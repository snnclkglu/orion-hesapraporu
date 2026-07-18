// Yapısal modüllerin (07 ana kiriş, 08 buruşma, 09 başkiriş) form alanı
// metadata'sı — UI formları bu tanımlardan üretilir. key'ler motor
// tiplerinin alan adlarıyla birebir aynıdır (bkz. fields.ts deseni).

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

// --- 07 ANA KİRİŞ -----------------------------------------------------------

export const GIRDER_DEP_FIELDS: FieldDef<GirderDeps>[] = [
  { key: "mainHookBlockWeightKg", label: "Kanca bloğu / kepçe ağırlığı", unit: "kg", type: "number", excelCell: "02!L14" },
  { key: "mainRopeWeightKg", label: "Halat ağırlığı", unit: "kg", type: "number", excelCell: "02!L15" },
  { key: "trolleyWeightT", label: "Araba ağırlığı", unit: "t", type: "number", excelCell: "05!L5" },
  { key: "trolleyWheelCount", label: "Araba teker sayısı", type: "number", excelCell: "05!L10" },
  { key: "trolleyActualSpeedMpm", label: "Gerçekleşen araba hızı", unit: "m/dak", type: "number", excelCell: "05!L109" },
  { key: "trolleyAccelTimeS", label: "Araba ivmelenme süresi", unit: "s", type: "number", excelCell: "05!L110" },
  { key: "bridgeGirdersWeightT", label: "Köprü ana kirişleri ağırlığı", unit: "t", type: "number", excelCell: "06!L6" },
  { key: "bridgeEndCarriagesWeightT", label: "Başkirişler ağırlığı", unit: "t", type: "number", excelCell: "06!L7" },
  { key: "bridgeWheelCount", label: "Köprü teker sayısı", type: "number", excelCell: "06!L14" },
  { key: "bridgeActualSpeedMpm", label: "Gerçekleşen köprü hızı", unit: "m/dak", type: "number", excelCell: "06!L115" },
  { key: "bridgeAccelTimeS", label: "Köprü ivmelenme süresi", unit: "s", type: "number", excelCell: "06!L117" },
];

