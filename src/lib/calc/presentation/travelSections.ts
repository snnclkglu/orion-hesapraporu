// Yürütme grubu sunum katmanı: Excel'in bölüm yapısı (5.1 ... 5.8 araba) +
// her hesap satırının SEMBOLİK FORMÜLÜ ve SAYILARIN YERİNE KONMUŞ hali.
// Hesabın kendisi travelGroup.ts'tedir (golden testli); burası yalnız gösterimdir.
//
// Bölüm id'leri ARABA (05) numaralarını taşır; köprü aynı listeyi kullanır ve
// UI numarayı 6.x'e çevirir (fren bölümü `bridgeOnly` işaretlidir ve Excel'de
// 6.6'dır; sonraki bölümler köprüde +1 kayar: 5.6→6.7, 5.7→6.8, 5.8→6.9/6.10).
// Hücre adresleri sayfalar arasında farklıdır: `cell` araba (05) adresi,
// `bridgeCell` köprü (06) adresidir; UI varyanta göre doğru adresi okur.

import type {
  TravelDeps,
  TravelInputs,
  TravelSelections,
  TravelValues,
  TravelWhich,
} from "../modules/travelGroup";
import type { TechnicalSpecs } from "../types";

export interface TravelCtx {
  c: Record<string, number | string>; // hücre haritası (motor çıktısı)
  v: TravelValues;                    // isimli değerler (varyanttan bağımsız erişim)
  inp: TravelInputs;
  sel: TravelSelections;
  specs: TechnicalSpecs;
  deps: TravelDeps;
  which: TravelWhich;
}

export interface TravelRowDef {
  cell: string;               // sonucun okunacağı Excel hücresi (araba/05 adresi)
  bridgeCell?: string;        // köprü (06) adresi — yoksa satır sadece arabada hücrelidir
  label: string;
  formula?: string;           // sembolik formül
  subst?: (ctx: TravelCtx) => string; // sayılar yerine konmuş hali
  unit?: string;
  digits?: number;
  standard?: string;
}

