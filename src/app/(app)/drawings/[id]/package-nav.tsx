"use client";

// Paket bölüm rayı — üç ekran arasındaki geçiş.
//
// `Tabs` KULLANILMAZ: bunlar aynı sayfanın panelleri değil AYRI ADRESLERdir
// (her biri kendi verisini sunucudan çeker, paylaşılabilir, yenilenebilir).
// Radix `Tabs` içine `<Link>` koymak `role="tablist"` sözleşmesini bozardı.
// Desen `worklog-nav.tsx` ile birebir aynı.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function PackageNav({ packageId }: { packageId: string }) {
  const pathname = usePathname() ?? "";
  const kok = `/drawings/${packageId}`;
  // SIRA İŞ AKIŞINI İZLER, dosya adlarını değil: paket açılır (Genel Bakış),
  // içindekiler okunur (Parça Defteri), atölyeye iner (Üretim), sonra denetim
  // (Rapor) ve en sonda arşiv (Sürümler). İki faz bu rayı ayrı ayrı genişletmek
  // istedi; tek düzenlemede birleştirildi.
  const sekmeler = [
    { href: kok, label: "Genel Bakış", exact: true },
    { href: `${kok}/parts`, label: "Parça Defteri", exact: false },
    { href: `${kok}/progress`, label: "Üretim", exact: false },
    { href: `${kok}/report`, label: "İçe Aktarım Raporu", exact: false },
    { href: `${kok}/versions`, label: "Sürümler", exact: false },
  ];

  return (
    <nav
      className="oc-scrollx flex items-center gap-3 overflow-x-auto overscroll-x-contain border-b [--oc-scroll-bg:var(--background)]"
      aria-label="Paket bölümleri"
    >
      {sekmeler.map((t) => {
        const aktif = t.exact ? pathname === t.href : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={aktif ? "page" : undefined}
            className={cn(
              "-mb-px shrink-0 border-b-2 px-3 py-2 text-sm whitespace-nowrap transition-colors pointer-coarse:py-2.5",
              aktif
                ? "border-primary font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
