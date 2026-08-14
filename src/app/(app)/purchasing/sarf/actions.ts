"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { canEditConsumableExpenses } from "@/lib/roles";
import { adBuyuk } from "@/lib/tr-text";
import { consumableMatchKey } from "@/lib/purchasing/consumable-key";
import { kurOnerisi } from "@/lib/purchasing/kur";
import {
  createConsumableExpenseSchema,
  deleteConsumableExpenseSchema,
  ensureConsumableItemSchema,
  expenseRateSchema,
  updateConsumableExpenseSchema,
  type ConsumableActionResult,
  type CreateConsumableExpenseInput,
  type EnsureConsumableItemInput,
  type UpdateConsumableExpenseInput,
} from "./schema";

type WriteContext = { supabase: SupabaseClient; userId: string };

async function requireWrite(): Promise<WriteContext | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (!canEditConsumableExpenses(profile?.role)) {
    return { error: "Sarf giderlerini yalnız Yönetici ve Satın Alma düzenleyebilir." };
  }
  return { supabase, userId: user.id };
}

function refreshConsumables() {
  revalidatePath("/purchasing/sarf");
  revalidatePath("/purchasing/sarf/kayitlar");
  revalidatePath("/purchasing/sarf/analiz");
  revalidatePath("/admin/consumables");
  revalidatePath("/admin/suppliers");
  revalidatePath("/purchasing/odemeler");
}

async function audit(
  supabase: SupabaseClient,
  actor: string,
  action: string,
  detail: Record<string, unknown>
) {
  await supabase.from("audit_log").insert({ project_id: null, actor, action, detail });
}

type ItemSnapshot = {
  id: string;
  code: string;
  name: string;
  group_name: string;
  active: boolean;
};

type SupplierSnapshot = { id: string; name: string; active: boolean };

async function readSupplier(
  supabase: SupabaseClient,
  id: string
): Promise<SupplierSnapshot | null> {
  const { data } = await supabase
    .from("purchase_suppliers")
    .select("id, name, active")
    .eq("id", id)
    .maybeSingle();
  return (data as SupplierSnapshot | null) ?? null;
}

async function readItems(
  supabase: SupabaseClient,
  ids: string[]
): Promise<Map<string, ItemSnapshot>> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map();
  const { data } = await supabase
    .from("purchase_consumable_items")
    .select("id, code, name, group_name, active")
    .in("id", unique);
  return new Map(((data ?? []) as ItemSnapshot[]).map((row) => [row.id, row]));
}

function databaseError(message: string): string {
  if (message.includes("purchase_consumable_expense_source_ref")) {
    return "Bu devralınan kayıt daha önce aktarılmış.";
  }
  if (message.includes("fx_rate") || message.includes("currency")) {
    return "Para birimi ve kur bilgisi birbiriyle uyumlu değil.";
  }
  return message;
}

export async function createConsumableExpenses(
  input: CreateConsumableExpenseInput
): Promise<ConsumableActionResult> {
  const ctx = await requireWrite();
  if ("error" in ctx) return { error: ctx.error };
  const parsed = createConsumableExpenseSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Geçersiz kayıt." };
  const value = parsed.data;

  const [supplier, items] = await Promise.all([
    readSupplier(ctx.supabase, value.supplierId),
    readItems(ctx.supabase, value.lines.map((line) => line.itemId)),
  ]);
  if (!supplier) return { error: "Tedarikçi defterde bulunamadı." };
  const missing = value.lines.find((line) => !items.has(line.itemId));
  if (missing) return { error: "Seçilen sarf malzemelerinden biri defterde bulunamadı." };

  const fxRate = value.currency === "EUR" ? 1 : value.fxRate;
  const paymentGroupId = crypto.randomUUID();
  const paymentDueAt = new Date(`${value.dueAt}T00:00:00`);
  paymentDueAt.setDate(paymentDueAt.getDate() + value.paymentTermDays);
  const paymentDueIso = `${paymentDueAt.getFullYear()}-${String(paymentDueAt.getMonth() + 1).padStart(2, "0")}-${String(paymentDueAt.getDate()).padStart(2, "0")}`;
  const payload = value.lines.map((line) => {
    const item = items.get(line.itemId)!;
    return {
      expense_date: value.expenseDate,
      item_id: item.id,
      item_code: item.code,
      item_name: item.name,
      group_name: item.group_name,
      supplier_id: supplier.id,
      supplier_name: supplier.name,
      document_no: value.documentNo || null,
      department: value.department || null,
      quantity: line.quantity,
      unit: line.unit,
      unit_price: line.unitPrice,
      amount: line.quantity * line.unitPrice,
      vat_rate: line.vatRate,
      payment_group_id: paymentGroupId,
      due_at: value.dueAt,
      payment_method: value.paymentMethod,
      payment_term_days: value.paymentTermDays,
      payment_due_at: paymentDueIso,
      currency: value.currency,
      fx_rate: fxRate,
      fx_rate_date: value.currency === "EUR" ? null : value.fxRateDate,
      fx_source: value.currency === "EUR" ? "daily" : value.fxSource,
      note: [value.note, line.note].filter(Boolean).join(" · ") || null,
      source: "app",
      created_by: ctx.userId,
      updated_by: ctx.userId,
    };
  });

  const { data, error } = await ctx.supabase
    .from("purchase_consumable_expenses")
    .insert(payload)
    .select("id, amount_eur");
  if (error) return { error: databaseError(error.message) };

  const rows = (data ?? []) as { id: string; amount_eur: number | null }[];
  await audit(ctx.supabase, ctx.userId, "purchase.consumable_expense_create", {
    ids: rows.map((row) => row.id),
    count: rows.length,
    expense_date: value.expenseDate,
    supplier_id: supplier.id,
    supplier_name: supplier.name,
    amount_eur: rows.reduce((sum, row) => sum + Number(row.amount_eur ?? 0), 0),
  });
  refreshConsumables();
  return { ok: rows.length, id: rows[0]?.id };
}

