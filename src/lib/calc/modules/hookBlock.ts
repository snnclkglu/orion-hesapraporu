// Kanca bloğu hesabı — Excel "04-KANCA BLOĞU" sayfasının parametrik karşılığı.
// Formül zinciri hücre hücre korunmuştur; her hesaplanan değer `cells`
// haritasında Excel adresiyle yer alır ve golden testler bu haritayı Excel V5
// dökümüyle karşılaştırır.
//
// ÖNEMLİ — §4.6 yorulma bloğu Excel'de BOZUKTUR (silinmiş malzeme dropdown'ına
// giden #ref! referansları; L134, L154, L166, L169, L177 zinciri #NAME?/#VALUE!
// hata değerleri üretir). Bu blok burada 07-ANA KİRİŞ sayfasının ÇALIŞAN
// DIN 15018 T17 mantığından (F409/G430: HLOOKUP+MATCH → tables.DIN15018_T17)
// temiz olarak yeniden yazılmıştır ve `fatigueMaterial` (S235JR/S355JR) girdisi
// silinen dropdown'ın yerine eklenmiştir. Bu satırların kontrolleri Excel'de
// karşılık üretilemediği için `nonExcel: true` işaretlidir ve hücre haritasına
// KONMAZ (golden test bu hücreleri hata değerleri sebebiyle hariç tutar).
//
// Birimler Excel ile aynıdır: kg, kg/cm², kg·cm, kN, mm, cm, d/dak, N/mm².
// Bu sayfada Excel her yerde PI() kullanır (3.14159 sabiti yok) → Math.PI.

import { mechanismLife, sheaveCoefficient } from "../coefficients";
import { DIN15018_T17 } from "../tables";
import type { AnyCheck, LoadGroup, ModuleResult, TechnicalSpecs } from "../types";

/** §4.6 kiriş yorulma malzemesi — Excel'de silinmiş dropdown'ın geri getirilmişi */
export type FatigueMaterial = "S235JR" | "S355JR";

/** DIN 15018 çentik sınıfı (T17 sütunları): W kaynaksız, K kaynaklı */
export type NotchClass = "W0" | "W1" | "W2" | "K0" | "K1" | "K2" | "K3" | "K4";

/**
 * Kanca bloğu mili malzemeleri (Excel L71:L73 IF zinciri, KATSAYILAR E34:J36).
 * Ana kaldırma milinden (ShaftMaterial) farkı: C45 de listededir.
 */
export type HookShaftMaterial = "C25" | "C30" | "C35" | "C45" | "4140+QT" | "4140";

/** İzin verilen gerilmeler [kg/cm²] — KATSAYILAR E34:J36 (CMAA #74, 4.5).
 * Not: Excel L72'de "4140+QT" dalı çapa hatasıyla J35'e (4140 kesmesi) bakar;
 * doğrusu I35=900'dür ve burada doğrusu kullanılır (V5 golden'ı etkilemez, C45 seçili). */
const HOOK_SHAFT_MATERIALS: Record<HookShaftMaterial, { bending: number; shear: number; combined: number }> = {
  C25: { bending: 850, shear: 490, combined: 850 },        // E34/E35/E36
  C30: { bending: 920, shear: 530, combined: 920 },        // F34/F35/F36
  C35: { bending: 980, shear: 565, combined: 980 },        // G34/G35/G36
  C45: { bending: 1180, shear: 680, combined: 1180 },      // H34/H35/H36
  "4140+QT": { bending: 1570, shear: 900, combined: 1570 },// I34/I35/I36
  "4140": { bending: 1300, shear: 1300 / Math.sqrt(3), combined: 1300 }, // J34/J35/J36
};

/** §4.6 yorulma için malzeme kopma dayanımı σB [N/mm²].
 * Excel L166 bozuk ArrayFormula; 07-ANA KİRİŞ!F417 (S235JR=350) ile uyumlu,
 * S355JR için standart 510 N/mm². */
const ULTIMATE_STRENGTH_NMM2: Record<FatigueMaterial, number> = {
  S235JR: 350,
  S355JR: 510,
};

/** FEM T.3.2.1.1 statik izin gerilmesi [kg/cm²] — Excel L134'ün (bozuk) niyeti */
const ALLOWABLE_STATIC_KGCM2: Record<FatigueMaterial, number> = {
  S235JR: 1530,
  S355JR: 2300,
};

