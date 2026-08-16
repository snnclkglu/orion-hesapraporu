"use client";

// Revizyon editörü — bölüm bölüm ilerleyen sihirbaz yapısı.
// Adım sırası: 01 Teknik Özellikler → 02 Ana Kaldırma → 03 Yrd Kaldırma →
// 04 Kanca Bloğu → 05 Araba Yürütme → 06 Köprü Yürütme → 07 Ana Kiriş →
// 08 Buruşma → 09 Başkiriş → Özet.
//
// Her bölümde: girdiler/katalog seçimleri, ardından bölümün HESABI. Kontroller
// ayrı bir blokta toplanmaz — ilgili oldukları formül satırının hemen altında
// ✓/✗ olarak görünür (bağlantı haritası: calc/presentation/check-anchors.ts).
// Eşlenmemiş kontroller bölümün sonundaki "Diğer Kontroller" bloğuna düşer.
//
// Modüllerin sunum farkları module-adapters.ts'te tek tipe indirgenmiştir.

import {
  useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition,
} from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { activeModules, runCalc, type CalcInput } from "@/lib/calc/engine";
// Alternatiflerin uygunluğu artık burada hesaplanmaz; module-adapters.ts'teki
// saf `altOptionPass` çağrılır (PDF raporu da aynı kaynağı okur).
import { hoistSpecView } from "@/lib/calc/modules/hoistGroup";
import {
  SPEC_FIELDS,
  SPEC_GROUPS,
  fieldLabel,
} from "@/lib/calc/fields";
import { travelApplicationClass } from "@/lib/calc/derive";
import { travelBufferCatalogTypes, travelSpecView } from "@/lib/calc/modules/travelGroup";
import { parseHoistLoadClass } from "@/lib/calc/types";
import { checkAnchor } from "@/lib/calc/presentation/check-anchors";
import { FIELD_GROUPS, FIELD_GROUP_ORDER } from "@/lib/calc/field-groups";
import {
  ctxFor as buildCtx,
  moduleResult as readModuleResult,
} from "@/lib/calc/presentation/module-access";
import {
  HOIST_OF_HOOKBLOCK,
  MODULE_ORDER,
  isHoistKey,
  isHookBlockKey,
  isTravelKey,
} from "@/lib/calc/presentation/module-family";
import {
  CALC_FIELD,
  altKeyFor,
  sectionHideKeyFor,
  sectionNoteKeyFor,
  splitAltKey,
  type RevisionAltState,
  type RevisionAlts,
  type RevisionSectionNotes,
} from "@/lib/revision-load";
import { checkDisplay, checkKind, checkSeverity } from "@/lib/calc/types";
import type { AnyCheck, ModuleResult, TechnicalSpecs } from "@/lib/calc/types";
import type { TravelInputs, TravelValues } from "@/lib/calc/modules/travelGroup";
import type { GirderSelections } from "@/lib/calc/modules/mainGirder";
import type { WheelLoadInputs } from "@/lib/calc/modules/wheelLoads";
import { WheelSpacingEditor } from "@/components/wheel-spacing-editor";
import {
  ADAPTER_BY_KEY,
  MODULE_ADAPTERS,
  adapterTitle,
  moduleLabelFor,
  MODULE_PARENT,
  OPTIONAL_MODULE_KEYS,
  CONFIG_DRIVEN_MODULE_KEYS,
  altOptionPass,
  autoInputFlag,
  autoSelectionFlag,
  buildModuleDeps,
  derivationWarnings,
  headlineItems,
  hiddenSectionCheckIds,
  moduleAllowedByConfig,
  moduleDisplayNumbers,
  renumberSectionId,
  renumberTitle,
  withDerivedModules,
  type AdapterHeadline,
  type AdapterRow,
  type AdapterSection,
  type AnyFieldDef,
  type HeadlineItem,
  type ModuleKey,
  type ModuleState,
  type ModulesState,
} from "./module-adapters";
import {
  applyCatalogPick,
  bearingHousingCompatibilityKey,
  catalogIdentityFields,
  getCatalogMapping,
  catalogKindLabel,
  attrValueLabel,
} from "@/lib/catalog-mapping";
import { CatalogPicker } from "@/components/catalog-picker";
import { CatalogSheetButton } from "@/components/catalog-sheet-dialog";
import { SectionDiagram } from "@/components/diagrams/section-diagram";
import { FestoonSchematic } from "@/components/festoon-schematic";
import {
  BufferArrangementSchematic,
  BufferCalculationGuide,
} from "@/components/buffer-arrangement-guide";
import { travelFestoonDistanceM } from "@/lib/calc/modules/travelGroup";
import { MathFormula } from "@/components/math/math-formula";
import { StandardRefBadge } from "@/components/standard-ref-dialog";
import type { StandardContext } from "@/lib/standards/registry";
import { toDisplayUnit, toDisplayUnitLabel } from "@/lib/units";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useOverlay } from "@/lib/use-overlay";
import { useStoredFlag } from "@/lib/use-stored-flag";
import { saveRevision } from "./actions";

/**
 * Feston şemasının başlığı. Feston artık bir KATALOG bölümüdür (5.9): seri
 * seçimi, taşıyıcı yükü ve hız kontrolü yürütme modülünün girdi/seçimlerinde
 * durur. Burada kalan tek şey, o bölümün üstünde çizilen parametrik şemadır.
 */
const FESTOON_AXIS_TITLES: Partial<Record<ModuleKey, string>> = {
  trolley: "Ana Araba",
  auxTrolley: "Yardımcı Araba",
  mono1Trolley: "Monoray 1 Arabası",
  mono2Trolley: "Monoray 2 Arabası",
  bridge: "Köprü",
};

/**
 * Alternatif ekipman seçimi: seçim alanı olan her modül bölümü için 3'e kadar
 * alternatif saklanır; aktif olan canlı hesapta kullanılır, diğerlerinin
 * uygunluğu rozetle gösterilir.
 *
 * Tip TANIMI burada DEĞİL, `revision-load.ts`tedir — aynı yapıyı PDF raporu ve
 * ekipman listesi de okur. Burada yalnız editörün alıştığı adlarla yeniden
 * dışa verilir (anahtar: `${moduleKey}-${section.rawId}`).
 */
export type AltState = RevisionAltState;
export type AltsMap = RevisionAlts;

function fmt(v: number | string | null | undefined, digits = 2): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string") return v;
  if (Number.isInteger(v)) return v.toLocaleString("tr-TR");
  return v.toLocaleString("tr-TR", { maximumFractionDigits: digits });
}

/**
 * Bir bölümün standart tablolarında hangi satırın vurgulanacağı.
 *
 * Vurgu, hesabın GERÇEKTE kullandığı sınıfı gösterir: her kaldırma ve yürütme
 * grubu kendi FEM sınıflarıyla hesaplandığından bağlam da bölüm başına kurulur
 * (ör. köprü yürütme bölümünde köprünün M/T sınıfı vurgulanır). Yük grubu ve
 * malzeme, DIN 15018 Tablo 17/18 satır vurgusu için taşınır.
 */
function standardContextFor(
  specs: TechnicalSpecs,
  key: ModuleKey | undefined,
  girderSelections: GirderSelections | undefined
): StandardContext {
  const base: StandardContext = {
    mechanismClass: specs.hoistMechanismClass,
    usageClass: specs.hoistUsageClass,
    structureClass: specs.structureClass,
    loadGroup: parseHoistLoadClass(specs.hoistLoadClass).loadGroup,
    material: girderSelections?.fatigueMaterial,
  };
  if (!key) return base;
  if (isHoistKey(key)) {
    const v = hoistSpecView(specs, key);
    return { ...base, mechanismClass: v.mechanismClass, usageClass: v.usageClass };
  }
  if (isHookBlockKey(key)) {
    const v = hoistSpecView(specs, HOIST_OF_HOOKBLOCK[key]);
    return { ...base, mechanismClass: v.mechanismClass, usageClass: v.usageClass };
  }
  if (isTravelKey(key)) {
    const v = travelSpecView(specs, key, { hookEquipmentT: 0, trolleyWeightT: 0 });
    return {
      ...base,
      mechanismClass: v.mechanismClass,
      usageClass: v.usageClass,
      // CMAA 70 servis faktörü tablosunda vincin kendi sınıfının satırı
      // vurgulansın (FEM sınıfından türetilen uygulama sınıfı).
      applicationClass: travelApplicationClass(v.mechanismClass),
    };
  }
  return base;
}

// ---------------------------------------------------------------- Field

interface AutoFieldState {
  on: boolean;
  onToggle: (next: boolean) => void;
  warning?: string;
}

/**
 * "Elle Gir…" satırının değeri. Radix `Select.Item` BOŞ değer kabul etmez, bu
 * yüzden gerçek bir seçenekle çakışmayacak bir sözcük kullanılır.
 */
const CUSTOM_ENTRY = "__elle__";

/**
 * Elle girilmiş bir değerden listeye dönerken seçilecek seçenek: sayısal
 * listelerde en yakın basamak, metin listelerinde ilk seçenek. Boş kutuya
 * dönmek hesabı geçersiz bir değerle koşturmak olurdu.
 */
function nearestOption(options: string[], current: string, numeric: boolean): string | null {
  if (options.length === 0) return null;
  if (!numeric) return options.includes(current) ? current : options[0];
  const cur = parseFloat(current.replace(",", "."));
  if (!Number.isFinite(cur)) return options[0];
  let best = options[0];
  let bestDiff = Infinity;
  for (const o of options) {
    const v = parseFloat(o);
    if (!Number.isFinite(v)) continue;
    const d = Math.abs(v - cur);
    if (d < bestDiff) { bestDiff = d; best = o; }
  }
  return best;
}

