// Katalog sayfası sunucusu — `catalog-sheets/` altındaki üretici katalog
// sayfalarını YALNIZ oturum açmış kullanıcıya verir.
//
// Neden `public/` değil: bu dosyalar üretici kataloglarının sayfalarıdır.
// `public/` altına konsaydı kimlik doğrulamasız, tahmin edilebilir bir adreste
// yayında olurlardı. Buradan geçtiklerinde oturum şartı işler.
//
// Dizin gezme (path traversal) yüzeyi yoktur: istenen yol, manifestten üretilen
// İZİN LİSTESİNDE birebir yoksa dosya hiç okunmaz.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { catalogSheetFiles } from "@/lib/catalog-sheets";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const CONTENT_TYPES: Record<string, string> = {
  ".webp": "image/webp",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Oturum gerekli", { status: 401 });

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
      // Sayfalar sürüm sürüm değişmez; tarayıcı önbelleği ÖZELdir (oturumlu).
      "Cache-Control": "private, max-age=86400",
      "Content-Disposition": `inline; filename="${path.basename(relative)}"`,
      // Kimlik doğrulamalı içerik: aynı köken dışına gömülmesine izin verilmez.
      "X-Content-Type-Options": "nosniff",
    },
  });
}
