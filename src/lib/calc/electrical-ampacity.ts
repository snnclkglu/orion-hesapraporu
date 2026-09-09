/**
 * Kullanıcının sağladığı “VDE 0298 Part 4 Current Carrying Capacity” tek
 * sayfalık tablosunun makinece okunabilir karşılığıdır. Kaynak doküman baskı
 * tarihini belirtmediği için arayüz ve raporda bu durum açıkça gösterilir.
 *
 * Tablo kapsamı: 30 °C, 3 yüklü damar + koruma iletkeni, sürekli çalışma.
 * Katsayılar birbirinden bağımsız olarak gösterilir; böylece bir seçimin neden
 * büyüdüğü veya küçüldüğü hesap izinden denetlenebilir.
 */

export const VDE_0298_ATTACHMENT_SOURCE =
  "Kullanıcı eki: VDE 0298 Part 4 Current Carrying Capacity, baskı tarihi belirtilmemiş";

export type CableInstallationMode =
  | "singleOnGround"
  | "festoonFreeAir"
  | "multiReel1"
  | "multiReel2"
  | "multiReel3"
  | "multiReel4"
  | "multiReel5"
  | "monoReelRound"
  | "monoReelFlat";

export const CABLE_INSTALLATION_LABELS: Readonly<Record<CableInstallationMode, string>> = {
  singleOnGround: "Tek kablo · zemin üzerinde",
  festoonFreeAir: "Feston · havada serbest asılı",
  multiReel1: "Çok sarımlı tambur · 1 kat",
  multiReel2: "Çok sarımlı tambur · 2 kat",
  multiReel3: "Çok sarımlı tambur · 3 kat",
  multiReel4: "Çok sarımlı tambur · 4 kat",
  multiReel5: "Çok sarımlı tambur · 5 kat",
  monoReelRound: "Tek sarımlı tambur · yuvarlak kablo",
  monoReelFlat: "Tek sarımlı tambur · yassı kablo",
};

export const VDE_SECTIONS_MM2 = [
  1, 1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240, 300,
] as const;

type AmpacityRow = Readonly<Record<CableInstallationMode, number>>;

export const VDE_RAW_AMPACITY_A: Readonly<Record<number, AmpacityRow>> = {
  1: { singleOnGround: 18, festoonFreeAir: 19, multiReel1: 14, multiReel2: 11, multiReel3: 9, multiReel4: 8, multiReel5: 6, monoReelRound: 14, monoReelFlat: 9 },
  1.5: { singleOnGround: 23, festoonFreeAir: 24, multiReel1: 18, multiReel2: 14, multiReel3: 11, multiReel4: 10, multiReel5: 8, monoReelRound: 18, monoReelFlat: 11 },
  2.5: { singleOnGround: 30, festoonFreeAir: 32, multiReel1: 24, multiReel2: 18, multiReel3: 15, multiReel4: 13, multiReel5: 10, monoReelRound: 24, monoReelFlat: 15 },
  4: { singleOnGround: 41, festoonFreeAir: 43, multiReel1: 33, multiReel2: 25, multiReel3: 20, multiReel4: 17, multiReel5: 14, monoReelRound: 33, monoReelFlat: 21 },
  6: { singleOnGround: 53, festoonFreeAir: 56, multiReel1: 42, multiReel2: 32, multiReel3: 26, multiReel4: 22, multiReel5: 18, monoReelRound: 42, monoReelFlat: 28 },
  10: { singleOnGround: 74, festoonFreeAir: 78, multiReel1: 59, multiReel2: 45, multiReel3: 36, multiReel4: 31, multiReel5: 25, monoReelRound: 59, monoReelFlat: 39 },
  16: { singleOnGround: 99, festoonFreeAir: 104, multiReel1: 79, multiReel2: 60, multiReel3: 49, multiReel4: 42, multiReel5: 34, monoReelRound: 79, monoReelFlat: 52 },
  25: { singleOnGround: 131, festoonFreeAir: 138, multiReel1: 105, multiReel2: 80, multiReel3: 64, multiReel4: 55, multiReel5: 45, monoReelRound: 105, monoReelFlat: 65 },
  35: { singleOnGround: 162, festoonFreeAir: 170, multiReel1: 130, multiReel2: 99, multiReel3: 79, multiReel4: 68, multiReel5: 55, monoReelRound: 130, monoReelFlat: 81 },
  50: { singleOnGround: 202, festoonFreeAir: 212, multiReel1: 162, multiReel2: 123, multiReel3: 99, multiReel4: 85, multiReel5: 69, monoReelRound: 162, monoReelFlat: 101 },
  70: { singleOnGround: 250, festoonFreeAir: 263, multiReel1: 200, multiReel2: 153, multiReel3: 123, multiReel4: 105, multiReel5: 85, monoReelRound: 200, monoReelFlat: 125 },
  95: { singleOnGround: 301, festoonFreeAir: 316, multiReel1: 241, multiReel2: 184, multiReel3: 147, multiReel4: 126, multiReel5: 102, monoReelRound: 241, monoReelFlat: 155 },
  120: { singleOnGround: 352, festoonFreeAir: 370, multiReel1: 282, multiReel2: 215, multiReel3: 172, multiReel4: 148, multiReel5: 120, monoReelRound: 282, monoReelFlat: 176 },
  150: { singleOnGround: 404, festoonFreeAir: 424, multiReel1: 323, multiReel2: 246, multiReel3: 198, multiReel4: 170, multiReel5: 137, monoReelRound: 323, monoReelFlat: 202 },
  185: { singleOnGround: 461, festoonFreeAir: 484, multiReel1: 369, multiReel2: 281, multiReel3: 226, multiReel4: 194, multiReel5: 157, monoReelRound: 369, monoReelFlat: 230 },
  240: { singleOnGround: 540, festoonFreeAir: 567, multiReel1: 432, multiReel2: 329, multiReel3: 265, multiReel4: 227, multiReel5: 184, monoReelRound: 432, monoReelFlat: 270 },
  300: { singleOnGround: 620, festoonFreeAir: 651, multiReel1: 496, multiReel2: 378, multiReel3: 304, multiReel4: 260, multiReel5: 211, monoReelRound: 496, monoReelFlat: 310 },
};

