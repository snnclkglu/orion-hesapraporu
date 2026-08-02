// Form alanı metadata'sı — UI formları bu tanımlardan üretilir.
// key'ler motor tiplerinin (TechnicalSpecs, HoistInputs, HoistSelections)
// alan adlarıyla birebir aynıdır.

import { SHEAVE_BEARING_KINDS } from "./derive";
import { ROPE_POSITIONS } from "./modules/hoistGroup";
import { COMMON_REEVINGS } from "./reeving";
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
  /** select seçeneklerinin gösterim etiketi (değer→etiket, ör. "1000"→"1/1000") */
  optionLabels?: Record<string, string>;
  /** Standart referansı (standards/registry.ts anahtarı) — alan yanında rozet */
  standardRef?: string;
  /** Alanın ait olduğu teknik özellik grubu (yalnız SPEC_FIELDS) */
  group?: SpecGroupKey;
  /** Alan yalnız bu modül açıkken gösterilir (yalnız SPEC_FIELDS) */
  requiresModule?: "aux";
  /** Alanın altında gösterilecek kısa açıklama */
  hint?: string;
}

// ------------------------------------------------------- Teknik özellik grupları

export type SpecGroupKey =
  | "crane"
  | "mainHoist"
  | "auxHoist"
  | "trolley"
  | "bridge"
  | "brakes"
  | "electrical"
  | "environment";

export interface SpecGroup {
  key: SpecGroupKey;
  title: string;
  description?: string;
  /** Grup yalnız bu modül açıkken gösterilir */
  requiresModule?: "aux";
}

/** Teknik özellikler ekranındaki blok sırası. */
export const SPEC_GROUPS: readonly SpecGroup[] = [
  {
    key: "crane",
    title: "Vinç Tanımı ve Sınıflandırma",
    description: "Vincin geometrisi ve FEM/DIN sınıfları — tüm hesaplar bunlara dayanır.",
  },
  {
    key: "mainHoist",
    title: "Ana Kaldırma",
  },
  {
    key: "auxHoist",
    title: "Yardımcı Kaldırma",
    requiresModule: "aux",
  },
  {
    key: "trolley",
    title: "Araba Yürütme",
  },
  {
    key: "bridge",
    title: "Köprü Yürütme",
  },
  {
    key: "brakes",
    title: "Frenler",
  },
  {
    key: "electrical",
    title: "Elektrik",
  },
  {
    key: "environment",
    title: "Ortam Koşulları",
  },
] as const;

// -------------------------------------------------------------- Seçenek listeleri

export const MECHANISM_CLASSES = ["M1", "M2", "M3", "M4", "M5", "M6", "M7", "M8"] as const;
export const USAGE_CLASSES = ["T0", "T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9"] as const;
export const STRUCTURE_CLASSES = ["A1", "A2", "A3", "A4", "A5", "A6", "A7", "A8"] as const;
export const DRUM_MATERIALS = ["S235", "S355"] as const;
export const SHAFT_MATERIALS = ["S355JR", "C25", "C30", "C35", "4140+QT", "4140"] as const;
export const HOOK_TYPES = [
  "DIN 15401 Tekli Kanca",
  "DIN 15402 Çift Ağız Kanca",
  "Kaldırma Kirişi",
  "Kaldırma Mıknatısı",
  "Polip",
  "Mekanik Kepçe",
  "Motorlu Kepçe",
  "C Kancası",
  "Diğer",
] as const;

/** Kaldırma / yük grubu sınıfı — DIN 15018 kaldırma sınıfı + yük grubu birleşimi */
export const HOIST_LOAD_CLASSES = [
  "H1/B1", "H1/B2", "H1/B3",
  "H2/B2", "H2/B3", "H2/B4",
  "H3/B3", "H3/B4", "H3/B5",
  "H4/B4", "H4/B5", "H4/B6",
] as const;

/** Kumanda şekli seçenekleri */
export const CONTROL_TYPES = [
  "Sabit Kabin + Uzaktan Kumanda",
  "Sabit Kabin",
  "Uzaktan Kumanda",
  "Yürütmeli Kabin",
] as const;

