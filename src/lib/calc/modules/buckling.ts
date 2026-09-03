// Buruşma (plaka burkulması) kontrolü — FEM 1.001 madde 3.4 + Appendix A-3.4.
//
// Ana kirişin basınç bölgesindeki iki paneli kontrol edilir: gövde sacının
// (yan sac) basınç paneli ve basınç başlığı (üst sac). Yöntemin tamamı
// `calc/plate-buckling.ts` çekirdeğindedir; bu modül girdileri toplar,
// çekirdeği çağırır, semantik anahtarları ve kontrolleri üretir.
//
// Zincir (her panel için):
//   σER → Kσ, Kτ (T.A.3.4.1) → σvcr, τvcr → orantı sınırı / ρ indirgemesi
//   (T.A.3.4.2) → σvcr.c → νv (md. 3.4) → izin verilen gerilme → σbil ile kontrol
//
// GİRDİLER ANA KİRİŞTEN TÜRETİLİR. Panel kalınlığı, genişliği, uzunluğu ve
// kenar gerilmeleri elle yazılmaz; ana kirişin kesit geometrisinden ve 7.4
// gerilme analizinden gelir (`bucklingDepsFrom`). Türetme kapatılırsa
// (`autoFromGirder = false`) modül elle girilen değerlerle çalışır.
//
// İŞARET KURALI: kenar gerilmeleri BASINÇ POZİTİF'tir (ana kiriş çekmeyi
// pozitif tutar; dönüşüm `bucklingDepsFrom` içinde bir kez yapılır). σ1 panelin
// BASINÇ kenarıdır — iki kenarın büyüğü. ψ = σ2/σ1 ham değeri −1'in altına
// inebilir (çekme baskın eğilme, T.A.3.4.1 durum 3); νv ve etkileşim bağıntısı
// için ψ [−1, +1] aralığına kelepçelenir (md. 3.4).
//
// YÜKLEME DURUMLARI: FEM A-3.4 "Durum II ve III için de kontrol edilmelidir"
// der. Uygulama Durum I ve Durum III'ü hesaplar — ana kiriş de bu ikisini
// hesapladığından gerilmeler tutarlı gelir. Durum II (rüzgârlı işletme)
// uygulamanın hiçbir yerinde modellenmez (rüzgâr yükü girdisi yok); bu
// sınırlama bir "bilgi" kontrolüyle rapora yazılır.
//
// KAPSAM DIŞI PANELLER: üst başlığın gövdelerden dışarı taşan çıkmaları üç
// kenarından mesnetlidir; T.A.3.4.1 dört kenarından mesnetli plakalar içindir,
// bu yüzden çıkmalar kontrol edilmez. Alt başlık açıklık ortasında çekmededir
// (burkulma söz konusu değil).
//
// GERİLME ÇİFTİ KABULÜ: σ panelin kenar eğilme gerilmesi, τ gövdenin ortalama
// kaymasıdır — FEM'in panel kabulü budur, ikisi aynı noktanın gerilmeleri
// değildir. Kullanılan çift açıklık ortasının en büyük eğilme gerilmesini
// gövdedeki kaymayla birleştirir; FEM'in çözümlü örneğindeki mesnet yakını
// kesit (büyük τ, küçük σ) bu bileşimin içinde kalır.

import type { AnyCheck, ModuleResult } from "../types";
import {
  LOAD_CASE_LABEL,
  PROPORTIONALITY_LIMIT_NMM2,
  SQRT3,
  STEEL_ELASTIC_MODULUS_NMM2,
  STEEL_POISSON,
  bucklingCaseNo,
  bucklingFactorSigma,
  bucklingFactorTau,
  bucklingSafety,
  comparisonStress,
  criticalComparisonStress,
  eulerReferenceStress,
  normalizePanelEdges,
  reduceCriticalShear,
  reduceCriticalStress,
  type BucklingCaseNo,
  type BucklingLoadCase,
  type BucklingSteel,
} from "../plate-buckling";

/** kg/cm² → N/mm² (1 kgf = 9,80665 N · 1 cm² = 100 mm²). */
const KGCM2_TO_NMM2 = 0.0980665;

