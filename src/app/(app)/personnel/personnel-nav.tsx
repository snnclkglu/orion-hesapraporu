"use client";

// Personel bölüm rayı — beş ekran arasındaki geçiş.
//
// `Tabs` bileşeni KULLANILMAZ: sekmeler aynı sayfanın panelleri değil AYRI
// ADRESLERdir (her biri kendi verisini sunucudan çeker, paylaşılabilir ve
// yenilenebilir). Gerekçenin tamamı `worklog/worklog-nav.tsx`te.
//
// SIRA İŞ AKIŞIDIR: kim çalışıyor (Personel) → bu ay ne ödedik (Maaş) → aylar
// nasıl gidiyor (Özet) → sahada günlük ne veriyoruz (Harcirah) → bunları avroya
// çevirirken hangi kuru kullanıyoruz (Kurlar).
//
// ÜCRET PLANI EN SAĞDADIR ve bu SIKLIK sıralamasıdır, akış değil (kullanıcı
// kararı, 13.08.2026: "bu sayfa çok az kullanılacak, Kurlar'ın yanına en sağa
// alalım"). Bir gün önce Maaş'tan ÖNCE konmuştu çünkü maaş satırı net ücreti
// ondan okur; bağ hâlâ doğru ama YÖN yanlış tarafı optimize ediyordu. Ücret
// planı YILDA BİR açılır, Maaş her ay — ve ray, günlük işi en yakın tutmalıdır.
// Kurlar da aynı sebeple sondadır (o da otomatik doluyor, elle açılmıyor).
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
  { href: "/personnel", label: "Personel", exact: true },
  { href: "/personnel/maas", label: "Maaş", exact: false },
  { href: "/personnel/ozet", label: "Özet", exact: false },
  { href: "/personnel/harcirah", label: "Harcirah", exact: false },
  { href: "/personnel/kurlar", label: "Kurlar", exact: false },
  { href: "/personnel/ucret", label: "Ücret Planı", exact: false },
];

export function PersonnelNav() {
  const pathname = usePathname() ?? "";
  return (
    <nav
      className="oc-scrollx flex items-center gap-3 overflow-x-auto overflow-y-hidden overscroll-x-contain shadow-[inset_0_-1px_0_var(--border)] [--oc-scroll-bg:var(--background)]"
      aria-label="Personel bölümleri"
    >
      {TABS.map((t) => {
        // KÖK SEKME "exact" DEĞİL "alt sayfa hariç"tir: `/personnel/<uuid>`
        // (personel profili) Personel sekmesinin altındadır ama `/personnel/maas`
        // değildir. Diğer sekmelerin adresi kökün öneki olduğu için düz bir
        // `startsWith` kökü her sayfada aktif gösterirdi.
        const active = t.exact
          ? pathname === t.href ||
            (pathname.startsWith("/personnel/") &&
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
