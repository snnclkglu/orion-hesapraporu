"use client";

// Satış bölümü rayı — Satış Takibi · Müşteri Bazında Ciro · Satış Faturaları
// (kullanıcı kararı, 14.08.2026). Üçü AYRI ADREStir (Satın Alma rayının deseni);
// her biri kendi verisini sunucudan çeker.
//
// RAY KAYMAZ, SARAR (kabuk kuralı 15; gerekçenin tamamı purchasing-nav'da):
// üç sekme telefonda gerekirse ikinci satıra iner, gizli sekme kalmaz.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MobileRouteGrid } from "@/components/mobile-nav-grid";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/sales", label: "Satış Takibi", exact: true },
  { href: "/sales/ciro", label: "Müşteri Bazında Ciro", exact: false },
  { href: "/sales/faturalar", label: "Satış Faturaları", exact: false },
];

export function SalesNav() {
  const pathname = usePathname() ?? "";
  const activeHref =
    TABS.find((t) => (t.exact ? pathname === t.href : pathname.startsWith(t.href)))
      ?.href ?? TABS[0].href;

  return (
    <>
      <MobileRouteGrid
        className="md:hidden"
        value={activeHref}
        options={TABS}
        label="Satış bölümü"
      />
      <nav
        className="hidden items-center gap-x-3 border-b md:flex"
        aria-label="Satış bölümleri"
      >
        {TABS.map((t) => {
          const active = t.exact ? pathname === t.href : pathname.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "shrink-0 px-3 py-2 text-sm whitespace-nowrap transition-colors pointer-coarse:py-2.5",
                active
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
