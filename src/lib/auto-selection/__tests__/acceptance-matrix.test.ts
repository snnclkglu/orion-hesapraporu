import { readFileSync, writeFileSync } from "node:fs";
import { expect, it } from "vitest";
import { NEW_WORK_DISABLED_MODULES, NEW_WORK_TEMPLATE } from "@/lib/calc/defaults";
import { activeModules, runCalc } from "@/lib/calc/engine";
import { isBlocking } from "@/lib/calc/types";
import { MODULE_ORDER } from "@/lib/calc/presentation/module-family";
import { requestFixture } from "./fixtures";
import { solveSelection } from "../orchestrator";
import { selectionCalcInput } from "../solver";
import { catalogCompatible } from "../compatibility";
import { selectionCatalogFilter } from "../catalog-scope";
import { contentHash, type EquipmentRow, type SelectionRequest } from "../types";

const cases: { name: string; change: (request: SelectionRequest) => void }[] = [
  { name: "3t-M4", change: r => Object.assign(r.specs, { mainCapacityT: 3.2, spanM: 12, mainLiftSpeedMpm: 6, hoistMechanismClass: "M4", hoistUsageClass: "T3" }) },
  { name: "25t-M7", change: r => Object.assign(r.specs, { mainCapacityT: 25, spanM: 25, mainLiftSpeedMpm: 3, hoistMechanismClass: "M7", hoistUsageClass: "T7", hoistBrakeType: "Eldro Fren" }) },
  { name: "50t-M8", change: r => Object.assign(r.specs, { mainCapacityT: 50, spanM: 30, mainLiftSpeedMpm: 2, hoistMechanismClass: "M8", hoistUsageClass: "T8", hookType: "DIN 15402 Çift Ağız Kanca", hoistBrakeType: "Eldro Fren" }) },
  { name: "marka-GAMAK", change: r => { r.brands = { motor: "GAMAK", hoistBrake: "Dereli", travelBrake: "Dereli" }; } },
  { name: "ikiz", change: r => { r.specs.mainHoistEquipmentArrangement = "twin"; } },
  { name: "acik-portal", change: r => { r.craneType = "Portal Vinç"; r.specs.installationEnvironment = "outdoor"; } },
];
// Üretici/mühendis kabulü değildir: farklı teknik taleplerde arama ve kapsam
// sözleşmesinin sabit gerçek katalog snapshot'ıyla tekrarlanabilir denetimidir.
it.skipIf(!process.env.AUTO_SELECTION_CATALOG_FILE).each(cases)("kabul matrisi · $name", ({ name, change }) => {
  const all = JSON.parse(readFileSync(process.env.AUTO_SELECTION_CATALOG_FILE!, "utf8")) as EquipmentRow[];
  const request = requestFixture(); const active = activeModules(NEW_WORK_TEMPLATE.specs, [...NEW_WORK_DISABLED_MODULES]);
  request.active = MODULE_ORDER.filter(key => active.has(key)); request.sizeDesigns = true; request.enableStructuralChecks = true; change(request);
  const before = contentHash(request); const filter = selectionCatalogFilter(request);
  const rows = all.filter(row => filter.some(f => f.kind === row.kind && (!f.application || f.application === row.attrs.application) && (f.brands === null || f.brands.includes(row.brand))));
  const start = performance.now(); const proposal = solveSelection(request, rows); const ms = Math.round(performance.now() - start);
  const input = selectionCalcInput({ ...request, specs: proposal.specs, active: proposal.active! }, proposal.modules);
  const result = runCalc(input);
  expect(contentHash(request)).toBe(before);
  expect(proposal.trace.decisions.length).toBeGreaterThan(10);
  expect(proposal.trace.evaluations).toBeLessThan(73000);
  expect(proposal.specs.mainCapacityT).toBe(request.specs.mainCapacityT);
  for (const decision of proposal.trace.decisions) {
    if (decision.section === "safety") continue;
    expect(catalogCompatible({ ...request, specs: proposal.specs }, proposal.modules, decision.module, decision.section, decision.row), decision.variantKey).toBe(true);
    if (decision.row.kind === "motor" && request.brands.motor) expect(decision.row.brand).toBe(request.brands.motor);
    if (decision.row.kind === "hook") expect(decision.row.model).toContain(name === "50t-M8" ? "15402" : "15401");
  }
  if (name === "acik-portal") expect(proposal.trace.issues.map(issue => issue.code)).toEqual(expect.arrayContaining(["scope.gantry", "scope.wind"]));
  if (name === "ikiz") expect(proposal.trace.issues.find(issue => issue.code === "scope.topology.main")?.state).toBe("missing");
  if (result.allChecks.some(isBlocking) || proposal.trace.issues.some(issue => issue.state !== "review")) expect(proposal.trace.status).toBe("incomplete");
  writeFileSync(`tmp/auto-selection/matrix-${name}.json`, JSON.stringify({ name, ms, rows: rows.length, bytes: Buffer.byteLength(JSON.stringify(rows)), evaluations: proposal.trace.evaluations,
    selections: proposal.trace.decisions.map(d => ({ module: d.module, section: d.section, brand: d.row.brand, model: d.row.model })), blocking: result.allChecks.filter(isBlocking), issues: proposal.trace.issues }, null, 2));
}, 120000);
