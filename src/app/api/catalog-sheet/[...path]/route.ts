// Katalog sayfası sunucusu — `catalog-sheets/` altındaki üretici katalog
// sayfalarını müşteri bağlantısına verir.
//
// Neden `public/` değil: istenen yol manifestten üretilen izin listesinde
// birebir doğrulanır. Böylece müşteri üyelik olmadan belirli katalog yaprağını
// açar ama sunucu dizini genel bir statik dosya alanına dönüşmez.
//
// Dizin gezme (path traversal) yüzeyi yoktur: istenen yol, manifestten üretilen
// İZİN LİSTESİNDE birebir yoksa dosya hiç okunmaz.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { catalogSheetFiles } from "@/lib/catalog-sheets";

export const runtime = "nodejs";

const CONTENT_TYPES: Record<string, string> = {
  ".webp": "image/webp",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: segments } = await params;
  const relative = (segments ?? []).join("/");
  if (!catalogSheetFiles().has(relative)) {
    return new Response("Katalog sayfası bulunamadı", { status: 404 });
  }

  const contentType = CONTENT_TYPES[path.extname(relative).toLowerCase()];
  if (!contentType) return new Response("Desteklenmeyen dosya", { status: 404 });

  let file: Buffer;
  try {
    file = await readFile(path.join(process.cwd(), "catalog-sheets", relative));
  } catch {
    // İzin listesinde var ama diskte yok → sayfa üretimi koşulmamış.
    return new Response(
      "Katalog sayfası dosyası yok — `python scripts/catalog-sheets.py` çalıştırın.",
      { status: 404 }
    );
  }

  return new Response(new Uint8Array(file), {
    status: 200,
    headers: {
      "Content-Type": contentType,
      // Üretici sayfası sürüm sürüm değişmez; müşteri tarayıcısı önbellekler.
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      "Content-Disposition": `inline; filename="${path.basename(relative)}"`,
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
      "Cross-Origin-Resource-Policy": "same-origin",
    },
  });
}
