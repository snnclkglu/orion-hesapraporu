"use client";

// İş Takibi bölüm rayı — üç ekran arasındaki geçiş.
//
// `Tabs` bileşeni KULLANILMAZ: sekmeler burada aynı sayfanın panelleri değil
// AYRI ADRESLERdir (her biri kendi verisini sunucudan çeker, paylaşılabilir ve
// yenilenebilir). Radix `Tabs` içine `<Link>` koymak `role="tablist"`
// sözleşmesini bozardı; ray düz bir `<nav>`dır ve aktif olan `aria-current`
// ile işaretlenir.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MobileRouteGrid } from "@/components/mobile-nav-grid";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/worklog", label: "Günlük Giriş", exact: true },
  { href: "/worklog/analysis", label: "Analiz", exact: false },
  { href: "/worklog/records", label: "Kayıtlar", exact: false },
];

export function WorkLogNav() {
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
        label="İş Takibi bölümü"
      />
      <nav
        className="hidden items-center gap-x-3 border-b md:flex"
        aria-label="İş Takibi bölümleri"
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
