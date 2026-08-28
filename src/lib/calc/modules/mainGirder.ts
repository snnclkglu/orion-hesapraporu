// Ana kiriş hesabı — çift kirişli köprü vincinin kutu kesitli ana kirişi.
//
// Akış: kesit özellikleri → yükler (FEM dinamik katsayı ψ, yatay ivme yükleri)
// → FEM yük kombinasyonları (Durum I ve III) → gerilme analizi (von Mises)
// → DIN 15018 yorulma → sehim.
//
// Dayanaklar: FEM 1.001 (2.2 yükler, 2.3 kombinasyonlar, 3.2.1.1–3.2.1.3 izin
// gerilmeleri, A.2.2.3 yatay ivme dinamik katsayısı), DIN 15018 (Şekil 9 teker
// basıncı, Tablo 17/18 yorulma), CMAA 70 (3.5.1 kesit oranları, 3.5.5.1 sehim).
//
// Birimler: mm, cm², cm³, cm⁴, kg, kg/cm², kg·cm, m, m/s, m/s², s, N/mm².
//
// Kesit dairesel olmadığı için ortak `shaftStress` modülü KULLANILMAZ; kutu
// kesitin kendi W/A büyüklükleri burada hesaplanır. Kiriş momentleri de kapalı
// formülleriyle yazılıdır (tekil yük çiftinin ve düzgün yayılı öz ağırlığın
// klasik çözümleri); `solveBeam` bu üç yük durumunu sadeleştirmediği için
// bilinçli olarak kullanılmamıştır.
//
// GERİLME NUMARALANDIRMASI — bileşen gerilmelerin kalıcı numaraları (sunum,
// diyagram ve gerilme tablosu aynı numaraları kullanır):
//   σ1  kiriş öz ağırlığı (düşey eğilme)        σ2  araba ağırlığı
//   σ3  kaldırma yükü (×ψ)                      σ4  köprü yatay yükü (yatay eğilme)
//   σ5  araba yanal yükü                        σ6  ray kolu / kaçıklık
//   σ7  ikincil moment — araba                  σ8  ikincil moment — yük (×ψ)
//   σ9  teker basıncı — araba (σz)              σ10 teker basıncı — yük (σz, ×ψ)
//   τ1  burulma — araba                         τ2  burulma — yük (×ψ)
//   τ3  kesme — öz ağırlık                      τ4  kesme — araba
//   τ5  kesme — yük (×ψ)

import { camberProfile, camberStationGrid } from "../camber";
import { DIN15018_T17, railMassKgPerM } from "../tables";
import { parseHoistLoadClass } from "../types";
import type {
  AnyCheck,
  LoadGroup,
  ModuleResult,
  StructureClass,
  TechnicalSpecs,
} from "../types";

/** DIN 15018 çentik durumu sınıfları (Tablo 17 sütunları) */
export type NotchClass = "W0" | "W1" | "W2" | "K0" | "K1" | "K2" | "K3" | "K4";
/** Yorulma malzemesi (DIN 15018 T17 satır blokları) */
export type FatigueMaterial = "S235JR" | "S355JR";
/** Statik izin gerilmesi tablosu malzemeleri (FEM T.3.2.1.1) */
export type GirderStaticMaterial = "St37" | "St44" | "St52";

/** FEM Table T.3.2.1.1 — yükleme durumu I/II/III izin gerilmeleri [kg/cm²] */
export const GIRDER_ALLOWABLE_STRESS: Record<
  GirderStaticMaterial,
  { case1: number; case2: number; case3: number }
> = {
  St37: { case1: 1630, case2: 1834, case3: 2191 },
  St44: { case1: 1783, case2: 1987, case3: 2450 },
  St52: { case1: 2450, case2: 2750, case3: 3310 },
};

/**
 * FEM 1.001 Tablo T.2.3.4 — çelik yapı sınıfına göre yük arttırma katsayısı γc.
 *
 * γc, yapının hizmet ömrü boyunca maruz kalacağı çevrim sayısı arttıkça
 * yükleri büyüten katsayıdır; A1 (en hafif kullanım) 1,00'den A8 (en ağır)
 * 1,20'ye kadar 0,03 adımlarla ilerler. Teknik özelliklerdeki `structureClass`
 * bu tablonun tek girdisidir; katsayı ayrıca elle girilmez.
 */
export const STRUCTURE_AMPLIFY_FACTOR: Record<StructureClass, number> = {
  A1: 1.0,
  A2: 1.02,
  A3: 1.05,
  A4: 1.08,
  A5: 1.11,
  A6: 1.14,
  A7: 1.17,
  A8: 1.2,
};

/**
 * Yorulma malzemesinin karakteristik kopma dayanımı σB [N/mm²].
 * (S235JR → 360, S355JR → 510; EN 10025-2 asgari değerleri.)
 */
export const FATIGUE_TENSILE_NMM2: Record<FatigueMaterial, number> = {
  S235JR: 360,
  S355JR: 510,
};

/**
 * DIN 15018 yük grubu ayrıştırılamadığında kullanılan güvenli taraf değeri.
 * B6 en ağır gruptur (en düşük izin gerilmesi) — sınıflandırma bilinmiyorsa
 * hesabın iyimser tarafa kaymaması için bilinçli olarak en ağırı seçilir.
 */
export const FALLBACK_LOAD_GROUP: LoadGroup = "B6";

/** Çeliğin elastisite modülü [kg/cm²] — sehim ve kamber hesabı. */
export const GIRDER_ELASTIC_MODULUS_KG_CM2 = 2_100_000;

/**
 * Kaynaklı çelik yapı için kabul edilen yoğunluk.
 *
 * Anma değeri 7,85 kg/dm³'tür; imalatta 8,0 kullanılır — aradaki %2 pay kaynak
 * metalini, sac haddeleme toleransını ve küçük bağlantı parçalarını karşılar
 * (firma kabulü). Kesit ağırlığı, perde ağırlığı ve kare çubuk ray ağırlığı
 * AYNI yoğunluktan hesaplanır; ayrışırlarsa kirişin toplam ağırlığı tutmaz.
 */
export const STEEL_DENSITY_KG_DM3 = 8.0;
/** Aynı yoğunluk kg/cm³ cinsinden (ray tablosu bu birimi ister). */
export const STEEL_DENSITY_KG_CM3 = STEEL_DENSITY_KG_DM3 / 1000;

/** DIN 15018 7.4.5 bileşik yorulma oranı üst sınırı. */
const FATIGUE_COMBINED_LIMIT = 1.1;

/** Yerçekimi ivmesi [m/s²]. */
const GRAVITY = 9.81;

/** kg/cm² → N/mm² dönüşümü (1 kgf = 9,81 N, 1 cm² = 100 mm²). */
const KG_CM2_TO_NMM2 = 9.81;

/**
 * Tahrik tekerleği ile ray arasındaki sürtünme katsayısı μ.
 * FEM 1.001 2.2.3.1.1 uygulamasında çelik teker / çelik ray için μ = 1/7.
 */
const WHEEL_FRICTION_COEFF = 1 / 7;

/** Bir tahrik dingilindeki teker sayısı — tahrik daima çift teker üzerinden aktarılır. */
const WHEELS_PER_DRIVEN_AXLE = 2;

/**
 * Sürtünmeyle aktarılabilen en büyük yatay kuvvetin böleni:
 * F'' = n_tahrikli · P_teker · μ / n_çift = n_tahrikli · P_teker / (2 · 7) = … / 14.
 */
const TRACTION_LIMIT_DIVISOR = WHEELS_PER_DRIVEN_AXLE / WHEEL_FRICTION_COEFF; // = 14

/**
 * Ana kiriş takımı anahtarı.
 *
 * Dört kirişli köprüde İKİ takım vardır ve AYNI hesap iki kez koşar; hangi
 * kaldırma grubunun yükünü taşıdığı `GirderDeps` ile gelir (modül specs'ten
 * kapasite/hız OKUMAZ — bkz. `hoistLoadKg` / `liftSpeedMpm`).
 */
export type GirderWhich = "girder" | "girder2";

/** Diğer modüllerden gelen değerler */
export interface GirderDeps {
  /**
   * Bu kirişin taşıdığı KALDIRMA YÜKÜ [kg] (kapasite × 1000).
   *
   * Modül bir süre `specs.mainCapacityT`yi doğrudan okuyordu; dört kirişli
   * köprüde ikinci takım YARDIMCI kaldırmayı taşıdığı için bu okuma taşındı.
   * Böylece "hangi kirişin hangi yükü taşıdığı" tek bir yerde (engine) kurulur.
   */
  hoistLoadKg: number;
  /** Bu kirişin taşıdığı kaldırma grubunun kaldırma hızı [m/dak] */
  liftSpeedMpm: number;
  /** Taşınan kaldırma grubunun tambur devri [d/dak] — basit dinamik tarama. */
  hoistDrumRpm: number;
  /**
   * Köprünün öz ağırlığını paylaşan ana kiriş adedi (tek/çift/dört kirişli
   * köprüde 1/2/4). Bir kirişe düşen ölü yük `bridgeWeightT / bu sayı`dır.
   */
  girdersInBridge: number;
  /**
   * Aynı araba ve kaldırma yükünü paylaşan kiriş adedi (tek kirişlide 1,
   * çift ve dört kirişlide takım başına 2).
   */
  liveLoadGirderCount: number;
  mainHookBlockWeightKg: number;
  mainRopeWeightKg: number;
  trolleyWeightT: number;
  trolleyWheelCount: number;
  trolleyDrivenWheels: number;      // araba yürütmeden gelir
  trolleyActualSpeedMpm: number;
  trolleyAccelTimeS: number;
  bridgeWeightT: number;            // köprünün TOPLAM ağırlığı (kirişler + başkirişler)
  bridgeWheelCount: number;
  bridgeDrivenWheels: number;       // köprü yürütmeden gelir
  bridgeActualSpeedMpm: number;
  bridgeAccelTimeS: number;
  /**
   * Arabanın üzerinde yürüdüğü ray kodu (araba yürütme seçiminden gelir).
   * Ray ana kirişin üstüne kaynaklıdır; metre ağırlığı kirişin ölü yüküne
   * girer ve kamberi doğrudan etkiler. Köprü rayı yol kirişine aittir,
   * ana kirişe binmez — bu yüzden ARABA rayı okunur.
   */
  trolleyRailCode: string;
}

/** Kullanıcı girdileri */
export interface GirderInputs {
  /** 7.2 Yükler bölümündeki yerleşim ölçülerinin kullanıcı onayı. */
  loadMeasurementsConfirmed?: boolean;
  railHeightMm: number;        // hr — ray yüksekliği (raporda gösterilir)
  t1Mm: number;                // ray altı sacı kalınlığı t1
  b1Mm: number;                // ray altı sacı genişliği b1 (merkezi RAY EKSENİNDE)
  t2Mm: number;                // üst iç flanş kalınlığı t2
  b2Mm: number;                // üst iç flanş genişliği b2
  t3Mm: number;                // ana gövde sacı kalınlığı t3
  h3Mm: number;                // gövde yüksekliği h3
  t4Mm: number;                // yardımcı gövde sacı kalınlığı t4
  t5Mm: number;                // alt flanş kalınlığı t5
  b5Mm: number;                // alt flanş genişliği b5
  t6Mm: number;                // ek flanş kalınlığı t6
  b6Mm: number;                // ek flanş genişliği b6
  aMm: number;                 // gövde sacları arası mesafe a
  xMm: number;                 // kenar mesafesi x

