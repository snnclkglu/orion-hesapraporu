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
import { bugunISO } from "@/lib/purchasing/terms";
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

  // GECİKME ROZETİ İÇİN UCUZ SAYIM (kullanıcı kararı, 16.08.2026): bölümün
  // neresinde olursa olsun "bugün ne acil" görünmeli. Sayım `head: true` ile
  // satır taşımaz; "bugün" İSTANBUL saatiyledir (`bugunISO` — Vercel UTC'de
  // koşar ve gece 00:00–03:00 arasında naif tarih bir gün geri kayardı, panel
  // PANEL-23'ün dersi). Ekipman/Hammadde için "bekleyen kalem" rozeti BİLEREK
  // yok: o sayı ancak havuz türetmesiyle çıkar ve her sayfa açılışında havuzu
  // kurmak bir rozet için çok pahalıdır.
  const { count: gecikmisSiparis } = await supabase
    .from("purchase_orders")
    .select("id", { count: "exact", head: true })
    .is("cancelled_at", null)
    .is("received_at", null)
    .lt("due_at", bugunISO());

  return (
    <div className="oc-purchasing-surface grid gap-2 sm:gap-3">
      {/* YETKİ ROZETİ ÜST BARDADIR (kullanıcı kararı, 14.08.2026: "üst bara
          alalım, bu bölümde yer kaybetmemiş oluruz"). Önce sayfanın içinde ayrı
          bir satırdaydı ve bir künye olduğu için oraya konmuştu; ama o satır
          bölümün en dar olduğu yerde bir kat yer yiyordu. `PageHeader`ın
          çocukları EYLEM yuvasına (üst şeridin sağı) portallanır — rozet orada
          `lg` üstünde başlığın hizasında durur, `lg` altında kendi satırında
          yatay kayar ve dikey yer yemez. */}
      <PageHeader
        title="Satın Alma"
        hint="Proje alımları, fiyat geçmişi ve fabrikanın sarf giderleri"
      >
        <span className="border border-primary/30 bg-primary/5 px-2 py-0.5 font-mono text-[11px] font-semibold tracking-[0.14em] text-primary uppercase">
          Yönetici · Satın Alma · Planlama
        </span>
      </PageHeader>

      <PurchasingNav gecikmis={gecikmisSiparis ?? 0} />

      {children}
    </div>
  );
}
