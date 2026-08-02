// Form alanı metadata'sı — UI formları bu tanımlardan üretilir.
// key'ler motor tiplerinin (TechnicalSpecs, HoistInputs, HoistSelections)
// alan adlarıyla birebir aynıdır.

import { ROPE_POSITIONS } from "./modules/hoistGroup";
import { COMMON_REEVINGS } from "./reeving";
import type { HoistInputs, HoistSelections } from "./modules/hoistGroup";
import type { ModuleKey } from "./presentation/module-family";
import type { TechnicalSpecs } from "./types";

export interface FieldDef<T> {
  key: keyof T & string;
  label: string;
  /**
   * Teknik özelliklere göre değişen etiket. Sabit `label` yedektir; sunum
   * katmanı `fieldLabel(def, specs)` ile çözer (ör. kanca bloğu ağırlığı alanı,
   * seçilen kanca/tutucu tipinin adıyla görünür).
   */
  labelFor?: (specs: TechnicalSpecs) => string;
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
  /** Alan yalnız bu hesap bölümü açıkken gösterilir (yalnız SPEC_FIELDS) */
  requiresModule?: ModuleKey;
  /** Alanın altında gösterilecek kısa açıklama */
  hint?: string;
}

// ------------------------------------------------------- Teknik özellik grupları

export type SpecGroupKey =
  | "crane"
  | "config"
  | "weights"
  | "mainHoist"
  | "auxHoist"
  | "mono1Hoist"
  | "mono2Hoist"
  | "trolley"
  | "auxTrolley"
  | "mono1Trolley"
  | "mono2Trolley"
  | "bridge"
  | "brakes"
  | "electrical"
  | "environment";

export interface SpecGroup {
  key: SpecGroupKey;
  title: string;
  description?: string;
  /** Grup yalnız bu hesap bölümü açıkken gösterilir */
  requiresModule?: ModuleKey;
}

