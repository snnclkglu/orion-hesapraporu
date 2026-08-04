// Tambur emniyet freni — katalog verisi ve seçim hesabı doğrulaması.
//
// Ölçüt fiziktir ve SIBRE kataloğudur: tork bağıntısı, sıkma kuvveti tabloları
// ve disk geometrisi sınırları. Kullanıcının elindeki eski Excel sayfası
// yalnız BİR NOKTADA (bilinen sayısal örnek) karşılaştırma için kullanılır —
// şartname değildir.

import { describe, expect, it } from "vitest";
import {
  BRAKE_ARRANGEMENTS,
  SAFETY_BRAKES,
  SAFETY_BRAKE_FRICTION,
  brakeTorqueNm,
  brakesInArrangement,
  clampForceKn,
  minFlangeDiaMm,
  safetyBrakeByCode,
} from "../safety-brake";

describe("SIBRE SHI katalog tablosu", () => {
  it("tüm modeller tekil koda ve pozitif geometriye sahiptir", () => {
    const codes = SAFETY_BRAKES.map((b) => b.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const b of SAFETY_BRAKES) {
      expect(b.leverXMm).toBeGreaterThan(0);
      expect(b.minDiscDiaMm).toBeGreaterThan(0);
      expect(b.discOverDrumMm).toBeGreaterThan(0);
      expect(b.minDiscThicknessMm).toBeGreaterThan(0);
      expect(b.releasePressureBar).toBeGreaterThan(0);
      expect(Object.keys(b.clampKn).length).toBeGreaterThan(0);
    }
  });

  it("sıkma kuvveti hava aralığı büyüdükçe azalır (yay boşalır)", () => {
    for (const b of SAFETY_BRAKES) {
      const gaps = [1, 2, 3] as const;
      const vals = gaps.map((g) => b.clampKn[g]).filter((v): v is number => v !== undefined);
      for (let i = 1; i < vals.length; i++) {
        expect(vals[i]).toBeLessThanOrEqual(vals[i - 1]);
      }
    }
  });

  it("SHI 231/232 yalnız 2…3 mm bandında çalışır", () => {
    for (const code of ["SHI 231", "SHI 232"]) {
      const m = safetyBrakeByCode(code)!;
      expect(m.clampKn[1]).toBeUndefined();
      expect(m.clampKn[2]).toBeGreaterThan(0);
      expect(m.clampKn[3]).toBeGreaterThan(0);
      expect(clampForceKn(m, 1)).toBeUndefined();
    }
  });

  it("katalog değerleri noktasal olarak doğrudur", () => {
    // SHI 105: FA(c=1/2/3) = 83,2 / 77,0 / 74,4 kN · x = 60 · d ≥ 650 · d1 = d−280
    const m = safetyBrakeByCode("SHI 105")!;
    expect(m.clampKn).toEqual({ 1: 83.2, 2: 77.0, 3: 74.4 });
    expect(m.leverXMm).toBe(60);
    expect(m.minDiscDiaMm).toBe(650);
    expect(m.discOverDrumMm).toBe(280);
    // SHI 75-1: en küçük model
    const s75 = safetyBrakeByCode("SHI 75-1")!;
    expect(s75.leverXMm).toBe(42.5);
    expect(s75.minDiscDiaMm).toBe(400);
    // SHI 282: en büyük model
    const s282 = safetyBrakeByCode("SHI 282")!;
    expect(s282.clampKn[1]).toBe(555);
    expect(s282.leverXMm).toBe(112.5);
    expect(s282.minDiscThicknessMm).toBe(30);
  });

  it("bilinmeyen kod undefined döner", () => {
    expect(safetyBrakeByCode("YOK")).toBeUndefined();
    expect(safetyBrakeByCode(undefined)).toBeUndefined();
    expect(clampForceKn(undefined, 2)).toBeUndefined();
  });
});

