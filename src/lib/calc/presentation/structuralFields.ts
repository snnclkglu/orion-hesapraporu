// Yapısal modüllerin (ana kiriş, buruşma, başkiriş) form alanı metadata'sı —
// UI formları bu tanımlardan üretilir. key'ler motor tiplerinin alan adlarıyla
// birebir aynıdır (bkz. fields.ts deseni).
//
// "…Override" ile biten alanlar normalde BOŞ bırakılır: değerleri teknik
// özelliklerden türetilir (yapı sınıfı → γc, kaldırma/yük sınıfı → H ve B
// bileşenleri). Alan doldurulduğunda türetme devre dışı kalır.

import type { FieldDef } from "../fields";
import type { BucklingInputs, BucklingPanelInputs } from "../modules/buckling";
import type {
  EndCarriageDeps,
  EndCarriageInputs,
  EndCarriageSelections,
} from "../modules/endCarriage";
import type { GirderDeps, GirderInputs, GirderSelections } from "../modules/mainGirder";

export const FATIGUE_MATERIALS = ["S235JR", "S355JR"] as const;
export const NOTCH_CLASSES = ["W0", "W1", "W2", "K0", "K1", "K2", "K3", "K4"] as const;
export const LOAD_GROUPS = ["B1", "B2", "B3", "B4", "B5", "B6"] as const;
export const GIRDER_STATIC_MATERIALS = ["St37", "St44", "St52"] as const;
export const HOIST_CLASSES = ["H1", "H2", "H3", "H4"] as const;

// --- ANA KİRİŞ --------------------------------------------------------------

export const GIRDER_DEP_FIELDS: FieldDef<GirderDeps>[] = [
  { key: "mainHookBlockWeightKg", label: "Kanca bloğu / kepçe ağırlığı", unit: "kg", type: "number" },
  { key: "mainRopeWeightKg", label: "Halat ağırlığı", unit: "kg", type: "number" },
  { key: "trolleyWeightT", label: "Araba ağırlığı", unit: "t", type: "number" },
  { key: "trolleyWheelCount", label: "Araba teker sayısı", type: "number" },
  { key: "trolleyActualSpeedMpm", label: "Gerçekleşen araba hızı", unit: "m/dak", type: "number" },
  { key: "trolleyAccelTimeS", label: "Araba ivmelenme süresi", unit: "s", type: "number" },
  { key: "bridgeGirdersWeightT", label: "Köprü ana kirişleri ağırlığı", unit: "t", type: "number" },
  { key: "bridgeEndCarriagesWeightT", label: "Başkirişler ağırlığı", unit: "t", type: "number" },
  { key: "bridgeWheelCount", label: "Köprü teker sayısı", type: "number" },
  { key: "bridgeActualSpeedMpm", label: "Gerçekleşen köprü hızı", unit: "m/dak", type: "number" },
  { key: "bridgeAccelTimeS", label: "Köprü ivmelenme süresi", unit: "s", type: "number" },
];

