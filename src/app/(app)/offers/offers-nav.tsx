"use client";

// Teklif bölümü rayı — Teklifler · Teklif Hesap Raporları · Analiz · Tanımlar.
//
// TELEFONDA AÇILIR LİSTE YOKTUR: altı bölüm yan yana kutularla görünür ve
// 360px üstünde üç sütun × iki satıra yerleşir. Kullanıcı nereye gideceğini
// listeyi açmadan görür; masaüstünde bölüm rayı görünmeye devam eder.
//
// RAY TEKLİFİN İÇİNDE GİZLENİR: editör ekranlarında (`/offers/…/revisions/…`
// ve `/offers/…/costs/…`) çizilmez. Mühendislik editöründeki kuralın aynısı —
// kullanıcı günün büyük kısmını orada geçirir ve kalıcı kabuk öğeleri o
// ekranda kısılır. Maliyet editörü de bir editördür ve aynı yükseklik
// zincirini ister (TEKLIF-17): ray orada çizilseydi bölüm kabının çocuk
// sayısı değişir ve zincir yine kopardı.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MobileRouteGrid } from "@/components/mobile-nav-grid";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/offers", label: "Teklifler", exact: true },
  // TEKLİF HESAP RAPORLARI, teklif listesi ile analiz arasındadır: satış
  // çalışması açılır → aynı mühendislik motoruyla ön hesap yapılır → teklif
  // sonucu analiz edilir. Kayıtlar `projects.report_context = offer` ile
  // Mühendislik arşivinden ayrılır; hesap kodu kopyalanmaz.
  { href: "/offers/hesap-raporlari", label: "Teklif Hesap Raporları", exact: false },
  { href: "/offers/analiz", label: "Analiz", exact: false },
  // TANIMLAR ARTIK `exact`TİR: altına bir adres eklendi ve önek eşleşmesi iki
  // sekmeyi birden etkin gösterirdi — "hangi sayfadayım" sorusunun cevabı
  // rayda İKİ tane olamaz.
  { href: "/offers/tanimlar", label: "Tanımlar", exact: true },
  { href: "/offers/tanimlar/maliyet", label: "Maliyet Şablonları", exact: false },
  { href: "/offers/tanimlar/hammadde", label: "Hammadde Fiyatları", exact: false },
];

export function OffersNav() {
  const pathname = usePathname() ?? "";
  if (pathname.includes("/revisions/") || pathname.includes("/costs/")) return null;

  const aktifSekme = TABS.find((t) =>
    t.exact ? pathname === t.href : pathname.startsWith(t.href)
  )?.href ?? "/offers";

  return (
    <>
      <MobileRouteGrid
        className="md:hidden"
        value={aktifSekme}
        options={TABS}
        label="Teklif bölümü"
      />

      <nav className="hidden flex-wrap items-center gap-x-3 border-b md:flex" aria-label="Teklif bölümleri">
        {TABS.map((t) => {
          const active = t.exact ? pathname === t.href : pathname.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "oc-tap shrink-0 px-3 py-2 text-sm whitespace-nowrap transition-colors pointer-coarse:py-2.5",
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
    </>
  );
}
