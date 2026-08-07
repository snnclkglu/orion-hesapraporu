// Kanca bloğu hesabı (§4.1 … §4.6).
//
// Modül saftır: girdiler → değerler + kontroller. Yöntem doğrudan standartlara
// dayanır ve hiçbir tablo yazılımının hücre düzenine bağlı değildir:
//
//   · DIN 15400 / 15401 — kanca seçimi ve taşıma kapasitesi
//   · FEM 1.001 T.4.2.3.1.1 — minimum makara çapı (H katsayısı)
//   · FEM 1.001 T.2.1.3.2 — makara rulmanı gerekli ömrü
//   · CMAA 70 4.11.4.1 — kanca bloğu mili gerilmeleri
//   · FEM 1.001 T.3.2.1.1 — kaldırma kirişi statik izin gerilmesi
//   · DIN 15018 Tablo 2 / 17 / 18 — dinamik katsayı ψ ve yorulma
//
// Kiriş statiği ortak `beam.ts`, dairesel mil gerilmeleri ortak `shaftStress.ts`,
// halat donanımı ortak `reeving.ts` ile çözülür; bu modül yalnız kendi
// mühendislik kararlarını taşır.
//
// Birimler: kg, kg/cm², kg·cm, kN, mm, cm, d/dak, N/mm².

import { solveBeam } from "../beam";
import { mechanismLife, sheaveCoefficient } from "../coefficients";
import {
  din15020Group,
  hookCapacityKg,
  smallestHookNumber,
  type HookStrengthClass,
} from "../hook-table";
import { hoistReeving, hoistSpecView, type HoistInputs } from "./hoistGroup";
import { HOIST_OF_HOOKBLOCK, type HookBlockKey } from "../presentation/module-family";
import { deriveReeving } from "../reeving";
import { shaftStress } from "../shaftStress";
import { DIN15018_T17 } from "../tables";
import {
  parseHoistLoadClass,
  type AnyCheck,
  type HoistClass,
  type LoadGroup,
  type ModuleResult,
  type TechnicalSpecs,
} from "../types";

/**
 * Kanca bloğu varyantı. Her kaldırma grubunun kendi kanca bloğu vardır; hesap
 * aynıdır, yalnız sınıf ve hız bağlı olduğu kaldırma grubundan okunur.
 */
export type HookBlockWhich = HookBlockKey;

/** §4.6 kaldırma kirişi yorulma malzemesi */
export type FatigueMaterial = "S235JR" | "S355JR";

/** DIN 15018 çentik sınıfı (Tablo 17 sütunları): W kaynaksız, K kaynaklı */
export type NotchClass = "W0" | "W1" | "W2" | "K0" | "K1" | "K2" | "K3" | "K4";

/**
 * Kanca bloğu mili malzemeleri. Ana kaldırma milinden (ShaftMaterial) farkı:
 * C45 de listededir (kanca bloğu millerinde yaygın kullanım).
 */
export type HookShaftMaterial =
  | "S355JR" | "C25" | "C30" | "C35" | "C45" | "4140+QT" | "4140";

/**
 * Mil malzemelerinin izin verilen gerilmeleri [kg/cm²] — CMAA 70 4.11.4.1
 * uyarınca kopma dayanımından türetilmiş firma tablosu değerleri.
 */
const HOOK_SHAFT_MATERIALS: Record<
  HookShaftMaterial,
  { bending: number; shear: number; combined: number }
> = {
  // S355JR: EN 10025-2 Rm,min = 470 N/mm² → CMAA 70 4.11.4.1 σa = Rm/5 = 94 MPa,
  // τa = σa/√3. kg/cm² karşılıkları (tablonun birimiyle uyumlu olsun diye).
  S355JR: { bending: 958.5, shear: 553.4, combined: 958.5 },
  C25: { bending: 850, shear: 490, combined: 850 },
  C30: { bending: 920, shear: 530, combined: 920 },
  C35: { bending: 980, shear: 565, combined: 980 },
  C45: { bending: 1180, shear: 680, combined: 1180 },
  "4140+QT": { bending: 1570, shear: 900, combined: 1570 },
  "4140": { bending: 1300, shear: 1300 / Math.sqrt(3), combined: 1300 },
};

/** §4.6 yorulma için malzeme kopma dayanımı σB [N/mm²] */
const ULTIMATE_STRENGTH_NMM2: Record<FatigueMaterial, number> = {
  S235JR: 350,
  S355JR: 510,
};

/** FEM 1.001 T.3.2.1.1 statik izin gerilmesi [kg/cm²] */
const ALLOWABLE_STATIC_KGCM2: Record<FatigueMaterial, number> = {
  S235JR: 1530,
  S355JR: 2300,
};

/** DIN 15018 Tablo 17 malzeme sütunu — S235JR → St37, S355JR → St52 */
const FATIGUE_STEEL_COLUMN: Record<FatigueMaterial, "St37" | "St52"> = {
  S235JR: "St37",
  S355JR: "St52",
};

/** Dinamik katsayı çifti: ψ = k + l · v_kaldırma */
export interface DynamicFactorCoefficients {
  /** Sabit terim k */
  k: number;
  /** Hız terimi l [dak/m] */
  l: number;
}

/**
 * DIN 15018 Tablo 2 — kaldırma sınıfına (H1…H4) göre dinamik katsayı çifti.
 * ψ = k + l · v, v kaldırma hızı [m/dak].
 */
export const DIN15018_T2_DYNAMIC: Record<HoistClass, DynamicFactorCoefficients> = {
  H1: { k: 1.1, l: 0.0022 },
  H2: { k: 1.2, l: 0.0044 },
  H3: { k: 1.3, l: 0.0066 },
  H4: { k: 1.4, l: 0.0088 },
};

/**
 * Teknik özelliklerde kaldırma sınıfı okunamazsa kullanılan sınıf.
 * En yüksek (en emniyetli) sınıf seçilir: eksik veri tasarımı emniyetsiz
 * yönde etkilememelidir.
 */