export interface TravelSectionDef {
  id: string;                 // "5.1" (araba numarası; UI köprüde 6.x'e çevirir)
  title: string;
  description?: string;
  /** Sadece köprü varyantında gösterilir (Excel 6.6 fren bölümü) */
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

export const TRAVEL_SECTIONS: TravelSectionDef[] = [
  {
    id: "5.1",
    title: "Tekerlekler",
    description:
      "Tekerlek yükleri ve yüzey basıncı kontrolü (FEM 1.001). Köprüde maksimum/minimum yükler araba yanaşma eksantrikliğiyle hesaplanır.",
    inputKeys: ["trolleyWeightT", "bridgeWeightT", "otherWeightsT", "minApproachM", "wheelCount"],
    selectionKeys: ["railCode", "wheelMaterial", "wheelTensileNmm2", "wheelDiaMm"],
    rows: [
      {
        cell: "L11", bridgeCell: "L15", label: "Maksimum tekerlek yükü Pmax",
        formula: "Pmax = ΣG / n_teker · 1000  (köprüde yanaşma eksantrik)",
        subst: (x) =>
          x.which === "trolley"
            ? `(${n(x.inp.trolleyWeightT)} + ${n(x.specs.mainCapacityT)} + ${n(x.deps.hookEquipmentT)}) / ${n(x.inp.wheelCount)} · 1000`
            : `((${n(x.specs.mainCapacityT)} + ${n(x.deps.trolleyWeightT)}) · (${n(x.specs.spanM)} − ${n(x.inp.minApproachM)})/${n(x.specs.spanM)} + (${n(x.inp.bridgeWeightT)} + ${n(x.inp.otherWeightsT)})/2) · 1000 / (${n(x.inp.wheelCount)}/2)`,
        unit: "kg",
      },
      {
        cell: "L12", bridgeCell: "L16", label: "Minimum tekerlek yükü Pmin",
        formula: "Pmin = ΣG_min / n_teker · 1000",
        subst: (x) =>
          x.which === "trolley"
            ? `(${n(x.inp.trolleyWeightT)} + ${n(x.deps.hookEquipmentT)}) / ${n(x.inp.wheelCount)} · 1000`
            : `(${n(x.deps.trolleyWeightT)} · ${n(x.inp.minApproachM)}/${n(x.specs.spanM)} + (${n(x.inp.bridgeWeightT)} + ${n(x.inp.otherWeightsT)})/2) · 1000 / (${n(x.inp.wheelCount)}/2)`,
        unit: "kg",
      },
      {
        cell: "L13", bridgeCell: "L17", label: "Ortalama tekerlek yükü Port",
        formula: "Port = (2·Pmax + Pmin) / 3",
        subst: (x) => `(2·${n(x.v.maxWheelLoadKg)} + ${n(x.v.minWheelLoadKg)}) / 3`,
        unit: "kg",
      },
      {
        cell: "L15", bridgeCell: "L19", label: "Ray temas yüzeyi genişliği b",
        formula: "b = f(ray)  [KATSAYILAR tablosu]",
        subst: (x) => `${x.sel.railCode} → ${n(x.v.railHeadWidthMm)}`,
        unit: "mm",
      },
      {
        cell: "L19", bridgeCell: "L23", label: "Tekerlek devri",
        formula: "n_t = v / (D/1000) / π",
        subst: (x) =>
          `${n(x.which === "trolley" ? x.specs.trolleySpeedMpm : x.specs.bridgeSpeedMpm)} / (${n(x.sel.wheelDiaMm)}/1000) / π`,
        unit: "d/dak",
      },
      {
        cell: "L20", bridgeCell: "L24", label: "Teker dönüş hızı katsayısı c1",
        formula: "c1 = f(D, v)  [FEM tablosu]",
        subst: (x) => `D=${n(x.sel.wheelDiaMm)}, v=${n(x.which === "trolley" ? x.specs.trolleySpeedMpm : x.specs.bridgeSpeedMpm)} → ${n(x.v.c1)}`,
        standard: "FEM 1.001 T.4.2.4.1.4.a",
      },
      {
        cell: "L21", bridgeCell: "L25", label: "Mekanizma katsayısı c2",
        formula: "c2 = f(mekanizma sınıfı)",
        subst: (x) => `${x.specs.hoistMechanismClass} → ${n(x.v.c2)}`,
        standard: "FEM 1.001 T.4.2.4.1.5",
      },
      {
        cell: "L22", bridgeCell: "L26", label: "Limit gerilme değeri PL",
        formula: "PL = f(çekme dayanımı)",
        subst: (x) => `${n(x.sel.wheelTensileNmm2)} N/mm² → ${n(x.v.limitPressure)}`,
        unit: "N/mm²", standard: "FEM 1.001 T.4.2.4.1.3",
      },
      {
        cell: "L23", bridgeCell: "L27", label: "Gerçekleşen basınç Port/(b·D)",
        formula: "p = Port · 9,81 / (b · D)",
        subst: (x) => `${n(x.v.avgWheelLoadKg)} · 9,81 / (${n(x.v.railHeadWidthMm)} · ${n(x.sel.wheelDiaMm)})`,
        unit: "N/mm²",
      },
      {
        cell: "L24", bridgeCell: "L28", label: "İzin verilen basınç PL·c1·c2",
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
    description: "Mesnet reaksiyonları, eğilme/kesme ve bileşik gerilme kontrolü.",
    inputKeys: ["shaftSpanACm", "shaftSpanBCm", "shaftDiaCm", "stressConcFactor"],
    selectionKeys: ["shaftMaterial"],
    rows: [
      {
        cell: "L46", bridgeCell: "L50", label: "Mesnet reaksiyonu RA",
        formula: "R_A = Pmax / 2",
        subst: (x) => `${n(x.v.maxWheelLoadKg)} / 2`, unit: "kg",
      },
      {
        cell: "L51", bridgeCell: "L55", label: "Maksimum moment Mmaks",
        formula: "M = R_A · a",
        subst: (x) => `${n(x.v.reactionAKg)} · ${n(x.inp.shaftSpanACm)}`, unit: "kg·cm",
      },
      {
        cell: "L56", bridgeCell: "L60", label: "Kesit modülü S",
        formula: "S = π · D³ / 32",
        subst: (x) => `π · ${n(x.inp.shaftDiaCm)}³ / 32`, unit: "cm³",
      },
      {
        cell: "L61", bridgeCell: "L65", label: "Maksimum eğilme gerilmesi",
        formula: "σ_eğ = M · k / S",
        subst: (x) => `${n(x.v.maxMomentKgCm)} · ${n(x.inp.stressConcFactor)} / ${n(x.v.sectionModulusCm3)}`,
        unit: "kg/cm²",
      },
      {
        cell: "L65", bridgeCell: "L69", label: "Kesme gerilmesi",
        formula: "τ = R_B / (π · (D/2)²) · k",
        subst: (x) => `${n(x.v.reactionBKg)} / (π · ${n(x.inp.shaftDiaCm / 2)}²) · ${n(x.inp.stressConcFactor)}`,
        unit: "kg/cm²",
      },
      {
        cell: "L69", bridgeCell: "L73", label: "Bileşik gerilme",
        formula: "σ_b = √(σ_eğ² + 3·τ²)",
        subst: (x) => `√(${n(x.v.shaftBendingStress)}² + 3·${n(x.v.shaftShearStress)}²)`,
        unit: "kg/cm²",
      },
      {
        cell: "L75", bridgeCell: "L79", label: "İzin verilen bileşik gerilme",
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
    description: "Eşdeğer yükler, statik emniyet ve L10 yorulma ömrü (FEM T.2.1.3.2).",
    inputKeys: ["bearingCount", "bearingFactorY0", "bearingFactorY1"],
    selectionKeys: ["bearingType", "bearingCode", "bearingDynCKn", "bearingStatC0Kn"],
    rows: [
      {
        cell: "L82", bridgeCell: "L86", label: "Rulman radyal yükü Fr",
        formula: "F_r = Port · 9,81 / 1000 / n_rulman",
        subst: (x) => `${n(x.v.avgWheelLoadKg)} · 9,81 / 1000 / ${n(x.inp.bearingCount)}`,
        unit: "kN",
      },
      {
        cell: "L83", bridgeCell: "L87", label: "Rulman eksenel yükü Fa",
        formula: "F_a = 0,1 · F_r",
        subst: (x) => `0,1 · ${n(x.v.bearingRadialKn)}`, unit: "kN",
      },
      {
        cell: "L89", bridgeCell: "L93", label: "Eşdeğer statik yük P₀",
        formula: "P₀ = F_r + F_a · Y₀",
        subst: (x) => `${n(x.v.bearingRadialKn)} + ${n(x.v.bearingAxialKn)} · ${n(x.inp.bearingFactorY0)}`,
        unit: "kN",
      },
      {
        cell: "L90", bridgeCell: "L94", label: "Eşdeğer dinamik yük P",
        formula: "P = F_r + Y₁ · F_a",
        subst: (x) => `${n(x.v.bearingRadialKn)} + ${n(x.inp.bearingFactorY1)} · ${n(x.v.bearingAxialKn)}`,
        unit: "kN",
      },
      {
        cell: "L98", bridgeCell: "L102", label: "Statik emniyet katsayısı S₀",
        formula: "S₀ = C₀ / P₀",
        subst: (x) => `${n(x.sel.bearingStatC0Kn)} / ${n(x.v.bearingEqStaticKn)}`,
      },
      {
        cell: "L101", bridgeCell: "L107", label: "Rulman ömrü (L10)",
        formula: "L₁₀ = (10⁶ / (60·n)) · (C/P)^(10/3)",
        subst: (x) => `(10⁶ / (60·${n(x.v.wheelRpm)})) · (${n(x.sel.bearingDynCKn)}/${n(x.v.bearingEqDynamicKn)})^(10/3)`,
        unit: "saat", digits: 0, standard: "FEM 1.001 T.2.1.3.2",
      },
      {
        cell: "L103", bridgeCell: "L109", label: "Gerekli minimum ömür",
        formula: "L_min = f(kullanım sınıfı)",
        subst: (x) => `${x.specs.hoistUsageClass} → ${n(x.v.requiredLifeMin, 0)}`,
        unit: "saat", digits: 0,
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
        cell: "L107", bridgeCell: "L113", label: "Toplam ağırlık W",
        formula: "W = ΣG · 1000",
        subst: (x) => `${n(x.v.totalWeightKg / 1000)} t · 1000`, unit: "kg",
      },
      {
        cell: "L108", bridgeCell: "L114", label: "Tasarım ağırlığı (%10 pay)",
        formula: "W' = W · 1,1 / 1000",
        subst: (x) => `${n(x.v.totalWeightKg)} · 1,1 / 1000`, unit: "ton",
      },
      {
        cell: "L109", bridgeCell: "L115", label: "Yürütme hızı V (gerçek)",
        formula: "V = (n_m / i) · π · D",
        subst: (x) => `(${n(x.sel.motorRpm)} / ${n(x.sel.gearboxRatio)}) · π · ${n(x.sel.wheelDiaMm / 1000, 3)}`,
        unit: "m/dak",
      },
      {
        cell: "L110", bridgeCell: "L117", label: "Kalkış süresi t",
        formula: "t = V / 60 / a",
        subst: (x) => `${n(x.v.actualSpeedMpm)} / 60 / ${n(x.inp.accelerationMs2)}`, unit: "sn",
      },
      {
        cell: "L114", bridgeCell: "L121", label: "Sürtünme katsayısı f",
        formula: "f = f(teker çapı)",
        subst: (x) => `D=${n(x.sel.wheelDiaMm)} → ${n(x.v.frictionFactor)}`,
        unit: "lb/ton", standard: "CMAA 70 T.5.2.9.1.2.1-D",
      },
      {
        cell: "L115", bridgeCell: "L122", label: "Verim E",
        formula: "E = 0,98^kademe",
        subst: (x) => `0,98^${n(x.inp.reducerStages)}`, digits: 4,
      },
      {
        cell: "L118", bridgeCell: "L125", label: "Dönme atalet faktörü Cr",
        formula: "Cr = 1,05 + (a·3,28 / 7,5)",
        subst: (x) => `1,05 + (${n(x.inp.accelerationMs2)}·3,28 / 7,5)`, digits: 4,
      },
      {
        cell: "L119", bridgeCell: "L126", label: "İvmelenme faktörü Ka",
        formula: "Ka = (f + 2000·a·Cr / (9,81·E)) / (Kt·33000)",
        subst: (x) =>
          `(${n(x.v.frictionFactor)} + 2000·${n(x.inp.accelerationMs2)}·${n(x.v.rotationInertiaFactor, 4)} / (9,81·${n(x.v.reducerEfficiency, 4)})) / (${n(x.inp.accelTorqueFactorKt)}·33000)`,
        digits: 6, standard: "CMAA 70 5.2.9.1.2.1",
      },
      {
        cell: "L120", bridgeCell: "L127", label: "Gerekli güç",
        formula: "P = W' · (V·3,28) · Ka · Ks · 0,745",
        subst: (x) =>
          `${n(x.v.designWeightTons)} · (${n(x.v.actualSpeedMpm)}·3,28) · ${n(x.v.accelFactorKa, 6)} · ${n(x.inp.serviceFactorKs)} · 0,745`,
        unit: "kW",
      },
      {
        cell: "L122", bridgeCell: "L129", label: "Gerekli maksimum güç PNmax",
        formula: "P' = k_t · P",
        subst: (x) => `${n(x.inp.tempFactor)} · ${n(x.v.requiredPowerKw)}`, unit: "kW",
      },
      {
        cell: "I133", bridgeCell: "I140", label: "Kurulu güç",
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
        cell: "L138", bridgeCell: "L145", label: "Gereken tahvil oranı",
        formula: "i_g = n_motor / n_teker",
        subst: (x) => `${n(x.sel.motorRpm)} / ${n(x.v.wheelRpm)}`,
      },
      {
        cell: "L140", bridgeCell: "L147", label: "Oran sapması",
        formula: "Δi = 100 · (i_g − i_seç) / i_g",
        subst: (x) => `100 · (${n(x.v.requiredRatio)} − ${n(x.sel.gearboxRatio)}) / ${n(x.v.requiredRatio)}`,
        unit: "%",
      },
      {
        cell: "L141", bridgeCell: "L148", label: "Gerçek hız",
        formula: "V = (n_m / i) · π · D",
        subst: (x) => `(${n(x.sel.motorRpm)} / ${n(x.sel.gearboxRatio)}) · π · ${n(x.sel.wheelDiaMm / 1000, 3)}`,
        unit: "m/dak",
      },
      {
        cell: "L148", bridgeCell: "L153", label: "Gerekli nominal giriş torku TGN",
        formula: "T_g = 9550 · P_motor / n_m",
        subst: (x) => `9550 · ${n(x.v.requiredPowerPerMotorKw)} / ${n(x.sel.motorRpm)}`,
        unit: "Nm",
      },
      {
        cell: "L150", bridgeCell: "L154", label: "Nominal çıkış torku Tnom",
        formula: "T_nom = T_g · i",
        subst: (x) => `${n(x.v.requiredInputTorqueNm)} · ${n(x.sel.gearboxRatio)}`, unit: "Nm",
      },
      {
        cell: "L152", bridgeCell: "L156", label: "Gereken minimum çıkış torku",
        formula: "T_gerekli = T_nom · k_e",
        subst: (x) => `${n(x.v.nominalOutputTorqueNm)} · ${n(x.inp.gearboxServiceFactor)}`, unit: "Nm",
      },
      {
        cell: "L157", bridgeCell: "L161", label: "Gerçekleşen emniyet katsayısı",
        formula: "n = T_seçilen / (T_nom / 1000)",
        subst: (x) => `${n(x.sel.gearboxOutputTorqueKnm)} / (${n(x.v.nominalOutputTorqueNm)} / 1000)`,
      },
    ],
    // Arabada gearbox.safety (Excel 05!O157), köprüde gearbox.torque
    // (Excel'in bozuk 06!O160'ının düzeltilmişi) üretilir; UI mevcut olanı gösterir.
    checkSuffixes: ["gearbox.ratio", "gearbox.safety", "gearbox.torque"],
  },
  {
    id: "5.5b",
    title: "Yürütme Freni",
    description:
      "Sadece köprü varyantı (Excel 6.6). V5 raporunda fren seçilmemiştir; kontrol başarısızdır.",
    bridgeOnly: true,
    inputKeys: ["brakeServiceFactor"],
    selectionKeys: ["brakeBrand", "brakeTorqueNm", "brakeWheelDiaMm"],
    rows: [
      {
        // bridgeOnly bölümde adresler köprü (06) sayfasınındır
        cell: "L167", bridgeCell: "L167", label: "Fren miline gelen tork TN",
        formula: "T_N = T_g (giriş torku)",
        subst: (x) => `${n(x.v.requiredInputTorqueNm)}`, unit: "Nm",
      },
      {
        cell: "L169", bridgeCell: "L169", label: "Gerekli fren tork kapasitesi",
        formula: "T_f = T_N · k_f",
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
        cell: "L164", bridgeCell: "L178", label: "Gerekli kaplin tork kapasitesi",
        formula: "T_k = T_N · k",
        subst: (x) => `${n(x.v.requiredInputTorqueNm)} · ${n(x.inp.motorCouplingServiceFactor)}`,
        unit: "Nm",
      },
      {
        cell: "L171", label: "Gerçekleşen emniyet",
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
        cell: "L174", bridgeCell: "L188", label: "Dişli kutusu çıkış momenti",
        formula: "T_ç = T_nom",
        subst: (x) => `${n(x.v.nominalOutputTorqueNm)}`, unit: "Nm",
      },
      {
        cell: "L176", bridgeCell: "L190", label: "Gerekli kaplin tork kapasitesi",
        formula: "T_k = T_ç · k",
        subst: (x) => `${n(x.v.nominalOutputTorqueNm)} · ${n(x.inp.wheelCouplingServiceFactor)}`,
        unit: "Nm",
      },
      {
        cell: "L183", label: "Gerçekleşen emniyet",
        formula: "n = T_kaplin / T_ç",
        subst: (x) => `${n(x.sel.wheelCouplingTorqueNm)} / ${n(x.v.nominalOutputTorqueNm)}`,
      },
    ],
    checkSuffixes: ["wheelCoupling.torque", "wheelCoupling.bore"],
  },
  {
    id: "5.8",
    title: "Tampon",
    description:
      "Çarpma enerjisi + yürütme enerjisi ile tampon seçimi. Köprüde çarpışma yükü eksantriktir ve 0,7 hız faktörü uygulanır.",
    inputKeys: ["bufferApproachM"],
    selectionKeys: ["bufferModel", "bufferStrokeMm", "bufferEnergyKj", "bufferLoadKn"],
    rows: [
      {
        cell: "L189", bridgeCell: "L205", label: "Çarpışma yükü We1",
        formula: "We1 = G_araba  (köprüde: G_köprü/2 + G_araba·(L−y)/L)",
        subst: (x) =>
          x.which === "trolley"
            ? `${n(x.inp.trolleyWeightT)}`
            : `(${n(x.inp.bridgeWeightT + x.inp.otherWeightsT)}/2) + ${n(x.deps.trolleyWeightT)}·(${n(x.specs.spanM)} − ${n(x.inp.bufferApproachM)})/${n(x.specs.spanM)}`,
        unit: "t",
      },
      {
        cell: "L191", bridgeCell: "L207", label: "Çarpma enerjisi",
        formula: "E_ç = 0,5 · We1 · (v/60)²  (köprüde v yerine 0,7·v)",
        subst: (x) =>
          x.which === "trolley"
            ? `0,5 · ${n(x.v.collisionLoadT)} · (${n(x.v.actualSpeedMpm)}/60)²`
            : `0,5 · ${n(x.v.collisionLoadT)} · (0,7·${n(x.v.actualSpeedMpm)}/60)²`,
        unit: "kJ", digits: 3,
      },
      {
        cell: "L197", bridgeCell: "L213", label: "Yürütme yükü / motor D''",
        formula: "D'' = P · i · 9550 / n",
        subst: (x) =>
          `${n(x.which === "trolley" ? x.v.requiredPowerPerMotorKw : x.sel.motorPowerKw)} · ${n(x.sel.gearboxRatio)} · 9550 / ${n(x.sel.motorRpm)}`,
        unit: "N",
      },
      {
        cell: "L200", bridgeCell: "L216", label: "Toplam yürütme yükü D'",
        formula: "D' = D'' · motor sayısı",
        subst: (x) => `${n(x.v.driveLoadPerMotorN)} · ${n(x.sel.motorCount)}`, unit: "N",
      },
      {
        cell: "L202", bridgeCell: "L218", label: "Tampon başına yürütme yükü",
        formula: "D = D' / 2",
        subst: (x) => `${n(x.v.totalDriveLoadN)} / 2`, unit: "N",
      },
      {
        cell: "L205", bridgeCell: "L221", label: "Yürütme enerjisi D·s",
        formula: "E_d = D · s / 10⁶",
        subst: (x) => `${n(x.v.bufferDriveLoadN)} · ${n(x.sel.bufferStrokeMm)} / 10⁶`,
        unit: "kJ", digits: 4,
      },
      {
        cell: "L207", bridgeCell: "L223", label: "Toplam sönümlenmesi gereken enerji",
        formula: "E = E_d + E_ç",
        subst: (x) => `${n(x.v.bufferDriveLoadN * x.sel.bufferStrokeMm / 1e6, 4)} + ${n(x.v.impactEnergyKj, 3)}`,
        unit: "kJ", digits: 3,
      },
      {
        cell: "L211", bridgeCell: "L227", label: "Tampon yükü",
        formula: "F_t = E / (s/1000) / 0,8 + D/1000",
        subst: (x) =>
          `${n(x.v.totalEnergyKj, 3)} / (${n(x.sel.bufferStrokeMm)}/1000) / 0,8 + ${n(x.v.bufferDriveLoadN)}/1000`,
        unit: "kN",
      },
    ],
    checkSuffixes: ["buffer.energy", "buffer.load"],
  },
];
