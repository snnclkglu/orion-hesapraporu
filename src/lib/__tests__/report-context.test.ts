import { describe, expect, it } from "vitest";
import {
  ENGINEERING_REPORT_CONTEXT,
  OFFER_REPORT_CONTEXT,
  reportBasePath,
  reportContextLabel,
  reportContextOf,
} from "@/lib/report-context";

describe("hesap raporu bağlamı", () => {
  it("eski ve bilinmeyen kayıtları Mühendislik bağlamında tutar", () => {
    expect(reportContextOf(undefined)).toBe(ENGINEERING_REPORT_CONTEXT);
    expect(reportContextOf("bilinmeyen")).toBe(ENGINEERING_REPORT_CONTEXT);
  });

  it("teklif raporunu ayrı gezinme yoluna taşır", () => {
    expect(reportContextOf("offer")).toBe(OFFER_REPORT_CONTEXT);
    expect(reportBasePath(OFFER_REPORT_CONTEXT)).toBe("/offers/hesap-raporlari");
    expect(reportContextLabel(OFFER_REPORT_CONTEXT)).toBe("Teklif Hesap Raporları");
  });

  it("Mühendislik adresini değiştirmez", () => {
    expect(reportBasePath(ENGINEERING_REPORT_CONTEXT)).toBe("/projects");
    expect(reportContextLabel(ENGINEERING_REPORT_CONTEXT)).toBe("Mühendislik");
  });
});
