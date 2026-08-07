// Hesap motoru çekirdek tipleri.
// Dört değer rolü: input (kullanıcı girer) -> computed (formül) ->
// selection (katalogdan seçim) -> check (kontrol).

import type { BufferType } from "./buffer";

export type MechanismClass = "M1" | "M2" | "M3" | "M4" | "M5" | "M6" | "M7" | "M8";
export type UsageClass = "T0" | "T1" | "T2" | "T3" | "T4" | "T5" | "T6" | "T7" | "T8" | "T9";
export type StructureClass = "A1" | "A2" | "A3" | "A4" | "A5" | "A6" | "A7" | "A8";
export type LoadGroup = "B1" | "B2" | "B3" | "B4" | "B5" | "B6";
export type HoistClass = "H1" | "H2" | "H3" | "H4";
export type DrumMaterial = "S235" | "S355";
export type ShaftMaterial = "S355JR" | "C25" | "C30" | "C35" | "4140+QT" | "4140";

/** Kaldırma grubunun hazır ekipman düzeni. Hesap her zaman tek grup üzerinden yürür. */
export type HoistEquipmentArrangement = "standard" | "twin";
export type HoistEquipmentGroup = "main" | "aux" | "mono1" | "mono2";

export const HOIST_EQUIPMENT_ARRANGEMENTS = ["standard", "twin"] as const;
export const HOIST_EQUIPMENT_ARRANGEMENT_LABELS: Record<HoistEquipmentArrangement, string> = {
  standard: "Standart Donanım",
  twin: "İkiz Donanım",
};

/**
 * Kontrolün dayanağı — kontrolü kimin şart koştuğunu söyler.
 *
 * - `standart` : FEM 1.001 / DIN 15018 / DIN 15400 / CMAA 70 maddesi doğrudan
 *                bu şartı koşar. Tartışmaya kapalı, normatif kaynaklıdır.
 * - `uretici`  : Bileşen üreticisinin katalog kriteri (rulman ömrü/statik
 *                emniyet, redüktör izinli radyal yük, kaplin momenti gibi).
 * - `firma`    : Firma veya tasarım kabulü (servis faktörü seçimi, redüktör
 *                çevrim oranı sapma bandı, sehim oranı hedefi gibi).
 * - `bilgi`    : Yalnız bilgilendirme amaçlı; tasarımı reddetmez
 *                (ör. rulman iç çapı = mil çapı uyumu).
 */
export type CheckKind = "standart" | "uretici" | "firma" | "bilgi";

/**
 * Kontrolün sonuca etkisi.
 *
 * - `engelleyici` : Sağlanmadan revizyon yayınlanmamalıdır.
 * - `uyari`       : Yayınlanabilir, ancak raporda görünür şekilde belirtilir.
 */
export type CheckSeverity = "engelleyici" | "uyari";

/**
 * HESAPLANAN değerin hangi alanda durduğu.
 *
 * Bir kontrol her zaman iki sayıyı karşılaştırır: biri tasarımdan/hesaptan
 * çıkan büyüklük, diğeri onu sınırlayan değer. Model bunları `provided`
 * (sağlanan kapasite) ve `required` (istenen talep) diye tutar; hangisinin
 * HESAPLANAN olduğu kontrole göre değişir:
 *
 * - `"provided"` : hesaplanan büyüklük `provided`, sınır `required`.
 *                  Örnek: gerçekleşen halat emniyet katsayısı (hesap) ≥
 *                  FEM'in istediği en küçük katsayı (sınır).
 * - `"required"` : hesaplanan büyüklük `required`, sınır `provided`.
 *                  Örnek: hesaplanan bileşik gerilme (hesap) ≤ malzemenin
 *                  izin verilen gerilmesi (sınır).
 *
 * Rapor ve arayüz satırı "Hesaplanan X ≤ İzin Verilen Y" biçiminde yazıldığı
 * için bu ayrım ZORUNLUDUR — tahmin edilemez.
 */
export type ComputedSide = "provided" | "required";

