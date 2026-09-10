import { z } from "zod";
import { designInputsSchema } from "./design-inputs";
import { ENGINE_VERSION, runCalc, type CalcInput, type CalcResult } from "@/lib/calc/engine";
import { checkSeverity, type AnyCheck } from "@/lib/calc/types";
import { MODULE_ORDER } from "@/lib/calc/presentation/module-family";
import { CALC_FIELD, calcInputFromRevision, type RevisionInputsJson, type RevisionSelectionsJson } from "@/lib/revision-load";
import { contentHash, type SelectionIssue, type SelectionTrace } from "./types";
import { moduleResult, moduleState } from "@/lib/calc/presentation/module-access";
import { isHoistKey, type ModuleKey } from "@/lib/calc/presentation/module-family";

const boundedText = z.string().max(4000);
const evidenceSchema = z.object({ id: z.string().max(150), label: boundedText,
  computed: z.number().finite().nullable(), limit: z.number().finite().nullable().optional(),
  min: z.number().finite().nullable().optional(), max: z.number().finite().nullable().optional(),
  operator: z.enum(["≤", "≥", "…", "="]), unit: z.string().max(100), pass: z.boolean(), standard: boundedText.optional(),
});
const schema = z.object({
  version: z.enum(["1.0.0", "1.1.0", "1.2.0", "1.3.0"]), engineVersion: z.string().max(60), createdAt: z.iso.datetime(),
  sourceHash: z.string().max(100), resultHash: z.string().max(100), catalogHash: z.string().max(100),
  brands: z.partialRecord(z.enum(["motor", "hoistGearbox", "travelGearbox", "brake", "hoistBrake", "travelBrake", "motorCoupling", "wheelCoupling", "drumCoupling", "bearing", "rope", "buffer"]), z.string().max(200)),
  locks: z.array(z.string().max(150)).max(300),
  series: z.partialRecord(z.enum(["motor", "hoistGearbox", "travelGearbox", "brake", "hoistBrake", "travelBrake", "motorCoupling", "wheelCoupling", "drumCoupling", "bearing", "rope", "buffer"]), z.string().max(200)).optional(),
  design: designInputsSchema.optional(),
  decisions: z.array(z.object({ module: z.enum(MODULE_ORDER), section: z.string().max(100), label: boundedText,
    variantKey: boundedText, checked: z.array(z.string().max(150)).max(200), provisional: z.boolean().optional(),
    evidence: z.array(evidenceSchema).max(200).optional(),
    row: z.object({ id: z.string().max(200), kind: z.string().max(100), brand: z.string().max(200), model: boundedText,
      attrs: z.record(z.string().max(200), z.unknown()), datasheet_url: z.string().max(4000).nullable().optional() }),
  })).max(200),
  issues: z.array(z.object({ code: z.string().max(200), module: z.enum(MODULE_ORDER).optional(), message: boundedText,
    state: z.enum(["failed", "missing", "review", "unsupported"]), category: z.enum(["repairable", "data", "constraint", "human"]).optional(), evidence: evidenceSchema.optional() })).max(1000),
  evaluations: z.number().int().nonnegative().max(100000), status: z.enum(["readyForReview", "incomplete"]), search: z.literal("bounded"),
  designProfile: z.string().max(150).optional(), weightSourceHash: z.string().max(100).optional(),
  diagnostics: z.array(z.object({ module: z.enum(MODULE_ORDER), section: z.string().max(100), motors: z.number().int().nonnegative(), gearboxes: z.number().int().nonnegative(), rejected: z.record(z.string().max(100), z.number().int().nonnegative()), accepted: z.number().int().nonnegative() })).max(100).optional(),
  audit: z.object({ policy: z.string().max(150),
    source: z.object({ specs: z.record(z.string().max(150), z.unknown()), modules: z.record(z.enum(MODULE_ORDER), z.object({ inputs: z.record(z.string().max(150), z.unknown()), selections: z.record(z.string().max(150), z.unknown()) })), active: z.array(z.enum(MODULE_ORDER)).max(30), sizeDesigns: z.boolean(), speedTolerancePct: z.number().finite().min(0).max(10), craneType: boundedText.optional(), weightBreakdown: z.unknown().optional(), enableStructuralChecks: z.boolean().optional() }),
    attempts: z.array(z.object({ iteration: z.number().int().min(1).max(4), reason: boundedText, resultHash: z.string().max(100), accepted: z.boolean(), explanation: boundedText, failures: z.number().int().nonnegative(), targets: z.number().int().nonnegative(), incompleteChains: z.number().int().nonnegative(), evaluations: z.number().int().nonnegative() })).max(4),
    stop: z.enum(["complete", "noRepair", "cycle", "noImprovement", "budget", "limit"]), elapsedMs: z.number().finite().nonnegative(), resolved: z.number().int().nonnegative(), remaining: z.number().int().nonnegative(),
    masses: z.array(z.object({ key: z.string().max(150), inputKg: z.number().finite().nullable(), modelKg: z.number().finite().nullable(), unknown: z.number().int().nonnegative(), estimated: z.boolean(), sources: z.record(z.string().max(50), z.number().finite()) })).max(30),
  }).optional(),
  review: z.object({ inputHash: z.string().max(100), notes: z.record(z.string().max(200), boundedText),
    evidence: z.record(z.string().max(200), z.object({ source: boundedText, reference: boundedText,
      method: z.enum(["manufacturer", "calculation", "measurement"]), value: z.number().finite().optional(), unit: z.string().max(60).optional(),
    })).optional(), reviewedAt: z.iso.datetime(), reviewedBy: z.string().max(100).optional() }).optional(),
});

