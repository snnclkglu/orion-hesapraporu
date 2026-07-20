// Form alanı metadata'sı — UI formları bu tanımlardan üretilir.
// key'ler motor tiplerinin (TechnicalSpecs, HoistInputs, HoistSelections)
// alan adlarıyla birebir aynıdır.

import type { HoistInputs, HoistSelections } from "./modules/hoistGroup";
import type { TechnicalSpecs } from "./types";

export interface FieldDef<T> {
  key: keyof T & string;
  label: string;
  unit?: string;
  type: "number" | "text" | "select";
  options?: readonly string[];
  /** select değerleri sayısal alana yazılır (ör. tambur çapı serisi) */
  numeric?: boolean;
  excelCell?: string;
}

export const MECHANISM_CLASSES = ["M1", "M2", "M3", "M4", "M5", "M6", "M7", "M8"] as const;
export const USAGE_CLASSES = ["T0", "T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9"] as const;
export const STRUCTURE_CLASSES = ["A1", "A2", "A3", "A4", "A5", "A6", "A7", "A8"] as const;
export const DRUM_MATERIALS = ["S235", "S355"] as const;
export const SHAFT_MATERIALS = ["C25", "C30", "C35", "4140+QT", "4140"] as const;
export const HOOK_TYPES = [
  "DIN 15401 Tekli Kanca",
  "DIN 15402 Çift Ağız Kanca",
  "Kaldırma Kirişi (Spreader)",
  "Polip",
  "Mekanik Kepçe",
  "Motorlu Kepçe",
  "C Kancası",
  "Diğer",
] as const;
export const AMBIENT_TEMP_MIN_C = ["-40", "-35", "-30", "-25", "-20", "-15", "-10", "-5", "0"] as const;
export const AMBIENT_TEMP_MAX_C = ["40", "45", "50", "55", "60", "65", "70", "75", "80"] as const;
/** Tambur çapı standart serisi [mm] */
export const DRUM_DIA_SERIES_MM = [
  "200", "250", "290", "315", "355", "400", "450", "500", "560", "630", "710", "800",
] as const;

export const SPEC_FIELDS: FieldDef<TechnicalSpecs>[] = [
  { key: "mainCapacityT", label: "Ana kaldırma kapasitesi", unit: "ton", type: "number", excelCell: "P4" },
  { key: "mainLiftHeightM", label: "Ana kaldırma yüksekliği", unit: "m", type: "number", excelCell: "P5" },
  { key: "mainLiftSpeedMpm", label: "Ana kaldırma hızı", unit: "m/dak", type: "number", excelCell: "P6" },
  { key: "auxCapacityT", label: "Yardımcı kaldırma kapasitesi", unit: "ton", type: "number", excelCell: "P7" },
  { key: "auxLiftHeightM", label: "Yardımcı kaldırma yüksekliği", unit: "m", type: "number", excelCell: "P8" },
  { key: "auxLiftSpeedMpm", label: "Yardımcı kaldırma hızı", unit: "m/dak", type: "number", excelCell: "P9" },
  { key: "structureClass", label: "Çelik konstrüksiyon sınıfı", type: "select", options: STRUCTURE_CLASSES, excelCell: "P10" },
  { key: "hoistLoadClass", label: "Kaldırma / yük grubu sınıfı", type: "text", excelCell: "P11" },
  { key: "hoistMechanismClass", label: "Kaldırma mekanizma sınıfı", type: "select", options: MECHANISM_CLASSES, excelCell: "P12" },
  { key: "hoistUsageClass", label: "Kaldırma kullanım sınıfı", type: "select", options: USAGE_CLASSES, excelCell: "P13" },
  { key: "bridgeSpeedMpm", label: "Köprü yürütme hızı", unit: "m/dak", type: "number", excelCell: "P14" },
  { key: "bridgeMechanismClass", label: "Köprü mekanizma sınıfı", type: "select", options: MECHANISM_CLASSES, excelCell: "P15" },
  { key: "bridgeUsageClass", label: "Köprü kullanım sınıfı", type: "select", options: USAGE_CLASSES, excelCell: "P16" },
  { key: "trolleySpeedMpm", label: "Araba yürütme hızı", unit: "m/dak", type: "number", excelCell: "P17" },
  { key: "trolleyMechanismClass", label: "Araba mekanizma sınıfı", type: "select", options: MECHANISM_CLASSES, excelCell: "P18" },
  { key: "trolleyUsageClass", label: "Araba kullanım sınıfı", type: "select", options: USAGE_CLASSES, excelCell: "P19" },
  { key: "hookType", label: "Kanca / tutucu tipi", type: "select", options: HOOK_TYPES, excelCell: "P20" },
  { key: "controlType", label: "Kumanda şekli", type: "text", excelCell: "P21" },
  { key: "ambientTempMinC", label: "Ortam sıcaklığı (min)", unit: "°C", type: "select", options: AMBIENT_TEMP_MIN_C, numeric: true, excelCell: "R22" },
  { key: "ambientTempMaxC", label: "Ortam sıcaklığı (maks)", unit: "°C", type: "select", options: AMBIENT_TEMP_MAX_C, numeric: true, excelCell: "T22" },
  { key: "supplyVoltage", label: "Besleme gerilimi", type: "text", excelCell: "P23" },
  { key: "controlVoltage", label: "Kumanda gerilimi", type: "text", excelCell: "P24" },
  { key: "spanM", label: "Açıklık", unit: "m", type: "number", excelCell: "P27" },
];

