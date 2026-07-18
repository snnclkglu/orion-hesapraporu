"use client";

// Revizyon editörü — bölüm bölüm ilerleyen sihirbaz yapısı.
// Her bölümde: o bölümün girdileri/katalog seçimleri, hemen altında bölümün
// HESABI (sembolik formül → sayılar yerine konmuş hali → sonuç) ve ✓/✗
// kontrolleri. Excel'in bölüm numaraları (2.1 ... 2.7) korunur.

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { runCalc, type CalcInput } from "@/lib/calc/engine";
import { computeHoistGroup } from "@/lib/calc/modules/hoistGroup";
import {
  HOIST_INPUT_FIELDS,
  HOIST_SELECTION_FIELDS,
  SPEC_FIELDS,
  type FieldDef,
} from "@/lib/calc/fields";
import {
  HOIST_SECTIONS,
  type HoistCtx,
  type HoistSectionDef,
} from "@/lib/calc/presentation/hoistSections";
import type { AnyCheck } from "@/lib/calc/types";
import type { HoistInputs, HoistSelections } from "@/lib/calc/modules/hoistGroup";
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
 * Alternatif ekipman seçimi: her seçim bölümü için 3'e kadar alternatif
 * saklanır; aktif olan canlı hesapta kullanılır, diğerlerinin uygunluğu
 * rozetle gösterilir.
 */
export interface AltState {
  active: number;
  options: Record<string, unknown>[];
}
export type AltsMap = Record<string, AltState>; // key: `${which}-${sectionId}`

/** Bölüm numarası: ana kaldırma 2.x, yardımcı kaldırma 3.x */
function displayId(which: "main" | "aux", id: string): string {
  return which === "aux" ? id.replace(/^2/, "3") : id;
}

function fmt(v: number | string | null | undefined, digits = 2): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string") return v;
  if (Number.isInteger(v)) return v.toLocaleString("tr-TR");
  return v.toLocaleString("tr-TR", { maximumFractionDigits: digits });
}

// ---------------------------------------------------------------- Fields
const INPUT_FIELD_MAP = new Map(HOIST_INPUT_FIELDS.map((f) => [f.key, f]));
const SELECTION_FIELD_MAP = new Map(HOIST_SELECTION_FIELDS.map((f) => [f.key, f]));

