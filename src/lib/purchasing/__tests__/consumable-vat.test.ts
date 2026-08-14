import { describe, expect, it } from "vitest";
import { calculateConsumableVatTotals } from "../consumable-vat";

describe("calculateConsumableVatTotals", () => {
  it("farklı KDV oranlarını satır bazında toplar", () => {
    expect(
      calculateConsumableVatTotals([
        { net: 100, vatRate: 20 },
        { net: 200, vatRate: 10 },
        { net: 300, vatRate: 1 },
      ])
    ).toEqual({ net: 600, vat: 43, gross: 643 });
  });

  it("bozuk tutarları hesaba katmaz", () => {
    expect(
      calculateConsumableVatTotals([
        { net: Number.NaN, vatRate: 20 },
        { net: -10, vatRate: 10 },
        { net: 50, vatRate: 1 },
      ])
    ).toEqual({ net: 50, vat: 0.5, gross: 50.5 });
  });
});
