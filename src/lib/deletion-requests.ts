export const DELETION_ENTITY_TYPES = [
  "job",
  "project",
  "revision",
  "drawing_package",
  "offer",
  "offer_revision",
  "offer_cost_revision",
  "employee",
  "employee_document",
  "project_spec",
  "electrical_project",
  "manual_revision",
  "equipment_attachment",
] as const;

export type DeletionEntityType = (typeof DELETION_ENTITY_TYPES)[number];
export type DeletionRequestStatus = "pending" | "processing" | "approved" | "rejected";
export type DeletionCleanupStatus = "not_required" | "pending" | "completed" | "failed";

export const DELETION_ENTITY_LABELS: Record<DeletionEntityType, string> = {
  job: "İş",
  project: "Hesap raporu",
  revision: "Hesap revizyonu",
  drawing_package: "Teknik resim paketi",
  offer: "Teklif",
  offer_revision: "Teklif revizyonu",
  offer_cost_revision: "Maliyet revizyonu",
  employee: "Personel kaydı",
  employee_document: "Özlük belgesi",
  project_spec: "Teknik şartname",
  electrical_project: "Elektrik projesi",
  manual_revision: "El kitabı revizyonu",
  equipment_attachment: "Ekipman eki",
};

export const DELETION_STATUS_LABELS: Record<DeletionRequestStatus, string> = {
  pending: "Onay bekliyor",
  processing: "İşleniyor",
  approved: "Onaylandı",
  rejected: "Reddedildi",
};

export const DELETION_CLEANUP_LABELS: Record<DeletionCleanupStatus, string> = {
  not_required: "Dosya yok",
  pending: "Dosyalar temizlenecek",
  completed: "Dosyalar temizlendi",
  failed: "Dosya temizliği başarısız",
};

export interface DeletionStorageItem {
  bucket: string;
  path: string;
}

export function deletionStorageItems(value: unknown): DeletionStorageItem[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is DeletionStorageItem =>
      typeof item === "object" &&
      item !== null &&
      typeof (item as DeletionStorageItem).bucket === "string" &&
      typeof (item as DeletionStorageItem).path === "string" &&
      (item as DeletionStorageItem).bucket.length > 0 &&
      (item as DeletionStorageItem).path.length > 0
  );
}
