// TEKLİFİN DURUMU — tek tanım yeri (`job-status.ts` · `revision-status.ts` deseni).
//
// Durum TEKLİFİN KENDİSİNE aittir, revizyonuna değil: bir teklif kazanılır ya
// da kaybedilir, "üçüncü revizyonu kazanıldı" diye bir olgu yoktur. Revizyonun
// kendi durumu (taslak / yayınlandı) AYRI bir sorudur ve `revision_status`tur.

export const OFFER_STATUSES = ["draft", "budgetary", "sent", "won", "lost", "cancelled"] as const;

export type OfferStatus = (typeof OFFER_STATUSES)[number];

export const OFFER_STATUS_LABELS: Record<OfferStatus, string> = {
  draft: "Hazırlanıyor",
  budgetary: "Bütçesel",
  sent: "Gönderildi",
  won: "Kazanıldı",
  lost: "Kaybedildi",
  cancelled: "İptal",
};

/**
 * Durum rengi OKLCH TON AÇISIDIR, hex değil (değişmez md. 6): aynı hex açık ve
 * koyu temada birden okunmaz. Doygunluk/parlaklık `globals.css` `.oc-tag`
 * kuralındadır ve tema başına verilir.
 */
export const OFFER_STATUS_HUES: Record<OfferStatus, number> = {
  draft: 250,
  budgetary: 285,
  sent: 210,
  won: 150,
  lost: 25,
  cancelled: 0,
};

export function offerStatusOf(value: string | null | undefined): OfferStatus {
  return (OFFER_STATUSES as readonly string[]).includes(value ?? "")
    ? (value as OfferStatus)
    : "draft";
}

export function offerStatusLabel(value: string | null | undefined): string {
  return OFFER_STATUS_LABELS[offerStatusOf(value)];
}

export function offerStatusHue(value: string | null | undefined): number {
  return OFFER_STATUS_HUES[offerStatusOf(value)];
}

/** Sonuçlanmış teklif — listede varsayılan olarak arka plana çekilir. */
export function isClosedOffer(value: string | null | undefined): boolean {
  const s = offerStatusOf(value);
  return s === "won" || s === "lost" || s === "cancelled";
}

/** Bütçesel çalışma gerçek bir satın alma fırsatı değildir; Analiz'e girmez. */
export function isOfferIncludedInAnalysis(value: string | null | undefined): boolean {
  return offerStatusOf(value) !== "budgetary";
}
