// Hesap motoru orkestrasyonu.
// Saf fonksiyon: girdiler + seçimler -> tüm modül sonuçları + kontrol özeti.
//
// Vinç topolojisi:
//   Her KALDIRMA grubunun (ana, yardımcı, monoray 1, monoray 2) kendi KANCA
//   BLOĞU ve gerektiğinde kendi ARABA YÜRÜTME grubu vardır. Yardımcı kaldırma
//   ana arabanın üzerinde olabilir (`auxTrolleyMode = "shared"`) ya da kendi
//   arabasında (`"separate"`). Köprü yürütme tektir.
//
// Modüller arası bağımlılıklar (deps) burada otomatik bağlanır:
//   kaldırma -> kendi kanca bloğu ve kendi arabası; ana kaldırma+araba+köprü ->
//   ana kiriş ve başkiriş.
//
// DB/UI bağımlılığı yoktur; revizyonlar sonucu snapshot olarak saklar.

import {
  computeHoistGroup,
  type HoistInputs,
  type HoistSelections,
  type HoistValues,
} from "./modules/hoistGroup";
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
import {
  HOIST_OF_HOOKBLOCK,
  type HoistKey,
  type HookBlockKey,
  type TravelKey,
} from "./presentation/module-family";
import type { AnyCheck, ModuleResult, TechnicalSpecs } from "./types";
import { hasSeparateAuxTrolley, monorailCount } from "./types";

/**
 * Motor sürümü: formül zinciri değiştiğinde yükseltilir.
 * Revizyonlar hangi sürümle hesaplandığını saklar (arşiv yeniden üretilebilirliği).
 * 0.2.0: Faz 2 — kanca bloğu, araba/köprü yürütme, ana kiriş, buruşma, başkiriş.
 * 0.3.0: Çoklu kaldırma topolojisi — her kaldırma grubunun kendi kanca bloğu ve
 *        arabası; ağırlıklar teknik özelliklere taşındı; tahrikli teker sayısı
 *        yürütme grubundan türetilip ana kirişe bağlandı.
 */
export const ENGINE_VERSION = "0.3.0";

export interface HoistModuleInput {
  inputs: HoistInputs;
  selections: HoistSelections;
}
export interface HookBlockModuleInput {
  inputs: HookBlockInputs;
  selections: HookBlockSelections;
}
export interface TravelModuleInput {
  inputs: TravelInputs;
  selections: TravelSelections;
}

export interface CalcInput {
  specs: TechnicalSpecs;
  // Kaldırma grupları
  mainHoist?: HoistModuleInput;
  auxHoist?: HoistModuleInput;
  mono1Hoist?: HoistModuleInput;
  mono2Hoist?: HoistModuleInput;
  // Kanca blokları — her biri aynı adı taşıyan kaldırma grubuna bağlıdır
  hookBlock?: HookBlockModuleInput;
  auxHookBlock?: HookBlockModuleInput;
  mono1HookBlock?: HookBlockModuleInput;
  mono2HookBlock?: HookBlockModuleInput;
  // Yürütme grupları
  trolley?: TravelModuleInput;
  auxTrolley?: TravelModuleInput;
  mono1Trolley?: TravelModuleInput;
  mono2Trolley?: TravelModuleInput;
  bridge?: TravelModuleInput;
  // Taşıyıcı yapı
  girder?: { inputs: GirderInputs; selections: GirderSelections };
  buckling?: { inputs: BucklingInputs };
  endCarriage?: { inputs: EndCarriageInputs; selections: EndCarriageSelections };
}

export interface CalcResult {
  engineVersion: string;
  mainHoist?: ModuleResult<HoistValues>;
  auxHoist?: ModuleResult<HoistValues>;
  mono1Hoist?: ModuleResult<HoistValues>;
  mono2Hoist?: ModuleResult<HoistValues>;
  hookBlock?: ModuleResult<HookBlockValues>;
  auxHookBlock?: ModuleResult<HookBlockValues>;
  mono1HookBlock?: ModuleResult<HookBlockValues>;
  mono2HookBlock?: ModuleResult<HookBlockValues>;
  trolley?: ModuleResult<TravelValues>;
  auxTrolley?: ModuleResult<TravelValues>;
  mono1Trolley?: ModuleResult<TravelValues>;
  mono2Trolley?: ModuleResult<TravelValues>;
  bridge?: ModuleResult<TravelValues>;
  girder?: ModuleResult<GirderValues>;
  buckling?: ModuleResult<BucklingValues>;
  endCarriage?: ModuleResult<EndCarriageValues>;
  /** Tüm modüllerin kontrolleri (pano/özet için düzleştirilmiş) */
  allChecks: AnyCheck[];
  allPass: boolean;
}

