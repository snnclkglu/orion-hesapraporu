import { createAdminClient } from "@/lib/supabase/admin";
import { resolvePublicDrawingShare } from "@/lib/drawing-public-share";
import { protectDrawingPdf } from "@/lib/pdf/drawing-viewer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeFileName(value: string): string {
  return value.replace(/[\r\n"]/g, " ").trim() || "teknik-resim.pdf";
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const share = await resolvePublicDrawingShare(token).catch(() => null);
  if (!share) return new Response("Bağlantı bulunamadı veya kapatıldı", { status: 404 });

  const admin = createAdminClient();
  const { data: blob, error } = await admin.storage
    .from("drawings")
    .download(share.storagePath);
  if (error || !blob) return new Response("Dosya açılamadı", { status: 404 });

  try {
    const source = new Uint8Array(await blob.arrayBuffer());
    const mark = `MÜŞTERİ PAYLAŞIMI · ${share.shareId.slice(0, 8).toUpperCase()}`;
    const protectedBytes = await protectDrawingPdf(source, mark);
    const responseBytes = new Uint8Array(protectedBytes.byteLength);
    responseBytes.set(protectedBytes);

    return new Response(responseBytes.buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(safeFileName(share.fileName))}`,
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