/** Tek panelin ölçüleri ve gerilmeleri. E ve η sabittir (FEM A-3.4). */
export interface BucklingPanelInputs {
  thicknessMm: number;        // sac kalınlığı e [mm]
  panelWidthMm: number;       // panel genişliği b — basınca DİK [mm]
  stiffenerSpacingMm: number; // panel uzunluğu a — iki perde arası [mm]
  sigma1: number;             // Durum I · basınç kenarı gerilmesi (basınç +) [N/mm²]
  sigma2: number;             // Durum I · karşı kenar (çekme −) [N/mm²]
  tau: number;                // Durum I · ortalama kayma gerilmesi [N/mm²]
}

export interface BucklingInputs {
  side: BucklingPanelInputs;  // yan sac (gövde) paneli
  top: BucklingPanelInputs;   // üst sac (basınç başlığı) paneli
  /**
   * Panel ölçüleri ve gerilmeleri ana kirişten otomatik türetilsin.
   * Kapatılırsa yukarıdaki elle girilen değerler kullanılır.
   */
  autoFromGirder: boolean;
}

/**
 * Ana kirişten gelen değerler. Buruşma bağımsız bir mekanizma değil, ana
 * kirişin bir kontrolüdür: malzeme, geometri ve gerilmeler oradan okunur.
 */
export interface BucklingDeps {
  /** Kiriş malzemesi — orantı sınırını ve ρ tablosunu belirler */
  steel: BucklingSteel;
  /** Durum III / Durum I normal gerilme oranı (ana kirişin test katsayısından) */
  case3SigmaRatio: number;
  /** Durum III / Durum I kayma gerilmesi oranı */
  case3TauRatio: number;
  /** Ana kirişten türetilmiş paneller — `autoFromGirder` açıkken kullanılır */
  derived?: { side: BucklingPanelInputs; top: BucklingPanelInputs };
  /** Kirişin perde aralığı [mm] — panel uzunluğu denetimi */
  diaphragmSpacingMm: number;
  /** Gövde yüksekliği h3 [mm] — yan sac panelinin fiziksel tavanı */
  webHeightMm: number;
  /** Gövde sacları arası net açıklık a [mm] — üst sac panelinin fiziksel tavanı */
  webGapMm: number;
  /** Ana gövde sacı kalınlığı t3 [mm] */
  webThicknessMm: number;
  /** Üst iç başlık kalınlığı t2 [mm] */
  topFlangeThicknessMm: number;
  /** Boyuna berkitmenin (köşebent) üst başlığa uzaklığı [mm]; 0 = berkitme yok */
  webStiffenerOffsetMm: number;
}

/** Ana kiriş kapalıyken kullanılan en emniyetli varsayılan bağımlılık seti. */
export const BUCKLING_DEPS_FALLBACK: BucklingDeps = {
  steel: "St37",              // en düşük orantı sınırı → en küçük kapasite
  case3SigmaRatio: 1,
  case3TauRatio: 1,
  diaphragmSpacingMm: 0,
  webHeightMm: 0,
  webGapMm: 0,
  webThicknessMm: 0,
  topFlangeThicknessMm: 0,
  webStiffenerOffsetMm: 0,
};

/** Bir panelin yükleme durumundan BAĞIMSIZ büyüklükleri. */
export interface BucklingPanelGeometry {
  thicknessMm: number;
  panelWidthMm: number;
  panelLengthMm: number;
  sigma1: number;             // basınç kenarı (basınç +)
  sigma2: number;
  psi: number;                // ham ψ (−1'in altına inebilir)
  psiClamped: number;         // νv ve etkileşim için [−1, +1]
  reordered: boolean;         // σ1/σ2 sırası düzeltildi mi
  allTension: boolean;
  alpha: number;              // α = a/b
  sigmaER: number;
  kSigma: number;
  kTau: number;
  caseNo: BucklingCaseNo;     // T.A.3.4.1'de hangi durum
  // Kritik gerilmeler — elastik (formülden) ve indirgenmiş (kullanılan)
  sigmaVcrElastic: number;
  sigmaVcr: number;
  rhoSigma: number;
  tauVcrElastic: number;
  tauVcr: number;
  rhoTau: number;
  reductionApplied: boolean;
  reductionClamped: boolean;
  proportionalLimit: number;
  steel: BucklingSteel;
}

