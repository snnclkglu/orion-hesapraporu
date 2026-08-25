"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requestPermanentDeletion } from "@/lib/deletion-request-server";
import {
  DEFAULT_CRANE_TYPE,
  TROLLEY_ONLY_DISABLED_MODULES,
  isTrolleyOnlyCraneType,
} from "@/lib/crane-types";
import { adBuyuk } from "@/lib/tr-text";
import { ENGINE_VERSION } from "@/lib/calc/engine";
import {
  EQUIPMENT_ATTACHMENT_BUCKET,
  loadEquipmentAttachments,
} from "@/lib/equipment-attachments";
import {
  notesForRevision,
  type EquipmentNoteRow,
} from "./[id]/revisions/[revId]/equipment/notes";
import {
  ENGINEERING_REPORT_CONTEXT,
  OFFER_REPORT_CONTEXT,
  REPORT_CONTEXTS,
  reportBasePath,
  reportContextOf,
} from "@/lib/report-context";

/**
 * Kaynak revizyonun ekipman listesi "Ek Özellikler" notlarını yeni revizyona
 * taşır (madde 34).
 *
 * NEDEN AYRI BİR ADIM: notlar `equipment_notes` tablosunda durur, revizyonun
 * inputs/selections/results snapshot'ında değil. Snapshot kopyalandığında
 * notlar kendiliğinden gelmez; yeni versiyona geçen mühendis yazdığı
 * açıklamaları kaybederdi.
 *
 * Hata YUTULUR: not taşınması revizyon açmayı bozmamalıdır — revizyon zaten
 * oluşturulmuş olur, eksik kalan yalnızca açıklamalardır ve elle yazılabilir.
 */
async function copyEquipmentNotes(
  supabase: Awaited<ReturnType<typeof createClient>>,
  fromRevisionId: string | null | undefined,
  toRevisionId: string,
  actorId: string
): Promise<void> {
  if (!fromRevisionId) return;
  const { data } = await supabase
    .from("equipment_notes")
    .select("row_key, note")
    .eq("revision_id", fromRevisionId);
  const rows = notesForRevision(
    (data ?? null) as EquipmentNoteRow[] | null,
    toRevisionId,
    actorId
  );
  if (rows.length === 0) return;
  await supabase.from("equipment_notes").insert(rows);
}

/**
 * Kaynak revizyonun TEKNİK RESSAM NOTUNU yeni revizyona taşır.
 *
 * Satır notlarıyla aynı gerekçe: not revizyon snapshot'ında değil ayrı bir
 * tablodadır (`equipment_drawing_notes`), yani revizyon kopyalanırken
 * kendiliğinden gelmez. Kopyalanmasaydı V1'e geçen mühendis ressama yazdığı
 * uyarıyı yeniden yazmak zorunda kalırdı — ya da yazmayı unuturdu.
 *
 * Hata YUTULUR: not taşınması revizyon açmayı bozmamalıdır.
 */
async function copyDrawingNotes(
  supabase: Awaited<ReturnType<typeof createClient>>,
  fromRevisionId: string | null | undefined,
  toRevisionId: string,
  actorId: string
): Promise<void> {
  if (!fromRevisionId) return;
  const { data } = await supabase
    .from("equipment_drawing_notes")
    .select("note_key, note")
    .eq("revision_id", fromRevisionId);
  const rows = ((data ?? []) as { note_key: string; note: string }[])
    .filter((r) => (r?.note ?? "").trim() !== "")
    .map((r) => ({
      revision_id: toRevisionId,
      note_key: (r.note_key ?? "genel").trim() || "genel",
      note: r.note.trim(),
      updated_by: actorId,
    }));
  if (rows.length === 0) return;
  await supabase.from("equipment_drawing_notes").insert(rows);
}

