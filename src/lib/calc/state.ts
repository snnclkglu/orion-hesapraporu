// Ortak saf durum geçişleri: manuel editör ve hızlı seçim aynı türetmeleri kullanır.
import { deriveGirderInputs, deriveHoistInputs, deriveHookBlockSelections, deriveTravelInputs, type GirderDeriveContext } from "./derive";
import { hoistReeving, hoistSpecView, type HoistInputs, type HoistSelections } from "./modules/hoistGroup";
import { travelSpecView, type TravelDeps, type TravelInputs, type TravelSelections } from "./modules/travelGroup";
import type { HookBlockInputs, HookBlockSelections } from "./modules/hookBlock";
import type { GirderInputs, GirderWhich } from "./modules/mainGirder";
import { creepSpeedForLiftSpeed, guideClearanceForWheelDiameter, hoistingClassForMechanism, normalizeWheelCount, resolveWheelSpacings, type WheelLoadInputs, type WheelLoadSelections } from "./modules/wheelLoads";
import { deriveReeving } from "./reeving";
import { RAILS, railCodesOfFamily, railFamilyOf, railNominalHeadWidthMm } from "./tables";
import { hasSeparateAuxTrolley, hookBlockLoadShare, type TechnicalSpecs } from "./types";
import { MODULE_ORDER, HOIST_OF_HOOKBLOCK, isHoistKey, isTravelKey, isHookBlockKey, type ModuleKey, type HoistKey, type TravelKey, type HookBlockKey } from "./presentation/module-family";

// ------------------------------------------------ Otomatik girdi türetmesi
//
// "Otomatik" anahtarı açık olan alanlar bir GİRDİ gibi saklanır ama değerleri
// başka verilerden türetilir (bkz. calc/derive.ts). Editör türetilen değeri
// state'e YAZAR — motor, PDF raporu ve ekipman listesi hep aynı sayıyı görsün
// diye. Bu bölüm o yazma işleminin SAF karşılığıdır: React'ten bağımsızdır,
// bu yüzden doğrudan test edilebilir.
//
// KRİTİK: yalnız DEĞİŞEN alan patch'lenir ve hiçbir değişiklik yoksa AYNI
// nesne geri döner. Referans eşitliği korunmazsa `setMods` her turda yeni
// nesne üretir ve editör sonsuz yeniden çizime girer.

/** Bir hesap bölümünün girdi + seçim durumu. */
export type ModuleState = { inputs: object; selections: object };
/** Tüm bölümlerin durumu — anahtar bazlı, vinç topolojisinden bağımsız. */
export type ModulesState = Record<ModuleKey, ModuleState>;

/** Otomatik açık ama kaynak veri eksikse alanın altında gösterilen uyarı. */
export interface DerivationWarning {
  field: string;
  message: string;
}

/**
 * Yürütme türetmesi teknik özelliklerden yalnız MEKANİZMA SINIFINI okur;
 * ağırlık bağımlılıkları (kanca donanımı, araba) bu türetmeye girmediği için
 * görünüm sıfır ağırlıkla kurulur.
 */
const TRAVEL_VIEW_DEPS: TravelDeps = { hookEquipmentT: 0, trolleyWeightT: 0 };

/**
 * Ana kirişin türetmesi TAŞIDIĞI kaldırma grubunun girdilerinden beslenir:
 * birinci takım ana kaldırmayı, dört kirişli köprüde ikinci takım YARDIMCI
 * kaldırmayı taşır. ψhA / ψhK kütle oranından çıktığı için bu ayrım gerçektir —
 * ikinci takımı ana kaldırmanın kütlesiyle türetmek yanlış bir yatay dinamik
 * katsayı yazardı.
 */
