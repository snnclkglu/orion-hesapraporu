// ÖZEL KOVADAKİ elektrik kataloğunu/föyünü oturumlu kullanıcıya açar.
//
// İstemciye depo yolu ya da uzun ömürlü imzalı bağlantı verilmez. Düğme
// kararlı belge UUID'sine gider; route oturumu ve DB kaydını doğrulayıp PDF'i
// `inline` döndürür. Böylece tarayıcı yeni sekmede kendi PDF görüntüleyicisini
// açar ve kullanıcı doğrudan ilgili teknik sayfaya ulaşır.

import { createClient } from "@/lib/supabase/server";
import {
  downloadElectricalCatalogDocument,
  loadElectricalCatalogDocuments,
} from "@/lib/electrical/catalog-data";

export const runtime = "nodejs";

function guvenliDosyaAdi(value: string): string {
  return value.replace(/[\r\n"]/g, " ").trim() || "elektrik-katalog.pdf";
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const { documentId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Oturum gerekli", { status: 401 });

  const document = (await loadElectricalCatalogDocuments(supabase, [documentId]))[0];
  if (!document) return new Response("Belge bulunamadı", { status: 404 });
  const bytes = await downloadElectricalCatalogDocument(supabase, document);
  if (!bytes) return new Response("Belge açılamadı", { status: 404 });
  const fileName = guvenliDosyaAdi(document.fileName);
  const responseBytes = new Uint8Array(bytes.byteLength);
  responseBytes.set(bytes);
  return new Response(responseBytes.buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "Cache-Control": "private, max-age=300",
    },
  });
}
