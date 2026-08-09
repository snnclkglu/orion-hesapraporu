// İş Takibi bölüm kabuğu: yetki kapısı + ortak başlık + bölüm rayı.
//
// Yetki her sayfada ayrı ayrı değil BURADA sorulur — üç ekran da aynı veriyi
// gösterir ve birinde unutulan kontrol sessiz bir sızıntı olurdu. Asıl engel
// yine RLS'tir (`can_see_work_log()`); buradaki yönlendirme yalnız kullanıcıya
// boş bir sayfa yerine anlamlı bir yer göstermek içindir.

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canSeeWorkLog } from "@/lib/roles";
import { WorkLogNav } from "./worklog-nav";

export default async function WorkLogLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
    : { data: null };

  if (!canSeeWorkLog(profile?.role)) redirect("/jobs");

  // ÜST BANT İKİ SATIRDIR, üç değil: bu bölümde asıl iş EKRANIN ALTINDA
  // (grafikler, tablolar). Başlık ile açıklama aynı satırda durur, yetki rozeti
  // sekme şeridinin sağ ucuna oturur — kendi satırını hak etmiyor.
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
        <h1 className="text-xl font-semibold tracking-tight">İş Takibi</h1>
        <p className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
          Atölyede hangi gün hangi işe kaç kişi çalıştı — adam·saat kaydı ve analizi
        </p>
      </div>

      <WorkLogNav
        badge={
          <span className="shrink-0 border border-primary/30 bg-primary/5 px-2 py-0.5 font-mono text-[10px] font-semibold tracking-[0.14em] text-primary uppercase">
            Yönetici · Müdür
          </span>
        }
      />

      {children}
    </div>
  );
}
