import { describe, expect, it } from "vitest";
import { emptyPayload } from "../payload";
import { jobOfferDocumentFileName, jobOfferDocumentPayload } from "../job-document";

describe("İşler için sade teklif dokümanı", () => {
  it("fiyat, iskonto, ödeme satırı ve özel imza yolunu çıkarır", () => {
    const payload = emptyPayload("EUR");
    payload.cover.signatories = [
      {
        name: "Ayşe Mühendis",
        title: "Proje Müdürü",
        signaturePath: "gizli/imza.png",
        signatureName: "imza.png",
      },
    ];
    payload.pricing.lines = [
      {
        id: "price-1",
        itemId: null,
        description: "Vinç",
        qty: 1,
        unit: "Adet",
        unitPrice: 125_000,
        optional: false,
        inTotal: true,
      },
    ];
    payload.pricing.discountTotal = 120_000;
    payload.pricing.total = 120_000;
    payload.terms.rows = [
      { key: "delivery", label: "Teslim", value: "6-8 hafta", parts: {} },
      { key: "payment", label: "Ödeme", value: "Avans", parts: {} },
      { key: "tax", label: "Para Birimi / Vergi", value: "EUR · KDV hariç", parts: {} },
    ];
    payload.terms.paymentLines = [{ id: "pay-1", text: "%40 avans" }];
    payload.notes = [
      { id: "technical", text: "Köprü rayı müşteri kapsamındadır." },
      { id: "commercial", text: "Net teklif bedeli 120.000 €'dur." },
    ];

    const safe = jobOfferDocumentPayload(payload, "EUR");

    expect(safe.pricing.lines).toEqual([]);
    expect(safe.pricing.discountTotal).toBeNull();
    expect(safe.pricing.total).toBeNull();
    expect(safe.terms.rows.map((row) => row.key)).toEqual(["delivery"]);
    expect(safe.terms.paymentLines).toEqual([]);
    expect(safe.terms.title).toBe("TESLİM VE DİĞER ŞARTLAR");
    expect(safe.notes.map((note) => note.id)).toEqual(["technical"]);
    expect(safe.generalTerms.some((term) => term.key === "price")).toBe(false);
    expect(safe.cover.signatories[0]).toEqual({
      name: "Ayşe Mühendis",
      title: "Proje Müdürü",
    });
  });

  it("iş ve teklif kimliğini taşıyan güvenli dosya adı üretir", () => {
    expect(jobOfferDocumentFileName("0064", "TETR-20260817-1", 2)).toBe(
      "0064 - TEKLİF DOKÜMANI - TETR-20260817-1 - REV 02.pdf"
    );
  });
});
