// Kanca bloğu sunum katmanı: bölüm yapısı (§4.1 … §4.6) ve her hesap satırının
// SEMBOLİK FORMÜLÜ ile SAYILARIN YERİNE KONMUŞ hali.
//
// Hesabın kendisi `modules/hookBlock.ts`tedir; burası yalnız gösterimdir ve
// PDF raporun formül satırlarını da bu katman üretir.
//
// Satırlar motorun SEMANTİK ANAHTARLARIYLA (`<blok>.<büyüklük>`) adreslenir:
// `key` hem satırın kimliği hem de değerin okunacağı anahtardır. Motorun hücre
// haritasında karşılığı olmayan (girdi/bağımlılık yankısı olan) satırlar
// değerini `valueFrom` ile doğrudan bağlamdan okur.

import type {
  HookBlockDeps,
  HookBlockInputs,
  HookBlockSelections,
  HookBlockValues,
} from "../modules/hookBlock";
import type { TechnicalSpecs } from "../types";

export interface HookBlockCtx {
  c: Record<string, number | string>; // semantik anahtar → değer (motor çıktısı)
  v: HookBlockValues;                 // isimli değerler
  inp: HookBlockInputs;
  sel: HookBlockSelections;
  deps: HookBlockDeps;
  specs: TechnicalSpecs;
}

export interface HookBlockRowDef {
  /**
   * Motorun semantik anahtarı (`<blok>.<büyüklük>`) ve satırın kararlı kimliği.
   * `valueFrom` verilmemişse değer bu anahtarla hücre haritasından okunur;
   * kontrol ↔ satır bağlantı haritası (check-anchors.ts) de bunu kullanır.
   */
  key: string;
  /** Değer motorun haritasında değilse (girdi/bağımlılık yankısı) okuma yolu */
  valueFrom?: (ctx: HookBlockCtx) => number | string;
  label: string;
  formula?: string;                      // sembolik formül
  subst?: (ctx: HookBlockCtx) => string; // sayılar yerine konmuş hali
  unit?: string;
  digits?: number;
  standard?: string;
}

