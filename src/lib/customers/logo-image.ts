// MÜŞTERİ LOGOSUNUN ÖLÇÜMÜ VE NORMALLEŞTİRİLMESİ (yalnız sunucu — sharp).
//
// AYRI DOSYADIR ÇÜNKÜ `logo.ts` TEKLİF PDF'İ TARAFINDAN OKUNUR: indirme yolunun
// `sharp`ı içe aktarması, belge ucuna hiç kullanmayacağı bir görüntü kitaplığı
// bağlardı. Burası yalnız YÜKLEME yolundadır.
//
// "PNG" BİR BEYANDIR, KANIT DEĞİL. `file.type` tarayıcıdan gelir ve uzantı da
// bir şey ispat etmez; sunucu yüklenen baytları GERİ İNDİRİP formatı ÖLÇER
// (özlük dosyasının pdf-lib ile açılması ile aynı ilke).
//
// ÖLÇMEK YETMEZ, NORMALLEŞTİRMEK DE GEREKİR: 16 bitlik, interlaced ya da
// paletli PNG varyantları react-pdf'in çözücüsünü düşürür ve tek bozuk logo
// BÜTÜN teklif PDF'ini 500'e çevirirdi. Ayrıca her logo başka bir tuval ve
// en-boy oranıyla gelir; ham görseli yalnız "20 pt yüksek" basmak geniş logoyu
// küçültür, kare logoyu büyütür ve ikisini farklı eksenlere kaydırır.
// Baytlar bu yüzden 8 bit sRGB, interlaced olmayan, paletsiz ve STANDART
// TUVALE ortalanmış bir PNG olarak YENİDEN KODLANIR.

import sharp from "sharp";

/**
 * PDF'deki logo yuvasının raster karşılığı: 120 x 32 pt, oran 3,75:1.
 *
 * Her kaynak önce görünür sınırına kırpılır, sonra 840 x 180 piksellik
 * iç alana SIĞDIRILIR ve 30 piksellik güvenli alanla bu tuvalin ortasına
 * konur. Böylece yatay, kare ve dikey logolar aynı fiziksel yuvayı paylaşır;
 * oran bozulmaz, konum logo dosyasının rastlantısal beyaz boşluğuna kalmaz.
 */
export const CUSTOMER_LOGO_CANVAS = {
  width: 900,
  height: 240,
  contentWidth: 840,
  contentHeight: 180,
  paddingX: 30,
  paddingY: 30,
} as const;

/**
 * Kabul edilen en büyük kenar — SIKIŞTIRMA BOMBASINA karşı.
 *
 * 2 MB'lık bir PNG 20.000 × 20.000 piksele açılabilir ve o 1,6 GB'lık bir
 * tampon demektir. Kova sınırı bayt sayar, bu sınır PİKSEL sayar; ikisi ayrı
 * şeyi korur. 6000 piksel, gerçek bir kurumsal logonun çok üstündedir.
 */
const MAX_KENAR = 6000;

export type CustomerLogoOlcumu =
  | {
      ok: true;
      png: Buffer;
      /** PDF'e verilen standart tuval. */
      width: number;
      height: number;
      /** Kırpılmış logonun kaynak ölçüsü; denetim izi için. */
      contentWidth: number;
      contentHeight: number;
    }
  | { ok: false; error: string };

export interface TechnicalHeaderLogo {
  png: Buffer;
  width: number;
  height: number;
  ratio: number;
}

/**
 * Teknik sayfa başlığı için görünür logoyu SIKI ve SAYDAM hâle getirir.
 *
 * Standart 900×240 tuval kapak ve künye yuvalarında logoları aynı eksende
 * tutar; teknik başlıkta ise görünür sağ kenarın kırmızı kuralla hizalanması
 * gerekir. Üstelik KARÇEL gibi opak beyaz zeminli bir kaynak, saydam tuvalin
 * içinde beyaz bir dikdörtgen olarak kalır ve PDF rasterleştiricisi bu geçişi
 * ince gri bir çerçeve gibi örnekler. Bu türev yalnız teknik başlıkta
 * kullanılır: beyaza yakın zemini alfaya çevirir ve görünür piksel sınırına
 * kırpar. Standart logo buffer'ı ve diğer belge yüzeyleri değişmez.
 */
export async function prepareCustomerLogoForTechnicalHeader(
  bytes: Uint8Array
): Promise<TechnicalHeaderLogo | null> {
  try {
    const { data, info } = await sharp(bytes)
      .toColourspace("srgb")
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    let left = info.width;
    let top = info.height;
    let right = -1;
    let bottom = -1;

    for (let y = 0; y < info.height; y++) {
      for (let x = 0; x < info.width; x++) {
        const i = (y * info.width + x) * 4;
        const r = data[i] ?? 255;
        const g = data[i + 1] ?? 255;
        const b = data[i + 2] ?? 255;
        const alpha = data[i + 3] ?? 0;
        const beyazdanUzaklik = Math.max(255 - r, 255 - g, 255 - b);

        // Tam beyaz zemin saydamdır; 8–36 arası yumuşak geçiş, küçültmede
        // yeniden gri bir kıl çizgi üretmeden kenar yumuşatmasını korur.
        const zeminCarpani = Math.max(0, Math.min(1, (beyazdanUzaklik - 8) / 28));
        const yeniAlpha = Math.round(alpha * zeminCarpani);
        data[i + 3] = yeniAlpha;
        if (yeniAlpha <= 4) continue;
        left = Math.min(left, x);
        top = Math.min(top, y);
        right = Math.max(right, x);
        bottom = Math.max(bottom, y);
      }
    }

    if (right < left || bottom < top) return null;
    const width = right - left + 1;
    const height = bottom - top + 1;
    const png = await sharp(data, {
      raw: { width: info.width, height: info.height, channels: 4 },
    })
      .extract({ left, top, width, height })
      .png({ palette: false, progressive: false, compressionLevel: 9 })
      .toBuffer();

    return { png, width, height, ratio: height / width };
  } catch {
    return null;
  }
}

