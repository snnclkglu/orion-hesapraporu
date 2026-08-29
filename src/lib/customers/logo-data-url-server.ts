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
