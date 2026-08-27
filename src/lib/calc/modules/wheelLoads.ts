// Teker yükleri hesabı — vincin YOL KİRİŞİNE (runway) aktardığı kuvvetlerin
// bütünü. Bir mekanizma hesabı değildir: çıktısı, yapı mühendisine teslim
// edilen karakteristik ve tasarım kuvvet setidir.
//
// Kapsam:
//   1) Düşey teker yükleri (araba en yakın / en uzak, yüklü ve yüksüz)
//   2) Kaldırma dinamik katsayısı φ2 ve tasarım teker yükü
//   3) Savrulma (skewing) kaynaklı enine yatay kuvvetler ve kılavuz kuvveti
//   4) Raya paralel boyuna kuvvetler (ivmelenme / frenleme)
//
// Dayanaklar:
//   FEM 1.001 Kitapçık 9 md. 9.3       — φ2 = φ2min + β2·νh  (T.9.3.a, T.9.3.b)
//   FEM 1.001 Kitapçık 9 md. 9.4.1.3   — f = 0,3·(1 − e^(−250α)),  Fy = ν·f·mg
//   FEM 1.001 Kitapçık 9 md. 9.4.1.4   — Fx = ξ·f·mg, Fy_i = ν_i·f·mg (T.9.4)
//   FEM 1.001 Kitapçık 9 md. 9.4.1.5   — α = αg + αw + αt ≤ 0,015 rad
//   FEM 1.001 Kitapçık 2 md. 2.2.3.1.1 — yürütme ivmelenme kuvveti; kuvvet
//                                        tahrikli teker yükünün 1/30'undan az,
//                                        1/4'ünden çok alınmaz
//   FEM 1.001 Kitapçık 2 md. 2.3.1     — Yükleme Durumu I: SG + ψ·SL + SH
//
// SAPMA (belgelenmiş): µ, ağırlık merkezinin 1 numaralı raya olan normalize
// uzaklığıdır (FEM Kitapçık 9, F.9.4.b altındaki metin: "mg, 1 numaralı raydan
// µl uzaklıkta etkir"). Ağırlık merkezi YALNIZ arabanın konumundan değil,
// köprünün kendi ağırlığının açıklık ortasındaki payından da etkilenir.
// Bu yüzden µ, araba kolundan (l−e)/l diye değil, DÜŞEY TEKER YÜKLERİNDEN
// türetilir — böylece savrulma bloğu ile düşey yük bloğu aynı yük dağılımını
// kullanır ve iki blok birbirini doğrular.
//
// Birimler: kg, t, m, mm, N, kN, m/s, m/s², rad.

import { railNominalHeadWidthMm } from "../tables";
import type { AnyCheck, MechanismClass, ModuleResult, TechnicalSpecs } from "../types";

/** FEM Kitapçık 9 T.9.3.a — kaldırma sınıfı (dinamik davranış). */
export type HoistingClass = "HC1" | "HC2" | "HC3" | "HC4";

/** FEM Kitapçık 9 T.9.3.b — kaldırma tahrikinin işletme biçimi. */
export type HoistDriveClass = "HD1" | "HD2" | "HD3" | "HD4" | "HD5";

/**
 * FEM Kitapçık 9 F.9.4.a — enine teker çiftinin türü.
 *
 * İlk harf teker çiftinin bağlı (C, coupled: mekanik mil ya da elektriksel
 * senkronizasyon) veya bağımsız (I, independent) olduğunu; sonraki iki harf
 * iki tarafın yanal serbestliğini (F sabit / M hareketli — ör. mafsallı ayak)
 * gösterir. Standart gezer köprülü vinçte iki taraf da sabittir (F/F).
 */
export type WheelPairMode = "CFF" | "IFF" | "CFM" | "IFM";

/** Vincin yanal kılavuzlaması — teker flanşı ya da ayrı kılavuz teker. */
export type GuideMeans = "flange" | "roller";

/** FEM Kitapçık 9 T.9.3.a — β2 [s/m] ve φ2min */
export const HOISTING_CLASS_FACTORS: Record<
  HoistingClass,
  { beta2: number; phi2Min: number }
> = {
  HC1: { beta2: 0.17, phi2Min: 1.05 },
  HC2: { beta2: 0.34, phi2Min: 1.1 },
  HC3: { beta2: 0.51, phi2Min: 1.15 },
  HC4: { beta2: 0.68, phi2Min: 1.2 },
};

/**
 * ORION yeni iş kuralı — ana kaldırma mekanizma sınıfından FEM kaldırma
 * dinamik sınıfına geçiş. FEM'in geçerli sınıf kodları HC1…HC4'tür.
 */
