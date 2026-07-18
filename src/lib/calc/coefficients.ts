// FEM / DIN katsayı tabloları — Excel KATSAYILAR sayfasının kod karşılığı.
// Motor saf kalsın diye tablolar gömülüdür; Supabase cat_* tabloları aynı
// verinin UI/yönetim kopyasıdır. Kaynak: reference/excel-dump/11_KATSAYILAR.txt

import type { MechanismClass, ShaftMaterial, UsageClass } from "./types";

/** Gerekli halat emniyet katsayıları Zp (KATSAYILAR A19:F30, FEM) */
const ROPE_SAFETY: Record<MechanismClass, { moving: number; fixed: number }> = {
  M1: { moving: 3.15, fixed: 2.5 },
  M2: { moving: 3.35, fixed: 2.5 },
  M3: { moving: 3.55, fixed: 3 },
  M4: { moving: 4, fixed: 3.5 },
  M5: { moving: 4.5, fixed: 4 },
  M6: { moving: 5.6, fixed: 4.5 },
  M7: { moving: 7.1, fixed: 5 },
  M8: { moving: 9, fixed: 5 },
};

export function ropeSafetyFactor(mech: MechanismClass, ropeType: "moving" | "fixed" = "moving"): number {
  return ROPE_SAFETY[mech][ropeType === "moving" ? "moving" : "fixed"];
}

/** Tambur / makara / denge makarası minimum çap katsayıları H (A39:I49) */
const DRUM_SHEAVE_COEFF: Record<MechanismClass, { drum: number; sheave: number; equalizer: number }> = {
  M1: { drum: 11.2, sheave: 12.5, equalizer: 11.2 },
  M2: { drum: 12.5, sheave: 14, equalizer: 12.5 },
  M3: { drum: 14, sheave: 16, equalizer: 12.5 },
  M4: { drum: 16, sheave: 18, equalizer: 14 },
  M5: { drum: 18, sheave: 20, equalizer: 14 },
  M6: { drum: 20, sheave: 22.4, equalizer: 16 },
  M7: { drum: 22.4, sheave: 25, equalizer: 16 },
  M8: { drum: 25, sheave: 28, equalizer: 18 },
};

export function drumCoefficient(mech: MechanismClass): number {
  return DRUM_SHEAVE_COEFF[mech].drum;
}
export function sheaveCoefficient(mech: MechanismClass): number {
  return DRUM_SHEAVE_COEFF[mech].sheave;
}
export function equalizerCoefficient(mech: MechanismClass): number {
  return DRUM_SHEAVE_COEFF[mech].equalizer;
}

/** Gerekli mekanizma ömürleri [saat] (A52:J64, FEM T.2.1.3.2) */
const MECHANISM_LIFE: Record<UsageClass, { min: number | null; max: number | null }> = {
  T0: { min: null, max: 200 },
  T1: { min: 200, max: 400 },
  T2: { min: 400, max: 800 },
  T3: { min: 800, max: 1600 },
  T4: { min: 1600, max: 3200 },
  T5: { min: 3200, max: 6300 },
  T6: { min: 6300, max: 12500 },
  T7: { min: 12500, max: 25000 },
  T8: { min: 25000, max: 50000 },
  T9: { min: 50000, max: null },
};

export function mechanismLife(usage: UsageClass): { min: number | null; max: number | null } {
  return MECHANISM_LIFE[usage];
}

/** Mil malzemeleri izin verilen gerilmeler [kg/cm²] (A32:J36) */
const SHAFT_MATERIALS: Record<ShaftMaterial, { bending: number; shear: number; combined: number }> = {
  C25: { bending: 850, shear: 490, combined: 850 },
  C30: { bending: 920, shear: 530, combined: 920 },
  C35: { bending: 980, shear: 565, combined: 980 },
  "4140+QT": { bending: 1570, shear: 900, combined: 1570 },
  "4140": { bending: 1300, shear: 1300 / Math.sqrt(3), combined: 1300 }, // Excel J35 = J34/SQRT(3)
};

export function shaftMaterialAllowables(material: ShaftMaterial) {
  return SHAFT_MATERIALS[material];
}

/**
 * Halat oluk adımı [mm] — DIN 15061 basamak fonksiyonu (Excel 02!L41).
 * Halat çapına göre oluk adımı = çap + pay.
 */
export function groovePitch(ropeDiaMm: number): number {
  if (ropeDiaMm < 8) return ropeDiaMm + 1;
  if (ropeDiaMm < 11) return ropeDiaMm + 1.5;
  if (ropeDiaMm < 21) return ropeDiaMm + 2;
  if (ropeDiaMm < 29) return ropeDiaMm + 3;
  if (ropeDiaMm < 41) return ropeDiaMm + 4;
  if (ropeDiaMm < 46) return ropeDiaMm + 5;
  if (ropeDiaMm < 56) return ropeDiaMm + 6;
  return ropeDiaMm + 7;
}

/** Tambur sacı izin verilen gerilme [kg/cm²] (Excel 02!L50) */
export function drumAllowableStress(material: "S235" | "S355"): number {
  return material === "S235" ? 500 : 700;
}