/** Bir panelin tek yükleme durumundaki sonucu. */
export interface BucklingCaseValues {
  loadCase: BucklingLoadCase;
  sigma: number;
  tau: number;
  sigmaCombined: number;      // σbil = √(σ² + 3τ²)
  sigmaVcrCElastic: number;
  sigmaVcrC: number;
  rhoCombined: number;
  safetyVv: number;
  allowable: number;          // σvcr.c / νv
  utilization: number;        // σbil / izin verilen
  pass: boolean;
}

export interface BucklingPanelValues extends BucklingPanelGeometry {
  case1: BucklingCaseValues;
  case3: BucklingCaseValues;
  /** İki durumdan ELVERİŞSİZ olanı (en büyük kullanım oranı) */
  governing: BucklingCaseValues;
}

export interface BucklingValues {
  side: BucklingPanelValues;
  top: BucklingPanelValues;
  steel: BucklingSteel;
  /** Girdiler ana kirişten mi geldi */
  derivedFromGirder: boolean;
}

type PanelBlock = "sidePanel" | "topPanel";

/**
 * Panelin yükleme durumundan bağımsız büyüklükleri.
 *
 * İNDİRGEME SIRASI (belgelenmiş yorum tercihi): önce σvcr ve τvcr indirgenir,
 * sonra σvcr.c BU indirgenmiş değerlerden hesaplanır, en son σvcr.c'nin kendisi
 * de sınırı aşıyorsa bir kez daha indirgenir. FEM'in notu "σvcr VE σvcr.c
 * bağıntıları yalnız orantı sınırının altında geçerlidir" der ve T.A.3.4.2'nin
 * sütun başlığı "σvcr veya σvcr.c hesaplanan"dır; dolayısıyla her iki büyüklük
 * de indirgemeye tabidir. Etkileşim bağıntısına orantı sınırının üstünde,
 * fiziksel olmayan kritik gerilmeler beslemek yerine indirgenmişlerini
 * beslemek hem tutarlı hem EMNİYETLİ taraftır.
 */
function panelGeometry(p: BucklingPanelInputs, steel: BucklingSteel): BucklingPanelGeometry {
  const edges = normalizePanelEdges(p.sigma1, p.sigma2);
  const alpha = p.panelWidthMm > 0 ? p.stiffenerSpacingMm / p.panelWidthMm : NaN;
  const sigmaER = eulerReferenceStress(
    p.thicknessMm, p.panelWidthMm, STEEL_ELASTIC_MODULUS_NMM2, STEEL_POISSON
  );
  // Kσ ham ψ ile hesaplanır: T.A.3.4.1 durum 3 ψ ≤ −1'i açıkça kapsar.
  const kSigma = bucklingFactorSigma(alpha, edges.psi);
  const kTau = bucklingFactorTau(alpha);

  const sigmaVcrElastic = kSigma * sigmaER;
  const tauVcrElastic = kTau * sigmaER;
  const rs = reduceCriticalStress(sigmaVcrElastic, steel);
  const rt = reduceCriticalShear(tauVcrElastic, steel);

  return {
    thicknessMm: p.thicknessMm,
    panelWidthMm: p.panelWidthMm,
    panelLengthMm: p.stiffenerSpacingMm,
    ...edges,
    alpha,
    sigmaER,
    kSigma,
    kTau,
    caseNo: bucklingCaseNo(edges.psi),
    sigmaVcrElastic,
    sigmaVcr: rs.reduced,
    rhoSigma: rs.rho,
    tauVcrElastic,
    tauVcr: rt.reduced,
    rhoTau: rt.rho,
    reductionApplied: rs.applied || rt.applied,
    reductionClamped: rs.clamped || rt.clamped,
    proportionalLimit: PROPORTIONALITY_LIMIT_NMM2[steel],
    steel,
  };
}

