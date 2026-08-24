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
import { MobileRouteGrid } from "@/components/mobile-nav-grid";
import { cn } from "@/lib/utils";

// SIRA İŞ AKIŞIDIR: ne lazım (havuz) → kaç plaka (yerleşim) → kimden (teklif)
// → verildi mi (sipariş) → ne kadara geliyor (analiz). Analiz en sondadır ve
// bu bir SIKLIK sıralamasıdır (Ücret Planı'nın kuralı): satınalmacı gün içinde
// havuzu açar, analizi ayda birkaç kez.
// SİPARİŞLER BU RAYIN DIŞINA ÇIKAR ve bu bilinçlidir (kullanıcı kararı,
// 15.08.2026: *"iki ayrı siparişler sayfası olmasa güzel olur"*). Hammaddenin
// kendi sipariş ekranı KALDIRILDI; sekme ortak ekrana `?tur=hammadde` süzgeciyle
// girer — kapı duruyor, oda tek. Aktiflik `href`ten değil `eslesme`den okunur:
// `usePathname` sorgu dizgisini taşımaz ve `startsWith("…?tur=…")` hiçbir zaman
// tutmazdı (sessizce hep pasif bir sekme).
const TABS = [
  { href: "/purchasing/hammadde", eslesme: "/purchasing/hammadde", label: "Hammadde Havuzu", exact: true },
  { href: "/purchasing/hammadde/yerlesim", eslesme: "/purchasing/hammadde/yerlesim", label: "Plaka Yerleşimi", exact: false },
  { href: "/purchasing/hammadde/teklifler", eslesme: "/purchasing/hammadde/teklifler", label: "Teklifler", exact: false },
  { href: "/purchasing/siparisler?tur=hammadde", eslesme: "/purchasing/siparisler", label: "Siparişler", exact: false },
  { href: "/purchasing/hammadde/analiz", eslesme: "/purchasing/hammadde/analiz", label: "Alım Analizi", exact: false },
];

export function HammaddeNav() {
  const pathname = usePathname() ?? "";
  const activeHref =
    TABS.find((t) => (t.exact ? pathname === t.eslesme : pathname.startsWith(t.eslesme)))
      ?.href ?? TABS[0].href;

  return (
    <>
      <MobileRouteGrid
        className="md:hidden"
        value={activeHref}
        options={TABS}
        label="Hammadde ekranları"
      />
      <nav
        className="hidden flex-wrap items-center gap-2 md:flex"
        aria-label="Hammadde ekranları"
      >
        {TABS.map((t) => {
          const active = t.exact ? pathname === t.eslesme : pathname.startsWith(t.eslesme);
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
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
    </>
  );
}
