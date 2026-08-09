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
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/worklog", label: "Günlük Giriş", exact: true },
  { href: "/worklog/analysis", label: "Analiz", exact: false },
  { href: "/worklog/records", label: "Kayıtlar", exact: false },
];

export function WorkLogNav({ badge }: { badge?: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  return (
    // Rozet `nav`ın İÇİNDE ama sekme değildir; `role="tablist"` sözleşmesi
    // burada yok (sekmeler gerçek bağlantı), bu yüzden aynı çizgiyi paylaşması
    // sorun değil — kazanılan bir satır boyudur.
    <nav className="flex items-center gap-3 border-b" aria-label="İş Takibi bölümleri">
      {TABS.map((t) => {
        const active = t.exact ? pathname === t.href : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              // Marka dili: alt çizgi kırmızı, köşe yuvarlaklığı yok, geçiş
              // yalnız RENK adımı (kılavuz: no scale, no shadow lift).
              "-mb-px border-b-2 px-3 py-1.5 text-sm transition-colors",
              active
                ? "border-primary font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
          </Link>
        );
      })}
      {badge && <span className="ml-auto pb-1.5">{badge}</span>}
    </nav>
  );
}
