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
  // İş emri bağlantısı: Projeler bölümünde iş seçilirse dolu gelir;
  // bağımsız raporlarda null kalır (sonradan "İşe Bağla" ile bağlanabilir).
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

// ------------------------------------------------------ Kopyalama (çoğaltma)

const duplicateSchema = z.object({
  doc_no: z.string().trim().min(1, "Doküman no gerekli"),
  name: z.string().trim().min(1, "Rapor adı gerekli"),
  customer: z.string().trim().min(1, "Müşteri gerekli"),
  /** Hedef iş emri; boş bırakılırsa kopya bağımsız kalır. */
  job_id: z.uuid("Geçersiz iş seçimi").nullable(),
  /** Hedef işin kalemi; seçilirse kalem yeni rapora yönlendirilir. */
  job_item_id: z.uuid("Geçersiz iş kalemi seçimi").nullable(),
});

export type DuplicateProjectInput = z.infer<typeof duplicateSchema>;

/**
 * Bir hesap raporunu kopyalayıp (istenirse) başka bir işe atar.
 * Kaynağın EN SON revizyonunun snapshot'ı (inputs/selections/results/
 * engine_version) yeni projede rev_no=0 · "V0" · taslak olarak açılır;
 * kaynağın revizyon geçmişi kopyalanmaz — kopya temiz bir hatta başlar.
 */
