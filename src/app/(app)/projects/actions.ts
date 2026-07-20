"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { ENGINE_VERSION } from "@/lib/calc/engine";

const projectSchema = z.object({
  doc_no: z.string().trim().min(1, "Doküman no gerekli"),
  name: z.string().trim().min(1, "Proje adı gerekli"),
  customer: z.string().trim().min(1, "Müşteri gerekli"),
  crane_type: z.string().trim().min(1),
  // İş emri bağlantısı: iş panelinden "Vinç Ekle" ile açılırsa dolu gelir;
  // bağımsız vinçlerde null kalır.
  job_id: z.uuid().nullable(),
});

export type ActionResult = { error?: string };

export async function createProject(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı" };

  const parsed = projectSchema.safeParse({
    doc_no: formData.get("doc_no"),
    name: formData.get("name"),
    customer: formData.get("customer"),
    crane_type: formData.get("crane_type") || "Çift Kirişli Gezer Köprülü Vinç",
    job_id: formData.get("job_id") || null,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const { data: project, error } = await supabase
    .from("projects")
    .insert({ ...parsed.data, created_by: user.id })
    .select("id")
    .single();

  if (error) {
    return {
      error: error.code === "23505" ? "Bu doküman no zaten kayıtlı" : error.message,
    };
  }

  await supabase.from("audit_log").insert({
    project_id: project.id,
    actor: user.id,
    action: "project.create",
    detail: {
      doc_no: parsed.data.doc_no,
      name: parsed.data.name,
      ...(parsed.data.job_id ? { job_id: parsed.data.job_id } : {}),
    },
  });

  revalidatePath("/projects");
  if (parsed.data.job_id) revalidatePath(`/jobs/${parsed.data.job_id}`);
  redirect(`/projects/${project.id}`);
}

export async function setProjectArchived(
  projectId: string,
  archived: boolean
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı" };

  const { error } = await supabase
    .from("projects")
    .update({ status: archived ? "archived" : "active" })
    .eq("id", projectId);
  if (error) return { error: error.message };

  await supabase.from("audit_log").insert({
    project_id: projectId,
    actor: user.id,
    action: archived ? "project.archive" : "project.unarchive",
    detail: {},
  });

  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
  return {};
}

export async function createRevision(projectId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı" };

  // Son revizyonu bul: yeni rev_no + snapshot kopyası.
  // Projenin ilk revizyonu ise şablon revizyondan (is_template) kopyalanır —
  // şablon panelden normal revizyon editörüyle bakımı yapılan bir revizyondur.
  let { data: last } = await supabase
    .from("revisions")
    .select("rev_no, inputs, selections, results, engine_version")
    .eq("project_id", projectId)
    .order("rev_no", { ascending: false })
    .limit(1)
    .maybeSingle();

  const revNo = (last?.rev_no ?? -1) + 1;
  let copiedFromTemplate = false;
  if (!last) {
    const { data: template } = await supabase
      .from("revisions")
      .select("rev_no, inputs, selections, results, engine_version")
      .eq("is_template", true)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (template) {
      last = template;
      copiedFromTemplate = true;
    }
  }

  const { data: revision, error } = await supabase
    .from("revisions")
    .insert({
      project_id: projectId,
      rev_no: revNo,
      label: `V${revNo}`,
      inputs: last?.inputs ?? {},
      selections: last?.selections ?? {},
      results: last?.results ?? {},
      engine_version: last?.engine_version || ENGINE_VERSION,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  await supabase.from("audit_log").insert({
    project_id: projectId,
    revision_id: revision.id,
    actor: user.id,
    action: "revision.create",
    detail: {
      rev_no: revNo,
      copied_from: copiedFromTemplate ? null : last?.rev_no ?? null,
      from_template: copiedFromTemplate,
    },
  });

  revalidatePath(`/projects/${projectId}`);
  redirect(`/projects/${projectId}/revisions/${revision.id}`);
}

// -------------------------------------------------------- Teknik çizimler

const drawingSchema = z.object({
  drawing_no: z.string().trim().min(1, "Çizim no gerekli"),
  title: z.string().trim().min(1, "Çizim adı gerekli"),
  category: z.string().trim().min(1, "Kategori gerekli"),
  revision: z.string().trim().min(1, "Revizyon gerekli"),
  status: z.enum(["draft", "checking", "approved"]),
  file_url: z.string().trim(),
  notes: z.string().trim(),
});

export type DrawingInput = z.infer<typeof drawingSchema>;

export async function createDrawing(
  projectId: string,
  input: DrawingInput
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı" };

  const parsed = drawingSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { data: drawing, error } = await supabase
    .from("drawings")
    .insert({ ...parsed.data, project_id: projectId, created_by: user.id })
    .select("id")
    .single();
  if (error) return { error: error.message };

  await supabase.from("audit_log").insert({
    project_id: projectId,
    actor: user.id,
    action: "drawing.create",
    detail: {
      drawing_id: drawing.id,
      drawing_no: parsed.data.drawing_no,
      title: parsed.data.title,
    },
  });

  revalidatePath(`/projects/${projectId}`);
  return {};
}

export async function updateDrawing(
  drawingId: string,
  projectId: string,
  input: DrawingInput
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı" };

  const parsed = drawingSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { error } = await supabase
    .from("drawings")
    .update(parsed.data)
    .eq("id", drawingId);
  if (error) return { error: error.message };

  await supabase.from("audit_log").insert({
    project_id: projectId,
    actor: user.id,
    action: "drawing.update",
    detail: {
      drawing_id: drawingId,
      drawing_no: parsed.data.drawing_no,
      revision: parsed.data.revision,
      status: parsed.data.status,
    },
  });

  revalidatePath(`/projects/${projectId}`);
  return {};
}

export async function deleteDrawing(
  drawingId: string,
  projectId: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı" };

  // RLS silmeyi admin'e sınırlar; etkilenen satırı seçerek yetkisizliği
  // sessiz başarı yerine net hatayla bildiririz.
  const { data: deleted, error } = await supabase
    .from("drawings")
    .delete()
    .eq("id", drawingId)
    .select("drawing_no");
  if (error) return { error: error.message };
  if (!deleted || deleted.length === 0) {
    return { error: "Çizim silinemedi (admin yetkisi gerekir)" };
  }

  await supabase.from("audit_log").insert({
    project_id: projectId,
    actor: user.id,
    action: "drawing.delete",
    detail: { drawing_id: drawingId, drawing_no: deleted[0].drawing_no },
  });

  revalidatePath(`/projects/${projectId}`);
  return {};
}
