"use server";

// Satış Takibi server action'ları.
//
// Yetki İKİ KEZ sorulur: burada net bir hata mesajı üretmek için, RLS'te ise
// asıl engel olarak. Arayüzden gizlemek tek başına yeterli değildir — sayfa
// adresi doğrudan yazılabilir.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { canSeeSales } from "@/lib/roles";
import { saleInputSchema, type SaleInput } from "./schema";

export type SalesActionResult = { error?: string; ok?: boolean };

async function requireSalesAccess() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı" } as const;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (!canSeeSales(profile?.role)) {
    return { error: "Satış bilgilerine yalnız Yönetici ve Müdür erişebilir" } as const;
  }
  return { supabase, user } as const;
}

/**
 * Kalemin ticari kaydını yazar. Kayıt yoksa açar, varsa günceller —
 * `job_item_id` ünik olduğu için tek `upsert` yeter; satırların önceden
 * üretilmesine gerek kalmaz.
 */
export async function saveSale(
  jobItemId: string,
  input: SaleInput
): Promise<SalesActionResult> {
  const ctx = await requireSalesAccess();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, user } = ctx;

  const parsed = saleInputSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  // Avro satırında kur her zaman 1'dir; kullanıcı başka bir şey yazmışsa bile
  // avro karşılığı bozulmasın diye burada sabitlenir.
  const data = { ...parsed.data };
  if (data.currency === "EUR") data.fx_rate = 1;

  // Fiyat girilmişse kur ZORUNLUDUR: kuru olmayan satır avro toplamına
  // giremez ve sessizce ciro dışında kalırdı.
  if (data.unit_price !== null && data.fx_rate === null) {
    return { error: "Fiyat girilen satırda kur da girilmelidir." };
  }

  const { error } = await supabase.from("job_item_sales").upsert(
    { job_item_id: jobItemId, ...data, updated_by: user.id },
    { onConflict: "job_item_id" }
  );
  if (error) return { error: error.message };

  await supabase.from("audit_log").insert({
    actor: user.id,
    action: "sales.save",
    detail: { job_item_id: jobItemId, currency: data.currency, unit_price: data.unit_price },
  });

  revalidatePath("/sales");
  return { ok: true };
}

/** Kalemin ticari kaydını tamamen siler (fiyat girilmemiş hâline döner). */
export async function clearSale(jobItemId: string): Promise<SalesActionResult> {
  const ctx = await requireSalesAccess();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, user } = ctx;

  const { error } = await supabase
    .from("job_item_sales")
    .delete()
    .eq("job_item_id", jobItemId);
  if (error) return { error: error.message };

  await supabase.from("audit_log").insert({
    actor: user.id,
    action: "sales.clear",
    detail: { job_item_id: jobItemId },
  });

  revalidatePath("/sales");
  return { ok: true };
}
