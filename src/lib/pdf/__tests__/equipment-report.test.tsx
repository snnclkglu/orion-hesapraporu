import { describe, expect, it } from "vitest";
import { renderEquipmentPdf, breakEquipmentModelCode } from "@/lib/pdf/equipment-report";

describe("ekipman listesi PDF düzeni", () => {
  it("uzun katalog kodlarına satır kırma noktası ekler ve yatay PDF üretir", async () => {
    const model = "N(NV).250.HYD.050/090-200N";
    expect(breakEquipmentModelCode(model)).toContain("\u200B");

    const pdf = await renderEquipmentPdf({
      meta: {
        docNo: "EQ-01", projectName: "Uzun Kod Testi", customer: "ORION", revLabel: "V0", revNo: 0,
        date: "07.08.2026",
      },
      groups: [{
        name: "Ana Kaldırma",
        rows: [{
          component: "Fren",
          brand: "Galvi Newcomen",
          model,
          spec: "Fren torku 720 Nm, kasnak/disk Ø250 mm; uzun özellik metni satıra güvenle kırılır.",
          qty: 4,
        }],
      }],
    });

    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
    expect(pdf.length).toBeGreaterThan(10 * 1024);
  }, 120_000);
});
