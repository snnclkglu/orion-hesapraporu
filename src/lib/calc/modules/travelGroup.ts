// Yürütme grubu hesabı — araba ve köprü yürütme mekanizmalarının tek
// parametrik modülü. Hesap yöntemi FEM 1.001 (tekerlek basıncı, rulman ömrü),
// CMAA 70 (yürütme gücü, mil emniyet gerilmeleri) ve ilgili katalog
// kriterlerine dayanır.
//
// Sonuçlar `cells` haritasında SEMANTİK ANAHTARLARLA (`<blok>.<büyüklük>`)
// yer alır; sunum katmanı ve raporlar bu anahtarlarla okur.
//
// Varyant farkları (mühendislik gerekçeleriyle):
//   · Köprüde tekerlek yükleri arabanın yanaşma eksantrikliğiyle hesaplanır;
//     arabada yük dört tekere eşit paylaştırılır.
//   · Yürütme freni yalnız köprü mekanizmasında hesaplanır.
//   · Köprü tamponunda çarpma hızı olarak nominal hızın %70'i alınır
//     (köprü kütlesi büyük olduğundan tam hızda çarpışma kabul edilmez).
//   · Çevrim oranı sapma bandı arabada +10/−5 %, köprüde +5/−10 %'dir:
//     köprüde hız fazlalığı raylı sistemde daha kritik olduğundan üst sınır
//     dardır.
//
// Birimler: t, kg, mm, cm, cm³, kg/cm², N/mm², kN, Nm, kNm, kW, kJ,
// m/dak, d/dak, saat.

import { solveBeam } from "../beam";
import { mechanismLife, shaftMaterialAllowables } from "../coefficients";
import { shaftStress } from "../shaftStress";
import { c1Factor, RAILS } from "../tables";
import type {
  AnyCheck,
  MechanismClass,
  ModuleResult,
  TechnicalSpecs,
  UsageClass,
} from "../types";

/**
 * Yürütme grubu varyantı. Ana araba, yardımcı araba ve monoray arabaları aynı
 * araba fiziğini kullanır; köprü ayrı dallanır.
 */
export type TravelWhich =
  | "trolley"
  | "auxTrolley"
  | "mono1Trolley"
  | "mono2Trolley"
  | "bridge";

/** Modüller arası bağımlılıklar — modül saf kalsın diye parametre olarak alınır */
export interface TravelDeps {
  /** Kanca bloğu + halat ağırlığı [t] (ilgili kaldırma grubundan gelir) */
  hookEquipmentT: number;
  /** Köprünün taşıdığı araba ağırlığı [t] — köprü varyantında kullanılır */
  trolleyWeightT: number;
}

/** Kullanıcı girdileri (tasarım kabulleri) */
export interface TravelInputs {
  minApproachM: number;         // minimum araba yanaşması [m] (sadece köprü)
  wheelCount: number;           // tekerlek adedi
  /**
   * Bir motorun tahrik ettiği teker sayısı. Yürütmede genellikle her motor tek
   * tekeri döndürür; arabalarda tek motor bir mil üzerinden İKİ tekeri birden
   * tahrik edebilir. Tahrikli teker sayısı = motor adedi × bu değerdir ve ana
   * kiriş yatay yük hesabına (sürtünmeyle aktarılabilen çekme kuvveti) girer.
   */
  wheelsPerMotor: number;
  shaftSpanACm: number;         // teker mili mesnet ölçüsü a [cm]
  shaftSpanBCm: number;         // teker mili ölçüsü b [cm] (gösterim)
  shaftDiaCm: number;           // teker mili çapı [cm]
  stressConcFactor: number;     // gerilme yığılması katsayısı
  bearingCount: number;         // teker başına rulman adedi
  bearingFactorY0: number;      // eşdeğer statik yük katsayısı Y0
  bearingFactorY1: number;      // eşdeğer dinamik yük katsayısı Y1
  applicationClass: string;     // uygulama sınıfı (H/O/Y, gösterim; sadece köprü)
  serviceFactorKs: number;      // Ks servis faktörü (CMAA 70)
  accelTorqueFactorKt: number;  // Kt ivmelenme tork faktörü (CMAA 70)
  reducerStages: number;        // redüktör kademe sayısı
  accelerationMs2: number;      // ivme a [m/s²]
  tempFactor: number;           // ortam sıcaklığı düzeltme faktörü
  /** Sıcaklık faktörü otomatik: ortam sıcaklığı üst sınırından türetilir. */
  tempFactorAuto?: boolean;
  motorCalcCount: number;       // gücün bölüşüldüğü motor adedi
  gearboxServiceFactor: number; // redüktör emniyet (servis) katsayısı
  brakeServiceFactor: number;   // fren emniyet katsayısı (sadece köprü)
  motorCouplingServiceFactor: number; // motor kaplini emniyet katsayısı
  wheelCouplingServiceFactor: number; // teker kaplini emniyet katsayısı
  bufferApproachM: number;      // tampon hesabında araba yanaşması [m] (sadece köprü)
}

