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
import {
  din15407Row,
  hookDesignationText,
  hookStandardOf,
  isLamellaHook,
  smallestDin15407Key,
  type Din15407Row,
  type HookStandard,
} from "../hook-standards";
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

/**
 * §4.2 — STANDART MAKARA ÇAPINA İNİŞ TOLERANSI [%] (FİRMA KABULÜ).
 *
 * FEM 1.001 T.4.2.3.1.1 minimum makara çapını `D_min = H · d` ile verir ve bu
 * sayı yuvarlak çıkmaz: Ø28 halat ile H = 36'da D_min = 1008 mm eder. Makaralar
 * ise standart bir çap serisinden imal edilir (tamburla AYNI seri) ve serideki
 * bir sonraki basamak 1100'dür — 8 mm için bir boy büyüğe geçmek makarayı,
 * yatağını, kanca bloğunu ve arabayı büyütür.
 *
 * Kullanıcı kararı (16.08.2026): *"%2'nin altında fark varsa aşağı yuvarlasın,
 * yani 1000 mm makara uygun görünsün."* Bu bir standart maddesi DEĞİL bir
 * FİRMA kabulüdür ve bu yüzden:
 *   · sapma GÖRÜNÜR — kullanılan tolerans kendi hesap satırındadır,
 *   · tolerans GERÇEKTEN kullanıldığında rapor ayrı bir kontrolle söyler,
 *   · %2'yi aşan eksiklik hâlâ ENGELLEYİCİdir.
 *
 * Ölçek duygusu: 1008 → 1000 sapması %0,79'dur; 1100 → 1008 gibi bir boy atlama
 * ise %9. Yani tolerans "bir boy küçüğe kaçmayı" değil yalnız SERİYE OTURMAYI
 * mümkün kılar.
 */
export const SHEAVE_DIA_TOLERANCE_PCT = 2;

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

  // ------------------------------------------- §4.6 Kaldırma kirişi geometrisi
  /**
   * ÖLÇÜ ZİNCİRİ (teknik resimdeki x · y · z):
   *
   *     |<-- x -->|<------- y ------->|<-- z -->|
   *     R_A       P1                  P2        R_B
   *
   *   x : sol mesnetten (askı noktası) BİRİNCİ yük noktasına
   *   y : iki yük noktası arası
   *   z : İKİNCİ yük noktasından sağ mesnete
   *
   * Kiriş açıklığı L = x + y + z olarak TÜRETİLİR; ayrıca sorulmaz.
   *
   * ESKİ MODEL (a = açıklık, b = yük mesafesi) bu zincirin SİMETRİK hâliydi:
   *   x = z = b, y = a − 2b. Simetrik geometride sonuçlar BİREBİR aynıdır
   *   (M = F·x, V = F); göç `revision-load.migrateLiftingBeam` ile yapılır.
   *   Asimetrik askı (şarj/döküm vinçlerinde yaygın) ancak bu zincirle
   *   modellenebiliyordu.
   */
  beamXMm: number;
  beamYMm: number;
  beamZMm: number;

  // ------------------------------------------------ §4.6 Kesit 1 (açıklık ortası)
  // Alan ADLARI "mid"/"thick" olarak KALIR: kayıtlı revizyonlar bu anahtarlarla
  // saklanıyor ve yeniden adlandırmak mühendisin girdiği bütün sac ölçülerini
  // sessizce şablon değerine düşürürdü. Ekranda görünen ad Kesit 1 / Kesit 2'dir.
  midTopPlateThkMm: number;      // Kesit 1 üst sac kalınlığı [mm]
  midTopPlateWidthMm: number;    // Kesit 1 üst sac genişliği [mm]
  midWebPlateThkMm: number;      // Kesit 1 yan sac kalınlığı [mm]
  midWebPlateHeightMm: number;   // Kesit 1 yan sac yüksekliği [mm]
  midBottomPlateThkMm: number;   // Kesit 1 alt sac kalınlığı [mm]
  midBottomPlateWidthMm: number; // Kesit 1 alt sac genişliği [mm]
  // -------------------------------------------- §4.6 Kesit 2 (mesnet/yük bölgesi)
  thickTopPlateThkMm: number;    // Kesit 2 üst sac kalınlığı [mm]
  thickTopPlateWidthMm: number;  // Kesit 2 üst sac genişliği [mm]
  thickWebPlateThkMm: number;    // Kesit 2 yan sac kalınlığı [mm]
  thickWebPlateHeightMm: number; // Kesit 2 yan sac yüksekliği [mm]
  thickBottomPlateThkMm: number; // Kesit 2 alt sac kalınlığı [mm]
  thickBottomPlateWidthMm: number; // Kesit 2 alt sac genişliği [mm]
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
  /**
   * "Kanca Tanımı" kutusu otomatik doldurulsun mu (uygulamanın `*Auto` deseni).
   * Anahtar GİRDİLERDE durur, türetilen metin SEÇİMLERE yazılır — yiv boyunun
   * (`drumGrooveLengthAuto`) birebir aynı düzeni.
   */
  hookDesignationAuto?: boolean;
}

