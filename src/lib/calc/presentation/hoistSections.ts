// Kaldırma grubu sunum katmanı: bölüm yapısı (2.1 … 2.7) + her hesap satırının
// SEMBOLİK FORMÜLÜ ve SAYILARIN YERİNE KONMUŞ hali.
//
// Hesabın kendisi `modules/hoistGroup.ts`tedir; burası yalnız gösterimdir.
// Satırlar sonucu motorun semantik anahtarından (`key`) okur; PDF raporun
// formül satırlarını da bu katman üretir.

import { hoistSpecView } from "../modules/hoistGroup";
import type {
  HoistInputs,
  HoistSelections,
  HoistWhich,
} from "../modules/hoistGroup";
import type { TechnicalSpecs } from "../types";

export interface HoistCtx {
  c: Record<string, number | string>; // semantik anahtar → değer (motor çıktısı)
  inp: HoistInputs;
  sel: HoistSelections;
  specs: TechnicalSpecs;
  which: HoistWhich;
}

/**
 * Bu kaldırma grubunun teknik özelliklerden okunan büyüklükleri.
 * Ana, yardımcı ve monoray kaldırma grupları aynı sunumu paylaşır; hangi
 * alanın okunacağını motorun `hoistSpecView`'ı belirler.
 */
const viewOf = (x: HoistCtx) => hoistSpecView(x.specs, x.which);

export interface HoistRowDef {
  /** Sonucun okunacağı semantik anahtar (`<blok>.<büyüklük>`) */
  key: string;
  label: string;
  formula?: string;          // sembolik formül (ör. "F = G / n / η")
  subst?: (ctx: HoistCtx) => string; // sayılar yerine konmuş hali
  unit?: string;
  digits?: number;
  standard?: string;
}

export interface HoistSectionDef {
  id: string;                // "2.1"
  title: string;
  description?: string;
  inputKeys: (keyof HoistInputs & string)[];
  selectionKeys: (keyof HoistSelections & string)[];
  rows: HoistRowDef[];
  /** Bölümde gösterilecek kontrol id sonekleri (örn. "rope.safety") */
  checkSuffixes: string[];
}

// Sayı biçimleyici (formül substitüsyonu için, TR yerel)
const n = (v: number | string | undefined, d = 2): string => {
  if (v === undefined) return "?";
  if (typeof v === "string") return v;
  if (Number.isInteger(v)) return String(v);
  return v.toLocaleString("tr-TR", { maximumFractionDigits: d });
};
const num = (v: number | string | undefined): number => (typeof v === "number" ? v : NaN);

