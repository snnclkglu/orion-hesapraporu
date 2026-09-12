// Vercel istek sınırının altında kalır; sunucu biçim/ölçü kontrolünü yine yapar.
const transportLimit = 3500000;
export async function prepareImageTransport(file: File): Promise<File> {
  if (file.size < 1 || file.size > 10 * 1024 * 1024) throw new Error("Görsel en fazla 10 MB olabilir.");
  if (file.size <= transportLimit) return file;
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Fotoğraf hazırlanamadı. Yeniden deneyin.");
  const url = URL.createObjectURL(file);
  const image = new Image();
  let source: CanvasImageSource;
  let width: number, height: number;
  let decodedCanvas: HTMLCanvasElement | undefined;
  try {
    try {
      image.src = url;
      await image.decode();
      width = image.naturalWidth; height = image.naturalHeight; source = image;
    } catch {
      const header = new TextDecoder().decode(await file.slice(4, 32).arrayBuffer());
      if (!header.startsWith("ftyp") || !/heic|heix|hevc|hevx|mif1|msf1/.test(header)) throw new Error("Görsel açılamadı. JPEG, PNG, WebP veya HEIC fotoğraf seçin.");
      // Yalnız tarayıcının açamadığı büyük HEIC için mevcut çözümleyici yüklenir.
      const { default: createHeif } = await import("libheif-js/libheif-wasm/libheif-bundle.mjs");
      const heif = await createHeif();
      const images = new heif.HeifDecoder().decode(new Uint8Array(await file.arrayBuffer()));
      try {
        const decoded = images[0];
        if (!decoded) throw new Error("HEIC fotoğraf açılamadı.");
        width = decoded.get_width(); height = decoded.get_height();
        checkDimensions(width, height);
        decodedCanvas = document.createElement("canvas");
        decodedCanvas.width = width; decodedCanvas.height = height;
        const output = decodedCanvas.getContext("2d");
        if (!output) throw new Error("Fotoğraf hazırlanamadı.");
        const pixels = output.createImageData(width, height);
        await new Promise<void>((resolve, reject) => decoded.display(pixels, result => {
          if (!result) { reject(new Error("HEIC fotoğraf açılamadı.")); return; }
          pixels.data.set(result.data); output.putImageData(pixels, 0, 0); resolve();
        }));
        source = decodedCanvas;
      } finally { images.forEach(decoded => decoded.free()); }
    }
    checkDimensions(width!, height!);
    const scale = Math.min(1, 1800 / Math.max(width!, height!));
    canvas.width = Math.max(1, Math.round(width! * scale));
    canvas.height = Math.max(1, Math.round(height! * scale));
    context.drawImage(source!, 0, 0, canvas.width, canvas.height);
    // WebP desteklenmiyorsa tarayıcı PNG döndürebilir; boyut ayrıca doğrulanır.
    let blob = await encode(canvas, "image/webp", 0.85);
    if (blob.size > transportLimit) blob = await encode(canvas, "image/jpeg", 0.8);
    if (!blob.size || blob.size > transportLimit) throw new Error("Fotoğraf küçültülemedi. Daha küçük bir görsel seçin.");
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + (blob.type === "image/jpeg" ? ".jpg" : blob.type === "image/png" ? ".png" : ".webp"), { type: blob.type });
  } finally {
    URL.revokeObjectURL(url);
    canvas.width = canvas.height = 1;
    if (decodedCanvas) decodedCanvas.width = decodedCanvas.height = 1;
  }
}
function checkDimensions(width: number, height: number) {
  if (width < 1 || height < 1 || width * height > 40000000) throw new Error("Görsel 40 megapiksel sınırını aşıyor.");
}
function encode(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Fotoğraf hazırlanamadı.")), type, quality));
}
