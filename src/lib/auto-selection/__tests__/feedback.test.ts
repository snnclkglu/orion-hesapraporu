import { describe, expect, it, vi } from "vitest";
import { requestFixture } from "./fixtures";
import data from "../fixtures/crane-100t-50m.json";
import catalog from "../fixtures/catalog-100t-50m.json";
import { contentHash, selectionSourceHash, type EquipmentRow, type SelectionRequest } from "../types";
import { solveSelection } from "../orchestrator";
import { assessSelection, improves } from "../assessment";
import { selectionCalcInput } from "../solver";
import { readSelectionTrace } from "../trace";
import { gearboxSpeedMatches, standardMotor, failedChecks, SEARCH_TIME_BUDGET_MS } from "../search-policy";
import { reportTechnicalRows } from "../offer-bridge";
import { selectionAuditChecksComplete } from "../publication-check";
import { loadRevision, CALC_FIELD, type RevisionInputsJson, type RevisionSelectionsJson } from "@/lib/revision-load";
import { moduleState } from "@/lib/calc/presentation/module-access";
import { MODULE_ORDER } from "@/lib/calc/presentation/module-family";
import type { ModulesState } from "@/lib/calc/state";

export function largeRequest(): SelectionRequest {
  const base = requestFixture();
  return { ...base, ...structuredClone(data), modules: { ...base.modules, ...structuredClone(data.modules) } as ModulesState, sizeDesigns: true, enableStructuralChecks: true } as SelectionRequest;
}
describe("devir ve kalıcı durum sözleşmesi", () => {
  const gear: EquipmentRow = { id: "test", kind: "gearbox", brand: "TEST", model: "TEST", attrs: { input_speed_rpm: 1450 } };
  it("1450 katalog noktası ile 1420–1500 etiket devirlerini kabul eder; azami sınırı aşmaz", () => {
    for (const rpm of [1420, 1450, 1475, 1480, 1500, 1595]) expect(gearboxSpeedMatches(rpm, gear)).toBe(true);
    for (const rpm of [740, 975, 1600, NaN, Infinity, 0]) expect(gearboxSpeedMatches(rpm, gear)).toBe(false);
    expect(gearboxSpeedMatches(1480, { ...gear, attrs: { ...gear.attrs, max_input_speed_rpm: 1470 } })).toBe(false);
    expect(gear.attrs).toEqual({ input_speed_rpm: 1450 });
    expect(standardMotor({ ...gear, kind: "motor", attrs: { rpm: 1450 } })).toBe(true);
    expect(standardMotor({ ...gear, kind: "motor", attrs: { rpm: 975 } })).toBe(false);
  });
  it("eksik anahtar/undefined kayıt turunda aynı; geçersiz sayılar farklı kalır", () => {
    expect(contentHash({ electrical: { duty: undefined } })).toBe(contentHash({ electrical: {} }));
    expect(contentHash([undefined])).toBe(contentHash([null]));
    expect(contentHash({ x: NaN })).not.toBe(contentHash({ x: null }));
    expect(contentHash({ x: Infinity })).not.toBe(contentHash({}));
    expect(contentHash({ x: 1 })).not.toBe(contentHash({ x: 2 }));
  });
});

