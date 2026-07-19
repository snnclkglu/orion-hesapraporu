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
    detail: { doc_no: parsed.data.doc_no, name: parsed.data.name },
  });

  revalidatePath("/projects");
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
