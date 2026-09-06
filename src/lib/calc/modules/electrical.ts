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
  cableLengthM?: number;
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
  powerFactor: number;
  motorEfficiencyPct: number;
  voltageDropLimitPct: number;
  currentDeratingFactor: number;
  mainDemandFactor: number;
  defaultMotorCableLengthM: number;
  mainCableLengthM: number;
  circuits: Partial<Record<ElectricalCircuitKey, ElectricalCircuitInput>>;
  festoonCircuitKeys: ElectricalCircuitKey[];
  extraCables: ElectricalExtraCable[];
  trolleyPresetId: string;
  trolleyBrand: string;
  trolleyModel: string;
  trolleyWidthMm: number;
  usableWidthMm: number;
  usableHeightMm: number;
  supportDiameterMm: number;
  maxCableLoadKg: number;
  loopHeightM: number;
  rowCount: 1 | 2;
  cableGapMm: number;
}

export interface ElectricalSelections {
  drives: Partial<Record<ElectricalCircuitKey, ElectricalDrivePick>>;
  motorCables: Partial<Record<ElectricalCircuitKey, ElectricalCablePick>>;
  mainCable: ElectricalCablePick;
}

export const DEFAULT_ELECTRICAL_INPUTS: ElectricalInputs = {
  lineVoltageV: 380,
  powerFactor: 0.85,
  motorEfficiencyPct: 90,
  voltageDropLimitPct: 3,
  currentDeratingFactor: 1,
  mainDemandFactor: 0.75,
  defaultMotorCableLengthM: 30,
  mainCableLengthM: 50,
  circuits: {},
  // Ana/yardımcı kaldırma ile ana araba, aynı araba üzerindeki en sık demettir.
  // Hesapta olmayan anahtarlar otomatik süzülür; kullanıcı her birini kaldırabilir.
  festoonCircuitKeys: ["main", "aux", "trolley"],
  // Yerleşim ilk açıldığında güç/kumanda/sinyal ayrımı görülebilsin. Bunlar
  // proje girdisi değil, kullanıcı tarafından silinebilen başlangıç kalemleri.
  extraCables: [
    { id: "default-control", label: "Kumanda", articleNo: "10369", quantity: 1, purpose: "control" },
    { id: "default-signal", label: "Sinyal / enkoder", articleNo: "19104", quantity: 1, purpose: "signal" },
  ],
  trolleyPresetId: "vasel-vs2020a",
  trolleyBrand: "Vasel",
  trolleyModel: "VS2020A-4WF",
  trolleyWidthMm: 106,
  usableWidthMm: 74,
  usableHeightMm: 22,
  supportDiameterMm: 80,
  maxCableLoadKg: 25,
  loopHeightM: 1.5,
  rowCount: 1,
  cableGapMm: 2,
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
  fitsWidth: boolean;
  fitsHeight: boolean;
  fitsBend: boolean;
  fitsLoad: boolean;
}

