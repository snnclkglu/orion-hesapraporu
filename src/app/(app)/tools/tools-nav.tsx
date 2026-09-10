"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MobileRouteGrid } from "@/components/mobile-nav-grid";
import { cn } from "@/lib/utils";

const ROUTES = [
  { href: "/tools", label: "Genel", exact: true },
  { href: "/tools/agirlik", label: "Ağırlık", exact: false },
  { href: "/tools/profiller", label: "Profiller", exact: false },
  { href: "/tools/kama", label: "Kama", exact: false },
  { href: "/tools/tolerans", label: "Tolerans", exact: false },
] as const;

export function ToolsNav() {
  const pathname = usePathname() ?? "/tools";
  const activeHref =
    ROUTES.find((route) =>
      route.exact ? pathname === route.href : pathname.startsWith(route.href)
    )?.href ?? "/tools";

  return (
    <>
      <MobileRouteGrid
        className="md:hidden"
        value={activeHref}
        options={ROUTES}
        label="Teknik Araçlar bölümü"
      />
      <nav className="hidden items-center gap-x-3 border-b md:flex" aria-label="Teknik Araçlar">
        {ROUTES.map((route) => {
          const active = route.href === activeHref;
          return (
            <Link
              key={route.href}
              href={route.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "shrink-0 px-3 py-2 text-sm whitespace-nowrap transition-colors pointer-coarse:py-2.5",
                active
                  ? "font-medium text-foreground shadow-[inset_0_-2px_0_var(--primary)]"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {route.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