export const GIRDER_INPUT_FIELDS: FieldDef<GirderInputs>[] = [
  { key: "railHeightMm", label: "Ray yüksekliği hr", unit: "mm", type: "number", excelCell: "C5" },
  { key: "t1Mm", label: "Üst flanş kalınlığı t1", unit: "mm", type: "number", excelCell: "C6" },
  { key: "b1Mm", label: "Üst flanş genişliği b1", unit: "mm", type: "number", excelCell: "C7" },
  { key: "t2Mm", label: "Üst iç flanş kalınlığı t2", unit: "mm", type: "number", excelCell: "C8" },
  { key: "b2Mm", label: "Üst iç flanş genişliği b2", unit: "mm", type: "number", excelCell: "C9" },
  { key: "t3Mm", label: "Ana gövde sacı kalınlığı t3", unit: "mm", type: "number", excelCell: "C10" },
  { key: "h3Mm", label: "Gövde yüksekliği h3", unit: "mm", type: "number", excelCell: "C11" },
  { key: "t4Mm", label: "Yardımcı gövde sacı kalınlığı t4", unit: "mm", type: "number", excelCell: "C12" },
  { key: "t5Mm", label: "Alt flanş kalınlığı t5", unit: "mm", type: "number", excelCell: "C13" },
  { key: "b5Mm", label: "Alt flanş genişliği b5", unit: "mm", type: "number", excelCell: "C14" },
  { key: "t6Mm", label: "Ek flanş kalınlığı t6", unit: "mm", type: "number", excelCell: "C15" },
  { key: "b6Mm", label: "Ek flanş genişliği b6", unit: "mm", type: "number", excelCell: "C16" },
  { key: "aMm", label: "Gövde sacları arası mesafe a", unit: "mm", type: "number", excelCell: "C17" },
  { key: "xMm", label: "Kenar mesafesi x", unit: "mm", type: "number", excelCell: "C18" },
  { key: "hookTopPositionM", label: "Kancanın en üst konumu l", unit: "m", type: "number", excelCell: "E68" },
  { key: "psiHK", label: "ψhK (Fig. FEM A.2.2.1, köprü)", type: "number", excelCell: "D80" },
  { key: "psiHA", label: "ψhA (Fig. FEM A.2.2.1, araba)", type: "number", excelCell: "D81" },
  { key: "bridgeAxleSpacingM", label: "Köprü dingil açıklığı", unit: "m", type: "number", excelCell: "D86" },
  { key: "trolleyWheelSpacingM", label: "Araba tekerlek açıklığı", unit: "m", type: "number", excelCell: "D87" },
  { key: "trolleyAxleSpacingM", label: "Araba dingil açıklığı", unit: "m", type: "number", excelCell: "D88" },
  { key: "trolleyDrivenWheels", label: "Araba tahrikli teker sayısı", type: "number", excelCell: "E101" },
  { key: "bridgeDrivenWheels", label: "Köprü tahrikli teker sayısı", type: "number", excelCell: "E120" },
  { key: "amplifyYc", label: "Arttırma katsayısı γc", type: "number", excelCell: "E138" },
  { key: "dynTestFactorR1", label: "Dinamik test katsayısı ρ1", type: "number", excelCell: "E161" },
  { key: "statTestFactorR2", label: "Statik test katsayısı ρ2", type: "number", excelCell: "E162" },
  { key: "railLeverCMm", label: "Kayma merkezi kolu c", unit: "mm", type: "number", excelCell: "D230" },
  { key: "diaphragmSpacingMm", label: "İki perde arası l1", unit: "mm", type: "number", excelCell: "D242" },
  { key: "wheelContactHMm", label: "Teker basınç yayılım yüksekliği h", unit: "mm", type: "number", excelCell: "D264" },
  { key: "wheelContactTMm", label: "Teker basıncı taşıyan sac kalınlığı t", unit: "mm", type: "number", excelCell: "D265" },
  { key: "sigmaYMaxNmm2", label: "σy,maks", unit: "N/mm²", type: "number", excelCell: "F397" },
  { key: "sigmaYMinNmm2", label: "σy,min", unit: "N/mm²", type: "number", excelCell: "F402" },
  { key: "fatigueTensileNmm2", label: "Malzeme kopma dayanımı σB", unit: "N/mm²", type: "number", excelCell: "F417" },
  { key: "deflectionLimitRatio", label: "Sehim sınırı (L/x)", type: "number" },
];

export const GIRDER_SELECTION_FIELDS: FieldDef<GirderSelections>[] = [
  { key: "fatigueMaterial", label: "Yorulma malzemesi", type: "select", options: FATIGUE_MATERIALS, excelCell: "F405" },
  { key: "fatigueLoadGroup", label: "Yük grubu (DIN 15018)", type: "select", options: LOAD_GROUPS, excelCell: "F406" },
  { key: "fatigueNotchClass", label: "Kaynak/çentik sınıfı (DIN 15018)", type: "select", options: NOTCH_CLASSES, excelCell: "F407" },
  { key: "staticMaterial", label: "Kiriş malzemesi (FEM T.3.2.1.1)", type: "select", options: GIRDER_STATIC_MATERIALS, excelCell: "B359" },
];

// --- 08 BURUŞMA KONTROLÜ ----------------------------------------------------

