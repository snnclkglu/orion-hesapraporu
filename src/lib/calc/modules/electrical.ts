// Elektrik hesap raporu — sürücü ön seçimi, kablo ön boyutlandırma ve
// feston arabası üzerindeki fiziksel kablo yerleşimi.
//
// Bu modül ekipman listesine satır üretmez. Elektrik projesinin parça listesi
// EPLAN çıktısından gelmeye devam eder; buradaki kataloglar yalnız mühendislik
// hesabı ve raporda izlenebilir seçim için kullanılır.

import {
  DRIVE_BRANDS,
  ELECTRICAL_CABLE_MODELS,
  ELECTRICAL_DRIVE_MODELS,
  cableByArticle,
  type CablePurpose,
  type ElectricalCableModel,
  type ElectricalDriveModel,
} from "../electrical-catalog";
import type { AnyCheck, ModuleResult, TechnicalSpecs } from "../types";

export type ElectricalCircuitKey =
  | "main"
  | "aux"
  | "mono1"
  | "mono2"
  | "trolley"
  | "auxTrolley"
  | "mono1Trolley"
  | "mono2Trolley"
  | "bridge";

export interface ElectricalMotorSource {
  key: ElectricalCircuitKey;
  label: string;
  motorPowerKw: number;
  motorCount: number;
}

export interface ElectricalDeps {
  motors: ElectricalMotorSource[];
  /** Ana araba feston bölümünden alınabilen hazır proje girdileri. */
  festoon?: {
    circuitKeys: ElectricalCircuitKey[];
    loopHeightM?: number;
    trolleyCount?: number;
    sourceLabel: string;
  };
}

export interface ElectricalDrivePick {
  brand?: string;
  series?: string;
  model?: string;
}

export interface ElectricalCablePick {
  articleNo?: string;
  parallelRuns?: number;
}

export interface ElectricalCircuitInput {
  /** Motor etiket akımı biliniyorsa formül sonucunu ezer. */
  ratedCurrentA?: number;
  /** true/yok: akımı motor gücü, hat gerilimi, cosφ ve verimden hesapla. */
  ratedCurrentAuto?: boolean;
  cableLengthM?: number;
  /** true/yok: devre boyunda genel motor kablo boyunu kullan. */
  cableLengthAuto?: boolean;
  /** true/yok: marka-seri-modeli katalogdan otomatik boyutlandır. */
  driveAuto?: boolean;
  /** true/yok: kesit ve paralel koşuyu katalogdan otomatik boyutlandır. */
  cableAuto?: boolean;
}

export interface ElectricalExtraCable {
  id: string;
  label: string;
  articleNo: string;
  quantity: number;
  purpose: CablePurpose;
}

export interface FestoonTrolleyPreset {
  id: string;
  brand: "Vasel" | "Conductix-Wampfler" | "Özel";
  model: string;
  trolleyWidthMm: number;
  usableWidthMm: number;
  usableHeightMm: number;
  supportDiameterMm: number;
  maxCableLoadKg: number;
  source: string;
}

export const FESTOON_TROLLEY_PRESETS: readonly FestoonTrolleyPreset[] = [
  {
    id: "vasel-vs2020a",
    brand: "Vasel",
    model: "VS2020A-4WF",
    trolleyWidthMm: 106,
    usableWidthMm: 74,
    usableHeightMm: 22,
    supportDiameterMm: 80,
    // Güncel ürün sayfasındaki 25 kg değeri, eski Cat.4b/52'deki 35 kg
    // satırından daha ihtiyatlıdır; hesap güncel düşük sınırı kullanır.
    maxCableLoadKg: 25,
    source: "Vasel güncel ürün sayfası; L=125, b1=106, b2=74, s=22, D=80 mm, azami kablo yükü 25 kg",
  },
  {
    id: "conductix-032252-250x200",
    brand: "Conductix-Wampfler",
    model: "032252-250x200",
    trolleyWidthMm: 215,
    usableWidthMm: 170,
    usableHeightMm: 60,
    supportDiameterMm: 125,
    maxCableLoadKg: 80,
    source: "Conductix-Wampfler KAT0320-0003-EN s.11-12 (yerel katalog)",
  },
  {
    id: "conductix-032465-320x250",
    brand: "Conductix-Wampfler",
    model: "032465-320x250",
    trolleyWidthMm: 265,
    usableWidthMm: 215,
    usableHeightMm: 25,
    supportDiameterMm: 250,
    maxCableLoadKg: 80,
    source: "Conductix-Wampfler KAT0320-0003-EN s.11-12 (yerel katalog)",
  },
  {
    id: "conductix-032654-320x250",
    brand: "Conductix-Wampfler",
    model: "032654-320x250",
    trolleyWidthMm: 265,
    usableWidthMm: 218,
    usableHeightMm: 50,
    supportDiameterMm: 200,
    maxCableLoadKg: 125,
    source: "Conductix-Wampfler KAT0320-0003-EN s.13-14 (yerel katalog)",
  },
  {
    id: "conductix-032867-400x250",
    brand: "Conductix-Wampfler",
    model: "032867-400x250",
    trolleyWidthMm: 265,
    usableWidthMm: 211,
    usableHeightMm: 32,
    supportDiameterMm: 320,
    maxCableLoadKg: 125,
    source: "Conductix-Wampfler KAT0320-0003-EN s.13-14 (yerel katalog)",
  },
  {
    id: "conductix-033253-320x160",
    brand: "Conductix-Wampfler",
    model: "033253-320x160",
    trolleyWidthMm: 175,
    usableWidthMm: 128,
    usableHeightMm: 70,
    supportDiameterMm: 160,
    maxCableLoadKg: 200,
    source: "Conductix-Wampfler KAT0320-0003-EN s.15-16 (yerel katalog)",
  },
  {
    id: "conductix-033252-320x250",
    brand: "Conductix-Wampfler",
    model: "033252-320x250",
    trolleyWidthMm: 265,
    usableWidthMm: 218,
    usableHeightMm: 85,
    supportDiameterMm: 125,
    maxCableLoadKg: 200,
    source: "Conductix-Wampfler KAT0320-0003-EN s.15-16 (yerel katalog)",
  },
  {
    id: "conductix-033253-320x200",
    brand: "Conductix-Wampfler",
    model: "033253-320x200",
    trolleyWidthMm: 215,
    usableWidthMm: 168,
    usableHeightMm: 70,
    supportDiameterMm: 160,
    maxCableLoadKg: 200,
    source: "Conductix-Wampfler KAT0320-0003-EN s.15-16 (yerel katalog)",
  },
  {
    id: "conductix-033254-400x200",
    brand: "Conductix-Wampfler",
    model: "033254-400x200",
    trolleyWidthMm: 215,
    usableWidthMm: 168,
    usableHeightMm: 85,
    supportDiameterMm: 200,
    maxCableLoadKg: 200,
    source: "Conductix-Wampfler KAT0320-0003-EN s.15-16 (yerel katalog)",
  },
];

