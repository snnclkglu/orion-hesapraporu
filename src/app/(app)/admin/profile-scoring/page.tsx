import { createClient } from "@/lib/supabase/server";
import { profileScoringSettingsOf } from "@/lib/profile-scoring";
import { ProfileScoringForm } from "./profile-scoring-form";

export default async function ProfileScoringPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "profile_scoring")
    .maybeSingle();

  return (
    <div className="grid gap-5">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Profil Puanlama</h2>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Kullanıcı etkinliği ve müşteri ilişkisi puanlarının ağırlıklarını yönetin. Bu göstergeler
          performans, ücret veya kredi değerlendirmesi değildir; profil ekranındaki kayıtlı etkinliği özetler.
        </p>
      </div>
      <ProfileScoringForm initial={profileScoringSettingsOf(data?.value)} />
    </div>
  );
}