const AMBIENT_FACTORS: ReadonlyArray<readonly [number, number]> = [
  [10, 1.18], [20, 1.10], [25, 1.05], [30, 1], [35, 0.95], [40, 0.89],
  [45, 0.84], [50, 0.77], [55, 0.71], [60, 0.63], [65, 0.55], [70, 0.45], [75, 0.32],
];

const LOADED_CONDUCTOR_FACTORS: ReadonlyArray<readonly [number, number]> = [
  [3, 1], [5, 0.75], [7, 0.65], [10, 0.55], [14, 0.50], [19, 0.45], [24, 0.40], [40, 0.35],
];

const DUTY_SECTIONS = [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240, 300] as const;
const DUTY_FACTORS: Readonly<Record<number, readonly number[]>> = {
  60: [1, 1, 1, 1, 1.03, 1.07, 1.10, 1.13, 1.16, 1.18, 1.20, 1.21, 1.22, 1.23, 1.24, 1.25],
  40: [1, 1, 1.03, 1.04, 1.09, 1.16, 1.23, 1.28, 1.34, 1.38, 1.42, 1.44, 1.46, 1.48, 1.49, 1.50],
  25: [1, 1.02, 1.05, 1.13, 1.21, 1.34, 1.45, 1.53, 1.62, 1.69, 1.74, 1.78, 1.81, 1.82, 1.85, 1.87],
  20: [1, 1.04, 1.11, 1.18, 1.31, 1.45, 1.59, 1.69, 1.79, 1.87, 1.93, 1.97, 2.01, 2.04, 2.10, 2.15],
  15: [1, 1.08, 1.19, 1.27, 1.44, 1.62, 1.79, 1.90, 2.03, 2.13, 2.21, 2.26, 2.30, 2.32, 2.36, 2.39],
};

export interface FactorLookup {
  factor: number;
  tableKey: number;
  exact: boolean;
  valid: boolean;
  note?: string;
}

/** Ara değerde bir sonraki daha sıcak tablo satırını seçerek ihtiyatlı kalır. */
export function ambientCorrectionFactor(temperatureC: number): FactorLookup {
  if (!Number.isFinite(temperatureC)) return { factor: 0, tableKey: 75, exact: false, valid: false, note: "Ortam sıcaklığı geçersiz" };
  if (temperatureC > 75) return { factor: 0, tableKey: 75, exact: false, valid: false, note: "Ek tablo 75 °C üzerinde değer vermiyor" };
  const row = AMBIENT_FACTORS.find(([temperature]) => temperatureC <= temperature) ?? AMBIENT_FACTORS[AMBIENT_FACTORS.length - 1];
  return { factor: row[1], tableKey: row[0], exact: temperatureC === row[0], valid: true, note: temperatureC < 10 ? "10 °C satırı kullanıldı" : undefined };
}

/** Ara adette bir sonraki daha çok yüklü damar satırını kullanır. */
export function loadedConductorCorrectionFactor(count: number): FactorLookup {
  if (!Number.isFinite(count) || count <= 0) return { factor: 0, tableKey: 3, exact: false, valid: false, note: "Yüklü damar adedi geçersiz" };
  if (count > 40) return { factor: 0, tableKey: 40, exact: false, valid: false, note: "Ek tablo 40 yüklü damar üzerinde değer vermiyor" };
  const normalized = Math.max(3, Math.ceil(count));
  const row = LOADED_CONDUCTOR_FACTORS.find(([conductors]) => normalized <= conductors) ?? LOADED_CONDUCTOR_FACTORS[LOADED_CONDUCTOR_FACTORS.length - 1];
  return { factor: row[1], tableKey: row[0], exact: count <= 3 || count === row[0], valid: true };
}

