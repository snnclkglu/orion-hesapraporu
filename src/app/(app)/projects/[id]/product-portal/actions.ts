"use server";

import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { PDFDocument } from "pdf-lib";
import { z } from "zod";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getReportSettings } from "@/lib/settings";
import {
  CUSTOMER_PORTAL_BUCKET,
  discoverPortalDocuments,
  loadProductPortalWorkspace,
  mergeDiscoveredDocuments,
  resolveAutomaticProductIdentity,
} from "@/lib/product-portal/data-server";
import {
  defaultPortalPayload,
  alphaSuffix,
  identityValues,
  suggestedSerialNo,
  unitCountFromQuantity,
  withProductPortalDefaults,
} from "@/lib/product-portal/identity";
import { materializePortalSelection } from "@/lib/product-portal/materialize-server";
import {
  hashPortalPassword,
  newPortalPassword,
  newPublicCode,
} from "@/lib/product-portal/secrets";
import {
  PORTAL_SOURCE_KINDS,
  PRODUCT_IDENTITY_FIELDS,
  type PortalDocumentSelection,
} from "@/lib/product-portal/types";

export type ProductPortalActionResult = {
  ok?: boolean;
  error?: string;
  warning?: string;
  password?: string;
  revisionId?: string;
};

const UUID = z.string().uuid();
const accessMode = z.enum(["view_watermarked", "download"]);
const sourceKind = z.enum(PORTAL_SOURCE_KINDS);
const identityField = z.enum(PRODUCT_IDENTITY_FIELDS);

const documentSchema = z.object({
  id: z.string().min(1).max(120),
  sourceKind,
  sourceId: z.string().min(1).max(500),
  sourceLabel: z.string().max(240),
  sourceRevisionLabel: z.string().max(80),
  title: z.string().trim().min(1).max(180),
  folderKey: z.string().regex(/^[a-z0-9-]{1,40}$/),
  folderTitle: z.string().trim().min(1).max(100),
  folderSort: z.number().int().min(0).max(10000),
  fileSort: z.number().int().min(0).max(10000),
  accessMode,
  included: z.boolean(),
  automatic: z.boolean(),
  ready: z.boolean(),
  unavailableReason: z.string().max(240).optional(),
});

const saveSchema = z.object({
  projectId: UUID,
  revisionId: UUID,
  serialBase: z.string().trim().min(1).max(80),
  plate: z.object({
    widthMm: z.number().min(120).max(1000),
    heightMm: z.number().min(80).max(1000),
    holeDiameterMm: z.number().positive().max(50).optional(),
    holeInsetMm: z.number().positive().max(100).optional(),
  }),
  overrides: z.record(identityField, z.string().max(180)),
  hiddenFields: z.array(identityField),
  portal: z.object({
    title: z.string().trim().min(1).max(100),
    note: z.string().max(600),
    supportEmail: z.union([z.literal(""), z.string().email().max(160)]),
  }),
  documents: z.array(documentSchema).max(500),
  units: z.array(z.object({ id: UUID, serialNo: z.string().trim().min(1).max(80) })).min(1).max(99),
});

type ServerSupabase = Awaited<ReturnType<typeof createClient>>;
type ContextError = { error: string };
type WriterContext = {
  supabase: ServerSupabase;
  user: User;
  project: { id: string; doc_no: string | null; name: string | null };
};
type PortalContext = WriterContext & {
  portal: { id: string; current_revision_id: string | null };
};
type RevisionContext = PortalContext & {
  revision: { id: string; portal_id: string; rev_no: number; status: string; payload: unknown };
};

async function writerContext(projectId: string): Promise<WriterContext | ContextError> {
  if (!UUID.safeParse(projectId).success) return { error: "Geçersiz proje kimliği." } as const;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum gerekli." } as const;
  const { data: allowed } = await supabase.rpc("can_edit_product_portals");
  if (!allowed) return { error: "Vinç kimliği düzenleme yetkiniz yok." } as const;
  const { data: project } = await supabase
    .from("projects")
    .select("id, doc_no, name")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) return { error: "Proje bulunamadı." } as const;
  return { supabase, user, project: project as WriterContext["project"] };
}

