// Yürütme grubu hesabı — araba ve köprü yürütme mekanizmalarının tek
// parametrik modülü. Hesap yöntemi FEM 1.001 (tekerlek basıncı, rulman ömrü),
// CMAA 70 (yürütme gücü, mil emniyet gerilmeleri) ve ilgili katalog
// kriterlerine dayanır.
//
// Sonuçlar `cells` haritasında SEMANTİK ANAHTARLARLA (`<blok>.<büyüklük>`)
// yer alır; sunum katmanı ve raporlar bu anahtarlarla okur.
//
// Varyant farkları (mühendislik gerekçeleriyle):
//   · Köprüde tekerlek yükleri arabanın yanaşma eksantrikliğiyle hesaplanır;
//     arabada yük dört tekere eşit paylaştırılır.
//   · Yürütme freni yalnız köprü mekanizmasında hesaplanır.
//   · Köprü tamponunda çarpma hızı olarak nominal hızın %70'i alınır
//     (köprü kütlesi büyük olduğundan tam hızda çarpışma kabul edilmez).
//   · Çevrim oranı sapma bandı arabada +10/−5 %, köprüde +5/−10 %'dir:
//     köprüde hız fazlalığı raylı sistemde daha kritik olduğundan üst sınır
//     dardır.
//
// Birimler: t, kg, mm, cm, cm³, kg/cm², N/mm², kN, Nm, kNm, kW, kJ,
// m/dak, d/dak, saat.

import { solveBeam } from "../beam";
import {
  BUFFER_CATALOG_TYPE,
  computeBuffer,
  FEM_IMPACT_SPEED_RATIO,
  selectMeteringPin,
  TROLLEY_IMPACT_SPEED_RATIO,
  type BufferType,
  type CurvePoint,
  type MeteringPin,
} from "../buffer";
import { cellularSpeedCurvesForModel } from "../cellularBufferSpeedCurves";
import { mechanismLife, shaftMaterialAllowables } from "../coefficients";
import { shaftStress } from "../shaftStress";
import { c1Factor, RAILS } from "../tables";
import type {
  AnyCheck,
  MechanismClass,
  ModuleResult,
  TechnicalSpecs,
  UsageClass,
} from "../types";

/**
 * Yürütme grubu varyantı. Ana araba, yardımcı araba ve monoray arabaları aynı
 * araba fiziğini kullanır; köprü ayrı dallanır.
 */
/**
 * İki durumlu yürütme girdilerinin "evet" değeri. Kayıtta düz METİN durur
 * (açılır liste seçeneği); motor bu sabitle karşılaştırır — böylece değer tek
 * bir yerde tanımlıdır ve sunum katmanı ile motor ayrışamaz.
 */
export const TRAVEL_YES = "Evet";
export const TRAVEL_NO = "Hayır";

export type TravelWhich =
  | "trolley"
  | "auxTrolley"
  | "mono1Trolley"
  | "mono2Trolley"
  | "bridge";

/** Modüller arası bağımlılıklar — modül saf kalsın diye parametre olarak alınır */
export interface TravelDeps {
  /** Kanca bloğu + halat ağırlığı [t] (ilgili kaldırma grubundan gelir) */
  hookEquipmentT: number;
  /** Köprünün taşıdığı araba ağırlığı [t] — köprü varyantında kullanılır */
  trolleyWeightT: number;
  /**
   * Köprü yürütme motor hesabındaki hareket eden toplam araba ağırlığı W [t].
   * Her aktif arabanın kendi kapasitesi, kanca/halat donanımı ve araba
   * ağırlığından oluşur. Tanımsızsa eski tek-araba toplamına geri dönülür.
   */
  bridgeMovingTrolleyWeightT?: number;
}

/** Kullanıcı girdileri (tasarım kabulleri) */
export interface TravelInputs {
  minApproachM: number;         // minimum araba yanaşması [m] (sadece köprü)
  wheelCount: number;           // tekerlek adedi
  /**
   * Bir motorun tahrik ettiği teker sayısı. Yürütmede genellikle her motor tek
   * tekeri döndürür; arabalarda tek motor bir mil üzerinden İKİ tekeri birden
   * tahrik edebilir. Tahrikli teker sayısı = motor adedi × bu değerdir ve ana
   * kiriş yatay yük hesabına (sürtünmeyle aktarılabilen çekme kuvveti) girer.
   */
  wheelsPerMotor: number;
  shaftSpanAMm: number;         // teker mili mesnet ölçüsü a [mm]
  shaftSpanBMm: number;         // teker mili ölçüsü b [mm] (gösterim)
  shaftDiaMm: number;           // teker mili çapı [mm]
  /**
   * Teker bandaj (tread) genişliği [mm].
   *
   * Teker yükü mile bir ÇİZGİ üzerinden değil, göbeğin oturduğu BANT boyunca
   * aktarılır; bu yüzden kiriş çözümünde tekil kuvvet değil düzgün yayılı yük
   * (q = P / b_teker) kullanılır. Bant açıklığın ORTASINDA merkezlenir.
   *
   * GERİYE DÖNÜK UYUM: alan tanımsız ya da 0 ise TEKİL yüke geri dönülür —
   * bu alanın eklenmesinden önceki revizyonların sayıları değişmez.
   */
  wheelWidthMm?: number;
  stressConcFactor: number;     // gerilme yığılması katsayısı
  bearingCount: number;         // teker başına rulman adedi
  bearingFactorY0: number;      // eşdeğer statik yük katsayısı Y0
  bearingFactorY1: number;      // eşdeğer dinamik yük katsayısı Y1
  /**
   * CMAA 70 servis (uygulama) sınıfı A…F — gösterim büyüklüğüdür, hesaba
   * girmez. FEM mekanizma sınıfından otomatik türetilir
   * (`travelApplicationClass`, firma tasarım kabulü); anahtar kapatılınca
   * mühendis listeden kendisi seçer.
   */
  applicationClass: string;
  /** Uygulama sınıfı otomatik: FEM mekanizma sınıfından türetilir. */
  travelApplicationClassAuto?: boolean;
  serviceFactorKs: number;      // Ks servis faktörü (CMAA 70)
  accelTorqueFactorKt: number;  // Kt ivmelenme tork faktörü (CMAA 70)
  /**
   * Tahrik / kumanda tipi — CMAA 70 T.5.2.9.1.2.1-E'nin SÜTUNU.
   * Ks yalnız servis sınıfından seçilemez; kumanda tipi de gerekir.
   */
  driveControl?: string;
  /** Ks otomatik: CMAA 70 T.5.2.9.1.2.1-E (sınıf × kumanda tipi). */
  serviceFactorKsAuto?: boolean;
  /**
   * Motor / kumanda tipi — CMAA 70 T.5.2.9.1.2.1-C'nin SATIRI.
   * Kt servis sınıfına bağlı DEĞİLDİR; yalnız motor ve kumanda tipine bağlıdır.
   */
  motorControl?: string;
  /** Kt otomatik: CMAA 70 T.5.2.9.1.2.1-C. */
  accelTorqueFactorKtAuto?: boolean;
  reducerStages: number;        // redüktör kademe sayısı
  accelerationMs2: number;      // ivme a [m/s²]
  tempFactor: number;           // ortam sıcaklığı düzeltme faktörü
  /** Sıcaklık faktörü otomatik: ortam sıcaklığı üst sınırından türetilir. */
  tempFactorAuto?: boolean;
  motorCalcCount: number;       // gücün bölüşüldüğü motor adedi
  gearboxServiceFactor: number; // redüktör emniyet (servis) katsayısı
  brakeServiceFactor: number;   // fren emniyet katsayısı (sadece köprü)
  motorCouplingServiceFactor: number; // motor kaplini emniyet katsayısı
  wheelCouplingServiceFactor: number; // teker kaplini emniyet katsayısı
  bufferApproachM: number;      // tampon hesabında araba yanaşması [m] (sadece köprü)
  /**
   * Çarpışmada AYNI ANDA temas eden tampon adedi. Araba iki kirişin ucundaki
   * iki durdurucuya, köprü de iki rayın ucundaki iki durdurucuya çarpar →
   * varsayılan 2. Çarpışan kütle bu adede paylaştırılır.
   */
  bufferCount?: number;
  /**
   * Yük RİJİT KILAVUZLU mu ("Evet" / "Hayır")? FEM 1.001 md. 2.2.3.4.1 /
   * CMAA 70 md. 3.3.2.1.3.2: yük salınabiliyorsa çarpışan kütleye GİRMEZ;
   * rijit kılavuzluysa kapasite + kanca donanımı da kütleye eklenir.
   * Varsayılan: salınabilir ("Hayır").
   */
  bufferLoadRigidlyGuided?: string;
  /**
   * Yürüyüş sınırına normal işletmede SIK ulaşılıyor mu ("Evet" / "Hayır")?
   * FEM 1.001 md. 7.7.1.2 bu durumda azami yavaşlamayı 5 m/s² yerine
   * 2,5 m/s² ile sınırlar.
   */
  bufferFrequentEndApproach?: string;
}