/**
 * Kaynak revizyonun "Ek Belge" PDF'lerini yeni revizyona taşır.
 *
 * NOTLARLA AYNI GEREKÇE (yukarıdaki blok): ekler `equipment_attachments`
 * tablosunda ve depoda durur, revizyon snapshot'ında değil; kopyalanmazsa
 * mühendis her versiyonda aynı katalog yapraklarını yeniden yüklerdi.
 *
 * BAYTLAR DA KOPYALANIR, PAYLAŞILMAZ. İki revizyon aynı depo nesnesini
 * gösterseydi eski revizyonun eki YENİSİNDEN silinince kaybolurdu — teslim
 * edilmiş bir listenin eki sonradan değişmemelidir. `storage.copy` sunucu
 * tarafında, aynı bölgede çalışır; ekler satır başına birkaç tanedir.
 *
 * Hata YUTULUR: ek taşınması revizyon açmayı bozmamalıdır. Kopyalanamayan bir
 * ekin SATIRI DA yazılmaz — kayıt var, baytı yok bir ek, detaylı listeyi her
 * seferinde eksik bastırırdı.
 */
async function copyEquipmentAttachments(
  supabase: Awaited<ReturnType<typeof createClient>>,
  fromRevisionId: string | null | undefined,
  toRevisionId: string,
  actorId: string
): Promise<void> {
  if (!fromRevisionId) return;
  const rows = await loadEquipmentAttachments(supabase, fromRevisionId);
  if (rows.length === 0) return;

  const yeniler: Record<string, unknown>[] = [];
  for (const row of rows) {
    const yeniId = crypto.randomUUID();
    const hedef = `${toRevisionId}/${yeniId}.pdf`;
    const { error } = await supabase.storage
      .from(EQUIPMENT_ATTACHMENT_BUCKET)
      .copy(row.storagePath, hedef);
    if (error) continue;
    yeniler.push({
      id: yeniId,
      revision_id: toRevisionId,
      row_key: row.rowKey,
      file_name: row.fileName,
      storage_path: hedef,
      page_count: row.pageCount,
      sort: row.sort,
      created_by: actorId,
    });
  }
  if (yeniler.length > 0) {
    await supabase.from("equipment_attachments").insert(yeniler);
  }
}

/**
 * Proje ve müşteri adı KAYDA BÜYÜK HARFLE girer (firma kuralı, `adBuyuk`).
 *
 * Dönüşüm formda da yapılır (kullanıcı yazarken görsün) ama asıl yeri burasıdır:
 * kopyalama ve düzenleme yolları da aynı şemadan geçer, yani ad hangi kapıdan
 * girerse girsin tek bir yazımla saklanır. Rapor DOSYA ADI zaten büyük harf
 * basıyordu (`pdf/doc-naming.ts`); kural olmadan ekran ile dosya ayrışıyordu.
 */
const adAlani = (mesaj: string) =>
  z.string().trim().min(1, mesaj).transform(adBuyuk);

const projectSchema = z.object({
  doc_no: z.string().trim().min(1, "Doküman no gerekli"),
  name: adAlani("Proje adı gerekli"),
  customer: adAlani("Müşteri gerekli"),
  crane_type: z.string().trim().min(1),
  crane_location: z.string().trim().max(240, "Vinç yeri en fazla 240 karakter olabilir"),
  report_brand_customer_id: z.uuid("Geçersiz rapor firması").nullable(),
  end_customer_id: z.uuid("Geçersiz son kullanıcı").nullable(),
  // İş emri bağlantısı: Mühendislik bölümünde iş seçilirse dolu gelir;
  // bağımsız raporlarda null kalır (sonradan "İşe Bağla" ile bağlanabilir).
  job_id: z.uuid().nullable(),
  report_context: z.enum(REPORT_CONTEXTS),
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
    crane_type: formData.get("crane_type") || DEFAULT_CRANE_TYPE,
    crane_location: formData.get("crane_location") || "",
    report_brand_customer_id: formData.get("report_brand_customer_id") || null,
    end_customer_id: formData.get("end_customer_id") || null,
    report_context: formData.get("report_context") || ENGINEERING_REPORT_CONTEXT,
    job_id:
      formData.get("report_context") === OFFER_REPORT_CONTEXT
        ? null
        : formData.get("job_id") || null,
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
      report_context: parsed.data.report_context,
    },
  });

  revalidatePath("/projects");
  revalidatePath("/offers/hesap-raporlari");
  if (parsed.data.job_id) revalidatePath(`/jobs/${parsed.data.job_id}`);
  redirect(`${reportBasePath(parsed.data.report_context)}/${project.id}`);
}

