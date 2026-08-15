// Satın Alma sözlüğü — ödeme koşulu, avans, teslim ve ödeme günü hesabı.
//
// Saf çekirdek: DB/UI bağımlılığı yok. Ekran, Excel çıktısı ve takvim sayfaları
// aynı bağıntıları buradan okur — ödeme gününü iki yerde hesaplamak, finansa
// verilen iki listenin farklı sayı söylemesi demektir.

import { type Currency, currencyOf } from "@/lib/currency";

// ═══════════════════════════════════════════════════════════ ÖDEME KOŞULU
//
// Kullanıcının açılır listesi karışık iki kavram içeriyor: "Peşin" ve "Kredi
// Kartı" bir ÖDEME BİÇİMİ, "30 gün" bir VADEdir. Veritabanı ikisini ayrı
// tutar (`payment_method` + `payment_term_days`); arayüz tek listede birleştirir
// çünkü satınalmacının kafasında tek bir soru var: "nasıl ödeyeceğiz?"

export const PAYMENT_METHODS = ["pesin", "kredi_karti", "vadeli"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  pesin: "Peşin",
  kredi_karti: "Kredi Kartı",
  vadeli: "Vadeli",
};

/** Açılır listenin bir seçeneği — biçim + gün birlikte. */
export interface PaymentTermOption {
  value: string;
  label: string;
  method: PaymentMethod;
  days: number;
}

/**
 * Hazır seçenekler. Kullanıcının istediği liste birebir budur:
 * "Peşin, Kredi Kartı, 15 gün 30 gün 45 gün 60 gün 90 gün gibi".
 *
 * "gibi" sözcüğü önemli: liste KAPALI DEĞİLDİR. Arayüz ayrıca serbest gün
 * girişi sunar ve veritabanı 0–365 arasını kabul eder — 120 gün gerektiğinde
 * migration yazmak gerekmemeli (Satış Takibi'ndeki `SALE_SCOPES` kuralının
 * aynısı: sabit seçenekler gerçek kullanımdan çıkarıldı ama liste kapalı değil).
 */
export const PAYMENT_TERMS: PaymentTermOption[] = [
  { value: "pesin", label: "Peşin", method: "pesin", days: 0 },
  { value: "kredi_karti", label: "Kredi Kartı", method: "kredi_karti", days: 0 },
  { value: "15", label: "15 gün", method: "vadeli", days: 15 },
  { value: "30", label: "30 gün", method: "vadeli", days: 30 },
  { value: "45", label: "45 gün", method: "vadeli", days: 45 },
  { value: "60", label: "60 gün", method: "vadeli", days: 60 },
  { value: "90", label: "90 gün", method: "vadeli", days: 90 },
];

/** Kayıttaki (biçim, gün) çiftinden açılır listenin değerini bulur. */
export function paymentTermValue(method: string, days: number): string {
  const m = methodOf(method);
  if (m !== "vadeli") return m;
  const hazir = PAYMENT_TERMS.find((t) => t.method === "vadeli" && t.days === days);
  return hazir ? hazir.value : "ozel";
}

/**
 * Açılır liste + KAYITTAKİ DEĞER.
 *
 * Listede olmayan bir vade (devralınan ya da elle girilmiş "120 gün") kendi
 * seçeneği olarak korunur; korunmasaydı kutu boş görünür ve ilk kaydetmede
 * sessizce "Peşin"e düşerdi (`leadTimeOptions` ile aynı kural).
 */
export function paymentTermOptions(method: string, days: number): PaymentTermOption[] {
  const v = paymentTermValue(method, days);
  if (v !== "ozel") return PAYMENT_TERMS;
  return [...PAYMENT_TERMS, { value: String(days), label: `${days} gün`, method: "vadeli", days }];
}

/** Açılır listenin değerinden (biçim, gün) çiftini kurar. */
export function paymentTermFrom(value: string): { method: PaymentMethod; days: number } {
  const hazir = PAYMENT_TERMS.find((t) => t.value === value);
  if (hazir) return { method: hazir.method, days: hazir.days };
  const gun = Number.parseInt(value, 10);
  return Number.isFinite(gun) && gun > 0
    ? { method: "vadeli", days: gun }
    : { method: "pesin", days: 0 };
}

export function methodOf(value: string | null | undefined): PaymentMethod {
  return (PAYMENT_METHODS as readonly string[]).includes(value ?? "")
    ? (value as PaymentMethod)
    : "pesin";
}

/** Ödeme koşulunun insan okunur özeti: "Vadeli · 45 gün". */
export function paymentTermLabel(method: string, days: number): string {
  const m = methodOf(method);
  if (m !== "vadeli") return PAYMENT_METHOD_LABELS[m];
  return `${days} gün vadeli`;
}

