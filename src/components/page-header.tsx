"use client";

// Sayfa başlığı — KABUĞUN ÜST ŞERİDİNDE.
//
// Eskiden her sayfa kendi başlık satırını çiziyordu: üst şerit (48 px, içinde
// yalnız bölüm adı ve bir standart künyesi) + başlık satırı (~64 px) + eylem
// düğmeleri. Üçü de aynı şeyi söylüyordu ve ekranın üst yüzünü yiyordu. Artık
// başlık, açıklama ve eylemler üst şeridin İÇİNE taşınır; kazanılan yer
// doğrudan tabloya, grafiğe, sihirbaza gider.
//
// Taşıma bir PORTALDIR (editörün durum şeridiyle aynı desen,
// EDITOR_STATUS_SLOT_ID): başlık sunucu bileşeninde üretilir, kabuk ise istemci
// bileşenidir; ikisini birleştirmenin en ucuz yolu budur. Yuva bulunamayan
// bağlamlarda (dev önizleme sayfaları) başlık YERİNDE çizilir, kaybolmaz.
//
// KİMLİK VE EYLEMLER AYRI YUVALARDADIR (bkz. APP_ACTIONS_SLOT_ID). `lg`
// üstünde ikisi aynı satırda görünür; `lg` altında eylemler kendi satırına
// iner ve yatay kayar. Bölme, "üst bar kayıyor" hatasının yapısal çözümüdür:
// tek satırda `shrink-0` bir eylem kümesi 375 px'lik ekranı KAÇINILMAZ olarak
// taşırıyordu.

import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { APP_ACTIONS_SLOT_ID, APP_HEADER_SLOT_ID } from "@/lib/app";
import { cn } from "@/lib/utils";

// Abonelik ve anlık görüntü fonksiyonları modül düzeyindedir: her boyamada yeni
// bir işlev üretilseydi React aboneliği baştan kurardı.

/**
 * Yuva DOM'a girene kadar bekler.
 *
 * Kabuk yuvayı sunucuda bastığı için normalde ilk okumada bulunur ve gözlemci
 * hiç kurulmaz. Gözlem yalnız yuvanın SONRADAN geldiği durum içindir: editör
 * ekranında durum şeridi bu başlığın İÇİNE portallanır, yani hedefi ancak
 * başlık kendi portalını kurduktan sonra doğar. Efekt sırasına güvenmek
 * kırılgandı — bir kez bulununca gözlemci kapanır, sürekli maliyet kalmaz.
 */
