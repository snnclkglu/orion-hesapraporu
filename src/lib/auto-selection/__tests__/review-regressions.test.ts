import { expect, it } from "vitest";
import { NEW_WORK_TEMPLATE } from "@/lib/calc/defaults";
import { emptyItem } from "@/lib/offers/payload";
import { copyOfferItem, copyPayloadForCustomer } from "@/lib/offers/copy";
import { emptyPayload } from "@/lib/offers/payload";
import { requestFixture } from "./fixtures";
import { applyReportToOfferItem, reportInputFromOfferItem } from "../offer-bridge";
import { prepareSelectionRequest } from "../technical-contract";
import { validateSelectionRequest } from "../preflight";
import { solveSelection } from "../orchestrator";
import type { EquipmentRow } from "../types";
import pilot from "../fixtures/catalog-pilot.json";
import { loadRevision } from "@/lib/revision-load";
import { selectionScopeIssues } from "../scope";
import { offerDemand, offerDemandPatch } from "../offer-demand";

const offer = () => emptyItem("DENETİM", ["general", "mainHoist", "trolley", "bridge", "electrical"]);
const source = () => ({ projectId: "source-project", revisionId: "source-revision", revisionNo: 0, input: structuredClone(NEW_WORK_TEMPLATE) });

it.each(["mainCapacityT", "spanM", "mainLiftSpeedMpm"] as const)("değişen teklifin eski %s hesabını aktaramaz", field => {
  const item = applyReportToOfferItem(offer(), source()).item;
  const row = field === "mainCapacityT" ? ["general", "capacity", "main"] : field === "spanM" ? ["general", "span", "value"] : ["mainHoist", "liftSpeed", "range"];
  const target = item.groups.find(group => group.key === row[0])!.rows.find(value => value.key === row[1])!;
  target.parts = { ...target.parts, [row[2]]: String(NEW_WORK_TEMPLATE.specs[field] * 2) };
  expect(() => applyReportToOfferItem(item, source())).toThrow("Teklif ile hesap uyuşmuyor");
});

it("boş teklifin kritik girdileri şablonla ön kontrolü geçemez", () => {
  const input = reportInputFromOfferItem(offer()).input;
  expect(input.specs.mainCapacityT).toBeNull();
  expect(loadRevision(JSON.parse(JSON.stringify({ specs: input.specs })), {}).full.specs.mainCapacityT).toBeNull();
  const request = requestFixture(); request.specs = input.specs;
  expect(() => validateSelectionRequest(request)).toThrow("kapasite");
});

it("teklifte temizlenen eski kapasiteyi siler; baştan boş olup raporda tamamlanan alanı korur", () => {
  const demand = offerDemand(offer());
  expect(offerDemandPatch(demand, { mainCapacityT: 25 }).mainCapacityT).toBeNull();
  expect(offerDemandPatch(demand, { mainCapacityT: null }).mainCapacityT).toBeUndefined();
});

it("teklifin özel aparatını ve fren ailelerini teknik talepte korur", () => {
  const item = offer();
  item.groups.find(g => g.key === "mainHoist")!.rows.find(r => r.key === "hook")!.value = "C Kancası";
  item.groups.find(g => g.key === "mainHoist")!.rows.find(r => r.key === "brake")!.parts = { type: "Eldro Fren" };
  const input = reportInputFromOfferItem(item).input;
  expect(input.specs.hookType).toBe("C Kancası"); expect(input.specs.hoistBrakeType).toBe("Eldro Fren");
  expect(selectionScopeIssues({ ...requestFixture(), specs: input.specs }).some(issue => issue.code === "scope.attachment")).toBe(true);
  item.groups.find(g => g.key === "trolley")!.rows.find(r => r.key === "brake")!.parts = { type: "Eldro Fren" };
  item.groups.find(g => g.key === "bridge")!.rows.find(r => r.key === "brake")!.parts = { type: "Manyetik Fren" };
  expect(() => validateSelectionRequest({ ...requestFixture(), active: ["main", "bridge"], specs: reportInputFromOfferItem(item).input.specs })).toThrow("fren tipleri çelişiyor");
});

it("teknik taleple çelişen kilitli kancayı sessizce değiştirmez", () => {
  const request = requestFixture(); request.specs.hookType = "DIN 15402 Çift Ağız Kanca";
  request.active = ["main", "hookBlock"]; request.locks = ["hookBlock.4.1"];
  expect(() => prepareSelectionRequest(request)).toThrow("kilitli kanca");
});