/**
 * Yalnız gerçek DIŞ BOŞLUĞU kırpar.
 *
 * `sharp.trim()` varsayılan olarak sol üst pikseli zemin sayar. Bu, renkli
 * zeminli bir amblemin kurumsal dikdörtgenini de kesebilirdi. Sol üst piksel
 * saydamsa saydamı, beyaza yakınsa beyazı kırparız; başka bir renkse kaynak
 * olduğu gibi kalır. Logo içindeki beyaz alanlar değil, yalnız kenardan
 * devam eden benzer pikseller gider.
 */
async function gorunurSiniraKirp(bytes: Uint8Array): Promise<sharp.Sharp> {
  const piksel = await sharp(bytes)
    .extract({ left: 0, top: 0, width: 1, height: 1 })
    .ensureAlpha()
    .raw()
    .toBuffer();
  const [r = 0, g = 0, b = 0, a = 255] = piksel;
  const kaynak = sharp(bytes);

  if (a <= 16) {
    return kaynak.trim({
      background: { r: 0, g: 0, b: 0, alpha: 0 },
      threshold: 12,
      lineArt: true,
    });
  }
  if (r >= 245 && g >= 245 && b >= 245) {
    return kaynak.trim({
      background: { r, g, b, alpha: a / 255 },
      threshold: 12,
      lineArt: true,
    });
  }
  return kaynak;
}

/**
 * Yüklenen baytları ölçer ve künyeye basılabilir bir PNG'ye çevirir.
 *
 * Saydamlık KORUNUR (`flatten` YOK): kapak beyaz kâğıttır ve şeffaf zeminli bir
 * logo orada doğru basılır — beyaza düzleştirmek, koyu zeminli bir künyede
 * çirkin bir kutu bırakırdı. (`pdf/catalog-sheet-images.ts`teki `flatten`
 * JPEG'in alfası olmadığı içindir, burada karşılığı yoktur.)
 */
export async function normalizeCustomerLogo(
  bytes: Uint8Array
): Promise<CustomerLogoOlcumu> {
  try {
    const kaynak = sharp(bytes);
    const meta = await kaynak.metadata();

    if (meta.format !== "png") {
      return {
        ok: false,
        error: `Dosya PNG değil (okunan biçim: ${meta.format ?? "bilinmiyor"}). Logoyu PNG olarak kaydedip tekrar deneyin.`,
      };
    }
    const w = meta.width ?? 0;
    const h = meta.height ?? 0;
    if (w <= 0 || h <= 0) {
      return { ok: false, error: "Görüntünün ölçüsü okunamadı; dosya bozuk olabilir." };
    }
    if (w > MAX_KENAR || h > MAX_KENAR) {
      return {
        ok: false,
        error: `Görüntü ${w}×${h} piksel — bir logo için fazla büyük (en çok ${MAX_KENAR} piksel).`,
      };
    }

    const kirpilmis = await gorunurSiniraKirp(bytes);
    const { data: govde, info: govdeInfo } = await kirpilmis
      // sRGB 8 BİTTİR: 16 bitlik bir kaynak burada tek bayta iner. Dönüşüm
      // yazılmazsa sharp derinliği olduğu gibi korur ve PNG 16 bit çıkardı.
      .toColourspace("srgb")
      .png({ palette: false, progressive: false, compressionLevel: 9 })
      .toBuffer({ resolveWithObject: true });

    if (govdeInfo.width <= 1 || govdeInfo.height <= 1) {
      return { ok: false, error: "Logo alanı boş görünüyor; içeriği olan bir PNG deneyin." };
    }

    const { data, info } = await sharp(govde)
      .resize({
        width: CUSTOMER_LOGO_CANVAS.contentWidth,
        height: CUSTOMER_LOGO_CANVAS.contentHeight,
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .extend({
        left: CUSTOMER_LOGO_CANVAS.paddingX,
        right: CUSTOMER_LOGO_CANVAS.paddingX,
        top: CUSTOMER_LOGO_CANVAS.paddingY,
        bottom: CUSTOMER_LOGO_CANVAS.paddingY,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png({ palette: false, progressive: false, compressionLevel: 9 })
      .toBuffer({ resolveWithObject: true });

    return {
      ok: true,
      png: data,
      width: info.width,
      height: info.height,
      contentWidth: govdeInfo.width,
      contentHeight: govdeInfo.height,
    };
  } catch {
    // sharp açamadı: uzantısı .png olan başka bir dosya ya da bozuk bayt dizisi.
    return { ok: false, error: "Görüntü açılamadı. Başka bir PNG kopyası deneyin." };
  }
}
