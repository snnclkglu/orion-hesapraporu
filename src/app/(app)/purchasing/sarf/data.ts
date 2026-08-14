import type { SupabaseClient } from "@supabase/supabase-js";
import type { Currency } from "@/lib/currency";
import type { ConsumableExpenseAnalyticsRow } from "@/lib/purchasing/consumables";
import { trKatla } from "@/lib/drawings/tr-text";

export interface ConsumableItemOption {
  id: string;
  code: string;
  name: string;
  groupName: string;
  defaultUnit: string;
  active: boolean;
}

export interface ConsumableSupplierOption {
  id: string;
  code: string;
  name: string;
  active: boolean;
}

const LEGACY_DEPARTMENTS = [
  "Ana Kiriş",
  "Borverk Tezgahı",
  "Kalite Kontrol",
  "Kiriş Sehpası",
  "Kompresör Odası",
  "MONTAJ",
  "MURAT ASLAN",
  "OFİS",
  "RADYAL MATKAP",
  "RESİMHANE",
  "Silindir (Düzeltme Makinesi)",
  "Spot Tezgahı",
  "TALAŞLI İMALAT - TORNA SN 71",
  "TOPLANTI ODASI",
  "Tüp Odası ve Atık Yeri",
  "YEMEKHANE",
] as const;

export interface ConsumableExpenseRow {
  id: string;
  expenseDate: string;
  itemId: string | null;
  itemCode: string;
  itemName: string;
  groupName: string;
  supplierId: string | null;
  supplierName: string;
  documentNo: string;
  department: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  amount: number;
  currency: Currency;
  fxRate: number;
  fxRateDate: string | null;
  fxSource: string;
  amountEur: number;
  note: string;
  source: string;
  sourceRef: string;
  qualityFlags: string[];
  createdAt: string;
}

export type ConsumableRecordSort =
  | "date"
  | "item"
  | "group"
  | "supplier"
  | "native"
  | "eur";

export interface ConsumableRecordFilters {
  q: string;
  year: string;
  group: string;
  supplierId: string;
  currency: string;
  source: string;
  sort: ConsumableRecordSort;
  desc: boolean;
  page: number;
}

export interface ConsumableRecordResult {
  rows: ConsumableExpenseRow[];
  total: number;
  page: number;
  pageSize: number;
}

type ExpenseDbRow = {
  id: string;
  expense_date: string;
  item_id: string | null;
  item_code: string | null;
  item_name: string | null;
  group_name: string | null;
  supplier_id: string | null;
  supplier_name: string | null;
  document_no: string | null;
  department: string | null;
  quantity: number | null;
  unit: string | null;
  unit_price: number | null;
  amount: number;
  currency: string;
  fx_rate: number;
  fx_rate_date: string | null;
  fx_source: string | null;
  amount_eur: number;
  note: string | null;
  source: string;
  source_ref: string | null;
  quality_flags: string[] | null;
  created_at: string;
};

const EXPENSE_COLUMNS =
  "id, expense_date, item_id, item_code, item_name, group_name, supplier_id, supplier_name, document_no, department, quantity, unit, unit_price, amount, currency, fx_rate, fx_rate_date, fx_source, amount_eur, note, source, source_ref, quality_flags, created_at";

function toExpenseRow(row: ExpenseDbRow): ConsumableExpenseRow {
  const currency: Currency = row.currency === "TRY" || row.currency === "USD" ? row.currency : "EUR";
  return {
    id: row.id,
    expenseDate: String(row.expense_date).slice(0, 10),
    itemId: row.item_id,
    itemCode: row.item_code ?? "",
    itemName: row.item_name ?? "",
    groupName: row.group_name ?? "Belirsiz",
    supplierId: row.supplier_id,
    supplierName: row.supplier_name ?? "",
    documentNo: row.document_no ?? "",
    department: row.department ?? "",
    quantity: Number(row.quantity ?? 0),
    unit: row.unit ?? "",
    unitPrice: Number(row.unit_price ?? 0),
    amount: Number(row.amount ?? 0),
    currency,
    fxRate: Number(row.fx_rate ?? 1),
    fxRateDate: row.fx_rate_date ? String(row.fx_rate_date).slice(0, 10) : null,
    fxSource: row.fx_source ?? "",
    amountEur: Number(row.amount_eur ?? 0),
    note: row.note ?? "",
    source: row.source ?? "app",
    sourceRef: row.source_ref ?? "",
    qualityFlags: row.quality_flags ?? [],
    createdAt: row.created_at ?? "",
  };
}

