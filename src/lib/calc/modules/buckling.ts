// Buruşma (plaka burkulması) kontrolü — ana kirişin basınç bölgesindeki iki
// paneli hesaplanır: yan sac ve üst sac.
//
// Yöntem (FEM 1.001 A-3.4): Euler plaka gerilmesi σER → panel kenar oranı α ve
// gerilme oranı ψ → burkulma katsayıları Kσ / Kτ (Tablo A.3.4.1) → kritik
// gerilmeler → normal ve kayma gerilmesinin birlikte etkidiği durumdaki
// etkileşimli kritik gerilme σvcr.c → buruşma emniyet katsayısı
// vv = 1,7 + 0,175·(ψ − 1) ile izin verilen gerilme.
//
// Panel kenar gerilmeleri (σ1, σ2, τ) ana kiriş gerilme analizinden okunup
// mühendis tarafından girilir. Birimler: N/mm², mm.

import type { AnyCheck, ModuleResult } from "../types";

/** Tek panelin girdileri */
export interface BucklingPanelInputs {
  elasticModulus: number;     // E [N/mm²]
  poisson: number;            // Poisson oranı η
  thicknessMm: number;        // sac kalınlığı e [mm]
  panelWidthMm: number;       // panel genişliği b [mm]
  stiffenerSpacingMm: number; // iki perde arası a [mm]
  sigma1: number;             // panel kenarı gerilmesi σ1 [N/mm²]
  sigma2: number;             // diğer kenar gerilmesi σ2 [N/mm²]
  tau: number;                // kesme gerilmesi τ [N/mm²]
}

export interface BucklingInputs {
  side: BucklingPanelInputs;         // yan sac paneli
  top: BucklingPanelInputs;          // üst sac paneli
  /** Berkitmeler dikkate alınarak düzeltilmiş kritik gerilme (elle) [N/mm²] */
  sideCorrectedCriticalNmm2: number;
}

/** Tek panelin hesap sonuçları */
export interface BucklingPanelValues {
  sigmaER: number;       // Euler plaka gerilmesi [N/mm²]
  sigmaCombined: number; // bileşik gerilme σbil [N/mm²]
  alpha: number;         // kenar oranı a/b
  psi: number;           // gerilme oranı σ2/σ1
  kSigma: number;        // Kσ (FEM T.A.3.4.1)
  kTau: number;          // Kτ
  sigmaVcr: number;      // kritik normal gerilme [N/mm²]
  tauVcr: number;        // kritik kesme gerilmesi [N/mm²]
  sigmaVcrC: number;     // etkileşimli kritik gerilme [N/mm²]
  safetyVv: number;      // buruşma emniyet katsayısı vv
  allowable: number;     // σvcr.c / vv [N/mm²]
}

export interface BucklingValues {
  side: BucklingPanelValues;
  top: BucklingPanelValues;
  sideCorrectedCritical: number;
}

/** Panelin semantik anahtar bloğu ("sidePanel" / "topPanel") */
type PanelBlock = "sidePanel" | "topPanel";

/**
 * Kσ — FEM 1.001 Tablo A.3.4.1, düzgün olmayan basınç dağılımı altında
 * dört kenarından mesnetli dikdörtgen panelin burkulma katsayısı.
 *
 * Üç dal vardır:
 *   ψ ≤ −1        : kenarlarda ters işaretli gerilme (baskın eğilme)
 *   −1 < ψ ≤ 0    : bir kenar çekme, diğeri basınç
 *   ψ > 0         : her iki kenar da basınç
 */
function bucklingFactorSigma(alpha: number, psi: number): number {
  if (psi <= -1) {
    return alpha >= 2 / 3 ? 23.9 : 15.87 + 1.87 / alpha ** 2 + 8.6 * alpha ** 2;
  }
  if (psi <= 0) {
    if (alpha > 1) {
      return ((1 + psi) * 8.4) / 1.1 - psi * 23.9 + 10 * psi * (1 + psi);
    }
    if (alpha > 2 / 3) {
      return (
        ((1 + psi) * (alpha + 1 / alpha) ** 2 * 2.1) / 1.1 -
        psi * 23.9 +
        10 * psi * (1 + psi)
      );
    }
    // Kısa panel (α ≤ 2/3): ψ ≤ −1 dalıyla aynı katsayı ifadesi kullanılır.
    return (
      ((1 + psi) * (alpha + 1 / alpha) ** 2 * 2.1) / 1.1 -
      psi * (15.87 + 1.87 / alpha ** 2 + 8.6 * alpha ** 2) +
      10 * psi * (1 + psi)
    );
  }
  return alpha > 1 ? 8.4 / (psi + 1.1) : ((alpha + 1 / alpha) ** 2 * 2.1) / (psi + 1.1);
}

/** Kτ — FEM 1.001 Tablo A.3.4.1, saf kayma altında burkulma katsayısı. */
function bucklingFactorTau(alpha: number): number {
  return alpha > 1 ? 5.34 + 4 / alpha ** 2 : 4 + 5.34 / alpha ** 2;
}

