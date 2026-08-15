"use client";

// Satın Alma bölüm rayı — proje alımları ve fabrika sarfları arasındaki geçiş.
//
// `Tabs` bileşeni KULLANILMAZ: sekmeler aynı sayfanın panelleri değil AYRI
// ADRESLERdir (her biri kendi verisini sunucudan çeker, paylaşılabilir ve
// yenilenebilir). Gerekçenin tamamı `worklog/worklog-nav.tsx`te.
//
// SIRA İŞ AKIŞIDIR, alfabe değil: ihtiyaç doğar (Talep Havuzu) → sipariş verilir
// (Siparişler) → mal gelir (Teslim Takvimi) → bir dahaki sefere ne kadara
// aldığımıza bakarız (Fiyat Arşivi).
//
// ÖDEME TAKVİMİ KALDIRILDI (kullanıcı kararı, 14.08.2026: "Ödeme Takvimi
// sayfasını satın alma bölümünde iptal edelim. Ödendi bilgisi takip
// etmeyelim."). Sayfa ve nav sekmesi silindi; ödeme işaretleri Siparişler
// ekranından da kaldırıldı.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

// TALEP HAVUZU İKİYE BÖLÜNDÜ (kullanıcı kararı, 15.08.2026): *"Satın alma
// bölümü talep havuzuna ikiye ayırmak istiyorum … ilk kısım talep havuzunun
// ekipman tarafı, ikinci kısım ise hammadde tarafı olmalı."* İki sekme aynı
// deftere bakar ama farklı yarılarına: ekipman satın alınan ürünü, hammadde
// imalat parçasının kesileceği malzemeyi sorar.
const TABS = [
  { href: "/purchasing", label: "Ekipman", exact: true },
  { href: "/purchasing/hammadde", label: "Hammadde", exact: false },
  { href: "/purchasing/siparisler", label: "Siparişler", exact: false },
  { href: "/purchasing/teslimat", label: "Teslim Takvimi", exact: false },
  { href: "/purchasing/fiyatlar", label: "Fiyat Arşivi", exact: false },
  { href: "/purchasing/sarf", label: "Sarf Girişi", exact: true },
  { href: "/purchasing/sarf/kayitlar", label: "Sarf Kayıtları", exact: false },
  { href: "/purchasing/sarf/analiz", label: "Sarf Analizi", exact: false },
];

export function PurchasingNav() {
  const pathname = usePathname() ?? "";
  return (
    <nav
      className="oc-scrollx flex items-center gap-3 overflow-x-auto overscroll-x-contain border-b [--oc-scroll-bg:var(--background)]"
      aria-label="Satın Alma bölümleri"
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
  );
}
