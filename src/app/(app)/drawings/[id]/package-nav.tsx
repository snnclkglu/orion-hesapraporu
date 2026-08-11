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
  // teslim edilen dosyalara bakılır (Dosyalar), içindekiler okunur (Parçalar),
  // sipariş verilir (Satın Alma), atölyeye iner (Üretim), sonra denetim (Rapor)
  // ve en sonda arşiv (Sürümler).
  //
  // SATIN ALMA ÜRETİMDEN AYRIDIR ve bu bir düzen tercihi değil bir YETKİ
  // ayrımıdır: "satın alındı" işareti yalnız o bölümden konur, atölye
  // tahtasında o çip hiç yoktur (`productionStages`). Satınalmacının 149 sac
  // parçasına, foreman'ın da sipariş kalemlerine bakması gerekmiyor.
  //
  // "Parçalar" — eskiden "Parça Defteri"ydi. Defter kod içindeki alan adıdır;
  // ekranda kullanıcının gördüğü şey parçaların listesidir.
  const sekmeler = [
    { href: kok, label: "Genel Bakış", exact: true },
    { href: `${kok}/files`, label: "Dosyalar", exact: false },
    { href: `${kok}/parts`, label: "Parçalar", exact: false },
    { href: `${kok}/purchasing`, label: "Satın Alma", exact: false },
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