// ----------------------------------------------------- Proje bilgisi düzenleme

/**
 * Proje bilgisi düzenleme.
 *
 * VİNÇ TİPİ BURADA DA DEĞİŞTİRİLİR (kullanıcı kararı, 15.08.2026). Alan bir
 * süre yalnız rapor AÇILIRKEN soruluyordu; yanlış tiple açılmış bir raporu
 * düzeltmenin tek yolu raporu kopyalamaktı (kopya yeni bir doküman no ister ve
 * revizyon geçmişini taşımaz). Serbest metin bırakılır — liste
 * `lib/crane-types.ts`tedir ama kayıtlı/devralınan bir tip listede olmayabilir.
 */
const projectDetailsSchema = z.object({
  doc_no: z.string().trim().min(1, "Doküman no gerekli"),
  name: adAlani("Proje / iş adı gerekli"),
  customer: adAlani("Müşteri gerekli"),
  crane_type: z.string().trim().min(1, "Vinç tipi gerekli"),
  crane_location: z.string().trim().max(240, "Vinç yeri en fazla 240 karakter olabilir"),
  report_brand_customer_id: z.uuid("Geçersiz rapor firması").nullable(),
  end_customer_id: z.uuid("Geçersiz son kullanıcı").nullable(),
});

export type ProjectDetailsInput = z.infer<typeof projectDetailsSchema>;

/** Mühendislik listesinden proje/iş adı ile müşteri bilgisini günceller. */
export async function updateProjectDetails(
  projectId: string,
  input: ProjectDetailsInput
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı" };

  const parsedId = z.uuid("Geçersiz hesap raporu").safeParse(projectId);
  if (!parsedId.success) return { error: parsedId.error.issues[0].message };
  const parsed = projectDetailsSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { data: current } = await supabase
    .from("projects")
    .select("id, doc_no, name, customer, crane_type, crane_location, report_brand_customer_id, end_customer_id, job_id")
    .eq("id", parsedId.data)
    .maybeSingle();
  if (!current) return { error: "Hesap raporu bulunamadı" };

  const { error } = await supabase
    .from("projects")
    .update({
      doc_no: parsed.data.doc_no,
      name: parsed.data.name,
      customer: parsed.data.customer,
      crane_type: parsed.data.crane_type,
      crane_location: parsed.data.crane_location,
      report_brand_customer_id: parsed.data.report_brand_customer_id,
      end_customer_id: parsed.data.end_customer_id,
    })
    .eq("id", parsedId.data);
  if (error) {
    return {
      error: error.code === "23505" ? "Bu doküman no zaten kayıtlı" : error.message,
    };
  }

  await supabase.from("audit_log").insert({
    project_id: parsedId.data,
    actor: user.id,
    action: "project.updateDetails",
    detail: {
      previous_doc_no: current.doc_no,
      previous_name: current.name,
      previous_customer: current.customer,
      previous_crane_type: current.crane_type,
      previous_crane_location: current.crane_location,
      previous_report_brand_customer_id: current.report_brand_customer_id,
      previous_end_customer_id: current.end_customer_id,
      doc_no: parsed.data.doc_no,
      name: parsed.data.name,
      customer: parsed.data.customer,
      crane_type: parsed.data.crane_type,
      crane_location: parsed.data.crane_location,
      report_brand_customer_id: parsed.data.report_brand_customer_id,
      end_customer_id: parsed.data.end_customer_id,
    },
  });

  revalidatePath("/projects");
  revalidatePath("/offers/hesap-raporlari");
  revalidatePath(`/projects/${parsedId.data}`);
  revalidatePath(`/offers/hesap-raporlari/${parsedId.data}`);
  if (current.job_id) revalidatePath(`/jobs/${current.job_id}`);
  return {};
}

// ---------------------------------------------------- Rapor imza sorumluları

const projectSignatoriesSchema = z.object({
  prepared_by: z.uuid().nullable(),
  checked_by: z.uuid().nullable(),
  checked_by_name: z.string().trim().max(120),
});