it("teknik tablodaki çift ağızlı kanca talebi seçimin fiziksel ailesidir", () => {
  const request = requestFixture(); request.specs.hookType = "DIN 15402 Çift Ağız Kanca";
  request.active = ["main", "hookBlock"]; request.sizeDesigns = true;
  const hook = (pilot as EquipmentRow[]).find(row => row.kind === "hook")!;
  const doubleHook = { ...hook, id: "synthetic-double-hook", model: hook.model.replace("15401", "15402") };
  const result = solveSelection(request, [...pilot as EquipmentRow[], doubleHook]);
  expect((result.modules.hookBlock.selections as Record<string, unknown>).hookStandard).toBe("DIN 15402");
  expect(result.trace.decisions.find(decision => decision.row.kind === "hook")?.row.model).toContain("15402");
  const unavailable = solveSelection(request, pilot as EquipmentRow[]);
  expect(unavailable.trace.decisions.some(decision => decision.row.kind === "hook")).toBe(false);
  expect(unavailable.trace.issues.some(issue => issue.code === "selection.hookBlock.4.1")).toBe(true);
});

it("kalem ve müşteri kopyası kaynak geçmişini derin kopyalar, bağımsız hesap için kökeni taşır", () => {
  const original = applyReportToOfferItem(offer(), source()).item;
  const copied = copyOfferItem(original, "KOPYA");
  expect(copied.calculationSource).toEqual(original.calculationSource);
  expect(copied.calculationSource).not.toBe(original.calculationSource);
  expect(copied.calculationOrigin).toEqual({ itemId: original.id });
  const payload = emptyPayload(); payload.items = [original];
  const customerCopy = copyPayloadForCustomer(payload, { customerName: "KOPYA", sourceRevisionId: "source-offer-revision" });
  expect(customerCopy.items[0].calculationOrigin).toEqual({ itemId: original.id, offerRevisionId: "source-offer-revision" });
  expect(customerCopy.items[0].calculationSource).not.toBe(original.calculationSource);
});

it("rapor aktarımı teklifin düşük/yüksek hız aralığını tek hıza indirmez", () => {
  const item = offer();
  const row = item.groups.find(group => group.key === "mainHoist")!.rows.find(row => row.key === "liftSpeed")!;
  row.parts = { range: `0,8 / ${NEW_WORK_TEMPLATE.specs.mainLiftSpeedMpm}` };
  const result = applyReportToOfferItem(item, source()).item;
  expect(result.groups.find(group => group.key === "mainHoist")!.rows.find(row => row.key === "liftSpeed")!.parts?.range).toBe(row.parts.range);
});

it("ilk dört redüktöre uymayan kaplin için sonraki uygun çifte döner", () => {
  const request = requestFixture(); request.sizeDesigns = true;
  const baseline = solveSelection(request, pilot as EquipmentRow[]);
  const drive = baseline.trace.decisions.find(decision => decision.row.kind === "gearbox")!.row;
  const coupling = baseline.trace.decisions.find(decision => decision.section === "2.6")!.row;
  const probe = requestFixture(); probe.modules = structuredClone(baseline.modules); probe.specs = baseline.specs;
  probe.locks = ["main.2.1", "main.design-drum", "main.2.2.6", "main.2.2.7", "main.2.4", "main.2.5", "main.2.7", "main.safety", "main.2.9"];
  const gears = Array.from({ length: 20 }, (_, index) => ({ ...drive, id: `synthetic-gear-${index}`, brand: "TEST", model: `GB-${String(index).padStart(2, "0")}`, attrs: { ...drive.attrs, input_shaft_mm: index < 15 ? 100 : 40, weight_kg: 100 + index } }));
  const connector = { ...coupling, id: "synthetic-coupling", brand: "TEST", attrs: { ...coupling.attrs, max_shaft_dia_mm: 60 } };
  const full = solveSelection(probe, [...gears, connector]);
  const exhaustive = gears.filter(gear => solveSelection(probe, [gear, connector]).trace.decisions.some(decision => decision.section === "2.6"));
  expect(exhaustive.length).toBe(5);
  expect(full.trace.decisions.find(decision => decision.row.kind === "gearbox")?.row.model).toBe(exhaustive[0].model);
  expect(full.trace.decisions.some(decision => decision.section === "2.6")).toBe(true);
  const shuffled = solveSelection(probe, [connector, ...gears.toReversed()]);
  expect(shuffled.trace.decisions.map(decision => decision.variantKey)).toEqual(full.trace.decisions.map(decision => decision.variantKey));
});
