import type { SupabaseClient } from "@supabase/supabase-js";
import type { OfferPayload } from "./types";
import { OFFER_SIGNATURE_BUCKET } from "./signature";

/** PDF için gerekli imzaları indirir; tek bozuk/eksik dosya belgeyi düşürmez. */
export async function loadOfferSignatureImages(
  supabase: SupabaseClient,
  payload: OfferPayload
): Promise<Record<string, Buffer>> {
  const paths = [...new Set(payload.cover.signatories.map((s) => s.signaturePath?.trim()).filter((p): p is string => Boolean(p)))];
  const pairs = await Promise.all(paths.map(async (path) => {
    try {
      const { data, error } = await supabase.storage.from(OFFER_SIGNATURE_BUCKET).download(path);
      if (error || !data || data.size === 0) return null;
      return [path, Buffer.from(await data.arrayBuffer())] as const;
    } catch {
      return null;
    }
  }));
  const out: Record<string, Buffer> = {};
  for (const pair of pairs) {
    if (pair) out[pair[0]] = pair[1];
  }
  return out;
}
