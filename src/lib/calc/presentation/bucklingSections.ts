// Buruşma kontrolü sunum katmanı: raporun 8.1 (yan sac) ve 8.2 (üst sac)
// bölümleri. Hesap buckling.ts'tedir; burası yalnız gösterimdir.
//
// Satırlar motorun semantik anahtarlarını (`sidePanel.*` / `topPanel.*`) okur.

import type { BucklingInputs, BucklingPanelInputs } from "../modules/buckling";

export interface BucklingCtx {
  c: Record<string, number | string>; // motorun ürettiği değerler
  inp: BucklingInputs;
}

export interface BucklingRowDef {
  key: string;
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

/** Panel satırlarını üretir; anahtar önekleri panele göre değişir. */
function panelRows(panel: "side" | "top"): BucklingRowDef[] {
  const isSide = panel === "side";
  const p = (x: BucklingCtx): BucklingPanelInputs => (isSide ? x.inp.side : x.inp.top);
  const block = isSide ? "sidePanel" : "topPanel";
  const k = {
    eulerStress: `${block}.eulerStress`,
    combinedStress: `${block}.combinedStress`,
    aspectRatio: `${block}.aspectRatio`,
    stressRatio: `${block}.stressRatio`,
    factorSigma: `${block}.factorSigma`,
    factorTau: `${block}.factorTau`,
    criticalSigma: `${block}.criticalSigma`,
    criticalTau: `${block}.criticalTau`,
    criticalCombined: `${block}.criticalCombined`,
    safetyFactor: `${block}.safetyFactor`,
    allowable: `${block}.allowable`,
  };
  return [
    {
      key: k.eulerStress, label: "Euler Plaka Gerilmesi σER",
      formula: "σER = π² · E · (e/b)² / (12 · (1 − η²))",
      subst: (x) => `π² · ${n(p(x).elasticModulus)} · (${n(p(x).thicknessMm)}/${n(p(x).panelWidthMm)})² / (12 · (1 − ${n(p(x).poisson, 2)}²))`,
      unit: "N/mm²",
    },
    {
      key: k.combinedStress, label: "Bileşik Gerilme σbil", formula: "σbil = √(σ1² + 3τ²)",
      subst: (x) => `√(${n(p(x).sigma1)}² + 3·${n(p(x).tau)}²)`, unit: "N/mm²",
    },
    {
      key: k.aspectRatio, label: "Kenar Oranı α", formula: "α = a / b",
      subst: (x) => `${n(p(x).stiffenerSpacingMm)} / ${n(p(x).panelWidthMm)}`, digits: 3,
    },
    {
      key: k.stressRatio, label: "Gerilme Oranı ψ", formula: "ψ = σ2 / σ1",
      subst: (x) => `${n(p(x).sigma2)} / ${n(p(x).sigma1)}`, digits: 3,
    },
    {
      key: k.factorSigma, label: "Burkulma Katsayısı Kσ",
      formula: "Kσ = f(α, ψ)",
      subst: (x) => `α = ${n(num(x.c[k.aspectRatio]), 3)}, ψ = ${n(num(x.c[k.stressRatio]), 3)} → ${n(num(x.c[k.factorSigma]), 3)}`,
      standard: "FEM 1.001 T.A.3.4.1",
    },
    {
      key: k.factorTau, label: "Burkulma Katsayısı Kτ",
      formula: "Kτ = α>1 → 5,34 + 4/α²; aksi 4 + 5,34/α²",
      subst: (x) => `α = ${n(num(x.c[k.aspectRatio]), 3)} → ${n(num(x.c[k.factorTau]), 3)}`,
      standard: "FEM 1.001 T.A.3.4.1",
    },
    {
      key: k.criticalSigma, label: "Kritik Normal Gerilme σvcr", formula: "σvcr = Kσ · σER",
      subst: (x) => `${n(num(x.c[k.factorSigma]), 3)} · ${n(num(x.c[k.eulerStress]))}`, unit: "N/mm²",
    },
    {
      key: k.criticalTau, label: "Kritik Kesme Gerilmesi τvcr", formula: "τvcr = Kτ · σER",
      subst: (x) => `${n(num(x.c[k.factorTau]), 3)} · ${n(num(x.c[k.eulerStress]))}`, unit: "N/mm²",
    },
    {
      key: k.criticalCombined, label: "Etkileşimli Kritik Gerilme σvcr.c",
      formula: "σvcr.c = σbil / { [(1+ψ)/4]·(σ/σvcr) + √([0,25·(3−ψ)·σ/σvcr]² · [τ/τvcr]²) }",
      subst: (x) => `${n(num(x.c[k.combinedStress]))} / f(ψ=${n(num(x.c[k.stressRatio]), 3)}, σvcr=${n(num(x.c[k.criticalSigma]))}, τvcr=${n(num(x.c[k.criticalTau]))})`,
      unit: "N/mm²",
    },
    {
      key: k.safetyFactor, label: "Buruşma Emniyet Katsayısı vv",
      formula: "vv = 1,7 + 0,175 · (ψ − 1)",
      subst: (x) => `1,7 + 0,175 · (${n(num(x.c[k.stressRatio]), 3)} − 1)`,
      digits: 3, standard: "FEM 1.001 A-3.4",
    },
    {
      key: k.allowable, label: "İzin Verilen Gerilme σvcr.c / vv",
      formula: "σvcr.c / vv",
      subst: (x) => `${n(num(x.c[k.criticalCombined]))} / ${n(num(x.c[k.safetyFactor]), 3)}`,
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
    rows: [
      ...panelRows("side"),
      {
        key: "sidePanel.correctedCritical",
        label: "Düzeltilmiş Kritik Gerilme (Elle)",
        formula: "Berkitme düzenine göre belirlenen kritik gerilme",
        unit: "N/mm²", standard: "FEM 1.001 A-3.4",
      },
    ],
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