function makeSubscribe(id: string) {
  return (onChange: () => void) => {
    if (document.getElementById(id)) return () => {};
    const observer = new MutationObserver(() => {
      if (!document.getElementById(id)) return;
      observer.disconnect();
      onChange();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  };
}

/** Sunucuda DOM yoktur: `undefined` "henüz bilinmiyor" demektir, "yok" değil. */
const getServerHost = (): HTMLElement | null | undefined => undefined;

/**
 * Bir yuva kimliği için abonelik üçlüsü. Fabrika, iki yuvanın (başlık ve
 * eylemler) aynı mekanizmayı modül düzeyinde sabit işlevlerle paylaşmasını
 * sağlar — üçlü çağrı sırasında üretilseydi her boyamada abonelik yenilenirdi.
 */
function slotStore(id: string) {
  return { subscribe: makeSubscribe(id), getHost: () => document.getElementById(id) };
}

const headerStore = slotStore(APP_HEADER_SLOT_ID);
const actionsStore = slotStore(APP_ACTIONS_SLOT_ID);

/**
 * İçeriği verilen yuvaya taşır.
 *
 * Sunucu çıktısı BOŞTUR — portal sunucuda yer alamaz. `null` yerine yerinde
 * bir kopya basılsaydı başlık bir kare sayfanın içinde belirip sonra şeride
 * zıplardı; boş bırakmak o sıçramayı ortadan kaldırır.
 *
 * `fallback` yuvası olmayan bağlam (dev önizleme) içindir: orada içerik
 * yerinde çizilir ki önizleme sayfaları boş görünmesin.
 */
function Slot({
  store,
  fallbackClassName,
  children,
}: {
  store: ReturnType<typeof slotStore>;
  fallbackClassName: string;
  children: React.ReactNode;
}) {
  const host = useSyncExternalStore(store.subscribe, store.getHost, getServerHost);
  if (host === undefined) return null;
  if (host) return createPortal(children, host);
  return <div className={fallbackClassName}>{children}</div>;
}

/**
 * Sayfa başlığı ve eylemleri.
 *
 * ```tsx
 * <PageHeader title="Mühendislik" hint="Hesap raporu projeleri ve revizyon arşivi">
 *   <NewProjectDialog … />
 * </PageHeader>
 * ```
 *
 * Başlık ve açıklama daralınca KIRPILIR, sarmaz: kimlik satırı tek satırdır ve
 * yüksekliği sayfadan sayfaya oynamamalıdır. `children` ise ayrı yuvaya gider
 * ve dar ekranda kendi satırında yatay kayar.
 *
 * BİR EKRANDA YALNIZ BİR `PageHeader` OLUR. İkisi aynı yuvaya yazar ve İKİSİ
 * BİRDEN çizilir — iç içe düzenlerde (ör. `drawings/layout` + `drawings/[id]`)
 * başlığı yalnız DIŞ katman basar.
 */
export function PageHeader({
  title,
  hint,
  /** Başlığın önünde küçük mono üst başlık (ör. kırıntı yolu) */
  kicker,
  /**
   * Bir üst seviyeye dönüş adresi.
   *
   * `kicker` (kırıntı yolu) yalnız `xl` üstünde görünür; 1280 px ALTINDA
   * kullanıcıda hiçbir "yukarı" bağlantısı kalmıyordu — telefonda derin bir
   * sayfadan çıkmanın tek yolu tarayıcı geri tuşuydu. Ok da tam o aralıkta
   * görünür, kırıntı yolu devreye girince kaybolur.
   */
  backHref,
  backLabel,
  children,
}: {
  title: React.ReactNode;
  hint?: React.ReactNode;
  kicker?: React.ReactNode;
  backHref?: string;
  backLabel?: string;
  children?: React.ReactNode;
}) {
  return (
    <>
      <Slot
        store={headerStore}
        fallbackClassName="flex min-w-0 items-center gap-x-3 border-b pb-2"
      >
        {backHref && (
          <Link
            href={backHref}
            aria-label={backLabel ?? "Geri"}
            title={backLabel ?? "Geri"}
            className="oc-tap-square -ml-1 grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground xl:hidden"
          >
            <ChevronLeft className="size-4" />
          </Link>
        )}
        {kicker && (
          <span className="oc-kicker hidden shrink-0 text-muted-foreground xl:inline">{kicker}</span>
        )}
        <h1 className="min-w-0 shrink truncate text-sm font-semibold tracking-tight">{title}</h1>
        {hint && (
          // Açıklama İKİNCİL: dar ekranda ilk feda edilen odur, başlık ve
          // eylemler kalır.
          <p className="hidden min-w-0 shrink truncate text-xs text-muted-foreground lg:block">
            {hint}
          </p>
        )}
      </Slot>
      {children && (
        <Slot
          store={actionsStore}
          fallbackClassName="flex flex-wrap items-center gap-2 border-b pb-2"
        >
          {children}
        </Slot>
      )}
    </>
  );
}

/**
 * Yalnız kabuğun kendi kullandığı yuva kapları. Sayfalar bunları ÇAĞIRMAZ.
 */

/** Kimlik yuvası: geri oku, kırıntı yolu, başlık, açıklama. */
export function PageHeaderHost({ className }: { className?: string }) {
  return (
    <div
      id={APP_HEADER_SLOT_ID}
      className={cn("flex min-w-0 flex-1 items-center gap-x-3", className)}
    />
  );
}

/**
 * Eylem yuvası.
 *
 * `lg` ALTINDA kendi satırıdır: yatay kayar (`.oc-scrollx` ile kenar gölgesi —
 * AGENTS dokunmatik MOBIL-8, mobil tarayıcı kaydırma çubuğu çizmez) ve
 * `empty:hidden` sayesinde eylemi olmayan sayfada HİÇ ÇİZİLMEZ, yani dikey yer
 * yemez. `lg` üstünde şeridin sağ ucuna döner ve görünüm eskisiyle birebir
 * aynıdır.
 *
 * `items-center` + `gap-2`: düzeni yuva verir, `PageHeader` çocukları ayrıca
 * sarmalamaz — sarmalasaydı `lg` altındaki yatay kaydırma sarmalayıcının
 * içinde kalır, kenar gölgesi yanlış kaba binerdi.
 */
export function PageActionsHost({ className }: { className?: string }) {
  return (
    <div
      id={APP_ACTIONS_SLOT_ID}
      className={cn(
        "oc-scrollx flex min-w-0 items-center gap-2 overflow-x-auto overscroll-x-contain border-t px-3 py-1.5 [--oc-scroll-bg:var(--background)] empty:hidden sm:px-4",
        // `lg`de de KAYAR, taşmaz. Eskiden eylemler `shrink-0` bir kutudaydı ve
        // 1024–1280px'lik pencerede kabuğun `lg:overflow-hidden`ı taşmayı
        // KIRPIYORDU: uzun proje adlı bir revizyonda "Yayınla" ve "Ekipman
        // Listesi" ekranın dışında kalıp erişilemiyordu. Kaydırma kabı bunu da
        // kapatır; gölge ipucu yalnız gerçekten taşınca görünür (`.oc-scrollx`
        // `background-attachment: local` ile kendiliğinden söner), o yüzden
        // `lg`de ayrıca kapatmak gerekmez.
        //
        // `py-1`: `overflow-x` kutuyu kaydırma kabı yapar ve `overflow-y` de
        // `auto`ya düşer — dikey pay olmadan odak halkası (`outline-offset-2`)
        // kırpılırdı.
        "lg:border-t-0 lg:px-0 lg:py-1",
        className
      )}
    />
  );
}
