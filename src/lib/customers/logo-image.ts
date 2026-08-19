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
// BÜTÜN teklif PDF'ini 500'e çevirirdi. Baytlar bu yüzden 8 bit sRGB,
// interlaced olmayan, paletsiz bir PNG olarak YENİDEN KODLANIR.

import sharp from "sharp";

/**
 * Yeniden kodlanan logonun en fazla genişliği.
 *
 * Künyedeki kutu 120 pt genişlik / 20 pt yüksekliktir (`pdf/offer.tsx`); 300
 * dpi'da bu ~500 pikselin karşılığıdır. 900 piksel iki katına yakın bir paydır
 * ve dosyayı küçük tutar — 4000 piksellik bir logo künyede aynı görünür, yalnız
 * PDF'i şişirirdi.
 */
const HEDEF_GENISLIK = 900;

/**
 * Kabul edilen en büyük kenar — SIKIŞTIRMA BOMBASINA karşı.
 *
 * 2 MB'lık bir PNG 20.000 × 20.000 piksele açılabilir ve o 1,6 GB'lık bir
 * tampon demektir. Kova sınırı bayt sayar, bu sınır PİKSEL sayar; ikisi ayrı
 * şeyi korur. 6000 piksel, gerçek bir kurumsal logonun çok üstündedir.
 */
const MAX_KENAR = 6000;

export type CustomerLogoOlcumu =
  | { ok: true; png: Buffer; width: number; height: number }
  | { ok: false; error: string };

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

    const { data, info } = await sharp(bytes)
      .resize({ width: HEDEF_GENISLIK, withoutEnlargement: true })
      // sRGB 8 BİTTİR: 16 bitlik bir kaynak burada tek bayta iner. Dönüşüm
      // yazılmazsa sharp derinliği olduğu gibi korur ve PNG 16 bit çıkardı.
      .toColourspace("srgb")
      .png({ palette: false, progressive: false, compressionLevel: 9 })
      .toBuffer({ resolveWithObject: true });

    return { ok: true, png: data, width: info.width, height: info.height };
  } catch {
    // sharp açamadı: uzantısı .png olan başka bir dosya ya da bozuk bayt dizisi.
    return { ok: false, error: "Görüntü açılamadı. Başka bir PNG kopyası deneyin." };
  }
}