async function portalContext(projectId: string): Promise<PortalContext | ContextError>;
async function portalContext(projectId: string, revisionId: string): Promise<RevisionContext | ContextError>;
async function portalContext(
  projectId: string,
  revisionId?: string
): Promise<PortalContext | RevisionContext | ContextError> {
  const base = await writerContext(projectId);
  if ("error" in base) return base;
  const { data: portal } = await base.supabase
    .from("product_portals")
    .select("id, current_revision_id")
    .eq("project_id", projectId)
    .maybeSingle();
  if (!portal) return { error: "Vinç kimliği henüz oluşturulmamış." } as const;
  if (!revisionId) return { ...base, portal } as PortalContext;
  const { data: revision } = await base.supabase
    .from("product_portal_revisions")
    .select("id, portal_id, rev_no, status, payload")
    .eq("id", revisionId)
    .eq("portal_id", portal.id)
    .maybeSingle();
  if (!revision) return { error: "Portal taslağı bulunamadı." } as const;
  return { ...base, portal, revision } as RevisionContext;
}

export async function setupProductPortal(projectId: string): Promise<ProductPortalActionResult> {
  const context = await writerContext(projectId);
  if ("error" in context) return { error: context.error };
  const { supabase, user, project } = context;
  const { data: existing } = await supabase
    .from("product_portals")
    .select("id")
    .eq("project_id", projectId)
    .maybeSingle();
  if (existing) return { error: "Bu proje için vinç kimliği zaten var." };

  const [{ data: items }, settings, documents] = await Promise.all([
    supabase
      .from("job_items")
      .select("id, item_no, quantity")
      .eq("project_id", projectId)
      .order("sort", { ascending: true })
      .limit(1),
    getReportSettings(supabase),
    discoverPortalDocuments(supabase, projectId),
  ]);
  const item = items?.[0] ?? null;
  const serialBase = String(item?.item_no ?? project.doc_no ?? "").trim();
  if (!serialBase) {
    return { error: "Otomatik seri kökü için iş kalemi veya proje doküman numarası gerekli." };
  }
  const parsedCount = unitCountFromQuantity(item?.quantity);
  const unitCount = parsedCount ?? 1;
  const payload = defaultPortalPayload({
    serialBase,
    supportEmail: settings.email,
    documents,
  });

  const { data: portal, error: portalError } = await supabase
    .from("product_portals")
    .insert({ project_id: projectId, created_by: user.id, updated_by: user.id })
    .select("id")
    .single();
  if (portalError || !portal) return { error: "Vinç kimliği defteri oluşturulamadı." };

  const { data: revision, error: revisionError } = await supabase
    .from("product_portal_revisions")
    .insert({ portal_id: portal.id, rev_no: 1, payload, created_by: user.id })
    .select("id")
    .single();
  if (revisionError || !revision) {
    await supabase.from("product_portals").delete().eq("id", portal.id);
    return { error: "İlk portal taslağı oluşturulamadı." };
  }

  const units = Array.from({ length: unitCount }, (_, index) => ({
    portal_id: portal.id,
    ordinal: index + 1,
    suffix: unitCount > 1 ? alphaSuffix(index + 1) : "",
    serial_no: suggestedSerialNo(serialBase, index + 1, unitCount),
    public_code: newPublicCode(),
    created_by: user.id,
    updated_by: user.id,
  }));
  const { error: unitError } = await supabase.from("crane_units").insert(units);
  if (unitError) {
    await supabase.from("product_portals").delete().eq("id", portal.id);
    return { error: `Fiziksel üniteler oluşturulamadı: ${unitError.message}` };
  }

  await supabase.from("audit_log").insert({
    project_id: projectId,
    actor: user.id,
    action: "product_portal.create",
    detail: { revision_id: revision.id, unit_count: unitCount, quantity_source: item?.quantity ?? "" },
  });
  revalidatePath(`/projects/${projectId}`);
  return {
    ok: true,
    revisionId: revision.id,
    ...(!parsedCount
      ? { warning: "İş kalemi adedi okunamadığı için 1 ünite oluşturuldu; seri satırlarını bölümden düzenleyebilirsiniz." }
      : {}),
  };
}