export interface ElectricalInputs {
  lineVoltageV: number;
  lineVoltageAuto: boolean;
  powerFactor: number;
  powerFactorAuto: boolean;
  motorEfficiencyPct: number;
  motorEfficiencyAuto: boolean;
  voltageDropLimitPct: number;
  voltageDropLimitAuto: boolean;
  currentDeratingFactor: number;
  mainDemandFactor: number;
  mainDemandFactorAuto: boolean;
  defaultMotorCableLengthM: number;
  defaultMotorCableLengthAuto: boolean;
  mainCableLengthM: number;
  mainCableLengthAuto: boolean;
  mainCableAuto: boolean;
  circuits: Partial<Record<ElectricalCircuitKey, ElectricalCircuitInput>>;
  festoonCircuitKeys: ElectricalCircuitKey[];
  festoonCircuitKeysAuto: boolean;
  extraCables: ElectricalExtraCable[];
  trolleyPresetId: string;
  trolleyPresetAuto: boolean;
  trolleyBrand: string;
  trolleyModel: string;
  trolleyWidthMm: number;
  usableWidthMm: number;
  usableHeightMm: number;
  supportDiameterMm: number;
  maxCableLoadKg: number;
  loopHeightM: number;
  loopHeightAuto: boolean;
  rowCount: 1 | 2;
  rowCountAuto: boolean;
  cableGapMm: number;
  cableGapAuto: boolean;
}

export interface ElectricalSelections {
  drives: Partial<Record<ElectricalCircuitKey, ElectricalDrivePick>>;
  motorCables: Partial<Record<ElectricalCircuitKey, ElectricalCablePick>>;
  mainCable: ElectricalCablePick;
}

export const DEFAULT_ELECTRICAL_INPUTS: ElectricalInputs = {
  lineVoltageV: 380,
  lineVoltageAuto: true,
  powerFactor: 0.85,
  powerFactorAuto: true,
  motorEfficiencyPct: 90,
  motorEfficiencyAuto: true,
  voltageDropLimitPct: 3,
  voltageDropLimitAuto: true,
  currentDeratingFactor: 1,
  mainDemandFactor: 0.75,
  mainDemandFactorAuto: true,
  defaultMotorCableLengthM: 30,
  defaultMotorCableLengthAuto: true,
  mainCableLengthM: 50,
  mainCableLengthAuto: true,
  mainCableAuto: true,
  circuits: {},
  // Ana/yardımcı kaldırma ile ana araba, aynı araba üzerindeki en sık demettir.
  // Hesapta olmayan anahtarlar otomatik süzülür; kullanıcı her birini kaldırabilir.
  festoonCircuitKeys: ["main", "aux", "trolley"],
  festoonCircuitKeysAuto: true,
  // Yerleşim ilk açıldığında güç/kumanda/sinyal ayrımı görülebilsin. Bunlar
  // proje girdisi değil, kullanıcı tarafından silinebilen başlangıç kalemleri.
  extraCables: [
    { id: "default-control", label: "Kumanda", articleNo: "UNTEL-UNFLEX-PUR-7G1-5", quantity: 1, purpose: "control" },
    { id: "default-signal", label: "Sinyal / enkoder", articleNo: "19104", quantity: 1, purpose: "signal" },
  ],
  trolleyPresetId: "vasel-vs2020a",
  trolleyPresetAuto: true,
  trolleyBrand: "Vasel",
  trolleyModel: "VS2020A-4WF",
  trolleyWidthMm: 106,
  usableWidthMm: 74,
  usableHeightMm: 22,
  supportDiameterMm: 80,
  maxCableLoadKg: 25,
  loopHeightM: 1.5,
  loopHeightAuto: true,
  rowCount: 1,
  rowCountAuto: true,
  cableGapMm: 2,
  cableGapAuto: true,
};

export const DEFAULT_ELECTRICAL_SELECTIONS: ElectricalSelections = {
  drives: {},
  motorCables: {},
  mainCable: {},
};

export interface ElectricalDriveResult {
  circuit: ElectricalMotorSource;
  designCurrentA: number;
  drive?: ElectricalDriveModel;
  automatic: boolean;
  ratedCurrentAutomatic: boolean;
}

export interface ElectricalCableResult {
  circuit: ElectricalMotorSource;
  designCurrentA: number;
  lengthM: number;
  requiredSectionMm2: number;
  recommendedRuns: number;
  selectedCable?: ElectricalCableModel;
  selectedRuns: number;
  ampacityA: number;
  voltageDropPct: number;
  automatic: boolean;
  ratedCurrentAutomatic: boolean;
  lengthAutomatic: boolean;
}

export interface MainCableResult {
  designCurrentA: number;
  installedPowerKw: number;
  lengthM: number;
  requiredSectionMm2: number;
  recommendedRuns: number;
  selectedCable?: ElectricalCableModel;
  selectedRuns: number;
  ampacityA: number;
  voltageDropPct: number;
  automatic: boolean;
}

