// İş emri durumu — tek tanım yeri.
//
// `projects.status` yalnız aktif/arşiv taşır; İŞİN akışı bundan zengindir:
// beklemeye alınan (pasif) ve tamamlanan işler ayrı durumlardır. Etiket, renk
// ve sıra burada tanımlanır; liste, detay ve filtreler buradan okur.

export const JOB_STATUSES = ["active", "passive", "completed", "archived"] as const;

export type JobStatus = (typeof JOB_STATUSES)[number];

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  active: "Aktif",
  passive: "Pasif",
  completed: "Tamamlandı",
  archived: "Arşiv",
};

/**
 * Durum noktasının rengi (Tailwind sınıfı). Aktif yeşil, pasif kehribar
 * (beklemede), tamamlandı kömür (kapanmış ama canlı kayıt), arşiv soluk gri.
 * KIRMIZI kullanılmaz: bu uygulamada kırmızı "kontrol sağlanmadı" demektir.
 */
export const JOB_STATUS_DOT: Record<JobStatus, string> = {
  active: "bg-success",
  passive: "bg-amber-500",
  completed: "bg-foreground",
  archived: "bg-muted-foreground/40",
};

/** Bilinmeyen/eski değerleri güvenli varsayılana indirger. */
export function jobStatusOf(value: unknown): JobStatus {
  return JOB_STATUSES.includes(value as JobStatus) ? (value as JobStatus) : "active";
}

export function jobStatusLabel(value: unknown): string {
  return JOB_STATUS_LABELS[jobStatusOf(value)];
}
