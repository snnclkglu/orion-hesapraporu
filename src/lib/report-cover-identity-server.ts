import type { SupabaseClient } from "@supabase/supabase-js";
import { loadCustomerLogo } from "@/lib/customers/logo-server";

export interface ReportCoverIdentity {
  reportBrand: { name: string; logo: Buffer | null } | null;
  endCustomerLogo: Buffer | null;
}

/**
 * Hesap raporunun iki bağımsız görsel kimliğini yükler.
 *
 * Firma adı logo olmasa da gösterilir; logo indirme/normalleştirme hatası ise
 * PDF üretimini durdurmaz. Böylece eski veya logosuz müşteri kayıtları kapak
 * düzenini bozmaz.
 */
export async function loadReportCoverIdentity(
  supabase: SupabaseClient,
  reportBrandCustomerId: string | null | undefined,
  endCustomerId: string | null | undefined
): Promise<ReportCoverIdentity> {
  const [reportBrandLogo, endCustomerLogo, reportBrandRow] = await Promise.all([
    loadCustomerLogo(supabase, reportBrandCustomerId),
    loadCustomerLogo(supabase, endCustomerId),
    reportBrandCustomerId
      ? supabase
          .from("customers")
          .select("name")
          .eq("id", reportBrandCustomerId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const name = ((reportBrandRow.data as { name?: string } | null)?.name ?? "").trim();

  return {
    reportBrand: reportBrandCustomerId && name ? { name, logo: reportBrandLogo } : null,
    endCustomerLogo,
  };
}
