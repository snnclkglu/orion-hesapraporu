"use client";

import Link from "next/link";
import { RouteBottomBar } from "@/components/section-bottom-bar";
import { usePathname } from "next/navigation";
import { MobileRouteGrid } from "@/components/mobile-nav-grid";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/admin/users", label: "Kullanıcılar" },
  // Yetkiler KULLANICILARIN HEMEN ALTINDA (kullanıcı kararı, md. 4): rolü
  // değiştiren kişi, o değişikliğin hangi bölümü açtığını bir sonraki
  // maddeden görür.
  { href: "/admin/access", label: "Yetkiler" },
  { href: "/admin/teams", label: "Ekipler" },
  { href: "/admin/feedback", label: "Geri Bildirimler" },
  { href: "/admin/email-center", label: "E-posta Merkezi" },
  { href: "/admin/deletion-requests", label: "Silme Onayları" },
  { href: "/admin/customers", label: "Müşteriler" },
  { href: "/admin/profile-scoring", label: "Profil Puanlama" },
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
  // El Kitabı Defterleri STANDART TABLOLARIN yanındadır: ikisi de
  // "belgede tekrar eden şey nerede tanımlı" sorusuna cevap verir.
  { href: "/admin/manual", label: "El Kitabı Defterleri" },
  { href: "/admin/settings", label: "Rapor Ayarları" },
];

export function AdminNav({ feedbackCount = 0 }: { feedbackCount?: number }) {
  const pathname = usePathname() ?? "";
  const activeHref = ITEMS.find((item) => pathname.startsWith(item.href))?.href ?? ITEMS[0].href;

  return (
    <>
      <RouteBottomBar label="Yönetim" options={ITEMS.map(item=>item.href==="/admin/feedback"?{...item,badge:feedbackCount || undefined}:item)} primary={["/admin/users","/admin/teams","/admin/access","/admin/feedback"]} value={activeHref} />
      <div className="oc-section-desktop">
      <MobileRouteGrid
        className="lg:hidden"
        value={activeHref}
        options={ITEMS.map(item => item.href === "/admin/feedback" && feedbackCount ? { ...item, label: `${item.label} (${feedbackCount})` } : item)}
        label="Yönetim bölümü"
      />
      <nav className="hidden gap-1 lg:flex lg:flex-col lg:self-start" aria-label="Yönetim bölümleri">
        {ITEMS.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "border-l-2 px-3 py-2 text-sm transition-colors pointer-coarse:py-2.5",
                active
                  ? "border-l-primary bg-muted font-medium text-foreground"
                  : "border-l-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {item.label}
              {item.href === "/admin/feedback" && feedbackCount > 0 && <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">{feedbackCount}</span>}
            </Link>
          );
        })}
      </nav>
      </div>
    </>
  );
}