export async function saveProductPortalDraft(
  input: z.input<typeof saveSchema>
): Promise<ProductPortalActionResult> {
  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Alanlar geçersiz." };
  const data = parsed.data;
  const context = await portalContext(data.projectId, data.revisionId);
  if ("error" in context) return { error: context.error };
  if (context.revision.status !== "draft") return { error: "Yayımlanmış sürüm düzenlenemez; yeni sürüm açın." };

  const existing = withProductPortalDefaults(context.revision.payload);
  const payload = {
    ...existing,
    serialBase: data.serialBase,
    plate: data.plate,
    overrides: data.overrides,
    hiddenFields: [...new Set(data.hiddenFields)],
    portal: data.portal,
    documents: data.documents as PortalDocumentSelection[],
  };
  delete payload.issuedIdentity;

  const { data: storedUnits } = await context.supabase
    .from("crane_units")
    .select("id")
    .eq("portal_id", context.portal.id);
  const storedIds = new Set((storedUnits ?? []).map((unit) => unit.id));
  if (data.units.length !== storedIds.size || data.units.some((unit) => !storedIds.has(unit.id))) {
    return { error: "Ünite listesi güncel değil; sayfayı yenileyin." };
  }

  const { error: payloadError } = await context.supabase
    .from("product_portal_revisions")
    .update({ payload })
    .eq("id", data.revisionId)
    .eq("status", "draft");
  if (payloadError) return { error: "Portal taslağı kaydedilemedi." };

  for (const unit of data.units) {
    const { error } = await context.supabase
      .from("crane_units")
      .update({ serial_no: unit.serialNo, updated_by: context.user.id })
      .eq("id", unit.id)
      .eq("portal_id", context.portal.id);
    if (error) return { error: `Seri numarası kaydedilemedi: ${error.message}` };
  }

  await context.supabase.from("audit_log").insert({
    project_id: data.projectId,
    actor: context.user.id,
    action: "product_portal.draft.save",
    detail: { revision_id: data.revisionId, included_documents: data.documents.filter((doc) => doc.included).length },
  });
  revalidatePath(`/projects/${data.projectId}`);
  return { ok: true };
}

