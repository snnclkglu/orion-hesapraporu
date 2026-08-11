import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";
import { tagsOf } from "@/lib/roles";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // ETİKET SÜTUNU İKİ DENEMEDE OKUNUR (satın alma sayfasındaki `due_at`
  // kalıbının aynısı): `tags` migration'ı uygulanmadan önce onu isteyen bir
  // `select` BÜTÜN sorguyu düşürür ve kullanıcı adsız/rolsüz bir kabukla
  // karşılaşırdı. Bir sütunun eksikliği yüzünden uygulamayı kaybetmek,
  // eksikliğin kendisinden çok daha pahalıdır.
  let { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, tags")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) {
    ({ data: profile } = await supabase
      .from("profiles")
      .select("full_name, role")
      .eq("id", user.id)
      .maybeSingle());
  }

  return (
    <>
      {/* Klavye kullanıcıları için içeriğe atlama linki; yalnız odaklanınca görünür */}
      <a
        href="#icerik"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:bg-primary focus:px-4 focus:py-2 focus:font-mono focus:text-sm focus:text-primary-foreground"
      >
        İçeriğe atla
      </a>
      <AppShell
        role={profile?.role ?? "engineer"}
        tags={tagsOf((profile as { tags?: string[] } | null)?.tags)}
        displayName={profile?.full_name || user.email || "Kullanıcı"}
        email={user.email ?? ""}
      >
        {/* main app-shell içinde; atlama hedefi bu sarmalayıcıdır */}
        {/* Yükseklik zinciri: sabit çerçeveli sayfalarda (revizyon editörü)
            main → bu sarmalayıcı → sayfa kökü kesintisiz `h-full` taşımalı,
            aksi hâlde editörün `lg:h-full` bağlanacağı belirli bir yükseklik
            bulamaz ve çerçeve çöker. */}
        <div id="icerik" tabIndex={-1} className="h-full outline-none">
          {children}
        </div>
      </AppShell>
    </>
  );
}
