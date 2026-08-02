// Başkiriş hesabı — köprünün tekerlekleri taşıyan enine kutu kirişi.
//
// Akış: tekerlek yükleri Fmaks/Fmin → eğilme momentleri → kutu kesit
// özellikleri → DIN 15018 dinamik katsayı (ψ = k + l·v) → gerilmeler ve statik
// kontrol → DIN 15018 Tablo 17/18 yorulma kontrolü.
//
// Dayanaklar: FEM 1.001 T.3.2.1.1 (statik izin gerilmesi), DIN 15018 Tablo 2
// (kaldırma sınıfına bağlı dinamik katsayı), DIN 15018 Tablo 17/18 (yorulma).
//
// Kesit dairesel olmadığı için ortak `shaftStress` modülü kullanılmaz; kutu
// kesitin W ve Ay büyüklükleri burada hesaplanır. Moment de tek kollu basit
// bağıntıyla (M = F·b) verildiğinden `solveBeam` kullanılmaz.
//
// Birimler: kg, mm, cm³, cm⁴, kg/m, kg·cm, kg/cm², N/mm².

import { DIN15018_T17 } from "../tables";
import { parseHoistLoadClass } from "../types";
import type { AnyCheck, HoistClass, LoadGroup, ModuleResult, TechnicalSpecs } from "../types";
import type { FatigueMaterial, NotchClass } from "./mainGirder";

/**
 * DIN 15018 Tablo 2 — kaldırma sınıfına bağlı dinamik katsayı sabitleri.
 * ψ = k + l·v (v: kaldırma hızı [m/dak]). H1 en yumuşak, H4 en sert kaldırma.
 */
export const HOIST_DYNAMIC_FACTORS: Record<HoistClass, { k: number; l: number }> = {
  H1: { k: 1.1, l: 0.0022 },
  H2: { k: 1.2, l: 0.0044 },
  H3: { k: 1.3, l: 0.0066 },
  H4: { k: 1.4, l: 0.0088 },
};

/**
 * Kaldırma sınıfı okunamazsa kullanılan güvenli taraf değeri: en sert kaldırma
 * (en büyük dinamik katsayı).
 */
export const FALLBACK_HOIST_CLASS: HoistClass = "H4";

/**
 * Yük grubu okunamazsa kullanılan güvenli taraf değeri: en ağır grup
 * (en düşük yorulma izin gerilmesi).
 */
export const FALLBACK_LOAD_GROUP: LoadGroup = "B6";

/** FEM 1.001 T.3.2.1.1 — Yükleme Durumu I izin gerilmeleri [kg/cm²] */
const ALLOWABLE_STRESS: Record<FatigueMaterial, number> = {
  S235JR: 1530,
  S355JR: 2300,
};

/** kg/cm² ↔ N/mm² dönüşümü (1 kgf = 9,81 N, 1 cm² = 100 mm²). */
const NMM2_TO_KG_CM2 = 100 / 9.81;

/** DIN 15018 7.4.5 bileşik yorulma oranı üst sınırı. */
const FATIGUE_COMBINED_LIMIT = 1.1;

/** Çelik yoğunluğu [kg/dm³] — birim ağırlık hesabı. */
const STEEL_DENSITY = 7.85;

/** Diğer modüllerden gelen değerler */
export interface EndCarriageDeps {
  mainHoistTotalLoadKg: number;      // yük + kanca bloğu + halat [kg]
  trolleyWeightT: number;            // araba ağırlığı [t]
  bridgeWeightT: number;             // köprü toplam ağırlığı [t] (kirişler + başkirişler)
}

/** Kullanıcı girdileri */
export interface EndCarriageInputs {
  wheelSpanAMm: number;           // tekerlekler arası mesafe a [mm]
  loadOffsetBMm: number;          // kiriş oturma noktası b [mm]
  topPlateThicknessMm: number;    // üst sac kalınlığı
  topPlateWidthMm: number;        // üst sac genişliği
  sidePlateThicknessMm: number;   // yan sac kalınlığı
  sidePlateHeightMm: number;      // yan sac yüksekliği
  bottomPlateThicknessMm: number; // alt sac kalınlığı
  bottomPlateWidthMm: number;     // alt sac genişliği
  fatigueTensileNmm2: number;     // malzeme kopma dayanımı σB [N/mm²]
}

/** Mühendis seçimleri */
export interface EndCarriageSelections {
  /**
   * Kaldırma sınıfı elle ezme. Verilmezse teknik özelliklerdeki kaldırma/yük
   * sınıfının H bileşeninden ("H3/B4" → H3) türetilir.
   */
  hoistClassOverride?: HoistClass;
  material: FatigueMaterial;        // statik izin gerilmesi malzemesi
  fatigueMaterial: FatigueMaterial; // yorulma malzemesi
  /**
   * DIN 15018 yük grubu elle ezme. Verilmezse teknik özelliklerdeki
   * kaldırma/yük sınıfının B bileşeninden türetilir.
   */
  fatigueLoadGroupOverride?: LoadGroup;
  fatigueNotchClass: NotchClass;    // W0..K4 (DIN 15018)
}

