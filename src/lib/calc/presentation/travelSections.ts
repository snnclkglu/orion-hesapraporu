// Yürütme grubu sunum katmanı: bölüm yapısı + her hesap satırının SEMBOLİK
// FORMÜLÜ ve SAYILARIN YERİNE KONMUŞ hali. Hesabın kendisi travelGroup.ts'tedir;
// burası yalnız gösterimdir.
//
// Araba ve köprü AYNI bölüm listesini kullanır: her büyüklük tek bir semantik
// anahtar taşır (`key`), varyanta göre adres dallanması YOKTUR. Bölüm id'leri
// araba numaralarını (5.x) taşır; UI köprüde 6.x'e çevirir.
//
// Yalnız tek varyantta üretilen satırlar `variant` ile işaretlenir; sunum
// adaptörü bunları diğer varyantta eler.

import { travelSpecView } from "../modules/travelGroup";
import type {
  TravelDeps,
  TravelInputs,
  TravelSelections,
  TravelValues,
  TravelWhich,
} from "../modules/travelGroup";
import type { TechnicalSpecs } from "../types";

export interface TravelCtx {
  c: Record<string, number | string>; // semantik anahtar → değer (motor çıktısı)
  v: TravelValues;                    // isimli değerler
  inp: TravelInputs;
  sel: TravelSelections;
  specs: TechnicalSpecs;
  deps: TravelDeps;
  which: TravelWhich;
}

export interface TravelRowDef {
  /** Sonucun okunacağı semantik anahtar (`<blok>.<büyüklük>`) */
  key: string;
  label: string;
  formula?: string;           // sembolik formül
  subst?: (ctx: TravelCtx) => string; // sayılar yerine konmuş hali
  unit?: string;
  digits?: number;
  standard?: string;
  /** Satır yalnız bu varyantta üretilir; diğerinde gösterilmez */
  variant?: TravelWhich;
}

export interface TravelSectionDef {
  id: string;                 // "5.1" (araba numarası; UI köprüde 6.x'e çevirir)
  title: string;
  description?: string;
  /** Sadece köprü varyantında gösterilir (yürütme freni bölümü) */
  bridgeOnly?: boolean;
  inputKeys: (keyof TravelInputs & string)[];
  selectionKeys: (keyof TravelSelections & string)[];
  rows: TravelRowDef[];
  /** Bölümde gösterilecek kontrol id sonekleri (örn. "wheel.pressure") */
  checkSuffixes: string[];
}

// Sayı biçimleyici (formül substitüsyonu için, TR yerel)
const n = (v: number | string | undefined, d = 2): string => {
  if (v === undefined) return "?";
  if (typeof v === "string") return v;
  if (Number.isInteger(v)) return String(v);
  return v.toLocaleString("tr-TR", { maximumFractionDigits: d });
};

/** Motor hücresinden sayı okur (formül substitüsyonu için) */
const num = (v: number | string | undefined): number => (typeof v === "number" ? v : NaN);

/**
 * Varyantın teknik özelliklerden okunan büyüklükleri. Yürütme grupları (ana
 * araba, yardımcı araba, monoray arabaları, köprü) aynı sunumu paylaşır; hangi
 * teknik özellik alanının okunacağını motorun `travelSpecView`'ı belirler.
 */
const viewOf = (x: TravelCtx) => travelSpecView(x.specs, x.which, x.deps);

/** Varyantın yürütme hızı — teknik özelliklerden okunur */
const speedOf = (x: TravelCtx): number => viewOf(x).speedMpm;

/** Varyantın kendi mekanizma sınıfı (FEM 1.001 4.2.4.1.5) */
const mechanismOf = (x: TravelCtx): string => viewOf(x).mechanismClass;

/** Varyantın kendi kullanım sınıfı (FEM 1.001 T.2.1.3.2) */
const usageOf = (x: TravelCtx): string => viewOf(x).usageClass;