export async function loadConsumableCatalogs(supabase: SupabaseClient): Promise<{
  items: ConsumableItemOption[];
  suppliers: ConsumableSupplierOption[];
  groups: string[];
  departments: string[];
}> {
  const [itemsResult, suppliersResult, liveDepartments] = await Promise.all([
    supabase
      .from("purchase_consumable_items")
      .select("id, code, name, group_name, default_unit, active")
      .order("name"),
    supabase.from("purchase_suppliers").select("id, code, name, active").order("name"),
    loadConsumableDepartments(supabase),
  ]);

  const items = ((itemsResult.data ?? []) as {
    id: string;
    code: string;
    name: string;
    group_name: string;
    default_unit: string | null;
    active: boolean;
  }[]).map((row) => ({
    id: row.id,
    code: row.code ?? "",
    name: row.name ?? "",
    groupName: row.group_name ?? "Belirsiz",
    defaultUnit: row.default_unit ?? "Adet",
    active: row.active !== false,
  }));

  const suppliers = ((suppliersResult.data ?? []) as {
    id: string;
    code: string | null;
    name: string;
    active: boolean;
  }[]).map((row) => ({
    id: row.id,
    code: row.code ?? "",
    name: row.name ?? "",
    active: row.active !== false,
  }));

  const groups = [...new Set(items.map((row) => row.groupName).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "tr")
  );
  const departments = [...new Set([...LEGACY_DEPARTMENTS, ...liveDepartments])].sort((a, b) =>
    a.localeCompare(b, "tr")
  );
  return { items, suppliers, groups, departments };
}

async function loadConsumableDepartments(supabase: SupabaseClient): Promise<string[]> {
  const departments = new Set<string>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("purchase_consumable_expenses")
      .select("department")
      .order("id", { ascending: true })
      .range(from, from + 999);
    if (error) break;
    const page = (data ?? []) as { department: string | null }[];
    for (const row of page) {
      const value = row.department?.trim();
      if (value) departments.add(value);
    }
    if (page.length < 1000) break;
  }
  return [...departments];
}

export async function loadRecentConsumableExpenses(
  supabase: SupabaseClient,
  limit = 12
): Promise<ConsumableExpenseRow[]> {
  const { data, error } = await supabase
    .from("purchase_consumable_expenses")
    .select(EXPENSE_COLUMNS)
    .order("expense_date", { ascending: false })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit);
  if (error) return [];
  return ((data ?? []) as ExpenseDbRow[]).map(toExpenseRow);
}

const SORT_COLUMNS: Record<ConsumableRecordSort, string> = {
  date: "expense_date",
  item: "item_name",
  group: "group_name",
  supplier: "supplier_name",
  native: "amount",
  eur: "amount_eur",
};

function safeSearch(value: string): string {
  return value.trim().replace(/[%_,()]/g, " ").replace(/\s+/g, " ").slice(0, 100);
}

