// Buruşma kontrolü sunum katmanı — raporun 8.1 (yan sac) ve 8.2 (üst sac)
// bölümleri. Hesap `modules/buckling.ts` ve `plate-buckling.ts`tedir; burası
// yalnız gösterimdir.
//
// Satırlar MOTORUN semantik anahtarlarını okur (`sidePanel.*` / `topPanel.*`);
// hiçbir değer burada yeniden hesaplanmaz. Panel ölçüleri ve gerilmeleri de
// motorun kullandığı EFEKTİF değerlerdir (otomatik türetildiyse ana kirişten
// gelen değerler), bu yüzden rapor her zaman gerçekten hesaplanan sayıyı basar.
//
// Satır sırası mühendislik zincirini izler:
//   kaynak → geometri → gerilmeler → kenar oranı/gerilme oranı → katsayılar →
//   kritik gerilmeler → orantı sınırı ve indirgeme → emniyet katsayısı →
//   izin verilen gerilme → kullanım oranı → test durumu

import { BUCKLING_CASE_LABEL, type BucklingCaseNo } from "../plate-buckling";
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
  if (!Number.isFinite(v)) return "—";
  if (Number.isInteger(v)) return String(v);
  return v.toLocaleString("tr-TR", { maximumFractionDigits: d });
};
const num = (v: number | string | undefined): number => (typeof v === "number" ? v : NaN);

const PANEL_INPUT_KEYS: (keyof BucklingPanelInputs & string)[] = [
  "thicknessMm", "panelWidthMm", "stiffenerSpacingMm", "sigma1", "sigma2", "tau",
];