/** Tek bir kontrol satırı: hesaplanan değer ile sınırın karşılaştırması. */
export interface Check {
  id: string;
  label: string;
  /** İstenen (talep) değer */
  required: number;
  /** Sağlanan (kapasite) değer */
  provided: number;
  unit: string;
  /** provided `op` required şeklinde okunur */
  op: ">=" | "<=";
  /** Hesaplanan değer hangi alanda (bkz. `ComputedSide`) */
  computedSide: ComputedSide;
  pass: boolean;
  /** İlgili standart (ör. FEM 1.001 T.2.1.3.2) */
  standard?: string;
  /**
   * Kontrolün dayanağı. Geçiş sürecinde opsiyoneldir: modüller aşamalı olarak
   * dolduracak, eski revizyon anlık görüntülerinde bu alan hiç bulunmaz.
   * Okurken doğrudan değil `checkKind()` ile erişin.
   */
  kind?: CheckKind;
  /**
   * Kontrolün sonuca etkisi. Geçiş sürecinde opsiyoneldir; okurken
   * `checkSeverity()` yardımcısını kullanın.
   */
  severity?: CheckSeverity;
}

/**
 * Aralık tipli kontrol (ör. redüktör çevrim oranı sapması −10%..+5%).
 * Hesaplanan değer daima `provided`, sınır ise [min, max] aralığıdır.
 */
export interface RangeCheck extends Omit<Check, "op" | "required" | "computedSide"> {
  op: "range";
  min: number;
  max: number;
  computedSide?: "provided";
}

export type AnyCheck = Check | RangeCheck;

/** Alan yokken kullanılan varsayılan dayanak. */
const VARSAYILAN_KIND: CheckKind = "standart";

/** Alan yokken kullanılan varsayılan etki. */
const VARSAYILAN_SEVERITY: CheckSeverity = "engelleyici";

const GECERLI_KINDS: readonly CheckKind[] = ["standart", "uretici", "firma", "bilgi"];
const GECERLI_SEVERITIES: readonly CheckSeverity[] = ["engelleyici", "uyari"];

/**
 * Kontrolün dayanağını döndürür. Alan tanımlı değilse (eski anlık görüntüler,
 * henüz güncellenmemiş modüller) varsayılan olarak "standart" kabul edilir.
 */
export function checkKind(c: AnyCheck): CheckKind {
  const k = c.kind;
  return k !== undefined && GECERLI_KINDS.includes(k) ? k : VARSAYILAN_KIND;
}

/**
 * Kontrolün etkisini döndürür. Alan tanımlı değilse en muhafazakâr varsayım
 * yapılır ve "engelleyici" kabul edilir.
 */
export function checkSeverity(c: AnyCheck): CheckSeverity {
  const s = c.severity;
  return s !== undefined && GECERLI_SEVERITIES.includes(s) ? s : VARSAYILAN_SEVERITY;
}

/** Kontrol hem başarısız hem de engelleyici mi? */
export function isBlocking(c: AnyCheck): boolean {
  return !c.pass && checkSeverity(c) === "engelleyici";
}

/**
 * Hesaplanan değerin hangi alanda olduğu. Eski revizyon anlık görüntülerinde bu
 * alan bulunmaz; o kayıtlarda en yaygın kalıp olan `provided` varsayılır.
 */
export function checkComputedSide(c: AnyCheck): ComputedSide {
  const v = (c as { computedSide?: ComputedSide }).computedSide;
  return v === "required" ? "required" : "provided";
}

/**
 * Kontrolün rapor/arayüz gösterimi: HESAPLANAN değer, İZİN VERİLEN sınır ve
 * ikisi arasındaki bağıntı işareti. Aynı kontrol hem PDF'te hem sihirbazda bu
 * fonksiyonla yazılır — iki yerde farklı okunması imkânsızdır.
 */
