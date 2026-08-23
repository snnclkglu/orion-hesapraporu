"use client";

// İş bölüm rayı — detay artık tek uzun sayfa değil bir HUB'dır.
//
// `Tabs` KULLANILMAZ: bunlar aynı sayfanın panelleri değil AYRI ADRESLERdir
// (her biri kendi verisini sunucudan çeker, paylaşılabilir, yenilenebilir).
// Desen `package-nav.tsx` ile birebir aynı: ray KAYMAZ, SARAR (ROL-15) ve
// aktif çizgi `-mb-px` değil İÇ GÖLGEYLE çizilir (kabuk kuralı 14).
//
// SIRA İŞ AKIŞINI İZLER: iş açılır (Genel Bakış), üzerinde ne olduğuna
// bakılır (Akış), sonra öteki modüllerdeki izleri (Bağlantılar). "Görevler"
// sekmesi kendi fazında araya girer.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MobileRouteSelect } from "@/components/mobile-route-select";
import { cn } from "@/lib/utils";

export function JobNav({ jobId }: { jobId: string }) {
  const pathname = usePathname() ?? "";
  const kok = `/jobs/${jobId}`;
  const sekmeler = [
    { href: kok, label: "Genel Bakış", exact: true },
    { href: `${kok}/gorevler`, label: "Görevler", exact: false },
    { href: `${kok}/akis`, label: "Akış", exact: false },
    { href: `${kok}/baglantilar`, label: "Bağlantılar", exact: false },
  ];
  const aktifHref =
    sekmeler.find((t) => (t.exact ? pathname === t.href : pathname.startsWith(t.href)))
      ?.href ?? kok;

  return (
    <>
      <MobileRouteSelect
        className="md:hidden"
        value={aktifHref}
        options={sekmeler}
        label="İş bölümü"
      />
      <nav
        className="hidden items-center gap-x-3 border-b md:flex"
        aria-label="İş bölümleri"
      >
        {sekmeler.map((t) => {
          const aktif = t.exact ? pathname === t.href : pathname.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={aktif ? "page" : undefined}
              className={cn(
                "shrink-0 px-3 py-2 text-sm whitespace-nowrap transition-colors pointer-coarse:py-2.5",
                aktif
                  ? "font-medium text-foreground shadow-[inset_0_-2px_0_var(--primary)]"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
