"use server";

// İş emri (jobs) server action'ları. İş = birden çok vinç (projects.job_id).

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { error?: string };

const jobSchema = z.object({
  // İş no formatı serbest metin (ör. 0057-00)
  job_no: z.string().trim().min(1, "İş no gerekli"),
  title: z.string().trim().min(1, "İş adı gerekli"),
  customer: z.string().trim().min(1, "Müşteri gerekli"),
  notes: z.string().trim(),
});

export async function createJob(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı" };

  const parsed = jobSchema.safeParse({
    job_no: formData.get("job_no"),
    title: formData.get("title"),
    customer: formData.get("customer"),
    notes: formData.get("notes") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { data: job, error } = await supabase
    .from("jobs")
    .insert({ ...parsed.data, created_by: user.id })
    .select("id")
    .single();
  if (error) {
    return {
      error: error.code === "23505" ? "Bu iş no zaten kayıtlı" : error.message,
    };
  }

  await supabase.from("audit_log").insert({
    actor: user.id,
    action: "job.create",
    detail: {
      job_id: job.id,
      job_no: parsed.data.job_no,
      title: parsed.data.title,
    },
  });

  revalidatePath("/jobs");
  redirect(`/jobs/${job.id}`);
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
