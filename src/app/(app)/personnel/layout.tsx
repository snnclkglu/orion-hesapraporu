// Personel bölüm kabuğu: yetki kapısı + ortak başlık + bölüm rayı.
//
// Yetki her sayfada ayrı ayrı değil BURADA sorulur — beş ekran da aynı kişisel
// veriyi gösterir ve birinde unutulan kontrol sessiz bir sızıntı olurdu. Asıl
// engel yine RLS'tir (`can_see_personnel()` + `personnel` bucket politikası);
// buradaki yönlendirme yalnız kullanıcıya boş bir sayfa yerine anlamlı bir yer
// göstermek içindir.

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canSeePersonnel } from "@/lib/roles";
import { PageHeader } from "@/components/page-header";
import { PersonnelNav } from "./personnel-nav";

export default async function PersonnelLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
    : { data: null };

  if (!canSeePersonnel((profile as { role?: string } | null)?.role)) redirect("/jobs");

  return (
    <div className="grid min-w-0 max-w-full gap-3 overflow-x-hidden">
      {/* Yetki rozeti PageHeader'ın children'ına (EYLEM yuvasına) KONMAZ;
          sayfa gövdesindedir. Eylem yuvası dar ekranda kendi satırını açar ve
          tek "eylem" bir bilgi rozetiyken o satır sırf rozet için ~40px yer
          yerdi — rozet bir eylem değil bir KÜNYEdir. */}
      <PageHeader
        title="Personel"
        hint="Künye ve özlük dosyaları, maaş ve fazla mesai, bordro, harcirah, kurlar"
      />
      <span className="w-fit border border-primary/30 bg-primary/5 px-2 py-0.5 font-mono text-[11px] font-semibold tracking-[0.14em] text-primary uppercase">
        Yönetici · Müdür
      </span>

      <PersonnelNav />

      {children}
    </div>
  );
}
