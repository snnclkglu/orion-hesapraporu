import "server-only";

import { createClient } from "@supabase/supabase-js";

/**
 * RLS'i aşan sunucu istemcisi.
 *
 * Yalnız üyeliği olmayan müşterinin opak paylaşım anahtarını çözmek ve private
 * bucket'taki TEK dosyayı okumak için kullanılır. Anahtar istemci paketine
 * girmez; bu modül `server-only` ile yanlışlıkla tarayıcıdan içe aktarılamaz.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Supabase sunucu anahtarı tanımlı değil.");
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
