// Yük hücresi (loadcell) — SAF statik katalog (drum-brake.ts deseni).
//
// Denge traversi/makarasında halat yükünü ölçen pim tipi loadcell. Yük =
// halat yükü × sabit halat adedi. Seçici, MARKAya göre, gerekli yükün
// ÜSTÜNDEKİ en küçük kapasiteyi önerir. İki marka: Esit PLC, Kobastar LPW1.
// Kaynak: Esit PLC ölçü resimleri; Kobastar LPW1 ürün veri sayfası.

export interface LoadCellSpec {
  brand: "Esit" | "Kobastar";
  model: string;
  capacityKg: number;
  bodyDiaMm: number;
  lengthMm: number;
  /**
   * ÜRÜN AĞIRLIĞI [kg] — yalnız üreticinin YAYIMLADIĞI satırlarda vardır.
   *
   * `undefined` = BİLİNMİYOR, `0` DEĞİL (değişmez md. 4). Esit PLC ölçü
   * resimleri kütleyi basar; Kobastar LPW1 föyü basmaz ve o satırlar bilerek
   * boş kalır — ağırlık dökümü orada "katalogda yok" der ve mühendis elle
   * girebilir.
   */
  weightKg?: number;
}

export const LOAD_CELLS: readonly LoadCellSpec[] = [
  // Esit PLC (ayrık kapasiteler)
  { brand: "Esit", model: "PLC 2000", capacityKg: 2000, bodyDiaMm: 39.8, lengthMm: 139, weightKg: 0.9 },
  { brand: "Esit", model: "PLC 5000", capacityKg: 5000, bodyDiaMm: 39.8, lengthMm: 160, weightKg: 1.1 },
  { brand: "Esit", model: "PLC 10", capacityKg: 10000, bodyDiaMm: 49.8, lengthMm: 199, weightKg: 2.5 },
  { brand: "Esit", model: "PLC 15", capacityKg: 15000, bodyDiaMm: 59.8, lengthMm: 199, weightKg: 4.1 },
  { brand: "Esit", model: "PLC 30", capacityKg: 30000, bodyDiaMm: 84.8, lengthMm: 290, weightKg: 11.7 },
  // Kobastar LPW1 (siparişe göre 2–60 t; ölçü bandı temsili)
  { brand: "Kobastar", model: "LPW1 5t", capacityKg: 5000, bodyDiaMm: 35, lengthMm: 105 },
  { brand: "Kobastar", model: "LPW1 10t", capacityKg: 10000, bodyDiaMm: 50.4, lengthMm: 152 },
  { brand: "Kobastar", model: "LPW1 20t", capacityKg: 20000, bodyDiaMm: 65.4, lengthMm: 195 },
  { brand: "Kobastar", model: "LPW1 40t", capacityKg: 40000, bodyDiaMm: 85, lengthMm: 265 },
];

export const LOAD_CELL_BRANDS = ["Esit", "Kobastar"] as const;

/** Model koduyla arama — ağırlık dökümü hesap hücresinden gelen kodu çözer. */
export function loadCellByModel(model: string | undefined | null): LoadCellSpec | null {
  const aranan = (model ?? "").trim();
  if (!aranan) return null;
  return (
    LOAD_CELLS.find((c) => c.model === aranan) ??
    LOAD_CELLS.find((c) => `${c.brand} ${c.model}` === aranan) ??
    null
  );
}

/**
 * Markaya göre, gerekli yükün ÜSTÜNDEKİ en küçük kapasiteli loadcell'i seçer.
 * Marka verilmezse Esit varsayılır. Hiçbir kapasite yetmiyorsa en büyük döner
 * (yine de yetersiz — kontrol bunu "uygun değil" gösterir), yük 0 ise `null`.
 */
export function loadCellForLoad(
  loadKg: number | undefined | null,
  brand: string | undefined | null
): LoadCellSpec | null {
  if (!Number.isFinite(loadKg) || (loadKg as number) <= 0) return null;
  const want = brand === "Kobastar" ? "Kobastar" : "Esit";
  const family = LOAD_CELLS.filter((c) => c.brand === want).sort(
    (a, b) => a.capacityKg - b.capacityKg
  );
  if (family.length === 0) return null;
  return family.find((c) => c.capacityKg >= (loadKg as number)) ?? family[family.length - 1];
}
