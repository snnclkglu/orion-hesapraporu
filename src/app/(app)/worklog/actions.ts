"use server";

// İş Takibi server action'ları.
//
// Yetki İKİ KEZ sorulur: burada net bir hata mesajı üretmek için, RLS'te ise
// asıl engel olarak. Menüden gizlemek tek başına yeterli değildir — sayfa
// adresi doğrudan yazılabilir.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { canSeeWorkLog } from "@/lib/roles";
import { nextDistinctHue } from "@/lib/tags";
import { resolveItemNo } from "@/lib/job-items";
import {
  remapItemSchema,
  workCategorySchema,
  workDaySchema,
  workLogRowSchema,
  workPartSchema,
  type WorkDayInput,
  type WorkLogRowInput,
} from "./schema";

export type WorkLogActionResult = { error?: string; ok?: boolean };

async function requireWorkLogAccess() {
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
  if (!canSeeWorkLog(profile?.role)) {
    return { error: "İş Takibi'ne yalnız Yönetici ve Müdür erişebilir" } as const;
  }
  return { supabase, user } as const;
}

/**
 * Kalem numarasını iş kalemine ve işe çözer.
 *
 * ÜÇ KADEME: (1) numaranın birebir karşılığı olan iş kalemi, (2) yoksa
 * numaranın kökündeki iş (0057-00 → 0057), (3) o da yoksa bağlantısız.
 * Metin her hâlükârda saklanır — bağlantı kurulamadı diye kayıt reddedilmez;
 * atölye kaydı sistemdeki numaralandırmayı beklemek zorunda değildir.
 */

/**
 * Bir günün kayıtlarını bir bütün olarak yazar.
 *
 * Ekran günü tek bir çizelge olarak düzenler, bu yüzden kayıt da tek işlemde
 * olur. Satırlar KİMLİKLERİYLE eşlenir: kalanlar güncellenir, yenileri
 * eklenir, ekrandan silinenler veritabanından da silinir. Günü silip yeniden
 * yazmak daha kısa olurdu ama her kaydetmede `created_at`/`created_by`
 * bilgisini yok eder ve kimin ne zaman girdiğini kaybederdik.
 */
export async function saveWorkDay(input: WorkDayInput): Promise<WorkLogActionResult> {
  const ctx = await requireWorkLogAccess();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, user } = ctx;

  const parsed = workDaySchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { date, rows } = parsed.data;

  // Kalem numarası çözümlemesi satır başına DEĞİL, farklı numara başına
  // yapılır: aynı gün on satır aynı kaleme yazılır ve on ayrı sorgu gereksizdir.
  const resolved = new Map<string, { jobItemId: string | null; jobId: string | null }>();
  for (const no of new Set(rows.map((r) => r.itemNo.trim()))) {
    resolved.set(no, await resolveItemNo(supabase, no));
  }

  const { data: existingRows } = await supabase
    .from("work_logs")
    .select("id")
    .eq("work_date", date);
  const existing = new Set(((existingRows ?? []) as { id: string }[]).map((r) => r.id));

  const keep = new Set(rows.map((r) => r.id).filter((id): id is string => Boolean(id)));
  const removed = [...existing].filter((id) => !keep.has(id));

  const payload = (row: WorkLogRowInput) => {
    const link = resolved.get(row.itemNo.trim()) ?? { jobItemId: null, jobId: null };
    return {
      work_date: date,
      item_no: row.itemNo.trim(),
      job_id: link.jobId,
      job_item_id: link.jobItemId,
      part_id: row.partId,
      category_id: row.categoryId,
      part_code: row.partCode,
      people: row.people,
      hours: row.hours,
      note: row.note,
      updated_by: user.id,
    };
  };

  const inserts = rows.filter((r) => !r.id).map((r) => ({ ...payload(r), created_by: user.id }));
  const updates = rows.filter((r) => r.id && existing.has(r.id));

  if (removed.length > 0) {
    const { error } = await supabase.from("work_logs").delete().in("id", removed);
    if (error) return { error: error.message };
  }
  for (const row of updates) {
    const { error } = await supabase.from("work_logs").update(payload(row)).eq("id", row.id!);
    if (error) return { error: error.message };
  }
  if (inserts.length > 0) {
    const { error } = await supabase.from("work_logs").insert(inserts);
    if (error) return { error: error.message };
  }

  await supabase.from("audit_log").insert({
    actor: user.id,
    action: "worklog.saveDay",
    detail: {
      work_date: date,
      rows: rows.length,
      added: inserts.length,
      updated: updates.length,
      removed: removed.length,
    },
  });

  revalidatePath("/worklog");
  revalidatePath("/worklog/analysis");
  revalidatePath("/worklog/records");
  return { ok: true };
}