export type ProjectSignatoriesInput = z.infer<typeof projectSignatoriesSchema>;

/**
 * Rapor kapağında yer alan hazırlayan ve kontrol eden kişileri proje bazında
 * saklar. Seçim Yönetim > Kullanıcılar defterindeki bütün profillerden
 * yapılabilir; istemciden gelen UUID'ye güvenilmez ve profil yeniden okunur.
 */
export async function updateProjectSignatories(
  projectId: string,
  input: ProjectSignatoriesInput
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı" };

  const parsedId = z.uuid("Geçersiz hesap raporu").safeParse(projectId);
  if (!parsedId.success) return { error: parsedId.error.issues[0].message };
  const parsed = projectSignatoriesSchema.safeParse(input);
  if (!parsed.success) return { error: "Geçersiz hazırlayan veya kontrol eden seçimi" };

  const selectedIds = [parsed.data.prepared_by, parsed.data.checked_by]
    .filter((id): id is string => Boolean(id));
  if (selectedIds.length > 0) {
    const { data: eligible } = await supabase
      .from("profiles")
      .select("id")
      .in("id", selectedIds);
    if ((eligible ?? []).length !== new Set(selectedIds).size) {
      return { error: "Seçilen oluşturan veya kontrol eden kullanıcı bulunamadı" };
    }
  }

  const { data: current } = await supabase
    .from("projects")
    .select("prepared_by, checked_by, checked_by_name")
    .eq("id", parsedId.data)
    .maybeSingle();
  if (!current) return { error: "Hesap raporu bulunamadı" };

  const { error } = await supabase
    .from("projects")
    .update(parsed.data)
    .eq("id", parsedId.data);
  if (error) return { error: error.message };

  await supabase.from("audit_log").insert({
    project_id: parsedId.data,
    actor: user.id,
    action: "project.updateSignatories",
    detail: {
      previous_prepared_by: current.prepared_by,
      previous_checked_by: current.checked_by,
      previous_checked_by_name: current.checked_by_name,
      prepared_by: parsed.data.prepared_by,
      checked_by: parsed.data.checked_by,
      checked_by_name: parsed.data.checked_by_name,
    },
  });

  revalidatePath(`/projects/${parsedId.data}`);
  revalidatePath(`/offers/hesap-raporlari/${parsedId.data}`);
  return {};
}

// ------------------------------------------------------ Kopyalama (çoğaltma)

