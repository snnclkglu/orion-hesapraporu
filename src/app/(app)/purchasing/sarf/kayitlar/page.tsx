import { createClient } from "@/lib/supabase/server";
import { canEditConsumableExpenses } from "@/lib/roles";
import {
  loadConsumableCatalogs,
  loadConsumableRecords,
  loadConsumableYears,
  type ConsumableRecordFilters,
  type ConsumableRecordSort,
} from "../data";
import { ConsumableRecordsView } from "./records-view";

function stringParam(value: string | string[] | undefined): string {
  return typeof value === "string" ? value : "";
}

const SORTS = new Set<ConsumableRecordSort>(["date", "item", "group", "supplier", "native", "eur"]);

export default async function ConsumableRecordsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const requestedSort = stringParam(params.sirala) as ConsumableRecordSort;
  const filters: ConsumableRecordFilters = {
    q: stringParam(params.q),
    year: stringParam(params.yil),
    group: stringParam(params.grup),
    supplierId: stringParam(params.tedarikci),
    currency: stringParam(params.para),
    source: stringParam(params.kaynak),
    sort: SORTS.has(requestedSort) ? requestedSort : "date",
    desc: stringParam(params.yon) !== "asc",
    page: Math.max(1, Number(stringParam(params.sayfa)) || 1),
  };

  const supabase = await createClient();
  const [result, catalogs, years, { data: auth }] = await Promise.all([
    loadConsumableRecords(supabase, filters),
    loadConsumableCatalogs(supabase),
    loadConsumableYears(supabase),
    supabase.auth.getUser(),
  ]);
  const { data: profile } = auth.user
    ? await supabase.from("profiles").select("role").eq("id", auth.user.id).maybeSingle()
    : { data: null };

  return (
    <ConsumableRecordsView
      result={result}
      filters={filters}
      years={years}
      groups={catalogs.groups}
      items={catalogs.items}
      suppliers={catalogs.suppliers}
      canEdit={canEditConsumableExpenses(profile?.role)}
    />
  );
}