function girderDeriveContext(
  mods: ModulesState,
  specs: TechnicalSpecs,
  which: GirderWhich = "girder"
): GirderDeriveContext {
  const ikinci = which === "girder2";
  const auxVar = ikinci && mods.aux !== undefined;
  const h = (auxVar ? mods.aux : mods.main)?.inputs as HoistInputs | undefined;
  const wheelInputs = mods.wheelLoads?.inputs as { wheelSpacingsText?: string } | undefined;
  const bridgeInputs = mods.bridge?.inputs as TravelInputs | undefined;
  const trolleySelections = (
    auxVar && hasSeparateAuxTrolley(specs) ? mods.auxTrolley : mods.trolley
  )?.selections as TravelSelections | undefined;
  const wheelsPerSide = normalizeWheelCount(bridgeInputs?.wheelCount ?? 4) / 2;
  const bridgeAxleSpacingM = wheelInputs?.wheelSpacingsText
    ? resolveWheelSpacings(wheelInputs.wheelSpacingsText, wheelsPerSide)
        .reduce((sum, spacing) => sum + spacing, 0) / 1000
    : undefined;
  return {
    mainHookBlockWeightKg: h?.hookBlockWeightKg ?? 0,
    mainRopeWeightKg: h?.ropeWeightKg ?? 0,
    hoistLoadKg: (auxVar ? specs.auxCapacityT : specs.mainCapacityT) * 1000,
    trolleyWeightT:
      auxVar && hasSeparateAuxTrolley(specs)
        ? specs.auxTrolleyWeightT ?? specs.mainTrolleyWeightT
        : specs.mainTrolleyWeightT,
    liftHeightM: auxVar ? specs.auxLiftHeightM : specs.mainLiftHeightM,
    bridgeAxleSpacingM,
    trolleyRailCode: trolleySelections?.railCode,
  };
}

/**
 * Kaldırma grubunun otomatik alanları.
 *
 * İki hedef vardır: halat/kanca/sıcaklık/makara verimi/tambur ağırlığı GİRDİYE,
 * yiv boyu metni ise KATALOG SEÇİMİNE yazılır (`HoistSelections`), çünkü yiv
 * boyu bir seçim alanıdır — anahtarı yine girdilerde durur.
 */
export function withDerivedHoist(
  state: ModuleState,
  specs: TechnicalSpecs,
  which: HoistKey
): ModuleState {
  const inputs = state.inputs as HoistInputs;
  const selections = state.selections as HoistSelections;
  const view = hoistSpecView(specs, which);
  const d = deriveHoistInputs(inputs, selections, {
    liftHeightM: view.liftHeightM,
    capacityT: view.capacityT,
    ambientTempMaxC: specs.ambientTempMaxC,
    mechanismClass: view.mechanismClass,
  });

  const patch: Partial<HoistInputs> = {};
  const put = <K extends keyof HoistInputs>(k: K, v: HoistInputs[K] | undefined) => {
    if (v !== undefined && v !== inputs[k]) patch[k] = v;
  };
  // Hazır donanım seçiliyse tahrikli/toplam halat kutuları da o donanıma uyar.
  put("drivenFalls", d.drivenFalls);
  put("totalFalls", d.totalFalls);
  put("ropeWeightKg", d.ropeWeightKg);
  put("hookBlockWeightKg", d.hookBlockWeightKg);
  put("tempFactor", d.tempFactor);
  put("sheaveEfficiency", d.sheaveEfficiency);
  put("drumWeightKg", d.drumWeightKg);
  put("drumSpanCMm", d.drumSpanCMm);
  put("drumSpanEMm", d.drumSpanEMm);
  put("gearboxServiceFactor", d.gearboxServiceFactor);
  put("drumCouplingServiceFactor", d.drumCouplingServiceFactor);

  const selPatch: Partial<HoistSelections> = {};
  if (
    d.drumGrooveLengthText !== undefined &&
    d.drumGrooveLengthText !== selections.drumGrooveLengthText
  ) {
    selPatch.drumGrooveLengthText = d.drumGrooveLengthText;
  }
  if (
    d.ropeOrderLengthM !== undefined &&
    d.ropeOrderLengthM !== selections.ropeOrderLengthM
  ) {
    selPatch.ropeOrderLengthM = d.ropeOrderLengthM;
  }

  const inputsChanged = Object.keys(patch).length > 0;
  const selChanged = Object.keys(selPatch).length > 0;
  if (!inputsChanged && !selChanged) return state;
  return {
    inputs: inputsChanged ? { ...inputs, ...patch } : state.inputs,
    selections: selChanged ? { ...selections, ...selPatch } : state.selections,
  };
}

/**
 * Yürütme grubunun otomatik alanları: sıcaklık faktörü, CMAA uygulama sınıfı
 * ve ona bağlı Ks / Kt katsayıları, mekanizma sınıfından gelen ivme ve
 * REDÜKTÖR TAHVİL ORANI. Teknik Özellikler'de mekanizma sınıfı değiştiğinde
 * uygulama sınıfı, Ks ve ivme BURADAN güncellenir.
 *
 * Tahvil oranı bir SEÇİM alanıdır (kaldırma tarafındaki yiv boyu gibi):
 * anahtarı girdilerde durur, türetilen değer seçimlere yazılır.
 */
