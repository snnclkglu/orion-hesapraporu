// Ana kiriş hesabı — Excel "07-ANA KİRİŞ" sayfasının parametrik karşılığı.
// Akış: kutu kesit özellikleri → yükler (FEM dinamik katsayı) → FEM yük
// kombinasyonları → gerilme analizi (von Mises) → DIN 15018 yorulma →
// sehim. Formül zinciri hücre hücre korunur; golden testler `cells`
// haritasını Excel V5 dökümüyle karşılaştırır.
//
// Birimler Excel ile aynıdır: mm, cm², cm³, cm⁴, kg, kg/cm², kg·cm,
// m, m/s, m/s², s, N/mm².
//
// Not: Bu sayfada Excel her yerde PI() (tam hassasiyet) kullanır (D70);
// hoistGroup'taki 3.14159 kısaltması burada yoktur.

import { DIN15018_T17 } from "../tables";
import type { AnyCheck, LoadGroup, ModuleResult, TechnicalSpecs } from "../types";

/** DIN 15018 çentik durumu sınıfları (Tablo 17 sütunları) */
export type NotchClass = "W0" | "W1" | "W2" | "K0" | "K1" | "K2" | "K3" | "K4";
/** Yorulma malzemesi (DIN 15018 T17 satır blokları) */
export type FatigueMaterial = "S235JR" | "S355JR";
/** Statik izin gerilmesi tablosu malzemeleri (FEM T.3.2.1.1) */
export type GirderStaticMaterial = "St37" | "St44" | "St52";

/** FEM Table T.3.2.1.1 — yükleme durumu I/II/III izin gerilmeleri [kg/cm²]
 * (Excel 07 D355:H357 statikleri) */
export const GIRDER_ALLOWABLE_STRESS: Record<
  GirderStaticMaterial,
  { case1: number; case2: number; case3: number }
> = {
  St37: { case1: 1630, case2: 1834, case3: 2191 },
  St44: { case1: 1783, case2: 1987, case3: 2450 },
  St52: { case1: 2450, case2: 2750, case3: 3310 },
};

/** Diğer sayfalardan çekilen değerler (Excel çapraz referansları) */
export interface GirderDeps {
  mainHookBlockWeightKg: number;   // 02!L14 — kanca bloğu/kepçe ağırlığı
  mainRopeWeightKg: number;        // 02!L15 — halat ağırlığı
  trolleyWeightT: number;          // 05!L5  — araba ağırlığı [t]
  trolleyWheelCount: number;       // 05!L10 — araba teker sayısı
  trolleyActualSpeedMpm: number;   // 05!L109 — gerçekleşen araba hızı [m/dak]
  trolleyAccelTimeS: number;       // 05!L110 — araba ivmelenme süresi [s]
  bridgeGirdersWeightT: number;    // 06!L6  — köprü ana kirişleri ağırlığı [t]
  bridgeEndCarriagesWeightT: number; // 06!L7 — başkirişler ağırlığı [t]
  bridgeWheelCount: number;        // 06!L14 — köprü teker sayısı
  bridgeActualSpeedMpm: number;    // 06!L115 — gerçekleşen köprü hızı [m/dak]
  bridgeAccelTimeS: number;        // 06!L117 — köprü ivmelenme süresi [s]
}

