// Yapısal modüllerin (ana kiriş, buruşma, başkiriş) tarihsel doğrulama
// eşlemesi: ilk portun çıkış noktası olan hesap tablosu dökümündeki hücre
// adresi → motorun semantik anahtarı.
//
// ÖNEMLİ: Bu dosya TEST katmanına aittir; üretim kodu buradan hiçbir şey içe
// aktarmaz. Motorun yöntemi standartlara dayanır (FEM 1.001 / DIN 15018 /
// CMAA 70); buradaki eşleme yalnızca ilk portun sayısal birikimini regresyon
// ağı olarak kullanılabilir tutar. Ayrıntı için bu klasördeki README.md'ye
// bakın.
//
// Eşleme tek yönlüdür: döküm hücresi → semantik anahtar. Ters yön bilinçli
// olarak sağlanmaz; motorun anahtarları tarihsel bir adresleme düzenine
// bağlanmamalıdır.

import type { AliasMap } from "./excel-alias";

/** Ana kiriş — döküm hücresi → semantik anahtar */
export const GIRDER_ALIASES: AliasMap = {
  // Kesit özellikleri
  A6: "section.areaTopFlange",
  A8: "section.areaTopInnerFlange",
  A10: "section.areaMainWeb",
  A11: "section.areaSecondaryWeb",
  A13: "section.areaBottomFlange",
  A15: "section.areaExtraFlange",
  C20: "section.height",
  C21: "section.area",
  C22: "section.weightPerLength",
  C23: "section.centroidZ",
  C24: "section.inertiaY",
  C25: "section.modulusYBottom",
  C26: "section.modulusYTop",
  I20: "section.inertiaTorsion",
  I21: "section.centroidY",
  I22: "section.inertiaZ",
  I23: "section.modulusZBottom",
  I24: "section.modulusZTop",
  I25: "section.inertiaTorsionOpen",
  I26: "section.torsionBoxWidth",
  I27: "section.torsionBoxHeight",
  D306: "section.webDepthAboveCentroid",
  D308: "section.mainWebShearArea",
  D315: "section.secondaryWebShearArea",
  // Yükler
  D34: "load.bridgeDeadWeight",
  D35: "load.trolleyWeight",
  D39: "load.hoistLoad",
  D40: "load.belowHookWeight",
  D41: "load.totalLiveLoad",
  D45: "load.liftSpeed",
  D46: "load.dynamicFactor",
  D55: "load.trolleySpeed",
  D57: "load.trolleyAccel",
  D59: "load.bridgeSpeed",
  D61: "load.bridgeAccel",
  D70: "load.pendulumPeriod",
  D71: "load.massRatioBridge",
  D73: "load.massRatioTrolley",
  D75: "load.betaBridge",
  D77: "load.betaTrolley",
  D89: "load.skewFactorBridge",
  D90: "load.skewFactorTrolley",
  D98: "load.trolleyInertia",
  E100: "load.trolleyWheelPressure",
  D103: "load.trolleyTractionLimit",
  D105: "load.trolleyHorizontal",
  D109: "load.trolleySkew",
  D117: "load.bridgeInertia",
  E119: "load.bridgeWheelPressure",
  D122: "load.bridgeTractionLimit",
  D124: "load.bridgeHorizontal",
  D128: "load.bridgeSkew",
  D191: "load.trolleyWheelLoad",
  D199: "load.hoistWheelLoad",
  D314: "load.selfWeightSecondaryShare",
  D330: "load.trolleySecondaryShare",
  D346: "load.hoistSecondaryShare",
  // Geometri
  D173: "geometry.wheelToSupport",
  D266: "geometry.wheelContactLength",
  // Momentler
  D184: "moment.girderSelfWeight",
  D192: "moment.trolleyWheel",
  D200: "moment.hoistLoad",
  I192: "moment.verticalTotal",
  D210: "moment.bridgeHorizontal",
  D218: "moment.trolleySkew",
  D232: "moment.railLever",
  D247: "moment.secondaryTrolley",
  D255: "moment.secondaryHoist",
  D287: "moment.torsionTrolley",
  D294: "moment.torsionHoist",
  // Gerilme bileşenleri
  D186: "stress.sigmaXSelfWeightBottom",
  D187: "stress.sigmaXSelfWeightTop",
  D194: "stress.sigmaXTrolleyBottom",
  D195: "stress.sigmaXTrolleyTop",
  D202: "stress.sigmaXHoistBottom",
  D203: "stress.sigmaXHoistTop",
  D212: "stress.sigmaXLateralBridgeBottom",
  D213: "stress.sigmaXLateralBridgeTop",
  D220: "stress.sigmaXLateralTrolleyBottom",
  D221: "stress.sigmaXLateralTrolleyTop",
  D234: "stress.sigmaXRailLeverBottom",
  D235: "stress.sigmaXRailLeverTop",
  D249: "stress.sigmaXSecondaryTrolleyBottom",
  D250: "stress.sigmaXSecondaryTrolleyTop",
  D257: "stress.sigmaXSecondaryHoistBottom",
  D258: "stress.sigmaXSecondaryHoistTop",
  D271: "stress.sigmaZTrolley",
  D275: "stress.sigmaZHoist",
  D289: "stress.torsionTrolley",
  D296: "stress.torsionHoist",
  D310: "stress.shearMainSelfWeight",
  D317: "stress.shearSecondarySelfWeight",
  D326: "stress.shearMainTrolley",
  D333: "stress.shearSecondaryTrolley",
  D343: "stress.shearMainHoist",
  D349: "stress.shearSecondaryHoist",
  // Yükleme durumu toplamları
  E362: "stress.sigmaXBottomCase1",
  E363: "stress.sigmaXTopCase1",
  E364: "stress.sigmaZCase1",
  E365: "stress.shearMainCase1",
  E366: "stress.shearSecondaryCase1",
  E367: "stress.combinedBottomCase1",
  E368: "stress.combinedTopCase1",
  E369: "stress.amplifiedSigmaXBottom",
  E370: "stress.amplifiedShearMain",
  E371: "stress.amplifiedSigmaXTop",
  E372: "stress.amplifiedShearSecondary",
  E373: "stress.amplifiedSigmaZ",
  E374: "stress.amplifiedCombinedBottom",
  E376: "stress.amplifiedCombinedTop",
  D386: "stress.testFactor",
  D388: "stress.sigmaXBottomCase3",
  D389: "stress.shearMainCase3",
  D390: "stress.sigmaZCase3",
  D391: "stress.combinedCase3",
  // Yorulma
  F396: "fatigue.sigmaXMax",
  F398: "fatigue.tauMax",
  F401: "fatigue.sigmaXMin",
  F403: "fatigue.tauMin",
  F409: "fatigue.allowableD1",
  F411: "fatigue.allowableDz0",
  F414: "fatigue.kappaX",
  F419: "fatigue.allowableSigmaX",
  G424: "fatigue.kappaY",
  G426: "fatigue.allowableSigmaY",
  G430: "fatigue.allowableTauW0",
  G431: "fatigue.allowableTau",
  E435: "fatigue.combined",
  // Sehim
  G441: "deflection.wheelLoad",
  G443: "deflection.loadOffset",
  G444: "deflection.span",
  G446: "deflection.value",
  G447: "deflection.ratio",
};

