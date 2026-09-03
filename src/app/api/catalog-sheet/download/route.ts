// Seçilen ürünün manifestte izin verilen katalog görüntülerini tek, çok
// sayfalı PDF olarak indirir. Ürün başına en çok dört sayfa kullanılır; sınır
// `catalogSheetImages` ile açılır pencere ve ekipman raporuyla ortaktır.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument } from "pdf-lib";
import sharp from "sharp";
import { catalogSheetImages, findCatalogSheet } from "@/lib/catalog-sheets";

export const runtime = "nodejs";

const A4_PORTRAIT: [number, number] = [595.28, 841.89];
const MARGIN = 12;

function first(search: URLSearchParams, key: string): string {
  return search.get(key)?.trim() ?? "";
}

function fileName(title: string): string {
  return `${title.replace(/[\\/:*?"<>|]/g, "-").trim() || "Katalog"}.pdf`;
}

export async function GET(request: Request) {
  const search = new URL(request.url).searchParams;
  const kind = first(search, "tur");
  const brand = first(search, "marka");
  const model = first(search, "model");
  const inputRpmRaw = first(search, "n1");
  const inputRpm = inputRpmRaw ? Number(inputRpmRaw) : undefined;
  const sheet = kind && model
    ? findCatalogSheet(kind, brand || null, model, {
        inputRpm: Number.isFinite(inputRpm) ? inputRpm : undefined,
      })
    : undefined;
  if (!sheet) return new Response("Katalog sayfası bulunamadı", { status: 404 });

  const pdf = await PDFDocument.create();
  for (const relative of catalogSheetImages(sheet)) {
    let converted: { data: Buffer; info: sharp.OutputInfo };
    try {
      const raw = await readFile(path.join(process.cwd(), "catalog-sheets", relative));
      converted = await sharp(raw)
        .rotate()
        .flatten({ background: "#ffffff" })
        .jpeg({ quality: 90, progressive: false })
        .toBuffer({ resolveWithObject: true });
    } catch {
      return new Response("Katalog sayfası dosyası açılamadı", { status: 404 });
    }

    const embedded = await pdf.embedJpg(converted.data);
    const landscape = converted.info.width > converted.info.height;
    const pageSize: [number, number] = landscape
      ? [A4_PORTRAIT[1], A4_PORTRAIT[0]]
      : A4_PORTRAIT;
    const page = pdf.addPage(pageSize);
    const maxWidth = page.getWidth() - MARGIN * 2;
    const maxHeight = page.getHeight() - MARGIN * 2;
    const scale = Math.min(maxWidth / embedded.width, maxHeight / embedded.height);
    const width = embedded.width * scale;
    const height = embedded.height * scale;
    page.drawImage(embedded, {
      x: (page.getWidth() - width) / 2,
      y: (page.getHeight() - height) / 2,
      width,
      height,
    });
  }

  const bytes = await pdf.save();
  const responseBytes = new Uint8Array(bytes.byteLength);
  responseBytes.set(bytes);
  const name = fileName(sheet.title);
  const asciiName = name.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "'");
  return new Response(responseBytes.buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(responseBytes.byteLength),
      "Content-Disposition": `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(name)}`,
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
    },
  });
}
