import type { SupabaseClient } from "@supabase/supabase-js";

export const CUSTOMER_DRAWING_PATH_PATTERN = /^\/paylas\/resim\/[A-Za-z0-9_-]{43}$/;

/** Ekipman listesine seçilmiş müşteri ana pafta yolu (yoksa boş). */
export async function loadCustomerDrawingPath(
  supabase: SupabaseClient,
  revisionId: string
): Promise<string> {
  const { data } = await supabase
    .from("equipment_customer_drawing_links")
    .select("share_path")
    .eq("revision_id", revisionId)
    .maybeSingle();
  return typeof data?.share_path === "string" ? data.share_path : "";
}

/** Yapıştırılan mutlak veya göreli müşteri linkinden yalnız güvenli yolu alır. */
export function customerDrawingPathOf(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return "";
  try {
    const url = new URL(trimmed, "https://orion.invalid");
    return CUSTOMER_DRAWING_PATH_PATTERN.test(url.pathname) ? url.pathname : null;
  } catch {
    return null;
  }
}