export interface FestoonCablePlacement {
  id: string;
  label: string;
  articleNo: string;
  brand: string;
  family: string;
  construction: string;
  purpose: CablePurpose;
  color: string;
  row: number;
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
  weightKgPerM: number;
  minimumBendDiameterMm: number;
}

export interface FestoonLayoutResult {
  placements: FestoonCablePlacement[];
  rowCount: 1 | 2;
  packageWidthMm: number;
  packageHeightMm: number;
  packageWeightKgPerM: number;
  trolleyCableLoadKg: number;
  centerOfGravityXmm: number;
  centerOffsetMm: number;
  minimumSupportDiameterMm: number;
  unsuitableCableLabels: string[];
  fitsCableApplication: boolean;
  fitsWidth: boolean;
  fitsHeight: boolean;
  fitsBend: boolean;
  fitsLoad: boolean;
  trolleyPresetId: string;
  trolleyBrand: string;
  trolleyModel: string;
  trolleyWidthMm: number;
  usableWidthMm: number;
  usableHeightMm: number;
  supportDiameterMm: number;
  maxCableLoadKg: number;
  loopHeightM: number;
  circuitKeys: ElectricalCircuitKey[];
  cableGapMm: number;
  trolleyAutomatic: boolean;
  rowCountAutomatic: boolean;
  loopHeightAutomatic: boolean;
  circuitKeysAutomatic: boolean;
  cableGapAutomatic: boolean;
}

export interface ElectricalResolvedSettings {
  lineVoltageV: number;
  powerFactor: number;
  motorEfficiencyPct: number;
  voltageDropLimitPct: number;
  currentDeratingFactor: number;
  mainDemandFactor: number;
  defaultMotorCableLengthM: number;
  mainCableLengthM: number;
}

export interface ElectricalValues {
  settings: ElectricalResolvedSettings;
  drives: ElectricalDriveResult[];
  motorCables: ElectricalCableResult[];
  mainCable: MainCableResult;
  festoon: FestoonLayoutResult;
}

// ORION ön boyutlandırma tablosu: Cu/PVC çok damarlı kablo için ihtiyatlı
// serbest hava başlangıç değerleri. Kesin seçim döşeme biçimi, ortam,
// demetleme ve harmoniklere göre elektrik projesinde doğrulanır.
const AMPACITY_A: Readonly<Record<number, number>> = {
  1.5: 18, 2.5: 25, 4: 34, 6: 44, 10: 60, 16: 80,
  25: 105, 35: 130, 50: 160, 70: 200, 95: 240, 120: 280, 150: 315,
};

const SECTIONS = Object.keys(AMPACITY_A).map(Number).sort((a, b) => a - b);
const RHO_CU = 0.0225; // Ω·mm²/m, işletme sıcaklığında ihtiyatlı bakır özdirenci

function sanePositive(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) && (value ?? 0) > 0 ? value as number : fallback;
}

function motorCurrent(powerKw: number, voltageV: number, pf: number, efficiencyPct: number): number {
  const efficiency = Math.max(0.01, efficiencyPct / 100);
  return powerKw * 1000 / (Math.sqrt(3) * voltageV * Math.max(0.01, pf) * efficiency);
}

/** Teknik özellikteki "380 VAC, 3 Faz, 50 Hz" metninden hat gerilimi. */
export function lineVoltageFromSpecs(specs: TechnicalSpecs, fallback = 380): number {
  const match = String(specs.supplyVoltage ?? "").match(/\b(220|230|380|400|415|440|460|480|500|525|575|600|660|690)\b/);
  return match ? Number(match[1]) : fallback;
}

function automaticUnlessOverridden(flag: boolean | undefined, manualValuePresent: boolean): boolean {
  return flag ?? !manualValuePresent;
}

function ambientFactor(maxTempC: number): number {
  if (maxTempC <= 30) return 1;
  if (maxTempC <= 35) return 0.94;
  if (maxTempC <= 40) return 0.87;
  if (maxTempC <= 45) return 0.79;
  if (maxTempC <= 50) return 0.71;
  if (maxTempC <= 55) return 0.61;
  return 0.5;
}

function voltageDropPct(
  currentA: number,
  lengthM: number,
  sectionMm2: number,
  runs: number,
  voltageV: number,
  pf: number
): number {
  if (!(sectionMm2 > 0) || !(runs > 0) || !(voltageV > 0)) return Infinity;
  const volts = Math.sqrt(3) * currentA * lengthM * RHO_CU * pf / (sectionMm2 * runs);
  return volts / voltageV * 100;
}

interface RequiredCable {
  sectionMm2: number;
  runs: number;
  ampacityA: number;
  voltageDropPct: number;
}

function requiredCable(
  currentA: number,
  lengthM: number,
  voltageV: number,
  pf: number,
  derating: number,
  maxDropPct: number
): RequiredCable {
  const candidates: RequiredCable[] = [];
  for (let runs = 1; runs <= 4; runs++) {
    for (const sectionMm2 of SECTIONS) {
      const ampacityA = AMPACITY_A[sectionMm2] * derating * runs;
      const drop = voltageDropPct(currentA, lengthM, sectionMm2, runs, voltageV, pf);
      if (ampacityA >= currentA && drop <= maxDropPct) {
        candidates.push({ sectionMm2, runs, ampacityA, voltageDropPct: drop });
      }
    }
  }
  // Önce TEK kablo: sürücü çıkışında dört küçük paralel ekranlı kablo,
  // toplam bakırı azaltsa bile EMC sonlandırmasını ve akım paylaşımını
  // gereksiz zorlaştırır. Ancak katalogdaki en büyük kesit yetmezse paralel
  // koşu açılır; aynı koşu adedinde en küçük uygun kesit seçilir.
  candidates.sort((a, b) => a.runs - b.runs || a.sectionMm2 - b.sectionMm2);
  return candidates[0] ?? {
    sectionMm2: SECTIONS[SECTIONS.length - 1], runs: 4,
    ampacityA: AMPACITY_A[SECTIONS[SECTIONS.length - 1]] * derating * 4,
    voltageDropPct: voltageDropPct(currentA, lengthM, SECTIONS[SECTIONS.length - 1], 4, voltageV, pf),
  };
}