function Field({
  def, value, onChange, disabled, auto, context, specs,
}: {
  def: AnyFieldDef;
  value: object;
  onChange: (next: object) => void;
  disabled?: boolean;
  /** Otomatik doldurulabilen alanlar için anahtar durumu */
  auto?: AutoFieldState;
  context?: StandardContext;
  /** Etiketi teknik özelliklere göre çözebilmek için (ör. kanca/tutucu tipi) */
  specs?: TechnicalSpecs;
}) {
  const v = (value as Record<string, unknown>)[def.key];
  const id = `f-${def.key}`;
  const locked = disabled || auto?.on === true;
  // Sayı alanı güvenliği: yazım sırasındaki ham metin lokalde tutulur; state'e
  // yalnız GEÇERLİ sayı yazılır (boş/geçersiz girdi sessizce 0 OLMAZ — hesap son
  // geçerli değerle koşar, alan hata gösterir). TR ondalık virgül desteklenir.
  const [draft, setDraft] = useState<string | null>(null);
  const [numError, setNumError] = useState<string | null>(null);
  // `allowCustom` alanlarında kullanıcı listeden "Elle Gir…"i seçtiyse kutu
  // serbest kalır. Dış kaynaklı değişimde (katalog seçimi) sıfırlanmaz — kip
  // kullanıcının kararıdır.
  const [customEntry, setCustomEntry] = useState(false);
  // Dıştan gelen değişimde (katalog seçimi, alternatif geçişi) taslak sıfırlanır;
  // kendi yazdığımız değer lastSent ile ayırt edilir.
  const lastSent = useRef<unknown>(v);
  useEffect(() => {
    if (v !== lastSent.current) {
      lastSent.current = v;
      setDraft(null);
      setNumError(null);
    }
  }, [v]);
  return (
    // SUBGRID: etiket ve girdi, ızgaranın SATIR RAYLARINA oturur. Böylece bir
    // satırdaki bütün girdiler aynı hizada başlar — standart rozeti olan alan
    // etiketi iki satıra taşsa bile komşusunun girdisi aşağı kaymaz. (Eskiden
    // aynı satırda girdi üstleri 449/453/461 px'e dağılıyordu.)
    // Alt dolgu satırlar arası ayrımı verir; ızgaranın satır boşluğu artık
    // etiket ile girdi arasındaki boşluktur.
    // `min-w-0`: ızgara sütununun varsayılan `min-width: auto` değeri, uzun bir
    // seçenek etiketi (ör. "HC2 — Normal kaldırma (genel amaçlı vinç)") olan
    // alanın sütununu içerik genişliğine zorluyor ve alan komşusunun üstüne
    // taşıyordu. Sıfırlanınca sütun küçülebiliyor, metin de kırpılıyor.
    <div className="grid min-w-0 content-start gap-1 pb-3 row-span-2 grid-rows-subgrid">
      <Label htmlFor={id} className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        <span>
          {fieldLabel(def, specs)}
          {def.unit ? (
            <>
              {" "}
              <span className="font-mono">[{toDisplayUnitLabel(def.unit)}]</span>
            </>
          ) : null}
        </span>
        {def.standardRef && (
          <StandardRefBadge code={def.standardRef} context={context} />
        )}
        {auto && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => auto.onToggle(!auto.on)}
            title={
              auto.on
                ? "Otomatik hesap açık — elle girmek için kapatın"
                : "Otomatik hesapla"
            }
            className={cn(
              // Dokunmatikte 16px'lik anahtar parmakla tutulmuyordu; farede
              // etiket satırı ince kalsın diye yükseklik yalnız kaba
              // işaretleme aygıtında büyür (sözleşme §2).
              "ml-auto inline-flex items-center gap-1 border px-1.5 py-px font-mono text-[11px] transition-colors pointer-coarse:min-h-10 pointer-coarse:px-2.5",
              auto.on
                ? "border-primary/40 bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted",
              disabled && "pointer-events-none opacity-50"
            )}
          >
            <span aria-hidden>{auto.on ? "●" : "○"}</span>
            OTOMATİK
          </button>
        )}
      </Label>
      {/* Denetim + yardım metinleri TEK kutuda: subgrid'in ikinci rayı bu
          kutudur, alan bileşeni her zaman iki çocuk taşır. */}
      <div className="grid min-w-0 content-start gap-1">
      {def.type === "select" ? (() => {
        // Sayısal select'ler (tambur/teker çapı, sıcaklık) değeri sayı olarak yazar.
        // Kayıtlı değer listede yoksa listeye eklenir (eski revizyonlar bozulmaz).
        const base = (def.optionsFor?.(specs ?? (value as TechnicalSpecs)) ?? def.options ?? []).map(String);
        const cur = v === null || v === undefined || v === "" ? "" : String(v);
        const opts = cur !== "" && !base.includes(cur) ? [cur, ...base] : base;

        // LİSTE BİR ÖNERİ OLABİLİR (`allowCustom`): tambur çapı gibi standart
        // serilerde mühendisin ara bir değeri elle yazması meşrudur. Elle giriş
        // kipi ya kullanıcı seçtiği için ya da KAYITLI DEĞER LİSTEDE OLMADIĞI
        // için açılır — ikincisi olmadan liste dışı bir kayıt açılır açılmaz
        // "seçilebilir bir seçenek" gibi görünür ve düzenlenemez kalırdı.
        if (def.allowCustom && (customEntry || (cur !== "" && !base.includes(cur)))) {
          return (
            <div className="relative">
              {def.diameter && (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-y-0 left-2 flex items-center font-mono text-sm text-muted-foreground"
                >
                  Ø
                </span>
              )}
              <Input
                id={id}
                className={cn(
                  "h-8 bg-background pr-24 font-mono tabular-nums pointer-coarse:h-10",
                  def.diameter && "pl-6"
                )}
                inputMode="decimal"
                value={draft !== null ? draft : cur}
                disabled={locked}
                aria-invalid={numError ? true : undefined}
                onChange={(e) => {
                  const raw = e.target.value;
                  setDraft(raw);
                  const nv = parseFloat(raw.trim().replace(",", "."));
                  if (raw.trim() === "") {
                    setNumError("Değer gerekli");
                  } else if (def.numeric && !Number.isFinite(nv)) {
                    setNumError("Geçersiz sayı");
                  } else {
                    setNumError(null);
                    const next = def.numeric ? nv : raw;
                    lastSent.current = next;
                    onChange({ ...value, [def.key]: next });
                  }
                }}
              />
              <button
                type="button"
                disabled={locked}
                onClick={() => {
                  setCustomEntry(false);
                  setDraft(null);
                  setNumError(null);
                  // Listeye dönerken en yakın standart değere düşülür: kutu boş
                  // bırakılsaydı hesap geçersiz bir çapla koşardı.
                  const nearest = nearestOption(base, cur, def.numeric === true);
                  if (nearest !== null && nearest !== cur) {
                    const next = def.numeric ? parseFloat(nearest) : nearest;
                    lastSent.current = next;
                    onChange({ ...value, [def.key]: next });
                  }
                }}
                className="absolute inset-y-0 right-0 px-2 font-mono text-[10px] text-muted-foreground hover:text-foreground disabled:opacity-50"
              >
                LİSTEDEN SEÇ
              </button>
            </div>
          );
        }
        return (
          <Select
            value={cur}
            onValueChange={(nv) => {
              if (nv === CUSTOM_ENTRY) {
                setCustomEntry(true);
                setDraft(cur);
                return;
              }
              onChange({
                ...value,
                [def.key]: def.numeric ? parseFloat(nv.replace(",", ".")) : nv,
              });
            }}
            disabled={locked}
          >
            {/* Yükseklik SelectTrigger'ın kendi `size` değerinden gelir
                (40px); buradaki eski `h-8` özgüllük yüzünden hiç
                uygulanmıyordu, dokunmatik payı zaten sağlanıyor. */}
            <SelectTrigger id={id} className="w-full">
              {/* Madde 30: çap alanlarında değerin başında "Ø" durur */}
              {def.diameter && (
                <span aria-hidden="true" className="font-mono text-muted-foreground">Ø</span>
              )}
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {opts.map((o) => (
                <SelectItem key={o} value={o}>
                  {def.optionLabels?.[o] ?? o}
                </SelectItem>
              ))}
              {def.allowCustom && (
                <SelectItem value={CUSTOM_ENTRY}>Elle Gir…</SelectItem>
              )}
            </SelectContent>
          </Select>
        );
      })() : (
        <>
          {/* Madde 30: çap alanında değerin başında sabit "Ø" işareti durur —
              girdinin KENDİSİNE yazılmaz, yalnız önüne konur. */}
          <div className="relative">
          {def.diameter && (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 left-2 flex items-center font-mono text-sm text-muted-foreground"
            >
              Ø
            </span>
          )}
          <Input
            id={id}
            className={cn(
              // Uygulamanın ANA veri girişi: farede 32px yoğunluk korunur,
              // parmakta 40px'e çıkar (sözleşme §2). Yazı boyutu ezilmez —
              // `Input` tabanı dokunmatikte 16px verir (iOS yakınlaştırması).
              "h-8 bg-background pointer-coarse:h-10",
              def.type === "number" && "font-mono tabular-nums",
              def.diameter && "pl-6",
              auto?.on && "border-primary/30 bg-primary/5"
            )}
            inputMode={def.type === "number" ? "decimal" : undefined}
            value={
              def.type === "number" && draft !== null
                ? draft
                : def.key === "bufferCatalogType"
                  ? attrValueLabel("type", v)
                  : String(v ?? "")
            }
            disabled={locked}
            aria-invalid={numError ? true : undefined}
            onChange={(e) => {
              const raw = e.target.value;
              if (def.type === "number") {
                setDraft(raw);
                const nv = parseFloat(raw.trim().replace(",", "."));
                if (raw.trim() === "") {
                  setNumError("Değer gerekli");
                } else if (!Number.isFinite(nv)) {
                  setNumError("Geçersiz sayı");
                } else {
                  setNumError(null);
                  lastSent.current = nv;
                  onChange({ ...value, [def.key]: nv });
                }
              } else {
                onChange({ ...value, [def.key]: raw });
              }
            }}
          />
          </div>
          {numError && (
            <p role="alert" className="font-mono text-[11px] text-destructive">
              ✗ {numError}
            </p>
          )}
        </>
      )}
      {auto?.on && auto.warning && (
        <p className="text-[11px] leading-snug text-destructive">{auto.warning}</p>
      )}
      {auto?.on && !auto.warning && def.hint && (
        <p className="text-[11px] leading-snug text-muted-foreground">{def.hint}</p>
      )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Checks

/**
 * Kontrolün sayısal karşılaştırması: "HESAPLANAN 616 MPa ≤ İZİN VERİLEN 2.450 MPa".
 * Hesaplanan değer kalın ve kontrolün sonucuna göre renklidir; hangi sayının
 * hesaptan çıktığını `checkDisplay` belirler (kontrolden kontrole değişir).
 */
function CheckComparison({ check }: { check: AnyCheck }) {
  const d = checkDisplay(check);
  const conv = (v: number) => toDisplayUnit(v, d.unit);
  const computed = conv(d.computed);
  const unit = computed.unit === "-" || !computed.unit ? "" : ` ${computed.unit}`;
  const limitText =
    d.operator === "…"
      ? `${fmt(conv(d.min ?? 0).value)} … ${fmt(conv(d.max ?? 0).value)}${unit}`
      : `${fmt(conv(d.limit ?? 0).value)}${unit}`;
  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-1.5 font-mono text-xs tabular-nums">
      <span className="text-[11px] tracking-wide text-muted-foreground uppercase">Hesaplanan</span>
      <span className={cn("font-semibold", check.pass ? "text-success" : "text-destructive")}>
        {fmt(computed.value)}
        {unit}
      </span>
      {d.operator !== "…" && <span className="text-muted-foreground">{d.operator}</span>}
      <span className="text-[11px] tracking-wide text-muted-foreground uppercase">İzin Verilen</span>
      <span className="text-foreground/80">{limitText}</span>
    </span>
  );
}

/**
 * Kontrolün DAYANAĞI ve AĞIRLIĞI — standart mı, üretici katalogu mu, firma
 * kabulü mü; sağlanmazsa yayını engelliyor mu. Rozet yalnız "standart +
 * engelleyici" varsayılanının dışındaki kontrollerde görünür (gürültü olmasın).
 */
const CHECK_KIND_LABEL: Record<string, string> = {
  standart: "standart",
  uretici: "üretici",
  firma: "firma kabulü",
  bilgi: "bilgilendirme",
};

function CheckOriginBadge({
  check,
  className,
}: {
  check: AnyCheck;
  className?: string;
}) {
  const kind = checkKind(check);
  const severity = checkSeverity(check);
  if (kind === "standart" && severity === "engelleyici") return null;
  const parts = [
    kind !== "standart" ? CHECK_KIND_LABEL[kind] : null,
    severity === "uyari" ? "uyarı" : null,
  ].filter(Boolean);
  if (parts.length === 0) return null;
  return (
    <span
      className={cn(
        "font-mono text-[11px] whitespace-nowrap text-muted-foreground",
        className
      )}
      title="Bu kontrolün dayanağı ve yayına etkisi"
    >
      ({parts.join(" · ")})
    </span>
  );
}

// ------------------------------------------------------------ Başlık kontrolü

/**
 * Başlık kontrolünün iki sayısı, gösterim birimine çevrilmiş metin hâlinde.
 * Hangi sayının hesaptan çıktığını `checkDisplay` belirler (kontrolden kontrole
 * değişir) — burada tahmin edilmez.
 */
function headlineTexts(check: AnyCheck): { computed: string; limit: string } {
  const d = checkDisplay(check);
  const conv = (v: number) => toDisplayUnit(v, d.unit);
  const c = conv(d.computed);
  const unit = c.unit === "-" || !c.unit ? "" : ` ${c.unit}`;
  const limit =
    d.operator === "…"
      ? `${fmt(conv(d.min ?? 0).value)} … ${fmt(conv(d.max ?? 0).value)}${unit}`
      : `${fmt(conv(d.limit ?? 0).value)}${unit}`;
  return { computed: `${fmt(c.value)}${unit}`, limit };
}

/**
 * Katalog seçim başlığının yanındaki rozet çifti (madde 3).
 *
 * "GEREKEN 5,00 · GERÇEKLEŞEN 5,42" — mühendis katalogdan seçim yaparken
 * kararını bu iki sayıya bakarak verir; renk kontrolün KENDİ `pass` değerinden
 * gelir, burada eşik karşılaştırması yapılmaz.
 */
