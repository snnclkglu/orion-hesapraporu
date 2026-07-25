"use server";

// İş emri (jobs) server action'ları. İş Emri = form FR.11.02: başlık bilgileri +
// müşteri + iş bilgileri + kapsam + iş kalemleri (job_items) + hazırlayan.
// İş = birden çok vinç (projects.job_id) ve birden çok iş kalemi (job_items).

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { error?: string };

const dateOrNull = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable();

export const jobScopeSchema = z.object({
  proje: z.boolean().default(false),
  devreyeAlma: z.boolean().default(false),
  malzeme: z.boolean().default(false),
  nakliye: z.boolean().default(false),
  imalat: z.boolean().default(false),
  montaj: z.boolean().default(false),
});

export const jobItemSchema = z.object({
  item_no: z.string().trim().max(40).default(""),
  product_name: z.string().trim().max(300).default(""),
  quantity: z.string().trim().max(40).default(""),
});

export const jobInputSchema = z.object({
  job_no: z.string().trim().min(1, "İş no gerekli"),
  title: z.string().trim().min(1, "İş adı gerekli"),
  customer: z.string().trim().min(1, "Müşteri gerekli"),
  work_order_date: dateOrNull,
  customer_address: z.string().trim().max(400).default(""),
  customer_tax_office: z.string().trim().max(120).default(""),
  customer_tax_no: z.string().trim().max(60).default(""),
  customer_phone: z.string().trim().max(60).default(""),
  customer_fax: z.string().trim().max(60).default(""),
  contract_exists: z.boolean().default(false),
  contract_date: dateOrNull,
  workshop_exit_date: dateOrNull,
  delivery_date: dateOrNull,
  quantity_text: z.string().trim().max(60).default(""),
  job_leader: z.string().trim().max(120).default(""),
  prepared_by_name: z.string().trim().max(120).default(""),
  prepared_by_title: z.string().trim().max(120).default(""),
  scope: jobScopeSchema.default({
    proje: false, devreyeAlma: false, malzeme: false,
    nakliye: false, imalat: false, montaj: false,
  }),
  notes: z.string().trim().max(4000).default(""),
  items: z.array(jobItemSchema).max(100).default([]),
});

export type JobInput = z.infer<typeof jobInputSchema>;
export type JobItemInput = z.infer<typeof jobItemSchema>;

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

export async function setJobArchived(
  jobId: string,
  archived: boolean
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı" };

  const { error } = await supabase
    .from("jobs")
    .update({ status: archived ? "archived" : "active" })
    .eq("id", jobId);
  if (error) return { error: error.message };

  await supabase.from("audit_log").insert({
    actor: user.id,
    action: archived ? "job.archive" : "job.unarchive",
    detail: { job_id: jobId },
  });

  revalidatePath("/jobs");
  revalidatePath(`/jobs/${jobId}`);
  return {};
}
