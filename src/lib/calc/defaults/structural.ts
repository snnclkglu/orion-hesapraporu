// İSDEMİR V5 raporunun yapısal modül değerleri (07/08/09 sayfaları) —
// yeni revizyonlar için başlangıç şablonu ve golden testlerin fikstürü.
// Kaynak: reference/excel-dump (statik hücreler + çapraz referans VALUE'ları).

import type { BucklingInputs } from "../modules/buckling";
import type {
  EndCarriageDeps,
  EndCarriageInputs,
  EndCarriageSelections,
} from "../modules/endCarriage";
import type { GirderDeps, GirderInputs, GirderSelections } from "../modules/mainGirder";

/** 07-ANA KİRİŞ çapraz referansları (dökümdeki VALUE'lar) */
export const V5_GIRDER_DEPS: GirderDeps = {
  mainHookBlockWeightKg: 3250,          // 02!L14
  mainRopeWeightKg: 250,                // 02!L15
  trolleyWeightT: 2.5,                  // 05!L5
  trolleyWheelCount: 4,                 // 05!L10
  trolleyActualSpeedMpm: 40.0823890285594, // 05!L109
  trolleyAccelTimeS: 3.34019908571329,  // 05!L110
  bridgeGirdersWeightT: 15,             // 06!L6
  bridgeEndCarriagesWeightT: 2,         // 06!L7
  bridgeWheelCount: 4,                  // 06!L14
  bridgeActualSpeedMpm: 61.0254372959817, // 06!L115
  bridgeAccelTimeS: 5.08545310799848,   // 06!L117
};

export const V5_GIRDER_INPUTS: GirderInputs = {
  railHeightMm: 40,           // C5  (hr)
  t1Mm: 8,                    // C6
  b1Mm: 300,                  // C7
  t2Mm: 8,                    // C8
  b2Mm: 460,                  // C9
  t3Mm: 8,                    // C10
  h3Mm: 990,                  // C11
  t4Mm: 8,                    // C12
  t5Mm: 8,                    // C13
  b5Mm: 440,                  // C14
  t6Mm: 0,                    // C15
  b6Mm: 0,                    // C16
  aMm: 320,                   // C17
  xMm: 80,                    // C18
  hookTopPositionM: 12,       // E68
  psiHK: 2,                   // D80
  psiHA: 2.31,                // D81
  bridgeAxleSpacingM: 3.75,   // D86
  trolleyWheelSpacingM: 3,    // D87
  trolleyAxleSpacingM: 3,     // D88
  trolleyDrivenWheels: 2,     // E101
  bridgeDrivenWheels: 4,      // E120
  amplifyYc: 1.14,            // E138 (A6 sınıfı)
  dynTestFactorR1: 1.1,       // E161
  statTestFactorR2: 1.25,     // E162
  railLeverCMm: 741.9,        // D230
  diaphragmSpacingMm: 2000,   // D242
  wheelContactHMm: 75,        // D264
  wheelContactTMm: 12,        // D265
  sigmaYMaxNmm2: 34,          // F397
  sigmaYMinNmm2: 8,           // F402
  fatigueTensileNmm2: 350,    // F417
  deflectionLimitRatio: 750,  // Excel'de yok; yaygın pratik L/750 (nonExcel kontrol)
};

export const V5_GIRDER_SELECTIONS: GirderSelections = {
  fatigueMaterial: "S235JR",  // F405
  fatigueLoadGroup: "B4",     // F406
  fatigueNotchClass: "K3",    // F407
  staticMaterial: "St52",     // B359 — "Seçilen Malzeme S355 (St 52)"
};

/** 08-BURUŞMA KONTROLÜ girdileri */
export const V5_BUCKLING_INPUTS: BucklingInputs = {
  side: {
    elasticModulus: 210000,   // L9
    poisson: 0.3,             // L10
    thicknessMm: 8,           // L11
    panelWidthMm: 300,        // L12
    stiffenerSpacingMm: 2000, // L13
    sigma1: 110,              // L21
    sigma2: 50,               // L22
    tau: -30,                 // L23
  },
  top: {
    elasticModulus: 210000,   // L68
    poisson: 0.3,             // L69
    thicknessMm: 8,           // L70
    panelWidthMm: 590,        // L71
    stiffenerSpacingMm: 1500, // L72
    sigma1: 80,               // L80
    sigma2: 60,               // L81
    tau: 0,                   // L82
  },
  sideCorrectedCriticalNmm2: 322, // L54
};

/** 09-BAŞKİRİŞ çapraz referansları */
export const V5_ENDCARRIAGE_DEPS: EndCarriageDeps = {
  mainHoistTotalLoadKg: 7500,     // 02!L16
  trolleyWeightT: 2.5,            // 06!L5
  bridgeGirdersWeightT: 15,       // 06!L6
  bridgeEndCarriagesWeightT: 2,   // 06!L7
};

export const V5_ENDCARRIAGE_INPUTS: EndCarriageInputs = {
  wheelSpanAMm: 2200,          // L14
  loadOffsetBMm: 750,          // L15
  topPlateThicknessMm: 10,     // L24
  topPlateWidthMm: 200,        // N24
  sidePlateThicknessMm: 10,    // L25
  sidePlateHeightMm: 320,      // N25
  bottomPlateThicknessMm: 10,  // L26
  bottomPlateWidthMm: 200,     // N26
  fatigueTensileNmm2: 350,     // 07!F417 deseni (S235JR σB; Excel 09'da bozuk L82)
};

export const V5_ENDCARRIAGE_SELECTIONS: EndCarriageSelections = {
  hoistClass: "H2",           // L37
  material: "S235JR",         // L49
  fatigueMaterial: "S235JR",  // Excel niyeti (bozuk #ref! → L49 malzemesi)
  fatigueLoadGroup: "B2",     // L64
  fatigueNotchClass: "K3",    // L65
};