export function withDerivedTravel(
  state: ModuleState,
  specs: TechnicalSpecs,
  which: TravelKey
): ModuleState {
  const inputs = state.inputs as TravelInputs;
  const selections = state.selections as TravelSelections;
  const view = travelSpecView(specs, which, TRAVEL_VIEW_DEPS);
  const d = deriveTravelInputs(inputs, selections, {
    ambientTempMaxC: specs.ambientTempMaxC,
    mechanismClass: view.mechanismClass,
    travelSpeedMpm: view.speedMpm,
  });

  const patch: Partial<TravelInputs> = {};
  const put = <K extends keyof TravelInputs>(k: K, v: TravelInputs[K] | undefined) => {
    if (v !== undefined && v !== inputs[k]) patch[k] = v;
  };
  put("tempFactor", d.tempFactor);
  put("applicationClass", d.applicationClass);
  put("serviceFactorKs", d.serviceFactorKs);
  put("accelTorqueFactorKt", d.accelTorqueFactorKt);
  put("gearboxServiceFactor", d.gearboxServiceFactor);
  put("accelerationMs2", d.accelerationMs2);

  const selPatch: Partial<TravelSelections> = {};
  if (d.motorCount !== undefined && d.motorCount !== selections.motorCount) {
    selPatch.motorCount = d.motorCount;
  }
  if (d.gearboxRatio !== undefined && d.gearboxRatio !== selections.gearboxRatio) {
    selPatch.gearboxRatio = d.gearboxRatio;
  }

  const inputsChanged = Object.keys(patch).length > 0;
  const selChanged = Object.keys(selPatch).length > 0;
  if (!inputsChanged && !selChanged) return state;
  return {
    inputs: inputsChanged ? { ...inputs, ...patch } : state.inputs,
    selections: selChanged ? { ...selections, ...selPatch } : state.selections,
  };
}

/**
 * TEKER SEÇİMİ DEĞİŞTİYSE TAHVİL ORANI YENİDEN OTOMATİĞE DÖNER.
 *
 * Teker çapı değişince gereken oran da değişir; elde kalan eski oran, artık
 * geçerli olmayan bir hızla güç hesabı yaptırır ve YANLIŞ MOTOR seçtirir
 * (kullanıcı bildirimi, 23.08.2026). Bu yüzden çap her değiştiğinde kutu
 * yeniden gereken orana eşitlenir ve kırmızıya döner — mühendis motoru
 * seçtikten sonra kataloğun gerçek oranını girer.
 *
 * Yalnız GEREKEN ORANI DEĞİŞTİREN seçime bakar (teker çapı); rulman ya da
 * kaplin değişimi oranı geri almaz. Değişiklik yoksa `null` döner.
 */
/**
 * RAY AİLESİ DEĞİŞİNCE ÖLÇÜ DE O AİLEYE GEÇER.
 *
 * Ray seçimi iki kutuludur: aile + ölçü. Aile değiştiğinde eski kod olduğu
 * gibi kalsaydı kutular birbirini yalanlardı ("S Tipi" ama "50x50") ve hesap
 * hâlâ eski rayla koşardı. Yeni ailede EN YAKIN BAŞ GENİŞLİĞİNE düşülür —
 * teker bandajı ve temas basıncı baş genişliğine bağlıdır, dolayısıyla en az
 * şaşırtan komşu odur. Kod zaten yeni ailedeyse dokunulmaz.
 */
export function syncRailCodeToFamily(
  key: ModuleKey,
  prior: object,
  next: object
): object | null {
  if (!isTravelKey(key)) return null;
  const family = String((next as TravelSelections).railFamily ?? "");
  if (!family || family === String((prior as TravelSelections).railFamily ?? "")) return null;
  const code = String((next as TravelSelections).railCode ?? "");
  if (railFamilyOf(code) === family && RAILS[code]) return null;
  const codes = railCodesOfFamily(family);
  if (codes.length === 0) return null;
  const cur = railNominalHeadWidthMm(code);
  const nearest = Number.isFinite(cur)
    ? codes.reduce((best, c) =>
        Math.abs(railNominalHeadWidthMm(c) - cur) < Math.abs(railNominalHeadWidthMm(best) - cur)
          ? c
          : best
      )
    : codes[0];
  return { ...next, railCode: nearest };
}

