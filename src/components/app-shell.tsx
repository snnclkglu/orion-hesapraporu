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

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useOverlay } from "@/lib/use-overlay";
import { useStoredFlag } from "@/lib/use-stored-flag";
import { BrandIcon, type BrandIconName } from "@/components/brand-icon";
import { LogoutButton } from "@/components/logout-button";
import { PageActionsHost, PageHeaderHost } from "@/components/page-header";
import { NotificationBell } from "@/components/notification-bell";
import { CommandPalette } from "@/components/command-palette";
import { ThemeToggle } from "@/components/theme-toggle";
import { LANDING_PATH, WORKSPACE_SECTIONS, roleLabel, visibleSections } from "@/lib/roles";
import { APP_NAME, COMPANY_NAME } from "@/lib/app";
import { UploadIndicator } from "@/app/(app)/drawings/new/upload-indicator";

interface AppShellProps {
  role: string;
  displayName: string;
  email: string;
  children: React.ReactNode;
}

/**
 * MENÜNÜN KAYNAĞI ARTIK BURADA DEĞİL — `lib/roles.ts`teki `WORKSPACE_SECTIONS`.
 *
 * Liste bir süre bu dosyada yaşadı; Yönetim'e "hangi bölüm kime açık" ekranı
 * eklenince (MOBIL-4) İKİNCİ bir liste yazma ihtiyacı doğdu ve iki listenin
 * ayrışması yetki ekranında olabilecek en kötü hatadır: matris, menünün
 * gerçekte yaptığından başka bir şey anlatırdı. `visible` yine bir ROL LİSTESİ
 * değil bir SORUDUR; menüden gizlemek yalnız görgü kuralıdır, asıl engel RLS.
 */

const COLLAPSE_KEY = "orion.sidebar.collapsed";

/**
 * Dar ray genişliği. 3.5rem (56px) idi: etiketsiz 16px'lik ikonlar 56px'lik
 * rayda kayboluyor, marka sembolü de sığmıyordu. 4.5rem'de ikon 24px'e çıkar,
 * satır 44px'lik dokunma hedefi olur ve sembol kırpılmadan durur.
 * Geniş kip 15rem'de kalır — orada etiketler zaten okunuyor.
 */
const SIDEBAR_W_COLLAPSED = "4.5rem";
const SIDEBAR_W_EXPANDED = "15rem";

/** Hiç değişmeyen depo — yalnız "hidrasyon bitti mi" sorusu için. */
const subscribeNever = () => () => {};

/**
 * Dar ekrandaki bölüm adı — aynı deftere sorulur.
 *
 * Elle yazılmış bir `if` zinciriydi; yeni bölüm eklendiğinde güncellenmesi
 * unutulduğunda telefonda başlıksız kalırdı. En UZUN eşleşen adres kazanır:
 * `/purchasing` ile `/purchasing/teslimat` aynı bölümdür ama iki bölümün
 * adresi birbirinin öneki olursa (bugün olmuyor, yarın olabilir) daha
 * belirgin olanı seçilmelidir.
 */