  // ------------------------------------------------- Ray altı T profil (opsiyonel)
  /**
   * BÜYÜK TONAJLI VİNÇLERDE RAY ALTINA T PROFİL KONUR (kullanıcı kararı,
   * 15.08.2026). Teker basıncı tek bir sacla değil, ray ekseninde duran bir T
   * profille gövdeye aktarılır.
   *
   * PROFİL KİRİŞİN ÜSTÜNE OTURMAZ, ÜST BÖLÜMÜNÜN İÇİNE GİRER:
   *
   *   ÜST ═══╤═════  üst iç flanş t2  ⟷  T üst sacı (AYNI SEVİYE)
   *          │▌      T yan sacı (t_T,yan × h_T), ray ekseninde
   *          ║       ana gövde sacı t3 — h_T kadar KISALIR
   *          ║
   *   ═══════╧═════  alt flanş t5 · ek flanş t6
   *
   * Üç sonuç (kullanıcının kendi cümlesiyle: "t1 iptal, t2 kısalır, h3
   * kısalır, diğerleri değişmez"):
   *   1. RAY ALTI SACI (t1/b1) İPTALDİR — rayı artık T'nin üst sacı taşır.
   *   2. ÜST İÇ FLANŞ (b2) T'nin genişliği kadar KESİLİR; o şeridi T'nin üst
   *      sacı doldurur. İki plaka aynı düzlemdedir, üst üste binmez.
   *   3. ANA GÖVDE SACI (t3) T'nin yan sacı kadar KISALIR.
   * TOPLAM YÜKSEKLİK DEĞİŞMEZ: dış yan sac tam boy kalır.
   *
   * YAN SAC ÜST SACIN TAM ORTASINDADIR ve ikisi de RAY EKSENİNDE durur
   * (x + t3/2).
   *
   * BURULMAYA GİRMEZ: T açık bir kesittir; Bredt akışı kapalı kutunun
   * çeperinden geçer ve katkısını saymak burulma ataletini emniyetsiz yönde
   * şişirirdi.
   */
  /** "Var" ise T profil kesite girer; verilmezse / "Yok" ise girmez. */
  railTProfile?: string;
  railTProfileWebThkMm?: number;    // T yan sacı kalınlığı
  railTProfileWebHeightMm?: number; // T yan sacı yüksekliği
  railTProfileTopThkMm?: number;    // T üst sacı kalınlığı
  railTProfileTopWidthMm?: number;  // T üst sacı genişliği
  hookTopPositionM: number;    // kancanın en üst konumu l [m]
  /** Kancanın en üst konumu teknik özelliklerdeki kaldırma yüksekliğinden gelsin. */
  hookTopPositionAuto?: boolean;
  bridgeAxleSpacingM: number;  // köprü dingil açıklığı [m]
  /** Köprü dingil açıklığı teker düzeninin ilk/son eksen mesafesinden gelsin. */
  bridgeAxleSpacingAuto?: boolean;
  trolleyWheelSpacingM: number; // araba tekerlek açıklığı [m]
  trolleyAxleSpacingM: number; // araba dingil açıklığı [m]
  /**
   * ψhA (FEM 1.001 Şekil A.2.2.1). `psiHAAuto` açıkken kütle oranından
   * türetilip bu alana YAZILIR (salt-okunur kutu); anahtar kapalıyken
   * mühendisin girdiği değer geçerlidir. Alan boşsa motor yine kütle
   * oranından türetir — eski revizyonlar bozulmaz.
   */
  psiHAOverride?: number;
  /** ψhK — `psiHKAuto` ile aynı mekanizma (FEM 1.001 Şekil A.2.2.1). */
  psiHKOverride?: number;
  /**
   * γc. `amplifyYcAuto` açıkken teknik özelliklerdeki çelik yapı sınıfından
   * FEM 1.001 T.2.3.4 ile türetilip bu alana yazılır.
   */
  amplifyYcOverride?: number;
  /**
   * Otomatik alan anahtarları (7.2 Yükler / 7.3 Yükleme Durumları). Açıkken
   * ilgili kutu türetilen değerle dolar ve salt-okunur olur; kapatılınca
   * mühendis elle düzeltir. Anahtarlar `revision-load.ts` AUTO_FLAGS
   * listesindedir — kayıtta anahtar yoksa elle girilmiş sayılır ve ezilmez.
   */
  psiHAAuto?: boolean;
  psiHKAuto?: boolean;
  amplifyYcAuto?: boolean;
  dynTestFactorR1: number;     // dinamik test katsayısı ρ1
  statTestFactorR2: number;    // statik test katsayısı ρ2
  railLeverCMm: number;        // kayma merkezi kolu c [mm]
  diaphragmSpacingMm: number;  // iki perde arası l1 [mm]
  /**
   * Gövde sacındaki BOYUNA berkitmenin (köşebent) üst başlığa uzaklığı [mm].
   * 0 = boyuna berkitme yok.
   *
   * Kesit özelliklerine GİRMEZ (köşebentin atalet momentine katkısı ihmal
   * edilir — muhafazakâr kabul); yalnız BURUŞMA panelini böler: FEM 1.001
   * A-3.4'te panel, mesnetli kenarları arasındaki açıklıktır ve boyuna
   * berkitme gövdeyi iki panele ayırır (bkz. modules/buckling.ts).
   */
  webStiffenerOffsetMm: number;
  wheelContactHMm: number;     // tekerlek basıncı yayılım yüksekliği h [mm]
  wheelContactTMm: number;     // tekerlek basıncı taşıyan sac kalınlığı t [mm]
  /** Teker basıncını taşıyan sac kalınlığı ana gövde sacı t3'e eşitlensin. */
  wheelContactTAuto?: boolean;
  /**
   * σy,maks elle ezme [N/mm²]. Verilmezse gerilme analizindeki teker basıncı
   * σz(I)'den türetilir — normalde boş bırakılır.
   */
  sigmaYMaxOverrideNmm2?: number;
  /** σy,min elle ezme [N/mm²]. Verilmezse σz(araba)'dan türetilir. */
  sigmaYMinOverrideNmm2?: number;
  /**
   * σB elle ezme [N/mm²]. Verilmezse seçilen yorulma malzemesinden türetilir
   * (S235JR → 360, S355JR → 510).
   */
  fatigueTensileOverrideNmm2?: number;
  deflectionLimitRatio: number; // sehim sınırı L/x
  /**
   * Kamber hesabında kirişin üstündeki İLAVE sabit yük [kg/m] — yürüme yolu,
   * korkuluk, festun, kablo tavası gibi kirişe kalıcı binen ve motorun
   * geometriden bilemediği her şey.
   *
   * Kesit sacları, perdeler ve RAY buraya YAZILMAZ: üçü de geometriden
   * hesaplanıp ölü yüke otomatik eklenir.
   *
   * Ölü yük sehimi kirişin kendi yayılı ağırlığından hesaplanır; gerilme
   * hesabındaki `bridgeDeadWeightKg` (köprü ağırlığının yarısı) burada
   * KULLANILMAZ, çünkü o değer başkirişleri de içerir ve başkirişler mesnet
   * üzerinde durup kirişi eğmez. Kamber imalat ölçüsüdür; fazla tahmin
   * edilirse kiriş fiilen yukarı kalkık kalır.
   */
  camberExtraDeadLoadKgPerM: number;
}

/** Mühendis seçimleri */
export interface GirderSelections {
  fatigueMaterial: FatigueMaterial;     // S235JR / S355JR
  /**
   * DIN 15018 yük grubu elle ezme. Verilmezse teknik özelliklerdeki
   * kaldırma/yük sınıfından ("H3/B4") türetilir — normalde boş bırakılır.
   */
  fatigueLoadGroupOverride?: LoadGroup;
  fatigueNotchClass: NotchClass;        // W0..K4 (DIN 15018)
  staticMaterial: GirderStaticMaterial; // FEM T.3.2.1.1 malzemesi
}

export interface GirderValues {
  // Kesit özellikleri
  heightMm: number;
  areaCm2: number;
  weightPerM: number;
  czMm: number;
  iyyCm4: number;
  wyyBottomCm3: number;
  wyyTopCm3: number;
  cyMm: number;
  railCenterYMm: number;       // ray ekseni (b1 merkezi), b2 sol kenarından [mm]
  izzCm4: number;
  wzzBottomCm3: number;
  wzzTopCm3: number;
  torsionIxxCm4: number;
  approxGirderWeightKg: number; // G_kesit · L · 1,15 ön ağırlık tahmini
  spanToDepthRatio: number;
  spanToWidthRatio: number;
  // Yükler
  bridgeWeightKg: number;
  trolleyWeightKg: number;
  liveLoadKg: number;
  totalLiveLoadKg: number;
  dynamicFactor: number;
  trolleyAccelMs2: number;
  bridgeAccelMs2: number;
  psiHA: number;               // türetilmiş ya da ezilmiş
  psiHK: number;
  trolleyHorizontalLoadKg: number;
  trolleySkewLoadKg: number;
  bridgeHorizontalLoadKg: number;
  bridgeSkewLoadKg: number;
  // Yük kombinasyonu katsayıları (türetilmiş)
  amplifyFactor: number;       // γc — FEM T.2.3.4
  loadGroup: LoadGroup;        // DIN 15018 yük grubu (türetilmiş ya da ezilmiş)
  // Gerilme analizi
  sigmaXBottomCase1: number;
  sigmaXTopCase1: number;
  sigmaZCase1: number;
  shearMainCase1: number;
  shearSecondaryCase1: number;
  sigmaCombBottomCase1: number; // iki gövde sacından ELVERİŞSİZ olanı
  sigmaCombTopCase1: number;
  ycSigmaCombBottom: number;   // γc·σcomb (alt) — kontrol değeri
  ycSigmaCombTop: number;
  testFactorK: number;
  sigmaCombCase3: number;
  allowableCase1: number;
  allowableCase3: number;
  // Yorulma (DIN 15018)
  fatigueSigmaXMax: number;
  fatigueSigmaXMin: number;
  fatigueSigmaYMax: number;
  fatigueSigmaYMin: number;
  fatigueTauMax: number;
  fatigueTauMin: number;
  fatigueTensileNmm2: number;  // türetilmiş ya da ezilmiş σB
  zulSigmaD1: number;          // zul σD(-1) — T17
  zulSigmaDz0: number;         // zul σDz(0)
  kappaX: number;
  zulSigmaDzX: number;         // zul σDz(κ)
  kappaY: number;
  zulSigmaDzY: number;
  kappaTau: number;
  zulTauW0: number;
  zulTauDX: number;
  fatigueCombined: number;
  // Sehim ve ters sehim (kamber)
  deflectionMm: number;        // canlı yük sehimi δ (açıklık ortası)
  deflectionRatio: number;     // L / sehim
  naturalPeriodS: number;      // statik sehimden SDOF ön tahmini
  naturalFrequencyHz: number;
  hoistExcitationFrequencyHz: number;
  frequencySeparationPct: number;
  deadDeflectionMm: number;    // ölü yük sehimi (açıklık ortası)
  camberCuttingMm: number;     // KESİMDE verilecek ters sehim (açıklık ortası)
  camberSupportedMm: number;   // MESNETTE ölçülecek ters sehim (açıklık ortası)
  camberDeadLoadKgPerM: number; // kamber ölü yükü w (toplam)
  // Ölü yük bileşenleri — kirişin gerçek ağırlığı
  diaphragmThicknessMm: number; // perde sacı kalınlığı (en ince kutu sacı)
  diaphragmMassKg: number;      // bir perdenin ağırlığı
  diaphragmCount: number;       // açıklık boyunca perde adedi (mesnetler dâhil)
  diaphragmKgPerM: number;      // perdelerin yayılı karşılığı
  railKgPerM: number;           // ray metre ağırlığı (bilinmiyorsa 0)
  girderTotalWeightKg: number;  // bir ana kirişin toplam ağırlığı
}