function HeadlineBadge({
  item,
  headline,
}: {
  item: HeadlineItem;
  headline: AdapterHeadline;
}) {
  const { check, label } = item;
  const t = headlineTexts(check);
  return (
    <span
      title={`${check.label} — ${headline.limitLabel} ${t.limit} / ${headline.computedLabel} ${t.computed}`}
      className={cn(
        // Sayısal rozet mobilde bir kademe büyür (sözleşme §3)
        "inline-flex flex-wrap items-baseline gap-x-1.5 border px-2 py-0.5 font-mono text-xs tabular-nums sm:text-[11px]",
        check.pass
          ? "border-success/40 bg-success/10 text-success"
          : "border-destructive/50 bg-destructive/10 text-destructive"
      )}
    >
      <span aria-hidden="true" className="font-semibold">
        {check.pass ? "✓" : "✗"}
      </span>
      <span className="tracking-wide uppercase opacity-70">{headline.limitLabel}</span>
      <span className="font-semibold">{t.limit}</span>
      <span aria-hidden="true" className="opacity-40">·</span>
      <span className="tracking-wide uppercase opacity-70">{headline.computedLabel}</span>
      <span className="font-semibold">{t.computed}</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}

/**
 * Girdilerin hemen altında, katalog seçiminin üstünde duran özet şeridi
 * (madde 7 — tambur mili gerilmeleri). Bölümün ayrıntılı hesap satırları
 * ALT BÖLÜMDE aynen kalır; bu şerit yalnız kararı hızlandıran özettir.
 */
function HeadlineBand({
  items,
  headline,
}: {
  items: HeadlineItem[];
  headline: AdapterHeadline;
}) {
  if (items.length === 0) return null;
  return (
    <div>
      {headline.title && (
        <h3 className="oc-kicker mb-2 text-muted-foreground">{headline.title}</h3>
      )}
      <div className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
        {items.map(({ label, check }) => {
          const t = headlineTexts(check);
          return (
            <div
              key={check.id}
              className={cn(
                "flex flex-wrap items-baseline gap-x-2 gap-y-0.5 border-l-2 py-1 pl-2.5 text-xs",
                check.pass
                  ? "border-success/50 bg-success/5"
                  : "border-destructive/60 bg-destructive/5"
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "shrink-0 font-mono text-sm font-semibold",
                  check.pass ? "text-success" : "text-destructive"
                )}
              >
                {check.pass ? "✓" : "✗"}
              </span>
              <span className="font-medium">{label}</span>
              <span className="inline-flex flex-wrap items-baseline gap-x-1.5 font-mono text-[11px] tabular-nums">
                <span className="text-[11px] tracking-wide text-muted-foreground uppercase">
                  {headline.computedLabel}
                </span>
                <span
                  className={cn(
                    "font-semibold",
                    check.pass ? "text-success" : "text-destructive"
                  )}
                >
                  {t.computed}
                </span>
                <span className="text-muted-foreground">
                  {checkDisplay(check).operator}
                </span>
                <span className="text-[11px] tracking-wide text-muted-foreground uppercase">
                  {headline.limitLabel}
                </span>
                <span className="text-foreground/80">{t.limit}</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Formül satırının altına iliştirilen ince kontrol şeridi. */
function InlineCheck({
  check,
  context,
}: {
  check: AnyCheck;
  context?: StandardContext;
}) {
  return (
    <div
      className={cn(
        "mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 border-l-2 py-1 pl-2.5 text-xs",
        check.pass
          ? "border-success/50 bg-success/5"
          : "border-destructive/60 bg-destructive/5"
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "shrink-0 font-mono text-sm font-semibold",
          check.pass ? "text-success" : "text-destructive"
        )}
      >
        {check.pass ? "✓" : "✗"}
      </span>
      <span className={cn("font-medium", check.pass ? "text-success" : "text-destructive")}>
        {check.pass ? "UYGUN" : "UYGUN DEĞİL"}
      </span>
      <span className="text-foreground/80">{check.label}</span>
      <CheckComparison check={check} />
      {check.standard && (
        <StandardRefBadge code={check.standard} context={context} />
      )}
      <CheckOriginBadge check={check} />
    </div>
  );
}

/** Özet panosunda ve "Diğer Kontroller" bloğunda kullanılan tam satır. */
function CheckRow({ check, context }: { check: AnyCheck; context?: StandardContext }) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-md border px-3 py-2 text-sm",
        check.pass
          ? "border-success/25 bg-success/5"
          : "border-destructive/40 bg-destructive/5"
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "w-4 shrink-0 text-center font-mono text-sm font-semibold",
          check.pass ? "text-success" : "text-destructive"
        )}
      >
        {check.pass ? "✓" : "✗"}
      </span>
      <div className="min-w-0 flex-1">
        {/* Dar ekranda tek satıra kırpılan kontrol adı okunmuyordu; özet
            panosunda kırmızı kontrolü bulmanın tek yolu bu metindir. */}
        <div className="line-clamp-2 font-medium sm:line-clamp-1" title={check.label}>
          {check.label}
          <CheckOriginBadge check={check} className="ml-1 align-middle" />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <CheckComparison check={check} />
          {check.standard && (
            <StandardRefBadge code={check.standard} context={context} />
          )}
        </div>
      </div>
      <Badge
        variant={check.pass ? "secondary" : "destructive"}
        className={cn("shrink-0", check.pass && "border-transparent bg-success/15 text-success")}
      >
        {check.pass ? "UYGUN" : "UYGUN DEĞİL"}
      </Badge>
    </div>
  );
}

// ---------------------------------------------------------------- CalcRow

function CalcRow({
  row, ctx, checks, context,
}: {
  row: AdapterRow;
  ctx: unknown;
  /** Bu satıra bağlı kontroller (varsa hemen altında gösterilir) */
  checks?: AnyCheck[];
  context?: StandardContext;
}) {
  if (row.visible && !row.visible(ctx)) return null;
  const raw = row.read(ctx);
  const { value, unit } = toDisplayUnit(raw, row.unit);
  // Sözel durumlar (ör. katalog yük diyagramı yok) sayısal birim almaz.
  const displayUnit = typeof value === "string" ? undefined : unit;
  // Değerin rengi, satıra bağlı kontrolün sonucunu taşır: kontrol sağlanıyorsa
  // (hesaplanan değer izin verilen sınırın uygun tarafındaysa) YEŞİL, değilse
  // KIRMIZI. Kontrolü olmayan satırlar nötr kalır.
  const rowPass =
    checks && checks.length > 0 ? checks.every((c) => c.pass) : null;
  return (
    <div className="grid gap-1 border-b py-2.5 last:border-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="min-w-0 text-sm">{row.label}</span>
        {/* Hesaplanan değer rolü: salt-okunur, mono zemin — birim boşlukla ayrık.
            `ml-auto`: etiket uzunsa rozet alt satıra düşer ve `justify-between`
            onu SOLA yaslıyordu; hiza dar ekranda tamamen bozuluyordu. */}
        <span
          className={cn(
            "ml-auto shrink-0 px-2 py-0.5 font-mono text-sm font-semibold tabular-nums",
            rowPass === true && "bg-success/15 text-success",
            rowPass === false && "bg-destructive/15 text-destructive",
            rowPass === null && "bg-muted text-foreground"
          )}
        >
          {/* Madde 30: çap satırlarında değerin başına "Ø" konur */}
          = {row.diameter ? "Ø" : ""}{fmt(value, row.digits ?? 2)}{displayUnit ? ` ${displayUnit}` : ""}
        </span>
      </div>
      {row.formula && (
        // `oc-scrollx`: mobil tarayıcı kaydırma çubuğu çizmez; uzun formülün
        // sağa devam ettiğini gösteren tek ipucu kenar gölgesidir (sözleşme §6).
        <div
          className="oc-scrollx overflow-x-auto overscroll-x-contain rounded-md bg-muted/50 px-3 py-2 text-[15px] leading-relaxed text-foreground/90 [--oc-scroll-bg:var(--muted)]"
          title={row.formulaHint}
          aria-label={row.formulaHint ? `Formül açıklaması: ${row.formulaHint}` : undefined}
        >
          <MathFormula formula={row.formula} />
        </div>
      )}
      {row.standard && (
        <div className="flex flex-wrap gap-1.5">
          <StandardRefBadge code={row.standard} context={context} />
        </div>
      )}
      {checks?.map((c) => (
        <InlineCheck key={c.id} check={c} context={context} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- SectionTable

/**
 * Bölüm sonundaki özet tablosu — satır satır okunması zor bileşen dökümlerini
 * (ör. ana kiriş gerilme tablosu) tek bakışta verir. Dar ekranda yatay kayar.
 */
function SectionTable({
  table, ctx,
}: {
  table: NonNullable<AdapterSection["table"]>;
  ctx: unknown;
}) {
  let rows: (string | number)[][] = [];
  try {
    rows = table.build(ctx);
  } catch {
    rows = [];
  }
  if (rows.length === 0) return null;
  return (
    <div className="grid gap-2">
      <h3 className="oc-kicker text-muted-foreground">{table.title}</h3>
      {/* `.oc-scrollx`: hücreler `whitespace-nowrap` olduğu için çok sütunlu
          sonuç tablosu telefonda kabın birkaç katına çıkıyor ve sessizce
          kırpılıyordu (AGENTS md. 8). Bölümdeki tek ipuçsuz kaydırıcıydı. */}
      <div className="oc-scrollx overflow-x-auto overscroll-x-contain rounded-lg border [--oc-scroll-bg:var(--card)]">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b bg-muted/60">
              {table.headers.map((h) => (
                <th
                  key={h}
                  className="px-3 py-2 text-left font-mono text-[11px] font-semibold tracking-wide whitespace-nowrap text-muted-foreground uppercase"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b last:border-0">
                {r.map((cell, j) => (
                  <td
                    key={j}
                    className={cn(
                      "px-3 py-1.5 align-top",
                      typeof cell === "number" && "text-right font-mono tabular-nums"
                    )}
                  >
                    {typeof cell === "number" ? fmt(cell) : cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {table.note && (
        <p className="text-[11px] leading-snug text-muted-foreground">{table.note}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- RoleLegend
/** 4 değer rolünün tek satırlık lejantı: girdi / hesap / katalog / kontrol. */
function RoleLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 font-mono text-[11px] tracking-wide text-muted-foreground">
      <span aria-hidden="true" className="inline-block size-2.5 shrink-0 border border-input bg-background" />
      <span>GİRDİ</span>
      <span aria-hidden="true">·</span>
      <span aria-hidden="true" className="inline-block size-2.5 shrink-0 bg-muted" />
      <span>HESAP</span>
      <span aria-hidden="true">·</span>
      <span aria-hidden="true">▾</span>
      <span>KATALOG</span>
      <span aria-hidden="true">·</span>
      <span aria-hidden="true">
        <span className="text-success">✓</span>/<span className="text-destructive">✗</span>
      </span>
      <span>KONTROL</span>
    </div>
  );
}

// ---------------------------------------------------------------- Steps
type Step =
  | { kind: "specs"; key: string; title: string }
  | { kind: "module"; key: string; title: string; moduleKey: ModuleKey; section: AdapterSection }
  | { kind: "summary"; key: string; title: string };

function buildSteps(
  present: (k: ModuleKey) => boolean,
  numbers: Partial<Record<ModuleKey, number>>,
  specs: TechnicalSpecs
): Step[] {
  const steps: Step[] = [{ kind: "specs", key: "specs", title: "01 · Teknik Özellikler" }];
  for (const adapter of MODULE_ADAPTERS) {
    if (!present(adapter.key)) continue;
    const num = numbers[adapter.key] ?? 0;
    for (const section of adapter.sections) {
      // Koşullu bölüm (ör. emniyet freni olmayan kaldırma grubunda 2.8)
      if (section.visible && !section.visible(specs)) continue;
      const displayId = renumberSectionId(section.id, num);
      steps.push({
        kind: "module",
        key: `${adapter.key}-${section.rawId}`,
        title: `${displayId} ${section.title}`,
        moduleKey: adapter.key,
        // rawId/hücreler korunur; yalnız görüntü id'si yeniden numaralanır
        section: { ...section, id: displayId },
      });
    }
  }
  steps.push({ kind: "summary", key: "summary", title: "Özet · Kontrol Panosu" });
  return steps;
}

/** Kenar çubuğu navigasyonu için adımların modül bazlı gruplanması (sadece sunum). */
interface NavGroup {
  key: string;
  title: string | null; // null → grupsuz tek adım (specs / özet)
  moduleKey?: ModuleKey;
  /** Modül kapatılabilir mi (kenar çubuğunda göz düğmesi) */
  optional?: boolean;
  /** Modül şu an açık mı (kapalıysa grup boş ve soluk görünür) */
  enabled?: boolean;
  items: { step: Step; index: number }[];
}

/**
 * Navigasyon grupları: KAPALI modüller de listelenir (soluk, öğesiz) ki aynı
 * yerden tekrar açılabilsinler.
 */
function buildNavGroups(
  steps: Step[],
  numbers: Partial<Record<ModuleKey, number>>,
  present: (k: ModuleKey) => boolean,
  /** Vinç konfigürasyonuna göre bu bölüm hiç var olabilir mi */
  allowed: (k: ModuleKey) => boolean,
  /** Başlıkları çözmek için teknik özellikler (ör. "Ana Kiriş - 1") */
  specs?: TechnicalSpecs
): NavGroup[] {
  const groups: NavGroup[] = [];
  const specsStep = steps.findIndex((s) => s.kind === "specs");
  if (specsStep >= 0) {
    groups.push({
      key: "specs",
      title: null,
      items: [{ step: steps[specsStep], index: specsStep }],
    });
  }
  for (const adapter of MODULE_ADAPTERS) {
    // Konfigürasyonda hiç yer almayan bölümler (monoray yokken monoray
    // grupları) listede görünmez — kapalı da olsa gürültü yaratmasın.
    if (!allowed(adapter.key)) continue;
    const items = steps
      .map((step, index) => ({ step, index }))
      .filter(
        (it) => it.step.kind === "module" && it.step.moduleKey === adapter.key
      );
    groups.push({
      key: `mod-${adapter.key}`,
      title: present(adapter.key)
        ? renumberTitle(adapterTitle(adapter, specs), numbers[adapter.key] ?? 0)
        : moduleLabelFor(adapter.key, specs),
      moduleKey: adapter.key,
      optional: OPTIONAL_MODULE_KEYS.includes(adapter.key),
      enabled: present(adapter.key),
      items,
    });
  }
  const summaryStep = steps.findIndex((s) => s.kind === "summary");
  if (summaryStep >= 0) {
    groups.push({
      key: "summary",
      title: null,
      items: [{ step: steps[summaryStep], index: summaryStep }],
    });
  }
  return groups;
}

// ---------------------------------------------------------------- Modül durumu

// Bölüm durumu tipleri ve otomatik alan türetmesi module-adapters.ts'tedir:
// saf (React'ten bağımsız) oldukları için doğrudan test edilirler.

function initModules(initial: CalcInput): ModulesState {
  // `initial` yükleyiciden (revision-load) gelir ve TÜM bölümleri içerir.
  // Otomatik alanlar ilk açılışta da türetilir (kayıtlı değer eskimiş olabilir).
  const src = initial as unknown as Record<string, ModuleState | undefined>;
  const out = {} as ModulesState;
  for (const key of MODULE_ORDER) {
    const st = src[CALC_FIELD[key]];
    out[key] = {
      inputs: st?.inputs ?? {},
      selections: st?.selections ?? {},
    };
  }
  return withDerivedModules(out, initial.specs);
}

// ---------------------------------------------------------------- Editor

/** Bölüm rayının dar/geniş tercihi (tarayıcı başına kalıcı). */
const NAV_COLLAPSE_KEY = "orion.editor.nav.collapsed";

/** Bölüm listesinin kimliği — mobil aç/kapa düğmesi `aria-controls` ile bağlanır. */
const NAV_LIST_ID = "hesap-bolum-listesi";

/** Bölüm panelinin (mobilde alt tabaka) kimliği — iki denetim de buna bağlanır. */
const NAV_PANEL_ID = "hesap-bolum-paneli";

/**
 * Durum şeridinin sayfa başlığındaki yuvası.
 *
 * Kontrol özeti ve Kaydet düğmesi editörün ÜSTÜNDE ayrı bir kart olarak
 * duruyordu ve çalışma alanından iki satır yiyordu; artık PDF Rapor düğmesinin
 * soluna, sayfa başlığına taşınır. Başlık sunucu bileşenindedir (proje adı,
 * rozetler, rapor menüsü oradan gelir), durum ise istemci durumundan çıkar —
 * ikisini birleştirmenin en ucuz yolu bir portaldır. Yuva bulunamazsa (dev
 * önizleme gibi başlıksız bağlamlar) şerit editörün kendi içinde çizilir.
 */
export const EDITOR_STATUS_SLOT_ID = "hesap-durum-yuvasi";

/**
 * Çocuklarını sayfa başlığındaki yuvaya taşır; yuva yoksa yerinde bırakır.
 *
 * Hedef ilk boyamadan SONRA aranır (portal sunucu çıktısında yer alamaz);
 * bulunana kadar hiçbir şey çizilmez, aksi hâlde şerit bir kare editörün
 * içinde belirip sonra başlığa zıplardı.
 */
function subscribeStatusHost(onChange: () => void) {
  // Yuva artık SAYFA BAŞLIĞININ İÇİNDE ve başlık da kabuğun şeridine
  // portallanıyor: hedef ilk boyamada henüz DOM'da OLMAYABİLİR. Efekt sırasına
  // güvenmek kırılgandı (portal içeriği ikinci geçişte bağlanıyor); yuva doğar
  // doğmaz haber veren bir gözlemci kullanılır ve bulununca kapanır.
  if (document.getElementById(EDITOR_STATUS_SLOT_ID)) return () => {};
  const observer = new MutationObserver(() => {
    if (!document.getElementById(EDITOR_STATUS_SLOT_ID)) return;
    observer.disconnect();
    onChange();
  });
  observer.observe(document.body, { childList: true, subtree: true });
  return () => observer.disconnect();
}
const getStatusHost = () => document.getElementById(EDITOR_STATUS_SLOT_ID);
/** Sunucuda DOM yoktur: `undefined` "henüz bilinmiyor" demektir, "yok" değil. */
const getServerStatusHost = (): HTMLElement | null | undefined => undefined;

function StatusSlot({ children }: { children: React.ReactNode }) {
  const host = useSyncExternalStore(subscribeStatusHost, getStatusHost, getServerStatusHost);
  if (host === undefined) return null;
  if (host) return createPortal(children, host);
  // Yuvası olmayan bağlam (dev önizleme): şerit yerinde çizilir.
  return <div className="flex justify-end">{children}</div>;
}

/** Sabit çerçevenin açıldığı genişlik (app-shell `lg` üstünde çerçeve kurar). */
const DESKTOP_MQ = "(min-width: 1024px)";

/**
 * Ekran sabit çerçeve genişliğinde mi (≥1024px).
 *
 * Editörün iki davranışı doğrudan buna bağlıdır: bölüm rayının DAR kipi ve
 * bölüm değişiminde neyin başa sarılacağı. lg ALTINDA çerçeve yoktur — ray tam
 * genişliktedir ve sayfa doğal olarak kayar; genişliği bilmeden ikisi de yanlış
 * çalışıyordu. Sunucuda genişlik bilinemez: `false` (mobil düzen) varsayılır,
 * ilk istemci boyaması gerçek değeri okur (hidrasyon uyumlu).
 */
// Abonelik ve anlık görüntü fonksiyonları modül düzeyindedir: her boyamada
// yeni bir işlev üretilseydi React aboneliği baştan kurardı.
function subscribeDesktop(onChange: () => void) {
  const mq = window.matchMedia(DESKTOP_MQ);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}
const desktopSnapshot = () => window.matchMedia(DESKTOP_MQ).matches;
const desktopServerSnapshot = () => false;

function useIsDesktop(): boolean {
  return useSyncExternalStore(subscribeDesktop, desktopSnapshot, desktopServerSnapshot);
}

export function RevisionEditor({
  projectId, revisionId, readOnly, initial, initialAlts, initialSectionNotes, initialDisabled,
  initialHidden,
}: {
  projectId: string;
  revisionId: string;
  readOnly: boolean;
  /** Tüm bölümlerin verisi (kapalılar dâhil) — kapalı bölüm tekrar açılabilsin */
  initial: CalcInput;
  initialAlts?: AltsMap;
  /** Her hesap alt bölümüne bağlanan serbest mühendis notları. */
  initialSectionNotes?: RevisionSectionNotes;
  /** Kapalı hesap bölümleri */
  initialDisabled?: string[];
  /**
   * Gizlenen alt bölümler (`sectionHideKeyFor` anahtarları, ör. "trolley-5.7").
   * Gizlenen bölüm hesaba girmeye devam eder ama raporda, PDF'lerde ve
   * ekipman listesinde görünmez; girdileri korunur.
   */
  initialHidden?: string[];
}) {
  const [specs, setSpecs] = useState(initial.specs);
  const [mods, setMods] = useState<ModulesState>(() => initModules(initial));
  const [alts, setAlts] = useState<AltsMap>(initialAlts ?? {});
  const [sectionNotes, setSectionNotes] = useState<RevisionSectionNotes>(initialSectionNotes ?? {});
  // Gizlenen alt bölümler — başlıktaki kutucukla açılıp kapanır.
  const [hiddenSections, setHiddenSections] = useState<Set<string>>(
    () => new Set(initialHidden ?? [])
  );
  const [stepIndex, setStepIndex] = useState(0);
  /**
   * Kayan gövde. Bölüm değişince başa sarılır: aksi hâlde uzun bir bölümün
   * ortasından kısa bir bölüme geçince kullanıcı boşluğa bakıyor ve sayfa
   * kaymış gibi görünüyordu.
   */
  const bodyRef = useRef<HTMLDivElement | null>(null);
  // Esnek modüller: opsiyonel modüller (yardımcı kaldırma, kanca bloğu, ana
  // kiriş, buruşma, başkiriş) açık/kapalı. Başlangıç: revizyonda modül varsa
  // açık. Kapatılınca hesaba/rapora girmez ve numaralandırma yeniden dizilir.
  const [enabled, setEnabled] = useState<Record<ModuleKey, boolean>>(() => {
    const off = new Set(initialDisabled ?? []);
    const out = {} as Record<ModuleKey, boolean>;
    for (const k of MODULE_ORDER) out[k] = !off.has(k);
    return out;
  });
  // Sadece sunum: kenar çubuğunda elle açılan modül grupları
  // (aktif adımın grubu her zaman açıktır).
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  // Bölüm navigasyonu arama filtresi (bölüm adına göre)
  const [navQuery, setNavQuery] = useState("");
  /**
   * Bölüm rayı dar kip. Mühendis günün büyük kısmını bu ekranda geçirir ve
   * çalışma alanı 286 px'lik bir listeye harcanmamalıdır; dar kipte yalnız
   * BÖLÜM NUMARALARI kalır (ör. "2.3"), ad ipucu olarak durur.
   *
   * Tercih tarayıcıda kalıcıdır ve ilk boyamada okunur (`useStoredFlag`);
   * genişlik geçişi ilk boyamadan sonra açılır, aksi hâlde her açılışta ray
   * geniş çizilip animasyonla daralırdı.
   */
  const [navCollapsed, toggleNavCollapsed] = useStoredFlag(NAV_COLLAPSE_KEY);
  const isDesktop = useIsDesktop();
  /**
   * Dar kip YALNIZ masaüstünde geçerlidir. Tercih tarayıcı başına kalıcı
   * olduğu için masaüstünden telefona taşınıyordu ve orada ray tam genişlikte
   * olduğundan satırlarda yalnız "2.3" yazıyordu.
   */
  const narrowNav = navCollapsed && isDesktop;
  /**
   * Bölüm rayı telefonda/tablet portrede KAPALI başlar ve ALT TABAKA olarak
   * açılır.
   *
   * Eskiden ray `lg` altında içeriğin ÜSTÜNDE, akışın içinde duruyordu:
   * başlık + arama + liste ≈ 350px, yani kullanıcı her adımda önce bu listeyi
   * geçmek zorundaydı. Kapalı tutmak o sorunu çözdü ama yenisini yarattı —
   * 100+ adımlık bir sihirbazda telefonda geriye yalnız Geri/İleri kalıyordu
   * ve uzak bir bölüme atlamanın yolu yoktu.
   *
   * Çözüm konumdur, görünürlük değil: ray akıştan çıkar (içerik yerini geri
   * alır) ve adım şeridindeki "12/117 · bölüm adı" etiketine dokununca alttan
   * yükselir. Başparmak zaten orada. JSX ÇOĞALTILMAZ — aynı `<nav>` yalnız
   * `max-lg:` sınıflarıyla yeniden konumlanır; ikinci bir kopya `NAV_LIST_ID`
   * ile birlikte `aria-current` ve arama durumunu da ikizlerdi.
   */
  const [navOpenMobile, setNavOpenMobile] = useState(false);
  /** Alt tabakayı açan düğme — kapanışta odak buraya döner (`useOverlay`). */
  const navPanelRef = useRef<HTMLElement>(null);
  const closeNavMobile = useCallback(() => setNavOpenMobile(false), []);
  /**
   * Tabaka davranışı kabuğun mobil çekmecesiyle ORTAK (`useOverlay`): gövde
   * kaymaz, Esc kapatır, Tab tabakanın içinde döner, kapanınca odak geri gider.
   * `isDesktop` kapısı şart — telefonda açıkken pencere genişletilirse ray
   * kendi sütununa döner ve gövde kaydırması kilitli kalırdı.
   */
  useOverlay(navOpenMobile && !isDesktop, closeNavMobile, navPanelRef);
  const [pending, startTransition] = useTransition();

  // Kaydedilmemiş değişiklik takibi: kaydedilen state'lerden herhangi biri
  // değişince kirli; başarılı kayıtta temizlenir. İlk mount atlanır.
  const [dirty, setDirty] = useState(false);
  const dirtyMountRef = useRef(true);
  useEffect(() => {
    if (dirtyMountRef.current) {
      dirtyMountRef.current = false;
      return;
    }
    setDirty(true);
  }, [specs, mods, alts, sectionNotes, enabled, hiddenSections]);

  // Kayıp koruması: tarayıcı kapanışı/yenileme için beforeunload, uygulama içi
  // gezinme (Link tıklaması) için capture fazında confirm.
  useEffect(() => {
    if (!dirty || readOnly) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    const onDocClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement | null)?.closest?.("a[href]");
      if (!anchor) return;
      const href = anchor.getAttribute("href") ?? "";
      if (href.startsWith("#")) return;
      if (
        !window.confirm(
          "Kaydedilmemiş değişiklikler var; sayfadan ayrılırsanız kaybolur. Devam edilsin mi?"
        )
      ) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onDocClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onDocClick, true);
    };
  }, [dirty, readOnly]);

  /**
   * Bölüm hesaba giriyor mu: kullanıcının aç/kapa tercihi + vinç konfigürasyonu
   * (monoray adedi, ayrı yardımcı araba) + üst bölümün açık olması.
   */
  const activeSet = useMemo(() => {
    const off = MODULE_ORDER.filter((k) => enabled[k] === false);
    return activeModules(specs, off);
  }, [specs, enabled]);
  const present = useCallback((k: ModuleKey) => activeSet.has(k), [activeSet]);
  const numbers = useMemo(() => moduleDisplayNumbers(present), [present]);
  const STEPS = useMemo(() => buildSteps(present, numbers, specs), [present, numbers, specs]);
  // Bölüm değişince gövde başa sarılır — kayma hissinin ana kaynağı buydu.
  // `bodyRef` kabı YALNIZ lg üstünde kayar (`lg:overflow-y-auto`); lg altında
  // kaydırma sayfanındır ve çağrı sessizce ölüyordu: yeni bölüme geçen kullanıcı
  // sayfanın ortasında/dibinde kalıyordu.
  useEffect(() => {
    if (window.matchMedia(DESKTOP_MQ).matches) bodyRef.current?.scrollTo({ top: 0 });
    else window.scrollTo({ top: 0 });
  }, [stepIndex]);
  /**
   * Bölüm kenar çubuğunda listelenir mi: vinç konfigürasyonu buna izin
   * veriyorsa ve bağlı olduğu üst bölüm açıksa. (Kapalı ama listelenen bölüm
   * aynı yerden geri açılabilir; hiç var olamayacak bölüm ise gürültüdür.)
   */
  const allowedByConfig = useCallback(
    (k: ModuleKey) => {
      if (!moduleAllowedByConfig(specs, k)) return false;
      const parent = MODULE_PARENT[k];
      return parent ? activeSet.has(parent) : true;
    },
    [specs, activeSet]
  );
  const NAV_GROUPS = useMemo(
    () => buildNavGroups(STEPS, numbers, present, allowedByConfig, specs),
    [STEPS, numbers, present, allowedByConfig, specs]
  );
  // Modül kapatılınca adım sayısı azalabilir → aktif adımı sınırla
  useEffect(() => {
    setStepIndex((i) => Math.min(i, STEPS.length - 1));
  }, [STEPS.length]);

  // ------------------------------------------------- otomatik girdi türetmesi
  // "Otomatik" anahtarı açık alanlar (halat ağırlığı, makara verimi, yiv boyu,
  // tambur ağırlığı, yürütmenin uygulama sınıfı / Ks / Kt, ana kirişin ψh ve γc)
  // kaynak veri her değiştiğinde AYNI state güncellemesi içinde yeniden
  // hesaplanır ve girdiye (yiv boyunda: seçime) yazılır. Böylece hesap motoru,
  // PDF rapor ve ekipman listesi hep aynı değeri görür; alan elle düzenlenmek
  // istenirse anahtar kapatılır ve serbest kalır.
  // Buradaki liste yalnız UYARILARDIR (otomatik açık ama kaynak veri eksik);
  // değerin kendisi `withDerivedModules` ile state'e yazılır.
  const warningsByModule = useMemo(() => derivationWarnings(mods, specs), [mods, specs]);

  /** Kapalı bölümlerin verisi de kayda gider — yeniden açılınca geri gelsin. */
  const fullCalcInput: CalcInput = useMemo(() => {
    const out: Record<string, unknown> = { specs };
    for (const k of MODULE_ORDER) {
      out[CALC_FIELD[k]] =
        k === "buckling" ? { inputs: mods[k].inputs } : mods[k];
    }
    return out as unknown as CalcInput;
  }, [specs, mods]);

  const calcInput: CalcInput = useMemo(() => {
    const out: Record<string, unknown> = { specs };
    for (const k of MODULE_ORDER) {
      if (!activeSet.has(k)) continue;
      out[CALC_FIELD[k]] = k === "buckling" ? { inputs: mods[k].inputs } : mods[k];
    }
    return out as unknown as CalcInput;
  }, [specs, mods, activeSet]);

  const disabledList = useMemo(
    () => OPTIONAL_MODULE_KEYS.filter((k) => enabled[k] === false),
    [enabled]
  );
  const result = useMemo(() => runCalc(calcInput), [calcInput]);
  const deps = useMemo(() => buildModuleDeps(calcInput, result), [calcInput, result]);
  /** Kayda giden gizli alt bölüm listesi (sıralı — diff satırı kararlı olsun). */
  const hiddenList = useMemo(() => [...hiddenSections].sort(), [hiddenSections]);
  /**
   * Gizlenen alt bölümlerin kontrol kimlikleri. Motor bölüm sınırı bilmez ve
   * kontrolleri yine üretir; kullanıcıya GÖSTERİLEN sayılar (durum şeridi,
   * özet pano, ray sayaçları) bu kümeyle süzülür — vinçte olmayan bir
   * ekipmanın kırmızı kontrolü raporu "uygun değil" gösteremez.
   */
  const hiddenCheckIdSet = useMemo(
    () => hiddenSectionCheckIds(hiddenSections),
    [hiddenSections]
  );
  const visibleChecks = useMemo(
    () => result.allChecks.filter((c) => !hiddenCheckIdSet.has(c.id)),
    [result, hiddenCheckIdSet]
  );
  const failCount = visibleChecks.filter((c) => !c.pass).length;
  const step = STEPS[Math.min(stepIndex, STEPS.length - 1)] ?? STEPS[0];

  // Bağlam aktif bölüme göre kurulur: pop-up'ta vurgulanan satır, o bölümün
  // hesabında gerçekten kullanılan sınıftır.
  const stdContext = useMemo(
    () =>
      standardContextFor(
        specs,
        step.kind === "module" ? step.moduleKey : undefined,
        mods.girder.selections as GirderSelections
      ),
    [specs, step, mods.girder.selections]
  );

  // ------------------------------------------------------------ modül erişimi
  function moduleResult(key: ModuleKey): ModuleResult<unknown> | undefined {
    return readModuleResult(result, key);
  }

  /**
   * Modül state'ini yazarken TÜM bölümlerin türetmelerini tazeler.
   *
   * Yalnız yazılan bölüm değil hepsi geçirilir, çünkü türetmeler bölüm sınırını
   * aşar: ana kirişin ψhA/ψhK katsayıları ana kaldırmanın kanca ve halat
   * ağırlıklarından beslenir. Değişmeyen bölümler aynı nesne olarak kalır.
   */
  function writeModule(
    m: ModulesState,
    key: ModuleKey,
    patch: { inputs?: object; selections?: object },
    nextSpecs = specs
  ): ModulesState {
    const merged: ModuleState = { ...m[key], ...patch };
    return withDerivedModules({ ...m, [key]: merged }, nextSpecs);
  }

  function setModuleInputs(key: ModuleKey, next: object) {
    setMods((m) => writeModule(m, key, { inputs: next }));
  }

  function setModuleSelections(key: ModuleKey, next: object) {
    setMods((m) => writeModule(m, key, { selections: next }));
  }

  /**
   * Teknik özellik değişimi: kaldırma yüksekliği, kapasite ve ortam sıcaklığı
   * otomatik girdileri besler; hepsi aynı güncellemede yeniden türetilir.
   */
  function updateSpecs(next: TechnicalSpecs) {
    // Vinç konfigürasyonu bir bölümü YENİ olanaklı kıldıysa (monoray adedi
    // arttı, yardımcı kaldırma ayrı arabaya alındı) o bölüm kendiliğinden
    // açılır — kullanıcı ayrıca kutucuk işaretlemek zorunda kalmasın.
    const newlyAllowed = CONFIG_DRIVEN_MODULE_KEYS.filter(
      (k) => !moduleAllowedByConfig(specs, k) && moduleAllowedByConfig(next, k)
    );
    if (newlyAllowed.length > 0) {
      setEnabled((e) => {
        const out = { ...e };
        for (const k of newlyAllowed) out[k] = true;
        return out;
      });
    }
    setSpecs(next);
    setMods((m) => withDerivedModules(m, next));
  }

  /**
   * Sunum katmanı ctx'i. Modül erişim katmanı (module-access) hem editör hem
   * PDF raporu için aynı bağlamı kurar; burada canlı `calcInput` kullanılır.
   */
  function ctxFor(key: ModuleKey): unknown {
    return buildCtx(key, calcInput, result, deps);
  }

  function sectionChecks(key: ModuleKey, section: AdapterSection): AnyCheck[] {
    const mr = moduleResult(key);
    if (!mr) return [];
    const prefix = ADAPTER_BY_KEY[key].checkPrefix;
    return section.checkSuffixes
      .map((s) => mr.checks.find((c) => c.id === `${prefix}${s}`))
      .filter((c): c is AnyCheck => Boolean(c));
  }

  function sectionStatus(key: ModuleKey, section: AdapterSection): "pass" | "fail" | "none" {
    // Gizli alt bölüm sayılmaz: rayın grup başlığındaki "n/m" ve kırmızı işaret
    // yalnız rapora GİREN bölümleri anlatır.
    if (hiddenSections.has(sectionHideKeyFor(key, section.rawId))) return "none";
    const checks = sectionChecks(key, section);
    if (checks.length === 0) return "none";
    return checks.every((c) => c.pass) ? "pass" : "fail";
  }

  /**
   * Bölüm kontrollerini satırlara dağıtır: anchorId'si eşleşenler ilgili
   * formül satırının altına, kalanlar bölüm sonuna.
   */
  function distributeChecks(key: ModuleKey, section: AdapterSection) {
    const prefix = ADAPTER_BY_KEY[key].checkPrefix;
    const byRow = new Map<string, AnyCheck[]>();
    const rest: AnyCheck[] = [];
    const rowIds = new Set(section.rows.map((r) => r.anchorId));
    for (const c of sectionChecks(key, section)) {
      const suffix = c.id.startsWith(prefix) ? c.id.slice(prefix.length) : c.id;
      const anchor = checkAnchor(key, section.rawId, suffix);
      if (anchor && rowIds.has(anchor)) {
        const list = byRow.get(anchor);
        if (list) list.push(c);
        else byRow.set(anchor, [c]);
      } else {
        rest.push(c);
      }
    }
    return { byRow, rest };
  }

  // ---------------------------------------------------------- alternatifler
  function pickSelection(sel: object, keys: readonly string[]): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    const rec = sel as Record<string, unknown>;
    for (const k of keys) out[k] = rec[k];
    return out;
  }

  /** Kaydetmeden önce aktif alternatifi canlı seçim değerleriyle eşitler */
  function syncedAlts(): AltsMap {
    const next: AltsMap = { ...alts };
    for (const [key, st] of Object.entries(next)) {
      const parts = splitAltKey(key);
      if (!parts) continue;
      const moduleKey = parts.moduleKey as ModuleKey;
      const adapter = ADAPTER_BY_KEY[moduleKey];
      const section = adapter?.sections.find((s) => s.rawId === parts.sectionRawId);
      if (!section) continue;
      const options = [...st.options];
      options[st.active] = pickSelection(mods[moduleKey].selections, section.selectionKeys);
      next[key] = { ...st, options };
    }
    return next;
  }

  function altStateFor(key: ModuleKey, section: AdapterSection): AltState {
    return (
      alts[altKeyFor(key, section.rawId)] ?? {
        active: 0,
        options: [pickSelection(mods[key].selections, section.selectionKeys)],
      }
    );
  }

  /**
   * Alternatifin uygunluk rozeti. Hesap BURADA yapılmaz: PDF raporundaki
   * "SEÇENEKLER" bloğuyla aynı saf yardımcı (`altOptionPass`) çağrılır ki iki
   * yüzey aynı sayıyı iki ayrı yoldan üretip sessizce ayrışmasın.
   */
  function altSectionPass(
    key: ModuleKey,
    section: AdapterSection,
    option: Record<string, unknown>
  ): boolean | null {
    return altOptionPass(
      key, section, specs, mods[key].inputs, mods[key].selections, option, deps
    );
  }

  function switchAlt(key: ModuleKey, section: AdapterSection, index: number) {
    const altKey = altKeyFor(key, section.rawId);
    const sel = mods[key].selections;
    const st = altStateFor(key, section);
    if (index === st.active) return;
    const options = [...st.options];
    options[st.active] = pickSelection(sel, section.selectionKeys);
    setModuleSelections(key, { ...sel, ...options[index] });
    setAlts({ ...alts, [altKey]: { active: index, options } });
  }

  function addAlt(key: ModuleKey, section: AdapterSection) {
    const altKey = altKeyFor(key, section.rawId);
    const st = altStateFor(key, section);
    if (st.options.length >= 3) return;
    const current = pickSelection(mods[key].selections, section.selectionKeys);
    const options = [...st.options];
    options[st.active] = current;
    options.push({ ...current });
    setAlts({ ...alts, [altKey]: { active: options.length - 1, options } });
  }

  function removeAlt(key: ModuleKey, section: AdapterSection) {
    const altKey = altKeyFor(key, section.rawId);
    const sel = mods[key].selections;
    const st = altStateFor(key, section);
    if (st.options.length <= 1) return;
    const options = st.options.filter((_, i) => i !== st.active);
    setModuleSelections(key, { ...sel, ...options[0] });
    setAlts({ ...alts, [altKey]: { active: 0, options } });
  }

  function handleSave() {
    startTransition(async () => {
      const res = await saveRevision(
        projectId,
        revisionId,
        calcInput,
        syncedAlts(),
        fullCalcInput,
        disabledList,
        sectionNotes,
        hiddenList
      );
      if (res.error) toast.error(res.error);
      else {
        setDirty(false);
        toast.success("Revizyon kaydedildi.");
      }
    });
  }

  function toggleModule(key: ModuleKey, on: boolean) {
    setEnabled((m) => ({ ...m, [key]: on }));
  }

  /** Alt bölümü gizle/göster — başlıktaki kutucuktan çağrılır. */
  function toggleSectionHidden(key: ModuleKey, sectionRawId: string, hide: boolean) {
    const hideKey = sectionHideKeyFor(key, sectionRawId);
    setHiddenSections((current) => {
      const next = new Set(current);
      if (hide) next.add(hideKey);
      else next.delete(hideKey);
      return next;
    });
  }

  // ------------------------------------------------------------ renderers
  /**
   * Kart iç boşluğu telefonda bir kademe kısılır: 24px'lik yatay boşluk
   * 375px'lik ekranda hesap satırına 271px bırakıyordu.
   */
  const cardSpacing = "[--card-spacing:--spacing(4)] sm:[--card-spacing:--spacing(6)]";

  function renderSpecs() {
    return (
      <Card className={cardSpacing}>
        <CardHeader className="border-b pb-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="inline-flex h-6 items-center bg-primary/10 px-2 font-mono text-xs font-semibold tabular-nums text-primary">
              01
            </span>
            <span className="tracking-tight">Teknik Özellikler</span>
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Vincin ana teknik verileri. Tüm hesap bölümleri bu değerlerden beslenir.
          </p>
        </CardHeader>
        <CardContent className="grid gap-6">
          {SPEC_GROUPS.map((group) => {
            if (group.requiresModule && !present(group.requiresModule)) return null;
            if (group.visible && !group.visible(specs)) return null;
            const fields = SPEC_FIELDS.filter(
              (f) =>
                f.group === group.key &&
                (!f.requiresModule || present(f.requiresModule)) &&
                (!f.visible || f.visible(specs))
            );
            if (fields.length === 0) return null;
            return (
              <section key={group.key} className="grid gap-2.5">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 border-b pb-1.5">
                  <h3 className="oc-kicker text-foreground/80">{group.title}</h3>
                  {group.description && (
                    <span className="text-[11px] text-muted-foreground">
                      {group.description}
                    </span>
                  )}
                </div>
                <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                  {fields.map((f) => (
                    <Field
                      key={f.key}
                      def={f}
                      value={specs}
                      onChange={(next) => updateSpecs(next as TechnicalSpecs)}
                      disabled={readOnly}
                      context={stdContext}
                      specs={specs}
                    />
                  ))}
                </div>
              </section>
            );
          })}

          {/* Hesap bölümleri — açık/kapalı; numaralandırma dinamik.
              Vinç konfigürasyonundan doğan bölümler (yardımcı araba, monoray)
              yalnız konfigürasyon izin verdiğinde listelenir. */}
          <section className="grid gap-2.5 border-t pt-4">
            <div className="border-b pb-1.5">
              <h3 className="oc-kicker text-foreground/80">Hesap Bölümleri</h3>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Kapatılan bölüm hesaba ve rapora girmez; bölüm numaraları otomatik
                yeniden dizilir. Aynı anahtarlar kenar çubuğundaki düğmede de var.
              </p>
            </div>
            <div className="grid gap-x-4 gap-y-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {OPTIONAL_MODULE_KEYS.filter((k) => moduleAllowedByConfig(specs, k)).map((k) => {
                const parent = MODULE_PARENT[k];
                const parentOff = parent ? !present(parent) : false;
                const fromConfig = CONFIG_DRIVEN_MODULE_KEYS.includes(k);
                return (
                  <label
                    key={k}
                    className={cn(
                      // Satır ~20px'ti; onay kutusu etiketiyle birlikte tek
                      // dokunma hedefidir, parmakla tutulabilmesi gerekir.
                      "inline-flex cursor-pointer items-center gap-2 py-1.5 text-sm pointer-coarse:min-h-10",
                      parentOff && "cursor-not-allowed opacity-45"
                    )}
                    title={
                      parentOff
                        ? `Önce ${moduleLabelFor(parent!, specs)} bölümünü açın`
                        : fromConfig
                          ? "Vinç konfigürasyonundan geldi"
                          : undefined
                    }
                  >
                    <input
                      type="checkbox"
                      checked={present(k)}
                      disabled={readOnly || parentOff}
                      onChange={(e) => toggleModule(k, e.target.checked)}
                      className="size-4 accent-primary"
                    />
                    {moduleLabelFor(k, specs)}
                  </label>
                );
              })}
            </div>
          </section>
        </CardContent>
      </Card>
    );
  }

  function renderModuleSection(key: ModuleKey, section: AdapterSection) {
    const adapter = ADAPTER_BY_KEY[key];
    const ctx = ctxFor(key);
    const inputs = mods[key].inputs as object;
    const sel = mods[key].selections as object;
    const bufferGuideValues = section.rawId === "5.8" && isTravelKey(key)
      ? (moduleResult(key)?.values as TravelValues | undefined)
      : undefined;
    const bufferGuideSnapshot = bufferGuideValues
      ? {
          model: (sel as { bufferModel?: string }).bufferModel,
          type: bufferGuideValues.bufferType,
          impactSpeedMps: bufferGuideValues.bufferImpactSpeedMps,
          massPerBufferT: bufferGuideValues.collisionLoadT,
          impactEnergyKj: bufferGuideValues.impactEnergyKj,
          driveEnergyKj: bufferGuideValues.bufferDriveEnergyKj,
          totalEnergyKj: bufferGuideValues.totalEnergyKj,
          catalogEnergyKj: bufferGuideValues.bufferCatalogEnergyAtImpactKj,
          compressionPct: bufferGuideValues.bufferCompressionPct,
          compressionLimitPct: (sel as { bufferMaxCompressionPct?: number }).bufferMaxCompressionPct,
          reactionForceKn: bufferGuideValues.bufferForceKn,
          avgDecelerationMps2: bufferGuideValues.bufferAvgDecelerationMps2,
          maxDecelerationMps2: bufferGuideValues.bufferMaxDecelerationMps2,
        }
      : undefined;
    const checks = sectionChecks(key, section);
    const { byRow, rest } = distributeChecks(key, section);
    const scopedInputs = section.inputScope ? section.inputScope.get(inputs) : inputs;
    // `visibleWhen`: alan MODÜLÜN KENDİ girdilerine bağlıdır (ör. ray altı T
    // profil ölçüleri yalnız anahtar "Var" iken görünür). Gizlenen alanın
    // DEĞERİ KORUNUR — sıfırlanmaz, anahtar geri açıldığında geri gelir
    // (bölüm aç/kapa mantığının aynısı).
    const visibleInputDefs = section.inputDefs.filter(
      (f) => f.visibleWhen?.(scopedInputs as Record<string, unknown>) ?? true
    );
    // Öbekli alanlar kendi başlıklı bloklarında, öbeksizler düz ızgarada.
    const fieldGroupBlocks = FIELD_GROUP_ORDER.flatMap((gk) => {
      const defs = visibleInputDefs.filter((f) => f.fieldGroup === gk);
      return defs.length > 0 ? [{ group: FIELD_GROUPS[gk], defs }] : [];
    });
    const ungroupedInputDefs = visibleInputDefs.filter((f) => !f.fieldGroup);
    const warnings = warningsByModule[key] ?? [];
    // Başlık kontrolleri: bölümün özünü seçim yapılan yerde tekrar eden özet
    // (madde 3 rozet çifti / madde 7 gerilme şeridi). Ayrıntılı satırlar kalır.
    const headline = section.headline;
    const headlines = headlineItems(
      adapter.checkPrefix,
      section,
      moduleResult(key)?.checks
    );
    const noteKey = sectionNoteKeyFor(key, section.rawId);
    const noteIsEnabled = Object.prototype.hasOwnProperty.call(sectionNotes, noteKey);
    const sectionNote = sectionNotes[noteKey] ?? "";
    // Alt bölüm gizleme: kutucuk başlıktadır, içerik soluk ama düzenlenebilir
    // kalır (girdiler korunur — bölüm aç/kapa mantığının aynısı).
    const isHidden = hiddenSections.has(sectionHideKeyFor(key, section.rawId));

    function enableSectionNote() {
      setSectionNotes((current) => ({ ...current, [noteKey]: "" }));
    }

    function updateSectionNote(note: string) {
      setSectionNotes((current) => ({ ...current, [noteKey]: note }));
    }

    function removeSectionNote() {
      setSectionNotes((current) => {
        const next = { ...current };
        delete next[noteKey];
        return next;
      });
    }

    const onInputsChange = (next: object) => {
      setModuleInputs(
        key,
        section.inputScope ? section.inputScope.set(inputs, next) : next
      );
    };

    /**
     * Otomatik doldurulabilen alanların anahtar durumu.
     *
     * Anahtar HER ZAMAN girdilerde durur — türetilen değer girdiye de seçime de
     * yazılabilir (yiv boyu bir SEÇİM alanıdır). Bu yüzden tek bir yardımcı
     * kullanılır; hangi haritadan okunacağını çağıran belirler.
     */
    function autoStateFrom(
      flag: string | undefined,
      fieldKey: string
    ): AutoFieldState | undefined {
      if (!flag) return undefined;
      const rec = inputs as unknown as Record<string, unknown>;
      return {
        on: rec[flag] === true,
        onToggle: (next) =>
          setModuleInputs(key, { ...(inputs as object), [flag]: next }),
        warning: warnings.find((w) => w.field === fieldKey)?.message,
      };
    }

    /** Girdi ızgarasındaki alanın otomatik anahtarı (kaldırma/yürütme/ana kiriş). */
    function autoStateFor(fieldKey: string): AutoFieldState | undefined {
      return autoStateFrom(autoInputFlag(key, fieldKey), fieldKey);
    }

    /** Katalog seçimi ızgarasındaki alanın otomatik anahtarı (yiv boyu). */
    function autoSelectionStateFor(fieldKey: string): AutoFieldState | undefined {
      return autoStateFrom(autoSelectionFlag(key, fieldKey), fieldKey);
    }

    return (
      <Card className={cardSpacing}>
        <CardHeader className="border-b pb-4">
          <CardTitle className="flex flex-wrap items-center gap-2 text-base">
            <span className="inline-flex h-6 items-center bg-primary/10 px-2 font-mono text-xs font-semibold tabular-nums text-primary">
              {section.id}
            </span>
            <span className="tracking-tight">{section.title}</span>
            {/* Rozet, kenar çubuğuyla AYNI dinamik numarayı basar: adapter.title
                sabit "05 · …" taşır, oysa bölüm numarası vince dahil modüllere
                göre yeniden dizilir (kenar çubuğu "04" derken rozet "05"
                diyordu). Numara tek kaynaktan — `numbers` haritasından — gelir. */}
            <Badge variant="outline" className="font-normal text-muted-foreground">
              {renumberTitle(adapterTitle(adapter, specs), numbers[key] ?? 0)}
            </Badge>
            {/* Sağ grup: bölüm notu düğmesi + kontrol rozeti.
                Not düğmesi eskiden içeriğin ilk satırındaydı ve HER bölümde bir
                satır boyu yer yiyordu — üstelik çoğu bölümde hiç kullanılmıyor.
                Başlık satırında zaten boş duran sağ kenara alındı. */}
            <span className="ml-auto flex items-center gap-2">
              {!noteIsEnabled && !readOnly && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={enableSectionNote}
                  title="Bu alt bölüme rapora girecek bir not ekle"
                  className="h-6 px-2 text-xs font-normal text-muted-foreground hover:text-foreground"
                >
                  + Bölüm Notu
                </Button>
              )}
              {/* Alt bölüm gizleme kutucuğu: işaretliyken bölüm hesap
                  raporunda, PDF'lerde ve ekipman listesinde görünmez.
                  Girdiler korunur — kutucuk geri açılınca bölüm aynen döner.
                  Salt-okunur revizyonda kutucuk yerine rozet basılır. */}
              {!readOnly && (
                <label
                  className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-normal text-muted-foreground hover:text-foreground pointer-coarse:min-h-10"
                  title="Bu alt bölümü gizle: hesap raporunda, PDF'lerde ve ekipman listesinde görünmez. Girdiler korunur."
                >
                  <input
                    type="checkbox"
                    checked={isHidden}
                    onChange={(e) => toggleSectionHidden(key, section.rawId, e.target.checked)}
                    className="size-3.5 accent-primary"
                  />
                  Gizle
                </label>
              )}
              {isHidden ? (
                <Badge variant="outline" className="font-normal text-muted-foreground">
                  Gizli
                </Badge>
              ) : (
                checks.length > 0 && (
                  <Badge
                    variant={checks.every((c) => c.pass) ? "secondary" : "destructive"}
                    className={cn(
                      checks.every((c) => c.pass) &&
                        "border-transparent bg-success/15 text-success"
                    )}
                  >
                    {checks.filter((c) => c.pass).length}/{checks.length} uygun
                  </Badge>
                )
              )}
            </span>
          </CardTitle>
          {section.description && (
            <p className="text-sm text-muted-foreground">{section.description}</p>
          )}
        </CardHeader>
        {/* Gizli bölümün içeriği SOLUK ama düzenlenebilir kalır: mühendis
            değerleri görmeye ve düzeltmeye devam edebilir, yalnız çıktılar
            bölümü taşımaz. İçeriği tamamen saklamak, kutucuğu geri açmadan
            önce "ne gizlediğimi göreyim" ihtiyacını karşılayamazdı. */}
        {isHidden && (
          <div className="mx-(--card-spacing) border border-dashed bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            Bu alt bölüm gizli: hesap raporunda, PDF çıktılarında ve ekipman
            listesinde görünmez; kontrolleri özetlere sayılmaz. Girdiler
            korunur — «Gizle» kutusunu kaldırınca bölüm aynen geri gelir.
          </div>
        )}
        <CardContent className={cn("grid gap-5", isHidden && "opacity-55")}>
          {/* Not KUTUSU yalnız not açıkken yer kaplar; "not ekle" düğmesi
              başlık satırındadır (bkz. CardTitle). */}
          {noteIsEnabled && (
            <section className="grid gap-2 border border-dashed bg-muted/20 p-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="oc-kicker text-foreground/80">Bölüm Notu</h3>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Kaydedildiğinde hesap raporunda bu alt bölümün altında görünür.
                  </p>
                </div>
                {!readOnly && (
                  <Button type="button" variant="ghost" size="sm" onClick={removeSectionNote}>
                    Notu Kaldır
                  </Button>
                )}
              </div>
              <Textarea
                value={sectionNote}
                disabled={readOnly}
                onChange={(event) => updateSectionNote(event.target.value)}
                placeholder="Not"
                rows={3}
              />
            </section>
          )}
          {/* Parametrik diyagram (7.1 kesit, 5.2/6.2 teker mili, 2.1/3.1 donanım) */}
          {section.rawId === "5.8" && isTravelKey(key) ? (
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
              <SectionDiagram
                moduleKey={key}
                sectionId={section.rawId}
                input={calcInput}
                result={result}
              />
              <BufferArrangementSchematic
                installedCount={(inputs as TravelInputs).bufferCount}
                axisTitle={FESTOON_AXIS_TITLES[key] ?? "Hareket Ekseni"}
              />
            </div>
          ) : (
            <SectionDiagram
              moduleKey={key}
              sectionId={section.rawId}
              input={calcInput}
              result={result}
            />
          )}
          {/* Özel düzenleyici: teker düzeni ölçü zinciri (10.1). Teker adedi
              Köprü Yürütme bölümünden okunur; geometri BİR RAY için girilir. */}
          {section.editor === "wheelSpacing" && (
            <WheelSpacingEditor
              totalWheels={(mods.bridge.inputs as TravelInputs).wheelCount}
              value={(inputs as WheelLoadInputs).wheelSpacingsText}
              onChange={(next) =>
                setModuleInputs(key, { ...(inputs as object), wheelSpacingsText: next })
              }
              disabled={readOnly}
            />
          )}
          {/* Feston şeması: hareket mesafesi teknik özelliklerden, taşıyıcı
              adedi ve loop yüksekliği bölüm girdilerinden canlı okunur. */}
          {section.editor === "festoon" && isTravelKey(key) && (
            <FestoonSchematic
              title={FESTOON_AXIS_TITLES[key] ?? "Hareket Ekseni"}
              travelDistanceM={travelFestoonDistanceM(specs, key)}
              trolleyCount={(inputs as TravelInputs).festoonTrolleyCount}
              loopHeightM={(inputs as TravelInputs).festoonLoopHeightM}
            />
          )}
          {(section.inputDefs.length > 0 || (section.extraInputDefs?.length ?? 0) > 0) && (
            <div>
              <h3 className="oc-kicker mb-2 text-muted-foreground">
                Girdiler / Tasarım Kabulleri
              </h3>
              {/* ÖBEKLİ IZGARA — alanlar kesitin PARÇALARINA göre ayrılmışsa
                  (ana kiriş 7.1) her öbek kendi başlığı ve RENGİYLE çizilir;
                  aynı ton kesit çiziminde de kullanılır, göz ikisini renkten
                  eşler. Öbeksiz bölümler bugünkü düz ızgarada kalır. */}
              {fieldGroupBlocks.length > 0 && (
                <div className="mb-4 grid gap-3">
                  {fieldGroupBlocks.map((block) => (
                    <section
                      key={block.group.key}
                      className="oc-fieldgroup grid gap-1 py-2 pl-3 pr-2"
                      style={{ "--oc-hue": block.group.hue } as React.CSSProperties}
                    >
                      <h4
                        className="oc-kicker oc-fieldgroup-title"
                        style={{ "--oc-hue": block.group.hue } as React.CSSProperties}
                      >
                        {block.group.title}
                      </h4>
                      <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {block.defs.map((f) => (
                          <Field
                            key={f.key}
                            def={f}
                            value={scopedInputs}
                            onChange={onInputsChange}
                            disabled={readOnly}
                            auto={section.inputScope ? undefined : autoStateFor(f.key)}
                            context={stdContext}
                            specs={specs}
                          />
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              )}
              <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {ungroupedInputDefs.map((f) => (
                  <Field
                    key={f.key}
                    def={f}
                    value={scopedInputs}
                    onChange={onInputsChange}
                    disabled={readOnly}
                    auto={section.inputScope ? undefined : autoStateFor(f.key)}
                    context={stdContext}
                    specs={specs}
                  />
                ))}
                {section.extraInputDefs?.map((f) => (
                  <Field
                    key={f.key}
                    def={f}
                    value={inputs}
                    onChange={(next) => setModuleInputs(key, next)}
                    disabled={readOnly}
                    context={stdContext}
                    specs={specs}
                  />
                ))}
              </div>
            </div>
          )}
          {/* Madde 7: İZİN VERİLEN / OLUŞAN özeti girdilerin hemen altında,
              katalog seçiminin üstünde. Ayrıntılı hesap alt bölümde kalır. */}
          {headline?.placement === "band" && (
            <HeadlineBand items={headlines} headline={headline} />
          )}
          {section.selectionDefs.length > 0 && (() => {
            const st = altStateFor(key, section);
            const baseCatalogMapping = getCatalogMapping(key, section.rawId);
            // Teknik özelliklerde yalnız ana aile seçilir. Kauçuk/Elastomer
            // ailesi altında Program 0170 kauçuk ile Program 0180 hücresel
            // poliüretan tamponun ikisi de ayrı katalog satırı olarak seçilir.
            const catalogMapping = baseCatalogMapping && section.rawId === "5.8" && isTravelKey(key)
              ? {
                  ...baseCatalogMapping,
                  lockedFacets: {
                    ...baseCatalogMapping.lockedFacets,
                    type: travelBufferCatalogTypes(specs, key),
                  },
                }
              : baseCatalogMapping && section.rawId === "2.2.7" && isHoistKey(key)
                ? (() => {
                    const bearingCode = bearingHousingCompatibilityKey(
                      (mods[key].selections as Record<string, unknown>).bearingCode
                    );
                    // Yatak, seçilmiş temel rulman koduna kilitlenir. Rulman
                    // seçilmemişse katalog düğmesini göstermemek, uyumsuz bir
                    // yatağın serbestçe seçilmesinden daha güvenlidir.
                    if (!bearingCode) return undefined;
                    return {
                      ...baseCatalogMapping,
                      lockedFacets: {
                        ...baseCatalogMapping.lockedFacets,
                        compatible_bearing: bearingCode,
                      },
                    };
                  })()
              : baseCatalogMapping;
            return (
              <div>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="oc-kicker text-muted-foreground">
                      Katalog Seçimi
                    </h3>
                    {catalogMapping && (
                      <span className="border px-1.5 py-px font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
                        ▾ {catalogKindLabel(catalogMapping.kind)}
                      </span>
                    )}
                    {!readOnly && catalogMapping && (
                      <CatalogPicker
                        mapping={catalogMapping}
                        onPick={(row) => {
                          const picked = applyCatalogPick(catalogMapping, row);
                          const priorSelections = mods[key].selections as Record<string, unknown>;
                          const next = {
                            ...priorSelections,
                            ...picked,
                          };
                          // Rulman kodu katalogdan değiştiğinde önceki yatağı
                          // taşımak fiziksel olarak yanlış bir eşleme yaratır.
                          // Aynı temel koda ait "E" soneki değişiminde ise yatak
                          // korunur; SKF yatak tablosu temel kodla eşleştirilir.
                          if (section.rawId === "2.2.6" && isHoistKey(key)) {
                            const oldBearing = bearingHousingCompatibilityKey(priorSelections.bearingCode);
                            const newBearing = bearingHousingCompatibilityKey(picked.bearingCode);
                            if (newBearing && oldBearing !== newBearing) {
                              for (const field of [
                                "bearingHousingBrand",
                                "bearingHousingCode",
                                "bearingHousingSeries",
                                "bearingHousingCompatibleBearing",
                                "bearingHousingBoreMm",
                                "bearingHousingWidthMm",
                                "bearingHousingSeatType",
                              ]) delete next[field];
                            }
                          }
                          // Bir kauçuk satırından hücresel / hidrolik satıra
                          // geçerken önceki ürünün eğrisini taşımak fiziksel
                          // olarak yanlıştır. Katalogda olmayan veri açıkça silinir.
                          if (section.rawId === "5.8") {
                            const bufferCatalogFields: Record<string, string> = {
                              bufferEnergyCurve: "energy_curve",
                              bufferForceCurve: "force_curve",
                              bufferMeteringPins: "metering_pins",
                              bufferMaxCompressionPct: "max_compression_pct",
                            };
                            for (const [selectionField, catalogField] of Object.entries(bufferCatalogFields)) {
                              if (!Object.prototype.hasOwnProperty.call(row.attrs, catalogField)) {
                                delete next[selectionField];
                              }
                            }
                          }
                          setModuleSelections(key, next);
                        }}
                      />
                    )}
                    {section.rawId === "5.8" && isTravelKey(key) && (
                      <BufferCalculationGuide
                        installedCount={(inputs as TravelInputs).bufferCount}
                        axisTitle={FESTOON_AXIS_TITLES[key] ?? "Hareket Ekseni"}
                        snapshot={bufferGuideSnapshot}
                      />
                    )}
                    {/* Seçilen ürünün üretici kataloğundaki gerçek sayfası.
                        Salt-okunur revizyonda da görünür: yayınlanmış bir
                        raporu okuyan mühendis de sayfaya bakabilmelidir. */}
                    {catalogMapping && (() => {
                      const { brandField, modelField, combinedField } =
                        catalogIdentityFields(catalogMapping);
                      const value = (field?: string) => {
                        if (!field) return undefined;
                        const v = (sel as Record<string, unknown>)[field];
                        return typeof v === "string" && v.trim() !== "" ? v : undefined;
                      };
                      // Redüktör, yürütme freni ve tamponda ürünün kimliği tek
                      // bir "MARKA MODEL" alanındadır; defter marka önekini
                      // kendisi ayıkladığı için metin olduğu gibi verilir.
                      return (
                        <CatalogSheetButton
                          kind={catalogMapping.kind}
                          brand={value(brandField)}
                          model={value(modelField) ?? value(combinedField)}
                        />
                      );
                    })()}
                    {/* Madde 3: seçim düğmesinin hemen yanında gereken ve
                        gerçekleşen değer — uygunsa yeşil, değilse kırmızı. */}
                    {headline?.placement === "catalog" &&
                      headlines.map((it) => (
                        <HeadlineBadge key={it.check.id} item={it} headline={headline} />
                      ))}
                  </div>
                  {/* Alternatif çipleri SARMALIDIR: kap `Card` `overflow-hidden`
                      taşıdığı için taşan kısım kaydırılamıyor, KIRPILIYORDU —
                      "✕ Alternatifi sil" telefonda hiç erişilemiyordu. */}
                  <div className="flex flex-wrap items-center justify-end gap-1.5">
                    {st.options.map((opt, i) => {
                      const isActive = i === st.active;
                      const pass = isActive
                        ? (checks.length > 0 ? checks.every((c) => c.pass) : null)
                        : altSectionPass(key, section, opt);
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => switchAlt(key, section, i)}
                          className={cn(
                            "inline-flex min-h-9 items-center gap-1.5 border px-2.5 py-1 text-xs transition-colors pointer-coarse:min-h-10",
                            isActive
                              ? "border-primary bg-primary/10 font-medium text-primary"
                              : "hover:bg-muted"
                          )}
                        >
                          <span
                            className={cn(
                              "size-[7px]",
                              pass === true && "bg-success",
                              pass === false && "bg-destructive",
                              pass === null && "bg-muted-foreground/30"
                            )}
                          />
                          Alternatif {i + 1}
                        </button>
                      );
                    })}
                    {!readOnly && st.options.length < 3 && (
                      <button
                        type="button"
                        onClick={() => addAlt(key, section)}
                        className="inline-flex min-h-9 items-center border border-dashed px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted pointer-coarse:min-h-10"
                        title="Bu ekipman için alternatif seçim ekle (en fazla 3)"
                      >
                        + Alternatif
                      </button>
                    )}
                    {!readOnly && st.options.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeAlt(key, section)}
                        className="inline-flex min-h-9 min-w-9 items-center justify-center border px-2 py-1 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive pointer-coarse:min-h-10 pointer-coarse:min-w-10"
                        title="Aktif alternatifi sil"
                        aria-label="Alternatifi sil"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
                <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {section.selectionDefs.map((f) => (
                    <Field
                      key={f.key}
                      def={f}
                      value={sel}
                      onChange={(next) => setModuleSelections(key, next)}
                      disabled={readOnly}
                      // Seçim alanı da otomatik olabilir (yiv boyu): anahtar
                      // girdilerde, türetilen değer seçimlerde durur.
                      auto={autoSelectionStateFor(f.key)}
                      context={stdContext}
                      specs={specs}
                    />
                  ))}
                </div>
              </div>
            );
          })()}
          {section.rows.length > 0 && (
            <>
              <Separator />
              <div>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="oc-kicker text-muted-foreground">
                    Hesap ve Kontroller
                  </h3>
                  {section.rawId === "5.8" && isTravelKey(key) && (
                    <BufferCalculationGuide
                      installedCount={(inputs as TravelInputs).bufferCount}
                      axisTitle={FESTOON_AXIS_TITLES[key] ?? "Hareket Ekseni"}
                      snapshot={bufferGuideSnapshot}
                    />
                  )}
                </div>
                {/* Geniş ekranda iki kolon: tek ekranda daha çok hesap görünür */}
                <div className="rounded-lg border bg-background px-3 dark:bg-card xl:grid xl:grid-cols-2 xl:gap-x-6">
                  {section.rows.map((r) => (
                    <CalcRow
                      key={r.key}
                      row={r}
                      ctx={ctx}
                      checks={byRow.get(r.anchorId)}
                      context={stdContext}
                    />
                  ))}
                </div>
              </div>
            </>
          )}
          {section.table && <SectionTable table={section.table} ctx={ctx} />}
          {rest.length > 0 && (
            <div className="grid gap-2">
              <h3 className="oc-kicker text-muted-foreground">Diğer Kontroller</h3>
              {rest.map((c) => (
                <CheckRow key={c.id} check={c} context={stdContext} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  function renderSummary() {
    // Gizlenen alt bölümlerin kontrolleri panoya GİRMEZ (PDF'teki Kontrol
    // Özeti ile aynı süzgeç): raporda basılmayan bir hesabın kontrolü burada
    // sayılsaydı iki yüzey farklı toplam söylerdi.
    const moduleChecks = (key: ModuleKey): AnyCheck[] =>
      (moduleResult(key)?.checks ?? []).filter((c) => !hiddenCheckIdSet.has(c.id));
    const blocks = MODULE_ADAPTERS.filter(
      (a) => present(a.key) && moduleChecks(a.key).length > 0
    );
    const totalFail = failCount;
    return (
      <Card className={cardSpacing}>
        <CardHeader className="border-b pb-4">
          <CardTitle className="text-base tracking-tight">Özet · Kontrol Panosu</CardTitle>
          <p className="text-sm text-muted-foreground">
            {totalFail === 0
              ? `Hesap raporundaki ${visibleChecks.length} kontrolün tamamı uygun.`
              : `Hesap raporundaki ${visibleChecks.length} kontrolün ${totalFail} tanesi uygun değil. ` +
                "Kırmızı satıra karşılık gelen bölüme dönüp seçimi gözden geçirin."}
          </p>
        </CardHeader>
        {/* Masaüstünde iki sütun: tüm bölümler tek ekranda görünür */}
        <CardContent className="grid gap-5 lg:grid-cols-2 lg:gap-x-6">
          {blocks.map((adapter) => {
            const checks = moduleChecks(adapter.key);
            const modulePass = checks.filter((c) => c.pass).length;
            const allOk = modulePass === checks.length;
            return (
              <section key={adapter.key} className="grid content-start gap-2">
                <div className="flex items-center justify-between gap-2 border-b pb-1.5">
                  <h3 className="text-sm font-semibold tracking-tight">
                    {renumberTitle(adapterTitle(adapter, specs), numbers[adapter.key] ?? 0)}
                  </h3>
                  <span
                    className={cn(
                      "shrink-0 font-mono text-[11px] font-medium tabular-nums",
                      allOk ? "text-success" : "text-destructive"
                    )}
                  >
                    {modulePass}/{checks.length} Uygun
                  </span>
                </div>
                {checks.map((c) => (
                  <CheckRow key={c.id} check={c} context={stdContext} />
                ))}
              </section>
            );
          })}
        </CardContent>
      </Card>
    );
  }

  // ------------------------------------------------------------ layout
  const passCount = visibleChecks.length - failCount;
  const progressPct = ((stepIndex + 1) / STEPS.length) * 100;
  // Gizli bölümün adım şeridi sayacı da susar — bölüm rapora girmiyor.
  const stepChecks =
    step.kind === "module" &&
    !hiddenSections.has(sectionHideKeyFor(step.moduleKey, step.section.rawId))
      ? sectionChecks(step.moduleKey, step.section)
      : [];

  /** Adımın ray etiketleri — dar ve geniş kip aynı kaynaktan okur. */
  function stepChip(s: Step): string {
    return s.kind === "module" ? s.section.id : s.kind === "specs" ? "01" : "ÖZ";
  }
  /** Adımın bölümü kullanıcı tarafından gizlendi mi (rayda soluk görünür). */
  function stepHidden(s: Step): boolean {
    return (
      s.kind === "module" &&
      hiddenSections.has(sectionHideKeyFor(s.moduleKey, s.section.rawId))
    );
  }
  function stepLabel(s: Step): string {
    return s.kind === "module"
      ? s.section.title
      : s.kind === "specs"
        ? "Teknik Özellikler"
        : "Özet · Kontrol Panosu";
  }

  /**
   * Bölüme geçiş. Telefonda ray içeriğin ÜSTÜNDE durduğu için seçimden sonra
   * kapanır; aksi hâlde kullanıcı seçtiği bölümü görmek için listeyi bir kez
   * daha geçmek zorunda kalırdı. lg üstünde liste zaten hep açıktır.
   */
  function goToStep(i: number) {
    setStepIndex(i);
    setNavOpenMobile(false);
  }

  /**
   * Dar kip satırı: yalnız BÖLÜM NUMARASI. Ad `title` ile durur ve kontrolü
   * kalan bölüm çipin köşesindeki kırmızı noktadan anlaşılır — sayaç yazısı bu
   * genişliğe sığmaz, ama "burada bir sorun var" bilgisi kaybolmamalıdır.
   */
  function navChip(s: Step, i: number) {
    const hidden = stepHidden(s);
    const checks = s.kind === "module" ? sectionChecks(s.moduleKey, s.section) : [];
    // Gizli bölümün kontrolü sayılmaz — kırmızı nokta da yakılmaz.
    const failing = !hidden && checks.some((c) => !c.pass);
    return (
      <li key={s.key}>
        <button
          type="button"
          onClick={() => goToStep(i)}
          title={`${stepChip(s)} · ${stepLabel(s)}${hidden ? " (gizli)" : ""}`}
          aria-current={i === stepIndex ? "step" : undefined}
          className={cn(
            "relative flex w-full items-center justify-center rounded-md py-1.5 font-mono text-[11px] tabular-nums transition-colors pointer-coarse:min-h-10",
            i === stepIndex
              ? "bg-primary/15 font-medium text-primary"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
            hidden && "opacity-45"
          )}
        >
          {stepChip(s)}
          {failing && (
            <span
              aria-hidden
              className="absolute top-0.5 right-0.5 size-1.5 rounded-full bg-destructive"
            />
          )}
        </button>
      </li>
    );
  }

  function navItem(s: Step, i: number) {
    // Numara çipi + kontrol özeti: durum noktası yerine "✓ n/m" sayısı
    // (hepsi geçtiyse nötr, kalan varsa kırmızı).
    const hidden = stepHidden(s);
    const checks = s.kind === "module" ? sectionChecks(s.moduleKey, s.section) : [];
    const passN = checks.filter((c) => c.pass).length;
    const chip = stepChip(s);
    const label = stepLabel(s);
    return (
      <li key={s.key}>
        <button
          type="button"
          onClick={() => goToStep(i)}
          aria-current={i === stepIndex ? "step" : undefined}
          className={cn(
            // Telefonda bölüm listesi ana dokunma hedefidir (~29px'ti)
            "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors pointer-coarse:min-h-10",
            i === stepIndex
              ? "bg-primary/10 font-medium text-primary"
              : "text-foreground/80 hover:bg-muted hover:text-foreground"
          )}
        >
          <span
            className={cn(
              "inline-flex h-5 min-w-8 shrink-0 items-center justify-center px-1 font-mono text-xs tabular-nums sm:text-[11px]",
              i === stepIndex ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
            )}
          >
            {chip}
          </span>
          <span
            className={cn("min-w-0 flex-1 truncate", hidden && "opacity-50")}
            title={hidden ? `${label} (gizli)` : label}
          >
            {label}
          </span>
          {/* Gizli bölümün sayacı yerine "gizli" etiketi: kırmızı bir sayaç
              "burada sorun var" derdi, oysa bölüm rapora hiç girmiyor. */}
          {hidden ? (
            <span className="shrink-0 text-[11px] text-muted-foreground/70">gizli</span>
          ) : (
            checks.length > 0 && (
              <span
                className={cn(
                  "shrink-0 font-mono text-xs tabular-nums sm:text-[11px]",
                  passN === checks.length ? "text-muted-foreground" : "text-destructive"
                )}
              >
                {passN}/{checks.length}
              </span>
            )
          )}
        </button>
      </li>
    );
  }

  const navQ = navQuery.trim().toLocaleLowerCase("tr-TR");
  const stepMatches = (s: Step) =>
    navQ === "" || s.title.toLocaleLowerCase("tr-TR").includes(navQ);

  /**
   * Durum şeridi — sayfa başlığındaki yuvaya taşınır (bkz. EDITOR_STATUS_SLOT_ID).
   * Yalnız kontrol özeti ve Kaydet kalır; ilerleme çubuğu, motor sürümü ve
   * "bu bölüm" sayacı alt adım şeridine indi (orada zaten adım bilgisi var).
   */
  const statusStrip = (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1.5 text-sm">
        {failCount === 0 ? (
          <>
            <span aria-hidden="true" className="shrink-0 font-mono font-semibold text-success">✓</span>
            <span className="hidden font-medium text-success sm:inline">Tüm kontroller uygun</span>
            <span className="font-mono text-xs tabular-nums text-muted-foreground">
              {visibleChecks.length}
            </span>
          </>
        ) : (
          <>
            <span aria-hidden="true" className="shrink-0 font-mono font-semibold text-destructive">✗</span>
            <span className="font-medium text-destructive">
              <span className="font-mono tabular-nums">{failCount}</span>
              <span className="hidden sm:inline"> kontrol uygun değil</span>
            </span>
            <span className="font-mono text-xs tabular-nums text-muted-foreground">
              / {visibleChecks.length}
            </span>
          </>
        )}
      </div>
      {/* Kaydet lg ALTINDA burada değil, sabitlenmiş adım şeridindedir.
          Gerekçe artık "başlık mobilde sticky değil" DEĞİLDİR (şerit her
          genişlikte `sticky`): eylem şeridi dar ekranda yatay kayan bir
          şerittir ve Kaydet orada sağa doğru kaybolabilir. Adım şeridi ise
          ekranın altına sabittir — her zaman elin altında. */}
      {!readOnly && (
        <Button onClick={handleSave} disabled={pending} size="sm" className="hidden lg:inline-flex">
          {pending ? "Kaydediliyor..." : "Kaydet"}
        </Button>
      )}
    </div>
  );

  return (
    // SABİT ÇERÇEVE: sayfa gövdesi kaymaz. Bölüm rayı ve içerik kendi
    // bölgelerinde kayar; adım şeridi çerçevenin gerçek alt kenarıdır.
    // Eskiden üstte bir durum çubuğu daha vardı; o artık sayfa başlığında.
    <div className="flex min-h-0 flex-col gap-3 lg:min-h-0 lg:flex-1 lg:flex-row lg:gap-5">
      <StatusSlot>{statusStrip}</StatusSlot>

      {/* Örtü — alt tabaka açıkken. Yalnız telefonda/tablet portrede vardır;
          `lg` üstünde ray zaten kendi sütunundadır ve örtülecek bir şey yok. */}
      {navOpenMobile && !isDesktop && (
        <div
          className="fixed inset-0 z-40 bg-black/45 lg:hidden"
          onClick={closeNavMobile}
          aria-hidden
        />
      )}

      {/* Bölüm navigasyonu.
          `lg` ÜSTÜNDE: bugünkü ray — dar/geniş kip, kalıcı tercih, kendi
          sütunu. Hiçbir şey değişmedi.
          `lg` ALTINDA: ALT TABAKA. Ray akıştan çıkar (içerik ~40px kazanır) ve
          adım şeridindeki etikete dokununca alttan yükselir. `translate-y-full`
          ile kapanır — `hidden` yerine dönüşüm, çünkü açılış/kapanış hareketi
          kullanıcıya listenin NEREDEN geldiğini söyler.
          `dvh` (`vh` DEĞİL, md. 3): adres çubuğu açıkken `vh` tabakayı ekranın
          altına taşırırdı. */}
      <nav
        ref={navPanelRef}
        id={NAV_PANEL_ID}
        aria-label="Hesap bölümleri"
        // Kapalı tabaka ekranın altında DURUYOR, yok olmuyor: `hidden`
        // verilseydi açılış hareketi de olmazdı. Ama duran bir tabaka Tab ile
        // hâlâ gezilebilir — 117 görünmez düğme klavye ve ekran okuyucu için
        // sayfayı kullanılamaz yapardı. `inert` ikisini birden keser.
        inert={!isDesktop && !navOpenMobile}
        className={cn(
          "flex min-h-0 min-w-0 flex-col",
          "max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-50 max-lg:max-h-[78dvh] max-lg:border-t max-lg:bg-card max-lg:px-3 max-lg:pt-2 max-lg:pb-3 max-lg:shadow-[0_-8px_24px_-8px_rgb(0_0_0/0.28)] max-lg:transition-transform max-lg:duration-200 max-lg:ease-out",
          !navOpenMobile && "max-lg:translate-y-full",
          "lg:shrink-0 lg:transition-[width] lg:duration-200 lg:ease-out",
          navCollapsed ? "lg:w-[3.25rem] xl:w-[3.25rem]" : "lg:w-[260px] xl:w-[286px]"
        )}
      >
        <div
          className={cn(
            "mb-1.5 flex items-center gap-1",
            narrowNav ? "justify-center" : "justify-between px-2"
          )}
        >
          {!narrowNav && (
            <>
              {/* lg ALTINDA bu satır TABAKANIN BAŞLIĞIDIR ve tabakayı kapatır
                  (açan denetim adım şeridindedir — başparmağın olduğu yerde).
                  lg üstünde ray kendi sütunundadır ve düğme etkisizdir. */}
              <button
                type="button"
                onClick={closeNavMobile}
                aria-expanded={navOpenMobile}
                aria-controls={NAV_PANEL_ID}
                title="Bölüm listesini kapat"
                className="oc-tap flex min-h-9 min-w-0 items-center gap-1.5 text-left transition-colors hover:text-foreground lg:pointer-events-none lg:min-h-0"
              >
                <span
                  aria-hidden
                  className="shrink-0 font-mono text-[11px] leading-none text-muted-foreground lg:hidden"
                >
                  ✕
                </span>
                <span className="oc-kicker text-muted-foreground">Bölümler</span>
                <span className="min-w-0 truncate font-mono text-[11px] text-muted-foreground lg:hidden">
                  · {stepChip(step)}
                </span>
              </button>
              <span
                className={cn(
                  "ml-auto shrink-0 font-mono text-[11px] font-medium tabular-nums",
                  failCount === 0 ? "text-success" : "text-destructive"
                )}
              >
                {passCount}/{visibleChecks.length} uygun
              </span>
            </>
          )}
          {/* Dar/geniş kip yalnız sabit çerçevede anlamlıdır; lg altında
              düğme hiçbir şey yapmayacağı için gösterilmez. */}
          <button
            type="button"
            onClick={toggleNavCollapsed}
            aria-pressed={navCollapsed}
            title={navCollapsed ? "Bölüm listesini genişlet" : "Bölüm listesini daralt"}
            aria-label={navCollapsed ? "Bölüm listesini genişlet" : "Bölüm listesini daralt"}
            className="hidden size-6 shrink-0 place-items-center rounded font-mono text-[11px] leading-none text-muted-foreground transition-colors hover:bg-muted hover:text-foreground pointer-coarse:size-10 lg:grid"
          >
            {navCollapsed ? "»" : "«"}
          </button>
        </div>

        {/* Bölüm arama kutusu — dar kipte yer kaplamaz (ada göre arıyor).
            Panelin kendisi gizlendiği için ayrıca gizlemeye gerek yok. */}
        {!narrowNav && (
          <div className="mb-2 shrink-0 px-1">
            <Input
              value={navQuery}
              onChange={(e) => setNavQuery(e.target.value)}
              placeholder="ARA · Bölüm Adı"
              // `text-sm` YAZILMAZ: taban `text-base pointer-fine:text-sm`tir ve
              // elle ezmek iOS Safari'nin odakta OTOMATİK YAKINLAŞTIRMASINI geri
              // getiriyordu (AGENTS md. 2) — uygulamadaki tek ihlal buydu.
              className="h-8 bg-background placeholder:font-mono placeholder:text-xs pointer-coarse:h-10"
              aria-label="Bölüm ara"
            />
          </div>
        )}

        {/* Dar kip: gruplar kalkar, adımlar tek sütun numara listesi olur.
            Kapalı modüllerin adımları zaten STEPS'te yoktur. */}
        {narrowNav ? (
          <ol
            id={NAV_LIST_ID}
            className="grid min-h-0 flex-1 auto-rows-max gap-0.5 overflow-y-auto overscroll-y-contain pb-2"
          >
            {STEPS.map((s, i) => navChip(s, i))}
          </ol>
        ) : (
        /* Uzun bölüm listesi yalnız KENDİ bölgesinde kayar. `max-h-72` kalktı:
           mobilde artık tabakanın kendisi yükseklik kelepçesini taşıyor
           (`max-lg:max-h-[78dvh]`), yani liste tabakanın kalanını doldurur. */
        <ol
          id={NAV_LIST_ID}
          className="grid min-h-0 flex-1 auto-rows-max gap-0.5 overflow-y-auto overscroll-y-contain pb-2 pr-1 text-sm">
          {NAV_GROUPS.map((group) => {
            const groupTitleMatch =
              navQ !== "" &&
              group.title !== null &&
              group.title.toLocaleLowerCase("tr-TR").includes(navQ);
            const visibleItems =
              navQ === "" || groupTitleMatch
                ? group.items
                : group.items.filter(({ step: s }) => stepMatches(s));
            // Grupsuz tek adımlar (Teknik Özellikler, Özet)
            if (group.title === null) {
              if (visibleItems.length === 0) return null;
              const { step: s, index: i } = visibleItems[0];
              return navItem(s, i);
            }
            const isDisabled = group.enabled === false;
            // Kapalı modüller yalnız arama boşken (ya da adı eşleşince) görünür
            if (isDisabled && navQ !== "" && !groupTitleMatch) return null;
            if (!isDisabled && visibleItems.length === 0) return null;
            const statuses = group.items.map(({ step: s }) =>
              s.kind === "module" ? sectionStatus(s.moduleKey, s.section) : "none"
            );
            const withChecks = statuses.filter((st) => st !== "none").length;
            const passed = statuses.filter((st) => st === "pass").length;
            const anyFail = statuses.some((st) => st === "fail");
            const containsCurrent = group.items.some(({ index: i }) => i === stepIndex);
            const isOpen =
              !isDisabled && (navQ !== "" || containsCurrent || !!openGroups[group.key]);
            return (
              <li key={group.key}>
                <div
                  className={cn(
                    "mt-2 flex w-full items-center gap-1 rounded-md pr-1 transition-colors",
                    isDisabled ? "opacity-55" : "hover:bg-muted"
                  )}
                >
                  <button
                    type="button"
                    disabled={isDisabled}
                    onClick={() =>
                      setOpenGroups((g) => ({ ...g, [group.key]: !isOpen }))
                    }
                    className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground pointer-coarse:min-h-10 disabled:cursor-default"
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        "inline-block shrink-0 font-mono transition-transform",
                        !isOpen && "-rotate-90",
                        isDisabled && "opacity-0"
                      )}
                    >
                      ▾
                    </span>
                    <span className="min-w-0 flex-1 truncate" title={group.title ?? undefined}>
                      {group.title}
                    </span>
                    {!isDisabled && withChecks > 0 && (
                      <span
                        className={cn(
                          "font-mono text-[11px] font-medium normal-case tabular-nums",
                          anyFail
                            ? "text-destructive"
                            : passed === withChecks
                              ? "text-success"
                              : "text-muted-foreground"
                        )}
                      >
                        {passed}/{withChecks}
                      </span>
                    )}
                    {isDisabled && (
                      <span className="font-mono text-[11px] normal-case text-muted-foreground">
                        kapalı
                      </span>
                    )}
                  </button>
                  {/* Bölüm aç/kapa — kapalı bölüm hesaba ve rapora girmez.
                      Yuva ZORUNLU bölümlerde de ayrılır: aksi hâlde sayaçlar
                      satırdan satıra 24px kayıyor ve liste hizasız görünüyordu. */}
                  {!(group.optional && group.moduleKey) && (
                    <span aria-hidden className="size-6 shrink-0 pointer-coarse:size-10" />
                  )}
                  {group.optional && group.moduleKey && (
                    <button
                      type="button"
                      disabled={readOnly}
                      onClick={() => toggleModule(group.moduleKey!, isDisabled)}
                      title={
                        isDisabled
                          ? `${moduleLabelFor(group.moduleKey, specs)} bölümünü aç`
                          : `${moduleLabelFor(group.moduleKey, specs)} bölümünü gizle (hesaba ve rapora girmez)`
                      }
                      aria-label={
                        isDisabled
                          ? `${moduleLabelFor(group.moduleKey, specs)} bölümünü aç`
                          : `${moduleLabelFor(group.moduleKey, specs)} bölümünü gizle`
                      }
                      aria-pressed={!isDisabled}
                      className={cn(
                        "grid size-6 shrink-0 place-items-center rounded font-mono text-[11px] transition-colors pointer-coarse:size-10",
                        isDisabled
                          ? "text-muted-foreground hover:bg-primary/10 hover:text-primary"
                          : "text-primary/70 hover:bg-muted hover:text-foreground",
                        readOnly && "pointer-events-none opacity-40"
                      )}
                    >
                      {isDisabled ? "＋" : "－"}
                    </button>
                  )}
                </div>
                {isOpen && (
                  <ol className="mt-0.5 ml-3.5 grid gap-0.5 border-l border-border/70 pl-2">
                    {visibleItems.map(({ step: s, index: i }) => navItem(s, i))}
                  </ol>
                )}
              </li>
            );
          })}
        </ol>
        )}
      </nav>

      {/* İçerik — kayan gövde + altta adım şeridi. Üstteki durum çubuğu
          kaldırıldı: kontrol özeti ve Kaydet sayfa başlığına taşındı, ilerleme
          bilgisi zaten adım bilgisi olan alt şeride indi. */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
        {/* Kayan gövde — bölüm değişince başa sarılır (bkz. scrollRef) */}
        <div ref={bodyRef} className="min-h-0 lg:flex-1 lg:overflow-y-auto lg:pr-1">
          {step.kind === "specs" && renderSpecs()}
          {step.kind === "module" && renderModuleSection(step.moduleKey, step.section)}
          {step.kind === "summary" && renderSummary()}
        </div>

        {/* Adım şeridi — lg üstünde çerçevenin alt kenarıdır. lg ALTINDA çerçeve
            yoktur: şerit uzun bölüm kartının en dibinde kalıyor ve her geçişte
            sayfanın sonuna kaydırmak gerekiyordu; orada ekranın altına
            SABİTLENİR. */}
        <div className="sticky bottom-0 z-20 shrink-0 rounded-lg border bg-card px-3 py-2 sm:px-4 sm:py-2.5 lg:static">
          {/* Telefonda üç düğme + ilerleme tek satıra sığmıyor (bölüm adına
              ~30px kalıyordu): bilgi satırı üste, düğmeler alta iner. */}
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
            <Button
              variant="outline"
              size="sm"
              disabled={stepIndex === 0}
              onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
            >
              <span aria-hidden="true" className="font-mono">←</span>
              Geri
            </Button>

            {/* İlerleme + bulunulan bölüm: eskiden üstteki durum çubuğundaydı,
                şimdi adım bilgisiyle aynı yerde duruyor. */}
            <div className="order-first flex min-w-0 grow basis-full items-center gap-2.5 sm:order-none sm:basis-0">
              <div className="h-1 min-w-8 flex-1 overflow-hidden bg-muted">
                <div
                  className="h-full bg-primary transition-[width] duration-300"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              {/* BÖLÜM LİSTESİNİN GİRİŞİ.
                  Bulunulan bölüm 640px altında da görünür — kullanıcının hangi
                  adımda olduğunu gösteren tek yazı budur. Listeyi de o açar:
                  ray `lg` altında alt tabakadadır ve tabakayı açacak denetim,
                  adım bilgisiyle aynı yerde, başparmağın altında olmalıdır.
                  `lg` üstünde ray zaten hep açık — düğme etkisizleşir. */}
              {/* Odağın kapanışta buraya dönmesi için ayrı bir ref gerekmez:
                  `useOverlay` açılış anındaki etkin öğeyi hatırlar ve o zaten
                  bu düğmedir. */}
              <button
                type="button"
                onClick={() => setNavOpenMobile((v) => !v)}
                aria-expanded={navOpenMobile}
                aria-controls={NAV_PANEL_ID}
                title={`${stepIndex + 1}/${STEPS.length} · ${step.title}`}
                className="oc-tap flex max-w-[60%] min-w-0 shrink items-center gap-1.5 rounded-md text-left font-mono text-[11px] tabular-nums text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:pointer-events-none lg:hover:bg-transparent"
              >
                <span aria-hidden className="shrink-0 leading-none lg:hidden">
                  ☰
                </span>
                <span className="min-w-0 truncate">
                  {stepIndex + 1}/{STEPS.length} · {step.title}
                </span>
              </button>
              {step.kind === "module" && stepChecks.length > 0 && (
                <span
                  className={cn(
                    "hidden shrink-0 border px-1.5 py-0.5 font-mono text-[11px] tabular-nums md:inline",
                    stepChecks.every((c) => c.pass)
                      ? "border-success/30 text-success"
                      : "border-destructive/40 text-destructive"
                  )}
                >
                  bu bölüm {stepChecks.filter((c) => c.pass).length}/{stepChecks.length}
                </span>
              )}
              <span className="hidden shrink-0 font-mono text-[11px] text-muted-foreground lg:inline">
                motor v{result.engineVersion}
              </span>
            </div>

            {/* Kaydet yalnız lg ALTINDA burada: sayfa başlığı mobilde sticky
                değil, sabit şerit ise her zaman elin altındadır. */}
            {!readOnly && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSave}
                disabled={pending}
                className="lg:hidden"
              >
                {pending ? "Kaydediliyor..." : "Kaydet"}
              </Button>
            )}

            <Button
              size="sm"
              disabled={stepIndex === STEPS.length - 1}
              onClick={() => setStepIndex((i) => Math.min(STEPS.length - 1, i + 1))}
            >
              İleri
              <span aria-hidden="true" className="font-mono">→</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