export interface CheckDisplay {
  /** Tasarımdan/hesaptan çıkan değer */
  computed: number;
  /** Sınır değer (tek sayı) — aralık kontrolünde undefined */
  limit?: number;
  /** Aralık kontrolünde alt/üst sınır */
  min?: number;
  max?: number;
  /** "hesaplanan ⟨işaret⟩ sınır" biçiminde okunur */
  operator: "≤" | "≥" | "…";
  unit: string;
}

export function checkDisplay(c: AnyCheck): CheckDisplay {
  if (c.op === "range") {
    const r = c as RangeCheck;
    return { computed: r.provided, min: r.min, max: r.max, operator: "…", unit: c.unit };
  }
  const chk = c as Check;
  const computedIsProvided = checkComputedSide(c) === "provided";
  const computed = computedIsProvided ? chk.provided : chk.required;
  const limit = computedIsProvided ? chk.required : chk.provided;
  // op, "provided ⟨op⟩ required" olarak okunur. Hesaplanan taraf `required`
  // ise bağıntı ters çevrilir (a ≥ b  ⟺  b ≤ a).
  const forward = chk.op === ">=" ? "≥" : "≤";
  const reversed = chk.op === ">=" ? "≤" : "≥";
  return {
    computed,
    limit,
    operator: computedIsProvided ? forward : reversed,
    unit: c.unit,
  };
}

/** Verilen kontroller içinden yayını engelleyen başarısızlıkları süzer. */
export function blockingFailures(checks: AnyCheck[]): AnyCheck[] {
  return checks.filter(isBlocking);
}

/**
 * Modül sonucu: isimli değerler + kontroller + izlenebilirlik haritası.
 * `cells` alanı tarihsel doğrulama fikstürüyle karşılaştırma için tutulan
 * ham değer dökümüdür; üretim hesabında anlam taşımaz.
 */
export interface ModuleResult<TValues> {
  values: TValues;
  checks: AnyCheck[];
  /** İzlenebilirlik anahtarı -> hesaplanan değer */
  cells: Record<string, number | string>;
}

/**
 * Yardımcı kaldırma grubunun arabası.
 *
 * - `shared`   : Yardımcı kaldırma ANA arabanın üzerindedir; ayrı bir yürütme
 *                grubu hesaplanmaz (araba ağırlığı ana arabaya dahildir).
 * - `separate` : Yardımcı kaldırmanın kendi arabası vardır; bağımsız bir araba
 *                yürütme grubu (hız, sınıf, ağırlık, teker, motor) hesaplanır.
 */
export type AuxTrolleyMode = "shared" | "separate";

/** Araba enerjisi için bu sürümde desteklenen besleme alternatifleri. */
export type TrolleyPowerSupply = "festoon" | "cableChain";

/** Köprü enerjisi için desteklenen besleme alternatifleri. */
export type BridgePowerSupply =
  | "festoon"
  | "cableChain"
  | "conductorBar"
  | "cableReel";

/** Operatör kabini projeye dâhil mi? */
export type OperatorCabinPresence = "yes" | "no";

/** Elektrik ekipmanının yerleşimi: ayrı oda, yan yana panolar veya yok. */
export type ElectricalAccommodationType = "none" | "room" | "panel";

/** Oda/kabin panel izolasyonu. Pano tipinde kullanılmaz; IP sınıfı ayrı tutulur. */
export type RoomInsulation = "rockWool50" | "rockWool100";

/** İklimlendirme çözümünün proje seviyesindeki sınıfı. */
export type AirConditioningType =
  | "none"
  | "standard"
  | "panel"
  | "industrial"
  | "heavyIndustrial";

/** Elektrik odası ve panolar için kurulu yedek klima düzeni. */
export type AirConditioningRedundancy = "none" | "nPlusOne";

/** I-kiriş festoon ürün ailesinin üreticisi. */
export type FestoonBrand = "conductixWampfler" | "vasel";

/**
 * I-kiriş festoon seri ailesi. `auto`, seçilen üreticide en küçük uygun aileyi
 * seçer. Vasel'in tam ürün kodu I-kiriş geometrisine göre katalog şablonundan
 * tamamlanır; seri seçimi bu geometrik doğrulamadan önceki ön seçimdir.
 */
