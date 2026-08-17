import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/profile";
import { AppShell } from "@/components/app-shell";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Profil `getSessionProfile` üzerinden okunur: açılış sayfası da aynı
  // fonksiyonu çağırır ve React `cache` sayesinde sorgu istek başına BİR KEZ
  // koşar (eskiden kabuk + sayfa aynı satırı iki kez okuyordu).
  const profile = await getSessionProfile();
  if (!profile) redirect("/login");

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
        role={profile.role}
        displayName={profile.fullName || profile.email || "Kullanıcı"}
        email={profile.email}
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
