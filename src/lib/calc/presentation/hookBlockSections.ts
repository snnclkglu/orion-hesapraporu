// Kanca bloğu sunum katmanı: Excel'in bölüm yapısı (4.1 ... 4.6) + her hesap
// satırının SEMBOLİK FORMÜLÜ ve SAYILARIN YERİNE KONMUŞ hali.
// Hesabın kendisi hookBlock.ts'tedir (golden testli); burası yalnız gösterimdir
// ve ileride PDF raporun formül satırlarını da bu katman üretir.
//
// §4.6 yorulma satırlarının bir kısmı Excel'de bozuk hücrelerin (temiz
// yeniden yazılmış) karşılığıdır; bunlarda Excel hücresi yerine `valueFrom`
// ile HookBlockValues alanı okunur ve `nonExcel: true` işaretlidir.

import type {
  HookBlockDeps,
  HookBlockInputs,
  HookBlockSelections,
  HookBlockValues,
} from "../modules/hookBlock";
import type { TechnicalSpecs } from "../types";

export interface HookBlockCtx {
  c: Record<string, number | string>; // hücre haritası (motor çıktısı)
  v: HookBlockValues;                 // isimli değerler (yeniden yazım dahil)
  inp: HookBlockInputs;
  sel: HookBlockSelections;
  deps: HookBlockDeps;
  specs: TechnicalSpecs;
}

