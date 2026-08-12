import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Menünün tek girdisi ROLdür. Bir süre burada "zengin sorgu + dar yedek"
  // ikilisi vardı çünkü `tags` sütunu yeni gelmişti; etiketler role dönüşüp
  // sütun düşürülünce (12.08.2026) yedeğin koruduğu bir şey kalmadı.
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .maybeSingle();

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