/** Katalog seçimleri — mühendisin seçtiği bileşenler */
export interface TravelSelections {
  railCode: string;             // ray tipi (ray tablosu anahtarı)
  wheelMaterial: string;
  wheelTensileNmm2: number;     // teker malzemesi çekme dayanımı [N/mm²]
  wheelDiaMm: number;           // tekerlek çapı [mm]
  shaftMaterial: string;        // teker mili malzemesi
  bearingType: string;
  bearingCode: string;
  bearingDynCKn: number;        // dinamik yük sayısı C [kN]
  bearingStatC0Kn: number;      // statik yük sayısı C0 [kN]
  motorBrand: string;
  motorPowerKw: number;
  motorRpm: number;
  motorCount: number;
  motorShaftMm: number;
  gearboxModel: string;
  gearboxRatio: number;
  gearboxOutputTorqueKnm: number;
  gearboxInputShaftText: string;
  gearboxOutputShaftMm: number;
  brakeBrand: string;           // yürütme freni (sadece köprü)
  brakeTorqueNm: number;
  brakeWheelDiaMm: number;
  /** Arabada kapline bağlanan motor mili ayrı girilir; köprüde motor mili çapı
   *  doğrudan kullanılır. */
  couplingMotorShaftMm: number;
  motorCouplingBrand: string;
  motorCouplingModel: string;
  motorCouplingTorqueNm: number;
  motorCouplingDmaxMm: number;
  wheelShaftDiaMm: number;      // kapline bağlanan teker mili çapı [mm]
  wheelCouplingBrand: string;
  wheelCouplingModel: string;
  wheelCouplingTorqueNm: number;
  wheelCouplingDmaxMm: number;
  bufferModel: string;
  bufferStrokeMm: number;
  bufferEnergyKj: number;
  bufferLoadKn: number;
}

export interface TravelValues {
  // Tahrik
  /** Motor adedi × motor başına teker; ana kiriş yatay yük hesabına girer */
  drivenWheels: number;
  // Ağırlıklar / tekerlekler
  craneWeightT: number | null;  // toplam vinç ağırlığı (sadece köprü)
  maxWheelLoadKg: number;
  minWheelLoadKg: number;
  avgWheelLoadKg: number;
  railHeadWidthMm: number;
  wheelRpm: number;
  c1: number;
  c2: number;
  limitPressure: number | string;
  actualPressure: number;
  allowedPressure: number;
  // Teker mili
  reactionAKg: number;
  reactionBKg: number;
  maxMomentKgCm: number;
  sectionModulusCm3: number;
  shaftBendingStress: number;
  shaftShearStress: number;
  shaftCombinedStress: number;
  shaftAllowables: { bending: number; shear: number; combined: number };
  // Rulman
  bearingRadialKn: number;
  bearingAxialKn: number;
  bearingEqStaticKn: number;
  bearingEqDynamicKn: number;
  bearingStaticSafety: number;
  bearingLifeHours: number;
  requiredLifeMin: number;
  requiredLifeMax: number | null;
  // Motor
  totalWeightKg: number;
  designWeightTons: number;
  actualSpeedMpm: number;
  startupTimeS: number;
  frictionFactor: number;
  reducerEfficiency: number;
  rotationInertiaFactor: number;
  accelFactorKa: number;
  requiredPowerKw: number;
  requiredMaxPowerKw: number;
  requiredPowerPerMotorKw: number;
  installedPowerKw: number;
  // Redüktör
  requiredRatio: number;
  ratioDeviationPct: number;
  requiredInputTorqueNm: number;
  nominalOutputTorqueNm: number;
  requiredMinOutputTorqueNm: number;
  gearboxActualSafety: number;
  // Fren (sadece köprü)
  requiredBrakeTorqueNm: number | null;
  // Kaplinler
  requiredMotorCouplingTorqueNm: number;
  motorCouplingShaftMm: number;
  motorCouplingSafety: number;
  requiredWheelCouplingTorqueNm: number;
  wheelCouplingSafety: number;
  // Tampon
  collisionLoadT: number;
  impactEnergyKj: number;
  driveLoadPerMotorN: number;
  totalDriveLoadN: number;
  bufferDriveLoadN: number;
  totalEnergyKj: number;
  bufferForceKn: number;
}

/**
 * Mekanizma katsayısı c2 — FEM 1.001 T.4.2.4.1.5.
 * Yürütme mekanizmasının KENDİ grup sınıfı ile okunur.
 */
function mechanismFactorC2(mech: MechanismClass): number {
  if (mech === "M1" || mech === "M2" || mech === "M3" || mech === "M4") return 1.12;
  if (mech === "M5") return 1;
  if (mech === "M6") return 0.9;
  return 0.8; // M7 / M8
}