function computePanel(
  p: BucklingPanelInputs,
  block: PanelBlock,
  cells: Record<string, number | string>
): BucklingPanelValues {
  const E = p.elasticModulus, nu = p.poisson;
  const e = p.thicknessMm, b = p.panelWidthMm, a = p.stiffenerSpacingMm;
  const s1 = p.sigma1, s2 = p.sigma2, t = p.tau;

  // σER = π²·E·(e/b)² / (12·(1 − η²))
  const sigmaER = (Math.PI ** 2 * E * (e / b) ** 2) / (12 * (1 - nu ** 2));
  // σbil = √(σ1² + 3τ²)
  const sigmaCombined = (s1 ** 2 + 3 * t ** 2) ** 0.5;
  const alpha = a / b;
  const psi = s2 / s1;

  const kSigma = bucklingFactorSigma(alpha, psi);
  const kTau = bucklingFactorTau(alpha);

  const sigmaVcr = kSigma * sigmaER;
  const tauVcr = kTau * sigmaER;
  // Normal + kayma gerilmesi etkileşimi altında kritik gerilme
  const sigmaVcrC =
    sigmaCombined /
    (((1 + psi) / 4) * (Math.abs(s1) / sigmaVcr) +
      ((0.25 * (3 - psi) * (Math.abs(s1) / sigmaVcr)) ** 2 * (Math.abs(t) / tauVcr) ** 2) ** 0.5);
  // vv = 1,7 + 0,175·(ψ − 1) — FEM 1.001 3.4
  const safetyVv = 1.7 + 0.175 * (psi - 1);
  const allowable = sigmaVcrC / safetyVv;

  Object.assign(cells, {
    [`${block}.eulerStress`]: sigmaER,
    [`${block}.combinedStress`]: sigmaCombined,
    [`${block}.aspectRatio`]: alpha,
    [`${block}.stressRatio`]: psi,
    [`${block}.factorSigma`]: kSigma,
    [`${block}.factorTau`]: kTau,
    [`${block}.criticalSigma`]: sigmaVcr,
    [`${block}.criticalTau`]: tauVcr,
    [`${block}.criticalCombined`]: sigmaVcrC,
    [`${block}.safetyFactor`]: safetyVv,
    [`${block}.allowable`]: allowable,
  });

  return {
    sigmaER, sigmaCombined, alpha, psi, kSigma, kTau,
    sigmaVcr, tauVcr, sigmaVcrC, safetyVv, allowable,
  };
}

export function computeBuckling(inp: BucklingInputs): ModuleResult<BucklingValues> {
  const cells: Record<string, number | string> = {};
  const checks: AnyCheck[] = [];

  // --- 8.1 Yan sac ----------------------------------------------------------
  const side = computePanel(inp.side, "sidePanel", cells);
  cells["sidePanel.correctedCritical"] = inp.sideCorrectedCriticalNmm2;
  checks.push({
    id: "buckling.side.interaction",
    label: "Yan Sac Buruşma Kontrolü (σvcr.c/vv ≥ σbil)",
    required: side.sigmaCombined, provided: side.allowable, unit: "N/mm²", op: ">=",
    // İki taraf da hesaptan çıkar; RAPORLANAN büyüklük panelin bileşik gerilmesi
    // σbil, sınır ise ondan bağımsız türetilen izin verilen burkulma gerilmesi
    // σvcr.c/vv'dir. Bu yüzden hesaplanan taraf `required`.
    computedSide: "required",
    pass: side.allowable >= side.sigmaCombined,
    standard: "FEM 1.001 A-3.4",
    kind: "standart", severity: "engelleyici",
  });
  checks.push({
    id: "buckling.side.corrected",
    label: "Yan Sac Düzeltilmiş Kritik Gerilme Kontrolü",
    required: side.sigmaCombined, provided: inp.sideCorrectedCriticalNmm2,
    unit: "N/mm²", op: ">=",
    computedSide: "required",
    pass: inp.sideCorrectedCriticalNmm2 >= side.sigmaCombined,
    standard: "FEM 1.001 A-3.4",
    // Karşılaştırılan kapasite motorun hesapladığı değil, berkitme düzenine
    // göre mühendisin girdiği bir değerdir; motor doğrulayamaz.
    kind: "firma", severity: "uyari",
  });

  // --- 8.2 Üst sac ----------------------------------------------------------
  const top = computePanel(inp.top, "topPanel", cells);
  checks.push({
    id: "buckling.top.interaction",
    label: "Üst Sac Buruşma Kontrolü (σvcr.c/vv ≥ σbil)",
    required: top.sigmaCombined, provided: top.allowable, unit: "N/mm²", op: ">=",
    // Yan sacla aynı gerekçe: hesaplanan σbil, sınır σvcr.c/vv.
    computedSide: "required",
    pass: top.allowable >= top.sigmaCombined,
    standard: "FEM 1.001 A-3.4",
    kind: "standart", severity: "engelleyici",
  });

  const values: BucklingValues = {
    side,
    top,
    sideCorrectedCritical: inp.sideCorrectedCriticalNmm2,
  };
  return { values, checks, cells };
}
