"use client";

import { useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Building2, CalendarRange, ReceiptText, WalletCards } from "lucide-react";
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
import { Combobox, type ComboOption } from "@/components/combobox";
import { StatCard } from "@/components/stat-card";
import { RankBars, TimeLineChart, type ChartColumn, type ChartSeries, type RankItem } from "@/components/charts";
import { PanoKabugu } from "../../board-ui";
import { fmtCompactEur, fmtMoney, fmtTutar } from "@/lib/currency";
import { hueFromText } from "@/lib/tags";
import { tarihGoster } from "@/lib/purchasing/terms";
import type {
  ConsumableAnnualGroupMatrix,
  ConsumableGroupMonthCell,
  ConsumableMonthlyEurPoint,
  ConsumableSelectedYearGroupMatrix,
  ConsumableSupplierDrilldown,
} from "@/lib/purchasing/consumables";
import type { ConsumableExpenseRow, ConsumableSupplierOption } from "../data";

type Matrix =
  | { kind: "monthly"; value: ConsumableSelectedYearGroupMatrix }
  | { kind: "annual"; value: ConsumableAnnualGroupMatrix };

function lineColumns(points: readonly ConsumableMonthlyEurPoint[], key = "total"): ChartColumn[] {
  return points.map((point) => ({
    key: point.monthKey,
    label: `${point.monthLabel.slice(0, 3)} ${String(point.year).slice(-2)}`,
    total: point.amountEur,
    parts: { [key]: point.amountEur },
  }));
}

function rankItems(
  rows: readonly { groupKey: string; groupLabel: string; totalEur: number; recordCount: number }[],
  total: number
): RankItem[] {
  return rows.map((row) => ({
    key: row.groupKey,
    label: row.groupLabel,
    hue: hueFromText(row.groupKey),
    value: row.totalEur,
    share: total === 0 ? 0 : row.totalEur / total,
    records: row.recordCount,
  }));
}

