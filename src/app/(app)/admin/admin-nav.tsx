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
  { href: "/admin/deletion-requests", label: "Silme Onayları" },
  { href: "/admin/customers", label: "Müşteriler" },
  // Tedarikçiler MÜŞTERİLERİN HEMEN ALTINDA: ikisi de bir CARİ defteridir ve
  // aynı sorulara cevap verir (ad düzeltme, kod, pasife çekme). Kataloglar
  // altta kalır — onlar ürün defteridir, firma defteri değil.
  { href: "/admin/suppliers", label: "Tedarikçiler" },
  { href: "/admin/consumables", label: "Sarf Malzemeleri" },
  // Görev Şablonu bir İŞ AKIŞI defteridir (İşler'in "Şablondan Ekle" kaynağı);
  // cari defterlerin altında, ürün kataloglarının üstünde durur.
  { href: "/admin/task-templates", label: "Görev Şablonu" },
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
    // RAY KAYMAZ, SARAR (kullanıcı kararı, 16.08.2026: "mobilde yatayda
    // kaydırma olmasın" — purchasing-nav ile aynı desen, kabuk kuralı 15).
    // Bir süre `.oc-scrollx` ile tek satırda yatay kayıyordu; gerekçesi
    // 11 maddenin telefonda ~3 satır (~110px) kalıcı blok bırakmasıydı.
    // Karar görünürlüğü yer tasarrufuna yeğledi: bütün maddeler her an
    // görünür, kesilip gizlenen madde kalmaz. `lg` üstünde ray zaten dikey
    // sütundur, sarma orada hiç devreye girmez.
    <nav className="flex flex-wrap gap-1 lg:flex-col lg:self-start">
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
              "shrink-0 border-b-2 px-3 py-2 text-sm transition-colors pointer-coarse:py-2.5 lg:border-b-0 lg:border-l-2",
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
