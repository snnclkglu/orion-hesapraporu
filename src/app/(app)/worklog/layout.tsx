// İş Takibi bölüm kabuğu: yetki kapısı + ortak başlık + bölüm rayı.
//
// Yetki her sayfada ayrı ayrı değil BURADA sorulur — üç ekran da aynı veriyi
// gösterir ve birinde unutulan kontrol sessiz bir sızıntı olurdu. Asıl engel
// yine RLS'tir (`can_see_work_log()`); buradaki yönlendirme yalnız kullanıcıya
// boş bir sayfa yerine anlamlı bir yer göstermek içindir.

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canSeeWorkLog } from "@/lib/roles";
import { PageHeader } from "@/components/page-header";
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

  // Bölümün üstünde artık YALNIZ sekme şeridi var: başlık, açıklama ve yetki
  // rozeti kabuğun üst şeridine taşındı. Bu bölümde asıl iş ekranın ALTINDA
  // (grafikler, çapraz tablolar) — üst bant ne kadar incelirse o kadar iyi.
  return (
    <div className="grid gap-3">
      <PageHeader
        title="İş Takibi"
        hint="Atölyede hangi gün hangi işe kaç kişi çalıştı — adam·saat kaydı ve analizi"
      >
        <span className="shrink-0 border border-primary/30 bg-primary/5 px-2 py-0.5 font-mono text-[10px] font-semibold tracking-[0.14em] text-primary uppercase">
          Yönetici · Müdür
        </span>
      </PageHeader>

      <WorkLogNav />

      {children}
    </div>
  );
}
