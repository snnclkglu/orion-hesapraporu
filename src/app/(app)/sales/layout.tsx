// Satış bölüm kabuğu: yetki kapısı + bölüm rayı. Üç alt sayfa (Satış Takibi,
// Müşteri Bazında Ciro, Satış Faturaları) aynı yetki ve rayı paylaşır.

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canSeeSales } from "@/lib/roles";
import { SalesNav } from "./sales-nav";

export default async function SalesLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
    : { data: null };

  // Menüden gizlemek yetmez: adres doğrudan yazılabilir. RLS zaten satırları
  // vermez ama boş bir sayfa göstermek yerine kullanıcıyı geri yollarız.
  if (!canSeeSales(profile?.role)) redirect("/jobs");

  return (
    <div className="grid min-w-0 max-w-full gap-4 overflow-x-hidden">
      <SalesNav />
      {children}
    </div>
  );
}