/**
 * Ana kaldırma sayfasından ('02-ANA KALDIRMA GRUBU') çekilen değerler.
 * Modül saf kalsın diye parametre olarak alınır; kaynak hücreler yorumda.
 */
export interface HookBlockDeps {
  ropeDiaMm: number;         // 02!L24 — halat çapı [mm]
  ropeLoadKg: number;        // 02!L19 — halat yükü T [kg]
  loadKg: number;            // 02!L13 — kaldırılan yük [kg]
  hookBlockWeightKg: number; // 02!L14 — kanca bloğu / kepçe ağırlığı [kg]
  ropeWeightKg: number;      // 02!L15 — halat ağırlığı [kg]
  totalLoadKg: number;       // 02!L16 — toplam yük [kg]
  drumRpm: number;           // 02!L149 — tambur devri [d/dak]
  drumDiaMm: number;         // 02!L39 — tambur çapı [mm]
}

/** Kullanıcı girdileri (tasarım kabulleri) — Excel L/N/P/R sütunu statikleri */
export interface HookBlockInputs {
  // 4.4 Kanca bloğu mili
  shaftSpanACm: number;          // L60 — mesnet ölçüsü a [cm]
  shaftSpanCCm: number;          // L61 — mesnet ölçüsü c [cm]
  shaftDiaCm: number;            // L63 — mil çapı D [cm]
  // 4.6 Kiriş kesiti
  girderSpanMm: number;          // L101 — a [mm]
  loadOffsetMm: number;          // L102 — b [mm]
  midTopPlateThkMm: number;      // L111 — orta kesit üst sac kalınlığı [mm]
  midTopPlateWidthMm: number;    // N111 — orta kesit üst sac genişliği [mm]
  midWebPlateThkMm: number;      // L112 — orta kesit yan sac kalınlığı [mm]
  midWebPlateHeightMm: number;   // N112 — orta kesit yan sac yüksekliği [mm]
  midBottomPlateThkMm: number;   // L113 — orta kesit alt sac kalınlığı [mm]
  midBottomPlateWidthMm: number; // N113 — orta kesit alt sac genişliği [mm]
  thickTopPlateThkMm: number;    // P111 — kalın kesit üst sac kalınlığı [mm]
  thickTopPlateWidthMm: number;  // R111 — kalın kesit üst sac genişliği [mm]
  thickWebPlateThkMm: number;    // P112 — kalın kesit yan sac kalınlığı [mm]
  thickWebPlateHeightMm: number; // R112 — kalın kesit yan sac yüksekliği [mm]
  thickBottomPlateThkMm: number; // P113 — kalın kesit alt sac kalınlığı [mm]
  thickBottomPlateWidthMm: number; // R113 — kalın kesit alt sac genişliği [mm]
  hoistClass: string;            // L122 — kaldırma sınıfı (gösterim, ör. "B6")
  dynamicFactorK: number;        // L126 — ψ katsayısı k (DIN 15018 Tablo 2)
  dynamicFactorL: number;        // L127 — ψ katsayısı l
  loadGroup: LoadGroup;          // L148 — yük sınıfı B1..B6 (DIN 15018)
  notchClass: NotchClass;        // L149 — kaynak/çentik sınıfı (ör. K3)
  fatigueMaterial: FatigueMaterial; // YENİ girdi — Excel'de silinmiş dropdown (#ref! kaynağı)
}

/** Katalog seçimleri — mühendisin seçtiği bileşenler */
export interface HookBlockSelections {
  hookDesignation: string;       // A5 — kanca tanımı (ör. "DIN 15401 Nr 10 S")
  hookCapacityKg: number;        // L6 — kanca kapasitesi [kg] (DIN 15400)
  sheaveDiaMm: number;           // L14 — halat ekseninde makara çapı [mm]
  sheaveBearingType: string;     // L22 — makara rulmanı tipi
  sheaveBearingCode: string;     // L23 — makara rulmanı kodu (ör. 6213)
  sheaveBearingDynCKn: number;   // L29 — dinamik yük katsayısı C [kN]
  sheaveBearingStatC0Kn: number; // L30 — statik yük katsayısı C0 [kN]
  shaftMaterial: HookShaftMaterial; // L69 — mil malzemesi (ör. C45)
  hookBearingType: string;       // L80 — kanca rulmanı tipi
  hookBearingCode: string;       // L81 — kanca rulmanı kodu (ör. 51214)
  hookBearingStatC0Kn: number;   // L82 — statik yük katsayısı C0 [kN]
}

