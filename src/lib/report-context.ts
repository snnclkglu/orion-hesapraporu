/**
 * Hesap raporunun iş bağlamı.
 *
 * Motor, revizyon snapshot'ı ve PDF üretimi iki bağlamda da AYNIDIR. Bu alan
 * yalnız kaydın hangi listede ve hangi gezinme yolunda yaşayacağını söyler:
 * alınmış işin mühendislik arşivi ya da henüz teklif aşamasındaki çalışma.
 */
export const REPORT_CONTEXTS = ["engineering", "offer"] as const;

export type ReportContext = (typeof REPORT_CONTEXTS)[number];

export const ENGINEERING_REPORT_CONTEXT: ReportContext = "engineering";
export const OFFER_REPORT_CONTEXT: ReportContext = "offer";

export function reportContextOf(value: unknown): ReportContext {
  return value === OFFER_REPORT_CONTEXT ? OFFER_REPORT_CONTEXT : ENGINEERING_REPORT_CONTEXT;
}

export function reportBasePath(context: ReportContext): string {
  return context === OFFER_REPORT_CONTEXT ? "/offers/hesap-raporlari" : "/projects";
}

export function reportContextLabel(context: ReportContext): string {
  return context === OFFER_REPORT_CONTEXT ? "Teklif Hesap Raporları" : "Mühendislik";
}
