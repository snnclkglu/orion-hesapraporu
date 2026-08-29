import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { buildManualSourceData } from "@/app/(app)/projects/[id]/manual/sources-data";
import { loadCurrentElectricalDoc } from "@/lib/electrical/data";
import { loadManual, loadManualRevisions } from "@/lib/manual/data";
import { loadCurrentSpec } from "@/lib/project-specs";
import { getReportSettings } from "@/lib/settings";
import {
  identityValues,
  resolveIdentityFields,
  withProductPortalDefaults,
} from "./identity";
import type {
  CraneUnitRow,
  IdentitySource,
  PortalDocumentSelection,
  ProductIdentityField,
  ProductIdentityValues,
  ProductPortalFileDto,
  ProductPortalPayload,
  ProductPortalRevisionRow,
  ResolvedIdentityField,
} from "./types";

export const CUSTOMER_PORTAL_BUCKET = "customer-portal";

export interface ProductPortalWorkspace {
  portalId: string;
  projectId: string;
  currentRevisionId: string | null;
  revisions: ProductPortalRevisionRow[];
  editableRevision: ProductPortalRevisionRow | null;
  units: CraneUnitRow[];
  identityFields: ResolvedIdentityField[];
  identity: ProductIdentityValues;
  publishedFiles: ProductPortalFileDto[];
}

const EMPTY_VALUES: ProductIdentityValues = {
  manufacturer: "",
  product: "",
  craneType: "",
  projectCode: "",
  productionYear: "",
  capacity: "",
  span: "",
  liftHeight: "",
  dutyClass: "",
  supplyVoltage: "",
  controlVoltage: "",
  frequency: "",
  customer: "",
  site: "",
};

function source(
  kind: IdentitySource["kind"],
  label: string,
  sourceId?: string,
  revisionLabel?: string
): IdentitySource {
  return { kind, label, ...(sourceId ? { sourceId } : {}), ...(revisionLabel ? { revisionLabel } : {}) };
}

function findSpec(
  rows: readonly { label: string; value: string }[] | undefined,
  pattern: RegExp
): string {
  return rows?.find((row) => pattern.test(row.label))?.value ?? "";
}

/**
 * Plaka alanlarının tek otomatik çözücüsü. Bilinmeyen değer boş kalır; her
 * alan kaynağını da taşır ki kullanıcı hangi bölümden geldiğini görsün.
 */
export async function resolveAutomaticProductIdentity(
  supabase: SupabaseClient,
  projectId: string,
  payload: ProductPortalPayload
): Promise<{ fields: ResolvedIdentityField[]; values: ProductIdentityValues }> {
  const [{ data: project }, { data: items }, { data: revisions }, settings, manualSources] =
    await Promise.all([
      supabase
        .from("projects")
        .select("id, doc_no, name, customer, crane_type, crane_location")
        .eq("id", projectId)
        .maybeSingle(),
      supabase
        .from("job_items")
        .select("id, item_no, product_name, quantity")
        .eq("project_id", projectId)
        .order("sort", { ascending: true })
        .limit(1),
      supabase
        .from("revisions")
        .select("id, rev_no, status")
        .eq("project_id", projectId)
        .order("rev_no", { ascending: false }),
      getReportSettings(supabase),
      buildManualSourceData(supabase, projectId),
    ]);

  const item = items?.[0] ?? null;
  const report = (revisions ?? []).find((entry) => entry.status === "issued") ?? revisions?.[0] ?? null;
  const cover = manualSources.coverSpecs ?? [];
  const characteristics = manualSources.characteristics ?? [];
  const reportLabel = report ? `Hesap Raporu · V${report.rev_no}` : "Hesap Raporu";

  const automatic: ProductIdentityValues = {
    ...EMPTY_VALUES,
    manufacturer: settings.company.trim(),
    product: String(item?.product_name ?? project?.name ?? "").trim(),
    craneType: String(project?.crane_type ?? "").trim(),
    projectCode: String(item?.item_no ?? project?.doc_no ?? "").trim(),
    productionYear: String(new Date().getFullYear()),
    capacity: findSpec(cover, /^KAPASİTE$/i),
    span: findSpec(cover, /^AÇIKLIK$/i),
    liftHeight: findSpec(cover, /KALDIRMA YÜKSEKLİĞİ/i),
    dutyClass: [
      findSpec(cover, /FEM SINIFI/i),
      findSpec(cover, /ÇELİK KONSTRÜKSİYON SINIFI/i),
    ].filter(Boolean).join(" · "),
    supplyVoltage: findSpec(characteristics, /besleme.*gerilim|çalışma.*gerilim|şebeke.*gerilim/i),
    controlVoltage: findSpec(characteristics, /kumanda.*gerilim|kontrol.*gerilim/i),
    frequency: findSpec(characteristics, /frekans/i),
    customer: String(project?.customer ?? "").trim(),
    site: String(project?.crane_location ?? "").trim(),
  };

  const projectSource = source("project", "Proje künyesi", String(project?.id ?? ""));
  const itemSource = source("job_item", "İş emri kalemi", String(item?.id ?? ""));
  const reportSource = source(
    "report",
    reportLabel,
    report ? String(report.id) : undefined,
    report ? `V${report.rev_no}` : undefined
  );
  const sources: Record<ProductIdentityField, IdentitySource> = {
    manufacturer: source("settings", "Rapor / firma ayarları"),
    product: item ? itemSource : projectSource,
    craneType: projectSource,
    projectCode: item ? itemSource : projectSource,
    productionYear: source("system", "Kimlik oluşturma yılı"),
    capacity: reportSource,
    span: reportSource,
    liftHeight: reportSource,
    dutyClass: reportSource,
    supplyVoltage: reportSource,
    controlVoltage: reportSource,
    frequency: reportSource,
    customer: projectSource,
    site: projectSource,
  };
  const fields = resolveIdentityFields(automatic, sources, payload.overrides);
  return { fields, values: identityValues(fields) };
}

