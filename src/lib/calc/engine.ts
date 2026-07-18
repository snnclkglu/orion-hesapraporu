// Hesap motoru orkestrasyonu.
// Saf fonksiyon: girdiler + seçimler -> tüm modül sonuçları + kontrol özeti.
// DB/UI bağımlılığı yoktur; revizyonlar sonucu snapshot olarak saklar.

import { computeHoistGroup, type HoistInputs, type HoistSelections } from "./modules/hoistGroup";
import type { AnyCheck, ModuleResult, TechnicalSpecs } from "./types";
import type { HoistValues } from "./modules/hoistGroup";

/**
 * Motor sürümü: formül zinciri değiştiğinde yükseltilir.
 * Revizyonlar hangi sürümle hesaplandığını saklar (arşiv yeniden üretilebilirliği).
 */
export const ENGINE_VERSION = "0.1.0";

export interface CalcInput {
  specs: TechnicalSpecs;
  mainHoist?: { inputs: HoistInputs; selections: HoistSelections };
  auxHoist?: { inputs: HoistInputs; selections: HoistSelections };
  // Faz 2: hookBlock, trolleyTravel, bridgeTravel, mainGirder, buckling, endCarriage
}

export interface CalcResult {
  engineVersion: string;
  mainHoist?: ModuleResult<HoistValues>;
  auxHoist?: ModuleResult<HoistValues>;
  /** Tüm modüllerin kontrolleri (pano/özet için düzleştirilmiş) */
  allChecks: AnyCheck[];
  /** Excel'de karşılığı olan kontrollerin tamamı geçiyor mu */
  allPass: boolean;
}

export function runCalc(input: CalcInput): CalcResult {
  const allChecks: AnyCheck[] = [];

  const mainHoist = input.mainHoist
    ? computeHoistGroup(input.specs, "main", input.mainHoist.inputs, input.mainHoist.selections)
    : undefined;
  if (mainHoist) allChecks.push(...mainHoist.checks);

  const auxHoist = input.auxHoist
    ? computeHoistGroup(input.specs, "aux", input.auxHoist.inputs, input.auxHoist.selections)
    : undefined;
  if (auxHoist) allChecks.push(...auxHoist.checks);

  return {
    engineVersion: ENGINE_VERSION,
    mainHoist,
    auxHoist,
    allChecks,
    allPass: allChecks.every((c) => c.pass),
  };
}
