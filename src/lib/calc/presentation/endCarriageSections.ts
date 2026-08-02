// Başkiriş sunum katmanı: raporun 9.1 … 9.4 bölümleri.
// Hesap endCarriage.ts'tedir; burası yalnız gösterimdir.
//
// Satırlar motorun semantik anahtarlarını (`<blok>.<büyüklük>`) okur.

import type {
  EndCarriageDeps,
  EndCarriageInputs,
  EndCarriageSelections,
} from "../modules/endCarriage";
import type { TechnicalSpecs } from "../types";

export interface EndCarriageCtx {
  c: Record<string, number | string>; // motorun ürettiği değerler
  inp: EndCarriageInputs;
  sel: EndCarriageSelections;
  deps: EndCarriageDeps;
  specs: TechnicalSpecs;
}

export interface EndCarriageRowDef {
  key: string;
  label: string;
  formula?: string;
  subst?: (ctx: EndCarriageCtx) => string;
  unit?: string;
  digits?: number;
  standard?: string;
}

export interface EndCarriageSectionDef {
  id: string;                // "9.1"
  title: string;
  description?: string;
  depKeys: (keyof EndCarriageDeps & string)[];
  inputKeys: (keyof EndCarriageInputs & string)[];
  selectionKeys: (keyof EndCarriageSelections & string)[];
  rows: EndCarriageRowDef[];
  /** "endCarriage." öneki hariç kontrol id sonekleri */
  checkSuffixes: string[];
}

const n = (v: number | string | undefined, d = 2): string => {
  if (v === undefined) return "?";
  if (typeof v === "string") return v;
  if (Number.isInteger(v)) return String(v);
  return v.toLocaleString("tr-TR", { maximumFractionDigits: d });
};
const num = (v: number | string | undefined): number => (typeof v === "number" ? v : NaN);