export const GIRDER_INPUT_FIELDS: FieldDef<GirderInputs>[] = [
  { key: "railHeightMm", label: "Ray yüksekliği hr", unit: "mm", type: "number" },
  { key: "t1Mm", label: "Üst flanş kalınlığı t1", unit: "mm", type: "number" },
  { key: "b1Mm", label: "Üst flanş genişliği b1", unit: "mm", type: "number" },
  { key: "t2Mm", label: "Üst iç flanş kalınlığı t2", unit: "mm", type: "number" },
  { key: "b2Mm", label: "Üst iç flanş genişliği b2", unit: "mm", type: "number" },
  { key: "t3Mm", label: "Ana gövde sacı kalınlığı t3", unit: "mm", type: "number" },
  { key: "h3Mm", label: "Gövde yüksekliği h3", unit: "mm", type: "number" },
  { key: "t4Mm", label: "Yardımcı gövde sacı kalınlığı t4", unit: "mm", type: "number" },
  { key: "t5Mm", label: "Alt flanş kalınlığı t5", unit: "mm", type: "number" },
  { key: "b5Mm", label: "Alt flanş genişliği b5", unit: "mm", type: "number" },
  { key: "t6Mm", label: "Ek flanş kalınlığı t6", unit: "mm", type: "number" },
  { key: "b6Mm", label: "Ek flanş genişliği b6", unit: "mm", type: "number" },
  { key: "aMm", label: "Gövde sacları arası mesafe a", unit: "mm", type: "number" },
  { key: "xMm", label: "Kenar mesafesi x", unit: "mm", type: "number" },
  { key: "hookTopPositionM", label: "Kancanın en üst konumu l", unit: "m", type: "number" },
  { key: "psiHK", label: "ψhK (FEM Fig. A.2.2.1, köprü)", type: "number" },
  { key: "psiHA", label: "ψhA (FEM Fig. A.2.2.1, araba)", type: "number" },
  { key: "bridgeAxleSpacingM", label: "Köprü dingil açıklığı", unit: "m", type: "number" },
  { key: "trolleyWheelSpacingM", label: "Araba tekerlek açıklığı", unit: "m", type: "number" },
  { key: "trolleyAxleSpacingM", label: "Araba dingil açıklığı", unit: "m", type: "number" },
  { key: "trolleyDrivenWheels", label: "Araba tahrikli teker sayısı", type: "number" },
  { key: "bridgeDrivenWheels", label: "Köprü tahrikli teker sayısı", type: "number" },
  {
    key: "amplifyYcOverride", label: "Arttırma katsayısı γc (elle)", type: "number",
    standardRef: "FEM 1.001 T.2.3.4",
    hint: "Boş bırakılırsa çelik yapı sınıfından türetilir (A1 → 1,00 … A8 → 1,20).",
  },
  { key: "dynTestFactorR1", label: "Dinamik test katsayısı ρ1", type: "number" },
  { key: "statTestFactorR2", label: "Statik test katsayısı ρ2", type: "number" },
  { key: "railLeverCMm", label: "Kayma merkezi kolu c", unit: "mm", type: "number" },
  {
    key: "diaphragmSpacingMm", label: "İki perde arası l1", unit: "mm",
    type: "select", options: ["1000", "1500", "2000"], numeric: true,
  },
  { key: "wheelContactHMm", label: "Teker basıncı yayılım yüksekliği h", unit: "mm", type: "number" },
  { key: "wheelContactTMm", label: "Teker basıncı taşıyan sac (ray T-profil) kalınlığı t", unit: "mm", type: "number" },
  { key: "sigmaYMaxNmm2", label: "σy,maks", unit: "N/mm²", type: "number" },
  { key: "sigmaYMinNmm2", label: "σy,min", unit: "N/mm²", type: "number" },
  { key: "fatigueTensileNmm2", label: "Malzeme kopma dayanımı σB", unit: "N/mm²", type: "number" },
  {
    key: "deflectionLimitRatio", label: "Sehim sınırı", type: "select",
    options: ["250", "500", "750", "1000", "1100"], numeric: true,
    optionLabels: { "250": "1/250", "500": "1/500", "750": "1/750", "1000": "1/1000", "1100": "1/1100" },
  },
];

export const GIRDER_SELECTION_FIELDS: FieldDef<GirderSelections>[] = [
  { key: "fatigueMaterial", label: "Yorulma malzemesi", type: "select", options: FATIGUE_MATERIALS },
  {
    key: "fatigueLoadGroupOverride", label: "Yük grubu (DIN 15018, elle)",
    type: "select", options: LOAD_GROUPS,
    hint: "Boş bırakılırsa teknik özelliklerdeki kaldırma/yük sınıfının B bileşeninden türetilir.",
  },
  { key: "fatigueNotchClass", label: "Kaynak/çentik sınıfı (DIN 15018)", type: "select", options: NOTCH_CLASSES },
  {
    key: "staticMaterial", label: "Kiriş malzemesi", type: "select",
    options: GIRDER_STATIC_MATERIALS, standardRef: "FEM 1.001 T.3.2.1.1",
  },
];

// --- BURUŞMA KONTROLÜ -------------------------------------------------------

