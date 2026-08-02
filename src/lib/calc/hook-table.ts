// DIN 15400 Tablo 3 — Kanca taşıma kapasiteleri (Tragfähigkeit).
//
// Kanca numarası + malzeme mukavemet sınıfı (M/P/S/T/V) + mekanizma grubu
// üçlüsü taşıma kapasitesini belirler. Tablo 10 sütunludur; her mukavemet
// sınıfı bu sütunlardan farklı bir pencereye oturur:
//
//   sınıf   1Bm  1Am  2m   3m   4m   5m
//   V       c1   c2   c3   c4   c5   —
//   T       c2   c3   c4   c5   c6   —
//   S       c3   c4   c5   c6   c7   c8
//   P       c4   c5   c6   c7   c8   c9
//   M       c5   c6   c7   c8   c9   c10
//
// Yani sütun indeksi = sınıf kaydırması + mekanizma grubu indeksidir. Aynı
// kanca numarasında daha yüksek mukavemet sınıfı (V en yüksek) daha büyük
// kapasite, daha ağır çalışma grubu ise daha küçük kapasite verir.
//
// Uygulama FEM 1.001 M1–M8 sınıflarını kullandığından DIN 15020 grup
// karşılıkları üzerinden eşleme yapılır (aşağıdaki FEM_TO_DIN_GROUP).

import type { MechanismClass } from "./types";

/** DIN 15400 malzeme mukavemet sınıfları (M en düşük, V en yüksek). */
export const HOOK_STRENGTH_CLASSES = ["M", "P", "S", "T", "V"] as const;
export type HookStrengthClass = (typeof HOOK_STRENGTH_CLASSES)[number];

/** Sınıfların asgari kopma dayanımı [N/mm²] — seçim ekranında bilgi amaçlı. */
export const HOOK_STRENGTH_CLASS_INFO: Record<HookStrengthClass, string> = {
  M: "Rm ≥ 400 N/mm²",
  P: "Rm ≥ 500 N/mm²",
  S: "Rm ≥ 630 N/mm²",
  T: "Rm ≥ 800 N/mm²",
  V: "Rm ≥ 1000 N/mm²",
};

/** Tablodaki mekanizma grubu sütun başlıkları (DIN 15020). */
export const DIN15020_GROUPS = ["1Bm", "1Am", "2m", "3m", "4m", "5m"] as const;
export type Din15020Group = (typeof DIN15020_GROUPS)[number];

/**
 * FEM 1.001 M1–M8 → DIN 15020 grubu.
 * M1–M3 tabloda karşılığı olmayan daha hafif gruplardır; standardın notu
 * gereği ("Leichterer Betrieb als nach Triebwerkgruppe 1Bm darf nicht
 * berücksichtigt werden") 1Bm'den hafif çalışma dikkate ALINMAZ → 1Bm kullanılır.
 */
const FEM_TO_DIN_GROUP: Record<MechanismClass, Din15020Group> = {
  M1: "1Bm",
  M2: "1Bm",
  M3: "1Bm",
  M4: "1Bm",
  M5: "1Am",
  M6: "2m",
  M7: "3m",
  M8: "4m",
};

export function din15020Group(mech: MechanismClass): Din15020Group {
  return FEM_TO_DIN_GROUP[mech];
}

/** Mukavemet sınıfının tablodaki sütun kaydırması. */
const CLASS_OFFSET: Record<HookStrengthClass, number> = {
  V: 0,
  T: 1,
  S: 2,
  P: 3,
  M: 4,
};

/** Kanca numaraları (DIN 15400 / DIN 15401 sıralaması). */
export const HOOK_NUMBERS = [
  "006", "010", "012", "020", "025", "04", "05", "08",
  "1", "1.6", "2.5", "4", "5", "6", "8", "10", "12", "16",
  "20", "25", "32", "40", "50", "63", "80", "100",
  "125", "160", "200", "250",
] as const;
export type HookNumber = (typeof HOOK_NUMBERS)[number];

/**
 * Tablo 3 — taşıma kapasiteleri [kg]. Her satır 10 sütundur (c1…c10);
 * `null` standartta "–" ile gösterilen, o sınıf/grup için tanımsız hücredir.
 * Değerler R10 (Renard) serisini izler; alt sınır 100 kg, üst sınır 500 000 kg.
 */