function MonthlyMatrix({ matrix }: { matrix: ConsumableSelectedYearGroupMatrix }) {
  const cellClass = (cell: ConsumableGroupMonthCell) => {
    if (cell.isFuture) return "bg-muted/20 text-muted-foreground/60";
    if (cell.anomaly === "strong") return "bg-destructive/20 font-semibold text-destructive";
    if (cell.anomaly === "spike") return "bg-destructive/10 font-medium text-destructive";
    return "";
  };
  return (
    <div className="oc-scrollx overflow-x-auto [--oc-scroll-bg:var(--card)]">
      <Table className="min-w-[78rem]">
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead className="sticky left-0 z-10 min-w-40 bg-muted">Grup</TableHead>
            {matrix.months.map((month) => <TableHead key={month.monthKey} className="w-24 text-right">{month.monthLabel.slice(0, 3)}</TableHead>)}
            <TableHead className="w-24 text-right">Ort.</TableHead>
            <TableHead className="w-28 text-right">Toplam</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {matrix.rows.map((row) => (
            <TableRow key={row.groupKey}>
              <TableCell className="sticky left-0 z-10 bg-card font-medium whitespace-normal">{row.groupLabel}</TableCell>
              {row.cells.map((cell) => (
                <TableCell
                  key={cell.monthKey}
                  className={`text-right font-mono text-xs tabular-nums ${cellClass(cell)}`}
                  title={
                    cell.ratioToBaseline == null
                      ? `${cell.monthLabel} · karşılaştırma için en az 3 dolu baz ay gerekir`
                      : `${cell.monthLabel} · diğer ay ortalamasının ${cell.ratioToBaseline.toFixed(2)} katı`
                  }
                >
                  {cell.isFuture ? "—" : (
                    <span>
                      {cell.anomaly !== "none" && <span aria-hidden>▲ </span>}
                      {fmtTutar(cell.amountEur)}
                    </span>
                  )}
                </TableCell>
              ))}
              <TableCell className="text-right font-mono text-xs tabular-nums">{fmtTutar(row.averageEur)}</TableCell>
              <TableCell className="text-right font-mono text-xs font-semibold tabular-nums">{fmtTutar(row.totalEur)}</TableCell>
            </TableRow>
          ))}
          <TableRow className="bg-muted/30 font-semibold">
            <TableCell className="sticky left-0 z-10 bg-muted">Ay Toplamı</TableCell>
            {matrix.months.map((month) => <TableCell key={month.monthKey} className="text-right font-mono text-xs tabular-nums">{month.isFuture ? "—" : fmtTutar(month.amountEur)}</TableCell>)}
            <TableCell className="text-right font-mono text-xs tabular-nums">{fmtTutar(matrix.averageEur)}</TableCell>
            <TableCell className="text-right font-mono text-xs tabular-nums">{fmtTutar(matrix.totalEur)}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}

function AnnualMatrix({ matrix }: { matrix: ConsumableAnnualGroupMatrix }) {
  return (
    <div className="oc-scrollx overflow-x-auto [--oc-scroll-bg:var(--card)]">
      <Table className="min-w-[42rem]">
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead className="sticky left-0 z-10 min-w-44 bg-muted">Grup</TableHead>
            {matrix.years.map((year) => <TableHead key={year} className="text-right">{year}</TableHead>)}
            <TableHead className="text-right">Yıl Ort.</TableHead>
            <TableHead className="text-right">Toplam</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {matrix.rows.map((row) => (
            <TableRow key={row.groupKey}>
              <TableCell className="sticky left-0 z-10 bg-card font-medium">{row.groupLabel}</TableCell>
              {row.cells.map((cell) => <TableCell key={cell.year} className="text-right font-mono text-xs tabular-nums">{fmtTutar(cell.amountEur)}</TableCell>)}
              <TableCell className="text-right font-mono text-xs tabular-nums">{fmtTutar(row.averageEur)}</TableCell>
              <TableCell className="text-right font-mono text-xs font-semibold tabular-nums">{fmtTutar(row.totalEur)}</TableCell>
            </TableRow>
          ))}
          <TableRow className="bg-muted/30 font-semibold">
            <TableCell className="sticky left-0 z-10 bg-muted">Yıl Toplamı</TableCell>
            {matrix.totals.map((cell) => <TableCell key={cell.year} className="text-right font-mono text-xs tabular-nums">{fmtTutar(cell.amountEur)}</TableCell>)}
            <TableCell />
            <TableCell className="text-right font-mono text-xs tabular-nums">{fmtTutar(matrix.totalEur)}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}

function SupplierSection({
  suppliers,
  selectedSupplierId,
  drilldown,
  history,
  onSupplier,
}: {
  suppliers: ConsumableSupplierOption[];
  selectedSupplierId: string;
  drilldown: ConsumableSupplierDrilldown | null;
  history: ConsumableExpenseRow[];
  onSupplier: (value: string) => void;
}) {
  const options: ComboOption[] = suppliers.map((supplier) => ({ value: supplier.id, label: supplier.name, badge: supplier.code }));
  const series: ChartSeries[] = [{ key: "supplier", label: drilldown?.supplierLabel ?? "Tedarikçi", hue: hueFromText(drilldown?.supplierKey ?? "supplier") }];
  const materialItems: RankItem[] = (drilldown?.materials ?? []).map((row) => ({
    key: row.key,
    label: row.label,
    hue: hueFromText(row.key),
    value: row.amountEur,
    share: row.shareOfTotal ?? 0,
    records: row.recordCount,
  }));

  return (
    <PanoKabugu baslik="Tedarikçi Geçmişi" alt="Seçilen dönemin EUR karşılığı">
      <div className="grid gap-4">
        <Combobox
          options={options}
          value={selectedSupplierId || null}
          onChange={onSupplier}
          placeholder="Tedarikçi seçin"
          searchPlaceholder="Firma adı veya TD kodu…"
          className="max-w-xl"
        />
        {!drilldown ? (
          <p className="border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
            Aylık alım seyrini, malzeme dağılımını ve geçmiş tabloyu görmek için bir tedarikçi seçin.
          </p>
        ) : (
          <>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard dense label="Tedarikçi Toplamı" value={fmtCompactEur(drilldown.totalEur)} icon={WalletCards} />
              <StatCard dense label="Kayıt Sayısı" value={drilldown.recordCount.toLocaleString("tr-TR")} icon={ReceiptText} />
              <StatCard dense label="Aylık Ortalama" value={fmtCompactEur(drilldown.averageMonthlyEur)} icon={CalendarRange} />
              <StatCard dense label="Son Alım" value={tarihGoster(drilldown.lastExpenseDate)} hint={`İlk: ${tarihGoster(drilldown.firstExpenseDate)}`} icon={Building2} />
            </div>
            <div className="grid gap-3 xl:grid-cols-[minmax(0,1.5fr)_minmax(20rem,1fr)]">
              <PanoKabugu baslik="Aylık Alım Seyri" alt={fmtCompactEur(drilldown.totalEur)}>
                <TimeLineChart columns={lineColumns(drilldown.monthly, "supplier")} series={series} valueLabel="EUR" format={fmtCompactEur} />
              </PanoKabugu>
              <PanoKabugu baslik="En Çok Alınan Malzemeler" alt={`${materialItems.length} kalem`}>
                <RankBars items={materialItems} limit={10} valueLabel="EUR" format={fmtCompactEur} />
              </PanoKabugu>
            </div>
            <div className="border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead>Tarih</TableHead><TableHead>Malzeme</TableHead><TableHead className="hidden md:table-cell">Grup</TableHead><TableHead className="text-right">Tutar (€)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-mono text-xs whitespace-nowrap">{tarihGoster(row.expenseDate)}</TableCell>
                      <TableCell className="whitespace-normal">{row.itemName || "Malzeme belirtilmemiş"}</TableCell>
                      <TableCell className="hidden md:table-cell">{row.groupName}</TableCell>
                      <TableCell className="text-right font-mono text-xs font-medium tabular-nums">{fmtMoney(row.amountEur, "EUR")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </div>
    </PanoKabugu>
  );
}

export function ConsumableAnalysisView({
  currentYear,
  selectedYear,
  availableYears,
  monthlySeries,
  matrix,
  supplierCount,
  suppliers,
  selectedSupplierId,
  drilldown,
  supplierHistory,
}: {
  currentYear: number;
  selectedYear: number | null;
  availableYears: number[];
  monthlySeries: ConsumableMonthlyEurPoint[];
  matrix: Matrix;
  supplierCount: number;
  suppliers: ConsumableSupplierOption[];
  selectedSupplierId: string;
  drilldown: ConsumableSupplierDrilldown | null;
  supplierHistory: ConsumableExpenseRow[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const total = matrix.value.totalEur;
  const count = matrix.value.recordCount;
  const average =
    matrix.kind === "monthly"
      ? (matrix.value.averageEur ?? 0)
      : matrix.value.totals.length > 0
        ? total / matrix.value.totals.length
        : 0;
  const groupRows = matrix.value.rows;
  const groupRanking = rankItems(groupRows, total);
  const columns = lineColumns(monthlySeries);
  const series: ChartSeries[] = [{ key: "total", label: "Aylık Sarf", hue: hueFromText("Aylık Sarf") }];
  const completedMonths = monthlySeries.filter(
    (month) => (month as ConsumableMonthlyEurPoint & { isFuture?: boolean }).isFuture !== true
  );
  const chartAverage =
    completedMonths.length > 0
      ? completedMonths.reduce((sum, month) => sum + month.amountEur, 0) / completedMonths.length
      : 0;

  function write(changes: Record<string, string | undefined>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    startTransition(() => router.replace(`?${next.toString()}`, { scroll: false }));
  }

  const quickYears = [currentYear, currentYear - 1, currentYear - 2];
  const selectedValue = selectedYear == null ? "all" : String(selectedYear);
  const otherYears = availableYears.filter((year) => !quickYears.includes(year));

  return (
    <div className={"grid gap-4" + (pending ? " opacity-70 transition-opacity" : "")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Sarf Analizi</h2>
          <p className="text-sm text-muted-foreground">Farklı fiziksel birimler toplanmaz; bütün kıyaslar kayıt günündeki kurla dondurulmuş EUR tutarıdır.</p>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {quickYears.map((year) => (
            <Button key={year} size="sm" variant={selectedYear === year ? "default" : "outline"} onClick={() => write({ yil: String(year) })}>{year}</Button>
          ))}
          <Button size="sm" variant={selectedYear == null ? "default" : "outline"} onClick={() => write({ yil: "tumu" })}>Tümü</Button>
          {otherYears.length > 0 && (
            <Select value={selectedValue} onValueChange={(value) => write({ yil: value === "all" ? "tumu" : value })}>
              <SelectTrigger size="sm">
                <SelectValue>{selectedYear == null ? "Tümü" : selectedYear}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tümü</SelectItem>
                {availableYears.map((year) => <SelectItem key={year} value={String(year)}>{year}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Toplam Sarf" value={fmtCompactEur(total)} icon={WalletCards} hint={selectedYear == null ? "Tüm dönem" : String(selectedYear)} />
        <StatCard label={selectedYear == null ? "Yıllık Ortalama" : "Aylık Ortalama"} value={fmtCompactEur(average)} icon={CalendarRange} />
        <StatCard label="Kayıt Sayısı" value={count.toLocaleString("tr-TR")} icon={ReceiptText} />
        <StatCard label="Tedarikçi" value={supplierCount.toLocaleString("tr-TR")} icon={Building2} />
      </div>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.6fr)_minmax(20rem,1fr)]">
        <PanoKabugu baslik="Aylık Sarf Gideri" alt={fmtCompactEur(total)}>
          <TimeLineChart
            columns={columns}
            series={series}
            referenceLines={[{ key: "monthly-average", label: "Ort.", value: chartAverage }]}
            valueLabel="EUR"
            format={fmtCompactEur}
          />
        </PanoKabugu>
        <PanoKabugu baslik="Sarf Grupları" alt={`${groupRows.length} grup`}>
          <RankBars items={groupRanking} limit={10} valueLabel="EUR" format={fmtCompactEur} />
        </PanoKabugu>
      </div>

      <PanoKabugu
        baslik={matrix.kind === "monthly" ? "Aylık Tutar (€) · Grup Matrisi" : "Yıllık Tutar (€) · Grup Matrisi"}
        alt={matrix.kind === "monthly" ? "▲ = diğer dolu ay ortalamasının >1,5 katı" : "Tüm dönem"}
      >
        {matrix.kind === "monthly" ? <MonthlyMatrix matrix={matrix.value} /> : <AnnualMatrix matrix={matrix.value} />}
      </PanoKabugu>

      <SupplierSection
        suppliers={suppliers}
        selectedSupplierId={selectedSupplierId}
        drilldown={drilldown}
        history={supplierHistory}
        onSupplier={(value) => write({ tedarikci: value || undefined })}
      />
    </div>
  );
}
