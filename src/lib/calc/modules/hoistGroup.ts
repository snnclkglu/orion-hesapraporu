// Kaldırma grubu hesabı — ana ve yardımcı kaldırma mekanizmasının tek
// parametrik modülü (`which` ile hangi mekanizma olduğu seçilir).
//
// YÖNTEM doğrudan standartlara dayanır:
//   · FEM 1.001 T.4.2.2.1.2 — halat emniyet katsayısı Zp
//   · FEM 1.001 T.4.2.3.1.1 — minimum tambur çapı katsayısı H
//   · FEM 1.001 T.2.1.3.2   — mekanizma kullanım sınıfı → gerekli rulman ömrü
//   · DIN 15061             — tambur yiv hatvesi
//   · CMAA 70 4.11.4.1      — mil gerilmeleri
//   · CMAA 70 5.2.9.1.1     — kaldırma motoru gücü
//
// Hesaplanan her büyüklük `cells` haritasında SEMANTİK anahtarla
// (`<blok>.<büyüklük>`) yer alır: `rope.load`, `drum.minDia`,
// `drumShaft.reactionGearbox`, `gearbox.requiredTorque` gibi. Sunum katmanı ve
// tarihsel doğrulama fikstürü yalnız bu anahtarları okur.
//
// Ortak kütüphaneler: halat donanımı `reeving.ts`, kiriş statiği `beam.ts`,
// dairesel kesit gerilmeleri `shaftStress.ts` üzerinden çözülür.
//
// Birimler: kg, kg/cm², cm, mm, kN, kNm, Nm, kW, m/dak, d/dak.

import { solveBeam, type PointLoad } from "../beam";
import {
  drumAllowableStress,
  drumCoefficient,
  groovePitch,
  mechanismLife,
  ropeSafetyFactor,
  shaftMaterialAllowables,
} from "../coefficients";
import { commonReevingByLabel, deriveReeving, type Reeving } from "../reeving";
import { shaftStress } from "../shaftStress";
import { KGF_TO_MPA } from "@/lib/units";
import type {
  AnyCheck,
  DrumMaterial,
  MechanismClass,
  ModuleResult,
  ShaftMaterial,
  TechnicalSpecs,
  UsageClass,
} from "../types";

/**
 * Kaldırma grubu varyantı. Aynı hesap; yalnız kapasite/yükseklik/hız ve
 * FEM sınıfları teknik özelliklerin farklı alanlarından okunur.
 */
export type HoistWhich = "main" | "aux" | "mono1" | "mono2";

// ------------------------------------------------- tambur mili geometrisi

/** Halat yükü konumu seçenekleri (girdi alanı listesiyle aynı metinler). */
export const ROPE_POSITION_AUTO = "En elverişsiz (otomatik)";
export const ROPE_POSITION_OUTER = "Dış uçlarda (yanaklara yakın)";
export const ROPE_POSITION_INNER = "İç uçlarda (ortaya yakın)";
export const ROPE_POSITIONS = [
  ROPE_POSITION_AUTO,
  ROPE_POSITION_OUTER,
  ROPE_POSITION_INNER,
] as const;

export function ropePositionMode(v: string | undefined): "auto" | "outer" | "inner" {
  if (v === ROPE_POSITION_OUTER) return "outer";
  if (v === ROPE_POSITION_INNER) return "inner";
  return "auto";
}

/** Yiv bölgesinin uç konumları (mesnet A'dan uzaklık, cm). */
interface GrooveSection {
  /** Yanaklara yakın uç */
  outer: number;
  /** Tambur ortasına yakın uç */
  inner: number;
}

export interface DrumShaftGeometry {
  aCm: number;          // redüktör tarafı konsol (moment kolu)
  gCm: number;          // tambur yatağı tarafı konsol (moment kolu)
  spanCm: number;       // mesnetler arası açıklık L
  weightArmCm: number;  // tambur ağırlık merkezinin mesnet A'ya uzaklığı
  sections: GrooveSection[];
}

const pos = (v: number | undefined): number =>
  typeof v === "number" && Number.isFinite(v) && v > 0 ? v : 0;

/**
 * A…G ölçü zincirinden mesnet açıklığını, tambur ağırlık merkezini ve yiv
 * bölgelerinin uç konumlarını türetir. Sağ yiv bölgesi (E) sıfırsa tek helisli
 * tambur kabul edilir ve tek yük noktası kullanılır.
 */
export function drumShaftGeometry(inp: HoistInputs): DrumShaftGeometry {
  const A = pos(inp.drumSpanACm);
  const B = pos(inp.drumSpanBCm);
  const C = pos(inp.drumSpanCCm);
  const D = pos(inp.drumSpanDCm);
  const E = pos(inp.drumSpanECm);
  const F = pos(inp.drumSpanFCm);
  const G = pos(inp.drumSpanGCm);
  const barrel = B + C + D + E + F;   // yanaklar arası namlu boyu
  const span = A + barrel + G;
  const sections: GrooveSection[] = [{ outer: A + B, inner: A + B + C }];
  if (E > 0) sections.push({ outer: A + B + C + D + E, inner: A + B + C + D });
  return {
    aCm: A,
    gCm: G,
    spanCm: span > 0 ? span : 1,
    weightArmCm: A + barrel / 2,
    sections,
  };
}


