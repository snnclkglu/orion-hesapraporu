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

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { activeModules, runCalc, type CalcInput } from "@/lib/calc/engine";
import { computeHoistGroup, hoistSpecView } from "@/lib/calc/modules/hoistGroup";
import { computeHookBlock } from "@/lib/calc/modules/hookBlock";
import { computeTravelGroup } from "@/lib/calc/modules/travelGroup";
import { computeMainGirder } from "@/lib/calc/modules/mainGirder";
import { computeBuckling } from "@/lib/calc/modules/buckling";
import { computeEndCarriage } from "@/lib/calc/modules/endCarriage";
import { HOIST_AUTO_FIELDS, SPEC_FIELDS, SPEC_GROUPS, fieldLabel } from "@/lib/calc/fields";
import { deriveHoistInputs, motorTempFactor } from "@/lib/calc/derive";
import { travelSpecView } from "@/lib/calc/modules/travelGroup";
import { parseHoistLoadClass } from "@/lib/calc/types";
import { checkAnchor } from "@/lib/calc/presentation/check-anchors";
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
import { CALC_FIELD } from "@/lib/revision-load";
import { checkDisplay, checkKind, checkSeverity } from "@/lib/calc/types";
import type { AnyCheck, ModuleResult, TechnicalSpecs } from "@/lib/calc/types";
import type { HoistInputs, HoistSelections } from "@/lib/calc/modules/hoistGroup";
import type { HookBlockSelections } from "@/lib/calc/modules/hookBlock";
import type { TravelInputs, TravelSelections } from "@/lib/calc/modules/travelGroup";
import type { GirderSelections } from "@/lib/calc/modules/mainGirder";
import type { EndCarriageSelections } from "@/lib/calc/modules/endCarriage";
import {
  ADAPTER_BY_KEY,
  MODULE_ADAPTERS,
  MODULE_LABELS,
  MODULE_PARENT,
  OPTIONAL_MODULE_KEYS,
  CONFIG_DRIVEN_MODULE_KEYS,
  buildModuleDeps,
  moduleAllowedByConfig,
  moduleDisplayNumbers,
  renumberSectionId,
  renumberTitle,
  type AdapterRow,
  type AdapterSection,
  type AnyFieldDef,
  type ModuleKey,
} from "./module-adapters";
import {
  applyCatalogPick,
  getCatalogMapping,
  catalogKindLabel,
} from "@/lib/catalog-mapping";
import { CatalogPicker } from "@/components/catalog-picker";
import { SectionDiagram } from "@/components/diagrams/section-diagram";
import { MathFormula } from "@/components/math/math-formula";
import { StandardRefBadge } from "@/components/standard-ref-dialog";
import type { StandardContext } from "@/lib/standards/registry";
import { toDisplayUnit, toDisplayUnitLabel } from "@/lib/units";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { saveRevision } from "./actions";

/**
 * Alternatif ekipman seçimi: seçim alanı olan her modül bölümü için 3'e kadar
 * alternatif saklanır; aktif olan canlı hesapta kullanılır, diğerlerinin
 * uygunluğu rozetle gösterilir.
 */
export interface AltState {
  active: number;
  options: Record<string, unknown>[];
}
export type AltsMap = Record<string, AltState>; // key: `${moduleKey}-${section.rawId}`

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
    return { ...base, mechanismClass: v.mechanismClass, usageClass: v.usageClass };
  }
  return base;
}

// ---------------------------------------------------------------- Field

