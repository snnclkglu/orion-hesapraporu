// MÜŞTERİ LOGOSU — istemci ve sunucunun ortak depo sözleşmesi.
//
// YOL KURALI TEK YERDEDİR ve iki taraf da buradan okur: tarayıcı yüklemeden
// önce (`admin/customers/logo-upload.tsx`), sunucu doğrulamadan önce
// (`admin/actions.ts`). Kural iki yerde ayrı yazılsaydı en küçük fark "dosya
// depoda bulunamadı" hatasına dönüşürdü (özlük dosyası kalıbı).

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