/** Kaldırma grubu anahtarı → CalcInput/CalcResult alan adı. */
const HOIST_FIELD: Record<HoistKey, "mainHoist" | "auxHoist" | "mono1Hoist" | "mono2Hoist"> = {
  main: "mainHoist",
  aux: "auxHoist",
  mono1: "mono1Hoist",
  mono2: "mono2Hoist",
};

/** Kanca bloğu / yürütme anahtarları alan adlarıyla birebir aynıdır. */
const HOOKBLOCK_KEYS: readonly HookBlockKey[] = [
  "hookBlock", "auxHookBlock", "mono1HookBlock", "mono2HookBlock",
];
const TRAVEL_KEYS: readonly TravelKey[] = [
  "trolley", "auxTrolley", "mono1Trolley", "mono2Trolley", "bridge",
];

/** Bir yürütme grubu hangi kaldırma grubunun donanımını taşır. */
const HOIST_OF_TRAVEL: Record<TravelKey, HoistKey> = {
  trolley: "main",
  auxTrolley: "aux",
  mono1Trolley: "mono1",
  mono2Trolley: "mono2",
  bridge: "main",
};

/** Kanca donanımı (blok + halat) ağırlığı [t] — kaldırma grubu girdilerinden. */
function hookEquipmentTons(m: HoistModuleInput | undefined): number {
  if (!m) return 0;
  return (m.inputs.hookBlockWeightKg + m.inputs.ropeWeightKg) / 1000;
}

/**
 * Köprünün taşıdığı toplam araba ağırlığı [t].
 *
 * Köprü, üzerindeki BÜTÜN arabaları taşır: ana araba, varsa ayrı yardımcı araba
 * ve monoray arabaları. Tekerlek yükü ve yürütme gücü hesabı hepsinin aynı anda
 * en elverişsiz konumda olduğunu kabul eder — emniyetli taraftır ve monoraylı
 * vinçlerde arabalar zaten birlikte çalışır.
 */
export function bridgeTrolleyWeightT(specs: TechnicalSpecs, active: Set<string>): number {
  let total = specs.mainTrolleyWeightT;
  if (active.has("auxTrolley")) total += specs.auxTrolleyWeightT ?? 0;
  if (active.has("mono1Trolley")) total += specs.mono1TrolleyWeightT ?? 0;
  if (active.has("mono2Trolley")) total += specs.mono2TrolleyWeightT ?? 0;
  return total;
}

/** Bu hesapta yer alan bölümlerin kümesi (girdi durumu mevcut olanlar). */
function presentSet(input: CalcInput): Set<string> {
  const src = input as unknown as Record<string, unknown>;
  const out = new Set<string>();
  for (const key of TRAVEL_KEYS) if (src[key] !== undefined) out.add(key);
  return out;
}

/**
 * Vince göre hangi modüllerin hesaplanacağı. Kapalı bölümler `disabled`
 * kümesiyle dışlanır; topolojiye aykırı bölümler (monoray yokken monoray
 * grupları, paylaşımlı yardımcı arabada ayrı araba) hiç açılmaz.
 */
export function activeModules(
  specs: TechnicalSpecs,
  disabled: readonly string[] = []
): Set<string> {
  const off = new Set(disabled);
  const monos = monorailCount(specs);
  const on = (k: string) => !off.has(k);
  const out = new Set<string>();

  if (on("main")) out.add("main");
  if (out.has("main") && on("hookBlock")) out.add("hookBlock");
  if (on("aux")) out.add("aux");
  if (out.has("aux") && on("auxHookBlock")) out.add("auxHookBlock");
  if (on("trolley")) out.add("trolley");
  if (out.has("aux") && hasSeparateAuxTrolley(specs) && on("auxTrolley")) out.add("auxTrolley");
  for (let i = 1; i <= monos; i += 1) {
    const h = `mono${i}`;
    if (!on(h)) continue;
    out.add(h);
    if (on(`${h}HookBlock`)) out.add(`${h}HookBlock`);
    if (on(`${h}Trolley`)) out.add(`${h}Trolley`);
  }
  if (on("bridge")) out.add("bridge");
  for (const k of ["girder", "buckling", "endCarriage"]) if (on(k)) out.add(k);
  return out;
}

