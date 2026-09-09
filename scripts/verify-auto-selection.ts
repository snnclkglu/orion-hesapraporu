import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { NEW_WORK_DISABLED_MODULES, NEW_WORK_TEMPLATE } from "../src/lib/calc/defaults";
import { activeModules } from "../src/lib/calc/engine";
import { MODULE_ORDER } from "../src/lib/calc/presentation/module-family";
import { moduleState } from "../src/lib/calc/presentation/module-access";
import type { ModulesState } from "../src/lib/calc/state";
import { solveSelection } from "../src/lib/auto-selection/orchestrator";
import type { EquipmentRow } from "../src/lib/auto-selection/types";

const path = process.argv[2] ?? "tmp/auto-selection/catalog.json";
const rows = JSON.parse(readFileSync(path, "utf8")) as EquipmentRow[];
const active = activeModules(NEW_WORK_TEMPLATE.specs, [...NEW_WORK_DISABLED_MODULES]);
const start = performance.now();
const proposal = solveSelection({
  specs: NEW_WORK_TEMPLATE.specs,
  modules: Object.fromEntries(MODULE_ORDER.map(key => [key, moduleState(NEW_WORK_TEMPLATE, key) ?? { inputs: {}, selections: {} }])) as ModulesState,
  active: MODULE_ORDER.filter(key => active.has(key)), brands: {}, locks: [], sizeDesigns: true, enableStructuralChecks: true, speedTolerancePct: 5,
}, rows, progress => process.stdout.write(`${progress.stage} (${progress.evaluations})\n`));
mkdirSync("tmp/auto-selection", { recursive: true });
writeFileSync("tmp/auto-selection/proposal.json", JSON.stringify(proposal, null, 2));
process.stdout.write(JSON.stringify({ ms: Math.round(performance.now() - start), evaluations: proposal.trace.evaluations, selections: proposal.trace.decisions.map(d => `${d.module} ${d.label}: ${d.row.brand} ${d.row.model}`), issues: proposal.trace.issues }, null, 2));