export const HOIST_INPUT_FIELDS: FieldDef<HoistInputs>[] = [
  { key: "drivenFalls", label: "Tahrikli halat sayısı", type: "number", excelCell: "L5" },
  { key: "totalFalls", label: "Toplam halat sayısı", type: "number", excelCell: "O5" },
  { key: "sheaveEfficiency", label: "Makara verimi", type: "number", excelCell: "L7" },
  { key: "fixedSheaveCount", label: "Sabit makara adedi", type: "number", excelCell: "L8" },
  { key: "hookBlockWeightKg", label: "Kanca bloğu / kepçe ağırlığı", unit: "kg", type: "number", excelCell: "L14" },
  { key: "ropeWeightKg", label: "Halat ağırlığı", unit: "kg", type: "number", excelCell: "L15" },
  { key: "drumWallThicknessMm", label: "Tambur et kalınlığı", unit: "mm", type: "number", excelCell: "L42" },
  { key: "safetyGrooveCount", label: "Emniyet sarımı", type: "number", excelCell: "L58" },
  { key: "drumWeightKg", label: "Tambur ağırlığı", unit: "kg", type: "number", excelCell: "L69" },
  { key: "shaftSpanACm", label: "Mil mesnet ölçüsü a", unit: "cm", type: "number", excelCell: "L70" },
  { key: "shaftSpanBCm", label: "Mil mesnet ölçüsü b", unit: "cm", type: "number", excelCell: "L71" },
  { key: "shaftSpanCCm", label: "Mil mesnet ölçüsü c", unit: "cm", type: "number", excelCell: "L72" },
  { key: "shaftMomentArmCm", label: "Moment kolu", unit: "cm", type: "number", excelCell: "L73" },
  { key: "shaftDiaCm", label: "Mil çapı (eğilme)", unit: "cm", type: "number", excelCell: "L76" },
  { key: "shaftShearDiaCm", label: "Mil çapı (kesme)", unit: "cm", type: "number", excelCell: "L77" },
  { key: "drumWeldThicknessCm", label: "Tambur kaynak kalınlığı", unit: "cm", type: "number", excelCell: "L99" },
  { key: "drumWeldAllowable", label: "Tambur kaynağı izin gerilmesi", unit: "MPa", type: "number", excelCell: "L101" },
  { key: "shaftWeldThicknessCm", label: "Mil kaynak kalınlığı", unit: "cm", type: "number", excelCell: "L115" },
  { key: "shaftWeldAllowable", label: "Mil kaynağı izin gerilmesi", unit: "MPa", type: "number", excelCell: "L117" },
  { key: "bearingFactorY1", label: "Rulman eşdeğer yük katsayısı (statik)", type: "number", excelCell: "L142" },
  { key: "bearingFactorY2", label: "Rulman eşdeğer yük katsayısı (dinamik)", type: "number", excelCell: "L143" },
  { key: "drumCount", label: "Tambur adedi", type: "number", excelCell: "L163" },
  { key: "gearboxServiceFactor", label: "Redüktör emniyet katsayısı", type: "number", excelCell: "L166" },
  { key: "reducerStages", label: "Redüktör kademe sayısı", type: "number", excelCell: "L195" },
  { key: "stageEfficiency", label: "Kademe verimi", type: "number", excelCell: "L196" },
  { key: "tempFactor", label: "Sıcaklık faktörü", type: "number", excelCell: "L203" },
  { key: "motorDivisor", label: "Motor güç bölücü", type: "number", excelCell: "L205" },
  { key: "brakeServiceFactor", label: "Fren emniyet katsayısı", type: "number", excelCell: "L219" },
  { key: "motorCouplingServiceFactor", label: "Motor kaplini emniyet katsayısı", type: "number", excelCell: "L234" },
  { key: "drumCouplingServiceFactor", label: "Tambur kaplini emniyet katsayısı", type: "number", excelCell: "L250" },
];