/** Tek satır düzenleme — Kayıtlar ekranındaki pencere. */
export async function updateWorkLog(
  id: string,
  input: WorkLogRowInput & { date: string }
): Promise<WorkLogActionResult> {
  const ctx = await requireWorkLogAccess();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, user } = ctx;

  const parsed = workLogRowSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return { error: "Tarih geçersiz" };

  const link = await resolveItemNo(supabase, parsed.data.itemNo);
  const { error } = await supabase
    .from("work_logs")
    .update({
      work_date: input.date,
      item_no: parsed.data.itemNo.trim(),
      job_id: link.jobId,
      job_item_id: link.jobItemId,
      part_id: parsed.data.partId,
      category_id: parsed.data.categoryId,
      part_code: parsed.data.partCode,
      people: parsed.data.people,
      hours: parsed.data.hours,
      note: parsed.data.note,
      updated_by: user.id,
    })
    .eq("id", id);
  if (error) return { error: error.message };

  await supabase.from("audit_log").insert({
    actor: user.id,
    action: "worklog.update",
    detail: { id, work_date: input.date, item_no: parsed.data.itemNo },
  });

  revalidatePath("/worklog");
  revalidatePath("/worklog/records");
  revalidatePath("/worklog/analysis");
  return { ok: true };
}

export async function deleteWorkLog(id: string): Promise<WorkLogActionResult> {
  const ctx = await requireWorkLogAccess();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, user } = ctx;

  const { data, error } = await supabase.from("work_logs").delete().eq("id", id).select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "Kayıt silinemedi." };

  await supabase.from("audit_log").insert({
    actor: user.id,
    action: "worklog.delete",
    detail: { id },
  });

  revalidatePath("/worklog");
  revalidatePath("/worklog/records");
  revalidatePath("/worklog/analysis");
  return { ok: true };
}

/**
 * Yeni parça — günlük girişteki arama kutusundan tek adımda açılır.
 * Defteri yönetim paneline göndermek, atölye kaydını yazan kişiyi ortasında
 * durdururdu; oysa yeni bir parça adı günlük işin en doğal parçasıdır.
 */
export async function createWorkPart(
  name: string
): Promise<WorkLogActionResult & { part?: { id: string; name: string } }> {
  const ctx = await requireWorkLogAccess();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, user } = ctx;

  const parsed = workPartSchema.safeParse({ name });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  // Aynı ad zaten varsa yeni kayıt açılmaz, var olan döner: kullanıcı "Ana
  // Kiriş" yazdığında listede zaten duran satırı seçmiş olur.
  const { data: dupe } = await supabase
    .from("work_parts")
    .select("id, name")
    .ilike("name", parsed.data.name)
    .limit(1)
    .maybeSingle();
  if (dupe) {
    const row = dupe as { id: string; name: string };
    return { ok: true, part: row };
  }

  const { data: maxRow } = await supabase
    .from("work_parts")
    .select("sort")
    .order("sort", { ascending: false })
    .limit(1)
    .maybeSingle();
  const sort = ((maxRow as { sort: number } | null)?.sort ?? 0) + 10;

  const { data, error } = await supabase
    .from("work_parts")
    .insert({ name: parsed.data.name, sort })
    .select("id, name")
    .single();
  if (error) return { error: error.message };

  await supabase.from("audit_log").insert({
    actor: user.id,
    action: "worklog.part.create",
    detail: { name: parsed.data.name },
  });

  revalidatePath("/worklog");
  return { ok: true, part: data as { id: string; name: string } };
}

