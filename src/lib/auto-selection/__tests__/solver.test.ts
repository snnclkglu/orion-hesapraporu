import { describe, expect, it } from "vitest";
import { getCatalogMapping } from "@/lib/catalog-mapping";
import { missingCatalogFields, normalizeCatalog, positive, replaceCatalogSelection, variantKey } from "../catalog";
import { contentHash, type EquipmentRow } from "../types";
import { solveSelection } from "../solver";
import { requestFixture } from "./fixtures";
const motor: EquipmentRow = { id: "a", kind: "motor", brand: "TEST", model: "M100", attrs: { power_kw: 11, rpm: 1460, shaft_mm: 42 } };
describe("hızlı seçim temel sözleşmesi", () => {
  it("eski ürünün kapasitesini ve ölçülerini yeni ürüne taşımaz", () => {
    const row = { ...motor, attrs: { power_kw: 4, rpm: 1450 } };
    const result = replaceCatalogSelection(getCatalogMapping("main", "2.4")!, row, { motorShaftMm: 80, motorWeightKg: 900, motorCount: 2 });
    expect(result.motorShaftMm).toBeNull(); expect(result.motorWeightKg).toBeNull(); expect(result.motorCount).toBe(2);
    expect(missingCatalogFields(row)).toContain("shaft_mm");
  });
  it("kW ve oran varyantlarını yalnız model adına indirgemez", () => {
    expect(variantKey(motor)).not.toBe(variantKey({ ...motor, attrs: { ...motor.attrs, power_kw: 15 } }));
    expect(normalizeCatalog([motor, { ...motor, id: "b" }])).toHaveLength(1);
  });
  it("belirsiz sayıyı ve sonsuzluğu kapasite kabul etmez", () => {
    for (const value of ["4/8", "2–4", "12 mm", Infinity, NaN, null, 0, -1, ""]) expect(positive(value)).toBeUndefined();
    expect(positive("1,25")).toBe(1.25);
    expect(contentHash({ a: 1, b: 2 })).toBe(contentHash({ b: 2, a: 1 }));
    expect(contentHash({ a: NaN })).not.toBe(contentHash({ a: null }));
  });
  it("boş katalogla başarı ve ölçü teyidi üretmez, kaynağı değiştirmez", () => {
    const request = requestFixture(); const before = contentHash(request);
    const result = solveSelection(request, []);
    expect(result.trace.status).toBe("incomplete"); expect(result.trace.issues.length).toBeGreaterThan(0);
    expect(contentHash(request)).toBe(before);
    expect(result.modules.wheelLoads.inputs).toEqual(request.modules.wheelLoads.inputs);
  });
  it("kilitli modülün seçimlerini korur", () => {
    const request = requestFixture(); request.locks = ["main"];
    const result = solveSelection(request, [motor]);
    expect(result.modules.main.selections).toEqual(request.modules.main.selections);
    expect(result.trace.decisions).toHaveLength(0);
  });
});