const VARSAYILAN_HOIST_CLASS: HoistClass = "H4";

/**
 * Ana kaldırma grubundan gelen bağımlılıklar. Modül saf kalsın diye parametre
 * olarak alınır.
 */
export interface HookBlockDeps {
  /** Halat çapı [mm] */
  ropeDiaMm: number;
  /** Bir halat kolundaki yük T [kg] */
  ropeLoadKg: number;
  /** Kaldırılan yük [kg] */
  loadKg: number;
  /** Kanca bloğu / tutucu ağırlığı [kg] */
  hookBlockWeightKg: number;
  /** Halat ağırlığı [kg] */
  ropeWeightKg: number;
  /** Toplam yük [kg] */
  totalLoadKg: number;
  /** Tambur devri [d/dak] */
  drumRpm: number;
  /** Tambur çapı [mm] */
  drumDiaMm: number;
  /**
   * Kanca bloğundaki hareketli makara adedi. Donanımın tek gerçek kaynağı
   * `reeving.ts`tir; bu değer `deriveReeving().blockSheaveCount` ile üretilir.
   */
  blockSheaveCount: number;
}

/** Kullanıcı girdileri (tasarım kabulleri) */
export interface HookBlockInputs {
  /**
   * §4.4 Kanca bloğu mili — ölçü zinciri (teknik resim):
   *   A: yan sac (mesnet) ekseni → ilk makara ekseni
   *   B: komşu makara eksenleri arası (küme içi adım)
   *   D: iki makara kümesi arasındaki orta boşluk (kanca sapı geçişi)
   * Makara adedi donanımdan gelir ve makaralar iki kümeye ayrılır:
   * 2 makara → A|D|A, 4 makara → A|B|D|B|A, 6 makara → A|B|B|D|B|B|A.
   */
  shaftEdgeGapMm: number;        // A [mm]
  shaftSheavePitchMm: number;    // B [mm]
  shaftCenterGapMm: number;      // D [mm]
  /** D1 — mil gerilme kesiti çapı [mm] */
  shaftD1Mm: number;
  // §4.6 Kaldırma kirişi kesiti
  /** a — kiriş açıklığı [mm] */
  girderSpanMm: number;
  /** b — yükün mesnede uzaklığı [mm] */
  loadOffsetMm: number;
  midTopPlateThkMm: number;      // orta kesit üst sac kalınlığı [mm]
  midTopPlateWidthMm: number;    // orta kesit üst sac genişliği [mm]
  midWebPlateThkMm: number;      // orta kesit yan sac kalınlığı [mm]
  midWebPlateHeightMm: number;   // orta kesit yan sac yüksekliği [mm]
  midBottomPlateThkMm: number;   // orta kesit alt sac kalınlığı [mm]
  midBottomPlateWidthMm: number; // orta kesit alt sac genişliği [mm]
  thickTopPlateThkMm: number;    // kalın kesit üst sac kalınlığı [mm]
  thickTopPlateWidthMm: number;  // kalın kesit üst sac genişliği [mm]
  thickWebPlateThkMm: number;    // kalın kesit yan sac kalınlığı [mm]
  thickWebPlateHeightMm: number; // kalın kesit yan sac yüksekliği [mm]
  thickBottomPlateThkMm: number; // kalın kesit alt sac kalınlığı [mm]
  thickBottomPlateWidthMm: number; // kalın kesit alt sac genişliği [mm]
  /**
   * ψ katsayısının k terimi — ELLE EZME (opsiyonel).
   * Boş bırakılırsa k, teknik özelliklerdeki kaldırma sınıfından
   * (DIN 15018 Tablo 2) türetilir. Yalnızca projeye özel bir gerekçe varsa
   * doldurulmalıdır.
   */
  dynamicFactorKOverride?: number;
  /** ψ katsayısının l terimi — ELLE EZME (opsiyonel), bkz. `dynamicFactorKOverride`. */
  dynamicFactorLOverride?: number;
  /** Yorulma yük grubu B1…B6 (DIN 15018) */
  loadGroup: LoadGroup;
  /** Kaynak / çentik sınıfı (DIN 15018 Tablo 17) */
  notchClass: NotchClass;
  /** Kaldırma kirişi malzemesi (yorulma dayanımı bu malzemeden okunur) */
  fatigueMaterial: FatigueMaterial;
}

/** Katalog seçimleri — mühendisin seçtiği bileşenler */
export interface HookBlockSelections {
  /** Kanca tanımı (ör. "DIN 15401 Nr 10 S") */
  hookDesignation: string;
  /** DIN 15400 kanca numarası (ör. "10") — taşıma kapasitesi tablodan gelir */
  hookNumber?: string;
  /** DIN 15400 malzeme mukavemet sınıfı (M/P/S/T/V) */
  hookStrengthClass?: HookStrengthClass;
  /** Tablo dışı kanca için elle girilen kapasite [kg] (yedek) */
  hookCapacityKg: number;
  /** Halat ekseninde makara çapı [mm] */
  sheaveDiaMm: number;
  sheaveBearingType: string;
  sheaveBearingCode: string;
  /** Makara rulmanı dinamik yük katsayısı C [kN] */
  sheaveBearingDynCKn: number;
  /** Makara rulmanı statik yük katsayısı C0 [kN] */
  sheaveBearingStatC0Kn: number;
  /** Makara rulmanı iç çapı [mm] — mil çapı D1 ile eşleşmelidir */
  sheaveBearingBoreMm?: number;
  /** Mil malzemesi */
  shaftMaterial: HookShaftMaterial;
  hookBearingType: string;
  hookBearingCode: string;
  /** Kanca rulmanı statik yük katsayısı C0 [kN] */
  hookBearingStatC0Kn: number;
}

