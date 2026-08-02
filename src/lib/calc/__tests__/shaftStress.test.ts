// Mil gerilme modülü testleri — doğrulama referansı mukavemet formülleridir:
// W = π·D³/32, A = π·D²/4, von Mises √(σ²+3τ²), bileşke √(σ²+τ²).

import { describe, expect, it } from "vitest";
import {
  CIRCULAR_PEAK_SHEAR_FACTOR,
  circularAreaCm2,
  circularSectionModulusCm3,
  shaftStress,
  stressUtilization,
  type ShaftStressInput,
} from "../shaftStress";

/** Ortak temel girdi: D = 10 cm, M = 100.000 kg·cm, V = 5.000 kg */
const BASE: ShaftStressInput = {
  momentKgCm: 100000,
  shearKg: 5000,
  bendingDiameterCm: 10,
  shearDiameterCm: 10,
  combined: "vonMises",
  shear: "ortalama",
};

describe("kesit özellikleri", () => {
  it("W = π·D³/32 elle hesapla doğrulanır", () => {
    // D = 10 → W = π·1000/32 = 98,1747704...
    expect(circularSectionModulusCm3(10)).toBeCloseTo((Math.PI * 1000) / 32, 10);
    expect(circularSectionModulusCm3(10)).toBeCloseTo(98.174770424681, 9);
    // D = 6,5 → W = π·274,625/32
    expect(circularSectionModulusCm3(6.5)).toBeCloseTo(
      (Math.PI * 6.5 ** 3) / 32,
      10
    );
  });

  it("A = π·D²/4 elle hesapla doğrulanır", () => {
    expect(circularAreaCm2(10)).toBeCloseTo((Math.PI * 100) / 4, 10);
    expect(circularAreaCm2(10)).toBeCloseTo(78.539816339745, 9);
    expect(circularAreaCm2(4)).toBeCloseTo(4 * Math.PI, 10);
  });

  it("çap iki katına çıkınca W sekiz, A dört katına çıkar", () => {
    expect(circularSectionModulusCm3(20) / circularSectionModulusCm3(10)).toBeCloseTo(8, 9);
    expect(circularAreaCm2(20) / circularAreaCm2(10)).toBeCloseTo(4, 9);
  });

  it("sonuç nesnesindeki kesit değerleri yardımcılarla aynıdır", () => {
    const result = shaftStress({
      ...BASE,
      bendingDiameterCm: 9,
      shearDiameterCm: 7,
    });
    expect(result.sectionModulusCm3).toBeCloseTo(circularSectionModulusCm3(9), 12);
    expect(result.shearAreaCm2).toBeCloseTo(circularAreaCm2(7), 12);
  });
});

describe("eğilme ve kayma gerilmeleri", () => {
  it("σ = |M| / W", () => {
    const result = shaftStress(BASE);
    expect(result.bendingStress).toBeCloseTo(100000 / ((Math.PI * 1000) / 32), 9);
    expect(result.bendingStress).toBeCloseTo(1018.5916357881, 6);
  });

  it("momentin işareti gerilmeyi etkilemez", () => {
    const positive = shaftStress(BASE);
    const negative = shaftStress({ ...BASE, momentKgCm: -100000, shearKg: -5000 });
    expect(negative.bendingStress).toBeCloseTo(positive.bendingStress, 12);
    expect(negative.shearStress).toBeCloseTo(positive.shearStress, 12);
    expect(negative.combinedStress).toBeCloseTo(positive.combinedStress, 12);
  });

  it("ortalama kayma: τ = V / A", () => {
    const result = shaftStress({ ...BASE, shear: "ortalama" });
    expect(result.shearStress).toBeCloseTo(5000 / ((Math.PI * 100) / 4), 9);
    expect(result.shearStress).toBeCloseTo(63.6619772368, 6);
  });

  it("maksimum kayma dağılımı ortalamanın 4/3 (≈1,33) katıdır", () => {
    const ortalama = shaftStress({ ...BASE, shear: "ortalama" });
    const maksimum = shaftStress({ ...BASE, shear: "maksimum" });
    expect(maksimum.shearStress / ortalama.shearStress).toBeCloseTo(
      CIRCULAR_PEAK_SHEAR_FACTOR,
      12
    );
    expect(CIRCULAR_PEAK_SHEAR_FACTOR).toBeCloseTo(1.33, 2);
    expect(maksimum.shearStress).toBeCloseTo((4 / 3) * 63.6619772368, 6);
    // Eğilme gerilmesi kayma kabulünden etkilenmez
    expect(maksimum.bendingStress).toBeCloseTo(ortalama.bendingStress, 12);
  });

  it("farklı eğilme ve kesme çapları bağımsız kullanılır", () => {
    const result = shaftStress({
      ...BASE,
      bendingDiameterCm: 8,
      shearDiameterCm: 12,
    });
    expect(result.bendingStress).toBeCloseTo(100000 / ((Math.PI * 512) / 32), 9);
    expect(result.shearStress).toBeCloseTo(5000 / ((Math.PI * 144) / 4), 9);
  });
});

