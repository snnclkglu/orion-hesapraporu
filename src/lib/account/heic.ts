import "server-only";
import sharp from "sharp";
/** Yalnız HEIC seçildiğinde yüklenir; ölçü sınırı RGBA belleği ayrılmadan uygulanır. */
export async function decodeHeic(bytes: Buffer) {
  const { default: heif } = await import("libheif-js/wasm-bundle");
  const images = new heif.HeifDecoder().decode(bytes);
  try {
    const image = images[0];
    if (!image) throw new Error("HEIC açılamadı");
    const width = image.get_width(),
      height = image.get_height();
    if (width < 1 || height < 1 || width * height > 40000000)
      throw new Error("Görsel ölçü sınırını aşıyor");
    const rgba = await new Promise<Uint8ClampedArray>((resolve, reject) => {
      image.display(
        { data: new Uint8ClampedArray(width * height * 4), width, height },
        (result) => {
          if (result) resolve(result.data);
          else reject(new Error("HEIC çözümlenemedi"));
        },
      );
    });
    return sharp(Buffer.from(rgba.buffer, rgba.byteOffset, rgba.byteLength), {
      raw: { width, height, channels: 4 },
    })
      .png()
      .toBuffer();
  } finally {
    images.forEach((image) => image.free());
  }
}
