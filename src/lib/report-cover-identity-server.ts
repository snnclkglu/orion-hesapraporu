import type { SupabaseClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { loadCustomerLogo } from "@/lib/customers/logo-server";

export interface ReportCoverIdentity {
  reportBrand: { name: string; logo: Buffer | null } | null;
  endCustomerLogo: Buffer | null;
}

/**
 * Müşteri logoları ortak 900 x 240 tuvalde saklanır. Kapakta sol kenarı
 * hizalayabilmek için bu taşıma tuvalini kaldırırız; görünür logo oranı korunur.
 * İndirme/çözme hatası kapak üretimini düşürmez, normalize kaynakla devam eder.
 */
async function trimReportLogo(logo: Buffer | null): Promise<Buffer | null> {
  if (!logo) return null;
  try {
    return await sharp(logo)
      .trim({
        background: { r: 0, g: 0, b: 0, alpha: 0 },
        threshold: 12,
        lineArt: true,
      })
      .png({ palette: false, progressive: false, compressionLevel: 9 })
      .toBuffer();
  } catch {
    return logo;
  }
}

/**
 * Proje PDF'lerinin partner kimliği ile hesap kapağının son kullanıcı logosunu
 * yükler. Partner alanı hesap raporu, ekipman listesi ve el kitabı tarafından
 * ortak kullanılır.
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
  const [alignedReportBrandLogo, alignedEndCustomerLogo] = await Promise.all([
    trimReportLogo(reportBrandLogo),
    trimReportLogo(endCustomerLogo),
  ]);

  return {
    reportBrand: reportBrandCustomerId && name ? { name, logo: alignedReportBrandLogo } : null,
    endCustomerLogo: alignedEndCustomerLogo,
  };
}
