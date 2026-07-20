"use server";

// Yönetim paneli server action'ları. Tüm yazma işlemleri:
// 1) sunucuda admin rol kontrolü (RLS zaten admin ister; burada net hata mesajı için)
// 2) audit_log kaydı (project_id null — proje bağımsız yönetim işlemi)

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { ReportSettings } from "@/lib/settings";

export type AdminActionResult = { error?: string; ok?: boolean };

type AdminContext = { supabase: SupabaseClient; user: User };

async function requireAdmin(): Promise<AdminContext | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") return { error: "Bu işlem için admin yetkisi gerekir" };

  return { supabase, user };
}

async function audit(
  supabase: SupabaseClient,
  actorId: string,
  action: string,
  detail: Record<string, unknown>
) {
  await supabase.from("audit_log").insert({
    project_id: null,
    actor: actorId,
    action,
    detail,
  });
}

// ------------------------------------------------------------------ Kullanıcılar

const userSchema = z.object({
  role: z.enum(["admin", "engineer"]),
  title: z.string().trim().max(120),
});

export async function updateUserProfile(
  userId: string,
  input: { role: "admin" | "engineer"; title: string }
): Promise<AdminActionResult> {
  const ctx = await requireAdmin();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, user } = ctx;

  const parsed = userSchema.safeParse(input);
  if (!parsed.success) return { error: "Geçersiz kullanıcı bilgisi" };

  const { data: target } = await supabase
    .from("profiles")
    .select("id, full_name, role, title")
    .eq("id", userId)
    .single();
  if (!target) return { error: "Kullanıcı bulunamadı" };

  // Son admin korunur: sistemde tek admin varsa rolü düşürülemez.
  if (target.role === "admin" && parsed.data.role === "engineer") {
    const { count } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin");
    if ((count ?? 0) <= 1) {
      return { error: "Sistemdeki son admin rolü düşürülemez. Önce başka bir admin atayın." };
    }
  }

  const { error } = await supabase
    .from("profiles")
    .update({ role: parsed.data.role, title: parsed.data.title })
    .eq("id", userId);
  if (error) return { error: error.message };

  await audit(supabase, user.id, "admin.user_update", {
    target_id: userId,
    target_name: target.full_name,
    role: parsed.data.role,
    title: parsed.data.title,
  });

  revalidatePath("/admin/users");
  return { ok: true };
}

// ---------------------------------------------------------------- Ekipman katalogu

const KINDS = ["motor", "gearbox", "rope", "brake", "bearing", "wheel", "buffer", "hook", "sheave", "coupling", "other"] as const;

const equipmentSchema = z.object({
  kind: z.enum(KINDS),
  brand: z.string().trim().min(1, "Marka gerekli"),
  model: z.string().trim().min(1, "Model gerekli"),
  notes: z.string().trim(),
  datasheet_url: z.string().trim().optional().default(""),
  active: z.boolean(),
  sort: z.number().int(),
  attrs: z.record(z.string(), z.union([z.string(), z.number()])),
});

export type EquipmentInput = z.infer<typeof equipmentSchema>;

export async function createEquipment(input: EquipmentInput): Promise<AdminActionResult> {
  const ctx = await requireAdmin();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, user } = ctx;

  const parsed = equipmentSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { data, error } = await supabase
    .from("cat_equipment")
    .insert(parsed.data)
    .select("id")
    .single();
  if (error) return { error: error.message };

  await audit(supabase, user.id, "admin.equipment_create", {
    id: data.id,
    kind: parsed.data.kind,
    brand: parsed.data.brand,
    model: parsed.data.model,
  });

  revalidatePath("/admin/equipment");
  return { ok: true };
}

export async function updateEquipment(
  id: string,
  input: EquipmentInput
): Promise<AdminActionResult> {
  const ctx = await requireAdmin();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, user } = ctx;

  const parsed = equipmentSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { error } = await supabase.from("cat_equipment").update(parsed.data).eq("id", id);
  if (error) return { error: error.message };

  await audit(supabase, user.id, "admin.equipment_update", {
    id,
    kind: parsed.data.kind,
    brand: parsed.data.brand,
    model: parsed.data.model,
  });

  revalidatePath("/admin/equipment");
  return { ok: true };
}

export async function deleteEquipment(id: string): Promise<AdminActionResult> {
  const ctx = await requireAdmin();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, user } = ctx;

  const { data: item } = await supabase
    .from("cat_equipment")
    .select("kind, brand, model")
    .eq("id", id)
    .single();

  const { error } = await supabase.from("cat_equipment").delete().eq("id", id);
  if (error) return { error: error.message };

  await audit(supabase, user.id, "admin.equipment_delete", {
    id,
    kind: item?.kind,
    brand: item?.brand,
    model: item?.model,
  });

  revalidatePath("/admin/equipment");
  return { ok: true };
}

// ----------------------------------------------------------------- Kaplin katalogu

const couplingSchema = z.object({
  coupling_type: z.enum(["drum", "brake", "gear"]),
  brand: z.string().trim().min(1, "Marka gerekli"),
  series: z.string().trim().min(1, "Seri gerekli"),
  model: z.string().trim().min(1, "Model gerekli"),
  dmax: z.number().positive("dmax pozitif olmalı"),
  t_nominal: z.number().positive("Nominal tork pozitif olmalı"),
  radial_load: z.number().positive().nullable(),
  sort: z.number().int(),
});