export async function duplicateProject(
  sourceProjectId: string,
  input: DuplicateProjectInput
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı" };

  const parsed = duplicateSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { data: source } = await supabase
    .from("projects")
    .select("id, doc_no, crane_type")
    .eq("id", sourceProjectId)
    .maybeSingle();
  if (!source) return { error: "Kaynak hesap raporu bulunamadı" };

  const { data: copy, error } = await supabase
    .from("projects")
    .insert({
      doc_no: parsed.data.doc_no,
      name: parsed.data.name,
      customer: parsed.data.customer,
      crane_type: source.crane_type,
      job_id: parsed.data.job_id,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error) {
    return {
      error: error.code === "23505" ? "Bu doküman no zaten kayıtlı" : error.message,
    };
  }

  // Kaynağın en son revizyonu → kopyanın V0 taslağı
  const { data: last } = await supabase
    .from("revisions")
    .select("id, rev_no, inputs, selections, results, engine_version")
    .eq("project_id", sourceProjectId)
    .order("rev_no", { ascending: false })
    .limit(1)
    .maybeSingle();

  let copiedRevisionId: string | null = null;
  if (last) {
    const { data: revision, error: revError } = await supabase
      .from("revisions")
      .insert({
        project_id: copy.id,
        rev_no: 0,
        label: "V0",
        status: "draft",
        inputs: last.inputs ?? {},
        selections: last.selections ?? {},
        results: last.results ?? {},
        engine_version: last.engine_version || ENGINE_VERSION,
        created_by: user.id,
      })
      .select("id")
      .single();
    if (revError) return { error: revError.message };
    copiedRevisionId = revision.id;
  }

  // Seçilen iş kalemi bu yeni rapora bağlanır (kalem başka rapora bağlıysa devralınır)
  if (parsed.data.job_id && parsed.data.job_item_id) {
    await supabase
      .from("job_items")
      .update({ project_id: copy.id })
      .eq("id", parsed.data.job_item_id)
      .eq("job_id", parsed.data.job_id);
  }

  await supabase.from("audit_log").insert({
    project_id: copy.id,
    revision_id: copiedRevisionId,
    actor: user.id,
    action: "project.duplicate",
    detail: {
      source_project_id: sourceProjectId,
      source_revision_id: last?.id ?? null,
      job_id: parsed.data.job_id,
      ...(parsed.data.job_item_id ? { job_item_id: parsed.data.job_item_id } : {}),
      doc_no: parsed.data.doc_no,
    },
  });

  revalidatePath("/projects");
  if (parsed.data.job_id) revalidatePath(`/jobs/${parsed.data.job_id}`);
  redirect(`/projects/${copy.id}`);
}

// ------------------------------------------------------------- İşe bağlama

const assignSchema = z.object({
  project_id: z.uuid("Geçersiz hesap raporu"),
  job_id: z.uuid("Geçersiz iş seçimi").nullable(),
  job_item_id: z.uuid("Geçersiz iş kalemi seçimi").nullable(),
});

/**
 * Bağımsız (ya da başka işe bağlı) bir hesap raporunu bir işe bağlar.
 * `jobId` null verilirse rapor işten çıkarılır. Rapora işaret eden eski iş
 * kalemi bağlantıları önce temizlenir; böylece bir rapor tek kaleme bağlı kalır.
 */
export async function assignProjectToJob(
  projectId: string,
  jobId: string | null,
  jobItemId?: string | null
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı" };

  const parsed = assignSchema.safeParse({
    project_id: projectId,
    job_id: jobId || null,
    job_item_id: jobId ? jobItemId || null : null,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { data: project } = await supabase
    .from("projects")
    .select("id, doc_no, job_id")
    .eq("id", parsed.data.project_id)
    .maybeSingle();
  if (!project) return { error: "Hesap raporu bulunamadı" };
  const previousJobId = project.job_id as string | null;

  const { error } = await supabase
    .from("projects")
    .update({ job_id: parsed.data.job_id })
    .eq("id", parsed.data.project_id);
  if (error) return { error: error.message };

  // Rapora işaret eden tüm eski kalem bağlantılarını temizle, sonra seçileni bağla
  await supabase
    .from("job_items")
    .update({ project_id: null })
    .eq("project_id", parsed.data.project_id);

  if (parsed.data.job_id && parsed.data.job_item_id) {
    await supabase
      .from("job_items")
      .update({ project_id: parsed.data.project_id })
      .eq("id", parsed.data.job_item_id)
      .eq("job_id", parsed.data.job_id);
  }

  await supabase.from("audit_log").insert({
    project_id: parsed.data.project_id,
    actor: user.id,
    action: "project.assignJob",
    detail: {
      job_id: parsed.data.job_id,
      previous_job_id: previousJobId,
      ...(parsed.data.job_item_id ? { job_item_id: parsed.data.job_item_id } : {}),
    },
  });

  revalidatePath("/projects");
  revalidatePath(`/projects/${parsed.data.project_id}`);
  if (previousJobId) revalidatePath(`/jobs/${previousJobId}`);
  if (parsed.data.job_id) revalidatePath(`/jobs/${parsed.data.job_id}`);
  return {};
}

// ------------------------------------------------------------------- Silme

/**
 * Hesap raporunu (proje + taslak revizyonları) kalıcı olarak siler.
 * DB gerçekleri: `projects` DELETE politikası is_admin() ister — yalnızca
 * yönetici silebilir. `guard_issued_revision` trigger'ı yayınlanmış revizyonun
 * silinmesini engeller; bu yüzden yayınlanmış revizyonu olan rapor silinemez,
 * arşivlenir.
 */
export async function deleteProject(projectId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı" };

  const parsedId = z.uuid("Geçersiz hesap raporu").safeParse(projectId);
  if (!parsedId.success) return { error: parsedId.error.issues[0].message };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "admin") {
    return { error: "Hesap raporunu yalnızca yönetici silebilir." };
  }

  const { data: project } = await supabase
    .from("projects")
    .select("id, doc_no, name, job_id")
    .eq("id", parsedId.data)
    .maybeSingle();
  if (!project) return { error: "Hesap raporu bulunamadı" };

  // Yayınlanmış revizyon varsa DB trigger'ı zaten engeller; kullanıcıya
  // veritabanı hatası yerine ne yapması gerektiğini söyleriz.
  const { data: issued } = await supabase
    .from("revisions")
    .select("id")
    .eq("project_id", parsedId.data)
    .eq("status", "issued")
    .limit(1);
  if (issued && issued.length > 0) {
    return {
      error:
        "Yayınlanmış revizyonu olan hesap raporu silinemez; önce arşivleyin.",
    };
  }

  const { data: deleted, error } = await supabase
    .from("projects")
    .delete()
    .eq("id", parsedId.data)
    .select("id");
  if (error) return { error: error.message };
  if (!deleted || deleted.length === 0) {
    return { error: "Hesap raporu silinemedi (yönetici yetkisi gerekir)." };
  }

  // Rapor arşivi yetim kalmasın: reports bucket'ında {project_id}/ altındaki
  // PDF'ler de temizlenir (admin DELETE politikası migration ile eklendi).
  // Depolama hatası silmeyi geri almaz; sessizce geçilir.
  const { data: archived } = await supabase.storage
    .from("reports")
    .list(parsedId.data);
  if (archived && archived.length > 0) {
    await supabase.storage
      .from("reports")
      .remove(archived.map((f) => `${parsedId.data}/${f.name}`));
  }

  // project_id ON DELETE SET NULL olduğu için kayıt NULL proje ile yazılır;
  // silinen raporun kimliği detail içinde saklanır.
  await supabase.from("audit_log").insert({
    project_id: null,
    actor: user.id,
    action: "project.delete",
    detail: {
      project_id: project.id,
      doc_no: project.doc_no,
      name: project.name,
      job_id: project.job_id,
    },
  });

  revalidatePath("/projects");
  if (project.job_id) revalidatePath(`/jobs/${project.job_id}`);
  redirect("/projects");
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
