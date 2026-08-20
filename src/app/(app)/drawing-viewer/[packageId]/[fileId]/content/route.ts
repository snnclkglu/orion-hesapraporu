// Teknik resim PDF baytlarının KORUMALI UCU.
//
// Görüntüleme akışı Supabase storage_path'e ya da imzalı URL'ye yönlenmez.
// Her istek oturum ve RLS üzerinden dosya + paket bağını doğrular; asıl yerine
// kişiye özel filigranlı bir görüntüleme kopyası döner.

import { createClient } from "@/lib/supabase/server";
import { protectDrawingPdf } from "@/lib/pdf/drawing-viewer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeFileName(value: string): string {
  return value.replace(/[\r\n"]/g, " ").trim() || "teknik-resim.pdf";
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ packageId: string; fileId: string }> }
) {
  const { packageId, fileId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Oturum gerekli", { status: 401 });

  // `fileId` tek başına yeterli görünse de paket bağı da sorulur: adresin
  // künyesi ile açılan dosyanın farklı paketlere ait olması sessizce kabul
  // edilmez. Tablo okumasındaki RLS asıl yetki kapısıdır.
  const { data } = await supabase
    .from("drawing_files")
    .select("id, package_id, file_name, storage_path")
    .eq("id", fileId)
    .eq("package_id", packageId)
    .maybeSingle();
  const file = data as {
    id: string;
    package_id: string;
    file_name: string;
    storage_path: string;
  } | null;
  if (!file || !file.storage_path) return new Response("Dosya bulunamadı", { status: 404 });
  if (!/\.pdf$/i.test(file.file_name)) {
    return new Response("Bu görüntüleyici yalnız PDF açar", { status: 415 });
  }

  const { data: blob, error } = await supabase.storage
    .from("drawings")
    .download(file.storage_path);
  if (error || !blob) return new Response("Dosya açılamadı", { status: 404 });

  try {
    const source = new Uint8Array(await blob.arrayBuffer());
    const protectedBytes = await protectDrawingPdf(source, user.email ?? user.id);
    const responseBytes = new Uint8Array(protectedBytes.byteLength);
    responseBytes.set(protectedBytes);
    const fileName = safeFileName(file.file_name);

    return new Response(responseBytes.buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        "Content-Length": String(responseBytes.byteLength),
        "Cache-Control": "private, no-store, max-age=0, must-revalidate",
        Pragma: "no-cache",
        "X-Content-Type-Options": "nosniff",
        "X-Robots-Tag": "noindex, nofollow, noarchive",
        "Cross-Origin-Resource-Policy": "same-origin",
        "Referrer-Policy": "no-referrer",
        Vary: "Cookie",
      },
    });
  } catch {
    // Parolalı/bozuk PDF'te aslı filigransız döndürülmez; koruma sessizce
    // gevşemek yerine kullanıcıya açık bir hata verir.
    return new Response("PDF güvenli görüntüleme için hazırlanamadı", { status: 422 });
  }
}