/** Kullanıcı girdileri — Excel 07 sayfasındaki statikler */
export interface GirderInputs {
  railHeightMm: number;        // C5  — hr (ray yüksekliği, gösterim)
  t1Mm: number;                // C6  — üst flanş kalınlığı t1
  b1Mm: number;                // C7  — üst flanş genişliği b1
  t2Mm: number;                // C8  — üst iç flanş kalınlığı t2
  b2Mm: number;                // C9  — üst iç flanş genişliği b2
  t3Mm: number;                // C10 — ana gövde sacı kalınlığı t3
  h3Mm: number;                // C11 — gövde yüksekliği h3
  t4Mm: number;                // C12 — yardımcı gövde sacı kalınlığı t4
  t5Mm: number;                // C13 — alt flanş kalınlığı t5
  b5Mm: number;                // C14 — alt flanş genişliği b5
  t6Mm: number;                // C15 — ek flanş kalınlığı t6
  b6Mm: number;                // C16 — ek flanş genişliği b6
  aMm: number;                 // C17 — gövde sacları arası mesafe a
  xMm: number;                 // C18 — kenar mesafesi x
  hookTopPositionM: number;    // E68 — kancanın en üst konumu l [m]
  psiHK: number;               // D80 — ψhK (Fig. FEM A.2.2.1, köprü)
  psiHA: number;               // D81 — ψhA (Fig. FEM A.2.2.1, araba)
  bridgeAxleSpacingM: number;  // D86 — köprü dingil açıklığı [m]
  trolleyWheelSpacingM: number; // D87 — araba tekerlek açıklığı [m]
  trolleyAxleSpacingM: number; // D88 — araba dingil açıklığı [m]
  trolleyDrivenWheels: number; // E101 — araba tahrikli teker sayısı
  bridgeDrivenWheels: number;  // E120 — köprü tahrikli teker sayısı
  amplifyYc: number;           // E138 — arttırma katsayısı γc (A6 → 1.14)
  dynTestFactorR1: number;     // E161 — dinamik test katsayısı ρ1
  statTestFactorR2: number;    // E162 — statik test katsayısı ρ2
  railLeverCMm: number;        // D230 — kayma merkezi kolu c [mm]
  diaphragmSpacingMm: number;  // D242 — iki perde arası l1 [mm]
  wheelContactHMm: number;     // D264 — tekerlek basınç yayılım yüksekliği h [mm]
  wheelContactTMm: number;     // D265 — tekerlek basıncı taşıyan sac kalınlığı t [mm]
  sigmaYMaxNmm2: number;       // F397 — σy,maks (elle girilen) [N/mm²]
  sigmaYMinNmm2: number;       // F402 — σy,min (elle girilen) [N/mm²]
  fatigueTensileNmm2: number;  // F417 — malzeme kopma dayanımı σB [N/mm²]
  deflectionLimitRatio: number; // Sehim sınırı L/x (Excel'de kontrol hücresi yok)
}

/** Mühendis seçimleri */
export interface GirderSelections {
  fatigueMaterial: FatigueMaterial;    // F405 — S235JR / S355JR
  fatigueLoadGroup: LoadGroup;         // F406 — B1..B6 (DIN 15018)
  fatigueNotchClass: NotchClass;       // F407 — W0..K4 (DIN 15018)
  staticMaterial: GirderStaticMaterial; // B359 — "Seçilen Malzeme S355 (St 52)"
}