describe("bileşke gerilme konvansiyonları", () => {
  it("vonMises = √(σ² + 3τ²)", () => {
    const result = shaftStress({ ...BASE, combined: "vonMises" });
    const beklenen = Math.sqrt(
      result.bendingStress ** 2 + 3 * result.shearStress ** 2
    );
    expect(result.combinedStress).toBeCloseTo(beklenen, 9);
  });

  it("resultant = √(σ² + τ²)", () => {
    const result = shaftStress({ ...BASE, combined: "resultant" });
    const beklenen = Math.sqrt(
      result.bendingStress ** 2 + result.shearStress ** 2
    );
    expect(result.combinedStress).toBeCloseTo(beklenen, 9);
  });

  it("vonMises kabulü resultant'tan daima büyüktür (τ ≠ 0 iken)", () => {
    const vonMises = shaftStress({ ...BASE, combined: "vonMises" });
    const resultant = shaftStress({ ...BASE, combined: "resultant" });
    expect(vonMises.combinedStress).toBeGreaterThan(resultant.combinedStress);
    // İki kabul arasındaki fark yalnızca kayma teriminin ağırlığıdır
    expect(vonMises.combinedStress ** 2 - resultant.combinedStress ** 2).toBeCloseTo(
      2 * vonMises.shearStress ** 2,
      6
    );
  });

  it("saf kaymada vonMises = τ·√3, resultant = τ", () => {
    const girdi: ShaftStressInput = { ...BASE, momentKgCm: 0 };
    const vonMises = shaftStress({ ...girdi, combined: "vonMises" });
    const resultant = shaftStress({ ...girdi, combined: "resultant" });
    expect(vonMises.combinedStress).toBeCloseTo(
      vonMises.shearStress * Math.sqrt(3),
      9
    );
    expect(resultant.combinedStress).toBeCloseTo(resultant.shearStress, 9);
  });

  it("saf eğilmede iki kabul de σ'ya eşittir", () => {
    const girdi: ShaftStressInput = { ...BASE, shearKg: 0 };
    for (const combined of ["vonMises", "resultant"] as const) {
      const result = shaftStress({ ...girdi, combined });
      expect(result.combinedStress).toBeCloseTo(result.bendingStress, 9);
    }
  });
});

describe("sınır durumları", () => {
  it("sıfır veya negatif çap NaN/Infinity üretmez", () => {
    for (const diameterCm of [0, -5, Number.NaN, Number.POSITIVE_INFINITY]) {
      const result = shaftStress({
        ...BASE,
        bendingDiameterCm: diameterCm,
        shearDiameterCm: diameterCm,
      });
      expect(Number.isFinite(result.bendingStress)).toBe(true);
      expect(Number.isFinite(result.shearStress)).toBe(true);
      expect(Number.isFinite(result.combinedStress)).toBe(true);
      expect(result.combinedStress).toBe(0);
    }
  });

  it("sıfır kesit kuvvetlerinde tüm gerilmeler sıfırdır", () => {
    const result = shaftStress({ ...BASE, momentKgCm: 0, shearKg: 0 });
    expect(result.bendingStress).toBe(0);
    expect(result.shearStress).toBe(0);
    expect(result.combinedStress).toBe(0);
  });
});

describe("stressUtilization", () => {
  it("oran = mevcut / emniyet", () => {
    expect(stressUtilization(1200, 1600)).toBeCloseTo(0.75, 12);
    expect(stressUtilization(1800, 1600)).toBeCloseTo(1.125, 12);
  });

  it("geçersiz emniyet gerilmesinde 0 döner (NaN/Infinity üretmez)", () => {
    for (const allowable of [0, -100, Number.NaN, Number.POSITIVE_INFINITY]) {
      const oran = stressUtilization(1200, allowable);
      expect(Number.isFinite(oran)).toBe(true);
      expect(oran).toBe(0);
    }
  });
});
