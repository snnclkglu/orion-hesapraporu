import "server-only";

// EL KİTABI GÖRSELİNİN TEK GİRİŞ KAPISI.
//
// DÖRT KAYNAK, TEK VARIŞ (KITAP-22): dosya yükleme, panoya yapıştırma,
// teknik resim paftası ve katalog sayfası. Dördü de BURADAN geçer ve
// KITAP-9'un üç kuralı dördünde de aynen işler:
//
//   · "PNG" BİR BEYANDIR, KANIT DEĞİL — `file.type` tarayıcıdan gelir.
//   · 16 bitlik, interlaced ya da paletli bir PNG react-pdf'in çözücüsünü
//     düşürür ve TEK bozuk görsel BÜTÜN kılavuzu 500'e çevirirdi.
//   · EN-BOY ORANI ÖLÇÜLÜR, beyan edilmez: yanlış bir oran PDF'te resmi ezer.
//
// Dört ayrı uç kendi kodlamasını yazsaydı biri `sharp`ı atlar ve o kaynaktan
// gelen tek bir bozuk görsel bütün kılavuzu düşürürdü.
//
// KAYNAK KAYDEDİLİR (`origin`): "bu resim hangi paftanın kaçıncı sayfası"
// sorusunun cevabı bir yıl sonra da gerekir — pafta revize edildiğinde hangi
// kılavuzun tazelenmesi gerektiği ancak böyle bilinir.

import sharp from "sharp";
import type { SupabaseClient } from "@supabase/supabase-js";
import { MANUAL_IMAGE_BUCKET, type ManualImageRow } from "./data";

/** Yeniden kodlanan görselin en fazla genişliği — A4 gövdesi 170 mm'dir. */
export const MANUAL_IMAGE_HEDEF_GENISLIK = 1600;

/** Kabul edilen en büyük kenar — SIKIŞTIRMA BOMBASINA karşı (piksel sayar). */
export const MANUAL_IMAGE_MAX_KENAR = 12000;

/** Görselin nereden geldiği — belgede basılmaz, kayıtta durur. */
export type ManualImageOrigin =
  | { tur: "yukleme" }
  | { tur: "pano" }
  | { tur: "pafta"; paketId: string; dosyaId: string; sayfa: number; ad: string }
  | { tur: "katalog"; belgeId: string; sayfa: number; ad: string };

export type IntakeSonuc =
  | { error: string; status: number }
  | { image: ManualImageRow };

/**
 * Baytları yeniden kodlar, depoya yazar ve kaydı açar.
 *
 * SIRA TERSTİR (önce depo, sonra kayıt) ve bu bilinçlidir: kayıt yazılamazsa
 * nesne silinir. Tersi olsaydı kaydı olan ama baytı olmayan bir görsel kalır
 * ve o blok belgede sessizce boşa düşerdi.
 */
export async function manualImageIntake(
  supabase: SupabaseClient,
  revisionId: string,
  userId: string,
  bytes: Uint8Array | Buffer,
  fileName: string,
  origin: ManualImageOrigin
): Promise<IntakeSonuc> {
  let png: Buffer;
  let width = 0;
  let height = 0;
  try {
    const ham = Buffer.from(bytes);
    const olcu = await sharp(ham).metadata();
    if (!olcu.width || !olcu.height) return { error: "Görsel okunamadı.", status: 422 };
    if (olcu.width > MANUAL_IMAGE_MAX_KENAR || olcu.height > MANUAL_IMAGE_MAX_KENAR) {
      return { error: "Görsel çözünürlüğü çok yüksek.", status: 413 };
    }
    // 8 bit sRGB, interlaced OLMAYAN, PALETSİZ bir PNG olarak yeniden kodlanır.
    png = await sharp(ham)
      .resize({
        width: Math.min(MANUAL_IMAGE_HEDEF_GENISLIK, olcu.width),
        withoutEnlargement: true,
      })
      .png({ progressive: false, palette: false, compressionLevel: 9 })
      .toBuffer();
    const son = await sharp(png).metadata();
    width = son.width ?? 0;
    height = son.height ?? 0;
  } catch {
    return { error: "Görsel işlenemedi.", status: 422 };
  }

  const imageId = crypto.randomUUID();
  const yol = `${revisionId}/${imageId}.png`;
  const { error: yuklemeHatasi } = await supabase.storage
    .from(MANUAL_IMAGE_BUCKET)
    .upload(yol, png, { contentType: "image/png", upsert: false });
  if (yuklemeHatasi) return { error: yuklemeHatasi.message, status: 500 };

  const { error } = await supabase.from("manual_images").insert({
    id: imageId,
    revision_id: revisionId,
    file_name: fileName,
    storage_path: yol,
    width,
    height,
    size_bytes: png.byteLength,
    origin,
    created_by: userId,
  });
  if (error) {
    await supabase.storage.from(MANUAL_IMAGE_BUCKET).remove([yol]);
    return { error: error.message, status: 500 };
  }

  // İSTEMCİ KAYDI HEMEN ÖNİZLER: yalnız kimlik dönersek editörün açılışta
  // aldığı `images` listesi değişmez ve yeni görsel sayfa yenilenene kadar
  // kâğıtta görünmezdi. Satırın sunucuda ÖLÇÜLMÜŞ hâli cevapta döner.
  return {
    image: {
      id: imageId,
      revisionId,
      fileName,
      storagePath: yol,
      width,
      height,
    } as ManualImageRow,
  };
}

/**
 * Ortak yetki + taslak denetimi — dört ucun da ilk adımı.
 *
 * REVİZYONUN BU PROJEYE AİT OLDUĞU yazmadan önce doğrulanır: adres
 * çubuğundaki proje kimliğiyle revizyon kimliği bağımsızdır ve eşleşmeyen
 * bir çift başka bir vincin kılavuzuna resim yazardı.
 */
export async function manualYazmaIzni(
  supabase: SupabaseClient,
  projectId: string,
  revisionId: string
): Promise<{ userId: string } | { error: string; status: number }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı.", status: 401 };

  const { data: profil } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  const { canEditReports } = await import("@/lib/roles");
  if (!canEditReports((profil as { role?: string } | null)?.role)) {
    return { error: "Yetkiniz yok.", status: 403 };
  }

  const { data: rev } = await supabase
    .from("manual_revisions")
    .select("id, status, manual_id, manuals:manual_id(project_id)")
    .eq("id", revisionId)
    .maybeSingle();
  if (!rev) return { error: "Revizyon bulunamadı.", status: 404 };
  if ((rev.manuals as unknown as { project_id?: string } | null)?.project_id !== projectId) {
    return { error: "Revizyon bu projeye ait değil.", status: 404 };
  }
  if (rev.status !== "draft") {
    return {
      error: "Yayımlanmış revizyona görsel eklenemez; yeni revizyon oluşturun.",
      status: 409,
    };
  }
  return { userId: user.id };
}
