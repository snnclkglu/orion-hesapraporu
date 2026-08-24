"use client";

// Paket bölüm rayı — üç ekran arasındaki geçiş.
//
// `Tabs` KULLANILMAZ: bunlar aynı sayfanın panelleri değil AYRI ADRESLERdir
// (her biri kendi verisini sunucudan çeker, paylaşılabilir, yenilenebilir).
// Radix `Tabs` içine `<Link>` koymak `role="tablist"` sözleşmesini bozardı.
// Desen `worklog-nav.tsx` ile birebir aynı.
//
// RAY KAYMAZ, SARAR (kullanıcı kararı, 16.08.2026: "mobilde yatayda kaydırma
// olmasın"). Yedi sekme telefonda `.oc-scrollx` ile kayıyordu ve son sekmeler
// görünmez kalıyordu; sarınca hepsi her an görünür (`purchasing-nav` deseni).
// Aktif çizgisi alt kenara `-mb-px` ile değil İÇ GÖLGEYLE çizilir: sarılmış
// ikinci satırda negatif kenar boşluğu çizgiyi rayın dibine değil satır
// arasına bırakırdı (kabuk kuralı 14).

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MobileRouteGrid } from "@/components/mobile-nav-grid";
import { cn } from "@/lib/utils";

export function PackageNav({ packageId }: { packageId: string }) {
  const pathname = usePathname() ?? "";
  const kok = `/drawings/${packageId}`;
  // SIRA İŞ AKIŞINI İZLER, dosya adlarını değil: paket açılır (Genel Bakış),
  // teslim edilen dosyalara bakılır (Dosyalar), içindekiler okunur (Parçalar),
  // atölyeye iner (Üretim), sonra denetim (Rapor) ve en sonda arşiv (Sürümler).
  //
  // SATIN ALMA SEKMESİ BİR KEZ KALDIRILDI, SONRA BAŞKA BİR ŞEY OLARAK DÖNDÜ
  // (kullanıcı kararları, 12.08.2026).
  //
  // Kaldırılan şey bir İŞLEM ekranıydı: paket başına sipariş/teklif listesi.
  // Gerekçesi duruyor — satınalmacı projeleri tek tek ele almaz, birden çok
  // projenin siparişini bir arada biriktirir; `/purchasing` tam olarak o işi
  // modelliyor ve iki YAZAN ekran "hangisi doğru" sorusunu doğururdu.
  //
  // Geri gelen şey bir PENCEREdir: *"Mühendis ya da ressam bu ekipman satın
  // alınmış mı diye bakabilsin ve teslim süresini görebilsin."* Mühendis ve
  // ressam `/purchasing` bölümünü görmüyor; sayfa salt okunurdur, fiyat ve
  // tedarikçi TAŞIMAZ ve tek bir yazma yolu yoktur. Çelişki bu yüzden
  // doğmaz: yazan taraf hâlâ tektir.
  //
  // Satın alma AŞAMALARI (`satinalindi` · `teslim_alindi`) yerinde duruyor:
  // sipariş açıldığında `/purchasing` onları yazıyor ve atölye tahtasında o
  // çipler hâlâ YOKTUR (`productionStages`) — yetki ayrımı değişmedi.
  //
  // "Parçalar" — eskiden "Parça Defteri"ydi. Defter kod içindeki alan adıdır;
  // ekranda kullanıcının gördüğü şey parçaların listesidir.
  const sekmeler = [
    { href: kok, label: "Genel Bakış", exact: true },
    { href: `${kok}/files`, label: "Dosyalar", exact: false },
    { href: `${kok}/parts`, label: "Parçalar", exact: false },
    { href: `${kok}/purchasing`, label: "Satın Alma", exact: false },
    { href: `${kok}/progress`, label: "Üretim", exact: false },
    { href: `${kok}/report`, label: "İçe Aktarım Raporu", exact: false },
    { href: `${kok}/versions`, label: "Sürümler", exact: false },
  ];
  const aktifHref =
    sekmeler.find((t) => (t.exact ? pathname === t.href : pathname.startsWith(t.href)))
      ?.href ?? kok;

  return (
    <>
      <MobileRouteGrid
        className="md:hidden"
        value={aktifHref}
        options={sekmeler}
        label="Paket bölümleri"
      />
      <nav
        className="hidden flex-wrap items-center gap-x-3 border-b md:flex"
        aria-label="Paket bölümleri"
      >
        {sekmeler.map((t) => {
          const aktif = t.exact ? pathname === t.href : pathname.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={aktif ? "page" : undefined}
              className={cn(
                "shrink-0 px-3 py-2 text-sm whitespace-nowrap transition-colors pointer-coarse:py-2.5",
                aktif
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
