import { readFileSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { requestFixture } from "./fixtures";
import { applyDesignInputs, designInputsFrom } from "../design-inputs";
import { DEFAULT_BRANDS, defaultSeries, initialBrands, availableSeries } from "../brands";
import { selectionCatalogFilter } from "../catalog-scope";
import { missingCatalogFields, normalizeCatalog } from "../catalog";
import { solveSelection } from "../orchestrator";
import { selectionCalcInput } from "../solver";
import { readSelectionTrace } from "../trace";
import { contentHash, selectionSourceHash, type EquipmentRow } from "../types";
import { runCalc } from "@/lib/calc/engine";
import { RAILS } from "@/lib/calc/tables";
import { buildEquipmentGroups } from "@/lib/equipment-list";
import { getCatalogMapping, applyCatalogPick } from "@/lib/catalog-mapping";
import { findCatalogSheet } from "@/lib/catalog-sheets";
import { TRAVEL_SECTIONS } from "@/lib/calc/presentation/travelSections";
import type { TravelSelections } from "@/lib/calc/modules/travelGroup";
import { kimlikBuyuk } from "@/lib/tr-text";

describe("hızlı seçim başlangıç kararları", () => {
  it("standart markalar ilk açılışta doludur; kayıtlı tercih ve serbest seçim korunur", () => {
    expect(initialBrands()).toEqual(DEFAULT_BRANDS);
    expect(initialBrands({ motor: "elk", rope: "Haşçelik", buffer: "" })).toMatchObject({ motor: "ELK", rope: "HAŞÇELİK", buffer: "" });
    expect(defaultSeries("hoistGearbox", "Yılmaz Redüktör")).toBe("H");
    expect(defaultSeries("travelGearbox", "Yılmaz Redüktör")).toBe("DR");
    expect(defaultSeries("motorCoupling", "SIBRE")).toBe("APC-AT");
    expect(defaultSeries("travelGearbox", "FLENDER")).toBe("H");
  });
  it("marka ve seri birlikte süzülür; başka markanın aynı tipine kaymaz", () => {
    const request = requestFixture(); request.active = ["main", "trolley"]; request.brands = initialBrands(); request.series = { hoistGearbox: "H", travelGearbox: "DR" };
    const families = [
      { kind: "gearbox", brand: "Yılmaz Redüktör", attrs: { application: "yurutme", series: "DR" } },
      { kind: "gearbox", brand: "Yılmaz Redüktör", attrs: { application: "kaldirma", series: "H" } },
      { kind: "gearbox", brand: "FLENDER", attrs: { application: "yurutme", series: "H1" } },
    ];
    expect(availableSeries(families, "travelGearbox", "YILMAZ REDÜKTÖR", request)).toEqual(["DR"]);
    expect(selectionCatalogFilter(request).filter(f => f.kind === "gearbox")).toEqual([
      { kind: "gearbox", brands: ["YILMAZ REDÜKTÖR"], application: "kaldirma", series: "H" },
      { kind: "gearbox", brands: ["YILMAZ REDÜKTÖR"], application: "yurutme", series: "DR" },
    ]);
    const proposal = solveSelection({ ...request, series: { hoistGearbox: "OLMAYAN" } }, []);
    expect(proposal.trace.decisions.some(d => d.row.kind === "gearbox")).toBe(false);
  });
  it("halat donanımı, teker ve ray kararı ortak fiziksel sonuçları değiştirir; kaynak değişmez", () => {
    const request = requestFixture(); request.active = ["main", "trolley", "bridge"];
    request.design = designInputsFrom(request);
    request.design.reeving.main = { drivenFalls: 2, totalFalls: 4 };
    request.design.travel.trolley = { wheelCount: 4, driveCount: 2, railCode: "70x40" };
    request.design.travel.bridge = { wheelCount: 8, driveCount: 4, railCode: "A120" };
    const before = contentHash(request); const prepared = applyDesignInputs(request);
    const first = runCalc(selectionCalcInput(prepared, prepared.modules));
    expect(contentHash(request)).toBe(before);
    expect(first.bridge!.cells["drive.count"]).toBe(4);
    expect(first.bridge!.cells["rail.headWidth"]).toBe(RAILS.A120.headWidth);
    expect(first.trolley!.cells["rail.headWidth"]).toBe(70);
    expect((prepared.modules.bridge.selections as TravelSelections).motorCount).toBe(4);
    request.design.reeving.main.totalFalls = 8;
    const next = applyDesignInputs(request); const second = runCalc(selectionCalcInput(next, next.modules));
    expect(second.mainHoist!.cells["rope.load"]).toBeLessThan(Number(first.mainHoist!.cells["rope.load"]));
    // Teker sayısını tek başına değiştir: donanım değişimi asılı halat kütlesini de etkiler.
    request.design.travel.trolley.wheelCount = 8;
    const eight = applyDesignInputs(request); const third = runCalc(selectionCalcInput(eight, eight.modules));
    expect(Number(third.trolley!.cells["wheel.maxLoad"])).toBeCloseTo(Number(second.trolley!.cells["wheel.maxLoad"]) / 2, 6);
  });
  it("kilit çatışmasını, tekerden fazla tahriki ve bilinmeyen rayı reddeder", () => {
    const request = requestFixture(); request.active = ["main", "trolley"]; request.design = designInputsFrom(request);
    request.design.travel.trolley!.driveCount = 8;
    expect(() => applyDesignInputs(request)).toThrow(/tahrik/);
    request.design.travel.trolley!.driveCount = 2; request.design.travel.trolley!.railCode = "A999";
    expect(() => applyDesignInputs(request)).toThrow(/ray/);
    request.design.travel.trolley!.railCode = "A120"; request.locks = ["trolley"];
    expect(() => applyDesignInputs(request)).toThrow(/kilitli/);
    request.locks = ["trolley.5.4"]; request.design.travel.trolley!.driveCount = 4;
    Object.assign(request.modules.trolley.inputs, { wheelsPerMotor: 1, motorCountAuto: true });
    expect(() => applyDesignInputs(request)).toThrow(/Motor adedi kilitli/);
  });
  it("değişen tasarım ölçü teyidini sıfırlar; boş sipariş alanları kilit ve kullanıcı tercihini korur", () => {
    const request = requestFixture(); request.active = ["main", "trolley"]; request.design = designInputsFrom(request);
    const measurements = request.modules.wheelLoads.inputs as Record<string, unknown>;
    measurements.measurementsConfirmed = true;
    request.design.travel.trolley!.wheelCount = 8;
    const selection = request.modules.trolley.selections as TravelSelections;
    selection.motorInsulationClass = "H"; selection.motorDutyType = "";
    selection.motorThermalProtection = ""; selection.motorMountType = "";
    request.locks = ["trolley.selections.motorThermalProtection"];
    const result = solveSelection(request, []);
    expect((result.modules.wheelLoads.inputs as Record<string, unknown>).measurementsConfirmed).toBe(false);
    expect(measurements.measurementsConfirmed).toBe(true);
    expect(result.modules.trolley.selections).toMatchObject({ motorInsulationClass: "H", motorDutyType: "S1", motorThermalProtection: "", motorMountType: "B3" });
    expect(result.trace.issues.some(issue => issue.code === "order.defaults.trolley")).toBe(true);
  });
  it("tasarım ve seri izi kayıt/yükleme turunda kalır; özgün taslak hash'i korunur", () => {
    const request = requestFixture(); request.design = designInputsFrom(request); request.series = { hoistGearbox: "H" };
    request.design.reeving.main = { drivenFalls: 2, totalFalls: 8 };
    const proposal = solveSelection(request, []);
    expect(proposal.trace.sourceHash).toBe(selectionSourceHash(request.specs, request.modules, request.active));
    expect(readSelectionTrace(JSON.parse(JSON.stringify(proposal.trace)))).toMatchObject({ design: request.design, series: request.series });
  });
});

it("DR motor akuple bağlantıda ayrı kaplin aramaz; DT'de kaplin kontrollerini geri getirir", () => {
  const request = requestFixture(); request.active = ["trolley"];
  const selection = request.modules.trolley.selections as TravelSelections;
  const dr: EquipmentRow = { id: "dr", kind: "gearbox", brand: "Yılmaz Redüktör", model: "DR072", attrs: { ratio: 21.12, input_speed_rpm: 1450, output_torque_nm: 150, output_shaft_mm: 25, input_configuration: "Motor akuple", series: "DR", application: "yurutme" } };
  expect(missingCatalogFields(dr)).toEqual([]);
  Object.assign(selection, applyCatalogPick(getCatalogMapping("trolley", "5.5")!, dr), { motorCouplingTorqueNm: 0, motorCouplingDmaxMm: 0 });
  const input = selectionCalcInput(request, request.modules);
  expect(runCalc(input).allChecks.some(c => c.id.includes(".motorCoupling."))).toBe(false);
  expect(buildEquipmentGroups(input).flatMap(g => g.rows).some(row => row.rowKey === "trolley:motorCoupling")).toBe(false);
  expect(TRAVEL_SECTIONS.find(section => section.id === "5.6")!.visible!(request.specs, "trolley", selection)).toBe(false);
  selection.gearboxInputConfiguration = "Motorsuz mil girişli";
  expect(runCalc(input).allChecks.filter(c => c.id.includes(".motorCoupling.")).some(c => !c.pass)).toBe(true);
  selection.gearboxInputConfiguration = "Motor akuple";
  Object.assign(selection, applyCatalogPick(getCatalogMapping("trolley", "5.5")!, { ...dr, attrs: { ...dr.attrs, input_configuration: undefined } }));
  expect(selection.gearboxInputConfiguration).toBe("");
  expect(TRAVEL_SECTIONS.find(section => section.id === "5.6")!.visible!(request.specs, "trolley", selection)).toBe(true);
});

it("büyük harfli katalog kimliği eski üretici föyünü bulur", () => {
  const first = findCatalogSheet("coupling", "SIBRE", "APC-AT 250");
  expect(first).toBeDefined();
  expect(findCatalogSheet("coupling", "sibre", "APC-AT 250")).toEqual(first);
  const row: EquipmentRow = { id: "1", kind: "motor", brand: "Haşçelik", model: "M", attrs: {} };
  expect(normalizeCatalog([row])[0].brand).toBe("HAŞÇELİK");
});

it.skipIf(!process.env.AUTO_SELECTION_CATALOG_FILE)("gerçek katalog: standart markalar, H/DR, APC-AT ve tasarım kararlarıyla sıralı seçim", () => {
  const request = requestFixture(); request.active = ["main", "hookBlock", "trolley", "bridge"]; request.sizeDesigns = true;
  request.specs.hoistBrakeType = "Eldro Fren"; request.specs.travelBrakeType = "Elektromanyetik Fren";
  request.brands = initialBrands(); request.series = { hoistGearbox: "H", travelGearbox: "DR", motorCoupling: "APC-AT", drumCoupling: "J" };
  request.design = designInputsFrom(request); request.design.travel.trolley = { wheelCount: 4, driveCount: 2, railCode: "70x40" }; request.design.travel.bridge = { wheelCount: 8, driveCount: 4, railCode: "A120" };
  const filters = selectionCatalogFilter(request);
  const rows = (JSON.parse(readFileSync(process.env.AUTO_SELECTION_CATALOG_FILE!, "utf8")) as EquipmentRow[]).filter(row => filters.some(f => f.kind === row.kind && (!f.application || f.application === row.attrs.application) && (!f.series || f.series === row.attrs.series) && (f.brands === null || f.brands.includes(kimlikBuyuk(row.brand)))));
  const start = performance.now(); const result = solveSelection(request, rows);
  writeFileSync("tmp/auto-selection/design-standard-result.json", JSON.stringify({ ms: Math.round(performance.now() - start), ...result }, null, 2));
  const hoistGear = result.trace.decisions.find(d => d.module === "main" && d.row.kind === "gearbox");
  const travelGears = result.trace.decisions.filter(d => ["trolley", "bridge"].includes(d.module) && d.row.kind === "gearbox");
  expect(hoistGear?.row.attrs.series).toBe("H");
  expect(travelGears).toHaveLength(2);
  expect(travelGears.every(d => d.row.attrs.series === "DR")).toBe(true);
  expect(result.trace.decisions.some(d => d.section === "5.6")).toBe(false);
  expect(result.trace.decisions.some(d => d.module === "main" && d.section === "2.1")).toBe(true);
  expect(result.trace.decisions.find(d => d.module === "main" && d.section === "2.6")?.row.attrs.series).toBe("APC-AT");
}, 120000);
