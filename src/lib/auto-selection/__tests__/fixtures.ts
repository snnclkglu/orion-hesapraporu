import { NEW_WORK_TEMPLATE } from "@/lib/calc/defaults";
import { MODULE_ORDER } from "@/lib/calc/presentation/module-family";
import { moduleState } from "@/lib/calc/presentation/module-access";
import type { ModulesState } from "@/lib/calc/state";
import type { SelectionRequest } from "../types";

export function requestFixture(): SelectionRequest {
  return { specs: structuredClone(NEW_WORK_TEMPLATE.specs), modules: Object.fromEntries(MODULE_ORDER.map(key => [key, structuredClone(moduleState(NEW_WORK_TEMPLATE, key) ?? { inputs: {}, selections: {} })])) as ModulesState, active: ["main"], brands: {}, locks: [], sizeDesigns: false, speedTolerancePct: 5 };
}