export type CouplingInput = z.infer<typeof couplingSchema>;

export async function createCoupling(input: CouplingInput): Promise<AdminActionResult> {
  const ctx = await requireAdmin();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, user } = ctx;

  const parsed = couplingSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { data, error } = await supabase
    .from("cat_couplings")
    .insert(parsed.data)
    .select("id")
    .single();
  if (error) {
    return {
      error: error.code === "23505" ? "Bu kaplin zaten kayıtlı (tip+marka+seri+model)" : error.message,
    };
  }

  await audit(supabase, user.id, "admin.coupling_create", {
    id: data.id,
    coupling_type: parsed.data.coupling_type,
    brand: parsed.data.brand,
    model: parsed.data.model,
  });

  revalidatePath("/admin/couplings");
  return { ok: true };
}

export async function updateCoupling(
  id: number,
  input: CouplingInput
): Promise<AdminActionResult> {
  const ctx = await requireAdmin();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, user } = ctx;

  const parsed = couplingSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { error } = await supabase.from("cat_couplings").update(parsed.data).eq("id", id);
  if (error) return { error: error.message };

  await audit(supabase, user.id, "admin.coupling_update", {
    id,
    coupling_type: parsed.data.coupling_type,
    brand: parsed.data.brand,
    model: parsed.data.model,
  });

  revalidatePath("/admin/couplings");
  return { ok: true };
}

export async function deleteCoupling(id: number): Promise<AdminActionResult> {
  const ctx = await requireAdmin();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, user } = ctx;

  const { data: item } = await supabase
    .from("cat_couplings")
    .select("coupling_type, brand, series, model")
    .eq("id", id)
    .single();

  const { error } = await supabase.from("cat_couplings").delete().eq("id", id);
  if (error) return { error: error.message };

  await audit(supabase, user.id, "admin.coupling_delete", { id, ...item });

  revalidatePath("/admin/couplings");
  return { ok: true };
}

// ------------------------------------------------------------------------ Raylar

const railSchema = z.object({
  code: z.string().trim().min(1, "Ray kodu gerekli"),
  radius: z.number().positive().nullable(),
  head_width: z.number().positive("Temas genişliği pozitif olmalı"),
  sort: z.number().int(),
});

export type RailInput = z.infer<typeof railSchema>;

export async function createRail(input: RailInput): Promise<AdminActionResult> {
  const ctx = await requireAdmin();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, user } = ctx;

  const parsed = railSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { error } = await supabase.from("cat_rails").insert(parsed.data);
  if (error) {
    return { error: error.code === "23505" ? "Bu ray kodu zaten kayıtlı" : error.message };
  }

  await audit(supabase, user.id, "admin.rail_create", { code: parsed.data.code });

  revalidatePath("/admin/rails");
  return { ok: true };
}

export async function updateRail(code: string, input: RailInput): Promise<AdminActionResult> {
  const ctx = await requireAdmin();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, user } = ctx;

  const parsed = railSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { error } = await supabase
    .from("cat_rails")
    .update({ radius: parsed.data.radius, head_width: parsed.data.head_width, sort: parsed.data.sort })
    .eq("code", code);
  if (error) return { error: error.message };

  await audit(supabase, user.id, "admin.rail_update", { code });

  revalidatePath("/admin/rails");
  return { ok: true };
}

export async function deleteRail(code: string): Promise<AdminActionResult> {
  const ctx = await requireAdmin();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, user } = ctx;

  const { error } = await supabase.from("cat_rails").delete().eq("code", code);
  if (error) return { error: error.message };

  await audit(supabase, user.id, "admin.rail_delete", { code });

  revalidatePath("/admin/rails");
  return { ok: true };
}

// ----------------------------------------------------------------- Rapor ayarları

const settingsSchema = z.object({
  company: z.string().trim().min(1, "Firma adı gerekli"),
  city: z.string().trim().min(1, "Şehir gerekli"),
  title_tr: z.string().trim().min(1, "Türkçe başlık gerekli"),
  title_en: z.string().trim().min(1, "İngilizce başlık gerekli"),
  default_crane_type: z.string().trim().min(1, "Varsayılan vinç tipi gerekli"),
  address: z.string().trim().optional().default(""),
  phone: z.string().trim().optional().default(""),
  email: z.string().trim().optional().default(""),
  web: z.string().trim().optional().default(""),
});

export async function updateReportSettings(
  input: ReportSettings
): Promise<AdminActionResult> {
  const ctx = await requireAdmin();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, user } = ctx;

  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { error } = await supabase.from("app_settings").upsert({
    key: "report",
    value: parsed.data,
    updated_at: new Date().toISOString(),
    updated_by: user.id,
  });
  if (error) return { error: error.message };

  await audit(supabase, user.id, "admin.settings_update", { key: "report", ...parsed.data });

  revalidatePath("/admin/settings");
  revalidatePath("/projects");
  return { ok: true };
}