/** Katalog seçimleri — mühendisin seçtiği bileşenler */
export interface TravelSelections {
  railCode: string;             // ray tipi (ray tablosu anahtarı)
  wheelMaterial: string;
  wheelTensileNmm2: number;     // teker malzemesi çekme dayanımı [N/mm²]
  wheelDiaMm: number;           // tekerlek çapı [mm]
  shaftMaterial: string;        // teker mili malzemesi
  bearingType: string;
  bearingCode: string;
  bearingDynCKn: number;        // dinamik yük sayısı C [kN]
  bearingStatC0Kn: number;      // statik yük sayısı C0 [kN]
  motorBrand: string;
  motorPowerKw: number;
  motorRpm: number;
  motorCount: number;
  motorShaftMm: number;
  gearboxModel: string;
  gearboxRatio: number;
  gearboxOutputTorqueKnm: number;
  gearboxInputShaftText: string;
  gearboxOutputShaftMm: number;
  brakeBrand: string;           // yürütme freni (sadece köprü)
  brakeTorqueNm: number;
  brakeWheelDiaMm: number;
  /** Arabada kapline bağlanan motor mili ayrı girilir; köprüde motor mili çapı
   *  doğrudan kullanılır. */
  couplingMotorShaftMm: number;
  motorCouplingBrand: string;
  motorCouplingModel: string;
  motorCouplingTorqueNm: number;
  motorCouplingDmaxMm: number;
  wheelShaftDiaMm: number;      // kapline bağlanan teker mili çapı [mm]
  wheelCouplingBrand: string;
  wheelCouplingModel: string;
  wheelCouplingTorqueNm: number;
  wheelCouplingDmaxMm: number;
  bufferModel: string;
  /**
   * Katalogdaki fiziksel tampon türü. Teknik özelliklerdeki "Kauçuk" ailesi
   * altında kauçuk ve hücresel poliüretan ürünler ayrı ayrı seçilebilir.
   */
  bufferCatalogType?: string;
  /**
   * HİDROLİKTE tam strok s [mm]; KAUÇUKTA tamponun GÖVDE YÜKSEKLİĞİ h [mm]
   * (sıkışma yolu f′ = sıkışma% · h / 100 olarak eğriden çıkar).
   */
  bufferStrokeMm: number;
  bufferEnergyKj: number;
  bufferLoadKn: number;
  /** Hidrolik: SIBRE kısma iğnesi (metering pin) sipariş kodu */
  bufferMeteringPinCode?: string;
  /** Hidrolik: katalog satırının strokla uyumlu kısma iğnesi tablosu. */
  bufferMeteringPins?: MeteringPin[];
  /** Hidrolik: seçilen strokta iğne tablosundaki tasarım kütlesi tavanı [t] */
  bufferDesignMassMaxT?: number;
  /** Kauçuk/hücresel: katalogun izin verdiği azami sıkışma [%] (kauçuk 50) */
  bufferMaxCompressionPct?: number;
  /**
   * Kauçuk: enerji–sıkışma eğrisi [[sıkışma %, enerji J], …].
   * Kaynak `catalog_data/buffers/conductix_curves.json`; kauçuk yay
   * karakteristiği doğrusal olmadığı için kapalı formül KULLANILMAZ.
   */
  bufferEnergyCurve?: CurvePoint[];
  /** Kauçuk: kuvvet–sıkışma eğrisi [[sıkışma %, kuvvet kN], …] */
  bufferForceCurve?: CurvePoint[];
}

