import { createAdminClient } from "@/lib/supabase/admin";
import { protectDrawingPdf } from "@/lib/pdf/drawing-viewer";
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
function safeFileName(value: string): string {
  return value.replace(/[\r\n"]/g, " ").trim() || "dokuman.pdf";
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string; documentId: string }> }
) {
  const { code: rawCode, documentId } = await params;
  const code = normalizedPublicCode(rawCode);
  const token = cookieValue(request, portalCookieName(code));
  const resolved = await resolvePortalDocument(code, token, documentId).catch(() => null);
  if (!resolved || resolved.file.accessMode !== "view_watermarked") {
    return new Response("Belge bulunamadı", { status: 404 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.storage.from("customer-portal").download(resolved.file.storagePath);
  if (error || !data) return new Response("Belge açılamadı", { status: 404 });
  try {
    const source = new Uint8Array(await data.arrayBuffer());
    const stamp = new Date().toLocaleDateString("tr-TR");
    const mark = `MÜŞTERİ PORTALI · ${resolved.session.unit.serialNo} · ${resolved.session.sessionId.slice(0, 8).toUpperCase()} · ${stamp}`;
    const protectedBytes = await protectDrawingPdf(source, mark);
    const responseBytes = new Uint8Array(protectedBytes.byteLength);
    responseBytes.set(protectedBytes);
    const fingerprints = portalRequestFingerprints(request, code);
    await admin.from("product_portal_access_events").insert({
      unit_id: resolved.session.unit.id,
      code_hash: fingerprints.codeHash,
      ip_hash: fingerprints.ipHash,
      user_agent_hash: fingerprints.userAgentHash,
      result: "document_view",
      document_id: documentId,
    });
    return new Response(responseBytes.buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(safeFileName(resolved.file.fileName))}`,
        "Content-Length": String(responseBytes.byteLength),
        "Cache-Control": "private, no-store, max-age=0, must-revalidate",
        Pragma: "no-cache",
        "X-Content-Type-Options": "nosniff",
        "X-Robots-Tag": "noindex, nofollow, noarchive",
        "Cross-Origin-Resource-Policy": "same-origin",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch {
    return new Response("PDF güvenli görüntüleme için hazırlanamadı", { status: 422 });
  }
}