function autoCable(sectionMm2: number, family: string): ElectricalCableModel | undefined {
  const exact = ELECTRICAL_CABLE_MODELS.find((x) => x.family === family && x.sectionMm2 === sectionMm2);
  if (exact) return exact;
  return ELECTRICAL_CABLE_MODELS
    .filter((x) => x.family === family && (x.sectionMm2 ?? 0) >= sectionMm2)
    .sort((a, b) => (a.sectionMm2 ?? 0) - (b.sectionMm2 ?? 0))[0];
}

function resolveDrive(source: ElectricalMotorSource, pick: ElectricalDrivePick | undefined, designCurrentA: number) {
  const exact = pick?.model
    ? ELECTRICAL_DRIVE_MODELS.find((x) => x.model === pick.model)
    : undefined;
  if (exact) return { drive: exact, automatic: false };
  const brand = pick?.brand && DRIVE_BRANDS.includes(pick.brand as never)
    ? pick.brand
    : "Schneider Electric";
  const series = pick?.series || (brand === "Schneider Electric" ? "ATV340" : undefined);
  let candidates = ELECTRICAL_DRIVE_MODELS
    .filter((x) => x.brand === brand && (!series || x.series === series))
    .filter((x) => x.motorPowerKw >= source.motorPowerKw && x.outputCurrentA >= designCurrentA)
    .sort((a, b) => a.motorPowerKw - b.motorPowerKw || a.outputCurrentA - b.outputCurrentA);
  // İlk açılışta ATV340 aralığı yetmiyorsa aynı markanın daha büyük serisine
  // geç; kullanıcı bir seri seçtiyse bu tercih asla sessizce değiştirilmez.
  if (candidates.length === 0 && !pick?.series) {
    candidates = ELECTRICAL_DRIVE_MODELS
      .filter((x) => x.brand === brand)
      .filter((x) => x.motorPowerKw >= source.motorPowerKw && x.outputCurrentA >= designCurrentA)
      .sort((a, b) => a.motorPowerKw - b.motorPowerKw || a.outputCurrentA - b.outputCurrentA);
  }
  return { drive: candidates[0], automatic: true };
}

function check(
  id: string,
  label: string,
  required: number,
  provided: number,
  unit: string,
  op: ">=" | "<=",
  kind: AnyCheck["kind"] = "firma",
  severity: AnyCheck["severity"] = "engelleyici"
): AnyCheck {
  return {
    id, label, required, provided, unit, op,
    // Kapasite denetiminde (sağlanan ≥ gereken) hesaplanan taraf GEREKEN;
    // sınır denetiminde (oluşan ≤ izinli) hesaplanan taraf SAĞLANAN'dır.
    computedSide: op === ">=" ? "required" : "provided",
    pass: op === ">=" ? provided >= required : provided <= required,
    kind, severity,
  };
}

const PURPOSE_COLORS: Record<CablePurpose, string> = {
  power: "#D94A3A",
  control: "#2F6FEB",
  signal: "#0F9D8A",
};

interface LayoutItem {
  id: string;
  label: string;
  cable: ElectricalCableModel;
  purpose: CablePurpose;
}

function rowsWidth(rows: LayoutItem[][], gap: number): number[] {
  return rows.map((row) =>
    row.reduce((sum, item) => sum + item.cable.widthMm, 0) + Math.max(0, row.length - 1) * gap
  );
}

function initialRows(items: LayoutItem[], count: 1 | 2, gap: number): LayoutItem[][] {
  const rows: LayoutItem[][] = Array.from({ length: count }, () => []);
  for (const item of [...items].sort((a, b) => b.cable.widthMm - a.cable.widthMm)) {
    const widths = rowsWidth(rows, gap);
    const target = widths.indexOf(Math.min(...widths));
    rows[target].push(item);
  }
  return rows;
}

function placeRows(rows: LayoutItem[][], gap: number, usableWidth: number): FestoonCablePlacement[] {
  const heights = rows.map((row) => Math.max(0, ...row.map((x) => x.cable.heightMm)));
  const totalHeight = heights.reduce((a, b) => a + b, 0) + Math.max(0, rows.length - 1) * gap;
  let y = -totalHeight / 2;
  const placements: FestoonCablePlacement[] = [];
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex];
    const width = rowsWidth([row], gap)[0] ?? 0;
    let x = (usableWidth - width) / 2;
    for (const item of row) {
      const cable = item.cable;
      placements.push({
        id: item.id,
        label: item.label,
        articleNo: cable.articleNo,
        brand: cable.brand,
        family: cable.family,
        construction: cable.construction,
        purpose: item.purpose,
        color: PURPOSE_COLORS[item.purpose],
        row: rowIndex,
        xMm: x + cable.widthMm / 2,
        yMm: y + heights[rowIndex] / 2,
        widthMm: cable.widthMm,
        heightMm: cable.heightMm,
        weightKgPerM: cable.weightKgPerM,
        minimumBendDiameterMm: cable.bendRadiusFactor * cable.heightMm * 2,
      });
      x += cable.widthMm + gap;
    }
    y += heights[rowIndex] + gap;
  }
  return placements;
}

function centerOffset(placements: FestoonCablePlacement[], usableWidth: number): number {
  const mass = placements.reduce((sum, p) => sum + p.weightKgPerM, 0);
  if (!(mass > 0)) return 0;
  const cog = placements.reduce((sum, p) => sum + p.xMm * p.weightKgPerM, 0) / mass;
  return cog - usableWidth / 2;
}

