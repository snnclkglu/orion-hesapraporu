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