/** Kullanıcı girdileri (tasarım kabulleri) */
export interface HoistInputs {
  /** Tambura sarılan (tahrikli) halat kolu sayısı */
  drivenFalls: number;
  /** Kanca bloğunu taşıyan toplam halat kolu sayısı */
  totalFalls: number;
  /** Tek makara verimi η_m */
  sheaveEfficiency: number;
  /** Verim zincirindeki sabit (yönlendirme) makara adedi */
  fixedSheaveCount: number;
  /**
   * Hazır halat donanımı etiketi ("2/4", "4/8" …). Tanınan bir etiket
   * seçildiğinde tahrikli/toplam kol sayıları o donanımdan okunur; "Elle giriş"
   * veya tanınmayan bir değerde yukarıdaki iki alan geçerlidir.
   */
  reevingLabel?: string;
  hookBlockWeightKg: number;    // kanca bloğu / kepçe ağırlığı
  ropeWeightKg: number;         // askıdaki halatların ağırlığı
  drumWallThicknessMm: number;  // tambur et kalınlığı
  safetyGrooveCount: number;    // emniyet sarımı adedi
  drumWeightKg: number;         // tambur ağırlığı W
  /**
   * Tambur mili ölçü zinciri (cm) — teknik resimdeki A…G bölümleri, soldan
   * (redüktör tarafı) sağa (tambur yatağı tarafı):
   *   A: redüktör tarafı mesnet ekseni → sol yanak   (aynı zamanda moment kolu)
   *   B: sol yanak → sol yiv bölgesi başlangıcı
   *   C: sol yiv bölgesi uzunluğu
   *   D: ortadaki yivsiz bölge (iki helis arası)
   *   E: sağ yiv bölgesi uzunluğu
   *   F: sağ yiv bölgesi sonu → sağ yanak
   *   G: sağ yanak → tambur yatağı mesnet ekseni     (aynı zamanda moment kolu)
   */
  drumSpanACm: number;
  drumSpanBCm: number;
  drumSpanCCm: number;
  drumSpanDCm: number;
  drumSpanECm: number;
  drumSpanFCm: number;
  drumSpanGCm: number;
  /** Halat yüklerinin yiv bölgesindeki konumu (bkz. ROPE_POSITION_*) */
  ropeLoadPosition?: string;
  shaftD1Cm: number;            // D1: eğilme gerilmesi kesiti çapı (yanak dibi)
  shaftD2Cm: number;            // D2: yatak / rulman oturma çapı (kesme kesiti)
  drumWeldThicknessCm: number;  // tambur kaynak kalınlığı
  drumWeldAllowable: number;    // tambur kaynağı izin gerilmesi [MPa]
  shaftWeldThicknessCm: number; // mil kaynak kalınlığı
  shaftWeldAllowable: number;   // mil kaynağı izin gerilmesi [MPa]
  bearingFactorY1: number;      // rulman eşdeğer yük katsayısı (statik)
  bearingFactorY2: number;      // rulman eşdeğer yük katsayısı (dinamik)
  drumCount: number;            // tambur adedi
  gearboxServiceFactor: number; // redüktör emniyet katsayısı
  reducerStages: number;        // redüktör kademe sayısı
  stageEfficiency: number;      // kademe verimi
  tempFactor: number;           // sıcaklık faktörü
  motorDivisor: number;         // güç bölücü (motor başına)
  brakeServiceFactor: number;   // fren emniyet katsayısı
  motorCouplingServiceFactor: number;
  drumCouplingDivisor: number;
  drumCouplingServiceFactor: number;
  /**
   * Otomatik alan anahtarları (sunum tarafı; hesap zincirini değiştirmez).
   * Açıkken sihirbaz ilgili girdiyi `lib/calc/derive.ts` türetmesiyle doldurur
   * ve alanı salt-okunur yapar.
   */
  ropeWeightAuto?: boolean;
  /**
   * Kanca bloğu / tutucu ağırlığı otomatik: kaldırma kapasitesinin %10'u
   * (firma tasarım kabulü, bkz. `derive.ts`). Kepçe, mıknatıs gibi özel
   * tutucularda kapatılıp gerçek ağırlık girilir.
   */
  hookBlockWeightAuto?: boolean;
  /** Sıcaklık faktörü otomatik: ortam sıcaklığı üst sınırından türetilir. */
  tempFactorAuto?: boolean;
}

/** Katalog seçimleri — mühendisin seçtiği bileşenler */
export interface HoistSelections {
  ropeBrand: string;
  ropeDiaMm: number;
  ropeConstruction: string;     // ör. "6x36"
  ropeCore: string;
  ropeWireStrength: number;     // [kg/mm²]
  ropeBreakingLoadKn: number;
  /** Halat metre ağırlığı [kg/m] — katalogdan gelir, halat ağırlığı türetmesinde kullanılır */
  ropeWeightKgPerM?: number;
  /** Makara yataklama tipi — makara verimi türetmesinde kullanılır */
  sheaveBearingKind?: string;
  drumDiaMm: number;
  drumMaterial: DrumMaterial;
  drumGrooveLengthText: string; // ör. "2 x 220"
  shaftMaterial: ShaftMaterial;
  bearingType: string;
  bearingCode: string;          // ör. 22212
  bearingDynCKn: number;
  bearingStatC0Kn: number;
  gearboxModel: string;
  gearboxRatio: number;
  gearboxNominalTorqueKnm: number;
  gearboxInputShaftMm: number;
  gearboxOutputShaftMm: number;
  gearboxWeightKg: number;
  gearboxAllowedRadialKn: number;
  motorPowerKw: number;
  motorRpm: number;
  motorShaftMm: number;
  motorBrand: string;
  motorCount: number;
  brakeBrand: string;
  brakeModel: string;
  brakeTorqueNm: number;
  brakeWheelDiaMm: number;
  brakeQty: number;
  motorCouplingBrand: string;
  motorCouplingModel: string;
  motorCouplingWheelDiaMm: number;
  motorCouplingTorqueNm: number;
  motorCouplingDmaxMm: number;
  drumCouplingBrand: string;
  drumCouplingModel: string;
  drumCouplingTorqueNm: number;
  drumCouplingRadialN: number;
  drumCouplingDmaxMm: number;
}