export async function refreshProductPortalSources(
  projectId: string,
  revisionId: string
): Promise<ProductPortalActionResult> {
  const context = await portalContext(projectId, revisionId);
  if ("error" in context) return { error: context.error };
  if (context.revision.status !== "draft") return { error: "Yayımlanmış sürümün kaynakları değiştirilemez." };
  const payload = withProductPortalDefaults(context.revision.payload);
  const discovered = await discoverPortalDocuments(context.supabase, projectId);
  payload.documents = mergeDiscoveredDocuments(payload.documents, discovered);
  const { error } = await context.supabase
    .from("product_portal_revisions")
    .update({ payload })
    .eq("id", revisionId)
    .eq("status", "draft");
  if (error) return { error: "Kaynak önerileri yenilenemedi." };
  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

export async function createNextProductPortalRevision(
  projectId: string
): Promise<ProductPortalActionResult> {
  const context = await portalContext(projectId);
  if ("error" in context) return { error: context.error };
  const workspace = await loadProductPortalWorkspace(context.supabase, projectId);
  if (!workspace) return { error: "Portal bulunamadı." };
  if (workspace.editableRevision) return { error: "Önce açık taslak sürümü tamamlayın." };
  const previous = workspace.revisions[0];
  if (!previous) return { error: "Kopyalanacak portal sürümü bulunamadı." };
  const payload = withProductPortalDefaults(previous.payload);
  delete payload.issuedIdentity;
  payload.documents = mergeDiscoveredDocuments(
    payload.documents,
    await discoverPortalDocuments(context.supabase, projectId)
  );
  const nextNo = Math.max(...workspace.revisions.map((entry) => entry.revNo), 0) + 1;
  const { data, error } = await context.supabase
    .from("product_portal_revisions")
    .insert({ portal_id: context.portal.id, rev_no: nextNo, payload, created_by: context.user.id })
    .select("id")
    .single();
  if (error || !data) return { error: "Yeni portal sürümü açılamadı." };
  revalidatePath(`/projects/${projectId}`);
  return { ok: true, revisionId: data.id };
}

export async function rotateCraneUnitPassword(
  projectId: string,
  unitId: string
): Promise<ProductPortalActionResult> {
  if (!UUID.safeParse(unitId).success) return { error: "Geçersiz ünite kimliği." };
  const context = await portalContext(projectId);
  if ("error" in context) return { error: context.error };
  const { data: unit } = await context.supabase
    .from("crane_units")
    .select("id, password_version, serial_no")
    .eq("id", unitId)
    .eq("portal_id", context.portal.id)
    .maybeSingle();
  if (!unit) return { error: "Ünite bulunamadı." };

  const password = newPortalPassword();
  const hashed = await hashPortalPassword(password);
  const nextVersion = Number(unit.password_version ?? 0) + 1;
  const { error } = await context.supabase
    .from("crane_units")
    .update({
      password_salt: hashed.saltHex,
      password_hash: hashed.hashHex,
      password_version: nextVersion,
      password_changed_at: new Date().toISOString(),
      updated_by: context.user.id,
    })
    .eq("id", unitId)
    .eq("portal_id", context.portal.id);
  if (error) return { error: "Yeni parola saklanamadı." };

  // Sürüm karşılaştırması eski oturumları zaten geçersiz kılar; satırları da
  // temizlemek defteri küçültür. Service role yalnız server-only modüldedir.
  await createAdminClient().from("product_portal_sessions").delete().eq("unit_id", unitId);
  await context.supabase.from("audit_log").insert({
    project_id: projectId,
    actor: context.user.id,
    action: "unit.password.rotate",
    detail: { unit_id: unitId, serial_no: unit.serial_no, password_version: nextVersion },
  });
  revalidatePath(`/projects/${projectId}`);
  return { ok: true, password };
}

export async function setCraneUnitPortalEnabled(
  projectId: string,
  unitId: string,
  enabled: boolean
): Promise<ProductPortalActionResult> {
  const context = await portalContext(projectId);
  if ("error" in context) return { error: context.error };
  const { data: unit } = await context.supabase
    .from("crane_units")
    .select("id, has_password")
    .eq("id", unitId)
    .eq("portal_id", context.portal.id)
    .maybeSingle();
  if (!unit) return { error: "Ünite bulunamadı." };
  if (enabled && !context.portal.current_revision_id) return { error: "Önce müşteri paketini yayımlayın." };
  if (enabled && !unit.has_password) return { error: "Önce ünite parolası oluşturun." };
  const { error } = await context.supabase
    .from("crane_units")
    .update({ portal_enabled: enabled, updated_by: context.user.id })
    .eq("id", unitId)
    .eq("portal_id", context.portal.id);
  if (error) return { error: "Portal durumu değiştirilemedi." };
  if (!enabled) await createAdminClient().from("product_portal_sessions").delete().eq("unit_id", unitId);
  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

export async function uploadCustomPortalDocument(
  projectId: string,
  revisionId: string,
  formData: FormData
): Promise<ProductPortalActionResult> {
  const context = await portalContext(projectId, revisionId);
  if ("error" in context) return { error: context.error };
  if (context.revision.status !== "draft") return { error: "Yalnız taslağa belge eklenebilir." };
  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "PDF dosyası seçin." };
  if (file.size <= 0 || file.size > 50 * 1024 * 1024) return { error: "PDF 50 MB'dan küçük olmalıdır." };
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (new TextDecoder("ascii").decode(bytes.slice(0, 5)) !== "%PDF-") return { error: "Dosya geçerli bir PDF değil." };
  try {
    if ((await PDFDocument.load(bytes, { updateMetadata: false })).getPageCount() < 1) throw new Error();
  } catch {
    return { error: "PDF okunamadı veya sayfa içermiyor." };
  }
  const storagePath = `draft/${context.portal.id}/${revisionId}/${randomUUID()}.pdf`;
  const { error: uploadError } = await context.supabase.storage
    .from(CUSTOMER_PORTAL_BUCKET)
    .upload(storagePath, bytes, { contentType: "application/pdf", upsert: false });
  if (uploadError) return { error: "Özel belge yüklenemedi." };

  const payload = withProductPortalDefaults(context.revision.payload);
  const title = file.name.replace(/\.pdf$/i, "").slice(0, 180) || "Ek Belge";
  payload.documents.push({
    id: `custom:${randomUUID()}`,
    sourceKind: "custom",
    sourceId: storagePath,
    sourceLabel: "Elle yüklenen PDF",
    sourceRevisionLabel: "",
    title,
    folderKey: "diger",
    folderTitle: "Diğer Belgeler",
    folderSort: 90,
    fileSort: payload.documents.filter((entry) => entry.folderKey === "diger").length + 1,
    accessMode: "view_watermarked",
    included: true,
    automatic: false,
    ready: true,
  });
  const { error } = await context.supabase
    .from("product_portal_revisions")
    .update({ payload })
    .eq("id", revisionId)
    .eq("status", "draft");
  if (error) {
    await context.supabase.storage.from(CUSTOMER_PORTAL_BUCKET).remove([storagePath]);
    return { error: "Belge taslağa eklenemedi." };
  }
  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

export async function deleteCustomPortalDocument(
  projectId: string,
  revisionId: string,
  documentId: string
): Promise<ProductPortalActionResult> {
  const context = await portalContext(projectId, revisionId);
  if ("error" in context) return { error: context.error };
  if (context.revision.status !== "draft") return { error: "Yayımlanmış belge silinemez; yeni sürüm açın." };
  const payload = withProductPortalDefaults(context.revision.payload);
  const entry = payload.documents.find((document) => document.id === documentId && document.sourceKind === "custom");
  if (!entry) return { error: "Özel belge bulunamadı." };
  payload.documents = payload.documents.filter((document) => document.id !== documentId);
  const { error } = await context.supabase
    .from("product_portal_revisions")
    .update({ payload })
    .eq("id", revisionId)
    .eq("status", "draft");
  if (error) return { error: "Belge taslaktan çıkarılamadı." };
  await context.supabase.storage.from(CUSTOMER_PORTAL_BUCKET).remove([entry.sourceId]);
  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

export async function issueProductPortalRevision(
  projectId: string,
  revisionId: string
): Promise<ProductPortalActionResult> {
  const context = await portalContext(projectId, revisionId);
  if ("error" in context) return { error: context.error };
  if (context.revision.status !== "draft") return { error: "Bu sürüm zaten yayımlanmış." };
  const payload = withProductPortalDefaults(context.revision.payload);
  const selected = payload.documents.filter((document) => document.included && document.ready);
  if (selected.length < 1) return { error: "Yayımlamak için en az bir hazır PDF seçin." };

  const automatic = await resolveAutomaticProductIdentity(context.supabase, projectId, payload);
  payload.issuedIdentity = identityValues(automatic.fields);
  const { error: snapshotError } = await context.supabase
    .from("product_portal_revisions")
    .update({ payload })
    .eq("id", revisionId)
    .eq("status", "draft");
  if (snapshotError) return { error: "Kimlik snapshotı dondurulamadı." };

  // Önceki başarısız denemeden kalmış TASLAK satırlar güvenle temizlenir.
  const { data: staleRows } = await context.supabase
    .from("product_portal_files")
    .select("storage_path")
    .eq("revision_id", revisionId);
  const stalePaths = (staleRows ?? []).map((row) => String(row.storage_path));
  if (stalePaths.length > 0) {
    await context.supabase.storage.from(CUSTOMER_PORTAL_BUCKET).remove(stalePaths);
    await context.supabase.from("product_portal_files").delete().eq("revision_id", revisionId);
  }

  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host") ?? "localhost:3000";
  const proto = headerStore.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const requestOrigin = `${proto}://${host}`;
  const materialized = [];
  try {
    for (const document of selected) {
      materialized.push(await materializePortalSelection({
        supabase: context.supabase,
        projectId,
        portalId: context.portal.id,
        revisionNo: Number(context.revision.rev_no),
        selection: document,
        requestOrigin,
      }));
    }

    const { error: insertError } = await context.supabase
      .from("product_portal_files")
      .insert(materialized.map((file) => ({
        ...file,
        revision_id: revisionId,
        created_by: context.user.id,
      })));
    if (insertError) throw new Error("Yayımlanmış dosya defteri yazılamadı.");

    const { error: issueError } = await context.supabase.rpc("issue_product_portal_revision", {
      p_revision_id: revisionId,
      p_expected_file_count: materialized.length,
    });
    if (issueError) throw new Error(issueError.message || "Portal sürümü yayımlanamadı.");
  } catch (error) {
    const paths = materialized.map((file) => file.storage_path);
    if (paths.length > 0) await context.supabase.storage.from(CUSTOMER_PORTAL_BUCKET).remove(paths);
    await context.supabase.from("product_portal_files").delete().eq("revision_id", revisionId);
    return { error: error instanceof Error ? error.message : "Portal paketi oluşturulamadı." };
  }

  await context.supabase.from("audit_log").insert({
    project_id: projectId,
    actor: context.user.id,
    action: "product_portal.issue",
    detail: {
      portal_id: context.portal.id,
      revision_id: revisionId,
      rev_no: Number(context.revision.rev_no),
      file_count: materialized.length,
      checksums: materialized.map((file) => file.sha256),
    },
  });
  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}