/** Katalog seçimleri — mühendisin seçtiği bileşenler */
export interface HookBlockSelections {
  /**
   * Kancanın hangi standarda göre seçildiği — DIN 15401 / 15402 (dövme) ya da
   * DIN 15407 / 15408 (lamel). Eski kayıtlarda yoktur; `hookStandardOf` onları
   * DIN 15401 sayar (uygulamanın bugüne kadarki tek yolu).
   */
  hookStandard?: HookStandard;
  /** Kanca tanımı (ör. "DIN 15401 Nr 10 S") — standart + numaradan türetilir */
  hookDesignation: string;
  /**
   * Kanca numarası. Dövme kancada DIN 15400 numarasıdır ("10"), lamel kancada
   * standardın kendi adlandırmasıdır ("63x150" → "63 × 150"). Tek alandır:
   * seçenek listesi seçilen standarda göre değişir (`hookNumberOptions`).
   */
  hookNumber?: string;
  /**
   * DIN 15400 malzeme mukavemet sınıfı (M/P/S/T/V). YALNIZ dövme kancada
   * anlamlıdır — lamel kancanın kapasitesi tablonun kendi satırındadır.
   */
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
  /** Çözülmüş kanca tanımı standardı (eksik kayıtlarda DIN 15401) */
  hookStandard: HookStandard;
  /** Kanca lamel (sac perçinli) mi — DIN 15407 / 15408 */
  hookIsLamella: boolean;
  /** Seçilen DIN 15407 satırı (lamel kanca değilse / tanınmayan boyda yok) */
  lamellaRow?: Din15407Row;
  /** Standart + numaradan türetilen tam tanım metni */
  hookDesignationText: string;
  /** Tablodan okunan taşıma kapasitesi [kg] (yoksa elle girilen) */
  hookCapacityKg: number;
  /** Kapasite tablodan mı geldi */
  hookCapacityFromTable: boolean;
  /** Mekanizma sınıfının DIN 15020 karşılığı (ör. M6 → 2m) */
  hookDinGroup: string;
  /** Yükü taşıyan en küçük kanca numarası (seçim önerisi) */
  suggestedHookNumber?: string;
  // §4.2 Makaralar
  sheaveCoefficientH: number;
  /** FEM'in istediği minimum makara çapı D_min = H · d [mm] */
  minSheaveDiaMm: number;
  /** Standart çap toleransıyla kabul edilen alt sınır [mm] */
  acceptedMinSheaveDiaMm: number;
  /** Seçilen çap FEM sınırının ALTINDA ama tolerans bandının İÇİNDE mi */
  sheaveDiaToleranceUsed: boolean;
  /** FEM sınırına göre eksiklik [%] — sınırın üstündeyse ≤ 0 */
  sheaveDiaShortfallPct: number;
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
  // §4.6 Kaldırma kirişi — geometri ve kesit tesirleri
  /** Ölçü zincirinden çözülmüş geometri (x · y · z, açıklık, yük konumları) */
  beam: LiftingBeamGeometry;
  /** Mesnet tepkileri (tam yük hâli) [kg] */
  beamReactionAKg: number;
  beamReactionBKg: number;
  /** Kesit 2'de (mesnet–yük arası) en büyük kesme kuvveti [kg] */
  beamShearMaxKg: number;
  /** Kesit 1'de (yükler arası) kesme kuvveti — simetrik askıda 0 [kg] */
  beamShearSection1Kg: number;
  /** Yük noktasındaki moment — Kesit 2'nin eğilmesi [kg·cm] */
  beamMomentSection2KgCm: number;
  /** Moment diyagramının düğümleri (şema ve rapor aynı çözümü okur) */
  beamStations: { xCm: number; momentKgCm: number }[];
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
  /** Kesit 1 (açıklık ortası) — kesme ve bileşik gerilme */
  section1ShearStress: number;
  section1CombinedStress: number;
  /** Kesit 2 (mesnet–yük arası) — eğilme ve bileşik gerilme */
  section2BendingStress: number;
  section2CombinedStress: number;
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

/** Kaldırma kirişinin ölçü zincirinden çözülmüş geometrisi [cm]. */
export interface LiftingBeamGeometry {
  xCm: number;
  yCm: number;
  zCm: number;
  /** Toplam açıklık L = x + y + z [cm] */
  spanCm: number;
  /** Birinci yük noktası (sol mesnetten) [cm] */
  load1Cm: number;
  /** İkinci yük noktası (sol mesnetten) [cm] */
  load2Cm: number;
  /** Açıklık ortası — Kesit 1'in yeri [cm] */
  midCm: number;
}

/**
 * Kaldırma kirişi ölçü zincirini (x · y · z) çözer.
 *
 * Geçersiz/eksik ölçüler SIFIRA indirgenir ve açıklık yine de pozitif kalır
 * (en az 1 cm): sıfır açıklıklı bir kiriş `solveBeam`i bölme hatasına
 * düşürmez ama gerilmeleri sonsuza götürürdü. Ekranda eksik ölçü zaten
 * görünür; hesabın NaN üretmemesi daha önemlidir.
 */
export function liftingBeamGeometry(
  inp: Pick<HookBlockInputs, "beamXMm" | "beamYMm" | "beamZMm">
): LiftingBeamGeometry {
  const mm = (v: number | undefined) =>
    typeof v === "number" && Number.isFinite(v) && v > 0 ? v : 0;
  const xCm = mm(inp.beamXMm) / 10;
  const yCm = mm(inp.beamYMm) / 10;
  const zCm = mm(inp.beamZMm) / 10;
  const spanCm = Math.max(xCm + yCm + zCm, 0.1);
  return {
    xCm, yCm, zCm, spanCm,
    load1Cm: xCm,
    load2Cm: xCm + yCm,
    midCm: spanCm / 2,
  };
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

  // --- §4.1 Kanca -----------------------------------------------------------
  // Kapasitenin nereden okunduğunu KANCA TANIMI belirler:
  //   · DIN 15401 / 15402 (dövme) → DIN 15400 Tablo 3, yani kanca numarası +
  //     malzeme mukavemet sınıfı + mekanizma grubu üçlüsü. FEM M1–M8 sınıfı
  //     DIN 15020 grubuna çevrilir.
  //   · DIN 15407 (lamel)         → tablonun KENDİ satırı ("Tragfähigkeit t").
  //     Lamel kancada mukavemet sınıfı ve mekanizma grubu kapasiteyi
  //     DEĞİŞTİRMEZ; standart doğrudan "bu boy şu tonu kaldırır" der.
  //   · DIN 15408 (çift ağızlı lamel) → tablo uygulamada YOK; kapasite elle
  //     girilir ve rapor bunu açıkça söyler (aşağıdaki `bilgi` kontrolü).
  const hookStandard = hookStandardOf(sel.hookStandard);
  const hookIsLamella = isLamellaHook(hookStandard);
  const lamellaRow = hookIsLamella ? din15407Row(sel.hookNumber) : undefined;
  const hookDinGroup = din15020Group(mech);
  const tableCapacityKg = hookIsLamella
    ? (lamellaRow ? lamellaRow.capacityT * 1000 : undefined)
    : sel.hookNumber && sel.hookStrengthClass
      ? hookCapacityKg(sel.hookNumber, sel.hookStrengthClass, mech)
      : undefined;
  const hookCapacity = tableCapacityKg ?? sel.hookCapacityKg;
  const suggestedHookNumber = hookIsLamella
    ? smallestDin15407Key(deps.loadKg)
    : sel.hookStrengthClass
      ? smallestHookNumber(deps.loadKg, sel.hookStrengthClass, mech)
      : undefined;
  cells["hook.capacity"] = hookCapacity;
  // Lamel kancanın ölçüleri hesaba GİRMEZ ama ekipman listesine ve imalat
  // resmine gider; raporda kendi satırlarıyla basılır (bkz. hookBlockSections).
  if (lamellaRow) {
    Object.assign(cells, {
      "hook.a1": lamellaRow.a1,
      "hook.a2": lamellaRow.a2,
      "hook.b1": lamellaRow.b1,
      "hook.b2": lamellaRow.b2,
      "hook.d1": lamellaRow.d1,
      "hook.g1": lamellaRow.g1,
      "hook.l1": lamellaRow.l1,
      "hook.l2": lamellaRow.l2,
      "hook.s1": lamellaRow.s1,
      "hook.plateCount": lamellaRow.plateCount,
      "hook.craneCapacity": lamellaRow.craneCapacityT * 1000,
    });
  }
  checks.push({
    id: `${which}.hook.capacity`,
    label: "Kanca Taşıma Kapasitesi",
    required: deps.loadKg, provided: hookCapacity, unit: "kg", op: ">=",
    computedSide: "required",
    pass: hookCapacity >= deps.loadKg,
    standard: hookIsLamella ? "DIN 15407" : "DIN 15400",
    kind: "standart", severity: "engelleyici",
  });
  // Kapasitenin NEREDEN geldiği ayrı bir KONTROL değil bir HESAP SATIRIDIR
  // (`hook.capacitySource`, hookBlockSections). Bir kontrol her koşulda
  // üretilmelidir (anchors.guard); "kaynak" ise bir kabul/ret değil bir
  // künyedir ve her zaman basılır — DIN 15408'de "elle girildi" der.

  // --- §4.2 Makaralar -------------------------------------------------------
  // FEM'in istediği çap D_min = H · d'dir ve yuvarlak çıkmaz; makara ise
  // standart bir çap serisinden imal edilir. Serinin bir alt basamağı D_min'in
  // %2'sinden az aşağıdaysa o basamak kabul edilir (bkz. SHEAVE_DIA_TOLERANCE_PCT).
  const sheaveCoefficientH = sheaveCoefficient(mech); // FEM H katsayısı
  const minSheaveDiaMm = sheaveCoefficientH * deps.ropeDiaMm;
  const acceptedMinSheaveDiaMm = minSheaveDiaMm * (1 - SHEAVE_DIA_TOLERANCE_PCT / 100);
  const sheaveDiaPass = sel.sheaveDiaMm >= acceptedMinSheaveDiaMm;
  // Tolerans GERÇEKTEN kullanıldı mı: FEM sınırının altında ama bandın içinde.
  const sheaveDiaToleranceUsed = sheaveDiaPass && sel.sheaveDiaMm < minSheaveDiaMm;
  const sheaveDiaShortfallPct =
    minSheaveDiaMm > 0 ? ((minSheaveDiaMm - sel.sheaveDiaMm) / minSheaveDiaMm) * 100 : 0;
  Object.assign(cells, {
    "sheave.coefficient": sheaveCoefficientH,
    "sheave.minDia": minSheaveDiaMm,
    "sheave.minDiaAccepted": acceptedMinSheaveDiaMm,
  });
  checks.push({
    id: `${which}.sheave.dia`,
    label: `Makara Çapı (min H·d, %${SHEAVE_DIA_TOLERANCE_PCT} standart çap toleransı)`,
    required: acceptedMinSheaveDiaMm, provided: sel.sheaveDiaMm, unit: "mm", op: ">=",
    computedSide: "required",
    pass: sheaveDiaPass,
    standard: "FEM 1.001 T.4.2.3.1.1", kind: "standart", severity: "engelleyici",
  });
  // Tolerans kullanıldığında SESSİZ KALINMAZ ama bu da ikinci bir KONTROL
  // değildir: kontrol bir kabul/ret sorusudur ve "tolerans kullanıldı" bir
  // olgudur. Rapor bunu `sheave.diaShortfall` satırıyla yazar — satır yalnız
  // tolerans gerçekten kullanıldığında basılır (md. 18/3: yanlış alarm yok).

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
  // Kiriş İKİ NOKTADAN askıdadır (uçlardaki mesnetler) ve İKİ NOKTADAN yüklüdür
  // (kanca blokları). Ölçü zinciri x · y · z teknik resimden okunur; açıklık
  // L = x + y + z olarak türetilir.
  //
  //   Kesit 1 : açıklık ortası — eğilme momenti burada en büyüktür
  //   Kesit 2 : mesnet ile yük noktası arası — KESME kuvveti burada en büyüktür
  //
  // Yük başına kuvvet: toplam yükün yarısı (iki askı noktası).
  const forceMaxKg = deps.totalLoadKg / 2;
  const forceMinKg = (deps.hookBlockWeightKg + deps.ropeWeightKg) / 2;
  const liftBeam = liftingBeamGeometry(inp);
  const solveLift = (loadKg: number) =>
    solveBeam({
      lengthCm: liftBeam.spanCm,
      supportACm: 0,
      supportBCm: liftBeam.spanCm,
      pointLoads: [
        { xCm: liftBeam.load1Cm, loadKg, label: "1. askı" },
        { xCm: liftBeam.load2Cm, loadKg, label: "2. askı" },
      ],
    });
  const liftMax = solveLift(forceMaxKg);
  const liftMin = solveLift(forceMinKg);
  const momentMaxKgCm = Math.abs(liftMax.maxMomentKgCm);
  const momentMinKgCm = Math.abs(liftMin.maxMomentKgCm);
  // Kesme: mesnetle ilk yük arasındaki bölge (Kesit 2) — mutlak en büyük kesme.
  const shearMaxKg = Math.abs(liftMax.maxShearKg);
  // Kesit 2'nin momenti: yük noktasındaki moment (mesnet ile yük arasında
  // doğrusal artar, tepe noktası yükün kendisidir).
  const moment2KgCm = Math.max(
    Math.abs(liftMax.momentAt(liftBeam.load1Cm)),
    Math.abs(liftMax.momentAt(liftBeam.load2Cm))
  );
  // Kesit 1'in kesmesi: iki yük ARASINDAKİ bölgenin kesmesi = R_A − P.
  // Simetrik askıda sıfırdır; asimetrik askıda sıfır değildir ve kesitin
  // bileşik gerilmesine girer.
  const shear1Kg = Math.abs(liftMax.reactionAKg - forceMaxKg);

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
    "girder.beamX": inp.beamXMm,
    "girder.beamY": inp.beamYMm,
    "girder.beamZ": inp.beamZMm,
    "girder.span": liftBeam.spanCm * 10,
    "girder.reactionA": liftMax.reactionAKg,
    "girder.reactionB": liftMax.reactionBKg,
    "girder.shearMax": shearMaxKg,
    "girder.shearSection1": shear1Kg,
    "girder.momentSection2": moment2KgCm,
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
  // Kesit 1 — açıklık ortası: eğilme burada tepe yapar, kesme (simetrik askıda)
  // sıfırdır.
  const staticBendingStress = (momentMaxKgCm * psi.psi) / mid.sectionModulusCm3;
  const section1ShearStress = (shear1Kg * psi.psi) / mid.webAreaCm2;
  const section1CombinedStress = Math.sqrt(
    staticBendingStress ** 2 + 3 * section1ShearStress ** 2
  );
  // Kesit 2 — mesnet ile yük noktası arası: kesme burada tepe yapar; kesit
  // genellikle kalınlaştırılmıştır.
  const staticShearStress = (shearMaxKg * psi.psi) / thick.webAreaCm2;
  const section2BendingStress = (moment2KgCm * psi.psi) / thick.sectionModulusCm3;
  const section2CombinedStress = Math.sqrt(
    section2BendingStress ** 2 + 3 * staticShearStress ** 2
  );
  /**
   * KONTROL EDİLEN DEĞER İKİ KESİTİN BÜYÜĞÜ DEĞİL, ZARFIDIR.
   *
   * Zarf = √(σ_Kesit1² + 3·τ_Kesit2²): en büyük eğilme ile en büyük kesme aynı
   * kesitte olmasa da bir arada değerlendirilir. Bu bilinçli olarak
   * MUHAFAZAKÂRdır ve tarihsel davranışı korur; iki kesitin kendi bileşik
   * gerilmeleri de hesaplanır ve zarf onlardan küçük kalamaz (kesit oranları
   * ters dönerse `Math.max` devreye girer).
   */
  const staticCombinedStress = Math.max(
    Math.sqrt(staticBendingStress ** 2 + 3 * staticShearStress ** 2),
    section1CombinedStress,
    section2CombinedStress
  );
  const allowableStaticStress = ALLOWABLE_STATIC_KGCM2[inp.fatigueMaterial];
  Object.assign(cells, {
    "girder.dynamicFactor": psi.psi,
    "girder.bendingStress": staticBendingStress,
    "girder.shearStress": staticShearStress,
    "girder.section1ShearStress": section1ShearStress,
    "girder.section1CombinedStress": section1CombinedStress,
    "girder.section2BendingStress": section2BendingStress,
    "girder.section2CombinedStress": section2CombinedStress,
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
  // Kesme kuvveti mesnet tepkisinden gelir; simetrik askıda yük başına düşen
  // kuvvete eşittir (eski model bu eşitliği doğrudan kullanıyordu).
  const shearMinKg = Math.abs(liftMin.maxShearKg);
  const sigmaMax = momentMaxKgCm / mid.sectionModulusCm3;
  const tauMax = shearMaxKg / mid.webAreaCm2;
  const combinedMax = Math.sqrt(sigmaMax ** 2 + 3 * tauMax ** 2);
  const sigmaMin = momentMinKgCm / mid.sectionModulusCm3;
  const tauMin = shearMinKg / mid.webAreaCm2;
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
    hookStandard,
    hookIsLamella,
    lamellaRow,
    hookDesignationText: hookDesignationText(sel) ?? hookStandard,
    hookCapacityKg: hookCapacity,
    hookCapacityFromTable: tableCapacityKg !== undefined,
    hookDinGroup,
    suggestedHookNumber,
    sheaveCoefficientH,
    minSheaveDiaMm,
    acceptedMinSheaveDiaMm,
    sheaveDiaToleranceUsed,
    sheaveDiaShortfallPct,
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
    beam: liftBeam,
    beamReactionAKg: liftMax.reactionAKg,
    beamReactionBKg: liftMax.reactionBKg,
    beamShearMaxKg: shearMaxKg,
    beamShearSection1Kg: shear1Kg,
    beamMomentSection2KgCm: moment2KgCm,
    // Diyagram, hesapla AYNI çözümün düğümlerini çizer — ikinci bir moment
    // hesabı yazılmaz. Kesme süreksizliğinin iki yüzü aynı momenti verdiği
    // için yalnız konum + moment taşınır.
    beamStations: liftMax.stations.map((s) => ({ xCm: s.xCm, momentKgCm: s.momentKgCm })),
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
    section1ShearStress,
    section1CombinedStress,
    section2BendingStress,
    section2CombinedStress,
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
