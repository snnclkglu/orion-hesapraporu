import { createClient } from "@/lib/supabase/server";
import {
  annualGroupMatrix,
  denseMonthlyEurRange,
  materialBreakdown,
  materialDrilldownAggregate,
  selectedYearGroupMatrix,
  supplierDrilldownAggregate,
} from "@/lib/purchasing/consumables";
import {
  loadConsumableAnalyticsRows,
  loadConsumableCatalogs,
  loadConsumableYears,
  loadSupplierConsumableHistory,
} from "../data";
import { ConsumableAnalysisView } from "./analysis-view";

function param(value: string | string[] | undefined): string {
  return typeof value === "string" ? value : "";
}

function istanbulToday(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export default async function ConsumableAnalysisPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const today = istanbulToday();
  const currentYear = Number(today.slice(0, 4));
  const rawYear = param(params.yil);
  const selectedYear = rawYear === "tumu" ? null : /^\d{4}$/.test(rawYear) ? Number(rawYear) : currentYear;
  const selectedSupplierId = param(params.tedarikci);
  const selectedMaterialKey = param(params.malzeme);
  const supabase = await createClient();

  const [rows, catalogs, years] = await Promise.all([
    loadConsumableAnalyticsRows(supabase, selectedYear),
    loadConsumableCatalogs(supabase),
    loadConsumableYears(supabase),
  ]);
  const matrix = selectedYear == null
    ? ({ kind: "annual" as const, value: annualGroupMatrix(rows) })
    : ({
        kind: "monthly" as const,
        value: selectedYearGroupMatrix(rows, selectedYear, today),
      });
  const monthlySeries = selectedYear == null
    ? denseMonthlyEurRange(rows)
    : matrix.kind === "monthly"
      ? matrix.value.months
      : [];
  const drilldown = selectedSupplierId ? supplierDrilldownAggregate(rows, selectedSupplierId) : null;
  const supplierHistory = selectedSupplierId
    ? await loadSupplierConsumableHistory(supabase, selectedSupplierId, selectedYear)
    : [];
  const supplierCount = new Set(rows.map((row) => row.supplierKey).filter(Boolean)).size;

  // MALZEME KIRILIMI VE SEYRİ aynı `rows`tan türer — ekstra sorgu yok. Seçenek
  // listesi de buradan gelir: dönemde gideri olan her malzeme listelenir, boş
  // bir katalog satırı öneriye girmez.
  const materialRanking = materialBreakdown(rows);
  const materialDrilldown = selectedMaterialKey
    ? materialDrilldownAggregate(rows, selectedMaterialKey)
    : null;
  const materialOptions = materialRanking.map((row) => ({ key: row.key, label: row.label }));

  return (
    <ConsumableAnalysisView
      currentYear={currentYear}
      selectedYear={selectedYear}
      availableYears={years}
      monthlySeries={monthlySeries}
      matrix={matrix}
      supplierCount={supplierCount}
      suppliers={catalogs.suppliers.filter((supplier) => supplier.active)}
      selectedSupplierId={selectedSupplierId}
      drilldown={drilldown}
      supplierHistory={supplierHistory}
      materialRanking={materialRanking}
      materialOptions={materialOptions}
      selectedMaterialKey={selectedMaterialKey}
      materialDrilldown={materialDrilldown}
    />
  );
}
