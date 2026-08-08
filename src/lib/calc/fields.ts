// Form alanı metadata'sı — UI formları bu tanımlardan üretilir.
// key'ler motor tiplerinin (TechnicalSpecs, HoistInputs, HoistSelections)
// alan adlarıyla birebir aynıdır.

import { ROPE_POSITION_AUTO, ROPE_POSITIONS } from "./modules/hoistGroup";
import { BUFFER_TECHNICAL_TYPES, BUFFER_TYPE_LABELS } from "./buffer";
import { DRUM_WEIGHT_FORMULA_HINT } from "./derive";
import { COMMON_REEVINGS } from "./reeving";
import {
  BRAKE_ARRANGEMENTS, HYDRAULIC_UNIT_CODES, SAFETY_BRAKE_CODES,
} from "./safety-brake";
import type { HoistInputs, HoistSelections } from "./modules/hoistGroup";
import type { ModuleKey } from "./presentation/module-family";
import {
  HOIST_EQUIPMENT_ARRANGEMENT_LABELS,
  HOIST_EQUIPMENT_ARRANGEMENTS,
  type TechnicalSpecs,
} from "./types";
import {
  AIR_CONDITIONING_TYPE_LABELS,
  AIR_CONDITIONING_TYPE_OPTIONS,
  airConditionerModelOptions,
} from "@/lib/tms-air-conditioning";

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
  /** Teknik özellik seçimlerine göre değişen select seçenekleri. */
  optionsFor?: (specs: TechnicalSpecs) => readonly string[];
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
  /** Teknik özellikteki seçimlere bağlı olarak alanı göster/gizle. */
  visible?: (specs: TechnicalSpecs) => boolean;
  /**
   * Ölçü bir ÇAPTIR — gösterilen değerin başına "Ø" konur ("Ø 400 mm").
   * Etikete yazılmaz; işaret ölçünün kendisine aittir. Arayüz ve PDF aynı
   * bayrağı okur, `withDiameterSign` ile biçimlendirir (tek kaynak).
   */
  diameter?: true;
}

/** Çap işareti — çap ölçülerinin başına konur. */
export const DIAMETER_SIGN = "Ø";

/** `diameter` bayrağı taşıyan alan/satır tanımı. */
export interface DiameterMarked {
  diameter?: true;
}

/**
 * Bir ölçünün gösterim metni: tanım çap işaretliyse başına "Ø" konur.
 * Boş/çizgi değerlere dokunulmaz — "Ø —" anlamsızdır.
 */
