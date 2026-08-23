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
  type GirderDeps,
  type GirderInputs,
  type GirderSelections,
  type GirderValues,
  type GirderWhich,
} from "./modules/mainGirder";
import {
  computeWheelLoads,
  wheelLoadDepsFrom,
  type WheelLoadInputs,
  type WheelLoadSelections,
  type WheelLoadValues,
} from "./modules/wheelLoads";
import {
  bucklingDepsFrom,
  computeBuckling,
  type BucklingInputs,
  type BucklingValues,
} from "./modules/buckling";
import {
  computeEndCarriage,
  type EndCarriageInputs,
  type EndCarriageSelections,
  type EndCarriageValues,
} from "./modules/endCarriage";
import {
  cabinModuleApplies,
  computeCabin,
  type CabinDeps,
  type CabinInputs,
  type CabinSelections,
  type CabinValues,
} from "./modules/cabin";
import { driveGroupLossKw, panelHeatKw } from "./drive-losses";
import {
  HOIST_OF_HOOKBLOCK,
  MODULE_ORDER,
  MODULE_PARENT,
  isRequiredModule,
  type HoistKey,
  type HookBlockKey,
  type ModuleKey,
  type TravelKey,
} from "./presentation/module-family";
import type { AnyCheck, ModuleResult, TechnicalSpecs } from "./types";
import {
  girdersInBridge,
  hasSecondGirder,
  hasSeparateAuxTrolley,
  hookBlockLoadShare,
  monorailCount,
} from "./types";

/**
 * Motor sürümü: formül zinciri değiştiğinde yükseltilir.
 * Revizyonlar hangi sürümle hesaplandığını saklar (arşiv yeniden üretilebilirliği).
 * 0.2.0: Faz 2 — kanca bloğu, araba/köprü yürütme, ana kiriş, buruşma, başkiriş.
 * 0.3.0: Çoklu kaldırma topolojisi — her kaldırma grubunun kendi kanca bloğu ve
 *        arabası; ağırlıklar teknik özelliklere taşındı; tahrikli teker sayısı
 *        yürütme grubundan türetilip ana kirişe bağlandı.
 * 0.4.0: Teker yükleri bölümü — yol kirişine aktarılan düşey/enine/boyuna
 *        kuvvetler, FEM Kitapçık 9 md. 9.3 dinamik katsayısı ve md. 9.4.1
 *        savrulma modeli.
 */
export const ENGINE_VERSION = "0.4.0";

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
  // Yol kirişine aktarılan kuvvetler
  wheelLoads?: { inputs: WheelLoadInputs; selections: WheelLoadSelections };
  // Taşıyıcı yapı
  girder?: { inputs: GirderInputs; selections: GirderSelections };
  /** Dört kirişli köprünün İKİNCİ ana kiriş takımı (yardımcı kaldırmayı taşır) */
  girder2?: { inputs: GirderInputs; selections: GirderSelections };
  buckling?: { inputs: BucklingInputs };
  endCarriage?: { inputs: EndCarriageInputs; selections: EndCarriageSelections };
  // Kabin ve elektrik odası (klima katalog seçimi dâhil)
  cabin?: { inputs: CabinInputs; selections: CabinSelections };
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
  wheelLoads?: ModuleResult<WheelLoadValues>;
  girder?: ModuleResult<GirderValues>;
  girder2?: ModuleResult<GirderValues>;
  buckling?: ModuleResult<BucklingValues>;
  endCarriage?: ModuleResult<EndCarriageValues>;
  cabin?: ModuleResult<CabinValues>;
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

/**
 * Köprü yürütme motor hesabında taşınan arabaların hareket eden toplam ağırlığı
 * W [t]. Bu, yalnız araba gövdelerinin toplamı değildir: her aktif arabanın
 * kapasitesi, kanca/halat donanımı ve kendi gövde ağırlığı dahildir.
 */
export function bridgeMovingTrolleyWeightT(specs: TechnicalSpecs, input: CalcInput): number {
  const active = presentSet(input);
  const movingWeight = (
    capacityT: number | undefined,
    trolleyWeightT: number | undefined,
    hoist: HoistModuleInput | undefined
  ) => (capacityT ?? 0) + (trolleyWeightT ?? 0) + hookEquipmentTons(hoist);

  // Ana araba köprü üzerinde her zaman bulunur; kendi yürütme bölümü kapalı
  // olsa bile köprü motorunun taşıdığı kütleden çıkarılamaz.
  let total = movingWeight(specs.mainCapacityT, specs.mainTrolleyWeightT, input.mainHoist);
  if (active.has("auxTrolley") && specs.auxTrolleyMode === "separate") {
    total += movingWeight(specs.auxCapacityT, specs.auxTrolleyWeightT, input.auxHoist);
  }
  if (active.has("mono1Trolley") && (specs.monorailCount ?? 0) >= 1) {
    total += movingWeight(specs.mono1CapacityT, specs.mono1TrolleyWeightT, input.mono1Hoist);
  }
  if (active.has("mono2Trolley") && (specs.monorailCount ?? 0) >= 2) {
    total += movingWeight(specs.mono2CapacityT, specs.mono2TrolleyWeightT, input.mono2Hoist);
  }
  return total;
}