/** Bir panelin verilen yükleme durumundaki sonucu. */
function panelCase(
  g: BucklingPanelGeometry,
  sigma: number,
  tau: number,
  loadCase: BucklingLoadCase
): BucklingCaseValues {
  const sigmaCombined = comparisonStress(sigma, tau);
  // Etkileşim bağıntısı ψ'nin tanım aralığında (md. 3.4) değerlendirilir.
  const sigmaVcrCElastic = criticalComparisonStress(
    sigma, tau, g.psiClamped, g.sigmaVcr, g.tauVcr
  );
  const rc = reduceCriticalStress(sigmaVcrCElastic, g.steel);
  const safetyVv = bucklingSafety(g.psiClamped, loadCase);
  const allowable = rc.reduced / safetyVv;
  const utilization = allowable > 0 ? sigmaCombined / allowable : NaN;
  return {
    loadCase, sigma, tau, sigmaCombined,
    sigmaVcrCElastic,
    sigmaVcrC: rc.reduced,
    rhoCombined: rc.rho,
    safetyVv,
    allowable,
    utilization,
    // Her iki kenar da çekmedeyse panelde basınç yoktur; burkulma söz konusu
    // değildir ve kontrol koşulsuz sağlanır.
    pass: g.allTension || sigmaCombined <= allowable,
  };
}

function computePanel(
  p: BucklingPanelInputs,
  deps: BucklingDeps,
  block: PanelBlock,
  cells: Record<string, number | string>
): BucklingPanelValues {
  const g = panelGeometry(p, deps.steel);

  const case1 = panelCase(g, g.sigma1, p.tau, 1);
  const case3 = panelCase(g, g.sigma1 * deps.case3SigmaRatio, p.tau * deps.case3TauRatio, 3);
  const governing =
    Number.isFinite(case3.utilization) && case3.utilization > (case1.utilization || 0)
      ? case3
      : case1;

  Object.assign(cells, {
    [`${block}.thickness`]: g.thicknessMm,
    [`${block}.width`]: g.panelWidthMm,
    [`${block}.length`]: g.panelLengthMm,
    [`${block}.eulerStress`]: g.sigmaER,
    [`${block}.aspectRatio`]: g.alpha,
    [`${block}.sigmaEdge1`]: g.sigma1,
    [`${block}.sigmaEdge2`]: g.sigma2,
    [`${block}.shearStress`]: p.tau,
    [`${block}.stressRatio`]: g.psi,
    [`${block}.stressRatioClamped`]: g.psiClamped,
    [`${block}.tableCase`]: g.caseNo,
    [`${block}.factorSigma`]: g.kSigma,
    [`${block}.factorTau`]: g.kTau,
    [`${block}.criticalSigmaElastic`]: g.sigmaVcrElastic,
    [`${block}.criticalSigma`]: g.sigmaVcr,
    [`${block}.reductionSigma`]: g.rhoSigma,
    [`${block}.criticalTauElastic`]: g.tauVcrElastic,
    [`${block}.criticalTau`]: g.tauVcr,
    [`${block}.reductionTau`]: g.rhoTau,
    [`${block}.proportionalLimit`]: g.proportionalLimit,
    [`${block}.shearLimit`]: g.proportionalLimit / SQRT3,
    // --- Yükleme Durumu I
    [`${block}.combinedStress`]: case1.sigmaCombined,
    [`${block}.criticalCombinedElastic`]: case1.sigmaVcrCElastic,
    [`${block}.criticalCombined`]: case1.sigmaVcrC,
    [`${block}.reductionCombined`]: case1.rhoCombined,
    [`${block}.safetyFactor`]: case1.safetyVv,
    [`${block}.allowable`]: case1.allowable,
    [`${block}.utilization`]: case1.utilization,
    // --- Yükleme Durumu III (test)
    [`${block}.sigmaCase3`]: case3.sigma,
    [`${block}.tauCase3`]: case3.tau,
    [`${block}.combinedStressCase3`]: case3.sigmaCombined,
    [`${block}.criticalCombinedCase3`]: case3.sigmaVcrC,
    [`${block}.safetyFactorCase3`]: case3.safetyVv,
    [`${block}.allowableCase3`]: case3.allowable,
    [`${block}.utilizationCase3`]: case3.utilization,
    [`${block}.governingCase`]: governing.loadCase,
  });

  return { ...g, case1, case3, governing };
}

const PANEL_LABEL: Record<PanelBlock, string> = {
  sidePanel: "Yan Sac",
  topPanel: "Üst Sac",
};