export function runCalc(input: CalcInput): CalcResult {
  const { specs } = input;
  const allChecks: AnyCheck[] = [];
  const push = <T,>(r: ModuleResult<T> | undefined) => {
    if (r) allChecks.push(...r.checks);
    return r;
  };

  const out: CalcResult = {
    engineVersion: ENGINE_VERSION,
    allChecks,
    allPass: true,
  };

  // --- Kaldırma grupları ----------------------------------------------------
  for (const which of ["main", "aux", "mono1", "mono2"] as const) {
    const field = HOIST_FIELD[which];
    const m = input[field];
    if (!m) continue;
    out[field] = push(computeHoistGroup(specs, which, m.inputs, m.selections));
  }

  // --- Kanca blokları: her biri kendi kaldırma grubundan beslenir -----------
  for (const key of HOOKBLOCK_KEYS) {
    const m = input[key];
    if (!m) continue;
    const hoistKey = HOIST_OF_HOOKBLOCK[key];
    const hoistInput = input[HOIST_FIELD[hoistKey]];
    const hoistResult = out[HOIST_FIELD[hoistKey]];
    if (!hoistInput || !hoistResult) continue;
    out[key] = push(
      computeHookBlock(
        specs,
        key,
        m.inputs,
        m.selections,
        hookBlockDepsFromHoist({
          values: hoistResult.values,
          inputs: hoistInput.inputs,
          selections: hoistInput.selections,
        })
      )
    );
  }

  // --- Yürütme grupları -----------------------------------------------------
  // Her araba, taşıdığı kaldırma grubunun kanca donanımını görür; köprü ana
  // arabanın ağırlığıyla (teknik özelliklerden) çalışır.
  const bridgeTrolleyT = bridgeTrolleyWeightT(specs, presentSet(input));
  for (const key of TRAVEL_KEYS) {
    const m = input[key];
    if (!m) continue;
    const hoistKey = HOIST_OF_TRAVEL[key];
    out[key] = push(
      computeTravelGroup(specs, key, m.inputs, m.selections, {
        hookEquipmentT: hookEquipmentTons(input[HOIST_FIELD[hoistKey]] ?? input.mainHoist),
        trolleyWeightT: bridgeTrolleyT,
      })
    );
  }

  // --- Ana kiriş: ana kaldırma + ana araba + köprüden beslenir --------------
  if (input.girder && input.mainHoist && out.trolley && out.bridge && input.trolley && input.bridge) {
    out.girder = push(
      computeMainGirder(specs, input.girder.inputs, input.girder.selections, {
        mainHookBlockWeightKg: input.mainHoist.inputs.hookBlockWeightKg,
        mainRopeWeightKg: input.mainHoist.inputs.ropeWeightKg,
        trolleyWeightT: specs.mainTrolleyWeightT,
        trolleyWheelCount: input.trolley.inputs.wheelCount,
        trolleyDrivenWheels: out.trolley.values.drivenWheels,
        trolleyActualSpeedMpm: out.trolley.values.actualSpeedMpm,
        trolleyAccelTimeS: out.trolley.values.startupTimeS,
        bridgeWeightT: specs.bridgeWeightT,
        bridgeWheelCount: input.bridge.inputs.wheelCount,
        bridgeDrivenWheels: out.bridge.values.drivenWheels,
        bridgeActualSpeedMpm: out.bridge.values.actualSpeedMpm,
        bridgeAccelTimeS: out.bridge.values.startupTimeS,
      })
    );
  }

  out.buckling = push(input.buckling && computeBuckling(input.buckling.inputs));

  // --- Başkiriş: ana kaldırma toplam yükü + köprü ağırlıkları ---------------
  if (input.endCarriage && out.mainHoist) {
    out.endCarriage = push(
      computeEndCarriage(specs, input.endCarriage.inputs, input.endCarriage.selections, {
        mainHoistTotalLoadKg: out.mainHoist.values.totalLoadKg,
        // Başkiriş köprüdeki tüm arabaların ağırlığını taşır.
        trolleyWeightT: bridgeTrolleyT,
        bridgeWeightT: specs.bridgeWeightT,
      })
    );
  }

  out.allPass = allChecks.every((c) => c.pass);
  return out;
}