/**
 * Yeni imalat türü. Rengi kullanıcı seçmez: var olan tonlardan EN UZAK boşluk
 * verilir (müşteri defteriyle aynı mekanizma) — yığılmış grafikte komşu
 * dilimlerin ayırt edilebilirliğini veri değil KURAL garanti eder.
 */
export async function createWorkCategory(
  name: string
): Promise<
  WorkLogActionResult & { category?: { id: string; name: string; color_hue: number } }
> {
  const ctx = await requireWorkLogAccess();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, user } = ctx;

  const { data: existing } = await supabase.from("work_categories").select("name, color_hue");
  const rows = (existing ?? []) as { name: string; color_hue: number }[];
  const dupe = rows.find((c) => c.name.toLocaleLowerCase("tr") === name.trim().toLocaleLowerCase("tr"));
  if (dupe) return { error: `"${dupe.name}" zaten kayıtlı` };

  const parsed = workCategorySchema.safeParse({
    name,
    colorHue: nextDistinctHue(rows.map((c) => c.color_hue)),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { data, error } = await supabase
    .from("work_categories")
    .insert({ name: parsed.data.name, color_hue: parsed.data.colorHue, sort: rows.length * 10 + 10 })
    .select("id, name, color_hue")
    .single();
  if (error) return { error: error.message };

  await supabase.from("audit_log").insert({
    actor: user.id,
    action: "worklog.category.create",
    detail: { name: parsed.data.name },
  });

  revalidatePath("/worklog");
  return { ok: true, category: data as { id: string; name: string; color_hue: number } };
}

/**
 * Eşleşmemiş kalem numarasını gerçek bir iş kalemine bağlar — TEK İŞLEMDE.
 *
 * Devralınan kayıtta 0020-00 numarasına 792 satır yazılmış ama sistemde 0020
 * no'lu iş YOK. Satır satır düzeltmek 792 tıklamadır; burada numaranın
 * tamamı bir kerede bağlanır. `rewriteItemNo` açıkken kayıttaki METİN de
 * hedefin numarasına çevrilir (0020-00 → 0019-00), kapalıyken metin
 * korunur ve yalnız bağlantı kurulur — atölyenin kendi numarası kaybolmasın
 * isteniyorsa bu seçenek kullanılır.
 */
export async function remapItemNo(input: {
  fromItemNo: string;
  jobItemId: string;
  rewriteItemNo: boolean;
}): Promise<WorkLogActionResult & { affected?: number }> {
  const ctx = await requireWorkLogAccess();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, user } = ctx;

  const parsed = remapItemSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { data: target } = await supabase
    .from("job_items")
    .select("id, item_no, job_id")
    .eq("id", parsed.data.jobItemId)
    .maybeSingle();
  if (!target) return { error: "Hedef iş kalemi bulunamadı" };
  const t = target as { id: string; item_no: string; job_id: string };

  const patch: Record<string, unknown> = {
    job_item_id: t.id,
    job_id: t.job_id,
    updated_by: user.id,
  };
  if (parsed.data.rewriteItemNo) patch.item_no = t.item_no;

  const { data, error } = await supabase
    .from("work_logs")
    .update(patch)
    .eq("item_no", parsed.data.fromItemNo)
    .select("id");
  if (error) return { error: error.message };

  await supabase.from("audit_log").insert({
    actor: user.id,
    action: "worklog.remapItem",
    detail: {
      from: parsed.data.fromItemNo,
      to: t.item_no,
      rewrote: parsed.data.rewriteItemNo,
      affected: data?.length ?? 0,
    },
  });

  revalidatePath("/worklog");
  revalidatePath("/worklog/records");
  revalidatePath("/worklog/analysis");
  return { ok: true, affected: data?.length ?? 0 };
}