export interface TravelValues {
  // Tahrik
  /** Motor adedi × motor başına teker; ana kiriş yatay yük hesabına girer */
  drivenWheels: number;
  // Ağırlıklar / tekerlekler
  craneWeightT: number | null;  // toplam vinç ağırlığı (sadece köprü)
  maxWheelLoadKg: number;
  minWheelLoadKg: number;
  avgWheelLoadKg: number;
  railHeadWidthMm: number;
  wheelRpm: number;
  c1: number;
  c2: number;
  limitPressure: number | string;
  actualPressure: number;
  allowedPressure: number;
  // Teker mili
  reactionAKg: number;
  reactionBKg: number;
  maxMomentKgCm: number;
  /** Teker yükünün yayıldığı bant boyu [cm] — 0 ise tekil yük modeli */
  shaftLoadBandCm: number;
  /** Yayılı yük şiddeti q = Pmaks / b_teker [kg/cm] — tekil yükte 0 */
  shaftLoadIntensityKgPerCm: number;
  sectionModulusCm3: number;
  shaftBendingStress: number;
  shaftShearStress: number;
  shaftCombinedStress: number;
  shaftAllowables: { bending: number; shear: number; combined: number };
  // Rulman
  bearingRadialKn: number;
  bearingAxialKn: number;
  bearingEqStaticKn: number;
  bearingEqDynamicKn: number;
  bearingStaticSafety: number;
  bearingLifeHours: number;
  requiredLifeMin: number;
  requiredLifeMax: number | null;
  // Motor
  totalWeightKg: number;
  /** CMAA bağıntısında kullanılan hareket eden toplam ağırlık W [ton] */
  designWeightTons: number;
  actualSpeedMpm: number;
  startupTimeS: number;
  frictionFactor: number;
  reducerEfficiency: number;
  rotationInertiaFactor: number;
  accelFactorKa: number;
  requiredPowerKw: number;
  requiredMaxPowerKw: number;
  requiredPowerPerMotorKw: number;
  installedPowerKw: number;
  // Redüktör
  requiredRatio: number;
  ratioDeviationPct: number;
  requiredInputTorqueNm: number;
  nominalOutputTorqueNm: number;
  requiredMinOutputTorqueNm: number;
  gearboxActualSafety: number;
  // Fren (sadece köprü)
  requiredBrakeTorqueNm: number | null;
  // Kaplinler
  requiredMotorCouplingTorqueNm: number;
  motorCouplingShaftMm: number;
  motorCouplingSafety: number;
  requiredWheelCouplingTorqueNm: number;
  wheelCouplingSafety: number;
  // Tampon
  bufferType: BufferType;
  /** Tampon başına çarpışan kütle [t] */
  collisionLoadT: number;
  /** Çarpma hızı oranı k (v_ç = v/60 · k) */
  bufferImpactSpeedRatio: number;
  /** Çarpma hızı [m/s] */
  bufferImpactSpeedMps: number;
  impactEnergyKj: number;
  driveLoadPerMotorN: number;
  totalDriveLoadN: number;
  bufferDriveLoadN: number;
  /** Hesapta kullanılan sıkışma yolu f′ [mm] */
  bufferStrokeUsedMm: number;
  bufferDriveEnergyKj: number;
  totalEnergyKj: number;
  bufferForceKn: number;
  /** Kauçukta gerçekleşen sıkışma [%] */
  bufferCompressionPct: number;
  bufferAvgDecelerationMps2: number;
  bufferMaxDecelerationMps2: number;
  /** Çarpma hızındaki hücresel katalog enerji sınırı [kJ] */
  bufferCatalogEnergyAtImpactKj: number;
  /** Çarpma hızındaki hücresel katalog son kuvveti [kN] */
  bufferCatalogForceAtImpactKn: number;
  /** Hücresel hız eğrisinin enterpole edildiği çarpma hızı [m/s] */
  bufferCatalogCurveSpeedMps?: number;
  /** SIBRE SP için hesaplanan kütle sınıfından otomatik seçilen iğne kodu. */
  bufferMeteringPinCode: string;
  /** Otomatik iğne sınıfının katalogdaki tasarım kütlesi üst sınırı [t]. */
  bufferDesignMassMaxT: number;
  /** Tampon tepkisi yapıya aktarılıyor mu (FEM Kitapçık 9 md. 9.4.2) */
  bufferTransferredToStructure: boolean;
  /** Tampon hesabı koştu mu (tip "yok" ya da eğri verisi eksikse false) */
  bufferComputed: boolean;
}

/**
 * Mekanizma katsayısı c2 — FEM 1.001 T.4.2.4.1.5.
 * Yürütme mekanizmasının KENDİ grup sınıfı ile okunur.
 */
function mechanismFactorC2(mech: MechanismClass): number {
  if (mech === "M1" || mech === "M2" || mech === "M3" || mech === "M4") return 1.12;
  if (mech === "M5") return 1;
  if (mech === "M6") return 0.9;
  return 0.8; // M7 / M8
}

/** Limit yüzey basıncı PL [N/mm²] — FEM 1.001 T.4.2.4.1.3 */
function wheelLimitPressure(tensileNmm2: number): number | string {
  if (tensileNmm2 >= 500 && tensileNmm2 < 600) return 5;
  if (tensileNmm2 >= 600 && tensileNmm2 < 700) return 5.6;
  if (tensileNmm2 >= 700 && tensileNmm2 < 800) return 6.5;
  if (tensileNmm2 >= 800 && tensileNmm2 < 900) return 7.2;
  if (tensileNmm2 >= 900 && tensileNmm2 < 1000) return 7.8;
  if (tensileNmm2 >= 1000) return 8.5;
  // Tablo 500 N/mm² altını kapsamaz: bu dayanımdaki bir teker malzemesi
  // ray temas basıncı için uygun değildir.
  return "Tanımsız (çekme dayanımı < 500 N/mm²)";
}

/**
 * Yuvarlanma sürtünme katsayısı f [lb/ton] — CMAA 70 T.5.2.9.1.2.1-D.
 *
 * Tablo çap kademeleriyle verilir; burada kademe SINIRLARI kullanılır, böylece
 * tabloda birebir yer almayan (ör. 1000 mm ve üzeri) standart teker çapları da
 * tanımlı kalır. Tabloda yer alan çaplarda değer birebir aynıdır.
 */
function travelFrictionFactor(wheelDiaMm: number): number {
  if (wheelDiaMm <= 200) return 16;
  if (wheelDiaMm <= 500) return 15;
  return 12;
}

/**
 * Bir yürütme grubunun teknik özelliklerden okunan büyüklükleri.
 *
 * Ağırlıklar artık modül girdisi değil vincin teknik özelliğidir: ana araba,
 * yardımcı araba ve köprü ağırlıkları tek yerde girilir, tüm yürütme grupları
 * buradan okur. Grup için değer tanımlı değilse ana grubun değeri kullanılır.
 */
export interface TravelSpecView {
  speedMpm: number;
  mechanismClass: MechanismClass;
  usageClass: UsageClass;
  /** Bu grubun kaldırdığı yük [t] */
  capacityT: number;
  /** Bu grubun kendi ağırlığı [t] (köprüde köprünün taşıdığı araba ağırlığı) */
  trolleyWeightT: number;
  /** Bu grubun tampon tipi (teknik özelliklerden) */
  bufferType: BufferType;
  /** Bu grubun çarpma hızı oranı k (teknik özelliklerden) */
  bufferImpactSpeedRatio: number;
}

const posOr = (v: number | undefined, fallback: number): number =>
  typeof v === "number" && Number.isFinite(v) && v > 0 ? v : fallback;

/** Geçerli bir tampon tipi mi (eski revizyonlarda alan hiç bulunmaz). */
function bufferTypeOr(v: BufferType | undefined, fallback: BufferType): BufferType {
  // Eski revizyonlardaki hücresel üst seçimi yeni arayüzdeki Kauçuk/Elastomer
  // ailesine taşınır. Fiziksel alt tür, katalog seçimindeki `bufferCatalogType`
  // alanından belirlenir.
  if (v === "hucresel") return "kaucuk";
  return v === "hidrolik" || v === "kaucuk" || v === "yok" ? v : fallback;
}

/**
 * Bir yürütme grubunun tampon tipi. Araba varyantlarının tamamı (ana, yardımcı,
 * monoray) tek bir "araba tamponu" seçimini paylaşır; köprünün kendi seçimi
 * vardır. Alan hiç tanımlı değilse (eski revizyonlar) hidrolik kabul edilir —
 * eski hesabın kapalı formülü de sabit verimli hidrolik davranışıydı.
 */
