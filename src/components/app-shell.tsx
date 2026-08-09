"use client";

// Uygulama kabuğu: kalıcı sol sidebar (koyu lacivert) + ince üst şerit.
// Mobilde sidebar hamburger ile açılır-kapanır. Sadece sunum katmanı —
// veri (kullanıcı adı/rolü) server layout'tan prop olarak gelir.
//
// YERLEŞİM İLKESİ — çerçeve oynamaz.
// Sidebar genişliğinin ve içerik payının TEK kaynağı `--app-sidebar-w`
// değişkenidir; iki değer ayrı yerlerde tanımlanırsa daralt/genişlet sırasında
// içerik bir kare kayar. Daraltma tercihi boyamadan ÖNCE okunur
// (useLayoutEffect) ve geçiş sınıfı ilk okuma bitene kadar kapalıdır; aksi
// hâlde her açılışta sidebar 240px'ten 56px'e "animasyonla" düşer.
//
// Revizyon editörü SABİT ÇERÇEVE modunda çalışır: sayfa gövdesi kaymaz, yalnız
// editörün kendi bölgeleri kayar. Böylece durum çubuğu ve adım şeridi gerçek
// çerçeve kenarı olur, `sticky` ile belge akışında sürüklenmez.

import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { BrandIcon, type BrandIconName } from "@/components/brand-icon";
import { LogoutButton } from "@/components/logout-button";
import { canSeeSales, canSeeWorkLog, isAdminRole, roleLabel } from "@/lib/roles";

interface AppShellProps {
  role: string;
  displayName: string;
  email: string;
  children: React.ReactNode;
}

/**
 * Menü yetkiye göre süzülür. `visible` bir ROL LİSTESİ değil bir SORUDUR
 * (`isAdminRole` / `canSeeSales`): yetkinin tanımı `lib/roles.ts`te tek yerde
 * durur, menü ile RLS aynı kaynağı okur.
 *
 * Menüden gizlemek yalnız görgü kuralıdır — Satış Takibi'ni asıl kapatan
 * `job_item_sales` üzerindeki RLS'tir.
 */
const NAV_ITEMS: {
  href: string;
  label: string;
  icon: BrandIconName;
  visible?: (role: string) => boolean;
}[] = [
  { href: "/jobs", label: "İşler", icon: "bolt" },
  { href: "/projects", label: "Projeler", icon: "panel" },
  { href: "/worklog", label: "İş Takibi", icon: "timesheet", visible: canSeeWorkLog },
  { href: "/sales", label: "Satış Takibi", icon: "ledger", visible: canSeeSales },
  { href: "/admin", label: "Yönetim", icon: "gauge", visible: isAdminRole },
];

const COLLAPSE_KEY = "orion.sidebar.collapsed";

