// MÜŞTERİ LOGOSU — depo sözleşmesi ve indirme.
//
// Bu dosya `SupabaseClient`ı PARAMETRE olarak alır, kendi istemcisini KURMAZ
// (`lib/settings.ts` emsali): hangi oturumla okunduğuna çağıran karar verir ve
// çekirdek bir HTTP/auth katmanı taşımaz.
//
// YOL KURALI TEK YERDEDİR ve iki taraf da buradan okur: tarayıcı yüklemeden
// önce (`admin/customers/logo-upload.tsx`), sunucu doğrulamadan önce
// (`admin/actions.ts`). Kural iki yerde ayrı yazılsaydı en küçük fark "dosya
// depoda bulunamadı" hatasına dönüşürdü (özlük dosyası kalıbı).

import type { SupabaseClient } from "@supabase/supabase-js";

export const CUSTOMER_LOGO_BUCKET = "customer-logos";

/** Kovanın kendi sınırı ile AYNI (migration 20260821000005). */
export const MAX_CUSTOMER_LOGO_BYTES = 2 * 1024 * 1024;

/**
 * TEK KABUL EDİLEN TİP PNG'dir.
 *
 * JPEG'in alfası yoktur ve logo beyaz kâğıda değil belgenin künyesine basılır;
 * SVG ise react-pdf'in `Image` çözücüsünde hiç yoktur. Kullanıcıya "PNG olsun"
 * demek, sessizce bozuk basılan bir belgeden iyidir.
 */
export const CUSTOMER_LOGO_MIME = "image/png";

/**
 * Depo yolu: `<müşteri id>/<yükleme id>.png`.
 *
 * SABİT BİR AD (`logo.png`) + `upsert` DEĞİL: Supabase/CDN aynı yola yazılan
 * eski baytı bir süre daha verebilir ve kullanıcı logoyu değiştirdiğini
 * sanırken teklif eski markayı basardı. Her yükleme kendi kimliğini alır,
 * eskisi kayıt yazıldıktan SONRA silinir.
 */
export function customerLogoPath(customerId: string, uploadId: string): string {
  return `${customerId}/${uploadId}.png`;
}

/**
 * Sunucu istemciden gelen YOLA GÜVENMEZ: yolun bu müşterinin klasöründe ve
 * `.png` uzantılı olduğunu doğrular. Doğrulanmasaydı yönetici penceresinden
 * gelen bir istek, defterdeki BAŞKA bir müşterinin logosunu kendi kaydına
 * bağlayabilirdi (kovanın RLS'i yalnız "admin mi" diye sorar, "hangi müşteri"
 * diye değil).
 */
export function isCustomerLogoPath(customerId: string, path: string): boolean {
  if (!customerId || !path) return false;
  if (!path.startsWith(`${customerId}/`)) return false;
  const kalan = path.slice(customerId.length + 1);
  // Tek seviye: alt klasör ya da `..` taşıyan bir yol kabul edilmez.
  return /^[0-9a-fA-F-]{16,64}\.png$/.test(kalan);
}

/**
 * Müşterinin logosunu BUFFER olarak indirir — logo yoksa ya da indirilemezse
 * `null`.
 *
 * HİÇBİR KOŞULDA FIRLATMAZ. Çağıran teklif PDF'idir ve bir müşteri logosunun
 * inmemesi belgeyi düşürmemelidir (katalog yaprağı kuralının aynısı,
 * `pdf/catalog-sheet-images.ts`): logosuz basılan bir teklif kusurlu değildir,
 * basılmayan bir teklif kusurludur.
 *
 * BUFFER döner, imzalı bir adres DEĞİL: react-pdf `<Image src>` metni URL
 * sayar ve Windows dosya yolunda düşer (`pdf/brand.tsx`).
 */
export async function loadCustomerLogo(
  supabase: SupabaseClient,
  customerId: string | null | undefined
): Promise<Buffer | null> {
  if (!customerId) return null;
  try {
    const { data: customer, error } = await supabase
      .from("customers")
      .select("logo_path")
      .eq("id", customerId)
      .maybeSingle();
    if (error) return null;
    const path = ((customer as { logo_path?: string } | null)?.logo_path ?? "").trim();
    if (!path) return null;

    const { data: file, error: indirmeHatasi } = await supabase.storage
      .from(CUSTOMER_LOGO_BUCKET)
      .download(path);
    if (indirmeHatasi || !file) return null;

    const bytes = Buffer.from(await file.arrayBuffer());
    // Boş bir nesne (0 bayt) react-pdf'te çözücü hatasına dönüşür; burada
    // "logo yok" saymak belgeyi ayakta tutar.
    return bytes.byteLength > 0 ? bytes : null;
  } catch {
    // Ağ, yetki ya da şema hatası: belge logosuz basılır.
    return null;
  }
}
