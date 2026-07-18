"use client";

// Revizyon editörü — bölüm bölüm ilerleyen sihirbaz yapısı.
// Adım sırası: 01 Teknik Özellikler → 02 Ana Kaldırma → 03 Yrd Kaldırma →
// 04 Kanca Bloğu → 05 Araba Yürütme → 06 Köprü Yürütme → 07 Ana Kiriş →
// 08 Buruşma → 09 Başkiriş → Özet. Her bölümde: girdiler/katalog seçimleri,
// hemen altında bölümün HESABI (sembolik formül → sayılar yerine konmuş hali)
// ve ✓/✗ kontrolleri. Excel'in bölüm numaraları korunur.
// Modüllerin sunum farkları module-adapters.ts'te tek tipe indirgenmiştir.

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { runCalc, type CalcInput, type CalcResult } from "@/lib/calc/engine";
import { computeHoistGroup } from "@/lib/calc/modules/hoistGroup";
import { computeHookBlock } from "@/lib/calc/modules/hookBlock";
import { computeTravelGroup } from "@/lib/calc/modules/travelGroup";
import { computeMainGirder } from "@/lib/calc/modules/mainGirder";
import { computeBuckling } from "@/lib/calc/modules/buckling";
import { computeEndCarriage } from "@/lib/calc/modules/endCarriage";
import { SPEC_FIELDS } from "@/lib/calc/fields";
import { V5_TEMPLATE } from "@/lib/calc/defaults";
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
  buildModuleDeps,
  type AdapterRow,
  type AdapterSection,
  type AnyFieldDef,
  type ModuleKey,
} from "./module-adapters";
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
  return (
    <div className="grid gap-1">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {def.label}
        {def.unit ? ` [${def.unit}]` : ""}
      </Label>
      {def.type === "select" ? (
        <Select
          value={String(v)}
          onValueChange={(nv) => onChange({ ...value, [def.key]: nv })}
          disabled={disabled}
        >
          <SelectTrigger id={id} className="h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(def.options ?? []).map((o) => (
              <SelectItem key={o} value={o}>{o}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Input
          id={id}
          className="h-8"
          inputMode={def.type === "number" ? "decimal" : undefined}
          value={String(v ?? "")}
          disabled={disabled}
          onChange={(e) => {
            const raw = e.target.value;
            if (def.type === "number") {
              const nv = parseFloat(raw.replace(",", "."));
              onChange({ ...value, [def.key]: Number.isFinite(nv) ? nv : 0 });
            } else {
              onChange({ ...value, [def.key]: raw });
            }
          }}
        />
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
        "flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm",
        check.pass ? "border-green-600/30 bg-green-500/5" : "border-destructive/40 bg-destructive/5"
      )}
    >
      <div className="min-w-0">
        <div className="truncate font-medium">
          {check.label}
          {check.nonExcel && (
            <span className="ml-1 align-middle text-[10px] text-muted-foreground">(ek kontrol)</span>
          )}
        </div>
        <div className="text-xs text-muted-foreground">
          {(() => {
            const u = check.unit === "-" ? "" : ` ${check.unit}`;
            return range
              ? `${fmt(check.provided)}${u} · izin: ${(check as { min: number }).min}…${(check as { max: number }).max}`
              : `gereken ${fmt((check as { required: number }).required)}${u} · sağlanan ${fmt(check.provided)}${u}`;
          })()}
          {check.standard ? ` · ${check.standard}` : ""}
        </div>
      </div>
      <Badge variant={check.pass ? "default" : "destructive"} className="shrink-0">
        {check.pass ? "✓ UYGUN" : "✗ UYGUN DEĞİL"}
      </Badge>
    </div>
  );
}