export interface HookBlockValues {
  // §4.1 Kanca
  /** DIN 15400 Tablo 3'ten okunan taşıma kapasitesi [kg] (yoksa elle girilen) */
  hookCapacityKg: number;
  /** Kapasite tablodan mı geldi */
  hookCapacityFromTable: boolean;
  /** Mekanizma sınıfının DIN 15020 karşılığı (ör. M6 → 2m) */
  hookDinGroup: string;
  /** Yükü taşıyan en küçük kanca numarası (seçim önerisi) */
  suggestedHookNumber?: string;
  // §4.2 Makaralar
  sheaveCoefficientH: number;
  minSheaveDiaMm: number;
  // §4.3 Makara rulmanları
  sheaveBearingRadialKn: number;
  sheaveBearingAxialKn: number;
  sheaveBearingEqStaticKn: number;
  sheaveBearingEqDynamicKn: number;
  sheaveRpm: number;
  sheaveBearingLifeHours: number;
  requiredLifeMin: number;
  requiredLifeMax: number | null;
  sheaveBearingStaticSafety: number;
  // §4.4 Kanca bloğu mili
  ropeLoadKg: number;
  /** Makara başına yük 2T [kg] */
  doubleRopeLoadKg: number;
  /** Kanca bloğundaki makara adedi (donanımdan) */
  sheaveCount: number;
  /** Makara eksenlerinin sol mesnete uzaklıkları [cm] */
  sheavePositionsCm: number[];
  /** Yan saclar (mesnetler) arası açıklık [cm] */
  shaftSpanCm: number;
  reactionAKg: number;
  reactionBKg: number;
  shaftMomentKgCm: number;
  /** Milin kesme hesabına giren en büyük kesme kuvveti [kg] */
  shaftShearKg: number;
  shaftSectionModulusCm3: number;
  shaftShearAreaCm2: number;
  shaftBendingStress: number;
  shaftShearStress: number;
  shaftCombinedStress: number;
  shaftAllowables: { bending: number; shear: number; combined: number };
  // §4.5 Kanca rulmanı
  hookBearingAxialKn: number;
  hookBearingStaticSafety: number;
  // §4.6 Kiriş kesiti — statik
  fMaxKg: number;
  fMinKg: number;
  maxMomentKgCm: number;
  minMomentKgCm: number;
  midUnitWeightKgM: number;
  midInertiaCm4: number;
  midSectionModulusCm3: number;
  midAreaCm2: number;
  midWebAreaCm2: number;
  thickUnitWeightKgM: number;
  thickInertiaCm4: number;
  thickSectionModulusCm3: number;
  thickAreaCm2: number;
  thickWebAreaCm2: number;
  /** ψ hesabında kullanılan kaldırma sınıfı (DIN 15018 Tablo 2) */
  hoistClassUsed: HoistClass;
  /** ψ katsayısı elle mi ezildi */
  dynamicFactorOverridden: boolean;
  dynamicFactorK: number;
  dynamicFactorL: number;
  /** ψ = k + l · v */
  dynamicFactor: number;
  staticBendingStress: number;
  staticShearStress: number;
  staticCombinedStress: number;
  allowableStaticStress: number;
  // §4.6 Yorulma
  sigmaMax: number;
  tauMax: number;
  combinedMax: number;
  sigmaMin: number;
  tauMin: number;
  combinedMin: number;
  /** Gerilme oranı x = σbil,min / σbil,max */
  kappa: number;
  /** zul σ D(-1) [N/mm²] */
  fatigueSigmaD1Nmm2: number;
  /** zul σ D(-1) [kg/cm²] */
  fatigueSigmaD1KgCm2: number;
  /** zul σ Dz(0) [kg/cm²] */
  fatigueSigmaDz0KgCm2: number;
  /** σB [kg/cm²] */
  ultimateStrengthKgCm2: number;
  /** zul σ Dz(x) [kg/cm²] */
  fatigueAllowableSigmaKgCm2: number;
  /** W0 çentik sınıfı için zul σ Dz(x) [N/mm²] */
  fatigueTauW0Nmm2: number;
  /** W0 çentik sınıfı için zul σ Dz(x) [kg/cm²] */
  fatigueTauW0KgCm2: number;
  /** zul τ D(x) [kg/cm²] */
  fatigueAllowableTauKgCm2: number;
  /** (σ/zulσ)² + (τ/zulτ)² */
  fatigueCombinedRatio: number;
}

/** Kanca bloğu mili geometrisi — makara konumları ve mesnet açıklığı. */
export interface HookShaftGeometry {
  edgeGapCm: number;
  pitchCm: number;
  centerGapCm: number;
  /** Makara eksenlerinin sol mesnete uzaklığı [cm] */
  positionsCm: number[];
  /** Yan saclar (mesnetler) arası açıklık [cm] */
  spanCm: number;
}

/**
 * Ölçü zincirinden (A, B, D) makara eksen konumlarını üretir. Makara adedi
 * DIŞARIDAN gelir: donanımın tek gerçek kaynağı `reeving.ts`tir ve adet
 * `deriveReeving().blockSheaveCount` ile hesaplanır. Makaralar iki kümeye
 * bölünür; tek makarada orta boşluk kullanılmaz.
 */
export function hookShaftGeometry(
  inp: Pick<HookBlockInputs, "shaftEdgeGapMm" | "shaftSheavePitchMm" | "shaftCenterGapMm">,
  sheaveCount: number
): HookShaftGeometry {
  const num = (v: number | undefined) =>
    typeof v === "number" && Number.isFinite(v) && v > 0 ? v : 0;
  const edgeGapCm = num(inp.shaftEdgeGapMm) / 10;
  const pitchCm = num(inp.shaftSheavePitchMm) / 10;
  const centerGapCm = num(inp.shaftCenterGapMm) / 10;
  const count = Math.max(
    1,
    Math.round(Number.isFinite(sheaveCount) ? sheaveCount : 1)
  );

  const positionsCm: number[] = [];
  if (count === 1) {
    positionsCm.push(edgeGapCm);
  } else {
    const left = Math.ceil(count / 2);
    const right = count - left;
    for (let i = 0; i < left; i++) positionsCm.push(edgeGapCm + i * pitchCm);
    const start = edgeGapCm + (left - 1) * pitchCm + centerGapCm;
    for (let j = 0; j < right; j++) positionsCm.push(start + j * pitchCm);
  }
  const spanCm = positionsCm[positionsCm.length - 1] + edgeGapCm;
  return { edgeGapCm, pitchCm, centerGapCm, positionsCm, spanCm };
}