export interface HookBlockRowDef {
  /** Sonucun okunacağı Excel hücresi (sağlam hücreler) */
  cell?: string;
  /** Excel hücresi bozuksa: değerin HookBlockValues'tan okunuşu */
  valueFrom?: (ctx: HookBlockCtx) => number | string;
  label: string;
  formula?: string;                   // sembolik formül
  subst?: (ctx: HookBlockCtx) => string; // sayılar yerine konmuş hali
  unit?: string;
  digits?: number;
  standard?: string;
  /** Excel'de sağlam karşılığı olmayan (yeniden yazılmış) satır */
  nonExcel?: boolean;
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
    selectionKeys: ["hookDesignation", "hookCapacityKg"],
    rows: [
      {
        label: "Kanca kapasitesi", formula: "Q_kanca (DIN 15400)",
        valueFrom: (x) => x.sel.hookCapacityKg,
        subst: (x) => `${x.sel.hookDesignation} → ${n(x.sel.hookCapacityKg)}`,
        unit: "kg", standard: "DIN 15400",
      },
    ],
    checkSuffixes: [],
  },
  {
    id: "4.2",
    title: "Makaralar",
    description: "Minimum makara çapı (FEM H katsayısı) ve makara seçimi.",
    inputKeys: [],
    selectionKeys: ["sheaveDiaMm"],
    rows: [
      {
        cell: "L11", label: "Makaralar için mekanizma katsayısı",
        formula: "H = f(mekanizma sınıfı)  [FEM tablosu]",
        subst: (x) => `${x.specs.hoistMechanismClass} → ${n(num(x.c.L11))}`,
        standard: "FEM 1.001 T.4.2.3.1.1",
      },
      {
        cell: "L12", label: "Halat çapı", formula: "d = 02!L24",
        subst: (x) => `${n(x.deps.ropeDiaMm)}`, unit: "mm",
      },
      {
        cell: "L10", label: "Minimum makara çapı", formula: "D_min = H · d",
        subst: (x) => `${n(num(x.c.L11))} · ${n(x.deps.ropeDiaMm)}`, unit: "mm",
        standard: "FEM 1.001 T.4.2.3.1.1",
      },
    ],
    checkSuffixes: ["sheave.dia"],
  },
  {
    id: "4.3",
    title: "Makara Rulmanları",
    description: "Eşdeğer yükler ve L10 yorulma ömrü (bilyalı rulman, FEM T.2.1.3.2).",
    inputKeys: [],
    selectionKeys: ["sheaveBearingType", "sheaveBearingCode", "sheaveBearingDynCKn", "sheaveBearingStatC0Kn"],
    rows: [
      {
        cell: "L19", label: "Rulman radyal yükü", formula: "F_r = F_halat · 0,00981",
        subst: (x) => `${n(x.deps.ropeLoadKg)} · 0,00981`, unit: "kN",
      },
      {
        cell: "L20", label: "Rulman eksenel yükü", formula: "F_a = 0,05 · F_r",
        subst: (x) => `0,05 · ${n(num(x.c.L19))}`, unit: "kN",
      },
      {
        cell: "L26", label: "Eşdeğer statik yük", formula: "P₀ = F_r",
        subst: (x) => `${n(num(x.c.L19))}`, unit: "kN",
      },
      {
        cell: "L27", label: "Eşdeğer dinamik yük", formula: "P = F_r",
        subst: (x) => `${n(num(x.c.L19))}`, unit: "kN",
      },
      {
        cell: "L34", label: "Rulman devri", formula: "n = n_tambur · (D_tambur / D_makara)",
        subst: (x) => `${n(x.deps.drumRpm)} · (${n(x.deps.drumDiaMm)} / ${n(x.sel.sheaveDiaMm)})`,
        unit: "d/dak",
      },
      {
        cell: "L36", label: "Rulman ömrü (L10)", formula: "L₁₀ = (10⁶ / (60·n)) · (C/P)³",
        subst: (x) => `(10⁶ / (60·${n(num(x.c.L34))})) · (${n(x.sel.sheaveBearingDynCKn)}/${n(num(x.c.L27))})³`,
        unit: "saat", digits: 0, standard: "FEM 1.001 T.2.1.3.2",
      },
      {
        cell: "L38", label: "Gerekli minimum ömür", formula: "L_min = f(kullanım sınıfı)",
        subst: (x) => `${x.specs.hoistUsageClass} → ${n(num(x.c.L38), 0)}`,
        unit: "saat", digits: 0, standard: "FEM 1.001 T.2.1.3.2",
      },
    ],
    checkSuffixes: ["sheaveBearing.life", "sheaveBearing.static"],
  },
  {
    id: "4.4",
    title: "Kanca Bloğu Mili",
    description: "Reaksiyonlar, eğilme/kesme ve bileşik gerilme kontrolü (CMAA #74).",
    inputKeys: ["shaftSpanACm", "shaftSpanCCm", "shaftDiaCm"],
    selectionKeys: ["shaftMaterial"],
    rows: [
      {
        cell: "L51", label: "Halat yükü", formula: "T = 02!L19",
        subst: (x) => `${n(x.deps.ropeLoadKg)}`, unit: "kg",
      },
      {
        cell: "L52", label: "Mil yükü", formula: "2T = 2 · T",
        subst: (x) => `2 · ${n(num(x.c.L51))}`, unit: "kg",
      },
      {
        cell: "L58", label: "Reaksiyon kuvveti Ra", formula: "R_a = 2 · 2T",
        subst: (x) => `2 · ${n(num(x.c.L52))}`, unit: "kg",
      },
      {
        cell: "L59", label: "Reaksiyon kuvveti Rb", formula: "R_b = R_a",
        subst: (x) => `${n(num(x.c.L58))}`, unit: "kg",
      },
      {
        cell: "L62", label: "Maksimum moment", formula: "M_maks = 2T · a",
        subst: (x) => `${n(num(x.c.L52))} · ${n(x.inp.shaftSpanACm)}`, unit: "kg·cm",
      },
      {
        cell: "L64", label: "Kesit modülü", formula: "S = (π·D⁴/64) / (D/2)",
        subst: (x) => `(π·${n(x.inp.shaftDiaCm)}⁴/64) / ${n(x.inp.shaftDiaCm / 2, 2)}`, unit: "cm³",
      },
      {
        cell: "L65", label: "Maksimum eğilme gerilmesi", formula: "σ_E = M_maks / S",
        subst: (x) => `${n(num(x.c.L62))} / ${n(num(x.c.L64))}`, unit: "kg/cm²",
      },
      {
        cell: "L66", label: "Kesme gerilmesi", formula: "τ = R_a / (π · (D/2)²)",
        subst: (x) => `${n(num(x.c.L58))} / (π · ${n(x.inp.shaftDiaCm / 2, 2)}²)`, unit: "kg/cm²",
      },
      {
        cell: "L67", label: "Bileşik gerilme", formula: "σ_bil = √(σ_E² + 3τ²)",
        subst: (x) => `√(${n(num(x.c.L65))}² + 3·${n(num(x.c.L66))}²)`, unit: "kg/cm²",
      },
      {
        cell: "L73", label: "İzin verilen bileşik gerilme", formula: "σ_em = f(mil malzemesi)",
        subst: (x) => `${x.sel.shaftMaterial} → ${n(num(x.c.L73))}`, unit: "kg/cm²",
        standard: "CMAA #74, 4.5",
      },
    ],
    checkSuffixes: ["shaft.stress"],
  },
  {
    id: "4.5",
    title: "Kanca Rulmanı",
    description: "Eksenel rulman statik kontrolü.",
    inputKeys: [],
    selectionKeys: ["hookBearingType", "hookBearingCode", "hookBearingStatC0Kn"],
    rows: [
      {
        cell: "L78", label: "Rulman eksenel yükü", formula: "F_a = G_yük · 9,81 / 1000",
        subst: (x) => `${n(x.deps.loadKg)} · 9,81 / 1000`, unit: "kN",
      },
      {
        cell: "L85", label: "Statik emniyet katsayısı", formula: "S₀ = C₀ / F_a",
        subst: (x) => `${n(x.sel.hookBearingStatC0Kn)} / ${n(num(x.c.L78))}`,
      },
    ],
    checkSuffixes: ["hookBearing.static"],
  },
  {
    id: "4.6",
    title: "Kiriş Kesiti ve Yorulma",
    description:
      "Kaldırma kirişi kesit özellikleri, ψ katsayılı statik gerilmeler ve DIN 15018 " +
      "yorulma kontrolü. Yorulma izin gerilmeleri Excel'in bozuk (#ref!) bloğu yerine " +
      "DIN 15018 Tablo 17 lookup'ıyla temiz yeniden yazılmıştır.",
    inputKeys: [
      "girderSpanMm", "loadOffsetMm",
      "midTopPlateThkMm", "midTopPlateWidthMm", "midWebPlateThkMm", "midWebPlateHeightMm",
      "midBottomPlateThkMm", "midBottomPlateWidthMm",
      "thickTopPlateThkMm", "thickTopPlateWidthMm", "thickWebPlateThkMm", "thickWebPlateHeightMm",
      "thickBottomPlateThkMm", "thickBottomPlateWidthMm",
      "hoistClass", "dynamicFactorK", "dynamicFactorL",
      "loadGroup", "notchClass", "fatigueMaterial",
    ],
    selectionKeys: [],
    rows: [
      {
        cell: "L98", label: "Maksimum kuvvet", formula: "F_max = G_toplam / 2",
        subst: (x) => `${n(x.deps.totalLoadKg)} / 2`, unit: "kg",
      },
      {
        cell: "L99", label: "Minimum kuvvet", formula: "F_min = (G_blok + G_halat) / 2",
        subst: (x) => `(${n(x.deps.hookBlockWeightKg)} + ${n(x.deps.ropeWeightKg)}) / 2`, unit: "kg",
      },
      {
        cell: "L105", label: "Maksimum moment", formula: "M_maks = F_max · b / 10",
        subst: (x) => `${n(num(x.c.L98))} · ${n(x.inp.loadOffsetMm)} / 10`, unit: "kg·cm",
      },
      {
        cell: "L108", label: "Minimum moment", formula: "M_min = F_min · b / 10",
        subst: (x) => `${n(num(x.c.L99))} · ${n(x.inp.loadOffsetMm)} / 10`, unit: "kg·cm",
      },
      {
        cell: "L116", label: "Birim ağırlık (orta kesit)", formula: "G = ΣA_sac · 7,85 / 10³",
        subst: (x) => `((${n(x.inp.midTopPlateThkMm)}·${n(x.inp.midTopPlateWidthMm)}) + 2·(${n(x.inp.midWebPlateThkMm)}·${n(x.inp.midWebPlateHeightMm)}) + (${n(x.inp.midBottomPlateThkMm)}·${n(x.inp.midBottomPlateWidthMm)})) · 7,85 / 10³`,
        unit: "kg/m",
      },
      {
        cell: "L117", label: "Atalet momenti (orta kesit)", formula: "I = Σ(I₀ + A·y²)",
        subst: (x) => `2·(${n(x.inp.midWebPlateThkMm / 10)}·${n(x.inp.midWebPlateHeightMm / 10)}³/12) + başlık sacları (Steiner)`,
        unit: "cm⁴",
      },
      {
        cell: "L118", label: "Kesit modülü (orta kesit)", formula: "w = I / (h/2)",
        subst: (x) => `${n(num(x.c.L117))} / ${n(x.inp.midWebPlateHeightMm / 20)}`, unit: "cm³",
      },
      {
        cell: "L119", label: "Kesit alanı (orta kesit)", formula: "A = ΣA_sac",
        subst: (x) => `${n(num(x.c.L119))}`, unit: "cm²",
      },
      {
        cell: "L120", label: "Yan sacların alanı (orta kesit)", formula: "A_y = 2 · t_y · h",
        subst: (x) => `2 · ${n(x.inp.midWebPlateThkMm / 10)} · ${n(x.inp.midWebPlateHeightMm / 10)}`, unit: "cm²",
      },
      {
        cell: "P118", label: "Kesit modülü (kalın kesit)", formula: "w = I / (h/2)",
        subst: (x) => `${n(num(x.c.P117))} / ${n(x.inp.thickWebPlateHeightMm / 20)}`, unit: "cm³",
      },
      {
        cell: "P120", label: "Yan sacların alanı (kalın kesit)", formula: "A_y = 2 · t_y · h",
        subst: (x) => `2 · ${n(x.inp.thickWebPlateThkMm / 10)} · ${n(x.inp.thickWebPlateHeightMm / 10)}`, unit: "cm²",
      },
      {
        cell: "L124", label: "Dinamik katsayı ψ", formula: "ψ = k + l · v_kaldırma",
        subst: (x) => `${n(x.inp.dynamicFactorK)} + ${n(x.inp.dynamicFactorL, 4)} · ${n(x.specs.mainLiftSpeedMpm)}`,
        standard: "DIN 15018 Tablo 2",
      },
      {
        cell: "L130", label: "Eğilme gerilmesi", formula: "σ = M_maks · ψ / w",
        subst: (x) => `${n(num(x.c.L105))} · ${n(num(x.c.L124), 3)} / ${n(num(x.c.L118))}`, unit: "kg/cm²",
      },
      {
        cell: "L131", label: "Kesme gerilmesi", formula: "τ = F_max · ψ / A_y (kalın kesit)",
        subst: (x) => `${n(num(x.c.L98))} · ${n(num(x.c.L124), 3)} / ${n(num(x.c.P120))}`, unit: "kg/cm²",
      },
      {
        cell: "L132", label: "Bileşik gerilme", formula: "σ_bil = √(σ² + 3τ²)",
        subst: (x) => `√(${n(num(x.c.L130))}² + 3·${n(num(x.c.L131))}²)`, unit: "kg/cm²",
      },
      {
        label: "İzin verilen gerilme", formula: "σ_em = f(malzeme)",
        valueFrom: (x) => x.v.allowableStaticStress,
        subst: (x) => `${x.inp.fatigueMaterial} → ${n(x.v.allowableStaticStress)}`,
        unit: "kg/cm²", standard: "FEM T.3.2.1.1", nonExcel: true,
      },
      {
        cell: "L139", label: "σmax", formula: "σ_max = M_maks / w",
        subst: (x) => `${n(num(x.c.L105))} / ${n(num(x.c.L118))}`, unit: "kg/cm²",
      },
      {
        cell: "L140", label: "τmax", formula: "τ_max = F_max / A_y",
        subst: (x) => `${n(num(x.c.L98))} / ${n(num(x.c.L120))}`, unit: "kg/cm²",
      },
      {
        cell: "L141", label: "Bileşik maksimum gerilme", formula: "σ_bil,max = √(σ_max² + 3τ_max²)",
        subst: (x) => `√(${n(num(x.c.L139))}² + 3·${n(num(x.c.L140))}²)`, unit: "kg/cm²",
      },
      {
        cell: "L144", label: "σmin", formula: "σ_min = M_min / w",
        subst: (x) => `${n(num(x.c.L108))} / ${n(num(x.c.L118))}`, unit: "kg/cm²",
      },
      {
        cell: "L145", label: "τmin", formula: "τ_min = F_min / A_y",
        subst: (x) => `${n(num(x.c.L99))} / ${n(num(x.c.L120))}`, unit: "kg/cm²",
      },
      {
        cell: "L146", label: "Bileşik minimum gerilme", formula: "σ_bil,min = √(σ_min² + 3τ_min²)",
        subst: (x) => `√(${n(num(x.c.L144))}² + 3·${n(num(x.c.L145))}²)`, unit: "kg/cm²",
      },
      {
        cell: "L161", label: "Gerilme oranı", formula: "x = σ_bil,min / σ_bil,max",
        subst: (x) => `${n(num(x.c.L146))} / ${n(num(x.c.L141))}`, digits: 3,
      },
      {
        label: "zul σ D(-1)", formula: "T17(malzeme, çentik, yük grubu)",
        valueFrom: (x) => x.v.fatigueSigmaD1Nmm2,
        subst: (x) => `${x.inp.fatigueMaterial} / ${x.inp.notchClass} / ${x.inp.loadGroup} → ${n(x.v.fatigueSigmaD1Nmm2)}`,
        unit: "N/mm²", standard: "DIN 15018 Tablo 17", nonExcel: true,
      },
      {
        label: "zul σ D(-1)", formula: "zul σ D(-1) · 100 / 9,81",
        valueFrom: (x) => x.v.fatigueSigmaD1KgCm2,
        subst: (x) => `${n(x.v.fatigueSigmaD1Nmm2)} · 100 / 9,81`,
        unit: "kg/cm²", nonExcel: true,
      },
      {
        label: "zul σ Dz(0)", formula: "zul σ Dz(0) = zul σ D(-1) · 5/3",
        valueFrom: (x) => x.v.fatigueSigmaDz0KgCm2,
        subst: (x) => `${n(x.v.fatigueSigmaD1KgCm2)} · 5/3`,
        unit: "kg/cm²", standard: "DIN 15018 Şekil 9", nonExcel: true,
      },
      {
        label: "Malzeme kopma dayanımı σB", formula: "σ_B = f(malzeme)",
        valueFrom: (x) => x.v.ultimateStrengthKgCm2,
        subst: (x) => `${x.inp.fatigueMaterial} → ${n(x.v.ultimateStrengthKgCm2)}`,
        unit: "kg/cm²", nonExcel: true,
      },
      {
        label: "zul σ Dz(x)", formula: "zul σ Dz(x) = zulσDz(0) / (1 − (1 − zulσDz(0)/(0,75·σB)) · x)",
        valueFrom: (x) => x.v.fatigueAllowableSigmaKgCm2,
        subst: (x) => `${n(x.v.fatigueSigmaDz0KgCm2)} / (1 − (1 − ${n(x.v.fatigueSigmaDz0KgCm2)}/(0,75·${n(x.v.ultimateStrengthKgCm2)})) · ${n(x.v.kappa, 3)})`,
        unit: "kg/cm²", standard: "DIN 15018 Tablo 18", nonExcel: true,
      },
      {
        label: "zul τ Dz(x) — W0 için", formula: "T17(malzeme, W0, yük grubu)",
        valueFrom: (x) => x.v.fatigueTauW0Nmm2,
        subst: (x) => `${x.inp.fatigueMaterial} / W0 / ${x.inp.loadGroup} → ${n(x.v.fatigueTauW0Nmm2)}`,
        unit: "N/mm²", standard: "DIN 15018 Tablo 17", nonExcel: true,
      },
      {
        label: "zul τ D(x)", formula: "zul τ D(x) = zul τ Dz(x) · (100/9,81) / √3",
        valueFrom: (x) => x.v.fatigueAllowableTauKgCm2,
        subst: (x) => `${n(x.v.fatigueTauW0KgCm2)} / √3`,
        unit: "kg/cm²", nonExcel: true,
      },
      {
        label: "Bileşik yorulma oranı", formula: "(σ_max/zulσ)² + (τ_max/zulτ)² ≤ 1,1",
        valueFrom: (x) => x.v.fatigueCombinedRatio,
        subst: (x) => `(${n(x.v.sigmaMax)}/${n(x.v.fatigueAllowableSigmaKgCm2)})² + (${n(x.v.tauMax)}/${n(x.v.fatigueAllowableTauKgCm2)})²`,
        digits: 4, standard: "DIN 15018 Bölüm 7.4.5", nonExcel: true,
      },
    ],
    checkSuffixes: ["girder.static", "fatigue.sigma", "fatigue.tau", "fatigue.combined"],
  },
];