export interface GirderValues {
  // Kesit özellikleri
  heightMm: number;            // C20
  areaCm2: number;             // C21
  weightPerM: number;          // C22
  czMm: number;                // C23
  iyyCm4: number;              // C24
  wyyBottomCm3: number;        // C25
  wyyTopCm3: number;           // C26
  cyMm: number;                // I21
  izzCm4: number;              // I22
  wzzBottomCm3: number;        // I23
  wzzTopCm3: number;           // I24
  torsionIxxCm4: number;       // I20
  // Yükler
  bridgeWeightKg: number;      // D34
  trolleyWeightKg: number;     // D35
  liveLoadKg: number;          // D39
  totalLiveLoadKg: number;     // D41
  dynamicFactor: number;       // D46
  trolleyAccelMs2: number;     // D57
  bridgeAccelMs2: number;      // D61
  trolleyHorizontalLoadKg: number; // D105 (Fha1)
  trolleySkewLoadKg: number;   // D109 (Fha2)
  bridgeHorizontalLoadKg: number;  // D124 (Fhk1)
  bridgeSkewLoadKg: number;    // D128 (Fhk2)
  // Gerilme analizi
  sigmaXBottomCase1: number;   // E362
  sigmaXTopCase1: number;      // E363
  sigmaZCase1: number;         // E364
  shearMainCase1: number;      // E365
  shearSecondaryCase1: number; // E366
  sigmaCombBottomCase1: number; // E367
  sigmaCombTopCase1: number;   // E368
  ycSigmaCombBottom: number;   // E374 — γc·σcomb (alt), kontrol değeri
  ycSigmaCombTop: number;      // E376
  testFactorK: number;         // D386
  sigmaCombCase3: number;      // D391
  allowableCase1: number;      // FEM T.3.2.1.1 (statik tablo)
  allowableCase3: number;
  // Yorulma (DIN 15018)
  fatigueSigmaXMax: number;    // F396 [N/mm²]
  fatigueSigmaXMin: number;    // F401
  fatigueTauMax: number;       // F398
  zulSigmaD1: number;          // F409 — zul σD(-1) T17
  zulSigmaDz0: number;         // F411 — zul σDz(0)
  kappaX: number;              // F414
  zulSigmaDzX: number;         // F419 — zul σDz(κ)
  kappaY: number;              // G424
  zulSigmaDzY: number;         // G426
  zulTauW0: number;            // G430
  zulTauDX: number;            // G431
  fatigueCombined: number;     // E435
  // Sehim
  deflectionCm: number;        // G446
  deflectionRatio: number;     // G447 (L / sehim)
}

const tick = (b: boolean) => (b ? "ü" : "û");

/** DIN 15018 Tablo 17 lookup (Excel F409/G430 HLOOKUP+MATCH karşılığı) */
function t17(material: FatigueMaterial, notch: NotchClass, group: LoadGroup): number {
  return DIN15018_T17[material === "S355JR" ? "St52" : "St37"][notch][group];
}

