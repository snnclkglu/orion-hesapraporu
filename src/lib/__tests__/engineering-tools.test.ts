import { describe, expect, it } from "vitest";
import { calculateWeight } from "@/lib/engineering-tools/weight";
import { findKeywayRows } from "@/lib/engineering-tools/keyways";
import { calculateFit } from "@/lib/engineering-tools/tolerances";

describe("metrik ağırlık hesabı", () => {
  it("1 m² × 1 mm çeliği 7,85 kg hesaplar", () => {
    const result = calculateWeight({ shape: "plate", dimensions: { widthMm: 1000, lengthMm: 1000, thicknessMm: 1 } });
    expect(result.unitKg).toBeCloseTo(7.85, 10);
  });

  it("boruda metre ağırlığı ile parça ağırlığı aynı temelden gelir", () => {
    const result = calculateWeight({ shape: "pipe", dimensions: { outerDiameterMm: 100, thicknessMm: 5, lengthMm: 2000 }, quantity: 3 });
    expect(result.unitKg).toBeCloseTo((result.kgPerM ?? 0) * 2, 10);
    expect(result.totalKg).toBeCloseTo(result.unitKg * 3, 10);
  });

  it("geçersiz iç geometrileri reddeder", () => {
    expect(() => calculateWeight({ shape: "ring", dimensions: { outerDiameterMm: 50, innerDiameterMm: 50, thicknessMm: 10 } })).toThrow(/İç çap/);
  });
});
describe("kama kaynak tablosu", () => {
  it("30 mm mil için 8 × 7 mm kama verir", () => {
    expect(findKeywayRows(30)).toEqual([expect.objectContaining({ keyWidthMm: 8, keyHeightMm: 7 })]);
  });

  it("kaynak belgedeki 86 mm sınır çakışmasını gizlemez", () => {
    expect(findKeywayRows(86)).toHaveLength(2);
  });
});

describe("JIS/ISO metrik geçme hesabı", () => {
  it("50 mm H7/h6 sınırlarını kaynak tablodaki IT değerleriyle verir", () => {
    const result = calculateFit(50, "H7", "h6");
    expect(result.hole.upperMicrometre).toBe(25);
    expect(result.shaft.lowerMicrometre).toBe(-16);
    expect(result.hole.maxSizeMm).toBeCloseTo(50.025, 10);
    expect(result.shaft.minSizeMm).toBeCloseTo(49.984, 10);
    expect(result.kind).toBe("bosluklu");
  });

  it("H7/js6 geçiş geçmesi olarak sınıflanır", () => {
    expect(calculateFit(50, "H7", "js6").kind).toBe("gecis");
  });
});