/** Panel satırlarını üretir; anahtar önekleri panele göre değişir. */
function panelRows(panel: "side" | "top"): BucklingRowDef[] {
  const block = panel === "side" ? "sidePanel" : "topPanel";
  const k = (q: string) => `${block}.${q}`;
  /** Motorun ürettiği değeri okur (kısaltma). */
  const g = (x: BucklingCtx, q: string) => num(x.c[k(q)]);

  return [
    // ------------------------------------------------------------ geometri
    {
      key: k("thickness"), label: "Sac Kalınlığı e", unit: "mm", digits: 1,
      formula: "kesitten okunur",
      subst: (x) => `${x.c["source.auto"] ?? ""}`,
      standard: "FEM 1.001 A-3.4",
    },
    {
      key: k("width"), label: "Panel Genişliği b (Basınca Dik)", unit: "mm", digits: 1,
      formula:
        panel === "side"
          ? "b = boyuna berkitme mesafesi (yoksa gövde yüksekliği h3)"
          : "b = gövde sacları arası net açıklık a",
      standard: "FEM 1.001 A-3.4",
    },
    {
      key: k("length"), label: "Panel Uzunluğu a (Perde Aralığı)", unit: "mm", digits: 1,
      formula: "a = ana kirişin iki perdesi arası l1",
      standard: "FEM 1.001 A-3.4",
    },
    {
      key: k("aspectRatio"), label: "Kenar Oranı α", formula: "α = a / b", digits: 3,
      subst: (x) => `${n(g(x, "length"), 1)} / ${n(g(x, "width"), 1)}`,
      standard: "FEM 1.001 T.A.3.4.1",
    },
    // ---------------------------------------------------------- gerilmeler
    {
      key: k("sigmaEdge1"), label: "Basınç Kenarı Gerilmesi σ1", unit: "N/mm²", digits: 2,
      formula: "kesit gerilme dağılımından, γc dahil (basınç +)",
      standard: "FEM 1.001 T.A.3.4.1",
    },
    {
      key: k("sigmaEdge2"), label: "Karşı Kenar Gerilmesi σ2", unit: "N/mm²", digits: 2,
      formula: "kesit gerilme dağılımından, γc dahil (çekme −)",
      standard: "FEM 1.001 T.A.3.4.1",
    },
    {
      key: k("shearStress"), label: "Kayma Gerilmesi τ", unit: "N/mm²", digits: 2,
      formula:
        panel === "side"
          ? "ana gövde sacının ortalama kayması (Durum I)"
          : "kapalı kesitin burulma akışından: τ = τburulma · (t3+t4)/2 / t2",
      standard: "FEM 1.001 A-3.4",
    },
    {
      key: k("stressRatio"), label: "Gerilme Oranı ψ", formula: "ψ = σ2 / σ1", digits: 3,
      subst: (x) =>
        `${n(g(x, "sigmaEdge2"), 2)} / ${n(g(x, "sigmaEdge1"), 2)}` +
        ` → ${BUCKLING_CASE_LABEL[(num(x.c[k("tableCase")]) as BucklingCaseNo) || 2]}`,
      standard: "FEM 1.001 T.A.3.4.1",
    },
    // ------------------------------------------------------- Euler + katsayılar
    {
      key: k("eulerStress"), label: "Euler Referans Gerilmesi σER",
      formula: "σER = π² · E · (e/b)² / [12 · (1 − η²)]",
      subst: (x) =>
        `π² · ${n(x.c["material.elasticModulus"])} · (${n(g(x, "thickness"), 1)}/${n(g(x, "width"), 1)})²` +
        ` / [12 · (1 − ${n(x.c["material.poisson"], 2)}²)]`,
      unit: "N/mm²", digits: 2, standard: "FEM 1.001 A-3.4",
    },
    {
      key: k("factorSigma"), label: "Burkulma Katsayısı Kσ",
      formula: "Kσ = f(α, ψ) — Tablo T.A.3.4.1",
      subst: (x) =>
        `α = ${n(g(x, "aspectRatio"), 3)} · ψ = ${n(g(x, "stressRatio"), 3)}` +
        ` → ${n(g(x, "factorSigma"), 3)}`,
      digits: 3, standard: "FEM 1.001 T.A.3.4.1",
    },
    {
      key: k("factorTau"), label: "Burkulma Katsayısı Kτ",
      formula: "Kτ = α ≥ 1 → 5,34 + 4/α² ; α ≤ 1 → 4 + 5,34/α²",
      subst: (x) => `α = ${n(g(x, "aspectRatio"), 3)} → ${n(g(x, "factorTau"), 3)}`,
      digits: 3, standard: "FEM 1.001 T.A.3.4.1",
    },
    // ------------------------------------------------ elastik kritik gerilmeler
    {
      key: k("criticalSigmaElastic"), label: "Elastik Kritik Normal Gerilme σvcr",
      formula: "σvcr = Kσ · σER",
      subst: (x) => `${n(g(x, "factorSigma"), 3)} · ${n(g(x, "eulerStress"), 2)}`,
      unit: "N/mm²", digits: 1, standard: "FEM 1.001 A-3.4",
    },
    {
      key: k("criticalTauElastic"), label: "Elastik Kritik Kayma Gerilmesi τvcr",
      formula: "τvcr = Kτ · σER",
      subst: (x) => `${n(g(x, "factorTau"), 3)} · ${n(g(x, "eulerStress"), 2)}`,
      unit: "N/mm²", digits: 1, standard: "FEM 1.001 A-3.4",
    },
    // ----------------------------------------------- orantı sınırı / indirgeme
    {
      key: k("proportionalLimit"), label: "Orantı Sınırı σP",
      formula: "malzemeye göre: St 37 → 190 · St 52 → 290 N/mm²",
      subst: (x) => `${x.c["material.steel"] ?? "?"}`,
      unit: "N/mm²", digits: 0, standard: "FEM 1.001 T.A.3.4.2",
    },
    {
      key: k("reductionSigma"), label: "İndirgeme Katsayısı ρ (Normal)",
      formula: "σvcr > σP ise Tablo T.A.3.4.2'den; değilse ρ = 1",
      subst: (x) =>
        `σvcr = ${n(g(x, "criticalSigmaElastic"), 1)} · σP = ${n(g(x, "proportionalLimit"), 0)}` +
        ` → ρ = ${n(g(x, "reductionSigma"), 3)}`,
      digits: 3, standard: "FEM 1.001 T.A.3.4.2",
    },
    {
      key: k("criticalSigma"), label: "İndirgenmiş Kritik Normal Gerilme σvcr,ind",
      formula: "σvcr,ind = ρ · σvcr",
      subst: (x) =>
        `${n(g(x, "reductionSigma"), 3)} · ${n(g(x, "criticalSigmaElastic"), 1)}`,
      unit: "N/mm²", digits: 1, standard: "FEM 1.001 T.A.3.4.2",
    },
    {
      key: k("shearLimit"), label: "Kayma İçin Orantı Sınırı σP/√3",
      formula: "FEM koşulu: √3 · τvcr ≤ σP",
      unit: "N/mm²", digits: 1, standard: "FEM 1.001 T.A.3.4.2",
    },
    {
      key: k("criticalTau"), label: "İndirgenmiş Kritik Kayma Gerilmesi τvcr,ind",
      formula: "√3·τvcr indirgenip tekrar √3'e bölünür",
      subst: (x) =>
        `ρ = ${n(g(x, "reductionTau"), 3)} · τvcr = ${n(g(x, "criticalTauElastic"), 1)}`,
      unit: "N/mm²", digits: 1, standard: "FEM 1.001 T.A.3.4.2",
    },
    // ------------------------------------------- Durum I: etkileşim ve emniyet
    {
      key: k("combinedStress"), label: "Karşılaştırma Gerilmesi σbil (Durum I)",
      formula: "σbil = √(σ1² + 3τ²)",
      subst: (x) => `√(${n(g(x, "sigmaEdge1"), 2)}² + 3 · ${n(g(x, "shearStress"), 2)}²)`,
      unit: "N/mm²", digits: 2, standard: "FEM 1.001 3.2.1.3",
    },
    {
      key: k("criticalCombinedElastic"), label: "Etkileşimli Kritik Gerilme σvcr.c",
      formula:
        "σvcr.c = σbil / { (1+ψ)/4 · (σ/σvcr) + √( [0,25·(3−ψ)·σ/σvcr]² + [τ/τvcr]² ) }",
      subst: (x) =>
        `σ/σvcr = ${n(g(x, "sigmaEdge1") / g(x, "criticalSigma"), 4)} · ` +
        `τ/τvcr = ${n(Math.abs(g(x, "shearStress")) / g(x, "criticalTau"), 4)} · ` +
        `ψ = ${n(g(x, "stressRatioClamped"), 3)}`,
      unit: "N/mm²", digits: 1, standard: "FEM 1.001 A-3.4",
    },
    {
      key: k("criticalCombined"), label: "İndirgenmiş σvcr.c,ind",
      formula: "σvcr.c orantı sınırını aşıyorsa T.A.3.4.2 ile indirgenir",
      subst: (x) =>
        `ρ = ${n(g(x, "reductionCombined"), 3)} · ${n(g(x, "criticalCombinedElastic"), 1)}`,
      unit: "N/mm²", digits: 1, standard: "FEM 1.001 T.A.3.4.2",
    },
    {
      key: k("safetyFactor"), label: "Buruşma Emniyet Katsayısı νv (Durum I)",
      formula: "νv = 1,70 + 0,175 · (ψ − 1)",
      subst: (x) => `1,70 + 0,175 · (${n(g(x, "stressRatioClamped"), 3)} − 1)`,
      digits: 3, standard: "FEM 1.001 3.4",
    },
    {
      key: k("allowable"), label: "İzin Verilen Gerilme σvcr.c,ind / νv",
      formula: "izin verilen = σvcr.c,ind / νv",
      subst: (x) =>
        `${n(g(x, "criticalCombined"), 1)} / ${n(g(x, "safetyFactor"), 3)}`,
      unit: "N/mm²", digits: 2, standard: "FEM 1.001 A-3.4",
    },
    {
      key: k("utilization"), label: "Kullanım Oranı (Durum I)",
      formula: "σbil / izin verilen",
      subst: (x) =>
        `${n(g(x, "combinedStress"), 2)} / ${n(g(x, "allowable"), 2)}` +
        ` = %${n(g(x, "utilization") * 100, 1)}`,
      digits: 3,
    },
    // --------------------------------------------------- Durum III (test yükü)
    {
      key: k("sigmaCase3"), label: "Basınç Kenarı Gerilmesi σ1 (Durum III)",
      formula: "σ1 · (Durum III / Durum I gerilme oranı)",
      subst: (x) =>
        `${n(g(x, "sigmaEdge1"), 2)} · ${n(x.c["source.sigmaRatioCase3"], 4)}`,
      unit: "N/mm²", digits: 2, standard: "FEM 1.001 3.4",
    },
    {
      key: k("combinedStressCase3"), label: "Karşılaştırma Gerilmesi σbil (Durum III)",
      formula: "σbil = √(σ1² + 3τ²)",
      unit: "N/mm²", digits: 2, standard: "FEM 1.001 3.2.1.3",
    },
    {
      key: k("safetyFactorCase3"), label: "Emniyet Katsayısı νv (Durum III)",
      formula: "νv = 1,35 + 0,075 · (ψ − 1)",
      subst: (x) => `1,35 + 0,075 · (${n(g(x, "stressRatioClamped"), 3)} − 1)`,
      digits: 3, standard: "FEM 1.001 3.4",
    },
    {
      key: k("allowableCase3"), label: "İzin Verilen Gerilme (Durum III)",
      formula: "σvcr.c,ind / νv",
      unit: "N/mm²", digits: 2, standard: "FEM 1.001 3.4",
    },
    {
      key: k("utilizationCase3"), label: "Kullanım Oranı (Durum III)",
      formula: "σbil / izin verilen",
      subst: (x) => `%${n(g(x, "utilizationCase3") * 100, 1)}`,
      digits: 3,
    },
  ];
}

