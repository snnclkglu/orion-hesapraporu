// Sadece development: silme onayı kartlarını auth/veritabanı olmadan görsel
// olarak denetlemek için sahte veri kullanır.

import { notFound } from "next/navigation";
import {
  DeletionRequestsView,
  type DeletionRequestRow,
} from "@/app/(app)/admin/deletion-requests/requests-view";
import { PageHeader } from "@/components/page-header";

const ROWS: DeletionRequestRow[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    entityType: "project",
    targetLabel: "Hesap raporu ORN-2026-014 · 40 t Portal Vinç",
    targetPath: "/projects/11111111-1111-4111-8111-111111111111",
    snapshot: { revision_count: 4, status: "active" },
    requestNote: "Mükerrer açılan rapor; doğru kayıt ORN-2026-013.",
    requesterName: "Ayşe Mühendis",
    requestedAt: "2026-08-20T08:35:00.000Z",
    status: "pending",
    reviewerName: "",
    reviewedAt: null,
    reviewNote: "",
    cleanupStatus: "not_required",
    cleanupError: "",
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    entityType: "employee_document",
    targetLabel: "Mehmet Yılmaz · Eski kimlik fotokopisi.pdf",
    targetPath: "/personnel/22222222-2222-4222-8222-222222222222",
    snapshot: { file_name: "kimlik-eski.pdf", size_bytes: 348120 },
    requestNote: "Yeni belge yüklendi.",
    requesterName: "İnsan Kaynakları",
    requestedAt: "2026-08-19T13:10:00.000Z",
    status: "approved",
    reviewerName: "Sistem Yöneticisi",
    reviewedAt: "2026-08-19T13:42:00.000Z",
    reviewNote: "Yeni belge doğrulandı.",
    cleanupStatus: "failed",
    cleanupError: "personnel: Geçici depo bağlantı hatası",
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    entityType: "job",
    targetLabel: "İş 0057 · Astor 1T ve 5T Vinçler",
    targetPath: "/jobs/33333333-3333-4333-8333-333333333333",
    snapshot: { item_count: 2, status: "completed" },
    requestNote: "",
    requesterName: "Planlama",
    requestedAt: "2026-08-18T09:00:00.000Z",
    status: "rejected",
    reviewerName: "Sistem Yöneticisi",
    reviewedAt: "2026-08-18T09:12:00.000Z",
    reviewNote: "Teslim edilmiş iş; arşive alınmalı.",
    cleanupStatus: "not_required",
    cleanupError: "",
  },
];

export default function DeletionRequestsPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return (
    <main className="mx-auto grid min-h-screen w-full max-w-5xl gap-5 p-4 sm:p-8">
      <PageHeader
        title="Silme Onayları"
        hint="Kalıcı silme talepleri ve değiştirilemeyen karar geçmişi"
      />
      <DeletionRequestsView rows={ROWS} />
    </main>
  );
}