export function hoistingClassForMechanism(mechanismClass: MechanismClass): HoistingClass {
  if (mechanismClass === "M8") return "HC4";
  if (mechanismClass === "M7") return "HC3";
  if (mechanismClass === "M6") return "HC2";
  return "HC1";
}

/** Ana kaldırma sürünme hızı için ORION başlangıç kuralı: anma hızının %10'u. */
export function creepSpeedForLiftSpeed(liftSpeedMpm: number): number {
  return Math.max(0, liftSpeedMpm) * 0.1;
}

/**
 * Köprü teker çapından tek taraf kılavuz boşluğu [mm]. Katalog çapları
 * arasındaki ara değerler bir sonraki tanımlı çapa kadar aynı kademede kalır.
 */
export function guideClearanceForWheelDiameter(wheelDiaMm: number): number {
  const dia = Math.max(0, wheelDiaMm);
  if (dia <= 200) return 5;
  if (dia <= 315) return 7.5;
  if (dia <= 630) return 10;
  if (dia <= 800) return 12.5;
  return 15;
}

/** FEM Kitapçık 9 md. 9.4.1.5 — savrulma açısının tolerans payı [rad] */
export const SKEW_TOLERANCE_RAD = 0.001;

/** FEM Kitapçık 9 md. 9.4.1.3 — savrulma açısı üst sınırı [rad] */
export const SKEW_ANGLE_LIMIT_RAD = 0.015;

/** FEM Kitapçık 9 md. 9.4.1.2 — sürtünme fonksiyonunun doyum değeri */
const FRICTION_SATURATION = 0.3;

/** FEM Kitapçık 2 md. 2.2.3.1.1 — boyuna kuvvetin tahrikli teker yükü bandı */
export const LONGITUDINAL_MIN_RATIO = 1 / 30;
export const LONGITUDINAL_MAX_RATIO = 1 / 4;

/**
 * FEM Kitapçık 2 md. 2.2.3.4.1 (Kitapçık 9 md. 9.4.2 ile değiştirilmiş) —
 * bu hızın altında tampon çarpma etkisi hesaba katılmaz [m/s].
 */
export const BUFFER_SPEED_THRESHOLD_MS = 0.4;

/** Yerçekimi ivmesi [m/s²] — kg ↔ N dönüşümü */
const G = 9.81;

/** Diğer modüllerden gelen değerler — modül saf kalsın diye parametre olarak. */
export interface WheelLoadDeps {
  /** Köprünün toplam teker adedi */
  wheelCount: number;
  /** Tahrikli teker adedi (tahrik adedi × motor başına teker) */
  drivenWheels: number;
  /** Gerçekleşen köprü yürütme hızı [m/dak] */
  travelSpeedMpm: number;
  /** Köprü yürütme ivmesi [m/s²] */
  accelerationMs2: number;
  /** Minimum araba yanaşması [m] */
  minApproachM: number;
  /** Köprü rayı kodu (ray başı genişliği buradan okunur) */
  railCode: string;
  /** Kaldırma yükü: kapasite + kanca bloğu + halat [t] — FEM 9.3'e göre SL */
  hoistLoadT: number;
  /** Köprünün taşıdığı toplam araba ağırlığı [t] */
  trolleyWeightT: number;
  /** Köprü ağırlığı [t] — ana kirişler + başkirişler */
  bridgeWeightT: number;
  /** Tampon tepki kuvveti [kN] — köprü yürütme bölümünden okunur */
  bufferForceKn: number;
}

/**
 * Köprü yürütme bölümü + ana kaldırmadan bağımlılık paketi kurar.
 *
 * Motor (`runCalc`) ve editör (`buildModuleDeps`) aynı kaynaklardan beslensin
 * diye tek yerde durur; modül saf kalması için yalnız ilkel değerler alır.
 */
export function wheelLoadDepsFrom(src: {
  bridgeWheelCount: number;
  bridgeDrivenWheels: number;
  bridgeActualSpeedMpm: number;
  bridgeAccelerationMs2: number;
  bridgeMinApproachM: number;
  bridgeRailCode: string;
  bridgeBufferForceKn: number;
  mainHoistTotalLoadKg: number;
  trolleyWeightT: number;
  bridgeWeightT: number;
}): WheelLoadDeps {
  return {
    wheelCount: src.bridgeWheelCount,
    drivenWheels: src.bridgeDrivenWheels,
    travelSpeedMpm: src.bridgeActualSpeedMpm,
    accelerationMs2: src.bridgeAccelerationMs2,
    minApproachM: src.bridgeMinApproachM,
    railCode: src.bridgeRailCode,
    hoistLoadT: src.mainHoistTotalLoadKg / 1000,
    trolleyWeightT: src.trolleyWeightT,
    bridgeWeightT: src.bridgeWeightT,
    bufferForceKn: src.bridgeBufferForceKn,
  };
}

