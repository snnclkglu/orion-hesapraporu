"use server";

// Görev şablonu defteri — yönetici yazar (RLS: is_admin), İşler'deki
// "Şablondan Ekle" okur. Yetkisiz çağrı sessiz kalmasın diye yazmalarda
// satır sayısı okunur (deleteJob kalıbı).

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type TemplateActionResult = { error?: string };

function tazele() {
  revalidatePath("/admin/task-templates");
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı" as const };
  return { supabase, user };
}

export async function createTemplate(title: string): Promise<TemplateActionResult> {
  const ctx = await requireUser();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase } = ctx;

  const v = title.trim();
  if (!v) return { error: "Madde boş olamaz" };
  if (v.length > 200) return { error: "Madde 200 karakteri aşamaz" };

  const { data: son } = await supabase
    .from("job_task_templates")
    .select("sort")
    .order("sort", { ascending: false })
    .limit(1)
    .maybeSingle();
  const sort = ((son as { sort?: number } | null)?.sort ?? -1) + 1;

  const { error } = await supabase
    .from("job_task_templates")
    .insert({ title: v, sort });
  if (error) return { error: error.message };

  tazele();
  return {};
}

export async function renameTemplate(
  id: string,
  title: string
): Promise<TemplateActionResult> {
  const ctx = await requireUser();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase } = ctx;

  const v = title.trim();
  if (!v) return { error: "Madde boş olamaz" };

  const { data, error } = await supabase
    .from("job_task_templates")
    .update({ title: v })
    .eq("id", id)
    .select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "Şablon yazımı yöneticiye açıktır." };

  tazele();
  return {};
}

export async function toggleTemplate(
  id: string,
  active: boolean
): Promise<TemplateActionResult> {
  const ctx = await requireUser();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase } = ctx;

  const { data, error } = await supabase
    .from("job_task_templates")
    .update({ active })
    .eq("id", id)
    .select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "Şablon yazımı yöneticiye açıktır." };

  tazele();
  return {};
}

export async function deleteTemplate(id: string): Promise<TemplateActionResult> {
  const ctx = await requireUser();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase } = ctx;

  const { data, error } = await supabase
    .from("job_task_templates")
    .delete()
    .eq("id", id)
    .select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "Şablon yazımı yöneticiye açıktır." };

  tazele();
  return {};
}

/** Maddeyi bir üst/alt komşusuyla yer değiştirir (sort takası). */
export async function moveTemplate(
  id: string,
  dir: -1 | 1
): Promise<TemplateActionResult> {
  const ctx = await requireUser();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase } = ctx;

  const { data: rows, error } = await supabase
    .from("job_task_templates")
    .select("id, sort")
    .order("sort", { ascending: true });
  if (error) return { error: error.message };

  const liste = (rows ?? []) as { id: string; sort: number }[];
  const i = liste.findIndex((r) => r.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= liste.length) return {};

  const a = liste[i];
  const b = liste[j];
  const { error: e1 } = await supabase
    .from("job_task_templates")
    .update({ sort: b.sort })
    .eq("id", a.id);
  if (e1) return { error: e1.message };
  const { error: e2 } = await supabase
    .from("job_task_templates")
    .update({ sort: a.sort })
    .eq("id", b.id);
  if (e2) return { error: e2.message };

  tazele();
  return {};
}
