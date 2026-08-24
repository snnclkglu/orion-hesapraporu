import { describe, expect, it } from "vitest";
import { emptyPayload } from "@/lib/offers/payload";
import { emptyCostPayload } from "@/lib/offers/cost/payload";
import { buildOfferCostWorkbook } from "../offer-cost";

describe("maliyet Excel baskı düzeni", () => {
  function workbook() {
    return buildOfferCostWorkbook({
      offer: {
        offerNo: "TETR-20260824-1",
        subject: "PORTAL VİNÇ",
        customerName: "ASTOR A.Ş.",
        currency: "EUR",
        offerRevNo: 0,
      },
      costRevNo: 0,
      payload: emptyCostPayload("EUR"),
      offerPayload: emptyPayload("EUR"),
      company: { company: "ORION CRANES" },
      meta: { generatedAt: "24.08.2026" },
    });
  }

  it("iki sayfa da A4 DİKEY ve tek sayfa genişliğindedir", async () => {
    const wb = workbook();
    expect(wb.worksheets.map((ws) => ws.pageSetup.orientation)).toEqual(["portrait", "portrait"]);
    for (const ws of wb.worksheets) {
      expect(ws.pageSetup.paperSize).toBe(9);
      expect(ws.pageSetup.fitToWidth).toBe(1);
      expect(ws.pageSetup.fitToHeight).toBe(0);
      expect(ws.pageSetup.printArea).toMatch(/^A1:/);
      expect(ws.views[0]?.showGridLines).toBe(false);
    }
    // Dosya yalnız bellekte kurulmakla kalmasın; ExcelJS gerçekten geçerli
    // bir XLSX paketi yazabilsin.
    expect((await wb.xlsx.writeBuffer()).byteLength).toBeGreaterThan(5_000);
  });

  it("geniş eski çizelge yerine dikey okunabilen sekiz sütun kullanır", () => {
    const wb = workbook();
    const detail = wb.getWorksheet("Maliyet Kalemleri")!;
    const header = detail.getRows(1, detail.rowCount)?.find((row) => {
      const values = Array.isArray(row.values) ? row.values : [];
      return values.includes("KAYNAK") && values.includes("TOPLAM");
    });
    expect(header?.values).toContain("AÇIKLAMA");
    expect(header?.values).not.toContain("PAKET TUTAR");
    expect(detail.pageSetup.printArea).toContain(":H");
  });
});
