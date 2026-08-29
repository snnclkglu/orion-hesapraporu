import "server-only";

import { createHmac } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { withProductPortalDefaults } from "./identity";
import { sha256 } from "./secrets";
import type { CustomerPortalDto, ProductPortalFileDto } from "./types";

export const PUBLIC_CODE_PATTERN = /^[A-Z0-9]{16}$/;
export const PORTAL_SESSION_HOURS = 12;

export function normalizedPublicCode(value: string): string {
  return value.trim().toUpperCase();
}

export function portalCookieName(publicCode: string): string {
  return `ocp_${normalizedPublicCode(publicCode)}`;
}

export function portalRequestFingerprints(
  request: Request,
  publicCode: string
): { codeHash: string; ipHash: string; userAgentHash: string } {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || request.headers.get("x-real-ip")?.trim() || "unknown";
  const agent = request.headers.get("user-agent")?.slice(0, 500) || "unknown";
  const pepper =
    process.env.PORTAL_AUDIT_SECRET ??
    process.env.SUPABASE_SECRET_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!pepper) throw new Error("Portal denetim anahtarı tanımlı değil.");
  const hmac = (value: string) => createHmac("sha256", pepper).update(value).digest("hex");
  return {
    codeHash: sha256(normalizedPublicCode(publicCode)),
    ipHash: hmac(ip),
    userAgentHash: hmac(agent),
  };
}

interface PortalSessionContext {
  unit: {
    id: string;
    portalId: string;
    serialNo: string;
    publicCode: string;
    passwordVersion: number;
  };
  portal: { id: string; projectId: string; currentRevisionId: string };
  revision: { id: string; revNo: number; payload: ReturnType<typeof withProductPortalDefaults>; issuedAt: string };
  sessionId: string;
}

/** Sayfa ve her belge route'u bunu yeniden çağırır; Proxy güvenlik kapısı değildir. */
export async function resolvePortalSession(
  publicCodeValue: string,
  rawSessionToken: string | undefined
): Promise<PortalSessionContext | null> {
  const publicCode = normalizedPublicCode(publicCodeValue);
  if (!PUBLIC_CODE_PATTERN.test(publicCode) || !rawSessionToken || rawSessionToken.length !== 43) return null;
  const admin = createAdminClient();

  const { data: unit } = await admin
    .from("crane_units")
    .select("id, portal_id, serial_no, public_code, password_version, portal_enabled")
    .eq("public_code", publicCode)
    .eq("portal_enabled", true)
    .maybeSingle();
  if (!unit) return null;

  const { data: session } = await admin
    .from("product_portal_sessions")
    .select("id, unit_id, password_version, expires_at, revoked_at")
    .eq("token_hash", sha256(rawSessionToken))
    .eq("unit_id", unit.id)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (!session || Number(session.password_version) !== Number(unit.password_version)) return null;

  const { data: portal } = await admin
    .from("product_portals")
    .select("id, project_id, current_revision_id")
    .eq("id", unit.portal_id)
    .maybeSingle();
  if (!portal?.current_revision_id) return null;

  const { data: revision } = await admin
    .from("product_portal_revisions")
    .select("id, rev_no, status, payload, issued_at")
    .eq("id", portal.current_revision_id)
    .eq("portal_id", portal.id)
    .eq("status", "issued")
    .maybeSingle();
  if (!revision?.issued_at) return null;

  return {
    unit: {
      id: String(unit.id),
      portalId: String(unit.portal_id),
      serialNo: String(unit.serial_no),
      publicCode: String(unit.public_code),
      passwordVersion: Number(unit.password_version),
    },
    portal: {
      id: String(portal.id),
      projectId: String(portal.project_id),
      currentRevisionId: String(portal.current_revision_id),
    },
    revision: {
      id: String(revision.id),
      revNo: Number(revision.rev_no),
      payload: withProductPortalDefaults(revision.payload),
      issuedAt: String(revision.issued_at),
    },
    sessionId: String(session.id),
  };
}

function fileDto(file: Record<string, unknown>): ProductPortalFileDto {
  return {
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
  };
}

export async function loadCustomerPortalDto(
  publicCode: string,
  rawSessionToken: string | undefined
): Promise<CustomerPortalDto | null> {
  const session = await resolvePortalSession(publicCode, rawSessionToken);
  if (!session) return null;
  const admin = createAdminClient();
  const { data: files } = await admin
    .from("product_portal_files")
    .select("id, folder_key, folder_title, folder_sort, file_sort, display_name, file_name, source_revision_label, access_mode, size_bytes, page_count")
    .eq("revision_id", session.revision.id)
    .order("folder_sort", { ascending: true })
    .order("file_sort", { ascending: true });
  const identity = session.revision.payload.issuedIdentity;
  if (!identity) return null;
  return {
    company: identity.manufacturer || "ORION CRANES",
    portalTitle: session.revision.payload.portal.title,
    note: session.revision.payload.portal.note,
    supportEmail: session.revision.payload.portal.supportEmail,
    product: identity.product,
    craneType: identity.craneType,
    serialNo: session.unit.serialNo,
    productionYear: identity.productionYear,
    projectCode: identity.projectCode,
    revisionLabel: `R${String(session.revision.revNo).padStart(2, "0")}`,
    publishedAt: session.revision.issuedAt,
    files: ((files ?? []) as Record<string, unknown>[]).map(fileDto),
    publicCode: session.unit.publicCode,
  };
}

export async function resolvePortalDocument(
  publicCode: string,
  rawSessionToken: string | undefined,
  documentId: string
): Promise<{
  session: PortalSessionContext;
  file: ProductPortalFileDto & { storagePath: string; mimeType: string };
} | null> {
  if (!/^[0-9a-f-]{36}$/i.test(documentId)) return null;
  const session = await resolvePortalSession(publicCode, rawSessionToken);
  if (!session) return null;
  const { data } = await createAdminClient()
    .from("product_portal_files")
    .select("id, folder_key, folder_title, folder_sort, file_sort, display_name, file_name, source_revision_label, access_mode, size_bytes, page_count, storage_path, mime_type")
    .eq("id", documentId)
    .eq("revision_id", session.revision.id)
    .maybeSingle();
  if (!data?.storage_path) return null;
  return {
    session,
    file: {
      ...fileDto(data as Record<string, unknown>),
      storagePath: String(data.storage_path),
      mimeType: String(data.mime_type ?? "application/pdf"),
    },
  };
}

export function customerPortalDtoForPreview({
  identity,
  serialNo,
  publicCode,
  payload,
  revisionNo,
  publishedAt,
  files,
}: {
  identity: ProductPortalPayloadIdentity;
  serialNo: string;
  publicCode: string;
  payload: ReturnType<typeof withProductPortalDefaults>;
  revisionNo: number;
  publishedAt?: string;
  files: ProductPortalFileDto[];
}): CustomerPortalDto {
  return {
    company: identity.manufacturer || "ORION CRANES",
    portalTitle: payload.portal.title,
    note: payload.portal.note,
    supportEmail: payload.portal.supportEmail,
    product: identity.product,
    craneType: identity.craneType,
    serialNo,
    productionYear: identity.productionYear,
    projectCode: identity.projectCode,
    revisionLabel: `R${String(revisionNo).padStart(2, "0")}`,
    publishedAt: publishedAt ?? new Date().toISOString(),
    files,
    publicCode,
    preview: true,
  };
}

type ProductPortalPayloadIdentity = NonNullable<ReturnType<typeof withProductPortalDefaults>["issuedIdentity"]>;
