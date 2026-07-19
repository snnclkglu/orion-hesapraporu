"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/admin/users", label: "Kullanıcılar" },
  { href: "/admin/equipment", label: "Ekipman Katalogu" },
  { href: "/admin/couplings", label: "Kaplin Katalogu" },
  { href: "/admin/rails", label: "Raylar" },
  { href: "/admin/standards", label: "Standart Tablolar" },
  { href: "/admin/settings", label: "Rapor Ayarları" },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-row flex-wrap gap-1 md:flex-col md:self-start">
      {ITEMS.map((item) => {
        const active = pathname?.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded-md px-3 py-2 text-sm transition-colors",
              active
                ? "bg-muted font-medium text-foreground"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
