// Yönetim paneli kabuğu: sadece admin erişir (sunucu tarafı rol kontrolü).
// RLS zaten yazmayı admin'e kısıtlar; buradaki kontrol UX içindir.

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AdminNav } from "./admin-nav";
import { PageHeader } from "@/components/page-header";

export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") redirect("/projects");

  return (
    <div className="grid min-w-0 max-w-full gap-4 overflow-x-clip">
      <PageHeader
        title="Yönetim"
        hint="Kullanıcılar, kataloglar ve rapor ayarları"
        backHref="/"
        backLabel="Panele dön"
      />
      {/* Yönetim rayı YALNIZ `lg` üstünde sütun olur: 768–1023px'te uygulama
          kabuğunun kendi menüsü zaten gizli, ikinci bir 200px'lik dikey ray
          tabletin içerik alanının üçte birini yiyordu. Altında ray yatay
          şerittir (bkz. admin-nav.tsx). */}
      <div className="grid min-w-0 gap-4 lg:grid-cols-[200px_1fr] lg:gap-6">
        <AdminNav />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