/** Buruşma kontrolü — döküm hücresi → semantik anahtar */
export const BUCKLING_ALIASES: AliasMap = {
  // Yan sac
  L16: "sidePanel.eulerStress",
  L24: "sidePanel.combinedStress",
  L28: "sidePanel.aspectRatio",
  L32: "sidePanel.stressRatio",
  L34: "sidePanel.factorSigma",
  L35: "sidePanel.factorTau",
  L39: "sidePanel.criticalSigma",
  L43: "sidePanel.criticalTau",
  L48: "sidePanel.criticalCombined",
  L50: "sidePanel.safetyFactor",
  L52: "sidePanel.allowable",
  // Üst sac
  L75: "topPanel.eulerStress",
  L83: "topPanel.combinedStress",
  L87: "topPanel.aspectRatio",
  L91: "topPanel.stressRatio",
  L93: "topPanel.factorSigma",
  L94: "topPanel.factorTau",
  L98: "topPanel.criticalSigma",
  L102: "topPanel.criticalTau",
  L107: "topPanel.criticalCombined",
  L109: "topPanel.safetyFactor",
  L111: "topPanel.allowable",
};

/** Başkiriş — döküm hücresi → semantik anahtar */
export const ENDCARRIAGE_ALIASES: AliasMap = {
  L11: "wheel.loadMax",
  L12: "wheel.loadMin",
  L18: "moment.max",
  L21: "moment.min",
  L29: "section.weightPerLength",
  L30: "section.inertia",
  L31: "section.modulus",
  L32: "section.area",
  L33: "section.shearArea",
  L39: "load.dynamicFactor",
  L41: "load.factorK",
  L42: "load.factorL",
  L45: "stress.bending",
  L46: "stress.shear",
  L47: "stress.combined",
  L50: "stress.allowable",
  L55: "fatigue.sigmaMax",
  L56: "fatigue.tauMax",
  L57: "fatigue.combinedMax",
  L60: "fatigue.sigmaMin",
  L61: "fatigue.tauMin",
  L62: "fatigue.combinedMin",
  L77: "fatigue.kappa",
};

/** Hücre adresini normalleştirir: boşluk kırpılır, harfler büyütülür. */
function normalizeCell(cell: string): string {
  return cell.trim().toUpperCase();
}

/**
 * Döküm hücresinin motordaki karşılığını çözer.
 *
 * @returns eşleşen değer; eşleme ya da değer yoksa `undefined`
 */
export function resolveAlias(
  aliases: AliasMap,
  cell: string,
  cells: Record<string, number | string>
): number | string | undefined {
  const key = aliases[normalizeCell(cell)];
  if (key === undefined) return undefined;
  return cells[key];
}