/** ψ çözümü: kaldırma sınıfından türetilen (ya da elle ezilen) katsayı çifti. */
export interface DynamicFactorResolution extends DynamicFactorCoefficients {
  /** Kullanılan kaldırma sınıfı */
  hoistClass: HoistClass;
  /** Katsayılardan en az biri elle ezildi mi */
  overridden: boolean;
  /** ψ = k + l · v */
  psi: number;
}

/**
 * DIN 15018 Tablo 2 dinamik katsayısı ψ.
 *
 * k ve l serbest sayılar DEĞİLDİR: kaldırma sınıfının (H1…H4) tablo satırıdır.
 * Sınıf, teknik özelliklerdeki "kaldırma / yük grubu" alanından okunur
 * (ör. "H3/B4" → H3). Alan okunamazsa en emniyetli sınıf (H4) kullanılır.
 * Projeye özel bir gerekçe varsa katsayılar tek tek elle ezilebilir.
 */
export function resolveDynamicFactor(
  specs: Pick<TechnicalSpecs, "hoistLoadClass">,
  inp: Pick<HookBlockInputs, "dynamicFactorKOverride" | "dynamicFactorLOverride">,
  liftSpeedMpm: number
): DynamicFactorResolution {
  const hoistClass =
    parseHoistLoadClass(specs.hoistLoadClass).hoistClass ?? VARSAYILAN_HOIST_CLASS;
  const table = DIN15018_T2_DYNAMIC[hoistClass];

  const valid = (v: number | undefined): v is number =>
    typeof v === "number" && Number.isFinite(v) && v > 0;
  const kOverride = inp.dynamicFactorKOverride;
  const lOverride = inp.dynamicFactorLOverride;
  const kOverridden = valid(kOverride);
  const lOverridden = valid(lOverride);
  const k = kOverridden ? kOverride : table.k;
  const l = lOverridden ? lOverride : table.l;

  const speed = Number.isFinite(liftSpeedMpm) ? liftSpeedMpm : 0;
  return {
    hoistClass,
    k,
    l,
    overridden: kOverridden || lOverridden,
    psi: k + l * speed,
  };
}

