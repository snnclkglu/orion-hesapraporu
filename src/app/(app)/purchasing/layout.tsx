// Satın Alma bölüm kabuğu: yetki kapısı + ortak başlık + bölüm rayı.
//
// Yetki her sayfada ayrı ayrı değil BURADA sorulur (İş Takibi kabuğuyla aynı
// desen): beş ekran da aynı ticari veriyi gösterir ve birinde unutulan kontrol
// sessiz bir sızıntı olurdu. Asıl engel yine RLS'tir (`can_see_purchasing()`);
// buradaki yönlendirme kullanıcıya boş bir sayfa yerine anlamlı bir yer
// göstermek içindir.

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canSeePurchasing } from "@/lib/roles";
import { PageHeader } from "@/components/page-header";
import { PurchasingNav } from "./purchasing-nav";

export default async function PurchasingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Yetki artık TEK BİR SÜTUNDAN okunur (12.08.2026): görev etiketleri role
  // dönüştü, `tags` sütunu düşürüldü. Etiket döneminden kalan "zengin sorgu +
  // dar yedek" ikilisi de bu yüzden kalktı — okunan alan `profiles`ın ilk
  // günden beri var olan `role` sütunudur, düşecek bir sorgu yoktur.
  const { data: profil } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
    : { data: null };

  if (!canSeePurchasing(profil?.role)) {
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
