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

// ————————————————————————————————————————————————————————— iskonto

/**
 * BELGENİN SONUÇ TUTARI — iskonto varsa odur.
 *
 * Liste ekranı, analiz ve `offer_revisions.total_amount` bu sayıyı okur:
 * müşterinin ödeyeceği rakam neyse takip edilen rakam da odur. Satırların ham
 * toplamı (`offerTotal`) yine görünür kalır — iskontonun ne kadar olduğunu
 * ancak ikisi birlikte söyler.
 */
export function effectiveTotal(pricing: OfferPricing): number | null {
  const ham = offerTotal(pricing.lines);
  const iskontolu = pricing.discountTotal;
  if (iskontolu === null || iskontolu === undefined) return ham;
  return iskontolu;
}

/** İskonto tutarı (ham toplam − iskontolu toplam); yoksa `null`. */
export function discountAmount(pricing: OfferPricing): number | null {
  const ham = offerTotal(pricing.lines);
  const iskontolu = pricing.discountTotal;
  if (ham === null || iskontolu === null || iskontolu === undefined) return null;
  const fark = ham - iskontolu;
  return Math.abs(fark) < 0.005 ? null : fark;
}

/** İskonto oranı — TUTARDAN türetilir, ayrıca saklanmaz. */
export function discountPercent(pricing: OfferPricing): number | null {
  const ham = offerTotal(pricing.lines);
  const tutar = discountAmount(pricing);
  if (ham === null || ham === 0 || tutar === null) return null;
  return (tutar / ham) * 100;
}

function yuvarla(n: number, basamak = 2): number {
  const c = 10 ** basamak;
  return Math.round(n * c) / c;
}

/**
 * İSKONTOYU BİRİM FİYATLARA YANSITIR — toplam HEDEFİ birebir tutar.
 *
 * Kullanıcı isteği (17.08.2026): *"İstersem birim fiyatları da o oranda
 * düşürsün, yuvarlama yapsın ama toplam tutsun."* İki istek aynı anda
 * karşılanamaz gibi görünür (yuvarlanan satırların toplamı hedefi tutmaz) ve
 * çözüm ARTIĞI BİR SATIRA yazmaktır:
 *
 *   1. Her satırın birim fiyatı `hedef / ham` oranıyla çarpılır ve TAM SAYIYA
 *      yuvarlanır — firmanın bütün tekliflerinde birim fiyatlar tam sayıdır
 *      (55.900 €), kuruşlu bir birim fiyat belgeye yakışmaz.
 *   2. Yuvarlamadan doğan artık (birkaç avro) EN BÜYÜK TUTARLI satıra bindirilir;
 *      o satırın birim fiyatı iki hane hassasiyetle düzeltilir. Artığı bütün
 *      satırlara dağıtmak hepsini kuruşlu yapardı; en büyüğe bindirmek ise
 *      oransal olarak en az fark eden yerdir.
 *
 * YALNIZ TOPLAMA GİREN satırlar ölçeklenir: gizlenmiş satır belgede yoktur,
 * `inTotal: false` satır (günlük süpervizörlük ücreti) ise zaten toplamın
 * dışındadır ve bir iskonto pazarlığı onu değiştirmez. Fiyatı ya da miktarı
 * girilmemiş satıra DOKUNULMAZ (değişmez md. 4).
 */
export function applyDiscountToLines(
  lines: readonly OfferPriceLine[],
  target: number
): OfferPriceLine[] {
  const ham = offerTotal(lines);
  if (ham === null || ham <= 0 || !Number.isFinite(target) || target <= 0) return [...lines];

  const olcekli = (l: OfferPriceLine) =>
    !l.hidden && l.inTotal && l.qty !== null && l.qty > 0 && l.unitPrice !== null;
  const oran = target / ham;
  const yeni = lines.map((l) =>
    olcekli(l) ? { ...l, unitPrice: Math.round((l.unitPrice as number) * oran) } : l
  );

  const artik = target - (offerTotal(yeni) ?? 0);
  if (Math.abs(artik) >= 0.005) {
    let enBuyuk = -1;
    let enBuyukTutar = -Infinity;
    yeni.forEach((l, i) => {
      const tutar = olcekli(l) ? (lineAmount(l) ?? 0) : -Infinity;
      if (tutar > enBuyukTutar) {
        enBuyukTutar = tutar;
        enBuyuk = i;
      }
    });
    if (enBuyuk >= 0) {
      const l = yeni[enBuyuk];
      yeni[enBuyuk] = {
        ...l,
        unitPrice: yuvarla((l.unitPrice as number) + artik / (l.qty as number)),
      };
    }
  }
  return yeni;
}

/** Toplamı hesaplanmış hâliyle fiyat bloğu — kaydetme yolu bunu yazar. */
export function withTotal(pricing: OfferPricing): OfferPricing {
  const total = effectiveTotal(pricing);
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
