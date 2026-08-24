import sharp from "sharp";

const CANVAS = { width: 900, height: 300, contentWidth: 820, contentHeight: 220 } as const;
const MAX_EDGE = 5000;

export type SignatureNormalization =
  | { ok: true; png: Buffer; width: number; height: number }
  | { ok: false; error: string };

/**
 * İmza PNG'sini React-PDF'in güvenle basacağı şeffaf, sabit bir tuvale alır.
 * Kenardaki saydam/beyaz boşluk kırpılır; imzanın kendi rengi korunur.
 */
export async function normalizeOfferSignature(bytes: Uint8Array): Promise<SignatureNormalization> {
  try {
    const meta = await sharp(bytes).metadata();
    if (meta.format !== "png") return { ok: false, error: "İmza dosyası PNG olmalıdır." };
    const width = meta.width ?? 0;
    const height = meta.height ?? 0;
    if (width <= 1 || height <= 1) return { ok: false, error: "İmza görseli boş veya bozuk." };
    if (width > MAX_EDGE || height > MAX_EDGE) {
      return { ok: false, error: `İmza görseli en çok ${MAX_EDGE} piksel olabilir.` };
    }

    const corner = await sharp(bytes).extract({ left: 0, top: 0, width: 1, height: 1 }).ensureAlpha().raw().toBuffer();
    const [r = 255, g = 255, b = 255, a = 255] = corner;
    const source = sharp(bytes).ensureAlpha();
    const trimmedSource = a <= 16
      ? source.trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 18, lineArt: true })
      : r >= 240 && g >= 240 && b >= 240
        ? source.trim({ background: { r, g, b, alpha: a / 255 }, threshold: 18, lineArt: true })
        : source;
    const trimmed = await trimmedSource
      .toColourspace("srgb")
      .png({ palette: false, progressive: false })
      .toBuffer();
    const png = await sharp(trimmed)
      .resize({
        width: CANVAS.contentWidth,
        height: CANVAS.contentHeight,
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .extend({
        left: (CANVAS.width - CANVAS.contentWidth) / 2,
        right: (CANVAS.width - CANVAS.contentWidth) / 2,
        top: (CANVAS.height - CANVAS.contentHeight) / 2,
        bottom: (CANVAS.height - CANVAS.contentHeight) / 2,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png({ palette: false, progressive: false, compressionLevel: 9 })
      .toBuffer();
    return { ok: true, png, width: CANVAS.width, height: CANVAS.height };
  } catch {
    return { ok: false, error: "İmza görseli açılamadı; geçerli bir PNG seçin." };
  }
}
