"use server";

import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { PDFDocument } from "pdf-lib";
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
  UUID,
  saveSchema,
  schemaError,
  type SaveProductPortalDraftInput,
} from "@/lib/product-portal/schema";
import {
  hashPortalPassword,
  newPortalPassword,
  newPublicCode,
} from "@/lib/product-portal/secrets";
import {
  PORTAL_FOLDER_OPTIONS,
  type PortalDocumentSelection,
} from "@/lib/product-portal/types";

export type ProductPortalActionResult = {
  ok?: boolean;
  error?: string;
  warning?: string;
  password?: string;
  revisionId?: string;
};

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
  input: SaveProductPortalDraftInput
): Promise<ProductPortalActionResult> {
  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) return { error: schemaError(parsed.error) };
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

  /*
   * SERİ NUMARASI İLK YAYINDAN SONRA SUNUCUDA DA KİLİTLİDİR.
   *
   * Kart girdiyi `hasIssuedRevision` ile devre dışı bırakıyordu — ama bu YALNIZ
   * İSTEMCİDEYDİ. Sunucu her kaydetmede seriyi güncelliyordu; eski bir sekme,
   * yeniden gönderilen bir istek ya da doğrudan çağrı, PLAKAYA KAZINMIŞ seri
   * numarasını sessizce değiştirebilirdi. O andan sonra sahadaki plaka ile
   * kayıt ayrışır ve hangisinin doğru olduğunu kimse bilemez.
   */
  const { data: issuedRevision } = await context.supabase
    .from("product_portal_revisions")
    .select("id")
    .eq("portal_id", context.portal.id)
    .eq("status", "issued")
    .limit(1)
    .maybeSingle();

  if (issuedRevision) {
    const { data: storedSerials } = await context.supabase
      .from("crane_units")
      .select("id, serial_no")
      .eq("portal_id", context.portal.id);
    const bySerial = new Map((storedSerials ?? []).map((row) => [String(row.id), String(row.serial_no)]));
    const changed = data.units.find((unit) => bySerial.get(unit.id) !== unit.serialNo);
    if (changed) {
      return {
        error: `Seri numarası ilk yayından sonra değiştirilemez (${bySerial.get(changed.id) ?? "?"}). Plakaya kazınan numara ile kayıt ayrışamaz.`,
      };
    }
  } else {
    for (const unit of data.units) {
      const { error } = await context.supabase
        .from("crane_units")
        .update({ serial_no: unit.serialNo, updated_by: context.user.id })
        .eq("id", unit.id)
        .eq("portal_id", context.portal.id);
      if (error) return { error: `Seri numarası kaydedilemedi: ${error.message}` };
    }
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
  const previous = workspace.revisions.find((entry) => entry.id === workspace.currentRevisionId)
    ?? workspace.revisions.find((entry) => entry.status === "issued")
    ?? workspace.revisions[0];
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

export async function withdrawProductPortal(
  projectId: string
): Promise<ProductPortalActionResult> {
  const context = await portalContext(projectId);
  if ("error" in context) return { error: context.error };
  if (!context.portal.current_revision_id) return { error: "Yayında bir müşteri paketi yok." };

  const { error } = await context.supabase.rpc("withdraw_product_portal", {
    p_portal_id: context.portal.id,
  });
  if (error) return { error: error.message || "Müşteri paketi yayından kaldırılamadı." };
  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

export async function activateProductPortalRevision(
  projectId: string,
  revisionId: string
): Promise<ProductPortalActionResult> {
  if (!UUID.safeParse(revisionId).success) return { error: "Geçersiz portal sürümü." };
  const context = await portalContext(projectId);
  if ("error" in context) return { error: context.error };
  const { data: revision } = await context.supabase
    .from("product_portal_revisions")
    .select("id, portal_id, status")
    .eq("id", revisionId)
    .eq("portal_id", context.portal.id)
    .eq("status", "issued")
    .maybeSingle();
  if (!revision) return { error: "Bu vinç kimliğine ait yayımlanmış sürüm bulunamadı." };

  const { error } = await context.supabase.rpc("activate_product_portal_revision", {
    p_revision_id: revisionId,
  });
  if (error) return { error: error.message || "Portal sürümü yeniden yayıma alınamadı." };
  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
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
  const customFolder = PORTAL_FOLDER_OPTIONS.find((entry) => entry.key === "diger");
  if (!customFolder) return { error: "Diğer belgeler klasörü tanımlı değil." };
  payload.documents.push({
    id: `custom:${randomUUID()}`,
    sourceKind: "custom",
    sourceId: storagePath,
    sourceLabel: "Elle yüklenen PDF",
    sourceRevisionLabel: "",
    title,
    folderKey: customFolder.key,
    folderTitle: customFolder.title,
    folderSort: customFolder.sort,
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

  /*
   * KİMLİK SNAPSHOT'I MATERYALİZASYONDAN ÖNCE YAZILIR — HATA HÂLİNDE GERİ ALINIR.
   *
   * Snapshot yayımın parçasıdır: müşteri, yayım anındaki kimliği görmelidir.
   * Ama önce yazılıp hata hâlinde geri ALINMIYORDU: başarısız bir deneme
   * taslağın kimliğini KALICI OLARAK donduruyor, `resolveAutomaticProductIdentity`
   * bir daha etkisini gösteremiyor ve kaynak raporda yapılan düzeltme kimliğe
   * hiç yansımıyordu. Kullanıcı bunu ancak plakada yanlış bir değer görüp
   * "neden güncellenmiyor" diye sorarak fark ederdi.
   */
  const automatic = await resolveAutomaticProductIdentity(context.supabase, projectId, payload);
  const payloadBeforeIssue = withProductPortalDefaults(context.revision.payload);
  payload.issuedIdentity = identityValues(automatic.fields);
  const { error: snapshotError } = await context.supabase
    .from("product_portal_revisions")
    .update({ payload })
    .eq("id", revisionId)
    .eq("status", "draft");
  if (snapshotError) return { error: "Kimlik snapshotı dondurulamadı." };

  const restoreDraftIdentity = async () => {
    delete payloadBeforeIssue.issuedIdentity;
    await context.supabase
      .from("product_portal_revisions")
      .update({ payload: payloadBeforeIssue })
      .eq("id", revisionId)
      .eq("status", "draft");
  };

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

  /*
   * ALT-İSTEK KULLANICININ BULUNDUĞU ADRESE GİDER, DAĞITIM ADRESİNE DEĞİL.
   *
   * Yayım, ağır PDF üreticilerini sayfa lambdasına taşımamak için aynı
   * origin'e auth'lu bir `fetch` atar (BELGE: "yayım action'ı PDF route
   * modülü import etmez"). Origin eskiden KOŞULSUZ `VERCEL_URL`den
   * kuruluyordu — oysa o, kullanıcının tarayıcıdaki alan adı değil DAĞITIMA
   * ÖZEL host'tur (`<proje>-<hash>-<takim>.vercel.app`). Takım hesaplarında
   * o adres Vercel'in dağıtım korumasının (SSO) arkasındadır: alt-istek
   * uygulamaya hiç ulaşmaz, 200 ile bir HTML duvarı döner ve kullanıcı
   * "Ekipman listesi PDF biçiminde üretilemedi." mesajını görür. Çerez de
   * zaten o host'a ait değildir.
   *
   * Sıra bu yüzden terstir: önce isteğin KENDİ host'u (çerezin ait olduğu
   * adres), yalnız o yoksa üretim adresi. `?.trim()` yerine `|| undefined`:
   * boş dizge nullish DEĞİLDİR ve `??` zinciri devreye girmeyip
   * `https://` gibi geçersiz bir origin üretiyordu.
   *
   * Protokol de hosttan TAHMİN EDİLMEZ: `next dev` düz HTTP dinler ve
   * `x-forwarded-proto` göndermez; `127.0.0.1:3000` ya da telefondan
   * `192.168.x.x:3000` ile girildiğinde "localhost" ile başlamadığı için
   * https seçiliyor ve el sıkışma reddediliyordu.
   */
  const headerStore = await headers();
  const uretimHost =
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim() || process.env.VERCEL_URL?.trim() || undefined;
  const host =
    headerStore.get("x-forwarded-host")?.trim()
    || headerStore.get("host")?.trim()
    || uretimHost
    || "localhost:3000";
  const proto =
    headerStore.get("x-forwarded-proto")?.trim()
    || (process.env.VERCEL ? "https" : "http");
  const requestOrigin = `${proto}://${host}`;
  const requestCookie = headerStore.get("cookie") ?? "";
  // OTURUM ÇEREZİ TAŞINAMIYORSA ALT-İSTEK OTURUMSUZ SAYILIR ve `proxy.ts`
  // onu `/login`e yollar; dönen 200 + text/html "PDF üretilemedi" diye
  // okunurdu. Sebebi burada, kaynağında söylemek gerekir.
  if (!requestCookie) {
    return { error: "Oturum çerezi okunamadı; sayfayı yenileyip yeniden deneyin." };
  }
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
        requestCookie,
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
    await restoreDraftIdentity();
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