/** Teknik özellikler ekranındaki blok sırası. */
export const SPEC_GROUPS: readonly SpecGroup[] = [
  {
    key: "crane",
    title: "Vinç Tanımı ve Sınıflandırma",
    description: "Vincin geometrisi ve FEM/DIN sınıfları — tüm hesaplar bunlara dayanır.",
  },
  {
    key: "config",
    title: "Vinç Konfigürasyonu",
    description:
      "Kaldırma grupları ve arabaları. Buradaki seçim hesap bölümlerini otomatik açar.",
  },
  {
    key: "weights",
    title: "Ağırlıklar",
    description: "Yürütme, ana kiriş ve başkiriş hesapları ağırlıkları buradan okur.",
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
    key: "mono1Hoist",
    title: "Monoray 1 Kaldırma",
    requiresModule: "mono1",
  },
  {
    key: "mono2Hoist",
    title: "Monoray 2 Kaldırma",
    requiresModule: "mono2",
  },
  {
    key: "trolley",
    title: "Ana Araba Yürütme",
  },
  {
    key: "auxTrolley",
    title: "Yardımcı Araba Yürütme",
    requiresModule: "auxTrolley",
  },
  {
    key: "mono1Trolley",
    title: "Monoray 1 Araba Yürütme",
    requiresModule: "mono1Trolley",
  },
  {
    key: "mono2Trolley",
    title: "Monoray 2 Araba Yürütme",
    requiresModule: "mono2Trolley",
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
 * "Halat donanımı" açılır listesi. Seçenekler yalnız sayıdır ("tahrikli/toplam"):
 * ilk sayı tambura sarılan tahrikli halat, ikinci sayı toplam halat adedidir.
 * Tanınan bir etiket seçildiğinde motor (bkz. `hoistReeving`) ve sihirbaz iki
 * sayısal alanı o donanımdan doldurur; "Elle giriş" seçiliyken alanlar serbesttir.
 */
export const REEVING_OPTIONS: readonly string[] = [
  ...COMMON_REEVINGS.map((r) => r.label),
  MANUAL_REEVING,
];

// -------------------------------------------------------------- Teknik özellikler

/** Yardımcı kaldırma arabası seçenekleri (değer → etiket). */
export const AUX_TROLLEY_MODES = ["shared", "separate"] as const;
export const AUX_TROLLEY_MODE_LABELS: Record<string, string> = {
  shared: "Ana Araba Üzerinde",
  separate: "Ayrı Yardımcı Araba",
};

/** Monoray kaldırma grubu adedi. */
export const MONORAIL_COUNTS = ["0", "1", "2"] as const;
export const MONORAIL_COUNT_LABELS: Record<string, string> = {
  "0": "Yok",
  "1": "1 Monoray",
  "2": "2 Monoray",
};

export const SPEC_FIELDS: FieldDef<TechnicalSpecs>[] = [
  // --- Vinç tanımı ve sınıflandırma
  { key: "spanM", label: "Açıklık", unit: "m", type: "number", group: "crane" },
  { key: "structureClass", label: "Çelik Konstrüksiyon Sınıfı", type: "select", options: STRUCTURE_CLASSES, group: "crane", standardRef: "FEM 1.001 T.2.3.4" },
  { key: "hoistLoadClass", label: "Kaldırma / Yük Grubu Sınıfı", type: "select", options: HOIST_LOAD_CLASSES, group: "crane", standardRef: "DIN 15018 Tablo 2" },
  { key: "hookType", label: "Kanca / Tutucu Tipi", type: "select", options: HOOK_TYPES, group: "crane", standardRef: "DIN 15400" },
  { key: "controlType", label: "Kumanda Şekli", type: "select", options: CONTROL_TYPES, group: "crane" },

  // --- Vinç konfigürasyonu (hesap bölümlerini açar)
  {
    key: "auxTrolleyMode", label: "Yardımcı Kaldırma Arabası", type: "select",
    options: AUX_TROLLEY_MODES, optionLabels: AUX_TROLLEY_MODE_LABELS,
    group: "config", requiresModule: "aux",
    hint: "Ayrı araba seçilirse bağımsız bir yardımcı araba yürütme bölümü açılır.",
  },
  {
    key: "monorailCount", label: "Monoray Kaldırma Grubu", type: "select",
    options: MONORAIL_COUNTS, optionLabels: MONORAIL_COUNT_LABELS, numeric: true,
    group: "config",
    hint: "Her monoray grubu kendi kaldırma, kanca bloğu ve araba yürütme bölümlerini açar.",
  },

  // --- Ağırlıklar (tüm yürütme ve yapı hesapları buradan okur)
  { key: "mainTrolleyWeightT", label: "Ana Araba Ağırlığı", unit: "t", type: "number", group: "weights" },
  {
    key: "auxTrolleyWeightT", label: "Yardımcı Araba Ağırlığı", unit: "t", type: "number",
    group: "weights", requiresModule: "auxTrolley",
  },
  {
    key: "mono1TrolleyWeightT", label: "Monoray 1 Araba Ağırlığı", unit: "t", type: "number",
    group: "weights", requiresModule: "mono1Trolley",
  },
  {
    key: "mono2TrolleyWeightT", label: "Monoray 2 Araba Ağırlığı", unit: "t", type: "number",
    group: "weights", requiresModule: "mono2Trolley",
  },
  {
    key: "bridgeWeightT", label: "Köprü Ağırlığı", unit: "t", type: "number", group: "weights",
    hint: "Ana kirişler ve başkirişler dâhil köprünün toplam ağırlığı.",
  },

  // --- Ana kaldırma
  { key: "mainCapacityT", label: "Kaldırma Kapasitesi", unit: "ton", type: "number", group: "mainHoist" },
  { key: "mainLiftHeightM", label: "Kaldırma Yüksekliği", unit: "m", type: "number", group: "mainHoist" },
  { key: "mainLiftSpeedMpm", label: "Kaldırma Hızı", unit: "m/dak", type: "number", group: "mainHoist" },
  { key: "hoistMechanismClass", label: "Mekanizma Sınıfı", type: "select", options: MECHANISM_CLASSES, group: "mainHoist", standardRef: "FEM 1.001 T.2.6" },
  { key: "hoistUsageClass", label: "Kullanım Sınıfı", type: "select", options: USAGE_CLASSES, group: "mainHoist", standardRef: "FEM 1.001 T.2.1.3.2" },

  // --- Yardımcı kaldırma (bölüm kapalıysa gizlenir)
  { key: "auxCapacityT", label: "Kaldırma Kapasitesi", unit: "ton", type: "number", group: "auxHoist", requiresModule: "aux" },
  { key: "auxLiftHeightM", label: "Kaldırma Yüksekliği", unit: "m", type: "number", group: "auxHoist", requiresModule: "aux" },
  { key: "auxLiftSpeedMpm", label: "Kaldırma Hızı", unit: "m/dak", type: "number", group: "auxHoist", requiresModule: "aux" },
  {
    key: "auxMechanismClass", label: "Mekanizma Sınıfı", type: "select",
    options: MECHANISM_CLASSES, group: "auxHoist", requiresModule: "aux",
    standardRef: "FEM 1.001 T.2.6",
    hint: "Yardımcı kaldırma bağımsız bir mekanizmadır; boş bırakılırsa ana kaldırmanın sınıfı kullanılır.",
  },
  {
    key: "auxUsageClass", label: "Kullanım Sınıfı", type: "select",
    options: USAGE_CLASSES, group: "auxHoist", requiresModule: "aux",
    standardRef: "FEM 1.001 T.2.1.3.2",
    hint: "Gerekli rulman ömrünü belirler; boş bırakılırsa ana kaldırmanın sınıfı kullanılır.",
  },

  // --- Monoray 1 kaldırma
  { key: "mono1CapacityT", label: "Kaldırma Kapasitesi", unit: "ton", type: "number", group: "mono1Hoist", requiresModule: "mono1" },
  { key: "mono1LiftHeightM", label: "Kaldırma Yüksekliği", unit: "m", type: "number", group: "mono1Hoist", requiresModule: "mono1" },
  { key: "mono1LiftSpeedMpm", label: "Kaldırma Hızı", unit: "m/dak", type: "number", group: "mono1Hoist", requiresModule: "mono1" },
  { key: "mono1MechanismClass", label: "Mekanizma Sınıfı", type: "select", options: MECHANISM_CLASSES, group: "mono1Hoist", requiresModule: "mono1", standardRef: "FEM 1.001 T.2.6" },
  { key: "mono1UsageClass", label: "Kullanım Sınıfı", type: "select", options: USAGE_CLASSES, group: "mono1Hoist", requiresModule: "mono1", standardRef: "FEM 1.001 T.2.1.3.2" },

  // --- Monoray 2 kaldırma
  { key: "mono2CapacityT", label: "Kaldırma Kapasitesi", unit: "ton", type: "number", group: "mono2Hoist", requiresModule: "mono2" },
  { key: "mono2LiftHeightM", label: "Kaldırma Yüksekliği", unit: "m", type: "number", group: "mono2Hoist", requiresModule: "mono2" },
  { key: "mono2LiftSpeedMpm", label: "Kaldırma Hızı", unit: "m/dak", type: "number", group: "mono2Hoist", requiresModule: "mono2" },
  { key: "mono2MechanismClass", label: "Mekanizma Sınıfı", type: "select", options: MECHANISM_CLASSES, group: "mono2Hoist", requiresModule: "mono2", standardRef: "FEM 1.001 T.2.6" },
  { key: "mono2UsageClass", label: "Kullanım Sınıfı", type: "select", options: USAGE_CLASSES, group: "mono2Hoist", requiresModule: "mono2", standardRef: "FEM 1.001 T.2.1.3.2" },

  // --- Ana araba yürütme
  { key: "trolleySpeedMpm", label: "Yürütme Hızı", unit: "m/dak", type: "number", group: "trolley" },
  { key: "trolleyMechanismClass", label: "Mekanizma Sınıfı", type: "select", options: MECHANISM_CLASSES, group: "trolley", standardRef: "FEM 1.001 T.2.6" },
  { key: "trolleyUsageClass", label: "Kullanım Sınıfı", type: "select", options: USAGE_CLASSES, group: "trolley", standardRef: "FEM 1.001 T.2.1.3.2" },

  // --- Yardımcı araba yürütme
  { key: "auxTrolleySpeedMpm", label: "Yürütme Hızı", unit: "m/dak", type: "number", group: "auxTrolley", requiresModule: "auxTrolley" },
  { key: "auxTrolleyMechanismClass", label: "Mekanizma Sınıfı", type: "select", options: MECHANISM_CLASSES, group: "auxTrolley", requiresModule: "auxTrolley", standardRef: "FEM 1.001 T.2.6" },
  { key: "auxTrolleyUsageClass", label: "Kullanım Sınıfı", type: "select", options: USAGE_CLASSES, group: "auxTrolley", requiresModule: "auxTrolley", standardRef: "FEM 1.001 T.2.1.3.2" },

  // --- Monoray araba yürütme
  { key: "mono1TrolleySpeedMpm", label: "Yürütme Hızı", unit: "m/dak", type: "number", group: "mono1Trolley", requiresModule: "mono1Trolley" },
  { key: "mono1TrolleyMechanismClass", label: "Mekanizma Sınıfı", type: "select", options: MECHANISM_CLASSES, group: "mono1Trolley", requiresModule: "mono1Trolley", standardRef: "FEM 1.001 T.2.6" },
  { key: "mono1TrolleyUsageClass", label: "Kullanım Sınıfı", type: "select", options: USAGE_CLASSES, group: "mono1Trolley", requiresModule: "mono1Trolley", standardRef: "FEM 1.001 T.2.1.3.2" },
  { key: "mono2TrolleySpeedMpm", label: "Yürütme Hızı", unit: "m/dak", type: "number", group: "mono2Trolley", requiresModule: "mono2Trolley" },
  { key: "mono2TrolleyMechanismClass", label: "Mekanizma Sınıfı", type: "select", options: MECHANISM_CLASSES, group: "mono2Trolley", requiresModule: "mono2Trolley", standardRef: "FEM 1.001 T.2.6" },
  { key: "mono2TrolleyUsageClass", label: "Kullanım Sınıfı", type: "select", options: USAGE_CLASSES, group: "mono2Trolley", requiresModule: "mono2Trolley", standardRef: "FEM 1.001 T.2.1.3.2" },

  // --- Köprü yürütme
  { key: "bridgeSpeedMpm", label: "Yürütme Hızı", unit: "m/dak", type: "number", group: "bridge" },
  { key: "bridgeMechanismClass", label: "Mekanizma Sınıfı", type: "select", options: MECHANISM_CLASSES, group: "bridge", standardRef: "FEM 1.001 T.2.6" },
  { key: "bridgeUsageClass", label: "Kullanım Sınıfı", type: "select", options: USAGE_CLASSES, group: "bridge", standardRef: "FEM 1.001 T.2.1.3.2" },

  // --- Frenler
  { key: "hoistBrakeType", label: "Kaldırma Freni Tipi", type: "select", options: HOIST_BRAKE_TYPES, group: "brakes" },
  { key: "hoistSafetyBrake", label: "Kaldırma Emniyet Freni", type: "select", options: YES_NO, group: "brakes" },
  { key: "travelBrakeType", label: "Yürütme Freni Tipi", type: "select", options: TRAVEL_BRAKE_TYPES, group: "brakes" },

  // --- Elektrik
  { key: "supplyVoltage", label: "Besleme Gerilimi", type: "select", options: SUPPLY_VOLTAGES, group: "electrical" },
  { key: "controlVoltage", label: "Kumanda Gerilimi", type: "select", options: CONTROL_VOLTAGES, group: "electrical" },

  // --- Ortam
  { key: "ambientTempMinC", label: "Ortam Sıcaklığı (Min)", unit: "°C", type: "select", options: AMBIENT_TEMP_MIN_C, numeric: true, group: "environment" },
  { key: "ambientTempMaxC", label: "Ortam Sıcaklığı (Maks)", unit: "°C", type: "select", options: AMBIENT_TEMP_MAX_C, numeric: true, group: "environment" },
];

export const HOIST_INPUT_FIELDS: FieldDef<HoistInputs>[] = [
  {
    key: "reevingLabel", label: "Halat Donanımı", type: "select",
    options: REEVING_OPTIONS,
    hint: "İlk sayı tahrikli, ikinci sayı toplam halat adedidir; seçim iki alanı da doldurur.",
  },
  { key: "drivenFalls", label: "Tahrikli Halat Sayısı", type: "number" },
  { key: "totalFalls", label: "Toplam Halat Sayısı", type: "number" },
  { key: "sheaveEfficiency", label: "Makara Verimi", type: "number", hint: "Rulmanlı yataklı makara (yüksek verim) standart kabulü." },
  { key: "fixedSheaveCount", label: "Sabit Makara Adedi", type: "number" },
  {
    key: "hookBlockWeightKg", label: "Kanca Bloğu Ağırlığı", unit: "kg", type: "number",
    labelFor: (s) => `${s.hookType} Ağırlığı`,
    hint: "Kaldırma kapasitesinin %10'u olarak türetilir.",
  },
  { key: "ropeWeightKg", label: "Halat Ağırlığı", unit: "kg", type: "number", hint: "Toplam halat sayısı × metre ağırlığı × kaldırma yüksekliği (50 kg'a yuvarlanır)." },
  { key: "drumWallThicknessMm", label: "Tambur Et Kalınlığı", unit: "mm", type: "number" },
  { key: "safetyGrooveCount", label: "Emniyet Sarımı", type: "number" },
  { key: "drumWeightKg", label: "Tambur Ağırlığı (W)", unit: "kg", type: "number" },
  { key: "drumSpanACm", label: "A · Redüktör Mesnedi → Sol Yanak", unit: "cm", type: "number", hint: "Redüktör tarafı moment kolu." },
  { key: "drumSpanBCm", label: "B · Sol Yanak → Yiv Başlangıcı", unit: "cm", type: "number" },
  { key: "drumSpanCCm", label: "C · Sol Yiv Bölgesi", unit: "cm", type: "number" },
  { key: "drumSpanDCm", label: "D · Ortadaki Yivsiz Bölge", unit: "cm", type: "number" },
  { key: "drumSpanECm", label: "E · Sağ Yiv Bölgesi", unit: "cm", type: "number", hint: "Tek helisli tamburda 0 girin." },
  { key: "drumSpanFCm", label: "F · Yiv Sonu → Sağ Yanak", unit: "cm", type: "number" },
  { key: "drumSpanGCm", label: "G · Sağ Yanak → Tambur Yatağı", unit: "cm", type: "number", hint: "Tambur yatağı tarafı moment kolu." },
  { key: "ropeLoadPosition", label: "Halat Yükü Konumu", type: "select", options: ROPE_POSITIONS },
  { key: "shaftD1Cm", label: "D1 · Mil Gerilme Kesiti Çapı", unit: "cm", type: "number" },
  { key: "shaftD2Cm", label: "D2 · Yatak / Rulman Oturma Çapı", unit: "cm", type: "number" },
  { key: "drumWeldThicknessCm", label: "Tambur Kaynak Kalınlığı", unit: "cm", type: "number" },
  { key: "drumWeldAllowable", label: "Tambur Kaynağı İzin Gerilmesi", unit: "MPa", type: "number" },
  { key: "shaftWeldThicknessCm", label: "Mil Kaynak Kalınlığı", unit: "cm", type: "number" },
  { key: "shaftWeldAllowable", label: "Mil Kaynağı İzin Gerilmesi", unit: "MPa", type: "number" },
  { key: "bearingFactorY1", label: "Rulman Eşdeğer Yük Katsayısı (statik)", type: "number" },
  { key: "bearingFactorY2", label: "Rulman Eşdeğer Yük Katsayısı (dinamik)", type: "number" },
  { key: "drumCount", label: "Tambur Adedi", type: "number" },
  { key: "gearboxServiceFactor", label: "Redüktör Emniyet Katsayısı", type: "number" },
  { key: "reducerStages", label: "Redüktör Kademe Sayısı", type: "number" },
  { key: "stageEfficiency", label: "Kademe Verimi", type: "number" },
  { key: "tempFactor", label: "Sıcaklık Faktörü", type: "number" },
  { key: "motorDivisor", label: "Motor Güç Bölücü", type: "number" },
  { key: "brakeServiceFactor", label: "Fren Emniyet Katsayısı", type: "number" },
  { key: "motorCouplingServiceFactor", label: "Motor Kaplini Emniyet Katsayısı", type: "number" },
  { key: "drumCouplingServiceFactor", label: "Tambur Kaplini Emniyet Katsayısı", type: "number" },
];

export const HOIST_SELECTION_FIELDS: FieldDef<HoistSelections>[] = [
  { key: "ropeBrand", label: "Halat Markası", type: "text" },
  { key: "ropeDiaMm", label: "Halat Çapı", unit: "mm", type: "number" },
  { key: "ropeConstruction", label: "Halat Yapısı", type: "text" },
  { key: "ropeCore", label: "Halat Özü", type: "select", options: ROPE_CORE_TYPES },
  { key: "ropeWireStrength", label: "Tel Mukavemeti", unit: "kg/mm²", type: "number" },
  { key: "ropeBreakingLoadKn", label: "Halat Kopma Yükü", unit: "kN", type: "number" },
  { key: "ropeWeightKgPerM", label: "Halat Metre Ağırlığı", unit: "kg/m", type: "number" },
  { key: "drumDiaMm", label: "Tambur Çapı", unit: "mm", type: "select", options: DRUM_DIA_SERIES_MM, numeric: true },
  { key: "drumMaterial", label: "Tambur Malzemesi", type: "select", options: DRUM_MATERIALS },
  { key: "drumGrooveLengthText", label: "Seçilen Oluk Boyu", unit: "mm", type: "text" },
  { key: "shaftMaterial", label: "Mil Malzemesi", type: "select", options: SHAFT_MATERIALS },
  { key: "bearingType", label: "Rulman Tipi", type: "text" },
  { key: "bearingCode", label: "Rulman Kodu", type: "text" },
  { key: "bearingDynCKn", label: "Rulman Dinamik Yük C", unit: "kN", type: "number" },
  { key: "bearingStatC0Kn", label: "Rulman Statik Yük C0", unit: "kN", type: "number" },
  { key: "gearboxModel", label: "Redüktör", type: "text" },
  { key: "gearboxRatio", label: "Çevrim Oranı", type: "number" },
  { key: "gearboxNominalTorqueKnm", label: "Redüktör Nominal Torku", unit: "kNm", type: "number" },
  { key: "gearboxInputShaftMm", label: "Redüktör Giriş Mili", unit: "mm", type: "number" },
  { key: "gearboxOutputShaftMm", label: "Redüktör Çıkış Mili", unit: "mm", type: "number" },
  { key: "gearboxWeightKg", label: "Redüktör Ağırlığı", unit: "kg", type: "number" },
  { key: "gearboxAllowedRadialKn", label: "Redüktör İzinli Radyal Yük", unit: "kN", type: "number" },
  { key: "motorPowerKw", label: "Motor Gücü", unit: "kW", type: "number" },
  { key: "motorRpm", label: "Motor Devri", unit: "d/dak", type: "number" },
  { key: "motorShaftMm", label: "Motor Mili", unit: "mm", type: "number" },
  { key: "motorBrand", label: "Motor Markası", type: "text" },
  { key: "motorCount", label: "Motor Adedi", type: "number" },
  { key: "brakeBrand", label: "Fren Markası", type: "text" },
  { key: "brakeModel", label: "Fren Modeli", type: "text" },
  { key: "brakeTorqueNm", label: "Fren Torku", unit: "Nm", type: "number" },
  { key: "brakeWheelDiaMm", label: "Fren Kasnak Çapı", unit: "mm", type: "number" },
  { key: "brakeQty", label: "Fren Adedi", type: "number" },
  { key: "motorCouplingBrand", label: "Motor Kaplini Markası", type: "text" },
  { key: "motorCouplingModel", label: "Motor Kaplini Modeli", type: "text" },
  { key: "motorCouplingTorqueNm", label: "Motor Kaplini Torku", unit: "Nm", type: "number" },
  { key: "motorCouplingDmaxMm", label: "Motor Kaplini Dmax", unit: "mm", type: "number" },
  { key: "drumCouplingBrand", label: "Tambur Kaplini Markası", type: "text" },
  { key: "drumCouplingModel", label: "Tambur Kaplini Modeli", type: "text" },
  { key: "drumCouplingTorqueNm", label: "Tambur Kaplini Torku", unit: "Nm", type: "number" },
  { key: "drumCouplingRadialN", label: "Tambur Kaplini Radyal Yükü", unit: "N", type: "number" },
  { key: "drumCouplingDmaxMm", label: "Tambur Kaplini Dmax", unit: "mm", type: "number" },
];

/** Otomatik doldurulabilen kaldırma girdileri: alan → anahtar alanı. */
export const HOIST_AUTO_FIELDS: Record<string, keyof HoistInputs & string> = {
  ropeWeightKg: "ropeWeightAuto",
  hookBlockWeightKg: "hookBlockWeightAuto",
  tempFactor: "tempFactorAuto",
};

/**
 * Alanın gösterilecek etiketi. `labelFor` tanımlıysa teknik özelliklere göre
 * çözülür; aksi hâlde sabit `label` kullanılır. Arayüz ve PDF raporu aynı
 * etiketi görsün diye tek kaynak burasıdır.
 */
export function fieldLabel(
  def: { label: string; labelFor?: (specs: TechnicalSpecs) => string },
  specs?: TechnicalSpecs
): string {
  if (specs && def.labelFor) {
    const v = def.labelFor(specs);
    if (v && v.trim() !== "") return v;
  }
  return def.label;
}
