"use client";

// Satın Alma bölüm rayı — proje alımları ve fabrika sarfları arasındaki geçiş.
//
// `Tabs` bileşeni KULLANILMAZ: sekmeler aynı sayfanın panelleri değil AYRI
// ADRESLERdir (her biri kendi verisini sunucudan çeker, paylaşılabilir ve
// yenilenebilir). Gerekçenin tamamı `worklog/worklog-nav.tsx`te.
//
// RAY KAYMAZ, SARAR (kullanıcı kararı, 16.08.2026: *"üstteki sayfa seçim barı
// zaten kayıyor … mobilde yatayda kaydırma olmasın"*). Bir süre `.oc-scrollx`
// ile yatay kayıyordu ve aktif sekmeyi görünür alana kaydıran bir efekt bile
// gerekmişti; sekiz sekme telefonda iki satıra sarınca ikisi de gereksizleşti —
// bütün sekmeler her an görünür, gizli sekme diye bir şey kalmadı. Masaüstünde
// zaten tek satıra sığıyor, sarma orada hiç devreye girmez.
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
//
// `sarf: true` bir GRUP sınırıdır: sarf giderleri herhangi bir işe/pakete
// bağlanmaz (md. 21) ve raydaki ayraç bu ayrımı gözle de verir — sekiz düz
// sekme içinde "nerede proje biter, nerede fabrika başlar" okunmuyordu.
const TABS = [
  { href: "/purchasing", label: "Ekipman", exact: true, sarf: false },
  { href: "/purchasing/hammadde", label: "Hammadde", exact: false, sarf: false },
  { href: "/purchasing/siparisler", label: "Siparişler", exact: false, sarf: false },
  { href: "/purchasing/teslimat", label: "Teslim Takvimi", exact: false, sarf: false },
  { href: "/purchasing/fiyatlar", label: "Fiyat Arşivi", exact: false, sarf: false },
  { href: "/purchasing/sarf", label: "Sarf Girişi", exact: true, sarf: true },
  { href: "/purchasing/sarf/kayitlar", label: "Sarf Kayıtları", exact: false, sarf: true },
  { href: "/purchasing/sarf/analiz", label: "Sarf Analizi", exact: false, sarf: true },
];

export function PurchasingNav({
  /**
   * Gecikmiş sipariş sayısı — Teslim Takvimi sekmesine kırmızı rozet.
   * SIFIR SAYAN ROZET ÇİZİLMEZ (açılış panosu kuralı): "0 gecikme" bir uyarı
   * değil gürültüdür.
   */
  gecikmis = 0,
}: {
  gecikmis?: number;
}) {
  const pathname = usePathname() ?? "";

  return (
    <nav
      className="flex flex-wrap items-center gap-x-3 border-b"
      aria-label="Satın Alma bölümleri"
    >
      {TABS.map((t, i) => {
        const active = t.exact ? pathname === t.href : pathname.startsWith(t.href);
        const grupSiniri = t.sarf && !TABS[i - 1]?.sarf;
        return (
          <span key={t.href} className="flex shrink-0 items-center gap-3">
            {grupSiniri && <span aria-hidden className="h-4 w-px shrink-0 bg-border" />}
            <Link
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex shrink-0 items-center gap-1.5 px-3 py-2 text-sm whitespace-nowrap transition-colors pointer-coarse:py-2.5",
                active
                  ? "font-medium text-foreground shadow-[inset_0_-2px_0_var(--primary)]"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t.label}
              {t.href === "/purchasing/teslimat" && gecikmis > 0 && (
                <span
                  className="inline-flex min-w-4 items-center justify-center border border-destructive/40 bg-destructive/10 px-1 font-mono text-[11px] leading-4 text-destructive tabular-nums"
                  title={`${gecikmis} siparişin termini geçti`}
                >
                  {gecikmis}
                </span>
              )}
            </Link>
          </span>
        );
      })}
    </nav>
  );
}
