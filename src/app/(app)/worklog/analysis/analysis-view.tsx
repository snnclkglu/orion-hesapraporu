"use client";

// Analiz panosu.
//
// SORU SIRASI ekranın sırasını belirler:
//   1. "Ne kadar emek harcandı, artıyor mu azalıyor mu?"  → özet kartları
//   2. "Zaman içinde nasıl dağıldı?"                       → zaman serisi
//   3. "En çok neye gitti?"                                → kırılım + halka
//   4. "Hangi iş ne zaman atölyeyi doldurdu?"              → ısı haritası
//   5. "İki büyüklüğü kesiştirirsem ne görürüm?"           → çapraz tablo
//   6. "Geçen döneme göre ne değişti?"                     → karşılaştırma
//
// Her blok aynı süzgeçten geçen satırlar üzerinde çalışır; tek bir seçim
// (ör. bir müşteri) bütün sayfayı o kesite indirger.

import { useMemo, useState } from "react";
import {
  ArrowLeftRight,
  CalendarRange,
  CircleAlert,
  Clock,
  Download,
  Grid3x3,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DonutChart, Heatmap, RankBars, StatCard, TimeBarChart } from "@/components/charts";
import { tagStyle } from "@/lib/tags";
import {
  bucketKey,
  bucketLabel,
  breakdown,
  cellKey,
  dimensionValue,
  fmtCompactHours,
  fmtDate,
  fmtManHours,
  pivot,
  previousPeriod,
  summarize,
  timeSeries,
  TIME_BUCKETS,
  TIME_BUCKET_LABELS,
  WORK_DIMENSION_LABELS,
  WORK_DIMENSIONS,
  type TimeBucket,
  type WorkDimension,
  type WorkLogRow,
} from "@/lib/work-log";
import { cn } from "@/lib/utils";
import { FilterBar, useFilterOptions } from "../filter-bar";
import {
  ALL,
  EMPTY_FILTERS,
  filtersToQuery,
  matchesFilters,
  periodOf,
  type WorkFilters,
} from "../filters";

/** Bölüm başlığı — kicker + kırmızı cetvel (marka grafik dili). */
function SectionHead({
  title,
  hint,
  icon: Icon,
  action,
}: {
  title: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/40 px-4 py-2.5">
      <div className="flex min-w-0 items-center gap-2">
        <Icon className="size-4 shrink-0 text-primary" />
        <span className="oc-kicker text-foreground/80">{title}</span>
        {hint && <span className="truncate text-[11px] text-muted-foreground">· {hint}</span>}
      </div>
      {action}
    </div>
  );
}