export const HOIST_SELECTION_FIELDS: FieldDef<HoistSelections>[] = [
  { key: "ropeBrand", label: "Halat markası", type: "text", excelCell: "L23" },
  { key: "ropeDiaMm", label: "Halat çapı", unit: "mm", type: "number", excelCell: "L24" },
  { key: "ropeConstruction", label: "Halat yapısı", type: "text", excelCell: "L25" },
  { key: "ropeCore", label: "Halat özü", type: "text", excelCell: "L26" },
  { key: "ropeWireStrength", label: "Tel mukavemeti", unit: "kg/mm²", type: "number", excelCell: "L27" },
  { key: "ropeBreakingLoadKn", label: "Halat kopma yükü", unit: "kN", type: "number", excelCell: "Q28" },
  { key: "drumDiaMm", label: "Tambur çapı", unit: "mm", type: "select", options: DRUM_DIA_SERIES_MM, numeric: true, excelCell: "L39" },
  { key: "drumMaterial", label: "Tambur malzemesi", type: "select", options: DRUM_MATERIALS, excelCell: "L40" },
  { key: "drumGrooveLengthText", label: "Seçilen oluk boyu", unit: "mm", type: "text", excelCell: "L63" },
  { key: "shaftMaterial", label: "Mil malzemesi", type: "select", options: SHAFT_MATERIALS, excelCell: "L90" },
  { key: "bearingType", label: "Rulman tipi", type: "text", excelCell: "L133" },
  { key: "bearingCode", label: "Rulman kodu", type: "text", excelCell: "L134" },
  { key: "bearingDynCKn", label: "Rulman dinamik yük C", unit: "kN", type: "number", excelCell: "L140" },
  { key: "bearingStatC0Kn", label: "Rulman statik yük C0", unit: "kN", type: "number", excelCell: "L141" },
  { key: "gearboxModel", label: "Redüktör", type: "text", excelCell: "L174" },
  { key: "gearboxRatio", label: "Çevrim oranı", type: "number", excelCell: "L175" },
  { key: "gearboxNominalTorqueKnm", label: "Redüktör nominal torku", unit: "kNm", type: "number", excelCell: "L176" },
  { key: "gearboxInputShaftMm", label: "Redüktör giriş mili", unit: "mm", type: "number", excelCell: "L177" },
  { key: "gearboxOutputShaftMm", label: "Redüktör çıkış mili", unit: "mm", type: "number", excelCell: "L178" },
  { key: "gearboxWeightKg", label: "Redüktör ağırlığı", unit: "kg", type: "number", excelCell: "L180" },
  { key: "gearboxAllowedRadialKn", label: "Redüktör izinli radyal yük", unit: "kN", type: "number", excelCell: "L188" },
  { key: "motorPowerKw", label: "Motor gücü", unit: "kW", type: "number", excelCell: "L208" },
  { key: "motorRpm", label: "Motor devri", unit: "d/dak", type: "number", excelCell: "O208" },
  { key: "motorShaftMm", label: "Motor mili", unit: "mm", type: "number", excelCell: "L209" },
  { key: "motorBrand", label: "Motor markası", type: "text", excelCell: "L210" },
  { key: "motorCount", label: "Motor adedi", type: "number", excelCell: "L211" },
  { key: "brakeBrand", label: "Fren markası", type: "text", excelCell: "L222" },
  { key: "brakeModel", label: "Fren modeli", type: "text", excelCell: "L223" },
  { key: "brakeTorqueNm", label: "Fren torku", unit: "Nm", type: "number", excelCell: "L224" },
  { key: "brakeWheelDiaMm", label: "Fren kasnak çapı", unit: "mm", type: "number", excelCell: "L225" },
  { key: "brakeQty", label: "Fren adedi", type: "number", excelCell: "L226" },
  { key: "motorCouplingBrand", label: "Motor kaplini markası", type: "text", excelCell: "L237" },
  { key: "motorCouplingModel", label: "Motor kaplini modeli", type: "text", excelCell: "L238" },
  { key: "motorCouplingTorqueNm", label: "Motor kaplini torku", unit: "Nm", type: "number", excelCell: "L240" },
  { key: "motorCouplingDmaxMm", label: "Motor kaplini dmax", unit: "mm", type: "number", excelCell: "L241" },
  { key: "drumCouplingBrand", label: "Tambur kaplini markası", type: "text", excelCell: "L256" },
  { key: "drumCouplingModel", label: "Tambur kaplini modeli", type: "text", excelCell: "L257" },
  { key: "drumCouplingTorqueNm", label: "Tambur kaplini torku", unit: "Nm", type: "number", excelCell: "L258" },
  { key: "drumCouplingRadialN", label: "Tambur kaplini radyal yükü", unit: "N", type: "number", excelCell: "L259" },
  { key: "drumCouplingDmaxMm", label: "Tambur kaplini dmax", unit: "mm", type: "number", excelCell: "L260" },
];