function optimizeRows(rows: LayoutItem[][], gap: number, usableWidth: number): LayoutItem[][] {
  let best = rows.map((x) => [...x]);
  let score = Math.abs(centerOffset(placeRows(best, gap, usableWidth), usableWidth));
  for (let iteration = 0; iteration < 80; iteration++) {
    let improved = false;
    for (let r1 = 0; r1 < best.length; r1++) {
      for (let i = 0; i < best[r1].length; i++) {
        for (let r2 = r1; r2 < best.length; r2++) {
          for (let j = r2 === r1 ? i + 1 : 0; j < best[r2].length; j++) {
            const candidate = best.map((x) => [...x]);
            const a = candidate[r1][i];
            candidate[r1][i] = candidate[r2][j];
            candidate[r2][j] = a;
            const nextScore = Math.abs(centerOffset(placeRows(candidate, gap, usableWidth), usableWidth));
            if (nextScore + 0.001 < score) {
              best = candidate;
              score = nextScore;
              improved = true;
            }
          }
        }
      }
    }
    if (!improved) break;
  }
  return best;
}

type FestoonLayoutTrial = Omit<
  FestoonLayoutResult,
  | "trolleyPresetId" | "trolleyBrand" | "trolleyModel" | "trolleyWidthMm"
  | "usableWidthMm" | "usableHeightMm" | "supportDiameterMm" | "maxCableLoadKg"
  | "loopHeightM" | "circuitKeys" | "trolleyAutomatic" | "rowCountAutomatic"
  | "loopHeightAutomatic" | "circuitKeysAutomatic" | "cableGapMm" | "cableGapAutomatic"
>;

function festoonLayoutTrial(
  inputs: ElectricalInputs,
  cableResults: ElectricalCableResult[]
): FestoonLayoutTrial {
  const items: LayoutItem[] = [];
  for (const result of cableResults) {
    if (!inputs.festoonCircuitKeys.includes(result.circuit.key) || !result.selectedCable) continue;
    const quantity = Math.max(1, result.circuit.motorCount * result.selectedRuns);
    for (let i = 0; i < quantity; i++) {
      items.push({
        id: `${result.circuit.key}-${i}`,
        label: `${result.circuit.label}${quantity > 1 ? ` ${i + 1}` : ""}`,
        cable: result.selectedCable,
        purpose: "power",
      });
    }
  }
  for (const extra of inputs.extraCables) {
    const cable = cableByArticle(extra.articleNo);
    if (!cable) continue;
    for (let i = 0; i < Math.max(0, Math.round(extra.quantity)); i++) {
      items.push({
        id: `${extra.id}-${i}`,
        label: `${extra.label || cable.family}${extra.quantity > 1 ? ` ${i + 1}` : ""}`,
        cable,
        purpose: extra.purpose,
      });
    }
  }

  const gap = Math.max(0, inputs.cableGapMm);
  const width = Math.max(1, inputs.usableWidthMm);
  const rows = optimizeRows(initialRows(items, inputs.rowCount, gap), gap, width);
  const placements = placeRows(rows, gap, width);
  const rowWidths = rowsWidth(rows, gap);
  const rowHeights = rows.map((row) => Math.max(0, ...row.map((x) => x.cable.heightMm)));
  const packageWidthMm = Math.max(0, ...rowWidths);
  const packageHeightMm = rowHeights.reduce((a, b) => a + b, 0) + Math.max(0, rows.length - 1) * gap;
  const packageWeightKgPerM = placements.reduce((sum, p) => sum + p.weightKgPerM, 0);
  const trolleyCableLoadKg = packageWeightKgPerM * 2 * Math.max(0, inputs.loopHeightM);
  const offset = centerOffset(placements, width);
  const cog = width / 2 + offset;
  // Üretici R_min değeri kablonun merkez hattı içindir. Bombeli mesnette
  // merkez hattı çapı D_mesnet + kablo kalınlığı olduğundan gereken mesnet
  // çapı 2·R_min − kablo kalınlığıdır.
  const minD = Math.max(0, ...placements.map((p) => p.minimumBendDiameterMm - p.heightMm));
  const unsuitableCableLabels = items
    .filter((item) => !item.cable.festoonSuitable)
    .map((item) => `${item.label} · ${item.cable.brand} ${item.cable.family} ${item.cable.construction}`);
  return {
    placements,
    rowCount: inputs.rowCount,
    packageWidthMm,
    packageHeightMm,
    packageWeightKgPerM,
    trolleyCableLoadKg,
    centerOfGravityXmm: cog,
    centerOffsetMm: offset,
    minimumSupportDiameterMm: minD,
    unsuitableCableLabels,
    fitsCableApplication: unsuitableCableLabels.length === 0,
    fitsWidth: packageWidthMm <= inputs.usableWidthMm,
    fitsHeight: packageHeightMm <= inputs.usableHeightMm,
    fitsBend: inputs.supportDiameterMm >= minD,
    fitsLoad: trolleyCableLoadKg <= inputs.maxCableLoadKg,
  };
}

function festoonViolationScore(layout: FestoonLayoutTrial, inputs: ElectricalInputs): number {
  const ratio = (used: number, allowed: number) => Math.max(0, used / Math.max(allowed, 0.001) - 1);
  return ratio(layout.packageWidthMm, inputs.usableWidthMm)
    + ratio(layout.packageHeightMm, inputs.usableHeightMm)
    + ratio(layout.minimumSupportDiameterMm, inputs.supportDiameterMm)
    + ratio(layout.trolleyCableLoadKg, inputs.maxCableLoadKg);
}

/**
 * Kablo paketine göre en küçük uygun katalog arabasını ve mümkünse tek sırayı
 * seçer. Otomatik kapatılan eksenlerde kullanıcının değeri aynen korunur.
 */
