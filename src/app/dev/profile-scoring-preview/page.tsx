import { notFound } from "next/navigation";
import { ProfileScoringForm } from "@/app/(app)/admin/profile-scoring/profile-scoring-form";
import { DEFAULT_PROFILE_SCORING_SETTINGS } from "@/lib/profile-scoring";

export default function ProfileScoringPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return (
    <main className="mx-auto grid max-w-[92rem] gap-5 p-3 sm:p-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Profil Puanlama</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Kullanıcı etkinliği ve müşteri ilişkisi puanlarının ağırlıklarını yönetin.
        </p>
      </div>
      <ProfileScoringForm initial={DEFAULT_PROFILE_SCORING_SETTINGS} />
    </main>
  );
}