/** Limit yüzey basıncı PL [N/mm²] — FEM 1.001 T.4.2.4.1.3 */
function wheelLimitPressure(tensileNmm2: number): number | string {
  if (tensileNmm2 >= 500 && tensileNmm2 < 600) return 5;
  if (tensileNmm2 >= 600 && tensileNmm2 < 700) return 5.6;
  if (tensileNmm2 >= 700 && tensileNmm2 < 800) return 6.5;
  if (tensileNmm2 >= 800 && tensileNmm2 < 900) return 7.2;
  if (tensileNmm2 >= 900 && tensileNmm2 < 1000) return 7.8;
  if (tensileNmm2 >= 1000) return 8.5;
  // Tablo 500 N/mm² altını kapsamaz: bu dayanımdaki bir teker malzemesi
  // ray temas basıncı için uygun değildir.
  return "Tanımsız (çekme dayanımı < 500 N/mm²)";
}

/**
 * Yuvarlanma sürtünme katsayısı f [lb/ton] — CMAA 70 T.5.2.9.1.2.1-D.
 *
 * Tablo çap kademeleriyle verilir; burada kademe SINIRLARI kullanılır, böylece
 * tabloda birebir yer almayan (ör. 1000 mm ve üzeri) standart teker çapları da
 * tanımlı kalır. Tabloda yer alan çaplarda değer birebir aynıdır.
 */
function travelFrictionFactor(wheelDiaMm: number): number {
  if (wheelDiaMm <= 200) return 16;
  if (wheelDiaMm <= 500) return 15;
  return 12;
}

/**
 * Bir yürütme grubunun teknik özelliklerden okunan büyüklükleri.
 *
 * Ağırlıklar artık modül girdisi değil vincin teknik özelliğidir: ana araba,
 * yardımcı araba ve köprü ağırlıkları tek yerde girilir, tüm yürütme grupları
 * buradan okur. Grup için değer tanımlı değilse ana grubun değeri kullanılır.
 */
export interface TravelSpecView {
  speedMpm: number;
  mechanismClass: MechanismClass;
  usageClass: UsageClass;
  /** Bu grubun kaldırdığı yük [t] */
  capacityT: number;
  /** Bu grubun kendi ağırlığı [t] (köprüde köprünün taşıdığı araba ağırlığı) */
  trolleyWeightT: number;
}

const posOr = (v: number | undefined, fallback: number): number =>
  typeof v === "number" && Number.isFinite(v) && v > 0 ? v : fallback;

export function travelSpecView(
  specs: TechnicalSpecs,
  which: TravelWhich,
  deps: TravelDeps
): TravelSpecView {
  switch (which) {
    case "auxTrolley":
      return {
        speedMpm: posOr(specs.auxTrolleySpeedMpm, specs.trolleySpeedMpm),
        mechanismClass: specs.auxTrolleyMechanismClass ?? specs.trolleyMechanismClass,
        usageClass: specs.auxTrolleyUsageClass ?? specs.trolleyUsageClass,
        capacityT: specs.auxCapacityT,
        trolleyWeightT: posOr(specs.auxTrolleyWeightT, specs.mainTrolleyWeightT),
      };
    case "mono1Trolley":
      return {
        speedMpm: posOr(specs.mono1TrolleySpeedMpm, specs.trolleySpeedMpm),
        mechanismClass: specs.mono1TrolleyMechanismClass ?? specs.trolleyMechanismClass,
        usageClass: specs.mono1TrolleyUsageClass ?? specs.trolleyUsageClass,
        capacityT: posOr(specs.mono1CapacityT, specs.mainCapacityT),
        trolleyWeightT: posOr(specs.mono1TrolleyWeightT, specs.mainTrolleyWeightT),
      };
    case "mono2Trolley":
      return {
        speedMpm: posOr(specs.mono2TrolleySpeedMpm, specs.trolleySpeedMpm),
        mechanismClass: specs.mono2TrolleyMechanismClass ?? specs.trolleyMechanismClass,
        usageClass: specs.mono2TrolleyUsageClass ?? specs.trolleyUsageClass,
        capacityT: posOr(specs.mono2CapacityT, specs.mainCapacityT),
        trolleyWeightT: posOr(specs.mono2TrolleyWeightT, specs.mainTrolleyWeightT),
      };
    case "bridge":
      return {
        speedMpm: specs.bridgeSpeedMpm,
        mechanismClass: specs.bridgeMechanismClass,
        usageClass: specs.bridgeUsageClass,
        capacityT: specs.mainCapacityT,
        // Köprü tekerlek yükü, açıklık üzerindeki ANA arabanın konumundan çıkar.
        trolleyWeightT: posOr(deps.trolleyWeightT, specs.mainTrolleyWeightT),
      };
    default:
      return {
        speedMpm: specs.trolleySpeedMpm,
        mechanismClass: specs.trolleyMechanismClass,
        usageClass: specs.trolleyUsageClass,
        capacityT: specs.mainCapacityT,
        trolleyWeightT: specs.mainTrolleyWeightT,
      };
  }
}