export interface EndCarriageValues {
  fMaxKg: number;
  fMinKg: number;
  mMaxKgCm: number;
  mMinKgCm: number;
  weightPerM: number;
  inertiaCm4: number;
  sectionModulusCm3: number;
  areaCm2: number;
  shearAreaCm2: number;
  hoistClass: HoistClass;    // türetilmiş ya da elle ezilmiş
  dynamicFactor: number;     // ψ = k + l·v
  sigmaKgCm2: number;
  tauKgCm2: number;
  sigmaCombinedKgCm2: number;
  allowableKgCm2: number;
  // Yorulma
  sigmaMaxKgCm2: number;
  tauMaxKgCm2: number;
  sigmaCombMaxKgCm2: number;
  sigmaMinKgCm2: number;
  tauMinKgCm2: number;
  sigmaCombMinKgCm2: number;
  kappa: number;                // κ = σbil,min / σbil,maks
  loadGroup: LoadGroup;         // türetilmiş ya da elle ezilmiş
  zulSigmaD1Nmm2: number;       // zul σD(-1) — DIN 15018 T17
  zulSigmaD1KgCm2: number;
  zulSigmaDz0KgCm2: number;     // zul σDz(0) = zul σD(-1)·5/3
  sigmaBKgCm2: number;          // σB [kg/cm²]
  zulSigmaDzKappaKgCm2: number; // zul σDz(κ) — DIN 15018 T18
  zulTauW0Nmm2: number;
  zulTauDKgCm2: number;         // zul τD = zul τW0/√3
  fatigueCombined: number;
}

/** DIN 15018 Tablo 17 lookup */
function t17(material: FatigueMaterial, notch: NotchClass, group: LoadGroup): number {
  return DIN15018_T17[material === "S355JR" ? "St52" : "St37"][notch][group];
}

/**
 * Kaldırma sınıfı — elle ezilmediyse teknik özelliklerdeki kaldırma/yük
 * sınıfının H bileşeninden türetilir. Sınıflandırma tek kaynaktan okunur;
 * modüle ayrı bir sınıf girilmesi veri çelişkisi üretir.
 */
export function endCarriageHoistClass(
  specs: TechnicalSpecs,
  sel: Pick<EndCarriageSelections, "hoistClassOverride">
): HoistClass {
  return (
    sel.hoistClassOverride ??
    parseHoistLoadClass(specs.hoistLoadClass).hoistClass ??
    FALLBACK_HOIST_CLASS
  );
}

/**
 * DIN 15018 yorulma yük grubu — elle ezilmediyse teknik özelliklerdeki
 * kaldırma/yük sınıfının B bileşeninden türetilir.
 */
export function endCarriageLoadGroup(
  specs: TechnicalSpecs,
  sel: Pick<EndCarriageSelections, "fatigueLoadGroupOverride">
): LoadGroup {
  return (
    sel.fatigueLoadGroupOverride ??
    parseHoistLoadClass(specs.hoistLoadClass).loadGroup ??
    FALLBACK_LOAD_GROUP
  );
}

