import type { OfferPayload } from "@/lib/offers/types";
import type { CompanyInfo } from "@/lib/pdf/brand";
import type { ReportSettings } from "@/lib/settings";

/**
 * Teklif PDF'inin KİMDEN künyesi.
 *
 * Partner seçimi payload snapshot'ıdır; müşteri defteri sonradan değişse bile
 * yayımlanan teklifin unvan/adres/vergi bilgileri değişmez. ORION seçimi ise
 * uygulamanın ortak rapor ayarlarını kullanmaya devam eder.
 */
export function offerIssuerCompany(
  payload: OfferPayload,
  settings: ReportSettings
): CompanyInfo {
  if (payload.issuer.customerId) {
    return {
      company: payload.issuer.company,
      address: payload.issuer.address,
      phone: payload.issuer.phone,
      fax: payload.issuer.fax,
      taxOffice: payload.issuer.taxOffice,
      taxNo: payload.issuer.taxNo,
      email: payload.issuer.email,
      web: payload.issuer.web,
    };
  }
  return {
    company: settings.company,
    address: settings.address || settings.city,
    phone: settings.phone,
    email: settings.email,
    web: settings.web,
  };
}

/** Dosya adı ve PDF metadata'sında kullanılan hazırlayan firma adı. */
export function offerIssuerName(payload: OfferPayload, settings: ReportSettings): string {
  if (!payload.issuer.customerId) return "ORİON VİNÇ";
  return offerIssuerCompany(payload, settings).company || "ORİON VİNÇ";
}
