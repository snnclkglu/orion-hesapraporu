// Teknik Araçlar · ağırlık hesabı saf çekirdeği.
//
// Bütün uzunluklar mm, yoğunluk g/cm³, sonuçlar kg'dır. Çelik için uygulama
// varsayılanı 7,85 g/cm³'tür. Bu modül React, tarayıcı ve veritabanı bilmez.

export const STEEL_DENSITY_G_CM3 = 7.85;

export type WeightShape =
  | "plate"
  | "disc"
  | "ring"
  | "roundBar"
  | "pipe"
  | "rectTube";

export interface WeightDimensions {
  widthMm?: number;
  heightMm?: number;
  thicknessMm?: number;
  lengthMm?: number;
  outerDiameterMm?: number;
  innerDiameterMm?: number;
}
export interface WeightCalculation {
  shape: WeightShape;
  dimensions: WeightDimensions;
  densityGcm3?: number;
  quantity?: number;
}

export interface WeightResult {
  crossSectionMm2: number;
  volumeMm3: number;
  kgPerM: number | null;
  unitKg: number;
  totalKg: number;
  formula: string;
}

function positive(value: number | undefined, label: string): number {
  if (value === undefined || !Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} sıfırdan büyük olmalı.`);
  }
  return value;
}

function circleArea(diameterMm: number): number {
  return (Math.PI * diameterMm ** 2) / 4;
}

export function calculateWeight(input: WeightCalculation): WeightResult {
  const density = positive(input.densityGcm3 ?? STEEL_DENSITY_G_CM3, "Özkütle");
  const quantity = positive(input.quantity ?? 1, "Adet");
  const d = input.dimensions;

  let crossSectionMm2: number;
  let volumeMm3: number;
  let linear = false;
  let formula: string;

  switch (input.shape) {
    case "plate": {
      const width = positive(d.widthMm, "En");
      const thickness = positive(d.thicknessMm, "Kalınlık");
      const length = positive(d.lengthMm, "Boy");
      crossSectionMm2 = width * thickness;
      volumeMm3 = crossSectionMm2 * length;
      linear = true;
      formula = "en × kalınlık × boy × özkütle";
      break;
    }
    case "disc": {
      const outer = positive(d.outerDiameterMm, "Dış çap");
      const thickness = positive(d.thicknessMm, "Kalınlık");
      crossSectionMm2 = circleArea(outer);
      volumeMm3 = crossSectionMm2 * thickness;
      formula = "π × dış çap² ÷ 4 × kalınlık × özkütle";
      break;
    }
    case "ring": {
      const outer = positive(d.outerDiameterMm, "Dış çap");
      const inner = positive(d.innerDiameterMm, "İç çap");
      const thickness = positive(d.thicknessMm, "Kalınlık");
      if (inner >= outer) throw new Error("İç çap dış çaptan küçük olmalı.");
      crossSectionMm2 = circleArea(outer) - circleArea(inner);
      volumeMm3 = crossSectionMm2 * thickness;
      formula = "π × (dış çap² − iç çap²) ÷ 4 × kalınlık × özkütle";
      break;
    }
    case "roundBar": {
      const outer = positive(d.outerDiameterMm, "Çap");
      const length = positive(d.lengthMm, "Boy");
      crossSectionMm2 = circleArea(outer);
      volumeMm3 = crossSectionMm2 * length;
      linear = true;
      formula = "π × çap² ÷ 4 × boy × özkütle";
      break;
    }
    case "pipe": {
      const outer = positive(d.outerDiameterMm, "Dış çap");
      const wall = positive(d.thicknessMm, "Et kalınlığı");
      const length = positive(d.lengthMm, "Boy");
      const inner = outer - 2 * wall;
      if (inner <= 0) throw new Error("Et kalınlığı dış çapın yarısından küçük olmalı.");
      crossSectionMm2 = circleArea(outer) - circleArea(inner);
      volumeMm3 = crossSectionMm2 * length;
      linear = true;
      formula = "π × (dış çap² − iç çap²) ÷ 4 × boy × özkütle";
      break;
    }
    case "rectTube": {
      const width = positive(d.widthMm, "En");
      const height = positive(d.heightMm, "Yükseklik");
      const wall = positive(d.thicknessMm, "Et kalınlığı");
      const length = positive(d.lengthMm, "Boy");
      if (2 * wall >= Math.min(width, height)) {
        throw new Error("Et kalınlığı kesitin yarısından küçük olmalı.");
      }
      crossSectionMm2 = width * height - (width - 2 * wall) * (height - 2 * wall);
      volumeMm3 = crossSectionMm2 * length;
      linear = true;
      formula = "[en × yükseklik − iç en × iç yükseklik] × boy × özkütle";
      break;
    }
  }

  // 1 g/cm³ = 10⁻⁶ kg/mm³.
  const unitKg = volumeMm3 * density * 1e-6;
  return {
    crossSectionMm2,
    volumeMm3,
    kgPerM: linear ? crossSectionMm2 * 1000 * density * 1e-6 : null,
    unitKg,
    totalKg: unitKg * quantity,
    formula,
  };
}