export type FestoonSeries =
  | "auto"
  | "0314" | "0320" | "0325" | "0330"
  | "VS2005" | "VS2010" | "VS2015" | "VS2020"
  | "VS2050" | "VS2060" | "VS2070"
  | "VS25-S1" | "VS25-S2" | "VS26-S3" | "VS26-S4";

/** Katalogdaki ayrı düz/kesitli ve yuvarlak kablo taşıyıcı düzenleri. */
export type FestoonCableForm = "flat" | "round";

/**
 * Bir hareket ekseni için minimum festoon ön seçimi.
 *
 * `cablePackageWeightKg` hareket eden kablo paketi toplam kütlesidir. Sistem,
 * bunu seçilen taşıyıcı adedine bölerek katalogdaki taşıyıcı başına kapasiteyle
 * kıyaslar. Kesin taşıyıcı parça kodu için ayrıca I-kiriş flanşı ve kablo paket
 * geometrisi gerekir; bu iki bilgi teklif/imalat doğrulamasında istenir.
 */
export interface FestoonSpec {
  /** Verilmezse eski kayıtlarla uyum için Conductix-Wampfler kabul edilir. */
  brand?: FestoonBrand;
  series: FestoonSeries;
  trolleyCount: number;
  cablePackageWeightKg: number;
  cableForm: FestoonCableForm;
  /** Kablo loop'larının ray altındaki en büyük çalışma yüksekliği [m]. */
  loopHeightM?: number;
}

/** Bir vinçte en çok kaç ek monoray kaldırma grubu tanımlanabilir. */
export const MAX_MONORAIL_COUNT = 2;

/** 01-TEKNİK ÖZELLİKLER girdileri */
export interface TechnicalSpecs {
  mainCapacityT: number;        // ana kaldırma kapasitesi [ton]
  mainLiftHeightM: number;      // ana kaldırma yüksekliği [m]
  mainLiftSpeedMpm: number;     // ana kaldırma hızı [m/dak]
  /** Ana kaldırma hazır ekipman adedi; ikiz seçim yalnız ekipman listesini etkiler. */
  mainHoistEquipmentArrangement?: HoistEquipmentArrangement;
  auxCapacityT: number;         // yardımcı kaldırma kapasitesi [ton]
  auxLiftHeightM: number;       // yardımcı kaldırma yüksekliği [m]
  auxLiftSpeedMpm: number;      // yardımcı kaldırma hızı [m/dak]
  /** Yardımcı kaldırma hazır ekipman adedi; ikiz seçim yalnız ekipman listesini etkiler. */
  auxHoistEquipmentArrangement?: HoistEquipmentArrangement;
  structureClass: StructureClass;      // çelik yapı sınıfı (A1–A8)
  hoistLoadClass: string;              // kaldırma/yük grubu (ör. "H3/B4")
  hoistMechanismClass: MechanismClass; // ana kaldırma mekanizma sınıfı
  hoistUsageClass: UsageClass;         // ana kaldırma kullanım sınıfı
  /**
   * Yardımcı kaldırma mekanizma sınıfı. Yardımcı kaldırma bağımsız bir
   * mekanizmadır; verilmezse ana kaldırmanın sınıfı kullanılır (geriye uyum).
   */
  auxMechanismClass?: MechanismClass;
  /**
   * Yardımcı kaldırma kullanım sınıfı. Verilmezse ana kaldırmanın kullanım
   * sınıfı kullanılır (geriye uyum).
   */
  auxUsageClass?: UsageClass;
  bridgeSpeedMpm: number;               // köprü yürütme hızı [m/dak]
  bridgeMechanismClass: MechanismClass; // köprü yürütme mekanizma sınıfı
  bridgeUsageClass: UsageClass;         // köprü yürütme kullanım sınıfı
  trolleySpeedMpm: number;              // araba yürütme hızı [m/dak]
  trolleyMechanismClass: MechanismClass; // araba yürütme mekanizma sınıfı
  trolleyUsageClass: UsageClass;         // araba yürütme kullanım sınıfı
  hookType: string;             // kanca / kaldırma aparatı tipi (ör. "Kepçe")
  controlType: string;          // kumanda tipi
  // Vinç tanımı — açıklayıcı seçimler (hesapta kullanılmaz, raporda görünür)
  hoistBrakeType?: string;      // kaldırma freni tipi (manyetik/eldro/disk)
  hoistSafetyBrake?: string;    // emniyet freni kapsamı (bkz. hasSafetyBrake)
  travelBrakeType?: string;     // yürütme freni tipi (manyetik/eldro)
  ambientTempMinC: number;      // ortam sıcaklığı alt sınırı [°C]
  ambientTempMaxC: number;      // ortam sıcaklığı üst sınırı [°C]
  supplyVoltage: string;        // besleme gerilimi
  controlVoltage: string;       // kumanda gerilimi
  spanM: number;                // açıklık [m]