// ---------------------------------------------------------------- CalcRow
function CalcRow({ row, ctx }: { row: AdapterRow; ctx: unknown }) {
  const value = row.read(ctx);
  return (
    <div className="grid gap-0.5 border-b border-dashed py-2 last:border-0">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm">{row.label}</span>
        <span className="shrink-0 font-mono text-sm font-semibold tabular-nums">
          = {fmt(value, row.digits ?? 2)}{row.unit ? ` ${row.unit}` : ""}
        </span>
      </div>
      {(row.formula || row.subst) && (
        <div className="font-mono text-xs text-muted-foreground">
          {row.formula}
          {row.subst ? <span className="text-foreground/70"> = {row.subst(ctx)}</span> : null}
        </div>
      )}
      <div className="flex gap-2 text-[10px] text-muted-foreground/70">
        {row.standard && <span>{row.standard}</span>}
        <span>{row.excelRef ? `Excel: ${row.excelRef}` : "yeniden yazım"}</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Steps
type Step =
  | { kind: "specs"; key: string; title: string }
  | { kind: "module"; key: string; title: string; moduleKey: ModuleKey; section: AdapterSection }
  | { kind: "summary"; key: string; title: string };

function buildSteps(): Step[] {
  const steps: Step[] = [{ kind: "specs", key: "specs", title: "01 · Teknik Özellikler" }];
  for (const adapter of MODULE_ADAPTERS) {
    for (const section of adapter.sections) {
      steps.push({
        kind: "module",
        key: `${adapter.key}-${section.rawId}`,
        title: `${section.id} ${section.title}`,
        moduleKey: adapter.key,
        section,
      });
    }
  }
  steps.push({ kind: "summary", key: "summary", title: "Özet · Kontrol Panosu" });
  return steps;
}

const STEPS = buildSteps();

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
  const [pending, startTransition] = useTransition();

  const calcInput: CalcInput = useMemo(
    () => ({
      specs,
      mainHoist: mods.main,
      auxHoist: mods.aux,
      hookBlock: mods.hookBlock,
      trolley: mods.trolley,
      bridge: mods.bridge,
      girder: mods.girder,
      buckling: { inputs: mods.buckling.inputs },
      endCarriage: mods.endCarriage,
    }),
    [specs, mods]
  );
  const result = useMemo(() => runCalc(calcInput), [calcInput]);
  const deps = useMemo(() => buildModuleDeps(calcInput, result), [calcInput, result]);

  const failCount = result.allChecks.filter((c) => !c.pass).length;
  const step = STEPS[stepIndex];

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
      else toast.success("Revizyon kaydedildi.");
    });
  }

  // ------------------------------------------------------------ renderers
  function renderSpecs() {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">01 · Teknik Özellikler</CardTitle>
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
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            <span className="mr-2 font-mono text-muted-foreground">{section.id}</span>
            {section.title}
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              ({adapter.title})
            </span>
          </CardTitle>
          {section.description && (
            <p className="text-sm text-muted-foreground">{section.description}</p>
          )}
        </CardHeader>
        <CardContent className="grid gap-5">
          {(section.inputDefs.length > 0 || (section.extraInputDefs?.length ?? 0) > 0) && (
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
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
            return (
              <div>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Katalog Seçimi
                  </h3>
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
                            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors",
                            isActive
                              ? "border-primary bg-primary/10 font-medium text-primary"
                              : "hover:bg-muted"
                          )}
                        >
                          <span
                            className={cn(
                              "size-1.5 rounded-full",
                              pass === true && "bg-green-500",
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
                        className="rounded-full border border-dashed px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted"
                        title="Bu ekipman için alternatif seçim ekle (en fazla 3)"
                      >
                        + Alternatif
                      </button>
                    )}
                    {!readOnly && st.options.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeAlt(key, section)}
                        className="rounded-full border px-2 py-1 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        title="Aktif alternatifi sil"
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
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Hesap
                </h3>
                <div>
                  {section.rows.map((r) => (
                    <CalcRow key={r.key} row={r} ctx={ctx} />
                  ))}
                </div>
              </div>
            </>
          )}
          {checks.length > 0 && (
            <div className="grid gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
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
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Özet · Kontrol Panosu</CardTitle>
          <p className="text-sm text-muted-foreground">
            Tüm bölümlerin kontrol durumu. Kırmızı satır = ilgili bölüme dönüp seçimi revize edin.
          </p>
        </CardHeader>
        <CardContent className="grid gap-4">
          {MODULE_ADAPTERS.map((adapter) => {
            const mr = moduleResult(adapter.key);
            if (!mr || mr.checks.length === 0) return null;
            return (
              <div key={adapter.key} className="grid gap-2">
                <h3 className="text-sm font-semibold">{adapter.title}</h3>
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
  return (
    <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
      {/* Bölüm navigasyonu */}
      <nav className="lg:sticky lg:top-20 lg:self-start">
        <ol className="grid gap-0.5 text-sm">
          {STEPS.map((s, i) => {
            const status =
              s.kind === "module" ? sectionStatus(s.moduleKey, s.section) : "none";
            const prev = STEPS[i - 1];
            const showGroupHeader =
              s.kind === "module" &&
              (!prev || prev.kind !== "module" || prev.moduleKey !== s.moduleKey);
            return (
              <li key={s.key}>
                {showGroupHeader && s.kind === "module" && (
                  <div className="mt-2 mb-1 px-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {ADAPTER_BY_KEY[s.moduleKey].title}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setStepIndex(i)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors",
                    i === stepIndex ? "bg-primary/10 font-medium text-primary" : "hover:bg-muted"
                  )}
                >
                  <span
                    className={cn(
                      "size-2 shrink-0 rounded-full",
                      status === "pass" && "bg-green-500",
                      status === "fail" && "bg-destructive",
                      status === "none" && "bg-muted-foreground/30"
                    )}
                  />
                  <span className="truncate">{s.title}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      {/* İçerik */}
      <div className="grid gap-4">
        <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-2">
          <div className="text-sm">
            {failCount === 0 ? (
              <span className="font-medium text-green-700 dark:text-green-400">
                ✓ Tüm kontroller uygun ({result.allChecks.length})
              </span>
            ) : (
              <span className="font-medium text-destructive">
                ✗ {failCount} kontrol uygun değil ({result.allChecks.length} kontrol)
              </span>
            )}
            <span className="ml-3 font-mono text-xs text-muted-foreground">
              motor v{result.engineVersion}
            </span>
          </div>
          {!readOnly && (
            <Button onClick={handleSave} disabled={pending} size="sm">
              {pending ? "Kaydediliyor..." : "Kaydet"}
            </Button>
          )}
        </div>

        {step.kind === "specs" && renderSpecs()}
        {step.kind === "module" && renderModuleSection(step.moduleKey, step.section)}
        {step.kind === "summary" && renderSummary()}

        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            disabled={stepIndex === 0}
            onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
          >
            ← Geri
          </Button>
          <span className="text-xs text-muted-foreground">
            Adım {stepIndex + 1} / {STEPS.length}
          </span>
          <Button
            size="sm"
            disabled={stepIndex === STEPS.length - 1}
            onClick={() => setStepIndex((i) => Math.min(STEPS.length - 1, i + 1))}
          >
            İleri →
          </Button>
        </div>
      </div>
    </div>
  );
}