interface AutoFieldState {
  on: boolean;
  onToggle: (next: boolean) => void;
  warning?: string;
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
    <div className="grid gap-1">
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
              "ml-auto inline-flex items-center gap-1 border px-1.5 py-px font-mono text-[10px] transition-colors",
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
      {def.type === "select" ? (() => {
        // Sayısal select'ler (tambur/teker çapı, sıcaklık) değeri sayı olarak yazar.
        // Kayıtlı değer listede yoksa listeye eklenir (eski revizyonlar bozulmaz).
        const base = (def.options ?? []).map(String);
        const cur = v === null || v === undefined || v === "" ? "" : String(v);
        const opts = cur !== "" && !base.includes(cur) ? [cur, ...base] : base;
        return (
          <Select
            value={cur}
            onValueChange={(nv) =>
              onChange({
                ...value,
                [def.key]: def.numeric ? parseFloat(nv.replace(",", ".")) : nv,
              })
            }
            disabled={locked}
          >
            <SelectTrigger id={id} className="h-8 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {opts.map((o) => (
                <SelectItem key={o} value={o}>
                  {def.optionLabels?.[o] ?? o}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      })() : (
        <>
          <Input
            id={id}
            className={cn(
              "h-8 bg-background",
              def.type === "number" && "font-mono tabular-nums",
              auto?.on && "border-primary/30 bg-primary/5"
            )}
            inputMode={def.type === "number" ? "decimal" : undefined}
            value={def.type === "number" && draft !== null ? draft : String(v ?? "")}
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
      <span className="text-[10px] tracking-wide text-muted-foreground uppercase">Hesaplanan</span>
      <span className={cn("font-semibold", check.pass ? "text-success" : "text-destructive")}>
        {fmt(computed.value)}
        {unit}
      </span>
      {d.operator !== "…" && <span className="text-muted-foreground">{d.operator}</span>}
      <span className="text-[10px] tracking-wide text-muted-foreground uppercase">İzin Verilen</span>
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
        "font-mono text-[10px] whitespace-nowrap text-muted-foreground",
        className
      )}
      title="Bu kontrolün dayanağı ve yayına etkisi"
    >
      ({parts.join(" · ")})
    </span>
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
        <div className="truncate font-medium">
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
  const raw = row.read(ctx);
  const { value, unit } = toDisplayUnit(raw, row.unit);
  // Değerin rengi, satıra bağlı kontrolün sonucunu taşır: kontrol sağlanıyorsa
  // (hesaplanan değer izin verilen sınırın uygun tarafındaysa) YEŞİL, değilse
  // KIRMIZI. Kontrolü olmayan satırlar nötr kalır.
  const rowPass =
    checks && checks.length > 0 ? checks.every((c) => c.pass) : null;
  return (
    <div className="grid gap-1 border-b py-2.5 last:border-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="min-w-0 text-sm">{row.label}</span>
        {/* Hesaplanan değer rolü: salt-okunur, mono zemin — birim boşlukla ayrık */}
        <span
          className={cn(
            "shrink-0 px-2 py-0.5 font-mono text-sm font-semibold tabular-nums",
            rowPass === true && "bg-success/15 text-success",
            rowPass === false && "bg-destructive/15 text-destructive",
            rowPass === null && "bg-muted text-foreground"
          )}
        >
          = {fmt(value, row.digits ?? 2)}{unit ? ` ${unit}` : ""}
        </span>
      </div>
      {row.formula && (
        <div className="overflow-x-auto rounded-md bg-muted/50 px-3 py-2 text-[15px] leading-relaxed text-foreground/90">
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
      <div className="overflow-x-auto rounded-lg border">
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
  numbers: Partial<Record<ModuleKey, number>>
): Step[] {
  const steps: Step[] = [{ kind: "specs", key: "specs", title: "01 · Teknik Özellikler" }];
  for (const adapter of MODULE_ADAPTERS) {
    if (!present(adapter.key)) continue;
    const num = numbers[adapter.key] ?? 0;
    for (const section of adapter.sections) {
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
  allowed: (k: ModuleKey) => boolean
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
        ? renumberTitle(adapter.title, numbers[adapter.key] ?? 0)
        : MODULE_LABELS[adapter.key],
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

/** Tüm hesap bölümlerinin girdi/seçim durumu — anahtar bazlı, topolojiden bağımsız. */
type ModuleState = { inputs: object; selections: object };
type ModulesState = Record<ModuleKey, ModuleState>;

/**
 * Otomatik alanları (halat ağırlığı, kanca bloğu ağırlığı, sıcaklık faktörü)
 * ve seçilen halat donanımını güncel girdi/seçimlerden yeniden türetir.
 * Anahtar kapalıysa ya da kaynak veri eksikse değer korunur.
 */
function withDerivedHoist(state: ModuleState, specs: TechnicalSpecs, which: ModuleKey): ModuleState {
  const inputs = state.inputs as HoistInputs;
  const selections = state.selections as HoistSelections;
  const view = hoistSpecView(specs, which as "main" | "aux" | "mono1" | "mono2");
  const patch: Partial<HoistInputs> = {};

  const d = deriveHoistInputs(inputs, selections, {
    liftHeightM: view.liftHeightM,
    capacityT: view.capacityT,
    ambientTempMaxC: specs.ambientTempMaxC,
  });
  // Hazır donanım seçiliyse tahrikli/toplam halat kutuları da o donanıma uyar.
  if (d.drivenFalls !== undefined) patch.drivenFalls = d.drivenFalls;
  if (d.totalFalls !== undefined) patch.totalFalls = d.totalFalls;
  if (d.ropeWeightKg !== undefined && d.ropeWeightKg !== inputs.ropeWeightKg) {
    patch.ropeWeightKg = d.ropeWeightKg;
  }
  if (
    d.hookBlockWeightKg !== undefined &&
    d.hookBlockWeightKg !== inputs.hookBlockWeightKg
  ) {
    patch.hookBlockWeightKg = d.hookBlockWeightKg;
  }
  if (d.tempFactor !== undefined && d.tempFactor !== inputs.tempFactor) {
    patch.tempFactor = d.tempFactor;
  }
  if (Object.keys(patch).length === 0) return state;
  return { ...state, inputs: { ...inputs, ...patch } };
}

/** Yürütme grubunda otomatik sıcaklık faktörü. */
function withDerivedTravel(state: ModuleState, specs: TechnicalSpecs): ModuleState {
  const inputs = state.inputs as TravelInputs;
  if (!inputs.tempFactorAuto) return state;
  const v = motorTempFactor(specs.ambientTempMaxC);
  if (v === inputs.tempFactor) return state;
  return { ...state, inputs: { ...inputs, tempFactor: v } };
}

/** Bir bölümün durumunu ailesine göre türetmelerden geçirir. */
function withDerived(key: ModuleKey, state: ModuleState, specs: TechnicalSpecs): ModuleState {
  if (isHoistKey(key)) return withDerivedHoist(state, specs, key);
  if (isTravelKey(key)) return withDerivedTravel(state, specs);
  return state;
}

function initModules(initial: CalcInput): ModulesState {
  // `initial` yükleyiciden (revision-load) gelir ve TÜM bölümleri içerir.
  // Otomatik alanlar ilk açılışta da türetilir (kayıtlı değer eskimiş olabilir).
  const src = initial as unknown as Record<string, ModuleState | undefined>;
  const out = {} as ModulesState;
  for (const key of MODULE_ORDER) {
    const st = src[CALC_FIELD[key]];
    const base: ModuleState = {
      inputs: st?.inputs ?? {},
      selections: st?.selections ?? {},
    };
    out[key] = withDerived(key, base, initial.specs);
  }
  return out;
}

// ---------------------------------------------------------------- Editor
export function RevisionEditor({
  projectId, revisionId, readOnly, initial, initialAlts, initialDisabled,
}: {
  projectId: string;
  revisionId: string;
  readOnly: boolean;
  /** Tüm bölümlerin verisi (kapalılar dâhil) — kapalı bölüm tekrar açılabilsin */
  initial: CalcInput;
  initialAlts?: AltsMap;
  /** Kapalı hesap bölümleri */
  initialDisabled?: string[];
}) {
  const [specs, setSpecs] = useState(initial.specs);
  const [mods, setMods] = useState<ModulesState>(() => initModules(initial));
  const [alts, setAlts] = useState<AltsMap>(initialAlts ?? {});
  const [stepIndex, setStepIndex] = useState(0);
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
  }, [specs, mods, alts, enabled]);

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
  const STEPS = useMemo(() => buildSteps(present, numbers), [present, numbers]);
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
    () => buildNavGroups(STEPS, numbers, present, allowedByConfig),
    [STEPS, numbers, present, allowedByConfig]
  );
  // Modül kapatılınca adım sayısı azalabilir → aktif adımı sınırla
  useEffect(() => {
    setStepIndex((i) => Math.min(i, STEPS.length - 1));
  }, [STEPS.length]);

  // ------------------------------------------------- otomatik girdi türetmesi
  // "Otomatik" anahtarı açık kaldırma girdileri (halat ağırlığı, makara verimi)
  // kaynak veri her değiştiğinde AYNI state güncellemesi içinde yeniden
  // hesaplanır ve girdiye yazılır. Böylece hesap motoru, PDF rapor ve ekipman
  // listesi hep aynı değeri görür; alan elle düzenlenmek istenirse anahtar
  // kapatılır ve serbest kalır.
  const derivations = useMemo(() => {
    const out = {} as Record<ModuleKey, ReturnType<typeof deriveHoistInputs> | undefined>;
    for (const k of MODULE_ORDER) {
      if (!isHoistKey(k)) continue;
      const view = hoistSpecView(specs, k);
      out[k] = deriveHoistInputs(
        mods[k].inputs as HoistInputs,
        mods[k].selections as HoistSelections,
        {
          liftHeightM: view.liftHeightM,
          capacityT: view.capacityT,
          ambientTempMaxC: specs.ambientTempMaxC,
        }
      );
    }
    return out;
  }, [mods, specs]);

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
  const failCount = result.allChecks.filter((c) => !c.pass).length;
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

  /** Modül state'ini yazarken ailesine özgü türetmeleri de uygular. */
  function writeModule(
    m: ModulesState,
    key: ModuleKey,
    patch: { inputs?: object; selections?: object },
    nextSpecs = specs
  ): ModulesState {
    const merged: ModuleState = { ...m[key], ...patch };
    return { ...m, [key]: withDerived(key, merged, nextSpecs) };
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
    setMods((m) => {
      const out = { ...m };
      let changed = false;
      for (const k of MODULE_ORDER) {
        const d = withDerived(k, m[k], next);
        if (d !== m[k]) {
          out[k] = d;
          changed = true;
        }
      }
      return changed ? out : m;
    });
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

  /** Verilen seçimlerle ilgili modülün kontrollerini yeniden hesaplar */
  function computeChecksWith(key: ModuleKey, sel: object): AnyCheck[] {
    const inp = mods[key].inputs;
    if (isHoistKey(key)) {
      return computeHoistGroup(specs, key, inp as never, sel as HoistSelections).checks;
    }
    if (isHookBlockKey(key)) {
      return computeHookBlock(
        specs, key, inp as never, sel as HookBlockSelections, deps.hookBlock[key]
      ).checks;
    }
    if (isTravelKey(key)) {
      return computeTravelGroup(
        specs, key, inp as never, sel as TravelSelections, deps.travel[key]
      ).checks;
    }
    switch (key) {
      case "girder":
        return computeMainGirder(specs, inp as never, sel as GirderSelections, deps.girder).checks;
      case "buckling":
        return computeBuckling(inp as never).checks;
      case "endCarriage":
        return computeEndCarriage(
          specs, inp as never, sel as EndCarriageSelections, deps.endCarriage
        ).checks;
    }
    return [];
  }

  /** Kaydetmeden önce aktif alternatifi canlı seçim değerleriyle eşitler */
  function syncedAlts(): AltsMap {
    const next: AltsMap = { ...alts };
    for (const [key, st] of Object.entries(next)) {
      const dash = key.indexOf("-");
      const moduleKey = key.slice(0, dash) as ModuleKey;
      const sectionId = key.slice(dash + 1);
      const adapter = ADAPTER_BY_KEY[moduleKey];
      const section = adapter?.sections.find((s) => s.rawId === sectionId);
      if (!section) continue;
      const options = [...st.options];
      options[st.active] = pickSelection(mods[moduleKey].selections, section.selectionKeys);
      next[key] = { ...st, options };
    }
    return next;
  }

  function altStateFor(key: ModuleKey, section: AdapterSection): AltState {
    const altKey = `${key}-${section.rawId}`;
    return (
      alts[altKey] ?? {
        active: 0,
        options: [pickSelection(mods[key].selections, section.selectionKeys)],
      }
    );
  }

  function altSectionPass(
    key: ModuleKey,
    section: AdapterSection,
    option: Record<string, unknown>
  ): boolean | null {
    const prefix = ADAPTER_BY_KEY[key].checkPrefix;
    try {
      const all = computeChecksWith(key, { ...mods[key].selections, ...option });
      const checks = section.checkSuffixes
        .map((s) => all.find((c) => c.id === `${prefix}${s}`))
        .filter((c): c is AnyCheck => Boolean(c));
      if (checks.length === 0) return null;
      return checks.every((c) => c.pass);
    } catch {
      return null;
    }
  }

  function switchAlt(key: ModuleKey, section: AdapterSection, index: number) {
    const altKey = `${key}-${section.rawId}`;
    const sel = mods[key].selections;
    const st = altStateFor(key, section);
    if (index === st.active) return;
    const options = [...st.options];
    options[st.active] = pickSelection(sel, section.selectionKeys);
    setModuleSelections(key, { ...sel, ...options[index] });
    setAlts({ ...alts, [altKey]: { active: index, options } });
  }

  function addAlt(key: ModuleKey, section: AdapterSection) {
    const altKey = `${key}-${section.rawId}`;
    const st = altStateFor(key, section);
    if (st.options.length >= 3) return;
    const current = pickSelection(mods[key].selections, section.selectionKeys);
    const options = [...st.options];
    options[st.active] = current;
    options.push({ ...current });
    setAlts({ ...alts, [altKey]: { active: options.length - 1, options } });
  }

  function removeAlt(key: ModuleKey, section: AdapterSection) {
    const altKey = `${key}-${section.rawId}`;
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
        disabledList
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

  // ------------------------------------------------------------ renderers
  function renderSpecs() {
    return (
      <Card>
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
            const fields = SPEC_FIELDS.filter(
              (f) =>
                f.group === group.key &&
                (!f.requiresModule || present(f.requiresModule))
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
                <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
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
                      "inline-flex cursor-pointer items-center gap-2 text-sm",
                      parentOff && "cursor-not-allowed opacity-45"
                    )}
                    title={
                      parentOff
                        ? `Önce ${MODULE_LABELS[parent!]} bölümünü açın`
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
                    {MODULE_LABELS[k]}
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
    const checks = sectionChecks(key, section);
    const { byRow, rest } = distributeChecks(key, section);
    const scopedInputs = section.inputScope ? section.inputScope.get(inputs) : inputs;
    const isHoist = isHoistKey(key);
    const derivation = derivations[key];

    const onInputsChange = (next: object) => {
      setModuleInputs(
        key,
        section.inputScope ? section.inputScope.set(inputs, next) : next
      );
    };

    /** Kaldırma modüllerinde otomatik doldurulabilen alanların anahtar durumu */
    function autoStateFor(fieldKey: string): AutoFieldState | undefined {
      if (!isHoist) return undefined;
      const flag = HOIST_AUTO_FIELDS[fieldKey];
      if (!flag) return undefined;
      const hoistInputs = inputs as unknown as HoistInputs;
      const on = hoistInputs[flag] === true;
      return {
        on,
        onToggle: (next) =>
          setModuleInputs(key, { ...(inputs as object), [flag]: next }),
        warning: derivation?.warnings.find((w) => w.field === fieldKey)?.message,
      };
    }

    return (
      <Card>
        <CardHeader className="border-b pb-4">
          <CardTitle className="flex flex-wrap items-center gap-2 text-base">
            <span className="inline-flex h-6 items-center bg-primary/10 px-2 font-mono text-xs font-semibold tabular-nums text-primary">
              {section.id}
            </span>
            <span className="tracking-tight">{section.title}</span>
            <Badge variant="outline" className="font-normal text-muted-foreground">
              {adapter.title}
            </Badge>
            {checks.length > 0 && (
              <Badge
                variant={checks.every((c) => c.pass) ? "secondary" : "destructive"}
                className={cn(
                  "ml-auto",
                  checks.every((c) => c.pass) && "border-transparent bg-success/15 text-success"
                )}
              >
                {checks.filter((c) => c.pass).length}/{checks.length} uygun
              </Badge>
            )}
          </CardTitle>
          {section.description && (
            <p className="text-sm text-muted-foreground">{section.description}</p>
          )}
        </CardHeader>
        <CardContent className="grid gap-5">
          {/* Parametrik diyagram (7.1 kesit, 5.2/6.2 teker mili, 2.1/3.1 donanım) */}
          <SectionDiagram
            moduleKey={key}
            sectionId={section.rawId}
            input={calcInput}
            result={result}
          />
          {(section.inputDefs.length > 0 || (section.extraInputDefs?.length ?? 0) > 0) && (
            <div>
              <h3 className="oc-kicker mb-2 text-muted-foreground">
                Girdiler / Tasarım Kabulleri
              </h3>
              <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {section.inputDefs.map((f) => (
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
          {section.selectionDefs.length > 0 && (() => {
            const st = altStateFor(key, section);
            const catalogMapping = getCatalogMapping(key, section.rawId);
            return (
              <div>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="oc-kicker text-muted-foreground">
                      Katalog Seçimi
                    </h3>
                    {catalogMapping && (
                      <span className="border px-1.5 py-px font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                        ▾ {catalogKindLabel(catalogMapping.kind)}
                      </span>
                    )}
                    {!readOnly && catalogMapping && (
                      <CatalogPicker
                        mapping={catalogMapping}
                        onPick={(row) =>
                          setModuleSelections(key, {
                            ...(mods[key].selections as object),
                            ...applyCatalogPick(catalogMapping, row),
                          })
                        }
                      />
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
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
                            "inline-flex items-center gap-1.5 border px-2.5 py-1 text-xs transition-colors",
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
                        className="border border-dashed px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted"
                        title="Bu ekipman için alternatif seçim ekle (en fazla 3)"
                      >
                        + Alternatif
                      </button>
                    )}
                    {!readOnly && st.options.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeAlt(key, section)}
                        className="border px-2 py-1 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        title="Aktif alternatifi sil"
                        aria-label="Alternatifi sil"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
                <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {section.selectionDefs.map((f) => (
                    <Field
                      key={f.key}
                      def={f}
                      value={sel}
                      onChange={(next) => setModuleSelections(key, next)}
                      disabled={readOnly}
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
                <h3 className="oc-kicker mb-2 text-muted-foreground">
                  Hesap ve Kontroller
                </h3>
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
    const blocks = MODULE_ADAPTERS.filter((a) => {
      const mr = moduleResult(a.key);
      return present(a.key) && mr && mr.checks.length > 0;
    });
    const totalFail = result.allChecks.filter((c) => !c.pass).length;
    return (
      <Card>
        <CardHeader className="border-b pb-4">
          <CardTitle className="text-base tracking-tight">Özet · Kontrol Panosu</CardTitle>
          <p className="text-sm text-muted-foreground">
            {totalFail === 0
              ? `Hesap raporundaki ${result.allChecks.length} kontrolün tamamı uygun.`
              : `Hesap raporundaki ${result.allChecks.length} kontrolün ${totalFail} tanesi uygun değil. ` +
                "Kırmızı satıra karşılık gelen bölüme dönüp seçimi gözden geçirin."}
          </p>
        </CardHeader>
        {/* Masaüstünde iki sütun: tüm bölümler tek ekranda görünür */}
        <CardContent className="grid gap-5 lg:grid-cols-2 lg:gap-x-6">
          {blocks.map((adapter) => {
            const mr = moduleResult(adapter.key)!;
            const modulePass = mr.checks.filter((c) => c.pass).length;
            const allOk = modulePass === mr.checks.length;
            return (
              <section key={adapter.key} className="grid content-start gap-2">
                <div className="flex items-center justify-between gap-2 border-b pb-1.5">
                  <h3 className="text-sm font-semibold tracking-tight">
                    {renumberTitle(adapter.title, numbers[adapter.key] ?? 0)}
                  </h3>
                  <span
                    className={cn(
                      "shrink-0 font-mono text-[11px] font-medium tabular-nums",
                      allOk ? "text-success" : "text-destructive"
                    )}
                  >
                    {modulePass}/{mr.checks.length} Uygun
                  </span>
                </div>
                {mr.checks.map((c) => (
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
  const passCount = result.allChecks.length - failCount;
  const progressPct = ((stepIndex + 1) / STEPS.length) * 100;
  const stepChecks =
    step.kind === "module" ? sectionChecks(step.moduleKey, step.section) : [];

  function navItem(s: Step, i: number) {
    // Numara çipi + kontrol özeti: durum noktası yerine "✓ n/m" sayısı
    // (hepsi geçtiyse nötr, kalan varsa kırmızı).
    const checks = s.kind === "module" ? sectionChecks(s.moduleKey, s.section) : [];
    const passN = checks.filter((c) => c.pass).length;
    const chip = s.kind === "module" ? s.section.id : s.kind === "specs" ? "01" : "ÖZ";
    const label =
      s.kind === "module"
        ? s.section.title
        : s.kind === "specs"
          ? "Teknik Özellikler"
          : "Özet · Kontrol Panosu";
    return (
      <li key={s.key}>
        <button
          type="button"
          onClick={() => setStepIndex(i)}
          className={cn(
            "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors",
            i === stepIndex
              ? "bg-primary/10 font-medium text-primary"
              : "text-foreground/80 hover:bg-muted hover:text-foreground"
          )}
        >
          <span
            className={cn(
              "inline-flex h-5 min-w-8 shrink-0 items-center justify-center px-1 font-mono text-[10px] tabular-nums",
              i === stepIndex ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
            )}
          >
            {chip}
          </span>
          <span className="min-w-0 flex-1 truncate">{label}</span>
          {checks.length > 0 && (
            <span
              className={cn(
                "shrink-0 font-mono text-[10px] tabular-nums",
                passN === checks.length ? "text-muted-foreground" : "text-destructive"
              )}
            >
              {passN}/{checks.length}
            </span>
          )}
        </button>
      </li>
    );
  }

  const navQ = navQuery.trim().toLocaleLowerCase("tr-TR");
  const stepMatches = (s: Step) =>
    navQ === "" || s.title.toLocaleLowerCase("tr-TR").includes(navQ);

  return (
    <div className="grid gap-3">
      {/* Rol lejantı — 4 değer rolünün görsel dili */}
      <RoleLegend />
      <div className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[290px_minmax(0,1fr)]">
      {/* Bölüm navigasyonu */}
      <nav className="lg:sticky lg:top-16 lg:max-h-[calc(100vh-5rem)] lg:self-start lg:overflow-y-auto lg:pr-1">
        <div className="mb-1.5 flex items-center justify-between px-2">
          <span className="oc-kicker text-muted-foreground">
            Bölümler
          </span>
          <span
            className={cn(
              "font-mono text-[11px] font-medium tabular-nums",
              failCount === 0 ? "text-success" : "text-destructive"
            )}
          >
            {passCount}/{result.allChecks.length} uygun
          </span>
        </div>
        {/* Bölüm arama kutusu — ikon yerine mono ARA placeholder */}
        <div className="mb-2 px-1">
          <Input
            value={navQuery}
            onChange={(e) => setNavQuery(e.target.value)}
            placeholder="ARA · bölüm adı"
            className="h-8 bg-background text-sm placeholder:font-mono placeholder:text-xs"
            aria-label="Bölüm ara"
          />
        </div>
        <ol className="grid gap-0.5 text-sm">
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
                    className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground disabled:cursor-default"
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
                    <span className="min-w-0 flex-1 truncate">{group.title}</span>
                    {!isDisabled && withChecks > 0 && (
                      <span
                        className={cn(
                          "font-mono text-[10px] font-medium normal-case tabular-nums",
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
                      <span className="font-mono text-[10px] normal-case text-muted-foreground">
                        kapalı
                      </span>
                    )}
                  </button>
                  {/* Bölüm aç/kapa — kapalı bölüm hesaba ve rapora girmez */}
                  {group.optional && group.moduleKey && (
                    <button
                      type="button"
                      disabled={readOnly}
                      onClick={() => toggleModule(group.moduleKey!, isDisabled)}
                      title={
                        isDisabled
                          ? `${MODULE_LABELS[group.moduleKey]} bölümünü aç`
                          : `${MODULE_LABELS[group.moduleKey]} bölümünü gizle (hesaba ve rapora girmez)`
                      }
                      aria-label={
                        isDisabled
                          ? `${MODULE_LABELS[group.moduleKey]} bölümünü aç`
                          : `${MODULE_LABELS[group.moduleKey]} bölümünü gizle`
                      }
                      aria-pressed={!isDisabled}
                      className={cn(
                        "grid size-6 shrink-0 place-items-center rounded font-mono text-[11px] transition-colors",
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
      </nav>

      {/* İçerik */}
      <div className="grid content-start gap-4">
        {/* Sticky durum çubuğu */}
        <div className="sticky top-12 z-20 grid gap-2 rounded-lg border bg-card px-4 py-2.5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <div className="flex items-center gap-1.5 text-sm">
              {failCount === 0 ? (
                <>
                  <span aria-hidden="true" className="shrink-0 font-mono font-semibold text-success">✓</span>
                  <span className="font-medium text-success">Tüm kontroller uygun</span>
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">
                    ({result.allChecks.length} kontrol)
                  </span>
                </>
              ) : (
                <>
                  <span aria-hidden="true" className="shrink-0 font-mono font-semibold text-destructive">✗</span>
                  <span className="font-medium text-destructive">
                    {failCount} kontrol uygun değil
                  </span>
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">
                    / {result.allChecks.length} kontrol
                  </span>
                </>
              )}
            </div>
            {step.kind === "module" && stepChecks.length > 0 && (
              <span
                className={cn(
                  "hidden border px-1.5 py-0.5 font-mono text-[11px] tabular-nums sm:inline",
                  stepChecks.every((c) => c.pass)
                    ? "border-success/30 text-success"
                    : "border-destructive/40 text-destructive"
                )}
              >
                bu bölüm {stepChecks.filter((c) => c.pass).length}/{stepChecks.length}
              </span>
            )}
            <span className="ml-auto hidden font-mono text-[11px] text-muted-foreground md:inline">
              motor v{result.engineVersion}
            </span>
            {!readOnly && (
              <Button onClick={handleSave} disabled={pending} size="sm">
                {pending ? "Kaydediliyor..." : "Kaydet"}
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2.5">
            <div className="h-1 flex-1 overflow-hidden bg-muted">
              <div
                className="h-full bg-primary transition-[width] duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <span className="max-w-[55%] truncate font-mono text-[11px] tabular-nums text-muted-foreground">
              {stepIndex + 1}/{STEPS.length} · {step.title}
            </span>
          </div>
        </div>

        {step.kind === "specs" && renderSpecs()}
        {step.kind === "module" && renderModuleSection(step.moduleKey, step.section)}
        {step.kind === "summary" && renderSummary()}

        {/* Sticky alt gezinme şeridi */}
        <div className="sticky bottom-0 z-20 flex items-center justify-between rounded-lg border bg-card px-4 py-2.5">
          <Button
            variant="outline"
            size="sm"
            disabled={stepIndex === 0}
            onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
          >
            <span aria-hidden="true" className="font-mono">←</span>
            Geri
          </Button>
          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            Adım {stepIndex + 1} / {STEPS.length}
          </span>
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
