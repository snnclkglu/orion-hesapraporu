import "server-only";
import { createClient } from "@/lib/supabase/server";
import sharp from "sharp";
export async function accountContext() {
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) throw new Error("Oturumunuz sona erdi. Yeniden giriş yapın.");
  return { db, user };
}
export function accountError(error: unknown) {
  if (error instanceof Error && !error.message.includes("fetch"))
    return error.message;
  return "İşlem tamamlanamadı. Bilgileriniz korunuyor; yeniden deneyin.";
}
export function checkDb(error: { code?: string; message?: string } | null) {
  if (!error) return;
  if (error.code === "40001")
    throw new Error(
      "Kayıt başka bir işlemle değişti. Sayfayı yenileyip tekrar deneyin.",
    );
  if (error.code === "42501") throw new Error("Bu işlem için yetkiniz yok.");
  if (error.code === "23514")
    throw new Error(error.message || "Bilgileri kontrol edin.");
  throw new Error("Kaydedilemedi. Yeniden deneyin.");
}
export async function normalizeImage(
  file: File,
  size: number,
  crop?: { zoom: number; x: number; y: number },
) {
  if (file.size < 1 || file.size > 10 * 1024 * 1024)
    throw new Error("Görsel en fazla 10 MB olabilir.");
  let bytes: Buffer = Buffer.from(await file.arrayBuffer());
  try {
    if (
      bytes.subarray(4, 8).toString() === "ftyp" &&
      /heic|heix|hevc|hevx|mif1|msf1/.test(bytes.subarray(8, 32).toString())
    ) {
      const { decodeHeic } = await import("./heic");
      bytes = await decodeHeic(bytes);
    }
    const source = sharp(bytes, {
      limitInputPixels: 40000000,
      animated: false,
    });
    const metadata = await source.metadata();
    if (!["jpeg", "png", "webp", "heif"].includes(metadata.format ?? ""))
      throw new Error("format");
    const normalized = await source
      .rotate()
      .toBuffer({ resolveWithObject: true });
    let pipeline = sharp(normalized.data);
    if (crop) {
      const zoom = Math.min(3, Math.max(1, crop.zoom));
      const side = Math.max(
        1,
        Math.floor(
          Math.min(normalized.info.width, normalized.info.height) / zoom,
        ),
      );
      const left = Math.round(
        (normalized.info.width - side) * Math.min(1, Math.max(0, crop.x)),
      );
      const top = Math.round(
        (normalized.info.height - side) * Math.min(1, Math.max(0, crop.y)),
      );
      pipeline = pipeline.extract({ left, top, width: side, height: side });
    }
    return await pipeline
      .resize(size, size, {
        fit: crop ? "cover" : "inside",
        withoutEnlargement: !crop,
      })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    throw new Error(
      "Görsel açılamadı veya 40 megapiksel sınırını aşıyor. JPEG, PNG, WebP veya HEIC fotoğraf seçin.",
    );
  }
}
export async function uploadPrivate(
  bucket: string,
  path: string,
  bytes: Buffer,
) {
  const { db } = await accountContext();
  const { error } = await db.functions.invoke("account-media", {
    body: { bucket, path, image: bytes.toString("base64") },
  });
  if (error) throw new Error("Görsel yüklenemedi. Yeniden deneyin.");
}
