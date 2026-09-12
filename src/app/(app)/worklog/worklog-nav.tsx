"use client";

// İş Takibi bölüm rayı — üç ekran arasındaki geçiş.
//
// `Tabs` bileşeni KULLANILMAZ: sekmeler burada aynı sayfanın panelleri değil
// AYRI ADRESLERdir (her biri kendi verisini sunucudan çeker, paylaşılabilir ve
// yenilenebilir). Radix `Tabs` içine `<Link>` koymak `role="tablist"`
// sözleşmesini bozardı; ray düz bir `<nav>`dır ve aktif olan `aria-current`
// ile işaretlenir.

import Link from "next/link";
import { SectionBottomBar } from "@/components/section-bottom-bar";
import { openBottomTool } from "@/components/bottom-bar-tools";
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
      <SectionBottomBar label="İş Takibi" items={[...[TABS[0],TABS[2],TABS[1]].map(t => ({id:t.href,href:t.href,label:t.href==="/worklog"?"Günlük":t.label,active:t.href===activeHref})),{id:"period",label:"Dönem",icon:"calendar",action:true,onSelect:()=>openBottomTool("worklog-period")}]} />
      <div className="oc-section-desktop">
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
      </div>
    </>
  );
}
