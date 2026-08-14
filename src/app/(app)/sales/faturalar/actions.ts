"use server";

// Satış Faturaları server eylemleri. Yetki `can_see_sales()` (Yönetici+Müdür);
// RLS asıl engeldir, buradaki kontrol anlaşılır hata mesajı içindir.

import { revalidatePath } from "next/cache";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { canSeeSales } from "@/lib/roles";
import { adBuyuk } from "@/lib/tr-text";
import {
  createInvoiceCustomerSchema,
  createInvoiceSchema,
  deleteInvoiceSchema,
  editInvoiceSchema,
  type CreateInvoiceCustomerInput,
  type CreateInvoiceInput,
  type EditInvoiceInput,
  type SalesInvoiceActionResult,
} from "./schema";

async function requireSales(): Promise<
  { supabase: SupabaseClient; user: User } | { error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı." };
  const { data: profil } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (!canSeeSales((profil as { role?: string } | null)?.role)) {
    return { error: "Bu işlem için yetkiniz yok." };
  }
  return { supabase, user };
}

function tazele() {
  revalidatePath("/sales/faturalar");
}

export async function createSalesInvoice(
  input: CreateInvoiceInput
): Promise<SalesInvoiceActionResult> {
  const ctx = await requireSales();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, user } = ctx;

  const parsed = createInvoiceSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const v = parsed.data;

  const { error } = await supabase.from("sales_invoices").insert({
    item_no: v.itemNo,
    invoice_year: Number(v.invoiceDate.slice(0, 4)),
    invoice_date: v.invoiceDate,
    invoice_no: v.invoiceNo,
    customer: adBuyuk(v.customer),
    customer_id: v.customerId,
    qty: v.qty,
    unit_price: v.unitPrice,
    currency: v.currency,
    fx_rate: v.currency === "EUR" ? 1 : v.fxRate,
    note: v.note,
    source: "app",
    created_by: user.id,
  });
  if (error) return { error: error.message };
  tazele();
  return { ok: 1 };
}

export async function editSalesInvoice(input: EditInvoiceInput): Promise<SalesInvoiceActionResult> {
  const ctx = await requireSales();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase } = ctx;

  const parsed = editInvoiceSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const v = parsed.data;

  const { error } = await supabase
    .from("sales_invoices")
    .update({
      item_no: v.itemNo,
      invoice_year: Number(v.invoiceDate.slice(0, 4)),
      invoice_date: v.invoiceDate,
      invoice_no: v.invoiceNo,
      customer: adBuyuk(v.customer),
      customer_id: v.customerId,
      qty: v.qty,
      unit_price: v.unitPrice,
      currency: v.currency,
      fx_rate: v.currency === "EUR" ? 1 : v.fxRate,
      note: v.note,
    })
    .eq("id", v.id);
  if (error) return { error: error.message };
  tazele();
  return { ok: 1 };
}

export async function deleteSalesInvoice(id: string): Promise<SalesInvoiceActionResult> {
  const ctx = await requireSales();
  if ("error" in ctx) return { error: ctx.error };
  const parsed = deleteInvoiceSchema.safeParse({ id });
  if (!parsed.success) return { error: "Geçersiz fatura." };
  const { error } = await ctx.supabase.from("sales_invoices").delete().eq("id", id);
  if (error) return { error: error.message };
  tazele();
  return { ok: 1 };
}

/**
 * Fatura ekranından yeni müşteri açar — YÖNETİM MÜŞTERİLER'e girer (kullanıcı
 * kararı, 14.08.2026). Kısaltma ve renk trigger'la atanır; geri okunup döner ki
 * dropdown anında güncellensin. Ad BÜYÜK HARF (md. 14).
 */
export async function createInvoiceCustomer(
  input: CreateInvoiceCustomerInput
): Promise<SalesInvoiceActionResult> {
  const ctx = await requireSales();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, user } = ctx;

  const parsed = createInvoiceCustomerSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const ad = adBuyuk(parsed.data.name.trim());

  const { data, error } = await supabase
    .from("customers")
    .insert({ name: ad, created_by: user.id })
    .select("id, name, short_name, color_hue")
    .maybeSingle();
  if (error) {
    return { error: error.code === "23505" ? "Bu müşteri zaten defterde." : error.message };
  }
  const c = data as { id: string; name: string; short_name: string | null; color_hue: number | null };
  revalidatePath("/sales/faturalar");
  revalidatePath("/admin/customers");
  return {
    ok: 1,
    customer: { id: c.id, name: c.name, short: c.short_name ?? null, hue: c.color_hue ?? null },
  };
}