export const BUCKLING_SECTIONS: BucklingSectionDef[] = [
  {
    id: "8.1",
    title: "Yan Sac (Gövde) Paneli",
    description:
      "Gövde sacının basınç bölgesindeki panelin plaka burkulması kontrolü. " +
      "Panel, üst başlık ile gövdeye kaynaklı boyuna berkitme (köşebent) " +
      "arasındaki bölgedir; berkitme yoksa gövdenin tamamı tek panel sayılır. " +
      "Ölçüler ve kenar gerilmeleri ana kirişin kesitinden ve gerilme " +
      "analizinden otomatik gelir (FEM 1.001 md. 3.4 + Appendix A-3.4).",
    panel: "side",
    inputKeys: PANEL_INPUT_KEYS,
    rows: panelRows("side"),
    checkSuffixes: ["side.case1", "side.case3", "side.width"],
  },
  {
    id: "8.2",
    title: "Üst Sac (Basınç Başlığı) Paneli",
    description:
      "Basınç başlığının gövde sacları arasında kalan, dört kenarından " +
      "mesnetli bölümünün burkulma kontrolü. Başlık kalınlığı boyunca gerilme " +
      "düzgün kabul edilir (ψ = +1, T.A.3.4.1 durum 1). Başlığın gövdelerden " +
      "dışarı taşan çıkmaları üç kenarından mesnetli olduğu için bu tablonun " +
      "kapsamı dışındadır ve kontrol edilmez.",
    panel: "top",
    inputKeys: PANEL_INPUT_KEYS,
    rows: panelRows("top"),
    checkSuffixes: ["top.case1", "top.case3", "top.width", "loadCaseII.scope"],
  },
];