export interface HookBlockValues {
  // 4.2 Makaralar
  sheaveCoefficientH: number;      // L11
  minSheaveDiaMm: number;          // L10
  // 4.3 Makara rulmanları
  sheaveBearingRadialKn: number;   // L19
  sheaveBearingAxialKn: number;    // L20
  sheaveBearingEqStaticKn: number; // L26
  sheaveBearingEqDynamicKn: number;// L27
  sheaveRpm: number;               // L34
  sheaveBearingLifeHours: number;  // L36
  requiredLifeMin: number;         // L38
  requiredLifeMax: number | null;  // Q38
  sheaveBearingStaticSafety: number; // C0/P0 (Excel'de hücre yok)
  // 4.4 Kanca bloğu mili
  ropeLoadKg: number;              // L51
  doubleRopeLoadKg: number;        // L52
  reactionAKg: number;             // L58
  reactionBKg: number;             // L59
  shaftMomentKgCm: number;         // L62
  shaftSectionModulusCm3: number;  // L64
  shaftBendingStress: number;      // L65
  shaftShearStress: number;        // L66
  shaftCombinedStress: number;     // L67
  shaftAllowables: { bending: number; shear: number; combined: number }; // L71/L72/L73
  // 4.5 Kanca rulmanı
  hookBearingAxialKn: number;      // L78
  hookBearingStaticSafety: number; // L85
  // 4.6 Kiriş kesiti — statik
  fMaxKg: number;                  // L98
  fMinKg: number;                  // L99
  maxMomentKgCm: number;           // L105
  minMomentKgCm: number;           // L108
  midUnitWeightKgM: number;        // L116
  midInertiaCm4: number;           // L117
  midSectionModulusCm3: number;    // L118
  midAreaCm2: number;              // L119
  midWebAreaCm2: number;           // L120
  thickUnitWeightKgM: number;      // P116
  thickInertiaCm4: number;         // P117
  thickSectionModulusCm3: number;  // P118
  thickAreaCm2: number;            // P119
  thickWebAreaCm2: number;         // P120
  dynamicFactor: number;           // L124 (ψ)
  staticBendingStress: number;     // L130
  staticShearStress: number;       // L131
  staticCombinedStress: number;    // L132
  allowableStaticStress: number;   // L134 yerine (yeniden yazım)
  // 4.6 Yorulma
  sigmaMax: number;                // L139
  tauMax: number;                  // L140
  combinedMax: number;             // L141
  sigmaMin: number;                // L144
  tauMin: number;                  // L145
  combinedMin: number;             // L146
  kappa: number;                   // L161 (x = σmin/σmax oranı)
  fatigueSigmaD1Nmm2: number;      // L154 yerine — zul σ D(-1) [N/mm²]
  fatigueSigmaD1KgCm2: number;     // L155 yerine [kg/cm²]
  fatigueSigmaDz0KgCm2: number;    // L157 yerine — zul σ Dz(0) [kg/cm²]
  ultimateStrengthKgCm2: number;   // L166 yerine — σB [kg/cm²]
  fatigueAllowableSigmaKgCm2: number; // L169 yerine — zul σ Dz(x) [kg/cm²]
  fatigueTauW0Nmm2: number;        // L177 yerine — zul σ Dz(x) W0 [N/mm²]
  fatigueTauW0KgCm2: number;       // L178 yerine [kg/cm²]
  fatigueAllowableTauKgCm2: number;// L180 yerine — zul τ D(x) [kg/cm²]
  fatigueCombinedRatio: number;    // I188 yerine — (σ/zulσ)² + (τ/zulτ)²
}

