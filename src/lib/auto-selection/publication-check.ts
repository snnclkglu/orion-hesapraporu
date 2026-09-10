import type { CalcInput } from "@/lib/calc/engine";
import { MODULE_ORDER } from "@/lib/calc/presentation/module-family";
import { moduleState } from "@/lib/calc/presentation/module-access";
import type { ModulesState } from "@/lib/calc/state";
import type { AgirlikDokumuDurumu } from "@/lib/weights/types";
import type { SelectionTrace } from "./types";
import { assessSelection } from "./assessment";

/** Kayıtlı 'başarılı' damgasına güvenmez: yayımlanan GÜNCEL tasarımı denetler.
 * Elle düzeltme mümkündür; eski turdaki sayısal hata sonsuza dek saklanmaz. */
export function selectionAuditChecksComplete(trace: SelectionTrace, input: CalcInput, weightBreakdown?: AgirlikDokumuDurumu): boolean {
  if (trace.version !== "1.3.0") return true;
  if (!trace.audit) return false;
  const active = MODULE_ORDER.filter(key => !!moduleState(input, key));
  const modules = Object.fromEntries(MODULE_ORDER.map(key => [key, moduleState(input, key) ?? trace.audit!.source.modules[key]])) as ModulesState;
  const request = { ...trace.audit.source, specs: input.specs, modules, active, brands: trace.brands, series: trace.series, locks: trace.locks, sizeDesigns: false, weightBreakdown };
  const assessment = assessSelection(request, { specs: input.specs, modules, active, trace: { ...trace, decisions: trace.decisions.map(d => ({ ...d })) } });
  return assessment.failures.length === 0 && assessment.targets.length === 0;
}
