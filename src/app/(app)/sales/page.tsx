// Satış Takibi — iş kalemi başına fiyat, termin/sevk ve ciro.
//
// Liste İŞ KALEMİNDEN çıkar, ticari kayıttan değil: iş emrinde açılan her kalem
// burada kendiliğinden görünür (fiyatı boş). Böylece "fiyatı girilmemiş iş"
// listeden düşmez, aksine göze batar.

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canSeeSales } from "@/lib/roles";
import { currencyOf } from "@/lib/currency";
import { EMPTY_SALE, type SaleRow } from "./schema";
import { SalesTable } from "./sales-table";
import { PageHeader } from "@/components/page-header";

/** Supabase gömülü ilişkiyi tekil ya da dizi olarak dönebilir; ikisini de karşıla. */
function one<T>(v: T | T[] | null | undefined): T | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

interface SaleJoin {
  scope: string | null;
  due_date: string | null;
  shipment_date: string | null;
  quantity: number | string | null;
  unit: string | null;
  unit_weight_kg: number | string | null;
  unit_price: number | string | null;
  currency: string | null;
  fx_rate: number | string | null;
  shipment_place: string | null;
  notes: string | null;
  total_weight_kg: number | string | null;
  total_price: number | string | null;
  eur_amount: number | string | null;
}

interface JobJoin {
  id: string;
  job_no: string;
  customer: string | null;
  status: string;
  contract_date: string | null;
  work_order_date: string | null;
  customers: CustomerJoin | CustomerJoin[] | null;
}

interface CustomerJoin {
  short_name: string | null;
  color_hue: number | null;
}

/** numeric sütunlar PostgREST'ten metin gelebilir; sayıya çevir. */
function num(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export default async function SalesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
    : { data: null };

  // Menüden gizlemek yetmez: adres doğrudan yazılabilir. RLS zaten satırları
  // vermez ama boş bir sayfa göstermek yerine kullanıcıyı geri yollarız.
  if (!canSeeSales(profile?.role)) redirect("/jobs");

  const { data: items } = await supabase
    .from("job_items")
    .select(
      `id, item_no, product_name, sort,
       jobs!inner(id, job_no, customer, status, contract_date, work_order_date,
                  customers(short_name, color_hue)),
       job_item_sales(scope, due_date, shipment_date, quantity, unit, unit_weight_kg,
                      unit_price, currency, fx_rate, shipment_place, notes,
                      total_weight_kg, total_price, eur_amount)`
    )
    .order("item_no", { ascending: false });

  const rows: SaleRow[] = (items ?? []).map((it) => {
    const job = one<JobJoin>(it.jobs as unknown as JobJoin | JobJoin[]);
    const s = one<SaleJoin>(it.job_item_sales as unknown as SaleJoin | SaleJoin[]);
    const book = one<CustomerJoin>(job?.customers);
    return {
      itemId: it.id,
      itemNo: it.item_no || "",
      productName: it.product_name || "",
      jobId: job?.id ?? "",
      jobNo: job?.job_no ?? "",
      customer: job?.customer ?? "",
      customerShort: book?.short_name ?? null,
      customerHue: book?.color_hue ?? null,
      jobStatus: job?.status ?? "active",
      contractDate: job?.contract_date ?? job?.work_order_date ?? null,
      hasSale: Boolean(s),
      sale: s
        ? {
            scope: s.scope ?? "",
            due_date: s.due_date,
            shipment_date: s.shipment_date,
            quantity: num(s.quantity),
            unit: s.unit ?? "Adet",
            unit_weight_kg: num(s.unit_weight_kg),
            unit_price: num(s.unit_price),
            currency: currencyOf(s.currency),
            fx_rate: num(s.fx_rate),
            shipment_place: s.shipment_place ?? "",
            notes: s.notes ?? "",
          }
        : { ...EMPTY_SALE },
      totalWeightKg: s ? num(s.total_weight_kg) : null,
      totalPrice: s ? num(s.total_price) : null,
      eurAmount: s ? num(s.eur_amount) : null,
    };
  });

  return (
    <div className="grid gap-4">
      <PageHeader
        title="Satış Takibi"
        hint="İş kalemi başına fiyat, termin ve sevk takibi — ciro avro karşılığıyla toplanır"
      >
        <span className="shrink-0 border border-primary/30 bg-primary/5 px-2 py-0.5 font-mono text-[10px] font-semibold tracking-[0.14em] text-primary uppercase">
          Yönetici · Müdür
        </span>
      </PageHeader>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 border bg-card px-6 py-16 text-center">
          <h2 className="border bg-background px-3 py-1.5 font-mono text-xs font-medium tracking-[0.15em]">
            [ HENÜZ İŞ KALEMİ YOK ]
          </h2>
          <p className="max-w-sm text-sm text-foreground/70">
            Satış satırları iş emirlerinden gelir. İşler bölümünde bir iş emri
            açtığınızda kalemleri burada kendiliğinden listelenir.
          </p>
        </div>
      ) : (
        <SalesTable rows={rows} />
      )}
    </div>
  );
}
