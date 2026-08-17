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
    <div className="grid gap-4">
      <OffersNav />
      {children}
    </div>
  );
}