export const ENDCARRIAGE_SECTIONS: EndCarriageSectionDef[] = [
  {
    id: "9.1",
    title: "Tekerlek Yükleri ve Momentler",
    description: "Maksimum/minimum tekerlek yükleri ve eğilme momentleri.",
    depKeys: ["mainHoistTotalLoadKg", "trolleyWeightT", "bridgeWeightT"],
    inputKeys: ["wheelSpanAMm", "loadOffsetBMm"],
    selectionKeys: [],
    rows: [
      {
        key: "wheel.loadMax", label: "Maksimum Tekerlek Yükü Fmaks",
        formula: "Fmaks = (W/2 + Wa·1000/2) · 0,9 + G_köprü·1000/4",
        subst: (x) => `(${n(x.deps.mainHoistTotalLoadKg)}/2 + ${n(x.deps.trolleyWeightT)}·1000/2) · 0,9 + ${n(x.deps.bridgeWeightT)}·1000/4`,
        unit: "kg",
      },
      {
        key: "wheel.loadMin", label: "Minimum Tekerlek Yükü Fmin",
        formula: "Fmin = (Wa·1000/2) · 0,5 + G_köprü·1000/4",
        subst: (x) => `(${n(x.deps.trolleyWeightT)}·1000/2) · 0,5 + ${n(x.deps.bridgeWeightT)}·1000/4`,
        unit: "kg",
      },
      {
        key: "moment.max", label: "Maksimum Moment Mmaks",
        formula: "Mmaks = Fmaks · b  (b mm verildiğinden /10 ile kg·cm)",
        subst: (x) => `${n(num(x.c["wheel.loadMax"]))} · ${n(x.inp.loadOffsetBMm)} / 10`, unit: "kg·cm",
      },
      {
        key: "moment.min", label: "Minimum Moment Mmin",
        formula: "Mmin = Fmin · b  (b mm verildiğinden /10 ile kg·cm)",
        subst: (x) => `${n(num(x.c["wheel.loadMin"]))} · ${n(x.inp.loadOffsetBMm)} / 10`, unit: "kg·cm",
      },
    ],
    checkSuffixes: [],
  },
  {
    id: "9.2",
    title: "Kesit Özellikleri",
    description: "Kutu kesit (üst/yan/alt saclar) özellikleri.",
    depKeys: [],
    inputKeys: [
      "topPlateThicknessMm", "topPlateWidthMm", "sidePlateThicknessMm",
      "sidePlateHeightMm", "bottomPlateThicknessMm", "bottomPlateWidthMm",
    ],
    selectionKeys: [],
    rows: [
      {
        key: "section.weightPerLength", label: "Birim Ağırlık G", formula: "G = ΣA · 7,85 / 1000",
        unit: "kg/m",
      },
      {
        key: "section.inertia", label: "Atalet Momenti I", formula: "I = Σ(Ii + Ai · di²)", unit: "cm⁴",
      },
      {
        key: "section.modulus", label: "Kesit Modülü W", formula: "W = I / (h/2)",
        subst: (x) => `${n(num(x.c["section.inertia"]))} / ${n(x.inp.sidePlateHeightMm / 20)}`, unit: "cm³",
      },
      {
        key: "section.area", label: "Kesit Alanı A", unit: "cm²",
      },
      {
        key: "section.shearArea", label: "Yan Sacların Alanı Ay", formula: "Ay = 2 · e · h",
        subst: (x) => `2 · ${n(x.inp.sidePlateThicknessMm / 10)} · ${n(x.inp.sidePlateHeightMm / 10)}`,
        unit: "cm²",
      },
    ],
    checkSuffixes: [],
  },
  {
    id: "9.3",
    title: "Gerilmeler ve Statik Kontrol",
    description: "DIN 15018 dinamik katsayı ile büyütülmüş gerilmeler ve izin kontrolü.",
    depKeys: [],
    inputKeys: [],
    selectionKeys: ["hoistClassOverride", "material"],
    rows: [
      {
        key: "load.dynamicFactor", label: "Dinamik Katsayı ψ", formula: "ψ = k + l · v_kaldırma",
        subst: (x) => `${x.c["load.hoistClass"]}: ${n(num(x.c["load.factorK"]))} + ${n(num(x.c["load.factorL"]), 4)} · ${n(x.specs.mainLiftSpeedMpm)}`,
        digits: 3, standard: "DIN 15018 Tablo 2",
      },
      {
        key: "stress.bending", label: "Eğilme Gerilmesi σ", formula: "σ = Mmaks · ψ / W",
        subst: (x) => `${n(num(x.c["moment.max"]))} · ${n(num(x.c["load.dynamicFactor"]), 3)} / ${n(num(x.c["section.modulus"]))}`, unit: "kg/cm²",
      },
      {
        key: "stress.shear", label: "Kesme Gerilmesi τ", formula: "τ = Fmaks · ψ / Ay",
        subst: (x) => `${n(num(x.c["wheel.loadMax"]))} · ${n(num(x.c["load.dynamicFactor"]), 3)} / ${n(num(x.c["section.shearArea"]))}`, unit: "kg/cm²",
      },
      {
        key: "stress.combined", label: "Bileşik Gerilme σbil", formula: "σbil = √(σ² + 3τ²)",
        subst: (x) => `√(${n(num(x.c["stress.bending"]))}² + 3·${n(num(x.c["stress.shear"]))}²)`, unit: "kg/cm²",
      },
      {
        key: "stress.allowable", label: "İzin Verilen Gerilme", formula: "σem = f(malzeme)",
        subst: (x) => `${x.sel.material} → ${n(num(x.c["stress.allowable"]))}`, unit: "kg/cm²",
        standard: "FEM 1.001 T.3.2.1.1",
      },
    ],
    checkSuffixes: ["stress"],
  },
  {
    id: "9.4",
    title: "Yorulma Kontrolü",
    description:
      "DIN 15018 yorulma kontrolü. İzin gerilmeleri DIN 15018 Tablo 17/18'den hesaplanır.",
    depKeys: [],
    inputKeys: ["fatigueTensileNmm2"],
    selectionKeys: ["fatigueMaterial", "fatigueLoadGroupOverride", "fatigueNotchClass"],
    rows: [
      {
        key: "fatigue.sigmaMax", label: "σmaks", formula: "σmaks = Mmaks / W",
        subst: (x) => `${n(num(x.c["moment.max"]))} / ${n(num(x.c["section.modulus"]))}`, unit: "kg/cm²",
      },
      {
        key: "fatigue.tauMax", label: "τmaks", formula: "τmaks = Fmaks / Ay",
        subst: (x) => `${n(num(x.c["wheel.loadMax"]))} / ${n(num(x.c["section.shearArea"]))}`, unit: "kg/cm²",
      },
      {
        key: "fatigue.sigmaMin", label: "σmin", formula: "σmin = Mmin / W",
        subst: (x) => `${n(num(x.c["moment.min"]))} / ${n(num(x.c["section.modulus"]))}`, unit: "kg/cm²",
      },
      {
        key: "fatigue.kappa", label: "κ", formula: "κ = σbil,min / σbil,maks",
        subst: (x) => `${n(num(x.c["fatigue.combinedMin"]))} / ${n(num(x.c["fatigue.combinedMax"]))}`, digits: 3,
      },
      {
        key: "fatigue.allowableD1Nmm2", label: "zul σD(-1)",
        formula: "T17(malzeme, çentik, yük grubu)",
        subst: (x) => `${x.sel.fatigueMaterial} / ${x.sel.fatigueNotchClass} / ${x.c["fatigue.loadGroup"]} → ${n(num(x.c["fatigue.allowableD1Nmm2"]))}`,
        unit: "N/mm²", standard: "DIN 15018 Tablo 17",
      },
      {
        key: "fatigue.allowableDz0KgCm2", label: "zul σDz(0)",
        formula: "zul σDz(0) = zul σD(-1) · 100/9,81 · 5/3",
        subst: (x) => `${n(num(x.c["fatigue.allowableD1Nmm2"]))} · 100/9,81 · 5/3`,
        unit: "kg/cm²",
      },
      {
        key: "fatigue.allowableSigmaKgCm2", label: "zul σDz(κ)",
        formula: "zul σDz(κ) = zul σDz(0) / (1 − (1 − zul σDz(0)/(0,75·σB)) · κ)",
        subst: (x) => `${n(num(x.c["fatigue.allowableDz0KgCm2"]))} / (1 − (1 − ${n(num(x.c["fatigue.allowableDz0KgCm2"]))}/(0,75·${n(num(x.c["fatigue.tensileKgCm2"]))})) · ${n(num(x.c["fatigue.kappa"]), 3)})`,
        unit: "kg/cm²", standard: "DIN 15018 Tablo 18",
      },
      {
        key: "fatigue.allowableTauKgCm2", label: "zul τD(κ)",
        formula: "zul τD = T17(malzeme, W0, yük grubu) · 100/9,81 / √3",
        subst: (x) => `${n(num(x.c["fatigue.allowableTauW0Nmm2"]))} · 100/9,81 / √3`,
        unit: "kg/cm²", standard: "DIN 15018 Tablo 17",
      },
      {
        key: "fatigue.combined", label: "Bileşik Yorulma Oranı",
        formula: "(σmaks/zul σDz(κ))² + (τmaks/zul τD)² ≤ 1,1",
        subst: (x) => `(${n(num(x.c["fatigue.sigmaMax"]))}/${n(num(x.c["fatigue.allowableSigmaKgCm2"]))})² + (${n(num(x.c["fatigue.tauMax"]))}/${n(num(x.c["fatigue.allowableTauKgCm2"]))})²`,
        digits: 4, standard: "DIN 15018 7.4.5",
      },
    ],
    checkSuffixes: ["fatigue.sigma", "fatigue.tau", "fatigue.combined"],
  },
];