/** Fren tipleri — kaldırma grupları (manyetik/eldro/disk), yürütme (manyetik/eldro) */
export const HOIST_BRAKE_TYPES = ["Manyetik Fren", "Eldro Fren", "Disk Fren"] as const;
export const TRAVEL_BRAKE_TYPES = ["Manyetik Fren", "Eldro Fren"] as const;
export const YES_NO = ["Var", "Yok"] as const;
export const AMBIENT_TEMP_MIN_C = ["-40", "-35", "-30", "-25", "-20", "-15", "-10", "-5", "0"] as const;
export const AMBIENT_TEMP_MAX_C = ["40", "45", "50", "55", "60", "65", "70", "75", "80"] as const;

/**
 * Besleme gerilimi — Türkiye, Avrupa ve Kuzey Amerika'da yaygın şebeke
 * gerilimleri. İlk iki seçenek Türkiye'de en çok kullanılanlardır.
 */
export const SUPPLY_VOLTAGES = [
  "380 VAC, 3 Faz, 50 Hz",
  "400 VAC, 3 Faz, 50 Hz",
  "415 VAC, 3 Faz, 50 Hz",
  "440 VAC, 3 Faz, 60 Hz",
  "460 VAC, 3 Faz, 60 Hz",
  "480 VAC, 3 Faz, 60 Hz",
  "690 VAC, 3 Faz, 50 Hz",
] as const;

/** Kumanda gerilimi — yaygın kumanda devresi gerilimleri. */
export const CONTROL_VOLTAGES = [
  "24 VDC",
  "48 VDC",
  "24 VAC",
  "48 VAC",
  "110 VAC",
  "220 VAC",
] as const;

/** Tambur çapı standart serisi [mm] */
export const DRUM_DIA_SERIES_MM = [
  "200", "250", "290", "315", "355", "400", "450", "500", "560", "630", "710", "800",
] as const;

/** Halat özü seçenekleri — katalog verisiyle uyumlu (FC / IWRC) */
export const ROPE_CORE_TYPES = [
  "Çelik Öz (IWRC)",
  "Elyaf Öz (FC)",
] as const;

// ------------------------------------------------------------ Halat donanımı

/** Hazır donanım yerine tahrikli/toplam kol sayılarının elle girildiği seçenek. */
export const MANUAL_REEVING = "Elle giriş";

/**
 * "Halat donanımı" açılır listesi. Tanınan bir etiket seçildiğinde motor
 * (bkz. `hoistReeving`) tahrikli ve toplam halat kolu sayılarını o donanımdan
 * okur; "Elle giriş" seçiliyken aşağıdaki iki sayısal alan geçerlidir.
 */
export const REEVING_OPTIONS: readonly string[] = [
  MANUAL_REEVING,
  ...COMMON_REEVINGS.map((r) => r.label),
];

/** Açılır listede gösterilecek açıklayıcı etiketler. */
export const REEVING_OPTION_LABELS: Record<string, string> = {
  [MANUAL_REEVING]: MANUAL_REEVING,
  ...Object.fromEntries(
    COMMON_REEVINGS.map((r) => [
      r.label,
      `${r.label} — ${r.drivenFalls} tahrikli / ${r.totalFalls} toplam kol`,
    ])
  ),
};

// -------------------------------------------------------------- Teknik özellikler