function Field<T extends object>({
  def, value, onChange, disabled,
}: {
  def: FieldDef<T>;
  value: T;
  onChange: (next: T) => void;
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
function CalcRow({
  ctx, cell, label, formula, subst, unit, digits, standard,
}: {
  ctx: HoistCtx;
  cell: string;
  label: string;
  formula?: string;
  subst?: (ctx: HoistCtx) => string;
  unit?: string;
  digits?: number;
  standard?: string;
}) {
  const value = ctx.c[cell];
  return (
    <div className="grid gap-0.5 border-b border-dashed py-2 last:border-0">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm">{label}</span>
        <span className="shrink-0 font-mono text-sm font-semibold tabular-nums">
          = {fmt(value, digits ?? 2)}{unit ? ` ${unit}` : ""}
        </span>
      </div>
      {(formula || subst) && (
        <div className="font-mono text-xs text-muted-foreground">
          {formula}
          {subst ? <span className="text-foreground/70"> = {subst(ctx)}</span> : null}
        </div>
      )}
      <div className="flex gap-2 text-[10px] text-muted-foreground/70">
        {standard && <span>{standard}</span>}
        <span>Excel: {cell}</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Steps
type Step =
  | { kind: "specs"; key: string; title: string }
  | { kind: "hoist"; key: string; title: string; which: "main" | "aux"; section: HoistSectionDef }
  | { kind: "summary"; key: string; title: string };

const HOIST_TITLES = { main: "02 · Ana Kaldırma", aux: "03 · Yrd Kaldırma" } as const;

function buildSteps(): Step[] {
  const steps: Step[] = [{ kind: "specs", key: "specs", title: "01 · Teknik Özellikler" }];
  for (const which of ["main", "aux"] as const) {
    for (const section of HOIST_SECTIONS) {
      steps.push({
        kind: "hoist",
        key: `${which}-${section.id}`,
        title: `${section.id} ${section.title}`,
        which,
        section,
      });
    }
  }
  steps.push({ kind: "summary", key: "summary", title: "Özet · Kontrol Panosu" });
  return steps;
}

const STEPS = buildSteps();

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
  const [mainInputs, setMainInputs] = useState(initial.mainHoist!.inputs);
  const [mainSel, setMainSel] = useState(initial.mainHoist!.selections);
  const [auxInputs, setAuxInputs] = useState(initial.auxHoist!.inputs);
  const [auxSel, setAuxSel] = useState(initial.auxHoist!.selections);
  const [alts, setAlts] = useState<AltsMap>(initialAlts ?? {});
  const [stepIndex, setStepIndex] = useState(0);
  const [pending, startTransition] = useTransition();

  const calcInput: CalcInput = useMemo(
    () => ({
      specs,
      mainHoist: { inputs: mainInputs, selections: mainSel },
      auxHoist: { inputs: auxInputs, selections: auxSel },
    }),
    [specs, mainInputs, mainSel, auxInputs, auxSel]
  );
  const result = useMemo(() => runCalc(calcInput), [calcInput]);

  const failCount = result.allChecks.filter((c) => !c.pass).length;
  const step = STEPS[stepIndex];

  function sectionChecks(which: "main" | "aux", section: HoistSectionDef): AnyCheck[] {
    const moduleResult = which === "main" ? result.mainHoist! : result.auxHoist!;
    return section.checkSuffixes
      .map((s) => moduleResult.checks.find((c) => c.id === `${which}.${s}`))
      .filter((c): c is AnyCheck => Boolean(c));
  }

  function sectionStatus(which: "main" | "aux", section: HoistSectionDef): "pass" | "fail" | "none" {
    const checks = sectionChecks(which, section);
    if (checks.length === 0) return "none";
    return checks.every((c) => c.pass) ? "pass" : "fail";
  }

  // ---------------------------------------------------------- alternatifler
  function pickSelection(
    sel: HoistSelections,
    keys: readonly string[]
  ): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    const rec = sel as unknown as Record<string, unknown>;
    for (const k of keys) out[k] = rec[k];
    return out;
  }

  /** Kaydetmeden önce aktif alternatifi canlı seçim değerleriyle eşitler */
  function syncedAlts(): AltsMap {
    const next: AltsMap = { ...alts };
    for (const [key, st] of Object.entries(next)) {
      const [which, sectionId] = [key.slice(0, key.indexOf("-")), key.slice(key.indexOf("-") + 1)];
      const section = HOIST_SECTIONS.find((s) => s.id === sectionId);
      if (!section) continue;
      const sel = which === "main" ? mainSel : auxSel;
      const options = [...st.options];
      options[st.active] = pickSelection(sel, section.selectionKeys);
      next[key] = { ...st, options };
    }
    return next;
  }

  function altStateFor(which: "main" | "aux", section: HoistSectionDef): AltState {
    const key = `${which}-${section.id}`;
    const sel = which === "main" ? mainSel : auxSel;
    return alts[key] ?? { active: 0, options: [pickSelection(sel, section.selectionKeys)] };
  }

  function altSectionPass(
    which: "main" | "aux",
    section: HoistSectionDef,
    option: Record<string, unknown>
  ): boolean | null {
    const inputs = which === "main" ? mainInputs : auxInputs;
    const sel = which === "main" ? mainSel : auxSel;
    try {
      const r = computeHoistGroup(specs, which, inputs, { ...sel, ...option } as HoistSelections);
      const checks = section.checkSuffixes
        .map((s) => r.checks.find((c) => c.id === `${which}.${s}`))
        .filter((c): c is AnyCheck => Boolean(c));
      if (checks.length === 0) return null;
      return checks.every((c) => c.pass);
    } catch {
      return null;
    }
  }

  function switchAlt(which: "main" | "aux", section: HoistSectionDef, index: number) {
    const key = `${which}-${section.id}`;
    const sel = which === "main" ? mainSel : auxSel;
    const setSel = which === "main" ? setMainSel : setAuxSel;
    const st = altStateFor(which, section);
    if (index === st.active) return;
    const options = [...st.options];
    options[st.active] = pickSelection(sel, section.selectionKeys);
    setSel({ ...sel, ...options[index] } as HoistSelections);
    setAlts({ ...alts, [key]: { active: index, options } });
  }

  function addAlt(which: "main" | "aux", section: HoistSectionDef) {
    const key = `${which}-${section.id}`;
    const sel = which === "main" ? mainSel : auxSel;
    const st = altStateFor(which, section);
    if (st.options.length >= 3) return;
    const current = pickSelection(sel, section.selectionKeys);
    const options = [...st.options];
    options[st.active] = current;
    options.push({ ...current });
    setAlts({ ...alts, [key]: { active: options.length - 1, options } });
  }

  function removeAlt(which: "main" | "aux", section: HoistSectionDef) {
    const key = `${which}-${section.id}`;
    const sel = which === "main" ? mainSel : auxSel;
    const setSel = which === "main" ? setMainSel : setAuxSel;
    const st = altStateFor(which, section);
    if (st.options.length <= 1) return;
    const options = st.options.filter((_, i) => i !== st.active);
    setSel({ ...sel, ...options[0] } as HoistSelections);
    setAlts({ ...alts, [key]: { active: 0, options } });
  }

  function handleSave() {
    startTransition(async () => {
      const res = await saveRevision(projectId, revisionId, calcInput, syncedAlts());
      if (res.error) toast.error(res.error);
      else toast.success("Revizyon kaydedildi.");
    });
  }

  function hoistCtx(which: "main" | "aux"): HoistCtx {
    return {
      c: (which === "main" ? result.mainHoist! : result.auxHoist!).cells,
      inp: which === "main" ? mainInputs : auxInputs,
      sel: which === "main" ? mainSel : auxSel,
      specs,
      which,
    };
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
              <Field key={f.key} def={f} value={specs} onChange={setSpecs} disabled={readOnly} />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  function renderHoistSection(which: "main" | "aux", section: HoistSectionDef) {
    const ctx = hoistCtx(which);
    const inputs = which === "main" ? mainInputs : auxInputs;
    const setInputs = which === "main" ? setMainInputs : setAuxInputs;
    const sel = which === "main" ? mainSel : auxSel;
    const setSel = which === "main" ? setMainSel : setAuxSel;
    const checks = sectionChecks(which, section);
    const inputDefs = section.inputKeys
      .map((k) => INPUT_FIELD_MAP.get(k))
      .filter((f): f is FieldDef<HoistInputs> => Boolean(f));
    const selDefs = section.selectionKeys
      .map((k) => SELECTION_FIELD_MAP.get(k))
      .filter((f): f is FieldDef<HoistSelections> => Boolean(f));

    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            <span className="mr-2 font-mono text-muted-foreground">{displayId(which, section.id)}</span>
            {section.title}
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              ({HOIST_TITLES[which]})
            </span>
          </CardTitle>
          {section.description && (
            <p className="text-sm text-muted-foreground">{section.description}</p>
          )}
        </CardHeader>
        <CardContent className="grid gap-5">
          {inputDefs.length > 0 && (
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Girdiler / Tasarım Kabulleri
              </h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {inputDefs.map((f) => (
                  <Field key={f.key} def={f} value={inputs} onChange={setInputs} disabled={readOnly} />
                ))}
              </div>
            </div>
          )}
          {selDefs.length > 0 && (() => {
            const st = altStateFor(which, section);
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
                        ? (sectionChecks(which, section).length > 0
                            ? sectionChecks(which, section).every((c) => c.pass)
                            : null)
                        : altSectionPass(which, section, opt);
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => switchAlt(which, section, i)}
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
                        onClick={() => addAlt(which, section)}
                        className="rounded-full border border-dashed px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted"
                        title="Bu ekipman için alternatif seçim ekle (en fazla 3)"
                      >
                        + Alternatif
                      </button>
                    )}
                    {!readOnly && st.options.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeAlt(which, section)}
                        className="rounded-full border px-2 py-1 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        title="Aktif alternatifi sil"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {selDefs.map((f) => (
                    <Field key={f.key} def={f} value={sel} onChange={setSel} disabled={readOnly} />
                  ))}
                </div>
              </div>
            );
          })()}
          <Separator />
          <div>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Hesap
            </h3>
            <div>
              {section.rows.map((r) => (
                <CalcRow key={r.cell} ctx={ctx} {...r} />
              ))}
            </div>
          </div>
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
          {(["main", "aux"] as const).map((which) => (
            <div key={which} className="grid gap-2">
              <h3 className="text-sm font-semibold">{HOIST_TITLES[which]}</h3>
              {(which === "main" ? result.mainHoist! : result.auxHoist!).checks.map((c) => (
                <CheckRow key={c.id} check={c} />
              ))}
            </div>
          ))}
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
              s.kind === "hoist" ? sectionStatus(s.which, s.section) : "none";
            const showGroupHeader =
              s.kind === "hoist" &&
              (i === 0 || STEPS[i - 1].kind !== "hoist" ||
                (STEPS[i - 1] as Extract<Step, { kind: "hoist" }>).which !== s.which);
            return (
              <li key={s.key}>
                {showGroupHeader && (
                  <div className="mt-2 mb-1 px-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {HOIST_TITLES[(s as Extract<Step, { kind: "hoist" }>).which]}
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
                  <span className="truncate">
                    {s.kind === "hoist"
                      ? `${displayId(s.which, s.section.id)} ${s.section.title}`
                      : s.title}
                  </span>
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
        {step.kind === "hoist" && renderHoistSection(step.which, step.section)}
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