export const HOIST_SECTIONS: HoistSectionDef[] = [
  {
    id: "2.1",
    title: "Halat",
    description:
      "Donanım, halat verimi, halat yükü ve halat seçimi (FEM 1.001). Tek makara " +
      "verimi, rulmanlı yataklı makara (yüksek verim) standart kabulüdür.",
    inputKeys: [
      "reevingLabel", "drivenFalls", "totalFalls", "sheaveEfficiency",
      "fixedSheaveCount", "hookBlockWeightKg", "ropeWeightKg",
    ],
    selectionKeys: [
      "ropeBrand", "ropeDiaMm", "ropeConstruction", "ropeCore",
      "ropeWireStrength", "ropeBreakingLoadKn", "ropeWeightKgPerM",
    ],
    rows: [
      {
        key: "reeving.mechanicalAdvantage", label: "Mekanik Avantaj",
        formula: "i = n_toplam / n_tahrik",
        subst: (x) => `${n(x.inp.totalFalls)} / ${n(x.inp.drivenFalls)}`,
      },
      {
        key: "reeving.ropeEfficiency", label: "Halat Donanımı Verimi",
        formula: "η = (η_m^s / i) · (1 − η_m^i) / (1 − η_m)",
        subst: (x) => `(${n(x.inp.sheaveEfficiency, 3)}^${n(x.inp.fixedSheaveCount)} / ${n(num(x.c["reeving.mechanicalAdvantage"]))}) · (1 − ${n(x.inp.sheaveEfficiency, 3)}^${n(num(x.c["reeving.mechanicalAdvantage"]))}) / (1 − ${n(x.inp.sheaveEfficiency, 3)})`,
        digits: 4,
      },
      {
        key: "load.hoisted", label: "Kaldırılan Yük", formula: "G_yük = Q · 1000",
        subst: (x) => `${n(viewOf(x).capacityT)} · 1000`,
        unit: "kg",
      },
      {
        key: "load.total", label: "Toplam Yük", formula: "G_t = G_yük + G_blok + G_halat",
        subst: (x) => `${n(num(x.c["load.hoisted"]))} + ${n(x.inp.hookBlockWeightKg)} + ${n(x.inp.ropeWeightKg)}`,
        unit: "kg",
      },
      {
        key: "rope.requiredSafety", label: "Gerekli Halat Emniyet Katsayısı",
        formula: "Zp = f(mekanizma sınıfı)  [FEM tablosu]",
        subst: (x) =>
          `${viewOf(x).mechanismClass} → ${n(num(x.c["rope.requiredSafety"]))}`,
        standard: "FEM 1.001 T.4.2.2.1.2",
      },
      {
        key: "rope.load", label: "Halat Yükü", formula: "F = G_t / n_toplam / η",
        subst: (x) => `${n(num(x.c["load.total"]))} / ${n(x.inp.totalFalls)} / ${n(num(x.c["reeving.ropeEfficiency"]), 4)}`,
        unit: "kg",
      },
      {
        key: "rope.requiredBreakingLoad", label: "Gerekli Min. Kopma Yükü",
        formula: "F_k,min = F · Zp",
        subst: (x) => `${n(num(x.c["rope.load"]))} · ${n(num(x.c["rope.requiredSafety"]))}`,
        unit: "kg",
      },
      {
        key: "rope.breakingLoad", label: "Seçilen Halatın Kopma Yükü",
        formula: "F_k = F_k,kN / 9,81 · 1000",
        subst: (x) => `${n(x.sel.ropeBreakingLoadKn)} / 9,81 · 1000`, unit: "kg",
      },
      {
        key: "rope.actualSafety", label: "Gerçekleşen Emniyet Katsayısı",
        formula: "n = F_k / F",
        subst: (x) => `${n(num(x.c["rope.breakingLoad"]))} / ${n(num(x.c["rope.load"]))}`,
      },
    ],
    checkSuffixes: ["rope.safety"],
  },
  {
    id: "2.2.1",
    title: "Tambur — Çap ve Gövde",
    description: "Minimum tambur çapı (FEM H katsayısı) ve tambur sacı gerilme kontrolü.",
    inputKeys: ["drumWallThicknessMm"],
    selectionKeys: ["drumDiaMm", "drumMaterial"],
    rows: [
      {
        key: "drum.coefficient", label: "Tambur Çap Katsayısı",
        formula: "H = f(mekanizma sınıfı)  [FEM tablosu]",
        subst: (x) =>
          `${viewOf(x).mechanismClass} → ${n(num(x.c["drum.coefficient"]))}`,
        standard: "FEM 1.001 T.4.2.3.1.1",
      },
      {
        key: "drum.minDia", label: "Minimum Tambur Çapı", formula: "D_min = H · d",
        subst: (x) => `${n(num(x.c["drum.coefficient"]))} · ${n(x.sel.ropeDiaMm)}`, unit: "mm",
      },
      {
        key: "drum.groovePitch", label: "Hatve p", formula: "p = d + pay  [DIN 15061]",
        subst: (x) => `${n(x.sel.ropeDiaMm)} + ${n(num(x.c["drum.groovePitch"]) - x.sel.ropeDiaMm, 1)}`,
        unit: "mm", standard: "DIN 15061",
      },
      {
        key: "drum.bearingStress", label: "Ezilme Gerilmesi",
        formula: "σ_ez = 0,5 · F · 100 / (p · s)",
        subst: (x) => `0,5 · ${n(num(x.c["rope.load"]))} · 100 / (${n(num(x.c["drum.groovePitch"]))} · ${n(x.inp.drumWallThicknessMm)})`,
        unit: "kg/cm²",
      },
      {
        key: "drum.bendingStress", label: "Eğilme Gerilmesi",
        formula: "σ_eğ = 0,96 · F · (1 / ((D/10)² · (s/10)⁶))^0,25",
        subst: (x) => `0,96 · ${n(num(x.c["rope.load"]))} · (1 / ((${n(x.sel.drumDiaMm)}/10)² · (${n(x.inp.drumWallThicknessMm)}/10)⁶))^0,25`,
        unit: "kg/cm²",
      },
      {
        key: "drum.combinedStress", label: "Bileşik Gerilme",
        formula: "σ_b = √(σ_eğ² + σ_ez² − σ_ez·σ_eğ)",
        subst: (x) => `√(${n(num(x.c["drum.bendingStress"]))}² + ${n(num(x.c["drum.bearingStress"]))}² − ${n(num(x.c["drum.bearingStress"]))}·${n(num(x.c["drum.bendingStress"]))})`,
        unit: "kg/cm²",
      },
      {
        key: "drum.allowableStress", label: "İzin Verilen Gerilme",
        formula: "σ_em = f(malzeme)",
        subst: (x) => `${x.sel.drumMaterial} → ${n(num(x.c["drum.allowableStress"]))}`,
        unit: "kg/cm²",
      },
    ],
    checkSuffixes: ["drum.stress", "drum.dia"],
  },
  {
    id: "2.2.2",
    title: "Tambur — Oluk Boyu",
    inputKeys: ["safetyGrooveCount"],
    selectionKeys: ["drumGrooveLengthText"],
    rows: [
      {
        key: "drum.requiredGrooves", label: "Gerekli Sarım Sayısı",
        formula: "z = (i · h) / (π · D) + z_emn",
        subst: (x) => `(${n(num(x.c["reeving.mechanicalAdvantage"]))} · ${n(viewOf(x).liftHeightM)}) / (π · ${n(x.sel.drumDiaMm / 1000, 3)}) + ${n(x.inp.safetyGrooveCount)}`,
      },
      {
        key: "drum.requiredGrooveLength", label: "Gerekli Oluk Boyu", formula: "L = z · p",
        subst: (x) => `${n(num(x.c["drum.requiredGrooves"]))} · ${n(num(x.c["drum.groovePitch"]))}`,
        unit: "mm", digits: 1,
      },
    ],
    checkSuffixes: [],
  },
  {
    id: "2.2.3",
    title: "Tambur Mili",
    description:
      "Tambur, redüktör tarafı mesnet (Ra) ile tambur yatağı tarafı mesnet (Rg) " +
      "arasında iki mesnetli kiriş olarak çözülür. Yükler: her yiv bölgesindeki " +
      "halat yükü T ve namlu ortasındaki tambur ağırlığı W. Reaksiyonlar hem " +
      "redüktör radyal yük kontrolünde hem tambur yatağı / rulman seçiminde " +
      "kullanılır; mil gerilmeleri D1 kesitinde (eğilme) ve D2 kesitinde (kesme) " +
      "bulunur. Halatlar yiv boyunca hareket ettiğinden iki uç hâli ayrı ayrı " +
      "çözülür; her mesnet KENDİ elverişsiz hâliyle boyutlandırılır (zarf değeri).",
    inputKeys: [
      "drumWeightKg",
      "drumSpanACm", "drumSpanBCm", "drumSpanCCm", "drumSpanDCm",
      "drumSpanECm", "drumSpanFCm", "drumSpanGCm",
      "ropeLoadPosition", "shaftD1Cm", "shaftD2Cm",
    ],
    selectionKeys: ["shaftMaterial"],
    rows: [
      {
        key: "drumShaft.ropeLoadPerPoint", label: "Yük Noktası Başına Halat Yükü (T)",
        formula: "T = F_halat · n_tahrik / yiv bölgesi adedi",
        subst: (x) => `${n(num(x.c["rope.load"]))} · ${n(x.inp.drivenFalls)} / ${n(x.inp.drumSpanECm > 0 ? 2 : 1)}`,
        unit: "kg",
      },
      {
        key: "drumShaft.span", label: "Mesnetler Arası Açıklık (L)",
        formula: "L = A + B + C + D + E + F + G",
        subst: (x) =>
          `${n(x.inp.drumSpanACm)} + ${n(x.inp.drumSpanBCm)} + ${n(x.inp.drumSpanCCm)} + ${n(x.inp.drumSpanDCm)} + ${n(x.inp.drumSpanECm)} + ${n(x.inp.drumSpanFCm)} + ${n(x.inp.drumSpanGCm)}`,
        unit: "cm",
      },
      {
        key: "drumShaft.weightArm", label: "Tambur Ağırlık Merkezi (Mesnet A'dan)",
        formula: "x_W = A + (B + C + D + E + F) / 2",
        subst: (x) =>
          `${n(x.inp.drumSpanACm)} + (${n(x.inp.drumSpanBCm + x.inp.drumSpanCCm + x.inp.drumSpanDCm + x.inp.drumSpanECm + x.inp.drumSpanFCm)}) / 2`,
        unit: "cm",
      },
      {
        key: "drumShaft.reactionBearingOuter", label: "Rg — Halatlar Dış Uçlarda",
        formula: "R_g = (T·x₁ + T·x₂ + W·x_W) / L",
        subst: (x) =>
          `(${n(num(x.c["drumShaft.ropeLoadPerPoint"]))}·${n(num(x.c["drumShaft.ropeXOuter1"]))} + ${n(num(x.c["drumShaft.ropeLoadPerPoint"]))}·${n(num(x.c["drumShaft.ropeXOuter2"]))} + ${n(x.inp.drumWeightKg)}·${n(num(x.c["drumShaft.weightArm"]))}) / ${n(num(x.c["drumShaft.span"]))}`,
        unit: "kg",
      },
      {
        key: "drumShaft.reactionGearboxOuter", label: "Ra — Halatlar Dış Uçlarda",
        formula: "R_a = ΣT + W − R_g",
        subst: (x) =>
          `${n(num(x.c["drumShaft.ropeLoadPerPoint"]) * 2)} + ${n(x.inp.drumWeightKg)} − ${n(num(x.c["drumShaft.reactionBearingOuter"]))}`,
        unit: "kg",
      },
      {
        key: "drumShaft.reactionBearingInner", label: "Rg — Halatlar İç Uçlarda",
        formula: "R_g = (T·x₁ + T·x₂ + W·x_W) / L",
        subst: (x) =>
          `(${n(num(x.c["drumShaft.ropeLoadPerPoint"]))}·${n(num(x.c["drumShaft.ropeXInner1"]))} + ${n(num(x.c["drumShaft.ropeLoadPerPoint"]))}·${n(num(x.c["drumShaft.ropeXInner2"]))} + ${n(x.inp.drumWeightKg)}·${n(num(x.c["drumShaft.weightArm"]))}) / ${n(num(x.c["drumShaft.span"]))}`,
        unit: "kg",
      },
      {
        key: "drumShaft.reactionGearboxInner", label: "Ra — Halatlar İç Uçlarda",
        formula: "R_a = ΣT + W − R_g",
        subst: (x) =>
          `${n(num(x.c["drumShaft.ropeLoadPerPoint"]) * 2)} + ${n(x.inp.drumWeightKg)} − ${n(num(x.c["drumShaft.reactionBearingInner"]))}`,
        unit: "kg",
      },
      {
        key: "drumShaft.reactionGearbox", label: "Tasarım Reaksiyonu — Redüktör Tarafı (Ra)",
        formula: "R_a = maks(R_a,dış ; R_a,iç)",
        subst: (x) =>
          `maks(${n(num(x.c["drumShaft.reactionGearboxOuter"]))} ; ${n(num(x.c["drumShaft.reactionGearboxInner"]))})`,
        unit: "kg",
      },
      {
        key: "drumShaft.reactionBearing", label: "Tasarım Reaksiyonu — Tambur Yatağı Tarafı (Rg)",
        formula: "R_g = maks(R_g,dış ; R_g,iç)",
        subst: (x) =>
          `maks(${n(num(x.c["drumShaft.reactionBearingOuter"]))} ; ${n(num(x.c["drumShaft.reactionBearingInner"]))})`,
        unit: "kg",
      },
      {
        key: "drumShaft.momentGearbox", label: "Redüktör Tarafı Eğilme Momenti",
        formula: "M_a = R_a · A",
        subst: (x) => `${n(num(x.c["drumShaft.reactionGearbox"]))} · ${n(x.inp.drumSpanACm)}`,
        unit: "kg·cm",
      },
      {
        key: "drumShaft.momentBearing", label: "Tambur Yatağı Tarafı Eğilme Momenti",
        formula: "M_g = R_g · G",
        subst: (x) => `${n(num(x.c["drumShaft.reactionBearing"]))} · ${n(x.inp.drumSpanGCm)}`,
        unit: "kg·cm",
      },
      {
        key: "drumShaft.moment", label: "Yönetici Eğilme Momenti (M)",
        formula: "M = maks(M_a, M_g)",
        subst: (x) =>
          `maks(${n(num(x.c["drumShaft.momentGearbox"]))}; ${n(num(x.c["drumShaft.momentBearing"]))})`,
        unit: "kg·cm",
      },
      {
        key: "drumShaft.bendingStress", label: "Eğilme Gerilmesi (D1 Kesiti)",
        formula: "σ = M / (π · D1³ / 32)",
        subst: (x) => `${n(num(x.c["drumShaft.moment"]))} / (π · ${n(x.inp.shaftD1Cm)}³ / 32)`,
        unit: "kg/cm²", standard: "CMAA 70 4.11.4.1",
      },
      {
        key: "drumShaft.shearStress", label: "Kesme Gerilmesi (D2 Kesiti)",
        // Dolu dairesel kesitte parabolik kayma dağılımının tepe değeri
        // ortalamanın 4/3 katıdır (tarafsız eksende).
        formula: "τ = (4/3) · R / (π · D2² / 4)",
        subst: (x) =>
          `(4/3) · ${n(Math.max(num(x.c["drumShaft.reactionGearbox"]), num(x.c["drumShaft.reactionBearing"])))} / (π · ${n(x.inp.shaftD2Cm)}² / 4)`,
        unit: "kg/cm²", standard: "CMAA 70 4.11.4.1",
      },
      {
        key: "drumShaft.combinedStress", label: "Bileşik Gerilme",
        formula: "σ_bil = √(σ² + τ²)",
        subst: (x) => `√(${n(num(x.c["drumShaft.bendingStress"]))}² + ${n(num(x.c["drumShaft.shearStress"]))}²)`,
        unit: "kg/cm²", standard: "CMAA 70 4.11.4.1",
      },
      {
        key: "drumShaft.allowableBending", label: "İzin Verilen Eğilme Gerilmesi",
        formula: "σ_em = f(mil malzemesi)",
        subst: (x) => `${x.sel.shaftMaterial} → ${n(num(x.c["drumShaft.allowableBending"]))}`,
        unit: "kg/cm²",
      },
      {
        key: "drumShaft.allowableShear", label: "İzin Verilen Kesme Gerilmesi",
        formula: "τ_em = f(mil malzemesi)",
        subst: (x) => `${x.sel.shaftMaterial} → ${n(num(x.c["drumShaft.allowableShear"]))}`,
        unit: "kg/cm²",
      },
      {
        key: "drumShaft.allowableCombined", label: "İzin Verilen Bileşik Gerilme",
        formula: "σ_em = f(mil malzemesi)",
        subst: (x) => `${x.sel.shaftMaterial} → ${n(num(x.c["drumShaft.allowableCombined"]))}`,
        unit: "kg/cm²",
      },
    ],
    checkSuffixes: ["shaft.bending", "shaft.shear", "shaft.stress"],
  },
  {
    id: "2.2.4",
    title: "Tambur Kaynağı",
    description:
      "Tambur yanağı ile göbek arasındaki çevresel kaynak: tambur torkundan " +
      "gelen burulma ile mesnet reaksiyonundan gelen kesme birlikte etkir.",
    inputKeys: ["drumWeldThicknessCm", "drumWeldAllowable"],
    selectionKeys: [],
    rows: [
      {
        key: "drumWeld.length", label: "Kaynak Boyu", formula: "L_k = π · D / 10",
        subst: (x) => `π · ${n(x.sel.drumDiaMm)} / 10`, unit: "cm",
      },
      {
        key: "drumWeld.area", label: "Kaynak Halka Alanı",
        formula: "A = π·((D_d/2)² − (D_i/2)²) / 100",
        subst: (x) => `π·((${n(num(x.c["drumWeld.outerDia"]))}/2)² − (${n(x.sel.drumDiaMm)}/2)²) / 100`,
        unit: "cm²",
      },
      {
        key: "drumWeld.polarModulus", label: "Polar Mukavemet Momenti",
        formula: "W_p = π·((D_d/10)⁴ − (D_i/10)⁴) / 32",
        subst: (x) => `π·((${n(num(x.c["drumWeld.outerDia"]))}/10)⁴ − (${n(x.sel.drumDiaMm)}/10)⁴) / 32`,
        unit: "cm³",
      },
      {
        key: "drumWeld.torsionStress", label: "Burulma Gerilmesi",
        formula: "τ_b = M_t · 100000 / 9,81 / W_p",
        subst: (x) => `${n(num(x.c["drum.torquePerDrum"]), 3)} · 100000 / 9,81 / ${n(num(x.c["drumWeld.polarModulus"]))}`,
        unit: "kg/cm²",
      },
      {
        key: "drumWeld.shearStress", label: "Kesme Gerilmesi",
        formula: "τ_k = R / A",
        subst: (x) => `${n(Math.max(num(x.c["drumShaft.reactionGearbox"]), num(x.c["drumShaft.reactionBearing"])))} / ${n(num(x.c["drumWeld.area"]))}`,
        unit: "kg/cm²",
      },
      {
        key: "drumWeld.combinedStress", label: "Bileşik Gerilme", formula: "σ_b = τ_k + τ_b",
        subst: (x) => `${n(num(x.c["drumWeld.shearStress"]))} + ${n(num(x.c["drumWeld.torsionStress"]))}`,
        unit: "kg/cm²",
      },
    ],
    checkSuffixes: ["drumWeld.stress"],
  },
  {
    id: "2.2.5",
    title: "Tambur Mili Kaynağı",
    description: "Mil ile tambur göbeği arasındaki kaynak, mesnet reaksiyonunu kesme olarak taşır.",
    inputKeys: ["shaftWeldThicknessCm", "shaftWeldAllowable"],
    selectionKeys: [],
    rows: [
      {
        key: "shaftWeld.length", label: "Kaynak Boyu", formula: "L_k = π · D1",
        subst: (x) => `π · ${n(x.inp.shaftD1Cm)}`, unit: "cm",
      },
      {
        key: "shaftWeld.area", label: "Kaynak Halka Alanı",
        formula: "A = π·((d_d/2)² − (d_i/2)²) / 100",
        subst: (x) => `π·((${n(num(x.c["shaftWeld.outerDia"]))}/2)² − (${n(x.inp.shaftD1Cm * 10)}/2)²) / 100`,
        unit: "cm²",
      },
      {
        key: "shaftWeld.shearStress", label: "Kesme Gerilmesi", formula: "τ = R / A",
        subst: (x) => `${n(Math.max(num(x.c["drumShaft.reactionGearbox"]), num(x.c["drumShaft.reactionBearing"])))} / ${n(num(x.c["shaftWeld.area"]))}`,
        unit: "kg/cm²",
      },
    ],
    checkSuffixes: ["shaftWeld.stress"],
  },
  {
    id: "2.2.6",
    title: "Tambur Rulmanı",
    description: "Eşdeğer yükler, statik emniyet ve L10 yorulma ömrü (FEM T.2.1.3.2).",
    inputKeys: ["bearingFactorY1", "bearingFactorY2"],
    selectionKeys: ["bearingType", "bearingCode", "bearingDynCKn", "bearingStatC0Kn"],
    rows: [
      {
        key: "drumBearing.radialLoad", label: "Radyal Yük (Tambur Yatağı Reaksiyonundan)",
        formula: "F_r = R_g · 0,00981",
        subst: (x) => `${n(num(x.c["drumShaft.reactionBearing"]))} · 0,00981`, unit: "kN",
      },
      {
        key: "drumBearing.axialLoad", label: "Eksenel Yük", formula: "F_a = 0,1 · F_r",
        subst: (x) => `0,1 · ${n(num(x.c["drumBearing.radialLoad"]))}`, unit: "kN",
      },
      {
        key: "drumBearing.equivalentStatic", label: "Eşdeğer Statik Yük",
        formula: "P₀ = F_r + Y₁ · F_a",
        subst: (x) => `${n(num(x.c["drumBearing.radialLoad"]))} + ${n(x.inp.bearingFactorY1)} · ${n(num(x.c["drumBearing.axialLoad"]))}`,
        unit: "kN",
      },
      {
        key: "drumBearing.staticSafety", label: "Statik Emniyet", formula: "s₀ = C₀ / P₀",
        subst: (x) => `${n(x.sel.bearingStatC0Kn)} / ${n(num(x.c["drumBearing.equivalentStatic"]))}`,
      },
      {
        key: "drum.rpm", label: "Tambur Devri", formula: "n_t = (v · i) / (D · π)",
        subst: (x) => `(${n(viewOf(x).liftSpeedMpm)} · ${n(num(x.c["reeving.mechanicalAdvantage"]))}) / (${n(x.sel.drumDiaMm / 1000, 3)} · π)`,
        unit: "d/dak",
      },
      {
        key: "drumBearing.lifeHours", label: "Rulman Ömrü (L10)",
        formula: "L₁₀ = (10⁶ / (60·n)) · (C/P)^(10/3)",
        subst: (x) => `(10⁶ / (60·${n(num(x.c["drum.rpm"]))})) · (${n(x.sel.bearingDynCKn)}/${n(num(x.c["drumBearing.equivalentDynamic"]))})^(10/3)`,
        unit: "saat", digits: 0, standard: "FEM 1.001 T.2.1.3.2",
      },
      {
        key: "drumBearing.requiredLifeMin", label: "Gerekli Minimum Ömür",
        formula: "L_min = f(kullanım sınıfı)",
        subst: (x) =>
          `${viewOf(x).usageClass} → ${n(num(x.c["drumBearing.requiredLifeMin"]), 0)}`,
        unit: "saat", digits: 0,
      },
    ],
    checkSuffixes: ["bearing.life", "bearing.static"],
  },
  {
    id: "2.3",
    title: "Redüktör (Dişli Kutusu)",
    description: "Tambur torku, gerekli çevrim oranı ve redüktör seçimi.",
    inputKeys: ["drumCount", "gearboxServiceFactor"],
    selectionKeys: ["gearboxModel", "gearboxRatio", "gearboxNominalTorqueKnm", "gearboxInputShaftMm", "gearboxOutputShaftMm", "gearboxAllowedRadialKn"],
    rows: [
      {
        key: "drum.torque", label: "Tambur Torku", formula: "M_t = r · n_tah · F_kN",
        subst: (x) => `${n(num(x.c["drum.radius"]), 3)} · ${n(x.inp.drivenFalls)} · ${n(num(x.c["rope.loadKn"]), 3)}`,
        unit: "kNm", digits: 3,
      },
      {
        key: "gearbox.requiredTorque", label: "Gerekli Redüktör Torku", formula: "M_g = k_e · M_t",
        subst: (x) => `${n(x.inp.gearboxServiceFactor)} · ${n(num(x.c["drum.torquePerDrum"]), 3)}`,
        unit: "kNm", digits: 3,
      },
      {
        key: "gearbox.requiredRatio", label: "Gerekli Çevrim Oranı",
        formula: "i_g = n_motor / n_tambur",
        subst: (x) => `${n(x.sel.motorRpm)} / ${n(num(x.c["drum.rpm"]))}`,
      },
      {
        key: "gearbox.ratioDeviation", label: "Oran Sapması",
        formula: "Δi = 100 · (i_seç − i_g) / i_g",
        subst: (x) => `100 · (${n(x.sel.gearboxRatio)} − ${n(num(x.c["gearbox.requiredRatio"]))}) / ${n(num(x.c["gearbox.requiredRatio"]))}`,
        unit: "%",
      },
      {
        key: "gearbox.actualLiftSpeed", label: "Gerçekleşen Kaldırma Hızı",
        formula: "v = (n_m / i) · π · D / i_donanım",
        subst: (x) => `(${n(x.sel.motorRpm)} / ${n(x.sel.gearboxRatio)}) · π · ${n(x.sel.drumDiaMm / 1000, 3)} / ${n(num(x.c["reeving.mechanicalAdvantage"]))}`,
        unit: "m/dak",
      },
      {
        key: "gearbox.actualSafety", label: "Gerçekleşen Emniyet",
        formula: "n = M_nominal / M_t",
        subst: (x) => `${n(x.sel.gearboxNominalTorqueKnm)} / ${n(num(x.c["drum.torquePerDrum"]), 3)}`,
      },
      {
        key: "gearbox.radialLoad", label: "Redüktöre Gelen Radyal Yük",
        formula: "F_rad = R_a · 9,81 / 1000",
        subst: (x) => `${n(num(x.c["drumShaft.reactionGearbox"]))} · 9,81 / 1000`, unit: "kN",
      },
    ],
    checkSuffixes: ["gearbox.torque", "gearbox.ratio", "gearbox.radial"],
  },
  {
    id: "2.4",
    title: "Motor",
    description: "Motor giriş torku ve gerekli güç (CMAA 70).",
    inputKeys: ["reducerStages", "stageEfficiency", "tempFactor", "motorDivisor"],
    selectionKeys: ["motorBrand", "motorPowerKw", "motorRpm", "motorShaftMm", "motorCount"],
    rows: [
      {
        key: "gearbox.outputTorque", label: "Redüktör Çıkış Torku", formula: "M_ç = M_t · 1000",
        subst: (x) => `${n(num(x.c["drum.torquePerDrum"]), 3)} · 1000`, unit: "Nm",
      },
      {
        key: "gearbox.efficiency", label: "Redüktör Verimi", formula: "η_r = η_kademe^s",
        subst: (x) => `${n(x.inp.stageEfficiency)}^${n(x.inp.reducerStages)}`, digits: 4,
      },
      {
        key: "motor.inputTorque", label: "Motor Giriş Torku", formula: "M_m = M_ç / (i · η_r)",
        subst: (x) => `${n(num(x.c["gearbox.outputTorque"]))} / (${n(x.sel.gearboxRatio)} · ${n(num(x.c["gearbox.efficiency"]), 4)})`,
        unit: "Nm",
      },
      {
        key: "motor.requiredPower", label: "Gerekli Güç", formula: "P = M_m · n_m / 9550",
        subst: (x) => `${n(num(x.c["motor.inputTorque"]))} · ${n(x.sel.motorRpm)} / 9550`, unit: "kW",
      },
      {
        key: "motor.adjustedPower", label: "Sıcaklık Düzeltmeli Güç", formula: "P' = k_t · P",
        subst: (x) => `${n(x.inp.tempFactor)} · ${n(num(x.c["motor.requiredPower"]))}`, unit: "kW",
      },
      {
        key: "motor.installedPower", label: "Kurulu Güç", formula: "P_kurulu = P_motor · adet",
        subst: (x) => `${n(x.sel.motorPowerKw)} · ${n(x.sel.motorCount)}`, unit: "kW",
      },
    ],
    checkSuffixes: ["motor.power"],
  },
  {
    id: "2.5",
    title: "Fren",
    inputKeys: ["brakeServiceFactor"],
    selectionKeys: ["brakeBrand", "brakeModel", "brakeTorqueNm", "brakeWheelDiaMm", "brakeQty"],
    rows: [
      {
        key: "motor.shaftTorque", label: "Fren Miline Gelen Tork", formula: "M_f = M_m / adet",
        subst: (x) => `${n(num(x.c["motor.inputTorque"]))} / ${n(x.sel.motorCount)}`, unit: "Nm",
      },
      {
        key: "brake.requiredTorque", label: "Gerekli Fren Torku", formula: "M_f,g = M_f · k_f",
        subst: (x) => `${n(num(x.c["motor.shaftTorque"]))} · ${n(x.inp.brakeServiceFactor)}`, unit: "Nm",
      },
      {
        key: "brake.actualSafety", label: "Gerçekleşen Emniyet", formula: "n = M_fren / M_f",
        subst: (x) => `${n(x.sel.brakeTorqueNm)} / ${n(num(x.c["motor.shaftTorque"]))}`,
      },
      {
        key: "brake.combinedSafety", label: "Toplam Fren Emniyeti (Tüm Frenler)",
        formula: "n_top = adet · n",
        subst: (x) => `${n(x.sel.brakeQty)} · ${n(num(x.c["brake.actualSafety"]))}`,
      },
    ],
    checkSuffixes: ["brake.torque"],
  },
  {
    id: "2.6",
    title: "Motor — Redüktör Kaplini",
    inputKeys: ["motorCouplingServiceFactor"],
    selectionKeys: ["motorCouplingBrand", "motorCouplingModel", "motorCouplingTorqueNm", "motorCouplingDmaxMm"],
    rows: [
      {
        key: "motorCoupling.requiredTorque", label: "Gerekli Kaplin Kapasitesi",
        formula: "M_k = M_m · k",
        subst: (x) => `${n(num(x.c["motor.shaftTorque"]))} · ${n(x.inp.motorCouplingServiceFactor)}`,
        unit: "Nm",
      },
      {
        key: "motorCoupling.shaftDia", label: "Bağlanacak En Büyük Mil",
        formula: "d = maks(d_motor, d_redüktör)",
        subst: (x) => `maks(${n(x.sel.motorShaftMm)}, ${n(x.sel.gearboxInputShaftMm)})`, unit: "mm",
      },
      {
        key: "motorCoupling.actualSafety", label: "Gerçekleşen Emniyet",
        formula: "n = M_kaplin / M_m",
        subst: (x) => `${n(x.sel.motorCouplingTorqueNm)} / ${n(num(x.c["motor.shaftTorque"]))}`,
      },
    ],
    checkSuffixes: ["motorCoupling.torque", "motorCoupling.bore"],
  },
  {
    id: "2.7",
    title: "Tambur Kaplini",
    inputKeys: ["drumCouplingServiceFactor"],
    selectionKeys: ["drumCouplingBrand", "drumCouplingModel", "drumCouplingTorqueNm", "drumCouplingRadialN", "drumCouplingDmaxMm"],
    rows: [
      {
        key: "drumCoupling.requiredTorque", label: "Gerekli Kaplin Kapasitesi",
        formula: "M_k = M_t,tasarım · k",
        subst: (x) => `${n(num(x.c["drumCoupling.designTorque"]))} · ${n(x.inp.drumCouplingServiceFactor)}`,
        unit: "Nm",
      },
      {
        key: "drumCoupling.requiredRadial", label: "Gerekli Radyal Yük Kapasitesi",
        formula: "F_rad = R_a · 9,81",
        subst: (x) => `${n(num(x.c["drumShaft.reactionGearbox"]))} · 9,81`, unit: "N",
      },
      {
        key: "drumCoupling.shaftDia", label: "Bağlanacak Mil Çapı",
        formula: "d = d_redüktör çıkış mili",
        subst: (x) => `${n(x.sel.gearboxOutputShaftMm)}`, unit: "mm",
      },
      {
        key: "drumCoupling.actualSafety", label: "Gerçekleşen Emniyet",
        formula: "n = M_kaplin / M_t,tasarım",
        subst: (x) => `${n(x.sel.drumCouplingTorqueNm)} / ${n(num(x.c["drumCoupling.designTorque"]))}`,
      },
    ],
    checkSuffixes: ["drumCoupling.torque", "drumCoupling.radial", "drumCoupling.bore"],
  },
];