interface PanelCheckContext {
  block: PanelBlock;
  idPrefix: "side" | "top";
  /** Panelin sığması gereken kesit ölçüsü [mm] ve adı */
  widthLimitMm: number;
  widthLimitLabel: string;
  /** Kesitteki karşılık gelen sac kalınlığı [mm] ve adı */
  thicknessMm: number;
  thicknessLabel: string;
}

/** Bir panelin kontrollerini üretir. */
function panelChecks(
  v: BucklingPanelValues,
  ctx: PanelCheckContext
): AnyCheck[] {
  const checks: AnyCheck[] = [];
  const name = PANEL_LABEL[ctx.block];

  checks.push({
    id: `buckling.${ctx.idPrefix}.case1`,
    label: `${name} Buruşma Kontrolü — Yükleme Durumu I`,
    required: v.case1.sigmaCombined, provided: v.case1.allowable, unit: "N/mm²", op: ">=",
    // Hesaplanan büyüklük panelin bileşik gerilmesi σbil; sınır ondan bağımsız
    // türetilen izin verilen burkulma gerilmesidir.
    computedSide: "required",
    pass: v.case1.pass,
    standard: "FEM 1.001 A-3.4",
    kind: "standart", severity: "engelleyici",
  });

  checks.push({
    id: `buckling.${ctx.idPrefix}.case3`,
    label: `${name} Buruşma Kontrolü — Yükleme Durumu III (Test)`,
    required: v.case3.sigmaCombined, provided: v.case3.allowable, unit: "N/mm²", op: ">=",
    computedSide: "required",
    pass: v.case3.pass,
    standard: "FEM 1.001 3.4",
    kind: "standart", severity: "engelleyici",
  });

  // Panelin kesite sığdığı her hâlde gösterilir: otomatik türetmede bu bir
  // doğrulama (değer zaten kesitten geldiği için geçer ve mühendise panelin
  // hangi ölçüden çıktığını görünür kılar), elle girişte ise girdi hatasını
  // yakalayan koruma olur.
  {
    if (ctx.widthLimitMm > 0) {
      checks.push({
        id: `buckling.${ctx.idPrefix}.width`,
        label: `${name} Panel Genişliği ≤ ${ctx.widthLimitLabel}`,
        required: v.panelWidthMm, provided: ctx.widthLimitMm, unit: "mm", op: ">=",
        computedSide: "required",
        pass: v.panelWidthMm <= ctx.widthLimitMm * 1.001,
        standard: "FEM 1.001 A-3.4",
        // Kesit ölçüsüyle karşılaştırma standart bir sınır değil, girdi
        // hatasını yakalayan tasarım tutarlılık denetimidir.
        kind: "firma", severity: "uyari",
      });
    }
  }

  return checks;
}

export function computeBuckling(
  inp: BucklingInputs,
  deps: BucklingDeps = BUCKLING_DEPS_FALLBACK
): ModuleResult<BucklingValues> {
  const cells: Record<string, number | string> = {};
  const checks: AnyCheck[] = [];

  const auto = inp.autoFromGirder !== false && deps.derived !== undefined;
  const sideInput = auto ? deps.derived!.side : inp.side;
  const topInput = auto ? deps.derived!.top : inp.top;

  cells["material.steel"] = deps.steel;
  cells["material.proportionalLimit"] = PROPORTIONALITY_LIMIT_NMM2[deps.steel];
  cells["material.elasticModulus"] = STEEL_ELASTIC_MODULUS_NMM2;
  cells["material.poisson"] = STEEL_POISSON;
  cells["source.auto"] = auto ? "Ana kirişten otomatik" : "Elle girilmiş";
  cells["source.sigmaRatioCase3"] = deps.case3SigmaRatio;
  cells["source.tauRatioCase3"] = deps.case3TauRatio;
  cells["source.stiffenerOffset"] = deps.webStiffenerOffsetMm;

  // --- 8.1 Yan sac (gövde) paneli --------------------------------------------
  const side = computePanel(sideInput, deps, "sidePanel", cells);
  checks.push(
    ...panelChecks(side, {
      block: "sidePanel", idPrefix: "side",
      widthLimitMm: deps.webHeightMm, widthLimitLabel: "Gövde Yüksekliği h3",
      thicknessMm: deps.webThicknessMm, thicknessLabel: "Gövde Sacı t3",
    })
  );

  // --- 8.2 Üst sac (basınç başlığı) paneli -----------------------------------
  const top = computePanel(topInput, deps, "topPanel", cells);
  checks.push(
    ...panelChecks(top, {
      block: "topPanel", idPrefix: "top",
      widthLimitMm: deps.webGapMm, widthLimitLabel: "Gövde Sacları Arası a",
      thicknessMm: deps.topFlangeThicknessMm, thicknessLabel: "Üst İç Başlık t2",
    })
  );

  // --- Kapsam bilgisi: Durum II hesaplanmaz ----------------------------------
  // FEM A-3.4 üç yükleme durumunun da kontrolünü ister. Durum II (rüzgârlı
  // işletme) uygulamada hiçbir modülde modellenmez — rüzgâr yükü girdisi
  // yoktur — bu yüzden buruşmada da hesaplanmaz. Sınırlama rapora yazılır ki
  // sessiz bir eksiklik olarak kalmasın.
  checks.push({
    id: "buckling.loadCaseII.scope",
    label: "Yükleme Durumu II (Rüzgârlı İşletme) Kapsam Dışı — Rüzgâr Yükü Modellenmiyor",
    required: 0, provided: 0, unit: "-", op: ">=",
    computedSide: "provided",
    pass: true,
    standard: "FEM 1.001 3.4",
    kind: "bilgi", severity: "uyari",
  });

  const values: BucklingValues = { side, top, steel: deps.steel, derivedFromGirder: auto };
  return { values, checks, cells };
}

