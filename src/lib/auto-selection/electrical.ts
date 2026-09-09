import { runCalc } from "@/lib/calc/engine";
import { checkSeverity } from "@/lib/calc/types";
import type { ElectricalInputs, ElectricalSelections } from "@/lib/calc/modules/electrical";
import { selectionCalcInput } from "./solver";
import { variantKey } from "./catalog";
import type { EquipmentRow, SelectionProposal, SelectionRequest } from "./types";

/** Ortak elektrik modülünün önerilerini kullanıcı düğmesine bağlı sabit seçime çevirir. */
export function completeElectricalSelection(request: SelectionRequest, proposal: SelectionProposal): void {
  if (!request.active.includes("electrical") || request.locks.some(lock => lock === "electrical" || lock.startsWith("electrical."))) return;
  const state = proposal.modules.electrical;
  const oldInput = state.inputs as ElectricalInputs;
  const oldSelections = state.selections as ElectricalSelections;
  const automatic: ElectricalInputs = { ...oldInput, mainCableAuto: true, trolleyPresetAuto: true,
    circuits: Object.fromEntries(request.active.map(key => [key, { ...oldInput.circuits[key as keyof typeof oldInput.circuits], driveAuto: true, cableAuto: true }])) };
  const modules = { ...proposal.modules, electrical: { inputs: automatic, selections: { ...oldSelections, drives: {}, motorCables: {}, mainCable: {} } } };
  const preview = runCalc(selectionCalcInput({ ...request, specs: proposal.specs }, modules)).electrical;
  if (!preview) return;
  const { drives, motorCables, mainCable, festoon } = preview.values;
  const selections: ElectricalSelections = { ...oldSelections, drives: {}, motorCables: {}, mainCable: {} };
  const inputs: ElectricalInputs = { ...automatic, circuits: { ...automatic.circuits }, mainCableAuto: false, trolleyPresetAuto: false, trolleyPresetId: festoon.trolleyPresetId };
  const decisions = proposal.trace.decisions;
  const add = (section: string, label: string, row: EquipmentRow) => decisions.push({ module: "electrical", section, label, row, variantKey: variantKey(row), checked: preview.checks.filter(check => check.id.startsWith(`electrical.${section}.`)).map(check => check.id) });
  for (const value of drives) {
    const key = value.circuit.key, drive = value.drive;
    if (!drive) continue;
    selections.drives[key] = { brand: drive.brand, series: drive.series, model: drive.model };
    inputs.circuits[key] = { ...inputs.circuits[key], driveAuto: false };
    add(`drive.${key}`, `${value.circuit.label} sürücü`, { id: `electrical:${drive.brand}:${drive.model}`, kind: "electrical_drive", brand: drive.brand, model: drive.model, attrs: { ...drive } });
  }
  for (const value of motorCables) {
    const key = value.circuit.key, cable = value.selectedCable;
    if (!cable) continue;
    selections.motorCables[key] = { articleNo: cable.articleNo, parallelRuns: value.selectedRuns };
    inputs.circuits[key] = { ...inputs.circuits[key], cableAuto: false };
    add(`cable.${key}`, `${value.circuit.label} kablo`, { id: `cable:${cable.articleNo}`, kind: "electrical_cable", brand: cable.brand, model: cable.articleNo, attrs: { ...cable } });
  }
  if (mainCable.selectedCable) {
    const cable = mainCable.selectedCable;
    selections.mainCable = { articleNo: cable.articleNo, parallelRuns: mainCable.selectedRuns };
    add("mainCable", "Ana besleme kablosu", { id: `cable:${cable.articleNo}`, kind: "electrical_cable", brand: cable.brand, model: cable.articleNo, attrs: { ...cable } });
  }
  proposal.modules = { ...modules, electrical: { inputs, selections } };
  const final = runCalc(selectionCalcInput({ ...request, specs: proposal.specs }, proposal.modules));
  proposal.trace.evaluations += 2;
  proposal.trace.issues = proposal.trace.issues.filter(issue => !issue.code.startsWith("electrical."));
  for (const check of final.electrical?.checks ?? []) if (!check.pass) proposal.trace.issues.push({ code: check.id, module: "electrical", state: checkSeverity(check) === "engelleyici" ? "failed" : "review", message: check.label });
  proposal.trace.issues.push({ code: "electrical.installation", module: "electrical", state: "missing", message: "Sürücü ve kablo ön seçimi tamamlandı; döşeme, kısa devre, koruma koordinasyonu, fren direnci ve EMC elektrik projesinde doğrulanmalı." });
}
