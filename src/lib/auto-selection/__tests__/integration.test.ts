import { describe, expect, it } from "vitest";
import { NEW_WORK_TEMPLATE } from "@/lib/calc/defaults";
import type { CalcInput } from "@/lib/calc/engine";
import { moduleState } from "@/lib/calc/presentation/module-access";
import { MODULE_ORDER } from "@/lib/calc/presentation/module-family";
import type { ModulesState } from "@/lib/calc/state";
import { emptyItem, withDefaults } from "@/lib/offers/payload";
import { costItemFromOfferItem } from "@/lib/offers/cost/payload";
import { withReportCostSource } from "@/lib/offers/cost/report-source";
import { SINGLE_GIRDER_CRANE_TYPE, GROUND_CRANE_TYPE } from "@/lib/crane-types";
import { applyReportToOfferItem, reportInputFromOfferItem, technicalNumber } from "../offer-bridge";
import { readOfferCalculationSource } from "../offer-source";
import { contentHash, type SelectionTrace } from "../types";
import { readSelectionTrace, selectionReviewComplete, selectionReviewHash } from "../trace";
import { undoSelection } from "../undo";
import { buildOfferReportTransferFile, stringifyOfferReportTransferFile, parseOfferReportTransferText } from "@/lib/offer-report-transfer";

function inputFixture(): CalcInput {
  const input: CalcInput = { specs: structuredClone(NEW_WORK_TEMPLATE.specs), mainHoist: structuredClone(NEW_WORK_TEMPLATE.mainHoist!) };
  input.mainHoist!.selections.motorPowerKw = 100;
  input.mainHoist!.selections.motorCount = 2;
  return input;
}
function traceFixture(): SelectionTrace {
  return { version: "1.0.0", engineVersion: "0.8.0", createdAt: new Date().toISOString(), sourceHash: "source", resultHash: "result", catalogHash: "catalog", brands: {}, locks: [], decisions: [], issues: [{ code: "thermal.main", state: "missing", message: "Termik kapasite" }], status: "incomplete", evaluations: 2, search: "bounded" };
}
const source = (input = inputFixture()) => ({ projectId: "project", revisionId: "revision", revisionNo: 0, input });
const offerFixture = () => emptyItem("Test", ["general", "mainHoist", "trolley", "bridge", "electrical"]);

describe("teklif ve maliyet aynı hesap snapshot'ını kullanır", () => {
  it("çift hızı açık kuralla okur, kapasite aralığını ve taşan sayıyı reddeder", () => {
    expect(technicalNumber("0,8 / 5", true)).toBe(5);
    expect(technicalNumber("1–6", true)).toBe(6);
    for (const text of ["10/20", "10 ton", "1.000,5", "9".repeat(400), "-5"]) expect(technicalNumber(text)).toBeUndefined();
  });
  it("manuel satırın artık görünmeyen parçalarını rapora taşımaz; tipi korur", () => {
    const item = offerFixture();
    const capacity = item.groups[0].rows.find(row => row.key === "capacity")!;
    capacity.parts = { main: "75" }; capacity.manual = true; capacity.value = "Müşteriye göre";
    item.craneType = SINGLE_GIRDER_CRANE_TYPE;
    const prepared = reportInputFromOfferItem(item);
    expect(prepared.input.specs.mainCapacityT).not.toBe(75);
    expect(prepared.warnings.some(warning => warning.includes("capacity"))).toBe(true);
    expect(prepared.input.specs.girderArrangement).toBe("tek");
    item.craneType = GROUND_CRANE_TYPE;
    expect(reportInputFromOfferItem(item).input.specs.travelArrangement).toBe("fixed");
  });
  it("birim motor gücü ile fiziksel toplam gücü ayırır; ikiz donanımı iki kez yanlış çarpmaz", () => {
    const input = inputFixture(); input.specs.mainHoistEquipmentArrangement = "twin";
    const applied = applyReportToOfferItem(offerFixture(), source(input)).item;
    expect(applied.calculationSource!.rows["mainHoist.motor"].power).toBe("100");
    expect(applied.calculationSource!.rows["mainHoist.motor"].count).toBe("4");
    const cost = costItemFromOfferItem(applied, 1);
    expect(cost.overrides["c.hoistMotorKw"]).toBe(100);
    expect(cost.overrides["c.installedKw"]).toBe(400);
  });
  it("tekrar aktarımda elle değiştirilen satır ile ticari ezmeyi korur", () => {
    const first = applyReportToOfferItem(offerFixture(), source()).item;
    const motor = first.groups.find(group => group.key === "mainHoist")!.rows.find(row => row.key === "motor")!;
    motor.parts = { ...motor.parts, power: "125" };
    const changed = inputFixture(); changed.mainHoist!.selections.motorPowerKw = 110;
    const next = applyReportToOfferItem(first, source(changed));
    expect(next.item.groups.find(group => group.key === "mainHoist")!.rows.find(row => row.key === "motor")!.parts!.power).toBe("125");
    expect(next.preserved.length).toBeGreaterThan(0);
    const cost = costItemFromOfferItem(first, 1); cost.overrides["c.hoistMotorKw"] = 120;
    expect(withReportCostSource(cost, next.item).overrides["c.hoistMotorKw"]).toBe(120);
    expect(changed.mainHoist!.selections.motorPowerKw).toBe(110);
  });
  it("başarısız seçim yerine şablon motorunu teklife ve maliyete yazmaz", () => {
    const first = applyReportToOfferItem(offerFixture(), source()).item;
    const next = applyReportToOfferItem(first, source(), traceFixture()).item;
    expect(next.calculationSource!.rows["mainHoist.motor"]).toBeUndefined();
    expect(next.groups.find(group => group.key === "mainHoist")!.rows.find(row => row.key === "motor")!.parts?.power).toBeUndefined();
    const cost = withReportCostSource(costItemFromOfferItem(first, 1), next);
    expect(cost.overrides["c.hoistMotorKw"]).toBeUndefined();
  });
  it("kaynak snapshot kayıt turunu geçer, sonradan oynanmış içerik reddedilir", () => {
    const input = inputFixture(); const applied = applyReportToOfferItem(offerFixture(), source(input)).item;
    const serialized = JSON.parse(JSON.stringify(applied.calculationSource));
    expect(readOfferCalculationSource(serialized)?.hash).toBe(applied.calculationSource!.hash);
    expect(withDefaults({ items: [applied] }).items[0].calculationSource?.hash).toBe(applied.calculationSource!.hash);
    input.mainHoist!.selections.motorPowerKw = 999;
    expect(applied.calculationSource!.input.mainHoist!.selections.motorPowerKw).toBe(100);
    serialized.input.mainHoist.selections.motorPowerKw = 999;
    expect(readOfferCalculationSource(serialized)).toBeUndefined();
  });
  it("hash'i yeniden yazılmış olsa bile bozuk modül ve ekipman kaynağını reddeder", () => {
    const good = applyReportToOfferItem(offerFixture(), source()).item.calculationSource!;
    const malformed = JSON.parse(JSON.stringify(good));
    delete malformed.input.mainHoist.selections;
    malformed.hash = contentHash(malformed.input);
    expect(readOfferCalculationSource(malformed)).toBeUndefined();
    expect(readOfferCalculationSource({ ...good, equipment: [null] })).toBeUndefined();
    expect(readOfferCalculationSource({ ...good, rows: { motor: ["100"] } })).toBeUndefined();
  });
});