export async function updateConsumableExpense(
  input: UpdateConsumableExpenseInput
): Promise<ConsumableActionResult> {
  const ctx = await requireWrite();
  if ("error" in ctx) return { error: ctx.error };
  const parsed = updateConsumableExpenseSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Geçersiz kayıt." };
  const value = parsed.data;

  const [supplier, items] = await Promise.all([
    readSupplier(ctx.supabase, value.supplierId),
    readItems(ctx.supabase, [value.line.itemId]),
  ]);
  const item = items.get(value.line.itemId);
  if (!supplier) return { error: "Tedarikçi defterde bulunamadı." };
  if (!item) return { error: "Sarf malzeme defterde bulunamadı." };

  const { data: before } = await ctx.supabase
    .from("purchase_consumable_expenses")
    .select("id, expense_date, item_name, supplier_name, amount_eur, source, source_ref")
    .eq("id", value.id)
    .maybeSingle();
  if (!before) return { error: "Sarf gideri bulunamadı." };

  const fxRate = value.currency === "EUR" ? 1 : value.fxRate;
  const { error } = await ctx.supabase
    .from("purchase_consumable_expenses")
    .update({
      expense_date: value.expenseDate,
      item_id: item.id,
      item_code: item.code,
      item_name: item.name,
      group_name: item.group_name,
      supplier_id: supplier.id,
      supplier_name: supplier.name,
      document_no: value.documentNo || null,
      department: value.department || null,
      quantity: value.line.quantity,
      unit: value.line.unit,
      unit_price: value.line.unitPrice,
      amount: value.line.quantity * value.line.unitPrice,
      currency: value.currency,
      fx_rate: fxRate,
      fx_rate_date: value.currency === "EUR" ? null : value.fxRateDate,
      fx_source: value.currency === "EUR" ? "daily" : value.fxSource,
      note: [value.note, value.line.note].filter(Boolean).join(" · ") || null,
      updated_by: ctx.userId,
    })
    .eq("id", value.id);
  if (error) return { error: databaseError(error.message) };

  await audit(ctx.supabase, ctx.userId, "purchase.consumable_expense_update", {
    id: value.id,
    before,
    expense_date: value.expenseDate,
    item_name: item.name,
    supplier_name: supplier.name,
  });
  refreshConsumables();
  return { ok: 1, id: value.id };
}

export async function deleteConsumableExpense(input: {
  id: string;
}): Promise<ConsumableActionResult> {
  const ctx = await requireWrite();
  if ("error" in ctx) return { error: ctx.error };
  const parsed = deleteConsumableExpenseSchema.safeParse(input);
  if (!parsed.success) return { error: "Geçersiz sarf gideri." };

  const { data: before } = await ctx.supabase
    .from("purchase_consumable_expenses")
    .select("id, expense_date, item_name, supplier_name, amount_eur, source, source_ref")
    .eq("id", parsed.data.id)
    .maybeSingle();
  if (!before) return { error: "Sarf gideri bulunamadı." };

  const { error } = await ctx.supabase
    .from("purchase_consumable_expenses")
    .delete()
    .eq("id", parsed.data.id);
  if (error) return { error: databaseError(error.message) };

  await audit(ctx.supabase, ctx.userId, "purchase.consumable_expense_delete", before);
  refreshConsumables();
  return { ok: 1 };
}