  /** Vinç yürüme yolu uzunluğu [m] — köprü festoon hareket mesafesi. */
  runwayLengthM?: number;

  // ---------------------------------------------------- Enerji besleme
  /** Ana araba enerji besleme yöntemi. */
  trolleyPowerSupply?: TrolleyPowerSupply;
  /** Ayrı yardımcı araba enerji besleme yöntemi. */
  auxTrolleyPowerSupply?: TrolleyPowerSupply;
  /** Monoray 1 araba enerji besleme yöntemi. */
  mono1TrolleyPowerSupply?: TrolleyPowerSupply;
  /** Monoray 2 araba enerji besleme yöntemi. */
  mono2TrolleyPowerSupply?: TrolleyPowerSupply;
  /** Köprü enerji besleme yöntemi. */
  bridgePowerSupply?: BridgePowerSupply;

  /** Her hareket ekseninin festoon ön seçimi. */
  trolleyFestoon?: FestoonSpec;
  auxTrolleyFestoon?: FestoonSpec;
  mono1TrolleyFestoon?: FestoonSpec;
  mono2TrolleyFestoon?: FestoonSpec;
  bridgeFestoon?: FestoonSpec;

  /** Enerji besleme/festoon ayrıntıları hesap raporunda basılsın mı. */
  showFestoonDetailsInReport?: boolean;

  // ---------------------------------------- Operatör kabini / elektrik mahalli
  /** Operatör kabini projeye dâhil mi? */
  hasOperatorCabin?: OperatorCabinPresence;
  operatorCabinWidthM?: number;
  operatorCabinLengthM?: number;
  operatorCabinHeightM?: number;
  operatorCabinInsulation?: RoomInsulation;
  operatorCabinAirConditioning?: AirConditioningType;
  /** TMS katalog tipi; standart klimada "Projeye özel seçim" bırakılabilir. */
  operatorCabinAirConditionerModel?: string;

  /** Elektrik ekipmanı ayrı odada mı, yan yana panolarda mı? */
  electricalAccommodationType?: ElectricalAccommodationType;
  electricalRoomWidthM?: number;
  electricalRoomLengthM?: number;
  electricalRoomHeightM?: number;
  electricalRoomInsulation?: RoomInsulation;
  electricalRoomAirConditioning?: AirConditioningType;
  electricalRoomAirConditionerModel?: string;
  /** Elektrik odası için kurulu yedek: 1+1. */
  electricalRoomAirConditioningRedundancy?: AirConditioningRedundancy;

  /** Pano tipi yerleşimde yan yana dizilen pano adedi ve kendi IP koruması. */
  electricalPanelCount?: number;
  electricalPanelIpClass?: string;
  electricalPanelAirConditioning?: AirConditioningType;
  electricalPanelAirConditionerModel?: string;
  electricalPanelAirConditioningRedundancy?: AirConditioningRedundancy;