export interface ElectricalValues {
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

function festoonLayout(
  inputs: ElectricalInputs,
  cableResults: ElectricalCableResult[]
): FestoonLayoutResult {
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
  const minD = Math.max(0, ...placements.map((p) => p.minimumBendDiameterMm));
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
    fitsWidth: packageWidthMm <= inputs.usableWidthMm,
    fitsHeight: packageHeightMm <= inputs.usableHeightMm,
    fitsBend: inputs.supportDiameterMm >= minD,
    fitsLoad: trolleyCableLoadKg <= inputs.maxCableLoadKg,
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
  const voltage = sanePositive(inputs.lineVoltageV, 380);
  const pf = Math.min(1, Math.max(0.1, sanePositive(inputs.powerFactor, 0.85)));
  const efficiency = Math.min(100, sanePositive(inputs.motorEfficiencyPct, 90));
  const maxDrop = sanePositive(inputs.voltageDropLimitPct, 3);
  const derating = Math.max(0.1, ambientFactor(specs.ambientTempMaxC) * sanePositive(inputs.currentDeratingFactor, 1));
  const checks: AnyCheck[] = [];

  const drives: ElectricalDriveResult[] = [];
  const motorCables: ElectricalCableResult[] = [];
  for (const source of deps.motors.filter((x) => x.motorPowerKw > 0 && x.motorCount > 0)) {
    const override = inputs.circuits[source.key];
    const designCurrentA = sanePositive(
      override?.ratedCurrentA,
      motorCurrent(source.motorPowerKw, voltage, pf, efficiency)
    );
    const resolvedDrive = resolveDrive(source, selections.drives[source.key], designCurrentA);
    drives.push({ circuit: source, designCurrentA, ...resolvedDrive });
    checks.push(check(
      `electrical.drive.${source.key}.power`, `${source.label} sürücü gücü`, source.motorPowerKw,
      resolvedDrive.drive?.motorPowerKw ?? 0, "kW", ">=", "uretici"
    ));
    checks.push(check(
      `electrical.drive.${source.key}.current`, `${source.label} sürücü çıkış akımı`, designCurrentA,
      resolvedDrive.drive?.outputCurrentA ?? 0, "A", ">=", "uretici"
    ));

    const lengthM = sanePositive(override?.cableLengthM, inputs.defaultMotorCableLengthM);
    const required = requiredCable(designCurrentA, lengthM, voltage, pf, derating, maxDrop);
    const pick = selections.motorCables[source.key];
    const picked = pick?.articleNo ? cableByArticle(pick.articleNo) : undefined;
    const selectedCable = picked ?? autoCable(required.sectionMm2, "TOPFLEX 611-C-PUR");
    const selectedRuns = Math.max(1, Math.round(sanePositive(pick?.parallelRuns, required.runs)));
    const section = selectedCable?.sectionMm2 ?? 0;
    const ampacityA = (AMPACITY_A[section] ?? 0) * derating * selectedRuns;
    const drop = voltageDropPct(designCurrentA, lengthM, section, selectedRuns, voltage, pf);
    motorCables.push({
      circuit: source, designCurrentA, lengthM,
      requiredSectionMm2: required.sectionMm2, recommendedRuns: required.runs,
      selectedCable, selectedRuns, ampacityA, voltageDropPct: drop,
      automatic: !picked,
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
  ) * Math.min(1, Math.max(0.1, inputs.mainDemandFactor));
  const mainLength = sanePositive(inputs.mainCableLengthM, 50);
  const mainRequired = requiredCable(mainDesignCurrentA, mainLength, voltage, pf, derating, maxDrop);
  const mainPicked = selections.mainCable.articleNo
    ? cableByArticle(selections.mainCable.articleNo)
    : undefined;
  const mainSelected = mainPicked ?? autoCable(mainRequired.sectionMm2, "JZ-600");
  const mainRuns = Math.max(1, Math.round(sanePositive(selections.mainCable.parallelRuns, mainRequired.runs)));
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
    automatic: !mainPicked,
  };
  checks.push(check("electrical.cable.main.ampacity", "Ana besleme kablosu akım taşıma", mainDesignCurrentA, mainAmpacity, "A", ">="));
  checks.push(check("electrical.cable.main.voltageDrop", "Ana besleme kablosu gerilim düşümü", maxDrop, mainDrop, "%", "<="));

  const festoon = festoonLayout(inputs, motorCables);
  checks.push(check("electrical.festoon.width", "Feston kablo paketi genişliği", inputs.usableWidthMm, festoon.packageWidthMm, "mm", "<=", "uretici"));
  checks.push(check("electrical.festoon.height", "Feston kablo paketi yüksekliği", inputs.usableHeightMm, festoon.packageHeightMm, "mm", "<=", "uretici"));
  checks.push(check("electrical.festoon.bend", "Feston taşıyıcı bükülme çapı", festoon.minimumSupportDiameterMm, inputs.supportDiameterMm, "mm", ">=", "uretici"));
  checks.push(check("electrical.festoon.load", "Feston araba kablo yükü", inputs.maxCableLoadKg, festoon.trolleyCableLoadKg, "kg", "<=", "uretici"));
  checks.push(check(
    "electrical.festoon.cog", "Feston enine ağırlık merkezi sapması",
    Math.max(2, inputs.usableWidthMm * 0.05), Math.abs(festoon.centerOffsetMm), "mm", "<=", "firma", "uyari"
  ));

  const cells: Record<string, number | string> = {
    "system.voltage": voltage,
    "system.installedPower": installedPowerKw,
    "system.mainCurrent": mainDesignCurrentA,
    "mainCable.requiredSection": mainRequired.sectionMm2,
    "mainCable.selected": mainSelected
      ? `${mainRuns} × ${mainSelected.family} ${mainSelected.construction} (${mainSelected.articleNo})`
      : "Kablo bulunamadı",
    "mainCable.voltageDrop": mainDrop,
    "festoon.trolley": `${inputs.trolleyBrand} ${inputs.trolleyModel}`.trim(),
    "festoon.packageWidth": festoon.packageWidthMm,
    "festoon.packageHeight": festoon.packageHeightMm,
    "festoon.packageWeight": festoon.packageWeightKgPerM,
    "festoon.centerOffset": festoon.centerOffsetMm,
    "festoon.minimumDiameter": festoon.minimumSupportDiameterMm,
  };

  return { values: { drives, motorCables, mainCable, festoon }, checks, cells };
}