export async function updateConsumablePaymentPaidAt(input: {
  paymentGroupId: string;
  paidAt: string;
}): Promise<ConsumableActionResult> {
  const ctx = await requireWrite();
  if ("error" in ctx) return { error: ctx.error };
  const parsed = z.object({
    paymentGroupId: z.uuid(),
    paidAt: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]),
  }).safeParse(input);
  if (!parsed.success) return { error: "Geçersiz ödeme bilgisi." };
  const { data, error } = await ctx.supabase
    .from("purchase_consumable_expenses")
    .update({ payment_paid_at: parsed.data.paidAt || null, updated_by: ctx.userId })
    .eq("payment_group_id", parsed.data.paymentGroupId)
    .select("id");
  if (error) return { error: databaseError(error.message) };
  if (!data?.length) return { error: "Sarf ödeme fişi bulunamadı." };
  await audit(ctx.supabase, ctx.userId, "purchase.consumable_payment_paid", {
    payment_group_id: parsed.data.paymentGroupId,
    paid_at: parsed.data.paidAt || null,
  });
  refreshConsumables();
  return { ok: data.length };
}

export async function ensureConsumableItem(
  input: EnsureConsumableItemInput
): Promise<
  ConsumableActionResult & {
    code?: string;
    name?: string;
    groupName?: string;
    defaultUnit?: string;
  }
> {
  const ctx = await requireWrite();
  if ("error" in ctx) return { error: ctx.error };
  const parsed = ensureConsumableItemSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Geçersiz malzeme." };

  const name = adBuyuk(parsed.data.name);
  const matchKey = consumableMatchKey(name);
  const existing = await ctx.supabase
    .from("purchase_consumable_items")
    .select("id, code, name, group_name, default_unit")
    .eq("match_key", matchKey)
    .maybeSingle();
  if (existing.data) {
    const row = existing.data as {
      id: string;
      code: string;
      name: string;
      group_name: string;
      default_unit: string | null;
    };
    return {
      ok: 0,
      id: row.id,
      code: row.code,
      name: row.name,
      groupName: row.group_name,
      defaultUnit: row.default_unit ?? "Adet",
    };
  }

  const { data, error } = await ctx.supabase
    .from("purchase_consumable_items")
    .insert({
      name,
      match_key: matchKey,
      group_name: parsed.data.groupName,
      default_unit: parsed.data.defaultUnit,
      created_by: ctx.userId,
      updated_by: ctx.userId,
    })
    .select("id, code, name, group_name, default_unit")
    .maybeSingle();
  if (error) {
    const retry = await ctx.supabase
      .from("purchase_consumable_items")
      .select("id, code, name, group_name, default_unit")
      .eq("match_key", matchKey)
      .maybeSingle();
    if (!retry.data) return { error: databaseError(error.message) };
    const row = retry.data as {
      id: string;
      code: string;
      name: string;
      group_name: string;
      default_unit: string | null;
    };
    return {
      ok: 0,
      id: row.id,
      code: row.code,
      name: row.name,
      groupName: row.group_name,
      defaultUnit: row.default_unit ?? "Adet",
    };
  }

  const row = data as {
    id: string;
    code: string;
    name: string;
    group_name: string;
    default_unit: string | null;
  } | null;
  if (!row) return { error: "Malzeme kaydedildi ancak kimliği okunamadı." };
  await audit(ctx.supabase, ctx.userId, "purchase.consumable_item_create", {
    id: row.id,
    code: row.code,
    name: row.name,
    group_name: row.group_name,
  });
  refreshConsumables();
  return {
    ok: 1,
    id: row.id,
    code: row.code,
    name: row.name,
    groupName: row.group_name,
    defaultUnit: row.default_unit ?? "Adet",
  };
}

export async function getConsumableExpenseRate(input: {
  expenseDate: string;
  currency: "EUR" | "TRY" | "USD";
}): Promise<{ error?: string; rate?: number; rateDate?: string; source?: "daily" }> {
  const ctx = await requireWrite();
  if ("error" in ctx) return { error: ctx.error };
  const parsed = expenseRateSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Geçersiz kur isteği." };
  if (parsed.data.currency === "EUR") return { rate: 1, source: "daily" };

  const { data, error } = await ctx.supabase
    .from("fx_rate_daily")
    .select("rate_date, usd_try, eur_try")
    .lte("rate_date", parsed.data.expenseDate)
    .order("rate_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return { error: "Bu tarihten önce yayımlanmış kur bulunamadı." };
  const row = data as { rate_date: string; usd_try: number | null; eur_try: number | null };
  const suggestion = kurOnerisi(parsed.data.currency, {
    rateDate: row.rate_date,
    usdTry: Number(row.usd_try ?? 0),
    eurTry: Number(row.eur_try ?? 0),
  });
  if (!suggestion) return { error: "Seçilen para birimi için kur hesaplanamadı." };
  return { rate: suggestion.kur, rateDate: suggestion.gun, source: "daily" };
}
