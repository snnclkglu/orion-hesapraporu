// FİYAT TOPLAMI — tek yerde.
//
// Toplam ELLE GİRİLMEZ (SATIS-16'nın kuralı): satırlarla çelişen bir toplam,
// müşteriye giden belgede bulunabilecek en pahalı hatadır. Payload'a yazılır
// çünkü veritabanındaki `offer_revisions.total_amount` üretilmiş sütunu onu
// okur ve liste ekranı belgeyi açmadan tutarı gösterebilsin.

import type { OfferPaymentLine, OfferPriceLine, OfferPricing } from "./types";

/** Satırın net tutarı; miktar ya da fiyat eksikse `null` (sıfır DEĞİL). */
export function lineAmount(line: OfferPriceLine): number | null {
  if (line.qty === null || line.unitPrice === null) return null;
  const n = line.qty * line.unitPrice;
  return Number.isFinite(n) ? n : null;
}

/**
 * Toplama giren satırlar: gizlenmiş olmayan ve `inTotal` taşıyanlar.
 *
 * `inTotal: false` gerçek bir ihtiyaçtır — devralınan bir teklifte günlük
 * ücretli süpervizörlük satırı bilerek toplama katılmamıştı. Satırı silmek
 * bilgiyi, toplama katmak rakamı bozardı.
 */
export function totalledLines(lines: readonly OfferPriceLine[]): OfferPriceLine[] {
  return lines.filter((l) => !l.hidden && l.inTotal);
}

/**
 * Teklif toplamı. Hiç tutarı olan satır yoksa `null` döner — sıfır DEĞİL:
 * fiyatı henüz girilmemiş bir teklif "0 €" değil, "—"dir.
 */
export function offerTotal(lines: readonly OfferPriceLine[]): number | null {
  let toplam = 0;
  let varMi = false;
  for (const line of totalledLines(lines)) {
    const tutar = lineAmount(line);
    if (tutar === null) continue;
    toplam += tutar;
    varMi = true;
  }
  return varMi ? toplam : null;
}

/** Toplamı hesaplanmış hâliyle fiyat bloğu — kaydetme yolu bunu yazar. */
export function withTotal(pricing: OfferPricing): OfferPricing {
  const total = offerTotal(pricing.lines);
  return total === pricing.total ? pricing : { ...pricing, total };
}

/**
 * KDV cümlesi TEK bayraktan türer.
 *
 * Devralınan belgelerde aynı sayfada hem "KDV Dahil ödeme şekli aşağıda
 * belirtilen şekildedir" hem "Belirtilen fiyatlara KDV dahil değildir"
 * yazıyordu; ikisi birbirini yalanlıyordu. Cümleyi veriden üretmek çelişkiyi
 * imkânsız kılar.
 */
export function vatNote(vatIncluded: boolean): string {
  return vatIncluded
    ? "Belirtilen fiyatlara KDV dahildir."
    : "Belirtilen fiyatlara KDV dahil değildir.";
}

// ————————————————————————————————————————————————————— ödeme planı

/** Basılan satır metni: `%40 Avans Sipariş ile Nakit`. */
export function paymentLineText(line: Pick<OfferPaymentLine, "percent" | "desc" | "text">): string {
  const aciklama = (line.desc ?? "").trim();
  // YÜZDESİZ SATIR MEŞRUDUR: devralınan tekliflerde sabit tutarlı ve
  // yüzdesiz satırlar var ("Montaj Sonrası Kalan Nakit"). Serbest metin
  // yazılmışsa o korunur.
  if (line.percent === null || line.percent === undefined) return aciklama || line.text || "";
  return aciklama ? `%${line.percent} ${aciklama}` : `%${line.percent}`;
}

/**
 * Ödeme planının yüzde toplamı ve durumu.
 *
 * TOPLAM ZORLANMAZ, GÖSTERİLİR: kullanıcı planı yazarken ara adımlarda toplam
 * kaçınılmaz olarak 100'den farklıdır ve kaydetmeyi engellemek onu düzenlerken
 * kilitlerdi. Ekran yalnız "100 oldu / olmadı" der; karar insanındır.
 * Yüzdesiz satırlar toplama GİRMEZ ve ayrıca sayılır.
 */
export function paymentPercentTotal(lines: readonly OfferPaymentLine[]): {
  toplam: number;
  yuzdeli: number;
  yuzdesiz: number;
  tam: boolean;
} {
  let toplam = 0;
  let yuzdeli = 0;
  let yuzdesiz = 0;
  for (const l of lines) {
    if (l.hidden) continue;
    if (l.percent === null || l.percent === undefined) {
      yuzdesiz += 1;
      continue;
    }
    toplam += l.percent;
    yuzdeli += 1;
  }
  return { toplam, yuzdeli, yuzdesiz, tam: yuzdeli > 0 && Math.abs(toplam - 100) < 0.001 };
}
