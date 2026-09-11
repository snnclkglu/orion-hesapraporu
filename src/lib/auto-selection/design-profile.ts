/** Firma aday serisi: bir standart kapasitesi veya onaylı imalat projesi değildir.
 * Her adayın yeterliliğini ortak hesap motoru belirler; ölçü teyidi korunur. */
export const DESIGN_PROFILE = "orion-aday-serisi-2026-09-v3";
export const DESIGN_FACTORS = [0.5, 0.625, 0.75, 0.875, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3] as const;
const PLATES = [4, 5, 6, 8, 10, 12, 14, 16, 18, 20, 25, 30, 35, 40, 45, 50, 60, 70, 80, 100, 120, 150];
export const DESIGN_SHAFTS = [20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100, 110, 120, 130, 140, 150, 160, 170, 180, 190, 200, 220, 240, 260, 280, 300, 320, 340, 360, 380, 400];
export function designDimension(field: string, value: number): number | undefined {
  if (!Number.isFinite(value) || value <= 0) return undefined;
  if (/WeldThickness/.test(field)) return value <= 30 ? Math.max(3, Math.ceil(value)) : undefined;
  if (/Thickness|^t[1-5]Mm$/.test(field)) return PLATES.find(n => n >= value);
  if (/shaftD|shaftDia/.test(field)) return DESIGN_SHAFTS.find(n => n >= value);
  return value <= 6000 ? Math.max(50, Math.ceil(value / 25) * 25) : undefined;
}

/** Yan sac yüksekliği / üst sac genişliği: firma geometri aralığı. */
export function girderPlateRatioValid(inputs: Record<string, unknown>): boolean {
  const ratio = Number(inputs.h3Mm) / Number(inputs.b2Mm);
  return Number(inputs.b2Mm) > 0 && Number.isFinite(ratio) && ratio >= 1.5 && ratio <= 3;
}
