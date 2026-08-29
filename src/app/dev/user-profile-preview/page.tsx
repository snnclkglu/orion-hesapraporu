// Sadece development: yönetici kullanıcı profilini auth olmadan görsel sınar.
// Fikstür veritabanına yazılmaz; uzun ad, altı özet kartı, grafik, bölüm
// dağılımı, oturum ve denetim geçmişinin bütün yerleşim hâllerini taşır.

import { notFound } from "next/navigation";
import { UserProfileView } from "@/app/(app)/admin/users/[id]/user-profile-view";
import type { UsageMetricRow } from "@/lib/usage";
import { DEFAULT_PROFILE_SCORING_SETTINGS } from "@/lib/profile-scoring";

const NOW = "2026-08-29T12:00:00.000Z";

const usageRows: UsageMetricRow[] = Array.from({ length: 14 }, (_, index) => {
  const day = String(29 - index).padStart(2, "0");
  const sections = ["engineering", "drawings", "jobs", "purchasing"];
  return {
    session_id: `10000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    usage_date: `2026-08-${day}`,
    section: sections[index % sections.length],
    device_class: index % 4 === 0 ? "mobile" : index % 5 === 0 ? "tablet" : "desktop",
    started_at: `2026-08-${day}T07:30:00.000Z`,
    last_seen_at: index === 0 ? "2026-08-29T11:59:20.000Z" : `2026-08-${day}T09:15:00.000Z`,
    active_seconds: 900 + (index % 5) * 780,
    page_views: 3 + (index % 6),
  };
});

export default function UserProfilePreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return (
    <main className="mx-auto max-w-[92rem] p-3 sm:p-6">
      <UserProfileView
        profile={{
          id: "10000000-0000-4000-8000-000000000099",
          fullName: "ÖNİZLEME KULLANICISI UZUN AD SOYAD",
          email: "onizleme.kullanicisi@orioncranes.com",
          title: "Kıdemli Proje ve Hesap Mühendisi",
          role: "engineer",
          createdAt: "2026-05-03T08:00:00.000Z",
        }}
        usageRows={usageRows}
        usageAvailable
        actionCount30={18}
        auditEvents={[
          { id: 1, action: "revision.issue", createdAt: "2026-08-29T10:45:00.000Z" },
          { id: 2, action: "drawing.update", createdAt: "2026-08-28T13:20:00.000Z" },
          { id: 3, action: "job.update", createdAt: "2026-08-27T07:10:00.000Z" },
          { id: 4, action: "project.create", createdAt: "2026-08-25T08:40:00.000Z" },
        ]}
        nowIso={NOW}
        scoring={DEFAULT_PROFILE_SCORING_SETTINGS.user}
      />
    </main>
  );
}
