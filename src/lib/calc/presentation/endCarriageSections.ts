// Başkiriş sunum katmanı: Excel 09 sayfasının bölüm yapısı (9.1 ... 9.4).
// Hesap endCarriage.ts'tedir (golden testli); burası yalnız gösterimdir
// (hoistSections deseni). Yorulma bölümü (9.4) Excel'in bozuk bloğunun
// yerine yeniden yazılan hesabın `fatigue.*` anahtarlarını okur.

import type {
  EndCarriageDeps,
  EndCarriageInputs,
  EndCarriageSelections,
} from "../modules/endCarriage";
import type { TechnicalSpecs } from "../types";

export interface EndCarriageCtx {
  c: Record<string, number | string>; // hücre haritası (motor çıktısı)
  inp: EndCarriageInputs;
  sel: EndCarriageSelections;
  deps: EndCarriageDeps;
  specs: TechnicalSpecs;
}

export interface EndCarriageRowDef {
  cell: string;              // Excel hücresi veya "fatigue.*" anahtarı
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
    depKeys: ["mainHoistTotalLoadKg", "trolleyWeightT", "bridgeGirdersWeightT", "bridgeEndCarriagesWeightT"],
    inputKeys: ["wheelSpanAMm", "loadOffsetBMm"],
    selectionKeys: [],
    rows: [
      {
        cell: "L11", label: "Maksimum tekerlek yükü Fmaks",
        formula: "Fmaks = (W/2 + Wa·1000/2) · 0,9 + (G_kiriş + G_başkiriş)·1000/4",
        subst: (x) => `(${n(x.deps.mainHoistTotalLoadKg)}/2 + ${n(x.deps.trolleyWeightT)}·1000/2) · 0,9 + (${n(x.deps.bridgeGirdersWeightT)} + ${n(x.deps.bridgeEndCarriagesWeightT)})·1000/4`,
        unit: "kg",
      },
      {
        cell: "L12", label: "Minimum tekerlek yükü Fmin",
        formula: "Fmin = (Wa·1000/2) · 0,5 + (G_kiriş + G_başkiriş)·1000/4",
        subst: (x) => `(${n(x.deps.trolleyWeightT)}·1000/2) · 0,5 + (${n(x.deps.bridgeGirdersWeightT)} + ${n(x.deps.bridgeEndCarriagesWeightT)})·1000/4`,
        unit: "kg",
      },
      {
        cell: "L18", label: "Maksimum moment Mmaks", formula: "Mmaks = Fmaks · b / 10",
        subst: (x) => `${n(num(x.c.L11))} · ${n(x.inp.loadOffsetBMm)} / 10`, unit: "kg·cm",
      },
      {
        cell: "L21", label: "Minimum moment Mmin", formula: "Mmin = Fmin · b / 10",
        subst: (x) => `${n(num(x.c.L12))} · ${n(x.inp.loadOffsetBMm)} / 10`, unit: "kg·cm",
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
        cell: "L29", label: "Birim ağırlık G", formula: "G = ΣA · 1000 · 7,85 / 10⁶",
        unit: "kg/m",
      },
      {
        cell: "L30", label: "Atalet momenti I", formula: "I = Σ(Ii + Ai · di²)", unit: "cm⁴",
      },
      {
        cell: "L31", label: "Kesit modülü W", formula: "W = I / (h/2)",
        subst: (x) => `${n(num(x.c.L30))} / ${n(x.inp.sidePlateHeightMm / 20)}`, unit: "cm³",
      },
      {
        cell: "L32", label: "Kesit alanı A", unit: "cm²",
      },
      {
        cell: "L33", label: "Yan sacların alanı Ay", formula: "Ay = 2 · e · h",
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
    selectionKeys: ["hoistClass", "material"],
    rows: [
      {
        cell: "L39", label: "Dinamik katsayı ψ", formula: "ψ = k + l · v_kaldırma",
        subst: (x) => `${n(num(x.c.L41))} + ${n(num(x.c.L42), 4)} · ${n(x.specs.mainLiftSpeedMpm)}`,
        digits: 3, standard: "DIN 15018 Tablo 2",
      },
      {
        cell: "L45", label: "Eğilme gerilmesi σ", formula: "σ = Mmaks · ψ / W",
        subst: (x) => `${n(num(x.c.L18))} · ${n(num(x.c.L39), 3)} / ${n(num(x.c.L31))}`, unit: "kg/cm²",
      },
      {
        cell: "L46", label: "Kesme gerilmesi τ", formula: "τ = Fmaks · ψ / Ay",
        subst: (x) => `${n(num(x.c.L11))} · ${n(num(x.c.L39), 3)} / ${n(num(x.c.L33))}`, unit: "kg/cm²",
      },
      {
        cell: "L47", label: "Bileşik gerilme σbil", formula: "σbil = √(σ² + 3τ²)",
        subst: (x) => `√(${n(num(x.c.L45))}² + 3·${n(num(x.c.L46))}²)`, unit: "kg/cm²",
      },
      {
        cell: "L50", label: "İzin verilen gerilme", formula: "σem = f(malzeme)",
        subst: (x) => `${x.sel.material} → ${n(num(x.c.L50))}`, unit: "kg/cm²",
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
    selectionKeys: ["fatigueMaterial", "fatigueLoadGroup", "fatigueNotchClass"],
    rows: [
      {
        cell: "L55", label: "σmaks", formula: "σmaks = Mmaks / W",
        subst: (x) => `${n(num(x.c.L18))} / ${n(num(x.c.L31))}`, unit: "kg/cm²",
      },
      {
        cell: "L56", label: "τmaks", formula: "τmaks = Fmaks / Ay",
        subst: (x) => `${n(num(x.c.L11))} / ${n(num(x.c.L33))}`, unit: "kg/cm²",
      },
      {
        cell: "L60", label: "σmin", formula: "σmin = Mmin / W",
        subst: (x) => `${n(num(x.c.L21))} / ${n(num(x.c.L31))}`, unit: "kg/cm²",
      },
      {
        cell: "L77", label: "κ", formula: "κ = σbil,min / σbil,maks",
        subst: (x) => `${n(num(x.c.L62))} / ${n(num(x.c.L57))}`, digits: 3,
      },
      {
        cell: "fatigue.zulSigmaD1Nmm2", label: "zul σD(-1)",
        formula: "T17(malzeme, çentik, yük grubu)",
        subst: (x) => `${x.sel.fatigueMaterial} / ${x.sel.fatigueNotchClass} / ${x.sel.fatigueLoadGroup} → ${n(num(x.c["fatigue.zulSigmaD1Nmm2"]))}`,
        unit: "N/mm²", standard: "DIN 15018 Tablo 17",
      },
      {
        cell: "fatigue.zulSigmaDz0KgCm2", label: "zul σDz(0)",
        formula: "zul σDz(0) = zul σD(-1) · 100/9,81 · 5/3",
        subst: (x) => `${n(num(x.c["fatigue.zulSigmaD1Nmm2"]))} · 100/9,81 · 5/3`,
        unit: "kg/cm²",
      },
      {
        cell: "fatigue.zulSigmaDzKappaKgCm2", label: "zul σDz(κ)",
        formula: "zul σDz(κ) = zul σDz(0) / (1 − (1 − zul σDz(0)/(0,75·σB)) · κ)",
        subst: (x) => `${n(num(x.c["fatigue.zulSigmaDz0KgCm2"]))} / (1 − (1 − ${n(num(x.c["fatigue.zulSigmaDz0KgCm2"]))}/(0,75·${n(num(x.c["fatigue.sigmaBKgCm2"]))})) · ${n(num(x.c.L77), 3)})`,
        unit: "kg/cm²", standard: "DIN 15018 Tablo 18",
      },
      {
        cell: "fatigue.zulTauDKgCm2", label: "zul τD(κ)",
        formula: "zul τD = T17(malzeme, W0, yük grubu) · 100/9,81 / √3",
        subst: (x) => `${n(num(x.c["fatigue.zulTauW0Nmm2"]))} · 100/9,81 / √3`,
        unit: "kg/cm²", standard: "DIN 15018 Tablo 17",
      },
      {
        cell: "fatigue.combined", label: "Bileşik yorulma oranı",
        formula: "(σmaks/zul σDz(κ))² + (τmaks/zul τD)² ≤ 1,1",
        subst: (x) => `(${n(num(x.c.L55))}/${n(num(x.c["fatigue.zulSigmaDzKappaKgCm2"]))})² + (${n(num(x.c.L56))}/${n(num(x.c["fatigue.zulTauDKgCm2"]))})²`,
        digits: 4, standard: "DIN 15018 7.4.5",
      },
    ],
    checkSuffixes: ["fatigue.sigma", "fatigue.tau", "fatigue.combined"],
  },
];