/**
 * Bir ana kiriş takımının bağımlılıkları — HANGİ kaldırma grubunun ve HANGİ
 * arabanın yükünü taşıdığı BURADA kurulur, modülün içinde değil.
 *
 * - `girder`  : ANA kaldırma + ana araba (klasik çift kirişli köprü)
 * - `girder2` : YARDIMCI kaldırma + (varsa) ayrı yardımcı araba
 *               (kullanıcı kararı 15.08.2026, dört kirişli / şarj-döküm vinci)
 *
 * Yardımcı kaldırmanın ayrı bir arabası yoksa (paylaşımlı) ikinci kiriş yine
 * ana arabanın teker ve hız verileriyle hesaplanır: araba fiziken oradadır,
 * yalnız üzerinde iki kaldırma grubu vardır.
 *
 * KÖPRÜ ORTAKTIR: teker adedi, hız, ivmelenme süresi ve toplam ağırlık her iki
 * takımda da aynıdır — köprü tektir. Ayrışan tek şey ölü yük PAYIdır
 * (`girdersInBridge`).
 */
export function girderDepsFor(
  specs: TechnicalSpecs,
  which: GirderWhich,
  input: CalcInput,
  result: CalcResult
): GirderDeps | undefined {
  const bridge = input.bridge;
  const bridgeRes = result.bridge;
  if (!bridge || !bridgeRes) return undefined;

  const ikinci = which === "girder2";
  // İkinci takım yardımcı kaldırmayı taşır; yardımcı kaldırma bölümü kapalıysa
  // (ya da hiç yoksa) hesap ana kaldırmanın verileriyle koşar — sessizce sıfır
  // yük varsaymak, kirişi olmayan bir yükle boyutlandırmak olurdu.
  const hoistInput = ikinci ? input.auxHoist ?? input.mainHoist : input.mainHoist;
  if (!hoistInput) return undefined;
  const capacityT = ikinci
    ? (input.auxHoist ? specs.auxCapacityT : specs.mainCapacityT)
    : specs.mainCapacityT;
  const liftSpeedMpm = ikinci
    ? (input.auxHoist ? specs.auxLiftSpeedMpm : specs.mainLiftSpeedMpm)
    : specs.mainLiftSpeedMpm;

  const useAuxTrolley = ikinci && input.auxTrolley !== undefined && hasSeparateAuxTrolley(specs);
  const trolleyInput = useAuxTrolley ? input.auxTrolley! : input.trolley;
  const trolleyRes = useAuxTrolley ? result.auxTrolley : result.trolley;
  if (!trolleyInput || !trolleyRes) return undefined;
  const trolleyWeightT = useAuxTrolley
    ? specs.auxTrolleyWeightT ?? specs.mainTrolleyWeightT
    : specs.mainTrolleyWeightT;

  return {
    hoistLoadKg: capacityT * 1000,
    liftSpeedMpm,
    hoistDrumRpm: (ikinci ? result.auxHoist ?? result.mainHoist : result.mainHoist)
      ?.values.drumRpm ?? 0,
    girdersInBridge: girdersInBridge(specs),
    mainHookBlockWeightKg: hoistInput.inputs.hookBlockWeightKg,
    mainRopeWeightKg: hoistInput.inputs.ropeWeightKg,
    trolleyWeightT,
    trolleyWheelCount: trolleyInput.inputs.wheelCount,
    trolleyDrivenWheels: trolleyRes.values.drivenWheels,
    trolleyActualSpeedMpm: trolleyRes.values.actualSpeedMpm,
    trolleyAccelTimeS: trolleyRes.values.startupTimeS,
    bridgeWeightT: specs.bridgeWeightT,
    bridgeWheelCount: bridge.inputs.wheelCount,
    bridgeDrivenWheels: bridgeRes.values.drivenWheels,
    bridgeActualSpeedMpm: bridgeRes.values.actualSpeedMpm,
    bridgeAccelTimeS: bridgeRes.values.startupTimeS,
    // Ray ana kirişin üstündedir → ARABA rayı (köprü rayı yol kirişinde)
    trolleyRailCode: trolleyInput.selections.railCode,
  };
}

