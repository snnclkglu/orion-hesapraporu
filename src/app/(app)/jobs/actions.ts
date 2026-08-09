"use server";

// İş emri (jobs) server action'ları. İş Emri = form FR.11.02: başlık bilgileri +
// müşteri + iş bilgileri + kapsam + iş kalemleri (job_items) + hazırlayan.
// İş = birden çok vinç (projects.job_id) ve birden çok iş kalemi (job_items).

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { JOB_STATUSES, type JobStatus } from "@/lib/job-status";
import { autoShortName, nextDistinctHue } from "@/lib/tags";
import {
  CUSTOMER_COLUMNS,
  customerInputSchema,
  jobInputSchema,
  type CustomerInput,
  type CustomerOption,
  type JobInput,
  type JobItemInput,
} from "./schema";
export type { JobInput, JobItemInput } from "./schema";

export type ActionResult = { error?: string };

/** jobs tablosu satırı (items hariç header alanları) */
function jobRowFrom(input: JobInput) {
  const { items: _items, ...rest } = input;
  void _items;
  return rest;
}

/** Boş (tamamen doldurulmamış) iş kalemlerini ele, sort ata */
function cleanItems(items: JobItemInput[]) {
  return items
    .filter((it) => it.product_name.trim() || it.item_no.trim())
    .map((it, i) => ({ ...it, sort: i }));
}

export async function createJob(input: JobInput): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı" };

  const parsed = jobInputSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { data: job, error } = await supabase
    .from("jobs")
    .insert({ ...jobRowFrom(parsed.data), created_by: user.id })
    .select("id")
    .single();
  if (error) {
    return { error: error.code === "23505" ? "Bu iş no zaten kayıtlı" : error.message };
  }

  const items = cleanItems(parsed.data.items);
  if (items.length > 0) {
    const { error: itemsError } = await supabase
      .from("job_items")
      .insert(items.map((it) => ({ ...it, job_id: job.id })));
    if (itemsError) return { error: itemsError.message };
  }

  await supabase.from("audit_log").insert({
    actor: user.id,
    action: "job.create",
    detail: { job_id: job.id, job_no: parsed.data.job_no, title: parsed.data.title },
  });

  revalidatePath("/jobs");
  redirect(`/jobs/${job.id}`);
}

export async function updateJob(jobId: string, input: JobInput): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı" };

  const parsed = jobInputSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { error } = await supabase
    .from("jobs")
    .update(jobRowFrom(parsed.data))
    .eq("id", jobId);
  if (error) {
    return { error: error.code === "23505" ? "Bu iş no zaten kayıtlı" : error.message };
  }

  // İş kalemlerini tam yenile; proje bağlantılarını item_no ile geri bağla
  const { data: existing } = await supabase
    .from("job_items")
    .select("item_no, project_id")
    .eq("job_id", jobId);
  const linkByNo = new Map<string, string>();
  for (const r of existing ?? []) {
    if (r.project_id && r.item_no) linkByNo.set(r.item_no, r.project_id as string);
  }

  await supabase.from("job_items").delete().eq("job_id", jobId);

  const items = cleanItems(parsed.data.items);
  if (items.length > 0) {
    const { error: itemsError } = await supabase.from("job_items").insert(
      items.map((it) => ({
        ...it,
        job_id: jobId,
        project_id: linkByNo.get(it.item_no) ?? null,
      }))
    );
    if (itemsError) return { error: itemsError.message };
  }

  await supabase.from("audit_log").insert({
    actor: user.id,
    action: "job.update",
    detail: { job_id: jobId, job_no: parsed.data.job_no },
  });

  revalidatePath("/jobs");
  revalidatePath(`/jobs/${jobId}`);
  redirect(`/jobs/${jobId}`);
}

/**
 * İşin durumunu değiştirir (Aktif · Pasif · Tamamlandı · Arşiv).
 *
 * Liste satırından ve iş detayından tek tıkla çağrılır; bu yüzden yönlendirme
 * YAPMAZ, yalnız ilgili sayfaları tazeler.
 */
export async function setJobStatus(
  jobId: string,
  status: JobStatus
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı" };
  if (!JOB_STATUSES.includes(status)) return { error: "Geçersiz iş durumu" };

  const { error } = await supabase.from("jobs").update({ status }).eq("id", jobId);
  if (error) return { error: error.message };

  await supabase.from("audit_log").insert({
    actor: user.id,
    action: "job.status",
    detail: { job_id: jobId, status },
  });

  revalidatePath("/jobs");
  revalidatePath(`/jobs/${jobId}`);
  return {};
}

/**
 * İşi kalıcı olarak siler. `job_items` cascade ile gider; bağlı hesap raporları
 * SİLİNMEZ — `projects.job_id` null'a düşer (raporun kendi ömrü vardır).
 * RLS silmeyi yalnız yöneticiye açar; yetkisiz çağrı sessizce başarısız
 * olmasın diye satır sayısı kontrol edilir.
 */
export async function deleteJob(jobId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı" };

  const { data, error } = await supabase
    .from("jobs")
    .delete()
    .eq("id", jobId)
    .select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0) {
    return { error: "İş silinemedi — silme yetkisi yalnız yöneticidedir." };
  }

  await supabase.from("audit_log").insert({
    actor: user.id,
    action: "job.delete",
    detail: { job_id: jobId },
  });

  revalidatePath("/jobs");
  return {};
}

// ------------------------------------------------------------------ müşteri

/**
 * Müşteri defterine yeni kayıt açar ve kaydı geri döner — form açılır listeyi
 * yeniden yüklemeden seçebilsin diye. Aynı ada sahip kayıt varsa MEVCUT kayıt
 * döner (unique index büyük/küçük harf duyarsızdır); mükerrer müşteri açılmaz.
 *
 * Renk BURADA seçilir, veritabanı varsayılanına bırakılmaz: defterdeki tonlar
 * okunup en uzak boşluk bulunur (`nextDistinctHue`), böylece yeni müşteri
 * listede komşularına benzemeyen bir renk alır.
 */
export async function createCustomer(
  input: CustomerInput
): Promise<{ error?: string; customer?: CustomerOption }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı" };

  const parsed = customerInputSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { data: used } = await supabase.from("customers").select("color_hue");
  const hue = nextDistinctHue(
    (used ?? []).map((r) => Number((r as { color_hue: number }).color_hue) || 0)
  );

  const { data, error } = await supabase
    .from("customers")
    .insert({
      ...parsed.data,
      short_name: parsed.data.short_name || autoShortName(parsed.data.name),
      color_hue: hue,
      created_by: user.id,
    })
    .select(CUSTOMER_COLUMNS)
    .single();

  if (error) {
    if (error.code !== "23505") return { error: error.message };
    // Aynı isim zaten kayıtlı: kullanıcıyı hata ile durdurmak yerine mevcut
    // kaydı döndürüp seçilmesini sağlıyoruz.
    const { data: existing } = await supabase
      .from("customers")
      .select(CUSTOMER_COLUMNS)
      .ilike("name", parsed.data.name)
      .maybeSingle();
    if (!existing) return { error: "Bu müşteri zaten kayıtlı." };
    return { customer: existing as CustomerOption };
  }

  revalidatePath("/jobs");
  revalidatePath("/admin/customers");
  return { customer: data as CustomerOption };
}