export function travelBufferType(specs: TechnicalSpecs, which: TravelWhich): BufferType {
  return which === "bridge"
    ? bufferTypeOr(specs.bridgeBufferType, "hidrolik")
    : bufferTypeOr(specs.trolleyBufferType, "hidrolik");
}

/** Teknik üst seçime göre katalogda izin verilen fiziksel tampon türleri. */
export function travelBufferCatalogTypes(specs: TechnicalSpecs, which: TravelWhich): string[] {
  const family = travelBufferType(specs, which);
  if (family === "kaucuk") return ["kauçuk", "hücresel"];
  return [BUFFER_CATALOG_TYPE[family]];
}

/**
 * Hesabın kullanacağı fiziksel tür. Teknik özellikteki Kauçuk seçimi yalnız
 * aileyi belirler; katalog satırı kauçuk mu hücresel mi olduğunu söyler.
 */
export function travelBufferCalculationType(
  specs: TechnicalSpecs,
  which: TravelWhich,
  selections: Pick<TravelSelections, "bufferCatalogType"> | undefined
): BufferType {
  const family = travelBufferType(specs, which);
  return family === "kaucuk" && selections?.bufferCatalogType === "hücresel"
    ? "hucresel"
    : family;
}

/**
 * Çarpma hızı oranı k. Teknik özelliklerde yüzde olarak düzenlenir.
 * Varsayılan: araba %100 (muhafazakâr firma kabulü), köprü %70
 * (FEM 1.001 md. 2.2.3.4.1).
 */
export function travelBufferImpactSpeedRatio(
  specs: TechnicalSpecs,
  which: TravelWhich
): number {
  const pct =
    which === "bridge"
      ? specs.bridgeBufferImpactSpeedPct
      : specs.trolleyBufferImpactSpeedPct;
  if (typeof pct === "number" && Number.isFinite(pct) && pct > 0) return pct / 100;
  return which === "bridge" ? FEM_IMPACT_SPEED_RATIO : TROLLEY_IMPACT_SPEED_RATIO;
}

export function travelSpecView(
  specs: TechnicalSpecs,
  which: TravelWhich,
  deps: TravelDeps
): TravelSpecView {
  return {
    ...travelSpecViewCore(specs, which, deps),
    bufferType: travelBufferType(specs, which),
    bufferImpactSpeedRatio: travelBufferImpactSpeedRatio(specs, which),
  };
}

/** Ağırlık/hız/sınıf kısmı — tampon alanları `travelSpecView` içinde eklenir. */
function travelSpecViewCore(
  specs: TechnicalSpecs,
  which: TravelWhich,
  deps: TravelDeps
): Omit<TravelSpecView, "bufferType" | "bufferImpactSpeedRatio"> {
  switch (which) {
    case "auxTrolley":
      return {
        speedMpm: posOr(specs.auxTrolleySpeedMpm, specs.trolleySpeedMpm),
        mechanismClass: specs.auxTrolleyMechanismClass ?? specs.trolleyMechanismClass,
        usageClass: specs.auxTrolleyUsageClass ?? specs.trolleyUsageClass,
        capacityT: specs.auxCapacityT,
        trolleyWeightT: posOr(specs.auxTrolleyWeightT, specs.mainTrolleyWeightT),
      };
    case "mono1Trolley":
      return {
        speedMpm: posOr(specs.mono1TrolleySpeedMpm, specs.trolleySpeedMpm),
        mechanismClass: specs.mono1TrolleyMechanismClass ?? specs.trolleyMechanismClass,
        usageClass: specs.mono1TrolleyUsageClass ?? specs.trolleyUsageClass,
        capacityT: posOr(specs.mono1CapacityT, specs.mainCapacityT),
        trolleyWeightT: posOr(specs.mono1TrolleyWeightT, specs.mainTrolleyWeightT),
      };
    case "mono2Trolley":
      return {
        speedMpm: posOr(specs.mono2TrolleySpeedMpm, specs.trolleySpeedMpm),
        mechanismClass: specs.mono2TrolleyMechanismClass ?? specs.trolleyMechanismClass,
        usageClass: specs.mono2TrolleyUsageClass ?? specs.trolleyUsageClass,
        capacityT: posOr(specs.mono2CapacityT, specs.mainCapacityT),
        trolleyWeightT: posOr(specs.mono2TrolleyWeightT, specs.mainTrolleyWeightT),
      };
    case "bridge":
      return {
        speedMpm: specs.bridgeSpeedMpm,
        mechanismClass: specs.bridgeMechanismClass,
        usageClass: specs.bridgeUsageClass,
        capacityT: specs.mainCapacityT,
        // Köprü tekerlek yükü, açıklık üzerindeki ANA arabanın konumundan çıkar.
        trolleyWeightT: posOr(deps.trolleyWeightT, specs.mainTrolleyWeightT),
      };
    default:
      return {
        speedMpm: specs.trolleySpeedMpm,
        mechanismClass: specs.trolleyMechanismClass,
        usageClass: specs.trolleyUsageClass,
        capacityT: specs.mainCapacityT,
        trolleyWeightT: specs.mainTrolleyWeightT,
      };
  }
}

