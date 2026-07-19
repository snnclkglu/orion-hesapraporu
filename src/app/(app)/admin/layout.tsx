// Yönetim paneli kabuğu: sadece admin erişir (sunucu tarafı rol kontrolü).
// RLS zaten yazmayı admin'e kısıtlar; buradaki kontrol UX içindir.

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AdminNav } from "./admin-nav";

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
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Yönetim</h1>
        <p className="text-sm text-muted-foreground">
          Kullanıcılar, kataloglar ve rapor ayarları
        </p>
      </div>
      <div className="grid gap-6 md:grid-cols-[200px_1fr]">
        <AdminNav />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
