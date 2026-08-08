// Para birimleri ve tutar biçimleme — Satış Takibi'nin ortak sözlüğü.
//
// Rakamlar ISO koduyla saklanır (TRY/EUR/USD), Türkçe adları yalnız sunumdadır.
// Karşılaştırılabilir tek büyüklük AVRO KARŞILIĞIDIR: firma satışını avroda
// toplar, kur satırın kendi kaydındadır (sözleşme anındaki kur).

export const CURRENCIES = ["EUR", "TRY", "USD"] as const;

export type Currency = (typeof CURRENCIES)[number];

export const CURRENCY_LABELS: Record<Currency, string> = {
  EUR: "Avro",
  TRY: "Türk Lirası",
  USD: "Amerikan Doları",
};

/** Tablo başlığı ve dar sütunlar için kısa simge. */
export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  EUR: "€",
  TRY: "₺",
  USD: "$",
};

export function currencyOf(value: string | null | undefined): Currency {
  return (CURRENCIES as readonly string[]).includes(value ?? "")
    ? (value as Currency)
    : "EUR";
}

/**
 * Kur alanının anlamı: 1 avro kaç birim `currency` eder.
 * Avro satırlarında her zaman 1'dir; kullanıcıya sorulmaz.
 */
export function defaultFxRate(currency: Currency): number | null {
  return currency === "EUR" ? 1 : null;
}

const NUM = new Intl.NumberFormat("tr-TR", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const NUM_FIXED = new Intl.NumberFormat("tr-TR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Sayıyı tr-TR biçiminde döndürür; boş/geçersizse tire. */
export function fmtNum(v: number | string | null | undefined, fixed = false): string {
  if (v === null || v === undefined || v === "") return "—";
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return "—";
  return (fixed ? NUM_FIXED : NUM).format(n);
}

/** Tutar + para birimi simgesi ("1.575.000 €"). */
export function fmtMoney(
  v: number | string | null | undefined,
  currency: Currency | string | null | undefined
): string {
  const s = fmtNum(v);
  if (s === "—") return s;
  return `${s} ${CURRENCY_SYMBOLS[currencyOf(currency)]}`;
}

/**
 * Büyük tutarları kısaltır (kart başlıkları için): 5.752.874 → "5,75 M€".
 * Tabloda KULLANILMAZ — orada tam sayı görünmelidir.
 */
export function fmtCompactEur(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${NUM_FIXED.format(v / 1_000_000)} M€`;
  if (abs >= 1_000) return `${NUM.format(v / 1_000)} B€`;
  return `${NUM.format(v)} €`;
}

/**
 * Kullanıcının yazdığı sayıyı okur: "1.575.000,50" ve "1575000.50" ikisi de
 * geçerlidir. Türkçe klavyede ondalık ayıracı virgüldür; nokta binlik ayıracı
 * olarak yazılır. Boş metin `null` döner (alan doldurulmamış demektir).
 */
export function parseNum(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;
  // Hem "1.234,5" hem "1234.5" desteklenir: virgül varsa nokta binliktir.
  const normalized = s.includes(",")
    ? s.replace(/\./g, "").replace(",", ".")
    : s.replace(/(\d)\.(?=\d{3}\b)/g, "$1");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}
