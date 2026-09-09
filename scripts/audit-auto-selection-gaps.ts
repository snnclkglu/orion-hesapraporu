// Salt yerel denetim: canlı veri yazmaz, üretim kodunu değiştirmez.
// GB-* satırları yalnız arama davranışı deneyi için SENTETİK test ürünleridir.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import assert from "node:assert/strict";
import { NEW_WORK_TEMPLATE } from "../src/lib/calc/defaults";
import { requestFixture } from "../src/lib/auto-selection/__tests__/fixtures";
import { solveSelection } from "../src/lib/auto-selection/orchestrator";
import { selectionCalcInput } from "../src/lib/auto-selection/solver";
import { applyReportToOfferItem, reportInputFromOfferItem } from "../src/lib/auto-selection/offer-bridge";
import { emptyItem } from "../src/lib/offers/payload";
import { copyOfferItem } from "../src/lib/offers/copy";
import type { EquipmentRow } from "../src/lib/auto-selection/types";

const catalog = JSON.parse(readFileSync("src/lib/auto-selection/fixtures/catalog-pilot.json", "utf8")) as EquipmentRow[];
const request = requestFixture(); request.sizeDesigns = true;
const solved = solveSelection(request, catalog);
const input = selectionCalcInput({ ...request, specs: solved.specs, active: solved.active! }, solved.modules);
const item = emptyItem("DENETİM", ["general", "mainHoist", "trolley", "bridge", "electrical"]);
const capacity = item.groups.find(group => group.key === "general")!.rows.find(row => row.key === "capacity")!;
capacity.parts = { main: "25" };
let staleError = "";
try { applyReportToOfferItem(item, { projectId: "audit-project", revisionId: "audit-revision", revisionNo: 0, input }, solved.trace); }
catch (error) { staleError = error instanceof Error ? error.message : String(error); }
assert.match(staleError, /Teklif ile hesap uyuşmuyor/);
const stale = applyReportToOfferItem(emptyItem("DOĞRULAMA", ["general", "mainHoist", "trolley", "bridge", "electrical"]), { projectId: "audit-project", revisionId: "audit-revision", revisionNo: 0, input }, solved.trace);
const staleMotor = stale.item.groups.find(group => group.key === "mainHoist")!.rows.find(row => row.key === "motor");
const copied = copyOfferItem(stale.item, "KOPYA");

const narrowRequest = requestFixture(); narrowRequest.modules = structuredClone(solved.modules); narrowRequest.specs = solved.specs;
narrowRequest.locks = ["main.2.1", "main.design-drum", "main.2.2.6", "main.2.2.7", "main.2.4", "main.2.5", "main.2.7", "main.safety", "main.2.9"];
Object.assign(narrowRequest.modules.main.selections, { motorCouplingDmaxMm: 60 });
const originalGear = solved.trace.decisions.find(d => d.row.kind === "gearbox")!.row;
const gears = Array.from({ length: 12 }, (_, index) => ({ ...originalGear, id: `audit-gear-${index}`, brand: "AUDIT TEST", model: `GB-${String(index).padStart(2, "0")}`, attrs: { ...originalGear.attrs, input_shaft_mm: index < 4 ? 100 : 40, weight_kg: 100 + index } }));
const originalCoupling = solved.trace.decisions.find(d => d.section === "2.6")!.row;
const coupling = { ...originalCoupling, id: "audit-coupling", brand: "AUDIT TEST", model: "C-60", attrs: { ...originalCoupling.attrs, max_shaft_dia_mm: 60 } };
const broad = solveSelection(narrowRequest, [...gears, coupling]);
const narrow = solveSelection(narrowRequest, [gears[4], coupling]);
const hookRequest = requestFixture();
hookRequest.specs.hookType = "DIN 15402 Çift Ağız Kanca";
hookRequest.active = ["main", "hookBlock"];
hookRequest.sizeDesigns = true;
const hookResult = solveSelection(hookRequest, catalog);
const diagnostics = {
  staleReportRejected: staleError,
  staleOffer: { offerCapacity: stale.item.groups[0].rows.find(row => row.key === "capacity")?.parts?.main, reportCapacity: input.specs.mainCapacityT, transferredMotorKw: staleMotor?.parts?.power, preservedWarnings: stale.preserved },
  copy: { newItemId: copied.id !== stale.item.id, sameCalculationSourceObject: copied.calculationSource === stale.item.calculationSource, sourceProjectId: copied.calculationSource?.projectId },
  search: { broad: { gear: broad.trace.decisions.find(d => d.row.kind === "gearbox")?.row.model, couplingSelected: broad.trace.decisions.some(d => d.section === "2.6"), missing: broad.trace.issues.filter(i => i.code.startsWith("selection.")) }, narrow: { gear: narrow.trace.decisions.find(d => d.row.kind === "gearbox")?.row.model, couplingSelected: narrow.trace.decisions.some(d => d.section === "2.6"), missing: narrow.trace.issues.filter(i => i.code.startsWith("selection.")) } },
  emptyOffer: { capacity: reportInputFromOfferItem(emptyItem("BOŞ", ["general", "mainHoist"])).input.specs.mainCapacityT, templateCapacity: NEW_WORK_TEMPLATE.specs.mainCapacityT },
  hookType: { requested: hookRequest.specs.hookType, resultingModuleStandard: (hookResult.modules.hookBlock.selections as Record<string, unknown>).hookStandard, selectedHook: hookResult.trace.decisions.find(decision => decision.row.kind === "hook")?.row.model, issues: hookResult.trace.issues.filter(issue => /hook|kanca/i.test(`${issue.code} ${issue.message}`)) },
};
assert.equal(diagnostics.emptyOffer.capacity, null);
assert.equal(diagnostics.copy.sameCalculationSourceObject, false);
assert.equal(diagnostics.search.broad.couplingSelected, true);
assert.equal(diagnostics.search.broad.gear, diagnostics.search.narrow.gear);
assert.equal(diagnostics.hookType.resultingModuleStandard, "DIN 15402");
assert.equal(diagnostics.hookType.selectedHook, undefined);
mkdirSync("tmp/auto-selection", { recursive: true });
writeFileSync("tmp/auto-selection/gap-regressions-verified.json", JSON.stringify(diagnostics, null, 2));
console.log(JSON.stringify(diagnostics, null, 2));
