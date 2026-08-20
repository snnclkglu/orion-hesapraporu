// Pano özet kartı — liste ekranlarının üstündeki dört kutu.
//
// İşler, Mühendislik ve Teknik Resimler aynı kartı basıyordu; iki kopya zaten
// vardı ve üçüncüsü yazılacaktı. Aynı görsel dilin üç yerde ayrı ayrı
// tutulması, biri değişince öbürlerinin sessizce ayrışması demek.
//
// Sunum katmanıdır: veri almaz, biçimlemez, yalnız gösterir. Sayı `value`ye
// BİÇİMLENMİŞ metin olarak verilir (tr-TR ayracı çağıranın işidir).

import { cn } from "@/lib/utils";

/**
 * `dense` — ALTI KART TEK SATIRA sığsın diye (kullanıcı kararı, 13.08.2026:
 * "Maaş sayfasındaki kutuları küçültüp 6 kutuyu tek satırda verelim").
 *
 * Kısılan şey YOĞUNLUKtur, BİLGİ DEĞİL: dolgu 16→10px, ikon 36→28px, sayı
 * `text-xl`→`text-base` iner; etiket, sayı ve ipucu üçü de yerinde kalır.
 * Ayrı bir bileşen yazmak yerine bir bayrak, çünkü iki kopya zamanla ayrışır —
 * bu dosyanın var oluş gerekçesi tam olarak buydu.
 *
 * İpucu 11px'in altına İNMEZ (dokunmatik MOBIL-11); yoğunluk okunurluğu yemez.
 */
export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  dense,
  responsiveCompact,
  className,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  dense?: boolean;
  /** Telefonda tek satırlık mikro özet, geniş ekranda normal kart. */
  responsiveCompact?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 items-start rounded-lg border bg-card",
        responsiveCompact
          ? "gap-1 p-1.5 sm:gap-2 sm:p-2.5 lg:gap-3 lg:p-4"
          : dense
            ? "gap-2 p-2.5"
            : "gap-3 p-4",
        className
      )}
    >
      <span
        className={cn(
          "flex shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary",
          responsiveCompact
            ? "hidden size-7 sm:flex lg:size-9"
            : dense
              ? "size-7"
              : "size-9"
        )}
      >
        <Icon
          className={
            responsiveCompact
              ? "size-3.5 lg:size-4"
              : dense
                ? "size-3.5"
                : "size-4"
          }
        />
      </span>
      <div className="min-w-0 leading-tight">
        <div
          className={cn(
            "oc-kicker truncate text-muted-foreground",
            responsiveCompact && "text-[9px] sm:text-[10px] lg:text-[11px]"
          )}
          title={label}
        >
          {label}
        </div>
        <div
          className={cn(
            "mt-0.5 max-w-full truncate font-mono font-semibold tabular-nums tracking-tight",
            responsiveCompact
              ? "text-[11px] sm:text-base lg:text-xl"
              : dense
                ? "text-base"
                : "text-xl"
          )}
          title={value}
        >
          {value}
        </div>
        {/* `truncate` kırptığında tam metnin görünebileceği tek yer ipucudur. */}
        {hint && (
          <div
            className={cn(
              "mt-0.5 truncate text-[11px] text-foreground/70",
              responsiveCompact && "hidden lg:block"
            )}
            title={hint}
          >
            {hint}
          </div>
        )}
      </div>
    </div>
  );
}
