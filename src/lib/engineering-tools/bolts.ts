export type BoltGrade = "8.8" | "10.9";

export interface BoltRow {
  designation: string;
  diameterMm: number;
  pitchMm: number;
  tapDrillMm: number;
  stressAreaMm2: number;
  clearanceMm: { fine: number; medium: number; coarse: number };
  wrenchMm: number;
  socketCounterboreMm: number | null;
  nutHeightMm: number;
  washer: { innerMm: number; outerMm: number; thicknessMm: number };
}

export const BOLT_ROWS: readonly BoltRow[] = [
  ["M6", 6, 1, 5, 20.1, 6.4, 6.6, 7, 10, 11, 5, 6.4, 12, 1.6],
  ["M8", 8, 1.25, 6.8, 36.6, 8.4, 9, 10, 13, 15, 6.5, 8.4, 16, 1.6],
  ["M10", 10, 1.5, 8.5, 58, 10.5, 11, 12, 16, 18, 8, 10.5, 20, 2],
  ["M12", 12, 1.75, 10.2, 84.3, 13, 13.5, 15, 18, 20, 10, 13, 24, 2.5],
  ["M16", 16, 2, 14, 157, 17, 17.5, 19, 24, 26, 13, 17, 30, 3],
  ["M20", 20, 2.5, 17.5, 245, 21, 22, 24, 30, 33, 16, 21, 37, 3],
  ["M24", 24, 3, 21, 353, 25, 26, 28, 36, 39, 19, 25, 44, 4],
  ["M30", 30, 3.5, 26.5, 561, 31, 33, 35, 46, 50, 24, 31, 56, 4],
  ["M36", 36, 4, 32, 817, 37, 39, 42, 55, 58, 29, 37, 66, 5],
].map(([designation, diameterMm, pitchMm, tapDrillMm, stressAreaMm2, fine, medium, coarse, wrenchMm, socketCounterboreMm, nutHeightMm, innerMm, outerMm, thicknessMm]) => ({
  designation: String(designation), diameterMm: Number(diameterMm), pitchMm: Number(pitchMm), tapDrillMm: Number(tapDrillMm), stressAreaMm2: Number(stressAreaMm2),
  clearanceMm: { fine: Number(fine), medium: Number(medium), coarse: Number(coarse) }, wrenchMm: Number(wrenchMm), socketCounterboreMm: Number(socketCounterboreMm), nutHeightMm: Number(nutHeightMm),
  washer: { innerMm: Number(innerMm), outerMm: Number(outerMm), thicknessMm: Number(thicknessMm) },
}));

const STANDARD_LENGTHS = [12, 16, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 90, 100, 110, 120, 130, 140, 150, 160, 180, 200, 220, 240, 260, 280, 300] as const;
const YIELD_MPA: Record<BoltGrade, number> = { "8.8": 640, "10.9": 900 };

export function calculateBoltTorque(row: BoltRow, grade: BoltGrade, friction: number, utilisation = 0.7) {
  if (!(friction >= 0.06 && friction <= 0.3)) throw new Error("Sürtünme katsayısı 0,06 ile 0,30 arasında olmalı.");
  const preloadN = utilisation * YIELD_MPA[grade] * row.stressAreaMm2;
  const pitchDiameterMm = row.diameterMm - 0.64952 * row.pitchMm;
  const bearingDiameterMm = (row.wrenchMm + row.clearanceMm.medium) / 2;
  const torqueNmm = preloadN * (row.pitchMm / (2 * Math.PI) + 0.57735 * pitchDiameterMm * friction + bearingDiameterMm * friction / 2);
  return { preloadKn: preloadN / 1000, torqueNm: torqueNmm / 1000 };
}

export function recommendBoltLength(row: BoltRow, gripMm: number, washerCount: 0 | 1 | 2) {
  if (!Number.isFinite(gripMm) || gripMm <= 0) throw new Error("Sıkıştırılan kalınlık sıfırdan büyük olmalı.");
  const requiredMm = gripMm + washerCount * row.washer.thicknessMm + row.nutHeightMm + 2 * row.pitchMm;
  const recommendedMm = STANDARD_LENGTHS.find((value) => value >= requiredMm) ?? null;
  return { requiredMm, recommendedMm };
}

export function eurocodeMinimumSpacing(holeDiameterMm: number) {
  if (!Number.isFinite(holeDiameterMm) || holeDiameterMm <= 0) throw new Error("Delik çapı sıfırdan büyük olmalı.");
  return { e1Mm: 1.2 * holeDiameterMm, e2Mm: 1.2 * holeDiameterMm, p1Mm: 2.2 * holeDiameterMm, p2Mm: 2.4 * holeDiameterMm };
}