export function computeTravelGroup(
  specs: TechnicalSpecs,
  which: TravelWhich,
  inp: TravelInputs,
  sel: TravelSelections,
  deps: TravelDeps
): ModuleResult<TravelValues> {
  const cells: Record<string, number | string> = {};
  const checks: AnyCheck[] = [];
  /** Hesaplanan büyüklüğü semantik anahtarıyla yayımlar. */
  const set = (key: string, value: number | string) => {
    cells[key] = value;
  };

  const isTrolley = which !== "bridge";
  const view = travelSpecView(specs, which, deps);
  const speedMpm = view.speedMpm;
  // Yürütme mekanizmasının kendi FEM sınıfları — kaldırma grubununki DEĞİL.
  const mechanismClass: MechanismClass = view.mechanismClass;
  const usageClass: UsageClass = view.usageClass;

  const capacityT = view.capacityT;
  const trolleyWeightT = view.trolleyWeightT;
  const bridgeWeightT = specs.bridgeWeightT;

  // --- Tahrik ---------------------------------------------------------------
  // Tahrikli teker sayısı = motor adedi × motor başına tahrik edilen teker.
  // Tekerlek adedini aşamaz. Ana kirişin yatay yük hesabı bu sayıyı kullanır.
  const drivenWheels = Math.min(
    inp.wheelCount,
    Math.max(1, Math.round(sel.motorCount * Math.max(1, inp.wheelsPerMotor)))
  );
  set("drive.wheelsPerMotor", Math.max(1, inp.wheelsPerMotor));
  set("drive.drivenWheels", drivenWheels);

  // --- Ağırlıklar ----------------------------------------------------------
  let craneWeightT: number | null = null;
  if (!isTrolley) {
    craneWeightT = bridgeWeightT + trolleyWeightT;
    set("weight.crane", craneWeightT);
    set("weight.bridgeTotal", bridgeWeightT);
  }
  set("weight.trolley", trolleyWeightT);

  // --- Tekerlekler ---------------------------------------------------------
  let maxWheelLoad: number; // maksimum tekerlek yükü [kg]
  let minWheelLoad: number; // minimum tekerlek yükü [kg]
  if (isTrolley) {
    // Araba: kapasite + kanca donanımı + araba ağırlığı tüm tekerlere eşit dağılır.
    maxWheelLoad = ((trolleyWeightT + capacityT + deps.hookEquipmentT) / inp.wheelCount) * 1000;
    minWheelLoad = ((trolleyWeightT + deps.hookEquipmentT) / inp.wheelCount) * 1000;
  } else {
    // Köprü: araba yanaşma eksantrikliği — yük, arabanın açıklık üzerindeki
    // konumuna göre iki başkirişe paylaştırılır.
    const span = specs.spanM;
    const halfBridge = bridgeWeightT / 2;
    maxWheelLoad =
      (((capacityT + trolleyWeightT) * ((span - inp.minApproachM) / span) + halfBridge) * 1000) /
      (inp.wheelCount / 2);
    minWheelLoad =
      ((trolleyWeightT * (inp.minApproachM / span) + halfBridge) * 1000) / (inp.wheelCount / 2);
  }
  // Yorulma/basınç hesabında kullanılan eşdeğer ortalama tekerlek yükü.
  const meanWheelLoad = (2 * maxWheelLoad + minWheelLoad) / 3;
  set("wheel.maxLoad", maxWheelLoad);
  set("wheel.minLoad", minWheelLoad);
  set("wheel.meanLoad", meanWheelLoad);

  const railHeadWidth = RAILS[sel.railCode]?.headWidth ?? Number.NaN;
  set("rail.headWidth", railHeadWidth);
  const wheelRpm = speedMpm / (sel.wheelDiaMm / 1000) / Math.PI;
  set("wheel.rpm", wheelRpm);
  const c1 = c1Factor(sel.wheelDiaMm, speedMpm) ?? Number.NaN;
  set("wheel.speedFactor", c1);
  const c2 = mechanismFactorC2(mechanismClass);
  set("wheel.mechanismFactor", c2);
  const limitPressure = wheelLimitPressure(sel.wheelTensileNmm2);
  set("wheel.limitPressure", limitPressure);
  const actualPressure = (meanWheelLoad * 9.81) / railHeadWidth / sel.wheelDiaMm;
  set("wheel.contactPressure", actualPressure);
  const limitPressureNum = typeof limitPressure === "number" ? limitPressure : Number.NaN;
  const allowedPressure = limitPressureNum * c1 * c2;
  set("wheel.allowablePressure", allowedPressure);
  checks.push({
    id: `${which}.wheel.pressure`,
    label: "Tekerlek Yüzey Basıncı (PL·c1·c2)",
    required: actualPressure, provided: allowedPressure, unit: "N/mm²", op: ">=",
    // Gerçekleşen temas basıncı HESAPTAN, sınır ise teker malzemesinin PL tablo
    // değerinin hız (c1) ve mekanizma (c2) katsayılarıyla ölçeklenmesinden çıkar.
    computedSide: "required",
    pass: allowedPressure >= actualPressure,
    standard: "FEM 1.001 4.2.4.1",
    kind: "standart", severity: "engelleyici",
  });

  // --- Teker Mili ----------------------------------------------------------
  // Model: teker mili iki rulman arasında basit kirişdir, tekerlek yükü
  // açıklığın ortasına etkir. Mesnet aralığı 2·a olduğundan mesnet tepkileri
  // Pmax/2, ortadaki eğilme momenti (Pmax/2)·a olur.
  const shaftSupportSpanCm = 2 * inp.shaftSpanACm;
  const shaftBeam = solveBeam({
    lengthCm: shaftSupportSpanCm,
    supportACm: 0,
    supportBCm: shaftSupportSpanCm,
    pointLoads: [{ xCm: inp.shaftSpanACm, loadKg: maxWheelLoad, label: "Tekerlek Yükü" }],
  });
  const reactionA = shaftBeam.reactionAKg;
  const reactionB = shaftBeam.reactionBKg;
  const maxMoment = Math.abs(shaftBeam.maxMomentKgCm);
  set("shaft.reactionA", reactionA);
  set("shaft.reactionB", reactionB);
  set("shaft.maxMoment", maxMoment);
  // Kayma dağılımı ORTALAMA kabul edilir (τ = V/A): teker milinde kritik kesit
  // eğilme momentinin en büyük olduğu orta kesittir, kaymanın tepe yaptığı
  // tarafsız eksen ile çakışmaz.
  const shaftSection = shaftStress({
    momentKgCm: maxMoment,
    shearKg: Math.abs(shaftBeam.maxShearKg),
    bendingDiameterCm: inp.shaftDiaCm,
    shearDiameterCm: inp.shaftDiaCm,
    combined: "vonMises",
    shear: "ortalama",
  });
  // Gerilme yığılması katsayısı her iki gerilme bileşenini de ölçekler;
  // bileşke gerilme de aynı katsayıyla ölçeklenir.
  const sectionModulus = shaftSection.sectionModulusCm3;
  const bendingStress = shaftSection.bendingStress * inp.stressConcFactor;
  const shearStress = shaftSection.shearStress * inp.stressConcFactor;
  const combinedStress = shaftSection.combinedStress * inp.stressConcFactor;
  set("shaft.sectionModulus", sectionModulus);
  set("shaft.bendingStress", bendingStress);
  set("shaft.shearStress", shearStress);
  set("shaft.combinedStress", combinedStress);
  // Teker mili malzemesi 42CrMo4 / AISI 4140 ıslah çeliğidir; izin verilen
  // gerilmeler bu malzemenin CMAA 70 4.11.4.1 karşılıklarından alınır.
  const shaftAllow = shaftMaterialAllowables("4140");
  set("shaft.allowableBending", shaftAllow.bending);
  set("shaft.allowableShear", shaftAllow.shear);
  set("shaft.allowableCombined", shaftAllow.combined);
  checks.push({
    id: `${which}.shaft.stress`,
    label: "Teker Mili Bileşik Gerilmesi",
    required: combinedStress, provided: shaftAllow.combined, unit: "kg/cm²", op: ">=",
    computedSide: "required",
    pass: shaftAllow.combined >= combinedStress,
    standard: "CMAA 70 4.11.4.1",
    kind: "standart", severity: "engelleyici",
  });

  // --- Tekerlek Rulmanı ----------------------------------------------------
  const bearingRadial = (meanWheelLoad * 9.81) / 1000 / inp.bearingCount; // [kN]
  set("bearing.radialLoad", bearingRadial);
  // Yanal (kılavuzlama) kuvveti radyal yükün %10'u kabul edilir.
  const bearingAxial = 0.1 * bearingRadial;
  set("bearing.axialLoad", bearingAxial);
  const eqStatic = bearingRadial + bearingAxial * inp.bearingFactorY0;
  set("bearing.equivalentStatic", eqStatic);
  const eqDynamic = bearingRadial + inp.bearingFactorY1 * bearingAxial;
  set("bearing.equivalentDynamic", eqDynamic);
  const staticSafety = sel.bearingStatC0Kn / eqStatic;
  set("bearing.staticSafety", staticSafety);
  // Makaralı rulman ömür üsteli 10/3.
  const lifeHours = (1000000 / (60 * wheelRpm)) * (sel.bearingDynCKn / eqDynamic) ** (10 / 3);
  set("bearing.lifeHours", lifeHours);
  // Gerekli ömür, yürütme mekanizmasının KENDİ kullanım sınıfından okunur.
  const life = mechanismLife(usageClass);
  const requiredLifeMin = life.min ?? 0;
  set("bearing.requiredLifeMin", requiredLifeMin);
  if (life.max !== null) set("bearing.requiredLifeMax", life.max);
  checks.push({
    id: `${which}.bearing.life`,
    label: "Tekerlek Rulmanı Ömrü",
    required: requiredLifeMin, provided: lifeHours, unit: "saat", op: ">=",
    computedSide: "provided",
    pass: lifeHours >= requiredLifeMin,
    standard: "FEM 1.001 T.2.1.3.2",
    kind: "standart", severity: "engelleyici",
  });
  checks.push({
    id: `${which}.bearing.static`,
    label: "Rulman Statik Emniyeti",
    required: 1, provided: staticSafety, unit: "-", op: ">=",
    computedSide: "provided",
    pass: staticSafety >= 1,
    kind: "uretici", severity: "engelleyici",
  });

  // --- Yürütme Motoru (CMAA 70) --------------------------------------------
  const totalWeightKg = isTrolley
    ? (capacityT + deps.hookEquipmentT + trolleyWeightT) * 1000
    : (capacityT + trolleyWeightT + bridgeWeightT) * 1000;
  set("weight.moving", totalWeightKg);
  // Tasarım ağırlığı: hareket eden kütleye %10 pay eklenir.
  const designWeightTons = (totalWeightKg * 1.1) / 1000;
  set("weight.design", designWeightTons);
  // Gerçekleşen yürütme hızı seçilen motor devri ve redüktör oranından çıkar.
  const actualSpeed = (sel.motorRpm / sel.gearboxRatio) * Math.PI * (sel.wheelDiaMm / 1000);
  set("drive.actualSpeed", actualSpeed);
  const startupTime = actualSpeed / 60 / inp.accelerationMs2; // [sn]
  set("drive.startupTime", startupTime);
  const friction = travelFrictionFactor(sel.wheelDiaMm);
  set("drive.frictionFactor", friction);
  // Kademe başına %2 kayıp kabulü.
  const reducerEff = 0.98 ** inp.reducerStages;
  set("drive.reducerEfficiency", reducerEff);
  // CMAA 70 bağıntıları imperial birimlidir: ivme ft/s²'ye çevrilir.
  set("drive.accelerationFps2", inp.accelerationMs2 * 3.2808);
  const inertiaCr = 1.05 + (inp.accelerationMs2 * 3.28) / 7.5;
  set("drive.inertiaFactor", inertiaCr);
  const accelKa =
    (friction + (2000 * inp.accelerationMs2 * inertiaCr) / (9.81 * reducerEff)) /
    (inp.accelTorqueFactorKt * 33000);
  set("drive.accelFactor", accelKa);
  const requiredPower = designWeightTons * (actualSpeed * 3.28) * accelKa * inp.serviceFactorKs * 0.745;
  set("motor.requiredPower", requiredPower);
  const requiredMaxPower = inp.tempFactor * requiredPower;
  set("motor.requiredMaxPower", requiredMaxPower);
  set("motor.maxPowerPerMotor", requiredMaxPower / inp.motorCalcCount);
  const installedPower = sel.motorPowerKw * sel.motorCount;
  set("motor.installedPower", installedPower);
  checks.push({
    id: `${which}.motor.power`,
    label: "Yürütme Motoru Gücü",
    required: requiredMaxPower, provided: installedPower, unit: "kW", op: ">=",
    computedSide: "required",
    pass: installedPower >= requiredMaxPower,
    standard: "CMAA 70 5.2.9.1.2.1",
    kind: "standart", severity: "engelleyici",
  });

  // --- Yürütme Dişli Kutusu ------------------------------------------------
  const requiredRatio = sel.motorRpm / wheelRpm;
  set("gearbox.requiredRatio", requiredRatio);
  const ratioDeviation = (100 * (requiredRatio - sel.gearboxRatio)) / requiredRatio; // [%]
  set("gearbox.ratioDeviation", ratioDeviation);
  // Sapma bandı tasarım kabulüdür: köprüde hız fazlalığı raylı sistemde daha
  // kritik olduğundan üst sınır dar tutulur.
  const devMax = isTrolley ? 10 : 5;
  const devMin = isTrolley ? -5 : -10;
  const devOk = ratioDeviation <= devMax && ratioDeviation >= devMin;
  checks.push({
    id: `${which}.gearbox.ratio`,
    label: "Çevrim Oranı Sapması",
    min: devMin, max: devMax, provided: ratioDeviation, unit: "%", op: "range",
    pass: devOk,
    kind: "firma", severity: "uyari",
  });
  const powerPerMotor = requiredPower / sel.motorCount;
  set("motor.powerPerMotor", powerPerMotor);
  const requiredInputTorque = (9550 * powerPerMotor) / sel.motorRpm; // [Nm]
  set("gearbox.requiredInputTorque", requiredInputTorque);
  const nominalOutputTorque = requiredInputTorque * sel.gearboxRatio; // [Nm]
  set("gearbox.nominalOutputTorque", nominalOutputTorque);
  const requiredMinOutputTorque = nominalOutputTorque * inp.gearboxServiceFactor; // [Nm]
  set("gearbox.requiredOutputTorque", requiredMinOutputTorque);
  const gearboxSafety = sel.gearboxOutputTorqueKnm / (nominalOutputTorque / 1000);
  set("gearbox.actualSafety", gearboxSafety);
  checks.push({
    id: `${which}.gearbox.safety`,
    label: "Redüktör Emniyet Katsayısı",
    required: inp.gearboxServiceFactor, provided: gearboxSafety, unit: "-", op: ">=",
    computedSide: "provided",
    pass: gearboxSafety >= inp.gearboxServiceFactor,
    kind: "firma", severity: "engelleyici",
  });

  // --- Yürütme Freni (sadece köprü) ----------------------------------------
  let requiredBrakeTorque: number | null = null;
  if (!isTrolley) {
    requiredBrakeTorque = requiredInputTorque * inp.brakeServiceFactor;
    set("brake.requiredTorque", requiredBrakeTorque);
    checks.push({
      id: `${which}.brake.torque`,
      label: "Köprü Yürütme Freni Torku",
      required: requiredBrakeTorque, provided: sel.brakeTorqueNm, unit: "Nm", op: ">=",
      computedSide: "required",
      pass: sel.brakeTorqueNm >= requiredBrakeTorque,
      kind: "standart", severity: "engelleyici",
    });
  }

  // --- Motor — Dişli Kutusu Kaplini ----------------------------------------
  const requiredMotorCouplingTorque = requiredInputTorque * inp.motorCouplingServiceFactor;
  set("motorCoupling.requiredTorque", requiredMotorCouplingTorque);
  // Arabada kapline bağlanan mil ayrı girilir; köprüde motorun mil çapıdır.
  const motorCouplingShaft = isTrolley ? sel.couplingMotorShaftMm : sel.motorShaftMm;
  set("motorCoupling.shaftDia", motorCouplingShaft);
  const motorCouplingSafety = sel.motorCouplingTorqueNm / requiredMotorCouplingTorque;
  set("motorCoupling.actualSafety", motorCouplingSafety);
  checks.push({
    id: `${which}.motorCoupling.torque`,
    label: "Motor Kaplini Tork Kapasitesi",
    required: requiredMotorCouplingTorque, provided: sel.motorCouplingTorqueNm, unit: "Nm", op: ">=",
    computedSide: "required",
    pass: sel.motorCouplingTorqueNm >= requiredMotorCouplingTorque,
    kind: "firma", severity: "engelleyici",
  });
  checks.push({
    id: `${which}.motorCoupling.bore`,
    label: "Motor Kaplini Delik Çapı",
    required: motorCouplingShaft, provided: sel.motorCouplingDmaxMm, unit: "mm", op: ">=",
    // İki taraf da katalogdan gelir; TALEP kaplinin geçirmesi gereken motor mili
    // çapıdır, sınır ise kaplinin en büyük delik çapıdır.
    computedSide: "required",
    pass: sel.motorCouplingDmaxMm >= motorCouplingShaft,
    kind: "uretici", severity: "engelleyici",
  });

  // --- Teker — Dişli Kutusu Kaplini ----------------------------------------
  const requiredWheelCouplingTorque = nominalOutputTorque * inp.wheelCouplingServiceFactor;
  set("wheelCoupling.requiredTorque", requiredWheelCouplingTorque);
  // Emniyet oranı servis faktörsüz nominal çıkış momentine göre raporlanır.
  const wheelCouplingSafety = sel.wheelCouplingTorqueNm / nominalOutputTorque;
  set("wheelCoupling.actualSafety", wheelCouplingSafety);
  checks.push({
    id: `${which}.wheelCoupling.torque`,
    label: "Teker Kaplini Tork Kapasitesi",
    required: requiredWheelCouplingTorque, provided: sel.wheelCouplingTorqueNm, unit: "Nm", op: ">=",
    computedSide: "required",
    pass: sel.wheelCouplingTorqueNm >= requiredWheelCouplingTorque,
    kind: "firma", severity: "engelleyici",
  });
  checks.push({
    id: `${which}.wheelCoupling.bore`,
    label: "Teker Kaplini Delik Çapı",
    required: sel.wheelShaftDiaMm, provided: sel.wheelCouplingDmaxMm, unit: "mm", op: ">=",
    // İki taraf da katalogdan gelir; TALEP kaplinin geçirmesi gereken teker mili
    // çapıdır, sınır ise kaplinin en büyük delik çapıdır.
    computedSide: "required",
    pass: sel.wheelCouplingDmaxMm >= sel.wheelShaftDiaMm,
    kind: "uretici", severity: "engelleyici",
  });

  // --- Tampon --------------------------------------------------------------
  let collisionLoadT: number;
  let impactEnergy: number;
  if (isTrolley) {
    collisionLoadT = trolleyWeightT;
    impactEnergy = 0.5 * collisionLoadT * (actualSpeed / 60) ** 2; // [kJ]
  } else {
    // Köprüde çarpışan kütle eksantriktir: köprünün yarısı + arabanın
    // yanaşma konumuna düşen payı.
    collisionLoadT =
      bridgeWeightT / 2 +
      (trolleyWeightT * (specs.spanM - inp.bufferApproachM)) / specs.spanM;
    // Köprü kütlesi büyük olduğundan çarpma hızı nominal hızın %70'i alınır.
    impactEnergy = 0.5 * collisionLoadT * ((0.7 * actualSpeed) / 60) ** 2;
  }
  set("buffer.collisionLoad", collisionLoadT);
  set("buffer.impactEnergy", impactEnergy);
  // Tampon sıkışırken tahrik itmeye devam eder: arabada motor başına GEREKLİ
  // güç, köprüde SEÇİLEN motor gücü esas alınır.
  const bufferPowerKw = isTrolley ? powerPerMotor : sel.motorPowerKw;
  set("buffer.drivePower", bufferPowerKw);
  const drivePerMotor = (bufferPowerKw * sel.gearboxRatio * 9550) / sel.motorRpm; // [N]
  set("buffer.driveForcePerMotor", drivePerMotor);
  const totalDrive = sel.motorCount * drivePerMotor; // [N]
  set("buffer.totalDriveForce", totalDrive);
  const bufferDrive = totalDrive / 2; // tampon başına
  set("buffer.driveForcePerBuffer", bufferDrive);
  const driveEnergy = (bufferDrive * sel.bufferStrokeMm) / 1000000; // [kJ]
  set("buffer.driveEnergy", driveEnergy);
  const totalEnergy = driveEnergy + impactEnergy; // [kJ]
  set("buffer.totalEnergy", totalEnergy);
  // Tampon karakteristik verimi 0,8 kabul edilir.
  const bufferForce = totalEnergy / (sel.bufferStrokeMm / 1000) / 0.8 + bufferDrive / 1000; // [kN]
  set("buffer.reactionForce", bufferForce);
  checks.push({
    id: `${which}.buffer.energy`,
    label: "Tampon Enerji Kapasitesi",
    required: totalEnergy, provided: sel.bufferEnergyKj, unit: "kJ", op: ">=",
    computedSide: "required",
    pass: sel.bufferEnergyKj >= totalEnergy,
    kind: "standart", severity: "engelleyici",
  });
  checks.push({
    id: `${which}.buffer.load`,
    label: "Tampon Yük Kapasitesi",
    required: bufferForce, provided: sel.bufferLoadKn, unit: "kN", op: ">=",
    computedSide: "required",
    pass: sel.bufferLoadKn >= bufferForce,
    kind: "standart", severity: "engelleyici",
  });

  const values: TravelValues = {
    drivenWheels,
    craneWeightT,
    maxWheelLoadKg: maxWheelLoad,
    minWheelLoadKg: minWheelLoad,
    avgWheelLoadKg: meanWheelLoad,
    railHeadWidthMm: railHeadWidth,
    wheelRpm,
    c1,
    c2,
    limitPressure,
    actualPressure,
    allowedPressure,
    reactionAKg: reactionA,
    reactionBKg: reactionB,
    maxMomentKgCm: maxMoment,
    sectionModulusCm3: sectionModulus,
    shaftBendingStress: bendingStress,
    shaftShearStress: shearStress,
    shaftCombinedStress: combinedStress,
    shaftAllowables: shaftAllow,
    bearingRadialKn: bearingRadial,
    bearingAxialKn: bearingAxial,
    bearingEqStaticKn: eqStatic,
    bearingEqDynamicKn: eqDynamic,
    bearingStaticSafety: staticSafety,
    bearingLifeHours: lifeHours,
    requiredLifeMin,
    requiredLifeMax: life.max,
    totalWeightKg,
    designWeightTons,
    actualSpeedMpm: actualSpeed,
    startupTimeS: startupTime,
    frictionFactor: friction,
    reducerEfficiency: reducerEff,
    rotationInertiaFactor: inertiaCr,
    accelFactorKa: accelKa,
    requiredPowerKw: requiredPower,
    requiredMaxPowerKw: requiredMaxPower,
    requiredPowerPerMotorKw: powerPerMotor,
    installedPowerKw: installedPower,
    requiredRatio,
    ratioDeviationPct: ratioDeviation,
    requiredInputTorqueNm: requiredInputTorque,
    nominalOutputTorqueNm: nominalOutputTorque,
    requiredMinOutputTorqueNm: requiredMinOutputTorque,
    gearboxActualSafety: gearboxSafety,
    requiredBrakeTorqueNm: requiredBrakeTorque,
    requiredMotorCouplingTorqueNm: requiredMotorCouplingTorque,
    motorCouplingShaftMm: motorCouplingShaft,
    motorCouplingSafety,
    requiredWheelCouplingTorqueNm: requiredWheelCouplingTorque,
    wheelCouplingSafety,
    collisionLoadT,
    impactEnergyKj: impactEnergy,
    driveLoadPerMotorN: drivePerMotor,
    totalDriveLoadN: totalDrive,
    bufferDriveLoadN: bufferDrive,
    totalEnergyKj: totalEnergy,
    bufferForceKn: bufferForce,
  };

  return { values, checks, cells };
}