function sectionLabel(pathname: string | null): string {
  if (!pathname) return "";
  if (pathname.startsWith("/admin")) return "Yönetim";
  if (pathname.startsWith("/jobs")) return "İşler";
  if (pathname.startsWith("/projects")) return "Projeler";
  if (pathname.startsWith("/sales")) return "Satış Takibi";
  if (pathname.startsWith("/worklog")) return "İş Takibi";
  return "";
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

function SidebarContent({
  role,
  displayName,
  email,
  pathname,
  collapsed,
  onNavigate,
  onToggleCollapse,
}: {
  role: string;
  displayName: string;
  email: string;
  pathname: string | null;
  /** Dar kip: yalnız ikonlar, metinler gizlenir */
  collapsed?: boolean;
  onNavigate?: () => void;
  /** Daralt/genişlet — yalnız masaüstü kenar çubuğunda verilir */
  onToggleCollapse?: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      {/* Marka — koyu zeminde beyaz logo (Orion Cranes marka kılavuzu) */}
      <Link
        href="/projects"
        onClick={onNavigate}
        title={collapsed ? "Orion Cranes · Hesap Raporu Sistemi" : undefined}
        className={cn("block pt-5 pb-4", collapsed ? "px-2" : "px-4")}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/orion-logo-white.svg"
          alt="Orion Cranes"
          className={cn(
            "h-[18px] w-auto",
            // Dar kipte logonun yalnız kilit (ikon) kısmı görünür: ayrı bir
            // ikon dosyası eklemeden kırpma ile aynı sonucu verir.
            collapsed && "max-w-[26px] object-cover object-left"
          )}
        />
        {!collapsed && (
          <span className="mt-1.5 block font-mono text-[10px] uppercase tracking-[0.14em] text-sidebar-foreground/60">
            Hesap Raporu Sistemi
          </span>
        )}
      </Link>

      <div className={cn("border-t border-sidebar-border", collapsed ? "mx-2" : "mx-4")} />

      {/* Navigasyon */}
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {!collapsed && (
          <div className="px-2 pb-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-sidebar-foreground/50">
            Çalışma Alanı
          </div>
        )}
        <ul className="grid gap-0.5">
          {NAV_ITEMS.filter((item) => !item.visible || item.visible(role)).map((item) => {
            const active = pathname?.startsWith(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    // Kırmızı sol çentik: omurga motifinin menüdeki devamı;
                    // pasifte şeffaf tutulur ki aktifleşince metin kaymasın.
                    "flex items-center gap-2.5 border-l-2 border-l-transparent py-2 text-sm transition-colors",
                    collapsed ? "justify-center px-0" : "px-2.5",
                    active
                      ? "border-l-primary bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                  )}
                >
                  <BrandIcon name={item.icon} className="size-4 shrink-0" />
                  {!collapsed && item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/*
        Daralt/genişlet — MENÜNÜN İÇİNDE.
        Aynı işi yapan bir düğme üst şeritte de var ama orada ikon tek başına
        duruyor ve neyi daralttığı anlaşılmıyordu; kullanıcı özelliği hiç fark
        etmiyordu. Denetim, denetlediği yüzeyin üzerinde durur.
      */}
      {onToggleCollapse && (
        <div className={cn("shrink-0 pb-2", collapsed ? "px-2" : "px-2")}>
          <button
            type="button"
            onClick={onToggleCollapse}
            title={collapsed ? "Menüyü genişlet (Ctrl+B)" : "Menüyü daralt (Ctrl+B)"}
            aria-label={collapsed ? "Menüyü genişlet" : "Menüyü daralt"}
            aria-pressed={collapsed}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-md py-2 text-xs text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
              collapsed ? "justify-center px-0" : "px-2.5"
            )}
          >
            <BrandIcon
              name={collapsed ? "sidebarExpand" : "sidebarCollapse"}
              className="size-4 shrink-0"
            />
            {!collapsed && "Menüyü daralt"}
          </button>
        </div>
      )}

      {/* Standart künyesi — dar kipte yer kaplamaz */}
      {!collapsed && (
        <div className="px-4 pb-3">
          <div className="rounded-md border border-sidebar-border bg-sidebar-accent/40 px-3 py-2 text-[10px] leading-relaxed text-sidebar-foreground/60">
            FEM 1.001 · DIN 15018 · CMAA 70
            <br />
            Çift kirişli gezer köprülü vinç
          </div>
        </div>
      )}

      {/* Kullanıcı kartı */}
      <div className={cn("border-t border-sidebar-border py-3", collapsed ? "px-2" : "px-3")}>
        <div className={cn("flex items-center gap-2.5", collapsed && "flex-col gap-2")}>
          <span
            title={collapsed ? `${displayName} · ${email}` : undefined}
            className="flex size-8 shrink-0 items-center justify-center bg-sidebar-primary/30 font-mono text-xs font-semibold text-sidebar-accent-foreground"
          >
            {initials(displayName) || "?"}
          </span>
          {!collapsed && (
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate text-sm font-medium text-sidebar-accent-foreground">
                {displayName}
              </div>
              <div className="truncate text-[11px] text-sidebar-foreground/60">
                {roleLabel(role)} · {email}
              </div>
            </div>
          )}
          <LogoutButton className="text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" />
        </div>
      </div>
    </div>
  );
}

export function AppShell({ role, displayName, email, children }: AppShellProps) {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  /** İlk okuma bitene kadar genişlik geçişi kapalı — açılışta kayma olmasın */
  const [ready, setReady] = useState(false);
  const pathname = usePathname();

  // Tercih boyamadan önce okunur; ilk kare doğru genişlikle çizilir.
  useLayoutEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {
      /* localStorage kapalıysa varsayılan geniş kalır */
    }
    setReady(true);
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((c) => {
      const next = !c;
      try {
        window.localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      } catch {
        /* yoksay */
      }
      return next;
    });
  }, []);

  // Ctrl/⌘ + B — masaüstünde menüyü daralt/genişlet
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        toggleCollapsed();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleCollapsed]);

  // Revizyon editörü sabit çerçevede çalışır: sayfa gövdesi kaymaz.
  //
  // DİKKAT — kalıp YALNIZ editörün kendisini yakalar (`…/revisions/<id>`),
  // ALT SAYFALARINI DEĞİL. Daha önce `/\/revisions\//` kullanılıyordu; bu
  // kalıp `…/revisions/<id>/equipment` gibi normal uzun sayfaları da çerçeve
  // kipine sokuyordu: gövdeye `lg:h-dvh lg:overflow-hidden`, `main`e
  // `lg:overflow-hidden` biniyor, sayfa kendi kaydırma kabını kurmadığı için
  // ekran yüksekliğinden taşan kısım KESİLİYOR ve kaydırılamıyordu
  // (ekipman listesi hatası, madde 35). Çerçeve kipini hak eden sayfa kendi
  // içinde kayan bölgeler kurar; alt sayfalar doğal sayfa kaydırmasını ister.
  const isFrame = /\/revisions\/[^/]+\/?$/.test(pathname ?? "");
  // Liste sayfaları ekranın TAMAMINI kullanır. Okuma genişliği kuralı (max-w-6xl)
  // metin için doğrudur ama çok sütunlu tabloda ters teper: sütunlar sıkışır,
  // durum menüsü kırpılır. Form ve rapor sayfaları dar kalmaya devam eder.
  // İş Takibi'nin ÜÇ sayfası da geniştir: günlük girişte satırlar yan yana
  // uzar, analiz grafik ızgarası, kayıtlar çok sütunlu tablodur.
  const isWide =
    /^\/(jobs|projects|sales)\/?$/.test(pathname ?? "") ||
    /^\/worklog(\/|$)/.test(pathname ?? "");
  const sidebarW = collapsed ? "3.5rem" : "15rem";

  return (
    <div
      // Sabit çerçeve YALNIZ masaüstünde: dar ekranda viewport yüksekliğine
      // sıkıştırmak bölüm rayını da içeriği de okunmaz hâle getirirdi; orada
      // doğal sayfa kaydırması doğru davranıştır.
      className={cn("flex", isFrame ? "min-h-screen lg:h-dvh lg:overflow-hidden" : "min-h-screen")}
    >
      {/* Masaüstü sidebar */}
      {/* Kırmızı omurga: kılavuzda her yüzeyin solunda 14px, hiçbir şey üzerine taşmaz */}
      <aside
        // Kenar çubuğu artık AKIŞTA: `position: fixed` + içerikte padding
        // telafisi yerine gerçek bir flex sütunu. Böylece daralma/genişleme
        // içeriğe kendiliğinden yansır — telafi payını ayrıca güncellemeyi
        // unutma riski (ve aradaki bir karelik kayma) ortadan kalkar.
        // Üç eksen birden sabitlenir; yalnız `width` verildiğinde öğe içeriğinin
        // içsel en küçük genişliğine göre şişiyordu.
        style={{ width: sidebarW, minWidth: sidebarW, maxWidth: sidebarW }}
        className={cn(
          "sticky top-0 z-40 hidden h-dvh shrink-0 flex-col overflow-hidden border-r border-l-[14px] border-sidebar-border border-l-primary bg-sidebar text-sidebar-foreground lg:flex",
          ready && "transition-[width] duration-200 ease-out"
        )}
      >
        <SidebarContent
          role={role}
          displayName={displayName}
          email={email}
          pathname={pathname}
          collapsed={collapsed}
          onToggleCollapse={toggleCollapsed}
        />
      </aside>

      {/* Mobil çekmece */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col border-l-[14px] border-l-primary bg-sidebar text-sidebar-foreground shadow-xl">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute top-4 right-3 rounded-md p-1 text-sidebar-foreground/70 hover:bg-sidebar-accent"
              aria-label="Menüyü kapat"
            >
              <BrandIcon name="close" className="size-4" />
            </button>
            <SidebarContent
              role={role}
              displayName={displayName}
              email={email}
              pathname={pathname}
              onNavigate={() => setOpen(false)}
            />
          </aside>
        </div>
      )}

      {/* İçerik */}
      <div
        className={cn(
          "flex min-w-0 flex-1 flex-col",
          isFrame && "lg:min-h-0"
        )}
      >
        <header className="sticky top-0 z-30 flex h-12 shrink-0 items-center gap-2 border-b bg-background px-4 lg:px-6">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground lg:hidden"
            aria-label="Menüyü aç"
          >
            <BrandIcon name="menu" className="size-4" />
          </button>
          {/* Daralt/genişlet — yalnız masaüstünde anlamlı */}
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-pressed={collapsed}
            title={collapsed ? "Menüyü genişlet (Ctrl+B)" : "Menüyü daralt (Ctrl+B)"}
            aria-label={collapsed ? "Menüyü genişlet" : "Menüyü daralt"}
            className="hidden rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:inline-flex"
          >
            <BrandIcon
              name={collapsed ? "sidebarExpand" : "sidebarCollapse"}
              className="size-4"
            />
          </button>
          <div className="oc-kicker min-w-0 text-foreground/80">{sectionLabel(pathname)}</div>
          <div className="ml-auto hidden items-center gap-2 text-[11px] text-muted-foreground sm:flex">
            <span className="font-mono">FEM 1.001</span>
            <span aria-hidden>·</span>
            <span className="font-mono">DIN 15018</span>
            <span aria-hidden>·</span>
            <span className="font-mono">CMAA 70</span>
          </div>
        </header>
        <main
          className={cn(
            "min-w-0 flex-1",
            isFrame
              ? "px-4 py-3 lg:min-h-0 lg:overflow-hidden lg:px-6"
              : "px-4 py-6 lg:px-8"
          )}
        >
          <div
            className={cn(
              "mx-auto w-full",
              isFrame ? "max-w-none lg:h-full" : isWide ? "max-w-none" : "max-w-6xl"
            )}
          >
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
