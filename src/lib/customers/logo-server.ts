// MÜŞTERİ LOGOSU — yalnız sunucuda çalışan indirme ve PDF hazırlığı.
//
// Ortak yol/MIME sabitleri `logo.ts`tedir ve tarayıcı da onları kullanır.
// `sharp` taşıyan normalleştirici bu AYRI modüldedir; istemci bileşeni sunucu
// görüntü kütüphanesini kendi paketine çekmez.

import type { SupabaseClient } from "@supabase/supabase-js";
import { CUSTOMER_LOGO_BUCKET, isCustomerLogoPath } from "./logo";
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
    // Başka müşterinin klasörüne işaret eden kayıt KABUL EDİLMEZ. Özellikle
    // benzer adlı KARDEMİR kayıtlarında yanlış logo basmak, logosuz basmaktan
    // daha ağır bir hatadır; yükleme yolu zaten bu kimlik bağını zorlar.
    if (!isCustomerLogoPath(customerId, path)) return null;

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

/**
 * Teklifin müşteri snapshot'ına karşılık gelen GÜNCEL müşteri kimliği.
 *
 * Yeni teklifler doğru `customer_id` taşır. Eski/kopyalanmış bir kayıtta kimlik
 * başka müşteriye bağlıysa (KARDEMİR A.Ş. ↔ KARDEMİR ÇH vakası), logo yalnız
 * kimlikten okununca yanlış firmanın logosu gelir. Önce kimlikteki AD snapshot
 * ile doğrulanır; uyuşmazsa resmî unvana TAM eşit müşteri aranır. Benzerlik ya
 * da `startsWith` KULLANILMAZ — iki KARDEMİR'i karıştıran şey tam da odur.
 */
export async function resolveCustomerIdForSnapshot(
  supabase: SupabaseClient,
  customerId: string | null | undefined,
  customerName: string
): Promise<string | null> {
  const snapshotName = (customerName ?? "").trim();
  try {
    if (customerId) {
      const { data } = await supabase
        .from("customers")
        .select("id, name")
        .eq("id", customerId)
        .maybeSingle();
      if (((data as { name?: string } | null)?.name ?? "").trim() === snapshotName) {
        return customerId;
      }
    }
    if (!snapshotName) return customerId ?? null;
    const { data } = await supabase
      .from("customers")
      .select("id")
      .eq("name", snapshotName)
      .limit(1)
      .maybeSingle();
    // TAM unvan da bulunamadıysa eski, uyuşmayan kimliğe geri dönülmez.
    // Yanlış logo, logosuz belgeden daha ağırdır.
    return ((data as { id?: string } | null)?.id ?? null) as string | null;
  } catch {
    return snapshotName ? null : customerId ?? null;
  }
}