function resolveFestoonLayout(
  inputs: ElectricalInputs,
  cableResults: ElectricalCableResult[]
): FestoonLayoutResult {
  const presetCandidates: Array<Pick<
    ElectricalInputs,
    "trolleyPresetId" | "trolleyBrand" | "trolleyModel" | "trolleyWidthMm" |
    "usableWidthMm" | "usableHeightMm" | "supportDiameterMm" | "maxCableLoadKg"
  >> = inputs.trolleyPresetAuto
    ? [...FESTOON_TROLLEY_PRESETS]
        .sort((a, b) => a.trolleyWidthMm - b.trolleyWidthMm || a.usableHeightMm - b.usableHeightMm)
        .map((preset) => ({
          trolleyPresetId: preset.id,
          trolleyBrand: preset.brand,
          trolleyModel: preset.model,
          trolleyWidthMm: preset.trolleyWidthMm,
          usableWidthMm: preset.usableWidthMm,
          usableHeightMm: preset.usableHeightMm,
          supportDiameterMm: preset.supportDiameterMm,
          maxCableLoadKg: preset.maxCableLoadKg,
        }))
    : [{
        trolleyPresetId: inputs.trolleyPresetId,
        trolleyBrand: inputs.trolleyBrand,
        trolleyModel: inputs.trolleyModel,
        trolleyWidthMm: inputs.trolleyWidthMm,
        usableWidthMm: inputs.usableWidthMm,
        usableHeightMm: inputs.usableHeightMm,
        supportDiameterMm: inputs.supportDiameterMm,
        maxCableLoadKg: inputs.maxCableLoadKg,
      }];
  const rowCandidates: Array<1 | 2> = inputs.rowCountAuto ? [1, 2] : [inputs.rowCount];
  const candidates: Array<{ effective: ElectricalInputs; layout: FestoonLayoutTrial }> = [];

  // Tek sıra önceliklidir; o sırada kabloyu taşıyan en küçük katalog arabası
  // seçilir. Tek sıra hiçbir katalog satırında olmazsa çift sıra denenir.
  for (const rowCount of rowCandidates) {
    for (const preset of presetCandidates) {
      const effective = { ...inputs, ...preset, rowCount };
      candidates.push({ effective, layout: festoonLayoutTrial(effective, cableResults) });
    }
  }

  const selected = candidates.find(({ layout }) =>
    layout.fitsWidth && layout.fitsHeight && layout.fitsBend && layout.fitsLoad
  ) ?? [...candidates].sort((a, b) =>
    festoonViolationScore(a.layout, a.effective) - festoonViolationScore(b.layout, b.effective)
  )[0];
  const effective = selected?.effective ?? inputs;
  const layout = selected?.layout ?? festoonLayoutTrial(inputs, cableResults);
  return {
    ...layout,
    trolleyPresetId: effective.trolleyPresetId,
    trolleyBrand: effective.trolleyBrand,
    trolleyModel: effective.trolleyModel,
    trolleyWidthMm: effective.trolleyWidthMm,
    usableWidthMm: effective.usableWidthMm,
    usableHeightMm: effective.usableHeightMm,
    supportDiameterMm: effective.supportDiameterMm,
    maxCableLoadKg: effective.maxCableLoadKg,
    loopHeightM: effective.loopHeightM,
    circuitKeys: effective.festoonCircuitKeys,
    cableGapMm: effective.cableGapMm,
    trolleyAutomatic: inputs.trolleyPresetAuto,
    rowCountAutomatic: inputs.rowCountAuto,
    loopHeightAutomatic: inputs.loopHeightAuto,
    circuitKeysAutomatic: inputs.festoonCircuitKeysAuto,
    cableGapAutomatic: inputs.cableGapAuto,
  };
}