  // ------------------------------------------------- Vinç konfigürasyonu
  /**
   * Yardımcı kaldırma ayrı bir arabada mı çalışıyor. `separate` seçilirse
   * "Yardımcı Araba Yürütme" hesap bölümü açılır. Verilmezse `shared`.
   */
  auxTrolleyMode?: AuxTrolleyMode;
  /**
   * Vinçteki ek monoray kaldırma grubu adedi (0…2). Her monoray grubu kendi
   * kaldırma, kanca bloğu ve araba yürütme bölümlerini açar.
   */
  monorailCount?: number;

  // ------------------------------------------------------------ Ağırlıklar
  // Yürütme gruplarının tümü ağırlık verilerini buradan okur; ağırlık artık
  // modül girdisi değil, vincin teknik özelliğidir.
  /** Ana araba ağırlığı [t] */
  mainTrolleyWeightT: number;
  /** Yardımcı araba ağırlığı [t] — yalnız ayrı yardımcı araba varken */
  auxTrolleyWeightT?: number;
  /** Köprü ağırlığı [t] — ana kirişler + başkirişler toplamı */
  bridgeWeightT: number;

  // ------------------------------------------------------------- Tamponlar
  /**
   * Araba yürütme tamponu tipi. Seçime göre 5.8 tampon bölümü görünür ve
   * ilgili hesap dalı (hidrolik / kauçuk) koşar. "yok" seçilirse bölüm
   * gösterilmez ve tampon hesabı yapılmaz. Tüm araba varyantları (ana,
   * yardımcı, monoray) aynı seçimi kullanır.
   */
  trolleyBufferType?: BufferType;
  /** Köprü yürütme tamponu tipi (6.9 bölümü) */
  bridgeBufferType?: BufferType;
  /**
   * Araba tamponunda çarpma hızı oranı k [%]. v_ç = (v_anma/60)·k/100.
   * FEM 1.001 md. 2.2.3.4.1 cihaz için 0,7 verir; arabada varsayılan %100
   * muhafazakâr firma kabulüdür (bkz. `calc/buffer.ts`).
   */
  trolleyBufferImpactSpeedPct?: number;
  /** Köprü tamponunda çarpma hızı oranı k [%] — FEM varsayılanı %70 */
  bridgeBufferImpactSpeedPct?: number;

  // --------------------------------------------- Yardımcı araba yürütme
  auxTrolleySpeedMpm?: number;
  auxTrolleyMechanismClass?: MechanismClass;
  auxTrolleyUsageClass?: UsageClass;

  // ------------------------------------------------------- Monoray 1
  mono1CapacityT?: number;
  mono1LiftHeightM?: number;
  mono1LiftSpeedMpm?: number;
  mono1HoistEquipmentArrangement?: HoistEquipmentArrangement;
  mono1MechanismClass?: MechanismClass;
  mono1UsageClass?: UsageClass;
  mono1TrolleySpeedMpm?: number;
  mono1TrolleyMechanismClass?: MechanismClass;
  mono1TrolleyUsageClass?: UsageClass;
  mono1TrolleyWeightT?: number;

  // ------------------------------------------------------- Monoray 2
  mono2CapacityT?: number;
  mono2LiftHeightM?: number;
  mono2LiftSpeedMpm?: number;
  mono2HoistEquipmentArrangement?: HoistEquipmentArrangement;
  mono2MechanismClass?: MechanismClass;
  mono2UsageClass?: UsageClass;
  mono2TrolleySpeedMpm?: number;
  mono2TrolleyMechanismClass?: MechanismClass;
  mono2TrolleyUsageClass?: UsageClass;
  mono2TrolleyWeightT?: number;
}

/** Vinçte kaç monoray kaldırma grubu var (0…MAX_MONORAIL_COUNT). */
export function monorailCount(specs: TechnicalSpecs): number {
  const n = specs.monorailCount;
  if (!Number.isFinite(n as number)) return 0;
  return Math.min(MAX_MONORAIL_COUNT, Math.max(0, Math.trunc(n as number)));
}

