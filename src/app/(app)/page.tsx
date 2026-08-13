// AÇILIŞ SAYFASI — giriş sonrası ilk ekran.
//
// Adres KÖKTÜR (`/`) ve bu bilinçlidir: giriş sonrası bir yönlendirme zinciri
// (`/` → `/panel` → …) her oturumda bir fazladan gidiş-dönüş eder ve tarayıcı
// geçmişinde geri tuşunu kırar. Sayfa `(app)` grubunun içindedir, yani kabuğu
// ve yetki kapısını diğer bölümlerle paylaşır.
//
// Sayfa VERİYİ TOPLAR, çizmeyi `PanelView`e bırakır: aynı görünümü auth'suz
// önizleme de basar (`/dev/panel-preview`) ve iki kopya zamanla ayrışırdı.

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { bugunIstanbul, loadPanel } from "./panel/data";
import { PanelView } from "./panel/panel-view";

export default async function PanelPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Kabuk zaten oturum ister; buradaki kontrol `user.id`yi tipe kazandırmak
  // içindir ("sana ait" sorgusu onunla süzülür).
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .maybeSingle();

  const role = profile?.role ?? "engineer";
  const today = bugunIstanbul();
  const data = await loadPanel(supabase, { role, userId: user.id, today });

  return (
    <PanelView
      data={data}
      role={role}
      displayName={profile?.full_name || user.email || ""}
      today={today}
    />
  );
}