export function computeTravelGroup(
  specs: TechnicalSpecs,
  which: TravelWhich,
  inp: TravelInputs,
  sel: TravelSelections,
  deps: TravelDeps
): ModuleResult<TravelValues> {
  const cells: Record<string, number | string> = {};
  const checks: AnyCheck[] = [];
  /** Hesaplanan büyüklüğü semantik anahtarıyla yayımlar. */
  const set = (key: string, value: number | string) => {
    cells[key] = value;
  };

  const isTrolley = which !== "bridge";
  const view = travelSpecView(specs, which, deps);
  const bufferType = travelBufferCalculationType(specs, which, sel);
  const speedMpm = view.speedMpm;
  // Yürütme mekanizmasının kendi FEM sınıfları — kaldırma grubununki DEĞİL.
  const mechanismClass: MechanismClass = view.mechanismClass;
  const usageClass: UsageClass = view.usageClass;

  const capacityT = view.capacityT;
  const trolleyWeightT = view.trolleyWeightT;
  const bridgeWeightT = specs.bridgeWeightT;

  // --- Tahrik ---------------------------------------------------------------
  // Tahrikli teker sayısı = motor adedi × motor başına tahrik edilen teker.
  // Tekerlek adedini aşamaz. Ana kirişin yatay yük hesabı bu sayıyı kullanır.
  const drivenWheels = Math.min(
    inp.wheelCount,
    Math.max(1, Math.round(sel.motorCount * Math.max(1, inp.wheelsPerMotor)))
  );
  set("drive.wheelsPerMotor", Math.max(1, inp.wheelsPerMotor));
  set("drive.drivenWheels", drivenWheels);

  // --- Ağırlıklar ----------------------------------------------------------
  let craneWeightT: number | null = null;
  if (!isTrolley) {
    craneWeightT = bridgeWeightT + trolleyWeightT;
    set("weight.crane", craneWeightT);
    set("weight.bridgeTotal", bridgeWeightT);
  }
  set("weight.trolley", trolleyWeightT);

  // --- Tekerlekler ---------------------------------------------------------
  let maxWheelLoad: number; // maksimum tekerlek yükü [kg]
  let minWheelLoad: number; // minimum tekerlek yükü [kg]
  if (isTrolley) {
    // Araba: kapasite + kanca donanımı + araba ağırlığı tüm tekerlere eşit dağılır.
    maxWheelLoad = ((trolleyWeightT + capacityT + deps.hookEquipmentT) / inp.wheelCount) * 1000;
    minWheelLoad = ((trolleyWeightT + deps.hookEquipmentT) / inp.wheelCount) * 1000;
  } else {
    // Köprü: araba yanaşma eksantrikliği — yük, arabanın açıklık üzerindeki
    // konumuna göre iki başkirişe paylaştırılır.
    const span = specs.spanM;
    const halfBridge = bridgeWeightT / 2;
    maxWheelLoad =
      (((capacityT + trolleyWeightT) * ((span - inp.minApproachM) / span) + halfBridge) * 1000) /
      (inp.wheelCount / 2);
    minWheelLoad =
      ((trolleyWeightT * (inp.minApproachM / span) + halfBridge) * 1000) / (inp.wheelCount / 2);
  }
  // Yorulma/basınç hesabında kullanılan eşdeğer ortalama tekerlek yükü.
  const meanWheelLoad = (2 * maxWheelLoad + minWheelLoad) / 3;
  set("wheel.maxLoad", maxWheelLoad);
  set("wheel.minLoad", minWheelLoad);
  set("wheel.meanLoad", meanWheelLoad);

  const railHeadWidth = RAILS[sel.railCode]?.headWidth ?? Number.NaN;
  set("rail.headWidth", railHeadWidth);
  const wheelRpm = speedMpm / (sel.wheelDiaMm / 1000) / Math.PI;
  set("wheel.rpm", wheelRpm);
  const c1 = c1Factor(sel.wheelDiaMm, speedMpm) ?? Number.NaN;
  set("wheel.speedFactor", c1);
  const c2 = mechanismFactorC2(mechanismClass);
  set("wheel.mechanismFactor", c2);
  const limitPressure = wheelLimitPressure(sel.wheelTensileNmm2);
  set("wheel.limitPressure", limitPressure);
  const actualPressure = (meanWheelLoad * 9.81) / railHeadWidth / sel.wheelDiaMm;
  set("wheel.contactPressure", actualPressure);
  const limitPressureNum = typeof limitPressure === "number" ? limitPressure : Number.NaN;
  const allowedPressure = limitPressureNum * c1 * c2;
  set("wheel.allowablePressure", allowedPressure);
  checks.push({
    id: `${which}.wheel.pressure`,
    label: "Tekerlek Yüzey Basıncı (PL·c1·c2)",
    required: actualPressure, provided: allowedPressure, unit: "N/mm²", op: ">=",
    // Gerçekleşen temas basıncı HESAPTAN, sınır ise teker malzemesinin PL tablo
    // değerinin hız (c1) ve mekanizma (c2) katsayılarıyla ölçeklenmesinden çıkar.
    computedSide: "required",
    pass: allowedPressure >= actualPressure,
    standard: "FEM 1.001 4.2.4.1",
    kind: "standart", severity: "engelleyici",
  });

  // --- Teker Mili ----------------------------------------------------------
  // Model: teker mili iki rulman arasında basit kirişdir, tekerlek yükü
  // açıklığın ortasına etkir. Mesnet aralığı 2·a olduğundan mesnet tepkileri
  // her hâlde Pmax/2'dir.
  //
  // TEKER GENİŞLİĞİ: teker göbeği mile bir ÇİZGİ üzerinden basmaz — yük bandaj
  // genişliği kadar bir BANT boyunca yayılır. Bant açıklığın ortasında
  // merkezlenir ve şiddeti q = Pmax / b_teker olur. Yayılı yük momenti tekil
  // yüke göre q·b_t²/8 kadar KÜÇÜLTÜR (moment diyagramının tepesi sivri değil
  // düz olur); mesnet reaksiyonları ve maksimum kesme kuvveti DEĞİŞMEZ.
  //
  // GERİYE DÖNÜK UYUM: teker genişliği girilmemişse (eski revizyonlar) tekil
  // yük modeline geri dönülür ve sayılar birebir korunur.
  const shaftSpanACm = inp.shaftSpanAMm / 10;
  const shaftSupportSpanCm = 2 * shaftSpanACm;
  const wheelWidthCm = Math.max(0, (inp.wheelWidthMm ?? 0) / 10);
  // Bant açıklığı aşamaz; aşarsa tüm açıklığa yayılır.
  const loadBandCm = Number.isFinite(wheelWidthCm)
    ? Math.min(wheelWidthCm, shaftSupportSpanCm)
    : 0;
  const shaftLoadDistributed = loadBandCm > 0 && shaftSupportSpanCm > 0;
  const loadIntensityKgPerCm = shaftLoadDistributed ? maxWheelLoad / loadBandCm : 0;
  const bandFromCm = (shaftSupportSpanCm - loadBandCm) / 2;
  const shaftBeam = solveBeam({
    lengthCm: shaftSupportSpanCm,
    supportACm: 0,
    supportBCm: shaftSupportSpanCm,
    pointLoads: shaftLoadDistributed
      ? []
      : [{ xCm: shaftSpanACm, loadKg: maxWheelLoad, label: "Tekerlek Yükü" }],
    distributedLoads: shaftLoadDistributed
      ? [{
          fromCm: bandFromCm,
          toCm: bandFromCm + loadBandCm,
          intensityKgPerCm: loadIntensityKgPerCm,
          label: "Tekerlek Yükü (yayılı)",
        }]
      : undefined,
  });
  set("shaft.loadBand", loadBandCm);
  set("shaft.loadIntensity", loadIntensityKgPerCm);
  const reactionA = shaftBeam.reactionAKg;
  const reactionB = shaftBeam.reactionBKg;
  const maxMoment = Math.abs(shaftBeam.maxMomentKgCm);
  set("shaft.reactionA", reactionA);
  set("shaft.reactionB", reactionB);
  set("shaft.maxMoment", maxMoment);
  // Kayma dağılımı ORTALAMA kabul edilir (τ = V/A): teker milinde kritik kesit
  // eğilme momentinin en büyük olduğu orta kesittir, kaymanın tepe yaptığı
  // tarafsız eksen ile çakışmaz.
  const shaftSection = shaftStress({
    momentKgCm: maxMoment,
    shearKg: Math.abs(shaftBeam.maxShearKg),
    bendingDiameterCm: inp.shaftDiaMm / 10,
    shearDiameterCm: inp.shaftDiaMm / 10,
    combined: "vonMises",
    shear: "ortalama",
  });
  // Gerilme yığılması katsayısı her iki gerilme bileşenini de ölçekler;
  // bileşke gerilme de aynı katsayıyla ölçeklenir.
  const sectionModulus = shaftSection.sectionModulusCm3;
  const bendingStress = shaftSection.bendingStress * inp.stressConcFactor;
  const shearStress = shaftSection.shearStress * inp.stressConcFactor;
  const combinedStress = shaftSection.combinedStress * inp.stressConcFactor;
  set("shaft.sectionModulus", sectionModulus);
  set("shaft.bendingStress", bendingStress);
  set("shaft.shearStress", shearStress);
  set("shaft.combinedStress", combinedStress);
  // Teker mili malzemesi 42CrMo4 / AISI 4140 ıslah çeliğidir; izin verilen
  // gerilmeler bu malzemenin CMAA 70 4.11.4.1 karşılıklarından alınır.
  const shaftAllow = shaftMaterialAllowables("4140");
  set("shaft.allowableBending", shaftAllow.bending);
  set("shaft.allowableShear", shaftAllow.shear);
  set("shaft.allowableCombined", shaftAllow.combined);
  checks.push({
    id: `${which}.shaft.stress`,
    label: "Teker Mili Bileşik Gerilmesi",
    required: combinedStress, provided: shaftAllow.combined, unit: "kg/cm²", op: ">=",
    computedSide: "required",
    pass: shaftAllow.combined >= combinedStress,
    standard: "CMAA 70 4.11.4.1",
    kind: "standart", severity: "engelleyici",
  });

  // --- Tekerlek Rulmanı ----------------------------------------------------
  const bearingRadial = (meanWheelLoad * 9.81) / 1000 / inp.bearingCount; // [kN]
  set("bearing.radialLoad", bearingRadial);
  // Yanal (kılavuzlama) kuvveti radyal yükün %10'u kabul edilir.
  const bearingAxial = 0.1 * bearingRadial;
  set("bearing.axialLoad", bearingAxial);
  const eqStatic = bearingRadial + bearingAxial * inp.bearingFactorY0;
  set("bearing.equivalentStatic", eqStatic);
  const eqDynamic = bearingRadial + inp.bearingFactorY1 * bearingAxial;
  set("bearing.equivalentDynamic", eqDynamic);
  const staticSafety = sel.bearingStatC0Kn / eqStatic;
  set("bearing.staticSafety", staticSafety);
  // Makaralı rulman ömür üsteli 10/3.
  const lifeHours = (1000000 / (60 * wheelRpm)) * (sel.bearingDynCKn / eqDynamic) ** (10 / 3);
  set("bearing.lifeHours", lifeHours);
  // Gerekli ömür, yürütme mekanizmasının KENDİ kullanım sınıfından okunur.
  const life = mechanismLife(usageClass);
  const requiredLifeMin = life.min ?? 0;
  set("bearing.requiredLifeMin", requiredLifeMin);
  if (life.max !== null) set("bearing.requiredLifeMax", life.max);
  checks.push({
    id: `${which}.bearing.life`,
    label: "Tekerlek Rulmanı Ömrü",
    required: requiredLifeMin, provided: lifeHours, unit: "saat", op: ">=",
    computedSide: "provided",
    pass: lifeHours >= requiredLifeMin,
    standard: "FEM 1.001 T.2.1.3.2",
    kind: "standart", severity: "engelleyici",
  });
  checks.push({
    id: `${which}.bearing.static`,
    label: "Rulman Statik Emniyeti",
    required: 1, provided: staticSafety, unit: "-", op: ">=",
    computedSide: "provided",
    pass: staticSafety >= 1,
    kind: "uretici", severity: "engelleyici",
  });

  // --- Yürütme Motoru (CMAA 70) --------------------------------------------
  const bridgeMovingTrolleyWeightT = deps.bridgeMovingTrolleyWeightT
    ?? capacityT + deps.hookEquipmentT + trolleyWeightT;
  const totalWeightKg = isTrolley
    ? (capacityT + deps.hookEquipmentT + trolleyWeightT) * 1000
    : (bridgeMovingTrolleyWeightT + bridgeWeightT) * 1000;
  set("weight.moving", totalWeightKg);
  // CMAA 70 motor bağıntısı ağırlığı tonla ister. Önceki %10 çarpanı fiziksel
  // bir tasarım payı değildi; kg → ton dönüşümünü yanlış yorumlayan eski kabul
  // kaldırıldı. W, hareket eden toplam kütlenin doğrudan ton karşılığıdır.
  const designWeightTons = totalWeightKg / 1000;
  set("weight.design", designWeightTons);
  // Gerçekleşen yürütme hızı seçilen motor devri ve redüktör oranından çıkar.
  const actualSpeed = (sel.motorRpm / sel.gearboxRatio) * Math.PI * (sel.wheelDiaMm / 1000);
  set("drive.actualSpeed", actualSpeed);
  const startupTime = actualSpeed / 60 / inp.accelerationMs2; // [sn]
  set("drive.startupTime", startupTime);
  const friction = travelFrictionFactor(sel.wheelDiaMm);
  set("drive.frictionFactor", friction);
  // Kademe başına %2 kayıp kabulü.
  const reducerEff = 0.98 ** inp.reducerStages;
  set("drive.reducerEfficiency", reducerEff);
  // CMAA 70 bağıntıları imperial birimlidir: ivme ft/s²'ye çevrilir.
  set("drive.accelerationFps2", inp.accelerationMs2 * 3.2808);
  const inertiaCr = 1.05 + (inp.accelerationMs2 * 3.28) / 7.5;
  set("drive.inertiaFactor", inertiaCr);
  const accelKa =
    (friction + (2000 * inp.accelerationMs2 * inertiaCr) / (9.81 * reducerEff)) /
    (inp.accelTorqueFactorKt * 33000);
  set("drive.accelFactor", accelKa);
  const requiredPower = designWeightTons * (actualSpeed * 3.28) * accelKa * inp.serviceFactorKs * 0.745;
  set("motor.requiredPower", requiredPower);
  const requiredMaxPower = inp.tempFactor * requiredPower;
  set("motor.requiredMaxPower", requiredMaxPower);
  set("motor.maxPowerPerMotor", requiredMaxPower / inp.motorCalcCount);
  const installedPower = sel.motorPowerKw * sel.motorCount;
  set("motor.installedPower", installedPower);
  checks.push({
    id: `${which}.motor.power`,
    label: "Yürütme Motoru Gücü",
    required: requiredMaxPower, provided: installedPower, unit: "kW", op: ">=",
    computedSide: "required",
    pass: installedPower >= requiredMaxPower,
    standard: "CMAA 70 5.2.9.1.2.1",
    kind: "standart", severity: "engelleyici",
  });

  // --- Yürütme Dişli Kutusu ------------------------------------------------
  const requiredRatio = sel.motorRpm / wheelRpm;
  set("gearbox.requiredRatio", requiredRatio);
  const ratioDeviation = (100 * (requiredRatio - sel.gearboxRatio)) / requiredRatio; // [%]
  set("gearbox.ratioDeviation", ratioDeviation);
  // Sapma bandı tasarım kabulüdür: köprüde hız fazlalığı raylı sistemde daha
  // kritik olduğundan üst sınır dar tutulur.
  const devMax = isTrolley ? 10 : 5;
  const devMin = isTrolley ? -5 : -10;
  const devOk = ratioDeviation <= devMax && ratioDeviation >= devMin;
  checks.push({
    id: `${which}.gearbox.ratio`,
    label: "Çevrim Oranı Sapması",
    min: devMin, max: devMax, provided: ratioDeviation, unit: "%", op: "range",
    pass: devOk,
    kind: "firma", severity: "uyari",
  });
  const powerPerMotor = requiredPower / sel.motorCount;
  set("motor.powerPerMotor", powerPerMotor);
  const requiredInputTorque = (9550 * powerPerMotor) / sel.motorRpm; // [Nm]
  set("gearbox.requiredInputTorque", requiredInputTorque);
  const nominalOutputTorque = requiredInputTorque * sel.gearboxRatio; // [Nm]
  set("gearbox.nominalOutputTorque", nominalOutputTorque);
  const requiredMinOutputTorque = nominalOutputTorque * inp.gearboxServiceFactor; // [Nm]
  set("gearbox.requiredOutputTorque", requiredMinOutputTorque);
  const gearboxSafety = sel.gearboxOutputTorqueKnm / (nominalOutputTorque / 1000);
  set("gearbox.actualSafety", gearboxSafety);
  checks.push({
    id: `${which}.gearbox.safety`,
    label: "Redüktör Emniyet Katsayısı",
    required: inp.gearboxServiceFactor, provided: gearboxSafety, unit: "-", op: ">=",
    computedSide: "provided",
    pass: gearboxSafety >= inp.gearboxServiceFactor,
    kind: "firma", severity: "engelleyici",
  });

  // --- Yürütme Freni (sadece köprü) ----------------------------------------
  let requiredBrakeTorque: number | null = null;
  if (!isTrolley) {
    requiredBrakeTorque = requiredInputTorque * inp.brakeServiceFactor;
    set("brake.requiredTorque", requiredBrakeTorque);
    checks.push({
      id: `${which}.brake.torque`,
      label: "Köprü Yürütme Freni Torku",
      required: requiredBrakeTorque, provided: sel.brakeTorqueNm, unit: "Nm", op: ">=",
      computedSide: "required",
      pass: sel.brakeTorqueNm >= requiredBrakeTorque,
      kind: "standart", severity: "engelleyici",
    });
  }

  // --- Motor — Dişli Kutusu Kaplini ----------------------------------------
  const requiredMotorCouplingTorque = requiredInputTorque * inp.motorCouplingServiceFactor;
  set("motorCoupling.requiredTorque", requiredMotorCouplingTorque);
  // Arabada kapline bağlanan mil ayrı girilir; köprüde motorun mil çapıdır.
  const motorCouplingShaft = isTrolley ? sel.couplingMotorShaftMm : sel.motorShaftMm;
  set("motorCoupling.shaftDia", motorCouplingShaft);
  const motorCouplingSafety = sel.motorCouplingTorqueNm / requiredMotorCouplingTorque;
  set("motorCoupling.actualSafety", motorCouplingSafety);
  checks.push({
    id: `${which}.motorCoupling.torque`,
    label: "Motor Kaplini Tork Kapasitesi",
    required: requiredMotorCouplingTorque, provided: sel.motorCouplingTorqueNm, unit: "Nm", op: ">=",
    computedSide: "required",
    pass: sel.motorCouplingTorqueNm >= requiredMotorCouplingTorque,
    kind: "firma", severity: "engelleyici",
  });
  checks.push({
    id: `${which}.motorCoupling.bore`,
    label: "Motor Kaplini Delik Çapı",
    required: motorCouplingShaft, provided: sel.motorCouplingDmaxMm, unit: "mm", op: ">=",
    // İki taraf da katalogdan gelir; TALEP kaplinin geçirmesi gereken motor mili
    // çapıdır, sınır ise kaplinin en büyük delik çapıdır.
    computedSide: "required",
    pass: sel.motorCouplingDmaxMm >= motorCouplingShaft,
    kind: "uretici", severity: "engelleyici",
  });

  // --- Teker — Dişli Kutusu Kaplini ----------------------------------------
  const requiredWheelCouplingTorque = nominalOutputTorque * inp.wheelCouplingServiceFactor;
  set("wheelCoupling.requiredTorque", requiredWheelCouplingTorque);
  // Emniyet oranı servis faktörsüz nominal çıkış momentine göre raporlanır.
  const wheelCouplingSafety = sel.wheelCouplingTorqueNm / nominalOutputTorque;
  set("wheelCoupling.actualSafety", wheelCouplingSafety);
  checks.push({
    id: `${which}.wheelCoupling.torque`,
    label: "Teker Kaplini Tork Kapasitesi",
    required: requiredWheelCouplingTorque, provided: sel.wheelCouplingTorqueNm, unit: "Nm", op: ">=",
    computedSide: "required",
    pass: sel.wheelCouplingTorqueNm >= requiredWheelCouplingTorque,
    kind: "firma", severity: "engelleyici",
  });
  checks.push({
    id: `${which}.wheelCoupling.bore`,
    label: "Teker Kaplini Delik Çapı",
    required: sel.wheelShaftDiaMm, provided: sel.wheelCouplingDmaxMm, unit: "mm", op: ">=",
    // İki taraf da katalogdan gelir; TALEP kaplinin geçirmesi gereken teker mili
    // çapıdır, sınır ise kaplinin en büyük delik çapıdır.
    computedSide: "required",
    pass: sel.wheelCouplingDmaxMm >= sel.wheelShaftDiaMm,
    kind: "uretici", severity: "engelleyici",
  });

  // --- Tampon --------------------------------------------------------------
  // Fizik `calc/buffer.ts` çekirdeğindedir; burada yalnız ÇARPIŞAN KÜTLE ve
  // TAHRİK GÜCÜ hazırlanır.
  //
  // ÇARPIŞAN KÜTLE (FEM 1.001 md. 2.2.3.4.1 / CMAA 70 md. 3.3.2.1.3.2):
  // yük SALINABİLİYORSA hariçtir; RİJİT KILAVUZLUYSA kapasite + kanca donanımı
  // eklenir. Aşağıdaki iki bağıntı da BİR TAMPONA gelen kütleyi verir:
  //   · Araba simetriktir → toplam kütle tampon adedine bölünür.
  //   · Köprüde araba eksantriktir → yakın raya düşen pay (köprü/2 + araba·
  //     (L−y)/L) o raydaki tamponlara (n/2 adet) bölünür.
  // İkinci bir "n'e bölme" YAPILMAZ; köprü bağıntısındaki /2 zaten iki paralel
  // tamponun payıdır (çift sayma olurdu).
  const bufferCount = Math.max(1, Math.round(posOr(inp.bufferCount, 2)));
  set("buffer.count", bufferCount);
  const rigidLoad = inp.bufferLoadRigidlyGuided === TRAVEL_YES;
  const rigidExtraT = rigidLoad ? capacityT + deps.hookEquipmentT : 0;
  set("buffer.rigidGuidedLoad", rigidLoad ? 1 : 0);

  let massPerBufferT: number;
  if (isTrolley) {
    massPerBufferT = (trolleyWeightT + rigidExtraT) / bufferCount;
  } else {
    const nearRailShareT =
      bridgeWeightT / 2 +
      ((trolleyWeightT + rigidExtraT) * (specs.spanM - inp.bufferApproachM)) / specs.spanM;
    massPerBufferT = nearRailShareT / Math.max(1, bufferCount / 2);
  }

  // Tampon sıkışırken tahrik itmeye devam eder: arabada motor başına GEREKLİ
  // güç, köprüde SEÇİLEN motor gücü esas alınır (mevcut tasarım kabulü).
  const bufferPowerKw = isTrolley ? powerPerMotor : sel.motorPowerKw;
  set("buffer.drivePower", bufferPowerKw);

  // SIBRE SP kısma iğnesi, katalogdaki aynı strok satırında tampon başına
  // hesaplanan tasarım kütlesini karşılayan en küçük sınıftır. Eski revizyon
  // ya da katalog dışı bir seçimde kullanıcıdaki manuel değer geri düşüm olur.
  const automaticMeteringPin = bufferType === "hidrolik"
    ? selectMeteringPin(sel.bufferMeteringPins, massPerBufferT)
    : undefined;
  const meteringPinCode = bufferType === "hidrolik"
    ? automaticMeteringPin?.code ?? sel.bufferMeteringPinCode ?? ""
    : "";
  const meteringPinMassMaxT = bufferType === "hidrolik"
    ? automaticMeteringPin?.designMassMaxT ?? sel.bufferDesignMassMaxT ?? 0
    : 0;
  set("buffer.meteringPinCode", meteringPinCode);
  set("buffer.meteringPinMassClass", meteringPinMassMaxT);

  const bufferResult = computeBuffer({
    which,
    type: bufferType,
    nominalSpeedMpm: actualSpeed,
    impactSpeedRatio: view.bufferImpactSpeedRatio,
    massPerBufferT,
    bufferCount,
    drivePowerTotalKw: bufferPowerKw * sel.motorCount,
    strokeMm: sel.bufferStrokeMm,
    catalogEnergyKj: sel.bufferEnergyKj,
    catalogMaxForceKn: sel.bufferLoadKn,
    catalogDesignMassMaxT: meteringPinMassMaxT,
    energyCurve: sel.bufferEnergyCurve,
    forceCurve: sel.bufferForceCurve,
    cellularSpeedCurves: bufferType === "hucresel"
      ? cellularSpeedCurvesForModel(sel.bufferModel)
      : undefined,
    maxCompressionPct: sel.bufferMaxCompressionPct ?? 0,
    frequentEndApproach: inp.bufferFrequentEndApproach === TRAVEL_YES,
  });
  for (const [key, value] of Object.entries(bufferResult.cells)) set(key, value);
  checks.push(...bufferResult.checks);
  const bv = bufferResult.values;
  // Motor başına tahrik kuvveti — raporda gösterilen ara büyüklük.
  const drivePerMotor = bv.totalDriveForceN / Math.max(1, sel.motorCount);
  set("buffer.driveForcePerMotor", drivePerMotor);

  const values: TravelValues = {
    drivenWheels,
    craneWeightT,
    maxWheelLoadKg: maxWheelLoad,
    minWheelLoadKg: minWheelLoad,
    avgWheelLoadKg: meanWheelLoad,
    railHeadWidthMm: railHeadWidth,
    wheelRpm,
    c1,
    c2,
    limitPressure,
    actualPressure,
    allowedPressure,
    reactionAKg: reactionA,
    reactionBKg: reactionB,
    maxMomentKgCm: maxMoment,
    shaftLoadBandCm: loadBandCm,
    shaftLoadIntensityKgPerCm: loadIntensityKgPerCm,
    sectionModulusCm3: sectionModulus,
    shaftBendingStress: bendingStress,
    shaftShearStress: shearStress,
    shaftCombinedStress: combinedStress,
    shaftAllowables: shaftAllow,
    bearingRadialKn: bearingRadial,
    bearingAxialKn: bearingAxial,
    bearingEqStaticKn: eqStatic,
    bearingEqDynamicKn: eqDynamic,
    bearingStaticSafety: staticSafety,
    bearingLifeHours: lifeHours,
    requiredLifeMin,
    requiredLifeMax: life.max,
    totalWeightKg,
    designWeightTons,
    actualSpeedMpm: actualSpeed,
    startupTimeS: startupTime,
    frictionFactor: friction,
    reducerEfficiency: reducerEff,
    rotationInertiaFactor: inertiaCr,
    accelFactorKa: accelKa,
    requiredPowerKw: requiredPower,
    requiredMaxPowerKw: requiredMaxPower,
    requiredPowerPerMotorKw: powerPerMotor,
    installedPowerKw: installedPower,
    requiredRatio,
    ratioDeviationPct: ratioDeviation,
    requiredInputTorqueNm: requiredInputTorque,
    nominalOutputTorqueNm: nominalOutputTorque,
    requiredMinOutputTorqueNm: requiredMinOutputTorque,
    gearboxActualSafety: gearboxSafety,
    requiredBrakeTorqueNm: requiredBrakeTorque,
    requiredMotorCouplingTorqueNm: requiredMotorCouplingTorque,
    motorCouplingShaftMm: motorCouplingShaft,
    motorCouplingSafety,
    requiredWheelCouplingTorqueNm: requiredWheelCouplingTorque,
    wheelCouplingSafety,
    bufferType: bv.type,
    collisionLoadT: bv.massPerBufferT,
    bufferImpactSpeedRatio: view.bufferImpactSpeedRatio,
    bufferImpactSpeedMps: bv.impactSpeedMps,
    impactEnergyKj: bv.impactEnergyKj,
    driveLoadPerMotorN: drivePerMotor,
    totalDriveLoadN: bv.totalDriveForceN,
    bufferDriveLoadN: bv.driveForcePerBufferN,
    bufferStrokeUsedMm: bv.strokeUsedMm,
    bufferDriveEnergyKj: bv.driveEnergyKj,
    totalEnergyKj: bv.totalEnergyKj,
    bufferForceKn: bv.reactionForceKn,
    bufferCompressionPct: bv.compressionPct,
    bufferAvgDecelerationMps2: bv.avgDecelerationMps2,
    bufferMaxDecelerationMps2: bv.maxDecelerationMps2,
    bufferCatalogEnergyAtImpactKj: bv.catalogEnergyAtImpactKj,
    bufferCatalogForceAtImpactKn: bv.catalogForceAtImpactKn,
    bufferCatalogCurveSpeedMps: bv.catalogCurveSpeedMps,
    bufferMeteringPinCode: meteringPinCode,
    bufferDesignMassMaxT: meteringPinMassMaxT,
    bufferTransferredToStructure: bv.transferredToStructure,
    bufferComputed: bv.computed,
  };

  return { values, checks, cells };
}