export const SPEC_FIELDS: FieldDef<TechnicalSpecs>[] = [
  // --- Vinç tanımı ve sınıflandırma
  { key: "spanM", label: "Açıklık", unit: "m", type: "number", group: "crane" },
  { key: "structureClass", label: "Çelik konstrüksiyon sınıfı", type: "select", options: STRUCTURE_CLASSES, group: "crane", standardRef: "FEM 1.001 T.2.3.4" },
  { key: "hoistLoadClass", label: "Kaldırma / yük grubu sınıfı", type: "select", options: HOIST_LOAD_CLASSES, group: "crane", standardRef: "DIN 15018 Tablo 2" },
  { key: "hookType", label: "Kanca / tutucu tipi", type: "select", options: HOOK_TYPES, group: "crane", standardRef: "DIN 15400" },
  { key: "controlType", label: "Kumanda şekli", type: "select", options: CONTROL_TYPES, group: "crane" },

  // --- Ana kaldırma
  { key: "mainCapacityT", label: "Kaldırma kapasitesi", unit: "ton", type: "number", group: "mainHoist" },
  { key: "mainLiftHeightM", label: "Kaldırma yüksekliği", unit: "m", type: "number", group: "mainHoist" },
  { key: "mainLiftSpeedMpm", label: "Kaldırma hızı", unit: "m/dak", type: "number", group: "mainHoist" },
  { key: "hoistMechanismClass", label: "Mekanizma sınıfı", type: "select", options: MECHANISM_CLASSES, group: "mainHoist", standardRef: "FEM 1.001 T.2.6" },
  { key: "hoistUsageClass", label: "Kullanım sınıfı", type: "select", options: USAGE_CLASSES, group: "mainHoist", standardRef: "FEM 1.001 T.2.1.3.2" },

  // --- Yardımcı kaldırma (modül kapalıysa gizlenir)
  { key: "auxCapacityT", label: "Kaldırma kapasitesi", unit: "ton", type: "number", group: "auxHoist", requiresModule: "aux" },
  { key: "auxLiftHeightM", label: "Kaldırma yüksekliği", unit: "m", type: "number", group: "auxHoist", requiresModule: "aux" },
  { key: "auxLiftSpeedMpm", label: "Kaldırma hızı", unit: "m/dak", type: "number", group: "auxHoist", requiresModule: "aux" },
  {
    key: "auxMechanismClass", label: "Mekanizma sınıfı", type: "select",
    options: MECHANISM_CLASSES, group: "auxHoist", requiresModule: "aux",
    standardRef: "FEM 1.001 T.2.6",
    hint: "Yardımcı kaldırma bağımsız bir mekanizmadır; boş bırakılırsa ana kaldırmanın sınıfı kullanılır.",
  },
  {
    key: "auxUsageClass", label: "Kullanım sınıfı", type: "select",
    options: USAGE_CLASSES, group: "auxHoist", requiresModule: "aux",
    standardRef: "FEM 1.001 T.2.1.3.2",
    hint: "Gerekli rulman ömrünü belirler; boş bırakılırsa ana kaldırmanın sınıfı kullanılır.",
  },

  // --- Araba yürütme
  { key: "trolleySpeedMpm", label: "Yürütme hızı", unit: "m/dak", type: "number", group: "trolley" },
  { key: "trolleyMechanismClass", label: "Mekanizma sınıfı", type: "select", options: MECHANISM_CLASSES, group: "trolley", standardRef: "FEM 1.001 T.2.6" },
  { key: "trolleyUsageClass", label: "Kullanım sınıfı", type: "select", options: USAGE_CLASSES, group: "trolley", standardRef: "FEM 1.001 T.2.1.3.2" },

  // --- Köprü yürütme
  { key: "bridgeSpeedMpm", label: "Yürütme hızı", unit: "m/dak", type: "number", group: "bridge" },
  { key: "bridgeMechanismClass", label: "Mekanizma sınıfı", type: "select", options: MECHANISM_CLASSES, group: "bridge", standardRef: "FEM 1.001 T.2.6" },
  { key: "bridgeUsageClass", label: "Kullanım sınıfı", type: "select", options: USAGE_CLASSES, group: "bridge", standardRef: "FEM 1.001 T.2.1.3.2" },

  // --- Frenler
  { key: "hoistBrakeType", label: "Kaldırma freni tipi", type: "select", options: HOIST_BRAKE_TYPES, group: "brakes" },
  { key: "hoistSafetyBrake", label: "Kaldırma emniyet freni", type: "select", options: YES_NO, group: "brakes" },
  { key: "travelBrakeType", label: "Yürütme freni tipi", type: "select", options: TRAVEL_BRAKE_TYPES, group: "brakes" },

  // --- Elektrik
  { key: "supplyVoltage", label: "Besleme gerilimi", type: "select", options: SUPPLY_VOLTAGES, group: "electrical" },
  { key: "controlVoltage", label: "Kumanda gerilimi", type: "select", options: CONTROL_VOLTAGES, group: "electrical" },

  // --- Ortam
  { key: "ambientTempMinC", label: "Ortam sıcaklığı (min)", unit: "°C", type: "select", options: AMBIENT_TEMP_MIN_C, numeric: true, group: "environment" },
  { key: "ambientTempMaxC", label: "Ortam sıcaklığı (maks)", unit: "°C", type: "select", options: AMBIENT_TEMP_MAX_C, numeric: true, group: "environment" },
];