/**
 * HIZLI TERMİN — "kaç hafta sonra".
 *
 * Sarf girişinde 1–8 hafta vardı; kullanıcı sipariş penceresi için uzun
 * terminleri de istedi (14.08.2026): *"Sipariş aç termine ayrıca 10 12 16 20
 * hafta olarak termin haftası eklemesi de yapalım."* Redüktör, motor ve tampon
 * gibi kalemlerde tedarikçinin verdiği süre aylarla ölçülür ve her seferinde
 * takvimden gün saymak gerçek bir iş kaybıydı.
 *
 * LİSTE TEKTİR ve iki ekran da onu okur: iki ayrı dizi tutulsaydı biri
 * güncellenip diğeri unutulurdu. Sarfın kısa terminleri listenin başında zaten
 * duruyor, yani orada hiçbir şey kaybolmaz.
 */
export const DELIVERY_WEEKS = [1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 16, 20] as const;

// ══════════════════════════════════════════════════════ TEKLİF TESLİM SÜRESİ
//
// Kullanıcı kararı (15.08.2026): *"Teslim dropdown gelsin. Hemen 1 2 3 4 5 6 8
// hafta seçilebilsin."*
//
// SİPARİŞTEKİ HIZLI TERMİNDEN AYRI BİR LİSTEDİR ve olmalıdır: orada seçilen şey
// bir TARİHtir (sipariş günü + n hafta), burada seçilen şey tedarikçinin beyan
// ettiği SÜREdir ve gün olarak saklanır (`purchase_quotes.lead_time_days`).
// Aynı diziyi iki anlama birden koşmak, sipariş tarihi değiştiğinde teklifin
// teslim süresini de kaydırırdı.
//
// İKİ UÇ AYRI DEĞERDİR: `0` = HAZIR (stokta), `null` = tedarikçi SÖYLEMEDİ.
// Tek bir "—" ikisini birden anlatsaydı karşılaştırmada stoktaki mal ile
// bilinmeyen termin aynı görünürdü.
export const QUOTE_LEAD_WEEKS = [1, 2, 3, 4, 5, 6, 8] as const;

export interface LeadTimeOption {
  /**
   * Açılır listenin değeri; `"yok"` = sorulmadı.
   *
   * BOŞ DİZGE KULLANILMAZ: Radix `Select.Item` boş değeri kabul etmez (kutuyu
   * "değer yok" hâline döndürmek için o değeri kendine ayırır) ve ekran
   * çalışma anında patlar.
   */
  value: string;
  label: string;
  /** Gün karşılığı; `null` = sorulmadı. */
  days: number | null;
}

export const QUOTE_LEAD_TIMES: LeadTimeOption[] = [
  { value: "yok", label: "Sorulmadı", days: null },
  { value: "0", label: "Hemen (stokta)", days: 0 },
  ...QUOTE_LEAD_WEEKS.map((h) => ({
    value: String(h * 7),
    label: `${h} hafta (${h * 7} gün)`,
    days: h * 7,
  })),
];

/**
 * Kayıttaki gün sayısından açılır listenin değerini bulur.
 *
 * LİSTE KAPALI DEĞİLDİR (`SALE_SCOPES` kuralı): devralınan ya da elle girilmiş
 * bir "20 gün" listede yoktur ve seçici onu KENDİ seçeneği olarak korur —
 * korumasaydı dolu bir alan ekranda boş görünür ve kullanıcı üzerine yazardı.
 */
export function leadTimeOptions(mevcut: number | null): LeadTimeOption[] {
  if (mevcut == null || QUOTE_LEAD_TIMES.some((o) => o.days === mevcut)) return QUOTE_LEAD_TIMES;
  return [
    ...QUOTE_LEAD_TIMES,
    { value: String(mevcut), label: `${mevcut} gün`, days: mevcut },
  ];
}

// ═══════════════════════════════════════════════════════════════════ AVANS
//
// İki yol: açılır listeden yüzde, ya da elle tutar. İkisi de İSTEĞE BAĞLIDIR
// (kullanıcı: "Avans miktarı da zorunlu olmasada girilebilsin").

export const ADVANCE_PERCENTS = [5, 10, 15, 20, 25, 30, 40, 50] as const;

/**
 * Siparişin avans tutarı.
 *
 * TUTAR YÜZDEYİ YENER: elle yazılmış bir sayı, bir orandan türetilenden daha
 * kesindir — tedarikçi çoğu zaman yuvarlak bir rakam ister ("10.000 € avans")
 * ve o rakam toplamın tam %20'si olmayabilir.
 */
export function advanceAmount(
  toplam: number,
  advancePct: number | null,
  advanceAmountRaw: number | null
): number {
  if (advanceAmountRaw != null && advanceAmountRaw > 0) return advanceAmountRaw;
  if (advancePct != null && advancePct > 0) return (toplam * advancePct) / 100;
  return 0;
}

