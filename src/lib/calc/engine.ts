// Hesap motoru orkestrasyonu.
// Saf fonksiyon: girdiler + seçimler -> tüm modül sonuçları + kontrol özeti.
// Modüller arası bağımlılıklar (deps) burada otomatik bağlanır:
//   ana kaldırma -> kanca bloğu, araba; araba -> köprü; araba+köprü -> ana kiriş, başkiriş.
// DB/UI bağımlılığı yoktur; revizyonlar sonucu snapshot olarak saklar.

import { computeHoistGroup, type HoistInputs, type HoistSelections, type HoistValues } from "./modules/hoistGroup";
import {
  computeHookBlock,
  hookBlockDepsFromHoist,
  type HookBlockInputs,
  type HookBlockSelections,
  type HookBlockValues,
} from "./modules/hookBlock";
import {
  computeTravelGroup,
  type TravelInputs,
  type TravelSelections,
  type TravelValues,
} from "./modules/travelGroup";
import {
  computeMainGirder,
  type GirderInputs,
  type GirderSelections,
  type GirderValues,
} from "./modules/mainGirder";
import { computeBuckling, type BucklingInputs, type BucklingValues } from "./modules/buckling";
import {
  computeEndCarriage,
  type EndCarriageInputs,
  type EndCarriageSelections,
  type EndCarriageValues,
} from "./modules/endCarriage";
import type { AnyCheck, ModuleResult, TechnicalSpecs } from "./types";

/**
 * Motor sürümü: formül zinciri değiştiğinde yükseltilir.
 * Revizyonlar hangi sürümle hesaplandığını saklar (arşiv yeniden üretilebilirliği).
 * 0.2.0: Faz 2 — kanca bloğu, araba/köprü yürütme, ana kiriş, buruşma, başkiriş.
 */
export const ENGINE_VERSION = "0.2.0";

export interface CalcInput {
  specs: TechnicalSpecs;
  mainHoist?: { inputs: HoistInputs; selections: HoistSelections };
  auxHoist?: { inputs: HoistInputs; selections: HoistSelections };
  hookBlock?: { inputs: HookBlockInputs; selections: HookBlockSelections };
  trolley?: { inputs: TravelInputs; selections: TravelSelections };
  bridge?: { inputs: TravelInputs; selections: TravelSelections };
  girder?: { inputs: GirderInputs; selections: GirderSelections };
  buckling?: { inputs: BucklingInputs };
  endCarriage?: { inputs: EndCarriageInputs; selections: EndCarriageSelections };
}

export interface CalcResult {
  engineVersion: string;
  mainHoist?: ModuleResult<HoistValues>;
  auxHoist?: ModuleResult<HoistValues>;
  hookBlock?: ModuleResult<HookBlockValues>;
  trolley?: ModuleResult<TravelValues>;
  bridge?: ModuleResult<TravelValues>;
  girder?: ModuleResult<GirderValues>;
  buckling?: ModuleResult<BucklingValues>;
  endCarriage?: ModuleResult<EndCarriageValues>;
  /** Tüm modüllerin kontrolleri (pano/özet için düzleştirilmiş) */
  allChecks: AnyCheck[];
  allPass: boolean;
}

const num = (v: number | string | undefined, fallback: number): number =>
  typeof v === "number" ? v : fallback;

export function runCalc(input: CalcInput): CalcResult {
  const { specs } = input;
  const allChecks: AnyCheck[] = [];
  const push = <T,>(r: ModuleResult<T> | undefined) => {
    if (r) allChecks.push(...r.checks);
    return r;
  };

  const mainHoist = push(
    input.mainHoist &&
      computeHoistGroup(specs, "main", input.mainHoist.inputs, input.mainHoist.selections)
  );
  const auxHoist = push(
    input.auxHoist &&
      computeHoistGroup(specs, "aux", input.auxHoist.inputs, input.auxHoist.selections)
  );

  // Kanca bloğu: ana kaldırma grubundan beslenir
  const hookBlock = push(
    input.hookBlock && mainHoist && input.mainHoist
      ? computeHookBlock(
          specs,
          input.hookBlock.inputs,
          input.hookBlock.selections,
          hookBlockDepsFromHoist({
            values: mainHoist.values,
            inputs: input.mainHoist.inputs,
            selections: input.mainHoist.selections,
          })
        )
      : undefined
  );

  // Araba: kanca donanımı ağırlığı ana kaldırmadan 
  const hookEquipmentT = input.mainHoist
    ? (input.mainHoist.inputs.hookBlockWeightKg + input.mainHoist.inputs.ropeWeightKg) / 1000
    : 3.5;
  const trolley = push(
    input.trolley &&
      computeTravelGroup(specs, "trolley", input.trolley.inputs, input.trolley.selections, {
        hookEquipmentT,
        trolleyWeightT: input.trolley.inputs.trolleyWeightT,
      })
  );

  // Köprü: araba ağırlığı araba modülünden 
  const bridge = push(
    input.bridge &&
      computeTravelGroup(specs, "bridge", input.bridge.inputs, input.bridge.selections, {
        hookEquipmentT,
        trolleyWeightT: input.trolley?.inputs.trolleyWeightT ?? input.bridge.inputs.trolleyWeightT,
      })
  );

  // Ana kiriş: ana kaldırma + araba + köprüden beslenir 
  const girder = push(
    input.girder && input.mainHoist && input.trolley && input.bridge && trolley && bridge
      ? computeMainGirder(specs, input.girder.inputs, input.girder.selections, {
          mainHookBlockWeightKg: input.mainHoist.inputs.hookBlockWeightKg,
          mainRopeWeightKg: input.mainHoist.inputs.ropeWeightKg,
          trolleyWeightT: input.trolley.inputs.trolleyWeightT,
          trolleyWheelCount: input.trolley.inputs.wheelCount,
          trolleyActualSpeedMpm: trolley.values.actualSpeedMpm,
          trolleyAccelTimeS: trolley.values.startupTimeS,
          bridgeGirdersWeightT: input.bridge.inputs.bridgeWeightT,
          bridgeEndCarriagesWeightT: input.bridge.inputs.otherWeightsT,
          bridgeWheelCount: input.bridge.inputs.wheelCount,
          bridgeActualSpeedMpm: bridge.values.actualSpeedMpm,
          bridgeAccelTimeS: bridge.values.startupTimeS,
        })
      : undefined
  );

  const buckling = push(input.buckling && computeBuckling(input.buckling.inputs));

  // Başkiriş: ana kaldırma toplam yükü + köprü ağırlıkları 
  const endCarriage = push(
    input.endCarriage && mainHoist && input.trolley && input.bridge
      ? computeEndCarriage(specs, input.endCarriage.inputs, input.endCarriage.selections, {
          mainHoistTotalLoadKg: mainHoist.values.totalLoadKg,
          trolleyWeightT: input.trolley.inputs.trolleyWeightT,
          bridgeGirdersWeightT: input.bridge.inputs.bridgeWeightT,
          bridgeEndCarriagesWeightT: input.bridge.inputs.otherWeightsT,
        })
      : undefined
  );

  return {
    engineVersion: ENGINE_VERSION,
    mainHoist,
    auxHoist,
    hookBlock,
    trolley,
    bridge,
    girder,
    buckling,
    endCarriage,
    allChecks,
    allPass: allChecks.every((c) => c.pass),
  };
}