/** Kullanıcı girdileri (geometri ve tasarım kabulleri) */
export interface WheelLoadInputs {
  /** Vinç verileri ve teker düzeni ölçülerinin kullanıcı tarafından onayı. */
  measurementsConfirmed?: boolean;
  /**
   * BİR RAY üzerindeki ardışık teker eksenleri arası yatay mesafeler [mm],
   * virgülle ayrılmış. Teker adedi ray başına n ise n−1 değer beklenir
   * (ör. 8 tekerli rayda "1100, 1410, 1100, 6600, 1100, 1410, 1100").
   * Karşı ray aynıdır — vinç dört köşesinde eşit tekerle yürür.
   */
  wheelSpacingsText: string;
  /**
   * Kılavuz elemanları arası mesafe wb [mm] — savrulma açısının paydası.
   * Teker flanşıyla kılavuzlamada dingil mesafesine eşittir.
   */
  guideSpacingMm: number;
  /** wb dingil mesafesinden alınsın (teker flanşıyla kılavuzlama) */
  guideSpacingAuto?: boolean;
  /** Kılavuz boşluğu — TEK TARAF [mm]. FEM'in sg değeri bunun iki katıdır. */
  guideClearanceMm: number;
  /** Kılavuz boşluğu köprü teker çapından türetilsin. */
  guideClearanceAuto?: boolean;
  /** Bağlı (coupled) teker çifti adedi p — FEM Kitapçık 9 md. 9.4.1.3 */
  coupledPairCount: number;
  /** p, teker çifti türü ve tahrikli teker sayısından türetilsin */
  coupledPairAuto?: boolean;
  /** Kaldırma sürünme (creep) hızı [m/dak] — HD2/HD3'te φ2'ye girer */
  creepSpeedMpm: number;
  /** Sürünme hızı ana kaldırma hızının %10'u olarak türetilsin. */
  creepSpeedAuto?: boolean;
  /** Kaldırma sınıfı ana kaldırma mekanizma sınıfından türetilsin. */
  hoistingClassAuto?: boolean;
}

/** Mühendis seçimleri */
export interface WheelLoadSelections {
  hoistingClass: HoistingClass;
  hoistDriveClass: HoistDriveClass;
  wheelPairMode: WheelPairMode;
  guideMeans: GuideMeans;
}

/** Tek bir tekerin savrulma kuvvetleri */
export interface WheelSkewForce {
  /** 1'den başlayan teker sırası */
  index: number;
  /** Teker kodu — "A1", "A2", … "B1", … (A: ön köşe, B: arka köşe) */
  code: string;
  /** Kılavuz elemandan uzaklık dᵢ [m] */
  distanceM: number;
  /** Yakın (yüklü) raydaki enine kuvvet [N] */
  lateralNearN: number;
  /** Uzak raydaki enine kuvvet [N] */
  lateralFarN: number;
  /** Raya paralel teğetsel kuvvet [N] — her iki rayda aynı */
  longitudinalN: number;
}

export interface WheelLoadValues {
  // Teker düzeni
  totalWheels: number;
  wheelsPerSide: number;
  wheelsPerCorner: number;
  /** Ardışık tekerler arası mesafeler [mm] — ray başına n−1 değer */
  spacingsMm: number[];
  /** Teker kodları — "A1" … "Bk" (ray başına n değer) */
  codes: string[];
  /** Dingil mesafesi [mm] — ilk ve son teker ekseni arası (Σ mesafeler) */
  wheelbaseMm: number;
  positionsM: number[];
  sumDM: number;
  sumD2M2: number;
  coupledPairs: number;
  railHeadWidthMm: number;
  // Ağırlıklar
  hoistLoadKg: number;
  deadLoadKg: number;
  totalLoadKg: number;
  // Düşey yükler [kg]
  maxWheelLoadKg: number;
  minWheelLoadKg: number;
  minUnloadedWheelLoadKg: number;
  designWheelLoadKg: number;
  nearRailShare: number;
  // Dinamik katsayı
  phi2: number;
  phi2Min: number;
  beta2: number;
  hoistSpeedMs: number;
  // Savrulma
  alphaGuideRad: number;
  alphaWearRad: number;
  alphaToleranceRad: number;
  alphaRad: number;
  frictionF: number;
  weightForceN: number;
  mu: number;
  muPrime: number;
  poleDistanceM: number;
  nu: number;
  xi: number;
  guideForceN: number;
  guideForceBalanceN: number;
  wheels: WheelSkewForce[];
  maxLateralNearN: number;
  maxLateralFarN: number;
  longitudinalSkewPerWheelN: number;
  skewApplicable: boolean;
  // Boyuna kuvvetler
  travelSpeedMs: number;
  accelTimeS: number;
  inertiaForceN: number;
  drivenWheelLoadN: number;
  longitudinalRatio: number;
  designLongitudinalN: number;
  longitudinalPerRailN: number;
  longitudinalPerDrivenWheelN: number;
  bufferConsidered: boolean;
  bufferForceKn: number;
}

