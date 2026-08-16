"use server";

// Kayıtlı görünüm CRUD'u. Uygulama (adrese yazma) İSTEMCİDEDİR; buradaki
// yol yalnız defteri yazar. `config` KAYDEDİLMEDEN ÖNCE şemadan geçirilir —
// bozuk bir görünüm hiç yazılmaz, okuma tarafı da ayrıca doğrular.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  savedViewConfigSchema,
  type SavedViewConfig,
} from "@/lib/jobs/view-state";

export type ViewActionResult = { error?: string };

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı" as const };
  return { supabase, user };
}

export async function createSavedView(
  name: string,
  config: SavedViewConfig,
  isDefault: boolean
): Promise<ViewActionResult> {
  const ctx = await requireUser();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, user } = ctx;

  const ad = name.trim();
  if (!ad) return { error: "Görünüm adı gerekli" };
  if (ad.length > 60) return { error: "Ad 60 karakteri aşamaz" };

  const parsed = savedViewConfigSchema.safeParse(config);
  if (!parsed.success) return { error: "Görünüm durumu okunamadı" };

  // Varsayılan TEK olabilir (kısmi tekil indeks): önce eski varsayılan
  // düşürülür — oku-sonra-yaz, çakışan upsert indeksle çarpışırdı.
  if (isDefault) {
    await supabase
      .from("user_saved_views")
      .update({ is_default: false })
      .eq("user_id", user.id)
      .eq("is_default", true);
  }

  const { data: son } = await supabase
    .from("user_saved_views")
    .select("sort")
    .eq("user_id", user.id)
    .order("sort", { ascending: false })
    .limit(1)
    .maybeSingle();
  const sort = ((son as { sort?: number } | null)?.sort ?? -1) + 1;

  const { error } = await supabase.from("user_saved_views").insert({
    user_id: user.id,
    name: ad,
    config: parsed.data,
    is_default: isDefault,
    sort,
  });
  if (error) return { error: error.message };

  revalidatePath("/jobs");
  return {};
}

export async function setDefaultSavedView(
  id: string,
  on: boolean
): Promise<ViewActionResult> {
  const ctx = await requireUser();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, user } = ctx;

  if (on) {
    await supabase
      .from("user_saved_views")
      .update({ is_default: false })
      .eq("user_id", user.id)
      .eq("is_default", true);
  }
  const { error } = await supabase
    .from("user_saved_views")
    .update({ is_default: on })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { error: error.message };

  revalidatePath("/jobs");
  return {};
}

export async function deleteSavedView(id: string): Promise<ViewActionResult> {
  const ctx = await requireUser();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, user } = ctx;

  const { error } = await supabase
    .from("user_saved_views")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { error: error.message };

  revalidatePath("/jobs");
  return {};
}