const duplicateSchema = z.object({
  doc_no: z.string().trim().min(1, "Doküman no gerekli"),
  name: adAlani("Rapor adı gerekli"),
  customer: adAlani("Müşteri gerekli"),
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
    .select("id, doc_no, crane_type, crane_location, report_brand_customer_id, end_customer_id, report_context")
    .eq("id", sourceProjectId)
    .maybeSingle();
  if (!source) return { error: "Kaynak hesap raporu bulunamadı" };
  const sourceContext = reportContextOf(source.report_context);
  const targetJobId = sourceContext === OFFER_REPORT_CONTEXT ? null : parsed.data.job_id;
  const targetJobItemId = sourceContext === OFFER_REPORT_CONTEXT ? null : parsed.data.job_item_id;

  const { data: copy, error } = await supabase
    .from("projects")
    .insert({
      doc_no: parsed.data.doc_no,
      name: parsed.data.name,
      customer: parsed.data.customer,
      crane_type: source.crane_type,
      crane_location: source.crane_location,
      report_brand_customer_id: source.report_brand_customer_id,
      end_customer_id: source.end_customer_id,
      report_context: sourceContext,
      job_id: targetJobId,
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
    // Ekipman listesine yazılmış "Ek Özellikler" notları ve "Ek Belge"
    // PDF'leri de kopyaya taşınır
    await copyEquipmentNotes(supabase, last.id, revision.id, user.id);
    await copyDrawingNotes(supabase, last.id, revision.id, user.id);
    await copyEquipmentAttachments(supabase, last.id, revision.id, user.id);
  }

  // Seçilen iş kalemi bu yeni rapora bağlanır (kalem başka rapora bağlıysa devralınır)
  if (targetJobId && targetJobItemId) {
    await supabase
      .from("job_items")
      .update({ project_id: copy.id })
      .eq("id", targetJobItemId)
      .eq("job_id", targetJobId);
  }

  await supabase.from("audit_log").insert({
    project_id: copy.id,
    revision_id: copiedRevisionId,
    actor: user.id,
    action: "project.duplicate",
    detail: {
      source_project_id: sourceProjectId,
      source_revision_id: last?.id ?? null,
      job_id: targetJobId,
      ...(targetJobItemId ? { job_item_id: targetJobItemId } : {}),
      doc_no: parsed.data.doc_no,
    },
  });

  revalidatePath("/projects");
  revalidatePath("/offers/hesap-raporlari");
  if (targetJobId) revalidatePath(`/jobs/${targetJobId}`);
  redirect(`${reportBasePath(sourceContext)}/${copy.id}`);
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
    .select("id, doc_no, job_id, report_context")
    .eq("id", parsed.data.project_id)
    .maybeSingle();
  if (!project) return { error: "Hesap raporu bulunamadı" };
  if (reportContextOf(project.report_context) === OFFER_REPORT_CONTEXT) {
    return {
      error:
        "Teklif hesap raporu işe bağlanamaz; kazanılan iş için raporu Mühendislik bölümüne kopyalayın.",
    };
  }
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
  revalidatePath("/offers/hesap-raporlari");
  revalidatePath(`/projects/${parsed.data.project_id}`);
  if (previousJobId) revalidatePath(`/jobs/${previousJobId}`);
  if (parsed.data.job_id) revalidatePath(`/jobs/${parsed.data.job_id}`);
  return {};
}

// ------------------------------------------------------------------- Silme

/** Hesap raporunun kalıcı silinmesini Yönetici onay kuyruğuna yollar. */
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
    .select("id")
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

  return requestPermanentDeletion({ entityType: "project", targetId: parsedId.data });
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
  revalidatePath("/offers/hesap-raporlari");
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/offers/hesap-raporlari/${projectId}`);
  return {};
}

/**
 * Vinç tipinin İLK revizyona yazdığı TOHUM — bir öneri, bir kural değil.
 *
 * "Vinç Arabası" tipiyle açılan rapor, mevcut bir vincin yalnız arabasının
 * yenilendiği iştir: köprü yürütme, teker yükleri, ana kirişler, buruşma ve
 * başkiriş bölümleri o belgede yoktur. Mühendisi her yeni raporda altı
 * kutucuğu tek tek kapatmaya bırakmak, unutulduğunda müşteriye olmayan bir
 * köprünün hesabını göndermek demekti.
 *
 * **VİNÇ TİPİ MOTORA GİRMEZ** (HESAP-8b). Kural ihlal edilmiyor çünkü tip
 * BİR KEZ, V0 doğarken okunur; ürettiği şey revizyonun kendi
 * `inputs.disabledModules` verisidir ve kararın sahibi o andan sonra
 * revizyondur. `runCalc`, `activeModules` ve `loadRevision` `crane_type`ı hiç
 * görmez; mühendis kutucukları ilk ekranda geri açabilir ve tip sonradan
 * değişse bile mevcut revizyonlar etkilenmez.
 *
 * Şablondan kopyalanan snapshot EZİLMEZ, yalnız kapalı bölüm listesi
 * BİRLEŞTİRİLİR: şablonun kendi kararı (ör. buruşma kapalı) korunur.
 */
function craneTypePresetInputs(
  revNo: number,
  craneType: string | null | undefined,
  inherited: Record<string, unknown>
): Record<string, unknown> {
  if (revNo !== 0 || !isTrolleyOnlyCraneType(craneType)) return inherited;
  const previous = Array.isArray(inherited.disabledModules)
    ? (inherited.disabledModules as unknown[]).filter((k): k is string => typeof k === "string")
    : [];
  return {
    ...inherited,
    disabledModules: [...new Set([...previous, ...TROLLEY_ONLY_DISABLED_MODULES])],
  };
}

export async function createRevision(projectId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı" };

  // Vinç tipi YALNIZ BURADA okunur (bkz. `craneTypePresetInputs`): ilk
  // revizyonun kapalı bölüm listesine bir ÖNERİ yazmak için.
  const { data: proje } = await supabase
    .from("projects")
    .select("crane_type, report_context")
    .eq("id", projectId)
    .maybeSingle();

  // Son revizyonu bul: yeni rev_no + snapshot kopyası.
  // Projenin ilk revizyonu ise şablon revizyondan (is_template) kopyalanır —
  // şablon panelden normal revizyon editörüyle bakımı yapılan bir revizyondur.
  // `id` de okunur: ekipman notları kaynak revizyondan kopyalanacak (madde 34).
  let { data: last } = await supabase
    .from("revisions")
    .select("id, rev_no, inputs, selections, results, engine_version")
    .eq("project_id", projectId)
    .order("rev_no", { ascending: false })
    .limit(1)
    .maybeSingle();

  const revNo = (last?.rev_no ?? -1) + 1;
  let copiedFromTemplate = false;
  if (!last) {
    const { data: template } = await supabase
      .from("revisions")
      .select("id, rev_no, inputs, selections, results, engine_version")
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
      inputs: craneTypePresetInputs(
        revNo,
        proje?.crane_type,
        (last?.inputs ?? {}) as Record<string, unknown>
      ),
      selections: last?.selections ?? {},
      results: last?.results ?? {},
      engine_version: last?.engine_version || ENGINE_VERSION,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  // Snapshot gibi ekipman notları ve ekleri de devralınır — şablondan gelen
  // ilk revizyonda şablonunkiler, sonrakilerde bir önceki revizyonunkiler.
  await copyEquipmentNotes(supabase, last?.id, revision.id, user.id);
  await copyDrawingNotes(supabase, last?.id, revision.id, user.id);
  await copyEquipmentAttachments(supabase, last?.id, revision.id, user.id);

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
  const basePath = reportBasePath(reportContextOf(proje?.report_context));
  revalidatePath(`${basePath}/${projectId}`);
  redirect(`${basePath}/${projectId}/revisions/${revision.id}`);
}

/**
 * TASLAK bir revizyonun kalıcı silinmesini Yönetici onayına yollar.
 *
 * Yayınlanmış revizyon SİLİNEMEZ — teslim edilmiş bir hesabın kaydı geriye
 * dönük yok edilemez. Bu kural veritabanında `guard_issued_revision`
 * tetikleyicisindedir; buradaki kontrol yalnız kullanıcıya anlaşılır bir mesaj
 * vermek içindir. Silme yetkisi RLS'te `can_edit_reports()`e bağlıdır: raporu
 * AÇAN ve düzenleyen mühendis kendi taslağını da temizleyebilmelidir (projeyi
 * silmek ise hâlâ yöneticiye özeldir — ayrı soru, ayrı politika).
 *
 * Yanlış açılmış ya da yanlış yönde ilerlemiş bir taslağı temizlemenin yolu
 * yoktu; kullanıcı ya bozuk revizyonla yaşıyor ya da üstüne bir yenisini
 * açıyordu. Silindikten sonra "Yeni Revizyon" KALAN SON revizyondan kopyalar
 * (`createRevision` en büyük rev_no'yu okur): V1 silinince açılan yeni V1
 * yeniden V0'dan türer.
 *
 * `equipment_notes` ve `equipment_extras` yabancı anahtarla birlikte gider.
 * PDF arşivi (reports bucket'ı) YALNIZ yayınlandığında yazılır; taslakta
 * yetim dosya kalmaz.
 */
export async function deleteRevision(
  projectId: string,
  revisionId: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı" };

  const { data: revision } = await supabase
    .from("revisions")
    .select("id, rev_no, status")
    .eq("id", revisionId)
    .eq("project_id", projectId)
    .maybeSingle();
  if (!revision) return { error: "Revizyon bulunamadı" };
  if (revision.status === "issued") {
    return { error: "Yayınlanmış revizyon silinemez." };
  }

  return requestPermanentDeletion({
    entityType: "revision",
    targetId: revisionId,
    context: { project_id: projectId },
  });
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
