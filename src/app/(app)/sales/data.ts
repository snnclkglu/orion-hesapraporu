// Satış Takibi'nin OKUMA katmanı — sayfa ve İş Listesi ucu aynı yerden okur.
//
// Sorgu iki yerde yazılsaydı ekranda görünen liste ile müşteriye giden PDF
// sessizce ayrışırdı; İş Takibi'nde bir kez yaşanmış ve `worklog/filters.ts`in
// başında anlatılan hata budur.

import type { SupabaseClient } from "@supabase/supabase-js";
import { currencyOf } from "@/lib/currency";
import { EMPTY_SALE, type SaleRow } from "./schema";

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

interface CustomerJoin {
  short_name: string | null;
  color_hue: number | null;
}

interface JobJoin {
  id: string;
  job_no: string;
  customer: string | null;
  status: string;
  contract_date: string | null;
  work_order_date: string | null;
  /** İş emrindeki PLANLANAN tarihler + sevk adresi — satış penceresinin önerisi. */
  delivery_date: string | null;
  workshop_exit_date: string | null;
  shipping_address: string | null;
  customers: CustomerJoin | CustomerJoin[] | null;
}

/** numeric sütunlar PostgREST'ten metin gelebilir; sayıya çevir. */
function num(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Satış satırları — İŞ KALEMİNDEN çıkar, ticari kayıttan değil.
 *
 * İş emrinde açılan her kalem listede kendiliğinden görünür (fiyatı boş);
 * böylece "fiyatı girilmemiş iş" listeden düşmez, aksine göze batar.
 * Yetki denetimi ÇAĞIRANDADIR — RLS zaten `job_item_sales`i keser, bu
 * fonksiyon yalnız okur.
 */
export async function loadSaleRows(supabase: SupabaseClient): Promise<SaleRow[]> {
  const { data: items } = await supabase
    .from("job_items")
    .select(
      `id, item_no, product_name, sort,
       jobs!inner(id, job_no, customer, status, contract_date, work_order_date,
                  delivery_date, workshop_exit_date, shipping_address,
                  customers(short_name, color_hue)),
       job_item_sales(scope, due_date, shipment_date, quantity, unit, unit_weight_kg,
                      unit_price, currency, fx_rate, shipment_place, notes,
                      total_weight_kg, total_price, eur_amount)`
    )
    .order("item_no", { ascending: false });

  return (items ?? []).map((it) => {
    const job = one<JobJoin>(it.jobs as unknown as JobJoin | JobJoin[]);
    const s = one<SaleJoin>(it.job_item_sales as unknown as SaleJoin | SaleJoin[]);
    const book = one<CustomerJoin>(job?.customers);
    return {
      itemId: it.id as string,
      itemNo: (it.item_no as string) || "",
      productName: (it.product_name as string) || "",
      jobId: job?.id ?? "",
      jobNo: job?.job_no ?? "",
      customer: job?.customer ?? "",
      customerShort: book?.short_name ?? null,
      customerHue: book?.color_hue ?? null,
      jobStatus: job?.status ?? "active",
      contractDate: job?.contract_date ?? job?.work_order_date ?? null,
      // İŞ EMRİNİN KENDİ ALANLARI — kopyalanmaz, TAŞINIR. Satış penceresi
      // boş alanları bunlarla doldurur (bkz. `sale-dialog.tsx`); kaydedilen
      // değer yine `job_item_sales`in kendi sütunudur.
      jobDeliveryDate: job?.delivery_date ?? null,
      jobWorkshopExitDate: job?.workshop_exit_date ?? null,
      jobShippingAddress: job?.shipping_address ?? "",
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
}