/** Eski revizyonlarda alan yoktur; her zaman standart donanım olarak okunur. */
export function hoistEquipmentArrangement(
  specs: TechnicalSpecs,
  which: HoistEquipmentGroup
): HoistEquipmentArrangement {
  const value = {
    main: specs.mainHoistEquipmentArrangement,
    aux: specs.auxHoistEquipmentArrangement,
    mono1: specs.mono1HoistEquipmentArrangement,
    mono2: specs.mono2HoistEquipmentArrangement,
  }[which];
  return value === "twin" ? "twin" : "standard";
}

/** İkiz donanımda yalnız satın alma/montaj listesi iki set hazır ekipman ister. */
export function hoistEquipmentQuantityFactor(
  specs: TechnicalSpecs,
  which: HoistEquipmentGroup
): 1 | 2 {
  return hoistEquipmentArrangement(specs, which) === "twin" ? 2 : 1;
}

/** Yardımcı kaldırmanın kendi arabası var mı. */
export function hasSeparateAuxTrolley(specs: TechnicalSpecs): boolean {
  return specs.auxTrolleyMode === "separate";
}

const HOIST_CLASS_SET: readonly string[] = ["H1", "H2", "H3", "H4"];
const LOAD_GROUP_SET: readonly string[] = ["B1", "B2", "B3", "B4", "B5", "B6"];

/**
 * "H3/B4" biçimindeki serbest metin kaldırma sınıfını ayrıştırır.
 *
 * Ayırıcı olarak "/", "-" veya boşluk kabul edilir; küçük harf ve fazladan
 * boşluklar tolere edilir; parçaların sırası önemli değildir ("B4/H3" de olur).
 * Tanınmayan veya eksik parçalar `undefined` döner — bozuk girdi hata atmaz.
 *
 * Örnekler:
 *   "H3/B4"  -> { hoistClass: "H3", loadGroup: "B4" }
 *   "h3 - b4"-> { hoistClass: "H3", loadGroup: "B4" }
 *   "H3"     -> { hoistClass: "H3" }
 *   "X9/B4"  -> { loadGroup: "B4" }
 *   ""       -> {}
 */
export function parseHoistLoadClass(v: string): {
  hoistClass?: HoistClass;
  loadGroup?: LoadGroup;
} {
  if (typeof v !== "string") return {};

  const out: { hoistClass?: HoistClass; loadGroup?: LoadGroup } = {};

  for (const raw of v.split(/[/\-\s,]+/)) {
    const token = raw.trim().toUpperCase();
    if (token === "") continue;
    // İlk geçerli eşleşme kazanır; sonraki tekrarlar yok sayılır.
    if (out.hoistClass === undefined && HOIST_CLASS_SET.includes(token)) {
      out.hoistClass = token as HoistClass;
      continue;
    }
    if (out.loadGroup === undefined && LOAD_GROUP_SET.includes(token)) {
      out.loadGroup = token as LoadGroup;
    }
  }

  return out;
}

/**
 * Bu kaldırma grubunda tambur emniyet freni var mı?
 *
 * Emniyet freni bir vinç özelliği değil KALDIRMA GRUBU özelliğidir: tamburun
 * flanşına oturur, dolayısıyla ana ve yardımcı kaldırmada ayrı ayrı bulunur.
 * Monoray kaldırma gruplarında tambur emniyet freni uygulanmaz.
 *
 * Geriye dönük uyum: alan eskiden "Var"/"Yok" idi. Kayıtlı "Var" değeri
 * "yalnız ana kaldırmada" diye yorumlanır — eski revizyonlarda yardımcı
 * kaldırmaya sessizce fren eklenmesi yanlış olurdu.
 */
export function hasSafetyBrake(
  specs: Pick<TechnicalSpecs, "hoistSafetyBrake">,
  which: "main" | "aux" | "mono1" | "mono2"
): boolean {
  const scope = (specs.hoistSafetyBrake ?? "Yok").trim();
  if (scope === "Yok" || scope === "") return false;
  if (which === "main") return true;
  if (which === "aux") return scope.includes("Yardımcı");
  return false;
}
