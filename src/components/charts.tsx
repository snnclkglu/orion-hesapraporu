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
              "flex items-center gap-1.5 text-[11px] transition-colors",
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
  className,
}: {
  columns: readonly ChartColumn[];
  series: readonly ChartSeries[];
  height?: number;
  valueLabel?: string;
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

  return (
    <div className={cn("grid gap-2", className)}>
      <div className="flex gap-2">
        {/* Y ekseni — tik etiketleri mono ve tabular, ızgarayla aynı hizada */}
        <div
          className="relative w-12 shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground"
          style={{ height }}
          aria-hidden
        >
          {ticks.map((t) => (
            <span
              key={t}
              className="absolute right-0 -translate-y-1/2"
              style={{ bottom: `${(t / top) * 100}%` }}
            >
              {fmtManHours(t)}
            </span>
          ))}
        </div>

        <div className="relative min-w-0 flex-1" style={{ height }}>
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
                  title={`${col.label} · ${fmtManHours(colTotal)} ${valueLabel}`}
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
                        title={`${col.label} · ${s.label} · ${fmtManHours(v)} ${valueLabel}`}
                      />
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* X ekseni etiketleri — Y ekseni payıyla aynı hizada */}
      <div className="flex gap-2">
        <div className="w-12 shrink-0" aria-hidden />
        <div className="flex min-w-0 flex-1 gap-[2px]">
          {columns.map((col, i) => (
            <div
              key={col.key}
              className="min-w-0 flex-1 truncate text-center font-mono text-[10px] text-muted-foreground"
            >
              {i % labelStep === 0 ? col.label : ""}
            </div>
          ))}
        </div>
      </div>

      {series.length > 1 && (
        <ChartLegend series={series} hidden={hiddenKeys} onToggle={toggle} className="pl-14" />
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
  className,
}: {
  items: readonly RankItem[];
  limit?: number;
  valueLabel?: string;
  emptyText?: string;
  onSelect?: (key: string) => void;
  selected?: string | null;
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
              "grid grid-cols-[minmax(6rem,11rem)_1fr_auto] items-center gap-2 px-1 py-1 text-left",
              onSelect && "transition-colors hover:bg-muted/60",
              active && "bg-muted"
            )}
            title={item.hint ? `${item.label} — ${item.hint}` : item.label}
          >
            <span className="flex min-w-0 items-center gap-1.5">
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
              <span className="w-16 text-right font-medium">{fmtManHours(item.value)}</span>
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
            {fmtManHours(rest.reduce((s, i) => s + i.value, 0))} {valueLabel}
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
  className,
}: {
  items: readonly RankItem[];
  centerValue: string;
  centerLabel: string;
  size?: number;
  className?: string;
}) {
  const titleId = useId();
  const total = items.reduce((s, i) => s + i.value, 0);
  const r = 42;
  const circumference = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className={cn("flex items-center gap-4", className)}>
      <svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        role="img"
        aria-labelledby={titleId}
        className="shrink-0"
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
                <title>{`${item.label} · ${fmtManHours(item.value)} a·s · %${fmtManHours(
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

      <div className="grid min-w-0 flex-1 gap-1">
        {items.map((item) => (
          <div key={item.key} className="flex items-center gap-2 text-xs">
            <span className="oc-tag-dot" style={tagStyle(item.hue)} aria-hidden />
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
            <span className="shrink-0 font-mono text-[11px] tabular-nums">
              {fmtManHours(item.value)}
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
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full border-separate border-spacing-[2px] text-xs">
        <thead>
          <tr>
            <th className="w-40 text-left font-normal" />
            {columns.map((c) => (
              <th
                key={c.key}
                className="px-0.5 pb-1 text-center font-mono text-[10px] font-normal whitespace-nowrap text-muted-foreground"
              >
                {c.label}
              </th>
            ))}
            <th className="pb-1 pl-2 text-right font-mono text-[10px] font-normal text-muted-foreground">
              Toplam
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <td className="max-w-40 truncate pr-2 text-xs" title={r.label}>
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
    <div className={cn("flex items-start gap-3 rounded-lg border bg-card p-4", className)}>
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-md",
          tone === "warn" ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"
        )}
      >
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 leading-tight">
        <div className="oc-kicker text-muted-foreground">{label}</div>
        <div className="mt-0.5 flex items-baseline gap-2">
          <span className="font-mono text-xl font-semibold tracking-tight tabular-nums">{value}</span>
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
