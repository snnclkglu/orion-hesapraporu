"use client";

// Revizyon editörü — bölüm bölüm ilerleyen sihirbaz yapısı.
// Adım sırası: 01 Teknik Özellikler → 02 Ana Kaldırma → 03 Yrd Kaldırma →
// 04 Kanca Bloğu → 05 Araba Yürütme → 06 Köprü Yürütme → 07 Ana Kiriş →
// 08 Buruşma → 09 Başkiriş → Özet. Her bölümde: girdiler/katalog seçimleri,
// hemen altında bölümün HESABI (sembolik formül → sayılar yerine konmuş hali)
// ve ✓/✗ kontrolleri. Excel'in bölüm numaraları korunur.
// Modüllerin sunum farkları module-adapters.ts'te tek tipe indirgenmiştir.

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { runCalc, type CalcInput, type CalcResult } from "@/lib/calc/engine";
import { computeHoistGroup } from "@/lib/calc/modules/hoistGroup";
import { computeHookBlock } from "@/lib/calc/modules/hookBlock";
import { computeTravelGroup } from "@/lib/calc/modules/travelGroup";
import { computeMainGirder } from "@/lib/calc/modules/mainGirder";
import { computeBuckling } from "@/lib/calc/modules/buckling";
import { computeEndCarriage } from "@/lib/calc/modules/endCarriage";
import { SPEC_FIELDS } from "@/lib/calc/fields";
import { NEW_WORK_TEMPLATE as V5_TEMPLATE } from "@/lib/calc/defaults";
import type { AnyCheck, ModuleResult } from "@/lib/calc/types";
import type { HoistInputs, HoistSelections } from "@/lib/calc/modules/hoistGroup";
import type { HookBlockInputs, HookBlockSelections } from "@/lib/calc/modules/hookBlock";
import type { TravelInputs, TravelSelections } from "@/lib/calc/modules/travelGroup";
import type { GirderInputs, GirderSelections } from "@/lib/calc/modules/mainGirder";
import type { BucklingInputs } from "@/lib/calc/modules/buckling";
import type { EndCarriageInputs, EndCarriageSelections } from "@/lib/calc/modules/endCarriage";
import type { HoistCtx } from "@/lib/calc/presentation/hoistSections";
import type { HookBlockCtx } from "@/lib/calc/presentation/hookBlockSections";
import type { TravelCtx } from "@/lib/calc/presentation/travelSections";
import type { GirderCtx } from "@/lib/calc/presentation/girderSections";
import type { BucklingCtx } from "@/lib/calc/presentation/bucklingSections";
import type { EndCarriageCtx } from "@/lib/calc/presentation/endCarriageSections";
import {
  ADAPTER_BY_KEY,
  MODULE_ADAPTERS,
  OPTIONAL_MODULE_KEYS,
  buildModuleDeps,
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
} from "@/lib/catalog-mapping";
import { CatalogPicker } from "@/components/catalog-picker";
import { SectionDiagram } from "@/components/diagrams/section-diagram";
import { MathFormula } from "@/components/math/math-formula";
import { FemTableButton } from "@/components/fem-table-dialog";
import { FEM_TABLES } from "@/lib/calc/fem-tables";
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

/** Opsiyonel modüllerin kullanıcı etiketleri (modül aç/kapa kontrolü). */
const OPTIONAL_MODULE_LABELS: Partial<Record<ModuleKey, string>> = {
  aux: "Yardımcı Kaldırma",
  hookBlock: "Kanca Bloğu",
};

function fmt(v: number | string | null | undefined, digits = 2): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string") return v;
  if (Number.isInteger(v)) return v.toLocaleString("tr-TR");
  return v.toLocaleString("tr-TR", { maximumFractionDigits: digits });
}

// ---------------------------------------------------------------- Field
function Field({
  def, value, onChange, disabled,
}: {
  def: AnyFieldDef;
  value: object;
  onChange: (next: object) => void;
  disabled?: boolean;
}) {
  const v = (value as Record<string, unknown>)[def.key];
  const id = `f-${def.key}`;
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
      <Label htmlFor={id} className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span>
          {def.label}
          {def.unit ? (
            <>
              {" "}
              <span className="font-mono">[{toDisplayUnitLabel(def.unit)}]</span>
            </>
          ) : null}
        </span>
        {(() => {
          const ft = (def as { femTable?: string }).femTable;
          return ft && FEM_TABLES[ft] ? (
            <FemTableButton
              table={FEM_TABLES[ft]}
              value={typeof v === "number" ? v : undefined}
              activeHeader={typeof v === "string" ? v : undefined}
            />
          ) : null;
        })()}
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
            disabled={disabled}
          >
            <SelectTrigger id={id} className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {opts.map((o) => (
                <SelectItem key={o} value={o}>
                  {(def as { optionLabels?: Record<string, string> }).optionLabels?.[o] ?? o}
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
              def.type === "number" && "font-mono tabular-nums"
            )}
            inputMode={def.type === "number" ? "decimal" : undefined}
            value={def.type === "number" && draft !== null ? draft : String(v ?? "")}
            disabled={disabled}
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
    </div>
  );
}