export interface HoistValues {
  // 2.1 Halat
  mechanicalAdvantage: number;
  ropeEfficiency: number;
  loadKg: number;
  totalLoadKg: number;
  requiredRopeSafety: number;
  ropeLoadKg: number;
  requiredBreakingKg: number;
  actualBreakingKg: number;
  actualRopeSafety: number;
  // 2.2 Tambur
  drumCoefficientH: number;
  minDrumDiaMm: number;
  groovePitchMm: number;
  drumBearingStress: number;
  drumBendingStress: number;
  drumCombinedStress: number;
  drumAllowable: number;
  requiredGrooves: number;
  requiredGrooveLengthMm: number;
  // Mil (tambur mili — iki mesnetli kiriş)
  /** Mesnetler arası açıklık L = A+B+C+D+E+F+G [cm] */
  drumShaftSpanCm: number;
  /** Tambur ağırlık merkezinin redüktör tarafı mesnede uzaklığı [cm] */
  drumWeightArmCm: number;
  /** Yönetici yükleme halindeki halat yükü konumları [cm] */
  ropeLoadPositionsCm: number[];
  /** Tambur üzerindeki halat yükü sayısı ve tekil yük [kg] */
  ropeLoadCount: number;
  ropeLoadPerPointKg: number;
  /** Redüktör tarafı mesnet reaksiyonu (Ra) [kg] */
  reactionGearboxKg: number;
  /** Tambur yatağı tarafı mesnet reaksiyonu (Rg) [kg] */
  reactionBearingKg: number;
  /** Geriye uyum: Ra / Rg takma adları */
  reactionAKg: number;
  reactionBKg: number;
  momentGearboxKgCm: number;
  momentBearingKgCm: number;
  shaftMomentKgCm: number;
  /** Gerilmelerin yönetici olduğu taraf */
  shaftGoverningSide: "redüktör" | "tambur yatağı";
  shaftBendingStress: number;
  shaftShearStress: number;
  shaftCombinedStress: number;
  shaftAllowables: { bending: number; shear: number; combined: number };
  // Kaynaklar
  drumWeldCombinedStress: number;
  shaftWeldStress: number;
  // Rulman
  bearingRadialKn: number;
  bearingAxialKn: number;
  bearingEqStaticKn: number;
  bearingEqDynamicKn: number;
  bearingStaticSafety: number;
  drumRpm: number;
  bearingLifeHours: number;
  requiredLifeMin: number;
  requiredLifeMax: number | null;
  // Redüktör
  drumTorqueKnm: number;
  requiredGearboxTorqueKnm: number;
  requiredRatio: number;
  ratioDeviationPct: number;
  actualLiftSpeedMpm: number;
  gearboxActualSafety: number;
  gearboxRadialKn: number;
  // Motor
  reducerEfficiency: number;
  motorInputTorqueNm: number;
  requiredPowerKw: number;
  requiredPowerAdjustedKw: number;
  installedPowerKw: number;
  // Fren
  brakeShaftTorqueNm: number;
  requiredBrakeTorqueNm: number;
  brakeActualSafety: number;
  // Kaplinler
  requiredMotorCouplingTorqueNm: number;
  couplingShaftDiaMm: number;
  motorCouplingActualSafety: number;
  requiredDrumCouplingTorqueNm: number;
  requiredDrumCouplingRadialN: number;
  drumCouplingActualSafety: number;
}

/**
 * Girdilerden halat donanımı tanımını kurar — donanımın TEK kaynağı budur.
 * Hazır bir donanım etiketi seçilmişse ("2/4", "4/8" …) kol sayıları o
 * seçimden okunur; aksi hâlde girdideki serbest değerler geçerlidir.
 */
export function hoistReeving(inp: HoistInputs): Reeving {
  const preset = inp.reevingLabel ? commonReevingByLabel(inp.reevingLabel) : undefined;
  return {
    drivenFalls: preset?.drivenFalls ?? inp.drivenFalls,
    totalFalls: preset?.totalFalls ?? inp.totalFalls,
    fixedSheaveCount: inp.fixedSheaveCount,
    sheaveEfficiency: inp.sheaveEfficiency,
  };
}

/**
 * Bir kaldırma grubunun teknik özelliklerden okunan büyüklükleri.
 *
 * Her grup bağımsız bir mekanizmadır: kendi kapasitesi, yüksekliği, hızı ve
 * FEM sınıfları vardır. Grup için değer tanımlı değilse (eski revizyonlar,
 * yeni açılmış monoray) ana kaldırmanınki kullanılır — hesap asla NaN'a düşmez.
 */
export interface HoistSpecView {
  capacityT: number;
  liftHeightM: number;
  liftSpeedMpm: number;
  mechanismClass: MechanismClass;
  usageClass: UsageClass;
}

const posOr = (v: number | undefined, fallback: number): number =>
  typeof v === "number" && Number.isFinite(v) && v > 0 ? v : fallback;

export function hoistSpecView(specs: TechnicalSpecs, which: HoistWhich): HoistSpecView {
  switch (which) {
    case "aux":
      return {
        capacityT: specs.auxCapacityT,
        liftHeightM: specs.auxLiftHeightM,
        liftSpeedMpm: specs.auxLiftSpeedMpm,
        mechanismClass: specs.auxMechanismClass ?? specs.hoistMechanismClass,
        usageClass: specs.auxUsageClass ?? specs.hoistUsageClass,
      };
    case "mono1":
      return {
        capacityT: posOr(specs.mono1CapacityT, specs.mainCapacityT),
        liftHeightM: posOr(specs.mono1LiftHeightM, specs.mainLiftHeightM),
        liftSpeedMpm: posOr(specs.mono1LiftSpeedMpm, specs.mainLiftSpeedMpm),
        mechanismClass: specs.mono1MechanismClass ?? specs.hoistMechanismClass,
        usageClass: specs.mono1UsageClass ?? specs.hoistUsageClass,
      };
    case "mono2":
      return {
        capacityT: posOr(specs.mono2CapacityT, specs.mainCapacityT),
        liftHeightM: posOr(specs.mono2LiftHeightM, specs.mainLiftHeightM),
        liftSpeedMpm: posOr(specs.mono2LiftSpeedMpm, specs.mainLiftSpeedMpm),
        mechanismClass: specs.mono2MechanismClass ?? specs.hoistMechanismClass,
        usageClass: specs.mono2UsageClass ?? specs.hoistUsageClass,
      };
    default:
      return {
        capacityT: specs.mainCapacityT,
        liftHeightM: specs.mainLiftHeightM,
        liftSpeedMpm: specs.mainLiftSpeedMpm,
        mechanismClass: specs.hoistMechanismClass,
        usageClass: specs.hoistUsageClass,
      };
  }
}