export function AnalysisView({
  rows,
  bounds,
}: {
  rows: WorkLogRow[];
  bounds: { first: string; last: string } | null;
}) {
  const [filters, setFilters] = useState<WorkFilters>({ ...EMPTY_FILTERS });
  const [bucket, setBucket] = useState<TimeBucket>("month");
  const [seriesDim, setSeriesDim] = useState<WorkDimension>("category");
  const [rankDim, setRankDim] = useState<WorkDimension>("item");
  const [heatDim, setHeatDim] = useState<WorkDimension>("item");
  const [pivotRow, setPivotRow] = useState<WorkDimension>("part");
  const [pivotCol, setPivotCol] = useState<WorkDimension>("category");

  const options = useFilterOptions(rows);
  const filtered = useMemo(() => rows.filter((r) => matchesFilters(r, filters)), [rows, filters]);

  const summary = useMemo(() => summarize(filtered), [filtered]);

  /**
   * Karşılaştırma dönemi: aynı uzunlukta, hemen ÖNCEKİ aralık. Tarih süzgeci
   * yoksa karşılaştırma da yoktur — "tüm zamanların öncesi" diye bir şey yok.
   */
  const previous = useMemo(() => {
    const prev = previousPeriod(periodOf(filters));
    if (!prev) return null;
    const prevRows = rows.filter((r) => matchesFilters(r, { ...filters, from: prev.from, to: prev.to }));
    return { period: prev, rows: prevRows, summary: summarize(prevRows) };
  }, [rows, filters]);

  const delta =
    previous && previous.summary.manHours > 0
      ? summary.manHours / previous.summary.manHours - 1
      : null;

  const seriesBuckets = useMemo(() => breakdown(filtered, seriesDim), [filtered, seriesDim]);
  // Yığılmış grafikte on beşten fazla dilim okunmaz; kalanı tek bir "Diğer"
  // dilimine toplamak yerine grafikten çıkarmak yanıltıcı olurdu — bu yüzden
  // seri listesi kırpılır ve kırpıldığı YAZILIR.
  const seriesShown = seriesBuckets.slice(0, 12);
  const series = seriesShown.map((b) => ({ key: b.key, label: b.label, hue: b.hue }));
  const columns = useMemo(
    () => timeSeries(filtered, bucket, seriesDim),
    [filtered, bucket, seriesDim]
  );

  const rankItems = useMemo(
    () =>
      breakdown(filtered, rankDim).map((b) => ({
        key: b.key,
        label: b.label,
        hue: b.hue,
        hint: b.hint,
        value: b.manHours,
        share: b.share,
        records: b.records,
      })),
    [filtered, rankDim]
  );

  const categoryItems = useMemo(
    () =>
      breakdown(filtered, "category").map((b) => ({
        key: b.key,
        label: b.label,
        hue: b.hue,
        value: b.manHours,
        share: b.share,
      })),
    [filtered]
  );

  // Isı haritası: satır = seçilen eksenin en büyük 12 kalemi, sütun = ay.
  const heat = useMemo(() => {
    const rowsB = breakdown(filtered, heatDim).slice(0, 12);
    const colKeys = new Map<string, string>();
    const cells = new Map<string, number>();
    for (const r of filtered) {
      const k = bucketKey(r.date, "month");
      colKeys.set(k, bucketLabel(k, "month"));
      const rk = dimensionValue(r, heatDim).key;
      const ck = cellKey(rk, k);
      cells.set(ck, (cells.get(ck) ?? 0) + r.manHours);
    }
    return {
      rows: rowsB.map((b) => ({ key: b.key, label: b.label, hue: b.hue, total: b.manHours })),
      columns: [...colKeys.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([key, label]) => ({ key, label })),
      cells,
    };
  }, [filtered, heatDim]);

  const cross = useMemo(() => pivot(filtered, pivotRow, pivotCol), [filtered, pivotRow, pivotCol]);
  const crossRows = cross.rows.slice(0, 25);
  const crossCols = cross.cols.slice(0, 12);
  const crossMax = useMemo(() => {
    let m = 0;
    for (const r of crossRows)
      for (const c of crossCols) m = Math.max(m, cross.cells.get(cellKey(r.key, c.key)) ?? 0);
    return m || 1;
  }, [cross, crossRows, crossCols]);

  // Karşılaştırma tablosu: seçilen eksende dönem × önceki dönem.
  const comparison = useMemo(() => {
    if (!previous) return null;
    const cur = new Map(breakdown(filtered, rankDim).map((b) => [b.key, b]));
    const prev = new Map(breakdown(previous.rows, rankDim).map((b) => [b.key, b]));
    const keys = new Set([...cur.keys(), ...prev.keys()]);
    return [...keys]
      .map((k) => {
        const c = cur.get(k);
        const p = prev.get(k);
        const now = c?.manHours ?? 0;
        const before = p?.manHours ?? 0;
        return {
          key: k,
          label: c?.label ?? p?.label ?? k,
          hue: c?.hue ?? p?.hue ?? 0,
          now,
          before,
          diff: now - before,
          ratio: before > 0 ? now / before - 1 : null,
        };
      })
      .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
      .slice(0, 15);
  }, [filtered, previous, rankDim]);

  const exportHref = `/worklog/export?${filtersToQuery(filters)}`;

  return (
    <div className="grid gap-4">
      <FilterBar
        filters={filters}
        onChange={setFilters}
        options={options}
        shown={filtered.length}
        total={rows.length}
        extra={
          <Button asChild variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
            <a href={exportHref}>
              <Download className="size-3.5" /> Excel indir
            </a>
          </Button>
        }
      />

      {/* 1 — Özet */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Toplam Adam·Saat"
          value={fmtCompactHours(summary.manHours)}
          hint={
            previous
              ? `önceki dönem ${fmtCompactHours(previous.summary.manHours)}`
              : `${summary.records} kayıt`
          }
          icon={Clock}
          delta={delta}
        />
        <StatCard
          label="Çalışılan Gün"
          value={String(summary.days)}
          hint={
            bounds
              ? `${fmtDate(filters.from || bounds.first)} – ${fmtDate(filters.to || bounds.last)}`
              : undefined
          }
          icon={CalendarRange}
        />
        <StatCard
          label="Günlük Ortalama"
          value={fmtManHours(summary.dailyAverage)}
          hint={
            summary.peakDate
              ? `en yoğun ${fmtDate(summary.peakDate)} · ${fmtManHours(summary.peakManHours)}`
              : undefined
          }
          icon={TrendingUp}
        />
        <StatCard
          label="Eşleşmemiş Kayıt"
          value={String(summary.unmatched)}
          hint={
            summary.unmatched > 0
              ? "kalem numarası sistemde yok — Kayıtlar'dan bağlayın"
              : "tüm kayıtlar bir işe bağlı"
          }
          icon={CircleAlert}
          tone={summary.unmatched > 0 ? "warn" : undefined}
        />
      </div>

      {/* 2 — Zaman serisi */}
      <div className="rounded-lg border bg-card">
        <SectionHead
          title="Zaman İçinde Dağılım"
          hint={`${columns.length} ${bucket === "month" ? "ay" : bucket === "week" ? "hafta" : "gün"}`}
          icon={TrendingUp}
          action={
            <div className="flex items-center gap-2">
              <Select value={seriesDim} onValueChange={(v) => setSeriesDim(v as WorkDimension)}>
                <SelectTrigger size="sm" className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WORK_DIMENSIONS.map((d) => (
                    <SelectItem key={d} value={d}>
                      {WORK_DIMENSION_LABELS[d]} kırılımı
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex">
                {TIME_BUCKETS.map((b) => (
                  <Button
                    key={b}
                    type="button"
                    variant={bucket === b ? "secondary" : "ghost"}
                    size="sm"
                    className="h-8 rounded-none px-2.5 text-xs first:border-l last:border-r border-y"
                    onClick={() => setBucket(b)}
                    aria-pressed={bucket === b}
                  >
                    {TIME_BUCKET_LABELS[b]}
                  </Button>
                ))}
              </div>
            </div>
          }
        />
        <div className="px-4 py-4">
          {columns.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Süzgeçlere uyan kayıt yok.
            </p>
          ) : (
            <>
              <TimeBarChart columns={columns} series={series} height={220} />
              {seriesBuckets.length > seriesShown.length && (
                <p className="mt-2 pl-14 text-[11px] text-muted-foreground">
                  Grafikte en büyük {seriesShown.length} {WORK_DIMENSION_LABELS[seriesDim]}{" "}
                  gösteriliyor; kalan {seriesBuckets.length - seriesShown.length} kalem çubuklara
                  girmiyor. Tamamı aşağıdaki kırılımda listelenir.
                </p>
              )}
            </>
          )}
        </div>
      </div>

      {/* 3 — Kırılım + halka */}
      <div className="grid gap-4 lg:grid-cols-[1.55fr_1fr]">
        <div className="rounded-lg border bg-card">
          <SectionHead
            title="Kırılım"
            hint={`${rankItems.length} kalem · toplam ${fmtManHours(summary.manHours)} adam·saat`}
            icon={Grid3x3}
            action={
              <Select value={rankDim} onValueChange={(v) => setRankDim(v as WorkDimension)}>
                <SelectTrigger size="sm" className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WORK_DIMENSIONS.map((d) => (
                    <SelectItem key={d} value={d}>
                      {WORK_DIMENSION_LABELS[d]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            }
          />
          <div className="px-3 py-3">
            <RankBars
              items={rankItems}
              limit={14}
              selected={
                rankDim === "customer" && filters.customer !== ALL ? filters.customer : null
              }
              onSelect={(key) => {
                // Kırılımdan süzgece: tıklanan kalem üst süzgeci ayarlar,
                // böylece bütün sayfa o kesite iner.
                if (rankDim === "customer") setFilters({ ...filters, customer: key });
                else if (rankDim === "item") setFilters({ ...filters, item: key });
                else if (rankDim === "job") setFilters({ ...filters, job: key });
                else if (rankDim === "part") {
                  const b = rankItems.find((i) => i.key === key);
                  if (b) setFilters({ ...filters, part: b.label });
                } else if (rankDim === "category") {
                  const b = rankItems.find((i) => i.key === key);
                  if (b) setFilters({ ...filters, category: b.label });
                }
              }}
              emptyText="Süzgeçlere uyan kayıt yok."
            />
          </div>
        </div>

        <div className="rounded-lg border bg-card">
          <SectionHead title="İmalat Türü Payları" icon={Clock} />
          <div className="px-4 py-4">
            <DonutChart
              items={categoryItems}
              centerValue={fmtCompactHours(summary.manHours)}
              centerLabel="adam·saat"
            />
          </div>
        </div>
      </div>

      {/* 4 — Isı haritası */}
      <div className="rounded-lg border bg-card">
        <SectionHead
          title="Aylık Yoğunluk"
          hint="koyu hücre = o ay o kaleme daha çok emek gitti"
          icon={CalendarRange}
          action={
            <Select value={heatDim} onValueChange={(v) => setHeatDim(v as WorkDimension)}>
              <SelectTrigger size="sm" className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WORK_DIMENSIONS.map((d) => (
                  <SelectItem key={d} value={d}>
                    {WORK_DIMENSION_LABELS[d]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          }
        />
        <div className="px-4 py-4">
          {heat.rows.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Gösterilecek kayıt yok.</p>
          ) : (
            <Heatmap
              rows={heat.rows}
              columns={heat.columns}
              cell={(r, c) => heat.cells.get(cellKey(r, c)) ?? 0}
            />
          )}
        </div>
      </div>

      {/* 5 — Çapraz tablo */}
      <div className="rounded-lg border bg-card">
        <SectionHead
          title="Çapraz Tablo"
          hint={`${WORK_DIMENSION_LABELS[pivotRow]} × ${WORK_DIMENSION_LABELS[pivotCol]}`}
          icon={Grid3x3}
          action={
            <div className="flex items-center gap-2">
              <Select value={pivotRow} onValueChange={(v) => setPivotRow(v as WorkDimension)}>
                <SelectTrigger size="sm" className="w-[135px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WORK_DIMENSIONS.map((d) => (
                    <SelectItem key={d} value={d}>
                      Satır: {WORK_DIMENSION_LABELS[d]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                title="Satır ve sütunu değiştir"
                aria-label="Satır ve sütunu değiştir"
                onClick={() => {
                  setPivotRow(pivotCol);
                  setPivotCol(pivotRow);
                }}
              >
                <ArrowLeftRight className="size-3.5" />
              </Button>
              <Select value={pivotCol} onValueChange={(v) => setPivotCol(v as WorkDimension)}>
                <SelectTrigger size="sm" className="w-[135px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WORK_DIMENSIONS.map((d) => (
                    <SelectItem key={d} value={d}>
                      Sütun: {WORK_DIMENSION_LABELS[d]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          }
        />
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="min-w-[11rem]">{WORK_DIMENSION_LABELS[pivotRow]}</TableHead>
                {crossCols.map((c) => (
                  <TableHead key={c.key} className="text-right">
                    <span className="flex items-center justify-end gap-1.5">
                      <span className="oc-tag-dot" style={tagStyle(c.hue)} aria-hidden />
                      <span className="truncate">{c.label}</span>
                    </span>
                  </TableHead>
                ))}
                <TableHead className="text-right font-semibold">Toplam</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {crossRows.map((r) => (
                <TableRow key={r.key} className="hover:bg-transparent">
                  <TableCell className="max-w-[16rem] truncate" title={r.hint || r.label}>
                    <span className="flex items-center gap-1.5">
                      <span className="oc-tag-dot" style={tagStyle(r.hue)} aria-hidden />
                      <span className="truncate font-medium">{r.label}</span>
                    </span>
                  </TableCell>
                  {crossCols.map((c) => {
                    const v = cross.cells.get(cellKey(r.key, c.key)) ?? 0;
                    return (
                      <TableCell key={c.key} className="p-0 text-right">
                        <div
                          className={cn("oc-heat px-2 py-2 font-mono text-xs tabular-nums")}
                          style={
                            {
                              ...tagStyle(c.hue),
                              "--oc-level": v > 0 ? Math.max(v / crossMax, 0.1) : 0,
                            } as React.CSSProperties
                          }
                        >
                          {v > 0 ? fmtManHours(v) : <span className="text-muted-foreground">—</span>}
                        </div>
                      </TableCell>
                    );
                  })}
                  <TableCell className="text-right font-mono text-xs font-semibold tabular-nums">
                    {fmtManHours(r.manHours)}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="border-t-2 bg-muted/40 hover:bg-muted/40">
                <TableCell className="font-semibold">Toplam</TableCell>
                {crossCols.map((c) => (
                  <TableCell
                    key={c.key}
                    className="text-right font-mono text-xs font-semibold tabular-nums"
                  >
                    {fmtManHours(c.manHours)}
                  </TableCell>
                ))}
                <TableCell className="text-right font-mono text-xs font-semibold tabular-nums">
                  {fmtManHours(cross.total)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
        {(cross.rows.length > crossRows.length || cross.cols.length > crossCols.length) && (
          <p className="px-4 py-2 text-[11px] text-muted-foreground">
            Tabloda en büyük {crossRows.length} satır ve {crossCols.length} sütun gösteriliyor
            {cross.rows.length > crossRows.length && ` (${cross.rows.length - crossRows.length} satır`}
            {cross.cols.length > crossCols.length &&
              `${cross.rows.length > crossRows.length ? ", " : " ("}${
                cross.cols.length - crossCols.length
              } sütun`}
            {(cross.rows.length > crossRows.length || cross.cols.length > crossCols.length) &&
              " dışarıda)"}
            . Tamamı Excel çıktısındadır.
          </p>
        )}
      </div>

      {/* 6 — Dönem karşılaştırması */}
      <div className="rounded-lg border bg-card">
        <SectionHead
          title="Dönem Karşılaştırması"
          hint={
            previous
              ? `${fmtDate(filters.from)} – ${fmtDate(filters.to)} ↔ ${fmtDate(
                  previous.period.from
                )} – ${fmtDate(previous.period.to)}`
              : "bir tarih aralığı seçin"
          }
          icon={ArrowLeftRight}
        />
        {!previous || !comparison ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            Karşılaştırma bir tarih aralığı ister: üstteki dönem süzgecinden &ldquo;Bu ay&rdquo;,
            &ldquo;Son 3 ay&rdquo; gibi bir aralık seçin. Sistem aynı uzunluktaki bir önceki
            dönemi kendiliğinden alır.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead>{WORK_DIMENSION_LABELS[rankDim]}</TableHead>
                <TableHead className="w-[9rem] text-right">Bu dönem</TableHead>
                <TableHead className="w-[9rem] text-right">Önceki dönem</TableHead>
                <TableHead className="w-[8rem] text-right">Fark</TableHead>
                <TableHead className="w-[7rem] text-right">Değişim</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {comparison.map((c) => (
                <TableRow key={c.key} className="hover:bg-transparent">
                  <TableCell>
                    <span className="flex items-center gap-1.5">
                      <span className="oc-tag-dot" style={tagStyle(c.hue)} aria-hidden />
                      <span className="truncate font-medium">{c.label}</span>
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs tabular-nums">
                    {fmtManHours(c.now)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs tabular-nums text-muted-foreground">
                    {fmtManHours(c.before)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right font-mono text-xs tabular-nums",
                      c.diff > 0 ? "text-success" : c.diff < 0 ? "text-destructive" : ""
                    )}
                  >
                    {c.diff > 0 ? "+" : ""}
                    {fmtManHours(c.diff)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs tabular-nums">
                    {c.ratio === null ? (
                      <span className="text-muted-foreground">yeni</span>
                    ) : (
                      <span className={c.ratio > 0 ? "text-success" : c.ratio < 0 ? "text-destructive" : ""}>
                        {c.ratio > 0 ? "▲" : c.ratio < 0 ? "▼" : "="} %
                        {fmtManHours(Math.abs(c.ratio) * 100)}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="border-t-2 bg-muted/40 hover:bg-muted/40">
                <TableCell className="font-semibold">Toplam</TableCell>
                <TableCell className="text-right font-mono text-xs font-semibold tabular-nums">
                  {fmtManHours(summary.manHours)}
                </TableCell>
                <TableCell className="text-right font-mono text-xs font-semibold tabular-nums">
                  {fmtManHours(previous.summary.manHours)}
                </TableCell>
                <TableCell className="text-right font-mono text-xs font-semibold tabular-nums">
                  {summary.manHours - previous.summary.manHours > 0 ? "+" : ""}
                  {fmtManHours(summary.manHours - previous.summary.manHours)}
                </TableCell>
                <TableCell className="text-right font-mono text-xs font-semibold tabular-nums">
                  {delta === null ? "—" : `%${fmtManHours(delta * 100)}`}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