function withSearchClock(action: () => void) {
  // Sayısal regresyon, aynı bilgisayarda çalışan PDF testlerinin duvar saati
  // yüküne bağlı değildir. Değerlendirme/tur bütçeleri açıktır; süre sınırı ayrı sınanır.
  const clock = vi.spyOn(performance, "now").mockReturnValue(0);
  try { action(); } finally { clock.mockRestore(); }
}
it("100 t × 50 m: tahrikler, kiriş hedefleri, kütle geri beslemesi ve tekrar kaliteyi korur", () => withSearchClock(() => {
  const request = largeRequest(), before = contentHash(request);
  const proposal = solveSelection(request, catalog as EquipmentRow[]);
  const assessment = assessSelection(request, proposal);
  expect(contentHash(request)).toBe(before);
  expect(assessment.failures).toEqual([]);
  expect(assessment.targets).toEqual([]);
  expect(assessment.incompleteChains).toEqual([]);
  expect(failedChecks(assessment.result.allChecks)).toEqual([]);
  for (const key of ["main", "trolley", "bridge"]) {
    const motor = proposal.trace.decisions.find(d => d.module === key && d.row.kind === "motor");
    expect(motor).toBeDefined(); expect(standardMotor(motor!.row)).toBe(true);
    expect(proposal.trace.decisions.find(d => d.module === key && d.row.kind === "gearbox")).toBeDefined();
  }
  expect(proposal.trace.decisions.some(d => d.section === "5.6")).toBe(false);
  expect(proposal.trace.audit!.attempts.length).toBeLessThanOrEqual(4);
  expect(proposal.trace.evaluations).toBeLessThanOrEqual(60100);
  expect(proposal.trace.issues.some(issue => issue.code.startsWith("thermal."))).toBe(true);
  expect(proposal.trace.audit!.masses.some(band => band.unknown > 0)).toBe(true);
  expect(proposal.trace.status).toBe("incomplete"); // Eksik üretici verisini yeşile boyamaz.
  for (const key of Object.keys(request.specs) as (keyof SelectionRequest["specs"])[]) if (!/WeightT$/.test(key)) expect(proposal.specs[key]).toEqual(request.specs[key]);
  expect(proposal.trace.design).toEqual(request.design);
  const repeated = solveSelection({ ...request, specs: proposal.specs, modules: proposal.modules }, [...catalog].reverse() as EquipmentRow[]);
  const after = assessSelection(request, repeated);
  expect(after.failures).toEqual([]); expect(after.targets).toEqual([]);
  expect(failedChecks(after.result.allChecks)).toEqual([]);
  const input = selectionCalcInput({ ...request, specs: proposal.specs }, proposal.modules);
  expect(selectionAuditChecksComplete(proposal.trace, input)).toBe(true);
  expect(reportTechnicalRows(input, proposal.trace)["bridge.motor"].power).toBeTruthy();
  const saved = JSON.parse(JSON.stringify(proposal.trace));
  expect(readSelectionTrace(saved)?.audit).toEqual(saved.audit);
  const inputs: RevisionInputsJson = { specs: proposal.specs, disabledModules: MODULE_ORDER.filter(key => !proposal.active!.includes(key)), autoSelection: saved };
  const selections: RevisionSelectionsJson = {};
  for (const key of MODULE_ORDER) { Object.assign(inputs, { [CALC_FIELD[key]]: proposal.modules[key].inputs }); Object.assign(selections, { [CALC_FIELD[key]]: proposal.modules[key].selections }); }
  const loaded = loadRevision(JSON.parse(JSON.stringify(inputs)), JSON.parse(JSON.stringify(selections)));
  const modules = Object.fromEntries(MODULE_ORDER.map(key => [key, moduleState(loaded.full, key)])) as ModulesState;
  expect(selectionSourceHash(loaded.input.specs, modules, proposal.active!)).toBe(proposal.trace.resultHash);
  // Önce geçen sehim hedefinin kaybı diğer hata sayısı düşse bile reddedilir.
  const bad = structuredClone(proposal);
  Object.assign(bad.modules.girder.inputs, { h3Mm: 1000 });
  expect(improves(assessSelection(request, bad), assessment)).toBe(false);
  expect(selectionAuditChecksComplete(bad.trace, selectionCalcInput({ ...request, specs: bad.specs }, bad.modules))).toBe(false);
  const light = { ...input, specs: { ...input.specs, bridgeWeightT: 10 } };
  expect(selectionAuditChecksComplete(proposal.trace, light)).toBe(false);
}), 120000);

it("süre bütçesi dolunca kısmi sonuçla başarılı tamamlanma uydurmaz", () => {
  const request = largeRequest(), before = contentHash(request);
  const clock = vi.spyOn(performance, "now").mockReturnValueOnce(0).mockReturnValueOnce(0).mockReturnValue(SEARCH_TIME_BUDGET_MS + 1);
  try {
    const result = solveSelection(request, catalog as EquipmentRow[]);
    expect(result.trace.audit?.stop).toBe("budget");
    expect(result.trace.status).toBe("incomplete");
    expect(result.trace.issues.some(issue => issue.code === "audit.stop")).toBe(true);
    expect(contentHash(request)).toBe(before);
  } finally { clock.mockRestore(); }
});

it("boş tahrik kataloğunda fren/kaplin kesinleşmez, teklife şablon tahrik aktarılmaz", () => {
  const request = largeRequest(); request.active = ["trolley"]; request.sizeDesigns = false;
  const proposal = solveSelection(request, (catalog as EquipmentRow[]).filter(row => row.kind !== "motor" && row.kind !== "gearbox"));
  expect(proposal.trace.decisions.some(d => ["5.5b", "5.6", "5.7"].includes(d.section))).toBe(false);
  expect(proposal.trace.diagnostics?.[0]).toMatchObject({ motors: 0, gearboxes: 0 });
  expect(proposal.trace.issues.some(issue => issue.code === "audit.chain.trolley")).toBe(true);
  const rows = reportTechnicalRows(selectionCalcInput(request, proposal.modules), proposal.trace);
  expect(rows["trolley.motor"]).toBeUndefined(); expect(rows["trolley.brake"]).toBeUndefined();
});

it("kütle ve kesit kilidi çelişkisinde kullanıcı kararı korunur ve gerekçe açık kalır", () => {
  const request = largeRequest(); request.active = ["main", "trolley", "bridge", "girder"]; request.locks = ["main", "trolley", "bridge", "girder", "specs.bridgeWeightT"];
  const proposal = solveSelection(request, []);
  expect(proposal.specs.bridgeWeightT).toBe(request.specs.bridgeWeightT);
  expect(proposal.modules.girder).toEqual(request.modules.girder);
  expect(proposal.trace.issues.some(issue => issue.code === "mass.conflict.bridge" && issue.category === "constraint")).toBe(true);
  expect(proposal.trace.status).toBe("incomplete");
});