// ---------------------------------------------------------------- Checks
function CheckRow({ check }: { check: AnyCheck }) {
  const range = check.op === "range";
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
          {check.nonExcel && (
            <span className="ml-1 align-middle text-[11px] font-mono text-muted-foreground">(ek kontrol)</span>
          )}
        </div>
        <div className="font-mono text-xs tabular-nums text-muted-foreground">
          {(() => {
            const prov = toDisplayUnit(check.provided, check.unit);
            const u = prov.unit === "-" || !prov.unit ? "" : ` ${prov.unit}`;
            if (range) {
              const mn = toDisplayUnit((check as { min: number }).min, check.unit);
              const mx = toDisplayUnit((check as { max: number }).max, check.unit);
              return `${fmt(prov.value)}${u} · izin: ${fmt(mn.value)}…${fmt(mx.value)}`;
            }
            const req = toDisplayUnit((check as { required: number }).required, check.unit);
            return `gereken ${fmt(req.value)}${u} · sağlanan ${fmt(prov.value)}${u}`;
          })()}
          {check.standard ? ` · ${check.standard}` : ""}
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
function CalcRow({ row, ctx }: { row: AdapterRow; ctx: unknown }) {
  const raw = row.read(ctx);
  const { value, unit } = toDisplayUnit(raw, row.unit);
  return (
    <div className="grid gap-1 border-b py-2.5 last:border-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="min-w-0 text-sm">{row.label}</span>
        {/* Hesaplanan değer rolü: salt-okunur, bg-muted zemin + mono — birim boşlukla ayrık */}
        <span className="shrink-0 bg-muted px-2 py-0.5 font-mono text-sm font-semibold tabular-nums text-foreground">
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
          <span className="border border-primary/25 bg-primary/5 px-1.5 py-px font-mono text-[10px] text-primary/90">
            {row.standard}
          </span>
        </div>
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
  items: { step: Step; index: number }[];
}

function buildNavGroups(
  steps: Step[],
  numbers: Partial<Record<ModuleKey, number>>
): NavGroup[] {
  const groups: NavGroup[] = [];
  steps.forEach((step, index) => {
    if (step.kind === "module") {
      const last = groups[groups.length - 1];
      if (last && last.moduleKey === step.moduleKey) {
        last.items.push({ step, index });
      } else {
        groups.push({
          key: `mod-${step.moduleKey}`,
          title: renumberTitle(
            ADAPTER_BY_KEY[step.moduleKey].title,
            numbers[step.moduleKey] ?? 0
          ),
          moduleKey: step.moduleKey,
          items: [{ step, index }],
        });
      }
    } else {
      groups.push({ key: step.key, title: null, items: [{ step, index }] });
    }
  });
  return groups;
}

// ---------------------------------------------------------------- Modül durumu
interface ModulesState {
  main: { inputs: HoistInputs; selections: HoistSelections };
  aux: { inputs: HoistInputs; selections: HoistSelections };
  hookBlock: { inputs: HookBlockInputs; selections: HookBlockSelections };
  trolley: { inputs: TravelInputs; selections: TravelSelections };
  bridge: { inputs: TravelInputs; selections: TravelSelections };
  girder: { inputs: GirderInputs; selections: GirderSelections };
  buckling: { inputs: BucklingInputs; selections: Record<string, unknown> };
  endCarriage: { inputs: EndCarriageInputs; selections: EndCarriageSelections };
}

function initModules(initial: CalcInput): ModulesState {
  // Eksik modüller (eski kayıtlar) V5 şablon değerleriyle tamamlanır.
  return {
    main: {
      inputs: initial.mainHoist?.inputs ?? V5_TEMPLATE.mainHoist!.inputs,
      selections: initial.mainHoist?.selections ?? V5_TEMPLATE.mainHoist!.selections,
    },
    aux: {
      inputs: initial.auxHoist?.inputs ?? V5_TEMPLATE.auxHoist!.inputs,
      selections: initial.auxHoist?.selections ?? V5_TEMPLATE.auxHoist!.selections,
    },
    hookBlock: {
      inputs: initial.hookBlock?.inputs ?? V5_TEMPLATE.hookBlock!.inputs,
      selections: initial.hookBlock?.selections ?? V5_TEMPLATE.hookBlock!.selections,
    },
    trolley: {
      inputs: initial.trolley?.inputs ?? V5_TEMPLATE.trolley!.inputs,
      selections: initial.trolley?.selections ?? V5_TEMPLATE.trolley!.selections,
    },
    bridge: {
      inputs: initial.bridge?.inputs ?? V5_TEMPLATE.bridge!.inputs,
      selections: initial.bridge?.selections ?? V5_TEMPLATE.bridge!.selections,
    },
    girder: {
      inputs: initial.girder?.inputs ?? V5_TEMPLATE.girder!.inputs,
      selections: initial.girder?.selections ?? V5_TEMPLATE.girder!.selections,
    },
    buckling: {
      inputs: initial.buckling?.inputs ?? V5_TEMPLATE.buckling!.inputs,
      selections: {},
    },
    endCarriage: {
      inputs: initial.endCarriage?.inputs ?? V5_TEMPLATE.endCarriage!.inputs,
      selections: initial.endCarriage?.selections ?? V5_TEMPLATE.endCarriage!.selections,
    },
  };
}

// ---------------------------------------------------------------- Editor
export function RevisionEditor({
  projectId, revisionId, readOnly, initial, initialAlts,
}: {
  projectId: string;
  revisionId: string;
  readOnly: boolean;
  initial: CalcInput;
  initialAlts?: AltsMap;
}) {
  const [specs, setSpecs] = useState(initial.specs);
  const [mods, setMods] = useState<ModulesState>(() => initModules(initial));
  const [alts, setAlts] = useState<AltsMap>(initialAlts ?? {});
  const [stepIndex, setStepIndex] = useState(0);
  // Esnek modüller: opsiyonel modüller (yardımcı kaldırma, kanca bloğu) açık/kapalı.
  // Başlangıç: revizyonda modül varsa açık. Kapatılınca hesaba/rapora girmez ve
  // numaralandırma yeniden dizilir.
  const [enabled, setEnabled] = useState<Record<ModuleKey, boolean>>(() => ({
    main: true,
    aux: initial.auxHoist != null,
    hookBlock: initial.hookBlock != null,
    trolley: true,
    bridge: true,
    girder: true,
    buckling: true,
    endCarriage: true,
  }));
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

  const present = useCallback((k: ModuleKey) => enabled[k] !== false, [enabled]);
  const numbers = useMemo(() => moduleDisplayNumbers(present), [present]);
  const STEPS = useMemo(() => buildSteps(present, numbers), [present, numbers]);
  const NAV_GROUPS = useMemo(() => buildNavGroups(STEPS, numbers), [STEPS, numbers]);
  // Modül kapatılınca adım sayısı azalabilir → aktif adımı sınırla
  useEffect(() => {
    setStepIndex((i) => Math.min(i, STEPS.length - 1));
  }, [STEPS.length]);

  const calcInput: CalcInput = useMemo(
    () => ({
      specs,
      mainHoist: mods.main,
      auxHoist: enabled.aux ? mods.aux : undefined,
      hookBlock: enabled.hookBlock ? mods.hookBlock : undefined,
      trolley: mods.trolley,
      bridge: mods.bridge,
      girder: mods.girder,
      buckling: { inputs: mods.buckling.inputs },
      endCarriage: mods.endCarriage,
    }),
    [specs, mods, enabled]
  );
  const result = useMemo(() => runCalc(calcInput), [calcInput]);
  const deps = useMemo(() => buildModuleDeps(calcInput, result), [calcInput, result]);

  const failCount = result.allChecks.filter((c) => !c.pass).length;
  const step = STEPS[Math.min(stepIndex, STEPS.length - 1)] ?? STEPS[0];

  // ------------------------------------------------------------ modül erişimi
  function moduleResult(key: ModuleKey): ModuleResult<unknown> | undefined {
    const map: Record<ModuleKey, ModuleResult<unknown> | undefined> = {
      main: result.mainHoist,
      aux: result.auxHoist,
      hookBlock: result.hookBlock,
      trolley: result.trolley,
      bridge: result.bridge,
      girder: result.girder,
      buckling: result.buckling,
      endCarriage: result.endCarriage,
    };
    return map[key];
  }

  function setModuleInputs(key: ModuleKey, next: object) {
    setMods((m) => ({ ...m, [key]: { ...m[key], inputs: next } }) as ModulesState);
  }

  function setModuleSelections(key: ModuleKey, next: object) {
    setMods((m) => ({ ...m, [key]: { ...m[key], selections: next } }) as ModulesState);
  }

  /** Sunum katmanı ctx'i — her modülün kendi Ctx tipiyle kurulur */
  function ctxFor(key: ModuleKey): unknown {
    const mr = moduleResult(key);
    const c = mr?.cells ?? {};
    switch (key) {
      case "main":
      case "aux": {
        const ctx: HoistCtx = {
          c, inp: mods[key].inputs, sel: mods[key].selections, specs, which: key,
        };
        return ctx;
      }
      case "hookBlock": {
        const ctx: HookBlockCtx = {
          c,
          v: result.hookBlock!.values,
          inp: mods.hookBlock.inputs,
          sel: mods.hookBlock.selections,
          deps: deps.hookBlock,
          specs,
        };
        return ctx;
      }
      case "trolley":
      case "bridge": {
        const ctx: TravelCtx = {
          c,
          v: (key === "trolley" ? result.trolley! : result.bridge!).values,
          inp: mods[key].inputs,
          sel: mods[key].selections,
          specs,
          deps: deps.travel,
          which: key,
        };
        return ctx;
      }
      case "girder": {
        const ctx: GirderCtx = {
          c, inp: mods.girder.inputs, sel: mods.girder.selections, deps: deps.girder, specs,
        };
        return ctx;
      }
      case "buckling": {
        const ctx: BucklingCtx = { c, inp: mods.buckling.inputs };
        return ctx;
      }
      case "endCarriage": {
        const ctx: EndCarriageCtx = {
          c,
          inp: mods.endCarriage.inputs,
          sel: mods.endCarriage.selections,
          deps: deps.endCarriage,
          specs,
        };
        return ctx;
      }
    }
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

  // ---------------------------------------------------------- alternatifler
  function pickSelection(sel: object, keys: readonly string[]): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    const rec = sel as Record<string, unknown>;
    for (const k of keys) out[k] = rec[k];
    return out;
  }

  /** Verilen seçimlerle ilgili modülün kontrollerini yeniden hesaplar */
  function computeChecksWith(key: ModuleKey, sel: object): AnyCheck[] {
    switch (key) {
      case "main":
      case "aux":
        return computeHoistGroup(specs, key, mods[key].inputs, sel as HoistSelections).checks;
      case "hookBlock":
        return computeHookBlock(
          specs, mods.hookBlock.inputs, sel as HookBlockSelections, deps.hookBlock
        ).checks;
      case "trolley":
        return computeTravelGroup(
          specs, "trolley", mods.trolley.inputs, sel as TravelSelections, deps.travel
        ).checks;
      case "bridge":
        return computeTravelGroup(
          specs, "bridge", mods.bridge.inputs, sel as TravelSelections, deps.travel
        ).checks;
      case "girder":
        return computeMainGirder(
          specs, mods.girder.inputs, sel as GirderSelections, deps.girder
        ).checks;
      case "buckling":
        return computeBuckling(mods.buckling.inputs).checks;
      case "endCarriage":
        return computeEndCarriage(
          specs, mods.endCarriage.inputs, sel as EndCarriageSelections, deps.endCarriage
        ).checks;
    }
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
      const res = await saveRevision(projectId, revisionId, calcInput, syncedAlts());
      if (res.error) toast.error(res.error);
      else {
        setDirty(false);
        toast.success("Revizyon kaydedildi.");
      }
    });
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
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {SPEC_FIELDS.map((f) => (
              <Field
                key={f.key}
                def={f}
                value={specs}
                onChange={(next) => setSpecs(next as typeof specs)}
                disabled={readOnly}
              />
            ))}
          </div>

          {/* Vinç modülleri — opsiyonel modüller açık/kapalı; numaralandırma dinamik */}
          <div className="mt-6 border-t pt-4">
            <div className="mb-2 text-xs font-medium text-muted-foreground">
              Vinç Modülleri (opsiyonel)
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {OPTIONAL_MODULE_KEYS.map((k) => (
                <label key={k} className="inline-flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={enabled[k] !== false}
                    disabled={readOnly}
                    onChange={(e) => setEnabled((m) => ({ ...m, [k]: e.target.checked }))}
                    className="size-4 accent-primary"
                  />
                  {OPTIONAL_MODULE_LABELS[k] ?? k}
                </label>
              ))}
            </div>
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              Kapatılan modül hesaba ve rapora girmez; bölüm numaraları otomatik yeniden dizilir
              (ör. yardımcı kaldırma yoksa Kanca Bloğu 03 olur).
            </p>
          </div>
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
    const scopedInputs = section.inputScope ? section.inputScope.get(inputs) : inputs;

    const onInputsChange = (next: object) => {
      setModuleInputs(
        key,
        section.inputScope ? section.inputScope.set(inputs, next) : next
      );
    };

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
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {section.inputDefs.map((f) => (
                  <Field
                    key={f.key}
                    def={f}
                    value={scopedInputs}
                    onChange={onInputsChange}
                    disabled={readOnly}
                  />
                ))}
                {section.extraInputDefs?.map((f) => (
                  <Field
                    key={f.key}
                    def={f}
                    value={inputs}
                    onChange={(next) => setModuleInputs(key, next)}
                    disabled={readOnly}
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
                        ▾ {catalogMapping.kind}
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
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {section.selectionDefs.map((f) => (
                    <Field
                      key={f.key}
                      def={f}
                      value={sel}
                      onChange={(next) => setModuleSelections(key, next)}
                      disabled={readOnly}
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
                  Hesap
                </h3>
                <div className="rounded-lg border bg-background px-3 dark:bg-card">
                  {section.rows.map((r) => (
                    <CalcRow key={r.key} row={r} ctx={ctx} />
                  ))}
                </div>
              </div>
            </>
          )}
          {checks.length > 0 && (
            <div className="grid gap-2">
              <h3 className="oc-kicker text-muted-foreground">
                Kontroller
              </h3>
              {checks.map((c) => <CheckRow key={c.id} check={c} />)}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  function renderSummary() {
    return (
      <Card>
        <CardHeader className="border-b pb-4">
          <CardTitle className="text-base tracking-tight">Özet · Kontrol Panosu</CardTitle>
          <p className="text-sm text-muted-foreground">
            Tüm bölümlerin kontrol durumu. Kırmızı satır = ilgili bölüme dönüp seçimi revize edin.
          </p>
        </CardHeader>
        <CardContent className="grid gap-4">
          {MODULE_ADAPTERS.map((adapter) => {
            const mr = moduleResult(adapter.key);
            if (!mr || mr.checks.length === 0) return null;
            const modulePass = mr.checks.filter((c) => c.pass).length;
            return (
              <div key={adapter.key} className="grid gap-2">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold tracking-tight">
                    {renumberTitle(adapter.title, numbers[adapter.key] ?? 0)}
                  </h3>
                  <span
                    className={cn(
                      "font-mono text-[11px] font-medium tabular-nums",
                      modulePass === mr.checks.length ? "text-success" : "text-destructive"
                    )}
                  >
                    {modulePass}/{mr.checks.length} uygun
                  </span>
                </div>
                {mr.checks.map((c) => (
                  <CheckRow key={c.id} check={c} />
                ))}
              </div>
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
            if (visibleItems.length === 0) return null;
            // Grupsuz tek adımlar (Teknik Özellikler, Özet)
            if (group.title === null) {
              const { step: s, index: i } = visibleItems[0];
              return navItem(s, i);
            }
            const statuses = group.items.map(({ step: s }) =>
              s.kind === "module" ? sectionStatus(s.moduleKey, s.section) : "none"
            );
            const withChecks = statuses.filter((st) => st !== "none").length;
            const passed = statuses.filter((st) => st === "pass").length;
            const anyFail = statuses.some((st) => st === "fail");
            const containsCurrent = group.items.some(({ index: i }) => i === stepIndex);
            const isOpen = navQ !== "" || containsCurrent || !!openGroups[group.key];
            return (
              <li key={group.key}>
                <button
                  type="button"
                  onClick={() =>
                    setOpenGroups((g) => ({ ...g, [group.key]: !isOpen }))
                  }
                  className="mt-2 flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "inline-block shrink-0 font-mono transition-transform",
                      !isOpen && "-rotate-90"
                    )}
                  >
                    ▾
                  </span>
                  <span className="min-w-0 flex-1 truncate">{group.title}</span>
                  {withChecks > 0 && (
                    <span
                      className={cn(
                        "font-mono text-[10px] font-medium tabular-nums normal-case",
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
                </button>
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