export async function loadConsumableRecords(
  supabase: SupabaseClient,
  filters: ConsumableRecordFilters
): Promise<ConsumableRecordResult> {
  const pageSize = 100;
  const page = Math.max(1, filters.page || 1);
  let query = supabase
    .from("purchase_consumable_expense_records")
    .select(EXPENSE_COLUMNS, { count: "exact" });

  const q = safeSearch(filters.q);
  if (q) {
    // Görünümün `ara` alanı aynı katlamayı SM/TD kodu, belge, grup, ad ve
    // açıklama üzerinde bir kez yapar; JSON payload liste aramasını şişirmez.
    query = query.ilike("ara", `%${trKatla(q).toLocaleUpperCase("tr-TR")}%`);
  }
  if (/^\d{4}$/.test(filters.year)) {
    query = query
      .gte("expense_date", `${filters.year}-01-01`)
      .lte("expense_date", `${filters.year}-12-31`);
  }
  if (filters.group) query = query.eq("group_name", filters.group);
  if (filters.supplierId) query = query.eq("supplier_id", filters.supplierId);
  if (filters.currency) query = query.eq("currency", filters.currency);
  if (filters.source === "legacy") query = query.neq("source", "app");
  if (filters.source === "app") query = query.eq("source", "app");

  const from = (page - 1) * pageSize;
  const sortColumn = SORT_COLUMNS[filters.sort] ?? SORT_COLUMNS.date;
  query = query
    .order(sortColumn, { ascending: !filters.desc, nullsFirst: false })
    .order("expense_date", { ascending: false })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(from, from + pageSize - 1);

  const { data, count, error } = await query;
  if (error) return { rows: [], total: 0, page, pageSize };
  return {
    rows: ((data ?? []) as ExpenseDbRow[]).map(toExpenseRow),
    total: count ?? 0,
    page,
    pageSize,
  };
}

export async function loadConsumableYears(supabase: SupabaseClient): Promise<number[]> {
  const years = new Set<number>();
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("purchase_consumable_expenses")
      .select("expense_date")
      .order("expense_date")
      .range(from, from + 999);
    if (error) return [...years].sort((a, b) => b - a);
    const rows = (data ?? []) as { expense_date: string }[];
    for (const row of rows) {
      const year = Number(String(row.expense_date).slice(0, 4));
      if (Number.isInteger(year)) years.add(year);
    }
    if (rows.length < 1000) break;
    from += 1000;
  }
  return [...years].sort((a, b) => b - a);
}

export async function loadConsumableAnalyticsRows(
  supabase: SupabaseClient,
  year: number | null
): Promise<ConsumableExpenseAnalyticsRow[]> {
  const rows: ConsumableExpenseAnalyticsRow[] = [];
  let from = 0;
  while (true) {
    let query = supabase
      .from("purchase_consumable_expenses")
      .select(
        "id, expense_date, amount_eur, group_name, supplier_id, supplier_name, item_id, item_name"
      )
      .order("expense_date")
      .order("id");
    if (year != null) {
      query = query.gte("expense_date", `${year}-01-01`).lte("expense_date", `${year}-12-31`);
    }
    const { data, error } = await query.range(from, from + 999);
    if (error) return rows;
    const page = (data ?? []) as {
      id: string;
      expense_date: string;
      amount_eur: number;
      group_name: string | null;
      supplier_id: string | null;
      supplier_name: string | null;
      item_id: string | null;
      item_name: string | null;
    }[];
    for (const row of page) {
      rows.push({
        expenseDate: String(row.expense_date).slice(0, 10),
        amountEur: Number(row.amount_eur ?? 0),
        groupKey: row.group_name || "__unknown__",
        groupLabel: row.group_name || "Belirsiz",
        supplierKey: row.supplier_id || `legacy:${row.supplier_name || "unknown"}`,
        supplierLabel: row.supplier_name || "Tedarikçi belirtilmemiş",
        materialKey: row.item_id || `legacy:${row.item_name || row.id}`,
        materialLabel: row.item_name || "Malzeme belirtilmemiş",
      });
    }
    if (page.length < 1000) break;
    from += 1000;
  }
  return rows;
}

export async function loadSupplierConsumableHistory(
  supabase: SupabaseClient,
  supplierId: string,
  year: number | null,
  limit = 100
): Promise<ConsumableExpenseRow[]> {
  let query = supabase
    .from("purchase_consumable_expenses")
    .select(EXPENSE_COLUMNS)
    .eq("supplier_id", supplierId);
  if (year != null) {
    query = query.gte("expense_date", `${year}-01-01`).lte("expense_date", `${year}-12-31`);
  }
  const { data, error } = await query
    .order("expense_date", { ascending: false })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit);
  if (error) return [];
  return ((data ?? []) as ExpenseDbRow[]).map(toExpenseRow);
}
