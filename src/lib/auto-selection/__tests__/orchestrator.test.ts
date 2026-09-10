import { expect, it } from "vitest";
import { checkDisplay, type AnyCheck } from "@/lib/calc/types";
import { runCalc, type CalcResult } from "@/lib/calc/engine";
import { getCatalogMapping } from "@/lib/catalog-mapping";
import { solveSelection } from "../orchestrator";
import { selectionCalcInput } from "../solver";
import { readSelectionTrace, selectionNumericallyComplete } from "../trace";
import { contentHash, type EquipmentRow } from "../types";
import { selectionScopeIssues } from "../scope";
import { requestFixture } from "./fixtures";
import pilot from "../fixtures/catalog-pilot.json";

it("bölüm ve alan kilidindeki ürün özelliklerini türetme ve ürün değişiminden korur", () => {
  const request = requestFixture(); request.sizeDesigns = true;
  Object.assign(request.modules.main.selections, { ropeOrderLengthM: 777, motorPowerKw: 55 });
  request.locks = ["main.2.1", "main.selections.motorPowerKw", "main.inputs.shaftD2Mm"];
  const before = structuredClone(request.modules.main);
  const result = solveSelection(request, pilot as EquipmentRow[]);
  for (const field of getCatalogMapping("main", "2.1")!.fields) expect((result.modules.main.selections as Record<string, unknown>)[field.sel]).toEqual((before.selections as Record<string, unknown>)[field.sel]);
  expect((result.modules.main.selections as Record<string, unknown>).motorPowerKw).toBe(55);
  expect((result.modules.main.inputs as Record<string, unknown>).shaftD2Mm).toBe((before.inputs as Record<string, unknown>).shaftD2Mm);
  expect(result.trace.decisions.some(decision => decision.section === "2.4")).toBe(false);
});

it("katalog satır sırası değişince aynı seçimleri yapar ve gerekçeleri son hesaptan alır", () => {
  const request = requestFixture(); request.sizeDesigns = true;
  const a = solveSelection(request, pilot as EquipmentRow[]);
  const b = solveSelection(request, [...pilot].reverse() as EquipmentRow[]);
  expect(a.trace.decisions.length).toBeGreaterThan(0);
  expect(contentHash(a.modules)).toBe(contentHash(b.modules));
  expect(a.trace.catalogHash).toBe(b.trace.catalogHash);
  expect(a.trace.decisions).toEqual(b.trace.decisions);
  const checks = runCalc(selectionCalcInput({ ...request, specs: a.specs, active: a.active! }, a.modules)).allChecks;
  for (const decision of a.trace.decisions) for (const evidence of decision.evidence ?? []) {
    const check = checks.find(value => value.id === evidence.id)!;
    expect(evidence.computed).toEqual(checkDisplay(check).computed);
    expect(evidence.pass).toBe(check.pass);
  }
  expect(readSelectionTrace(JSON.parse(JSON.stringify(a.trace)))?.decisions).toEqual(JSON.parse(JSON.stringify(a.trace.decisions)));
});

it("istenirse yapısal modülleri açar; bilinmeyen kütleyi ve insan ölçü onayını üretmez", () => {
  const request = requestFixture(); request.active = ["main", "girder"]; request.enableStructuralChecks = true; request.sizeDesigns = true;
  const result = solveSelection(request, []);
  expect(result.active).toEqual(expect.arrayContaining(["girder", "buckling", "endCarriage"]));
  expect(result.specs.mainTrolleyWeightT).toBeGreaterThanOrEqual(request.specs.mainTrolleyWeightT);
  expect(result.trace.audit?.masses.some(band => band.unknown > 0)).toBe(true);
  expect(result.trace.issues.some(issue => issue.code === "mass.trolley" && issue.state === "missing")).toBe(true);
  expect(result.trace.issues.some(issue => issue.code.startsWith("mass."))).toBe(true);
  expect((result.modules.girder.inputs as Record<string, unknown>).loadMeasurementsConfirmed).not.toBe(true);
  expect(result.trace.status).toBe("incomplete");
});

it("elektrik önerisini sabit seçime dönüştürür; kilitli elektrik bölümünü korur", () => {
  const request = requestFixture(); request.active = ["main", "electrical"]; request.specs.hasElectricalCalculation = "yes";
  const result = solveSelection(request, []);
  expect(result.trace.decisions.some(decision => decision.module === "electrical")).toBe(true);
  expect((result.modules.electrical.inputs as Record<string, unknown>).mainCableAuto).toBe(false);
  const electrical = runCalc(selectionCalcInput(request, result.modules)).electrical!;
  expect(electrical.checks.filter(check => /festoon\.(width|bend)/.test(check.id)).every(check => check.pass)).toBe(true);
  expect(result.modules.electrical.inputs).toMatchObject({ usableWidthMm: electrical.values.festoon.usableWidthMm, supportDiameterMm: electrical.values.festoon.supportDiameterMm });
  expect(result.trace.issues.some(issue => issue.code === "electrical.installation")).toBe(true);
  request.locks = ["electrical"];
  const locked = solveSelection(request, []);
  expect(locked.modules.electrical).toEqual(request.modules.electrical);
});

it("sonsuzluk içeren yeşil kontrolü yayımlanabilir saymaz", () => {
  const valid: AnyCheck = { id: "test", label: "Kontrol", provided: 2, required: 1, op: ">=", computedSide: "provided", pass: true, unit: "" };
  const result = (check: AnyCheck) => ({ allChecks: [check] }) as CalcResult;
  expect(selectionNumericallyComplete(result(valid))).toBe(true);
  expect(selectionNumericallyComplete(result({ ...valid, provided: Infinity }))).toBe(false);
  expect(selectionNumericallyComplete(result({ ...valid, computedSide: "provided", op: "range", min: 1, max: NaN }))).toBe(false);
  expect(selectionNumericallyComplete({ allChecks: [] } as unknown as CalcResult)).toBe(false);
});

it("portal ve özel aparat kapsamını varsayılan köprü hesabıyla tamamlanmış saymaz", () => {
  const request = requestFixture(); request.craneType = "Portal Vinç"; request.specs.hookType = "Kepçe";
  expect(selectionScopeIssues(request).filter(issue => issue.state === "unsupported").map(issue => issue.code)).toEqual(expect.arrayContaining(["scope.gantry", "scope.attachment"]));
});
