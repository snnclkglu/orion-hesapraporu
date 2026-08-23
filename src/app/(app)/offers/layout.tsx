// Teklif bölüm kabuğu: yetki kapısı + bölüm rayı.
//
// Menüden gizlemek YETMEZ — adres doğrudan yazılabilir. RLS zaten satırları
// vermez (teklif fiyat taşır) ama boş bir sayfa göstermek yerine kullanıcıyı
// geri yollarız (Satış bölümünün deseni).

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canSeeOffers } from "@/lib/roles";
import { OffersNav } from "./offers-nav";

export default async function OffersLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
    : { data: null };

  if (!canSeeOffers(profile?.role)) redirect("/jobs");

  return (
    // KAP YÜKSEKLİĞİ GEÇİRİR — ve bu bir süslemeden ibaret değil, editörün
    // kaydırılabilmesinin ŞARTI.
    //
    // Kabuk revizyon ekranlarını SABİT ÇERÇEVE sayar (`isFrame`, app-shell.tsx)
    // ve `main`e `lg:overflow-hidden` verir; editör kendi kaydırma kabını
    // kurabilmek için kesintisiz bir yükseklik zinciri ister. Bu sarmalayıcı
    // bir süre düz `grid gap-4` idi, yani AUTO yükseklikti: zincir tam burada
    // kopuyor, sayfa kökündeki `lg:h-full` yüzde-yüzünü `auto`dan alıp yine
    // `auto` oluyor ve taşan içerik kaydırılamadan KIRPILIYORDU (kullanıcı
    // bildirimi, 17.08.2026 — hata iki kez, en son burada bulundu).
    //
    // `lg:h-full` normal sayfalara (liste · analiz · tanımlar) ZARAR VERMEZ:
    // orada üst kap zaten auto yüksekliktedir, yüzde çözülemez ve `auto`ya
    // düşer. `flex-col`, `grid` yerine bilinçlidir — çocuk sayısı değişse de
    // (`OffersNav` revizyon ekranında `null` döner) satır ataması kaymaz.
    <div className="flex min-w-0 max-w-full flex-col gap-4 overflow-x-hidden lg:h-full lg:min-h-0">
      <OffersNav />
      {children}
    </div>
  );
}