/**
 * Bir vinçte olabilecek toplam teker adetleri.
 *
 * Vinç DÖRT KÖŞESİNDE eşit sayıda tekerle yürür: toplam teker adedi daima
 * dördün katıdır. 16 tekerli bir vinçte her köşede 4, her rayda 8 teker olur.
 */
export const WHEEL_COUNT_OPTIONS = [4, 8, 12, 16, 20, 24] as const;

/**
 * Teker mesafeleri okunamadığında kullanılan varsayılanlar [mm].
 * Köşe içi mesafe boji teker aralığı, köşeler arası mesafe dingil aralığıdır.
 */
export const DEFAULT_CORNER_GAP_MM = 1500;
export const DEFAULT_BOGIE_GAP_MM = 5500;

/** Toplam teker adedini en yakın geçerli seçeneğe oturtur. */
export function normalizeWheelCount(count: number): number {
  if (!Number.isFinite(count)) return WHEEL_COUNT_OPTIONS[0];
  const rounded = Math.round(count / 4) * 4;
  return Math.min(
    WHEEL_COUNT_OPTIONS[WHEEL_COUNT_OPTIONS.length - 1],
    Math.max(WHEEL_COUNT_OPTIONS[0], rounded)
  );
}

/**
 * Teker kodları — bir ray üzerindeki tekerler, yürüme yönünde ön köşeden
 * başlayarak "A1…Ak" ve arka köşede "B1…Bk" diye kodlanır. Karşı ray aynı
 * kodları taşır (vinç dört köşesinde eşit tekerle yürür); rapor ve şema bu
 * kodlarla konuşur.
 */
export function wheelCodes(wheelsPerSide: number): string[] {
  const n = Math.max(1, Math.round(wheelsPerSide));
  const perCorner = Math.max(1, Math.round(n / 2));
  return Array.from({ length: n }, (_, i) =>
    i < perCorner ? `A${i + 1}` : `B${i - perCorner + 1}`
  );
}

/**
 * Ardışık tekerler arası mesafeleri çözer — ray başına n−1 değer.
 *
 * Metin ayrıştırılamazsa ya da adet tutmuyorsa simetrik bir varsayılana
 * düşülür: köşe içi boşluklar `DEFAULT_CORNER_GAP_MM`, iki köşe arası
 * `DEFAULT_BOGIE_GAP_MM`. Bozuk girdi hesabı NaN'a çevirmez; görsel düzenleyici
 * bu değerleri hemen gösterdiği için mühendis farkı anında görür.
 */
export function resolveWheelSpacings(text: string, wheelsPerSide: number): number[] {
  const n = Math.max(1, Math.round(wheelsPerSide));
  const gaps = Math.max(0, n - 1);
  const perCorner = Math.max(1, Math.round(n / 2));
  const fallback = (): number[] =>
    Array.from({ length: gaps }, (_, i) =>
      i === perCorner - 1 ? DEFAULT_BOGIE_GAP_MM : DEFAULT_CORNER_GAP_MM
    );

  const parsed = String(text ?? "")
    .split(/[;,\s]+/)
    .map((t) => Number(t.replace(",", ".")))
    .filter((v) => Number.isFinite(v) && v >= 0);
  if (parsed.length !== gaps) return fallback();
  return parsed;
}

/** Mesafelerden teker eksen konumları [mm] — ilk teker referans (0). */
export function positionsFromSpacings(spacingsMm: number[]): number[] {
  const out = [0];
  for (const gap of spacingsMm) out.push(out[out.length - 1] + Math.max(0, gap));
  return out;
}

/**
 * FEM Kitapçık 9 T.9.3.b — φ2 hesabına giren kaldırma hızı νh [m/s].
 * Yükleme Durumu I/II satırı kullanılır (kaldırılan yükün yerden alınması).
 */
export function hoistSpeedForPhi2(
  drive: HoistDriveClass,
  liftSpeedMpm: number,
  creepSpeedMpm: number
): number {
  const vMax = Math.max(0, liftSpeedMpm) / 60;
  const vCreep = Math.max(0, creepSpeedMpm) / 60;
  switch (drive) {
    case "HD1":
      return vMax;
    case "HD2":
    case "HD3":
      return vCreep;
    case "HD4":
      return 0.5 * vMax;
    case "HD5":
      return 0;
  }
}

/** Teker çifti türü bağlı (coupled) mı — ξ ve p bundan çıkar. */
export function isCoupledMode(mode: WheelPairMode): boolean {
  return mode === "CFF" || mode === "CFM";
}