export function computeElectrical(
  specs: TechnicalSpecs,
  rawInputs: ElectricalInputs,
  rawSelections: ElectricalSelections,
  deps: ElectricalDeps
): ModuleResult<ElectricalValues> {
  const inputs: ElectricalInputs = {
    ...DEFAULT_ELECTRICAL_INPUTS,
    ...rawInputs,
    circuits: { ...DEFAULT_ELECTRICAL_INPUTS.circuits, ...rawInputs?.circuits },
    festoonCircuitKeys: rawInputs?.festoonCircuitKeys ?? DEFAULT_ELECTRICAL_INPUTS.festoonCircuitKeys,
    extraCables: rawInputs?.extraCables ?? [],
    rowCount: rawInputs?.rowCount === 2 ? 2 : 1,
  };
  const selections: ElectricalSelections = {
    ...DEFAULT_ELECTRICAL_SELECTIONS,
    ...rawSelections,
    drives: { ...rawSelections?.drives },
    motorCables: { ...rawSelections?.motorCables },
    mainCable: { ...rawSelections?.mainCable },
  };
  const settings: ElectricalResolvedSettings = {
    lineVoltageV: inputs.lineVoltageAuto
      ? lineVoltageFromSpecs(specs, DEFAULT_ELECTRICAL_INPUTS.lineVoltageV)
      : sanePositive(inputs.lineVoltageV, DEFAULT_ELECTRICAL_INPUTS.lineVoltageV),
    powerFactor: inputs.powerFactorAuto
      ? DEFAULT_ELECTRICAL_INPUTS.powerFactor
      : Math.min(1, Math.max(0.1, sanePositive(inputs.powerFactor, DEFAULT_ELECTRICAL_INPUTS.powerFactor))),
    motorEfficiencyPct: inputs.motorEfficiencyAuto
      ? DEFAULT_ELECTRICAL_INPUTS.motorEfficiencyPct
      : Math.min(100, sanePositive(inputs.motorEfficiencyPct, DEFAULT_ELECTRICAL_INPUTS.motorEfficiencyPct)),
    voltageDropLimitPct: inputs.voltageDropLimitAuto
      ? DEFAULT_ELECTRICAL_INPUTS.voltageDropLimitPct
      : sanePositive(inputs.voltageDropLimitPct, DEFAULT_ELECTRICAL_INPUTS.voltageDropLimitPct),
    currentDeratingFactor: sanePositive(inputs.currentDeratingFactor, 1),
    mainDemandFactor: inputs.mainDemandFactorAuto
      ? DEFAULT_ELECTRICAL_INPUTS.mainDemandFactor
      : Math.min(1, Math.max(0.1, sanePositive(inputs.mainDemandFactor, DEFAULT_ELECTRICAL_INPUTS.mainDemandFactor))),
    defaultMotorCableLengthM: inputs.defaultMotorCableLengthAuto
      ? DEFAULT_ELECTRICAL_INPUTS.defaultMotorCableLengthM
      : sanePositive(inputs.defaultMotorCableLengthM, DEFAULT_ELECTRICAL_INPUTS.defaultMotorCableLengthM),
    mainCableLengthM: inputs.mainCableLengthAuto
      ? DEFAULT_ELECTRICAL_INPUTS.mainCableLengthM
      : sanePositive(inputs.mainCableLengthM, DEFAULT_ELECTRICAL_INPUTS.mainCableLengthM),
  };
  const automaticFestoonKeys = deps.festoon?.circuitKeys.filter((key) =>
    deps.motors.some((motor) => motor.key === key)
  ) ?? [];
  const effectiveInputs: ElectricalInputs = {
    ...inputs,
    lineVoltageV: settings.lineVoltageV,
    powerFactor: settings.powerFactor,
    motorEfficiencyPct: settings.motorEfficiencyPct,
    voltageDropLimitPct: settings.voltageDropLimitPct,
    mainDemandFactor: settings.mainDemandFactor,
    defaultMotorCableLengthM: settings.defaultMotorCableLengthM,
    mainCableLengthM: settings.mainCableLengthM,
    festoonCircuitKeys: inputs.festoonCircuitKeysAuto && automaticFestoonKeys.length > 0
      ? automaticFestoonKeys
      : inputs.festoonCircuitKeys,
    loopHeightM: inputs.loopHeightAuto
      ? sanePositive(deps.festoon?.loopHeightM, DEFAULT_ELECTRICAL_INPUTS.loopHeightM)
      : sanePositive(inputs.loopHeightM, DEFAULT_ELECTRICAL_INPUTS.loopHeightM),
    cableGapMm: inputs.cableGapAuto ? DEFAULT_ELECTRICAL_INPUTS.cableGapMm : Math.max(0, inputs.cableGapMm),
  };
  const voltage = settings.lineVoltageV;
  const pf = settings.powerFactor;
  const efficiency = settings.motorEfficiencyPct;
  const maxDrop = settings.voltageDropLimitPct;
  const derating = Math.max(0.1, ambientFactor(specs.ambientTempMaxC) * settings.currentDeratingFactor);
  const checks: AnyCheck[] = [];

  const drives: ElectricalDriveResult[] = [];
  const motorCables: ElectricalCableResult[] = [];
  for (const source of deps.motors.filter((x) => x.motorPowerKw > 0 && x.motorCount > 0)) {
    const override = inputs.circuits[source.key];
    const ratedCurrentAutomatic = automaticUnlessOverridden(
      override?.ratedCurrentAuto,
      override?.ratedCurrentA !== undefined
    );
    const calculatedCurrentA = motorCurrent(source.motorPowerKw, voltage, pf, efficiency);
    const designCurrentA = ratedCurrentAutomatic
      ? calculatedCurrentA
      : sanePositive(override?.ratedCurrentA, calculatedCurrentA);
    const drivePick = selections.drives[source.key];
    const driveAutomatic = automaticUnlessOverridden(override?.driveAuto, Boolean(drivePick?.model));
    const resolvedDrive = resolveDrive(source, driveAutomatic ? undefined : drivePick, designCurrentA);
    drives.push({
      circuit: source,
      designCurrentA,
      drive: resolvedDrive.drive,
      automatic: driveAutomatic,
      ratedCurrentAutomatic,
    });
    checks.push(check(
      `electrical.drive.${source.key}.power`, `${source.label} sürücü gücü`, source.motorPowerKw,
      resolvedDrive.drive?.motorPowerKw ?? 0, "kW", ">=", "uretici"
    ));
    checks.push(check(
      `electrical.drive.${source.key}.current`, `${source.label} sürücü çıkış akımı`, designCurrentA,
      resolvedDrive.drive?.outputCurrentA ?? 0, "A", ">=", "uretici"
    ));

    const lengthAutomatic = automaticUnlessOverridden(
      override?.cableLengthAuto,
      override?.cableLengthM !== undefined
    );
    const lengthM = lengthAutomatic
      ? settings.defaultMotorCableLengthM
      : sanePositive(override?.cableLengthM, settings.defaultMotorCableLengthM);
    const required = requiredCable(designCurrentA, lengthM, voltage, pf, derating, maxDrop);
    const pick = selections.motorCables[source.key];
    const cableAutomatic = automaticUnlessOverridden(
      override?.cableAuto,
      Boolean(pick?.articleNo) || pick?.parallelRuns !== undefined
    );
    const picked = !cableAutomatic && pick?.articleNo ? cableByArticle(pick.articleNo) : undefined;
    const selectedCable = picked ?? autoCable(
      required.sectionMm2,
      effectiveInputs.festoonCircuitKeys.includes(source.key) ? "NGFLCGÖU" : "TOPFLEX 611-C-PUR"
    );
    const selectedRuns = cableAutomatic
      ? required.runs
      : Math.max(1, Math.round(sanePositive(pick?.parallelRuns, required.runs)));
    const section = selectedCable?.sectionMm2 ?? 0;
    const ampacityA = (AMPACITY_A[section] ?? 0) * derating * selectedRuns;
    const drop = voltageDropPct(designCurrentA, lengthM, section, selectedRuns, voltage, pf);
    motorCables.push({
      circuit: source, designCurrentA, lengthM,
      requiredSectionMm2: required.sectionMm2, recommendedRuns: required.runs,
      selectedCable, selectedRuns, ampacityA, voltageDropPct: drop,
      automatic: cableAutomatic,
      ratedCurrentAutomatic,
      lengthAutomatic,
    });
    checks.push(check(
      `electrical.cable.${source.key}.ampacity`, `${source.label} kablo akım taşıma`, designCurrentA,
      ampacityA, "A", ">=", "firma"
    ));
    checks.push(check(
      `electrical.cable.${source.key}.voltageDrop`, `${source.label} gerilim düşümü`, maxDrop,
      drop, "%", "<=", "firma"
    ));
  }

  const installedPowerKw = deps.motors.reduce((sum, x) => sum + x.motorPowerKw * x.motorCount, 0);
  const mainDesignCurrentA = drives.reduce(
    (sum, drive) => sum + drive.designCurrentA * drive.circuit.motorCount,
    0
  ) * settings.mainDemandFactor;
  const mainLength = settings.mainCableLengthM;
  const mainRequired = requiredCable(mainDesignCurrentA, mainLength, voltage, pf, derating, maxDrop);
  const mainAutomatic = inputs.mainCableAuto;
  const mainPicked = !mainAutomatic && selections.mainCable.articleNo
    ? cableByArticle(selections.mainCable.articleNo)
    : undefined;
  const mainSelected = mainPicked ?? autoCable(mainRequired.sectionMm2, "JZ-600");
  const mainRuns = mainAutomatic
    ? mainRequired.runs
    : Math.max(1, Math.round(sanePositive(selections.mainCable.parallelRuns, mainRequired.runs)));
  const mainSection = mainSelected?.sectionMm2 ?? 0;
  const mainAmpacity = (AMPACITY_A[mainSection] ?? 0) * derating * mainRuns;
  const mainDrop = voltageDropPct(mainDesignCurrentA, mainLength, mainSection, mainRuns, voltage, pf);
  const mainCable: MainCableResult = {
    designCurrentA: mainDesignCurrentA,
    installedPowerKw,
    lengthM: mainLength,
    requiredSectionMm2: mainRequired.sectionMm2,
    recommendedRuns: mainRequired.runs,
    selectedCable: mainSelected,
    selectedRuns: mainRuns,
    ampacityA: mainAmpacity,
    voltageDropPct: mainDrop,
    automatic: mainAutomatic,
  };
  checks.push(check("electrical.cable.main.ampacity", "Ana besleme kablosu akım taşıma", mainDesignCurrentA, mainAmpacity, "A", ">="));
  checks.push(check("electrical.cable.main.voltageDrop", "Ana besleme kablosu gerilim düşümü", maxDrop, mainDrop, "%", "<="));

  const festoon = resolveFestoonLayout(effectiveInputs, motorCables);
  checks.push(check("electrical.festoon.width", "Feston kablo paketi genişliği", festoon.usableWidthMm, festoon.packageWidthMm, "mm", "<=", "uretici"));
  checks.push(check("electrical.festoon.height", "Feston kablo paketi yüksekliği", festoon.usableHeightMm, festoon.packageHeightMm, "mm", "<=", "uretici"));
  checks.push(check("electrical.festoon.bend", "Feston taşıyıcı bükülme çapı", festoon.minimumSupportDiameterMm, festoon.supportDiameterMm, "mm", ">=", "uretici"));
  checks.push(check("electrical.festoon.load", "Feston araba kablo yükü", festoon.maxCableLoadKg, festoon.trolleyCableLoadKg, "kg", "<=", "uretici"));
  checks.push(check("electrical.festoon.application", "Feston hareketli kullanıma uygun kablo", 1, festoon.fitsCableApplication ? 1 : 0, "", ">=", "uretici"));
  checks.push(check(
    "electrical.festoon.cog", "Feston enine ağırlık merkezi sapması",
    Math.max(2, festoon.usableWidthMm * 0.05), Math.abs(festoon.centerOffsetMm), "mm", "<=", "firma", "uyari"
  ));

  const cells: Record<string, number | string> = {
    "system.voltage": voltage,
    "system.powerFactor": pf,
    "system.motorEfficiency": efficiency,
    "system.ambientTemperature": specs.ambientTempMaxC,
    "system.ambientFactor": ambientFactor(specs.ambientTempMaxC),
    "system.extraDerating": settings.currentDeratingFactor,
    "system.totalDerating": derating,
    "system.voltageDropLimit": maxDrop,
    "system.demandFactor": settings.mainDemandFactor,
    "system.installedPower": installedPowerKw,
    "system.mainCurrent": mainDesignCurrentA,
    "mainCable.length": mainLength,
    "mainCable.ampacity": mainAmpacity,
    "mainCable.requiredSection": mainRequired.sectionMm2,
    "mainCable.selected": mainSelected
      ? `${mainRuns} × ${mainSelected.family} ${mainSelected.construction} (${mainSelected.articleNo})`
      : "Kablo bulunamadı",
    "mainCable.voltageDrop": mainDrop,
    "festoon.trolley": `${festoon.trolleyBrand} ${festoon.trolleyModel}`.trim(),
    "festoon.packageWidth": festoon.packageWidthMm,
    "festoon.packageHeight": festoon.packageHeightMm,
    "festoon.packageWeight": festoon.packageWeightKgPerM,
    "festoon.loopHeight": festoon.loopHeightM,
    "festoon.loopCableLength": 2 * festoon.loopHeightM,
    "festoon.trolleyCableLoad": festoon.trolleyCableLoadKg,
    "festoon.maxCableLoad": festoon.maxCableLoadKg,
    "festoon.usableWidth": festoon.usableWidthMm,
    "festoon.usableHeight": festoon.usableHeightMm,
    "festoon.supportDiameter": festoon.supportDiameterMm,
    "festoon.centerOffset": festoon.centerOffsetMm,
    "festoon.minimumDiameter": festoon.minimumSupportDiameterMm,
  };

  return { values: { settings, drives, motorCables, mainCable, festoon }, checks, cells };
}