describe("frenleme momenti — M = 2·FA·µ·(d/2 − x)", () => {
  it("bilinen sayısal örneği birebir verir", () => {
    // SHI 105, c = 2 mm → FA = 77 kN; flanş Ø950; x = 60
    //   M = 2 · 77000 · 0,4 · (475 − 60) / 1000 = 25.564 Nm
    const m = brakeTorqueNm({
      clampForceN: 77_000,
      frictionCoeff: 0.4,
      flangeDiaMm: 950,
      leverXMm: 60,
    });
    expect(m).toBeCloseTo(25_564, 6);
  });

  it("sürtünme yarıçapı ile doğru orantılıdır", () => {
    const base = { clampForceN: 50_000, frictionCoeff: 0.4, leverXMm: 60 };
    const m1 = brakeTorqueNm({ ...base, flangeDiaMm: 1000 });
    const m2 = brakeTorqueNm({ ...base, flangeDiaMm: 1880 }); // yarıçap iki katı
    expect(m2 / m1).toBeCloseTo(2, 9);
  });

  it("sıkma kuvvetiyle ve sürtünme katsayısıyla doğru orantılıdır", () => {
    const base = { flangeDiaMm: 900, leverXMm: 60 };
    const a = brakeTorqueNm({ ...base, clampForceN: 40_000, frictionCoeff: 0.4 });
    const b = brakeTorqueNm({ ...base, clampForceN: 80_000, frictionCoeff: 0.4 });
    const c = brakeTorqueNm({ ...base, clampForceN: 40_000, frictionCoeff: 0.2 });
    expect(b).toBeCloseTo(2 * a, 9);
    expect(c).toBeCloseTo(a / 2, 9);
  });

  it("flanş kaliper baskı noktasından küçükse moment sıfırdır (negatif kol yok)", () => {
    expect(
      brakeTorqueNm({ clampForceN: 77_000, frictionCoeff: 0.4, flangeDiaMm: 100, leverXMm: 60 })
    ).toBe(0);
  });

  it("balata sürtünme katsayısı katalog değeridir", () => {
    expect(SAFETY_BRAKE_FRICTION).toBe(0.4);
  });
});

describe("minimum flanş dış çapı", () => {
  it("katalogun en küçük disk çapı ile tambur + Δ koşulunun büyüğünü alır", () => {
    const m = safetyBrakeByCode("SHI 105")!; // d ≥ 650, Δ = 280
    // Küçük tamburda katalog alt sınırı belirleyicidir
    expect(minFlangeDiaMm({ model: m, drumDiaMm: 300, clearanceMm: 0 })).toBe(650);
    // Büyük tamburda geometrik koşul belirleyicidir
    expect(minFlangeDiaMm({ model: m, drumDiaMm: 500, clearanceMm: 0 })).toBe(780);
  });

  it("montaj payı alt sınırın üstüne biner", () => {
    const m = safetyBrakeByCode("SHI 105")!;
    expect(minFlangeDiaMm({ model: m, drumDiaMm: 450, clearanceMm: 140 })).toBe(730 + 140);
  });

  it("negatif pay yok sayılır", () => {
    const m = safetyBrakeByCode("SHI 105")!;
    expect(minFlangeDiaMm({ model: m, drumDiaMm: 450, clearanceMm: -50 })).toBe(730);
  });

  it("model seçilmediyse NaN döner (sessiz sıfır değil)", () => {
    expect(minFlangeDiaMm({ model: undefined, drumDiaMm: 450, clearanceMm: 0 })).toBeNaN();
  });
});

describe("yerleşim düzeni → kaliper adedi", () => {
  it("altı standart düzenin tamamı çözülür", () => {
    const counts = BRAKE_ARRANGEMENTS.map((a) => brakesInArrangement(a));
    expect(counts).toEqual([1, 2, 1, 2, 2, 4]);
  });

  it("tanımsız düzen en güvenli tarafa (tek fren) düşer", () => {
    expect(brakesInArrangement(undefined)).toBe(1);
    expect(brakesInArrangement("")).toBe(1);
    expect(brakesInArrangement("bilinmeyen")).toBe(1);
  });
});