/** Panel alanları; excelCell yan sac / üst sac hücreleri */
export const BUCKLING_PANEL_FIELDS: FieldDef<BucklingPanelInputs>[] = [
  { key: "elasticModulus", label: "Elastisite modülü E", unit: "N/mm²", type: "number", excelCell: "L9 / L68" },
  { key: "poisson", label: "Poisson oranı", type: "number", excelCell: "L10 / L69" },
  { key: "thicknessMm", label: "Sac kalınlığı e", unit: "mm", type: "number", excelCell: "L11 / L70" },
  { key: "panelWidthMm", label: "Panel genişliği b", unit: "mm", type: "number", excelCell: "L12 / L71" },
  { key: "stiffenerSpacingMm", label: "İki perde arası a", unit: "mm", type: "number", excelCell: "L13 / L72" },
  { key: "sigma1", label: "Panel kenarı gerilmesi σ1", unit: "N/mm²", type: "number", excelCell: "L21 / L80" },
  { key: "sigma2", label: "Diğer kenar gerilmesi σ2", unit: "N/mm²", type: "number", excelCell: "L22 / L81" },
  { key: "tau", label: "Kesme gerilmesi τ", unit: "N/mm²", type: "number", excelCell: "L23 / L82" },
];

export const BUCKLING_EXTRA_FIELDS: FieldDef<BucklingInputs>[] = [
  { key: "sideCorrectedCriticalNmm2", label: "Düzeltilmiş kritik gerilme (yan sac)", unit: "N/mm²", type: "number", excelCell: "L54" },
];

// --- 09 BAŞKİRİŞ ------------------------------------------------------------

export const ENDCARRIAGE_DEP_FIELDS: FieldDef<EndCarriageDeps>[] = [
  { key: "mainHoistTotalLoadKg", label: "Ana kaldırma toplam yükü", unit: "kg", type: "number", excelCell: "02!L16" },
  { key: "trolleyWeightT", label: "Araba ağırlığı", unit: "t", type: "number", excelCell: "06!L5" },
  { key: "bridgeGirdersWeightT", label: "Köprü ana kirişleri ağırlığı", unit: "t", type: "number", excelCell: "06!L6" },
  { key: "bridgeEndCarriagesWeightT", label: "Başkirişler ağırlığı", unit: "t", type: "number", excelCell: "06!L7" },
];

export const ENDCARRIAGE_INPUT_FIELDS: FieldDef<EndCarriageInputs>[] = [
  { key: "wheelSpanAMm", label: "Tekerlekler arası mesafe a", unit: "mm", type: "number", excelCell: "L14" },
  { key: "loadOffsetBMm", label: "Kiriş oturma noktası b", unit: "mm", type: "number", excelCell: "L15" },
  { key: "topPlateThicknessMm", label: "Üst sac kalınlığı", unit: "mm", type: "number", excelCell: "L24" },
  { key: "topPlateWidthMm", label: "Üst sac genişliği", unit: "mm", type: "number", excelCell: "N24" },
  { key: "sidePlateThicknessMm", label: "Yan sac kalınlığı", unit: "mm", type: "number", excelCell: "L25" },
  { key: "sidePlateHeightMm", label: "Yan sac yüksekliği", unit: "mm", type: "number", excelCell: "N25" },
  { key: "bottomPlateThicknessMm", label: "Alt sac kalınlığı", unit: "mm", type: "number", excelCell: "L26" },
  { key: "bottomPlateWidthMm", label: "Alt sac genişliği", unit: "mm", type: "number", excelCell: "N26" },
  { key: "fatigueTensileNmm2", label: "Malzeme kopma dayanımı σB", unit: "N/mm²", type: "number" },
];

export const ENDCARRIAGE_SELECTION_FIELDS: FieldDef<EndCarriageSelections>[] = [
  { key: "hoistClass", label: "Kaldırma sınıfı", type: "select", options: HOIST_CLASSES, excelCell: "L37" },
  { key: "material", label: "Malzeme", type: "select", options: FATIGUE_MATERIALS, excelCell: "L49" },
  { key: "fatigueMaterial", label: "Yorulma malzemesi", type: "select", options: FATIGUE_MATERIALS },
  { key: "fatigueLoadGroup", label: "Yük grubu (DIN 15018)", type: "select", options: LOAD_GROUPS, excelCell: "L64" },
  { key: "fatigueNotchClass", label: "Kaynak/çentik sınıfı (DIN 15018)", type: "select", options: NOTCH_CLASSES, excelCell: "L65" },
];