export function reArmGearboxRatioAuto(
  key: ModuleKey,
  prior: object,
  next: object,
  inputs: object
): object | null {
  if (!isTravelKey(key)) return null;
  const before = (prior as TravelSelections).wheelDiaMm;
  const after = (next as TravelSelections).wheelDiaMm;
  if (before === after) return null;
  if ((inputs as TravelInputs).gearboxRatioAuto === true) return null;
  return { ...inputs, gearboxRatioAuto: true };
}

/**
 * Kanca bloğunun otomatik alanı: "Kanca Tam Tanımı" metni. Anahtar GİRDİLERDE
 * (`hookDesignationAuto`), türetilen değer SEÇİMLERDE durur — yiv boyunun
 * (`drumGrooveLengthText`) birebir aynı düzeni.
 */
export function withDerivedHookBlock(
  state: ModuleState,
  which: HookBlockKey,
  all: ModulesState,
  specs?: TechnicalSpecs
): ModuleState {
  const inputs = state.inputs as HookBlockInputs;
  const selections = state.selections as HookBlockSelections;
  const hoist = all[HOIST_OF_HOOKBLOCK[which]];
  const derivedSheaveCount = hoist
    ? Math.max(
        1,
        Math.round(
          deriveReeving(hoistReeving(hoist.inputs as HoistInputs)).blockSheaveCount *
            (specs ? hookBlockLoadShare(specs, HOIST_OF_HOOKBLOCK[which]) : 1)
        )
      )
    : undefined;
  const d = deriveHookBlockSelections(inputs, selections, derivedSheaveCount);
  const patch: Partial<HookBlockSelections> = {};
  if (d.hookDesignation !== undefined && d.hookDesignation !== selections.hookDesignation) {
    patch.hookDesignation = d.hookDesignation;
  }
  if (d.sheaveCount !== undefined && d.sheaveCount !== selections.sheaveCount) {
    patch.sheaveCount = d.sheaveCount;
  }
  if (Object.keys(patch).length === 0) return state;
  return {
    ...state,
    selections: { ...selections, ...patch },
  };
}

/** Ana kirişin kesit, yerel basınç ve yük katsayısı otomatikleri. */
export function withDerivedGirder(
  state: ModuleState,
  specs: TechnicalSpecs,
  ctx: GirderDeriveContext
): ModuleState {
  const inputs = state.inputs as GirderInputs;
  const d = deriveGirderInputs(inputs, specs, ctx);

  const patch: Partial<GirderInputs> = {};
  const put = <K extends keyof GirderInputs>(k: K, v: GirderInputs[K] | undefined) => {
    if (v !== undefined && v !== inputs[k]) patch[k] = v;
  };
  put("railHeightMm", d.railHeightMm);
  put("t7Mm", d.t7Mm);
  put("psiHAOverride", d.psiHAOverride);
  put("psiHKOverride", d.psiHKOverride);
  put("amplifyYcOverride", d.amplifyYcOverride);
  const loadGeometryChanged =
    (d.hookTopPositionM !== undefined && d.hookTopPositionM !== inputs.hookTopPositionM) ||
    (d.bridgeAxleSpacingM !== undefined && d.bridgeAxleSpacingM !== inputs.bridgeAxleSpacingM);
  put("hookTopPositionM", d.hookTopPositionM);
  put("bridgeAxleSpacingM", d.bridgeAxleSpacingM);
  put("wheelContactHMm", d.wheelContactHMm);
  put("wheelContactTMm", d.wheelContactTMm);
  if (loadGeometryChanged && inputs.loadMeasurementsConfirmed === true) {
    patch.loadMeasurementsConfirmed = false;
  }

  if (Object.keys(patch).length === 0) return state;
  return { ...state, inputs: { ...inputs, ...patch } };
}

/**
 * Teker yükleri 6.2 otomatikleri. Kaynakların üçü de bölüm dışındadır:
 * mekanizma sınıfı ve kaldırma hızı teknik özelliklerden, kılavuz boşluğu
 * köprü yürütmenin seçilmiş teker çapından gelir.
 */