export function computeHoistGroup(
  specs: TechnicalSpecs,
  which: HoistWhich,
  inp: HoistInputs,
  sel: HoistSelections
): ModuleResult<HoistValues> {
  const view = hoistSpecView(specs, which);
  const capacityT = view.capacityT;
  const liftHeightM = view.liftHeightM;
  const liftSpeedMpm = view.liftSpeedMpm;
  const mech = view.mechanismClass;
  const usage = view.usageClass;

  const cells: Record<string, number | string> = {};
  const checks: AnyCheck[] = [];

  // --- 2.1 Halat -----------------------------------------------------------
  // Donanım (mekanik avantaj + halat verimi) tek kaynaktan gelir: reeving.ts.
  const reeving = hoistReeving(inp);
  const rig = deriveReeving(reeving);
  const mechanicalAdvantage = rig.mechanicalAdvantage;
  const ropeEfficiency = rig.ropeEfficiency;
  const hoistedLoadKg = capacityT * 1000;
  const totalLoadKg = hoistedLoadKg + inp.hookBlockWeightKg + inp.ropeWeightKg;
  const requiredRopeSafety = ropeSafetyFactor(mech, "moving");
  const ropeLoadKg = totalLoadKg / reeving.totalFalls / ropeEfficiency;
  const requiredBreakingKg = ropeLoadKg * requiredRopeSafety;
  const actualBreakingKg = (sel.ropeBreakingLoadKn / 9.81) * 1000;
  const actualRopeSafety = actualBreakingKg / ropeLoadKg;
  Object.assign(cells, {
    "reeving.mechanicalAdvantage": mechanicalAdvantage,
    "reeving.ropeEfficiency": ropeEfficiency,
    "load.hoisted": hoistedLoadKg,
    "load.total": totalLoadKg,
    "rope.requiredSafety": requiredRopeSafety,
    "rope.load": ropeLoadKg,
    "rope.requiredBreakingLoad": requiredBreakingKg,
    "rope.breakingLoad": actualBreakingKg,
    "rope.actualSafety": actualRopeSafety,
  });
  checks.push({
    id: `${which}.rope.safety`,
    label: "Halat Emniyet Katsayısı",
    required: requiredRopeSafety, provided: actualRopeSafety, unit: "-", op: ">=",
    computedSide: "provided",
    pass: actualRopeSafety >= requiredRopeSafety,
    standard: "FEM 1.001 T.4.2.2.1.2",
    kind: "standart", severity: "engelleyici",
  });

  // --- 2.2.1 Tambur çapı ve gerilmeler -------------------------------------
  const drumCoefficientH = drumCoefficient(mech);
  const minDrumDiaMm = drumCoefficientH * sel.ropeDiaMm;
  const groovePitchMm = groovePitch(sel.ropeDiaMm);
  // Yiv tabanı ezilme gerilmesi: sarım başına düşen halat kuvvetinin hatve
  // ve et kalınlığı üzerine yayılması (klasik tambur gövdesi bağıntısı).
  const drumBearingStress =
    (0.5 * ropeLoadKg * 100) / groovePitchMm / inp.drumWallThicknessMm;
  // Tambur gövdesinin yerel eğilme gerilmesi (çap ve et kalınlığına bağlı).
  const drumBendingStress =
    0.96 *
    ropeLoadKg *
    (1 / ((sel.drumDiaMm / 10) ** 2 * (inp.drumWallThicknessMm / 10) ** 6) ** 0.25);
  const drumCombinedStress = Math.sqrt(
    drumBendingStress ** 2 + drumBearingStress ** 2 - drumBearingStress * drumBendingStress
  );
  const drumAllowable = drumAllowableStress(sel.drumMaterial);
  Object.assign(cells, {
    "drum.coefficient": drumCoefficientH,
    "drum.minDia": minDrumDiaMm,
    "drum.groovePitch": groovePitchMm,
    "drum.bearingStress": drumBearingStress,
    "drum.bendingStress": drumBendingStress,
    "drum.combinedStress": drumCombinedStress,
    "drum.allowableStress": drumAllowable,
  });
  checks.push({
    id: `${which}.drum.stress`,
    label: "Tambur Bileşik Gerilmesi",
    required: drumCombinedStress, provided: drumAllowable, unit: "kg/cm²", op: ">=",
    computedSide: "required",
    pass: drumAllowable >= drumCombinedStress,
    kind: "standart", severity: "engelleyici",
  });
  checks.push({
    id: `${which}.drum.dia`,
    label: "Tambur Çapı (min H·d)",
    required: minDrumDiaMm, provided: sel.drumDiaMm, unit: "mm", op: ">=",
    computedSide: "required",
    pass: sel.drumDiaMm >= minDrumDiaMm,
    standard: "FEM 1.001 T.4.2.3.1.1",
    kind: "standart", severity: "engelleyici",
  });

  // --- 2.2.2 Oluk boyu -----------------------------------------------------
  // Sarım sayısı: kaldırma yüksekliğinde tambura sarılacak halat boyu, tambur
  // çevresine bölünür; üzerine emniyet sarımı eklenir.
  const requiredGrooves =
    (mechanicalAdvantage * liftHeightM) / Math.PI / (sel.drumDiaMm / 1000) +
    inp.safetyGrooveCount;
  const requiredGrooveLengthMm = requiredGrooves * groovePitchMm;
  Object.assign(cells, {
    "drum.requiredGrooves": requiredGrooves,
    "drum.requiredGrooveLength": requiredGrooveLengthMm,
  });

  // --- 2.2.3 Tambur mili ---------------------------------------------------
  // Model (teknik resimdeki A…G ölçü zinciri): tambur, redüktör tarafı mesnet
  // (Ra) ile tambur yatağı tarafı mesnet (Rg) arasında iki mesnetli kiriştir.
  // Yükler: her yiv bölgesindeki halat yükü T ve tambur ağırlığı W (namlu
  // ortasında). Statik çözüm ortak kiriş çözücüsüyle (beam.ts) yapılır.
  // Halatlar yiv boyunca hareket ettiğinden iki uç hâli (dış uçlar / iç uçlar)
  // ayrı çözülür ve her mesnet için elverişsiz olan alınır.
  const geo = drumShaftGeometry(inp);
  const ropeLoadCount = rig.drumRopeEnds;
  const ropePerPoint = (ropeLoadKg * ropeLoadCount) / (geo.sections.length || 1);

  /**
   * Bir yükleme hâlini kiriş olarak çözer. Mesnet A (redüktör tarafı) x=0,
   * mesnet B (tambur yatağı tarafı) x=L konumundadır. Yanak dibi kesitleri
   * x=A ve x=L−G'dir; bu kesitlerle mesnetler arasında yük bulunmadığından
   * kesit momentleri doğrudan M = R · kol değerine eşittir.
   */
  const caseFor = (edge: "outer" | "inner") => {
    const xs = geo.sections.map((sec) => (edge === "outer" ? sec.outer : sec.inner));
    const pointLoads: PointLoad[] = xs.map((x, i) => ({
      xCm: x,
      loadKg: ropePerPoint,
      label: `Halat yükü T${i + 1}`,
    }));
    pointLoads.push({ xCm: geo.weightArmCm, loadKg: inp.drumWeightKg, label: "Tambur Ağırlığı W" });
    const beam = solveBeam({
      lengthCm: geo.spanCm,
      supportACm: 0,
      supportBCm: geo.spanCm,
      pointLoads,
    });
    return {
      xs,
      ra: beam.reactionAKg,
      rg: beam.reactionBKg,
      momentGearbox: Math.abs(beam.momentAt(geo.aCm)),
      momentBearing: Math.abs(beam.momentAt(geo.spanCm - geo.gCm)),
    };
  };
  const outer = caseFor("outer");
  const inner = caseFor("inner");
  const mode = ropePositionMode(inp.ropeLoadPosition);
  const cases = mode === "outer" ? [outer] : mode === "inner" ? [inner] : [outer, inner];

  // Her yükleme hâli kendi içinde dengededir (Ra + Rg = ΣT + W). Halat konumu
  // "otomatik" seçildiğinde her mesnet KENDİ elverişsiz hâliyle boyutlandırılır;
  // bu bir ZARF değeridir, iki reaksiyon aynı anda oluşmayabilir.
  const reactionGearboxKg = Math.max(...cases.map((c) => c.ra));
  const reactionBearingKg = Math.max(...cases.map((c) => c.rg));
  /** Tambur yatağını boyutlandıran hâlin halat konumları (diyagram + rapor) */
  const govBearing = cases.reduce((a, b) => (b.rg > a.rg ? b : a));
  const momentGearboxKgCm = Math.max(...cases.map((c) => c.momentGearbox));
  const momentBearingKgCm = Math.max(...cases.map((c) => c.momentBearing));

  const shaftAllow = shaftMaterialAllowables(sel.shaftMaterial);
  /**
   * Mil gerilmeleri ortak modülle (shaftStress.ts) bulunur. KONVANSİYONLAR
   * açık parametre olarak verilir:
   *   · combined: "resultant" → √(σ² + τ²). Firma kabulüdür; tambur milinde
   *     kesme gerilmesi eğilmenin yanında küçüktür ve izin verilen bileşik
   *     gerilme zaten malzeme tablosundan ayrıca sınırlanır.
   *   · shear: "maksimum" → dolu dairesel kesitte parabolik kayma dağılımının
   *     tepe değeri, ortalamanın tam 4/3 katıdır (tarafsız eksende).
   */
  const sideStress = (momentKgCm: number, reactionKg: number) =>
    shaftStress({
      momentKgCm,
      shearKg: reactionKg,
      bendingDiameterCm: inp.shaftD1Cm,
      shearDiameterCm: inp.shaftD2Cm,
      combined: "resultant",
      shear: "maksimum",
    });
  const sGearbox = sideStress(momentGearboxKgCm, reactionGearboxKg);
  const sBearing = sideStress(momentBearingKgCm, reactionBearingKg);
  const governing = sGearbox.combinedStress >= sBearing.combinedStress ? sGearbox : sBearing;
  const governingSide: "redüktör" | "tambur yatağı" =
    sGearbox.combinedStress >= sBearing.combinedStress ? "redüktör" : "tambur yatağı";

  const shaftMomentKgCm = Math.max(momentGearboxKgCm, momentBearingKgCm);
  const shaftBendingStress = governing.bendingStress;
  const shaftShearStress = governing.shearStress;
  const shaftCombinedStress = governing.combinedStress;
  /** Kaynak/kesit kontrollerinde elverişsiz mesnet reaksiyonu */
  const maxReactionKg = Math.max(reactionGearboxKg, reactionBearingKg);
  Object.assign(cells, {
    "drumShaft.span": geo.spanCm,
    "drumShaft.armGearbox": geo.aCm,
    "drumShaft.armBearing": geo.gCm,
    "drumShaft.weightArm": geo.weightArmCm,
    "drumShaft.ropeLoadPerPoint": ropePerPoint,
    "drumShaft.ropeX1": govBearing.xs[0] ?? 0,
    "drumShaft.ropeX2": govBearing.xs[1] ?? govBearing.xs[0] ?? 0,
    "drumShaft.reactionGearboxOuter": outer.ra,
    "drumShaft.reactionBearingOuter": outer.rg,
    "drumShaft.reactionGearboxInner": inner.ra,
    "drumShaft.reactionBearingInner": inner.rg,
    "drumShaft.ropeXOuter1": outer.xs[0] ?? 0,
    "drumShaft.ropeXOuter2": outer.xs[1] ?? outer.xs[0] ?? 0,
    "drumShaft.ropeXInner1": inner.xs[0] ?? 0,
    "drumShaft.ropeXInner2": inner.xs[1] ?? inner.xs[0] ?? 0,
    "drumShaft.momentGearbox": momentGearboxKgCm,
    "drumShaft.momentBearing": momentBearingKgCm,
    "drumShaft.reactionGearbox": reactionGearboxKg,
    "drumShaft.reactionBearing": reactionBearingKg,
    "drumShaft.moment": shaftMomentKgCm,
    "drumShaft.bendingStress": shaftBendingStress,
    "drumShaft.shearStress": shaftShearStress,
    "drumShaft.combinedStress": shaftCombinedStress,
    "drumShaft.allowableBending": shaftAllow.bending,
    "drumShaft.allowableShear": shaftAllow.shear,
    "drumShaft.allowableCombined": shaftAllow.combined,
  });
  checks.push({
    id: `${which}.shaft.stress`,
    label: "Tambur Mili Bileşik Gerilmesi",
    required: shaftCombinedStress, provided: shaftAllow.combined, unit: "kg/cm²", op: ">=",
    computedSide: "required",
    pass: shaftAllow.combined >= shaftCombinedStress,
    standard: "CMAA 70 4.11.4.1",
    kind: "standart", severity: "engelleyici",
  });
  checks.push({
    id: `${which}.shaft.bending`,
    label: "Tambur Mili Eğilme Gerilmesi",
    required: shaftBendingStress, provided: shaftAllow.bending, unit: "kg/cm²", op: ">=",
    computedSide: "required",
    pass: shaftAllow.bending >= shaftBendingStress,
    standard: "CMAA 70 4.11.4.1",
    kind: "standart", severity: "engelleyici",
  });
  checks.push({
    id: `${which}.shaft.shear`,
    label: "Tambur Mili Kesme Gerilmesi",
    required: shaftShearStress, provided: shaftAllow.shear, unit: "kg/cm²", op: ">=",
    computedSide: "required",
    pass: shaftAllow.shear >= shaftShearStress,
    standard: "CMAA 70 4.11.4.1",
    kind: "standart", severity: "engelleyici",
  });

  // --- Tambur torku (kaynak ve redüktör hesapları buna dayanır) ------------
  const drumRadiusM = sel.drumDiaMm / 2000;
  const ropeLoadKn = (ropeLoadKg * 9.81) / 1000;
  const drumTorqueKnm = drumRadiusM * reeving.drivenFalls * ropeLoadKn;
  const drumTorquePerDrumKnm = drumTorqueKnm / inp.drumCount;
  const requiredGearboxTorqueKnm = inp.gearboxServiceFactor * drumTorquePerDrumKnm;

  // --- 2.2.4 Tambur kaynağı ------------------------------------------------
  // Tambur yanağı ile göbek arasındaki çevresel kaynak: burulma (tambur torku)
  // ve kesme (mesnet reaksiyonu) birlikte etkir.
  const drumWeldLengthCm = (Math.PI * sel.drumDiaMm) / 10;
  const drumWeldThroatAreaCm2 = inp.drumWeldThicknessCm * drumWeldLengthCm;
  const drumWeldOuterDiaMm = sel.drumDiaMm + 2 * inp.drumWeldThicknessCm * 10;
  const drumWeldAreaCm2 =
    (Math.PI * ((drumWeldOuterDiaMm / 2) ** 2 - (sel.drumDiaMm / 2) ** 2)) / 100;
  const drumWeldPolarModulusCm3 =
    (Math.PI * ((drumWeldOuterDiaMm / 10) ** 4 - (sel.drumDiaMm / 10) ** 4)) / 32;
  const drumWeldTorsionStress =
    (drumTorquePerDrumKnm * 100000) / 9.81 / drumWeldPolarModulusCm3;
  const drumWeldShearStress = maxReactionKg / drumWeldAreaCm2;
  const drumWeldCombinedStress = drumWeldShearStress + drumWeldTorsionStress;
  Object.assign(cells, {
    "drumWeld.length": drumWeldLengthCm,
    "drumWeld.throatArea": drumWeldThroatAreaCm2,
    "drumWeld.outerDia": drumWeldOuterDiaMm,
    "drumWeld.area": drumWeldAreaCm2,
    "drumWeld.polarModulus": drumWeldPolarModulusCm3,
    "drumWeld.torsionStress": drumWeldTorsionStress,
    "drumWeld.shearStress": drumWeldShearStress,
    "drumWeld.combinedStress": drumWeldCombinedStress,
  });
  checks.push({
    id: `${which}.drumWeld.stress`,
    label: "Tambur Kaynağı Gerilmesi",
    required: drumWeldCombinedStress * KGF_TO_MPA, provided: inp.drumWeldAllowable,
    unit: "MPa", op: ">=",
    computedSide: "required",
    pass: inp.drumWeldAllowable >= drumWeldCombinedStress * KGF_TO_MPA,
    kind: "firma", severity: "engelleyici",
  });

  // --- 2.2.5 Mil kaynağı ---------------------------------------------------
  const shaftWeldLengthCm = Math.PI * inp.shaftD1Cm;
  const shaftWeldThroatAreaCm2 = inp.shaftWeldThicknessCm * shaftWeldLengthCm;
  const shaftWeldInnerDiaMm = inp.shaftD1Cm * 10;
  const shaftWeldOuterDiaMm = shaftWeldInnerDiaMm + 2 * inp.shaftWeldThicknessCm * 10;
  const shaftWeldAreaCm2 =
    (Math.PI * ((shaftWeldOuterDiaMm / 2) ** 2 - (shaftWeldInnerDiaMm / 2) ** 2)) / 100;
  const shaftWeldPolarModulusCm3 =
    (Math.PI * ((shaftWeldOuterDiaMm / 10) ** 4 - (shaftWeldInnerDiaMm / 10) ** 4)) / 32;
  const shaftWeldShearStress = maxReactionKg / shaftWeldAreaCm2;
  Object.assign(cells, {
    "shaftWeld.length": shaftWeldLengthCm,
    "shaftWeld.throatArea": shaftWeldThroatAreaCm2,
    "shaftWeld.outerDia": shaftWeldOuterDiaMm,
    "shaftWeld.area": shaftWeldAreaCm2,
    "shaftWeld.polarModulus": shaftWeldPolarModulusCm3,
    "shaftWeld.shearStress": shaftWeldShearStress,
  });
  checks.push({
    id: `${which}.shaftWeld.stress`,
    label: "Mil Kaynağı Gerilmesi",
    required: shaftWeldShearStress * KGF_TO_MPA, provided: inp.shaftWeldAllowable,
    unit: "MPa", op: ">=",
    computedSide: "required",
    pass: inp.shaftWeldAllowable >= shaftWeldShearStress * KGF_TO_MPA,
    kind: "firma", severity: "engelleyici",
  });

  // --- 2.2.6 Tambur rulmanı ------------------------------------------------
  // Tambur yatağı rulmanı, TAMBUR YATAĞI tarafı reaksiyonunu taşır.
  const bearingRadialKn = reactionBearingKg * 0.00981;
  const bearingAxialKn = 0.1 * bearingRadialKn;
  const bearingEqStaticKn = bearingRadialKn + bearingAxialKn * inp.bearingFactorY1;
  const bearingEqDynamicKn = bearingRadialKn + inp.bearingFactorY2 * bearingAxialKn;
  const bearingStaticSafety = sel.bearingStatC0Kn / bearingEqStaticKn;
  const drumRpm =
    (liftSpeedMpm * mechanicalAdvantage) / (sel.drumDiaMm / 1000) / Math.PI;
  const bearingLifeHours =
    (1000000 / (60 * drumRpm)) * (sel.bearingDynCKn / bearingEqDynamicKn) ** (10 / 3);
  const life = mechanismLife(usage);
  const requiredLifeMin = life.min ?? 0;
  const requiredLifeMax = life.max;
  Object.assign(cells, {
    "drumBearing.radialLoad": bearingRadialKn,
    "drumBearing.axialLoad": bearingAxialKn,
    "drumBearing.equivalentStatic": bearingEqStaticKn,
    "drumBearing.equivalentDynamic": bearingEqDynamicKn,
    "drumBearing.staticSafety": bearingStaticSafety,
    "drum.rpm": drumRpm,
    "drumBearing.lifeHours": bearingLifeHours,
    "drumBearing.requiredLifeMin": requiredLifeMin,
    ...(requiredLifeMax !== null ? { "drumBearing.requiredLifeMax": requiredLifeMax } : {}),
  });
  checks.push({
    id: `${which}.bearing.life`,
    label: "Tambur Rulmanı Ömrü",
    required: requiredLifeMin, provided: bearingLifeHours, unit: "saat", op: ">=",
    computedSide: "provided",
    pass: bearingLifeHours >= requiredLifeMin,
    standard: "FEM 1.001 T.2.1.3.2",
    kind: "standart", severity: "engelleyici",
  });
  checks.push({
    id: `${which}.bearing.static`,
    label: "Rulman Statik Emniyeti",
    required: 1, provided: bearingStaticSafety, unit: "-", op: ">=",
    computedSide: "provided",
    pass: bearingStaticSafety >= 1,
    kind: "uretici", severity: "engelleyici",
  });

  // --- 2.3 Redüktör (seçim ve kontroller) ----------------------------------
  const requiredRatio = sel.motorRpm / drumRpm;
  const gearboxActualSafety = sel.gearboxNominalTorqueKnm / drumTorquePerDrumKnm;
  const ratioDeviationPct = (100 * (sel.gearboxRatio - requiredRatio)) / requiredRatio;
  const actualLiftSpeedMpm =
    ((sel.motorRpm / sel.gearboxRatio) * Math.PI * (sel.drumDiaMm / 1000)) / mechanicalAdvantage;
  // Redüktör çıkış miline gelen radyal yük REDÜKTÖR tarafı reaksiyonudur.
  const gearboxRadialKn = (reactionGearboxKg * 9.81) / 1000;
  Object.assign(cells, {
    "drum.radius": drumRadiusM,
    "rope.loadKn": ropeLoadKn,
    "drum.torque": drumTorqueKnm,
    "drum.torquePerDrum": drumTorquePerDrumKnm,
    "gearbox.requiredTorque": requiredGearboxTorqueKnm,
    "gearbox.requiredRatio": requiredRatio,
    "gearbox.actualSafety": gearboxActualSafety,
    "gearbox.ratioDeviation": ratioDeviationPct,
    "gearbox.actualLiftSpeed": actualLiftSpeedMpm,
    "gearbox.radialLoad": gearboxRadialKn,
  });
  checks.push({
    id: `${which}.gearbox.torque`,
    label: "Redüktör Tork Kapasitesi",
    required: requiredGearboxTorqueKnm, provided: sel.gearboxNominalTorqueKnm,
    unit: "kNm", op: ">=",
    computedSide: "required",
    pass: sel.gearboxNominalTorqueKnm >= requiredGearboxTorqueKnm,
    kind: "uretici", severity: "engelleyici",
  });
  checks.push({
    id: `${which}.gearbox.ratio`,
    label: "Çevrim Oranı Sapması",
    min: -10, max: 5, provided: ratioDeviationPct, unit: "%", op: "range",
    pass: ratioDeviationPct <= 5 && ratioDeviationPct >= -10,
    // Band bir tasarım kabulüdür: dışına çıkmak kaldırma hızını beyan edilenden
    // saptırır, taşıyıcı bir yetersizlik yaratmaz.
    kind: "firma", severity: "uyari",
  });
  checks.push({
    id: `${which}.gearbox.radial`,
    label: "Redüktör Radyal Yük",
    required: gearboxRadialKn, provided: sel.gearboxAllowedRadialKn, unit: "kN", op: ">=",
    computedSide: "required",
    pass: sel.gearboxAllowedRadialKn >= gearboxRadialKn,
    kind: "uretici", severity: "engelleyici",
  });

  // --- 2.4 Motor -----------------------------------------------------------
  const gearboxOutputTorqueNm = drumTorquePerDrumKnm * 1000;
  const gearboxEfficiency = inp.stageEfficiency ** inp.reducerStages;
  const motorInputTorqueNm =
    gearboxOutputTorqueNm / (sel.gearboxRatio * gearboxEfficiency);
  const requiredPowerKw = (motorInputTorqueNm * sel.motorRpm) / 9550;
  const requiredPowerAdjustedKw = inp.tempFactor * requiredPowerKw;
  const powerPerMotorKw = requiredPowerAdjustedKw / inp.motorDivisor;
  const installedPowerKw = sel.motorPowerKw * sel.motorCount;
  Object.assign(cells, {
    "gearbox.outputTorque": gearboxOutputTorqueNm,
    "gearbox.efficiency": gearboxEfficiency,
    "motor.inputTorque": motorInputTorqueNm,
    "motor.requiredPower": requiredPowerKw,
    "motor.adjustedPower": requiredPowerAdjustedKw,
    "motor.powerPerMotor": powerPerMotorKw,
    "motor.installedPower": installedPowerKw,
  });
  checks.push({
    id: `${which}.motor.power`,
    label: "Motor Gücü",
    required: requiredPowerAdjustedKw, provided: installedPowerKw, unit: "kW", op: ">=",
    computedSide: "required",
    pass: installedPowerKw >= requiredPowerAdjustedKw,
    standard: "CMAA 70 5.2.9.1.1",
    kind: "standart", severity: "engelleyici",
  });

  // --- 2.5 Fren ------------------------------------------------------------
  // Fren de motor–redüktör kaplini de motor miline oturur: ikisinin gördüğü
  // tork aynı büyüklüktür (motor giriş torku / motor adedi).
  const motorShaftTorqueNm = motorInputTorqueNm / sel.motorCount;
  const requiredBrakeTorqueNm = motorShaftTorqueNm * inp.brakeServiceFactor;
  const brakeActualSafety = sel.brakeTorqueNm / motorShaftTorqueNm;
  Object.assign(cells, {
    "motor.shaftTorque": motorShaftTorqueNm,
    "brake.requiredTorque": requiredBrakeTorqueNm,
    "brake.actualSafety": brakeActualSafety,
    "brake.combinedSafety": sel.brakeQty * brakeActualSafety,
  });
  checks.push({
    id: `${which}.brake.torque`,
    label: "Fren Torku",
    required: requiredBrakeTorqueNm, provided: sel.brakeTorqueNm, unit: "Nm", op: ">=",
    computedSide: "required",
    pass: sel.brakeTorqueNm >= requiredBrakeTorqueNm,
    // Gerekli tork, firma servis faktörüyle ölçeklenir; sağlanmadan yayınlanamaz.
    kind: "firma", severity: "engelleyici",
  });

  // --- 2.6 Motor-redüktör kaplini ------------------------------------------
  const requiredMotorCouplingTorqueNm = motorShaftTorqueNm * inp.motorCouplingServiceFactor;
  const couplingShaftDiaMm = Math.max(sel.motorShaftMm, sel.gearboxInputShaftMm);
  const motorCouplingActualSafety = sel.motorCouplingTorqueNm / motorShaftTorqueNm;
  Object.assign(cells, {
    "motorCoupling.requiredTorque": requiredMotorCouplingTorqueNm,
    "motorCoupling.shaftDia": couplingShaftDiaMm,
    "motorCoupling.actualSafety": motorCouplingActualSafety,
  });
  checks.push({
    id: `${which}.motorCoupling.torque`,
    label: "Motor Kaplini Tork Kapasitesi",
    required: requiredMotorCouplingTorqueNm, provided: sel.motorCouplingTorqueNm,
    unit: "Nm", op: ">=",
    computedSide: "required",
    pass: sel.motorCouplingTorqueNm >= requiredMotorCouplingTorqueNm,
    kind: "uretici", severity: "engelleyici",
  });
  checks.push({
    id: `${which}.motorCoupling.bore`,
    label: "Motor Kaplini Delik Çapı",
    required: couplingShaftDiaMm, provided: sel.motorCouplingDmaxMm, unit: "mm", op: ">=",
    // İki taraf da katalogdan gelir; TALEP tarafı burada türetilir (motor mili ile
    // redüktör giriş mili çaplarının büyüğü), sınır ise kaplinin delik kapasitesidir.
    computedSide: "required",
    pass: sel.motorCouplingDmaxMm >= couplingShaftDiaMm,
    kind: "uretici", severity: "engelleyici",
  });

  // --- 2.7 Tambur kaplini --------------------------------------------------
  const drumCouplingDesignTorqueNm = (drumTorqueKnm * 1000) / inp.drumCouplingDivisor;
  const requiredDrumCouplingTorqueNm =
    drumCouplingDesignTorqueNm * inp.drumCouplingServiceFactor;
  const requiredDrumCouplingRadialN = reactionGearboxKg * 9.81;
  const drumCouplingShaftDiaMm = sel.gearboxOutputShaftMm;
  const drumCouplingActualSafety = sel.drumCouplingTorqueNm / drumCouplingDesignTorqueNm;
  Object.assign(cells, {
    "drumCoupling.designTorque": drumCouplingDesignTorqueNm,
    "drumCoupling.requiredTorque": requiredDrumCouplingTorqueNm,
    "drumCoupling.requiredRadial": requiredDrumCouplingRadialN,
    "drumCoupling.shaftDia": drumCouplingShaftDiaMm,
    "drumCoupling.actualSafety": drumCouplingActualSafety,
  });
  checks.push({
    id: `${which}.drumCoupling.torque`,
    label: "Tambur Kaplini Tork Kapasitesi",
    required: requiredDrumCouplingTorqueNm, provided: sel.drumCouplingTorqueNm,
    unit: "Nm", op: ">=",
    computedSide: "required",
    pass: sel.drumCouplingTorqueNm >= requiredDrumCouplingTorqueNm,
    kind: "uretici", severity: "engelleyici",
  });
  checks.push({
    id: `${which}.drumCoupling.radial`,
    label: "Tambur Kaplini Radyal Yük",
    required: requiredDrumCouplingRadialN, provided: sel.drumCouplingRadialN,
    unit: "N", op: ">=",
    computedSide: "required",
    pass: sel.drumCouplingRadialN >= requiredDrumCouplingRadialN,
    kind: "uretici", severity: "engelleyici",
  });
  checks.push({
    id: `${which}.drumCoupling.bore`,
    label: "Tambur Kaplini Delik Çapı",
    required: drumCouplingShaftDiaMm, provided: sel.drumCouplingDmaxMm, unit: "mm", op: ">=",
    // İki taraf da katalogdan gelir; TALEP redüktör çıkış mili çapıdır (kaplinin
    // karşılaması gereken), sınır ise kaplinin en büyük delik çapıdır.
    computedSide: "required",
    pass: sel.drumCouplingDmaxMm >= drumCouplingShaftDiaMm,
    kind: "uretici", severity: "engelleyici",
  });

  const values: HoistValues = {
    mechanicalAdvantage,
    ropeEfficiency,
    loadKg: hoistedLoadKg,
    totalLoadKg,
    requiredRopeSafety,
    ropeLoadKg,
    requiredBreakingKg,
    actualBreakingKg,
    actualRopeSafety,
    drumCoefficientH,
    minDrumDiaMm,
    groovePitchMm,
    drumBearingStress,
    drumBendingStress,
    drumCombinedStress,
    drumAllowable,
    requiredGrooves,
    requiredGrooveLengthMm,
    drumShaftSpanCm: geo.spanCm,
    drumWeightArmCm: geo.weightArmCm,
    ropeLoadPositionsCm: govBearing.xs,
    ropeLoadCount,
    ropeLoadPerPointKg: ropePerPoint,
    reactionGearboxKg,
    reactionBearingKg,
    reactionAKg: reactionGearboxKg,
    reactionBKg: reactionBearingKg,
    momentGearboxKgCm,
    momentBearingKgCm,
    shaftGoverningSide: governingSide,
    shaftMomentKgCm,
    shaftBendingStress,
    shaftShearStress,
    shaftCombinedStress,
    shaftAllowables: shaftAllow,
    drumWeldCombinedStress,
    shaftWeldStress: shaftWeldShearStress,
    bearingRadialKn,
    bearingAxialKn,
    bearingEqStaticKn,
    bearingEqDynamicKn,
    bearingStaticSafety,
    drumRpm,
    bearingLifeHours,
    requiredLifeMin,
    requiredLifeMax,
    drumTorqueKnm: drumTorquePerDrumKnm,
    requiredGearboxTorqueKnm,
    requiredRatio,
    ratioDeviationPct,
    actualLiftSpeedMpm,
    gearboxActualSafety,
    gearboxRadialKn,
    reducerEfficiency: gearboxEfficiency,
    motorInputTorqueNm,
    requiredPowerKw,
    requiredPowerAdjustedKw,
    installedPowerKw,
    brakeShaftTorqueNm: motorShaftTorqueNm,
    requiredBrakeTorqueNm,
    brakeActualSafety,
    requiredMotorCouplingTorqueNm,
    couplingShaftDiaMm,
    motorCouplingActualSafety,
    requiredDrumCouplingTorqueNm,
    requiredDrumCouplingRadialN,
    drumCouplingActualSafety,
  };

  return { values, checks, cells };
}
