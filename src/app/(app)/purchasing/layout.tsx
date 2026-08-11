// Satın Alma bölüm kabuğu: yetki kapısı + ortak başlık + bölüm rayı.
//
// Yetki her sayfada ayrı ayrı değil BURADA sorulur (İş Takibi kabuğuyla aynı
// desen): beş ekran da aynı ticari veriyi gösterir ve birinde unutulan kontrol
// sessiz bir sızıntı olurdu. Asıl engel yine RLS'tir (`can_see_purchasing()`);
// buradaki yönlendirme kullanıcıya boş bir sayfa yerine anlamlı bir yer
// göstermek içindir.

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canSeePurchasing, tagsOf } from "@/lib/roles";
import { PageHeader } from "@/components/page-header";
import { PurchasingNav } from "./purchasing-nav";

export default async function PurchasingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Etiket sütunu iki denemede okunur — migration uygulanmadan önce sorgunun
  // tamamı düşerdi ve YÖNETİCİ bile bölüme giremezdi (kabuktaki kalıbın aynısı).
  let profil: { role?: string; tags?: string[] } | null = null;
  if (user) {
    const zengin = await supabase
      .from("profiles")
      .select("role, tags")
      .eq("id", user.id)
      .maybeSingle();
    profil = zengin.error
      ? (
          await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
        ).data
      : zengin.data;
  }

  if (!canSeePurchasing({ role: profil?.role ?? "", tags: tagsOf(profil?.tags) })) {
    redirect("/jobs");
  }

  return (
    <div className="grid gap-3">
      <PageHeader
        title="Satın Alma"
        hint="Talep havuzu, teklifler, siparişler; teslim ve ödeme takvimi"
      />
      {/* Yetki rozeti şeridin EYLEM yuvasında DEĞİL sayfanın içindedir: rozet
          bir eylem değil bir künyedir ve dar ekranda eylem satırını sırf kendisi
          için açtırmamalıdır (İş Takibi'nde belgelenen kural). */}
      <span className="w-fit border border-primary/30 bg-primary/5 px-2 py-0.5 font-mono text-[11px] font-semibold tracking-[0.14em] text-primary uppercase">
        Yönetici · Satın Alma · Planlama
      </span>

      <PurchasingNav />

      {children}
    </div>
  );
}
