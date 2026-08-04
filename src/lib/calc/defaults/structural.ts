// Yapısal modüllerin (ana kiriş, buruşma, başkiriş) başlangıç değerleri —
// yeni revizyonlar için şablon ve tarihsel doğrulama fikstürünün girdisi.
//
// Değerler İSDEMİR amonyum sülfat vinci projesinin ilk hesabından gelir; yeni
// bir iş emrinde mühendis bunları kendi geometrisiyle değiştirir.

import type { BucklingInputs } from "../modules/buckling";
import type {
  EndCarriageDeps,
  EndCarriageInputs,
  EndCarriageSelections,
} from "../modules/endCarriage";
import type { GirderDeps, GirderInputs, GirderSelections } from "../modules/mainGirder";

/** Ana kirişin diğer modüllerden aldığı değerler */
export const V5_GIRDER_DEPS: GirderDeps = {
  mainHookBlockWeightKg: 3250,
  mainRopeWeightKg: 250,
  trolleyWeightT: 2.5,
  trolleyWheelCount: 4,
  trolleyDrivenWheels: 2,
  trolleyActualSpeedMpm: 40.0823890285594,
  trolleyAccelTimeS: 3.34019908571329,
  bridgeWeightT: 17,          // 15 t ana kirişler + 2 t başkirişler
  bridgeWheelCount: 4,
  bridgeDrivenWheels: 4,
  bridgeActualSpeedMpm: 61.0254372959817,
  bridgeAccelTimeS: 5.08545310799848,
  trolleyRailCode: "50x50",   // araba rayı — ana kirişin üstüne kaynaklı
};

export const V5_GIRDER_INPUTS: GirderInputs = {
  railHeightMm: 40,           // hr
  t1Mm: 8,
  b1Mm: 300,
  t2Mm: 8,
  b2Mm: 460,
  t3Mm: 8,
  h3Mm: 990,
  t4Mm: 8,
  t5Mm: 8,
  b5Mm: 440,
  t6Mm: 0,
  b6Mm: 0,
  aMm: 320,
  xMm: 80,
  hookTopPositionM: 12,
  bridgeAxleSpacingM: 3.75,
  trolleyWheelSpacingM: 3,
  trolleyAxleSpacingM: 3,
  // ψhA / ψhK elle girilmez: kütle oranından türetilir (FEM 1.001 Şekil A.2.2.1)
  //   µ_araba = 7500/2500 = 3,0 → ψhA = √(2 + µ + 1/µ) = 2,309
  //   µ_köprü = 7500/19500 = 0,38 ≤ 1 → ψhK = 2,00
  // γc elle girilmez: yapı sınıfı A6 → FEM 1.001 T.2.3.4 → 1,14
  dynTestFactorR1: 1.1,       // ρ1
  statTestFactorR2: 1.25,     // ρ2
  railLeverCMm: 741.9,
  diaphragmSpacingMm: 2000,
  wheelContactHMm: 75,
  wheelContactTMm: 12,
  // σy,maks / σy,min elle girilmez: teker basıncı σz'den gelir
  // σB elle girilmez: S235JR → 360 N/mm²
  deflectionLimitRatio: 750,  // yaygın imalat hedefi L/750
  // Kirişin üstündeki ilave sabit yük (ray + yürüme yolu + festun). Kirişin
  // kendi ağırlığı kesitten hesaplanır, buraya eklenmez.
  camberExtraDeadLoadKgPerM: 0,
};

export const V5_GIRDER_SELECTIONS: GirderSelections = {
  fatigueMaterial: "S235JR",
  // Yük grubu elle girilmez: teknik özelliklerdeki "H3/B4" → B4
  fatigueNotchClass: "K3",
  staticMaterial: "St52",     // S355 (St 52)
};

/** Buruşma kontrolü panelleri */
export const V5_BUCKLING_INPUTS: BucklingInputs = {
  side: {
    elasticModulus: 210000,
    poisson: 0.3,
    thicknessMm: 8,
    panelWidthMm: 300,
    stiffenerSpacingMm: 2000,
    sigma1: 110,
    sigma2: 50,
    tau: -30,
  },
  top: {
    elasticModulus: 210000,
    poisson: 0.3,
    thicknessMm: 8,
    panelWidthMm: 590,
    stiffenerSpacingMm: 1500,
    sigma1: 80,
    sigma2: 60,
    tau: 0,
  },
  sideCorrectedCriticalNmm2: 322,
};

/** Başkirişin diğer modüllerden aldığı değerler */
export const V5_ENDCARRIAGE_DEPS: EndCarriageDeps = {
  mainHoistTotalLoadKg: 7500,
  trolleyWeightT: 2.5,
  bridgeWeightT: 17,          // 15 t ana kirişler + 2 t başkirişler
};

export const V5_ENDCARRIAGE_INPUTS: EndCarriageInputs = {
  wheelSpanAMm: 2200,
  loadOffsetBMm: 750,
  topPlateThicknessMm: 10,
  topPlateWidthMm: 200,
  sidePlateThicknessMm: 10,
  sidePlateHeightMm: 320,
  bottomPlateThicknessMm: 10,
  bottomPlateWidthMm: 200,
  fatigueTensileNmm2: 350,    // S235JR σB
};

export const V5_ENDCARRIAGE_SELECTIONS: EndCarriageSelections = {
  // Kaldırma sınıfı elle girilmez: teknik özelliklerdeki "H3/B4" → H3
  material: "S235JR",
  fatigueMaterial: "S235JR",
  // Yorulma yük grubu bilinçli olarak ezilir: başkirişin gerilme kolektifi ana
  // kirişinkinden hafiftir (araba yalnız uçlara yaklaştığında tam yükü görür),
  // bu yüzden vinç sınıfı B4 olsa da başkiriş B2 grubunda değerlendirilir.
  fatigueLoadGroupOverride: "B2",
  fatigueNotchClass: "K3",
};
