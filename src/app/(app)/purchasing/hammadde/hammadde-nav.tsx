"use client";

// Hammadde alt rayı — havuz ile plaka yerleşimi arasındaki geçiş.
//
// İKİNCİ KATMANDIR ve KISA KALIR. Beş kategori sekme DEĞİLDİR: kategori bir
// ADRES değil bir GÖRÜNÜMDÜR (aynı listenin sütun düzenini değiştirir) ve
// sekmeye çıkarılsaydı üst rayla birlikte on iki sekme ederdi — 360 px'lik bir
// telefonda kullanılamaz. Kategori seçimi tablonun kendi çip şeridindedir.
//
// `exact: true` ZORUNLU: `/purchasing/hammadde/yerlesim` `startsWith` ile
// köke de uyar ve iki sekme birden aktif görünürdü (Sarf Girişi'nde yaşanmış).

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/purchasing/hammadde", label: "Hammadde Havuzu", exact: true },
  { href: "/purchasing/hammadde/yerlesim", label: "Plaka Yerleşimi", exact: false },
];

export function HammaddeNav() {
  const pathname = usePathname() ?? "";
  return (
    <nav
      className="oc-scrollx flex items-center gap-2 overflow-x-auto overscroll-x-contain [--oc-scroll-bg:var(--background)]"
      aria-label="Hammadde ekranları"
    >
      {TABS.map((t) => {
        const active = t.exact ? pathname === t.href : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            // `.oc-tap` YOK: görünmez dokunma katmanı `overflow-x` veren bu
            // şeritte dikey taşma ve yalancı bir kaydırma çubuğu doğurur
            // (dokunmatik md. 14). Pay kutunun kendi dolgusundan gelir —
            // `PurchasingNav`ın çözümünün aynısı.
            className={cn(
              "shrink-0 border px-3 py-2 text-[13px] whitespace-nowrap transition-colors pointer-coarse:py-2.5",
              active
                ? "border-primary/50 bg-primary/[0.08] font-medium text-foreground"
                : "border-border text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
