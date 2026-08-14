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

const NUM_TAM = new Intl.NumberFormat("tr-TR", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** Sayıyı tr-TR biçiminde döndürür; boş/geçersizse tire. */
export function fmtNum(v: number | string | null | undefined, fixed = false): string {
  if (v === null || v === undefined || v === "") return "—";
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return "—";
  return (fixed ? NUM_FIXED : NUM).format(n);
}

/**
 * TUTAR — ONDALIKSIZ, BİNLİK AYIRAÇLI: `200000` → `200.000`.
 *
 * KULLANICI KARARI (13.08.2026): "Sayfalarda tutarlarda virgülden sonraki
 * kısımlar görünmesin." Gerekçe ekrandan okundu: bir maaş listesinde aranan
 * şey "kim ne kadar aldı"dır, kuruş değil; ",00" her sütunu üç karakter
 * genişletiyor ve on üç sütunlu bir tabloyu ekranın dışına itiyordu.
 *
 * KURUŞ GEREKEN YER BORDRODUR ve orada tam basılır (`lib/pdf/bordro`): ücret
 * hesap pusulası 4857 md. 37'ye göre denetlenebilir olmalıdır ve bir kuruşluk
 * fark orada gerçek bir hatadır. Bu fonksiyon EKRAN içindir.
 *
 * `Math.round` AÇIKÇA yapılır, `maximumFractionDigits: 0`a bırakılmaz:
 * biçimleyicinin yuvarlaması yerel ayara bağlı bir davranıştır ve toplamlar
 * ile satırların ayrı ayrı yuvarlanması bir liralık sapma bırakabilir. Sapma
 * kalmasın diye toplamlar HAM sayıdan alınır, yalnız basılırken yuvarlanır.
 */
export function fmtTutar(v: number | string | null | undefined): string {
  if (v === null || v === undefined || v === "") return "—";
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return "—";
  return NUM_TAM.format(Math.round(n));
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

const NUM_1 = new Intl.NumberFormat("tr-TR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/**
 * Grafik ÜSTÜNE yazılan nokta değeri (kullanıcı kararı, 14.08.2026):
 * "grafik üstüne değeri yazalım, virgülden sonra 1 basamak olsun". Kısaltma
 * biçimi `fmtCompactEur` ile aynıdır ama ondalık HER ZAMAN tam bir basamaktır:
 * eksende 2 haneye kadar açılan değer, eğrinin üstünde tek basamağa iner ki
 * on iki ayın etiketi yan yana okunabilsin. Sıfır "0,0 €" olur, tire değil —
 * grafik noktası gerçek bir sıfırdır (kayıtsız ay), boş bir hücre değil.
 */
export function fmtCompactEur1(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${NUM_1.format(v / 1_000_000)} M€`;
  if (abs >= 1_000) return `${NUM_1.format(v / 1_000)} B€`;
  return `${NUM_1.format(v)} €`;
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
