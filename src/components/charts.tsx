"use client";

// Pano grafikleri — zaman serisi, sıralı çubuk, halka ve ısı haritası.
//
// NEDEN `lib/diagrams` DEĞİL: oradaki katman bir teknik resim üreticisidir
// (`DiagramEl[]` → aynı model hem web hem PDF'e basılır). Kategorik ekseni,
// çubuk/dilim ilkeli ve etkileşimi yoktur; renkleri sabit hex'tir. Pano
// grafiği bunların TAMAMINI ister. İki katman ayrı kalır: mühendislik şeması
// kağıda basılır, pano ekranda okunur.
//
// ÇİZİM ARACI OLARAK HTML: çubuklar SVG değil düz div'dir. Gerekçe ölçekleme:
// bir SVG `viewBox` ile kabına sığdırıldığında YAZILAR DA ölçeklenir — dar
// kolonda okunmaz, geniş kolonda şişer. HTML kutusu yüzdeyle esner, yazı
// boyutu sabit kalır. Yay gerektiren tek grafik (halka) SVG'dir; orada yazı
// yoktur.
//
// RENK: seri rengi veriden yalnız TON AÇISI olarak gelir (`lib/tags.ts`
// mekanizması); doygunluk ve parlaklık `globals.css` `.oc-series-*` kuralında
// ve tema başına verilir. Grafikte elle hex yazılmaz.

import { useId, useState } from "react";
import { niceTicks } from "@/lib/diagrams/chart";
import { tagStyle } from "@/lib/tags";
import { fmtManHours } from "@/lib/work-log";
import { cn } from "@/lib/utils";

/** Bir serinin kimliği ve rengi (yığılmış grafiklerde dilim başına). */
export interface ChartSeries {
  key: string;
  label: string;
  hue: number;
}

/** Zaman serisinin bir sütunu. */
export interface ChartColumn {
  key: string;
  label: string;
  total: number;
  /** Seri anahtarı → değer */
  parts: Record<string, number>;
}

export interface ChartReferenceLine {
  key: string;
  label: string;
  value: number;
}

// ------------------------------------------------------------------- efsane

export function ChartLegend({
  series,
  className,
  onToggle,
  hidden,
}: {
  series: readonly ChartSeries[];
  className?: string;
  /** Verilirse efsane maddeleri tıklanabilir olur (seri gizle/göster) */
  onToggle?: (key: string) => void;
  hidden?: ReadonlySet<string>;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-1.5", className)}>
      {series.map((s) => {
        const off = hidden?.has(s.key) ?? false;
        const content = (
          <>
            <span className="oc-tag-dot" style={tagStyle(s.hue)} aria-hidden />
            <span className="truncate">{s.label}</span>
          </>
        );
        return onToggle ? (
          <button
            key={s.key}
            type="button"
            onClick={() => onToggle(s.key)}
            aria-pressed={!off}
            className={cn(
              // Efsane öğesi bir SERİYİ AÇIP KAPATAN denetimdir, salt etiket
              // değil — 17px'lik satır parmakla tutulmuyordu. Vurma alanı
              // dolguyla büyür, negatif kenar boşluğu efsanenin görsel
              // yüksekliğini olduğu gibi bırakır.
              "-my-1 flex items-center gap-1.5 py-1 text-[11px] transition-colors pointer-coarse:-my-2 pointer-coarse:py-2",
              off ? "text-muted-foreground/50 line-through" : "text-foreground/80 hover:text-foreground"
            )}
          >
            {content}
          </button>
        ) : (
          <span key={s.key} className="flex items-center gap-1.5 text-[11px] text-foreground/80">
            {content}
          </span>
        );
      })}
    </div>
  );
}

// ------------------------------------------------------- zaman serisi (yığılmış)

/**
 * Yığılmış zaman serisi. Sütun = zaman kovası, dilim = seri.
 *
 * BOŞ KOVA GÖSTERİLİR: `timeSeries(..., fill)` aradaki kayıtsız ayları da
 * üretir; onları atlamak iki kayıtlı ayı yan yana getirir ve duraklamayı
 * gizlerdi. Boş sütun yalnız taban çizgisiyle görünür.
 */