/** Bu hesapta yer alan bölümlerin kümesi (girdi durumu mevcut olanlar). */
function presentSet(input: CalcInput): Set<string> {
  const src = input as unknown as Record<string, unknown>;
  const out = new Set<string>();
  for (const key of TRAVEL_KEYS) if (src[key] !== undefined) out.add(key);
  return out;
}

/**
 * Bölüm, vincin KONFİGÜRASYONUNA göre hiç var olabilir mi?
 *
 * Kullanıcının aç/kapa tercihinden bağımsız YAPISAL uygunluk: monoray yokken
 * monoray grupları, paylaşımlı yardımcı arabada ayrı araba, iki kirişli
 * köprüde ikinci kiriş takımı hiç açılmaz. Kural burada — saf çekirdekte —
 * durur; editör onu `module-adapters.ts` üzerinden AYNI yerden okur (iki
 * kopya, kutucuğun ekranda görünüp hesaba girmemesinin en kısa yoluydu).
 */
export function moduleAllowedByConfig(specs: TechnicalSpecs, key: ModuleKey): boolean {
  const monos = monorailCount(specs);
  switch (key) {
    case "auxTrolley":
      return hasSeparateAuxTrolley(specs);
    case "mono1":
    case "mono1HookBlock":
    case "mono1Trolley":
      return monos >= 1;
    case "mono2":
    case "mono2HookBlock":
    case "mono2Trolley":
      return monos >= 2;
    // İkinci ana kiriş takımı yalnız DÖRT KİRİŞLİ köprüde vardır.
    case "girder2":
      return hasSecondGirder(specs);
    // Kabin ve elektrik odası bölümü ancak vinçte operatör kabini ya da bir
    // elektrik yerleşimi (oda / pano) varsa vardır — ikisi de yoksa boş bir
    // bölüm olurdu.
    case "cabin":
      return cabinModuleApplies(specs);
    default:
      return true;
  }
}

/**
 * Vince göre hangi modüllerin hesaplanacağı.
 *
 * Üç kapı sırayla uygulanır ve HEPSİ tek bir döngüdedir:
 *   1. Kullanıcının kapattıkları (`disabled`) — `REQUIRED_MODULE_KEYS`
 *      dışındaki her bölüm kapatılabilir.
 *   2. Vinç konfigürasyonunun izin verdikleri (`moduleAllowedByConfig`).
 *   3. ÜST bölümü açık olanlar (`MODULE_PARENT`) — üst kapalıysa alt bölümün
 *      hesabı zaten koşamaz (bkz. `girderDepsFor`, teker yükleri).
 *
 * Bağlılık zinciri `MODULE_ORDER` sırasında çözülür: üst bölüm alt bölümden
 * ÖNCE gelir, o yüzden tek geçiş yeter. Eskiden bu üç kapı elle yazılmış bir
 * if merdiveniydi ve yeni bir bağ (köprü → ana kiriş) eklemek merdivenin
 * ortasına dokunmayı gerektiriyordu.
 */
export function activeModules(
  specs: TechnicalSpecs,
  disabled: readonly string[] = []
): Set<string> {
  const off = new Set(disabled);
  const out = new Set<string>();
  for (const key of MODULE_ORDER) {
    // Ana kaldırma ve ana araba kapatılamaz: bozuk bir kayıt onları kapalı
    // gösterse bile hesap onlarsız anlamsızdır (bkz. REQUIRED_MODULE_KEYS).
    if (off.has(key) && !isRequiredModule(key)) continue;
    if (!moduleAllowedByConfig(specs, key)) continue;
    const parent = MODULE_PARENT[key];
    if (parent && !out.has(parent)) continue;
    out.add(key);
  }
  return out;
}

/**
 * Kabin bölümünün pano ısısı girdisi: vincin SEÇİLMİŞ motorlarından türetilir.
 *
 * Mühendisten sürücü gücü ayrıca istenmez — vinç tahrikinde sürücü ağır hizmet
 * sütunundan, yani motorun anma gücüne göre bir büyük gövdeden seçilir ve ABB
 * katalogu her gövdenin atık ısısını yayımlar (bkz. `drive-losses.ts`).
 * Yalnız hesaba GİREN (kapatılmamış) bölümlerin motorları sayılır.
 */