export function computeEndCarriage(
  specs: TechnicalSpecs,
  inp: EndCarriageInputs,
  sel: EndCarriageSelections,
  deps: EndCarriageDeps
): ModuleResult<EndCarriageValues> {
  const cells: Record<string, number | string> = {};
  const checks: AnyCheck[] = [];

  // --- 9.1 Tekerlek yükleri ve momentler -----------------------------------
  const bridgeSelfWeightKg =
    (deps.bridgeWeightT * 1000) / 4;
  // Fmaks: araba en yakın tekere yanaşmışken (0,9 yaklaşma katsayısı)
  const wheelLoadMaxKg =
    (deps.mainHoistTotalLoadKg / 2 + (deps.trolleyWeightT * 1000) / 2) * 0.9 +
    bridgeSelfWeightKg;
  // Fmin: yüksüz araba karşı uçta (0,5 payı)
  const wheelLoadMinKg =
    ((deps.trolleyWeightT * 1000) / 2) * 0.5 + bridgeSelfWeightKg;
  const momentMaxKgCm = (wheelLoadMaxKg * inp.loadOffsetBMm) / 10;
  const momentMinKgCm = (wheelLoadMinKg * inp.loadOffsetBMm) / 10;
  Object.assign(cells, {
    "wheel.loadMax": wheelLoadMaxKg,
    "wheel.loadMin": wheelLoadMinKg,
    "moment.max": momentMaxKgCm,
    "moment.min": momentMinKgCm,
  });

  // --- 9.2 Kutu kesit özellikleri ------------------------------------------
  const topT = inp.topPlateThicknessMm, topW = inp.topPlateWidthMm;
  const sideT = inp.sidePlateThicknessMm, sideH = inp.sidePlateHeightMm;
  const botT = inp.bottomPlateThicknessMm, botW = inp.bottomPlateWidthMm;
  const weightPerM =
    ((topT * topW + sideT * sideH * 2 + botT * botW) * 1000 * STEEL_DENSITY) / 10 ** 6;
  // Atalet momenti [cm⁴] — yan saclar kendi ekseni, flanşlar Steiner terimiyle
  const inertiaCm4 =
    ((sideT / 10) * (sideH / 10) ** 3 / 12) * 2 +
    ((topW / 10) * (topT / 10) ** 3 / 12 + (topT / 10) * (topW / 10) * ((sideH / 10) / 2) ** 2) +
    (botT / 10) * (botW / 10) * ((sideH / 10) / 2) ** 2;
  const sectionModulusCm3 = inertiaCm4 / (sideH / 20);
  const areaCm2 =
    (topT / 10) * (topW / 10) + (sideT / 10) * (sideH / 10) * 2 + (botT / 10) * (botW / 10);
  const shearAreaCm2 = (sideT / 10) * (sideH / 10) * 2; // kesmeyi yan saclar taşır
  Object.assign(cells, {
    "section.weightPerLength": weightPerM,
    "section.inertia": inertiaCm4,
    "section.modulus": sectionModulusCm3,
    "section.area": areaCm2,
    "section.shearArea": shearAreaCm2,
  });

  // --- 9.3 DIN 15018 dinamik katsayı ---------------------------------------
  const hoistClass = endCarriageHoistClass(specs, sel);
  const { k: factorK, l: factorL } = HOIST_DYNAMIC_FACTORS[hoistClass];
  const dynamicFactor = factorK + factorL * specs.mainLiftSpeedMpm;
  Object.assign(cells, {
    "load.hoistClass": hoistClass,
    "load.factorK": factorK,
    "load.factorL": factorL,
    "load.dynamicFactor": dynamicFactor,
  });

  // --- 9.4 Gerilmeler ve statik kontrol ------------------------------------
  const sigmaKgCm2 = (momentMaxKgCm * dynamicFactor) / sectionModulusCm3;
  const tauKgCm2 = (wheelLoadMaxKg * dynamicFactor) / shearAreaCm2;
  const sigmaCombinedKgCm2 = Math.sqrt(sigmaKgCm2 ** 2 + 3 * tauKgCm2 ** 2);
  const allowableKgCm2 = ALLOWABLE_STRESS[sel.material];
  Object.assign(cells, {
    "stress.bending": sigmaKgCm2,
    "stress.shear": tauKgCm2,
    "stress.combined": sigmaCombinedKgCm2,
    "stress.allowable": allowableKgCm2,
  });
  checks.push({
    id: "endCarriage.stress",
    label: "Başkiriş Bileşik Gerilmesi",
    required: sigmaCombinedKgCm2, provided: allowableKgCm2, unit: "kg/cm²", op: ">=",
    computedSide: "required",
    pass: sigmaCombinedKgCm2 <= allowableKgCm2,
    standard: "FEM 1.001 T.3.2.1.1",
    kind: "standart", severity: "engelleyici",
  });

  // --- 9.5 Yorulma gerilmeleri (dinamik katsayısız, gerçek gerilme genlikleri)
  const sigmaMaxKgCm2 = momentMaxKgCm / sectionModulusCm3;
  const tauMaxKgCm2 = wheelLoadMaxKg / shearAreaCm2;
  const sigmaCombMaxKgCm2 = Math.sqrt(sigmaMaxKgCm2 ** 2 + 3 * tauMaxKgCm2 ** 2);
  const sigmaMinKgCm2 = momentMinKgCm / sectionModulusCm3;
  const tauMinKgCm2 = wheelLoadMinKg / shearAreaCm2;
  const sigmaCombMinKgCm2 = Math.sqrt(sigmaMinKgCm2 ** 2 + 3 * tauMinKgCm2 ** 2);
  const kappa = sigmaCombMinKgCm2 / sigmaCombMaxKgCm2;

  // --- 9.6 Yorulma izin gerilmeleri (DIN 15018 Tablo 17/18) ----------------
  const loadGroup = endCarriageLoadGroup(specs, sel);
  const zulSigmaD1Nmm2 = t17(sel.fatigueMaterial, sel.fatigueNotchClass, loadGroup);
  const zulSigmaD1KgCm2 = zulSigmaD1Nmm2 * NMM2_TO_KG_CM2;
  const zulSigmaDz0KgCm2 = (zulSigmaD1KgCm2 * 5) / 3;
  const sigmaBKgCm2 = inp.fatigueTensileNmm2 * NMM2_TO_KG_CM2;
  // zul σDz(κ) — DIN 15018 Tablo 18 gerilme oranı düzeltmesi
  const zulSigmaDzKappaKgCm2 =
    zulSigmaDz0KgCm2 / (1 - (1 - zulSigmaDz0KgCm2 / sigmaBKgCm2 / 0.75) * kappa);
  // Kayma için çentik durumu daima W0 kabul edilir (DIN 15018 7.4.3)
  const zulTauW0Nmm2 = t17(sel.fatigueMaterial, "W0", loadGroup);
  const zulTauDKgCm2 = (zulTauW0Nmm2 * NMM2_TO_KG_CM2) / Math.sqrt(3);
  const fatigueCombined =
    (sigmaMaxKgCm2 / zulSigmaDzKappaKgCm2) ** 2 + (tauMaxKgCm2 / zulTauDKgCm2) ** 2;

  Object.assign(cells, {
    "fatigue.sigmaMax": sigmaMaxKgCm2,
    "fatigue.tauMax": tauMaxKgCm2,
    "fatigue.combinedMax": sigmaCombMaxKgCm2,
    "fatigue.sigmaMin": sigmaMinKgCm2,
    "fatigue.tauMin": tauMinKgCm2,
    "fatigue.combinedMin": sigmaCombMinKgCm2,
    "fatigue.kappa": kappa,
    "fatigue.loadGroup": loadGroup,
    "fatigue.allowableD1Nmm2": zulSigmaD1Nmm2,
    "fatigue.allowableD1KgCm2": zulSigmaD1KgCm2,
    "fatigue.allowableDz0KgCm2": zulSigmaDz0KgCm2,
    "fatigue.tensileKgCm2": sigmaBKgCm2,
    "fatigue.allowableSigmaKgCm2": zulSigmaDzKappaKgCm2,
    "fatigue.allowableTauW0Nmm2": zulTauW0Nmm2,
    "fatigue.allowableTauKgCm2": zulTauDKgCm2,
    "fatigue.combined": fatigueCombined,
    "fatigue.combinedLimit": FATIGUE_COMBINED_LIMIT,
  });
  checks.push({
    id: "endCarriage.fatigue.sigma",
    label: "Yorulma σmaks ≤ zul σDz(κ)",
    required: sigmaMaxKgCm2, provided: zulSigmaDzKappaKgCm2, unit: "kg/cm²", op: ">=",
    computedSide: "required",
    pass: sigmaMaxKgCm2 <= zulSigmaDzKappaKgCm2,
    standard: "DIN 15018 T.17/18",
    kind: "standart", severity: "engelleyici",
  });
  checks.push({
    id: "endCarriage.fatigue.tau",
    label: "Yorulma τmaks ≤ zul τD(κ)",
    required: tauMaxKgCm2, provided: zulTauDKgCm2, unit: "kg/cm²", op: ">=",
    computedSide: "required",
    pass: tauMaxKgCm2 <= zulTauDKgCm2,
    standard: "DIN 15018 T.17",
    kind: "standart", severity: "engelleyici",
  });
  checks.push({
    id: "endCarriage.fatigue.combined",
    label: "Bileşik Yorulma Oranı",
    required: fatigueCombined, provided: FATIGUE_COMBINED_LIMIT, unit: "-", op: ">=",
    computedSide: "required",
    pass: fatigueCombined <= FATIGUE_COMBINED_LIMIT,
    standard: "DIN 15018 7.4.5",
    kind: "standart", severity: "engelleyici",
  });

  const values: EndCarriageValues = {
    fMaxKg: wheelLoadMaxKg,
    fMinKg: wheelLoadMinKg,
    mMaxKgCm: momentMaxKgCm,
    mMinKgCm: momentMinKgCm,
    weightPerM,
    inertiaCm4,
    sectionModulusCm3,
    areaCm2,
    shearAreaCm2,
    hoistClass,
    dynamicFactor,
    sigmaKgCm2,
    tauKgCm2,
    sigmaCombinedKgCm2,
    allowableKgCm2,
    sigmaMaxKgCm2,
    tauMaxKgCm2,
    sigmaCombMaxKgCm2,
    sigmaMinKgCm2,
    tauMinKgCm2,
    sigmaCombMinKgCm2,
    kappa,
    loadGroup,
    zulSigmaD1Nmm2,
    zulSigmaD1KgCm2,
    zulSigmaDz0KgCm2,
    sigmaBKgCm2,
    zulSigmaDzKappaKgCm2,
    zulTauW0Nmm2,
    zulTauDKgCm2,
    fatigueCombined,
  };
  return { values, checks, cells };
}
