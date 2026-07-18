// Buruşma kontrolü sunum katmanı: Excel 08 sayfasının bölüm yapısı
// (8.1 yan sac, 8.2 üst sac). Hesap buckling.ts'tedir (golden testli);
// burası yalnız gösterimdir (hoistSections deseni).

import type { BucklingInputs, BucklingPanelInputs } from "../modules/buckling";

export interface BucklingCtx {
  c: Record<string, number | string>; // hücre haritası (motor çıktısı)
  inp: BucklingInputs;
}

export interface BucklingRowDef {
  cell: string;
  label: string;
  formula?: string;
  subst?: (ctx: BucklingCtx) => string;
  unit?: string;
  digits?: number;
  standard?: string;
}

export interface BucklingSectionDef {
  id: string;                 // "8.1"
  title: string;
  description?: string;
  /** Bölümün panel girdisi (inp.side / inp.top) */
  panel: "side" | "top";
  inputKeys: (keyof BucklingPanelInputs & string)[];
  rows: BucklingRowDef[];
  /** "buckling." öneki hariç kontrol id sonekleri */
  checkSuffixes: string[];
}

const n = (v: number | string | undefined, d = 2): string => {
  if (v === undefined) return "?";
  if (typeof v === "string") return v;
  if (Number.isInteger(v)) return String(v);
  return v.toLocaleString("tr-TR", { maximumFractionDigits: d });
};
const num = (v: number | string | undefined): number => (typeof v === "number" ? v : NaN);

const PANEL_INPUT_KEYS: (keyof BucklingPanelInputs & string)[] = [
  "elasticModulus", "poisson", "thicknessMm", "panelWidthMm", "stiffenerSpacingMm",
  "sigma1", "sigma2", "tau",
];

/** Panel satırlarını üretir; hücre adları panele göre değişir. */
function panelRows(panel: "side" | "top"): BucklingRowDef[] {
  const s = panel === "side";
  const p = (x: BucklingCtx): BucklingPanelInputs => (s ? x.inp.side : x.inp.top);
  const cell = {
    sigmaER: s ? "L16" : "L75", sigmaCombined: s ? "L24" : "L83",
    alpha: s ? "L28" : "L87", psi: s ? "L32" : "L91",
    kSigma: s ? "L34" : "L93", kTau: s ? "L35" : "L94",
    sigmaVcr: s ? "L39" : "L98", tauVcr: s ? "L43" : "L102",
    sigmaVcrC: s ? "L48" : "L107", safetyVv: s ? "L50" : "L109",
    allowable: s ? "L52" : "L111",
  };
  return [
    {
      cell: cell.sigmaER, label: "Euler plaka gerilmesi σER",
      formula: "σER = π² · E · (e/b)² / (12 · (1 − η²))",
      subst: (x) => `π² · ${n(p(x).elasticModulus)} · (${n(p(x).thicknessMm)}/${n(p(x).panelWidthMm)})² / (12 · (1 − ${n(p(x).poisson, 2)}²))`,
      unit: "N/mm²",
    },
    {
      cell: cell.sigmaCombined, label: "Bileşik gerilme σbil", formula: "σbil = √(σ1² + 3τ²)",
      subst: (x) => `√(${n(p(x).sigma1)}² + 3·${n(p(x).tau)}²)`, unit: "N/mm²",
    },
    {
      cell: cell.alpha, label: "Kenar oranı α", formula: "α = a / b",
      subst: (x) => `${n(p(x).stiffenerSpacingMm)} / ${n(p(x).panelWidthMm)}`, digits: 3,
    },
    {
      cell: cell.psi, label: "Gerilme oranı ψ", formula: "ψ = σ2 / σ1",
      subst: (x) => `${n(p(x).sigma2)} / ${n(p(x).sigma1)}`, digits: 3,
    },
    {
      cell: cell.kSigma, label: "Burkulma katsayısı Kσ",
      formula: "Kσ = f(α, ψ)  [FEM T.A.3.4.1]",
      subst: (x) => `α = ${n(num(x.c[cell.alpha]), 3)}, ψ = ${n(num(x.c[cell.psi]), 3)} → ${n(num(x.c[cell.kSigma]), 3)}`,
      standard: "FEM 1.001 T.A.3.4.1",
    },
    {
      cell: cell.kTau, label: "Burkulma katsayısı Kτ",
      formula: "Kτ = α>1 → 5,34 + 4/α²; aksi 4 + 5,34/α²",
      subst: (x) => `α = ${n(num(x.c[cell.alpha]), 3)} → ${n(num(x.c[cell.kTau]), 3)}`,
      standard: "FEM 1.001 T.A.3.4.1",
    },
    {
      cell: cell.sigmaVcr, label: "Kritik normal gerilme σvcr", formula: "σvcr = Kσ · σER",
      subst: (x) => `${n(num(x.c[cell.kSigma]), 3)} · ${n(num(x.c[cell.sigmaER]))}`, unit: "N/mm²",
    },
    {
      cell: cell.tauVcr, label: "Kritik kesme gerilmesi τvcr", formula: "τvcr = Kτ · σER",
      subst: (x) => `${n(num(x.c[cell.kTau]), 3)} · ${n(num(x.c[cell.sigmaER]))}`, unit: "N/mm²",
    },
    {
      cell: cell.sigmaVcrC, label: "Etkileşimli kritik gerilme σvcr.c",
      formula: "σvcr.c = σbil / { [(1+ψ)/4]·(σ/σvcr) + √([0,25·(3−ψ)·σ/σvcr]² · [τ/τvcr]²) }",
      subst: (x) => `${n(num(x.c[cell.sigmaCombined]))} / f(ψ=${n(num(x.c[cell.psi]), 3)}, σvcr=${n(num(x.c[cell.sigmaVcr]))}, τvcr=${n(num(x.c[cell.tauVcr]))})`,
      unit: "N/mm²",
    },
    {
      cell: cell.safetyVv, label: "Buruşma emniyet katsayısı vv",
      formula: "vv = 1,7 + 0,175 · (ψ − 1)",
      subst: (x) => `1,7 + 0,175 · (${n(num(x.c[cell.psi]), 3)} − 1)`,
      digits: 3, standard: "FEM 1.001 3.4",
    },
    {
      cell: cell.allowable, label: "İzin verilen gerilme σvcr.c / vv",
      formula: "σvcr.c / vv",
      subst: (x) => `${n(num(x.c[cell.sigmaVcrC]))} / ${n(num(x.c[cell.safetyVv]), 3)}`,
      unit: "N/mm²",
    },
  ];
}

export const BUCKLING_SECTIONS: BucklingSectionDef[] = [
  {
    id: "8.1",
    title: "Yan Sac",
    description:
      "Üst sac ile köşebent arasındaki basınç bölgesinin plaka burkulması kontrolü (FEM 1.001 3.4).",
    panel: "side",
    inputKeys: PANEL_INPUT_KEYS,
    rows: panelRows("side"),
    checkSuffixes: ["side.interaction", "side.corrected"],
  },
  {
    id: "8.2",
    title: "Üst Sac",
    description: "Ray altı basınç bölgesinin plaka burkulması kontrolü (FEM 1.001 3.4).",
    panel: "top",
    inputKeys: PANEL_INPUT_KEYS,
    rows: panelRows("top"),
    checkSuffixes: ["top.interaction"],
  },
];