export function cabinDepsFrom(input: CalcInput): CabinDeps {
  let installedKw = 0;
  let inverterLossKw = 0;
  const add = (m: { selections: { motorPowerKw: number; motorCount: number } } | undefined) => {
    if (!m) return;
    const p = m.selections.motorPowerKw;
    const n = m.selections.motorCount;
    if (!Number.isFinite(p) || p <= 0) return;
    const count = Number.isFinite(n) && n > 0 ? Math.floor(n) : 1;
    installedKw += p * count;
    inverterLossKw += driveGroupLossKw(p, count);
  };
  for (const which of ["main", "aux", "mono1", "mono2"] as const) add(input[HOIST_FIELD[which]]);
  for (const key of TRAVEL_KEYS) add(input[key]);
  return {
    installedDrivePowerKw: installedKw,
    panelHeatKw: panelHeatKw(inverterLossKw),
  };
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
        }, hookBlockLoadShare(specs, hoistKey))
      )
    );
  }

  // --- Yürütme grupları -----------------------------------------------------
  // Her araba, taşıdığı kaldırma grubunun kanca donanımını görür; köprü ana
  // arabanın ağırlığıyla (teknik özelliklerden) çalışır.
  const bridgeTrolleyT = bridgeTrolleyWeightT(specs, presentSet(input));
  const bridgeMovingTrolleyT = bridgeMovingTrolleyWeightT(specs, input);
  for (const key of TRAVEL_KEYS) {
    const m = input[key];
    if (!m) continue;
    const hoistKey = HOIST_OF_TRAVEL[key];
    out[key] = push(
      computeTravelGroup(specs, key, m.inputs, m.selections, {
        hookEquipmentT: hookEquipmentTons(input[HOIST_FIELD[hoistKey]] ?? input.mainHoist),
        trolleyWeightT: bridgeTrolleyT,
        bridgeMovingTrolleyWeightT: bridgeMovingTrolleyT,
      })
    );
  }

  // --- Teker yükleri: köprü yürütme + ana kaldırmadan beslenir -------------
  if (input.wheelLoads && input.bridge && out.bridge && out.mainHoist) {
    out.wheelLoads = push(
      computeWheelLoads(
        specs,
        input.wheelLoads.inputs,
        input.wheelLoads.selections,
        wheelLoadDepsFrom({
          bridgeWheelCount: input.bridge.inputs.wheelCount,
          bridgeDrivenWheels: out.bridge.values.drivenWheels,
          bridgeActualSpeedMpm: out.bridge.values.actualSpeedMpm,
          bridgeAccelerationMs2: input.bridge.inputs.accelerationMs2,
          bridgeMinApproachM: input.bridge.inputs.minApproachM,
          bridgeRailCode: input.bridge.selections.railCode,
          bridgeBufferForceKn: out.bridge.values.bufferForceKn,
          mainHoistTotalLoadKg: out.mainHoist.values.totalLoadKg,
          trolleyWeightT: bridgeTrolleyT,
          bridgeWeightT: specs.bridgeWeightT,
        })
      )
    );
  }

  // --- Ana kiriş takımları --------------------------------------------------
  // Bir ya da iki takım: `girder` ana kaldırmayı, `girder2` (dört kirişli
  // köprüde) yardımcı kaldırmayı taşır. Bağımlılıklar tek yerde kurulur
  // (`girderDepsFor`) — iki takım için iki ayrı bağlama mantığı yazılmaz.
  for (const key of ["girder", "girder2"] as const) {
    const m = input[key];
    if (!m) continue;
    const deps = girderDepsFor(specs, key, input, out);
    if (!deps) continue;
    out[key] = push(computeMainGirder(specs, key, m.inputs, m.selections, deps));
  }

  // --- Buruşma: ana kirişin kesit geometrisi ve gerilme analizinden beslenir
  // Panel ölçüleri ve kenar gerilmeleri elle yazılmaz; ana kiriş açıksa
  // oradan türetilir (bkz. modules/buckling.ts `bucklingDepsFrom`).
  //
  // KAYNAK BİRİNCİ TAKIMDIR. Dört kirişli köprüde iki ana kiriş vardır ama
  // buruşma bölümü TEKTİR ve ANA KİRİŞ - 1'in panellerini kontrol eder. İki
  // takımın panellerini tek bölümde toplamak hangi sacın hangi kirişe ait
  // olduğunu belirsizleştirirdi; ikinci takımın buruşması gerekirse kendi
  // bölümü olarak açılır (bugün kapsam dışıdır ve burada yazılıdır).
  out.buckling = push(
    input.buckling &&
      computeBuckling(
        input.buckling.inputs,
        input.girder
          ? bucklingDepsFrom(input.girder, out.girder?.cells)
          : undefined
      )
  );

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

  // --- Kabin ve elektrik odası --------------------------------------------
  if (input.cabin) {
    out.cabin = push(
      computeCabin(specs, input.cabin.inputs, input.cabin.selections, cabinDepsFrom(input))
    );
  }

  out.allPass = allChecks.every((c) => c.pass);
  return out;
}