/** Ray altı T profilinin çözülmüş ölçüleri [mm]. */
export interface RailTProfile {
  webThkMm: number;
  webHeightMm: number;
  topThkMm: number;
  topWidthMm: number;
  /** Profil kesite giriyor mu (anahtar açık VE dört ölçü de pozitif) */
  present: boolean;
}

/** T profil anahtarının "açık" değeri (teknik özelliklerdeki Var/Yok dili). */
export const RAIL_T_PROFILE_ON = "Var";

/**
 * Ray altı T profilinin ölçülerini güvenle okur.
 *
 * PROFİL ANAHTARLA AÇILIR (`railTProfile = "Var"`), ölçülerin dolu olmasıyla
 * değil: kullanıcı "Var" der, ölçüler ondan sonra sorulur. Anahtar kapalıyken
 * kayıtlı ölçüler KORUNUR ama kesite girmez — bölüm aç/kapa mantığının aynısı.
 *
 * ANAHTAR AÇIK AMA ÖLÇÜ EKSİKSE profil yine kesite girmez: dört ölçünün
 * dördü de pozitif olmalıdır. Yarım bir T (üst sacı olan, yan sacı olmayan)
 * bir profil değildir ve kesit özelliklerini sessizce bozardı.
 *
 * Eski revizyonlarda alanların hiçbiri yoktur → profil yok → bugünkü sonuçlar
 * birebir korunur.
 */
export function railTProfile(inp: Partial<GirderInputs>): RailTProfile {
  const num = (v: number | undefined): number =>
    typeof v === "number" && Number.isFinite(v) && v > 0 ? v : 0;
  const on = (inp.railTProfile ?? "").trim() === RAIL_T_PROFILE_ON;
  const webThkMm = num(inp.railTProfileWebThkMm);
  const webHeightMm = num(inp.railTProfileWebHeightMm);
  const topThkMm = num(inp.railTProfileTopThkMm);
  const topWidthMm = num(inp.railTProfileTopWidthMm);
  const present =
    on && webThkMm > 0 && webHeightMm > 0 && topThkMm > 0 && topWidthMm > 0;
  return {
    webThkMm: present ? webThkMm : 0,
    webHeightMm: present ? webHeightMm : 0,
    topThkMm: present ? topThkMm : 0,
    topWidthMm: present ? topWidthMm : 0,
    present,
  };
}

/** DIN 15018 Tablo 17 lookup */
function t17(material: FatigueMaterial, notch: NotchClass, group: LoadGroup): number {
  return DIN15018_T17[material === "S355JR" ? "St52" : "St37"][notch][group];
}

/** von Mises düzlem gerilme bileşkesi: √(σx² + σz² − |σx·σz| + 3τ²) */
function vonMisesPlane(sigmaX: number, sigmaZ: number, tau: number): number {
  return Math.sqrt(sigmaX ** 2 + sigmaZ ** 2 - Math.abs(sigmaX * sigmaZ) + 3 * tau ** 2);
}

/**
 * Yatay ivme dinamik katsayısı ψh — FEM 1.001 Appendix A.2.2.3 / Şekil A.2.2.1.
 *
 * Kütle oranı µ = m1/m (m1: asılı yük kütlesi, m: hareket eden eşdeğer kütle):
 *   µ ≤ 1 → ψh = 2            (grafiğin üst zarfı; β ≥ βkrit'te tam 2'ye ulaşır)
 *   µ > 1 → ψh = √(2 + µ + 1/µ)   (Part 2'de verilen teorik maksimum)
 * Yük dışındaki hareketli parçalar için standart zaten ψh = 2 öngörür; bu
 * yüzden atalet yükü formüllerinde araç ağırlığı 2 katsayısıyla girer.
 */
export function horizontalDynamicFactor(massRatio: number): number {
  if (!Number.isFinite(massRatio) || massRatio <= 0) return 2;
  return massRatio > 1 ? Math.sqrt(2 + massRatio + 1 / massRatio) : 2;
}

/**
 * Yük arttırma katsayısı γc — elle ezilmediyse yapı sınıfından türetilir.
 * (FEM 1.001 T.2.3.4)
 */
export function girderAmplifyFactor(
  specs: TechnicalSpecs,
  inp: Pick<GirderInputs, "amplifyYcOverride">
): number {
  return inp.amplifyYcOverride ?? STRUCTURE_AMPLIFY_FACTOR[specs.structureClass];
}

/**
 * DIN 15018 yorulma yük grubu — elle ezilmediyse teknik özelliklerdeki
 * kaldırma/yük sınıfının B bileşeninden türetilir. Sınıf okunamazsa güvenli
 * tarafta kalmak için en ağır grup (B6) kullanılır.
 */
export function girderLoadGroup(
  specs: TechnicalSpecs,
  sel: Pick<GirderSelections, "fatigueLoadGroupOverride">
): LoadGroup {
  return (
    sel.fatigueLoadGroupOverride ??
    parseHoistLoadClass(specs.hoistLoadClass).loadGroup ??
    FALLBACK_LOAD_GROUP
  );
}