// ---------------------------------------------------- Ana kirişten türetme

/** `bucklingDepsFrom` için gereken ana kiriş girdileri. */
export interface BucklingGirderInputs {
  t1Mm: number; t2Mm: number; t3Mm: number; t4Mm: number;
  t5Mm: number; t6Mm: number;
  h3Mm: number; aMm: number;
  diaphragmSpacingMm: number;
  webStiffenerOffsetMm: number;
}

/**
 * Ana kirişin girdi/seçim/hücrelerinden buruşma bağımlılıklarını türetir.
 *
 * PANEL TANIMLARI (FEM A-3.4: panel = mesnetli kenarları arasındaki açıklık):
 *   Yan sac : b = boyuna berkitme mesafesi (yoksa gövdenin tamamı h3)
 *             a = perde aralığı · e = t3
 *   Üst sac : b = gövde sacları arası NET açıklık a (dört kenarı kaynaklı bölüm)
 *             a = perde aralığı · e = t2 · σ düzgün (ψ = +1, T.A.3.4.1 durum 1)
 *
 * KENAR GERİLMELERİ: kesitin iki uç lifi arasında doğrusal enterpolasyon.
 * Tarafsız eksen üzerinden gitmek yerine uç liflerin kendisi kullanılır, çünkü
 * ana kirişin uç lif gerilmeleri yalnız düşey eğilmeyi değil yatay eğilmeyi,
 * ray kolunu ve ikincil momentleri de içerir; bu bileşenlerin bir kısmı z'ye
 * göre doğrusal değildir. İki uç lif arasında enterpolasyon (i) motorun
 * gerçekten hesapladığı değerleri birebir yeniden üretir, (ii) baskın olan
 * düşey eğilme için tamdır, (iii) yatay eğilme payını panel boyunca uç lif
 * değerinde sabit tuttuğu için EMNİYETLİ taraftadır.
 *
 * γc (FEM T.2.3.4 arttırma katsayısı) UYGULANIR: ana kirişin kendi mukavemet
 * kontrolü de γc·σ ile çalışır, buruşma aynı yükleme durumunun gerilmelerini
 * kullandığına göre aynı katsayıyı taşımalıdır.
 *
 * ÜST BAŞLIK KAYMASI: başlık düşey kesme taşımaz, yalnız kapalı kutunun
 * burulma akışını görür. Bredt kabulüyle akış q = τ·e sabit olduğundan
 * τ_başlık = τ_burulma,gövde · ((t3+t4)/2) / t2.
 */
