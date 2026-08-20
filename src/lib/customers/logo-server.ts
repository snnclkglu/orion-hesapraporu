// MÜŞTERİ LOGOSU — yalnız sunucuda çalışan indirme ve PDF hazırlığı.
//
// Ortak yol/MIME sabitleri `logo.ts`tedir ve tarayıcı da onları kullanır.
// `sharp` taşıyan normalleştirici bu AYRI modüldedir; istemci bileşeni sunucu
// görüntü kütüphanesini kendi paketine çekmez.

import type { SupabaseClient } from "@supabase/supabase-js";
import { CUSTOMER_LOGO_BUCKET } from "./logo";
import { normalizeCustomerLogo } from "./logo-image";

/**
 * Müşterinin logosunu indirir ve STANDART PDF tuvaline getirir.
 *
 * Yükleme yolu yeni dosyaları zaten normalleştirir; burada bir kez daha
 * çalışması bilinçlidir. Bu sayede düzeltmeden önce yüklenmiş, kenarlarında
 * beyaz/saydam boşluk taşıyan logolar da yeniden yüklenmeden düzelir. İşlem
 * idempotenttir: standart tuval kırpılır ve aynı tuvale yeniden ortalanır.
 *
 * HİÇBİR KOŞULDA FIRLATMAZ. Bir logo yüzünden teklif PDF'i düşmez; hata
 * `null`a iner ve künye logosuz basılır.
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
    if (indirmeHatasi || !file || file.size <= 0) return null;

    const sonuc = await normalizeCustomerLogo(new Uint8Array(await file.arrayBuffer()));
    return sonuc.ok ? sonuc.png : null;
  } catch {
    return null;
  }
}
