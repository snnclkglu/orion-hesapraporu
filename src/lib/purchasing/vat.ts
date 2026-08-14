// KDV — Satın Alma'nın TEK KDV sözlüğü (saf çekirdek: DB/UI bağımlılığı yok).
//
// Dosya bir süre `consumable-vat.ts` adıyla yalnız sarf giderine hizmet
// ediyordu. Kullanıcı kararı (14.08.2026) KDV'yi SİPARİŞE de getirdi:
//
//   "Satın alma talep havuzunda sipariş açma bölümüne de Sarf Gideri Gir
//    bölümüyle aynı mantıkla kdv ekleyelim. 20 10 1 ve 0 % kdv olsun.
//    Kullanıcı hep kdv hariç fiyat girer, kdv otomatik gelir. Fiyat arşivi vb
//    diğer grafiklerde her zaman kdv hariç fiyat üzerinden gösterim yapılır."
//
// İKİ AYRI ORAN LİSTESİ TUTULMAZ. Sarf %0'ı tanımayıp sipariş tanısaydı, aynı
// modülde aynı soruya iki cevap olurdu ve hangi ekranın hangi listeyi kullandığı
// ancak koda bakarak anlaşılırdı. Liste burada tektir; veritabanındaki iki
// `check` kısıtı da bu listeyle aynı değerleri taşır (migration 20260814000004).
//
// KDV BİR SUNUM/ÖDEME HESABIDIR, DEFTER TUTARI DEĞİLDİR. `unit_price`,
// `amount`, `amount_eur` ve bunlardan türeyen HER analiz (fiyat arşivi, sarf
// panosu, tedarikçi dağılımı, sipariş akışı) KDV HARİÇ kalır. KDV yalnız
// faturanın kontrolünde ve ÖDEME TAKVİMİNDE görünür: kasadan çıkan para KDV
// dahildir. Bu ayrım ileride sessizce "vergi dahil analiz"e çevrilmez.

export const VAT_RATES = [20, 10, 1, 0] as const;

export type VatRate = (typeof VAT_RATES)[number];

/** Varsayılan oran — firmanın alımlarının büyük çoğunluğu. */
export const DEFAULT_VAT_RATE: VatRate = 20;

/**
 * Ham bir değeri geçerli bir orana indirger.
 *
 * Veritabanından `numeric` gelir (yani `20.00`), eski satırlarda `null` olabilir
 * ve elle yazılmış bir istek başka bir sayı taşıyabilir. TANINMAYAN DEĞER
 * VARSAYILANA DÜŞER, sıfıra değil: bilinmeyen bir oranı "KDV yok" saymak,
 * ödeme takvimini olduğundan düşük gösterirdi.
 */
export function vatRateOf(value: unknown): VatRate {
  const n = typeof value === "string" ? Number(value) : value;
  return (VAT_RATES as readonly number[]).includes(n as number)
    ? (n as VatRate)
    : DEFAULT_VAT_RATE;
}

export interface VatLine {
  /** KDV HARİÇ satır tutarı. */
  net: number;
  vatRate: VatRate;
}

export interface VatTotals {
  net: number;
  vat: number;
  gross: number;
}

/**
 * KDV hariç satırlardan üç toplam.
 *
 * Dönen `net`, veritabanına yazılan ve analizlerde kullanılan tutardır; `gross`
 * yalnız fatura kontrolü ve ödeme takvimi içindir.
 */
export function vatTotals(lines: readonly VatLine[]): VatTotals {
  let net = 0;
  let vat = 0;
  for (const line of lines) {
    if (!Number.isFinite(line.net) || line.net < 0) continue;
    net += line.net;
    vat += line.net * (line.vatRate / 100);
  }
  return { net, vat, gross: net + vat };
}

/** Sipariş satırı — adet × birim fiyat KDV HARİÇ tutarı verir. */
export interface OrderVatLine {
  qty: number;
  unitPrice: number | null;
  vatRate?: number | null;
}

/**
 * Bir siparişin üç toplamı.
 *
 * Ekran, ödeme takvimi ve pencereler aynı fonksiyonu çağırır; üç yerde ayrı
 * yazılsaydı biri er geç KDV'yi başka orandan sayardı (`purchase_order_totals`
 * görünümünün SQL'de var olma gerekçesinin aynısı).
 */
export function orderVatTotals(lines: readonly OrderVatLine[]): VatTotals {
  return vatTotals(
    lines.map((l) => ({
      net: (Number(l.qty) || 0) * (l.unitPrice ?? 0),
      vatRate: vatRateOf(l.vatRate),
    }))
  );
}