/** Yan sac ve üst sac panelleri aynı alan kümesini kullanır. */
export const BUCKLING_PANEL_FIELDS: FieldDef<BucklingPanelInputs>[] = [
  { key: "elasticModulus", label: "Elastisite modülü E", unit: "N/mm²", type: "number" },
  { key: "poisson", label: "Poisson oranı", type: "number" },
  { key: "thicknessMm", label: "Sac kalınlığı e", unit: "mm", type: "number" },
  { key: "panelWidthMm", label: "Panel genişliği b", unit: "mm", type: "number" },
  { key: "stiffenerSpacingMm", label: "İki perde arası a", unit: "mm", type: "number" },
  { key: "sigma1", label: "Panel kenarı gerilmesi σ1", unit: "N/mm²", type: "number" },
  { key: "sigma2", label: "Diğer kenar gerilmesi σ2", unit: "N/mm²", type: "number" },
  { key: "tau", label: "Kesme gerilmesi τ", unit: "N/mm²", type: "number" },
];

export const BUCKLING_EXTRA_FIELDS: FieldDef<BucklingInputs>[] = [
  {
    key: "sideCorrectedCriticalNmm2", label: "Düzeltilmiş kritik gerilme (yan sac)",
    unit: "N/mm²", type: "number",
    hint: "Berkitme düzeni dikkate alınarak elle belirlenen kritik gerilme.",
  },
];

// --- BAŞKİRİŞ ---------------------------------------------------------------

export const ENDCARRIAGE_DEP_FIELDS: FieldDef<EndCarriageDeps>[] = [
  { key: "mainHoistTotalLoadKg", label: "Ana kaldırma toplam yükü", unit: "kg", type: "number" },
  { key: "trolleyWeightT", label: "Araba ağırlığı", unit: "t", type: "number" },
  { key: "bridgeGirdersWeightT", label: "Köprü ana kirişleri ağırlığı", unit: "t", type: "number" },
  { key: "bridgeEndCarriagesWeightT", label: "Başkirişler ağırlığı", unit: "t", type: "number" },
];

export const ENDCARRIAGE_INPUT_FIELDS: FieldDef<EndCarriageInputs>[] = [
  { key: "wheelSpanAMm", label: "Tekerlekler arası mesafe a", unit: "mm", type: "number" },
  { key: "loadOffsetBMm", label: "Kiriş oturma noktası b", unit: "mm", type: "number" },
  { key: "topPlateThicknessMm", label: "Üst sac kalınlığı", unit: "mm", type: "number" },
  { key: "topPlateWidthMm", label: "Üst sac genişliği", unit: "mm", type: "number" },
  { key: "sidePlateThicknessMm", label: "Yan sac kalınlığı", unit: "mm", type: "number" },
  { key: "sidePlateHeightMm", label: "Yan sac yüksekliği", unit: "mm", type: "number" },
  { key: "bottomPlateThicknessMm", label: "Alt sac kalınlığı", unit: "mm", type: "number" },
  { key: "bottomPlateWidthMm", label: "Alt sac genişliği", unit: "mm", type: "number" },
  { key: "fatigueTensileNmm2", label: "Malzeme kopma dayanımı σB", unit: "N/mm²", type: "number" },
];

export const ENDCARRIAGE_SELECTION_FIELDS: FieldDef<EndCarriageSelections>[] = [
  {
    key: "hoistClassOverride", label: "Kaldırma sınıfı (elle)",
    type: "select", options: HOIST_CLASSES, standardRef: "DIN 15018 Tablo 2",
    hint: "Boş bırakılırsa teknik özelliklerdeki kaldırma/yük sınıfının H bileşeninden türetilir.",
  },
  { key: "material", label: "Malzeme", type: "select", options: FATIGUE_MATERIALS },
  { key: "fatigueMaterial", label: "Yorulma malzemesi", type: "select", options: FATIGUE_MATERIALS },
  {
    key: "fatigueLoadGroupOverride", label: "Yük grubu (DIN 15018, elle)",
    type: "select", options: LOAD_GROUPS,
    hint: "Boş bırakılırsa teknik özelliklerdeki kaldırma/yük sınıfının B bileşeninden türetilir.",
  },
  { key: "fatigueNotchClass", label: "Kaynak/çentik sınıfı (DIN 15018)", type: "select", options: NOTCH_CLASSES },
];