export function TimeBarChart({
  columns,
  series,
  height = 200,
  valueLabel = "adam·saat",
  format = fmtManHours,
  className,
}: {
  columns: readonly ChartColumn[];
  series: readonly ChartSeries[];
  height?: number;
  valueLabel?: string;
  /** Eksen ve ipucu biçimi — bkz. `RankBars.format`. */
  format?: (v: number) => string;
  className?: string;
}) {
  const [hiddenKeys, setHiddenKeys] = useState<ReadonlySet<string>>(new Set());
  const visible = series.filter((s) => !hiddenKeys.has(s.key));

  const totals = columns.map((c) =>
    visible.reduce((sum, s) => sum + (c.parts[s.key] ?? 0), 0)
  );
  const peak = Math.max(0, ...totals);
  // Üst sınır "güzel" bir tikte biter — 18.162 için 20.000, 37 için 40.
  const ticks = niceTicks(0, peak || 1, 4);
  const top = Math.max(peak, ticks[ticks.length - 1] ?? peak) || 1;

  function toggle(key: string) {
    setHiddenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      // Son görünen seriyi de kapatmak grafiği boşaltırdı; izin verilmez.
      return next.size >= series.length ? prev : next;
    });
  }

  // Sütun sayısı arttıkça etiketleri seyrelt: 30 sütunda hepsini basmak
  // okunmaz bir şerit üretir.
  const labelStep = columns.length > 26 ? Math.ceil(columns.length / 13) : 1;

  /**
   * ÇİZİM ALANI KENDİ İÇİNDE KAYAR ve sütuna taban genişlik verilir.
   *
   * Eskiden bütün sütunlar kabın genişliğine sıkışıyordu: 360px'lik ekranda
   * aylık kırılımın 20 sütunu sütun başına 12px'e iniyor, "Oca 25" etiketi
   * (~34px) okunmaz oluyordu. Artık sütun en az 40px'tir; kap dar olduğunda
   * grafik yatay kayar. Üst sınır seyreltilmiş etiketle birlikte çok uzun
   * dönemlerde (günlük kova) tuvalin şişmesini engeller.
   *
   * Y ekseni kaydırma kabının DIŞINDADIR: kayarken tik değerleri yerinde kalır.
   */
  const plotMinWidth = Math.min(columns.length * 40, 1600);

  return (
    <div className={cn("grid gap-2", className)}>
      <div className="flex gap-2">
        {/* Y ekseni — tik etiketleri mono ve tabular, ızgarayla aynı hizada */}
        <div
          className="relative w-12 shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground"
          style={{ height }}
          aria-hidden
        >
          {ticks.map((t) => (
            <span
              key={t}
              className="absolute right-0 -translate-y-1/2"
              style={{ bottom: `${(t / top) * 100}%` }}
            >
              {format(t)}
            </span>
          ))}
        </div>

        <div className="oc-scrollx min-w-0 flex-1 overflow-x-auto overscroll-x-contain">
          <div style={{ minWidth: plotMinWidth }}>
            <div className="relative" style={{ height }}>
              {/* Izgara — çubukların ALTINDA, saç teli kalınlığında */}
              {ticks.map((t) => (
                <div
                  key={t}
                  aria-hidden
                  className={cn(
                    "absolute inset-x-0 border-t",
                    t === 0 ? "border-border" : "border-border/50"
                  )}
                  style={{ bottom: `${(t / top) * 100}%` }}
                />
              ))}

              <div className="absolute inset-0 flex items-end gap-[2px]">
                {columns.map((col, i) => {
                  const colTotal = totals[i];
                  return (
                    <div
                      key={col.key}
                      className="group relative flex h-full min-w-0 flex-1 flex-col justify-end"
                      title={`${col.label} · ${format(colTotal)} ${valueLabel}`}
                    >
                      {/* Vurgu: sütunun tamamı hover'da hafifçe zeminlenir */}
                      <span
                        aria-hidden
                        className="pointer-events-none absolute inset-0 bg-foreground/[0.04] opacity-0 transition-opacity group-hover:opacity-100"
                      />
                      {visible.map((s) => {
                        const v = col.parts[s.key] ?? 0;
                        if (v <= 0) return null;
                        return (
                          <span
                            key={s.key}
                            className="oc-series-bg block w-full"
                            style={{ ...tagStyle(s.hue), height: `${(v / top) * 100}%` }}
                            title={`${col.label} · ${s.label} · ${format(v)} ${valueLabel}`}
                          />
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* X ekseni etiketleri — çubuklarla AYNI kaydırma kabında, yoksa
                kaydırınca etiket ile sütun birbirinden ayrılırdı. */}
            <div className="mt-2 flex gap-[2px]">
              {columns.map((col, i) => (
                <div
                  key={col.key}
                  className="min-w-0 flex-1 truncate text-center font-mono text-[11px] text-muted-foreground"
                >
                  {i % labelStep === 0 ? col.label : ""}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {series.length > 1 && (
        <ChartLegend
          series={series}
          hidden={hiddenKeys}
          onToggle={toggle}
          /* Y ekseni payı (48px + 8px) telefonda genişliğin beşte birini
             yiyordu; efsane orada kenardan başlar. */
          className="pl-0 sm:pl-14"
        />
      )}
    </div>
  );
}

// ------------------------------------------------------- zaman serisi (çizgi)

/**
 * ÇİZGİ GRAFİK — aynı veri, çubuk yerine eğri (kullanıcı kararı, 13.08.2026:
 * "tablolar bar şeklinde değil çizgi şeklinde olsun").
 *
 * NEDEN AYRI BİR BİLEŞEN: çubuk YIĞILIRdı (dilimler üst üste, toplam görünür),
 * çizgi YIĞILMAZ — her seri kendi eğrisidir ve okunan şey "hangisi hangisinin
 * üstünde"dir. İkisini tek bileşende bir bayrakla anlatmak, yığma mantığını
 * her okuyanın kafasında iki kez çözmesini gerektirirdi.
 *
 * SVG BURADA MEŞRUDUR ama yalnız EĞRİ İÇİN: `viewBox` + `preserveAspectRatio
 * ="none"` ile tuval kabına gerilir, `vectorEffect="non-scaling-stroke"` ile
 * çizgi kalınlığı gerilmeden korunur. Grafiğin İÇİNDE HİÇ YAZI YOKTUR — eksen
 * etiketleri ve tik değerleri SVG'nin dışında, düz HTML'dedir. Dosya
 * başlığındaki kural ("SVG'de yazı ölçeklenir, dar kolonda okunmaz") böylece
 * çiğnenmez; halka grafiğiyle aynı istisna.
 *
 * BOŞ KOVA ÇİZGİYİ KESMEZ, sıfıra iner: aradaki ayı atlamak iki kayıtlı ayı
 * yan yana getirir ve duraklamayı gizlerdi (`TimeBarChart` ile aynı kural).
 * Tek noktalı seri çizgi çizemez; orada yalnız işaret kalır.
 */
export function TimeLineChart({
  columns,
  series,
  referenceLines = [],
  height = 200,
  valueLabel = "adam·saat",
  format = fmtManHours,
  /**
   * NOKTA DEĞERLERİNİ EĞRİNİN ÜSTÜNE YAZ (kullanıcı kararı, 14.08.2026).
   *
   * YALNIZ TEK SERİ GÖRÜNÜRKEN çizilir: iki eğrinin değerleri üst üste
   * bindiğinde okunmaz bir yığın olur ve grafiğin kendisi zaten "hangisi
   * hangisinin üstünde"yi gösterir. İki serili bir kartta (avans/bakiye,
   * teslim akışı) etiket, kullanıcı efsaneden birini kapatıp tek eğri
   * bıraktığında belirir — bu yüzden bayrağı bütün grafiklere geçmek güvenlidir.
   */
  valueLabels = false,
  /** Etiketin biçimi; verilmezse eksenle aynı `format` kullanılır. */
  valueFormat,
  className,
}: {
  columns: readonly ChartColumn[];
  series: readonly ChartSeries[];
  referenceLines?: readonly ChartReferenceLine[];
  height?: number;
  valueLabel?: string;
  format?: (v: number) => string;
  valueLabels?: boolean;
  valueFormat?: (v: number) => string;
  className?: string;
}) {
  const [hiddenKeys, setHiddenKeys] = useState<ReadonlySet<string>>(new Set());
  const visible = series.filter((s) => !hiddenKeys.has(s.key));
  const showValues = valueLabels && visible.length === 1;
  const fmtValue = valueFormat ?? format;

  let peak = 0;
  for (const c of columns) {
    for (const s of visible) peak = Math.max(peak, c.parts[s.key] ?? 0);
  }
  for (const line of referenceLines) {
    if (Number.isFinite(line.value)) peak = Math.max(peak, line.value);
  }
  const ticks = niceTicks(0, peak || 1, 4);
  const top = Math.max(peak, ticks[ticks.length - 1] ?? peak) || 1;

  function toggle(key: string) {
    setHiddenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      // Son görünen seriyi de kapatmak grafiği boşaltırdı; izin verilmez.
      return next.size >= series.length ? prev : next;
    });
  }

  const labelStep = columns.length > 26 ? Math.ceil(columns.length / 13) : 1;
  // Çizgi grafikte sütun genişliği çubuktakinden dardır (48 → 40 gerekmez):
  // okunan şey kutu değil eğim, ve dar aralık eğimi belirginleştirir. Yine de
  // X etiketi ("Oca 26" ≈ 34px) sığmalıdır.
  const plotMinWidth = Math.min(Math.max(columns.length, 2) * 40, 1600);

  /** Noktanın tuval koordinatı — tuval 0…100 × 0…100 birimindedir. */
  const x = (i: number) =>
    columns.length <= 1 ? 50 : (i / (columns.length - 1)) * 100;
  const y = (v: number) => 100 - (v / top) * 100;

  return (
    <div className={cn("grid gap-2", className)}>
      <div className="flex gap-2">
        {/* Y ekseni — kaydırma kabının DIŞINDA: kayarken tikler yerinde kalır */}
        <div
          className="relative w-12 shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground"
          style={{ height }}
          aria-hidden
        >
          {ticks.map((t) => (
            <span
              key={t}
              className="absolute right-0 -translate-y-1/2"
              style={{ bottom: `${(t / top) * 100}%` }}
            >
              {format(t)}
            </span>
          ))}
        </div>

        <div className="oc-scrollx min-w-0 flex-1 overflow-x-auto overscroll-x-contain">
          {/* YATAY 3px DOLGU ZORUNLUDUR ve süs değildir: ilk ve son nokta
              işareti tam kenardadır (`left: 0%` / `100%`) ve `-translate-x-1/2`
              ile yarısı kabın DIŞINA taşar. Sağdaki yarım nokta `scrollWidth`i
              3px büyütüyor, bu da `.oc-scrollx`in kenar gölgesini yakıyor ve
              "kaydırılacak içerik var" diye YALAN söylüyordu — üstelik
              `overflow-x` veren kap `overflow-y`yi de kaybettiği için
              (AGENTS MOBIL-14) tek piksellik bir taşma gerçek bir kaydırma
              çubuğu doğurabiliyor. Dolgu, noktanın yarıçapı kadardır. */}
          <div className="px-[3px]" style={{ minWidth: plotMinWidth }}>
            <div className="relative" style={{ height }}>
              {/* Izgara — eğrilerin ALTINDA, saç teli kalınlığında */}
              {ticks.map((t) => (
                <div
                  key={t}
                  aria-hidden
                  className={cn(
                    "absolute inset-x-0 border-t",
                    t === 0 ? "border-border" : "border-border/50"
                  )}
                  style={{ bottom: `${(t / top) * 100}%` }}
                />
              ))}

              {referenceLines.map((line) => {
                if (!Number.isFinite(line.value) || line.value < 0) return null;
                return (
                  <div
                    key={line.key}
                    aria-label={`${line.label}: ${format(line.value)} ${valueLabel}`}
                    className="pointer-events-none absolute inset-x-0 z-10 border-t border-dashed border-primary/70"
                    style={{ bottom: `${(line.value / top) * 100}%` }}
                  >
                    <span className="absolute right-0 -translate-y-full bg-card px-1 font-mono text-[10px] text-primary">
                      {line.label} {format(line.value)}
                    </span>
                  </div>
                );
              })}

              <svg
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                className="absolute inset-0 h-full w-full overflow-visible"
                aria-hidden
              >
                {visible.map((s) => {
                  const noktalar = columns.map((c, i) => ({
                    cx: x(i),
                    cy: y(c.parts[s.key] ?? 0),
                  }));
                  const d = noktalar
                    .map((p, i) => `${i === 0 ? "M" : "L"}${p.cx} ${p.cy}`)
                    .join(" ");
                  return (
                    <g key={s.key}>
                      {noktalar.length > 1 && (
                        <path
                          d={d}
                          fill="none"
                          className="oc-series-stroke"
                          style={tagStyle(s.hue)}
                          strokeWidth={2}
                          strokeLinejoin="round"
                          strokeLinecap="round"
                          // Tuval gerildiği için kalınlık da gerilirdi; bu
                          // özellik çizgiyi ekran pikselinde sabit tutar.
                          vectorEffect="non-scaling-stroke"
                        />
                      )}
                      {/* Nokta işaretleri: `r` de gerilirdi, o yüzden çember
                          değil kare değil — `circle` + `non-scaling-stroke`
                          yerine sabit yarıçaplı bir daire ancak `viewBox`
                          gerilmediğinde çalışır. Bunun yerine noktalar HTML
                          katmanında basılır (aşağıda). */}
                    </g>
                  );
                })}
              </svg>

              {/* NOKTALAR VE İPUÇLARI HTML'DE: SVG tuvali gerildiği için orada
                  çizilen bir daire elips olurdu. Aynı katman `title` ipucunu da
                  taşır — dokunmatikte olmasa da farede sayıyı okutan tek yer. */}
              <div className="absolute inset-0">
                {visible.map((s) =>
                  columns.map((c, i) => {
                    const v = c.parts[s.key] ?? 0;
                    return (
                      <span
                        key={`${s.key}-${c.key}`}
                        className="oc-series-bg absolute size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
                        style={{
                          ...tagStyle(s.hue),
                          left: `${x(i)}%`,
                          top: `${y(v)}%`,
                        }}
                        title={`${c.label} · ${s.label} · ${format(v)} ${valueLabel}`}
                      />
                    );
                  })
                )}
              </div>

              {/* NOKTA DEĞERLERİ — eğrinin üstünde (tepeye yakınsa altında).
                  Etiket [0, height] aralığında kalır: `overflow-x` veren
                  kaydırma kabı `overflow-y`yi de auto'ya çevirir (AGENTS MOBIL-14)
                  ve tuvalin dışına taşan bir yazı yalancı bir dikey kaydırma
                  doğururdu. Bu yüzden tepedeki nokta (~%18'in üstünde) etiketi
                  ALTINA alır; uçlardaki nokta yatayda hizalanır ki yarısı kabın
                  dışına düşmesin (X ekseni etiketiyle aynı kural). */}
              {showValues &&
                visible.map((s) =>
                  columns.map((c, i) => {
                    if (i % labelStep !== 0 && i !== columns.length - 1) return null;
                    const v = c.parts[s.key] ?? 0;
                    const yv = y(v);
                    const altta = yv < 18;
                    const tx = i === 0 ? "0" : i === columns.length - 1 ? "-100%" : "-50%";
                    const ty = altta ? "0.3rem" : "calc(-100% - 0.3rem)";
                    return (
                      <span
                        key={`v-${s.key}-${c.key}`}
                        aria-hidden
                        className="pointer-events-none absolute z-10 font-mono text-[10px] font-medium tabular-nums text-foreground"
                        style={{
                          left: `${x(i)}%`,
                          top: `${yv}%`,
                          transform: `translate(${tx}, ${ty})`,
                        }}
                      >
                        {fmtValue(v)}
                      </span>
                    );
                  })
                )}
            </div>

            {/* X ekseni etiketleri — eğriyle AYNI kaydırma kabında, yoksa
                kaydırınca etiket ile nokta birbirinden ayrılırdı. */}
            <div className="mt-2 flex">
              {columns.map((col, i) => (
                <div
                  key={col.key}
                  className={cn(
                    "min-w-0 flex-1 truncate font-mono text-[11px] text-muted-foreground",
                    // İlk ve son etiket kabın dışına taşmasın: uçlarda nokta
                    // tam kenardadır, ortalanmış etiket yarısını kaybederdi.
                    i === 0 ? "text-left" : i === columns.length - 1 ? "text-right" : "text-center"
                  )}
                >
                  {i % labelStep === 0 || i === columns.length - 1 ? col.label : ""}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {series.length > 1 && (
        <ChartLegend
          series={series}
          hidden={hiddenKeys}
          onToggle={toggle}
          className="pl-0 sm:pl-14"
        />
      )}
    </div>
  );
}

// ------------------------------------------------------------- sıralı çubuklar

export interface RankItem {
  key: string;
  label: string;
  hue: number;
  hint?: string;
  value: number;
  share: number;
  records?: number;
}

/**
 * Sıralı yatay çubuk — "en çok hangi işe/parçaya çalışıldı" sorusunun cevabı.
 *
 * Çubuk uzunluğu EN BÜYÜK KALEME göre normalize edilir (toplama değil):
 * toplama göre normalize etmek uzun kuyruklu dağılımda bütün çubukları
 * görünmez inceliğe indirirdi. Pay yüzdesi zaten ayrı sütunda yazar.
 */
export function RankBars({
  items,
  limit,
  valueLabel = "a·s",
  emptyText = "Kayıt yok",
  onSelect,
  selected,
  format = fmtManHours,
  className,
}: {
  items: readonly RankItem[];
  limit?: number;
  valueLabel?: string;
  emptyText?: string;
  onSelect?: (key: string) => void;
  selected?: string | null;
  /**
   * Değer biçimlendirici. Varsayılanı adam·saattir çünkü bileşen İş
   * Takibi için doğdu; Satın Alma aynı çubuğu AVRO ve ADET için kullanıyor
   * ve "1.250" ile "1.250 €" arasındaki fark okurun kafasında değil ekranda
   * durmalıdır. Varsayılan korunur, çağıran değiştirir.
   */
  format?: (v: number) => string;
  className?: string;
}) {
  const shown = limit ? items.slice(0, limit) : items;
  const rest = limit ? items.slice(limit) : [];
  const max = Math.max(1, ...shown.map((i) => i.value));

  if (items.length === 0) {
    return <p className={cn("py-6 text-center text-sm text-muted-foreground", className)}>{emptyText}</p>;
  }

  return (
    <div className={cn("grid gap-1", className)}>
      {shown.map((item) => {
        const active = selected === item.key;
        const Row = onSelect ? "button" : "div";
        return (
          <Row
            key={item.key}
            {...(onSelect
              ? { type: "button" as const, onClick: () => onSelect(item.key), "aria-pressed": active }
              : {})}
            className={cn(
              // MOBİLDE ETİKET ÇUBUĞUN ÜSTÜNDEDİR: üç sütunlu düzende çubuğa
              // ~74px kalıyor ve etiketler tanınmaz biçimde kırpılıyordu —
              // dokunmatikte `title` ipucu da yoktur.
              "grid grid-cols-[1fr_auto] items-center gap-x-2 gap-y-1 px-1 py-1 text-left sm:grid-cols-[minmax(6rem,11rem)_1fr_auto] sm:gap-y-0",
              // Dokunma hedefi yalnız KABA işaretçide büyür; farede satır
              // yoğunluğu bilinçli bir tercihtir (bkz. `Button` boy notu).
              onSelect && "transition-colors pointer-coarse:min-h-10 hover:bg-muted/60",
              active && "bg-muted"
            )}
            title={item.hint ? `${item.label} — ${item.hint}` : item.label}
          >
            <span className="col-span-2 flex min-w-0 items-center gap-1.5 sm:col-span-1">
              <span className="oc-tag-dot" style={tagStyle(item.hue)} aria-hidden />
              <span className="truncate text-xs font-medium">{item.label}</span>
            </span>
            <span className="h-3 min-w-0 bg-muted/70">
              <span
                className="oc-series-bg block h-full"
                style={{ ...tagStyle(item.hue), width: `${Math.max((item.value / max) * 100, 1)}%` }}
              />
            </span>
            <span className="flex shrink-0 items-baseline gap-2 font-mono text-[11px] tabular-nums">
              <span className="w-16 text-right font-medium">{format(item.value)}</span>
              <span className="w-11 text-right text-muted-foreground">
                %{fmtManHours(item.share * 100)}
              </span>
            </span>
          </Row>
        );
      })}
      {rest.length > 0 && (
        <p className="px-1 pt-1 text-[11px] text-muted-foreground">
          + {rest.length} kalem daha ·{" "}
          <span className="font-mono tabular-nums">
            {format(rest.reduce((s, i) => s + i.value, 0))} {valueLabel}
          </span>
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------- halka

/**
 * Halka grafik — payların TOPLAMI anlamlı olduğunda (imalat türü dağılımı).
 *
 * Yaylar `stroke-dasharray` ile çizilir; `path` + `A` komutu yerine bu yol
 * seçildi çünkü tek bir dilim %100'ü kapladığında yay komutu dejenere olur
 * (başlangıç ve bitiş noktası çakışır, çember hiç çizilmez).
 */
export function DonutChart({
  items,
  centerValue,
  centerLabel,
  size = 168,
  format = fmtManHours,
  className,
}: {
  items: readonly RankItem[];
  centerValue: string;
  centerLabel: string;
  size?: number;
  /** Efsanedeki değer biçimi — bkz. `RankBars.format`. */
  format?: (v: number) => string;
  className?: string;
}) {
  const titleId = useId();
  const total = items.reduce((s, i) => s + i.value, 0);
  const r = 42;
  const circumference = 2 * Math.PI * r;
  let offset = 0;

  return (
    // Halka + efsane dar kolonda YAN YANA DURAMAZ: 276px'lik bir kartta halkaya
    // 168px gidince efsaneye 58px kalıyor ama sayı sütunları `shrink-0` olduğu
    // için ~107px yer istiyor ve efsane kartın dışına taşıyordu. Dar kapta alt
    // alta dizilir; halka da kabından geniş olamaz.
    <div className={cn("flex flex-col items-center gap-4 sm:flex-row", className)}>
      <svg
        viewBox="0 0 100 100"
        style={{ width: size, maxWidth: "100%" }}
        role="img"
        aria-labelledby={titleId}
        className="h-auto shrink-0"
      >
        <title id={titleId}>{`${centerLabel}: ${centerValue}`}</title>
        <circle cx="50" cy="50" r={r} fill="none" strokeWidth="14" className="stroke-muted" />
        {total > 0 &&
          items.map((item) => {
            const len = (item.value / total) * circumference;
            const dash = `${len} ${circumference - len}`;
            const el = (
              <circle
                key={item.key}
                cx="50"
                cy="50"
                r={r}
                fill="none"
                strokeWidth="14"
                className="oc-series-stroke"
                style={{
                  ...tagStyle(item.hue),
                  strokeDasharray: dash,
                  strokeDashoffset: -offset,
                }}
                // Yay saat 12'den başlasın: çember varsayılan olarak saat 3'ten
                // başlar ve okuyucu payı yanlış yerden aramaya başlardı.
                transform="rotate(-90 50 50)"
              >
                <title>{`${item.label} · ${format(item.value)} · %${fmtManHours(
                  item.share * 100
                )}`}</title>
              </circle>
            );
            offset += len;
            return el;
          })}
        <text
          x="50"
          y="47"
          textAnchor="middle"
          className="fill-foreground font-mono text-[13px] font-semibold"
        >
          {centerValue}
        </text>
        <text
          x="50"
          y="59"
          textAnchor="middle"
          className="fill-muted-foreground font-mono text-[6.5px] tracking-[0.14em] uppercase"
        >
          {centerLabel}
        </text>
      </svg>

      <div className="grid w-full min-w-0 flex-1 gap-1">
        {items.map((item) => (
          <div key={item.key} className="flex items-center gap-2 text-xs">
            <span className="oc-tag-dot" style={tagStyle(item.hue)} aria-hidden />
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
            <span className="shrink-0 font-mono text-[11px] tabular-nums">
              {format(item.value)}
            </span>
            <span className="w-10 shrink-0 text-right font-mono text-[11px] tabular-nums text-muted-foreground">
              %{fmtManHours(item.share * 100)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ------------------------------------------------------------- oranlı şerit

/**
 * ORANLI ŞERİT — bir bütünün parçaları, HALKA YERİNE.
 *
 * Kullanıcı bildirimi (13.08.2026): *"Sipariş sayfasında durum kırılımında
 * yuvarlak pasta şeklinde olan grafik yapısı mantıklı değil değiştirelim"* ve
 * aynısı Ödeme Takvimi'nin avans/bakiye kırılımı için. Haklı ve gerekçesi
 * ölçülebilir:
 *
 *  · Halka AÇI okutur, insan gözü açıyı UZUNLUKTAN çok daha kötü karşılaştırır.
 *    İki dilim yakın olduğunda hangisinin büyük olduğu ancak yandaki sayıdan
 *    anlaşılıyordu — yani grafiğin kendisi bir şey söylemiyordu.
 *  · Sipariş durumları bir AŞAMA SIRASIDIR (bekliyor → teslim → ödendi):
 *    çemberde başı ve sonu yoktur, şeritte soldan sağa akar.
 *  · Halka 168px'lik bir kare yer kaplıyordu; şerit kartın tam genişliğini
 *    kullanır ve dar ekranda da okunur kalır.
 *
 * DİLİM SIRASI ÇAĞIRANIN VERDİĞİ SIRADIR, büyüklüğe göre değil: aşama sırasını
 * yeniden dizmek okuyucunun kafasındaki akışı bozardı.
 */
export function SplitBar({
  items,
  format = fmtManHours,
  valueLabel = "",
  emptyText = "Kayıt yok",
  toplamEtiketi = "Toplam",
  className,
}: {
  items: readonly RankItem[];
  format?: (v: number) => string;
  valueLabel?: string;
  emptyText?: string;
  toplamEtiketi?: string;
  className?: string;
}) {
  const total = items.reduce((s, i) => s + i.value, 0);

  if (items.length === 0 || total <= 0) {
    return <p className={cn("py-6 text-center text-sm text-muted-foreground", className)}>{emptyText}</p>;
  }

  return (
    <div className={cn("grid gap-3", className)}>
      {/* ŞERİT: dilim genişliği PAYIN KENDİSİDİR. En küçük dilim bile görünür
          kalsın diye 2px taban verilir — yoksa %0,3'lük bir kalem şeritten
          düşer ve efsanedeki satırın karşılığı ekranda hiç bulunmazdı. */}
      <div className="flex h-4 w-full overflow-hidden bg-muted/70" role="presentation">
        {items.map((item) => (
          <span
            key={item.key}
            className="oc-series-bg block h-full"
            style={{
              ...tagStyle(item.hue),
              width: `${Math.max((item.value / total) * 100, 0.5)}%`,
              minWidth: 2,
            }}
            title={`${item.label} · ${format(item.value)} ${valueLabel} · %${fmtManHours(
              item.share * 100
            )}`}
          />
        ))}
      </div>

      {/* EFSANE BİR TABLODUR: sayılar sütun sütun hizalanır, yoksa üç haneli
          bir tutarla altı haneli bir tutar yan yana okunmaz. */}
      <div className="grid gap-1">
        {items.map((item) => (
          <div key={item.key} className="flex items-center gap-2 text-xs">
            <span className="oc-tag-dot" style={tagStyle(item.hue)} aria-hidden />
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
            {item.records != null && (
              <span className="w-16 shrink-0 text-right font-mono text-[11px] tabular-nums text-muted-foreground">
                {fmtManHours(item.records)} kayıt
              </span>
            )}
            <span className="w-20 shrink-0 text-right font-mono text-[11px] tabular-nums">
              {format(item.value)}
            </span>
            <span className="w-10 shrink-0 text-right font-mono text-[11px] tabular-nums text-muted-foreground">
              %{fmtManHours(item.share * 100)}
            </span>
          </div>
        ))}
        <div className="flex items-center gap-2 border-t pt-1 text-xs">
          <span className="min-w-0 flex-1 truncate font-medium">{toplamEtiketi}</span>
          <span className="w-20 shrink-0 text-right font-mono text-[11px] font-medium tabular-nums">
            {format(total)}
          </span>
          <span className="w-10 shrink-0" />
        </div>
      </div>
    </div>
  );
}

// --------------------------------------------------------------- ısı haritası

export interface HeatRow {
  key: string;
  label: string;
  hue: number;
  total: number;
}

/**
 * Isı haritası — satır (iş/parça) × sütun (ay/hafta) yoğunluğu.
 *
 * "Hangi iş ne zaman atölyeyi doldurdu" sorusunun cevabı bir toplamda değil
 * bu ızgarada durur: aynı toplam, üç aya yayılmış da olabilir tek haftaya
 * sıkışmış da. Yoğunluk SATIR İÇİNDE değil TABLO GENELİNDE normalize edilir;
 * satır içi normalizasyon küçük bir işi büyük bir işle aynı koyulukta
 * gösterip karşılaştırmayı bozardı.
 */
export function Heatmap({
  rows,
  columns,
  cell,
  valueLabel = "a·s",
  className,
}: {
  rows: readonly HeatRow[];
  columns: readonly { key: string; label: string }[];
  cell: (rowKey: string, colKey: string) => number;
  valueLabel?: string;
  className?: string;
}) {
  let max = 0;
  for (const r of rows) for (const c of columns) max = Math.max(max, cell(r.key, c.key));
  if (max <= 0) max = 1;

  return (
    // Satır etiketi sütunu SOLA YAPIŞIR: yatay kaydırınca hangi satıra
    // bakıldığı kayboluyordu. Ay başlığındaki `whitespace-nowrap` da kaldırıldı
    // — 24px'lik hücrelerin yanında ~38px'lik başlık sütunu gereksiz geriyordu,
    // "Oca 25" dar kapta iki satıra iner.
    <div className={cn("oc-scrollx overflow-x-auto overscroll-x-contain", className)}>
      <table className="w-full border-separate border-spacing-[2px] text-xs">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 w-24 bg-card text-left font-normal sm:w-40" />
            {columns.map((c) => (
              <th
                key={c.key}
                className="px-0.5 pb-1 text-center font-mono text-[11px] font-normal text-muted-foreground"
              >
                {c.label}
              </th>
            ))}
            <th className="pb-1 pl-2 text-right font-mono text-[11px] font-normal text-muted-foreground">
              Toplam
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <td
                className="sticky left-0 z-10 max-w-24 truncate bg-card pr-2 text-xs sm:max-w-40"
                title={r.label}
              >
                <span className="flex items-center gap-1.5">
                  <span className="oc-tag-dot" style={tagStyle(r.hue)} aria-hidden />
                  <span className="truncate">{r.label}</span>
                </span>
              </td>
              {columns.map((c) => {
                const v = cell(r.key, c.key);
                return (
                  <td key={c.key} className="p-0">
                    <div
                      className="oc-heat h-6 min-w-6 border border-border/40"
                      style={
                        {
                          ...tagStyle(r.hue),
                          "--oc-level": v > 0 ? Math.max(v / max, 0.12) : 0,
                        } as React.CSSProperties
                      }
                      title={
                        v > 0
                          ? `${r.label} · ${c.label} · ${fmtManHours(v)} ${valueLabel}`
                          : `${r.label} · ${c.label} · kayıt yok`
                      }
                    />
                  </td>
                );
              })}
              <td className="pl-2 text-right font-mono text-[11px] tabular-nums whitespace-nowrap">
                {fmtManHours(r.total)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// -------------------------------------------------------------------- kartlar

/**
 * Özet kartı — liste ekranlarındaki desenin İş Takibi karşılığı.
 * `delta` verildiğinde önceki dönemle farkı da gösterir.
 */
export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone,
  delta,
  className,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "warn";
  /** Önceki döneme göre oransal değişim (0,12 = %12 artış) */
  delta?: number | null;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start gap-2.5 rounded-lg border bg-card p-3", className)}>
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-md",
          tone === "warn" ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"
        )}
      >
        <Icon className="size-4" />
      </span>
      {/* `min-w-0` TEK BAŞINA YETMEZ: alttaki satır `flex` ve içindeki iki
          `span` de büzülemiyordu (metin `min-content`ten dar olamaz). Dört
          kartın iki sütuna indiği 375px'lik ekranda uzun bir tutar + değişim
          rozeti ("721.417,78 ₺" + "▼ %4,7") kartı ~9px taşırıyor ve o taşma
          BÜTÜN SAYFAYI yatay kaydırıyordu (Finans özet kartlarında ölçüldü,
          12.08.2026). `flex-wrap` rozeti gerektiğinde alt satıra indirir;
          geniş ekranda görünüm birebir aynı kalır. */}
      <div className="min-w-0 flex-1 leading-tight">
        <div className="oc-kicker text-muted-foreground">{label}</div>
        <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2">
          <span className="font-mono text-lg font-semibold tracking-tight tabular-nums">{value}</span>
          {delta !== null && delta !== undefined && Number.isFinite(delta) && (
            <span
              className={cn(
                "font-mono text-[11px] tabular-nums",
                delta > 0 ? "text-success" : delta < 0 ? "text-destructive" : "text-muted-foreground"
              )}
              title="Önceki eşit uzunluktaki döneme göre"
            >
              {delta > 0 ? "▲" : delta < 0 ? "▼" : "="} %{fmtManHours(Math.abs(delta) * 100)}
            </span>
          )}
        </div>
        {hint && <div className="mt-0.5 truncate text-[11px] text-foreground/70">{hint}</div>}
      </div>
    </div>
  );
}