export function bucklingDepsFrom(
  girder: {
    inputs: BucklingGirderInputs;
    selections: { staticMaterial: BucklingSteel };
  },
  cells: Record<string, number | string> | undefined
): BucklingDeps {
  const g = girder.inputs;
  const num = (k: string): number => {
    const v = cells?.[k];
    return typeof v === "number" && Number.isFinite(v) ? v : NaN;
  };
  const ratio = (case3Key: string, case1Key: string): number => {
    const a = num(case3Key);
    const b = num(case1Key);
    return Number.isFinite(a) && Number.isFinite(b) && Math.abs(b) > 1e-9 ? Math.abs(a / b) : 1;
  };

  const base: BucklingDeps = {
    steel: girder.selections.staticMaterial,
    // Üst lif (basınç) gerilmesi buruşmanın belirleyici bileşenidir
    case3SigmaRatio: ratio("stress.sigmaXTopCase3", "stress.sigmaXTopCase1"),
    case3TauRatio: ratio("stress.shearMainCase3", "stress.shearMainCase1"),
    diaphragmSpacingMm: g.diaphragmSpacingMm,
    webHeightMm: g.h3Mm,
    webGapMm: g.aMm,
    webThicknessMm: g.t3Mm,
    topFlangeThicknessMm: g.t2Mm,
    webStiffenerOffsetMm: g.webStiffenerOffsetMm ?? 0,
  };

  const gammaC = num("load.amplifyFactor");
  const sigmaBottom = num("stress.sigmaXBottomCase1");
  const sigmaTop = num("stress.sigmaXTopCase1");
  const shearMain = num("stress.shearMainCase1");
  const torsionTrolley = num("stress.torsionTrolley");
  const torsionHoist = num("stress.torsionHoist");
  const dynamicFactor = num("load.dynamicFactor");
  const heightMm = g.t1Mm + g.t2Mm + g.h3Mm + g.t5Mm + g.t6Mm;

  if (
    !Number.isFinite(gammaC) || !Number.isFinite(sigmaBottom) || !Number.isFinite(sigmaTop) ||
    !Number.isFinite(shearMain) || !(heightMm > 0) || !(g.h3Mm > 0) || !(g.aMm > 0)
  ) {
    return base;  // ana kiriş hesaplanmamış — elle girdilerle çalışılır
  }

  const k = gammaC * KGCM2_TO_NMM2;
  /**
   * z kotundaki (kesit alt yüzünden [mm]) normal gerilme, BASINÇ POZİTİF.
   * Ana kiriş çekmeyi pozitif tuttuğu için işaret ters çevrilir.
   */
  const compressionAt = (z: number): number =>
    -(sigmaBottom + ((sigmaTop - sigmaBottom) * z) / heightMm) * k;

  const zWebTop = g.t6Mm + g.t5Mm + g.h3Mm;
  const zFlangeMid = zWebTop + g.t2Mm / 2;
  const stiffenerOffset = base.webStiffenerOffsetMm;
  const sideWidth = stiffenerOffset > 0 ? Math.min(stiffenerOffset, g.h3Mm) : g.h3Mm;

  const tauWeb = shearMain * k;
  const torsionCase1 =
    Number.isFinite(torsionTrolley) && Number.isFinite(torsionHoist) && Number.isFinite(dynamicFactor)
      ? (torsionTrolley + dynamicFactor * torsionHoist) * k
      : 0;
  const tauFlange =
    g.t2Mm > 0 ? (torsionCase1 * ((g.t3Mm + g.t4Mm) / 2)) / g.t2Mm : torsionCase1;

  return {
    ...base,
    derived: {
      side: {
        thicknessMm: g.t3Mm,
        panelWidthMm: sideWidth,
        stiffenerSpacingMm: g.diaphragmSpacingMm,
        sigma1: compressionAt(zWebTop),
        sigma2: compressionAt(zWebTop - sideWidth),
        tau: tauWeb,
      },
      top: {
        thicknessMm: g.t2Mm,
        panelWidthMm: g.aMm,
        stiffenerSpacingMm: g.diaphragmSpacingMm,
        // Başlık kalınlığı boyunca gerilme düzgün kabul edilir → ψ = +1
        sigma1: compressionAt(zFlangeMid),
        sigma2: compressionAt(zFlangeMid),
        tau: tauFlange,
      },
    },
  };
}

export { LOAD_CASE_LABEL };
