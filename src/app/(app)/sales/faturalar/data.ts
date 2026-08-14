import type { SupabaseClient } from "@supabase/supabase-js";
import type { Currency } from "@/lib/currency";

export interface SalesInvoiceRow {
  id: string;
  itemNo: string;
  invoiceYear: number | null;
  invoiceDate: string | null;
  invoiceNo: string;
  customer: string;
  customerId: string | null;
  qty: number | null;
  unitPrice: number | null;
  currency: Currency;
  fxRate: number | null;
  amount: number | null;
  amountEur: number | null;
  note: string;
  source: string;
}

export interface InvoiceCustomerOption {
  id: string;
  name: string;
  short: string | null;
  hue: number | null;
}

export interface LatestFx {
  rateDate: string;
  eurTry: number;
  usdTry: number;
}

const COLS =
  "id, item_no, invoice_year, invoice_date, invoice_no, customer, customer_id, qty, " +
  "unit_price, currency, fx_rate, amount, amount_eur, note, source";

export async function loadSalesInvoices(supabase: SupabaseClient): Promise<SalesInvoiceRow[]> {
  const rows: SalesInvoiceRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("sales_invoices")
      .select(COLS)
      .order("invoice_date", { ascending: false, nullsFirst: false })
      .order("id")
      .range(from, from + 999);
    if (error) return rows;
    const page = (data ?? []) as unknown as Record<string, unknown>[];
    for (const r of page) {
      const cur = String(r.currency ?? "TRY");
      rows.push({
        id: String(r.id),
        itemNo: String(r.item_no ?? ""),
        invoiceYear: r.invoice_year == null ? null : Number(r.invoice_year),
        invoiceDate: r.invoice_date ? String(r.invoice_date).slice(0, 10) : null,
        invoiceNo: String(r.invoice_no ?? ""),
        customer: String(r.customer ?? ""),
        customerId: (r.customer_id as string | null) ?? null,
        qty: r.qty == null ? null : Number(r.qty),
        unitPrice: r.unit_price == null ? null : Number(r.unit_price),
        currency: (cur === "EUR" || cur === "USD" ? cur : "TRY") as Currency,
        fxRate: r.fx_rate == null ? null : Number(r.fx_rate),
        amount: r.amount == null ? null : Number(r.amount),
        amountEur: r.amount_eur == null ? null : Number(r.amount_eur),
        note: String(r.note ?? ""),
        source: String(r.source ?? "app"),
      });
    }
    if (page.length < 1000) break;
  }
  return rows;
}

export async function loadInvoiceCustomers(
  supabase: SupabaseClient
): Promise<InvoiceCustomerOption[]> {
  const { data, error } = await supabase
    .from("customers")
    .select("id, name, short_name, color_hue")
    .order("name");
  if (error) return [];
  return ((data ?? []) as {
    id: string;
    name: string;
    short_name: string | null;
    color_hue: number | null;
  }[]).map((c) => ({
    id: c.id,
    name: c.name ?? "",
    short: c.short_name ?? null,
    hue: c.color_hue ?? null,
  }));
}

/** En son yayımlanmış günlük kur — fatura kur önerisi (md. 16 deseni). */
export async function loadLatestFx(supabase: SupabaseClient): Promise<LatestFx | null> {
  const { data, error } = await supabase
    .from("fx_rate_daily")
    .select("rate_date, eur_try, usd_try")
    .order("rate_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  const r = data as { rate_date: string; eur_try: number | null; usd_try: number | null };
  if (r.eur_try == null) return null;
  return {
    rateDate: String(r.rate_date).slice(0, 10),
    eurTry: Number(r.eur_try),
    usdTry: Number(r.usd_try ?? 0),
  };
}
