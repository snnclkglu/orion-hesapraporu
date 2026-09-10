import { describe, expect, it } from "vitest";
import { calculateWeight } from "@/lib/engineering-tools/weight";
import { findKeywayRows } from "@/lib/engineering-tools/keyways";
import { calculateFit } from "@/lib/engineering-tools/tolerances";
import { railAccessories } from "@/lib/engineering-tools/rails";
import { BOLT_ROWS, calculateBoltTorque, eurocodeMinimumSpacing, recommendBoltLength } from "@/lib/engineering-tools/bolts";
import { EXTERNAL_CIRCLIPS, INTERNAL_CIRCLIPS } from "@/lib/engineering-tools/circlips";
import { findAxleHolder } from "@/lib/engineering-tools/axle-holders";
import { searchSeals, SUPTEX_SEALS } from "@/lib/engineering-tools/seals";

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

  it("H7/p6 sıkı geçme olarak sınıflanır", () => {
    const result = calculateFit(50, "H7", "p6");
    expect(result.kind).toBe("sikilik");
    expect(result.shaft.lowerMicrometre).toBe(26);
  });
});

describe("ray aksesuar eşleşmeleri", () => {
  it("A65 için Beket RP170 ve Crapex seçeneklerini verir", () => {
    const result = railAccessories("A65");
    expect(result.pads.map((row) => row.code)).toContain("RP170");
    expect(result.clamps.map((row) => row.model)).toContain("CRAPEX 400");
  });
  it("doğrulanmamış çubuk ray eşleşmesi uydurmaz", () => expect(railAccessories("50x50")).toEqual({ pads: [], clamps: [] }));
});

describe("cıvata merkezi", () => {
  const m16 = BOLT_ROWS.find((row) => row.designation === "M16")!;
  it("M16 temel ölçülerini taşır", () => expect(m16).toMatchObject({ pitchMm: 2, tapDrillMm: 14, stressAreaMm2: 157, wrenchMm: 24 }));
  it("sürtünme arttıkça referans tork artar", () => expect(calculateBoltTorque(m16, "10.9", 0.18).torqueNm).toBeGreaterThan(calculateBoltTorque(m16, "10.9", 0.1).torqueNm));
  it("önerilen standart boy gereken boydan kısa değildir", () => { const result = recommendBoltLength(m16, 30, 2); expect(result.recommendedMm).toBeGreaterThanOrEqual(result.requiredMm); });
  it("Eurocode katsayılarını delik çapına uygular", () => expect(eurocodeMinimumSpacing(18).p1Mm).toBeCloseTo(39.6));
});

describe("katalog araçları", () => {
  it("segman defterlerinde ortak 20 mm satırı vardır", () => { expect(EXTERNAL_CIRCLIPS.some((row)=>row.nominalMm===20)).toBe(true); expect(INTERNAL_CIRCLIPS.some((row)=>row.nominalMm===20)).toBe(true); });
  it("80 mm aks için bir tutucu ve M16 satırını seçer", () => expect(findAxleHolder(80)).toMatchObject({ bolt: "M16", aMm: 40 }));
  it("Suptex defteri eksiksizdir ve kodla aranır", () => { expect(SUPTEX_SEALS).toHaveLength(3896); expect(searchSeals("DMK-8609-NB01-1", "")[0]?.code).toBe("DMK-8609-NB01-1"); });
});