export interface HookBlockSectionDef {
  id: string;                         // "4.1"
  title: string;
  description?: string;
  inputKeys: (keyof HookBlockInputs & string)[];
  selectionKeys: (keyof HookBlockSelections & string)[];
  rows: HookBlockRowDef[];
  /** Bölümde gösterilecek kontrol id sonekleri (örn. "sheave.dia") */
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

export const HOOKBLOCK_SECTIONS: HookBlockSectionDef[] = [
  {
    id: "4.1",
    title: "Kanca",
    description: "DIN 15400/15401 kanca seçimi.",
    inputKeys: [],
    selectionKeys: [
      "hookDesignation", "hookNumber", "hookStrengthClass", "hookCapacityKg",
    ],
    rows: [
      {
        key: "hook.load",
        label: "Kancaya Gelen Yük", formula: "Q = kaldırılan yük",
        valueFrom: (x) => x.deps.loadKg,
        subst: (x) => `${n(x.deps.loadKg)}`, unit: "kg",
      },
      {
        key: "hook.dinGroup",
        label: "Mekanizma Grubu (DIN 15020 Karşılığı)",
        formula: "grup = f(FEM sınıfı)",
        valueFrom: (x) => `${x.specs.hoistMechanismClass} → ${x.v.hookDinGroup}`,
        standard: "DIN 15400",
      },
      {
        key: "hook.capacity",
        label: "Kanca Taşıma Kapasitesi",
        formula: "Q_kanca = T3(kanca no, malzeme sınıfı, mekanizma grubu)",
        subst: (x) =>
          x.v.hookCapacityFromTable
            ? `Nr ${x.sel.hookNumber} / ${x.sel.hookStrengthClass} / ${x.v.hookDinGroup} → ${n(x.v.hookCapacityKg)}`
            : `${x.sel.hookDesignation} → ${n(x.v.hookCapacityKg)} (elle)`,
        unit: "kg", standard: "DIN 15400",
      },
      {
        key: "hook.suggestedNumber",
        label: "Bu Yükü Taşıyan En Küçük Kanca",
        formula: "en küçük Nr (DIN 15400 Tablo 3)",
        valueFrom: (x) => x.v.suggestedHookNumber ?? "—",
        standard: "DIN 15400",
      },
    ],
    checkSuffixes: ["hook.capacity"],
  },
  {
    id: "4.2",
    title: "Makaralar",
    description: "Minimum makara çapı (FEM H katsayısı) ve makara seçimi.",
    inputKeys: [],
    selectionKeys: ["sheaveDiaMm"],
    rows: [
      {
        key: "sheave.coefficient", label: "Makaralar İçin Mekanizma Katsayısı",
        formula: "H = f(mekanizma sınıfı)",
        subst: (x) => `${x.specs.hoistMechanismClass} → ${n(num(x.c["sheave.coefficient"]))}`,
        standard: "FEM 1.001 T.4.2.3.1.1",
      },
      {
        key: "sheave.ropeDia", label: "Halat Çapı",
        formula: "d = kaldırma grubundan seçilen halat çapı",
        valueFrom: (x) => x.deps.ropeDiaMm,
        subst: (x) => `${n(x.deps.ropeDiaMm)}`, unit: "mm",
      },
      {
        key: "sheave.minDia", label: "Minimum Makara Çapı", formula: "D_min = H · d",
        subst: (x) => `${n(num(x.c["sheave.coefficient"]))} · ${n(x.deps.ropeDiaMm)}`,
        unit: "mm", standard: "FEM 1.001 T.4.2.3.1.1",
      },
    ],
    checkSuffixes: ["sheave.dia"],
  },
  {
    id: "4.3",
    title: "Makara Rulmanları",
    description:
      "Eşdeğer yükler ve ISO 281 nominal ömrü (bilyalı rulman). Gerekli ömür " +
      "FEM 1.001 T.2.1.3.2 kullanım sınıfı bandından okunur.",
    inputKeys: [],
    selectionKeys: [
      "sheaveBearingType", "sheaveBearingCode", "sheaveBearingBoreMm",
      "sheaveBearingDynCKn", "sheaveBearingStatC0Kn",
    ],
    rows: [
      {
        key: "sheaveBearing.radialLoad", label: "Rulman Radyal Yükü",
        formula: "F_r = T · 9,81 / 1000",
        subst: (x) => `${n(x.deps.ropeLoadKg)} · 0,00981`, unit: "kN",
      },
      {
        key: "sheaveBearing.axialLoad", label: "Rulman Eksenel Yükü",
        formula: "F_a = 0,05 · F_r",
        subst: (x) => `0,05 · ${n(num(x.c["sheaveBearing.radialLoad"]))}`, unit: "kN",
      },
      {
        key: "sheaveBearing.equivalentStatic", label: "Eşdeğer Statik Yük",
        formula: "P₀ = F_r  (saf radyal yük: X = 1, Y = 0)",
        subst: (x) => `${n(num(x.c["sheaveBearing.radialLoad"]))}`, unit: "kN",
      },
      {
        key: "sheaveBearing.equivalentDynamic", label: "Eşdeğer Dinamik Yük",
        formula: "P = F_r  (saf radyal yük: X = 1, Y = 0)",
        subst: (x) => `${n(num(x.c["sheaveBearing.radialLoad"]))}`, unit: "kN",
      },
      {
        key: "sheaveBearing.rpm", label: "Rulman Devri",
        formula: "n = n_tambur · (D_tambur / D_makara)",
        subst: (x) => `${n(x.deps.drumRpm)} · (${n(x.deps.drumDiaMm)} / ${n(x.sel.sheaveDiaMm)})`,
        unit: "d/dak",
      },
      {
        key: "sheaveBearing.lifeHours", label: "Rulman Ömrü (L₁₀)",
        formula: "L₁₀ = (10⁶ / (60·n)) · (C/P)³",
        subst: (x) =>
          `(10⁶ / (60·${n(num(x.c["sheaveBearing.rpm"]))})) · (${n(x.sel.sheaveBearingDynCKn)}/${n(num(x.c["sheaveBearing.equivalentDynamic"]))})³`,
        unit: "saat", digits: 0, standard: "ISO 281",
      },
      {
        key: "sheaveBearing.requiredLifeMin", label: "Gerekli Minimum Ömür",
        formula: "L_min = f(kullanım sınıfı)",
        subst: (x) => `${x.specs.hoistUsageClass} → ${n(num(x.c["sheaveBearing.requiredLifeMin"]), 0)}`,
        unit: "saat", digits: 0, standard: "FEM 1.001 T.2.1.3.2",
      },
      {
        key: "sheaveBearing.bore",
        label: "Rulman İç Çapı (Mil Çapı D1'e Oturur)",
        formula: "d_rulman = D1 · 10",
        valueFrom: (x) => x.sel.sheaveBearingBoreMm ?? 0,
        subst: (x) =>
          `mil D1 = ${n(x.inp.shaftD1Cm)} cm → ${n(x.inp.shaftD1Cm * 10)} mm`,
        unit: "mm",
      },
    ],
    checkSuffixes: ["sheaveBearing.life", "sheaveBearing.static", "sheaveBearing.bore"],
  },
  {
    id: "4.4",
    title: "Kanca Bloğu Mili",
    description:
      "Mil, iki yan sac (mesnet) arasında basit kiriştir. Kanca bloğundaki " +
      "makara adedi halat donanımından gelir (n = n_toplam / 2) ve HER MAKARA " +
      "2T yükü taşır. Ölçü zinciri: A yan sac → ilk makara, B küme içi makara " +
      "adımı, D iki küme arasındaki orta boşluk. Eğilme ve kesme gerilmeleri D1 " +
      "mil çapında hesaplanır; makara rulmanı da bu çapa oturur. Bileşik gerilme " +
      "CMAA 70 4.11.4.1'e göre √(σ² + 3τ²), kesme gerilmesi ortalama (τ = V/A) " +
      "kabulüyle alınır.",
    inputKeys: [
      "shaftEdgeGapCm", "shaftSheavePitchCm", "shaftCenterGapCm", "shaftD1Cm",
    ],
    selectionKeys: ["shaftMaterial"],
    rows: [
      {
        key: "shaft.ropeLoad", label: "Halat Yükü (T)",
        formula: "T = bir halat kolundaki yük",
        valueFrom: (x) => x.deps.ropeLoadKg,
        subst: (x) => `${n(x.deps.ropeLoadKg)}`, unit: "kg",
      },
      {
        key: "shaft.sheaveCount", label: "Kanca Bloğu Makara Adedi",
        formula: "n = n_toplam / 2  (halat donanımından)",
        subst: (x) => `donanım → ${n(x.deps.blockSheaveCount)}`,
      },
      {
        key: "shaft.sheaveLoad", label: "Makara Başına Yük", formula: "P = 2T",
        subst: (x) => `2 · ${n(x.deps.ropeLoadKg)}`, unit: "kg",
      },
      {
        key: "shaft.span", label: "Yan Saclar Arası Açıklık (L)",
        formula: "L = 2A + (n_küme − 1)·B + D",
        subst: (x) =>
          `A=${n(x.inp.shaftEdgeGapCm)} · B=${n(x.inp.shaftSheavePitchCm)} · D=${n(x.inp.shaftCenterGapCm)} → ${n(num(x.c["shaft.span"]))}`,
        unit: "cm",
      },
      {
        key: "shaft.reactionA", label: "Mesnet Reaksiyonu Ra (Sol Yan Sac)",
        formula: "R_a = Σ P·(L − x_i) / L",
        subst: (x) =>
          `${n(x.v.sheaveCount)} × ${n(num(x.c["shaft.sheaveLoad"]))} yük · konumlar [${x.v.sheavePositionsCm.map((p) => n(p)).join("; ")}] cm`,
        unit: "kg",
      },
      {
        key: "shaft.reactionB", label: "Mesnet Reaksiyonu Rb (Sağ Yan Sac)",
        formula: "R_b = n · P − R_a",
        subst: (x) =>
          `${n(x.v.sheaveCount)} · ${n(num(x.c["shaft.sheaveLoad"]))} − ${n(num(x.c["shaft.reactionA"]))}`,
        unit: "kg",
      },
      {
        key: "shaft.moment", label: "Maksimum Eğilme Momenti",
        formula: "M_maks = maks[ R_a·x − Σ P·(x − x_i) ]",
        subst: (x) => `${n(num(x.c["shaft.reactionA"]))} · konum − yük katkıları`,
        unit: "kg·cm",
      },
      {
        key: "shaft.sectionModulus", label: "Kesit Modülü (D1)",
        formula: "W = π · D1³ / 32",
        subst: (x) => `π · ${n(x.inp.shaftD1Cm)}³ / 32`, unit: "cm³",
      },
      {
        key: "shaft.bendingStress", label: "Eğilme Gerilmesi", formula: "σ = M_maks / W",
        subst: (x) => `${n(num(x.c["shaft.moment"]))} / ${n(num(x.c["shaft.sectionModulus"]))}`,
        unit: "kg/cm²", standard: "CMAA 70 4.11.4.1",
      },
      {
        key: "shaft.shearStress", label: "Kesme Gerilmesi (Ortalama)",
        formula: "τ = V / (π · D1² / 4)",
        subst: (x) =>
          `${n(num(x.c["shaft.shear"]))} / (π · ${n(x.inp.shaftD1Cm)}² / 4)`,
        unit: "kg/cm²", standard: "CMAA 70 4.11.4.1",
      },
      {
        key: "shaft.combinedStress", label: "Bileşik Gerilme", formula: "σ_bil = √(σ² + 3τ²)",
        subst: (x) =>
          `√(${n(num(x.c["shaft.bendingStress"]))}² + 3·${n(num(x.c["shaft.shearStress"]))}²)`,
        unit: "kg/cm²", standard: "CMAA 70 4.11.4.1",
      },
      {
        key: "shaft.allowableBending", label: "İzin Verilen Eğilme Gerilmesi",
        formula: "σ_em = f(mil malzemesi)",
        subst: (x) => `${x.sel.shaftMaterial} → ${n(num(x.c["shaft.allowableBending"]))}`,
        unit: "kg/cm²", standard: "CMAA 70 4.11.4.1",
      },
      {
        key: "shaft.allowableShear", label: "İzin Verilen Kesme Gerilmesi",
        formula: "τ_em = f(mil malzemesi)",
        subst: (x) => `${x.sel.shaftMaterial} → ${n(num(x.c["shaft.allowableShear"]))}`,
        unit: "kg/cm²", standard: "CMAA 70 4.11.4.1",
      },
      {
        key: "shaft.allowableCombined", label: "İzin Verilen Bileşik Gerilme",
        formula: "σ_em = f(mil malzemesi)",
        subst: (x) => `${x.sel.shaftMaterial} → ${n(num(x.c["shaft.allowableCombined"]))}`,
        unit: "kg/cm²", standard: "CMAA 70 4.11.4.1",
      },
    ],
    checkSuffixes: ["shaft.bending", "shaft.shear", "shaft.stress"],
  },
  {
    id: "4.5",
    title: "Kanca Rulmanı",
    description: "Eksenel rulman statik kontrolü.",
    inputKeys: [],
    selectionKeys: ["hookBearingType", "hookBearingCode", "hookBearingStatC0Kn"],
    rows: [
      {
        key: "hookBearing.axialLoad", label: "Rulman Eksenel Yükü",
        formula: "F_a = Q · 9,81 / 1000",
        subst: (x) => `${n(x.deps.loadKg)} · 9,81 / 1000`, unit: "kN",
      },
      {
        key: "hookBearing.staticSafety", label: "Statik Emniyet Katsayısı",
        formula: "S₀ = C₀ / F_a",
        subst: (x) => `${n(x.sel.hookBearingStatC0Kn)} / ${n(num(x.c["hookBearing.axialLoad"]))}`,
      },
    ],
    checkSuffixes: ["hookBearing.static"],
  },
  {
    id: "4.6",
    title: "Kaldırma Kirişi ve Yorulma",
    description:
      "Kanca bloğunun kaldırma kirişi: kutu kesit özellikleri, DIN 15018 Tablo 2 " +
      "dinamik katsayısı ψ ile statik gerilmeler ve DIN 15018 yorulma kontrolü. " +
      "Yorulma izin gerilmeleri Tablo 17'den (malzeme × çentik sınıfı × yük grubu), " +
      "gerilme oranına göre düzeltme Tablo 18'den alınır. ψ katsayısının k ve l " +
      "terimleri serbest sayı değildir: teknik özelliklerdeki kaldırma sınıfının " +
      "(H1…H4) Tablo 2 satırıdır.",
    inputKeys: [
      "girderSpanMm", "loadOffsetMm",
      "midTopPlateThkMm", "midTopPlateWidthMm", "midWebPlateThkMm", "midWebPlateHeightMm",
      "midBottomPlateThkMm", "midBottomPlateWidthMm",
      "thickTopPlateThkMm", "thickTopPlateWidthMm", "thickWebPlateThkMm", "thickWebPlateHeightMm",
      "thickBottomPlateThkMm", "thickBottomPlateWidthMm",
      "loadGroup", "notchClass", "fatigueMaterial",
      "dynamicFactorKOverride", "dynamicFactorLOverride",
    ],
    selectionKeys: [],
    rows: [
      {
        key: "girder.forceMax", label: "Maksimum Kuvvet", formula: "F_max = G_toplam / 2",
        subst: (x) => `${n(x.deps.totalLoadKg)} / 2`, unit: "kg",
      },
      {
        key: "girder.forceMin", label: "Minimum Kuvvet",
        formula: "F_min = (G_blok + G_halat) / 2",
        subst: (x) => `(${n(x.deps.hookBlockWeightKg)} + ${n(x.deps.ropeWeightKg)}) / 2`,
        unit: "kg",
      },
      {
        key: "girder.momentMax", label: "Maksimum Moment", formula: "M_maks = F_max · b / 10",
        subst: (x) => `${n(num(x.c["girder.forceMax"]))} · ${n(x.inp.loadOffsetMm)} / 10`,
        unit: "kg·cm",
      },
      {
        key: "girder.momentMin", label: "Minimum Moment", formula: "M_min = F_min · b / 10",
        subst: (x) => `${n(num(x.c["girder.forceMin"]))} · ${n(x.inp.loadOffsetMm)} / 10`,
        unit: "kg·cm",
      },
      {
        key: "girder.midUnitWeight", label: "Birim Ağırlık (Orta Kesit)",
        formula: "G = ΣA_sac · 7,85 / 10³",
        subst: (x) => `((${n(x.inp.midTopPlateThkMm)}·${n(x.inp.midTopPlateWidthMm)}) + 2·(${n(x.inp.midWebPlateThkMm)}·${n(x.inp.midWebPlateHeightMm)}) + (${n(x.inp.midBottomPlateThkMm)}·${n(x.inp.midBottomPlateWidthMm)})) · 7,85 / 10³`,
        unit: "kg/m",
      },
      {
        key: "girder.midInertia", label: "Atalet Momenti (Orta Kesit)",
        formula: "I = Σ(I₀ + A·y²)",
        subst: (x) => `2·(${n(x.inp.midWebPlateThkMm / 10)}·${n(x.inp.midWebPlateHeightMm / 10)}³/12) + başlık sacları (Steiner)`,
        unit: "cm⁴",
      },
      {
        key: "girder.midSectionModulus", label: "Kesit Modülü (Orta Kesit)",
        formula: "w = I / (h/2)",
        subst: (x) => `${n(num(x.c["girder.midInertia"]))} / ${n(x.inp.midWebPlateHeightMm / 20)}`,
        unit: "cm³",
      },
      {
        key: "girder.midArea", label: "Kesit Alanı (Orta Kesit)", formula: "A = ΣA_sac",
        subst: (x) => `${n(num(x.c["girder.midArea"]))}`, unit: "cm²",
      },
      {
        key: "girder.midWebArea", label: "Yan Sacların Alanı (Orta Kesit)",
        formula: "A_y = 2 · t_y · h",
        subst: (x) => `2 · ${n(x.inp.midWebPlateThkMm / 10)} · ${n(x.inp.midWebPlateHeightMm / 10)}`,
        unit: "cm²",
      },
      {
        key: "girder.thickSectionModulus", label: "Kesit Modülü (Kalın Kesit)",
        formula: "w = I / (h/2)",
        subst: (x) => `${n(num(x.c["girder.thickInertia"]))} / ${n(x.inp.thickWebPlateHeightMm / 20)}`,
        unit: "cm³",
      },
      {
        key: "girder.thickWebArea", label: "Yan Sacların Alanı (Kalın Kesit)",
        formula: "A_y = 2 · t_y · h",
        subst: (x) => `2 · ${n(x.inp.thickWebPlateThkMm / 10)} · ${n(x.inp.thickWebPlateHeightMm / 10)}`,
        unit: "cm²",
      },
      {
        key: "girder.dynamicFactor", label: "Dinamik Katsayı ψ",
        formula: "ψ = k + l · v_kaldırma   (k, l = Tablo 2 kaldırma sınıfı satırı)",
        subst: (x) =>
          `${x.v.hoistClassUsed}${x.v.dynamicFactorOverridden ? " (elle ezildi)" : ""} → ` +
          `${n(x.v.dynamicFactorK)} + ${n(x.v.dynamicFactorL, 4)} · ${n(x.specs.mainLiftSpeedMpm)}`,
        digits: 3, standard: "DIN 15018 Tablo 2",
      },
      {
        key: "girder.bendingStress", label: "Eğilme Gerilmesi", formula: "σ = M_maks · ψ / w",
        subst: (x) => `${n(num(x.c["girder.momentMax"]))} · ${n(num(x.c["girder.dynamicFactor"]), 3)} / ${n(num(x.c["girder.midSectionModulus"]))}`,
        unit: "kg/cm²",
      },
      {
        key: "girder.shearStress", label: "Kesme Gerilmesi",
        formula: "τ = F_max · ψ / A_y (kalın kesit)",
        subst: (x) => `${n(num(x.c["girder.forceMax"]))} · ${n(num(x.c["girder.dynamicFactor"]), 3)} / ${n(num(x.c["girder.thickWebArea"]))}`,
        unit: "kg/cm²",
      },
      {
        key: "girder.combinedStress", label: "Bileşik Gerilme", formula: "σ_bil = √(σ² + 3τ²)",
        subst: (x) => `√(${n(num(x.c["girder.bendingStress"]))}² + 3·${n(num(x.c["girder.shearStress"]))}²)`,
        unit: "kg/cm²",
      },
      {
        key: "girder.allowableStress",
        label: "İzin Verilen Gerilme", formula: "σ_em = f(malzeme)",
        subst: (x) => `${x.inp.fatigueMaterial} → ${n(x.v.allowableStaticStress)}`,
        unit: "kg/cm²", standard: "FEM 1.001 T.3.2.1.1",
      },
      {
        key: "fatigue.sigmaMax", label: "σmax", formula: "σ_max = M_maks / w",
        subst: (x) => `${n(num(x.c["girder.momentMax"]))} / ${n(num(x.c["girder.midSectionModulus"]))}`,
        unit: "kg/cm²",
      },
      {
        key: "fatigue.tauMax", label: "τmax", formula: "τ_max = F_max / A_y",
        subst: (x) => `${n(num(x.c["girder.forceMax"]))} / ${n(num(x.c["girder.midWebArea"]))}`,
        unit: "kg/cm²",
      },
      {
        key: "fatigue.combinedMax", label: "Bileşik Maksimum Gerilme",
        formula: "σ_bil,max = √(σ_max² + 3τ_max²)",
        subst: (x) => `√(${n(num(x.c["fatigue.sigmaMax"]))}² + 3·${n(num(x.c["fatigue.tauMax"]))}²)`,
        unit: "kg/cm²",
      },
      {
        key: "fatigue.sigmaMin", label: "σmin", formula: "σ_min = M_min / w",
        subst: (x) => `${n(num(x.c["girder.momentMin"]))} / ${n(num(x.c["girder.midSectionModulus"]))}`,
        unit: "kg/cm²",
      },
      {
        key: "fatigue.tauMin", label: "τmin", formula: "τ_min = F_min / A_y",
        subst: (x) => `${n(num(x.c["girder.forceMin"]))} / ${n(num(x.c["girder.midWebArea"]))}`,
        unit: "kg/cm²",
      },
      {
        key: "fatigue.combinedMin", label: "Bileşik Minimum Gerilme",
        formula: "σ_bil,min = √(σ_min² + 3τ_min²)",
        subst: (x) => `√(${n(num(x.c["fatigue.sigmaMin"]))}² + 3·${n(num(x.c["fatigue.tauMin"]))}²)`,
        unit: "kg/cm²",
      },
      {
        key: "fatigue.stressRatio", label: "Gerilme Oranı",
        formula: "x = σ_bil,min / σ_bil,max",
        subst: (x) => `${n(num(x.c["fatigue.combinedMin"]))} / ${n(num(x.c["fatigue.combinedMax"]))}`,
        digits: 3,
      },
      {
        key: "fatigue.sigmaD1",
        label: "zul σ D(-1)", formula: "T17(malzeme, çentik sınıfı, yük grubu)",
        subst: (x) => `${x.inp.fatigueMaterial} / ${x.inp.notchClass} / ${x.inp.loadGroup} → ${n(x.v.fatigueSigmaD1Nmm2)}`,
        unit: "N/mm²", standard: "DIN 15018 Tablo 17",
      },
      {
        key: "fatigue.sigmaD1KgCm2",
        label: "zul σ D(-1)", formula: "zul σ D(-1) · 100 / 9,81",
        subst: (x) => `${n(x.v.fatigueSigmaD1Nmm2)} · 100 / 9,81`,
        unit: "kg/cm²",
      },
      {
        key: "fatigue.sigmaDz0",
        label: "zul σ Dz(0)", formula: "zul σ Dz(0) = zul σ D(-1) · 5/3",
        subst: (x) => `${n(x.v.fatigueSigmaD1KgCm2)} · 5/3`,
        unit: "kg/cm²", standard: "DIN 15018 Şekil 9",
      },
      {
        key: "fatigue.ultimateStrength",
        label: "Malzeme Kopma Dayanımı σB", formula: "σ_B = f(malzeme)",
        subst: (x) => `${x.inp.fatigueMaterial} → ${n(x.v.ultimateStrengthKgCm2)}`,
        unit: "kg/cm²",
      },
      {
        key: "fatigue.allowableSigma",
        label: "zul σ Dz(x)",
        formula: "zul σ Dz(x) = zulσDz(0) / (1 − (1 − zulσDz(0)/(0,75·σB)) · x)",
        subst: (x) => `${n(x.v.fatigueSigmaDz0KgCm2)} / (1 − (1 − ${n(x.v.fatigueSigmaDz0KgCm2)}/(0,75·${n(x.v.ultimateStrengthKgCm2)})) · ${n(x.v.kappa, 3)})`,
        unit: "kg/cm²", standard: "DIN 15018 Tablo 18",
      },
      {
        key: "fatigue.tauW0",
        label: "zul σ Dz(x) — W0 Çentik Sınıfı", formula: "T17(malzeme, W0, yük grubu)",
        subst: (x) => `${x.inp.fatigueMaterial} / W0 / ${x.inp.loadGroup} → ${n(x.v.fatigueTauW0Nmm2)}`,
        unit: "N/mm²", standard: "DIN 15018 Tablo 17",
      },
      {
        key: "fatigue.allowableTau",
        label: "zul τ D(x)", formula: "zul τ D(x) = zul σ Dz(x)|W0 · (100/9,81) / √3",
        subst: (x) => `${n(x.v.fatigueTauW0KgCm2)} / √3`,
        unit: "kg/cm²",
      },
      {
        key: "fatigue.combined",
        label: "Bileşik Yorulma Oranı",
        formula: "(σ_max/zulσ)² + (τ_max/zulτ)² ≤ 1,1",
        subst: (x) => `(${n(x.v.sigmaMax)}/${n(x.v.fatigueAllowableSigmaKgCm2)})² + (${n(x.v.tauMax)}/${n(x.v.fatigueAllowableTauKgCm2)})²`,
        digits: 4, standard: "DIN 15018 Bölüm 7.4.5",
      },
    ],
    checkSuffixes: ["girder.static", "fatigue.sigma", "fatigue.tau", "fatigue.combined"],
  },
];
