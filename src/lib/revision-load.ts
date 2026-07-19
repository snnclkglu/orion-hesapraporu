// Revizyon snapshot'ından (inputs/selections jsonb) CalcInput kurar.
// Boş alanlar V5 şablonuyla doldurulur — editör, PDF ve Excel çıktıları
// aynı yükleyiciyi kullanır.

import { V5_TEMPLATE } from "@/lib/calc/defaults";
import type { CalcInput } from "@/lib/calc/engine";
import type { HoistInputs, HoistSelections } from "@/lib/calc/modules/hoistGroup";
import type { HookBlockInputs, HookBlockSelections } from "@/lib/calc/modules/hookBlock";
import type { TravelInputs, TravelSelections } from "@/lib/calc/modules/travelGroup";
import type { GirderInputs, GirderSelections } from "@/lib/calc/modules/mainGirder";
import type { BucklingInputs } from "@/lib/calc/modules/buckling";
import type { EndCarriageInputs, EndCarriageSelections } from "@/lib/calc/modules/endCarriage";
import type { TechnicalSpecs } from "@/lib/calc/types";

export interface RevisionInputsJson {
  specs?: TechnicalSpecs;
  mainHoist?: HoistInputs | null;
  auxHoist?: HoistInputs | null;
  hookBlock?: HookBlockInputs | null;
  trolley?: TravelInputs | null;
  bridge?: TravelInputs | null;
  girder?: GirderInputs | null;
  buckling?: BucklingInputs | null;
  endCarriage?: EndCarriageInputs | null;
}

export interface RevisionSelectionsJson {
  mainHoist?: HoistSelections | null;
  auxHoist?: HoistSelections | null;
  hookBlock?: HookBlockSelections | null;
  trolley?: TravelSelections | null;
  bridge?: TravelSelections | null;
  girder?: GirderSelections | null;
  endCarriage?: EndCarriageSelections | null;
  alts?: Record<string, { active: number; options: Record<string, unknown>[] }>;
}

export function calcInputFromRevision(
  inputs: RevisionInputsJson | null,
  selections: RevisionSelectionsJson | null
): CalcInput {
  return {
    specs: inputs?.specs ?? V5_TEMPLATE.specs,
    mainHoist: {
      inputs: inputs?.mainHoist ?? V5_TEMPLATE.mainHoist!.inputs,
      selections: selections?.mainHoist ?? V5_TEMPLATE.mainHoist!.selections,
    },
    auxHoist: {
      inputs: inputs?.auxHoist ?? V5_TEMPLATE.auxHoist!.inputs,
      selections: selections?.auxHoist ?? V5_TEMPLATE.auxHoist!.selections,
    },
    hookBlock: {
      inputs: inputs?.hookBlock ?? V5_TEMPLATE.hookBlock!.inputs,
      selections: selections?.hookBlock ?? V5_TEMPLATE.hookBlock!.selections,
    },
    trolley: {
      inputs: inputs?.trolley ?? V5_TEMPLATE.trolley!.inputs,
      selections: selections?.trolley ?? V5_TEMPLATE.trolley!.selections,
    },
    bridge: {
      inputs: inputs?.bridge ?? V5_TEMPLATE.bridge!.inputs,
      selections: selections?.bridge ?? V5_TEMPLATE.bridge!.selections,
    },
    girder: {
      inputs: inputs?.girder ?? V5_TEMPLATE.girder!.inputs,
      selections: selections?.girder ?? V5_TEMPLATE.girder!.selections,
    },
    buckling: {
      inputs: inputs?.buckling ?? V5_TEMPLATE.buckling!.inputs,
    },
    endCarriage: {
      inputs: inputs?.endCarriage ?? V5_TEMPLATE.endCarriage!.inputs,
      selections: selections?.endCarriage ?? V5_TEMPLATE.endCarriage!.selections,
    },
  };
}