/** İki taraf da yanal sabit mi (F/F) — h ve ν bağıntıları buna göre dallanır. */
export function isFixedFixed(mode: WheelPairMode): boolean {
  return mode === "CFF" || mode === "IFF";
}

/**
 * Bağlı teker çifti adedi p — otomatikte tahrikli teker çiftlerinden okunur.
 * Bağımsız (I) düzende hiçbir çift bağlı değildir → p = 0.
 */
export function autoCoupledPairs(
  mode: WheelPairMode,
  drivenWheels: number,
  wheelsPerSide: number
): number {
  if (!isCoupledMode(mode)) return 0;
  const pairs = Math.round(Math.max(0, drivenWheels) / 2);
  return Math.min(wheelsPerSide, Math.max(0, pairs));
}

export function computeWheelLoads(
  specs: TechnicalSpecs,
  inp: WheelLoadInputs,
  sel: WheelLoadSelections,
  deps: WheelLoadDeps
): ModuleResult<WheelLoadValues> {
  const cells: Record<string, number | string> = {};
  const checks: AnyCheck[] = [];
  const set = (key: string, value: number | string) => {
    cells[key] = value;
  };

  // --- 1) Teker düzeni ------------------------------------------------------
  // Vinç dört köşesinde eşit tekerle yürür: toplam / 4 = köşe başına teker,
  // toplam / 2 = ray başına teker. Geometri BİR RAY için girilir; karşı ray
  // aynıdır.
  const totalWheels = normalizeWheelCount(deps.wheelCount);
  const wheelsPerSide = totalWheels / 2;
  const wheelsPerCorner = totalWheels / 4;
  const spacingsMm = resolveWheelSpacings(inp.wheelSpacingsText, wheelsPerSide);
  const positionsMm = positionsFromSpacings(spacingsMm);
  const codes = wheelCodes(wheelsPerSide);
  const wheelbaseMm = positionsMm[positionsMm.length - 1];
  const positionsM = positionsMm.map((v) => v / 1000);
  const sumD = positionsM.reduce((a, b) => a + b, 0);
  const sumD2 = positionsM.reduce((a, b) => a + b * b, 0);
  // Aşınma payı rayın ANMA baş genişliğini ister (teker basıncındaki etkin
  // genişliği değil) — FEM Kitapçık 9 md. 9.4.1.5.
  const railHeadWidth = railNominalHeadWidthMm(deps.railCode);
  const requestedPairs = inp.coupledPairAuto
    ? autoCoupledPairs(sel.wheelPairMode, deps.drivenWheels, wheelsPerSide)
    : Math.min(wheelsPerSide, Math.max(0, Math.round(inp.coupledPairCount)));
  // Bağımsız (I) düzende tanım gereği hiçbir teker çifti bağlı değildir; elle
  // girilen p değeri seçilen düzenle çelişemez (FEM Kitapçık 9 md. 9.4.1.1).
  const coupledPairs = isCoupledMode(sel.wheelPairMode) ? requestedPairs : 0;

  set("wheelSet.total", totalWheels);
  set("wheelSet.perSide", wheelsPerSide);
  set("wheelSet.perCorner", wheelsPerCorner);
  set("wheelSet.wheelbase", wheelbaseMm);
  set("wheelSet.sumDistance", sumD);
  set("wheelSet.sumDistanceSq", sumD2);
  set("wheelSet.coupledPairs", coupledPairs);
  set("wheelSet.railHeadWidth", railHeadWidth);
  set(
    "wheelSet.measurementsConfirmed",
    inp.measurementsConfirmed === true ? "Onaylandı" : "Onay Bekliyor"
  );
  checks.push({
    id: "wheelLoads.measurements.confirmed",
    label: "Vinç Verileri ve Teker Düzeni Ölçü Onayı",
    required: 1,
    provided: inp.measurementsConfirmed === true ? 1 : 0,
    unit: "-",
    op: ">=",
    computedSide: "provided",
    pass: inp.measurementsConfirmed === true,
    standard: "ORION tasarım veri onayı",
    kind: "firma",
    severity: "engelleyici",
  });

  // --- 2) Ağırlıklar ve düşey teker yükleri --------------------------------
  // FEM 9.3'e göre kaldırma yükü SL, kaldırılan yükü + kaldırma aparatını +
  // asılı halat payını kapsar; araba ve köprü ölü yüktür (SG).
  const hoistLoadKg = Math.max(0, deps.hoistLoadT) * 1000;
  const trolleyKg = Math.max(0, deps.trolleyWeightT) * 1000;
  const bridgeKg = Math.max(0, deps.bridgeWeightT) * 1000;
  const deadLoadKg = trolleyKg + bridgeKg;
  const totalLoadKg = hoistLoadKg + deadLoadKg;

  const span = Math.max(1e-6, specs.spanM);
  const approach = Math.min(Math.max(0, deps.minApproachM), span / 2);
  // Araba yakın raya yanaşınca kolun yakın raya düşen payı; köprü kendi
  // ağırlığını iki raya eşit paylaştırır.
  const nearLever = (span - approach) / span;
  const farLever = approach / span;
  const perWheel = (loadKg: number) => loadKg / wheelsPerSide;

  const hoistNearKg = hoistLoadKg * nearLever;
  const trolleyNearKg = trolleyKg * nearLever;
  const bridgeShareKg = bridgeKg / 2;
  const maxWheelLoadKg = perWheel(hoistNearKg + trolleyNearKg + bridgeShareKg);
  const minWheelLoadKg = perWheel(
    (hoistLoadKg + trolleyKg) * farLever + bridgeShareKg
  );
  const minUnloadedWheelLoadKg = perWheel(trolleyKg * farLever + bridgeShareKg);
  // Yakın rayın toplam yükten aldığı pay — savrulma bloğu bunu µ' olarak kullanır.
  const nearRailShare = (maxWheelLoadKg * wheelsPerSide) / Math.max(1e-9, totalLoadKg);

  set("vertical.hoistLoad", hoistLoadKg);
  set("vertical.deadLoad", deadLoadKg);
  set("vertical.totalLoad", totalLoadKg);
  set("vertical.nearLever", nearLever);
  set("vertical.maxWheelLoad", maxWheelLoadKg);
  set("vertical.minWheelLoad", minWheelLoadKg);
  set("vertical.minUnloadedWheelLoad", minUnloadedWheelLoadKg);
  set("vertical.nearRailShare", nearRailShare);

  // --- 3) Dinamik katsayı φ2 (FEM Kitapçık 9 md. 9.3) -----------------------
  const { beta2, phi2Min } = HOISTING_CLASS_FACTORS[sel.hoistingClass];
  const hoistSpeedMs = hoistSpeedForPhi2(
    sel.hoistDriveClass,
    specs.mainLiftSpeedMpm,
    inp.creepSpeedMpm
  );
  const phi2 = phi2Min + beta2 * hoistSpeedMs;
  // Yükleme Durumu I: yalnız KALDIRMA YÜKÜ büyütülür, ölü yük büyütülmez
  // (FEM Kitapçık 2 md. 2.3.1: SG + ψ·SL + SH).
  const designWheelLoadKg = perWheel(
    phi2 * hoistNearKg + trolleyNearKg + bridgeShareKg
  );

  set("dynamic.phi2Min", phi2Min);
  set("dynamic.beta2", beta2);
  set("dynamic.hoistSpeed", hoistSpeedMs);
  set("dynamic.phi2", phi2);
  set("vertical.designWheelLoad", designWheelLoadKg);

  // --- 4) Savrulma açısı α (FEM Kitapçık 9 md. 9.4.1.5) --------------------
  const guideSpacingMm = inp.guideSpacingAuto ? wheelbaseMm : inp.guideSpacingMm;
  const wb = Math.max(1e-6, guideSpacingMm);
  // sg, kılavuzun TOPLAM boşluğudur: tek taraf boşluğun iki katı.
  const slackMm = 2 * Math.max(0, inp.guideClearanceMm);
  const alphaGuide = slackMm / wb;
  const alphaWear = 0.1 * (railHeadWidth / wb);
  const alphaTolerance = SKEW_TOLERANCE_RAD;
  const alpha = alphaGuide + alphaWear + alphaTolerance;
  const frictionF = FRICTION_SATURATION * (1 - Math.exp(-250 * alpha));

  // Savrulma açıları MİLİRADYAN olarak yayımlanır: rad cinsinden değerler
  // (0,00933 gibi) rapor biçimlendirmesinde okunmaz hâle geliyordu ve 0,015
  // sınırıyla karşılaştırması anlamsızlaşıyordu. `values` SI biriminde kalır.
  const MRAD = 1000;
  set("skew.alphaGuide", alphaGuide * MRAD);
  set("skew.alphaWear", alphaWear * MRAD);
  set("skew.alphaTolerance", alphaTolerance * MRAD);
  set("skew.angle", alpha * MRAD);
  set("skew.angleLimit", SKEW_ANGLE_LIMIT_RAD * MRAD);
  set("skew.friction", frictionF);
  checks.push({
    id: "wheelLoads.skew.angle",
    label: "Savrulma Açısı α",
    required: alpha * MRAD,
    provided: SKEW_ANGLE_LIMIT_RAD * MRAD,
    unit: "mrad",
    op: ">=",
    computedSide: "required",
    pass: alpha <= SKEW_ANGLE_LIMIT_RAD,
    standard: "FEM 1.001 9.4.1.5",
    kind: "standart",
    severity: "engelleyici",
  });

  // --- 5) Savrulma kuvvetleri (FEM Kitapçık 9 md. 9.4.1.3 / T.9.4) ---------
  // µ, ağırlık merkezinin 1 numaralı raya normalize uzaklığıdır; 1 numaralı
  // ray (yakın ray) toplam yükün µ' = 1 − µ payını taşır.
  const muPrime = nearRailShare;
  const mu = 1 - muPrime;
  const weightForceN = totalLoadKg * G;
  const fixedFixed = isFixedFixed(sel.wheelPairMode);
  // n ≥ 2 teker ve Σd > 0 olmadan anlık kayma kutbu tanımsızdır (tek tekerli
  // taraf savrulmaya direnç üretmez).
  const skewApplicable = wheelsPerSide >= 2 && sumD > 0;

  const poleTerm = fixedFixed
    ? coupledPairs * mu * muPrime * span ** 2
    : coupledPairs * mu * span ** 2;
  const poleDistance = skewApplicable ? (poleTerm + sumD2) / sumD : 0;
  const nuBase = skewApplicable
    ? 1 - sumD / (wheelsPerSide * poleDistance)
    : 0;
  const nu = fixedFixed ? nuBase : muPrime * nuBase;
  const xi =
    skewApplicable && isCoupledMode(sel.wheelPairMode)
      ? (mu * muPrime * span) / (wheelsPerSide * poleDistance)
      : 0;
  const guideForceN = nu * frictionF * weightForceN;

  set("skew.mu", mu);
  set("skew.muPrime", muPrime);
  set("skew.weightForce", weightForceN / 1000);
  set("skew.poleDistance", poleDistance);
  set("skew.nu", nu);
  set("skew.xi", xi);
  set("skew.guideForce", guideForceN / 1000);

  const wheels: WheelSkewForce[] = positionsM.map((d, i) => {
    const shape = skewApplicable ? 1 - d / poleDistance : 0;
    const nearFactor = (muPrime / wheelsPerSide) * shape;
    // F/M düzende hareketli taraf enine kuvvet taşımaz (T.9.4: ν2i = 0).
    const farFactor = fixedFixed ? (mu / wheelsPerSide) * shape : 0;
    return {
      index: i + 1,
      code: codes[i] ?? `T${i + 1}`,
      distanceM: d,
      lateralNearN: nearFactor * frictionF * weightForceN,
      lateralFarN: farFactor * frictionF * weightForceN,
      longitudinalN: xi * frictionF * weightForceN,
    };
  });
  const guideForceBalanceN = wheels.reduce(
    (a, w) => a + w.lateralNearN + w.lateralFarN,
    0
  );
  const maxLateralNearN = wheels.reduce((a, w) => Math.max(a, w.lateralNearN), 0);
  const maxLateralFarN = wheels.reduce((a, w) => Math.max(a, w.lateralFarN), 0);
  const longitudinalSkewPerWheelN = xi * frictionF * weightForceN;

  set("skew.maxLateralNear", maxLateralNearN / 1000);
  set("skew.maxLateralFar", maxLateralFarN / 1000);
  set("skew.longitudinalPerWheel", longitudinalSkewPerWheelN / 1000);
  set("skew.guideForceBalance", guideForceBalanceN / 1000);

  // Model doğrulaması: teker enine kuvvetlerinin toplamı kılavuz kuvvetini
  // vermelidir (FEM Kitapçık 9 md. 9.4.1.3 — Fy, teğetsel kuvvetlerle dengede).
  const balanceErrorKn = Math.abs(guideForceBalanceN - guideForceN) / 1000;
  const balanceToleranceKn = Math.max(0.01, Math.abs(guideForceN) * 1e-6 / 1000);
  set("skew.balanceError", balanceErrorKn);
  checks.push({
    id: "wheelLoads.skew.balance",
    label: "Kılavuz Kuvveti Denge Kontrolü",
    required: balanceErrorKn,
    provided: balanceToleranceKn,
    unit: "kN",
    op: ">=",
    computedSide: "required",
    pass: balanceErrorKn <= balanceToleranceKn,
    standard: "FEM 1.001 9.4.1.3",
    kind: "bilgi",
    severity: "uyari",
  });

  // --- 6) Boyuna kuvvetler (FEM Kitapçık 2 md. 2.2.3.1.1) ------------------
  const travelSpeedMs = Math.max(0, deps.travelSpeedMpm) / 60;
  const acceleration = Math.max(1e-9, deps.accelerationMs2);
  const accelTimeS = travelSpeedMs / acceleration;
  const inertiaForceN = totalLoadKg * deps.accelerationMs2;
  // Kuvvet tahrikli tekerlerin tabanında raya paralel etkir; sürtünmeyle
  // aktarılabilen pay tahrikli tekerlerin taşıdığı düşey yüke bağlıdır.
  const drivenWheels = Math.min(
    Math.max(1, Math.round(deps.drivenWheels)),
    totalWheels
  );
  const drivenWheelLoadN = (totalLoadKg * G * drivenWheels) / totalWheels;
  const longitudinalRatio = inertiaForceN / Math.max(1e-9, drivenWheelLoadN);
  const floorN = drivenWheelLoadN * LONGITUDINAL_MIN_RATIO;
  const ceilingN = drivenWheelLoadN * LONGITUDINAL_MAX_RATIO;
  const designLongitudinalN = Math.min(Math.max(inertiaForceN, floorN), ceilingN);
  // Hangi sınırın devreye girdiği raporda açıkça yazılır: mühendis, tasarım
  // kuvvetinin kendi ivme kabulünden mi yoksa FEM bandından mı geldiğini görür.
  const bound =
    inertiaForceN < floorN
      ? "FEM alt sınırı (W_t/30)"
      : inertiaForceN > ceilingN
        ? "FEM üst sınırı (W_t/4)"
        : "hesaplanan atalet kuvveti";

  set("longitudinal.bound", bound);
  set("longitudinal.travelSpeed", travelSpeedMs);
  set("longitudinal.accelTime", accelTimeS);
  set("longitudinal.inertiaForce", inertiaForceN / 1000);
  set("longitudinal.drivenWheels", drivenWheels);
  set("longitudinal.drivenWheelLoad", drivenWheelLoadN / 1000);
  set("longitudinal.ratio", longitudinalRatio);
  set("longitudinal.designForce", designLongitudinalN / 1000);
  set("longitudinal.perRail", designLongitudinalN / 2000);
  set("longitudinal.perDrivenWheel", designLongitudinalN / drivenWheels / 1000);
  // FEM'in 1/30 ALT sınırı bir tasarım tabanıdır, kabul ölçütü değil: ivme
  // düşükse kuvvet o tabana yükseltilir ve tasarım güvenli tarafta kalır.
  // Kontrole değer olan ÜST sınırdır — atalet kuvveti tahrikli teker yükünün
  // 1/4'ünü aşarsa tekerler kayar ve öngörülen ivme gerçekleşmez.
  checks.push({
    id: "wheelLoads.longitudinal.transferable",
    label: "Boyuna Kuvvet ≤ Sürtünmeyle Aktarılabilen Sınır (W_t/4)",
    required: inertiaForceN / 1000,
    provided: ceilingN / 1000,
    unit: "kN",
    op: ">=",
    computedSide: "required",
    pass: inertiaForceN <= ceilingN,
    standard: "FEM 1.001 2.2.3.1.1",
    kind: "standart",
    severity: "uyari",
  });

  // --- 7) Tampon (FEM Kitapçık 2 md. 2.2.3.4.1 / Kitapçık 9 md. 9.4.2) -----
  const bufferConsidered = travelSpeedMs > BUFFER_SPEED_THRESHOLD_MS;
  set("buffer.speedThreshold", BUFFER_SPEED_THRESHOLD_MS);
  set("buffer.reactionForce", bufferConsidered ? deps.bufferForceKn : 0);

  const values: WheelLoadValues = {
    totalWheels,
    wheelsPerSide,
    wheelsPerCorner,
    spacingsMm,
    codes,
    wheelbaseMm,
    positionsM,
    sumDM: sumD,
    sumD2M2: sumD2,
    coupledPairs,
    railHeadWidthMm: railHeadWidth,
    hoistLoadKg,
    deadLoadKg,
    totalLoadKg,
    maxWheelLoadKg,
    minWheelLoadKg,
    minUnloadedWheelLoadKg,
    designWheelLoadKg,
    nearRailShare,
    phi2,
    phi2Min,
    beta2,
    hoistSpeedMs,
    alphaGuideRad: alphaGuide,
    alphaWearRad: alphaWear,
    alphaToleranceRad: alphaTolerance,
    alphaRad: alpha,
    frictionF,
    weightForceN,
    mu,
    muPrime,
    poleDistanceM: poleDistance,
    nu,
    xi,
    guideForceN,
    guideForceBalanceN,
    wheels,
    maxLateralNearN,
    maxLateralFarN,
    longitudinalSkewPerWheelN,
    skewApplicable,
    travelSpeedMs,
    accelTimeS,
    inertiaForceN,
    drivenWheelLoadN,
    longitudinalRatio,
    designLongitudinalN,
    longitudinalPerRailN: designLongitudinalN / 2,
    longitudinalPerDrivenWheelN: designLongitudinalN / drivenWheels,
    bufferConsidered,
    bufferForceKn: bufferConsidered ? deps.bufferForceKn : 0,
  };

  return { values, checks, cells };
}