export function computeHookBlock(
  specs: TechnicalSpecs,
  which: HookBlockWhich,
  inp: HookBlockInputs,
  sel: HookBlockSelections,
  deps: HookBlockDeps
): ModuleResult<HookBlockValues> {
  // Kanca bloğu, bağlı olduğu kaldırma grubunun sınıfı ve hızıyla hesaplanır.
  const hoistView = hoistSpecView(specs, HOIST_OF_HOOKBLOCK[which]);
  const mech = hoistView.mechanismClass;
  const usage = hoistView.usageClass;

  const cells: Record<string, number | string> = {};
  const checks: AnyCheck[] = [];

  // --- §4.1 Kanca (DIN 15400 Tablo 3) --------------------------------------
  // Taşıma kapasitesi kanca numarası + malzeme mukavemet sınıfı + mekanizma
  // grubu üçlüsüyle belirlenir. FEM M1–M8 sınıfı DIN 15020 grubuna çevrilir.
  const hookDinGroup = din15020Group(mech);
  const tableCapacityKg =
    sel.hookNumber && sel.hookStrengthClass
      ? hookCapacityKg(sel.hookNumber, sel.hookStrengthClass, mech)
      : undefined;
  const hookCapacity = tableCapacityKg ?? sel.hookCapacityKg;
  const suggestedHookNumber = sel.hookStrengthClass
    ? smallestHookNumber(deps.loadKg, sel.hookStrengthClass, mech)
    : undefined;
  cells["hook.capacity"] = hookCapacity;
  checks.push({
    id: `${which}.hook.capacity`,
    label: "Kanca Taşıma Kapasitesi",
    required: deps.loadKg, provided: hookCapacity, unit: "kg", op: ">=",
    computedSide: "required",
    pass: hookCapacity >= deps.loadKg,
    standard: "DIN 15400", kind: "standart", severity: "engelleyici",
  });

  // --- §4.2 Makaralar -------------------------------------------------------
  const sheaveCoefficientH = sheaveCoefficient(mech); // FEM H katsayısı
  const minSheaveDiaMm = sheaveCoefficientH * deps.ropeDiaMm;
  Object.assign(cells, {
    "sheave.coefficient": sheaveCoefficientH,
    "sheave.minDia": minSheaveDiaMm,
  });
  checks.push({
    id: `${which}.sheave.dia`,
    label: "Makara Çapı (min H·d)",
    required: minSheaveDiaMm, provided: sel.sheaveDiaMm, unit: "mm", op: ">=",
    computedSide: "required",
    pass: sel.sheaveDiaMm >= minSheaveDiaMm,
    standard: "FEM 1.001 T.4.2.3.1.1", kind: "standart", severity: "engelleyici",
  });

  // --- §4.3 Makara rulmanları ----------------------------------------------
  // Radyal yük halat kolundan gelir; eksenel yük halat sapma açısından doğan
  // %5'lik firma kabulüdür. Bilyalı rulmanda eşdeğer statik ve dinamik yükler
  // saf radyal yüke eşittir (X=1, Y=0).
  const bearingRadialKn = deps.ropeLoadKg * 0.00981;
  const bearingAxialKn = bearingRadialKn * 0.05;
  const bearingEqStaticKn = bearingRadialKn;
  const bearingEqDynamicKn = bearingRadialKn;
  const sheaveRpm = deps.drumRpm * (deps.drumDiaMm / sel.sheaveDiaMm);
  // ISO 281 nominal ömür: L₁₀ = (10⁶ / 60n) · (C/P)³ (bilyalı rulman üsteli 3)
  const sheaveBearingLifeHours =
    (1000000 / (60 * sheaveRpm)) * (sel.sheaveBearingDynCKn / bearingEqDynamicKn) ** 3;
  const life = mechanismLife(usage);
  const requiredLifeMin = life.min ?? 0;
  const requiredLifeMax = life.max;
  const sheaveBearingStaticSafety = sel.sheaveBearingStatC0Kn / bearingEqStaticKn;
  Object.assign(cells, {
    "sheaveBearing.radialLoad": bearingRadialKn,
    "sheaveBearing.axialLoad": bearingAxialKn,
    "sheaveBearing.equivalentStatic": bearingEqStaticKn,
    "sheaveBearing.equivalentDynamic": bearingEqDynamicKn,
    "sheaveBearing.rpm": sheaveRpm,
    "sheaveBearing.lifeHours": sheaveBearingLifeHours,
    "sheaveBearing.requiredLifeMin": requiredLifeMin,
    "sheaveBearing.staticSafety": sheaveBearingStaticSafety,
    ...(requiredLifeMax !== null ? { "sheaveBearing.requiredLifeMax": requiredLifeMax } : {}),
  });
  checks.push({
    id: `${which}.sheaveBearing.life`,
    label: "Makara Rulmanı Ömrü",
    required: requiredLifeMin, provided: sheaveBearingLifeHours, unit: "saat",
    op: ">=", computedSide: "provided",
    pass: sheaveBearingLifeHours >= requiredLifeMin,
    standard: "FEM 1.001 T.2.1.3.2", kind: "standart", severity: "engelleyici",
  });
  checks.push({
    id: `${which}.sheaveBearing.static`,
    label: "Makara Rulmanı Statik Emniyeti",
    required: 1, provided: sheaveBearingStaticSafety, unit: "-", op: ">=",
    computedSide: "provided",
    pass: sheaveBearingStaticSafety >= 1,
    kind: "uretici", severity: "engelleyici",
  });

  // --- §4.4 Kanca bloğu mili -----------------------------------------------
  // Mil, iki yan sac (mesnet) arasında basit kiriştir. Makara adedi donanımdan
  // gelir ve HER MAKARA 2T (iki halat kolu) yükü taşır. Makaralar iki kümeye
  // ayrılır; kümeler arasında kanca sapının geçtiği orta boşluk (D) vardır.
  const ropeLoadKg = deps.ropeLoadKg;
  const doubleRopeLoadKg = ropeLoadKg * 2;
  const geo = hookShaftGeometry(inp, deps.blockSheaveCount);
  const sheaveCount = geo.positionsCm.length;

  // Statik: ortak kiriş çözücüsü. Mesnetler mil uçlarındadır (0 ve L).
  const beam = solveBeam({
    lengthCm: geo.spanCm,
    supportACm: 0,
    supportBCm: geo.spanCm,
    pointLoads: geo.positionsCm.map((xCm, i) => ({
      xCm,
      loadKg: doubleRopeLoadKg,
      label: `${i + 1}. makara`,
    })),
  });
  const shaftMomentKgCm = Math.abs(beam.maxMomentKgCm);
  const shaftShearKg = Math.abs(beam.maxShearKg);

  // Gerilme konvansiyonu (açık parametre):
  //   · bileşik = vonMises → √(σ² + 3τ²), CMAA 70 4.11.4.1 kesme enerjisi kriteri
  //   · kesme   = ortalama → τ = V/A. Dolu dairesel kesitte tarafsız eksendeki
  //     TEPE kayma gerilmesi ortalamanın 4/3 katıdır; kanca bloğu milinde kritik
  //     kesit eğilmenin en büyük olduğu orta bölgedir ve orada kayma gerilmesi
  //     tarafsız eksende, eğilme gerilmesi ise dış lifte tepe yapar. Bu yüzden
  //     bileşik gerilmede ortalama kayma kullanılır (yaygın vinç uygulaması).
  //     Tepe kaymayla çalışmak istenirse `shear: "maksimum"` verilir.
  const stress = shaftStress({
    momentKgCm: shaftMomentKgCm,
    shearKg: shaftShearKg,
    bendingDiameterCm: inp.shaftD1Mm / 10,
    shearDiameterCm: inp.shaftD1Mm / 10,
    combined: "vonMises",
    shear: "ortalama",
  });
  const shaftAllow = HOOK_SHAFT_MATERIALS[sel.shaftMaterial];
  Object.assign(cells, {
    "shaft.sheaveLoad": doubleRopeLoadKg,
    "shaft.sheaveCount": sheaveCount,
    "shaft.span": geo.spanCm * 10,
    "shaft.reactionA": beam.reactionAKg,
    "shaft.reactionB": beam.reactionBKg,
    "shaft.moment": shaftMomentKgCm,
    "shaft.shear": shaftShearKg,
    "shaft.sectionModulus": stress.sectionModulusCm3,
    "shaft.shearArea": stress.shearAreaCm2,
    "shaft.bendingStress": stress.bendingStress,
    "shaft.shearStress": stress.shearStress,
    "shaft.combinedStress": stress.combinedStress,
    "shaft.allowableBending": shaftAllow.bending,
    "shaft.allowableShear": shaftAllow.shear,
    "shaft.allowableCombined": shaftAllow.combined,
  });
  checks.push({
    id: `${which}.shaft.bending`,
    label: "Kanca Bloğu Mili Eğilme Gerilmesi",
    required: stress.bendingStress, provided: shaftAllow.bending,
    unit: "kg/cm²", op: ">=", computedSide: "required",
    pass: shaftAllow.bending >= stress.bendingStress,
    standard: "CMAA 70 4.11.4.1", kind: "standart", severity: "engelleyici",
  });
  checks.push({
    id: `${which}.shaft.shear`,
    label: "Kanca Bloğu Mili Kesme Gerilmesi",
    required: stress.shearStress, provided: shaftAllow.shear,
    unit: "kg/cm²", op: ">=", computedSide: "required",
    pass: shaftAllow.shear >= stress.shearStress,
    standard: "CMAA 70 4.11.4.1", kind: "standart", severity: "engelleyici",
  });
  checks.push({
    id: `${which}.shaft.stress`,
    label: "Kanca Bloğu Mili Bileşik Gerilmesi",
    required: stress.combinedStress, provided: shaftAllow.combined,
    unit: "kg/cm²", op: ">=", computedSide: "required",
    pass: shaftAllow.combined >= stress.combinedStress,
    standard: "CMAA 70 4.11.4.1", kind: "standart", severity: "engelleyici",
  });
  // Makara rulmanı milin üzerine oturur → iç çapı mil çapına eşit olmalı.
  // Montaj uyumu bilgisidir; tasarımı reddetmez.
  if (sel.sheaveBearingBoreMm !== undefined && sel.sheaveBearingBoreMm > 0) {
    const boreMm = sel.sheaveBearingBoreMm;
    const shaftMm = inp.shaftD1Mm;
    checks.push({
      id: `${which}.sheaveBearing.bore`,
      label: "Makara Rulmanı İç Çapı = Mil Çapı (D1)",
      min: shaftMm, max: shaftMm, provided: boreMm, unit: "mm", op: "range",
      pass: Math.abs(boreMm - shaftMm) < 0.5,
      kind: "bilgi", severity: "uyari",
    });
  }

  // --- §4.5 Kanca rulmanı ---------------------------------------------------
  const hookBearingAxialKn = (deps.loadKg * 9.81) / 1000;
  const hookBearingStaticSafety = sel.hookBearingStatC0Kn / hookBearingAxialKn;
  Object.assign(cells, {
    "hookBearing.axialLoad": hookBearingAxialKn,
    "hookBearing.staticSafety": hookBearingStaticSafety,
  });
  checks.push({
    id: `${which}.hookBearing.static`,
    label: "Kanca Rulmanı Statik Emniyeti",
    // Dönmeyen / çok yavaş dönen eksenel rulmanlarda rulman katalogları
    // S0 ≥ 0,5 alt sınırını yeterli sayar (düşük sessiz çalışma talebi).
    required: 0.5, provided: hookBearingStaticSafety, unit: "-", op: ">=",
    computedSide: "provided",
    pass: hookBearingStaticSafety >= 0.5,
    kind: "uretici", severity: "engelleyici",
  });

  // --- §4.6 Kaldırma kirişi — yükler ve kesit özellikleri -------------------
  // Kanca bloğu iki kaldırma kirişi arasında asılıdır: her kiriş yükün yarısını
  // taşır ve yük, mesnetten b kadar uzakta etki eder.
  const forceMaxKg = deps.totalLoadKg / 2;
  const forceMinKg = (deps.hookBlockWeightKg + deps.ropeWeightKg) / 2;
  const loadOffsetCm = inp.loadOffsetMm / 10;
  const momentMaxKgCm = forceMaxKg * loadOffsetCm;
  const momentMinKgCm = forceMinKg * loadOffsetCm;

  // Orta kesit ve kalın kesit sacları [mm]
  const {
    midTopPlateThkMm, midTopPlateWidthMm,
    midWebPlateThkMm, midWebPlateHeightMm,
    midBottomPlateThkMm, midBottomPlateWidthMm,
    thickTopPlateThkMm, thickTopPlateWidthMm,
    thickWebPlateThkMm, thickWebPlateHeightMm,
    thickBottomPlateThkMm, thickBottomPlateWidthMm,
  } = inp;

  /** Kaynaklı kutu kesit özellikleri (üst + 2 yan + alt sac), ölçüler [mm] */
  const boxSection = (
    topThk: number, topWidth: number,
    webThk: number, webHeight: number,
    botThk: number, botWidth: number
  ) => {
    // Birim ağırlık: kesit alanı [mm²] × 1 m × 7,85 g/cm³ → kg/m
    const unitWeightKgM =
      ((topThk * topWidth) + (webThk * webHeight * 2) + (botThk * botWidth)) *
      1000 * 7.85 / 10 ** 6;
    // Atalet momenti: yan sacların kendi ataleti + başlık saclarının Steiner payı
    const inertiaCm4 =
      ((webThk / 10) * (webHeight / 10) ** 3 / 12) * 2
      + (((topWidth / 10) * ((topThk / 10) ** 3) / 12)
        + ((topThk / 10) * (topWidth / 10) * ((webHeight / 10) / 2) ** 2))
      + ((botThk / 10) * (botWidth / 10) * ((webHeight / 10) / 2) ** 2);
    const sectionModulusCm3 = inertiaCm4 / (webHeight / 20);
    const areaCm2 =
      (topThk / 10) * (topWidth / 10)
      + (webThk / 10) * (webHeight / 10) * 2
      + (botThk / 10) * (botWidth / 10);
    const webAreaCm2 = (webThk / 10) * (webHeight / 10) * 2;
    return { unitWeightKgM, inertiaCm4, sectionModulusCm3, areaCm2, webAreaCm2 };
  };

  const mid = boxSection(
    midTopPlateThkMm, midTopPlateWidthMm,
    midWebPlateThkMm, midWebPlateHeightMm,
    midBottomPlateThkMm, midBottomPlateWidthMm
  );
  const thick = boxSection(
    thickTopPlateThkMm, thickTopPlateWidthMm,
    thickWebPlateThkMm, thickWebPlateHeightMm,
    thickBottomPlateThkMm, thickBottomPlateWidthMm
  );
  Object.assign(cells, {
    "girder.forceMax": forceMaxKg,
    "girder.forceMin": forceMinKg,
    "girder.momentMax": momentMaxKgCm,
    "girder.momentMin": momentMinKgCm,
    "girder.midUnitWeight": mid.unitWeightKgM,
    "girder.midInertia": mid.inertiaCm4,
    "girder.midSectionModulus": mid.sectionModulusCm3,
    "girder.midArea": mid.areaCm2,
    "girder.midWebArea": mid.webAreaCm2,
    "girder.thickUnitWeight": thick.unitWeightKgM,
    "girder.thickInertia": thick.inertiaCm4,
    "girder.thickSectionModulus": thick.sectionModulusCm3,
    "girder.thickArea": thick.areaCm2,
    "girder.thickWebArea": thick.webAreaCm2,
  });

  // --- §4.6 Statik gerilmeler (dinamik katsayı ψ ile) -----------------------
  const psi = resolveDynamicFactor(specs, inp, hoistView.liftSpeedMpm);
  const staticBendingStress = (momentMaxKgCm * psi.psi) / mid.sectionModulusCm3;
  // Kesme gerilmesi mesnet bölgesinde kritiktir; orada kesit kalınlaştırılmıştır.
  const staticShearStress = (forceMaxKg * psi.psi) / thick.webAreaCm2;
  const staticCombinedStress = Math.sqrt(
    staticBendingStress ** 2 + 3 * staticShearStress ** 2
  );
  const allowableStaticStress = ALLOWABLE_STATIC_KGCM2[inp.fatigueMaterial];
  Object.assign(cells, {
    "girder.dynamicFactor": psi.psi,
    "girder.bendingStress": staticBendingStress,
    "girder.shearStress": staticShearStress,
    "girder.combinedStress": staticCombinedStress,
    "girder.allowableStress": allowableStaticStress,
  });
  checks.push({
    id: `${which}.girder.static`,
    label: "Kiriş Statik Bileşik Gerilmesi",
    required: staticCombinedStress, provided: allowableStaticStress,
    unit: "kg/cm²", op: ">=", computedSide: "required",
    pass: allowableStaticStress >= staticCombinedStress,
    standard: "FEM 1.001 T.3.2.1.1", kind: "standart", severity: "engelleyici",
  });

  // --- §4.6 Yorulma (DIN 15018) --------------------------------------------
  // Gerilme genliği, tam yüklü (maks) ve boş (min) durumların oranından çıkar.
  const sigmaMax = momentMaxKgCm / mid.sectionModulusCm3;
  const tauMax = forceMaxKg / mid.webAreaCm2;
  const combinedMax = Math.sqrt(sigmaMax ** 2 + 3 * tauMax ** 2);
  const sigmaMin = momentMinKgCm / mid.sectionModulusCm3;
  const tauMin = forceMinKg / mid.webAreaCm2;
  const combinedMin = Math.sqrt(sigmaMin ** 2 + 3 * tauMin ** 2);
  const kappa = combinedMin / combinedMax; // gerilme oranı x

  const steel = FATIGUE_STEEL_COLUMN[inp.fatigueMaterial];
  // zul σ D(-1): DIN 15018 Tablo 17 (çentik sınıfı × yük grubu) [N/mm²]
  const fatigueSigmaD1Nmm2 = DIN15018_T17[steel][inp.notchClass][inp.loadGroup];
  const fatigueSigmaD1KgCm2 = (fatigueSigmaD1Nmm2 * 100) / 9.81;
  // zul σ Dz(0) = 5/3 · zul σ D(-1)  (DIN 15018 Şekil 9)
  const fatigueSigmaDz0KgCm2 = (fatigueSigmaD1KgCm2 * 5) / 3;
  const ultimateStrengthKgCm2 =
    (ULTIMATE_STRENGTH_NMM2[inp.fatigueMaterial] * 100) / 9.81;
  // zul σ Dz(x) — DIN 15018 Tablo 18 gerilme oranı enterpolasyonu
  const fatigueAllowableSigmaKgCm2 =
    fatigueSigmaDz0KgCm2 /
    (1 - (1 - fatigueSigmaDz0KgCm2 / ultimateStrengthKgCm2 / 0.75) * kappa);
  // Kayma yorulması: kaynaksız (W0) çentik sınıfı satırı üzerinden, τ = σ/√3
  const fatigueTauW0Nmm2 = DIN15018_T17[steel]["W0"][inp.loadGroup];
  const fatigueTauW0KgCm2 = (fatigueTauW0Nmm2 * 100) / 9.81;
  const fatigueAllowableTauKgCm2 = fatigueTauW0KgCm2 / Math.sqrt(3);
  // Bileşik yorulma etkileşimi (DIN 15018 Bölüm 7.4.5)
  const fatigueCombinedRatio =
    (sigmaMax / fatigueAllowableSigmaKgCm2) ** 2 +
    (tauMax / fatigueAllowableTauKgCm2) ** 2;
  Object.assign(cells, {
    "fatigue.sigmaMax": sigmaMax,
    "fatigue.tauMax": tauMax,
    "fatigue.combinedMax": combinedMax,
    "fatigue.sigmaMin": sigmaMin,
    "fatigue.tauMin": tauMin,
    "fatigue.combinedMin": combinedMin,
    "fatigue.stressRatio": kappa,
    "fatigue.sigmaD1": fatigueSigmaD1Nmm2,
    "fatigue.sigmaD1KgCm2": fatigueSigmaD1KgCm2,
    "fatigue.sigmaDz0": fatigueSigmaDz0KgCm2,
    "fatigue.ultimateStrength": ultimateStrengthKgCm2,
    "fatigue.allowableSigma": fatigueAllowableSigmaKgCm2,
    "fatigue.tauW0": fatigueTauW0Nmm2,
    "fatigue.tauW0KgCm2": fatigueTauW0KgCm2,
    "fatigue.allowableTau": fatigueAllowableTauKgCm2,
    "fatigue.combined": fatigueCombinedRatio,
  });

  checks.push({
    id: `${which}.fatigue.sigma`,
    label: "Kiriş Yorulması — Normal Gerilme (σmax ≤ zul σ Dz(x))",
    required: sigmaMax, provided: fatigueAllowableSigmaKgCm2, unit: "kg/cm²",
    op: ">=", computedSide: "required",
    pass: fatigueAllowableSigmaKgCm2 >= sigmaMax,
    standard: "DIN 15018 Tablo 17/18", kind: "standart", severity: "engelleyici",
  });
  checks.push({
    id: `${which}.fatigue.tau`,
    label: "Kiriş Yorulması — Kesme Gerilmesi (τmax ≤ zul τ D(x))",
    required: tauMax, provided: fatigueAllowableTauKgCm2, unit: "kg/cm²",
    op: ">=", computedSide: "required",
    pass: fatigueAllowableTauKgCm2 >= tauMax,
    standard: "DIN 15018 Tablo 17", kind: "standart", severity: "engelleyici",
  });
  checks.push({
    id: `${which}.fatigue.combined`,
    label: "Kiriş Yorulması — Bileşik Oran",
    required: fatigueCombinedRatio, provided: 1.1, unit: "-", op: ">=",
    computedSide: "required",
    pass: 1.1 >= fatigueCombinedRatio,
    standard: "DIN 15018 Bölüm 7.4.5", kind: "standart", severity: "engelleyici",
  });

  const values: HookBlockValues = {
    hookCapacityKg: hookCapacity,
    hookCapacityFromTable: tableCapacityKg !== undefined,
    hookDinGroup,
    suggestedHookNumber,
    sheaveCoefficientH,
    minSheaveDiaMm,
    sheaveBearingRadialKn: bearingRadialKn,
    sheaveBearingAxialKn: bearingAxialKn,
    sheaveBearingEqStaticKn: bearingEqStaticKn,
    sheaveBearingEqDynamicKn: bearingEqDynamicKn,
    sheaveRpm,
    sheaveBearingLifeHours,
    requiredLifeMin,
    requiredLifeMax,
    sheaveBearingStaticSafety,
    ropeLoadKg,
    doubleRopeLoadKg,
    sheaveCount,
    sheavePositionsCm: geo.positionsCm,
    shaftSpanCm: geo.spanCm,
    reactionAKg: beam.reactionAKg,
    reactionBKg: beam.reactionBKg,
    shaftMomentKgCm,
    shaftShearKg,
    shaftSectionModulusCm3: stress.sectionModulusCm3,
    shaftShearAreaCm2: stress.shearAreaCm2,
    shaftBendingStress: stress.bendingStress,
    shaftShearStress: stress.shearStress,
    shaftCombinedStress: stress.combinedStress,
    shaftAllowables: shaftAllow,
    hookBearingAxialKn,
    hookBearingStaticSafety,
    fMaxKg: forceMaxKg,
    fMinKg: forceMinKg,
    maxMomentKgCm: momentMaxKgCm,
    minMomentKgCm: momentMinKgCm,
    midUnitWeightKgM: mid.unitWeightKgM,
    midInertiaCm4: mid.inertiaCm4,
    midSectionModulusCm3: mid.sectionModulusCm3,
    midAreaCm2: mid.areaCm2,
    midWebAreaCm2: mid.webAreaCm2,
    thickUnitWeightKgM: thick.unitWeightKgM,
    thickInertiaCm4: thick.inertiaCm4,
    thickSectionModulusCm3: thick.sectionModulusCm3,
    thickAreaCm2: thick.areaCm2,
    thickWebAreaCm2: thick.webAreaCm2,
    hoistClassUsed: psi.hoistClass,
    dynamicFactorOverridden: psi.overridden,
    dynamicFactorK: psi.k,
    dynamicFactorL: psi.l,
    dynamicFactor: psi.psi,
    staticBendingStress,
    staticShearStress,
    staticCombinedStress,
    allowableStaticStress,
    sigmaMax,
    tauMax,
    combinedMax,
    sigmaMin,
    tauMin,
    combinedMin,
    kappa,
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

/**
 * Kaldırma grubu sonucundan `HookBlockDeps` üretir (uygulama tarafı kolaylığı).
 * Kanca bloğundaki makara adedi burada donanımın tek gerçek kaynağından
 * (`reeving.ts`) türetilir; modülün kendi sayımı yoktur.
 */
export function hookBlockDepsFromHoist(hoist: {
  values: {
    ropeLoadKg: number; loadKg: number; totalLoadKg: number; drumRpm: number;
  };
  inputs: HoistInputs;
  selections: { ropeDiaMm: number; drumDiaMm: number };
}): HookBlockDeps {
  // Donanım tek kaynaktan okunur: hazır bir donanım etiketi seçilmişse kol
  // sayıları o seçimden gelir (hoistReeving), serbest girdiden değil.
  const reeving = deriveReeving(hoistReeving(hoist.inputs));
  return {
    ropeDiaMm: hoist.selections.ropeDiaMm,
    ropeLoadKg: hoist.values.ropeLoadKg,
    loadKg: hoist.values.loadKg,
    hookBlockWeightKg: hoist.inputs.hookBlockWeightKg,
    ropeWeightKg: hoist.inputs.ropeWeightKg,
    totalLoadKg: hoist.values.totalLoadKg,
    drumRpm: hoist.values.drumRpm,
    drumDiaMm: hoist.selections.drumDiaMm,
    blockSheaveCount: reeving.blockSheaveCount,
  };
}
