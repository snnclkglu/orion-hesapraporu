"use client";

// Satın Alma bölüm rayı — beş ekran arasındaki geçiş.
//
// `Tabs` bileşeni KULLANILMAZ: sekmeler aynı sayfanın panelleri değil AYRI
// ADRESLERdir (her biri kendi verisini sunucudan çeker, paylaşılabilir ve
// yenilenebilir). Gerekçenin tamamı `worklog/worklog-nav.tsx`te.
//
// SIRA İŞ AKIŞIDIR, alfabe değil: ihtiyaç doğar (Talep Havuzu) → sipariş verilir
// (Siparişler) → mal gelir (Teslim Takvimi) → para çıkar (Ödeme Takvimi) →
// bir dahaki sefere ne kadara aldığımıza bakarız (Fiyat Arşivi).

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/purchasing", label: "Talep Havuzu", exact: true },
  { href: "/purchasing/siparisler", label: "Siparişler", exact: false },
  { href: "/purchasing/teslimat", label: "Teslim Takvimi", exact: false },
  { href: "/purchasing/odemeler", label: "Ödeme Takvimi", exact: false },
  { href: "/purchasing/fiyatlar", label: "Fiyat Arşivi", exact: false },
];

export function PurchasingNav() {
  const pathname = usePathname() ?? "";
  return (
    <nav
      className="oc-scrollx flex items-center gap-3 overflow-x-auto overscroll-x-contain border-b [--oc-scroll-bg:var(--background)]"
      aria-label="Satın Alma bölümleri"
    >
      {TABS.map((t) => {
        const active = t.exact ? pathname === t.href : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px shrink-0 border-b-2 px-3 py-2 text-sm whitespace-nowrap transition-colors pointer-coarse:py-2.5",
              active
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
