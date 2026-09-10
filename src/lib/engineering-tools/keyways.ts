// Kullanıcının verdiği "Keyway-and-Key-Size-Dimensions.pdf" belgesindeki
// METRİK tablo. Kaynak bir standart numarası belirtmediği için burada DIN/ISO
// adı uydurulmaz; ekranda "kaynak tablo" olarak sunulur.

export interface KeywayRow {
  shaftFromMm: number;
  shaftToMm: number;
  keywayWidthMm: number;
  keywayDepthMm: number;
  keyWidthMm: number;
  keyHeightMm: number;
}
export const KEYWAY_ROWS: readonly KeywayRow[] = [
  [6, 8, 2, 1, 2, 2], [9, 10, 3, 1.4, 3, 3], [11, 12, 4, 1.8, 4, 4],
  [13, 17, 5, 2.3, 5, 5], [18, 22, 6, 2.8, 6, 6], [23, 30, 8, 3.3, 8, 7],
  [31, 38, 10, 3.3, 10, 8], [39, 44, 12, 3.3, 12, 8], [45, 50, 14, 3.8, 14, 9],
  [51, 58, 16, 4.3, 16, 10], [59, 65, 18, 4.4, 18, 11], [66, 75, 20, 4.9, 20, 12],
  [76, 86, 22, 5.4, 22, 14], [86, 96, 25, 5.4, 25, 14], [96, 110, 28, 6.4, 28, 16],
  [111, 130, 32, 7.4, 32, 18], [131, 150, 36, 8.4, 36, 20], [151, 170, 40, 9.4, 40, 22],
  [171, 200, 45, 10.4, 45, 25], [201, 230, 50, 11.4, 50, 28], [231, 260, 56, 12.4, 56, 32],
  [261, 290, 63, 12.4, 63, 32], [291, 330, 70, 14.4, 70, 36], [331, 380, 80, 15.4, 80, 40],
  [381, 440, 90, 17.4, 90, 45], [441, 500, 100, 19.5, 100, 50],
].map(([shaftFromMm, shaftToMm, keywayWidthMm, keywayDepthMm, keyWidthMm, keyHeightMm]) => ({
  shaftFromMm, shaftToMm, keywayWidthMm, keywayDepthMm, keyWidthMm, keyHeightMm,
}));

/** Kaynakta 86 ve 96 mm sınırları iki satırda da geçtiği için dizi döner. */
export function findKeywayRows(shaftDiameterMm: number): readonly KeywayRow[] {
  if (!Number.isFinite(shaftDiameterMm) || shaftDiameterMm <= 0) return [];
  return KEYWAY_ROWS.filter(
    (row) => shaftDiameterMm >= row.shaftFromMm && shaftDiameterMm <= row.shaftToMm
  );
}