/**
 * Kesintili çalışma artışı otomatik olarak uygulanmaz. Etkinleştirildiğinde
 * ara görev çevrimi için daha yüksek (daha ihtiyatlı) yüzde satırı seçilir.
 */
export function intermittentCorrectionFactor(sectionMm2: number, dutyCyclePct?: number): FactorLookup {
  if (dutyCyclePct == null || dutyCyclePct >= 100) return { factor: 1, tableKey: 100, exact: dutyCyclePct === 100, valid: true };
  if (!Number.isFinite(dutyCyclePct) || dutyCyclePct < 15) return { factor: 0, tableKey: 15, exact: false, valid: false, note: "Ek tablo %15 altında görev çevrimi vermiyor" };
  const dutyKey = [15, 20, 25, 40, 60].find((value) => dutyCyclePct <= value) ?? 100;
  if (dutyKey === 100) return { factor: 1, tableKey: 100, exact: dutyCyclePct === 100, valid: true };
  const sectionIndex = DUTY_SECTIONS.indexOf(sectionMm2 as typeof DUTY_SECTIONS[number]);
  if (sectionIndex < 0) return { factor: 0, tableKey: dutyKey, exact: false, valid: false, note: "Kesintili çalışma tablosunda bu kesit yok" };
  return {
    factor: DUTY_FACTORS[dutyKey][sectionIndex],
    tableKey: dutyKey,
    exact: dutyCyclePct === dutyKey,
    valid: true,
  };
}

export interface AmpacityTraceInput {
  sectionMm2: number;
  installationMode: CableInstallationMode;
  ambientTemperatureC: number;
  loadedConductors?: number;
  groupingFactor?: number;
  projectFactor?: number;
  dutyCyclePct?: number;
  parallelRuns?: number;
}

export interface AmpacityTrace {
  sectionMm2: number;
  installationMode: CableInstallationMode;
  installationLabel: string;
  rawAmpacityA: number;
  ambientFactor: number;
  ambientTableTemperatureC: number;
  loadedConductors: number;
  loadedConductorFactor: number;
  loadedConductorTableCount: number;
  groupingFactor: number;
  projectFactor: number;
  dutyCyclePct?: number;
  intermittentFactor: number;
  parallelRuns: number;
  correctedAmpacityA: number;
  valid: boolean;
  notes: string[];
  source: string;
}

export function ampacityTrace(input: AmpacityTraceInput): AmpacityTrace {
  const rawAmpacityA = VDE_RAW_AMPACITY_A[input.sectionMm2]?.[input.installationMode] ?? 0;
  const ambient = ambientCorrectionFactor(input.ambientTemperatureC);
  const loaded = loadedConductorCorrectionFactor(input.loadedConductors ?? 3);
  const intermittent = intermittentCorrectionFactor(input.sectionMm2, input.dutyCyclePct);
  const groupingFactor = Number.isFinite(input.groupingFactor) && (input.groupingFactor ?? 0) > 0 ? Math.min(1, input.groupingFactor as number) : 1;
  const projectFactor = Number.isFinite(input.projectFactor) && (input.projectFactor ?? 0) > 0 ? Math.min(1, input.projectFactor as number) : 1;
  const parallelRuns = Math.max(1, Math.round(Number.isFinite(input.parallelRuns) ? input.parallelRuns as number : 1));
  const valid = rawAmpacityA > 0 && ambient.valid && loaded.valid && intermittent.valid;
  const correctedAmpacityA = valid
    ? rawAmpacityA * ambient.factor * loaded.factor * groupingFactor * projectFactor * intermittent.factor * parallelRuns
    : 0;
  const notes = [
    ambient.note,
    loaded.note,
    intermittent.note,
    !ambient.exact ? `${input.ambientTemperatureC} °C için ${ambient.tableKey} °C satırı kullanıldı` : undefined,
    !loaded.exact ? `${input.loadedConductors ?? 3} yüklü damar için ${loaded.tableKey} damar satırı kullanıldı` : undefined,
    !intermittent.exact && intermittent.valid && intermittent.tableKey < 100
      ? `%${input.dutyCyclePct} için %${intermittent.tableKey} görev çevrimi satırı kullanıldı`
      : undefined,
    rawAmpacityA <= 0 ? "Seçilen kesit/yerleşim için ek tabloda ham kapasite yok" : undefined,
  ].filter((note): note is string => Boolean(note));
  return {
    sectionMm2: input.sectionMm2,
    installationMode: input.installationMode,
    installationLabel: CABLE_INSTALLATION_LABELS[input.installationMode],
    rawAmpacityA,
    ambientFactor: ambient.factor,
    ambientTableTemperatureC: ambient.tableKey,
    loadedConductors: input.loadedConductors ?? 3,
    loadedConductorFactor: loaded.factor,
    loadedConductorTableCount: loaded.tableKey,
    groupingFactor,
    projectFactor,
    dutyCyclePct: input.dutyCyclePct,
    intermittentFactor: intermittent.factor,
    parallelRuns,
    correctedAmpacityA,
    valid,
    notes,
    source: VDE_0298_ATTACHMENT_SOURCE,
  };
}