describe("düzenleme ve kontrol kaydı", () => {
  it("dışa ve içe aktarım seçim izini taşır, önceki raporun mühendis notu onayını taşımaz", () => {
    const trace = traceFixture();
    trace.review = { inputHash: "old-report", notes: { "thermal.main": "Üretici tablosu doğrulandı." }, reviewedAt: new Date().toISOString() };
    const metadata = { offerRevisionId: "offer", itemId: "item", warnings: ["Mekanizma sınıfı kontrol edilmeli"] };
    const file = buildOfferReportTransferFile({ project: { documentNo: "TEST", name: "TEST", customer: "TEST", craneType: "Çift Kirişli Gezer Köprülü Vinç", craneLocation: "" }, revision: { revNo: 0, engineVersion: "test", inputs: { specs: NEW_WORK_TEMPLATE.specs, autoSelection: trace, offerTechnicalSource: metadata }, selections: {} } });
    expect(readSelectionTrace(file.revision.inputs.autoSelection)?.review).toBeUndefined();
    // İçeri alınan dış dosya eski onayı yeniden eklese bile yeniden onay gerekir.
    file.revision.inputs.autoSelection = trace;
    const imported = parseOfferReportTransferText(stringifyOfferReportTransferFile(file));
    expect(imported.inputs.autoSelection?.review).toBeUndefined();
    expect(imported.inputs.autoSelection?.issues).toEqual(trace.issues);
    expect(imported.inputs.offerTechnicalSource).toEqual(metadata);
    expect(trace.review).toBeDefined();
  });
  it("geri alma yalnız otomatiğin değişmeden kalan alanlarını geri yazar", () => {
    const before = Object.fromEntries(MODULE_ORDER.map(key => [key, structuredClone(moduleState(NEW_WORK_TEMPLATE, key) ?? { inputs: {}, selections: {} })])) as ModulesState;
    const after = structuredClone(before), current = structuredClone(before);
    Object.assign(after.main.selections, { motorPowerKw: 20, motorRpm: 1400 });
    Object.assign(current.main.selections, { motorPowerKw: 25, motorRpm: 1400 });
    const result = undoSelection(current, before, after);
    expect((result.modules.main.selections as Record<string, unknown>).motorPowerKw).toBe(25);
    expect((result.modules.main.selections as Record<string, unknown>).motorRpm).toBe((before.main.selections as Record<string, unknown>).motorRpm);
    expect(result.preserved).toBe(1);
  });
  it("üretici notu hesap değiştiğinde geçersizleşir; JSON kayıt turunda aynı kalır", () => {
    const trace = traceFixture(), input = inputFixture();
    expect(selectionReviewComplete(trace, input)).toBe(false);
    trace.review = { inputHash: selectionReviewHash(input), notes: { "thermal.main": "Üretici termik güç tablosu, sayfa 12 doğrulandı." }, reviewedAt: new Date().toISOString() };
    expect(selectionReviewComplete(trace, input)).toBe(true);
    expect(selectionReviewHash(JSON.parse(JSON.stringify(input)))).toBe(selectionReviewHash(input));
    input.specs.mainCapacityT += 1;
    expect(selectionReviewComplete(trace, input)).toBe(false);
    expect(readSelectionTrace(trace)?.review).toEqual(trace.review);
    expect(readSelectionTrace({ ...trace, issues: "eksik" })).toBeUndefined();
    expect(contentHash(trace)).not.toBe(contentHash({ ...trace, review: undefined }));
  });
});
