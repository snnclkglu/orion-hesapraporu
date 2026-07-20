// Buruşma (plaka burkulması) kontrolü — Excel "08-BURUŞMA KONTROLÜ"
// sayfasının parametrik karşılığı. İki panel hesaplanır: yan sac (8.1) ve
// üst sac (8.2). σER Euler plaka gerilmesi, ψ ve α oranları, FEM 1.001
// T.A.3.4.1 Kσ/Kτ katsayıları (Excel yardımcı hücreleri AA32:AA34 ve X32
// dahil birebir), kritik gerilmeler, etkileşim formülü σvcr.c ve emniyet
// katsayısı vv = 1,7 + 0,175(ψ−1).
//
// Panel gerilmeleri (σ1, σ2, τ) Excel'de elle girilen statiklerdir → girdi.
// Birimler: N/mm², mm. Excel bu sayfada PI() (tam hassasiyet) kullanır.

import type { AnyCheck, ModuleResult } from "../types";

/** Tek panelin girdileri (Excel yan sac L9:L23 / üst sac L68:L82 statikleri) */
export interface BucklingPanelInputs {
  elasticModulus: number;     // L9 / L68  — E [N/mm²]
  poisson: number;            // L10 / L69 — Poisson oranı
  thicknessMm: number;        // L11 / L70 — sac kalınlığı e [mm]
  panelWidthMm: number;       // L12 / L71 — panel genişliği b [mm]
  stiffenerSpacingMm: number; // L13 / L72 — iki perde arası a [mm]
  sigma1: number;             // L21 / L80 — panel kenarı gerilmesi σ1 [N/mm²]
  sigma2: number;             // L22 / L81 — diğer kenar gerilmesi σ2 [N/mm²]
  tau: number;                // L23 / L82 — kesme gerilmesi τ [N/mm²]
}

export interface BucklingInputs {
  side: BucklingPanelInputs;         // 8.1 Yan sac
  top: BucklingPanelInputs;          // 8.2 Üst sac
  sideCorrectedCriticalNmm2: number; // L54 — düzeltilmiş kritik gerilme (elle) [N/mm²]
}

/** Tek panelin hesap sonuçları (hücre adları yan sac satırlarına göre) */
export interface BucklingPanelValues {
  sigmaER: number;       // L16 / L75 — Euler plaka gerilmesi [N/mm²]
  sigmaCombined: number; // L24 / L83 — bileşik gerilme σbil [N/mm²]
  alpha: number;         // L28 / L87 — a/b
  psi: number;           // L32 / L91 — σ2/σ1
  kSigma: number;        // L34 / L93 — Kσ (FEM T.A.3.4.1)
  kTau: number;          // L35 / L94 — Kτ
  sigmaVcr: number;      // L39 / L98 — kritik normal gerilme [N/mm²]
  tauVcr: number;        // L43 / L102 — kritik kesme gerilmesi [N/mm²]
  sigmaVcrC: number;     // L48 / L107 — etkileşimli kritik gerilme [N/mm²]
  safetyVv: number;      // L50 / L109 — buruşma emniyet katsayısı vv
  allowable: number;     // L52 / L111 — σvcr.c / vv [N/mm²]
}

export interface BucklingValues {
  side: BucklingPanelValues;
  top: BucklingPanelValues;
  sideCorrectedCritical: number; // L54
}

interface PanelCellRefs {
  sigmaER: string; sigmaCombined: string; alpha: string; psi: string;
  psiCase: string; aa1: string; aa2: string; aa3: string;
  kSigma: string; kTau: string; sigmaVcr: string; tauVcr: string;
  sigmaVcrC: string; safetyVv: string; allowable: string;
}

const SIDE_REFS: PanelCellRefs = {
  sigmaER: "L16", sigmaCombined: "L24", alpha: "L28", psi: "L32",
  psiCase: "X32", aa1: "AA32", aa2: "AA33", aa3: "AA34",
  kSigma: "L34", kTau: "L35", sigmaVcr: "L39", tauVcr: "L43",
  sigmaVcrC: "L48", safetyVv: "L50", allowable: "L52",
};

const TOP_REFS: PanelCellRefs = {
  sigmaER: "L75", sigmaCombined: "L83", alpha: "L87", psi: "L91",
  psiCase: "X91", aa1: "AA91", aa2: "AA92", aa3: "AA93",
  kSigma: "L93", kTau: "L94", sigmaVcr: "L98", tauVcr: "L102",
  sigmaVcrC: "L107", safetyVv: "L109", allowable: "L111",
};

