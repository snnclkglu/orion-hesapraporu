// Halat kama soketi (denge traversi) — SAF statik katalog (drum-brake.ts deseni).
//
// Denge traversinde halat ucu bir kama soketiyle bağlanır. Soket HALAT ÇAPINA
// göre seçilir (yüke göre değil): her satır bir halat çapı aralığını taşır
// (dahil, ör. 14–16 → 14 ve 16 mm için). İki tip vardır: Normal ve Uzun.
// Kaynak: Van Beest Green Pin Open Wedge Socket CP (G-6413) / Open Long (G-6419).
// Aynı ürün Crosby'de de bulunur.
//
// Katalog PURE calc'ta durur ki motor DB olmadan otomatik seçebilsin (halat
// çapı bilindiğinde soketi doğrudan türetir; kanca freni/drum-brake ile aynı).

export interface WedgeSocketSpec {
  /** Üreticinin sipariş kodu (ör. "SKGOW016") */
  model: string;
  /** "Normal" | "Uzun" */
  type: "Normal" | "Uzun";
  /** Uygun halat çapı aralığı [mm] — dahil */
  ropeMinMm: number;
  ropeMaxMm: number;
  /** Minimum kırılma yükü [ton] */
  mblTon: number;
  /** Ağırlık [kg] */
  weightKg: number;
}

/** Green Pin Open Wedge Socket CP — Normal (G-6413) + Uzun (G-6419). */
export const WEDGE_SOCKETS: readonly WedgeSocketSpec[] = [
  // Normal
  { model: "SKGOW008", type: "Normal", ropeMinMm: 7, ropeMaxMm: 8, mblTon: 8, weightKg: 0.8 },
  { model: "SKGOW010", type: "Normal", ropeMinMm: 9, ropeMaxMm: 10, mblTon: 12, weightKg: 1.54 },
  { model: "SKGOW013", type: "Normal", ropeMinMm: 11, ropeMaxMm: 13, mblTon: 20, weightKg: 2.44 },
  { model: "SKGOW016", type: "Normal", ropeMinMm: 14, ropeMaxMm: 16, mblTon: 25, weightKg: 4.29 },
  { model: "SKGOW019", type: "Normal", ropeMinMm: 18, ropeMaxMm: 19, mblTon: 40, weightKg: 7.59 },
  { model: "SKGOW022", type: "Normal", ropeMinMm: 20, ropeMaxMm: 22, mblTon: 55, weightKg: 11.6 },
  { model: "SKGOW025", type: "Normal", ropeMinMm: 24, ropeMaxMm: 26, mblTon: 75, weightKg: 16.2 },
  { model: "SKGOW028", type: "Normal", ropeMinMm: 27, ropeMaxMm: 29, mblTon: 90, weightKg: 22.1 },
  { model: "SKGOW032", type: "Normal", ropeMinMm: 30, ropeMaxMm: 32, mblTon: 110, weightKg: 32.5 },
  { model: "SKGOW035", type: "Normal", ropeMinMm: 34, ropeMaxMm: 36, mblTon: 125, weightKg: 40.0 },
  { model: "SKGOW038", type: "Normal", ropeMinMm: 37, ropeMaxMm: 39, mblTon: 150, weightKg: 49.0 },
  { model: "SKGOW040", type: "Normal", ropeMinMm: 40, ropeMaxMm: 42, mblTon: 170, weightKg: 68.5 },
  { model: "SKGOW045", type: "Normal", ropeMinMm: 43, ropeMaxMm: 48, mblTon: 225, weightKg: 92.5 },
  // Uzun (9–32 mm bandı)
  { model: "SKGOW010L", type: "Uzun", ropeMinMm: 9, ropeMaxMm: 10, mblTon: 12, weightKg: 1.5 },
  { model: "SKGOW013L", type: "Uzun", ropeMinMm: 11, ropeMaxMm: 13, mblTon: 20, weightKg: 2.4 },
  { model: "SKGOW016L", type: "Uzun", ropeMinMm: 14, ropeMaxMm: 16, mblTon: 25, weightKg: 4.0 },
  { model: "SKGOW019L", type: "Uzun", ropeMinMm: 18, ropeMaxMm: 19, mblTon: 40, weightKg: 7.4 },
  { model: "SKGOW022L", type: "Uzun", ropeMinMm: 20, ropeMaxMm: 22, mblTon: 55, weightKg: 11.0 },
  { model: "SKGOW025L", type: "Uzun", ropeMinMm: 24, ropeMaxMm: 26, mblTon: 75, weightKg: 16.0 },
  { model: "SKGOW028L", type: "Uzun", ropeMinMm: 27, ropeMaxMm: 29, mblTon: 90, weightKg: 22.0 },
  { model: "SKGOW032L", type: "Uzun", ropeMinMm: 30, ropeMaxMm: 32, mblTon: 110, weightKg: 31.0 },
];

/**
 * Halat çapına ve tipe göre uygun soketi seçer. Çap bir aralığa girmiyorsa
 * (ör. Uzun tip yalnız 9–32 mm) `null` döner — uydurma bir soket verilmez.
 * Standart tip "Normal"dir.
 */
export function wedgeSocketForRope(
  ropeDiaMm: number | undefined | null,
  type: string | undefined | null
): WedgeSocketSpec | null {
  if (!Number.isFinite(ropeDiaMm) || (ropeDiaMm as number) <= 0) return null;
  const want = type === "Uzun" ? "Uzun" : "Normal";
  const d = ropeDiaMm as number;
  return (
    WEDGE_SOCKETS.find(
      (soket) => soket.type === want && d >= soket.ropeMinMm && d <= soket.ropeMaxMm
    ) ?? null
  );
}