export const HOIST_INPUT_FIELDS: FieldDef<HoistInputs>[] = [
  {
    key: "reevingLabel", label: "Halat donanımı", type: "select",
    options: REEVING_OPTIONS, optionLabels: REEVING_OPTION_LABELS,
    hint: "Hazır donanım seçilirse tahrikli ve toplam halat kolu sayıları buradan alınır.",
  },
  { key: "drivenFalls", label: "Tahrikli halat sayısı", type: "number" },
  { key: "totalFalls", label: "Toplam halat sayısı", type: "number" },
  { key: "sheaveEfficiency", label: "Makara verimi", type: "number", hint: "Makara yataklama tipinden otomatik türetilebilir." },
  { key: "fixedSheaveCount", label: "Sabit makara adedi", type: "number" },
  { key: "hookBlockWeightKg", label: "Kanca bloğu / kepçe ağırlığı", unit: "kg", type: "number" },
  { key: "ropeWeightKg", label: "Halat ağırlığı", unit: "kg", type: "number", hint: "Toplam halat sayısı × metre ağırlığı × kaldırma yüksekliği (50 kg'a yuvarlanır)." },
  { key: "drumWallThicknessMm", label: "Tambur et kalınlığı", unit: "mm", type: "number" },
  { key: "safetyGrooveCount", label: "Emniyet sarımı", type: "number" },
  { key: "drumWeightKg", label: "Tambur ağırlığı (W)", unit: "kg", type: "number" },
  { key: "drumSpanACm", label: "A · Redüktör mesnedi → sol yanak", unit: "cm", type: "number", hint: "Redüktör tarafı moment kolu." },
  { key: "drumSpanBCm", label: "B · Sol yanak → yiv başlangıcı", unit: "cm", type: "number" },
  { key: "drumSpanCCm", label: "C · Sol yiv bölgesi", unit: "cm", type: "number" },
  { key: "drumSpanDCm", label: "D · Ortadaki yivsiz bölge", unit: "cm", type: "number" },
  { key: "drumSpanECm", label: "E · Sağ yiv bölgesi", unit: "cm", type: "number", hint: "Tek helisli tamburda 0 girin." },
  { key: "drumSpanFCm", label: "F · Yiv sonu → sağ yanak", unit: "cm", type: "number" },
  { key: "drumSpanGCm", label: "G · Sağ yanak → tambur yatağı", unit: "cm", type: "number", hint: "Tambur yatağı tarafı moment kolu." },
  { key: "ropeLoadPosition", label: "Halat yükü konumu", type: "select", options: ROPE_POSITIONS },
  { key: "shaftD1Cm", label: "D1 · Mil gerilme kesiti çapı", unit: "cm", type: "number" },
  { key: "shaftD2Cm", label: "D2 · Yatak / rulman oturma çapı", unit: "cm", type: "number" },
  { key: "drumWeldThicknessCm", label: "Tambur kaynak kalınlığı", unit: "cm", type: "number" },
  { key: "drumWeldAllowable", label: "Tambur kaynağı izin gerilmesi", unit: "MPa", type: "number" },
  { key: "shaftWeldThicknessCm", label: "Mil kaynak kalınlığı", unit: "cm", type: "number" },
  { key: "shaftWeldAllowable", label: "Mil kaynağı izin gerilmesi", unit: "MPa", type: "number" },
  { key: "bearingFactorY1", label: "Rulman eşdeğer yük katsayısı (statik)", type: "number" },
  { key: "bearingFactorY2", label: "Rulman eşdeğer yük katsayısı (dinamik)", type: "number" },
  { key: "drumCount", label: "Tambur adedi", type: "number" },
  { key: "gearboxServiceFactor", label: "Redüktör emniyet katsayısı", type: "number" },
  { key: "reducerStages", label: "Redüktör kademe sayısı", type: "number" },
  { key: "stageEfficiency", label: "Kademe verimi", type: "number" },
  { key: "tempFactor", label: "Sıcaklık faktörü", type: "number" },
  { key: "motorDivisor", label: "Motor güç bölücü", type: "number" },
  { key: "brakeServiceFactor", label: "Fren emniyet katsayısı", type: "number" },
  { key: "motorCouplingServiceFactor", label: "Motor kaplini emniyet katsayısı", type: "number" },
  { key: "drumCouplingServiceFactor", label: "Tambur kaplini emniyet katsayısı", type: "number" },
];