function sectionLabel(pathname: string | null): string {
  if (!pathname) return "";
  let en = "";
  for (const s of WORKSPACE_SECTIONS) {
    if (pathname.startsWith(s.href) && s.href.length > en.length) en = s.href;
  }
  return WORKSPACE_SECTIONS.find((s) => s.href === en)?.label ?? "";
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
      {/* Marka — koyu zeminde beyaz logo (Orion Cranes marka kılavuzu).
          Bağlantı AÇILIŞ PANOSUNA gider: uygulamanın "başa dön" adresi odur
          (menünün de ilk satırı). Bir süre `/projects`te kalmıştı — logo
          uygulamanın en görünür ev bağlantısıdır ve orayı Mühendislik
          göstermek panonun kendisini bulunmaz yapıyordu. */}
      <Link
        href={LANDING_PATH}
        onClick={onNavigate}
        title={collapsed ? `${COMPANY_NAME} · ${APP_NAME}` : undefined}
        className={cn("block pt-5 pb-4", collapsed ? "px-2" : "px-4")}
      >
        {/* Dar kipte MARKA SEMBOLÜ basılır, kısaltılmış lockup değil.
            Daha önce lockup `max-w-[26px] object-cover` ile kırpılıyordu;
            sembol 18px yükseklikte 27,7px yer tuttuğu için kırpma tam
            sembolün üstüne düşüyor ve logo yarıda kesiliyordu. Sembolün kendi
            dosyası zaten var (`orion-symbol-white.svg`) — kırpmaya gerek yok
            ve dar rayda büyütülebiliyor. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={collapsed ? "/brand/orion-symbol-white.svg" : "/brand/orion-logo-white.svg"}
          alt="Orion Cranes"
          className={cn("w-auto", collapsed ? "mx-auto h-6" : "h-[18px]")}
        />
        {!collapsed && (
          <span className="mt-1.5 block font-mono text-[11px] uppercase tracking-[0.14em] text-sidebar-foreground/60">
            {APP_NAME}
          </span>
        )}
      </Link>

      <div className={cn("border-t border-sidebar-border", collapsed ? "mx-2" : "mx-4")} />

      {/* Navigasyon */}
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {!collapsed && (
          <div className="px-2 pb-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-sidebar-foreground/50">
            Çalışma Alanı
          </div>
        )}
        <ul className="grid gap-0.5">
          {visibleSections(role).map((item) => {
            // KÖK ADRES TAM EŞLEŞİR. `startsWith("/")` her yolu doğrular ve
            // Panel satırı bütün bölümlerde birden aktif görünürdü.
            const active =
              item.href === "/" ? pathname === "/" : pathname?.startsWith(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  // Dar kipte etiket yok, ipucu bölümün ADIDIR; geniş kipte
                  // etiket zaten okunuyor, ipucu ne işe yaradığını söyler.
                  title={collapsed ? item.label : item.hint}
                  className={cn(
                    // Kırmızı sol çentik: omurga motifinin menüdeki devamı;
                    // pasifte şeffaf tutulur ki aktifleşince metin kaymasın.
                    // Dokunmatikte satır 36px'ten 40px'e çıkar — mobil çekmece
                    // menünün tek hâli, hedefler orada daralmamalı.
                    "flex items-center gap-2.5 border-l-2 border-l-transparent py-2 text-sm transition-colors pointer-coarse:py-2.5",
                    collapsed ? "justify-center px-0 py-2.5" : "px-2.5",
                    active
                      ? "border-l-primary bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                  )}
                >
                  <BrandIcon
                    name={item.icon as BrandIconName}
                    className="size-4 shrink-0"
                  />
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
              collapsed ? "justify-center px-0 py-2.5" : "px-2.5"
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
  const pathname = usePathname();

  // Revizyon ekranı: hesap raporu editörü ve onun alt sayfaları (ekipman
  // paneli). Mühendis günün büyük kısmını burada geçirir ve ekranın yatay
  // genişliğine ihtiyaç duyar — MENÜ BURAYA GİRİLDİĞİNDE KENDİLİĞİNDEN DARALIR.
  // Yeni hesap raporu oluşturmak da buraya yönlendirir, ayrı bir kural
  // gerekmez. Kalıp `isFrame`ten AYRIDIR ve daha geniştir: `isFrame` sabit
  // çerçeve yerleşimini seçer ve alt sayfaları bilinçli olarak dışarıda
  // bırakır (aşağıdaki nota bakın); daralma ise revizyonun tamamı boyunca
  // sürmelidir, yoksa editörden ekipman paneline geçince menü geri açılırdı.
  // MALİYET EDİTÖRÜ DE BİR REVİZYON EKRANIDIR (`/offers/<id>/costs/<id>`).
  // Adresinde "revisions" geçmez çünkü kendi zinciri vardır (M0/M1) ve teklif
  // revizyonlarıyla karışmaması için bilerek ayrı adlandırıldı; ama ekran
  // davranışı birebir aynıdır — bölüm rayı + kendi kaydırma kabı, geniş tablo,
  // uzun oturum. Kalıba eklenmeseydi menü daralmaz ve sayfa çerçeve kipine
  // girmezdi: editör 1000 px'e büyür, `main` onu kırpar ve kaydırılamazdı
  // (TEKLIF-17'de iki kez yaşanan hatanın aynısı).
  const isRevisionScreen = /\/revisions\/[^/]+|\/costs\/[^/]+/.test(pathname ?? "");

  const [open, setOpen] = useState(false);
  /**
   * Kullanıcının KALICI daralt tercihi — normal sayfalarda geçerlidir.
   * `useStoredFlag` tam bu iş için var: efekt içinde `setState` ile okumak hem
   * ilk kareyi yanlış genişlikte boyuyor hem zincirleme render tetikliyordu.
   */
  const [storedCollapsed, toggleStored] = useStoredFlag(COLLAPSE_KEY);
  /**
   * Revizyon ziyaretine özel geçersiz kılma.
   *
   * Editör her girişte daralmış açılır; mühendis isterse orada genişletir ama
   * bu KALICI DEĞİLDİR: revizyondan çıkıp geri girince menü yine daralır ve
   * normal sayfalardaki tercihi bozulmaz. Kalıcı yazılsaydı editörde bir kez
   * genişletmek bütün uygulamanın tercihini değiştirirdi.
   */
  const [revisionOverride, setRevisionOverride] = useState<boolean | null>(null);
  /**
   * Rota sınıfı değişince ziyarete özel geçersiz kılma sıfırlanır. Efekt
   * değil, RENDER SIRASINDA düzeltme: efektle yapılsaydı menü bir kare yanlış
   * genişlikte boyanırdı (React'in "bir prop değişince state'i ayarlama"
   * kalıbı).
   */
  const [prevIsRevisionScreen, setPrevIsRevisionScreen] = useState(isRevisionScreen);
  if (prevIsRevisionScreen !== isRevisionScreen) {
    setPrevIsRevisionScreen(isRevisionScreen);
    setRevisionOverride(null);
  }
  const collapsed = isRevisionScreen ? (revisionOverride ?? true) : storedCollapsed;
  /**
   * Mobil çekmece açıkken ARKA SAYFA KAYMAZ, Esc kapatır ve Tab çekmecenin
   * İÇİNDE döner.
   *
   * Çekmece `fixed` bir örtüdür ama gövde kaydırması engellenmediği için
   * telefonda menüde parmak sürüklemek arkadaki uzun listeyi kaydırıyordu:
   * kullanıcı menüyü kapattığında sayfa bambaşka bir yerdeydi. Klavye
   * kullanıcısı için de tek çıkış yolu örtüye tıklamaktı — üstelik `aria-modal`
   * yazmasına rağmen odak tuzağı YOKTU ve Tab arkadaki görünmez bağlantılara
   * geçiyordu. Üçü de artık `useOverlay`da, bölüm listesi tabakasıyla ORTAK.
   */
  const drawerRef = useRef<HTMLElement>(null);
  const closeDrawer = useCallback(() => setOpen(false), []);
  useOverlay(open, closeDrawer, drawerRef);
  /**
   * ŞERİDİN GERÇEK YÜKSEKLİĞİ bir CSS değişkenine yazılır.
   *
   * Şerit `lg` altında bir ya da İKİ satır olabilir (eylem yuvası boşsa hiç
   * çizilmez). Buna bağlı üç yer var ve üçü de sabit 48 px varsayamaz: toast
   * konumu (`layout.tsx`), bölüm listesi tabakasının üst kenarı ve çapa
   * kaydırması. Ölçüm tek yerde yapılır, tüketiciler `var(--app-header-h)`
   * okur; varsayılanı `globals.css`te 48 px'tir (sunucu boyaması ve ilk kare).
   */
  const headerRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    // `getBoundingClientRect` (sınır kutusu), `contentRect` DEĞİL: şeridin
    // `border-b`si de altındaki içeriği ittiği için paya girmelidir.
    const write = () =>
      document.documentElement.style.setProperty(
        "--app-header-h",
        `${Math.round(el.getBoundingClientRect().height)}px`
      );
    // ÜÇ TETİKLEYİCİ, çünkü hiçbiri tek başına yetmiyor:
    //
    // 1) SENKRON ilk ölçüm — efekt düzen hesaplandıktan sonra çalışır.
    // 2) `MutationObserver` — eylemler şeride PORTALLA gelir ve portal, kabuk
    //    boyandıktan SONRAKİ bir commit'te basılır; ilk ölçüm o yüzden hep tek
    //    satırı (49px) görüyordu. Mutation geri çağrıları mikrogörevdir, yani
    //    boyama döngüsünden bağımsız olarak HER ZAMAN teslim edilir.
    // 3) `ResizeObserver` — yazı tipi yüklenmesi, sarma, `lg` eşiğini geçen
    //    pencere boyu gibi saf ölçü değişiklikleri.
    //
    // (2) olmadan sekme arka plandayken değişken 48px'te takılıyordu: `RO` geri
    // çağrıları boyama döngüsünde teslim edilir ve görünmeyen sekmede o döngü
    // durur — iki satırlı şeritte bildirim eylem düğmelerinin üstüne otururdu.
    write();
    const mo = new MutationObserver(write);
    mo.observe(el, { childList: true, subtree: true });
    const ro = new ResizeObserver(write);
    ro.observe(el);
    return () => {
      mo.disconnect();
      ro.disconnect();
    };
    // `pathname`e bağlı: sayfanın eylemi olup olmaması şeridin yüksekliğini
    // değiştirir; her gezinmede taze bir senkron ölçüm istiyoruz.
  }, [pathname]);
  /**
   * Genişlik geçişi HİDRASYONDAN SONRA açılır: sunucu tercihi bilemez ve geniş
   * çizer, istemci daralmış okuduğunda sidebar her açılışta 240px'ten kayarak
   * daralırdı. Hiç değişmeyen bir depoya abone olmak bu soruyu `setState`li
   * bir efekte gerek kalmadan sorar (react-hooks/set-state-in-effect).
   */
  const ready = useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false
  );

  // Düğme ve Ctrl+B revizyon ekranında ZİYARETE ÖZEL, dışarıda KALICI yazar.
  const toggleCollapsed = useCallback(() => {
    if (isRevisionScreen) {
      setRevisionOverride((v) => !(v ?? true));
      return;
    }
    toggleStored();
  }, [isRevisionScreen, toggleStored]);

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
  const isFrame = /(\/revisions\/[^/]+|\/costs\/[^/]+)\/?$/.test(pathname ?? "");
  // Liste sayfaları ekranın TAMAMINI kullanır. Okuma genişliği kuralı (max-w-6xl)
  // metin için doğrudur ama çok sütunlu tabloda ters teper: sütunlar sıkışır,
  // durum menüsü kırpılır. Form ve rapor sayfaları dar kalmaya devam eder.
  // İş Takibi'nin ÜÇ sayfası da geniştir: günlük girişte satırlar yan yana
  // uzar, analiz grafik ızgarası, kayıtlar çok sütunlu tablodur.
  // Teknik Resimler'in DÖRT sayfası da geniştir: paket listesi çok sütunlu,
  // parça defteri daha da geniş, montaj ağacı derin girintili, rapor uzun
  // metinli. Dar kip hiçbirine yaramaz.
  // Satın Alma'nın DÖRT sayfası da geniştir: talep havuzu on sütunlu, teslim ve
  // ödeme takvimleri ay ay yan yana açılır, fiyat arşivi geçmiş satırları
  // tarih tarih sıralar. Dar kip hiçbirine yaramaz.
  // Finans'ın BEŞ sayfası da geniştir: personel listesi on sütunlu (ad · görev ·
  // kategori · giriş · kıdem · telefon · belge), maaş tablosu ay boyunca bütün
  // personeli net + iki mesai sütunu + tutarla yan yana dizer, özet yıl ay
  // çapraz tablosudur, kur tablosu dört kur çiftini birlikte gösterir. Dar kip
  // hiçbirine yaramaz.
  // İş HUB'ı da geniştir (Genel Bakış · Akış · Bağlantılar): kalem tablosu,
  // termin tablosu ve olay akışı yan yana genişlikten kazanır. FORMLAR DAR
  // KALIR — `/jobs/new` ve `/jobs/[id]/edit` okuma değil yazma ekranıdır ve
  // uzun bir formun satır genişliği okunabilirlik sınırını aşmamalıdır.
  const jobsHub =
    /^\/jobs\/[^/]+/.test(pathname ?? "") &&
    !/^\/jobs\/new(\/|$)/.test(pathname ?? "") &&
    !/\/edit(\/|$)/.test(pathname ?? "");
  const isWide =
    /^\/(jobs|projects|sales)\/?$/.test(pathname ?? "") ||
    jobsHub ||
    /^\/worklog(\/|$)/.test(pathname ?? "") ||
    /^\/purchasing(\/|$)/.test(pathname ?? "") ||
    /^\/personnel(\/|$)/.test(pathname ?? "") ||
    /^\/drawings(\/|$)/.test(pathname ?? "");
  const sidebarW = collapsed ? SIDEBAR_W_COLLAPSED : SIDEBAR_W_EXPANDED;

  return (
    <div
      // Sabit çerçeve YALNIZ masaüstünde: dar ekranda viewport yüksekliğine
      // sıkıştırmak bölüm rayını da içeriği de okunmaz hâle getirirdi; orada
      // doğal sayfa kaydırması doğru davranıştır.
      // `min-h-dvh` (`min-h-screen` = 100vh DEĞİL): mobil tarayıcıda 100vh
      // adres çubuğu gizliyken ölçülen BÜYÜK görünür alandır, çubuk açıkken
      // sayfa her zaman ~60-90px fazladan kaydırılabilir kalıyordu ("hayalet
      // kaydırma"). Kenar çubuğu zaten `h-dvh` kullanıyordu — ikisi ayrışmıştı.
      className={cn("flex", isFrame ? "min-h-dvh lg:h-dvh lg:overflow-hidden" : "min-h-dvh")}
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
          <aside
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label="Ana menü"
            // `max-w-[85%]`: 320px'lik küçük telefonlarda 256px'lik çekmece
            // ekranın %80'ini kaplayıp arkadaki içeriğe dokunacak yer
            // bırakmıyordu; örtüye basıp kapatmak zorlaşıyordu.
            className="absolute inset-y-0 left-0 flex w-64 max-w-[85%] flex-col overflow-y-auto overscroll-contain border-l-[14px] border-l-primary bg-sidebar text-sidebar-foreground shadow-xl"
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              // 40px dokunma hedefi (eskiden 24px); konum optik olarak aynı
              // kalsın diye negatif marj yerine kenar boşluğu kısıldı.
              //
              // `absolute` DEĞİL `sticky`: kap `overflow-y-auto` olduğu için
              // mutlak konumlu düğme İÇERİĞİN tepesine çakılıydı ve kısa
              // ekranda (yatay tutulan telefon) menü kaydırılınca yukarı
              // kayıp gözden kayboluyordu — çekmeceyi kapatmanın görünür yolu
              // kalmıyordu. `-mb-10` düğmenin kendi yüksekliğini (40px) geri
              // alır, yani akışta yer kaplamaz ve marka bloğu yerinden oynamaz.
              className="sticky top-2 z-10 -mb-10 mr-1.5 ml-auto block rounded-md p-2.5 text-sidebar-foreground/70 hover:bg-sidebar-accent"
              aria-label="Menüyü kapat"
            >
              <BrandIcon name="close" className="size-5" />
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
        {/*
          ÜST ŞERİT — `lg` üstünde TEK satır (48 px), `lg` altında İKİ satır.
          Kimlik satırı (hamburger · bölüm adı · sayfa başlığı) her zaman
          48 px'tir; eylemler dar ekranda kendi satırına iner ve yatay kayar.

          NEDEN BÖLÜNDÜ: eylem kümesi `shrink-0`dır ve küçülemez. Hesap raporu
          ekranında doğal genişliği ~520-560 px; 375 px'lik telefonda şerit
          taşıyor, belge yatay kayıyordu. `position: sticky` YALNIZ DİKEY
          sabitler — sağa kaydırınca şeridin zemini ekrandan çıkıyor ve şerit
          "kayıyor" görünüyordu. Şeridi daha da sıkıştırmak çözüm değildi:
          altı eylem bir satıra hiçbir sıkıştırmayla sığmaz.
        */}
        <header
          ref={headerRef}
          className="sticky top-0 z-30 flex shrink-0 flex-col border-b bg-background lg:h-12 lg:flex-row lg:items-center lg:gap-2 lg:px-6"
        >
          {/* KİMLİK SATIRI — her genişlikte tam 48 px, hiçbir zaman sarmaz. */}
          {/* `lg:min-w-[10rem]` — `lg:min-w-0` DEĞİL. Esnek kutuda daralma
              taban genişliğiyle ağırlıklandırılır: bu satırın tabanı `flex-1`
              yüzünden 0'dır, yani yer daralınca DARALMAZ, buna karşılık
              eylemler bütün açığı kapatmak zorunda kalır ve başlık sıfıra
              çöker. 160px'lik kelepçe sayfa kimliğini garanti eder; artan
              daralmayı eylem şeridi kendi içinde kaydırarak karşılar. */}
          <div className="flex h-12 shrink-0 items-center gap-1 px-3 sm:gap-2 sm:px-4 lg:h-auto lg:min-w-[10rem] lg:flex-1 lg:px-0">
            <button
              type="button"
              onClick={() => setOpen(true)}
              // 40px dokunma hedefi (eskiden 28px). Telefonda ve 768px tablet
              // portrede gezinmenin TEK yolu bu düğme; negatif marj ile optik
              // hizası korunurken tıklama alanı şeridin tamamına yayılır.
              className="-ml-2 rounded-md p-2.5 text-muted-foreground hover:bg-muted hover:text-foreground lg:hidden"
              aria-label="Menüyü aç"
              aria-expanded={open}
            >
              <BrandIcon name="menu" className="size-5" />
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
            {/*
              Bölüm adı YALNIZ DAR EKRANDA görünür.
              Geniş ekranda sayfa başlığı yuvaya geliyor ve bölüm adını zaten
              içeriyor ("Mühendislik" / "İş Takibi"); ikisi yan yana durunca aynı
              kelime iki kez okunuyordu. Telefonda ise başlığı olmayan sayfalarda
              bölüm adı tek kimliktir.
              `min-w-0 truncate`: uzun ad sağdaki içeriğin üstüne binmesin.
            */}
            <div className="oc-kicker min-w-0 truncate text-foreground/80 lg:hidden">
              {sectionLabel(pathname)}
            </div>
            {/*
              SAYFA KİMLİĞİ YUVASI — geri oku, kırıntı yolu, başlık ve açıklama
              buraya portalla gelir (components/page-header.tsx). EYLEMLER ayrı
              yuvadadır (aşağıda). Standart künyesi (FEM 1.001 · DIN 15018 ·
              CMAA 70) buradan KALDIRILDI: uygulama yalnız hesap raporu değil,
              künye beş bölümün üçünde konu dışıydı. Standart referansları asıl
              yerlerinde — hesap satırlarındaki tıklanabilir rozetlerde — duruyor.
            */}
            <PageHeaderHost />
            {/* Zil kimlik satırının SAĞ ucunda ve her genişlikte görünür:
                eylem şeridi sayfadan sayfaya değişir, bildirim ise kişiye
                aittir ve sayfayla ilgisizdir. Satır 48px kalır — zil kutu
                büyütmez, dokunma payını `.oc-tap-square` tamamlar. */}
            <div className="ml-auto flex shrink-0 items-center gap-0.5 lg:ml-0">
              <ThemeToggle />
              <NotificationBell />
            </div>
            {/* Komut paleti görünmez; Ctrl/⌘+K dinleyicisini taşır. */}
            <CommandPalette />
          </div>
          {/* EYLEM SATIRI — dar ekranda ikinci satır ve yatay kayar, `lg`
              üstünde şeridin sağ ucu. Eylemi olmayan sayfada `empty:hidden`
              ile hiç çizilmez, yani dikey yer yemez. */}
          <PageActionsHost />
        </header>
        <main
          // Telefonda kenar boşluğu bir kademe kısılır: 375px ekranda
          // `px-4` içeriğin %8,5'ini yiyordu ve asıl darlığı çeken şey tablo
          // sütunlarıydı. ≥640px'te eski değerlere döner.
          // `relative` BİR SÜSLEME DEĞİL, KIRPMANIN ŞARTI (MOBIL-18):
          // `overflow-hidden` KONUMLANMIŞ bir çocuğu ancak o çocuğun
          // KAPSAYICI BLOĞU ise kırpar. `main` konumsuz kaldığı sürece
          // içerideki her `position: absolute` öğe (Tailwind'in `sr-only`si
          // dahil) kırpmadan kaçar ve sayfayı kendi statik konumuna kadar
          // uzatır — çerçeve kipinde olmaması gereken ikinci bir kaydırma.
          className={cn(
            "relative min-w-0 flex-1",
            isFrame
              ? "px-3 py-3 sm:px-4 lg:min-h-0 lg:overflow-hidden lg:px-6"
              : "px-3 py-4 sm:px-4 sm:py-6 lg:px-8"
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
      {/* ARKA PLANDAKİ TEKNİK RESİM YÜKLEMESİ — kabuğun içinde olmak zorunda.
          Yükleme artık sihirbaz sökülse de sürüyor (drawings/new/upload-store.ts);
          görünmeyen bir iş olmayan bir iştir ve kullanıcı sekmeyi kapatıp
          kendi yüklemesini keser. Gösterge iş yokken hiçbir şey çizmez. */}
      <UploadIndicator />
    </div>
  );
}
