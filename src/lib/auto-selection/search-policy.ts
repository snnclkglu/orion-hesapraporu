import { checkDisplay, type AnyCheck } from "@/lib/calc/types";
import type { EquipmentRow, SelectionEvidence } from "./types";
import { positive } from "./catalog";

/** Firma kararı, 10.09.2026. Etiket devri korunur, katalog kapasitesi ölçeklenmez. */
export const SEARCH_POLICY = "orion-1500-rpm-10pct-denetim-v1";
export const STANDARD_MOTOR_RPM = 1500;
export const MOTOR_RPM_TOLERANCE = 0.1;
/** Büyük rapor ve yavaş cihaz için üst sınır; worker kullanıcı tarafından iptal edilebilir. */
export const SEARCH_TIME_BUDGET_MS = 120_000;
export function standardMotor(row: EquipmentRow): boolean {
  const rpm = positive(row.attrs.rpm);
  return !!rpm && Math.abs(rpm / STANDARD_MOTOR_RPM - 1) <= MOTOR_RPM_TOLERANCE + 1e-9;
}
export function gearboxSpeedMatches(motorRpm: number, row: EquipmentRow): boolean {
  const reference = positive(row.attrs.input_speed_rpm);
  const maximum = positive(row.attrs.max_input_speed_rpm);
  return !!reference && Number.isFinite(motorRpm) && motorRpm > 0 && (!maximum || motorRpm <= maximum)
    && Math.abs(motorRpm / reference - 1) <= MOTOR_RPM_TOLERANCE + 1e-9;
}
export const humanCheck = (id: string) => /(?:^|\.)measurements\.confirmed$/.test(id);
export const finiteCheck = (check: AnyCheck) => Number.isFinite(check.provided) && (check.op === "range" ? Number.isFinite(check.min) && Number.isFinite(check.max) : Number.isFinite(check.required));
export const checkPass = (check: AnyCheck) => finiteCheck(check) && check.pass;
export function checkEvidence(check: AnyCheck): SelectionEvidence {
  const display = checkDisplay(check);
  const finite = (value: number | undefined) => value === undefined ? undefined : Number.isFinite(value) ? value : null;
  return { id: check.id, label: check.label, computed: finite(display.computed) ?? null, limit: finite(display.limit), min: finite(display.min), max: finite(display.max), operator: display.operator, unit: display.unit, pass: checkPass(check), standard: check.standard };
}
export const failedChecks = (checks: AnyCheck[]) => checks.filter(check => !humanCheck(check.id) && !checkPass(check));

export interface SearchBudget { evaluations: number; maxEvaluations: number; deadline: number }
export const budgetExpired = (budget: SearchBudget) => budget.evaluations >= budget.maxEvaluations || performance.now() >= budget.deadline;