// ═══════════════════════════════════════════════════════ TARİH BAĞINTILARI

/** `YYYY-MM-DD` — YEREL gün, UTC değil (bir günlük kayma terminleri bozar). */
export function bugunISO(): string {
  const d = new Date();
  return isoGun(d);
}

export function isoGun(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export function gunEkle(iso: string, gun: number): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  d.setDate(d.getDate() + gun);
  return isoGun(d);
}

/** İki ISO gün arasındaki fark (gün). Geçersiz tarihte `null`. */
export function gunFarki(iso: string | null | undefined, referans = bugunISO()): number | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const hedef = new Date(`${iso}T00:00:00`);
  const ref = new Date(`${referans}T00:00:00`);
  if (Number.isNaN(hedef.getTime())) return null;
  return Math.round((hedef.getTime() - ref.getTime()) / 86_400_000);
}

export function tarihGoster(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("tr-TR");
}

/**
 * ÖDEME GÜNÜ — kullanıcının açık kuralı (md. 11):
 *
 *   "Ödeme vadesi var ise ÜRÜN TESLİMİ + vade süresi şeklinde öderiz.
 *    Sipariş tarihi + Vade DEĞİL."
 *
 * Mal henüz gelmediyse beklenen teslim (termin) esas alınır: takvim bir
 * tahmindir ve tahminin dayanağı da tahmin olabilir. Ne teslim ne termin
 * varsa ödeme günü YOKTUR — sipariş tarihine düşmek, kuralın tam tersini
 * yapmak olurdu.
 *
 * `purchase_order_totals` görünümündeki SQL ile aynı bağıntı; ikisi
 * ayrışırsa ekran ile Excel farklı gün söyler.
 */
export function odemeGunu(o: {
  dueAt: string | null;
  receivedAt: string | null;
  paymentTermDays: number;
}): string | null {
  const taban = o.receivedAt || o.dueAt;
  if (!taban) return null;
  return o.paymentTermDays > 0 ? gunEkle(taban, o.paymentTermDays) : taban;
}

/** Avans ödemesi SİPARİŞ GÜNÜNDE yapılır — vadesi yoktur, peşinatın tanımı budur. */
export function avansGunu(o: { orderedAt: string }): string {
  return o.orderedAt;
}

// ═══════════════════════════════════════════════════════════════ DÖNEMLER

/** Bir ay ya da haftanın kimliği + insan okunur adı. */
export interface Donem {
  key: string;
  label: string;
  /** Dönemin ilk günü (ISO) — sıralama buna göre. */
  start: string;
}

const AYLAR = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

export function ayDonemi(iso: string): Donem {
  const [y, m] = iso.split("-");
  return {
    key: `${y}-${m}`,
    label: `${AYLAR[Number(m) - 1] ?? m} ${y}`,
    start: `${y}-${m}-01`,
  };
}

/**
 * ISO hafta dönemi — hafta PAZARTESİ başlar.
 *
 * Atölye takvimi pazartesi başlar ve "bu hafta ne geliyor" sorusunun cevabı
 * pazar günü değişmemelidir. `getDay()` pazarı 0 verir; kaydırma bu yüzden var.
 */
export function haftaDonemi(iso: string): Donem {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return { key: iso, label: iso, start: iso };
  const gun = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - gun);
  const bas = isoGun(d);
  const son = gunEkle(bas, 6);
  return {
    key: `H${bas}`,
    label: `${tarihGoster(bas)} – ${tarihGoster(son)}`,
    start: bas,
  };
}

// ═══════════════════════════════════════════════════════════════════ PARA

/**
 * Avro karşılığı.
 *
 * `job_item_sales` ile AYNI sözleşme: `fxRate` = 1 avro kaç birim `currency`
 * eder. Kur yoksa `null` — SIFIR DEĞİL. Sıfır "bedava" derdi ve toplamlara
 * sessizce girerdi; `null` "bu satır avro toplamına giremez" der ve ekran
 * onu ayrıca sayar (Satış Takibi'nin kuralının aynısı).
 */
export function eurKarsiligi(
  tutar: number | null | undefined,
  currency: string | null | undefined,
  fxRate: number | null | undefined
): number | null {
  if (tutar == null || !Number.isFinite(tutar)) return null;
  if (currencyOf(currency) === "EUR") return tutar;
  if (fxRate == null || !Number.isFinite(fxRate) || fxRate <= 0) return null;
  return tutar / fxRate;
}

/** Kur zorunlu mu? Avro dışı her para birimi için EVET (kullanıcı kararı). */
export function kurGerekli(currency: Currency | string | null | undefined): boolean {
  return currencyOf(currency) !== "EUR";
}
