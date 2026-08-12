"use client";

// Finans bölüm rayı — beş ekran arasındaki geçiş.
//
// `Tabs` bileşeni KULLANILMAZ: sekmeler aynı sayfanın panelleri değil AYRI
// ADRESLERdir (her biri kendi verisini sunucudan çeker, paylaşılabilir ve
// yenilenebilir). Gerekçenin tamamı `worklog/worklog-nav.tsx`te.
//
// SIRA İŞ AKIŞIDIR: kim çalışıyor (Personel) → bu ay ne ödedik (Maaş) → aylar
// nasıl gidiyor (Özet) → sahada günlük ne veriyoruz (Harcirah) → bunları
// avroya çevirirken hangi kuru kullanıyoruz (Kurlar).
//
// ALT ÇİZGİ `border-b` DEĞİL İÇ GÖLGEDİR (AGENTS md. 14). `overflow-x` veren
// bir kap `overflow-y`yi de kaybeder ve `-mb-px` ile bir piksel taşan sekme
// gerçek bir dikey kaydırma çubuğu doğurur — proje sekme rayında bir kez
// yaşandı ve kullanıcı arıza olarak bildirdi. Gölge dolgu kutusunun İÇİNE
// boyandığı için aktif sekmenin çizgisi negatif kenar boşluğu olmadan onun
// üstüne oturur.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/finance", label: "Personel", exact: true },
  { href: "/finance/maas", label: "Maaş", exact: false },
  { href: "/finance/ozet", label: "Özet", exact: false },
  { href: "/finance/harcirah", label: "Harcirah", exact: false },
  { href: "/finance/kurlar", label: "Kurlar", exact: false },
];

export function FinanceNav() {
  const pathname = usePathname() ?? "";
  return (
    <nav
      className="oc-scrollx flex items-center gap-3 overflow-x-auto overflow-y-hidden overscroll-x-contain shadow-[inset_0_-1px_0_var(--border)] [--oc-scroll-bg:var(--background)]"
      aria-label="Finans bölümleri"
    >
      {TABS.map((t) => {
        // KÖK SEKME "exact" DEĞİL "alt sayfa hariç"tir: `/finance/<uuid>`
        // (personel profili) Personel sekmesinin altındadır ama `/finance/maas`
        // değildir. Diğer sekmelerin adresi kökün öneki olduğu için düz bir
        // `startsWith` kökü her sayfada aktif gösterirdi.
        const active = t.exact
          ? pathname === t.href ||
            (pathname.startsWith("/finance/") &&
              !TABS.some((o) => !o.exact && pathname.startsWith(o.href)))
          : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              // Marka dili: alt çizgi kırmızı, köşe yuvarlaklığı yok, geçiş
              // yalnız RENK adımı (no scale, no shadow lift).
              "shrink-0 border-b-2 px-3 py-2 text-sm whitespace-nowrap transition-colors pointer-coarse:py-2.5",
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