export function withDiameterSign(text: string, def?: DiameterMarked): string {
  if (!def?.diameter) return text;
  const t = text.trim();
  if (t === "" || t === "—" || t === "-" || t.startsWith(DIAMETER_SIGN)) return text;
  return `${DIAMETER_SIGN}${t}`;
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
  | "environment"
  | "operatorCabin"
  | "electricalAccommodation"
  | "electricalRoom"
  | "panelType";

export interface SpecGroup {
  key: SpecGroupKey;
  title: string;
  description?: string;
  /** Grup yalnız bu hesap bölümü açıkken gösterilir */
  requiresModule?: ModuleKey;
  /** Teknik özellik seçimine göre grubu göster/gizle. */
  visible?: (specs: TechnicalSpecs) => boolean;
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
    key: "operatorCabin",
    title: "Operatör Kabini",
    description: "Kabin ölçüleri, taş yünü izolasyonu ve klima ön seçimi.",
  },
  {
    key: "electricalAccommodation",
    title: "Elektrik Yerleşimi",
    description: "Elektrik odası veya yan yana pano tipi yerleşim seçilir.",
  },
  {
    key: "electricalRoom",
    title: "Elektrik Odası Özellikleri",
    description: "Oda ölçüleri, izolasyon ve 1+1 kurulu yedek klima seçimi.",
    visible: (specs) => specs.electricalAccommodationType === "room",
  },
  {
    key: "panelType",
    title: "Pano Tipi Özellikleri",
    description: "Yan yana pano yerleşimi; oda izolasyonu yerine pano IP koruması kullanılır.",
    visible: (specs) => specs.electricalAccommodationType === "panel",
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

/** Fren tipleri — hem kaldırma hem yürütme grupları: manyetik / eldro / disk */
export const HOIST_BRAKE_TYPES = ["Manyetik Fren", "Eldro Fren", "Disk Fren"] as const;
export const TRAVEL_BRAKE_TYPES = ["Manyetik Fren", "Eldro Fren", "Disk Fren"] as const;
export const YES_NO = ["Var", "Yok"] as const;

/**
 * Emniyet freni hangi kaldırma gruplarında var? Emniyet freni bir vinç
 * özelliği değil KALDIRMA GRUBU özelliğidir: tamburun üstüne oturur, dolayısıyla
 * her kaldırma grubunda ayrı ayrı bulunabilir. Eski revizyonlar bu alanı
 * "Var"/"Yok" olarak saklar; `hasSafetyBrake` eski değeri "yalnız ana
 * kaldırma" diye yorumlar (bkz. types.ts).
 */
export const SAFETY_BRAKE_SCOPE = [
  "Yok",
  "Ana Kaldırmada",
  "Ana ve Yardımcı Kaldırmada",
] as const;
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

/** Araba ve köprü enerji besleme yöntemleri. Festoon ayrıntısı özel seçim kartında açılır. */
export const TROLLEY_POWER_SUPPLY_OPTIONS = ["festoon", "cableChain"] as const;
export const TROLLEY_POWER_SUPPLY_LABELS: Record<string, string> = {
  festoon: "Feston Sistemi",
  cableChain: "Kablo Zinciri",
};
export const BRIDGE_POWER_SUPPLY_OPTIONS = [
  "festoon", "cableChain", "conductorBar", "cableReel",
] as const;
export const BRIDGE_POWER_SUPPLY_LABELS: Record<string, string> = {
  festoon: "Feston Sistemi",
  cableChain: "Kablo Zinciri",
  conductorBar: "Bara",
  cableReel: "Kablo Sarma Tamburu",
};

/**
 * Emniyet sarımı adedi — tamburda halat ucunun bağlantısından önce kalması
 * gereken tam sarım sayısı. Yarım sarım basamakları da kullanıldığı için liste
 * 0,5 adımlıdır. **Değerler NOKTA ayraçlıdır**: sayısal select'te seçilen değer
 * `parseFloat` ile sayıya çevrilir ve kayıtlı sayı `String(v)` ile listeyle
 * eşleştirilir (1,5 → "1,5" listede bulunamaz, 1.5 → "1.5" bulunur). Türkçe
 * gösterim `SAFETY_GROOVE_COUNT_LABELS` ile verilir.
 */
export const SAFETY_GROOVE_COUNTS = ["1", "1.5", "2", "2.5", "3", "4"] as const;
export const SAFETY_GROOVE_COUNT_LABELS: Record<string, string> = {
  "1": "1",
  "1.5": "1,5",
  "2": "2",
  "2.5": "2,5",
  "3": "3",
  "4": "4",
};

/** Tambur çapı standart serisi [mm] */
export const DRUM_DIA_SERIES_MM = [
  "200", "250", "290", "315", "355", "400", "450", "500", "560", "630", "710", "800",
] as const;

/**
 * Halat yükü konumu seçeneklerinin gösterim etiketleri. Saklanan DEĞER
 * `hoistGroup.ts`teki sabitlerdir ve kayıtlı revizyonlar ona bağlı olduğundan
 * değişmez; burada yalnız kullanıcıya görünen metin sadeleştirilir.
 */
export const ROPE_POSITION_LABELS: Record<string, string> = {
  [ROPE_POSITION_AUTO]: "En Kritik Konum",
};

/** Halat özü seçenekleri — katalog verisiyle uyumlu (FC / IWRC) */
export const ROPE_CORE_TYPES = [
  "Çelik Öz (IWRC)",
  "Elyaf Öz (FC)",
] as const;

// ------------------------------------------------------------ Motor serileri

/**
 * IEC standart motor gücü basamakları [kW] (R20 türevi anma güç serisi).
 * Kaldırma ve yürütme farklı aralık kullanır; liste tek yerde tutulur ki
 * iki grupta farklı basamaklar oluşmasın.
 */
const IEC_MOTOR_POWERS_KW = [
  0.18, 0.25, 0.37, 0.55, 0.75, 1.1, 1.5, 2.2, 3, 4, 5.5, 7.5, 11, 15, 18.5,
  22, 30, 37, 45, 55, 75, 90, 110, 132, 160, 200, 250, 315, 355, 400, 450,
  500, 560, 630, 710, 800, 900, 1000,
] as const;

/** Seçenek değeri nokta ayraçlı ("5.5"), görünen etiket tr-TR ("5,5"). */
function powerOptions(minKw: number, maxKw: number) {
  const list = IEC_MOTOR_POWERS_KW.filter((p) => p >= minKw && p <= maxKw);
  return {
    options: list.map((p) => String(p)),
    optionLabels: Object.fromEntries(
      list.map((p) => [String(p), p.toLocaleString("tr-TR")])
    ) as Record<string, string>,
  };
}

/** Kaldırma motoru güç aralığı: 0,55 … 1000 kW */
export const HOIST_MOTOR_POWERS = powerOptions(0.55, 1000);
/** Yürütme motoru güç aralığı: 0,18 … 355 kW */
export const TRAVEL_MOTOR_POWERS = powerOptions(0.18, 355);

/**
 * Motor anma devirleri [d/dak] — 50 Hz kutup sayılarına karşılık gelir:
 * 8 kutup ≈ 750, 6 kutup ≈ 1000, 4 kutup ≈ 1500, 2 kutup ≈ 3000.
 * Vinç uygulamasında varsayılan 4 kutuplu (1500) motordur.
 */
export const MOTOR_RPM_SERIES = ["750", "1000", "1500", "3000"] as const;
export const MOTOR_RPM_LABELS: Record<string, string> = {
  "750": "750 (8 kutup)",
  "1000": "1.000 (6 kutup)",
  "1500": "1.500 (4 kutup)",
  "3000": "3.000 (2 kutup)",
};
export const DEFAULT_MOTOR_RPM = 1500;

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

export const OPERATOR_CABIN_OPTIONS = ["yes", "no"] as const;
export const OPERATOR_CABIN_LABELS: Record<string, string> = { yes: "Var", no: "Yok" };
export const ELECTRICAL_ACCOMMODATION_OPTIONS = ["none", "room", "panel"] as const;
export const ELECTRICAL_ACCOMMODATION_LABELS: Record<string, string> = {
  none: "Yok", room: "Elektrik Odası", panel: "Pano Tipi",
};
export const ROOM_INSULATION_OPTIONS = ["rockWool50", "rockWool100"] as const;
export const ROOM_INSULATION_LABELS: Record<string, string> = {
  rockWool50: "Taş Yünü 50 mm", rockWool100: "Taş Yünü 100 mm",
};
export const AIR_CONDITIONING_REDUNDANCY_OPTIONS = ["none", "nPlusOne"] as const;
export const AIR_CONDITIONING_REDUNDANCY_LABELS: Record<string, string> = {
  none: "Yok", nPlusOne: "1+1 (Kurulu Yedek)",
};
export const ELECTRICAL_PANEL_IP_CLASSES = ["IP54", "IP55", "IP65"] as const;

export const SPEC_FIELDS: FieldDef<TechnicalSpecs>[] = [
  // --- Vinç tanımı ve sınıflandırma
  { key: "spanM", label: "Açıklık", unit: "m", type: "number", group: "crane" },
  {
    key: "runwayLengthM", label: "Vinç Yürüme Yolu Uzunluğu", unit: "m", type: "number", group: "crane",
    hint: "Köprü festoonu seçildiğinde kablo taşıyıcı sisteminin hareket mesafesi olarak kullanılır.",
  },
  { key: "structureClass", label: "Çelik Konstrüksiyon Sınıfı", type: "select", options: STRUCTURE_CLASSES, group: "crane", standardRef: "FEM 1.001 T.2.3.4" },
  { key: "hoistLoadClass", label: "Kaldırma / Yük Grubu Sınıfı", type: "select", options: HOIST_LOAD_CLASSES, group: "crane", standardRef: "DIN 15018 Tablo 2" },
  { key: "hookType", label: "Kanca Tipi", type: "select", options: HOOK_TYPES, group: "crane", standardRef: "DIN 15400" },
  { key: "controlType", label: "Kumanda Şekli", type: "select", options: CONTROL_TYPES, group: "crane" },

  // --- Operatör kabini
  {
    key: "hasOperatorCabin", label: "Operatör Kabini", type: "select",
    options: OPERATOR_CABIN_OPTIONS, optionLabels: OPERATOR_CABIN_LABELS, group: "operatorCabin",
  },
  { key: "operatorCabinWidthM", label: "Kabin Genişliği", unit: "m", type: "number", group: "operatorCabin", visible: (s) => s.hasOperatorCabin === "yes" },
  { key: "operatorCabinLengthM", label: "Kabin Uzunluğu", unit: "m", type: "number", group: "operatorCabin", visible: (s) => s.hasOperatorCabin === "yes" },
  { key: "operatorCabinHeightM", label: "Kabin Yüksekliği", unit: "m", type: "number", group: "operatorCabin", visible: (s) => s.hasOperatorCabin === "yes" },
  {
    key: "operatorCabinInsulation", label: "Kabin İzolasyonu", type: "select",
    options: ROOM_INSULATION_OPTIONS, optionLabels: ROOM_INSULATION_LABELS, group: "operatorCabin", visible: (s) => s.hasOperatorCabin === "yes",
  },
  {
    key: "operatorCabinAirConditioning", label: "Kabin Kliması", type: "select",
    options: AIR_CONDITIONING_TYPE_OPTIONS, optionLabels: AIR_CONDITIONING_TYPE_LABELS, group: "operatorCabin", visible: (s) => s.hasOperatorCabin === "yes",
  },
  {
    key: "operatorCabinAirConditionerModel", label: "Kabin Klima Tipi", type: "select",
    options: ["Projeye özel seçim"], optionsFor: (s) => airConditionerModelOptions(s.operatorCabinAirConditioning), group: "operatorCabin",
    visible: (s) => s.hasOperatorCabin === "yes" && s.operatorCabinAirConditioning !== "none",
    hint: "TMS tipi, seçilen klima sınıfına uygun olarak proje ısı yüküyle teyit edilir.",
  },

  // --- Elektrik odası / pano tipi
  {
    key: "electricalAccommodationType", label: "Elektrik Yerleşimi", type: "select",
    options: ELECTRICAL_ACCOMMODATION_OPTIONS, optionLabels: ELECTRICAL_ACCOMMODATION_LABELS, group: "electricalAccommodation",
    hint: "Elektrik odası ayrı hacimdir; pano tipinde panolar yan yana dizilir ve oda izolasyonu uygulanmaz.",
  },
  { key: "electricalRoomWidthM", label: "Oda Genişliği", unit: "m", type: "number", group: "electricalRoom", visible: (s) => s.electricalAccommodationType === "room" },
  { key: "electricalRoomLengthM", label: "Oda Uzunluğu", unit: "m", type: "number", group: "electricalRoom", visible: (s) => s.electricalAccommodationType === "room" },
  { key: "electricalRoomHeightM", label: "Oda Yüksekliği", unit: "m", type: "number", group: "electricalRoom", visible: (s) => s.electricalAccommodationType === "room" },
  {
    key: "electricalRoomInsulation", label: "Oda İzolasyonu", type: "select",
    options: ROOM_INSULATION_OPTIONS, optionLabels: ROOM_INSULATION_LABELS, group: "electricalRoom", visible: (s) => s.electricalAccommodationType === "room",
  },
  {
    key: "electricalRoomAirConditioning", label: "Elektrik Odası Kliması", type: "select",
    options: AIR_CONDITIONING_TYPE_OPTIONS, optionLabels: AIR_CONDITIONING_TYPE_LABELS, group: "electricalRoom", visible: (s) => s.electricalAccommodationType === "room",
  },
  {
    key: "electricalRoomAirConditionerModel", label: "Elektrik Odası Klima Tipi", type: "select",
    options: ["Projeye özel seçim"], optionsFor: (s) => airConditionerModelOptions(s.electricalRoomAirConditioning), group: "electricalRoom",
    visible: (s) => s.electricalAccommodationType === "room" && s.electricalRoomAirConditioning !== "none",
  },
  {
    key: "electricalRoomAirConditioningRedundancy", label: "Klima Yedeği", type: "select",
    options: AIR_CONDITIONING_REDUNDANCY_OPTIONS, optionLabels: AIR_CONDITIONING_REDUNDANCY_LABELS, group: "electricalRoom",
    visible: (s) => s.electricalAccommodationType === "room" && s.electricalRoomAirConditioning !== "none",
    hint: "Elektrik odasında kurulu yedek seçimi 1+1 olarak ekipman listesine yansır.",
  },
  { key: "electricalPanelCount", label: "Pano Adedi", unit: "adet", type: "number", group: "panelType", visible: (s) => s.electricalAccommodationType === "panel" },
  {
    key: "electricalPanelIpClass", label: "Pano Koruma Sınıfı", type: "select", options: ELECTRICAL_PANEL_IP_CLASSES, group: "panelType", visible: (s) => s.electricalAccommodationType === "panel",
    hint: "Pano tipi yerleşimde oda izolasyonu yoktur; pano gövdesinin IP koruması belirtilir.",
  },
  {
    key: "electricalPanelAirConditioning", label: "Pano Kliması", type: "select",
    options: AIR_CONDITIONING_TYPE_OPTIONS, optionLabels: AIR_CONDITIONING_TYPE_LABELS, group: "panelType", visible: (s) => s.electricalAccommodationType === "panel",
  },
  {
    key: "electricalPanelAirConditionerModel", label: "Pano Klima Tipi", type: "select",
    options: ["Projeye özel seçim"], optionsFor: (s) => airConditionerModelOptions(s.electricalPanelAirConditioning), group: "panelType",
    visible: (s) => s.electricalAccommodationType === "panel" && s.electricalPanelAirConditioning !== "none",
  },
  {
    key: "electricalPanelAirConditioningRedundancy", label: "Klima Yedeği", type: "select",
    options: AIR_CONDITIONING_REDUNDANCY_OPTIONS, optionLabels: AIR_CONDITIONING_REDUNDANCY_LABELS, group: "panelType",
    visible: (s) => s.electricalAccommodationType === "panel" && s.electricalPanelAirConditioning !== "none",
  },

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
  {
    key: "mainHoistEquipmentArrangement", label: "Kaldırma Donanımı", type: "select",
    options: HOIST_EQUIPMENT_ARRANGEMENTS, optionLabels: HOIST_EQUIPMENT_ARRANGEMENT_LABELS,
    group: "mainHoist", hint: "İkiz donanım, hesapları değiştirmez; ekipman listesinde hazır ekipman adetlerini iki katına çıkarır.",
  },
  { key: "mainLiftHeightM", label: "Kaldırma Yüksekliği", unit: "m", type: "number", group: "mainHoist" },
  { key: "mainLiftSpeedMpm", label: "Kaldırma Hızı", unit: "m/dak", type: "number", group: "mainHoist" },
  { key: "hoistMechanismClass", label: "Ana Kaldırma Mekanizma Sınıfı", type: "select", options: MECHANISM_CLASSES, group: "mainHoist", standardRef: "FEM 1.001 T.2.6" },
  { key: "hoistUsageClass", label: "Ana Kaldırma Kullanım Sınıfı", type: "select", options: USAGE_CLASSES, group: "mainHoist", standardRef: "FEM 1.001 T.2.1.3.2" },

  // --- Yardımcı kaldırma (bölüm kapalıysa gizlenir)
  { key: "auxCapacityT", label: "Kaldırma Kapasitesi", unit: "ton", type: "number", group: "auxHoist", requiresModule: "aux" },
  {
    key: "auxHoistEquipmentArrangement", label: "Kaldırma Donanımı", type: "select",
    options: HOIST_EQUIPMENT_ARRANGEMENTS, optionLabels: HOIST_EQUIPMENT_ARRANGEMENT_LABELS,
    group: "auxHoist", requiresModule: "aux", hint: "İkiz donanım, hesapları değiştirmez; ekipman listesinde hazır ekipman adetlerini iki katına çıkarır.",
  },
  { key: "auxLiftHeightM", label: "Kaldırma Yüksekliği", unit: "m", type: "number", group: "auxHoist", requiresModule: "aux" },
  { key: "auxLiftSpeedMpm", label: "Kaldırma Hızı", unit: "m/dak", type: "number", group: "auxHoist", requiresModule: "aux" },
  {
    key: "auxMechanismClass", label: "Yardımcı Kaldırma Mekanizma Sınıfı", type: "select",
    options: MECHANISM_CLASSES, group: "auxHoist", requiresModule: "aux",
    standardRef: "FEM 1.001 T.2.6",
    hint: "Yardımcı kaldırma bağımsız bir mekanizmadır; boş bırakılırsa ana kaldırmanın sınıfı kullanılır.",
  },
  {
    key: "auxUsageClass", label: "Yardımcı Kaldırma Kullanım Sınıfı", type: "select",
    options: USAGE_CLASSES, group: "auxHoist", requiresModule: "aux",
    standardRef: "FEM 1.001 T.2.1.3.2",
    hint: "Gerekli rulman ömrünü belirler; boş bırakılırsa ana kaldırmanın sınıfı kullanılır.",
  },

  // --- Monoray 1 kaldırma
  { key: "mono1CapacityT", label: "Kaldırma Kapasitesi", unit: "ton", type: "number", group: "mono1Hoist", requiresModule: "mono1" },
  {
    key: "mono1HoistEquipmentArrangement", label: "Kaldırma Donanımı", type: "select",
    options: HOIST_EQUIPMENT_ARRANGEMENTS, optionLabels: HOIST_EQUIPMENT_ARRANGEMENT_LABELS,
    group: "mono1Hoist", requiresModule: "mono1", hint: "İkiz donanım, hesapları değiştirmez; ekipman listesinde hazır ekipman adetlerini iki katına çıkarır.",
  },
  { key: "mono1LiftHeightM", label: "Kaldırma Yüksekliği", unit: "m", type: "number", group: "mono1Hoist", requiresModule: "mono1" },
  { key: "mono1LiftSpeedMpm", label: "Kaldırma Hızı", unit: "m/dak", type: "number", group: "mono1Hoist", requiresModule: "mono1" },
  { key: "mono1MechanismClass", label: "Monoray 1 Kaldırma Mekanizma Sınıfı", type: "select", options: MECHANISM_CLASSES, group: "mono1Hoist", requiresModule: "mono1", standardRef: "FEM 1.001 T.2.6" },
  { key: "mono1UsageClass", label: "Monoray 1 Kaldırma Kullanım Sınıfı", type: "select", options: USAGE_CLASSES, group: "mono1Hoist", requiresModule: "mono1", standardRef: "FEM 1.001 T.2.1.3.2" },

  // --- Monoray 2 kaldırma
  { key: "mono2CapacityT", label: "Kaldırma Kapasitesi", unit: "ton", type: "number", group: "mono2Hoist", requiresModule: "mono2" },
  {
    key: "mono2HoistEquipmentArrangement", label: "Kaldırma Donanımı", type: "select",
    options: HOIST_EQUIPMENT_ARRANGEMENTS, optionLabels: HOIST_EQUIPMENT_ARRANGEMENT_LABELS,
    group: "mono2Hoist", requiresModule: "mono2", hint: "İkiz donanım, hesapları değiştirmez; ekipman listesinde hazır ekipman adetlerini iki katına çıkarır.",
  },
  { key: "mono2LiftHeightM", label: "Kaldırma Yüksekliği", unit: "m", type: "number", group: "mono2Hoist", requiresModule: "mono2" },
  { key: "mono2LiftSpeedMpm", label: "Kaldırma Hızı", unit: "m/dak", type: "number", group: "mono2Hoist", requiresModule: "mono2" },
  { key: "mono2MechanismClass", label: "Monoray 2 Kaldırma Mekanizma Sınıfı", type: "select", options: MECHANISM_CLASSES, group: "mono2Hoist", requiresModule: "mono2", standardRef: "FEM 1.001 T.2.6" },
  { key: "mono2UsageClass", label: "Monoray 2 Kaldırma Kullanım Sınıfı", type: "select", options: USAGE_CLASSES, group: "mono2Hoist", requiresModule: "mono2", standardRef: "FEM 1.001 T.2.1.3.2" },

  // --- Ana araba yürütme
  { key: "trolleySpeedMpm", label: "Ana Araba Yürütme Hızı", unit: "m/dak", type: "number", group: "trolley" },
  { key: "trolleyMechanismClass", label: "Ana Araba Yürütme Mekanizma Sınıfı", type: "select", options: MECHANISM_CLASSES, group: "trolley", standardRef: "FEM 1.001 T.2.6" },
  { key: "trolleyUsageClass", label: "Ana Araba Yürütme Kullanım Sınıfı", type: "select", options: USAGE_CLASSES, group: "trolley", standardRef: "FEM 1.001 T.2.1.3.2" },
  {
    key: "trolleyPowerSupply", label: "Ana Araba Enerji Besleme Sistemi", type: "select",
    options: TROLLEY_POWER_SUPPLY_OPTIONS, optionLabels: TROLLEY_POWER_SUPPLY_LABELS, group: "trolley",
    hint: "Araba için Feston veya kablo zinciri seçilir. Feston seçildiğinde aşağıda tip ve adet açılır.",
  },

  // --- Yardımcı araba yürütme
  { key: "auxTrolleySpeedMpm", label: "Yardımcı Araba Yürütme Hızı", unit: "m/dak", type: "number", group: "auxTrolley", requiresModule: "auxTrolley" },
  { key: "auxTrolleyMechanismClass", label: "Yardımcı Araba Yürütme Mekanizma Sınıfı", type: "select", options: MECHANISM_CLASSES, group: "auxTrolley", requiresModule: "auxTrolley", standardRef: "FEM 1.001 T.2.6" },
  { key: "auxTrolleyUsageClass", label: "Yardımcı Araba Yürütme Kullanım Sınıfı", type: "select", options: USAGE_CLASSES, group: "auxTrolley", requiresModule: "auxTrolley", standardRef: "FEM 1.001 T.2.1.3.2" },
  {
    key: "auxTrolleyPowerSupply", label: "Yardımcı Araba Enerji Besleme Sistemi", type: "select",
    options: TROLLEY_POWER_SUPPLY_OPTIONS, optionLabels: TROLLEY_POWER_SUPPLY_LABELS,
    group: "auxTrolley", requiresModule: "auxTrolley",
  },

  // --- Monoray araba yürütme
  { key: "mono1TrolleySpeedMpm", label: "Monoray 1 Araba Yürütme Hızı", unit: "m/dak", type: "number", group: "mono1Trolley", requiresModule: "mono1Trolley" },
  { key: "mono1TrolleyMechanismClass", label: "Monoray 1 Araba Yürütme Mekanizma Sınıfı", type: "select", options: MECHANISM_CLASSES, group: "mono1Trolley", requiresModule: "mono1Trolley", standardRef: "FEM 1.001 T.2.6" },
  { key: "mono1TrolleyUsageClass", label: "Monoray 1 Araba Yürütme Kullanım Sınıfı", type: "select", options: USAGE_CLASSES, group: "mono1Trolley", requiresModule: "mono1Trolley", standardRef: "FEM 1.001 T.2.1.3.2" },
  {
    key: "mono1TrolleyPowerSupply", label: "Monoray 1 Araba Enerji Besleme Sistemi", type: "select",
    options: TROLLEY_POWER_SUPPLY_OPTIONS, optionLabels: TROLLEY_POWER_SUPPLY_LABELS,
    group: "mono1Trolley", requiresModule: "mono1Trolley",
  },
  { key: "mono2TrolleySpeedMpm", label: "Monoray 2 Araba Yürütme Hızı", unit: "m/dak", type: "number", group: "mono2Trolley", requiresModule: "mono2Trolley" },
  { key: "mono2TrolleyMechanismClass", label: "Monoray 2 Araba Yürütme Mekanizma Sınıfı", type: "select", options: MECHANISM_CLASSES, group: "mono2Trolley", requiresModule: "mono2Trolley", standardRef: "FEM 1.001 T.2.6" },
  { key: "mono2TrolleyUsageClass", label: "Monoray 2 Araba Yürütme Kullanım Sınıfı", type: "select", options: USAGE_CLASSES, group: "mono2Trolley", requiresModule: "mono2Trolley", standardRef: "FEM 1.001 T.2.1.3.2" },
  {
    key: "mono2TrolleyPowerSupply", label: "Monoray 2 Araba Enerji Besleme Sistemi", type: "select",
    options: TROLLEY_POWER_SUPPLY_OPTIONS, optionLabels: TROLLEY_POWER_SUPPLY_LABELS,
    group: "mono2Trolley", requiresModule: "mono2Trolley",
  },

  {
    key: "trolleyBufferType", label: "Araba Tampon Tipi", type: "select",
    options: BUFFER_TECHNICAL_TYPES, optionLabels: BUFFER_TYPE_LABELS, group: "trolley",
    hint:
      "Seçime göre 5.8 Tampon bölümü açılır ve ilgili hesap dalı koşar. " +
      "Hidrolik tamponda tam strok ve η = 0,85 ile kapalı çözüm; kauçuk " +
      "ve hücresel poliüretan tamponlarda katalog alt türü seçilir. Tüm araba " +
      "grupları (ana, yardımcı, monoray) bu seçimi paylaşır.",
  },
  {
    key: "trolleyBufferImpactSpeedPct", label: "Araba Çarpma Hızı Oranı", unit: "%",
    type: "number", group: "trolley", standardRef: "FEM 1.001 2.2.3.4.1",
    hint:
      "v_ç = anma hızı × bu oran. FEM 1.001 md. 2.2.3.4.1 cihaz için %70 verir; " +
      "arabada varsayılan %100 muhafazakâr firma kabulüdür.",
  },

  // --- Köprü yürütme
  { key: "bridgeSpeedMpm", label: "Köprü Yürütme Hızı", unit: "m/dak", type: "number", group: "bridge" },
  { key: "bridgeMechanismClass", label: "Köprü Yürütme Mekanizma Sınıfı", type: "select", options: MECHANISM_CLASSES, group: "bridge", standardRef: "FEM 1.001 T.2.6" },
  { key: "bridgeUsageClass", label: "Köprü Yürütme Kullanım Sınıfı", type: "select", options: USAGE_CLASSES, group: "bridge", standardRef: "FEM 1.001 T.2.1.3.2" },
  {
    key: "bridgePowerSupply", label: "Köprü Enerji Besleme Sistemi", type: "select",
    options: BRIDGE_POWER_SUPPLY_OPTIONS, optionLabels: BRIDGE_POWER_SUPPLY_LABELS, group: "bridge",
    hint: "Köprü için Feston, kablo zinciri, bara veya kablo sarma tamburu seçilir.",
  },
  {
    key: "bridgeBufferType", label: "Köprü Tampon Tipi", type: "select",
    options: BUFFER_TECHNICAL_TYPES, optionLabels: BUFFER_TYPE_LABELS, group: "bridge",
    hint:
      "Seçime göre 6.9 Tampon bölümü açılır. Kauçuk seçiminde katalogdan " +
      "kauçuk veya hücresel poliüretan alt türü seçilebilir.",
  },
  {
    key: "bridgeBufferImpactSpeedPct", label: "Köprü Çarpma Hızı Oranı", unit: "%",
    type: "number", group: "bridge", standardRef: "FEM 1.001 2.2.3.4.1",
    hint:
      "v_ç = anma hızı × bu oran. Köprüde FEM 1.001 md. 2.2.3.4.1'in verdiği " +
      "%70 varsayılandır.",
  },

  // --- Frenler
  { key: "hoistBrakeType", label: "Kaldırma Freni Tipi", type: "select", options: HOIST_BRAKE_TYPES, group: "brakes" },
  { key: "hoistSafetyBrake", label: "Kaldırma Emniyet Freni", type: "select", options: SAFETY_BRAKE_SCOPE, group: "brakes",
    hint: "Emniyet freni tamburun üstüne oturur; hangi kaldırma gruplarında bulunacağı burada seçilir. Seçilen gruplara \"Emniyet Freni\" hesap bölümü eklenir." },
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
  {
    key: "sheaveEfficiency", label: "Makara Verimi", type: "number",
    hint:
      "Otomatik: ORION makaraları istisnasız rulmanlı yataklanır; η_m = 0,985 " +
      "sabit firma kabulüdür (CMAA 70 T.5.2.9.1.1.1-1'in rulmanlı yatak değeri " +
      "0,99'un biraz altında, imalat toleransı payıyla).",
  },
  { key: "fixedSheaveCount", label: "Sabit Makara Adedi", type: "number" },
  {
    key: "hookBlockWeightKg", label: "Kanca Bloğu Ağırlığı", unit: "kg", type: "number",
    labelFor: (s) => `${s.hookType} Ağırlığı`,
    hint: "Kaldırma kapasitesinin %10'u olarak türetilir.",
  },
  { key: "ropeWeightKg", label: "Halat Ağırlığı", unit: "kg", type: "number", hint: "Toplam halat sayısı × metre ağırlığı × kaldırma yüksekliği (50 kg'a yuvarlanır)." },
  { key: "drumWallThicknessMm", label: "Tambur Yiv Dibi Et Kalınlığı", unit: "mm", type: "number" },
  {
    key: "safetyGrooveCount", label: "Emniyet Sarımı", type: "select",
    options: SAFETY_GROOVE_COUNTS, optionLabels: SAFETY_GROOVE_COUNT_LABELS, numeric: true,
    hint: "Halat ucu bağlantısından önce tamburda kalması gereken sarım sayısı.",
  },
  {
    key: "drumWeightKg", label: "Tambur Ağırlığı (W)", unit: "kg", type: "number",
    hint: DRUM_WEIGHT_FORMULA_HINT,
  },
  // Tambur mili ölçü zinciri: teknik resimden okunduğu gibi mm sorulur.
  { key: "drumSpanAMm", label: "A · Redüktör Mesnedi → Sol Yanak", unit: "mm", type: "number", hint: "Redüktör tarafı moment kolu." },
  { key: "drumSpanBMm", label: "B · Sol Yanak → Yiv Başlangıcı", unit: "mm", type: "number" },
  { key: "drumSpanCMm", label: "C · Sol Yiv Bölgesi", unit: "mm", type: "number" },
  { key: "drumSpanDMm", label: "D · Ortadaki Yivsiz Bölge", unit: "mm", type: "number" },
  { key: "drumSpanEMm", label: "E · Sağ Yiv Bölgesi", unit: "mm", type: "number", hint: "Tek helisli tamburda 0 girin." },
  { key: "drumSpanFMm", label: "F · Yiv Sonu → Sağ Yanak", unit: "mm", type: "number" },
  { key: "drumSpanGMm", label: "G · Sağ Yanak → Tambur Yatağı", unit: "mm", type: "number", hint: "Tambur yatağı tarafı moment kolu." },
  {
    // Seçenek DEĞERLERİ değişmez (kayıtlı revizyonlar bunlara bağlıdır); yalnız
    // gösterim etiketi sadeleştirilir. `optionLabels` hem sihirbazda hem PDF
    // raporunda (FieldTable) uygulanır.
    key: "ropeLoadPosition", label: "Halat Yükü Konumu", type: "select",
    options: ROPE_POSITIONS, optionLabels: ROPE_POSITION_LABELS,
  },
  { key: "shaftD1Mm", label: "D1 · Mil Gerilme Kesiti Çapı", unit: "mm", type: "number", diameter: true },
  { key: "shaftD2Mm", label: "D2 · Yatak / Rulman Oturma Çapı", unit: "mm", type: "number", diameter: true },
  { key: "drumWeldThicknessMm", label: "Tambur Kaynak Kalınlığı", unit: "mm", type: "number" },
  { key: "drumWeldAllowable", label: "Tambur Kaynağı İzin Gerilmesi", unit: "MPa", type: "number" },
  { key: "shaftWeldThicknessMm", label: "Mil Kaynak Kalınlığı", unit: "mm", type: "number" },
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
  {
    key: "safetyBrakeServiceFactor", label: "Emniyet Freni Emniyet Katsayısı", type: "number",
    hint: "Emniyet freninin sağlaması istenen, tamburdaki statik yük momentine göre kat sayısı.",
  },
  {
    key: "safetyBrakeFlangeClearanceMm", label: "Flanş Montaj Payı", unit: "mm", type: "number",
    hint: "Katalogun geometrik alt sınırının üstüne eklenen pay; kaliper gövdesinin rahat oturması için.",
  },
];

export const HOIST_SELECTION_FIELDS: FieldDef<HoistSelections>[] = [
  { key: "ropeBrand", label: "Halat Markası", type: "text" },
  { key: "ropeDiaMm", label: "Halat Çapı", unit: "mm", type: "number", diameter: true },
  { key: "ropeConstruction", label: "Halat Yapısı", type: "text" },
  { key: "ropeCore", label: "Halat Özü", type: "select", options: ROPE_CORE_TYPES },
  { key: "ropeWireStrength", label: "Tel Mukavemeti", unit: "kg/mm²", type: "number" },
  { key: "ropeBreakingLoadKn", label: "Halat Kopma Yükü", unit: "kN", type: "number" },
  { key: "ropeWeightKgPerM", label: "Halat Metre Ağırlığı", unit: "kg/m", type: "number" },
  { key: "drumDiaMm", label: "Tambur Çapı", unit: "mm", type: "select", options: DRUM_DIA_SERIES_MM, numeric: true, diameter: true },
  { key: "drumMaterial", label: "Tambur Malzemesi", type: "select", options: DRUM_MATERIALS },
  {
    key: "drumGrooveLengthText", label: "Yiv Boyu", unit: "mm", type: "text",
    hint:
      "Otomatik: <tahrikli halat sayısı> x <gerekli yiv boyu>. Boy yukarı " +
      "yuvarlanır (1 m altında 10 mm, üstünde 50 mm adımla) — yiv boyu " +
      "yetmezse halat tambura sığmaz.",
  },
  { key: "shaftMaterial", label: "Mil Malzemesi", type: "select", options: SHAFT_MATERIALS },
  { key: "bearingType", label: "Rulman Tipi", type: "text" },
  { key: "bearingCode", label: "Rulman Kodu", type: "text" },
  { key: "bearingDynCKn", label: "Rulman Dinamik Yük C", unit: "kN", type: "number" },
  { key: "bearingStatC0Kn", label: "Rulman Statik Yük C0", unit: "kN", type: "number" },
  { key: "bearingHousingBrand", label: "Tambur Yatağı Markası", type: "text" },
  { key: "bearingHousingCode", label: "Tambur Yatağı Kodu", type: "text" },
  { key: "bearingHousingSeries", label: "Tambur Yatağı Serisi", type: "text" },
  { key: "bearingHousingCompatibleBearing", label: "Uyumlu Rulman", type: "text" },
  { key: "bearingHousingBoreMm", label: "Yatak Rulman İç Çapı", unit: "mm", type: "number", diameter: true },
  { key: "bearingHousingWidthMm", label: "Yatak Genişliği A₂", unit: "mm", type: "number" },
  { key: "bearingHousingSeatType", label: "Yataklama Tipi", type: "text" },
  { key: "gearboxModel", label: "Redüktör", type: "text" },
  { key: "gearboxRatio", label: "Çevrim Oranı", type: "number" },
  { key: "gearboxNominalTorqueKnm", label: "Redüktör Nominal Torku", unit: "kNm", type: "number" },
  { key: "gearboxInputShaftMm", label: "Redüktör Giriş Mili", unit: "mm", type: "number", diameter: true },
  { key: "gearboxOutputShaftMm", label: "Redüktör Çıkış Mili", unit: "mm", type: "number", diameter: true },
  { key: "gearboxWeightKg", label: "Redüktör Ağırlığı", unit: "kg", type: "number" },
  { key: "gearboxAllowedRadialKn", label: "Redüktör İzinli Radyal Yük", unit: "kN", type: "number" },
  {
    key: "motorPowerKw", label: "Motor Gücü", unit: "kW", type: "select",
    options: HOIST_MOTOR_POWERS.options, optionLabels: HOIST_MOTOR_POWERS.optionLabels,
    numeric: true,
  },
  {
    // Katalog GERÇEK yüklü devri verir (1465, 1470, 1475 …) ve bu değer doğrudan
    // hesaba girer (çevrim oranı, gerçekleşen kaldırma hızı, gerekli güç).
    // Anma devri listesi (750/1000/1500/3000) gerçeği temsil etmediği ve
    // katalogdan gelen devri açılır listeye sığdıramadığı için alan SERBEST
    // SAYIDIR. `MOTOR_RPM_SERIES` / `MOTOR_RPM_LABELS` anma devri sözlüğü
    // olarak dışa verilmeye devam eder (silinmedi); alan tanımı artık okumaz.
    key: "motorRpm", label: "Motor Devri", unit: "d/dak", type: "number",
    hint: "Katalogdan gelen gerçek yüklü devir (anma devri değil).",
  },
  { key: "motorShaftMm", label: "Motor Mili", unit: "mm", type: "number", diameter: true },
  { key: "motorBrand", label: "Motor Markası", type: "text" },
  { key: "motorCount", label: "Motor Adedi", type: "number" },
  { key: "brakeBrand", label: "Fren Markası", type: "text" },
  { key: "brakeModel", label: "Fren Modeli", type: "text" },
  { key: "brakeTorqueNm", label: "Fren Torku", unit: "Nm", type: "number" },
  { key: "brakeWheelDiaMm", label: "Fren Kasnak Çapı", unit: "mm", type: "number", diameter: true },
  { key: "brakeQty", label: "Fren Adedi", type: "number" },
  { key: "motorCouplingBrand", label: "Motor Kaplini Markası", type: "text" },
  { key: "motorCouplingModel", label: "Motor Kaplini Modeli", type: "text" },
  { key: "motorCouplingTorqueNm", label: "Motor Kaplini Torku", unit: "Nm", type: "number" },
  { key: "motorCouplingDmaxMm", label: "Motor Kaplini Dmax", unit: "mm", type: "number", diameter: true },
  { key: "drumCouplingBrand", label: "Tambur Kaplini Markası", type: "text" },
  { key: "drumCouplingModel", label: "Tambur Kaplini Modeli", type: "text" },
  { key: "drumCouplingTorqueNm", label: "Tambur Kaplini Torku", unit: "Nm", type: "number" },
  { key: "drumCouplingRadialN", label: "Tambur Kaplini Radyal Yükü", unit: "N", type: "number" },
  { key: "drumCouplingDmaxMm", label: "Tambur Kaplini Dmax", unit: "mm", type: "number", diameter: true },
  {
    key: "safetyBrakeModel", label: "Emniyet Freni Modeli", type: "select",
    options: SAFETY_BRAKE_CODES, standardRef: "SIBRE SHI",
  },
  {
    key: "safetyBrakeAirGapMm", label: "Fren Boşluğu c", unit: "mm", type: "select",
    options: ["1", "2", "3"], numeric: true, standardRef: "SIBRE SHI",
    hint: "Balata ile disk arasındaki ayar boşluğu (katalogda \"air gap\"). Boşluk büyüdükçe yay sıkma kuvveti FA düşer.",
  },
  {
    key: "safetyBrakeArrangement", label: "Fren Yerleşimi", type: "select",
    options: BRAKE_ARRANGEMENTS,
    hint: "Tambur üzerindeki kaliper düzeni (A…F); kaliper adedini ve şemadaki açısal konumları belirler.",
  },
  {
    key: "safetyBrakeFlangeDiaMm", label: "Flanş Dış Çapı", unit: "mm", type: "number", diameter: true,
    hint: "Fren diski olarak kullanılan tambur flanşının dış çapı.",
  },
  {
    key: "safetyBrakeFlangeThicknessMm", label: "Seçilen Flanş Kalınlığı", unit: "mm",
    type: "select", options: ["20", "25", "30", "35", "40"], numeric: true,
    standardRef: "SIBRE SHI",
    hint: "Fren diski olarak kullanılan flanşın kalınlığı b. Katalogun istediği en küçük değerin altına inilemez.",
  },
  {
    key: "safetyBrakeHydraulicUnit", label: "Hidrolik Güç Ünitesi", type: "select",
    options: HYDRAULIC_UNIT_CODES, standardRef: "SIBRE SHI",
    hint: "Kaliper fren yayla kapanır, hidrolikle açılır. V2 kompakt ünitedir (≤50 çevrim/saat, en çok iki fren); H-SF 3 (V3) yüksek çevrim içindir. Boş bırakılırsa katalogun seçim tablosundan önerilen ünite kullanılır.",
  },
];

/** Otomatik doldurulabilen kaldırma girdileri: alan → anahtar alanı. */
export const HOIST_AUTO_FIELDS: Record<string, keyof HoistInputs & string> = {
  ropeWeightKg: "ropeWeightAuto",
  hookBlockWeightKg: "hookBlockWeightAuto",
  tempFactor: "tempFactorAuto",
  sheaveEfficiency: "sheaveEfficiencyAuto",
  drumWeightKg: "drumWeightAuto",
};

/**
 * Otomatik doldurulabilen kaldırma KATALOG SEÇİMİ alanları: alan → anahtar.
 *
 * Anahtar yine GİRDİLERDE durur (`HoistInputs`), çünkü `revision-load.ts`teki
 * AUTO_FLAGS koruması yalnız girdi nesnesine bakar; türetilen değer ise
 * seçimlere yazılır.
 */
export const HOIST_AUTO_SELECTION_FIELDS: Record<string, keyof HoistInputs & string> = {
  drumGrooveLengthText: "drumGrooveLengthAuto",
};

/**
 * Otomatik doldurulabilen YÜRÜTME girdileri — kaldırma tarafıyla aynı
 * mekanizma: anahtar açıkken alan salt-okunurdur ve türetilen değer girdiye
 * yazılır (motor, PDF ve Excel aynı sayıyı görür).
 */
export const TRAVEL_AUTO_FIELDS: Record<string, string> = {
  tempFactor: "tempFactorAuto",
  applicationClass: "travelApplicationClassAuto",
  serviceFactorKs: "serviceFactorKsAuto",
  accelTorqueFactorKt: "accelTorqueFactorKtAuto",
};

/**
 * Otomatik doldurulabilen ANA KİRİŞ girdileri (7.2 Yükler / 7.3 Yükleme
 * Durumları). Bu üç kutu eskiden "(Elle)" etiketiyle boş isteniyordu; artık
 * türetilen değerle dolar ve anahtar kapatılınca elle düzeltilebilir.
 */
export const GIRDER_AUTO_FIELDS: Record<string, string> = {
  psiHAOverride: "psiHAAuto",
  psiHKOverride: "psiHKAuto",
  amplifyYcOverride: "amplifyYcAuto",
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
