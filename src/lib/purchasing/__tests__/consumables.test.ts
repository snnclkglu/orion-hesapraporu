import { describe, expect, it } from "vitest";
import {
  annualGroupMatrix,
  classifyConsumableSpike,
  denseMonthlyEurRange,
  selectedYearGroupMatrix,
  selectedYearMonthlyEurSeries,
  supplierDrilldownAggregate,
  type ConsumableExpenseAnalyticsRow,
} from "../consumables";

function expense(
  overrides: Partial<ConsumableExpenseAnalyticsRow> = {}
): ConsumableExpenseAnalyticsRow {
  return {
    expenseDate: "2026-01-15",
    amountEur: 100,
    groupKey: "bakim",
    groupLabel: "Bakım",
    supplierKey: "supplier-a",
    supplierLabel: "A Tedarik",
    materialKey: "sm-001",
    materialLabel: "Temizlik Bezi",
    ...overrides,
  };
}

describe("selectedYearMonthlyEurSeries — 12 ay her zaman yoğundur", () => {
  it("boş ayları sıfırlar, aynı ayı toplar ve gelecek ayı işaretler", () => {
    const series = selectedYearMonthlyEurSeries(
      [
        expense({ expenseDate: "2026-01-03", amountEur: 40 }),
        expense({ expenseDate: "2026-01-28", amountEur: 60 }),
        expense({ expenseDate: "2026-03-10", amountEur: 200 }),
        expense({ expenseDate: "2026-09-01", amountEur: 900 }),
        expense({ expenseDate: "2025-01-01", amountEur: 9_999 }),
      ],
      2026,
      "2026-08-14"
    );

    expect(series).toHaveLength(12);
    expect(series[0]).toMatchObject({
      monthKey: "2026-01",
      monthLabel: "Ocak 2026",
      amountEur: 100,
      recordCount: 2,
      isFuture: false,
    });
    expect(series[1]).toMatchObject({ amountEur: 0, recordCount: 0, isFuture: false });
    expect(series[7].isFuture).toBe(false);
    expect(series[8]).toMatchObject({ amountEur: 900, isFuture: true });
  });

  it("kur karşılığı olmayan, sonlu olmayan ve bozuk tarihli satırı toplamaz", () => {
    const series = selectedYearMonthlyEurSeries(
      [
        expense({ amountEur: null }),
        expense({ amountEur: Number.NaN }),
        expense({ expenseDate: "2026-02-30" }),
        expense({ expenseDate: "2026-02-28", amountEur: 25 }),
      ],
      2026,
      "2026-12-31"
    );
    expect(series.reduce((sum, month) => sum + month.amountEur, 0)).toBe(25);
    expect(series.reduce((sum, month) => sum + month.recordCount, 0)).toBe(1);
  });
});

describe("classifyConsumableSpike — diğer POZİTİF ayların ortalaması", () => {
  it("en az üç başka pozitif ay olmadan hücreyi boyamaz", () => {
    expect(classifyConsumableSpike(999, [100, 100, 0, -20])).toEqual({
      level: "none",
      baselineAverageEur: null,
      baselineMonthCount: 2,
      ratioToBaseline: null,
    });
  });

  it("eşikler katıdır: >1,5× artış, >2× güçlü artış", () => {
    expect(classifyConsumableSpike(150, [100, 100, 100]).level).toBe("none");
    expect(classifyConsumableSpike(151, [100, 100, 100]).level).toBe("spike");
    expect(classifyConsumableSpike(200, [100, 100, 100]).level).toBe("spike");
    expect(classifyConsumableSpike(201, [100, 100, 100])).toMatchObject({
      level: "strong",
      baselineAverageEur: 100,
      baselineMonthCount: 3,
      ratioToBaseline: 2.01,
    });
  });
});

describe("selectedYearGroupMatrix — grup × ay ve gelecek ay kuralı", () => {
  it("gelecek ayı bazdan çıkarır ve gelecek hücrenin kendisini de işaretlemez", () => {
    const rows = [
      ...[1, 2, 3, 4].map((month) =>
        expense({ expenseDate: `2026-${String(month).padStart(2, "0")}-10`, amountEur: 100 })
      ),
      expense({ expenseDate: "2026-05-10", amountEur: 201 }),
      // 10.000 EUR eylülde gerçekleşmiş gibi veri gelse dahi mayıs bazını bozmamalı.
      expense({ expenseDate: "2026-09-10", amountEur: 10_000 }),
      expense({
        expenseDate: "2026-01-10",
        amountEur: 10,
        groupKey: "ofis",
        groupLabel: "Ofis",
      }),
      expense({
        expenseDate: "2026-02-10",
        amountEur: 10,
        groupKey: "ofis",
        groupLabel: "Ofis",
      }),
      expense({
        expenseDate: "2026-05-10",
        amountEur: 1_000,
        groupKey: "ofis",
        groupLabel: "Ofis",
      }),
    ];

    const matrix = selectedYearGroupMatrix(rows, 2026, "2026-05-20");
    const bakim = matrix.rows.find((row) => row.groupKey === "bakim")!;
    const ofis = matrix.rows.find((row) => row.groupKey === "ofis")!;

    expect(bakim.cells).toHaveLength(12);
    expect(bakim.cells[4]).toMatchObject({
      amountEur: 201,
      anomaly: "strong",
      baselineAverageEur: 100,
      baselineMonthCount: 4,
      ratioToBaseline: 2.01,
      isFuture: false,
    });
    expect(bakim.cells[8]).toMatchObject({
      amountEur: 10_000,
      anomaly: "none",
      baselineAverageEur: null,
      baselineMonthCount: 0,
      isFuture: true,
    });
    expect(bakim.averageEur).toBeCloseTo(601 / 5);
    // Ofis mayısında yalnız ocak ve şubat pozitif bazdır: dev tutar olsa da renk yok.
    expect(ofis.cells[4]).toMatchObject({ anomaly: "none", baselineMonthCount: 2 });
  });
});