function computePanel(
  p: BucklingPanelInputs,
  refs: PanelCellRefs,
  cells: Record<string, number | string>
): BucklingPanelValues {
  const E = p.elasticModulus, nu = p.poisson;
  const e = p.thicknessMm, b = p.panelWidthMm, a = p.stiffenerSpacingMm;
  const s1 = p.sigma1, s2 = p.sigma2, t = p.tau;

  // σER = π²·E·(e/b)² / (12·(1−η²))  — Excel L16/L75, PI()
  const sigmaER = (Math.PI ** 2 * E * (e / b) ** 2) / (12 * (1 - nu ** 2));
  // σbil = (σ1² + 3τ²)^0,5 — Excel L24/L83
  const sigmaCombined = (s1 ** 2 + 3 * t ** 2) ** 0.5;
  const alpha = a / b;      // L28/L87
  const psi = s2 / s1;      // L32/L91
  // Yardımcı hücre X32/X91: ψ aralığı göstergesi (2: ψ≥0, 3: ψ≤−1, 4: −1<ψ<0)
  const psiCase = psi >= 0 ? 2 : psi <= -1 ? 3 : 4;

  // FEM T.A.3.4.1 Kσ yardımcı hücreleri — Excel AA32:AA34 / AA91:AA93 birebir
  // AA32: ψ ≤ −1 durumu
  const aa1 = alpha >= 2 / 3 ? 23.9 : 15.87 + 1.87 / alpha ** 2 + 8.6 * alpha ** 2;
  // AA33: −1 < ψ ≤ 0 durumu (Excel'in son dalında 8,6/α² yazılıdır; sadık kalındı)
  const aa2 =
    alpha > 1
      ? ((1 + psi) * 8.4) / 1.1 - psi * 23.9 + 10 * psi * (1 + psi)
      : alpha > 2 / 3
        ? ((1 + psi) * (alpha + 1 / alpha) ** 2 * 2.1) / 1.1 - psi * 23.9 + 10 * psi * (1 + psi)
        : ((1 + psi) * (alpha + 1 / alpha) ** 2 * 2.1) / 1.1 -
          psi * (15.87 + 1.87 / alpha ** 2 + 8.6 / alpha ** 2) +
          10 * psi * (1 + psi);
  // AA34: ψ > 0 durumu
  const aa3 = alpha > 1 ? 8.4 / (psi + 1.1) : ((alpha + 1 / alpha) ** 2 * 2.1) / (psi + 1.1);
  // Kσ seçimi — Excel L34/L93
  const kSigma = psi <= -1 ? aa1 : psi > -1 && psi <= 0 ? aa2 : aa3;
  // Kτ — Excel L35/L94
  const kTau = alpha > 1 ? 5.34 + 4 / alpha ** 2 : 4 + 5.34 / alpha ** 2;

  const sigmaVcr = kSigma * sigmaER; // L39/L98
  const tauVcr = kTau * sigmaER;     // L43/L102
  // Etkileşim: σvcr.c — Excel L48/L107
  const sigmaVcrC =
    sigmaCombined /
    (((1 + psi) / 4) * (Math.abs(s1) / sigmaVcr) +
      ((0.25 * (3 - psi) * (Math.abs(s1) / sigmaVcr)) ** 2 * (Math.abs(t) / tauVcr) ** 2) ** 0.5);
  // vv = 1,7 + 0,175(ψ−1) — FEM 1.001 3.4, Excel L50/L109
  const safetyVv = 1.7 + 0.175 * (psi - 1);
  const allowable = sigmaVcrC / safetyVv; // L52/L111

  cells[refs.sigmaER] = sigmaER;
  cells[refs.sigmaCombined] = sigmaCombined;
  cells[refs.alpha] = alpha;
  cells[refs.psi] = psi;
  cells[refs.psiCase] = psiCase;
  cells[refs.aa1] = aa1;
  cells[refs.aa2] = aa2;
  cells[refs.aa3] = aa3;
  cells[refs.kSigma] = kSigma;
  cells[refs.kTau] = kTau;
  cells[refs.sigmaVcr] = sigmaVcr;
  cells[refs.tauVcr] = tauVcr;
  cells[refs.sigmaVcrC] = sigmaVcrC;
  cells[refs.safetyVv] = safetyVv;
  cells[refs.allowable] = allowable;

  return {
    sigmaER, sigmaCombined, alpha, psi, kSigma, kTau,
    sigmaVcr, tauVcr, sigmaVcrC, safetyVv, allowable,
  };
}

export function computeBuckling(inp: BucklingInputs): ModuleResult<BucklingValues> {
  const cells: Record<string, number | string> = {};
  const checks: AnyCheck[] = [];

  // --- 8.1 Yan sac ----------------------------------------------------------
  const side = computePanel(inp.side, SIDE_REFS, cells);
  cells.Q52 = side.sigmaCombined; // Excel Q52 = L24 (karşılaştırma göstergesi)
  cells.Q54 = side.sigmaCombined; // Excel Q54 = L24
  checks.push({
    id: "buckling.side.interaction",
    label: "Yan sac buruşma kontrolü (σvcr.c/vv ≥ σbil)",
    required: side.sigmaCombined, provided: side.allowable, unit: "N/mm²", op: ">=",
    pass: side.allowable >= side.sigmaCombined,
    standard: "FEM 1.001 A-3.4",
  });
  checks.push({
    id: "buckling.side.corrected",
    label: "Yan sac düzeltilmiş kritik gerilme kontrolü",
    required: side.sigmaCombined, provided: inp.sideCorrectedCriticalNmm2,
    unit: "N/mm²", op: ">=",
    pass: inp.sideCorrectedCriticalNmm2 >= side.sigmaCombined,
    standard: "FEM 1.001 A-3.4",
  });

  // --- 8.2 Üst sac ----------------------------------------------------------
  const top = computePanel(inp.top, TOP_REFS, cells);
  cells.Q111 = top.sigmaCombined; // Excel Q111 = L83
  checks.push({
    id: "buckling.top.interaction",
    label: "Üst sac buruşma kontrolü (σvcr.c/vv ≥ σbil)",
    required: top.sigmaCombined, provided: top.allowable, unit: "N/mm²", op: ">=",
    pass: top.allowable >= top.sigmaCombined,
    standard: "FEM 1.001 A-3.4",
  });

  const values: BucklingValues = {
    side,
    top,
    sideCorrectedCritical: inp.sideCorrectedCriticalNmm2,
  };
  return { values, checks, cells };
}
