// KATSAYILAR ortak tabloları — scripts ile dökümden üretildi (elle düzenlemeyin).
// Kaynak: reference/excel-dump/11_KATSAYILAR.txt

/** DIN 15018 Tablo 17 — izin verilen yorulma gerilmeleri [N/mm²].
 * material: St37 (S235) | St52 (S355); notch: W0-W2 (kaynaksız) / K0-K4 (kaynaklı); loadGroup: B1-B6 */
export const DIN15018_T17: Record<string, Record<string, Record<string, number>>> = {
  "St37": {
    "W0": { "B1": 180, "B2": 180, "B3": 180, "B4": 169.7, "B5": 142.7, "B6": 120 },
    "W1": { "B1": 180, "B2": 180, "B3": 161.4, "B4": 135.8, "B5": 114.2, "B6": 96 },
    "W2": { "B1": 180, "B2": 168, "B3": 141.3, "B4": 118.8, "B5": 99.9, "B6": 84 },
    "K0": { "B1": 180, "B2": 180, "B3": 180, "B4": 168, "B5": 118.8, "B6": 84 },
    "K1": { "B1": 180, "B2": 180, "B3": 180, "B4": 150, "B5": 106.1, "B6": 75 },
    "K2": { "B1": 180, "B2": 180, "B3": 178.2, "B4": 126, "B5": 86.1, "B6": 63 },
    "K3": { "B1": 180, "B2": 180, "B3": 127.3, "B4": 90, "B5": 63.6, "B6": 45 },
    "K4": { "B1": 152.7, "B2": 108, "B3": 76.4, "B4": 54, "B5": 38.2, "B6": 27 },
  },
  "St52": {
    "W0": { "B1": 270, "B2": 270, "B3": 252.2, "B4": 203.2, "B5": 163.8, "B6": 132 },
    "W1": { "B1": 270, "B2": 249, "B3": 200.6, "B4": 161.1, "B5": 130.3, "B6": 105 },
    "W2": { "B1": 247.2, "B2": 199.2, "B3": 160.5, "B4": 129.3, "B5": 104.2, "B6": 84 },
    "K0": { "B1": 270, "B2": 270, "B3": 237.6, "B4": 168, "B5": 118.8, "B6": 84 },
    "K1": { "B1": 270, "B2": 270, "B3": 212.1, "B4": 150, "B5": 89.1, "B6": 63 },
    "K2": { "B1": 270, "B2": 252, "B3": 178.2, "B4": 126, "B5": 89.1, "B6": 63 },
    "K3": { "B1": 254, "B2": 180, "B3": 127.3, "B4": 90, "B5": 63.6, "B6": 45 },
    "K4": { "B1": 152.7, "B2": 108, "B3": 76.4, "B4": 54, "B5": 38.2, "B6": 27 },
  },
};

/** FEM T.4.2.4.1.4.a — c1 hız bandı başlıkları (d/dak) */
export const C1_SPEEDS = [10, 12.5, 16, 20, 25, 31.5, 40, 50, 63, 80, 100, 125, 160, 200, 250] as const;

/** c1 katsayı tablosu: teker çapı [mm] -> hız bandı sütunları (null = tablo dışı) */
export const C1_TABLE: Record<number, (number | null)[]> = {
  200: [1.09, 1.06, 1.03, 1, 0.97, 0.94, 0.91, 0.87, 0.82, 0.77, 0.72, 0.66, null, null, null],
  250: [1.11, 1.09, 1.06, 1.03, 1, 0.97, 0.94, 0.91, 0.87, 0.82, 0.77, 0.72, 0.66, null, null],
  315: [1.13, 1.11, 1.09, 1.06, 1.03, 1, 0.97, 0.94, 0.91, 0.87, 0.82, 0.77, 0.72, 0.66, null],
  400: [1.14, 1.13, 1.11, 1.09, 1.06, 1.03, 1, 0.97, 0.94, 0.91, 0.87, 0.82, 0.77, 0.72, 0.66],
  500: [1.15, 1.14, 1.13, 1.11, 1.09, 1.06, 1.03, 1, 0.97, 0.94, 0.91, 0.87, 0.82, 0.77, 0.72],
  630: [1.17, 1.15, 1.14, 1.13, 1.11, 1.09, 1.06, 1.03, 1, 0.97, 0.94, 0.91, 0.87, 0.82, 0.77],
  710: [null, 1.16, 1.14, 1.13, 1.12, 1.1, 1.07, 1.04, 1.02, 0.99, 0.96, 0.92, 0.89, 0.84, 0.79],
  800: [null, 1.17, 1.15, 1.14, 1.13, 1.11, 1.09, 1.06, 1.03, 1, 0.97, 0.94, 0.91, 0.87, 0.82],
  900: [null, null, 1.16, 1.14, 1.13, 1.12, 1.1, 1.07, 1.04, 1.02, 0.99, 0.96, 0.92, 0.89, 0.84],
  // Kaynak Excel'de F85 metin olarak "1,14" girilmiş; sayıya çevrildi.
  1000: [null, null, 1.17, 1.15, 1.14, 1.13, 1.11, 1.09, 1.06, 1.03, 1, 0.97, 0.94, 0.91, 0.87],
  1120: [null, null, null, 1.16, 1.14, 1.13, 1.12, 1.1, 1.07, 1.04, 1.02, 0.99, 0.96, 0.92, 0.89],
  1250: [null, null, null, 1.17, 1.15, 1.14, 1.13, 1.11, 1.09, 1.06, 1.03, 1, 0.97, 0.94, 0.91],
};

/** KATSAYILAR!Q81/R81 karşılığı: hız [m/dak] -> c1 sütun indeksi (0 tabanlı). */
export function c1SpeedIndex(speed: number): number {
  for (let i = 0; i < C1_SPEEDS.length - 1; i++) {
    if (speed >= C1_SPEEDS[i] && speed < C1_SPEEDS[i + 1]) return i;
  }
  return C1_SPEEDS.length - 1;
}

/** c1 katsayısı: teker çapı + hız (Excel VLOOKUP + Q81/R81) */
export function c1Factor(wheelDiaMm: number, speed: number): number | null {
  const row = C1_TABLE[wheelDiaMm];
  if (!row) return null;
  return row[c1SpeedIndex(speed)] ?? null;
}

/** Ray tablosu (KATSAYILAR C68:O70): baş genişliği [mm] ve radius */
export const RAILS: Record<string, { radius: number | null; headWidth: number }> = {
  "A150": { radius: 10, headWidth: 136.666666666667 },
  "A120": { radius: 10, headWidth: 106.666666666667 },
  "A100": { radius: 10, headWidth: 86.6666666666667 },
  "A75": { radius: 8, headWidth: 64.3333333333333 },
  "A65": { radius: 6, headWidth: 57 },
  "A55": { radius: 5, headWidth: 48.3333333333333 },
  "A45": { radius: 4, headWidth: 39.6666666666667 },
  "30x30": { radius: null, headWidth: 30 },
  "40x40": { radius: null, headWidth: 40 },
  "50x50": { radius: null, headWidth: 50 },
  "60x60": { radius: null, headWidth: 60 },
  "70x40": { radius: null, headWidth: 70 },
  "80x80": { radius: null, headWidth: 80 },
};
