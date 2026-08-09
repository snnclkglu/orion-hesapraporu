// Revizyon durumu — tek tanım yeri.
//
// Etiket ALTI ayrı yerde elle yazılıyordu ve yazımlar ayrışmıştı: proje
// listesi "Yayınlandı"/"Taslak", proje detayı · iş detayı · revizyon başlığı ·
// karşılaştırma seçicisi ise küçük harfle "yayınlandı"/"taslak" basıyordu.
// Aynı durum aynı ekranda iki türlü görünmemelidir; `job-status.ts` ve
// `drawings.ts` gibi etiket tek yerde durur.
//
// Rozet VARYANTI da buradadır: yayınlanmış revizyon dolu (marka) rozet,
// taslak sessiz rozettir.

export const REVISION_STATUSES = ["draft", "issued"] as const;

export type RevisionStatus = (typeof REVISION_STATUSES)[number];

export const REVISION_STATUS_LABELS: Record<RevisionStatus, string> = {
  draft: "Taslak",
  issued: "Yayınlandı",
};

/** Bilinmeyen/eski değerleri güvenli varsayılana (taslak) indirger. */
export function revisionStatusOf(value: unknown): RevisionStatus {
  return value === "issued" ? "issued" : "draft";
}

export function revisionStatusLabel(value: unknown): string {
  return REVISION_STATUS_LABELS[revisionStatusOf(value)];
}

/** Rozet varyantı — yayınlanmış dolu, taslak sessiz. */
export function revisionStatusVariant(value: unknown): "default" | "secondary" {
  return revisionStatusOf(value) === "issued" ? "default" : "secondary";
}
