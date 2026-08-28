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

import { travelBufferType, travelHasFestoon, travelSpecView } from "../modules/travelGroup";
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
  /** Formülün üzerine gelindiğinde gösterilen kısa, sade açıklama. */
  formulaHint?: string;
  /** Motor hücresi yerine sunuma dönüştürülmüş değer. */
  valueFrom?: (ctx: TravelCtx) => number | string;
  subst?: (ctx: TravelCtx) => string; // sayılar yerine konmuş hali
  unit?: string;
  digits?: number;
  standard?: string;
  /**
   * Ölçü bir ÇAPTIR — gösterilen değerin başına "Ø" konur (bkz. fields.ts
   * `withDiameterSign`). Arayüz ve PDF aynı bayrağı okur.
   */
  diameter?: true;
  /** Satır yalnız bu varyantta üretilir; diğerinde gösterilmez */
  variant?: TravelWhich;
  /** Satır yalnız bu hesap bağlamında anlamlıysa gösterilir. */
  visible?: (ctx: TravelCtx) => boolean;
}

export interface TravelSectionDef {
  id: string;                 // "5.1" (araba numarası; UI köprüde 6.x'e çevirir)
  title: string;
  description?: string;
  /**
   * Bölüm yalnız bu koşul sağlanınca gösterilir (kaldırma tarafındaki
   * `HoistSectionDef.visible` deseniyle aynı). Tampon bölümü, teknik
   * özelliklerde o grup için tampon seçilmişse görünür.
   */
  visible?: (specs: TechnicalSpecs, which: TravelWhich) => boolean;
  inputKeys: (keyof TravelInputs & string)[];
  selectionKeys: (keyof TravelSelections & string)[];
  /** Jenerik alan ızgarasına sığmayan, bölüme ait özel düzenleyici. */
  editor?: "festoon";
  rows: TravelRowDef[];
  /** Bölümde gösterilecek kontrol id sonekleri (örn. "wheel.pressure") */
  checkSuffixes: string[];
  /**
   * Bu bölümün ekipman listesindeki satır slug'ları (`EqRow.rowKey`in
   * `<modulKey>:` sonrası). Bölüm GİZLENDİĞİNDE bu satırlar da listeden düşer
   * (ekran + Excel + PDF); bağ koruma testiyle ölçülür
   * (`hidden-sections-equipment.test.ts`).
   */
  equipmentSlugs?: readonly string[];
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
    equipmentSlugs: ["wheel"],
    description:
      "Tekerlek yükleri ve ray temas basıncı kontrolü (FEM 1.001 4.2.4.1). Köprüde maksimum/minimum yükler araba yanaşma eksantrikliğiyle hesaplanır.",
    inputKeys: ["minApproachM", "wheelCount", "driveCount", "wheelsPerMotor"],
    selectionKeys: [
      "railFamily", "railCode", "wheelMaterial", "wheelTensileNmm2",
      "wheelDiaMm", "wheelHardness",
    ],
    rows: [
      {
        key: "drive.drivenWheels", label: "Tahrikli Teker Sayısı",
        formula: "n_tahrik,teker = tahrik adedi × motor başına teker",
        subst: (x) =>
          `${n(x.inp.driveCount)} × ${n(num(x.c["drive.wheelsPerMotor"]))}`,
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
      "Teker mili iki rulman arasında basit kiriş olarak çözülür. Teker yükü " +
      "mile bir çizgi üzerinden değil bandaj genişliği boyunca YAYILI aktarılır " +
      "(q = Pmaks / b_teker, bant açıklığın ortasında); bu, momentin tepesini " +
      "q·b_t²/8 kadar düşürür. Teker genişliği girilmezse yük tekil kabul " +
      "edilir. Kesit kuvvetleri dairesel kesitte gerilmeye çevrilir.",
    inputKeys: [
      "shaftSpanAMm", "shaftSpanBMm", "shaftDiaMm", "wheelWidthMm", "stressConcFactor",
    ],
    selectionKeys: ["shaftMaterial"],
    rows: [
      {
        key: "shaft.reactionA", label: "Mesnet Reaksiyonu RA",
        formula: "R_A = Pmax / 2",
        subst: (x) => `${n(x.v.maxWheelLoadKg)} / 2`, unit: "kg",
      },
      {
        key: "shaft.loadBand", label: "Yük Bandı (teker genişliği)",
        formula: "b_t = teker genişliği   (0 → tekil yük)",
        valueFrom: (x) => num(x.c["shaft.loadBand"]) * 10,
        subst: (x) => `${n(x.inp.wheelWidthMm ?? 0)}`, unit: "mm",
      },
      {
        key: "shaft.loadIntensity", label: "Yayılı Yük Şiddeti",
        formula: "q = Pmaks / b_t",
        valueFrom: (x) => num(x.c["shaft.loadIntensity"]) / 10,
        subst: (x) =>
          x.v.shaftLoadBandCm > 0
            ? `${n(x.v.maxWheelLoadKg)} / ${n(x.v.shaftLoadBandCm * 10)}`
            : "tekil yük — yayılı yük yok",
        unit: "kg/mm",
      },
      {
        key: "shaft.maxMoment", label: "Maksimum Moment Mmaks",
        formula: "M = R_A · a − q · b_t² / 8",
        subst: (x) =>
          x.v.shaftLoadBandCm > 0
            ? `${n(x.v.reactionAKg)} · (${n(x.inp.shaftSpanAMm)} / 10) − ${n(x.v.shaftLoadIntensityKgPerCm)} · ${n(x.v.shaftLoadBandCm)}² / 8`
            : `${n(x.v.reactionAKg)} · (${n(x.inp.shaftSpanAMm)} / 10)`,
        unit: "kg·cm",
      },
      {
        key: "shaft.sectionModulus", label: "Kesit Modülü W",
        formula: "W = π · D³ / 32",
        subst: (x) => `π · (${n(x.inp.shaftDiaMm)} / 10)³ / 32`, unit: "cm³",
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
        subst: (x) => `${n(x.v.reactionBKg)} / (π · (${n(x.inp.shaftDiaMm)} / 10)²/4) · ${n(x.inp.stressConcFactor)}`,
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
    equipmentSlugs: ["wheelBearing"],
    description: "Eşdeğer yükler, statik emniyet ve L10 yorulma ömrü (FEM 1.001 T.2.1.3.2).",
    inputKeys: ["bearingCount", "bearingFactorY0", "bearingFactorY1"],
    selectionKeys: [
      "bearingBrand", "bearingType", "bearingCode", "bearingBoreMm", "bearingOuterDiaMm",
      "bearingWidthMm", "bearingDynCKn", "bearingStatC0Kn",
    ],
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
      {
        key: "bearing.bore", label: "Rulman İç Çapı", diameter: true,
        formula: "d_rulman = d_mil",
        subst: (x) => `${n(x.sel.bearingBoreMm ?? 0)} = ${n(x.inp.shaftDiaMm)}`,
        unit: "mm",
      },
      {
        key: "bearing.outerDia", label: "Rulman Dış Çapı", diameter: true,
        formula: "D = katalog",
        subst: (x) => `${n(x.sel.bearingOuterDiaMm ?? 0)}`,
        unit: "mm",
      },
      {
        key: "bearing.width", label: "Rulman Genişliği",
        formula: "B = katalog",
        subst: (x) => `${n(x.sel.bearingWidthMm ?? 0)}`,
        unit: "mm",
      },
    ],
    checkSuffixes: ["bearing.static", "bearing.life", "bearing.bore"],
  },
  {
    id: "5.4",
    title: "Yürütme Motoru",
    equipmentSlugs: ["motor"],
    description: "CMAA 70 ivmelenme faktörü yöntemiyle gerekli güç ve motor seçimi.",
    inputKeys: [
      "applicationClass", "serviceFactorKs", "accelTorqueFactorKt",
      "accelerationMs2", "tempFactor",
    ],
    selectionKeys: [
      "motorBrand", "motorModel", "motorMountType", "motorBrakeType",
      "motorEfficiencyClass", "motorInsulationClass", "motorDutyType",
      "motorThermalProtection", "motorEncoder", "motorPowerKw", "motorRpm",
      "motorCount", "motorShaftMm",
    ],
    rows: [
      {
        key: "weight.movingTonnes", label: "Hareket Eden Toplam Kütle ΣG",
        formula: "ΣG = Σm / 1000",
        subst: (x) => `${n(x.v.totalWeightKg)} / 1000`, unit: "ton",
      },
      {
        // CMAA 70 imperial birimlidir: sürtünme f [lb/ton] ve ivmelenme
        // terimindeki 2000 sayısı KISA TONA (1 US ton = 2000 lb) aittir.
        // Metrik ton doğrudan yazılırsa gerekli güç %10 eksik çıkar.
        key: "weight.design", label: "Hareket Eden Toplam Ağırlık W (kısa ton)",
        formula: "W = ΣG · 1,1",
        subst: (x) => `${n(x.v.totalWeightKg / 1000)} · 1,1`,
        unit: "US ton", standard: "CMAA 70 5.2.9.1.2.1",
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
        formula: "P = W · (V·3,28) · Ka · Ks · 0,745",
        subst: (x) =>
          `${n(x.v.designWeightShortTons)} · (${n(x.v.actualSpeedMpm)}·3,28) · ${n(x.v.accelFactorKa, 6)} · ${n(x.inp.serviceFactorKs)} · 0,745`,
        unit: "kW", standard: "CMAA 70 5.2.9.1.2.1",
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
    title: "Yürütme Redüktörü",
    description:
      "Gerekli çevrim oranı, tork zinciri ve redüktör seçimi. Tahvil oranı " +
      "kutusu OTOMATİK açılır ve gereken orana eşitlenir; böylece gerçekleşen " +
      "hız anma hızına oturur ve motor doğru güçten seçilir. Redüktör " +
      "katalogdan seçilene (ya da oran elle girilene) kadar bölüm UYGUN " +
      "DEĞİLDİR.",
    equipmentSlugs: ["gearbox"],
    inputKeys: ["gearboxServiceFactor", "reducerStages"],
    selectionKeys: [
      // MİL YÖNLERİ KUTUSU YÜRÜTMEDE YOKTUR (kullanıcı kararı, 24.08.2026):
      // yürütme redüktörü teker miline sabit bir düzende oturur, yön bir
      // sipariş sorusu değildir.
      "gearboxModel", "gearboxOutputFeature",
      "gearboxMountingPosition", "gearboxOptions",
      "gearboxRatio", "gearboxOutputTorqueKnm",
      "gearboxInputShaftMm", "gearboxOutputShaftMm",
    ],
    rows: [
      {
        key: "gearbox.requiredRatio", label: "Gereken Tahvil Oranı",
        formula: "i_g = n_motor / n_teker",
        formulaHint:
          "Anma hızını tam tutturan orandır. Tahvil oranı kutusu otomatikken " +
          "bu sayıya eşitlenir; motor seçildikten sonra kataloğun gerçek oranı " +
          "girilir ve sapma bir alt satırda ölçülür.",
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
    checkSuffixes: ["gearbox.selected", "gearbox.ratio", "gearbox.safety"],
  },
  {
    id: "5.5b",
    title: "Yürütme Freni",
    description:
      "Araba ve köprü yürütme mekanizmalarında motor başına gereken giriş torku üzerinden hesaplanır. Fren seçimi yapılmadan kontrol uygun olmaz.",
    equipmentSlugs: ["brake"],
    inputKeys: ["brakeServiceFactor"],
    selectionKeys: ["brakeBrand", "brakeTorqueNm", "brakeWheelDiaMm", "brakeOptions"],
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
    title: "Motor — Redüktör Kaplini",
    equipmentSlugs: ["motorCoupling"],
    inputKeys: ["motorCouplingServiceFactor"],
    selectionKeys: [
      "motorCouplingBrand", "motorCouplingModel",
      "motorCouplingTorqueNm", "motorCouplingDmaxMm", "motorCouplingSealType",
    ],
    rows: [
      {
        key: "motorCoupling.requiredTorque", label: "Gerekli Kaplin Tork Kapasitesi",
        formula: "T_k = T_g · k",
        subst: (x) => `${n(x.v.requiredInputTorqueNm)} · ${n(x.inp.motorCouplingServiceFactor)}`,
        unit: "Nm",
      },
      {
        key: "motorCoupling.shaftDia", label: "Bağlanacak Mil Çapı", diameter: true,
        formula: "d = maks(d_motor, d_redüktör giriş)",
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
    title: "Teker — Redüktör Kaplini",
    equipmentSlugs: ["wheelCoupling"],
    inputKeys: ["wheelCouplingServiceFactor"],
    selectionKeys: [
      "wheelShaftDiaMm", "wheelCouplingBrand", "wheelCouplingModel",
      "wheelCouplingTorqueNm", "wheelCouplingDmaxMm", "wheelCouplingSealType",
    ],
    rows: [
      {
        key: "wheelCoupling.requiredTorque", label: "Gerekli Kaplin Tork Kapasitesi",
        formula: "T_k = T_nom · k",
        subst: (x) => `${n(x.v.nominalOutputTorqueNm)} · ${n(x.inp.wheelCouplingServiceFactor)}`,
        unit: "Nm",
      },
      {
        key: "wheelCoupling.shaftDia", label: "Bağlanacak En Büyük Mil Çapı", diameter: true,
        formula: "d = maks(d_teker, d_redüktör çıkış)",
        subst: (x) => `maks(${n(x.sel.wheelShaftDiaMm)}; ${n(x.sel.gearboxOutputShaftMm)})`,
        unit: "mm",
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
      "Çarpma enerjisi + tahrik enerjisi ile tampon seçimi (FEM 1.001 md. " +
      "2.2.3.4.1). Çarpışan kütleye salınabilen yük DAHİL DEĞİLDİR; kütle aynı " +
      "anda temas eden tamponlara paylaşılır. Köprüde araba eksantriktir. " +
      "Teknik özelliklerdeki tampon ailesi (hidrolik / kauçuk) hesap dalını " +
      "belirler; kauçuk ailesinde katalogdan kauçuk veya hücresel poliüretan " +
      "alt türü seçilir. Rapor; kinematik ortalama yavaşlamayı ve tampon kuvvet " +
      "eğrisinden gelen tepe yavaşlamayı ayrı gösterir; katalog seçiminde tepe " +
      "yavaşlama esas alınır. Tepki kuvveti yapıya YÜKLEME DURUMU III olarak teslim " +
      "edilir; köprüde bu değeri teker yükleri bölümü yol kirişi yüklerine " +
      "taşır (FEM Kitapçık 9 md. 9.4.2 eşiğinin üstündeyse).",
    // Bölüm yalnız o grupta tampon seçilmişse görünür (teknik özellikler).
    visible: (specs, which) => travelBufferType(specs, which) !== "yok",
    equipmentSlugs: ["buffer"],
    inputKeys: [
      "bufferApproachM", "bufferCount", "bufferLoadRigidlyGuided",
      "bufferFrequentEndApproach",
    ],
    selectionKeys: [
      "bufferModel", "bufferCatalogType", "bufferRubberQuality",
      "bufferStrokeMm", "bufferEnergyKj", "bufferLoadKn",
    ],
    rows: [
      {
        key: "buffer.impactSpeedRatio", label: "Çarpma Hızı Oranı k",
        formula: "k = teknik özelliklerden (FEM 1.001 2.2.3.4.1: 0,7)",
        formulaHint: "Nominal hızın çarpma anında alınacak oranı; köprüde varsayılan %70'tir.",
        subst: (x) => `${n(x.v.bufferImpactSpeedRatio, 2)}`,
        standard: "FEM 1.001 2.2.3.4.1", digits: 2,
      },
      {
        key: "buffer.impactSpeed", label: "Çarpma Hızı v_ç",
        formula: "v_ç = (v/60) · k",
        formulaHint: "Nominal yürüyüş hızı metre/saniyeye çevrilir ve çarpma hızı oranı ile azaltılır.",
        subst: (x) => `(${n(x.v.actualSpeedMpm)}/60) · ${n(x.v.bufferImpactSpeedRatio, 2)}`,
        unit: "m/s", digits: 3, standard: "FEM 1.001 2.2.3.4.1",
      },
      {
        key: "buffer.collisionLoad", label: "Tampon Başına Çarpışan Kütle m_t",
        formula:
          "m_t = G_araba / n  (köprüde: [G_köprü/2 + G_araba·(L−y)/L] / (n/2))",
        formulaHint: "Çarpışma enerjisini taşıyan ve aynı anda temas eden tamponlara paylaştırılan hareketli kütledir.",
        subst: (x) =>
          x.which !== "bridge"
            ? `${n(num(x.c["weight.trolley"]))} / ${n(num(x.c["buffer.activeCount"]))}`
            : `[${n(x.specs.bridgeWeightT)}/2 + ${n(x.deps.trolleyWeightT)}·(${n(x.specs.spanM)} − ${n(x.inp.bufferApproachM)})/${n(x.specs.spanM)}] / ${n(Math.max(1, num(x.c["buffer.activeCount"]) / 2))}`,
        unit: "t", digits: 3, standard: "FEM 1.001 2.2.3.4.1",
      },
      {
        key: "buffer.impactEnergy", label: "Çarpma Enerjisi E_kin",
        formula: "E_kin = 0,5 · m_t · v_ç²",
        formulaHint: "Tamponun, tampon başına gelen hareketli kütleyi çarpma hızından durdururken yutması gereken kinetik enerjidir.",
        subst: (x) =>
          `0,5 · ${n(x.v.collisionLoadT, 3)} · ${n(x.v.bufferImpactSpeedMps, 3)}²`,
        unit: "kJ", digits: 3,
      },
      {
        key: "buffer.driveForcePerMotor", label: "Motor Başına Tahrik Kuvveti F₀″",
        formula: "F₀ = P[W] / v[m/s]   (= T_çıkış / r_teker)",
        formulaHint: "Motor gücünün o hızdaki eşdeğer çekiş kuvvetidir; çıkış torkunun teker yarıçapına bölünmesine eşittir.",
        subst: (x) =>
          `${n(num(x.c["buffer.drivePower"]) * 1000)} / (${n(x.v.actualSpeedMpm)}/60)`,
        unit: "N", digits: 1,
      },
      {
        key: "buffer.totalDriveForce", label: "Toplam Tahrik Kuvveti F₀′",
        formula: "F₀′ = F₀″ · motor sayısı",
        formulaHint: "Aynı hareket yönünde çalışan tüm yürüyüş motorlarının toplam itme kuvvetidir.",
        subst: (x) => `${n(x.v.driveLoadPerMotorN, 1)} · ${n(x.sel.motorCount)}`,
        unit: "N", digits: 1,
      },
      {
        key: "buffer.driveForcePerBuffer", label: "Tampon Başına Tahrik Kuvveti F₀",
        formula: "F₀ = F₀′ / n",
        formulaHint: "Toplam tahrik kuvvetinin aynı anda temas eden tamponlar arasındaki payıdır.",
        subst: (x) => `${n(x.v.totalDriveLoadN, 1)} / ${n(num(x.c["buffer.activeCount"]))}`,
        unit: "N", digits: 1,
      },
      {
        key: "buffer.strokeUsed", label: "Hesaplanan Sıkışma Yolu f′",
        formula: "hidrolik: f′ = s · elastomer: f′ = (sıkışma % / izin %) · s_izin",
        formulaHint: "Hidrolikte tam strok kullanılır; kauçuk ve hücresel tamponlarda yol, enerji-sıkışma eğrisinden bulunur.",
        subst: (x) =>
          x.v.bufferType === "kaucuk" || x.v.bufferType === "hucresel"
            ? `${n(x.v.bufferCompressionPct, 1)} % / ${n(x.sel.bufferMaxCompressionPct)} % · ${n(x.sel.bufferStrokeMm)}`
            : `${n(x.sel.bufferStrokeMm)}`,
        unit: "mm", digits: 1,
      },
      {
        key: "buffer.driveEnergy", label: "Tahrikin Eklediği Enerji E_tahrik",
        formula: "E_pot = F₀ · f′ / 10⁶",
        formulaHint: "Tampon sıkışırken tahrik devam ederse, itme kuvvetinin sıkışma yolu boyunca yaptığı ek iştir.",
        subst: (x) => `${n(x.v.bufferDriveLoadN, 1)} · ${n(x.v.bufferStrokeUsedMm, 1)} / 10⁶`,
        unit: "kJ", digits: 4,
      },
      {
        key: "buffer.totalEnergy", label: "Tampon Başına Sönümlenmesi Gereken Enerji E_a",
        formula: "E_a = E_kin + E_pot",
        formulaHint: "Tamponun yutması gereken talep enerjisidir. Katalogdaki W_maks ise tamponun izin verilen kapasitesidir.",
        subst: (x) => `${n(x.v.impactEnergyKj, 3)} + ${n(x.v.bufferDriveEnergyKj, 4)}`,
        unit: "kJ", digits: 3, standard: "FEM 1.001 2.2.3.4.1",
      },
      {
        key: "buffer.catalogEnergyAtImpact", label: "Katalog İzinli Enerji Kapasitesi W_maks",
        valueFrom: (x) => x.v.bufferCatalogEnergyAtImpactKj,
        formula: "hücresel: gerçek çarpma hızında komşu katalog eğrileri arasında enterpolasyon · diğer: seçilen katalog satırı",
        formulaHint: "Bu kapasite, talep edilen E_a ile karşılaştırılan katalog sınırıdır. Hücreselde enerji ve kuvvet aynı çarpma hızındaki tek hesap eğrisinden okunur; ara hızda üretici teyidi önerilir.",
        subst: (x) => x.v.bufferType === "hucresel"
          ? `${n(x.v.bufferCatalogLowerCurveSpeedMps ?? x.v.bufferImpactSpeedMps, 3)}–${n(x.v.bufferCatalogUpperCurveSpeedMps ?? x.v.bufferImpactSpeedMps, 3)} m/s → vç=${n(x.v.bufferCatalogCurveSpeedMps ?? x.v.bufferImpactSpeedMps, 3)} m/s`
          : x.sel.bufferModel || "—",
        unit: "kJ", digits: 3,
      },
      {
        key: "buffer.compression", label: "Hesaplanan Sıkışma Oranı",
        valueFrom: (x) =>
          (x.v.bufferType === "kaucuk" || x.v.bufferType === "hucresel") && !x.v.bufferComputed
            ? "Yük diyagramı yok"
            : x.v.bufferCompressionPct,
        formula: "kauçuk / hücresel: enerji–sıkışma eğrisinden (E_a → %)",
        formulaHint: "Gereken E_a değeri katalogdaki enerji-sıkışma eğrisi üzerinde hangi sıkışmaya karşılık geliyorsa o oran okunur.",
        subst: (x) =>
          x.v.bufferType === "kaucuk" || x.v.bufferType === "hucresel"
            ? x.v.bufferComputed
              ? `eğri(${n(x.v.totalEnergyKj * 1000, 1)} J)`
              : "katalog yük diyagramı yok"
            : "tam strok",
        unit: "%", digits: 1,
      },
      {
        key: "buffer.maxCompressionLimit", label: "Katalog İzinli En Büyük Sıkışma",
        valueFrom: (x) => x.sel.bufferMaxCompressionPct || "Katalog verisi yok",
        unit: "%", digits: 1,
        formula: "Program 0170: %50 · Program 0180: %80",
        formulaHint: "Üreticinin izin verdiği sıkışma üst sınırıdır; hesaplanan sıkışma bu değeri geçemez.",
      },
      {
        key: "buffer.reactionForce", label: "Tampon Tepki Kuvveti F_t",
        valueFrom: (x) =>
          (x.v.bufferType === "kaucuk" || x.v.bufferType === "hucresel") && !x.v.bufferComputed
            ? "Yük diyagramı yok"
            : x.v.bufferForceKn,
        formula:
          "hidrolik: F_t = E_a / (s · η), η = 0,85 · " +
          "kauçuk / hücresel: F_t = kuvvet eğrisi(sıkışma %)",
        formulaHint: "Tamponun durdurma anındaki direnç kuvvetidir. Elastomer tamponlarda aynı sıkışma oranındaki katalog kuvvet eğrisinden okunur.",
        subst: (x) =>
          x.v.bufferType === "kaucuk" || x.v.bufferType === "hucresel"
            ? x.v.bufferComputed
              ? `eğri(${n(x.v.bufferCompressionPct, 1)} %)`
              : "katalog yük diyagramı yok"
            : `${n(x.v.totalEnergyKj, 3)} / (${n(x.v.bufferStrokeUsedMm)}/1000 · 0,85)`,
        unit: "kN", digits: 2,
      },
      {
        key: "buffer.catalogForceAtImpact", label: "Katalog Son Kuvvet Sınırı",
        valueFrom: (x) => x.v.bufferCatalogForceAtImpactKn,
        formula: "hücresel: gerçek çarpma hızında komşu katalog eğrileri arasında enterpolasyon · diğer: seçilen katalog satırı",
        formulaHint: "Tampon kuvveti bu katalog sınırını geçmemelidir. Enerji ile kuvvet aynı ara hız eğrisinden okunur; iki farklı hız eğrisini karıştırmak doğru değildir.",
        subst: (x) => x.v.bufferType === "hucresel"
          ? `${n(x.v.bufferCatalogLowerCurveSpeedMps ?? x.v.bufferImpactSpeedMps, 3)}–${n(x.v.bufferCatalogUpperCurveSpeedMps ?? x.v.bufferImpactSpeedMps, 3)} m/s → vç=${n(x.v.bufferCatalogCurveSpeedMps ?? x.v.bufferImpactSpeedMps, 3)} m/s`
          : x.sel.bufferModel || "—",
        unit: "kN", digits: 2,
      },
      {
        key: "buffer.avgDeceleration", label: "Ortalama Yavaşlama (Kinematik) a_ort",
        formula: "a_ort = v_ç² / (2 · f′)",
        formulaHint: "Aynı çarpma hızında sıkışma yolu uzadıkça bu ortalama yavaşlama azalır.",
        subst: (x) =>
          `${n(x.v.bufferImpactSpeedMps, 3)}² / (2 · ${n(x.v.bufferStrokeUsedMm / 1000, 3)})`,
        unit: "m/s²", digits: 2, standard: "FEM 1.001 7.7.1.2",
      },
      {
        key: "buffer.maxDeceleration", label: "Tepe Yavaşlama (Tampon Kuvvetinden) a_maks",
        formula: "a_maks = F_t / m_t",
        formulaHint: "KAT0170/0180 s.7'deki tepe yavaşlama bağıntısıdır. F₀, E_a hesabında sıkışmayı ve dolayısıyla F_t değerini zaten etkiler; burada ikinci kez çıkarılmaz. Strok uzadıkça F_t her zaman azalmaz; eğri ve tampon sertliği belirleyicidir.",
        subst: (x) =>
          `${n(x.v.bufferForceKn * 1000, 0)} / ${n(x.v.collisionLoadT * 1000, 0)}`,
        unit: "m/s²", digits: 2, standard: "FEM 1.001 7.7.1.2",
      },
      {
        key: "buffer.designMass", label: "Kısma İğnesi Seçim Kütlesi (Tampon Başına)",
        formula: "m_a = m_t (tampon başına)",
        formulaHint: "Yalnız hidrolik tamponlarda, uygun kısma iğnesi sınıfını seçmek için kullanılan tampon başına hareketli kütledir.",
        subst: (x) => `${n(x.v.collisionLoadT, 3)}`,
        unit: "t", digits: 3,
        visible: (x) => x.v.bufferType === "hidrolik",
      },
      {
        key: "buffer.meteringPinCode", label: "Seçilen Kısma İğnesi Kodu",
        valueFrom: (x) => x.v.bufferMeteringPinCode || "Katalog tablosu yok",
        formula: "seçilen strokta m_a değerini karşılayan en küçük katalog sınıfı",
        formulaHint: "Hidrolik tampon için, tasarım kütlesini karşılayan en küçük üretici kısma iğnesi sınıfı seçilir.",
        visible: (x) => x.v.bufferType === "hidrolik",
      },
      {
        key: "buffer.meteringPinMassClass", label: "İğne Kütle Sınıfı",
        valueFrom: (x) => x.v.bufferDesignMassMaxT || "—",
        unit: "t", digits: 3,
        visible: (x) => x.v.bufferType === "hidrolik",
      },
    ],
    checkSuffixes: [
      "buffer.energy", "buffer.load", "buffer.compression",
      "buffer.deceleration", "buffer.designMass", "buffer.speedThreshold",
      "buffer.scope",
    ],
  },
  {
    id: "5.9",
    title: "Feston Sistemi",
    equipmentSlugs: ["festoon"],
    description:
      "Bu hareket ekseninin kablo taşıyıcı sistemi. Seri KATALOGDAN seçilir " +
      "(marka → kablo formu → ürün hattı → ürün tablosu); hareket mesafesi ve " +
      "hız teknik özelliklerden okunur. Bu bir kablo sarkması hesabı değil, " +
      "üreticinin çalışma yükü ve hız sınırlarına karşı bir SEÇİM kontrolüdür: " +
      "hareketli kablo paketi taşıyıcılara eşit dağıtılır. Kesin parça kodu " +
      "için I-kiriş flanş genişliği, kablo paketinin genişlik/yükseklik ölçüsü " +
      "ve minimum bükülme çapı teklif/imalat aşamasında doğrulanır.",
    visible: (specs, which) => travelHasFestoon(specs, which),
    inputKeys: [
      "festoonTrolleyCount", "festoonCablePackageWeightKg", "festoonLoopHeightM",
    ],
    selectionKeys: [
      "festoonBrand", "festoonSeries", "festoonLine", "festoonCableForm",
      "festoonTrolleyLoadKg", "festoonMaxSpeedMpm",
      "festoonTrolleyCode", "festoonTowTrolleyCode", "festoonEndClampCode",
    ],
    // Şema (hareket mesafesi · taşıyıcı adedi · loop yüksekliği) bölümün
    // üstünde canlı çizilir; seçim akışı diğer bölümlerin aynısıdır.
    editor: "festoon",
    rows: [
      {
        key: "festoon.travelDistance", label: "Hareket Mesafesi",
        formula: "araba: açıklık L · köprü: yürüme yolu uzunluğu",
        subst: (x) => x.which === "bridge"
          ? `${n(x.specs.runwayLengthM)}`
          : `${n(x.specs.spanM)}`,
        unit: "m", digits: 2,
      },
      {
        key: "festoon.cablePackageWeight", label: "Hareketli Kablo Paketi",
        formula: "mühendis girdisi",
        subst: (x) => `${n(x.inp.festoonCablePackageWeightKg)}`,
        unit: "kg", digits: 2,
      },
      {
        key: "festoon.trolleyCount", label: "Kablo Taşıyıcı Adedi",
        formula: "mühendis girdisi",
        subst: (x) => `${n(x.inp.festoonTrolleyCount)}`,
      },
      {
        key: "festoon.loadPerTrolley", label: "Taşıyıcı Başına Yük",
        formula: "G_taşıyıcı = G_kablo / n_taşıyıcı",
        subst: (x) =>
          `${n(x.inp.festoonCablePackageWeightKg)} / ${n(x.inp.festoonTrolleyCount)}`,
        unit: "kg", digits: 2,
      },
      {
        key: "festoon.catalogLoad", label: "Katalog Çalışma Yükü",
        valueFrom: (x) => x.sel.festoonTrolleyLoadKg || "Katalogdan ürün seçilmedi",
        formula: "seçilen katalog satırı (seri × kablo formu)",
        unit: "kg", digits: 2,
      },
      {
        key: "festoon.catalogSpeed", label: "Katalog Hız Sınırı",
        valueFrom: (x) => x.sel.festoonMaxSpeedMpm || "Katalogda yayımlanmamış",
        formula: "katalogda yayımlanmışsa; yoksa üretici teyidi gerekir",
        unit: "m/dak", digits: 1,
      },
      {
        key: "festoon.loopHeight", label: "Azami Loop Yüksekliği",
        formula: "mühendis girdisi — sistem yüksekliği ve alt gabari kontrolü için",
        subst: (x) => `${n(x.inp.festoonLoopHeightM)}`,
        unit: "m", digits: 2,
      },
    ],
    checkSuffixes: ["festoon.capacity", "festoon.speed"],
  },
];
