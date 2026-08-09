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

import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { APP_HEADER_SLOT_ID } from "@/lib/app";
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

const subscribe = makeSubscribe(APP_HEADER_SLOT_ID);
const getHost = () => document.getElementById(APP_HEADER_SLOT_ID);
/** Sunucuda DOM yoktur: `undefined` "henüz bilinmiyor" demektir, "yok" değil. */
const getServerHost = (): HTMLElement | null | undefined => undefined;

/**
 * Başlık bloğunu üst şeride taşır.
 *
 * Sunucu çıktısı BOŞTUR — portal sunucuda yer alamaz. `null` yerine yerinde
 * bir kopya basılsaydı başlık bir kare sayfanın içinde belirip sonra şeride
 * zıplardı; boş bırakmak o sıçramayı ortadan kaldırır.
 */
function HeaderSlot({ children }: { children: React.ReactNode }) {
  const host = useSyncExternalStore(subscribe, getHost, getServerHost);
  if (host === undefined) return null;
  if (host) return createPortal(children, host);
  // Yuvası olmayan bağlam (dev önizleme): başlık yerinde çizilir.
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 border-b pb-2">
      {children}
    </div>
  );
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
 * `children` sağa yaslanır — şeridin sağ ucu eylem bölgesidir. Başlık ve
 * açıklama daralınca KIRPILIR, sarmaz: şerit tek satırdır ve yüksekliği
 * sayfadan sayfaya oynamamalıdır.
 */
export function PageHeader({
  title,
  hint,
  /** Başlığın önünde küçük mono üst başlık (ör. kırıntı yolu) */
  kicker,
  children,
}: {
  title: React.ReactNode;
  hint?: React.ReactNode;
  kicker?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <HeaderSlot>
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
      {children && (
        <div className="ml-auto flex shrink-0 items-center gap-2">{children}</div>
      )}
    </HeaderSlot>
  );
}

/**
 * Yalnız kabuğun kendi kullandığı yuva kabı. Sayfalar bunu ÇAĞIRMAZ.
 * `flex-1` verilir ki başlık şeridin tamamına yayılsın ve eylemler sağa dayansın.
 */
export function PageHeaderHost({ className }: { className?: string }) {
  return (
    <div
      id={APP_HEADER_SLOT_ID}
      className={cn("flex min-w-0 flex-1 items-center gap-x-3", className)}
    />
  );
}
