import { createAdminClient } from "@/lib/supabase/admin";
import {
  normalizedPublicCode,
  portalCookieName,
  portalRequestFingerprints,
  resolvePortalDocument,
} from "@/lib/product-portal/access-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cookieValue(request: Request, name: string): string | undefined {
  const cookie = request.headers.get("cookie") ?? "";
  for (const part of cookie.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return undefined;
}
export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string; documentId: string }> }
) {
  const { code: rawCode, documentId } = await params;
  const code = normalizedPublicCode(rawCode);
  const resolved = await resolvePortalDocument(
    code,
    cookieValue(request, portalCookieName(code)),
    documentId
  ).catch(() => null);
  if (!resolved || resolved.file.accessMode !== "download") {
    return new Response("Belge bulunamadı", { status: 404 });
  }
  const admin = createAdminClient();
  const { data, error } = await admin.storage.from("customer-portal").download(resolved.file.storagePath);
  if (error || !data) return new Response("Belge açılamadı", { status: 404 });
  const bytes = new Uint8Array(await data.arrayBuffer());
  const fingerprints = portalRequestFingerprints(request, code);
  await admin.from("product_portal_access_events").insert({
    unit_id: resolved.session.unit.id,
    code_hash: fingerprints.codeHash,
    ip_hash: fingerprints.ipHash,
    user_agent_hash: fingerprints.userAgentHash,
    result: "document_download",
    document_id: documentId,
  });
  return new Response(bytes, {
    headers: {
      "Content-Type": resolved.file.mimeType,
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(resolved.file.fileName)}`,
      "Content-Length": String(bytes.byteLength),
      "Cache-Control": "private, no-store, max-age=0, must-revalidate",
      Pragma: "no-cache",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
      "Referrer-Policy": "no-referrer",
    },
  });
}