describe("denseMonthlyEurRange — yıllar arasında ay atlamaz", () => {
  const rows = [
    expense({ expenseDate: "2024-11-15", amountEur: 10 }),
    expense({ expenseDate: "2025-01-15", amountEur: 30 }),
  ];

  it("verinin ilk ve son ayı arasında sıfırlı ay üretir", () => {
    expect(denseMonthlyEurRange(rows).map((month) => [month.monthKey, month.amountEur])).toEqual([
      ["2024-11", 10],
      ["2024-12", 0],
      ["2025-01", 30],
    ]);
  });

  it("açık aralıkta başı ve sonu da dense tutar", () => {
    const series = denseMonthlyEurRange(rows, { fromMonth: "2024-10", toMonth: "2025-02" });
    expect(series.map((month) => month.monthKey)).toEqual([
      "2024-10",
      "2024-11",
      "2024-12",
      "2025-01",
      "2025-02",
    ]);
    expect(series[0].amountEur).toBe(0);
    expect(series[4].amountEur).toBe(0);
  });
});

describe("annualGroupMatrix — eksik yıl da sütundur", () => {
  it("ilk-son yıl arasını yoğunlaştırır ve grup/yıl toplamlarını verir", () => {
    const matrix = annualGroupMatrix([
      expense({ expenseDate: "2024-05-01", amountEur: 100 }),
      expense({ expenseDate: "2026-05-01", amountEur: 300 }),
      expense({
        expenseDate: "2026-07-01",
        amountEur: 500,
        groupKey: "ofis",
        groupLabel: "Ofis",
      }),
    ]);

    expect(matrix.years).toEqual([2024, 2025, 2026]);
    expect(matrix.totals.map((cell) => cell.amountEur)).toEqual([100, 0, 800]);
    expect(matrix.totalEur).toBe(900);
    expect(matrix.recordCount).toBe(3);
    expect(matrix.rows.map((row) => row.groupKey)).toEqual(["ofis", "bakim"]);
    expect(matrix.rows.find((row) => row.groupKey === "bakim")!.cells).toEqual([
      { year: 2024, amountEur: 100, recordCount: 1 },
      { year: 2025, amountEur: 0, recordCount: 0 },
      { year: 2026, amountEur: 300, recordCount: 1 },
    ]);
  });
});

describe("supplierDrilldownAggregate — tek tedarikçinin EUR geçmişi", () => {
  it("aylık/yıllık seri ile grup ve malzeme kırılımlarını birlikte toplar", () => {
    const rows = [
      expense({
        expenseDate: "2024-12-05",
        amountEur: 100,
        supplierLabel: "Eski A Tedarik",
      }),
      expense({
        expenseDate: "2025-02-05",
        amountEur: 300,
        supplierLabel: "Yeni A Tedarik",
        groupKey: "ofis",
        groupLabel: "Ofis",
        materialKey: "sm-002",
        materialLabel: "Fotokopi Kağıdı",
      }),
      expense({
        expenseDate: "2025-02-20",
        amountEur: 100,
        supplierLabel: "Yeni A Tedarik",
        groupKey: "ofis",
        groupLabel: "Ofis",
        materialKey: "sm-002",
        materialLabel: "Fotokopi Kağıdı",
      }),
      expense({ supplierKey: "supplier-b", amountEur: 9_999 }),
      expense({ supplierKey: "supplier-a", amountEur: null }),
    ];

    const result = supplierDrilldownAggregate(rows, "supplier-a")!;
    expect(result).toMatchObject({
      supplierLabel: "Yeni A Tedarik",
      totalEur: 500,
      recordCount: 3,
      firstExpenseDate: "2024-12-05",
      lastExpenseDate: "2025-02-20",
    });
    expect(result.monthly.map((month) => [month.monthKey, month.amountEur])).toEqual([
      ["2024-12", 100],
      ["2025-01", 0],
      ["2025-02", 400],
    ]);
    expect(result.annual).toEqual([
      { year: 2024, amountEur: 100, recordCount: 1 },
      { year: 2025, amountEur: 400, recordCount: 2 },
    ]);
    expect(result.groups.map((group) => [group.key, group.amountEur, group.shareOfTotal])).toEqual([
      ["ofis", 400, 0.8],
      ["bakim", 100, 0.2],
    ]);
    expect(result.materials.map((material) => [material.key, material.amountEur])).toEqual([
      ["sm-002", 400],
      ["sm-001", 100],
    ]);
    expect(result.averageMonthlyEur).toBeCloseTo(500 / 3);
  });

  it("tedarikçinin geçerli EUR kaydı yoksa null döner", () => {
    expect(supplierDrilldownAggregate([], "supplier-a")).toBeNull();
    expect(
      supplierDrilldownAggregate([expense({ amountEur: null })], "supplier-a")
    ).toBeNull();
  });
});

describe("geçersiz dönem girdisi sessizce yanlış seri üretmez", () => {
  it("bozuk tarih/yıl ve ters aralıkta açık hata verir", () => {
    expect(() => selectedYearMonthlyEurSeries([], 2026, "2026-02-30")).toThrow(RangeError);
    expect(() => selectedYearMonthlyEurSeries([], 0, "2026-01-01")).toThrow(RangeError);
    expect(() =>
      denseMonthlyEurRange([], { fromMonth: "2026-03", toMonth: "2026-02" })
    ).toThrow(RangeError);
    expect(() => annualGroupMatrix([], { fromYear: 2026, toYear: 2025 })).toThrow(RangeError);
  });
});