export function computeMainGirder(
  specs: TechnicalSpecs,
  which: GirderWhich,
  inp: GirderInputs,
  sel: GirderSelections,
  deps: GirderDeps
): ModuleResult<GirderValues> {
  const cells: Record<string, number | string> = {};
  const checks: AnyCheck[] = [];

  // --- 7.1 Kesit özellikleri ------------------------------------------------
  const t2 = inp.t2Mm, b2 = inp.b2Mm;      // üst iç flanş
  const t3 = inp.t3Mm, h3 = inp.h3Mm;      // ana gövde sacı
  const t4 = inp.t4Mm;                     // yardımcı gövde sacı
  const t5 = inp.t5Mm, b5 = inp.b5Mm;      // alt flanş
  const t6 = inp.t6Mm, b6 = inp.b6Mm;      // ek flanş
  const webGapMm = inp.aMm;                // gövde sacları arası mesafe
  const edgeDistMm = inp.xMm;              // kenar mesafesi

  // Ray altı T profil (bkz. GirderInputs). AÇIKKEN RAY ALTI SACI İPTALDİR:
  // rayı taşıyan sac artık T profilin üst sacıdır.
  const tp = railTProfile(inp);
  const tTw = tp.webThkMm, hTw = tp.webHeightMm;   // T yan sacı
  const tTf = tp.topThkMm, bTf = tp.topWidthMm;    // T üst sacı
  const t1 = tp.present ? 0 : inp.t1Mm;    // ray altı sacı (T varken iptal)
  const b1 = tp.present ? 0 : inp.b1Mm;

  // Ray, ana gövde sacının (web1) ekseninde durur; "ray altı sacı" b1 ve T
  // profilin iki sacı da bu eksende ortalanır — kesitin ortasında DEĞİL.
  const railCenterYMm = edgeDistMm + t3 * 0.5;

  /**
   * ÜST İÇ FLANŞ, T PROFİLİN SAĞ UCUNDAN BAŞLAR.
   *
   * T profilin üst sacı ile ana kirişin üst sacı AYNI SEVİYEDEDİR (kullanıcı
   * kararı, 15.08.2026): T, kirişin üstüne oturmaz, üst bölümünün İÇİNE girer.
   * Ray kesitin sol yanındadır ve T profil oraya oturur; **b2 sacının sol
   * başlangıç noktası T profilin SAĞ BİTİŞ noktasıdır** (kullanıcı düzeltmesi,
   * ekran görüntüsüyle). Yani T'nin SOLUNDA b2 parçası YOKTUR — kesitin o
   * yandaki en dış lifi T flanşının kendisidir ve flanş b2'nin nominal sol
   * kenarından dışarı taşabilir.
   *
   * `tCutHi` T'nin sağ ucudur; b2'yi aşarsa (çok geniş T) plaka tümüyle
   * kaybolur ve `b2Eff` sıfıra iner.
   */
  const tCutHi = tp.present ? Math.min(b2, railCenterYMm + bTf * 0.5) : 0;
  const b2Eff = tp.present ? Math.max(0, b2 - tCutHi) : b2;

  /**
   * ANA GÖVDE SACI T PROFİLİN YAN SACI KADAR KISALIR.
   *
   * T'nin üst sacı kesitin en üstünden başlar (tTf kalınlığında), yan sacı
   * onun altından hTw kadar iner. Ana gövde sacı o kotun ALTINDA başlar; yani
   * gövde bölgesinin toplam yüksekliği (t2 + h3) değişmez, yalnız içindeki
   * paylaşım değişir. tTf = t2 olduğunda sonuç tam olarak h3 − hTw'dir.
   */
  const h3Main = tp.present ? Math.max(0, h3 + t2 - tTf - hTw) : h3;

  const areaTopFlange = t1 * b1;           // [mm²]
  const areaTopInnerFlange = t2 * b2Eff;
  const areaMainWeb = t3 * h3Main;
  const areaSecondaryWeb = h3 * t4;        // dış yan sac TAM BOY kalır
  const areaBottomFlange = t5 * b5;
  const areaExtraFlange = t6 * b6;
  const areaTWeb = tTw * hTw;
  const areaTTop = tTf * bTf;
  const totalAreaMm2 =
    areaTopFlange + areaTopInnerFlange + areaMainWeb +
    areaSecondaryWeb + areaBottomFlange + areaExtraFlange +
    areaTWeb + areaTTop;

  /**
   * TOPLAM YÜKSEKLİK DEĞİŞMEZ: dış yan sacın boyu + başlık sacları. T profil
   * kesitin içine girdiği için yüksekliğe bir şey EKLEMEZ; ray altı sacı
   * iptal olduğundan (t1 = 0) o kalınlık da düşer.
   */
  const heightMm = t1 + t2 + h3 + t5 + t6;
  const areaCm2 = totalAreaMm2 * 0.01;
  // Kesit saclarının metre ağırlığı: A[cm²] × 100[cm/m] × yoğunluk[kg/cm³]
  const weightPerM = areaCm2 * 100 * STEEL_DENSITY_KG_CM3; // [kg/m]
  // Parçaların alt yüzden ölçülen ağırlık merkezleri [mm]
  const zTTopMid = heightMm - 0.5 * tTf;              // T üst sacı (en üstte)
  const zTWebMid = heightMm - tTf - 0.5 * hTw;        // T yan sacı
  const zMainWebMid = t6 + t5 + 0.5 * h3Main;         // kısalmış ana gövde
  const zSecondaryWebMid = t6 + t5 + 0.5 * h3;        // dış gövde (tam boy)
  // Ağırlık merkezi, alt yüzden ölçülür [mm].
  // T PROFİL YOKKEN ifade harfi harfine eskisidir — iki gövde tek terimde
  // toplanır. Ayrıştırılmış biçim matematiksel olarak aynıdır ama kayan
  // noktada son bitleri kaydırır ve tarihsel karşılaştırma bunu görür.
  const webFirstMoment = tp.present
    ? areaMainWeb * zMainWebMid + areaSecondaryWeb * zSecondaryWebMid
    : (t3 + t4) * h3 * (t6 + t5 + 0.5 * h3);
  const centroidZMm =
    ((areaExtraFlange * (0.5 * t6) +
      areaBottomFlange * (t6 + 0.5 * t5) +
      webFirstMoment +
      areaTopInnerFlange * (t6 + t5 + h3 + 0.5 * t2) +
      areaTopFlange * (t6 + t5 + h3 + t2 + 0.5 * t1) +
      areaTWeb * zTWebMid +
      areaTTop * zTTopMid) * 0.01) / areaCm2;
  // Yatay eksen etrafında atalet momenti (Steiner) [cm⁴]
  const webOwnInertiaY = tp.present
    ? t3 * h3Main ** 3 + t4 * h3 ** 3
    : (t3 + t4) * h3 ** 3;
  const webSteinerY = tp.present
    ? (centroidZMm - zMainWebMid) ** 2 * areaMainWeb +
      (centroidZMm - zSecondaryWebMid) ** 2 * areaSecondaryWeb
    : (centroidZMm - t6 - t5 - 0.5 * h3) ** 2 * (h3 * (t4 + t3));
  const inertiaYCm4 =
    ((1 / 12) * (b1 * t1 ** 3 + b2Eff * t2 ** 3 + webOwnInertiaY + b5 * t5 ** 3 + b6 * t6 ** 3
      + tTw * hTw ** 3 + bTf * tTf ** 3) +
      (centroidZMm - 0.5 * t6) ** 2 * areaExtraFlange +
      (centroidZMm - t6 - 0.5 * t5) ** 2 * areaBottomFlange +
      webSteinerY +
      (centroidZMm - t6 - t5 - h3 - 0.5 * t2) ** 2 * areaTopInnerFlange +
      (centroidZMm - t6 - t5 - h3 - t2 - 0.5 * t1) ** 2 * areaTopFlange +
      (centroidZMm - zTWebMid) ** 2 * areaTWeb +
      (centroidZMm - zTTopMid) ** 2 * areaTTop) * 0.1 ** 4;
  const modulusYBottomCm3 = (inertiaYCm4 * 10) / centroidZMm;
  const modulusYTopCm3 = (inertiaYCm4 * 10) / (heightMm - centroidZMm);

  /**
   * KESİLMİŞ ÜST İÇ FLANŞIN yatay eksendeki büyüklükleri.
   *
   * Plaka [0, b2] aralığından [tCutLo, tCutHi] şeridi çıkarılmış bir dikdörtgen
   * çiftidir; ağırlık merkezi artık b2/2 DEĞİLDİR ve kendi ataleti de
   * b2³·t2/12 değildir. İkisi de kesitin sol kenarına (y = 0) göre TAM olarak
   * hesaplanır, sonra Steiner ile kesitin ağırlık merkezine taşınır.
   *
   * T profil yokken (`tCutWidth = 0`) ifadeler harfi harfine eski değerlere
   * indirgenir; tarihsel karşılaştırma bunu görür, o yüzden dallanma
   * korunmuştur.
   */
  // Kalan plaka [tCutHi, b2] aralığındaki tek bir dikdörtgendir.
  const topInnerCentroidY = tp.present ? (tCutHi + b2) * 0.5 : b2 * 0.5;
  // (1/12) çarpanı aşağıdaki grubun TAMAMINA uygulanır; kesilmiş plakanın kendi
  // ataleti bu forma girmediği için 12 ile çarpılıp gruba konur. T profil
  // yokken terim harfi harfine `b2³·t2` olur ve tarihsel sonuç bit bit korunur.
  const topInnerOwnInertiaZ12 = tp.present
    ? 12 * ((t2 * (b2 ** 3 - tCutHi ** 3)) / 3 -
        areaTopInnerFlange * topInnerCentroidY ** 2)
    : b2 ** 3 * t2;
  // Düşey eksen etrafında ağırlık merkezi ve atalet [mm] / [cm⁴]
  const centroidYMm =
    (areaMainWeb * (edgeDistMm + t3 * 0.5) +
      areaSecondaryWeb * (edgeDistMm + t3 + webGapMm + t4 * 0.5) +
      areaTopFlange * railCenterYMm +
      (areaTWeb + areaTTop) * railCenterYMm +
      areaTopInnerFlange * topInnerCentroidY +
      areaBottomFlange * ((b2 - b5) * 0.5 + b5 * 0.5) +
      areaExtraFlange * ((b2 - b6) * 0.5 + b6 * 0.5)) / totalAreaMm2;
  // Gövde saclarının kendi ataleti: ana gövde kısaldığı için ayrı yazılır
  // (T profil yokken tek terimde kalır — bkz. yukarıdaki kayan nokta notu).
  const webOwnInertiaZ = tp.present
    ? h3Main * t3 ** 3 + h3 * t4 ** 3
    : h3 * (t3 ** 3 + t4 ** 3);
  // Kesilmiş plakanın Steiner payı — T profil YOKKEN bu terim tarihsel ifadede
  // HİÇ YOKTU; eklemek sonucu değiştirirdi, sıfır eklemek ise etkisizdir.
  const topInnerSteinerZ = tp.present
    ? (topInnerCentroidY - centroidYMm) ** 2 * areaTopInnerFlange
    : 0;
  const inertiaZCm4 =
    ((1 / 12) * (b1 ** 3 * t1 + topInnerOwnInertiaZ12 + webOwnInertiaZ
      + b5 ** 3 * t5 + b6 ** 3 * t6 + tTw ** 3 * hTw + bTf ** 3 * tTf) +
      (railCenterYMm - centroidYMm) ** 2 * areaTopFlange +
      (railCenterYMm - centroidYMm) ** 2 * (areaTWeb + areaTTop) +
      ((edgeDistMm + t3 * 0.5) - centroidYMm) ** 2 * areaMainWeb +
      ((edgeDistMm + t3 + webGapMm + t4 * 0.5) - centroidYMm) ** 2 * areaSecondaryWeb +
      topInnerSteinerZ +
      ((b2 - b5) * 0.5 + 0.5 * b5 - centroidYMm) ** 2 * areaBottomFlange +
      ((b2 - b6) * 0.5 + b6 * 0.5 - centroidYMm) ** 2 * areaExtraFlange) / 10 ** 4;
  // Kesitin YATAYDA en dış lifleri. Normalde plaka kenarlarıdır (0 ve b2), ama
  // T profilin üst sacı iki yana da taşabilir — özellikle SOLA, çünkü ray
  // kesitin sol yanındadır ve T flanşı b2'nin nominal sol kenarını geçer.
  const outerLeftYMm = tp.present ? Math.min(0, railCenterYMm - bTf * 0.5) : 0;
  const outerRightYMm = tp.present ? Math.max(b2, railCenterYMm + bTf * 0.5) : b2;
  const modulusZBottomCm3 = (10 * inertiaZCm4) / (centroidYMm - outerLeftYMm);
  const modulusZTopCm3 = (10 * inertiaZCm4) / (outerRightYMm - centroidYMm);

  // Burulma: kapalı kutu (Bredt) — bir gövde sacı yoksa açık kesit (St Venant)
  const inertiaTorsionOpenCm4 =
    (t2 ** 3 * b2 + t3 ** 3 * h3 + t4 ** 3 * h3 + t5 ** 3 * b5) * 0.1 ** 4 / 3;
  const torsionBoxWidthCm = (webGapMm + t3 * 0.5 + t4 * 0.5) * 0.1;
  const torsionBoxHeightCm = (h3 + 0.5 * t5 + 0.5 * t2) * 0.1;
  const inertiaTorsionCm4 =
    t3 === 0 || t4 === 0
      ? inertiaTorsionOpenCm4
      : (4 * (torsionBoxWidthCm * torsionBoxHeightCm) ** 2) /
        (torsionBoxWidthCm / (t2 * 0.1) +
          torsionBoxWidthCm / (0.1 * t5) +
          torsionBoxHeightCm / (0.1 * t3) +
          torsionBoxHeightCm / (0.1 * t4));

  // CMAA 70 3.5.1 — kaynaklı kutu kiriş oranları (bilgi amaçlı gösterilir)
  const spanMm = specs.spanM * 1000;                     // L — açıklık
  const spanToDepthRatio = spanMm / heightMm;            // L/h ≤ 25
  const spanToWidthRatio = spanMm / webGapMm;            // L/b ≤ 65
  // Ön ağırlık teklif/taşıma hesabında doğrudan kullanıldığı için küsuratlı
  // bırakılmaz. Emniyetli tarafta kalacak biçimde HER ZAMAN bir sonraki
  // 50 kg katına çıkarılır (zaten 50'nin katıysa değer değişmez).
  const approxGirderWeightKg = Math.ceil((weightPerM * specs.spanM * 1.15) / 50) * 50;

  Object.assign(cells, {
    "section.areaTProfileWeb": areaTWeb,
    "section.areaTProfileTop": areaTTop,
    "section.mainWebHeight": h3Main,
    "section.topInnerEffectiveWidth": b2Eff,
    "section.areaTopFlange": areaTopFlange,
    "section.areaTopInnerFlange": areaTopInnerFlange,
    "section.areaMainWeb": areaMainWeb,
    "section.areaSecondaryWeb": areaSecondaryWeb,
    "section.areaBottomFlange": areaBottomFlange,
    "section.areaExtraFlange": areaExtraFlange,
    "section.height": heightMm,
    "section.area": areaCm2,
    "section.weightPerLength": weightPerM,
    "section.centroidZ": centroidZMm,
    "section.inertiaY": inertiaYCm4,
    "section.modulusYBottom": modulusYBottomCm3,
    "section.modulusYTop": modulusYTopCm3,
    "section.railCenterY": railCenterYMm,
    "section.centroidY": centroidYMm,
    "section.inertiaZ": inertiaZCm4,
    "section.modulusZBottom": modulusZBottomCm3,
    "section.modulusZTop": modulusZTopCm3,
    "section.inertiaTorsion": inertiaTorsionCm4,
    "section.inertiaTorsionOpen": inertiaTorsionOpenCm4,
    "section.torsionBoxWidth": torsionBoxWidthCm,
    "section.torsionBoxHeight": torsionBoxHeightCm,
    "section.spanToDepthRatio": spanToDepthRatio,
    "section.spanToWidthRatio": spanToWidthRatio,
    "section.approxGirderWeight": approxGirderWeightKg,
  });
  checks.push({
    id: `${which}.section.spanToDepthRatio`,
    label: "Kutu Kiriş Açıklık / Yükseklik Oranı L/h",
    required: 25,
    provided: spanToDepthRatio,
    unit: "-",
    op: "<=",
    computedSide: "provided",
    pass: spanToDepthRatio <= 25,
    standard: "CMAA 70 3.5.1",
    kind: "standart",
    severity: "uyari",
  });
  checks.push({
    id: `${which}.section.spanToWidthRatio`,
    label: "Kutu Kiriş Açıklık / Gövdeler Arası Oranı L/b",
    required: 65,
    provided: spanToWidthRatio,
    unit: "-",
    op: "<=",
    computedSide: "provided",
    pass: spanToWidthRatio <= 65,
    standard: "CMAA 70 3.5.1",
    kind: "standart",
    severity: "uyari",
  });

  // --- 7.2 Yükler -----------------------------------------------------------
  // Bir ana kirişe düşen köprü öz ağırlığı: köprünün toplam ağırlığı, taşıyıcı
  // kiriş adedine bölünür (tek/çift/dört kirişli düzende 1/2/4).
  const girderShare = deps.girdersInBridge > 0 ? deps.girdersInBridge : 2;
  // Dört kirişli köprüde ana ve yardımcı araba ayrı ikişer kirişli takımlar
  // üzerinde yürür; bu nedenle hareketli yük payı toplam kiriş adedi değildir.
  const liveLoadShare = deps.liveLoadGirderCount === 1 ? 1 : 2;
  const bridgeDeadWeightKg = (deps.bridgeWeightT / girderShare) * 1000;
  const trolleyWeightKg = deps.trolleyWeightT * 1000;
  const hoistLoadKg = deps.hoistLoadKg;
  const belowHookWeightKg = deps.mainHookBlockWeightKg + deps.mainRopeWeightKg;
  const trolleyWeightOnGirderKg = trolleyWeightKg / liveLoadShare;
  const hoistLoadOnGirderKg = hoistLoadKg / liveLoadShare;
  const belowHookWeightOnGirderKg = belowHookWeightKg / liveLoadShare;
  cells["loads.measurementsConfirmed"] = inp.loadMeasurementsConfirmed === true
    ? "Onaylandı"
    : "Onay Bekliyor";
  checks.push({
    id: `${which}.loads.measurements.confirmed`,
    label: "Yükler Bölümü Ölçü Onayı",
    required: 1,
    provided: inp.loadMeasurementsConfirmed === true ? 1 : 0,
    unit: "-",
    op: ">=",
    computedSide: "provided",
    pass: inp.loadMeasurementsConfirmed === true,
    standard: "ORION tasarım veri onayı",
    kind: "firma",
    severity: "engelleyici",
  });
  const totalLiveLoadKg = hoistLoadKg + belowHookWeightKg;
  const totalLiveLoadOnGirderKg = totalLiveLoadKg / liveLoadShare;

  const liftSpeedMs = deps.liftSpeedMpm / 60;
  // FEM 1.001 2.2.2.1.1 dinamik katsayı ψ
  const dynamicFactor =
    liftSpeedMs < 0.25 ? 1.15 : liftSpeedMs > 1 ? 1.6 : 1 + liftSpeedMs * 0.6;

  const trolleySpeedMs = deps.trolleyActualSpeedMpm / 60;
  const trolleyAccelMs2 = trolleySpeedMs / deps.trolleyAccelTimeS;
  const bridgeSpeedMs = deps.bridgeActualSpeedMpm / 60;
  const bridgeAccelMs2 = bridgeSpeedMs / deps.bridgeAccelTimeS;

  // FEM A.2.2.3 — sarkaç periyodu T1, kütle oranı µ = m1/m ve β = tm/T1.
  // m1 asılı kütledir: yük + kanca bloğu + halat (= toplam hareketli yük).
  // m ise harekete zorlanan eşdeğer kütledir: araba yürütmede arabanın kendisi,
  // köprü yürütmede tüm köprü + araba.
  const pendulumPeriodS = 2 * Math.PI * Math.sqrt(inp.hookTopPositionM / GRAVITY);
  const bridgeMovingMassKg = deps.bridgeWeightT * 1000 + trolleyWeightKg;
  const massRatioBridge = totalLiveLoadKg / bridgeMovingMassKg;
  const massRatioTrolley = totalLiveLoadKg / trolleyWeightKg;
  const betaBridge = deps.bridgeAccelTimeS / pendulumPeriodS;
  const betaTrolley = deps.trolleyAccelTimeS / pendulumPeriodS;
  const psiHA = inp.psiHAOverride ?? horizontalDynamicFactor(massRatioTrolley);
  const psiHK = inp.psiHKOverride ?? horizontalDynamicFactor(massRatioBridge);

  // Yanal (skew) yük katsayısı λ — FEM 1.001 2.2.3.3, 0,05…0,20 bandına kırpılır
  const clampSkew = (v: number) => (v < 0.05 ? 0.05 : v > 0.2 ? 0.2 : v);
  const skewFactorBridge = clampSkew((0.025 * specs.spanM) / inp.bridgeAxleSpacingM);
  const skewFactorTrolley =
    clampSkew((0.025 * inp.trolleyWheelSpacingM) / inp.trolleyAxleSpacingM);

  // Araba yatay yükleri (FEM 1.001 2.2.3.1.1)
  const trolleyInertiaLoadKg =
    (trolleyAccelMs2 * (hoistLoadKg * psiHA + 2 * trolleyWeightKg)) / GRAVITY;
  const trolleyWheelPressureKg = trolleyWeightKg / deps.trolleyWheelCount;
  // Tahrikli tekerde sürtünme ile aktarılabilen en büyük kuvvet (μ = 1/7, çift teker)
  const trolleyTractionLimitKg =
    (deps.trolleyDrivenWheels * trolleyWheelPressureKg) / TRACTION_LIMIT_DIVISOR;
  const trolleyHorizontalKg =
    trolleyTractionLimitKg < trolleyInertiaLoadKg
      ? trolleyTractionLimitKg / liveLoadShare
      : trolleyInertiaLoadKg / liveLoadShare;
  const trolleySkewKg = (trolleyWeightKg + hoistLoadKg) * skewFactorTrolley;

  // Köprü yatay yükleri — araba ile SİMETRİK: asılı yük ψhK ile dahil edilir
  // (FEM 1.001 2.2.3.1.1 + A.2.2.3: yükten gelen atalet kuvveti ψh·Fcm).
  const bridgeInertiaLoadKg =
    (bridgeAccelMs2 *
      (hoistLoadKg * psiHK + liveLoadShare * bridgeDeadWeightKg)) /
    GRAVITY;
  const bridgeWheelPressureKg = bridgeDeadWeightKg / deps.bridgeWheelCount;
  const bridgeTractionLimitKg =
    (deps.bridgeDrivenWheels * bridgeWheelPressureKg) / TRACTION_LIMIT_DIVISOR;
  const bridgeHorizontalKg =
    bridgeTractionLimitKg < bridgeInertiaLoadKg
      ? bridgeTractionLimitKg / liveLoadShare
      : bridgeInertiaLoadKg / liveLoadShare;
  const bridgeSkewKg = (bridgeDeadWeightKg + hoistLoadKg) * skewFactorBridge;

  Object.assign(cells, {
    "load.bridgeDeadWeight": bridgeDeadWeightKg,
    "load.bridgeTotalWeight": deps.bridgeWeightT * 1000,
    "load.girderCount": girderShare,
    "load.liveLoadGirderCount": liveLoadShare,
    "load.trolleyWeight": trolleyWeightKg,
    "load.trolleyWeightOnGirder": trolleyWeightOnGirderKg,
    "load.hoistLoad": hoistLoadKg,
    "load.hoistLoadOnGirder": hoistLoadOnGirderKg,
    "load.belowHookWeight": belowHookWeightKg,
    "load.belowHookWeightOnGirder": belowHookWeightOnGirderKg,
    "load.totalLiveLoad": totalLiveLoadKg,
    "load.totalLiveLoadOnGirder": totalLiveLoadOnGirderKg,
    "load.liftSpeed": liftSpeedMs,
    "load.dynamicFactor": dynamicFactor,
    "load.trolleySpeed": trolleySpeedMs,
    "load.trolleyAccel": trolleyAccelMs2,
    "load.bridgeSpeed": bridgeSpeedMs,
    "load.bridgeAccel": bridgeAccelMs2,
    "load.trolleyWheelCount": deps.trolleyWheelCount,
    "load.trolleyDrivenWheels": deps.trolleyDrivenWheels,
    "load.bridgeWheelCount": deps.bridgeWheelCount,
    "load.bridgeDrivenWheels": deps.bridgeDrivenWheels,
    "load.pendulumPeriod": pendulumPeriodS,
    "load.bridgeMovingMass": bridgeMovingMassKg,
    "load.massRatioBridge": massRatioBridge,
    "load.massRatioTrolley": massRatioTrolley,
    "load.betaBridge": betaBridge,
    "load.betaTrolley": betaTrolley,
    "load.psiHA": psiHA,
    "load.psiHK": psiHK,
    "load.skewFactorBridge": skewFactorBridge,
    "load.skewFactorTrolley": skewFactorTrolley,
    "load.trolleyInertia": trolleyInertiaLoadKg,
    "load.trolleyWheelPressure": trolleyWheelPressureKg,
    "load.trolleyTractionLimit": trolleyTractionLimitKg,
    "load.trolleyHorizontal": trolleyHorizontalKg,
    "load.trolleySkew": trolleySkewKg,
    "load.bridgeInertia": bridgeInertiaLoadKg,
    "load.bridgeWheelPressure": bridgeWheelPressureKg,
    "load.bridgeTractionLimit": bridgeTractionLimitKg,
    "load.bridgeHorizontal": bridgeHorizontalKg,
    "load.bridgeSkew": bridgeSkewKg,
  });

  // --- 7.4 Gerilme analizi --------------------------------------------------
  const axleSpacingMm = inp.trolleyAxleSpacingM * 1000; // a — araba dingil açıklığı
  const wheelToSupportMm = (spanMm - axleSpacingMm) / 2; // b — mesnetten tekere

  // σ1…σ3 — düşey yükler → σx (Mmaks = W·L/8; mm→cm için /10)
  const momentSelfWeight = (spanMm * bridgeDeadWeightKg) / 80;
  const sigmaXSelfWeightBottom = momentSelfWeight / modulusYBottomCm3;   // σ1 alt
  const sigmaXSelfWeightTop = -momentSelfWeight / modulusYTopCm3;        // σ1 üst
  // Bir kiriş üzerinde iki boyuna teker/yük istasyonu vardır. Çift kirişlide
  // toplam dört teker yükü iki kirişe dağılır (Wa/4); tek kirişlide iki
  // istasyonda birleşir (Wa/2).
  const trolleyWheelLoadKg = trolleyWeightOnGirderKg / 2;
  const momentTrolley = (wheelToSupportMm * trolleyWheelLoadKg) / 10;
  const sigmaXTrolleyBottom = momentTrolley / modulusYBottomCm3;         // σ2 alt
  const sigmaXTrolleyTop = -momentTrolley / modulusYTopCm3;              // σ2 üst
  const hoistWheelLoadKg = hoistLoadOnGirderKg / 2;
  const momentHoistLoad = (wheelToSupportMm * hoistWheelLoadKg) / 10;
  const momentVerticalTotal = momentSelfWeight + momentTrolley + momentHoistLoad;
  const sigmaXHoistBottom = momentHoistLoad / modulusYBottomCm3;         // σ3 alt
  const sigmaXHoistTop = -momentHoistLoad / modulusYTopCm3;              // σ3 üst

  // σ4, σ5 — yatay yükler → σx (düşey eksen etrafında eğilme)
  const momentBridgeHorizontal = (spanMm * bridgeHorizontalKg) / 80;
  const sigmaXLateralBridgeBottom = momentBridgeHorizontal / modulusZBottomCm3;
  const sigmaXLateralBridgeTop = momentBridgeHorizontal / modulusZTopCm3;
  const momentTrolleySkew = (axleSpacingMm * trolleySkewKg) / 20;
  const sigmaXLateralTrolleyBottom = momentTrolleySkew / modulusZBottomCm3;
  const sigmaXLateralTrolleyTop = momentTrolleySkew / modulusZTopCm3;

  // σ6 — ray kolu (kayma merkezi eksantrikliği) → σx
  const momentRailLever = (inp.railLeverCMm * trolleyHorizontalKg) / 10;
  const sigmaXRailLeverBottom = momentRailLever / modulusYBottomCm3;
  const sigmaXRailLeverTop = momentRailLever / modulusYTopCm3;

  // σ7, σ8 — ikincil momentler (perdeler arası yerel eğilme)
  const momentSecondaryTrolley = (inp.diaphragmSpacingMm * trolleyWheelLoadKg) / 50;
  const sigmaXSecondaryTrolleyBottom = momentSecondaryTrolley / modulusYBottomCm3 / 3;
  const sigmaXSecondaryTrolleyTop = -momentSecondaryTrolley / modulusYTopCm3 / 3;
  const momentSecondaryHoist = (inp.diaphragmSpacingMm * hoistWheelLoadKg) / 50;
  const sigmaXSecondaryHoistBottom = momentSecondaryHoist / modulusYBottomCm3;
  const sigmaXSecondaryHoistTop = -momentSecondaryHoist / modulusYTopCm3;

  // σ9, σ10 — tekerlek basıncı → σz (basınç, negatif) — DIN 15018 Şekil 9
  const wheelContactLengthMm = 2 * inp.wheelContactHMm + 40;
  const contactWidthCm = (0.2 * inp.wheelContactHMm + 5) * inp.wheelContactTMm * 0.1;
  const sigmaZTrolley = -(trolleyWheelLoadKg / 2) / contactWidthCm;
  const sigmaZHoist = -(hoistWheelLoadKg / 2) / contactWidthCm;

  // τ1, τ2 — burulma → kayma gerilmesi (Bredt: τ = T / (2·Am·t))
  const torsionLeverMm = centroidYMm - railCenterYMm;
  const momentTorsionTrolley = (trolleyWheelLoadKg * torsionLeverMm) / 10;
  const torsionShearDenominator = 2 * areaCm2 * ((t3 + t4) / 2);
  const shearTorsionTrolley = momentTorsionTrolley / torsionShearDenominator;
  const momentTorsionHoist = (hoistWheelLoadKg * torsionLeverMm) / 10;
  const shearTorsionHoist = momentTorsionHoist / torsionShearDenominator;

  // τ3, τ4, τ5 — kesme kuvveti → gövde saclarında kayma gerilmesi
  const webDepthAboveCentroidMm = heightMm - centroidZMm - t2;
  /**
   * RAY ALTINDAKİ GÖVDE HATTININ kesme alanı. T profil varsa hat iki
   * parçadır: üstte T'nin yan sacı (kalın), altta kısalmış ana gövde sacı.
   * İkisi de aynı düşey kesme akışını taşır ve toplanır — yalnız ana gövdeyi
   * saymak, T profil konan bir kirişte kesme gerilmesini olduğundan büyük
   * gösterirdi. T profil yokken ifade harfi harfine eskisidir.
   */
  const mainWebShearAreaCm2 = tp.present
    ? (h3Main * t3 + hTw * tTw) / 100
    : (h3 * t3) / 100;
  const shearMainSelfWeight =
    (bridgeDeadWeightKg * (inp.diaphragmSpacingMm - 2 * webDepthAboveCentroidMm)) /
    (2 * inp.diaphragmSpacingMm * mainWebShearAreaCm2);
  const selfWeightSecondaryShareKg = bridgeDeadWeightKg / 2;
  const secondaryWebShearAreaCm2 = (h3 * t4) / 100;
  const shearSecondarySelfWeight =
    (0.5 * selfWeightSecondaryShareKg *
      (inp.diaphragmSpacingMm - 2 * webDepthAboveCentroidMm)) /
    (2 * inp.diaphragmSpacingMm * secondaryWebShearAreaCm2);
  const shearMainTrolley = trolleyWheelLoadKg / mainWebShearAreaCm2;
  const trolleySecondaryShareKg = trolleyWheelLoadKg / 2;
  const shearSecondaryTrolley = trolleySecondaryShareKg / secondaryWebShearAreaCm2;
  const shearMainHoist = hoistWheelLoadKg / mainWebShearAreaCm2;
  const hoistSecondaryShareKg = hoistWheelLoadKg / 2;
  const shearSecondaryHoist = hoistSecondaryShareKg / secondaryWebShearAreaCm2;

  Object.assign(cells, {
    "geometry.wheelToSupport": wheelToSupportMm,
    "geometry.wheelContactLength": wheelContactLengthMm,
    "geometry.railLever": inp.railLeverCMm,
    "geometry.torsionLever": torsionLeverMm,
    "section.webDepthAboveCentroid": webDepthAboveCentroidMm,
    "section.mainWebShearArea": mainWebShearAreaCm2,
    "section.secondaryWebShearArea": secondaryWebShearAreaCm2,
    "section.wheelContactWidth": contactWidthCm,
    "load.trolleyWheelLoad": trolleyWheelLoadKg,
    "load.hoistWheelLoad": hoistWheelLoadKg,
    "load.selfWeightSecondaryShare": selfWeightSecondaryShareKg,
    "load.trolleySecondaryShare": trolleySecondaryShareKg,
    "load.hoistSecondaryShare": hoistSecondaryShareKg,
    "moment.girderSelfWeight": momentSelfWeight,
    "moment.trolleyWheel": momentTrolley,
    "moment.hoistLoad": momentHoistLoad,
    "moment.verticalTotal": momentVerticalTotal,
    "moment.bridgeHorizontal": momentBridgeHorizontal,
    "moment.trolleySkew": momentTrolleySkew,
    "moment.railLever": momentRailLever,
    "moment.secondaryTrolley": momentSecondaryTrolley,
    "moment.secondaryHoist": momentSecondaryHoist,
    "moment.torsionTrolley": momentTorsionTrolley,
    "moment.torsionHoist": momentTorsionHoist,
    "stress.sigmaXSelfWeightBottom": sigmaXSelfWeightBottom,
    "stress.sigmaXSelfWeightTop": sigmaXSelfWeightTop,
    "stress.sigmaXTrolleyBottom": sigmaXTrolleyBottom,
    "stress.sigmaXTrolleyTop": sigmaXTrolleyTop,
    "stress.sigmaXHoistBottom": sigmaXHoistBottom,
    "stress.sigmaXHoistTop": sigmaXHoistTop,
    "stress.sigmaXLateralBridgeBottom": sigmaXLateralBridgeBottom,
    "stress.sigmaXLateralBridgeTop": sigmaXLateralBridgeTop,
    "stress.sigmaXLateralTrolleyBottom": sigmaXLateralTrolleyBottom,
    "stress.sigmaXLateralTrolleyTop": sigmaXLateralTrolleyTop,
    "stress.sigmaXRailLeverBottom": sigmaXRailLeverBottom,
    "stress.sigmaXRailLeverTop": sigmaXRailLeverTop,
    "stress.sigmaXSecondaryTrolleyBottom": sigmaXSecondaryTrolleyBottom,
    "stress.sigmaXSecondaryTrolleyTop": sigmaXSecondaryTrolleyTop,
    "stress.sigmaXSecondaryHoistBottom": sigmaXSecondaryHoistBottom,
    "stress.sigmaXSecondaryHoistTop": sigmaXSecondaryHoistTop,
    "stress.sigmaZTrolley": sigmaZTrolley,
    "stress.sigmaZHoist": sigmaZHoist,
    "stress.torsionTrolley": shearTorsionTrolley,
    "stress.torsionHoist": shearTorsionHoist,
    "stress.shearMainSelfWeight": shearMainSelfWeight,
    "stress.shearSecondarySelfWeight": shearSecondarySelfWeight,
    "stress.shearMainTrolley": shearMainTrolley,
    "stress.shearSecondaryTrolley": shearSecondaryTrolley,
    "stress.shearMainHoist": shearMainHoist,
    "stress.shearSecondaryHoist": shearSecondaryHoist,
  });

  // --- Toplam gerilmeler (FEM Yükleme Durumu I) -----------------------------
  const amplifyFactor = girderAmplifyFactor(specs, inp);
  const sigmaXBottomCase1 =
    sigmaXSelfWeightBottom + sigmaXTrolleyBottom + dynamicFactor * sigmaXHoistBottom +
    sigmaXLateralBridgeBottom + sigmaXLateralTrolleyBottom + sigmaXRailLeverBottom +
    sigmaXSecondaryTrolleyBottom + dynamicFactor * sigmaXSecondaryHoistBottom;
  const sigmaXTopCase1 =
    sigmaXSelfWeightTop + sigmaXTrolleyTop + dynamicFactor * sigmaXHoistTop -
    sigmaXLateralBridgeTop - sigmaXLateralTrolleyTop - sigmaXRailLeverTop +
    sigmaXSecondaryTrolleyTop + dynamicFactor * sigmaXSecondaryHoistTop;
  const sigmaZCase1 = sigmaZTrolley + dynamicFactor * sigmaZHoist;
  const shearMainCase1 =
    shearTorsionTrolley + dynamicFactor * shearTorsionHoist +
    shearMainSelfWeight + shearMainTrolley + dynamicFactor * shearMainHoist;
  const shearSecondaryCase1 =
    shearTorsionTrolley + dynamicFactor * shearTorsionHoist +
    shearSecondarySelfWeight + shearSecondaryTrolley + dynamicFactor * shearSecondaryHoist;

  // Bileşik gerilme her gövde sacı için AYRI hesaplanır; kontrol kritik
  // olan (en büyük) değer üzerinden yürür (FEM 1.001 3.2.1.3).
  const combinedBottomMainCase1 = vonMisesPlane(sigmaXBottomCase1, sigmaZCase1, shearMainCase1);
  const combinedBottomSecondaryCase1 =
    vonMisesPlane(sigmaXBottomCase1, sigmaZCase1, shearSecondaryCase1);
  const combinedBottomCase1 = Math.max(combinedBottomMainCase1, combinedBottomSecondaryCase1);
  const combinedTopMainCase1 = vonMisesPlane(sigmaXTopCase1, sigmaZCase1, shearMainCase1);
  const combinedTopSecondaryCase1 =
    vonMisesPlane(sigmaXTopCase1, sigmaZCase1, shearSecondaryCase1);
  const combinedTopCase1 = Math.max(combinedTopMainCase1, combinedTopSecondaryCase1);

  const amplifiedSigmaXBottom = amplifyFactor * sigmaXBottomCase1;
  const amplifiedShearMain = amplifyFactor * shearMainCase1;
  const amplifiedSigmaXTop = amplifyFactor * sigmaXTopCase1;
  const amplifiedShearSecondary = amplifyFactor * shearSecondaryCase1;
  const amplifiedSigmaZ = amplifyFactor * sigmaZCase1;
  const amplifiedCombinedBottom = amplifyFactor * combinedBottomCase1;
  const amplifiedCombinedTop = amplifyFactor * combinedTopCase1;

  // Yükleme Durumu III — test yükleri (dinamik ρ1 / statik ρ2)
  const testFactor =
    dynamicFactor * inp.dynTestFactorR1 > inp.statTestFactorR2
      ? dynamicFactor * inp.dynTestFactorR1
      : inp.statTestFactorR2;
  const sigmaXBottomCase3 =
    sigmaXSelfWeightBottom + sigmaXTrolleyBottom + testFactor * sigmaXHoistBottom +
    sigmaXLateralBridgeBottom + sigmaXLateralTrolleyBottom + sigmaXRailLeverBottom +
    sigmaXSecondaryTrolleyBottom + testFactor * sigmaXSecondaryHoistBottom;
  const sigmaXTopCase3 =
    sigmaXSelfWeightTop + sigmaXTrolleyTop + testFactor * sigmaXHoistTop -
    sigmaXLateralBridgeTop - sigmaXLateralTrolleyTop - sigmaXRailLeverTop +
    sigmaXSecondaryTrolleyTop + testFactor * sigmaXSecondaryHoistTop;
  const shearMainCase3 =
    shearTorsionTrolley + testFactor * shearTorsionHoist +
    shearMainSelfWeight + shearMainTrolley + testFactor * shearMainHoist;
  const shearSecondaryCase3 =
    shearTorsionTrolley + testFactor * shearTorsionHoist +
    shearSecondarySelfWeight + shearSecondaryTrolley + testFactor * shearSecondaryHoist;
  const sigmaZCase3 = sigmaZTrolley + testFactor * sigmaZHoist;
  const combinedBottomCase3 = Math.max(
    vonMisesPlane(sigmaXBottomCase3, sigmaZCase3, shearMainCase3),
    vonMisesPlane(sigmaXBottomCase3, sigmaZCase3, shearSecondaryCase3)
  );
  const combinedTopCase3 = Math.max(
    vonMisesPlane(sigmaXTopCase3, sigmaZCase3, shearMainCase3),
    vonMisesPlane(sigmaXTopCase3, sigmaZCase3, shearSecondaryCase3)
  );
  const combinedCase3 = Math.max(combinedBottomCase3, combinedTopCase3);

  const allow = GIRDER_ALLOWABLE_STRESS[sel.staticMaterial];

  Object.assign(cells, {
    "load.amplifyFactor": amplifyFactor,
    "stress.sigmaXBottomCase1": sigmaXBottomCase1,
    "stress.sigmaXTopCase1": sigmaXTopCase1,
    "stress.sigmaZCase1": sigmaZCase1,
    "stress.shearMainCase1": shearMainCase1,
    "stress.shearSecondaryCase1": shearSecondaryCase1,
    "stress.combinedBottomMainCase1": combinedBottomMainCase1,
    "stress.combinedBottomSecondaryCase1": combinedBottomSecondaryCase1,
    "stress.combinedBottomCase1": combinedBottomCase1,
    "stress.combinedTopMainCase1": combinedTopMainCase1,
    "stress.combinedTopSecondaryCase1": combinedTopSecondaryCase1,
    "stress.combinedTopCase1": combinedTopCase1,
    "stress.amplifiedSigmaXBottom": amplifiedSigmaXBottom,
    "stress.amplifiedShearMain": amplifiedShearMain,
    "stress.amplifiedSigmaXTop": amplifiedSigmaXTop,
    "stress.amplifiedShearSecondary": amplifiedShearSecondary,
    "stress.amplifiedSigmaZ": amplifiedSigmaZ,
    "stress.amplifiedCombinedBottom": amplifiedCombinedBottom,
    "stress.amplifiedCombinedTop": amplifiedCombinedTop,
    "stress.testFactor": testFactor,
    "stress.sigmaXBottomCase3": sigmaXBottomCase3,
    "stress.sigmaXTopCase3": sigmaXTopCase3,
    "stress.shearMainCase3": shearMainCase3,
    "stress.shearSecondaryCase3": shearSecondaryCase3,
    "stress.sigmaZCase3": sigmaZCase3,
    "stress.combinedBottomCase3": combinedBottomCase3,
    "stress.combinedTopCase3": combinedTopCase3,
    "stress.combinedCase3": combinedCase3,
    "stress.allowableCase1": allow.case1,
    "stress.allowableCase3": allow.case3,
  });

  const worstCombinedCase1 = Math.max(amplifiedCombinedBottom, amplifiedCombinedTop);
  checks.push({
    id: `${which}.stress.case1`,
    label: "Yükleme Durumu I Bileşik Gerilme (γc·σcomb)",
    required: worstCombinedCase1, provided: allow.case1, unit: "kg/cm²", op: ">=",
    computedSide: "required",
    pass: allow.case1 >= worstCombinedCase1,
    standard: "FEM 1.001 T.3.2.1.1",
    kind: "standart", severity: "engelleyici",
  });
  checks.push({
    id: `${which}.stress.case3`,
    label: "Yükleme Durumu III Bileşik Gerilme (Test Durumu)",
    required: combinedCase3, provided: allow.case3, unit: "kg/cm²", op: ">=",
    computedSide: "required",
    pass: allow.case3 >= combinedCase3,
    standard: "FEM 1.001 T.3.2.1.1",
    kind: "standart", severity: "engelleyici",
  });

  // --- 7.5 Yorulma kontrolü (DIN 15018) -------------------------------------
  // Yorulma girdileri ELLE GİRİLMEZ: hepsi 7.4 gerilme analizinden gelir.
  //  σx : açıklık ortası alt lif normal gerilmesi (maks = Durum I, min = yalnız öz ağırlık)
  //  σy : gövde sacındaki yerel enine gerilme = teker basıncı σz
  //       (basınç olduğundan genlik hesabı MUTLAK değerlerle yapılır; κ oranı korunur)
  //  τ  : gerçek kayma gerilmesi (maks = kritik gövde sacı, min = yalnız öz ağırlık)
  const loadGroup = girderLoadGroup(specs, sel);
  const fatigueTensileNmm2 =
    inp.fatigueTensileOverrideNmm2 ?? FATIGUE_TENSILE_NMM2[sel.fatigueMaterial];

  const fatigueSigmaXMax = sigmaXBottomCase1 / KG_CM2_TO_NMM2;
  const fatigueSigmaXMin = sigmaXSelfWeightBottom / KG_CM2_TO_NMM2;
  const fatigueSigmaYMax =
    inp.sigmaYMaxOverrideNmm2 ?? Math.abs(sigmaZCase1) / KG_CM2_TO_NMM2;
  const fatigueSigmaYMin =
    inp.sigmaYMinOverrideNmm2 ?? Math.abs(sigmaZTrolley) / KG_CM2_TO_NMM2;
  const fatigueTauMax =
    Math.max(Math.abs(shearMainCase1), Math.abs(shearSecondaryCase1)) / KG_CM2_TO_NMM2;
  const fatigueTauMin = Math.abs(shearMainSelfWeight) / KG_CM2_TO_NMM2;

  const allowableD1 = t17(sel.fatigueMaterial, sel.fatigueNotchClass, loadGroup);
  const allowableDz0 = (allowableD1 * 5) / 3;
  // DIN 15018 Tablo 18 — κ (gerilme oranı) düzeltmesi
  const kappaCorrect = (dz0: number, kappa: number) =>
    dz0 / (1 - (1 - dz0 / fatigueTensileNmm2 / 0.75) * kappa);
  const kappaX = fatigueSigmaXMin / fatigueSigmaXMax;
  const allowableSigmaX = kappaCorrect(allowableDz0, kappaX);
  const kappaY = fatigueSigmaYMin / fatigueSigmaYMax;
  const allowableSigmaY = kappaCorrect(allowableDz0, kappaY);
  // Kayma için çentik durumu daima W0 kabul edilir (DIN 15018 7.4.3); izin
  // verilen kayma, aynı κ düzeltmesinden geçmiş normal gerilme / √3'tür.
  const allowableTauW0 = t17(sel.fatigueMaterial, "W0", loadGroup);
  const allowableTauDz0 = (allowableTauW0 * 5) / 3;
  const kappaTau = fatigueTauMin / fatigueTauMax;
  const allowableTau = kappaCorrect(allowableTauDz0, kappaTau) / Math.sqrt(3);
  const fatigueCombined =
    (fatigueSigmaXMax / allowableSigmaX) ** 2 +
    (fatigueSigmaYMax / allowableSigmaY) ** 2 -
    (fatigueSigmaXMax * fatigueSigmaYMax) / (allowableSigmaY * allowableSigmaX) +
    (fatigueTauMax / allowableTau) ** 2;

  Object.assign(cells, {
    "fatigue.loadGroup": loadGroup,
    "fatigue.tensileStrength": fatigueTensileNmm2,
    "fatigue.sigmaXMax": fatigueSigmaXMax,
    "fatigue.sigmaXMin": fatigueSigmaXMin,
    "fatigue.sigmaYMax": fatigueSigmaYMax,
    "fatigue.sigmaYMin": fatigueSigmaYMin,
    "fatigue.tauMax": fatigueTauMax,
    "fatigue.tauMin": fatigueTauMin,
    "fatigue.allowableD1": allowableD1,
    "fatigue.allowableDz0": allowableDz0,
    "fatigue.kappaX": kappaX,
    "fatigue.allowableSigmaX": allowableSigmaX,
    "fatigue.kappaY": kappaY,
    "fatigue.allowableSigmaY": allowableSigmaY,
    "fatigue.allowableTauW0": allowableTauW0,
    "fatigue.allowableTauDz0": allowableTauDz0,
    "fatigue.kappaTau": kappaTau,
    "fatigue.allowableTau": allowableTau,
    "fatigue.combined": fatigueCombined,
    "fatigue.combinedLimit": FATIGUE_COMBINED_LIMIT,
  });
  checks.push({
    id: `${which}.fatigue.sigmaX`,
    label: "Yorulma σx,maks ≤ zul σDz(κ)",
    required: fatigueSigmaXMax, provided: allowableSigmaX, unit: "N/mm²", op: ">=",
    computedSide: "required",
    pass: fatigueSigmaXMax <= allowableSigmaX,
    standard: "DIN 15018 T.17/18",
    kind: "standart", severity: "engelleyici",
  });
  checks.push({
    id: `${which}.fatigue.sigmaY`,
    label: "Yorulma σy,maks ≤ zul σDz(κ)",
    required: fatigueSigmaYMax, provided: allowableSigmaY, unit: "N/mm²", op: ">=",
    computedSide: "required",
    pass: fatigueSigmaYMax <= allowableSigmaY,
    standard: "DIN 15018 T.17/18",
    kind: "standart", severity: "engelleyici",
  });
  checks.push({
    id: `${which}.fatigue.tau`,
    label: "Yorulma τ,maks ≤ zul τD(κ)",
    required: fatigueTauMax, provided: allowableTau, unit: "N/mm²", op: ">=",
    computedSide: "required",
    pass: fatigueTauMax <= allowableTau,
    standard: "DIN 15018 T.17",
    kind: "standart", severity: "engelleyici",
  });
  checks.push({
    id: `${which}.fatigue.combined`,
    label: "Bileşik Yorulma Oranı",
    required: fatigueCombined, provided: FATIGUE_COMBINED_LIMIT, unit: "-", op: ">=",
    computedSide: "required",
    pass: fatigueCombined <= FATIGUE_COMBINED_LIMIT,
    standard: "DIN 15018 7.4.5",
    kind: "standart", severity: "engelleyici",
  });

  // --- 7.6 Sehim kontrolü ---------------------------------------------------
  const deflectionWheelLoadKg = trolleyWheelLoadKg + hoistWheelLoadKg;
  const deflectionSpanCm = spanMm / 10;
  const deflectionLoadOffsetCm = (deflectionSpanCm - axleSpacingMm / 10) / 2;
  // İki simetrik tekil yük altında açıklık ortası sehimi — hesap cm cinsinden
  // yapılır, SUNULAN değer mm'dir (vinç pratiğinde sehim mm ile konuşulur).
  const deflectionCm =
    -1 *
    ((deflectionWheelLoadKg *
      deflectionLoadOffsetCm *
      (4 * deflectionLoadOffsetCm ** 2 - 3 * deflectionSpanCm ** 2)) /
      24 /
      GIRDER_ELASTIC_MODULUS_KG_CM2 /
      inertiaYCm4);
  const deflectionMm = deflectionCm * 10;
  // Oran birimsizdir: açıklık da mm'ye çevrilir (spanMm / δ[mm])
  const deflectionRatio = spanMm / deflectionMm;
  // FEM 1.001 A-2.2.3, taşıyıcı yapının çoğu durumda basit bir salınım
  // sistemi olarak ön modellenebileceğini belirtir; sayısal rezonans bandı
  // vermez. Buradaki f1 = (1/2π)√(g/δ) Rayleigh/SDOF ÖN TAHMİNİDİR.
  const naturalPeriodS = 2 * Math.PI * Math.sqrt(
    Math.max(deflectionMm, 1e-9) / 1000 / GRAVITY
  );
  const naturalFrequencyHz = 1 / naturalPeriodS;
  const hoistExcitationFrequencyHz = Math.max(0, deps.hoistDrumRpm) / 60;
  const frequencySeparationPct = hoistExcitationFrequencyHz > 0
    ? Math.abs(naturalFrequencyHz - hoistExcitationFrequencyHz) /
      Math.max(naturalFrequencyHz, hoistExcitationFrequencyHz) * 100
    : 100;

  // --- Ters sehim (kamber) — CMAA 70 md. 3.5.5.2 --------------------------
  //
  // ÖLÜ YÜK = kesit sacları + perdeler + ray + ilave sabit yük.
  // (Gerilme hesabındaki bridgeDeadWeightKg başkirişleri de içerdiği için
  // kamberde kullanılmaz — bkz. GirderInputs.camberExtraDeadLoadKgPerM.)
  //
  // Perde sacı: kutuyu oluşturan sacların EN İNCESİ kadar kalınlıktadır;
  // ölçüsü kutunun iç genişliği (gövde sacları arası a) × iç yüksekliği (h3)
  // kadardır. Ray altı sacı t1 ve ek flanş t6 kutunun dışında kaldığı için
  // en ince sac aranırken hesaba katılmaz.
  const diaphragmThicknessMm = Math.min(t2, t3, t4, t5);
  // Hacim mm³ → dm³ : 1 dm = 100 mm olduğundan bölen 100³ = 1.000.000'dur.
  const diaphragmMassKg =
    ((webGapMm * h3 * diaphragmThicknessMm) / 1_000_000) * STEEL_DENSITY_KG_DM3;
  // Perdeler kamber kotlarının verildiği eksenlerde durur — adet oradan okunur,
  // böylece perde sayısı ile kot listesi asla ayrışmaz.
  const diaphragmCount = camberStationGrid(spanMm, inp.diaphragmSpacingMm).xs.length;
  // Ayrık perdeler yayılı yüke çevrilir: açıklık boyunca düzgün dağıldıkları
  // için sehimdeki fark ihmal edilebilir (%1 mertebesinde).
  const diaphragmKgPerM = spanMm > 0 ? (diaphragmCount * diaphragmMassKg) / (spanMm / 1000) : 0;
  const railKgPerM = railMassKgPerM(deps.trolleyRailCode, STEEL_DENSITY_KG_CM3) ?? 0;

  const camberDeadLoadKgPerM =
    weightPerM + diaphragmKgPerM + railKgPerM + (inp.camberExtraDeadLoadKgPerM || 0);
  const girderTotalWeightKg = camberDeadLoadKgPerM * (spanMm / 1000);
  const camber = camberProfile(
    {
      spanCm: deflectionSpanCm,
      deadLoadPerCm: camberDeadLoadKgPerM / 100, // kg/m → kg/cm
      wheelLoadKg: deflectionWheelLoadKg,
      wheelSpacingCm: axleSpacingMm / 10,
      elasticModulus: GIRDER_ELASTIC_MODULUS_KG_CM2,
      inertiaCm4: inertiaYCm4,
    },
    inp.diaphragmSpacingMm
  );
  const deadDeflectionMm = camber.mid.deadMm;
  const camberCuttingMm = camber.mid.cuttingMm;
  const camberSupportedMm = camber.mid.supportedMm;

  Object.assign(cells, {
    "deflection.wheelLoad": deflectionWheelLoadKg,
    "deflection.span": deflectionSpanCm,
    "deflection.spanMm": spanMm,
    "deflection.loadOffset": deflectionLoadOffsetCm,
    "deflection.value": deflectionMm,
    "deflection.ratio": deflectionRatio,
    "dynamics.naturalPeriod": naturalPeriodS,
    "dynamics.naturalFrequency": naturalFrequencyHz,
    "dynamics.hoistExcitationFrequency": hoistExcitationFrequencyHz,
    "dynamics.frequencySeparation": frequencySeparationPct,
    "camber.deadLoadPerM": camberDeadLoadKgPerM,
    "camber.deadValue": deadDeflectionMm,
    "camber.cutting": camberCuttingMm,
    "camber.supported": camberSupportedMm,
    "camber.stationSpacing": camber.spacingUsedMm,
    "camber.stationCount": camber.stations.length,
    "camber.diaphragmThickness": diaphragmThicknessMm,
    "camber.diaphragmMass": diaphragmMassKg,
    "camber.diaphragmCount": diaphragmCount,
    "camber.diaphragmPerM": diaphragmKgPerM,
    "camber.railPerM": railKgPerM,
    "camber.girderTotalWeight": girderTotalWeightKg,
  });
  checks.push({
    id: `${which}.deflection`,
    label: "Sehim Oranı (L/δ)",
    required: inp.deflectionLimitRatio, provided: deflectionRatio, unit: "-", op: ">=",
    computedSide: "provided",
    pass: deflectionRatio >= inp.deflectionLimitRatio,
    standard: "CMAA 70 3.5.5.1",
    // Sınır oranı mühendisin seçtiği bir kullanılabilirlik hedefidir; aşılması
    // taşıma güvenliğini değil kullanım konforunu/kepçe konumlamasını etkiler.
    kind: "firma", severity: "uyari",
  });
  checks.push({
    id: `${which}.dynamics.frequencySeparation`,
    label: "Basit Rezonans Ön Taraması (Frekans Ayrımı)",
    required: 20,
    provided: frequencySeparationPct,
    unit: "%",
    op: ">=",
    computedSide: "provided",
    pass: frequencySeparationPct >= 20,
    standard: "FEM 1.001 A-2.2.3 model yaklaşımı · ORION ±20% ön tarama",
    kind: "firma",
    severity: "uyari",
  });
  // 7.7 Ters sehim bölümüne KONTROL EKLENMEZ: kamber bir uygunluk ölçütü değil
  // imalat ölçüsüdür. "Kamber > 0" gibi bir kontrol aşağı yönlü yükler altında
  // matematiksel olarak asla başarısız olamaz; rapora yalnız gürültü katardı.
  // Doğrulama atölyede yapılır: kiriş sehpaya alınıp MESNETTE kotu ölçülür.

  const values: GirderValues = {
    heightMm,
    areaCm2,
    weightPerM,
    czMm: centroidZMm,
    iyyCm4: inertiaYCm4,
    wyyBottomCm3: modulusYBottomCm3,
    wyyTopCm3: modulusYTopCm3,
    cyMm: centroidYMm,
    railCenterYMm,
    izzCm4: inertiaZCm4,
    wzzBottomCm3: modulusZBottomCm3,
    wzzTopCm3: modulusZTopCm3,
    torsionIxxCm4: inertiaTorsionCm4,
    approxGirderWeightKg,
    spanToDepthRatio,
    spanToWidthRatio,
    bridgeWeightKg: bridgeDeadWeightKg,
    trolleyWeightKg,
    liveLoadKg: hoistLoadKg,
    totalLiveLoadKg,
    dynamicFactor,
    trolleyAccelMs2,
    bridgeAccelMs2,
    psiHA,
    psiHK,
    trolleyHorizontalLoadKg: trolleyHorizontalKg,
    trolleySkewLoadKg: trolleySkewKg,
    bridgeHorizontalLoadKg: bridgeHorizontalKg,
    bridgeSkewLoadKg: bridgeSkewKg,
    amplifyFactor,
    loadGroup,
    sigmaXBottomCase1,
    sigmaXTopCase1,
    sigmaZCase1,
    shearMainCase1,
    shearSecondaryCase1,
    sigmaCombBottomCase1: combinedBottomCase1,
    sigmaCombTopCase1: combinedTopCase1,
    ycSigmaCombBottom: amplifiedCombinedBottom,
    ycSigmaCombTop: amplifiedCombinedTop,
    testFactorK: testFactor,
    sigmaCombCase3: combinedCase3,
    allowableCase1: allow.case1,
    allowableCase3: allow.case3,
    fatigueSigmaXMax,
    fatigueSigmaXMin,
    fatigueSigmaYMax,
    fatigueSigmaYMin,
    fatigueTauMax,
    fatigueTauMin,
    fatigueTensileNmm2,
    zulSigmaD1: allowableD1,
    zulSigmaDz0: allowableDz0,
    kappaX,
    zulSigmaDzX: allowableSigmaX,
    kappaY,
    zulSigmaDzY: allowableSigmaY,
    kappaTau,
    zulTauW0: allowableTauW0,
    zulTauDX: allowableTau,
    fatigueCombined,
    deflectionMm,
    deflectionRatio,
    naturalPeriodS,
    naturalFrequencyHz,
    hoistExcitationFrequencyHz,
    frequencySeparationPct,
    deadDeflectionMm,
    camberCuttingMm,
    camberSupportedMm,
    camberDeadLoadKgPerM,
    diaphragmThicknessMm,
    diaphragmMassKg,
    diaphragmCount,
    diaphragmKgPerM,
    railKgPerM,
    girderTotalWeightKg,
  };

  return { values, checks, cells };
}