export function withDerivedWheelLoads(
  state: ModuleState,
  specs: TechnicalSpecs,
  all: ModulesState
): ModuleState {
  const inputs = state.inputs as WheelLoadInputs;
  const selections = state.selections as WheelLoadSelections;
  const bridgeSelections = all.bridge?.selections as TravelSelections | undefined;
  const patch: Partial<WheelLoadInputs> = {};
  const selPatch: Partial<WheelLoadSelections> = {};

  if (inputs.creepSpeedAuto === true) {
    const value = creepSpeedForLiftSpeed(specs.mainLiftSpeedMpm);
    if (value !== inputs.creepSpeedMpm) patch.creepSpeedMpm = value;
  }
  if (inputs.guideClearanceAuto === true && bridgeSelections) {
    const value = guideClearanceForWheelDiameter(bridgeSelections.wheelDiaMm);
    if (value !== inputs.guideClearanceMm) patch.guideClearanceMm = value;
  }
  if (inputs.hoistingClassAuto === true) {
    const value = hoistingClassForMechanism(specs.hoistMechanismClass);
    if (value !== selections.hoistingClass) selPatch.hoistingClass = value;
  }

  const inputsChanged = Object.keys(patch).length > 0;
  const selectionsChanged = Object.keys(selPatch).length > 0;
  if (!inputsChanged && !selectionsChanged) return state;
  return {
    inputs: inputsChanged ? { ...inputs, ...patch } : state.inputs,
    selections: selectionsChanged ? { ...selections, ...selPatch } : state.selections,
  };
}

/** Bir bölümün durumunu ailesine göre türetmelerden geçirir. */
export function withDerivedModule(
  key: ModuleKey,
  state: ModuleState,
  specs: TechnicalSpecs,
  all: ModulesState
): ModuleState {
  if (isHoistKey(key)) return withDerivedHoist(state, specs, key);
  if (isTravelKey(key)) return withDerivedTravel(state, specs, key);
  if (isHookBlockKey(key)) return withDerivedHookBlock(state, key, all, specs);
  if (key === "girder" || key === "girder2") {
    return withDerivedGirder(state, specs, girderDeriveContext(all, specs, key));
  }
  if (key === "wheelLoads") return withDerivedWheelLoads(state, specs, all);
  return state;
}

/**
 * TÜM bölümlerin otomatik alanlarını tek geçişte tazeler.
 *
 * Bölümler `MODULE_ORDER` sırasıyla işlenir; ana kaldırma ana kirişten ÖNCE
 * geldiği için kirişin ψh katsayıları ana kaldırmanın AYNI turda güncellenmiş
 * kanca/halat ağırlıklarını görür. Hiçbir bölüm değişmediyse giriş nesnesi
 * olduğu gibi döner (referans eşitliği → gereksiz yeniden çizim yok).
 */
export function withDerivedModules(
  mods: ModulesState,
  specs: TechnicalSpecs
): ModulesState {
  let out = mods;
  for (const key of MODULE_ORDER) {
    const cur = out[key];
    if (!cur) continue;
    const next = withDerivedModule(key, cur, specs, out);
    if (next === cur) continue;
    if (out === mods) out = { ...mods };
    out[key] = next;
  }
  return out;
}

/**
 * Bölüm başına türetme uyarıları (otomatik açık ama kaynak veri eksik).
 * Alanın altında kırmızı satır olarak gösterilir.
 */
export function derivationWarnings(
  mods: ModulesState,
  specs: TechnicalSpecs
): Record<ModuleKey, DerivationWarning[]> {
  const out = {} as Record<ModuleKey, DerivationWarning[]>;
  for (const key of MODULE_ORDER) {
    const st = mods[key];
    if (!st) {
      out[key] = [];
      continue;
    }
    if (isHoistKey(key)) {
      const view = hoistSpecView(specs, key);
      out[key] = deriveHoistInputs(
        st.inputs as HoistInputs,
        st.selections as HoistSelections,
        {
          liftHeightM: view.liftHeightM,
          capacityT: view.capacityT,
          ambientTempMaxC: specs.ambientTempMaxC,
          mechanismClass: view.mechanismClass,
        }
      ).warnings;
    } else if (isTravelKey(key)) {
      const view = travelSpecView(specs, key, TRAVEL_VIEW_DEPS);
      out[key] = deriveTravelInputs(
        st.inputs as TravelInputs,
        st.selections as TravelSelections,
        {
          ambientTempMaxC: specs.ambientTempMaxC,
          mechanismClass: view.mechanismClass,
          travelSpeedMpm: view.speedMpm,
        }
      ).warnings;
    } else {
      out[key] = [];
    }
  }
  return out;
}
