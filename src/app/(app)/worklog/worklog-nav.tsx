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
    // ve alt çizgi göstergesi bozuluyordu. Ray artık kaydırılır, etiketler
    // kırılmaz; rozet telefonda hiç basılmaz (yetki bilgisi kritik değil,
    // asıl engel zaten RLS'tir).
    <nav
      className="oc-scrollx [--oc-scroll-bg:var(--background)] flex items-center gap-3 overflow-x-auto overscroll-x-contain border-b"
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