export const HOIST_SELECTION_FIELDS: FieldDef<HoistSelections>[] = [
  { key: "ropeBrand", label: "Halat markası", type: "text" },
  { key: "ropeDiaMm", label: "Halat çapı", unit: "mm", type: "number" },
  { key: "ropeConstruction", label: "Halat yapısı", type: "text" },
  { key: "ropeCore", label: "Halat özü", type: "select", options: ROPE_CORE_TYPES },
  { key: "ropeWireStrength", label: "Tel mukavemeti", unit: "kg/mm²", type: "number" },
  { key: "ropeBreakingLoadKn", label: "Halat kopma yükü", unit: "kN", type: "number" },
  { key: "ropeWeightKgPerM", label: "Halat metre ağırlığı", unit: "kg/m", type: "number" },
  { key: "sheaveBearingKind", label: "Makara yataklama tipi", type: "select", options: SHEAVE_BEARING_KINDS },
  { key: "drumDiaMm", label: "Tambur çapı", unit: "mm", type: "select", options: DRUM_DIA_SERIES_MM, numeric: true },
  { key: "drumMaterial", label: "Tambur malzemesi", type: "select", options: DRUM_MATERIALS },
  { key: "drumGrooveLengthText", label: "Seçilen oluk boyu", unit: "mm", type: "text" },
  { key: "shaftMaterial", label: "Mil malzemesi", type: "select", options: SHAFT_MATERIALS },
  { key: "bearingType", label: "Rulman tipi", type: "text" },
  { key: "bearingCode", label: "Rulman kodu", type: "text" },
  { key: "bearingDynCKn", label: "Rulman dinamik yük C", unit: "kN", type: "number" },
  { key: "bearingStatC0Kn", label: "Rulman statik yük C0", unit: "kN", type: "number" },
  { key: "gearboxModel", label: "Redüktör", type: "text" },
  { key: "gearboxRatio", label: "Çevrim oranı", type: "number" },
  { key: "gearboxNominalTorqueKnm", label: "Redüktör nominal torku", unit: "kNm", type: "number" },
  { key: "gearboxInputShaftMm", label: "Redüktör giriş mili", unit: "mm", type: "number" },
  { key: "gearboxOutputShaftMm", label: "Redüktör çıkış mili", unit: "mm", type: "number" },
  { key: "gearboxWeightKg", label: "Redüktör ağırlığı", unit: "kg", type: "number" },
  { key: "gearboxAllowedRadialKn", label: "Redüktör izinli radyal yük", unit: "kN", type: "number" },
  { key: "motorPowerKw", label: "Motor gücü", unit: "kW", type: "number" },
  { key: "motorRpm", label: "Motor devri", unit: "d/dak", type: "number" },
  { key: "motorShaftMm", label: "Motor mili", unit: "mm", type: "number" },
  { key: "motorBrand", label: "Motor markası", type: "text" },
  { key: "motorCount", label: "Motor adedi", type: "number" },
  { key: "brakeBrand", label: "Fren markası", type: "text" },
  { key: "brakeModel", label: "Fren modeli", type: "text" },
  { key: "brakeTorqueNm", label: "Fren torku", unit: "Nm", type: "number" },
  { key: "brakeWheelDiaMm", label: "Fren kasnak çapı", unit: "mm", type: "number" },
  { key: "brakeQty", label: "Fren adedi", type: "number" },
  { key: "motorCouplingBrand", label: "Motor kaplini markası", type: "text" },
  { key: "motorCouplingModel", label: "Motor kaplini modeli", type: "text" },
  { key: "motorCouplingTorqueNm", label: "Motor kaplini torku", unit: "Nm", type: "number" },
  { key: "motorCouplingDmaxMm", label: "Motor kaplini dmax", unit: "mm", type: "number" },
  { key: "drumCouplingBrand", label: "Tambur kaplini markası", type: "text" },
  { key: "drumCouplingModel", label: "Tambur kaplini modeli", type: "text" },
  { key: "drumCouplingTorqueNm", label: "Tambur kaplini torku", unit: "Nm", type: "number" },
  { key: "drumCouplingRadialN", label: "Tambur kaplini radyal yükü", unit: "N", type: "number" },
  { key: "drumCouplingDmaxMm", label: "Tambur kaplini dmax", unit: "mm", type: "number" },
];

/** Otomatik doldurulabilen kaldırma girdileri: alan → anahtar alanı. */
export const HOIST_AUTO_FIELDS: Record<string, keyof HoistInputs & string> = {
  ropeWeightKg: "ropeWeightAuto",
  sheaveEfficiency: "sheaveEfficiencyAuto",
};