/** İçe aktarım/kayıt sınırı: biçimi bozuk iz UI veya yayımlama koşullarına girmez. */
export function readSelectionTrace(value: unknown): SelectionTrace | undefined {
  try {
    if (JSON.stringify(value).length > 2_000_000) return undefined;
    const parsed = schema.safeParse(value);
    return parsed.success ? parsed.data as SelectionTrace : undefined;
  } catch { return undefined; }
}

/** Kayıttan geri yüklemede eklenen varsayılan alanlar aynı biçime getirilir. */
export function selectionReviewHash(input: CalcInput): string {
  const inputs: RevisionInputsJson = { specs: input.specs, disabledModules: [] };
  const selections: RevisionSelectionsJson = {};
  for (const key of MODULE_ORDER) {
    const field = CALC_FIELD[key];
    const state = input[field as keyof CalcInput] as { inputs: object; selections: object } | undefined;
    if (state) { Object.assign(inputs, { [field]: state.inputs }); Object.assign(selections, { [field]: state.selections }); }
    else inputs.disabledModules!.push(key);
  }
  return contentHash({ engineVersion: ENGINE_VERSION, input: calcInputFromRevision(inputs, selections) });
}

/** Sayısal hatalar hesapta düzeltilir. Katalog/kapsam eksiği ise kaynaklı mühendis notu gerektirir. */
export function externalReviewIssues(trace: SelectionTrace) {
  return trace.issues.filter(issue => issue.state === "missing" || issue.state === "unsupported");
}
export function externalReviewRequirement(issue: SelectionIssue, input: CalcInput): { required: number; unit: string } | undefined {
  const key = (issue.module ?? issue.code.split(".")[1]) as ModuleKey;
  if (!MODULE_ORDER.includes(key)) return undefined;
  if (issue.code.startsWith("thermal.")) {
    const cells = moduleResult(runCalc(input), key)?.cells;
    const required = Number(cells?.[isHoistKey(key) ? "motor.requiredPower" : "motor.powerPerMotor"]);
    return Number.isFinite(required) && required > 0 ? { required, unit: "kW" } : undefined;
  }
  if (issue.code.startsWith("speed.")) {
    const selections = moduleState(input, key)?.selections as Record<string, unknown> | undefined;
    const motorSide = ["2.6", "5.6"].includes(issue.code.split(".").slice(2).join("."));
    const required = Number(selections?.motorRpm) / (motorSide ? 1 : Number(selections?.gearboxRatio));
    return Number.isFinite(required) && required > 0 ? { required, unit: "rpm" } : undefined;
  }
  return undefined;
}
export function selectionReviewComplete(trace: SelectionTrace, input: CalcInput): boolean {
  const issues = externalReviewIssues(trace);
  if (!issues.length) return true;
  if (trace.review?.inputHash !== selectionReviewHash(input)) return false;
  return issues.every(issue => {
    if ((trace.review?.notes[issue.code]?.trim().length ?? 0) < 12) return false;
    if (trace.version === "1.0.0") return true; // Önceki yayımlanmış belge sözleşmesi korunur.
    const evidence = trace.review?.evidence?.[issue.code];
    if (!evidence || evidence.source.trim().length < 4 || evidence.reference.trim().length < 2) return false;
    if (/^(?:thermal|speed)\./.test(issue.code)) {
      const metric = externalReviewRequirement(issue, input);
      return !!metric && evidence.unit === metric.unit && typeof evidence.value === "number" && Number.isFinite(evidence.value) && evidence.value >= metric.required;
    }
    return true;
  });
}

export function selectionNumericallyComplete(result: CalcResult): boolean {
  return selectionChecksComplete(result.allChecks);
}
export function selectionChecksComplete(checks: AnyCheck[]): boolean {
  return checks.length > 0 && checks.filter(check => checkSeverity(check) === "engelleyici").every(check => check.pass && Number.isFinite(check.provided) && (check.op === "range" ? Number.isFinite(check.min) && Number.isFinite(check.max) : Number.isFinite(check.required)));
}

/** Tarihsel aktarım notudur; taşınması canlı teklif bağlantısı oluşturmaz. */
export function readOfferTechnicalSource(value: unknown): RevisionInputsJson["offerTechnicalSource"] {
  const parsed = z.object({ offerRevisionId: z.string().max(100), itemId: z.string().max(200), warnings: z.array(boundedText).max(200), fingerprint: z.string().max(100).optional(), craneType: z.string().max(300).optional(), values: z.record(z.string().max(100), z.union([boundedText, z.number().finite(), z.null()])).refine(values => Object.keys(values).length <= 200).optional() }).safeParse(value);
  return parsed.success ? parsed.data : undefined;
}
