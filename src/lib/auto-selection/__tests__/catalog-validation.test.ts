import { readFileSync, writeFileSync } from "node:fs";
import { it, expect } from "vitest";
import { activeModules, runCalc } from "@/lib/calc/engine";
import { isBlocking } from "@/lib/calc/types";
import { NEW_WORK_DISABLED_MODULES, NEW_WORK_TEMPLATE } from "@/lib/calc/defaults";
import { MODULE_ORDER } from "@/lib/calc/presentation/module-family";
import { moduleState } from "@/lib/calc/presentation/module-access";
import type { ModulesState } from "@/lib/calc/state";
import { solveSelection } from "../orchestrator";
import type { EquipmentRow } from "../types";
import { selectionCalcInput } from "../solver";
import { readSelectionTrace } from "../trace";

// Canlı veritabanına yazmaz. İsteğe bağlı, sabit katalog snapshot'ıyla gölge çalışma.
it.skipIf(!process.env.AUTO_SELECTION_CATALOG_FILE).each(["default", "eldro"])("gerçek katalogla bağlı seçim ve tamlık denetimi: %s", scenario => {
  const rows = JSON.parse(readFileSync(process.env.AUTO_SELECTION_CATALOG_FILE!, "utf8")) as EquipmentRow[];
  const active = activeModules(NEW_WORK_TEMPLATE.specs, [...NEW_WORK_DISABLED_MODULES]);
  const start = performance.now();
  const specs = { ...NEW_WORK_TEMPLATE.specs, ...(scenario === "eldro" ? { hoistBrakeType: "Eldro Fren" } : {}) };
  const proposal = solveSelection({ specs,
    modules: Object.fromEntries(MODULE_ORDER.map(key => [key, moduleState(NEW_WORK_TEMPLATE, key) ?? { inputs: {}, selections: {} }])) as ModulesState,
    active: MODULE_ORDER.filter(key => active.has(key)), brands: {}, locks: [], sizeDesigns: true, enableStructuralChecks: true, speedTolerancePct: 5,
  }, rows);
  const ms = Math.round(performance.now() - start);
  const result = runCalc(selectionCalcInput({ specs: proposal.specs, active: proposal.active! }, proposal.modules));
  writeFileSync(`tmp/auto-selection/proposal-${scenario}.json`, JSON.stringify(proposal, null, 2));
  writeFileSync(`tmp/auto-selection/measurement-${scenario}.json`, JSON.stringify({ ms, rows: rows.length, evaluations: proposal.trace.evaluations, selections: proposal.trace.decisions.length, blocking: result.allChecks.filter(isBlocking), issues: proposal.trace.issues }, null, 2));
  expect(proposal.trace.decisions.length).toBeGreaterThan(0);
  expect(proposal.trace.evaluations).toBeLessThan(73000);
  expect(readSelectionTrace(JSON.parse(JSON.stringify(proposal.trace)))).toBeDefined();
  const byId = new Map(rows.map(row => [row.id, row]));
  for (const decision of proposal.trace.decisions) if (!decision.row.id.startsWith("sibre:")) expect(byId.get(decision.row.id)).toEqual(decision.row);
  if (scenario === "eldro") expect(proposal.trace.decisions.find(decision => decision.module === "main" && decision.section === "2.5")?.row.attrs.brake_type).toBe("drum");
  if (proposal.trace.issues.some(issue => issue.state !== "review")) expect(proposal.trace.status).toBe("incomplete");
}, 120000);
