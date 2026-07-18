// Kanca bloğu form alanı metadata'sı — UI formları bu tanımlardan üretilir.
// key'ler motor tiplerinin (HookBlockInputs, HookBlockSelections) alan
// adlarıyla birebir aynıdır; excelCell "04-KANCA BLOĞU" sayfasına işaret eder.

import type { FieldDef } from "../fields";
import type { HookBlockInputs, HookBlockSelections } from "../modules/hookBlock";

export const HOOK_SHAFT_MATERIALS = ["C25", "C30", "C35", "C45", "4140+QT", "4140"] as const;
export const FATIGUE_MATERIALS = ["S235JR", "S355JR"] as const;
export const NOTCH_CLASSES = ["W0", "W1", "W2", "K0", "K1", "K2", "K3", "K4"] as const;
export const LOAD_GROUPS = ["B1", "B2", "B3", "B4", "B5", "B6"] as const;

export const HOOKBLOCK_INPUT_FIELDS: FieldDef<HookBlockInputs>[] = [
  { key: "shaftSpanACm", label: "Mil mesnet ölçüsü a", unit: "cm", type: "number", excelCell: "L60" },
  { key: "shaftSpanCCm", label: "Mil mesnet ölçüsü c", unit: "cm", type: "number", excelCell: "L61" },
  { key: "shaftDiaCm", label: "Mil çapı D", unit: "cm", type: "number", excelCell: "L63" },
  { key: "girderSpanMm", label: "Kiriş açıklığı a", unit: "mm", type: "number", excelCell: "L101" },
  { key: "loadOffsetMm", label: "Yük mesafesi b", unit: "mm", type: "number", excelCell: "L102" },
  { key: "midTopPlateThkMm", label: "Orta kesit üst sac kalınlığı", unit: "mm", type: "number", excelCell: "L111" },
  { key: "midTopPlateWidthMm", label: "Orta kesit üst sac genişliği", unit: "mm", type: "number", excelCell: "N111" },
  { key: "midWebPlateThkMm", label: "Orta kesit yan sac kalınlığı", unit: "mm", type: "number", excelCell: "L112" },
  { key: "midWebPlateHeightMm", label: "Orta kesit yan sac yüksekliği", unit: "mm", type: "number", excelCell: "N112" },
  { key: "midBottomPlateThkMm", label: "Orta kesit alt sac kalınlığı", unit: "mm", type: "number", excelCell: "L113" },
  { key: "midBottomPlateWidthMm", label: "Orta kesit alt sac genişliği", unit: "mm", type: "number", excelCell: "N113" },
  { key: "thickTopPlateThkMm", label: "Kalın kesit üst sac kalınlığı", unit: "mm", type: "number", excelCell: "P111" },
  { key: "thickTopPlateWidthMm", label: "Kalın kesit üst sac genişliği", unit: "mm", type: "number", excelCell: "R111" },
  { key: "thickWebPlateThkMm", label: "Kalın kesit yan sac kalınlığı", unit: "mm", type: "number", excelCell: "P112" },
  { key: "thickWebPlateHeightMm", label: "Kalın kesit yan sac yüksekliği", unit: "mm", type: "number", excelCell: "R112" },
  { key: "thickBottomPlateThkMm", label: "Kalın kesit alt sac kalınlığı", unit: "mm", type: "number", excelCell: "P113" },
  { key: "thickBottomPlateWidthMm", label: "Kalın kesit alt sac genişliği", unit: "mm", type: "number", excelCell: "R113" },
  { key: "hoistClass", label: "Kaldırma sınıfı", type: "text", excelCell: "L122" },
  { key: "dynamicFactorK", label: "ψ katsayısı k", type: "number", excelCell: "L126" },
  { key: "dynamicFactorL", label: "ψ katsayısı l", type: "number", excelCell: "L127" },
  { key: "loadGroup", label: "Yük sınıfı", type: "select", options: LOAD_GROUPS, excelCell: "L148" },
  { key: "notchClass", label: "Kaynak / çentik sınıfı", type: "select", options: NOTCH_CLASSES, excelCell: "L149" },
  // Excel'de dropdown silinmişti (#ref!); temiz yeniden yazımla geri geldi.
  { key: "fatigueMaterial", label: "Kiriş malzemesi (yorulma)", type: "select", options: FATIGUE_MATERIALS },
];

export const HOOKBLOCK_SELECTION_FIELDS: FieldDef<HookBlockSelections>[] = [
  { key: "hookDesignation", label: "Kanca tanımı", type: "text", excelCell: "A5" },
  { key: "hookCapacityKg", label: "Kanca kapasitesi", unit: "kg", type: "number", excelCell: "L6" },
  { key: "sheaveDiaMm", label: "Halat ekseninde makara çapı", unit: "mm", type: "number", excelCell: "L14" },
  { key: "sheaveBearingType", label: "Makara rulmanı tipi", type: "text", excelCell: "L22" },
  { key: "sheaveBearingCode", label: "Makara rulmanı kodu", type: "text", excelCell: "L23" },
  { key: "sheaveBearingDynCKn", label: "Makara rulmanı dinamik yük C", unit: "kN", type: "number", excelCell: "L29" },
  { key: "sheaveBearingStatC0Kn", label: "Makara rulmanı statik yük C0", unit: "kN", type: "number", excelCell: "L30" },
  { key: "shaftMaterial", label: "Mil malzemesi", type: "select", options: HOOK_SHAFT_MATERIALS, excelCell: "L69" },
  { key: "hookBearingType", label: "Kanca rulmanı tipi", type: "text", excelCell: "L80" },
  { key: "hookBearingCode", label: "Kanca rulmanı kodu", type: "text", excelCell: "L81" },
  { key: "hookBearingStatC0Kn", label: "Kanca rulmanı statik yük C0", unit: "kN", type: "number", excelCell: "L82" },
];
