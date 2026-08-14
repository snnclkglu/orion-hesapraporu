"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/admin/users", label: "Kullanıcılar" },
  // Yetkiler KULLANICILARIN HEMEN ALTINDA (kullanıcı kararı, md. 4): rolü
  // değiştiren kişi, o değişikliğin hangi bölümü açtığını bir sonraki
  // maddeden görür.
  { href: "/admin/access", label: "Yetkiler" },
  { href: "/admin/customers", label: "Müşteriler" },
  // Tedarikçiler MÜŞTERİLERİN HEMEN ALTINDA: ikisi de bir CARİ defteridir ve
  // aynı sorulara cevap verir (ad düzeltme, kod, pasife çekme). Kataloglar
  // altta kalır — onlar ürün defteridir, firma defteri değil.
  { href: "/admin/suppliers", label: "Tedarikçiler" },
  { href: "/admin/consumables", label: "Sarf Malzemeleri" },
  { href: "/admin/qualities", label: "Marka/Kalite" },
  { href: "/admin/equipment", label: "Ekipman Katalogu" },
  { href: "/admin/couplings", label: "Kaplin Katalogu" },
  { href: "/admin/rails", label: "Raylar" },
  { href: "/admin/standards", label: "Standart Tablolar" },
  { href: "/admin/settings", label: "Rapor Ayarları" },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    // 7 madde sarınca telefonda ~3 satır oluyor ve HER yönetim sayfasının
    // üstünde 110px'lik kalıcı bir blok bırakıyordu. `lg` altında tek satırlık
    // kaydırılabilir şerit: negatif kenar boşluğu şeridi kabuğun `px-3`
    // dolgusunun dışına taşırır, böylece kaydırma ekran kenarında biter ve
    // kesilen madde "devamı var" ipucu olur (kenar gölgesi `oc-scrollx`).
    <nav
      // Negatif kenar boşluğu kabuğun dolgusunu İZLER (`px-3`, ≥640px'te
      // `px-4`); sabit kalsaydı tablette şerit 4px içeride biter ve kesilen
      // madde ekran kenarına değmediği için "devamı var" ipucu zayıflardı.
      className="oc-scrollx -mx-3 flex snap-x gap-1 overflow-x-auto overscroll-x-contain px-3 [--oc-scroll-bg:var(--background)] sm:-mx-4 sm:px-4 lg:mx-0 lg:flex-col lg:self-start lg:overflow-visible lg:bg-none lg:px-0"
    >
      {ITEMS.map((item) => {
        const active = pathname?.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              // Aktiflik dili app-shell ile aynı: kırmızı çentik + zemin.
              // Pasifte şeffaf çentik, aktifleşince metin kaymasın diye.
              // Çentik yönü yerleşimi izler: yatay şeritte SOL çentik hangi
              // maddeye ait olduğunu göstermez, altta durması gerekir.
              "shrink-0 snap-start border-b-2 px-3 py-2 text-sm transition-colors pointer-coarse:py-2.5 lg:border-b-0 lg:border-l-2",
              active
                ? "border-b-primary bg-muted font-medium text-foreground lg:border-l-primary"
                : "border-b-transparent text-muted-foreground hover:bg-muted hover:text-foreground lg:border-l-transparent"
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
