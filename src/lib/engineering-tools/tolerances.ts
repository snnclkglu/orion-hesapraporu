// fit_tolerances.pdf içindeki JIS B 0401:1999 metrik ölçü basamakları ve
// güvenle doğrulanabilen IT değerleri. İlk kapsam H delik, h/js mil sınıflarıdır.

export type HoleToleranceCode = "H6" | "H7" | "H8" | "H9" | "H10";
export type ShaftToleranceCode = "h5" | "h6" | "h7" | "h8" | "h9" | "js5" | "js6" | "js7" | "p6";

interface ToleranceBand {
  fromExclusiveMm: number;
  toInclusiveMm: number;
  it: Record<5 | 6 | 7 | 8 | 9 | 10, number>;
}
export const TOLERANCE_BANDS: readonly ToleranceBand[] = [
  { fromExclusiveMm: 0, toInclusiveMm: 3, it: { 5: 4, 6: 6, 7: 10, 8: 14, 9: 25, 10: 40 } },
  { fromExclusiveMm: 3, toInclusiveMm: 6, it: { 5: 5, 6: 8, 7: 12, 8: 18, 9: 30, 10: 48 } },
  { fromExclusiveMm: 6, toInclusiveMm: 10, it: { 5: 6, 6: 9, 7: 15, 8: 22, 9: 36, 10: 58 } },
  { fromExclusiveMm: 10, toInclusiveMm: 18, it: { 5: 8, 6: 11, 7: 18, 8: 27, 9: 43, 10: 70 } },
  { fromExclusiveMm: 18, toInclusiveMm: 30, it: { 5: 9, 6: 13, 7: 21, 8: 33, 9: 52, 10: 84 } },
  { fromExclusiveMm: 30, toInclusiveMm: 50, it: { 5: 11, 6: 16, 7: 25, 8: 39, 9: 62, 10: 100 } },
  { fromExclusiveMm: 50, toInclusiveMm: 80, it: { 5: 13, 6: 19, 7: 30, 8: 46, 9: 74, 10: 120 } },
  { fromExclusiveMm: 80, toInclusiveMm: 120, it: { 5: 15, 6: 22, 7: 35, 8: 54, 9: 87, 10: 140 } },
  { fromExclusiveMm: 120, toInclusiveMm: 180, it: { 5: 18, 6: 25, 7: 40, 8: 63, 9: 100, 10: 160 } },
  { fromExclusiveMm: 180, toInclusiveMm: 250, it: { 5: 20, 6: 29, 7: 46, 8: 72, 9: 115, 10: 185 } },
  { fromExclusiveMm: 250, toInclusiveMm: 315, it: { 5: 23, 6: 32, 7: 52, 8: 81, 9: 130, 10: 210 } },
  { fromExclusiveMm: 315, toInclusiveMm: 400, it: { 5: 25, 6: 36, 7: 57, 8: 89, 9: 140, 10: 230 } },
  { fromExclusiveMm: 400, toInclusiveMm: 500, it: { 5: 27, 6: 40, 7: 63, 8: 97, 9: 155, 10: 250 } },
];

export interface DeviationResult {
  code: HoleToleranceCode | ShaftToleranceCode;
  lowerMicrometre: number;
  upperMicrometre: number;
  minSizeMm: number;
  maxSizeMm: number;
}

export interface FitResult {
  hole: DeviationResult;
  shaft: DeviationResult;
  minClearanceMicrometre: number;
  maxClearanceMicrometre: number;
  kind: "bosluklu" | "gecis" | "sikilik";
  behavior: string;
  behaviorNote: string;
}

const P6_LOWER_BY_BAND = [6, 12, 15, 18, 22, 26, 32, 37, 43, 50, 56, 62, 68] as const;

function gradeOf(code: string): 5 | 6 | 7 | 8 | 9 | 10 {
  return Number(code.replace(/\D/g, "")) as 5 | 6 | 7 | 8 | 9 | 10;
}

function toleranceFor(sizeMm: number, grade: 5 | 6 | 7 | 8 | 9 | 10): number {
  const band = TOLERANCE_BANDS.find(
    (item) => sizeMm > item.fromExclusiveMm && sizeMm <= item.toInclusiveMm
  );
  if (!band) throw new Error("Anma ölçüsü 0 mm'den büyük ve en fazla 500 mm olmalı.");
  return band.it[grade];
}

export function calculateFit(
  nominalMm: number,
  holeCode: HoleToleranceCode,
  shaftCode: ShaftToleranceCode
): FitResult {
  if (!Number.isFinite(nominalMm) || nominalMm <= 0 || nominalMm > 500) {
    throw new Error("Anma ölçüsü 0 mm'den büyük ve en fazla 500 mm olmalı.");
  }
  const holeIt = toleranceFor(nominalMm, gradeOf(holeCode));
  const shaftIt = toleranceFor(nominalMm, gradeOf(shaftCode));
  const hole: DeviationResult = {
    code: holeCode,
    lowerMicrometre: 0,
    upperMicrometre: holeIt,
    minSizeMm: nominalMm,
    maxSizeMm: nominalMm + holeIt / 1000,
  };
  const shaftIsJs = shaftCode.startsWith("js");
  const bandIndex = TOLERANCE_BANDS.findIndex((item) => nominalMm > item.fromExclusiveMm && nominalMm <= item.toInclusiveMm);
  const p6Lower = shaftCode === "p6" ? P6_LOWER_BY_BAND[bandIndex] : null;
  const shaftUpper = p6Lower !== null ? p6Lower + shaftIt : shaftIsJs ? shaftIt / 2 : 0;
  const shaftLower = p6Lower !== null ? p6Lower : shaftIsJs ? -shaftIt / 2 : -shaftIt;
  const shaft: DeviationResult = {
    code: shaftCode,
    lowerMicrometre: shaftLower,
    upperMicrometre: shaftUpper,
    minSizeMm: nominalMm + shaftLower / 1000,
    maxSizeMm: nominalMm + shaftUpper / 1000,
  };
  const minClearanceMicrometre = hole.lowerMicrometre - shaft.upperMicrometre;
  const maxClearanceMicrometre = hole.upperMicrometre - shaft.lowerMicrometre;
  const kind = minClearanceMicrometre >= 0 ? "bosluklu" : maxClearanceMicrometre <= 0 ? "sikilik" : "gecis";
  const behavior = shaftCode === "h6" && holeCode === "H7" ? "Yakın boşluklu / elle kayar" : shaftCode === "js6" && holeCode === "H7" ? "Hassas konumlama" : shaftCode === "p6" && holeCode === "H7" ? "Pres geçme" : kind === "bosluklu" ? "Boşluklu" : kind === "gecis" ? "Geçiş" : "Sıkı";
  return {
    hole,
    shaft,
    minClearanceMicrometre,
    maxClearanceMicrometre,
    kind,
    behavior,
    behaviorNote: "Kullanım karakteri ön seçim bilgisidir; yük, sıcaklık, yüzey, yağlama ve montaj yöntemi ayrıca değerlendirilir.",
  };
}