export const DIN15400_T3: Record<string, (number | null)[]> = {
  "006": [320, 250, 200, 160, 125, 100, null, null, null, null],
  "010": [500, 400, 320, 250, 200, 160, 125, 100, null, null],
  "012": [630, 500, 400, 320, 250, 200, 160, 125, 100, null],
  "020": [1000, 800, 630, 500, 400, 320, 250, 200, 160, 125],
  "025": [1250, 1000, 800, 630, 500, 400, 320, 250, 200, 160],
  "04": [2000, 1600, 1250, 1000, 800, 630, 500, 400, 320, 250],
  "05": [2500, 2000, 1600, 1250, 1000, 800, 630, 500, 400, 320],
  "08": [4000, 3200, 2500, 2000, 1600, 1250, 1000, 800, 630, 500],
  "1": [5000, 4000, 3200, 2500, 2000, 1600, 1250, 1000, 800, 630],
  "1.6": [8000, 6300, 5000, 4000, 3200, 2500, 2000, 1600, 1250, 1000],
  "2.5": [12500, 10000, 8000, 6300, 5000, 4000, 3200, 2500, 2000, 1600],
  "4": [20000, 16000, 12500, 10000, 8000, 6300, 5000, 4000, 3200, 2500],
  "5": [25000, 20000, 16000, 12500, 10000, 8000, 6300, 5000, 4000, 3200],
  "6": [32000, 25000, 20000, 16000, 12500, 10000, 8000, 6300, 5000, 4000],
  "8": [40000, 32000, 25000, 20000, 16000, 12500, 10000, 8000, 6300, 5000],
  "10": [50000, 40000, 32000, 25000, 20000, 16000, 12500, 10000, 8000, 6300],
  "12": [63000, 50000, 40000, 32000, 25000, 20000, 16000, 12500, 10000, 8000],
  "16": [80000, 63000, 50000, 40000, 32000, 25000, 20000, 16000, 12500, 10000],
  "20": [100000, 80000, 63000, 50000, 40000, 32000, 25000, 20000, 16000, 12500],
  "25": [125000, 100000, 80000, 63000, 50000, 40000, 32000, 25000, 20000, 16000],
  "32": [160000, 125000, 100000, 80000, 63000, 50000, 40000, 32000, 25000, 20000],
  "40": [200000, 160000, 125000, 100000, 80000, 63000, 50000, 40000, 32000, 25000],
  "50": [250000, 200000, 160000, 125000, 100000, 80000, 63000, 50000, 40000, 32000],
  "63": [320000, 250000, 200000, 160000, 125000, 100000, 80000, 63000, 50000, 40000],
  "80": [400000, 320000, 250000, 200000, 160000, 125000, 100000, 80000, 63000, 50000],
  "100": [500000, 400000, 320000, 250000, 200000, 160000, 125000, 100000, 80000, 63000],
  "125": [null, 500000, 400000, 320000, 250000, 200000, 160000, 125000, 100000, 80000],
  "160": [null, null, 500000, 400000, 320000, 250000, 200000, 160000, 125000, 100000],
  "200": [null, null, null, 500000, 400000, 320000, 250000, 200000, 160000, 125000],
  "250": [null, null, null, null, 500000, 400000, 320000, 250000, 200000, 160000],
};

/** Bir sınıf + grup çiftinin tablodaki sütun indeksi (0 tabanlı); yoksa −1. */
export function hookColumnIndex(
  strengthClass: HookStrengthClass,
  group: Din15020Group
): number {
  const gi = DIN15020_GROUPS.indexOf(group);
  if (gi < 0) return -1;
  const idx = CLASS_OFFSET[strengthClass] + gi;
  return idx >= 0 && idx < 10 ? idx : -1;
}

/**
 * Kanca taşıma kapasitesi [kg]. Kanca numarası / sınıf / mekanizma grubu
 * kombinasyonu tabloda tanımsızsa `undefined` döner.
 */
export function hookCapacityKg(
  hookNumber: string,
  strengthClass: HookStrengthClass,
  mech: MechanismClass
): number | undefined {
  const row = DIN15400_T3[hookNumber];
  if (!row) return undefined;
  const idx = hookColumnIndex(strengthClass, din15020Group(mech));
  if (idx < 0) return undefined;
  return row[idx] ?? undefined;
}

/**
 * Verilen yükü taşıyan EN KÜÇÜK kanca numarası — seçim yardımı olarak
 * gösterilir (kullanıcı isterse daha büyüğünü seçebilir).
 */
export function smallestHookNumber(
  requiredKg: number,
  strengthClass: HookStrengthClass,
  mech: MechanismClass
): string | undefined {
  if (!Number.isFinite(requiredKg) || requiredKg <= 0) return undefined;
  for (const nr of HOOK_NUMBERS) {
    const cap = hookCapacityKg(nr, strengthClass, mech);
    if (cap !== undefined && cap >= requiredKg) return nr;
  }
  return undefined;
}
