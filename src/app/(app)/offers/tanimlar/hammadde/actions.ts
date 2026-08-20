"use server";

// GLOBAL HAMMADDE FİYAT DEFTERİ — yeni maliyet çalışmalarının açılış kopyası.

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { MATERIAL_PRICE_DEFS } from "@/lib/offers/cost/registry";

export type MaterialPriceActionResult = { ok?: boolean; error?: string };

const schema = z.object({
  prices: z.record(
    z.string(),
    z.number().finite().min(0, "Fiyat negatif olamaz.").max(1_000_000).nullable()
  ),
});

export async function saveCostMaterialPrices(input: {
  prices: Record<string, number | null>;
}): Promise<MaterialPriceActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı." };

  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const rows = MATERIAL_PRICE_DEFS.map((def, index) => ({
    key: def.key,
    label: def.label,
    unit: def.unit,
    unit_price: parsed.data.prices[def.key] ?? null,
    sort: (index + 1) * 10,
    active: true,
    updated_by: user.id,
  }));
  const { data, error } = await supabase
    .from("offer_cost_material_prices")
    .upsert(rows, { onConflict: "key" })
    .select("key");
  if (error) return { error: error.message };
  if (!data || data.length !== rows.length) {
    return { error: "Hammadde fiyatlarını düzenleme yetkisi gerekir." };
  }

  await supabase.from("audit_log").insert({
    project_id: null,
    actor: user.id,
    action: "offer.cost_material_prices_save",
    detail: { keys: rows.map((row) => row.key) },
  });

  revalidatePath("/offers/tanimlar/hammadde");
  revalidatePath("/offers");
  return { ok: true };
}
