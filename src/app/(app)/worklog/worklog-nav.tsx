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

export function WorkLogNav() {
  const pathname = usePathname() ?? "";
  return (
    //
    // 360px'te üç sekme + rozet 449px istiyordu: etiketler iki satıra kırılıyor
    // ve alt çizgi göstergesi bozuluyordu. Ray bir süre `.oc-scrollx` ile yatay
    // kaydı; artık KAYMAZ, SARAR (kabuk ROL-15, `purchasing-nav` deseni):
    // sekmeler dar ekranda ikinci satıra iner ve hepsi her an görünür kalır.
    <nav
      className="flex flex-wrap items-center gap-x-3 border-b"
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
              // Marka dili: alt çizgi kırmızı, köşe yuvarlaklığı yok, geçiş
              // yalnız RENK adımı (kılavuz: no scale, no shadow lift).
              // 34px'lik sekme dokunmatik eşiğin altındaydı; bölüme girişin
              // tek yolu bu üç bağlantı.
              // Aktif çizgi `-mb-px border-b-2` değil İÇ GÖLGEDİR (md. 14):
              // saran rayda negatif kenar boşluğu alt satırın üstüne binerdi.
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
  );
}