function documentCandidate(
  input: Omit<PortalDocumentSelection, "included" | "automatic" | "ready"> &
    Partial<Pick<PortalDocumentSelection, "included" | "automatic" | "ready">>
): PortalDocumentSelection {
  return {
    ...input,
    included: input.included ?? true,
    automatic: input.automatic ?? true,
    ready: input.ready ?? true,
  };
}

/** İç bölümlerden bulunan teslim edilebilir PDF'ler; henüz müşteri yayını değildir. */
export async function discoverPortalDocuments(
  supabase: SupabaseClient,
  projectId: string
): Promise<PortalDocumentSelection[]> {
  const [{ data: project }, { data: revisions }, manual, electrical, spec, { data: itemRows }] =
    await Promise.all([
      supabase.from("projects").select("doc_no, name").eq("id", projectId).maybeSingle(),
      supabase
        .from("revisions")
        .select("id, rev_no, label, status")
        .eq("project_id", projectId)
        .eq("status", "issued")
        .order("rev_no", { ascending: false }),
      loadManual(supabase, projectId),
      loadCurrentElectricalDoc(supabase, projectId),
      loadCurrentSpec(supabase, projectId),
      supabase.from("job_items").select("id, item_no").eq("project_id", projectId),
    ]);

  const output: PortalDocumentSelection[] = [];
  const report = revisions?.[0] ?? null;
  if (report) {
    output.push(documentCandidate({
      id: `report:${report.id}`,
      sourceKind: "report",
      sourceId: String(report.id),
      sourceLabel: "Yayımlanmış hesap raporu arşivi",
      sourceRevisionLabel: `V${report.rev_no}`,
      title: `Hesap Raporu · V${report.rev_no}`,
      folderKey: "proje-belgeleri",
      folderTitle: "Proje Belgeleri",
      folderSort: 10,
      fileSort: 10,
      accessMode: "view_watermarked",
    }));
    output.push(documentCandidate({
      id: `equipment:${report.id}`,
      sourceKind: "equipment",
      sourceId: String(report.id),
      sourceLabel: "Hesap raporu revizyonundan otomatik üretilir",
      sourceRevisionLabel: `V${report.rev_no}`,
      title: `Ekipman Listesi · V${report.rev_no}`,
      folderKey: "ekipman",
      folderTitle: "Ekipman Listeleri",
      folderSort: 20,
      fileSort: 10,
      accessMode: "view_watermarked",
    }));
  }

  if (manual) {
    const issued = (await loadManualRevisions(supabase, manual.id)).find((entry) => entry.status === "issued");
    if (issued) output.push(documentCandidate({
      id: `manual:${issued.id}`,
      sourceKind: "manual",
      sourceId: issued.id,
      sourceLabel: "Yayımlanmış işletme ve bakım el kitabı",
      sourceRevisionLabel: `V${issued.revNo}`,
      title: `İşletme ve Bakım El Kitabı · V${issued.revNo}`,
      folderKey: "proje-belgeleri",
      folderTitle: "Proje Belgeleri",
      folderSort: 10,
      fileSort: 20,
      // Dijital kullanım talimatı müşterinin kaydedip yazdırabilmesi için indirilir.
      accessMode: "download",
    }));
  }

  if (electrical) output.push(documentCandidate({
    id: `electrical:${electrical.id}`,
    sourceKind: "electrical",
    sourceId: electrical.id,
    sourceLabel: "Güncel olarak işaretlenmiş elektrik projesi",
    sourceRevisionLabel: electrical.revision,
    title: `Elektrik Projesi${electrical.revision ? ` · ${electrical.revision}` : ""}`,
    folderKey: "elektrik",
    folderTitle: "Elektrik Belgeleri",
    folderSort: 30,
    fileSort: 10,
    accessMode: "view_watermarked",
  }));

  if (spec && spec.contentType === "application/pdf") output.push(documentCandidate({
    id: `specification:${spec.id}`,
    sourceKind: "specification",
    sourceId: spec.id,
    sourceLabel: "Güncel teknik şartname",
    sourceRevisionLabel: spec.revision,
    title: `Teknik Şartname${spec.revision ? ` · ${spec.revision}` : ""}`,
    folderKey: "proje-belgeleri",
    folderTitle: "Proje Belgeleri",
    folderSort: 10,
    fileSort: 30,
    accessMode: "download",
  }));

  const itemIds = (itemRows ?? []).map((entry) => String(entry.id));
  const itemNos = (itemRows ?? []).map((entry) => String(entry.item_no ?? "")).filter(Boolean);
  if (itemIds.length > 0 || itemNos.length > 0) {
    const filters: string[] = [];
    if (itemIds.length > 0) filters.push(`job_item_id.in.(${itemIds.join(",")})`);
    if (itemNos.length > 0) filters.push(`item_no.in.(${itemNos.map((no) => `"${no.replaceAll('"', "")}"`).join(",")})`);
    const { data: packages } = await supabase
      .from("drawing_packages")
      .select("id, folder_name, rev_no, status")
      .or(filters.join(","))
      .neq("status", "superse")
      .order("rev_no", { ascending: false });
    const packageIds = (packages ?? []).map((entry) => String(entry.id));
    if (packageIds.length > 0) {
      const { data: files } = await supabase
        .from("drawing_files")
        .select("id, package_id, file_name, storage_path, stored")
        .in("package_id", packageIds)
        .eq("stored", true)
        .eq("lifecycle", "canli")
        .ilike("file_name", "%.pdf")
        .order("file_name", { ascending: true });
      for (const [index, file] of (files ?? []).entries()) {
        const pack = (packages ?? []).find((entry) => entry.id === file.package_id);
        output.push(documentCandidate({
          id: `drawing:${file.id}`,
          sourceKind: "drawing",
          sourceId: String(file.id),
          sourceLabel: String(pack?.folder_name ?? "Teknik resim paketi"),
          sourceRevisionLabel: pack ? `R${String(pack.rev_no).padStart(2, "0")}` : "",
          title: String(file.file_name).replace(/\.pdf$/i, ""),
          folderKey: "teknik-resimler",
          folderTitle: "Teknik Resimler",
          folderSort: 40,
          fileSort: index + 1,
          accessMode: "view_watermarked",
          // Yüzlerce imalat paftasını fark edilmeden yayımlamamak için bulunur
          // ama ilk kez insan seçimi bekler.
          included: false,
        }));
      }
    }
  }

  void project;
  return output;
}

/** Yeni bulunan kaynakları kullanıcı seçimini bozmadan taslağa ekler. */
export function mergeDiscoveredDocuments(
  existing: readonly PortalDocumentSelection[],
  discovered: readonly PortalDocumentSelection[]
): PortalDocumentSelection[] {
  const byId = new Map(discovered.map((entry) => [entry.id, entry]));
  const merged = existing.map((entry) => {
    const fresh = byId.get(entry.id);
    if (!fresh || entry.sourceKind === "custom") return entry;
    byId.delete(entry.id);
    return {
      ...fresh,
      title: entry.title,
      folderKey: entry.folderKey,
      folderTitle: entry.folderTitle,
      folderSort: entry.folderSort,
      fileSort: entry.fileSort,
      accessMode: entry.accessMode,
      included: entry.included,
    };
  });
  return [...merged, ...byId.values()].sort(
    (a, b) => a.folderSort - b.folderSort || a.fileSort - b.fileSort || a.title.localeCompare(b.title, "tr")
  );
}

function revisionRow(raw: Record<string, unknown>): ProductPortalRevisionRow {
  return {
    id: String(raw.id),
    revNo: Number(raw.rev_no),
    status: raw.status === "issued" ? "issued" : "draft",
    payload: withProductPortalDefaults(raw.payload),
    createdAt: String(raw.created_at ?? ""),
    issuedAt: raw.issued_at ? String(raw.issued_at) : null,
  };
}

export async function loadProductPortalWorkspace(
  supabase: SupabaseClient,
  projectId: string
): Promise<ProductPortalWorkspace | null> {
  const { data: portal } = await supabase
    .from("product_portals")
    .select("id, project_id, current_revision_id")
    .eq("project_id", projectId)
    .maybeSingle();
  if (!portal) return null;

  const [{ data: revisionData }, { data: unitData }] = await Promise.all([
    supabase
      .from("product_portal_revisions")
      .select("id, rev_no, status, payload, created_at, issued_at")
      .eq("portal_id", portal.id)
      .order("rev_no", { ascending: false }),
    supabase
      .from("crane_units")
      .select("id, ordinal, suffix, serial_no, public_code, has_password, password_version, portal_enabled")
      .eq("portal_id", portal.id)
      .order("ordinal", { ascending: true }),
  ]);
  const revisions = ((revisionData ?? []) as Record<string, unknown>[]).map(revisionRow);
  const editableRevision = revisions.find((entry) => entry.status === "draft") ?? null;
  const displayRevision = editableRevision ?? revisions.find((entry) => entry.id === portal.current_revision_id) ?? revisions[0] ?? null;
  if (!displayRevision) return null;

  const payload = displayRevision.payload;
  const automatic = payload.issuedIdentity
    ? {
        fields: resolveIdentityFields(
          payload.issuedIdentity,
          Object.fromEntries(Object.keys(payload.issuedIdentity).map((key) => [
            key,
            source("system", "Yayımlanmış kimlik snapshotı"),
          ])) as Record<ProductIdentityField, IdentitySource>,
          {}
        ),
        values: payload.issuedIdentity,
      }
    : await resolveAutomaticProductIdentity(supabase, projectId, payload);

  let publishedFiles: ProductPortalFileDto[] = [];
  if (portal.current_revision_id) {
    const { data } = await supabase
      .from("product_portal_files")
      .select("id, folder_key, folder_title, folder_sort, file_sort, display_name, file_name, source_revision_label, access_mode, size_bytes, page_count")
      .eq("revision_id", portal.current_revision_id)
      .order("folder_sort", { ascending: true })
      .order("file_sort", { ascending: true });
    publishedFiles = ((data ?? []) as Record<string, unknown>[]).map((file) => ({
      id: String(file.id),
      folderKey: String(file.folder_key),
      folderTitle: String(file.folder_title),
      folderSort: Number(file.folder_sort),
      fileSort: Number(file.file_sort),
      title: String(file.display_name),
      fileName: String(file.file_name),
      revisionLabel: String(file.source_revision_label ?? ""),
      accessMode: file.access_mode === "download" ? "download" : "view_watermarked",
      sizeBytes: Number(file.size_bytes),
      pageCount: Number(file.page_count),
    }));
  }

  return {
    portalId: String(portal.id),
    projectId,
    currentRevisionId: portal.current_revision_id ? String(portal.current_revision_id) : null,
    revisions,
    editableRevision,
    units: ((unitData ?? []) as Record<string, unknown>[]).map((unit) => ({
      id: String(unit.id),
      ordinal: Number(unit.ordinal),
      suffix: String(unit.suffix ?? ""),
      serialNo: String(unit.serial_no),
      publicCode: String(unit.public_code),
      hasPassword: unit.has_password === true,
      passwordVersion: Number(unit.password_version ?? 0),
      portalEnabled: unit.portal_enabled === true,
    })),
    identityFields: automatic.fields,
    identity: automatic.values,
    publishedFiles,
  };
}
