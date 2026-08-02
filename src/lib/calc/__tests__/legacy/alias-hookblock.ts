// Kanca bloğu — tarihsel doğrulama eşlemesi.
//
// Eski hesap tablosu dökümündeki hücre adresi → motorun semantik anahtarı.
// Bu dosya TEST katmanına aittir; üretim kodu buradan hiçbir şey içe aktarmaz.
// Ayrıntı için bu klasördeki README.md'ye bakın.
//
// Haritada YALNIZCA dökümde FORMULA olarak geçen ve motorda gerçekten karşılığı
// olan hücreler bulunur. Karşılığı olmayanlar (girdi yankısı, gösterim ikizi,
// hata değeri taşıyan bozuk zincir) golden testteki `KAPSAM_DISI` sözlüğünde
// gerekçesiyle toplanır.

import type { AliasMap } from "./excel-alias";

export const HOOKBLOCK_ALIASES: AliasMap = {
  // §4.2 Makaralar
  L11: "sheave.coefficient",
  L10: "sheave.minDia",

  // §4.3 Makara rulmanları
  L19: "sheaveBearing.radialLoad",
  L20: "sheaveBearing.axialLoad",
  L26: "sheaveBearing.equivalentStatic",
  L27: "sheaveBearing.equivalentDynamic",
  L34: "sheaveBearing.rpm",
  L36: "sheaveBearing.lifeHours",
  L38: "sheaveBearing.requiredLifeMin",
  Q38: "sheaveBearing.requiredLifeMax",

  // §4.4 Kanca bloğu mili
  L52: "shaft.sheaveLoad",
  L58: "shaft.reactionA",
  L59: "shaft.reactionB",
  L62: "shaft.moment",
  L64: "shaft.sectionModulus",
  L65: "shaft.bendingStress",
  L66: "shaft.shearStress",
  L67: "shaft.combinedStress",
  L71: "shaft.allowableBending",
  L72: "shaft.allowableShear",
  L73: "shaft.allowableCombined",

  // §4.5 Kanca rulmanı
  L78: "hookBearing.axialLoad",
  L85: "hookBearing.staticSafety",

  // §4.6 Kaldırma kirişi — yükler ve kesit özellikleri
  L98: "girder.forceMax",
  L99: "girder.forceMin",
  L105: "girder.momentMax",
  L108: "girder.momentMin",
  L116: "girder.midUnitWeight",
  L117: "girder.midInertia",
  L118: "girder.midSectionModulus",
  L119: "girder.midArea",
  L120: "girder.midWebArea",
  P116: "girder.thickUnitWeight",
  P117: "girder.thickInertia",
  P118: "girder.thickSectionModulus",
  P119: "girder.thickArea",
  P120: "girder.thickWebArea",

  // §4.6 Statik gerilmeler (dinamik katsayı ψ ile)
  L124: "girder.dynamicFactor",
  L130: "girder.bendingStress",
  L131: "girder.shearStress",
  L132: "girder.combinedStress",

  // §4.6 Yorulma
  L139: "fatigue.sigmaMax",
  L140: "fatigue.tauMax",
  L141: "fatigue.combinedMax",
  L144: "fatigue.sigmaMin",
  L145: "fatigue.tauMin",
  L146: "fatigue.combinedMin",
  L161: "fatigue.stressRatio",
};