export const TRAVEL_SECTIONS: TravelSectionDef[] = [
  {
    id: "5.1",
    title: "Tekerlekler",
    description:
      "Tekerlek yükleri ve ray temas basıncı kontrolü (FEM 1.001 4.2.4.1). Köprüde maksimum/minimum yükler araba yanaşma eksantrikliğiyle hesaplanır.",
    inputKeys: ["minApproachM", "wheelCount", "wheelsPerMotor"],
    selectionKeys: ["railCode", "wheelMaterial", "wheelTensileNmm2", "wheelDiaMm"],
    rows: [
      {
        key: "drive.drivenWheels", label: "Tahrikli Teker Sayısı",
        formula: "n_tahrik = motor adedi × motor başına teker",
        subst: (x) =>
          `${n(x.sel.motorCount)} × ${n(num(x.c["drive.wheelsPerMotor"]))}`,
        digits: 0,
      },
      {
        key: "weight.crane", label: "Toplam Vinç Ağırlığı", variant: "bridge",
        formula: "G_vinç = G_köprü + G_araba",
        subst: (x) =>
          `${n(x.specs.bridgeWeightT)} + ${n(x.deps.trolleyWeightT)}`,
        unit: "t",
      },
      {
        key: "wheel.maxLoad", label: "Maksimum Tekerlek Yükü Pmax",
        formula: "Pmax = ΣG / n_teker · 1000  (köprüde yanaşma eksantrik)",
        subst: (x) =>
          x.which !== "bridge"
            ? `(${n(num(x.c["weight.trolley"]))} + ${n(x.specs.mainCapacityT)} + ${n(x.deps.hookEquipmentT)}) / ${n(x.inp.wheelCount)} · 1000`
            : `((${n(x.specs.mainCapacityT)} + ${n(x.deps.trolleyWeightT)}) · (${n(x.specs.spanM)} − ${n(x.inp.minApproachM)})/${n(x.specs.spanM)} + ${n(x.specs.bridgeWeightT)}/2) · 1000 / (${n(x.inp.wheelCount)}/2)`,
        unit: "kg",
      },
      {
        key: "wheel.minLoad", label: "Minimum Tekerlek Yükü Pmin",
        formula: "Pmin = ΣG_min / n_teker · 1000",
        subst: (x) =>
          x.which !== "bridge"
            ? `(${n(num(x.c["weight.trolley"]))} + ${n(x.deps.hookEquipmentT)}) / ${n(x.inp.wheelCount)} · 1000`
            : `(${n(x.deps.trolleyWeightT)} · ${n(x.inp.minApproachM)}/${n(x.specs.spanM)} + ${n(x.specs.bridgeWeightT)}/2) · 1000 / (${n(x.inp.wheelCount)}/2)`,
        unit: "kg",
      },
      {
        key: "wheel.meanLoad", label: "Ortalama Tekerlek Yükü Port",
        formula: "Port = (2·Pmax + Pmin) / 3",
        subst: (x) => `(2·${n(x.v.maxWheelLoadKg)} + ${n(x.v.minWheelLoadKg)}) / 3`,
        unit: "kg",
      },
      {
        key: "rail.headWidth", label: "Ray Temas Yüzeyi Genişliği B",
        formula: "b = f(ray tipi)",
        subst: (x) => `${x.sel.railCode} → ${n(x.v.railHeadWidthMm)}`,
        unit: "mm",
      },
      {
        key: "wheel.rpm", label: "Tekerlek Devri",
        formula: "n_t = v / (D/1000) / π",
        subst: (x) => `${n(speedOf(x))} / (${n(x.sel.wheelDiaMm)}/1000) / π`,
        unit: "d/dak",
      },
      {
        key: "wheel.speedFactor", label: "Teker Dönüş Hızı Katsayısı C1",
        formula: "c1 = f(D, v)",
        subst: (x) => `D=${n(x.sel.wheelDiaMm)}, v=${n(speedOf(x))} → ${n(x.v.c1)}`,
        standard: "FEM 1.001 T.4.2.4.1.4.a",
      },
      {
        key: "wheel.mechanismFactor", label: "Mekanizma Katsayısı C2",
        formula: "c2 = f(yürütme mekanizma sınıfı)",
        subst: (x) => `${mechanismOf(x)} → ${n(x.v.c2)}`,
        standard: "FEM 1.001 T.4.2.4.1.5",
      },
      {
        key: "wheel.limitPressure", label: "Limit Gerilme Değeri PL",
        formula: "PL = f(teker çekme dayanımı)",
        subst: (x) => `${n(x.sel.wheelTensileNmm2)} N/mm² → ${n(x.v.limitPressure)}`,
        unit: "N/mm²", standard: "FEM 1.001 T.4.2.4.1.3 / T.9.12.a",
      },
      {
        key: "wheel.contactPressure", label: "Gerçekleşen Basınç Port/(b·D)",
        formula: "p = Port · 9,81 / (b · D)",
        subst: (x) => `${n(x.v.avgWheelLoadKg)} · 9,81 / (${n(x.v.railHeadWidthMm)} · ${n(x.sel.wheelDiaMm)})`,
        unit: "N/mm²",
      },
      {
        key: "wheel.allowablePressure", label: "İzin Verilen Basınç PL·c1·c2",
        formula: "p_em = PL · c1 · c2",
        subst: (x) => `${n(x.v.limitPressure)} · ${n(x.v.c1)} · ${n(x.v.c2)}`,
        unit: "N/mm²",
      },
    ],
    checkSuffixes: ["wheel.pressure"],
  },
  {
    id: "5.2",
    title: "Teker Mili",
    description:
      "Teker mili, tekerlek yükü açıklığın ortasına etkiyen iki mesnetli kiriş olarak çözülür; kesit kuvvetleri dairesel kesitte gerilmeye çevrilir.",
    inputKeys: ["shaftSpanACm", "shaftSpanBCm", "shaftDiaCm", "stressConcFactor"],
    selectionKeys: ["shaftMaterial"],
    rows: [
      {
        key: "shaft.reactionA", label: "Mesnet Reaksiyonu RA",
        formula: "R_A = Pmax / 2",
        subst: (x) => `${n(x.v.maxWheelLoadKg)} / 2`, unit: "kg",
      },
      {
        key: "shaft.maxMoment", label: "Maksimum Moment Mmaks",
        formula: "M = R_A · a",
        subst: (x) => `${n(x.v.reactionAKg)} · ${n(x.inp.shaftSpanACm)}`, unit: "kg·cm",
      },
      {
        key: "shaft.sectionModulus", label: "Kesit Modülü W",
        formula: "W = π · D³ / 32",
        subst: (x) => `π · ${n(x.inp.shaftDiaCm)}³ / 32`, unit: "cm³",
      },
      {
        key: "shaft.bendingStress", label: "Maksimum Eğilme Gerilmesi",
        formula: "σ_eğ = M · k / W",
        subst: (x) => `${n(x.v.maxMomentKgCm)} · ${n(x.inp.stressConcFactor)} / ${n(x.v.sectionModulusCm3)}`,
        unit: "kg/cm²",
      },
      {
        key: "shaft.shearStress", label: "Kesme Gerilmesi (ortalama)",
        formula: "τ = V / (π · D²/4) · k",
        subst: (x) => `${n(x.v.reactionBKg)} / (π · ${n(x.inp.shaftDiaCm)}²/4) · ${n(x.inp.stressConcFactor)}`,
        unit: "kg/cm²",
      },
      {
        key: "shaft.combinedStress", label: "Bileşik Gerilme",
        formula: "σ_b = √(σ_eğ² + 3·τ²)",
        subst: (x) => `√(${n(x.v.shaftBendingStress)}² + 3·${n(x.v.shaftShearStress)}²)`,
        unit: "kg/cm²", standard: "CMAA 70 4.11.4.1",
      },
      {
        key: "shaft.allowableCombined", label: "İzin Verilen Bileşik Gerilme",
        formula: "σ_em = f(mil malzemesi)",
        subst: (x) => `${x.sel.shaftMaterial} → ${n(x.v.shaftAllowables.combined)}`,
        unit: "kg/cm²",
      },
    ],
    checkSuffixes: ["shaft.stress"],
  },
  {
    id: "5.3",
    title: "Tekerlek Rulmanı",
    description: "Eşdeğer yükler, statik emniyet ve L10 yorulma ömrü (FEM 1.001 T.2.1.3.2).",
    inputKeys: ["bearingCount", "bearingFactorY0", "bearingFactorY1"],
    selectionKeys: ["bearingType", "bearingCode", "bearingDynCKn", "bearingStatC0Kn"],
    rows: [
      {
        key: "bearing.radialLoad", label: "Rulman Radyal Yükü Fr",
        formula: "F_r = Port · 9,81 / 1000 / n_rulman",
        subst: (x) => `${n(x.v.avgWheelLoadKg)} · 9,81 / 1000 / ${n(x.inp.bearingCount)}`,
        unit: "kN",
      },
      {
        key: "bearing.axialLoad", label: "Rulman Eksenel Yükü Fa",
        formula: "F_a = 0,1 · F_r",
        subst: (x) => `0,1 · ${n(x.v.bearingRadialKn)}`, unit: "kN",
      },
      {
        key: "bearing.equivalentStatic", label: "Eşdeğer Statik Yük P₀",
        formula: "P₀ = F_r + F_a · Y₀",
        subst: (x) => `${n(x.v.bearingRadialKn)} + ${n(x.v.bearingAxialKn)} · ${n(x.inp.bearingFactorY0)}`,
        unit: "kN",
      },
      {
        key: "bearing.equivalentDynamic", label: "Eşdeğer Dinamik Yük P",
        formula: "P = F_r + Y₁ · F_a",
        subst: (x) => `${n(x.v.bearingRadialKn)} + ${n(x.inp.bearingFactorY1)} · ${n(x.v.bearingAxialKn)}`,
        unit: "kN",
      },
      {
        key: "bearing.staticSafety", label: "Statik Emniyet Katsayısı S₀",
        formula: "S₀ = C₀ / P₀",
        subst: (x) => `${n(x.sel.bearingStatC0Kn)} / ${n(x.v.bearingEqStaticKn)}`,
      },
      {
        key: "bearing.lifeHours", label: "Rulman Ömrü (L10)",
        formula: "L₁₀ = (10⁶ / (60·n)) · (C/P)^(10/3)",
        subst: (x) => `(10⁶ / (60·${n(x.v.wheelRpm)})) · (${n(x.sel.bearingDynCKn)}/${n(x.v.bearingEqDynamicKn)})^(10/3)`,
        unit: "saat", digits: 0, standard: "FEM 1.001 T.2.1.3.2",
      },
      {
        key: "bearing.requiredLifeMin", label: "Gerekli Minimum Ömür",
        formula: "L_min = f(yürütme kullanım sınıfı)",
        subst: (x) => `${usageOf(x)} → ${n(x.v.requiredLifeMin, 0)}`,
        unit: "saat", digits: 0, standard: "FEM 1.001 T.2.1.3.2",
      },
    ],
    checkSuffixes: ["bearing.static", "bearing.life"],
  },
  {
    id: "5.4",
    title: "Yürütme Motoru",
    description: "CMAA 70 ivmelenme faktörü yöntemiyle gerekli güç ve motor seçimi.",
    inputKeys: [
      "applicationClass", "serviceFactorKs", "accelTorqueFactorKt", "reducerStages",
      "accelerationMs2", "tempFactor", "motorCalcCount",
    ],
    selectionKeys: ["motorBrand", "motorPowerKw", "motorRpm", "motorCount", "motorShaftMm"],
    rows: [
      {
        key: "weight.moving", label: "Hareket Eden Toplam Ağırlık W",
        formula: "W = ΣG · 1000",
        subst: (x) => `${n(x.v.totalWeightKg / 1000)} t · 1000`, unit: "kg",
      },
      {
        key: "weight.design", label: "Tasarım Ağırlığı (%10 Pay)",
        formula: "W' = W · 1,1 / 1000",
        subst: (x) => `${n(x.v.totalWeightKg)} · 1,1 / 1000`, unit: "ton",
      },
      {
        key: "drive.actualSpeed", label: "Yürütme Hızı V (gerçek)",
        formula: "V = (n_m / i) · π · D",
        subst: (x) => `(${n(x.sel.motorRpm)} / ${n(x.sel.gearboxRatio)}) · π · ${n(x.sel.wheelDiaMm / 1000, 3)}`,
        unit: "m/dak",
      },
      {
        key: "drive.startupTime", label: "Kalkış Süresi T",
        formula: "t = V / 60 / a",
        subst: (x) => `${n(x.v.actualSpeedMpm)} / 60 / ${n(x.inp.accelerationMs2)}`, unit: "sn",
      },
      {
        key: "drive.frictionFactor", label: "Sürtünme Katsayısı F",
        formula: "f = f(teker çapı)",
        subst: (x) => `D=${n(x.sel.wheelDiaMm)} → ${n(x.v.frictionFactor)}`,
        unit: "lb/ton", standard: "CMAA 70 T.5.2.9.1.2.1-D",
      },
      {
        key: "drive.reducerEfficiency", label: "Verim E",
        formula: "E = 0,98^kademe",
        subst: (x) => `0,98^${n(x.inp.reducerStages)}`, digits: 4,
      },
      {
        key: "drive.inertiaFactor", label: "Dönme Atalet Faktörü Cr",
        formula: "Cr = 1,05 + (a·3,28 / 7,5)",
        subst: (x) => `1,05 + (${n(x.inp.accelerationMs2)}·3,28 / 7,5)`, digits: 4,
      },
      {
        key: "drive.accelFactor", label: "İvmelenme Faktörü Ka",
        formula: "Ka = (f + 2000·a·Cr / (9,81·E)) / (Kt·33000)",
        subst: (x) =>
          `(${n(x.v.frictionFactor)} + 2000·${n(x.inp.accelerationMs2)}·${n(x.v.rotationInertiaFactor, 4)} / (9,81·${n(x.v.reducerEfficiency, 4)})) / (${n(x.inp.accelTorqueFactorKt)}·33000)`,
        digits: 6, standard: "CMAA 70 5.2.9.1.2.1",
      },
      {
        key: "motor.requiredPower", label: "Gerekli Güç",
        formula: "P = W' · (V·3,28) · Ka · Ks · 0,745",
        subst: (x) =>
          `${n(x.v.designWeightTons)} · (${n(x.v.actualSpeedMpm)}·3,28) · ${n(x.v.accelFactorKa, 6)} · ${n(x.inp.serviceFactorKs)} · 0,745`,
        unit: "kW",
      },
      {
        key: "motor.requiredMaxPower", label: "Gerekli Maksimum Güç PNmax",
        formula: "P' = k_t · P",
        subst: (x) => `${n(x.inp.tempFactor)} · ${n(x.v.requiredPowerKw)}`, unit: "kW",
      },
      {
        key: "motor.installedPower", label: "Kurulu Güç",
        formula: "P_kurulu = P_motor · adet",
        subst: (x) => `${n(x.sel.motorPowerKw)} · ${n(x.sel.motorCount)}`, unit: "kW",
      },
    ],
    checkSuffixes: ["motor.power"],
  },
  {
    id: "5.5",
    title: "Yürütme Dişli Kutusu",
    description: "Gerekli çevrim oranı, tork zinciri ve redüktör seçimi.",
    inputKeys: ["gearboxServiceFactor"],
    selectionKeys: [
      "gearboxModel", "gearboxRatio", "gearboxOutputTorqueKnm",
      "gearboxInputShaftText", "gearboxOutputShaftMm",
    ],
    rows: [
      {
        key: "gearbox.requiredRatio", label: "Gereken Tahvil Oranı",
        formula: "i_g = n_motor / n_teker",
        subst: (x) => `${n(x.sel.motorRpm)} / ${n(x.v.wheelRpm)}`,
      },
      {
        key: "gearbox.ratioDeviation", label: "Oran Sapması",
        formula: "Δi = 100 · (i_g − i_seç) / i_g",
        subst: (x) => `100 · (${n(x.v.requiredRatio)} − ${n(x.sel.gearboxRatio)}) / ${n(x.v.requiredRatio)}`,
        unit: "%",
      },
      {
        key: "motor.powerPerMotor", label: "Motor Başına Gerekli Güç",
        formula: "P_m = P / motor adedi",
        subst: (x) => `${n(x.v.requiredPowerKw)} / ${n(x.sel.motorCount)}`, unit: "kW",
      },
      {
        key: "gearbox.requiredInputTorque", label: "Gerekli Nominal Giriş Torku TGN",
        formula: "T_g = 9550 · P_m / n_m",
        subst: (x) => `9550 · ${n(x.v.requiredPowerPerMotorKw)} / ${n(x.sel.motorRpm)}`,
        unit: "Nm",
      },
      {
        key: "gearbox.nominalOutputTorque", label: "Nominal Çıkış Torku Tnom",
        formula: "T_nom = T_g · i",
        subst: (x) => `${n(x.v.requiredInputTorqueNm)} · ${n(x.sel.gearboxRatio)}`, unit: "Nm",
      },
      {
        key: "gearbox.requiredOutputTorque", label: "Gereken Minimum Çıkış Torku",
        formula: "T_gerekli = T_nom · k_e",
        subst: (x) => `${n(x.v.nominalOutputTorqueNm)} · ${n(x.inp.gearboxServiceFactor)}`, unit: "Nm",
      },
      {
        key: "gearbox.actualSafety", label: "Gerçekleşen Emniyet Katsayısı",
        formula: "n = T_seçilen / (T_nom / 1000)",
        subst: (x) => `${n(x.sel.gearboxOutputTorqueKnm)} / (${n(x.v.nominalOutputTorqueNm)} / 1000)`,
      },
    ],
    checkSuffixes: ["gearbox.ratio", "gearbox.safety"],
  },
  {
    id: "5.5b",
    title: "Yürütme Freni",
    description:
      "Yalnız köprü yürütme mekanizmasında hesaplanır. Fren seçimi yapılmadan kontrol uygun olmaz.",
    bridgeOnly: true,
    inputKeys: ["brakeServiceFactor"],
    selectionKeys: ["brakeBrand", "brakeTorqueNm", "brakeWheelDiaMm"],
    rows: [
      {
        key: "brake.requiredTorque", label: "Gerekli Fren Tork Kapasitesi",
        formula: "T_f = T_g · k_f",
        subst: (x) => `${n(x.v.requiredInputTorqueNm)} · ${n(x.inp.brakeServiceFactor)}`, unit: "Nm",
      },
    ],
    checkSuffixes: ["brake.torque"],
  },
  {
    id: "5.6",
    title: "Motor — Dişli Kutusu Kaplini",
    inputKeys: ["motorCouplingServiceFactor"],
    selectionKeys: [
      "couplingMotorShaftMm", "motorCouplingBrand", "motorCouplingModel",
      "motorCouplingTorqueNm", "motorCouplingDmaxMm",
    ],
    rows: [
      {
        key: "motorCoupling.requiredTorque", label: "Gerekli Kaplin Tork Kapasitesi",
        formula: "T_k = T_g · k",
        subst: (x) => `${n(x.v.requiredInputTorqueNm)} · ${n(x.inp.motorCouplingServiceFactor)}`,
        unit: "Nm",
      },
      {
        key: "motorCoupling.shaftDia", label: "Bağlanacak Mil Çapı",
        formula: "d = d_motor mili",
        subst: (x) => `${n(x.v.motorCouplingShaftMm)}`,
        unit: "mm",
      },
      {
        key: "motorCoupling.actualSafety", label: "Gerçekleşen Emniyet",
        formula: "n = T_kaplin / T_k",
        subst: (x) => `${n(x.sel.motorCouplingTorqueNm)} / ${n(x.v.requiredMotorCouplingTorqueNm)}`,
      },
    ],
    checkSuffixes: ["motorCoupling.torque", "motorCoupling.bore"],
  },
  {
    id: "5.7",
    title: "Teker — Dişli Kutusu Kaplini",
    inputKeys: ["wheelCouplingServiceFactor"],
    selectionKeys: [
      "wheelShaftDiaMm", "wheelCouplingBrand", "wheelCouplingModel",
      "wheelCouplingTorqueNm", "wheelCouplingDmaxMm",
    ],
    rows: [
      {
        key: "wheelCoupling.requiredTorque", label: "Gerekli Kaplin Tork Kapasitesi",
        formula: "T_k = T_nom · k",
        subst: (x) => `${n(x.v.nominalOutputTorqueNm)} · ${n(x.inp.wheelCouplingServiceFactor)}`,
        unit: "Nm",
      },
      {
        key: "wheelCoupling.actualSafety", label: "Gerçekleşen Emniyet",
        formula: "n = T_kaplin / T_nom",
        subst: (x) => `${n(x.sel.wheelCouplingTorqueNm)} / ${n(x.v.nominalOutputTorqueNm)}`,
      },
    ],
    checkSuffixes: ["wheelCoupling.torque", "wheelCoupling.bore"],
  },
  {
    id: "5.8",
    title: "Tampon",
    description:
      "Çarpma enerjisi + yürütme enerjisi ile tampon seçimi. Köprüde çarpışan kütle eksantriktir ve çarpma hızı nominal hızın %70'i alınır.",
    inputKeys: ["bufferApproachM"],
    selectionKeys: ["bufferModel", "bufferStrokeMm", "bufferEnergyKj", "bufferLoadKn"],
    rows: [
      {
        key: "buffer.collisionLoad", label: "Çarpışma Yükü We1",
        formula: "We1 = G_araba  (köprüde: G_köprü/2 + G_araba·(L−y)/L)",
        subst: (x) =>
          x.which !== "bridge"
            ? `${n(num(x.c["weight.trolley"]))}`
            : `${n(x.specs.bridgeWeightT)}/2 + ${n(x.deps.trolleyWeightT)}·(${n(x.specs.spanM)} − ${n(x.inp.bufferApproachM)})/${n(x.specs.spanM)}`,
        unit: "t",
      },
      {
        key: "buffer.impactEnergy", label: "Çarpma Enerjisi",
        formula: "E_ç = 0,5 · We1 · (v/60)²  (köprüde v yerine 0,7·v)",
        subst: (x) =>
          x.which !== "bridge"
            ? `0,5 · ${n(x.v.collisionLoadT)} · (${n(x.v.actualSpeedMpm)}/60)²`
            : `0,5 · ${n(x.v.collisionLoadT)} · (0,7·${n(x.v.actualSpeedMpm)}/60)²`,
        unit: "kJ", digits: 3,
      },
      {
        key: "buffer.driveForcePerMotor", label: "Yürütme Yükü / Motor D''",
        formula: "D'' = P · i · 9550 / n",
        subst: (x) =>
          `${n(x.which !== "bridge" ? x.v.requiredPowerPerMotorKw : x.sel.motorPowerKw)} · ${n(x.sel.gearboxRatio)} · 9550 / ${n(x.sel.motorRpm)}`,
        unit: "N",
      },
      {
        key: "buffer.totalDriveForce", label: "Toplam Yürütme Yükü D'",
        formula: "D' = D'' · motor sayısı",
        subst: (x) => `${n(x.v.driveLoadPerMotorN)} · ${n(x.sel.motorCount)}`, unit: "N",
      },
      {
        key: "buffer.driveForcePerBuffer", label: "Tampon Başına Yürütme Yükü",
        formula: "D = D' / 2",
        subst: (x) => `${n(x.v.totalDriveLoadN)} / 2`, unit: "N",
      },
      {
        key: "buffer.driveEnergy", label: "Yürütme Enerjisi D·s",
        formula: "E_d = D · s / 10⁶",
        subst: (x) => `${n(x.v.bufferDriveLoadN)} · ${n(x.sel.bufferStrokeMm)} / 10⁶`,
        unit: "kJ", digits: 4,
      },
      {
        key: "buffer.totalEnergy", label: "Toplam Sönümlenmesi Gereken Enerji",
        formula: "E = E_d + E_ç",
        subst: (x) => `${n((x.v.bufferDriveLoadN * x.sel.bufferStrokeMm) / 1e6, 4)} + ${n(x.v.impactEnergyKj, 3)}`,
        unit: "kJ", digits: 3,
      },
      {
        key: "buffer.reactionForce", label: "Tampon Yükü",
        formula: "F_t = E / (s/1000) / 0,8 + D/1000",
        subst: (x) =>
          `${n(x.v.totalEnergyKj, 3)} / (${n(x.sel.bufferStrokeMm)}/1000) / 0,8 + ${n(x.v.bufferDriveLoadN)}/1000`,
        unit: "kN",
      },
    ],
    checkSuffixes: ["buffer.energy", "buffer.load"],
  },
];
