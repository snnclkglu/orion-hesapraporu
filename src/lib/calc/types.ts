// Hesap motoru çekirdek tipleri.
// Dört değer rolü: input (kullanıcı girer) -> computed (formül) ->
// selection (katalogdan seçim) -> check (kontrol).

export type MechanismClass = "M1" | "M2" | "M3" | "M4" | "M5" | "M6" | "M7" | "M8";
export type UsageClass = "T0" | "T1" | "T2" | "T3" | "T4" | "T5" | "T6" | "T7" | "T8" | "T9";
export type StructureClass = "A1" | "A2" | "A3" | "A4" | "A5" | "A6" | "A7" | "A8";
export type LoadGroup = "B1" | "B2" | "B3" | "B4" | "B5" | "B6";
export type HoistClass = "H1" | "H2" | "H3" | "H4";
export type DrumMaterial = "S235" | "S355";
export type ShaftMaterial = "S355JR" | "C25" | "C30" | "C35" | "4140+QT" | "4140";

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

/** Bir vinçte en çok kaç ek monoray kaldırma grubu tanımlanabilir. */
export const MAX_MONORAIL_COUNT = 2;

/** 01-TEKNİK ÖZELLİKLER girdileri */
export interface TechnicalSpecs {
  mainCapacityT: number;        // ana kaldırma kapasitesi [ton]
  mainLiftHeightM: number;      // ana kaldırma yüksekliği [m]
  mainLiftSpeedMpm: number;     // ana kaldırma hızı [m/dak]
  auxCapacityT: number;         // yardımcı kaldırma kapasitesi [ton]
  auxLiftHeightM: number;       // yardımcı kaldırma yüksekliği [m]
  auxLiftSpeedMpm: number;      // yardımcı kaldırma hızı [m/dak]
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
  hoistSafetyBrake?: string;    // kaldırma emniyet freni (Var/Yok)
  travelBrakeType?: string;     // yürütme freni tipi (manyetik/eldro)
  ambientTempMinC: number;      // ortam sıcaklığı alt sınırı [°C]
  ambientTempMaxC: number;      // ortam sıcaklığı üst sınırı [°C]
  supplyVoltage: string;        // besleme gerilimi
  controlVoltage: string;       // kumanda gerilimi
  spanM: number;                // açıklık [m]

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

  // --------------------------------------------- Yardımcı araba yürütme
  auxTrolleySpeedMpm?: number;
  auxTrolleyMechanismClass?: MechanismClass;
  auxTrolleyUsageClass?: UsageClass;

  // ------------------------------------------------------- Monoray 1
  mono1CapacityT?: number;
  mono1LiftHeightM?: number;
  mono1LiftSpeedMpm?: number;
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
