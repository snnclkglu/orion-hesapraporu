import { describe, expect, it } from "vitest";
import { buildCustomerProfileAnalytics, type CustomerProfileDataset } from "@/lib/customer-profile";
import { DEFAULT_PROFILE_SCORING_SETTINGS } from "@/lib/profile-scoring";

const dataset: CustomerProfileDataset = {
  customer: {
    id: "c", name: "Müşteri", shortName: "MŞT", colorHue: 210, address: "Adres",
    taxOffice: "Merkez", taxNo: "1", phone: "2", fax: "", notes: "", logoPath: "c/logo.png",
    logoName: "logo.png", createdAt: "2025-01-01T00:00:00Z", updatedAt: "2026-08-01T00:00:00Z",
  },
  contacts: [{ id: "k", name: "Kişi", title: "", department: "", phone: "", email: "a@b.com", note: "", isPrimary: true, active: true }],
  offers: [
    { id: "o1", offerNo: "T-1", subject: "A", status: "won", currency: "EUR", latestTotal: 100, issuedOn: "2026-08-01", issueDate: "", createdAt: "2026-08-01", updatedAt: "2026-08-01" },
    { id: "o2", offerNo: "T-2", subject: "B", status: "lost", currency: "EUR", latestTotal: 50, issuedOn: "2026-07-01", issueDate: "", createdAt: "2026-07-01", updatedAt: "2026-07-01" },
    { id: "o3", offerNo: "T-3", subject: "C", status: "sent", currency: "USD", latestTotal: 30, issuedOn: "2026-06-01", issueDate: "", createdAt: "2026-06-01", updatedAt: "2026-06-01" },
  ],
  jobs: [{ id: "j", jobNo: "1", title: "İş", status: "active", workOrderDate: "2026-08-02", createdAt: "2026-08-02", updatedAt: "2026-08-02" }],
  projects: [{ id: "p", jobId: "j", docNo: "D", name: "Proje", status: "active", createdAt: "2026-08-03", updatedAt: "2026-08-03" }],
};

describe("müşteri profil analizi", () => {
  it("para birimlerini birleştirmeden ve kazanım oranını sonuçlanan tekliflerden hesaplar", () => {
    const result = buildCustomerProfileAnalytics(dataset, new Date("2026-08-29T00:00:00Z"), DEFAULT_PROFILE_SCORING_SETTINGS.customer);
    expect(result.conversionRatio).toBe(0.5);
    expect(result.quotedTotalsByCurrency).toEqual([
      { currency: "EUR", total: 150, count: 2 },
      { currency: "USD", total: 30, count: 1 },
    ]);
    expect(result.completenessFilled).toBe(result.completenessTotal);
    expect(result.monthly12.reduce((sum, row) => sum + row.offers, 0)).toBe(3);
  });

  it("sonuçlanan teklif yoksa uydurma yüzde üretmez", () => {
    const result = buildCustomerProfileAnalytics(
      { ...dataset, offers: dataset.offers.filter((offer) => offer.status === "sent") },
      new Date("2026-08-29T00:00:00Z"),
      DEFAULT_PROFILE_SCORING_SETTINGS.customer
    );
    expect(result.conversionRatio).toBeNull();
  });
});