export function computeMainGirder(
  specs: TechnicalSpecs,
  inp: GirderInputs,
  sel: GirderSelections,
  deps: GirderDeps
): ModuleResult<GirderValues> {
  const cells: Record<string, number | string> = {};
  const checks: AnyCheck[] = [];

  // Excel hücre adlarıyla yerel değişkenler (formül sadakati için)
  const C5 = inp.railHeightMm;
  const C6 = inp.t1Mm, C7 = inp.b1Mm, C8 = inp.t2Mm, C9 = inp.b2Mm;
  const C10 = inp.t3Mm, C11 = inp.h3Mm, C12 = inp.t4Mm;
  const C13 = inp.t5Mm, C14 = inp.b5Mm, C15 = inp.t6Mm, C16 = inp.b6Mm;
  const C17 = inp.aMm, C18 = inp.xMm;
  void C5; // gösterim amaçlı girdi; formüllerde kullanılmaz

  // --- 7.1 Kesit özellikleri ----------------------------------------------
  const A6 = C6 * C7;    // üst flanş alanı [mm²]
  const A8 = C8 * C9;
  const A10 = C10 * C11;
  const A11 = C11 * C12;
  const A13 = C13 * C14;
  const A15 = C15 * C16;
  const sumA = A6 + A8 + A10 + A11 + A13 + A15; // SUM(A6:A15)
  const C20 = C6 + C8 + C11 + C13 + C15; // toplam yükseklik h [mm]
  const C21 = sumA * 0.01; // alan [cm²]
  const C22 = C21 * 100000 * 0.000008; // birim ağırlık [kg/m]
  const C23 =
    (((C15 * C16) * (0.5 * C15) +
      (C13 * C14) * (C15 + 0.5 * C13) +
      ((C10 + C12) * C11 * (C15 + C13 + 0.5 * C11)) +
      (C8 * C9) * (C15 + C13 + C11 + 0.5 * C8) +
      (C6 * C7) * (C15 + C13 + C11 + C8 + 0.5 * C6)) * 0.01) / C21; // Cz [mm]
  const C24 =
    ((1 / 12) * (C7 * C6 ** 3 + C9 * C8 ** 3 + (C10 + C12) * C11 ** 3 + C14 * C13 ** 3 + C16 * C15 ** 3) +
      (C23 - 0.5 * C15) ** 2 * A15 +
      (C23 - C15 - 0.5 * C13) ** 2 * A13 +
      (C23 - C15 - C13 - 0.5 * C11) ** 2 * (C11 * (C12 + C10)) +
      (C23 - C15 - C13 - C11 - 0.5 * C8) ** 2 * A8 +
      (C23 - C15 - C13 - C11 - C8 - 0.5 * C6) ** 2 * A6) * 0.1 ** 4; // Iyy [cm⁴]
  const C25 = (C24 * 10) / C23;         // Wyy (alt) [cm³]
  const C26 = (C24 * 10) / (C20 - C23); // Wyy (üst) [cm³]
  const I21 =
    (A10 * (C18 + C10 * 0.5) +
      A11 * (C18 + C10 + C17 + C12 * 0.5) +
      A6 * ((C9 - C7) * 0.5 + C7 * 0.5) +
      A8 * C9 * 0.5 +
      A13 * ((C9 - C14) * 0.5 + C14 * 0.5) +
      A15 * ((C9 - C16) * 0.5 + C16 * 0.5)) / sumA; // Cy [mm]
  const I22 =
    ((1 / 12) * (C7 ** 3 * C6 + C9 ** 3 * C8 + C11 * (C10 ** 3 + C12 ** 3) + C14 ** 3 * C13 + C16 ** 3 * C15) +
      ((C9 - C7) * 0.5 + C7 * 0.5 - I21) ** 2 * A6 +
      ((C18 + C10 * 0.5) - I21) ** 2 * A10 +
      ((C18 + C10 + C17 + C12 * 0.5) - I21) ** 2 * A11 +
      ((C9 - C14) * 0.5 + 0.5 * C14 - I21) ** 2 * A13 +
      ((C9 - C16) * 0.5 - C16 * 0.5 - I21) ** 2 * A15) / 10 ** 4; // Izz [cm⁴]
  const I23 = (10 * I22) / I21;        // Wzz (alt) [cm³]
  const I24 = (10 * I22) / (C9 - I21); // Wzz (üst) [cm³]
  const I25 = (C8 ** 3 * C9 + C10 ** 3 * C11 + C12 ** 3 * C11 + C13 ** 3 * C14) * 0.1 ** 4 / 3;
  const I26 = (C17 + C10 * 0.5 + C12 * 0.5) * 0.1; // b [cm]
  const I27 = (C11 + 0.5 * C13 + 0.5 * C8) * 0.1;  // h [cm]
  const I20 =
    C10 === 0
      ? I25
      : C12 === 0
        ? I25
        : (4 * (I26 * I27) ** 2) /
          (I26 / (C8 * 0.1) + I26 / (0.1 * C13) + I27 / (0.1 * C10) + I27 / (0.1 * C12)); // Ixx (tors) [cm⁴]
  Object.assign(cells, {
    A6, A8, A10, A11, A13, A15, C20, C21, C22, C23, C24, C25, C26,
    I20, I21, I22, I23, I24, I25, I26, I27,
  });

  // --- 7.2 Yükler -----------------------------------------------------------
  const D34 = ((deps.bridgeGirdersWeightT + deps.bridgeEndCarriagesWeightT) / 2) * 1000; // Wv [kg]
  const D35 = deps.trolleyWeightT * 1000; // Wa [kg]
  const D39 = specs.mainCapacityT * 1000; // yük [kg]
  const D40 = deps.mainHookBlockWeightKg + deps.mainRopeWeightKg; // kanca altı [kg]
  const D41 = D39 + D40;
  const D45 = specs.mainLiftSpeedMpm / 60; // Vl [m/s]
  // FEM dinamik katsayı ψ (Excel D46)
  const D46 = D45 < 0.25 ? 1.15 : D45 > 1 ? 1.6 : 1 + D45 * 0.6;
  const D55 = deps.trolleyActualSpeedMpm / 60; // VA [m/s]
  const D56 = deps.trolleyAccelTimeS;
  const D57 = D55 / D56; // aA [m/s²]
  const D59 = deps.bridgeActualSpeedMpm / 60;
  const D60 = deps.bridgeAccelTimeS;
  const D61 = D59 / D60; // aK [m/s²]
  const D70 = 2 * Math.PI * Math.sqrt(inp.hookTopPositionM / 9.81); // T1 [s]
  const D71 = D39 / D34; // m (köprü)
  const D73 = D39 / D35; // m (araba)
  const D75 = D60 / D70; // β (köprü)
  const D77 = D56 / D70; // β (araba)
  const D80 = inp.psiHK, D81 = inp.psiHA;
  const D85 = specs.spanM; // p [m]
  const D86 = inp.bridgeAxleSpacingM;
  const D87 = inp.trolleyWheelSpacingM;
  const D88 = inp.trolleyAxleSpacingM;
  const clampLambda = (v: number) => (v < 0.05 ? 0.05 : v > 0.2 ? 0.2 : v);
  const D89 = clampLambda((0.025 * D85) / D86); // λK
  const D90 = clampLambda((0.025 * D87) / D88); // λA
  // 2.3.1 Araba
  const D98 = (D57 * (D39 * D81 + 2 * D35)) / 9.81; // F'ha1 [kg]
  const E100 = D35 / deps.trolleyWheelCount; // PT [kg]
  const E101 = inp.trolleyDrivenWheels;
  const D103 = (E101 * E100) / 14; // F''ha1 [kg]
  const D105 = D103 < D98 ? D103 / 2 : D98 / 2; // Fha1 [kg/tahrikli teker]
  const D109 = (D35 + D39) * D90; // Fha2 [kg]
  // 2.3.2 Köprü
  const D117 = (D61 * (2 * D34)) / 9.81; // F'hk1 [kg]
  const E119 = D34 / deps.bridgeWheelCount; // PT [kg]
  const E120 = inp.bridgeDrivenWheels;
  const D122 = (E120 * E119) / 14; // F''hk1 [kg]
  const D124 = D122 < D117 ? D122 / 2 : D117 / 2; // Fhk1 [kg]
  const D128 = (D34 + D39) * D89; // Fhk2 [kg]
  Object.assign(cells, {
    D34, D35, D39, D40, D41, D45, D46, D55, D56, D57, D59, D60, D61,
    D70, D71, D73, D75, D77, D85, D89, D90,
    D98, E100, D103, D105, D109, D117, E119, D122, D124, D128,
  });

  // --- 7.4 Gerilme analizi --------------------------------------------------
  const D172 = D88 * 1000; // a [mm]
  const D174 = specs.spanM * 1000; // L [mm]
  const D173 = (D174 - D172) / 2; // b [mm]
  // 4.1.1 z-yönü yükleri
  const D183 = D34;
  const D184 = (D174 * D183) / 80; // My [kg·cm]
  const D186 = D184 / C25;  // σx (alt)
  const D187 = -D184 / C26; // σx (üst)
  const D191 = D35 / 4; // P teker [kg]
  const D192 = (D173 * D191) / 10;
  const D194 = D192 / C25;
  const D195 = -D192 / C26;
  const D199 = D39 / 4; // Ptek [kg]
  const D200 = (D173 * D199) / 10;
  const I192 = D184 + D192 + D200; // toplam My (gösterim)
  const D202 = D200 / C25;
  const D203 = -D200 / C26;
  // 4.1.2 y-yönü yükleri
  const D209 = D124;
  const D210 = (D174 * D209) / 80;
  const D212 = D210 / I23;
  const D213 = D210 / I24;
  const D217 = D109;
  const D218 = (D172 * D217) / 20;
  const D220 = D218 / I23;
  const D221 = D218 / I24;
  // 4.1.3 x-yönü yükleri
  const D230 = inp.railLeverCMm;
  const D231 = D105;
  const D232 = (D230 * D231) / 10;
  const D234 = D232 / C25;
  const D235 = D232 / C26;
  // 4.1.4 İkincil momentler
  const D242 = inp.diaphragmSpacingMm;
  const D246 = D191;
  const D247 = (D242 * D246) / 50; // Mysec [kg·cm]
  const D249 = D247 / C25 / 3;
  const D250 = -D247 / C26 / 3;
  const D254 = D199;
  const D255 = (D242 * D254) / 50;
  const D257 = D255 / C25;
  const D258 = -D255 / C26;
  // 4.2 Tekerlek basıncı
  const D264 = inp.wheelContactHMm, D265 = inp.wheelContactTMm;
  const D266 = 2 * D264 + 40; // l [mm]
  const D271 = -(D246 / 2) / ((0.2 * D264 + 5) * D265 * 0.1); // σz (araba)
  const D275 = -(D254 / 2) / ((0.2 * D264 + 5) * D265 * 0.1); // σz (yük)
  // 4.3.1 Burulma (kesme)
  const D286 = D191;
  const D287 = (D286 * (I21 - (C18 + C10 / 2))) / 10; // T [kg·cm]
  const D289 = D287 / (2 * C21 * ((C10 + C12) / 2)); // σs (araba)
  const D293 = D199;
  const D294 = (D293 * (I21 - (C18 + C10 / 2))) / 10;
  const D296 = D294 / (2 * C21 * ((C10 + C12) / 2)); // σs (yük)
  // 4.3.2 Kesme
  const D306 = C20 - C23 - C8; // b [mm]
  const D307 = D183;
  const D308 = (C11 * C10) / 100; // Amw [cm²]
  const D310 = (D307 * (D242 - 2 * D306)) / (2 * D242 * D308); // τm (ana gövde)
  const D314 = D307 / 2;
  const D315 = (C11 * C12) / 100; // Asw [cm²]
  const D317 = (0.5 * D314 * (D242 - 2 * D306)) / (2 * D242 * D315); // τss
  const D323 = D191;
  const D324 = D308;
  const D326 = D323 / D324; // τsm (araba)
  const D330 = D323 / 2;
  const D331 = D315;
  const D333 = D330 / D331;
  const D341 = D199;
  const D342 = D324;
  const D343 = D341 / D342; // τsm (yük)
  const D346 = D341 / 2;
  const D347 = D331;
  const D349 = D346 / D347;
  Object.assign(cells, {
    D172, D173, D174, D183, D184, D186, D187, D191, D192, I192, D194, D195,
    D199, D200, D202, D203, D209, D210, D212, D213, D217, D218, D220, D221,
    D231, D232, D234, D235, D246, D247, D249, D250, D254, D255, D257, D258,
    D266, D271, D275, D286, D287, D289, D293, D294, D296,
    D306, D307, D308, D310, D314, D315, D317, D323, D324, D326, D330, D331,
    D333, D341, D342, D343, D346, D347, D349,
  });

  // --- Toplam gerilmeler (Yükleme Durumu I) ---------------------------------
  const E138 = inp.amplifyYc;
  const E362 = D186 + D194 + D46 * D202 + D212 + D220 + D234 + D249 + D46 * D257;
  const E363 = D187 + D195 + D46 * D203 - D213 - D221 - D235 + D250 + D46 * D258;
  const E364 = D271 + D46 * D275;
  const E365 = D289 + D46 * D296 + D310 + D326 + D46 * D343;
  const E366 = D289 + D46 * D296 + D317 + D333 + D46 * D349;
  const E367 = Math.sqrt(E362 ** 2 + E364 ** 2 - Math.abs(E362 * E364) + 3 * E366 ** 2);
  const E368 = Math.sqrt(E363 ** 2 + E364 ** 2 - Math.abs(E363 * E364) + 3 * E366 ** 2);
  const E369 = E138 * E362;
  const E370 = E138 * E365;
  const E371 = E138 * E363;
  const E372 = E138 * E366;
  const E373 = E138 * E364;
  const E374 = E138 * E367; // γc·σcomb (alt)
  const E375 = E138 * E363;
  const E376 = E138 * E368; // γc·σcomb (üst)
  // Yükleme Durumu III (dinamik/statik test)
  const E161 = inp.dynTestFactorR1, E162 = inp.statTestFactorR2;
  const D386 = D46 * E161 > E162 ? D46 * E161 : E162; // k
  const D388 = D186 + D194 + D386 * D202 + D212 + D220 + D234 + D249 + D386 * D257;
  const D389 = D289 + D386 * D296 + D310 + D326 + D386 * D343;
  const D390 = D271 + D386 * D275;
  const D391 = Math.sqrt(D388 ** 2 + D390 ** 2 - Math.abs(D388 * D390) + 3 * D389 ** 2);
  Object.assign(cells, {
    E362, E363, E364, E365, E366, E367, E368, E369, E370, E371, E372, E373,
    E374, E375, E376, D386, D388, D389, D390, D391,
  });

  const allow = GIRDER_ALLOWABLE_STRESS[sel.staticMaterial];
  checks.push({
    id: "girder.stress.case1",
    label: "Yükleme Durumu I bileşik gerilme (γc·σcomb)",
    required: Math.max(E374, E376), provided: allow.case1, unit: "kg/cm²", op: ">=",
    pass: allow.case1 >= Math.max(E374, E376),
    standard: "FEM 1.001 T.3.2.1.1", nonExcel: true,
  });
  checks.push({
    id: "girder.stress.case3",
    label: "Yükleme Durumu III bileşik gerilme (test durumu)",
    required: D391, provided: allow.case3, unit: "kg/cm²", op: ">=",
    pass: allow.case3 >= D391,
    standard: "FEM 1.001 T.3.2.1.1", nonExcel: true,
  });

  // --- 7.5 Yorulma kontrolü (DIN 15018) ------------------------------------
  const F396 = E362 / 9.81; // σx,maks [N/mm²]
  const F397 = inp.sigmaYMaxNmm2;
  const F398 = E364 / 9.81; // τ,maks [N/mm²]
  const F401 = D186 / 9.81; // σx,min [N/mm²]
  const F402 = inp.sigmaYMinNmm2;
  const F403 = D326 / 9.81; // τ,min [N/mm²]
  const F409 = t17(sel.fatigueMaterial, sel.fatigueNotchClass, sel.fatigueLoadGroup); // zul σD(-1)
  const F411 = (F409 * 5) / 3; // zul σDz(0)
  const F414 = F401 / F396; // κ (σx)
  const F417 = inp.fatigueTensileNmm2; // σB
  const F419 = F411 / (1 - (1 - F411 / F417 / 0.75) * F414); // zul σDz(κ) — T18
  const E422 = F396, G422 = F419;
  const H422 = tick(E422 <= G422);
  const G424 = F402 / F397; // κ (σy)
  const G426 = F411 / (1 - (1 - F411 / F417 / 0.75) * G424);
  const E428 = F397, G428 = G426;
  const H428 = tick(E428 <= G428);
  const G430 = t17(sel.fatigueMaterial, "W0", sel.fatigueLoadGroup); // zul τ için W0
  const G431 = G430 / Math.sqrt(3); // zul τD(κ)
  const E433 = F398, G433 = G431;
  const H433 = tick(E433 <= G433);
  const E435 =
    (E422 / G422) ** 2 + (E428 / G428) ** 2 - (E422 * E428) / (G428 * G422) + (E433 / G433) ** 2;
  const G435 = 1.1;
  const H435 = tick(E435 <= G435);
  Object.assign(cells, {
    F396, F398, F401, F403, F409, F411, F414, F419,
    E422, G422, H422, G424, G426, E428, G428, H428,
    G430, G431, E433, G433, H433, E435, H435,
  });
  checks.push({
    id: "girder.fatigue.sigmaX",
    label: "Yorulma σx,maks ≤ zul σDz(κ)",
    required: E422, provided: G422, unit: "N/mm²", op: ">=", pass: E422 <= G422,
    standard: "DIN 15018 T.17/18",
  });
  checks.push({
    id: "girder.fatigue.sigmaY",
    label: "Yorulma σy,maks ≤ zul σDz(κ)",
    required: E428, provided: G428, unit: "N/mm²", op: ">=", pass: E428 <= G428,
    standard: "DIN 15018 T.17/18",
  });
  checks.push({
    id: "girder.fatigue.tau",
    label: "Yorulma τ,maks ≤ zul τD(κ)",
    required: E433, provided: G433, unit: "N/mm²", op: ">=", pass: E433 <= G433,
    standard: "DIN 15018 T.17",
  });
  checks.push({
    id: "girder.fatigue.combined",
    label: "Bileşik yorulma oranı",
    required: E435, provided: G435, unit: "-", op: ">=", pass: E435 <= G435,
    standard: "DIN 15018 7.4.5",
  });

  // --- 7.6 Sehim kontrolü ---------------------------------------------------
  const G441 = D191 + D199; // tekerlek yükü [kg]
  const G442 = D172 / 10;   // b [cm]
  const G444 = D174 / 10;   // l [cm]
  const G443 = (G444 - G442) / 2; // a [cm]
  const G445 = C24; // I [cm⁴]
  const G446 = -1 * ((G441 * G443 * (4 * G443 ** 2 - 3 * G444 ** 2)) / 24 / 2100000 / G445); // sehim [cm]
  const G447 = G444 / G446; // sehim oranı L/δ
  Object.assign(cells, { G441, G442, G443, G444, G445, G446, G447 });
  checks.push({
    id: "girder.deflection",
    label: "Sehim oranı (L/δ)",
    required: inp.deflectionLimitRatio, provided: G447, unit: "-", op: ">=",
    pass: G447 >= inp.deflectionLimitRatio, nonExcel: true,
    standard: "CMAA 70 3.5.5.1",
  });

  const values: GirderValues = {
    heightMm: C20,
    areaCm2: C21,
    weightPerM: C22,
    czMm: C23,
    iyyCm4: C24,
    wyyBottomCm3: C25,
    wyyTopCm3: C26,
    cyMm: I21,
    izzCm4: I22,
    wzzBottomCm3: I23,
    wzzTopCm3: I24,
    torsionIxxCm4: I20,
    bridgeWeightKg: D34,
    trolleyWeightKg: D35,
    liveLoadKg: D39,
    totalLiveLoadKg: D41,
    dynamicFactor: D46,
    trolleyAccelMs2: D57,
    bridgeAccelMs2: D61,
    trolleyHorizontalLoadKg: D105,
    trolleySkewLoadKg: D109,
    bridgeHorizontalLoadKg: D124,
    bridgeSkewLoadKg: D128,
    sigmaXBottomCase1: E362,
    sigmaXTopCase1: E363,
    sigmaZCase1: E364,
    shearMainCase1: E365,
    shearSecondaryCase1: E366,
    sigmaCombBottomCase1: E367,
    sigmaCombTopCase1: E368,
    ycSigmaCombBottom: E374,
    ycSigmaCombTop: E376,
    testFactorK: D386,
    sigmaCombCase3: D391,
    allowableCase1: allow.case1,
    allowableCase3: allow.case3,
    fatigueSigmaXMax: F396,
    fatigueSigmaXMin: F401,
    fatigueTauMax: F398,
    zulSigmaD1: F409,
    zulSigmaDz0: F411,
    kappaX: F414,
    zulSigmaDzX: F419,
    kappaY: G424,
    zulSigmaDzY: G426,
    zulTauW0: G430,
    zulTauDX: G431,
    fatigueCombined: E435,
    deflectionCm: G446,
    deflectionRatio: G447,
  };

  return { values, checks, cells };
}
