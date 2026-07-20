// Görüntüleme birimi dönüşümü — tüm hesap/rapor yüzeylerinde gerilmeler MPa,
// momentler Nm cinsinden gösterilir. Hesap motoru iç değerlerini kendi
// biriminde tutar (golden testler bunlara bakar); dönüşüm YALNIZCA sunum
// katmanında yapılır.
//
// Sunum `unit` etiketi, saklanan değerin gerçek birimini güvenilir biçimde
// gösterir (kg/cm² etiketli satır kg/cm² tutar; N/mm² etiketli satır zaten
// N/mm² = MPa tutar). Bu yüzden dönüşüm etiket bazlıdır.

/** 1 kgf/cm² = 0,0980665 MPa  ·  1 kgf·cm = 0,0980665 N·m (aynı katsayı) */
export const KGF_TO_MPA = 0.0980665;
const KGF = KGF_TO_MPA;

export interface DisplayValue {
  value: number | string | null | undefined;
  unit?: string;
}

/**
 * Bir (değer, birim) çiftini gösterim birimine çevirir.
 * - kg/cm²  → MPa  (değer × 0,0980665)
 * - kg·cm   → Nm   (değer × 0,0980665)
 * - N/mm²   → MPa  (sayısal değişiklik yok; N/mm² ≡ MPa)
 * - diğer   → olduğu gibi
 */
export function toDisplayUnit(
  value: number | string | null | undefined,
  unit: string | undefined
): DisplayValue {
  if (unit === undefined) return { value, unit };
  const u = unit.trim();
  const num = typeof value === "number" ? value : undefined;
  if (u === "kg/cm²" || u === "kg/cm2") {
    return { value: num === undefined ? value : num * KGF, unit: "MPa" };
  }
  if (u === "kg·cm" || u === "kg.cm" || u === "kgcm") {
    return { value: num === undefined ? value : num * KGF, unit: "Nm" };
  }
  if (u === "N/mm²" || u === "N/mm2") {
    return { value, unit: "MPa" };
  }
  return { value, unit };
}

/** Yalnız etiket dönüşümü (girdi alanı başlıkları vb. sayısal değeri sabit). */
export function toDisplayUnitLabel(unit: string | undefined): string | undefined {
  if (unit === undefined) return undefined;
  const u = unit.trim();
  if (u === "kg/cm²" || u === "kg/cm2" || u === "N/mm²" || u === "N/mm2") return "MPa";
  if (u === "kg·cm" || u === "kg.cm" || u === "kgcm") return "Nm";
  return unit;
}
