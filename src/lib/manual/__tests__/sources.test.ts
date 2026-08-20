import { describe, expect, it } from "vitest";
import { autoTableFor, resolveAutoTable } from "../sources";

describe("elektrik malzeme özeti", () => {
  it("uzun ürün listesini pano bazında karar tablosuna indirir", () => {
    const table = resolveAutoTable("elektrikMalzeme", {
      electricalParts: [
        {
          deviceTag: "=185T+LVD01-F1",
          installation: "185T",
          location: "LVD01",
          device: "F1",
          qty: 2,
          designation: "Şalter",
          typeNo: "A",
          supplier: "Üretici",
          partNo: "P-1",
          page: 10,
        },
        {
          deviceTag: "=185T+LVD01-F2",
          installation: "185T",
          location: "LVD01",
          device: "F2",
          qty: 3,
          designation: "Kontaktör",
          typeNo: "B",
          supplier: "Üretici",
          partNo: "P-2",
          page: 11,
        },
        {
          deviceTag: "=185T+SD01-F1",
          installation: "185T",
          location: "SD01",
          device: "F1",
          qty: null,
          designation: "Sigorta",
          typeNo: "C",
          supplier: "Üretici",
          partNo: "P-3",
          page: 12,
        },
      ],
    });

    expect(table.head).toEqual(["Pano", "Proje Satırı", "Toplam Adet"]);
    expect(table.rows).toEqual([
      ["+LVD01", "2", "5"],
      ["+SD01", "1", ""],
    ]);
    expect(table.caption).toContain("tam malzeme dökümü elektrik projesinde");
  });

  it("yayımlanmış revizyondaki donmuş tabloyu değiştirmez", () => {
    const frozen = { head: ["Eski"], rows: [["Donmuş"]] };
    expect(
      autoTableFor(
        { source: "elektrikMalzeme", frozen },
        { electricalParts: [] }
      )
    ).toBe(frozen);
  });
});