export function computeHookBlock(
  specs: TechnicalSpecs,
  inp: HookBlockInputs,
  sel: HookBlockSelections,
  deps: HookBlockDeps
): ModuleResult<HookBlockValues> {
  const mech = specs.hoistMechanismClass;
  const usage = specs.hoistUsageClass;

  const cells: Record<string, number | string> = {};
  const checks: AnyCheck[] = [];

  // --- 4.2 Makaralar --------------------------------------------------------
  const L11 = sheaveCoefficient(mech);   // makara H katsayısı (KATSAYILAR F42:F49)
  const L12 = deps.ropeDiaMm;            // ='02-ANA KALDIRMA GRUBU'!L24
  const L10 = L11 * L12;                 // minimum makara çapı [mm]
  Object.assign(cells, { L10, L11, L12 });
  checks.push({
    id: "hookBlock.sheave.dia",
    label: "Makara çapı (min H·d)",
    required: L10, provided: sel.sheaveDiaMm, unit: "mm", op: ">=",
    pass: sel.sheaveDiaMm >= L10,
    standard: "FEM 1.001 T.4.2.3.1.1", nonExcel: true,
  });

  // --- 4.3 Makara rulmanları ------------------------------------------------
  const L19 = deps.ropeLoadKg * 0.00981; // radyal yük Fr [kN]
  const L20 = L19 * 0.05;                // eksenel yük Fa [kN]
  const L26 = L19;                       // eşdeğer statik yük P0 [kN] (bilyalı)
  const L27 = L19;                       // eşdeğer dinamik yük P [kN]
  const L33 = deps.drumRpm;              // ='02-ANA KALDIRMA GRUBU'!L149
  const L34 = L33 * (deps.drumDiaMm / sel.sheaveDiaMm); // rulman devri [d/dak]
  const L36 = (1000000 / (60 * L34)) * (sel.sheaveBearingDynCKn / L27) ** 3; // L10 ömür [saat]
  const life = mechanismLife(usage);
  const L38 = life.min ?? 0;
  const Q38 = life.max;
  const sheaveBearingStaticSafety = sel.sheaveBearingStatC0Kn / L26;
  Object.assign(cells, {
    L19, L20, L26, L27, L33, L34, L36, L38,
    ...(Q38 !== null ? { Q38 } : {}),
  });
  checks.push({
    id: "hookBlock.sheaveBearing.life",
    label: "Makara rulmanı ömrü",
    required: L38, provided: L36, unit: "saat", op: ">=", pass: L36 >= L38,
    standard: "FEM 1.001 T.2.1.3.2",
  });
  checks.push({
    id: "hookBlock.sheaveBearing.static",
    label: "Makara rulmanı statik emniyeti",
    required: 1, provided: sheaveBearingStaticSafety, unit: "-", op: ">=",
    pass: sheaveBearingStaticSafety >= 1, nonExcel: true,
  });

  // --- 4.4 Kanca bloğu mili -------------------------------------------------
  const L51 = deps.ropeLoadKg;           // halat yükü T [kg]
  const L52 = L51 * 2;                   // 2T [kg]
  const L58 = L52 * 2;                   // Ra [kg]
  const L59 = L58;                       // Rb [kg]
  const L62 = L52 * inp.shaftSpanACm;    // Mmaks = 2T·a [kg·cm]
  const L63 = inp.shaftDiaCm;
  const L64 = (Math.PI * L63 ** 4 / 64) / (L63 / 2); // kesit modülü S [cm³]
  const L65 = L62 / L64;                 // eğilme gerilmesi [kg/cm²]
  const L66 = L58 / (Math.PI * (L63 / 2) ** 2); // kesme gerilmesi [kg/cm²]
  const L67 = Math.sqrt(L65 ** 2 + 3 * L66 ** 2); // bileşik gerilme [kg/cm²]
  const shaftAllow = HOOK_SHAFT_MATERIALS[sel.shaftMaterial];
  const L71 = shaftAllow.bending;
  const L72 = shaftAllow.shear;
  const L73 = shaftAllow.combined;
  Object.assign(cells, { L51, L52, L58, L59, L62, L64, L65, L66, L67, L71, L72, L73 });
  checks.push({
    id: "hookBlock.shaft.stress",
    label: "Kanca bloğu mili bileşik gerilmesi",
    required: L67, provided: L73, unit: "kg/cm²", op: ">=", pass: L73 >= L67,
    standard: "CMAA #74, 4.5", nonExcel: true,
  });

  // --- 4.5 Kanca rulmanı ----------------------------------------------------
  const L78 = deps.loadKg * 9.81 / 1000; // eksenel yük Fa [kN]
  const L85 = sel.hookBearingStatC0Kn / L78; // statik emniyet S0
  Object.assign(cells, { L78, L85 });
  checks.push({
    id: "hookBlock.hookBearing.static",
    label: "Kanca rulmanı statik emniyeti",
    required: 0.5, provided: L85, unit: "-", op: ">=", pass: L85 >= 0.5, // O85 = 0,5
  });

  // --- 4.6 Kiriş kesiti — yükler ve kesit özellikleri -----------------------
  const L98 = deps.totalLoadKg / 2;      // Fmax [kg]
  const L99 = (deps.hookBlockWeightKg + deps.ropeWeightKg) / 2; // Fmin [kg]
  const L102 = inp.loadOffsetMm;
  const L105 = L98 * L102 / 10;          // Mmaks [kg·cm]
  const L108 = L99 * L102 / 10;          // Mmin [kg·cm]

  // Orta kesit sacları (L111..N113) / kalın kesit sacları (P111..R113)
  const { midTopPlateThkMm: L111, midTopPlateWidthMm: N111,
    midWebPlateThkMm: L112, midWebPlateHeightMm: N112,
    midBottomPlateThkMm: L113, midBottomPlateWidthMm: N113,
    thickTopPlateThkMm: P111, thickTopPlateWidthMm: R111,
    thickWebPlateThkMm: P112, thickWebPlateHeightMm: R112,
    thickBottomPlateThkMm: P113, thickBottomPlateWidthMm: R113 } = inp;

  const L116 = ((L111 * N111) + (L112 * N112 * 2) + (L113 * N113)) * 1000 * 7.85 / 10 ** 6; // birim ağırlık [kg/m]
  const P116 = ((P111 * R111) + (P112 * R112 * 2) + (P113 * R113)) * 1000 * 7.85 / 10 ** 6;
  const L117 = (((L112 / 10) * (N112 / 10) ** 3 / 12) * 2
    + (((N111 / 10) * ((L111 / 10) ** 3) / 12) + ((L111 / 10) * (N111 / 10) * ((N112 / 10) / 2) ** 2))
    + ((L113 / 10) * (N113 / 10) * ((N112 / 10) / 2) ** 2)); // atalet momenti I [cm⁴]
  const P117 = (((P112 / 10) * (R112 / 10) ** 3 / 12) * 2
    + (((R111 / 10) * ((P111 / 10) ** 3) / 12) + ((P111 / 10) * (R111 / 10) * ((R112 / 10) / 2) ** 2))
    + ((P113 / 10) * (R113 / 10) * ((R112 / 10) / 2) ** 2));
  const L118 = L117 / (N112 / 20);       // kesit modülü w [cm³]
  const P118 = P117 / (R112 / 20);
  const L119 = ((L111 / 10 * N111 / 10) + (L112 / 10 * N112 / 10 * 2) + (L113 / 10 * N113 / 10)); // alan [cm²]
  const P119 = ((P111 / 10 * R111 / 10) + (P112 / 10 * R112 / 10 * 2) + (P113 / 10 * R113 / 10));
  const L120 = (L112 / 10) * (N112 / 10) * 2; // yan sac alanı Ay [cm²]
  const P120 = (P112 / 10) * (R112 / 10) * 2;
  Object.assign(cells, {
    L98, L99, L105, L108,
    L116, P116, L117, P117, L118, P118, L119, P119, L120, P120,
  });

  // --- 4.6 Statik gerilmeler (ψ katsayılı) ----------------------------------
  const L124 = inp.dynamicFactorK + inp.dynamicFactorL * specs.mainLiftSpeedMpm; // ψ (DIN 15018 Tablo 2; 01!P6)
  const L130 = L105 * L124 / L118;       // σ [kg/cm²]
  const L131 = L98 * L124 / P120;        // τ (kalın kesit) [kg/cm²]
  const L132 = Math.sqrt(L130 ** 2 + 3 * L131 ** 2); // σbil [kg/cm²]
  Object.assign(cells, { L124, L130, L131, L132 });

  // Excel L134 bozuk: =IF(#ref!="S355JR",2300,IF(#ref!="S235JR",1530)) →
  // yeniden yazım: fatigueMaterial girdisinden (FEM Table T.3.2.1.1).
  const allowableStaticStress = ALLOWABLE_STATIC_KGCM2[inp.fatigueMaterial];
  checks.push({
    id: "hookBlock.girder.static",
    label: "Kiriş statik bileşik gerilmesi",
    required: L132, provided: allowableStaticStress, unit: "kg/cm²", op: ">=",
    pass: allowableStaticStress >= L132,
    standard: "FEM T.3.2.1.1", nonExcel: true, // Excel P132/L134 bozuk (#ref!)
  });

  // --- 4.6 Yorulma hesabı ---------------------------------------------------
  const L139 = L105 / L118;              // σmax [kg/cm²]
  const L140 = L98 / L120;               // τmax [kg/cm²]
  const L141 = Math.sqrt(L139 ** 2 + 3 * L140 ** 2); // σbil,max [kg/cm²]
  const L144 = L108 / L118;              // σmin [kg/cm²]
  const L145 = L99 / L120;               // τmin [kg/cm²]
  const L146 = Math.sqrt(L144 ** 2 + 3 * L145 ** 2); // σbil,min [kg/cm²]
  const L161 = L146 / L141;              // x (κ) gerilme oranı
  const I172 = L139;                     // kontrol gösterimi: σmax
  const I183 = L140;                     // kontrol gösterimi: τmax
  Object.assign(cells, { L139, L140, L141, L144, L145, L146, L161, I172, I183 });

  // Excel L154/L155/L157/L166/L169/L177/L178/L180/I188 zinciri bozuktur (#ref!).
  // Yeniden yazım — 07-ANA KİRİŞ!F409/F411/F419/G430/G431 çalışan deseniyle:
  const st = inp.fatigueMaterial === "S355JR" ? "St52" : "St37";
  // zul σ D(-1): DIN 15018 Tablo 17 (çentik sınıfı × yük grubu) [N/mm²]
  const fatigueSigmaD1Nmm2 = DIN15018_T17[st][inp.notchClass][inp.loadGroup];
  const fatigueSigmaD1KgCm2 = fatigueSigmaD1Nmm2 * 100 / 9.81; // (Excel L155 dönüşümü)
  // zul σ Dz(0) = 5/3 · zul σ D(-1)  (DIN 15018 Şekil 9)
  const fatigueSigmaDz0KgCm2 = fatigueSigmaD1KgCm2 * 5 / 3;
  // σB — Excel L166 bozuk ArrayFormula yerine malzemeden (07!F417 ile uyumlu)
  const ultimateStrengthKgCm2 = ULTIMATE_STRENGTH_NMM2[inp.fatigueMaterial] * 100 / 9.81;
  // zul σ Dz(x) — DIN 15018 Tablo 18 enterpolasyonu (Excel L169 formül niyeti)
  const fatigueAllowableSigmaKgCm2 =
    fatigueSigmaDz0KgCm2 / (1 - (1 - fatigueSigmaDz0KgCm2 / ultimateStrengthKgCm2 / 0.75) * L161);
  // zul τ: W0 çentik sınıfı üzerinden (Excel L177/L178/L180 niyeti).
  // Not: Excel'in ölü L178 hücresi ×9,81 kullanır; burada L155 ile tutarlı
  // (ve doğru) N/mm² → kg/cm² dönüşümü ×100/9,81 kullanılır.
  const fatigueTauW0Nmm2 = DIN15018_T17[st]["W0"][inp.loadGroup];
  const fatigueTauW0KgCm2 = fatigueTauW0Nmm2 * 100 / 9.81;
  const fatigueAllowableTauKgCm2 = fatigueTauW0KgCm2 / Math.sqrt(3);
  // Bileşik yorulma (DIN 15018 Bölüm 7.4.5; Excel I188 niyeti)
  const fatigueCombinedRatio =
    (L139 / fatigueAllowableSigmaKgCm2) ** 2 + (L140 / fatigueAllowableTauKgCm2) ** 2;

  checks.push({
    id: "hookBlock.fatigue.sigma",
    label: "Kiriş yorulması — normal gerilme (σmax ≤ zul σ Dz(x))",
    required: L139, provided: fatigueAllowableSigmaKgCm2, unit: "kg/cm²", op: ">=",
    pass: fatigueAllowableSigmaKgCm2 >= L139,
    standard: "DIN 15018 Tablo 17/18", nonExcel: true,
  });
  checks.push({
    id: "hookBlock.fatigue.tau",
    label: "Kiriş yorulması — kesme gerilmesi (τmax ≤ zul τ D(x))",
    required: L140, provided: fatigueAllowableTauKgCm2, unit: "kg/cm²", op: ">=",
    pass: fatigueAllowableTauKgCm2 >= L140,
    standard: "DIN 15018 Tablo 17", nonExcel: true,
  });
  checks.push({
    id: "hookBlock.fatigue.combined",
    label: "Kiriş yorulması — bileşik oran",
    required: fatigueCombinedRatio, provided: 1.1, unit: "-", op: ">=",
    pass: 1.1 >= fatigueCombinedRatio,
    standard: "DIN 15018 Bölüm 7.4.5", nonExcel: true,
  });

  const values: HookBlockValues = {
    sheaveCoefficientH: L11,
    minSheaveDiaMm: L10,
    sheaveBearingRadialKn: L19,
    sheaveBearingAxialKn: L20,
    sheaveBearingEqStaticKn: L26,
    sheaveBearingEqDynamicKn: L27,
    sheaveRpm: L34,
    sheaveBearingLifeHours: L36,
    requiredLifeMin: L38,
    requiredLifeMax: Q38,
    sheaveBearingStaticSafety,
    ropeLoadKg: L51,
    doubleRopeLoadKg: L52,
    reactionAKg: L58,
    reactionBKg: L59,
    shaftMomentKgCm: L62,
    shaftSectionModulusCm3: L64,
    shaftBendingStress: L65,
    shaftShearStress: L66,
    shaftCombinedStress: L67,
    shaftAllowables: shaftAllow,
    hookBearingAxialKn: L78,
    hookBearingStaticSafety: L85,
    fMaxKg: L98,
    fMinKg: L99,
    maxMomentKgCm: L105,
    minMomentKgCm: L108,
    midUnitWeightKgM: L116,
    midInertiaCm4: L117,
    midSectionModulusCm3: L118,
    midAreaCm2: L119,
    midWebAreaCm2: L120,
    thickUnitWeightKgM: P116,
    thickInertiaCm4: P117,
    thickSectionModulusCm3: P118,
    thickAreaCm2: P119,
    thickWebAreaCm2: P120,
    dynamicFactor: L124,
    staticBendingStress: L130,
    staticShearStress: L131,
    staticCombinedStress: L132,
    allowableStaticStress,
    sigmaMax: L139,
    tauMax: L140,
    combinedMax: L141,
    sigmaMin: L144,
    tauMin: L145,
    combinedMin: L146,
    kappa: L161,
    fatigueSigmaD1Nmm2,
    fatigueSigmaD1KgCm2,
    fatigueSigmaDz0KgCm2,
    ultimateStrengthKgCm2,
    fatigueAllowableSigmaKgCm2,
    fatigueTauW0Nmm2,
    fatigueTauW0KgCm2,
    fatigueAllowableTauKgCm2,
    fatigueCombinedRatio,
  };

  return { values, checks, cells };
}

/** Kaldırma grubu sonucundan HookBlockDeps üretir (uygulama tarafı kolaylığı). */
export function hookBlockDepsFromHoist(hoist: {
  values: {
    ropeLoadKg: number; loadKg: number; totalLoadKg: number; drumRpm: number;
  };
  inputs: { hookBlockWeightKg: number; ropeWeightKg: number };
  selections: { ropeDiaMm: number; drumDiaMm: number };
}): HookBlockDeps {
  return {
    ropeDiaMm: hoist.selections.ropeDiaMm,
    ropeLoadKg: hoist.values.ropeLoadKg,
    loadKg: hoist.values.loadKg,
    hookBlockWeightKg: hoist.inputs.hookBlockWeightKg,
    ropeWeightKg: hoist.inputs.ropeWeightKg,
    totalLoadKg: hoist.values.totalLoadKg,
    drumRpm: hoist.values.drumRpm,
    drumDiaMm: hoist.selections.drumDiaMm,
  };
}
