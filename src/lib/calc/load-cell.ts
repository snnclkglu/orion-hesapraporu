// Yük hücresi (loadcell) — SAF statik katalog (drum-brake.ts deseni).
//
// Denge traversi/makarasında halat yükünü ölçen pim tipi loadcell. Yük =
// halat yükü × sabit halat adedi. Seçici, MARKAya göre, gerekli yükün
// ÜSTÜNDEKİ en küçük kapasiteyi önerir. İki marka: Esit PL/PLI, Kobastar LPW1.
// Kaynak: Esit PL/PLI değişiklik föyü; Kobastar LPW1 ürün veri sayfası.

export interface LoadCellSpec {
  brand: "Esit" | "Kobastar";
  model: string;
  series: "PL" | "PLI" | "LPW1";
  capacityKg: number;
  bodyDiaMm: number;
  lengthMm: number;
  /** Esit teknik resmindeki A…F ölçüleri [mm]. */
  aMm?: number;
  bMm?: number;
  cMm?: number;
  dMm?: number;
  eMm?: number;
  fMm?: number;
  /** Esit'in güncel sipariş/malzeme kodu. */
  productCode?: string;
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
  // Esit PL — çelik. Ölçüler, kullanıcının sağladığı 28.10.2025 tarihli
  // PLC → PL/PLI değişiklik föyündeki yeni ürün tablosudur.
  { brand: "Esit", series: "PL", model: "PL-2", capacityKg: 2000, bodyDiaMm: 40, lengthMm: 135, aMm: 135, bMm: 6, cMm: 6, dMm: 6.5, eMm: 40, fMm: 30.5, productCode: "152-061502800-0004" },
  { brand: "Esit", series: "PL", model: "PL-5", capacityKg: 5000, bodyDiaMm: 40, lengthMm: 155, aMm: 155, bMm: 6, cMm: 6, dMm: 6.5, eMm: 40, fMm: 37.5, productCode: "152-061503000-0006" },
  { brand: "Esit", series: "PL", model: "PL-10", capacityKg: 10000, bodyDiaMm: 50, lengthMm: 195, aMm: 195, bMm: 8, cMm: 8, dMm: 7, eMm: 50, fMm: 46, productCode: "152-061503300-0003" },
  { brand: "Esit", series: "PL", model: "PL-15", capacityKg: 15000, bodyDiaMm: 60, lengthMm: 195, aMm: 195, bMm: 8, cMm: 8, dMm: 9, eMm: 60, fMm: 46, productCode: "152-061503400-0002" },
  { brand: "Esit", series: "PL", model: "PL-20", capacityKg: 20000, bodyDiaMm: 75, lengthMm: 265, aMm: 265, bMm: 10, cMm: 10, dMm: 10.5, eMm: 75, fMm: 64.5, productCode: "152-061503500-0004" },
  { brand: "Esit", series: "PL", model: "PL-30", capacityKg: 30000, bodyDiaMm: 85, lengthMm: 280, aMm: 280, bMm: 10, cMm: 10, dMm: 13, eMm: 85, fMm: 64.5, productCode: "152-061503700-0006" },
  { brand: "Esit", series: "PL", model: "PL-60", capacityKg: 60000, bodyDiaMm: 85, lengthMm: 280, aMm: 280, bMm: 10, cMm: 10, dMm: 13, eMm: 85, fMm: 64.5, productCode: "152-061503900-0005" },
  // Esit PLI — paslanmaz. Aynı föy PL/PLI için ortak yeni geometrileri ve
  // ayrı sipariş kodlarını yayımlar.
  { brand: "Esit", series: "PLI", model: "PLI-2", capacityKg: 2000, bodyDiaMm: 40, lengthMm: 135, aMm: 135, bMm: 6, cMm: 6, dMm: 6.5, eMm: 40, fMm: 30.5, productCode: "152-061502800-0002" },
  { brand: "Esit", series: "PLI", model: "PLI-5", capacityKg: 5000, bodyDiaMm: 40, lengthMm: 155, aMm: 155, bMm: 6, cMm: 6, dMm: 6.5, eMm: 40, fMm: 37.5, productCode: "152-061503000-0005" },
  { brand: "Esit", series: "PLI", model: "PLI-10", capacityKg: 10000, bodyDiaMm: 50, lengthMm: 195, aMm: 195, bMm: 8, cMm: 8, dMm: 7, eMm: 50, fMm: 46, productCode: "152-061503300-0004" },
  { brand: "Esit", series: "PLI", model: "PLI-15", capacityKg: 15000, bodyDiaMm: 60, lengthMm: 195, aMm: 195, bMm: 8, cMm: 8, dMm: 9, eMm: 60, fMm: 46, productCode: "152-061503400-0003" },
  { brand: "Esit", series: "PLI", model: "PLI-20", capacityKg: 20000, bodyDiaMm: 75, lengthMm: 265, aMm: 265, bMm: 10, cMm: 10, dMm: 10.5, eMm: 75, fMm: 64.5, productCode: "152-061503500-0003" },
  { brand: "Esit", series: "PLI", model: "PLI-30", capacityKg: 30000, bodyDiaMm: 85, lengthMm: 280, aMm: 280, bMm: 10, cMm: 10, dMm: 13, eMm: 85, fMm: 64.5, productCode: "152-061503700-0005" },
  { brand: "Esit", series: "PLI", model: "PLI-60", capacityKg: 60000, bodyDiaMm: 85, lengthMm: 280, aMm: 280, bMm: 10, cMm: 10, dMm: 13, eMm: 85, fMm: 64.5, productCode: "152-061503900-0004" },
  // Kobastar LPW1 (siparişe göre 2–60 t; ölçü bandı temsili)
  { brand: "Kobastar", series: "LPW1", model: "LPW1 5t", capacityKg: 5000, bodyDiaMm: 35, lengthMm: 105 },
  { brand: "Kobastar", series: "LPW1", model: "LPW1 10t", capacityKg: 10000, bodyDiaMm: 50.4, lengthMm: 152 },
  { brand: "Kobastar", series: "LPW1", model: "LPW1 20t", capacityKg: 20000, bodyDiaMm: 65.4, lengthMm: 195 },
  { brand: "Kobastar", series: "LPW1", model: "LPW1 40t", capacityKg: 40000, bodyDiaMm: 85, lengthMm: 265 },
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
  brand: string | undefined | null,
  series?: string | undefined | null
): LoadCellSpec | null {
  if (!Number.isFinite(loadKg) || (loadKg as number) <= 0) return null;
  const want = brand === "Kobastar" ? "Kobastar" : "Esit";
  const wantedSeries = want === "Esit" && series === "PLI" ? "PLI" : want === "Esit" ? "PL" : "LPW1";
  const family = LOAD_CELLS.filter((c) => c.brand === want && c.series === wantedSeries).sort(
    (a, b) => a.capacityKg - b.capacityKg
  );
  if (family.length === 0) return null;
  return family.find((c) => c.capacityKg >= (loadKg as number)) ?? family[family.length - 1];
}
