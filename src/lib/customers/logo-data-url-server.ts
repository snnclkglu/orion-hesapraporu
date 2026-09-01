import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CUSTOMER_LOGO_BUCKET,
  MAX_CUSTOMER_LOGO_BYTES,
  isCustomerLogoPath,
} from "./logo";

/**
 * Ekran/SVG yüzleri için müşterinin onaylı PNG logosunu self-contained veri
 * adresi olarak yükler. PDF normalleştiricisini (sharp) proje sayfasının
 * Vercel trace'ine taşımaz; yükleme hattı yeni logoları zaten normalize eder.
 */
export async function loadCustomerLogoDataUrl(
  supabase: SupabaseClient,
  customerId: string | null | undefined
): Promise<string | null> {
  if (!customerId) return null;
  try {
    const { data: customer, error } = await supabase
      .from("customers")
      .select("logo_path")
      .eq("id", customerId)
      .maybeSingle();
    if (error) return null;
    const storagePath = String(customer?.logo_path ?? "").trim();
    if (!storagePath || !isCustomerLogoPath(customerId, storagePath)) return null;
    const { data: file, error: downloadError } = await supabase.storage
      .from(CUSTOMER_LOGO_BUCKET)
      .download(storagePath);
    if (downloadError || !file || file.size <= 0 || file.size > MAX_CUSTOMER_LOGO_BYTES) {
      return null;
    }
    return `data:image/png;base64,${Buffer.from(await file.arrayBuffer()).toString("base64")}`;
  } catch {
    return null;
  }
}

/**
 * Ekran önizlemesi için logo: veri adresi VE ÖLÇÜLMÜŞ oran.
 *
 * Oran BEYAN EDİLMEZ, ÖLÇÜLÜR (KITAP-9'un kuralı). Kâğıt önizlemesi logoyu
 * oranından boyutlandırır; yanlış bir oran bant yüksekliğini bozar. Ölçüm
 * PNG başlığından yapılır — `sharp` çağırmak, bu modülün kaçındığı ağır
 * bağımlılığı proje sayfasının trace'ine geri sokardı.
 */
export async function loadCustomerLogoPreview(
  supabase: SupabaseClient,
  customerId: string | null | undefined
): Promise<{ url: string; oran: number } | null> {
  const url = await loadCustomerLogoDataUrl(supabase, customerId);
  if (!url) return null;
  const base64 = url.slice(url.indexOf(",") + 1);
  const bytes = Buffer.from(base64, "base64");
  // PNG imzası 8 bayt, ardından IHDR uzunluğu/tipi 8 bayt; en/boy 16 ve 20'de.
  const png =
    bytes.length > 24 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47;
  if (!png) return null;
  const genislik = bytes.readUInt32BE(16);
  const yukseklik = bytes.readUInt32BE(20);
  if (!(genislik > 0 && yukseklik > 0)) return null;
  return { url, oran: yukseklik / genislik };
}
