// Teklif hesap raporu ↔ yapay zekâ aracı dosyası.
//
// Dosya bir hesap SONUCU taşımaz. Proje künyesini (müşteri, rapor firması,
// imza sorumluları dâhil), kullanıcı girdilerini, katalog/seçim snapshot'ını
// ve ağırlık dökümündeki insan kararlarını taşır; içe aktarımda sonuçlar
// güncel hesap motoruyla yeniden üretilir. Böylece yerel bir AI agent'ın
// yazdığı JSON, uygulamaya eski ya da uydurulmuş hesap sonuçları sokamaz.
//
// KAPSAM KURALI (kullanıcı kararı, 04.09.2026): dosya, editörün bildiği HER
// alanı taşır ve içe aktarım bu alanların hepsini kabul eder. "Bilinen alan"
// ikinci bir elle yazılmış listeden değil, kodun zaten taşıdığı kayıtlardan
// okunur: yeni iş şablonu (`loadRevision(null, null)`), alan tanımları
// (`SPEC_FIELDS`, `*_INPUT_FIELDS`, `*_SELECTION_FIELDS`), otomatik anahtar
// defterleri (`*_AUTO_FIELDS`, rulman markası bağı) ve katalog eşlemeleri
// (`catalog-mapping`). Yalnız şablona bakan eski aktarım, şablonda bulunmayan
// alanları SESSİZCE düşürüyordu — mono/yardımcı araba teknik özellikleri,
// feston, motor/redüktör katalog seçenekleri, kiriş katsayı ezmeleri ve
// ağırlık dökümü kararları hep bu yüzden kayboluyordu. Tip ile bu kayıtların
// bir daha ayrışmaması `offer-report-transfer.coverage.test.ts` ile kilitlidir.

import { z } from "zod";
import { runCalc, type CalcInput, type CalcResult } from "@/lib/calc/engine";
import {
  CABIN_AUTO_FIELDS,
  GIRDER_AUTO_FIELDS,
  HOIST_AUTO_FIELDS,
  HOIST_AUTO_SELECTION_FIELDS,
  HOIST_INPUT_FIELDS,
  HOIST_SELECTION_FIELDS,
  HOOKBLOCK_AUTO_SELECTION_FIELDS,
  SPEC_FIELDS,
  TRAVEL_AUTO_FIELDS,
  TRAVEL_AUTO_SELECTION_FIELDS,
  type FieldDef,
} from "@/lib/calc/fields";
import {
  HOOKBLOCK_INPUT_FIELDS,
  HOOKBLOCK_SELECTION_FIELDS,
} from "@/lib/calc/presentation/hookBlockFields";
import {
  TRAVEL_INPUT_FIELDS,
  TRAVEL_SELECTION_FIELDS,
} from "@/lib/calc/presentation/travelFields";
import {
  BUCKLING_EXTRA_FIELDS,
  BUCKLING_PANEL_FIELDS,
  ENDCARRIAGE_INPUT_FIELDS,
  ENDCARRIAGE_SELECTION_FIELDS,
  GIRDER_INPUT_FIELDS,
  GIRDER_SELECTION_FIELDS,
} from "@/lib/calc/presentation/structuralFields";
import {
  WHEELLOAD_AUTO_FIELDS,
  WHEELLOAD_AUTO_SELECTION_FIELDS,
  WHEELLOAD_INPUT_FIELDS,
  WHEELLOAD_SELECTION_FIELDS,
} from "@/lib/calc/presentation/wheelLoadFields";
import {
  CABIN_INPUT_FIELDS,
  CABIN_SELECTION_FIELDS,
} from "@/lib/calc/presentation/cabinFields";
import { bearingBrandFields } from "@/lib/calc/bearing-brand";
import { catalogSelectionFields } from "@/lib/catalog-mapping";
import {
  MODULE_ORDER,
  REQUIRED_MODULE_KEYS,
  moduleFamily,
  type ModuleFamily,
  type ModuleKey,
} from "@/lib/calc/presentation/module-family";
import {
  CALC_FIELD,
  altsFromRevision,
  calcInputFromRevision,
  hiddenDiagramsFromRevision,
  hiddenSectionsFromRevision,
  loadRevision,
  sectionNotesFromRevision,
  weightBreakdownFromRevision,
  type RevisionInputsJson,
  type RevisionSelectionsJson,
  type RevisionWeightBreakdown,
} from "@/lib/revision-load";
import {
  GROUND_CRANE_TYPE,
  OFFER_CRANE_TYPES,
  applyCraneTypeRevisionPreset,
} from "@/lib/crane-types";
import { AGIRLIK_SERBEST_ON_EKI, AGIRLIK_SERBEST_SINIRI } from "@/lib/weights/types";

export const OFFER_REPORT_TRANSFER_FORMAT = "orion-offer-calculation-report";

/**
 * Sürüm 2 (04.09.2026): proje künyesi (müşteri, rapor firması, imza
 * sorumluları), ağırlık dökümü kararları ve tam alan kapsamı. Sürüm 1
 * dosyaları okunmaya devam eder — yeni alanlar isteğe bağlıdır.
 */
export const OFFER_REPORT_TRANSFER_VERSION = 2;
type AcceptedFormatVersion = 1 | 2;

/** Server Action varsayılan 1 MB sınırının altında bilinçli pay. */
export const OFFER_REPORT_TRANSFER_MAX_BYTES = 900_000;

const MAX_JSON_DEPTH = 14;
// Alan rehberi bütün bölümleri ve seçenek listelerini taşıdığından düğüm
// sayısı büyüktür; sınır dosyanın kendi boyutuna (900 KB) göre bol bırakılır.
const MAX_JSON_NODES = 250_000;
const FORBIDDEN_KEYS = new Set(["__proto__", "prototype", "constructor"]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Teknik özelliklerde artık YAŞAMAYAN, yalnız eski kayıtların göçü için tipte
 * duran anahtarlar. Feston verisi yürütme bölümlerine, kabin/elektrik odası
 * ölçüleri kabin bölümüne taşındı (`revision-load.migrateFestoon` /
 * `migrateCabin`). Dosyaya yazılmazlar: AI eski ve yeni yerini birlikte görüp
 * hangisinin geçerli olduğunu tahmin etmek zorunda kalmasın.
 */
export const LEGACY_SPEC_KEYS: readonly string[] = [
  "trolleyFestoon",
  "auxTrolleyFestoon",
  "mono1TrolleyFestoon",
  "mono2TrolleyFestoon",
  "bridgeFestoon",
  "showFestoonDetailsInReport",
  "operatorCabinWidthM",
  "operatorCabinLengthM",
  "operatorCabinHeightM",
  "operatorCabinWidthM_legacy",
  "operatorCabinInsulation",
  "operatorCabinAirConditioning",
  "operatorCabinAirConditionerModel",
  "electricalRoomWidthM",
  "electricalRoomLengthM",
  "electricalRoomHeightM",
  "electricalRoomInsulation",
  "electricalRoomAirConditioning",
  "electricalRoomAirConditionerModel",
  "electricalRoomAirConditioningRedundancy",
  "electricalPanelCount",
  "electricalPanelIpClass",
  "electricalPanelAirConditioning",
  "electricalPanelAirConditionerModel",
  "electricalPanelAirConditioningRedundancy",
];

// --------------------------------------------------------------------- şema

const transferCompanySchema = z.object({
  id: z.string().trim().max(80).optional(),
  name: z.string().trim().max(500).default(""),
  shortName: z.string().trim().max(120).default(""),
  address: z.string().trim().max(1_000).default(""),
  taxOffice: z.string().trim().max(240).default(""),
  taxNo: z.string().trim().max(60).default(""),
  phone: z.string().trim().max(120).default(""),
  fax: z.string().trim().max(120).default(""),
  email: z.string().trim().max(240).default(""),
  web: z.string().trim().max(240).default(""),
});

const transferSignatoriesSchema = z.object({
  preparedBy: z.string().trim().max(120).default(""),
  checkedBy: z.string().trim().max(120).default(""),
});

const transferProjectSchema = z.object({
  documentNo: z.string().trim().min(1, "Doküman no gerekli").max(160),
  name: z.string().trim().min(1, "Rapor / vinç adı gerekli").max(500),
  // Müşteri adı boş bırakılabilir: son kullanıcı kaydının adı devreye girer
  // (`normalizeProject`). İkisi de boşsa açık hata verilir.
  customer: z.string().trim().max(500).default(""),
  craneType: z.string().trim().min(1, "Vinç tipi gerekli").max(240),
  craneLocation: z.string().trim().max(240).default(""),
  endCustomer: transferCompanySchema.nullable().optional(),
  reportBrand: transferCompanySchema.nullable().optional(),
  issuer: transferCompanySchema.nullable().optional(),
  signatories: transferSignatoriesSchema.optional(),
});

const jsonRecordSchema = z.record(z.string(), z.unknown());

const transferFileSchema = z.object({
  format: z.literal(OFFER_REPORT_TRANSFER_FORMAT),
  formatVersion: z.union([z.literal(1), z.literal(2)]),
  instructions: z.array(z.string().max(2_000)).max(40).optional(),
  source: z
    .object({
      documentNo: z.string().max(160),
      revisionNo: z.number().int().min(0),
      engineVersion: z.string().max(160),
      exportedAt: z.string().max(80),
    })
    .optional(),
  project: transferProjectSchema,
  revision: z
    .object({
      inputs: jsonRecordSchema,
      selections: jsonRecordSchema,
    })
    .strict(),
  reviewNotes: z.array(z.string().trim().min(1).max(1_000)).max(100).default([]),
  // Alan rehberi insan/AI içindir. İçe aktarım bu bölüme güvenmez;
  // güncel kodun kendi tipleri ve hesap motoru son sözü söyler.
  fieldGuide: z.array(z.unknown()).max(8_000).optional(),
});

// -------------------------------------------------------------------- tipler

/** Firma defteri kaydının dosyaya yazılan künyesi. Bilinmeyen alan BOŞ metindir. */
export interface OfferReportTransferCompany {
  /**
   * Defter kaydının kimliği — AYNI veritabanında birebir eşleşme ipucu.
   * Dosya kurumlar arasında taşınabilir kalsın diye eşleşmenin esası addır;
   * kimlik bulunamazsa ad denenir.
   */
  id?: string;
  name: string;
  shortName: string;
  address: string;
  taxOffice: string;
  taxNo: string;
  phone: string;
  fax: string;
  email: string;
  web: string;
}

export interface OfferReportTransferSignatories {
  /** Kapaktaki "Hazırlayan" — BİLGİ; içe aktarımda dosyayı yükleyen kullanıcı olur. */
  preparedBy: string;
  /** Kapaktaki "Kontrol Eden" — serbest metin olarak yeni projeye yazılır. */
  checkedBy: string;
}

export interface OfferReportTransferProject {
  documentNo: string;
  name: string;
  /** Serbest metin müşteri adı (kayıtta BÜYÜK HARF). */
  customer: string;
  craneType: string;
  craneLocation: string;
  /** Son kullanıcı firma (kapak logosu + künye) — defterden; yoksa null. */
  endCustomer: OfferReportTransferCompany | null;
  /** Raporu kendi adıyla sunan firma — defterden; null = raporu ORION sunar. */
  reportBrand: OfferReportTransferCompany | null;
  /** Raporu üreten firma (bizim kaydımız, `customers.is_self`) — BİLGİ. */
  issuer: OfferReportTransferCompany | null;
  signatories: OfferReportTransferSignatories;
}

export interface OfferReportTransferSource {
  documentNo: string;
  revisionNo: number;
  engineVersion: string;
  exportedAt: string;
}

export interface OfferReportTransferFieldGuide {
  path: string;
  label: string;
  valueType: "number" | "text" | "select" | "multiselect" | "boolean" | "list" | "object";
  unit?: string;
  options?: (string | number)[];
  optionLabels?: Record<string, string>;
  hint?: string;
  /**
   * `katalog`: katalog satırından gelir, elle uydurulmaz · `otomatik`: motor
   * türetir · `bilgi`: yalnız okunur, içe aktarım yazmaz.
   */
  source?: "katalog" | "otomatik" | "bilgi";
}

export interface OfferReportTransferFile {
  format: typeof OFFER_REPORT_TRANSFER_FORMAT;
  formatVersion: AcceptedFormatVersion;
  instructions: string[];
  source: OfferReportTransferSource;
  project: OfferReportTransferProject;
  revision: {
    inputs: Record<string, unknown>;
    selections: Record<string, unknown>;
  };
  reviewNotes: string[];
  fieldGuide: OfferReportTransferFieldGuide[];
}

export interface ParsedOfferReportTransfer {
  project: OfferReportTransferProject;
  inputs: RevisionInputsJson;
  selections: RevisionSelectionsJson;
  results: CalcResult;
  reviewNotes: string[];
  source?: OfferReportTransferSource;
}

export class OfferReportTransferError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OfferReportTransferError";
  }
}

// ------------------------------------------------------------ JSON güvenliği

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * JSON.parse kod çalıştırmaz; fakat sonradan spread edilen `__proto__` gibi
 * anahtarlar nesne davranışını değiştirebilir. Dosya daha şemaya gelmeden
 * derinlik, düğüm sayısı ve tehlikeli anahtarlar bakımından sınırlanır.
 */
function assertSafeJson(value: unknown): void {
  let nodes = 0;
  const visit = (current: unknown, depth: number) => {
    nodes += 1;
    if (nodes > MAX_JSON_NODES) {
      throw new OfferReportTransferError("Dosya izin verilen veri miktarını aşıyor.");
    }
    if (depth > MAX_JSON_DEPTH) {
      throw new OfferReportTransferError("Dosyadaki veri yapısı fazla derin.");
    }
    if (typeof current === "number" && !Number.isFinite(current)) {
      throw new OfferReportTransferError("Dosyada sonlu olmayan bir sayı var.");
    }
    if (typeof current === "string" && current.length > 20_000) {
      throw new OfferReportTransferError("Dosyada izin verilenden uzun bir metin var.");
    }
    if (Array.isArray(current)) {
      for (const item of current) visit(item, depth + 1);
      return;
    }
    if (!isPlainObject(current)) return;
    for (const [key, item] of Object.entries(current)) {
      if (FORBIDDEN_KEYS.has(key)) {
        throw new OfferReportTransferError(`Dosyada kullanılamayan anahtar var: ${key}`);
      }
      visit(item, depth + 1);
    }
  };
  visit(value, 0);
}

/** Dışa aktarılan dosyanın düğüm sayısı — testler sınıra payı buradan ölçer. */
export function countJsonNodes(value: unknown): number {
  let nodes = 0;
  const visit = (current: unknown) => {
    nodes += 1;
    if (Array.isArray(current)) {
      for (const item of current) visit(item);
    } else if (isPlainObject(current)) {
      for (const item of Object.values(current)) visit(item);
    }
  };
  visit(value);
  return nodes;
}

function jsonClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

// ------------------------------------------------------- alan tanımı köprüsü

interface TransferFieldDef {
  key: string;
  label: string;
  labelFor?: (specs: CalcInput["specs"]) => string;
  unit?: string;
  type: "number" | "text" | "select" | "multiselect";
  options?: readonly (string | number)[];
  optionsFor?: (specs: CalcInput["specs"]) => readonly (string | number)[];
  optionsFrom?: (source: Record<string, unknown>) => readonly (string | number)[];
  optionLabels?: Record<string, string>;
  numeric?: boolean;
  hint?: string;
}

function transferDefs<T>(fields: readonly FieldDef<T>[]): readonly TransferFieldDef[] {
  return fields as unknown as readonly TransferFieldDef[];
}

function defsForModule(key: ModuleKey): {
  inputs: readonly TransferFieldDef[];
  selections: readonly TransferFieldDef[];
} {
  switch (moduleFamily(key)) {
    case "hoist":
      return {
        inputs: transferDefs(HOIST_INPUT_FIELDS),
        selections: transferDefs(HOIST_SELECTION_FIELDS),
      };
    case "hookBlock":
      return {
        inputs: transferDefs(HOOKBLOCK_INPUT_FIELDS),
        selections: transferDefs(HOOKBLOCK_SELECTION_FIELDS),
      };
    case "travel":
      return {
        inputs: transferDefs(TRAVEL_INPUT_FIELDS),
        selections: transferDefs(TRAVEL_SELECTION_FIELDS),
      };
    case "wheelLoads":
      return {
        inputs: transferDefs(WHEELLOAD_INPUT_FIELDS),
        selections: transferDefs(WHEELLOAD_SELECTION_FIELDS),
      };
    case "girder":
      return {
        inputs: transferDefs(GIRDER_INPUT_FIELDS),
        selections: transferDefs(GIRDER_SELECTION_FIELDS),
      };
    case "buckling":
      return {
        inputs: [
          ...transferDefs(BUCKLING_PANEL_FIELDS),
          ...transferDefs(BUCKLING_EXTRA_FIELDS),
        ],
        selections: [],
      };
    case "endCarriage":
      return {
        inputs: transferDefs(ENDCARRIAGE_INPUT_FIELDS),
        selections: transferDefs(ENDCARRIAGE_SELECTION_FIELDS),
      };
    case "cabin":
      return {
        inputs: transferDefs(CABIN_INPUT_FIELDS),
        selections: transferDefs(CABIN_SELECTION_FIELDS),
      };
  }
}

function isBucklingPanelKey(key: string): boolean {
  return BUCKLING_PANEL_FIELDS.some((item) => item.key === key);
}

/**
 * Otomatik türetme anahtarları: hedef alan → girdi nesnesindeki `*Auto`
 * anahtarı. Kaynak, editörün kullandığı defterlerdir; burada yalnız aileye
 * göre toplanır.
 */
function autoFlagMapForModule(key: ModuleKey): Record<string, string> {
  const out: Record<string, string> = {};
  const add = (registry: Record<string, string>) => {
    for (const [target, flag] of Object.entries(registry)) out[target] = flag;
  };
  switch (moduleFamily(key)) {
    case "hoist":
      add(HOIST_AUTO_FIELDS);
      add(HOIST_AUTO_SELECTION_FIELDS);
      // Kaynak emniyet gerilmeleri: anahtar `HoistInputs.weldAllowableAuto`,
      // defterde değil modülün kendisindedir (hoistGroup.ts).
      out.drumWeldAllowable = "weldAllowableAuto";
      out.shaftWeldAllowable = "weldAllowableAuto";
      break;
    case "hookBlock":
      add(HOOKBLOCK_AUTO_SELECTION_FIELDS);
      break;
    case "travel":
      add(TRAVEL_AUTO_FIELDS);
      add(TRAVEL_AUTO_SELECTION_FIELDS);
      break;
    case "wheelLoads":
      add(WHEELLOAD_AUTO_FIELDS);
      add(WHEELLOAD_AUTO_SELECTION_FIELDS);
      break;
    case "girder":
      add(GIRDER_AUTO_FIELDS);
      break;
    case "cabin":
      add(CABIN_AUTO_FIELDS);
      break;
    default:
      break;
  }
  for (const field of bearingBrandFields(key)) out[field.selection] = field.flag;
  return out;
}

type OptionalKind = "number" | "text" | "boolean" | "json";

/**
 * Alan tanımı ya da katalog eşlemesi olmayan, tipte var olan anahtarlar.
 * Küçük ve gerekçeli bir liste: ölçü doğrulama kutucukları ve editörün
 * görsel düzenleyicilerinin yazdığı ölçüler. Kapsam testi listeyi tipe karşı
 * sınar; yeni bir anahtar tipe girip buraya girmezse test düşer.
 */
const EXTRA_INPUT_KEYS: Partial<Record<ModuleFamily, Record<string, OptionalKind>>> = {
  hookBlock: {
    shaftEdgeGapMm: "number",
    shaftSheavePitchMm: "number",
    shaftCenterGapMm: "number",
  },
  girder: { loadMeasurementsConfirmed: "boolean" },
  wheelLoads: { measurementsConfirmed: "boolean" },
};

const EXTRA_SELECTION_KEYS: Partial<Record<ModuleFamily, Record<string, OptionalKind>>> = {
  hoist: { sheaveBearingKind: "text" },
  travel: { gearboxShaftDirection: "text" },
};

/** Alan tanımı dışındaki bilinen anahtarların Türkçe etiketleri (rehber için). */
const EXTRA_KEY_LABELS: Record<string, { label: string; unit?: string; hint?: string }> = {
  shaftEdgeGapMm: { label: "Kanca Mili Kenar Boşluğu", unit: "mm", hint: "Görsel mil düzenleyicisinden yazılır." },
  shaftSheavePitchMm: { label: "Kanca Mili Makara Adımı", unit: "mm", hint: "Görsel mil düzenleyicisinden yazılır." },
  shaftCenterGapMm: { label: "Kanca Mili Orta Boşluğu", unit: "mm", hint: "Görsel mil düzenleyicisinden yazılır." },
  loadMeasurementsConfirmed: {
    label: "Yük Ölçüleri Doğrulandı",
    hint: "Mühendisin 7.2 yük ölçülerini gözden geçirdiğini işaretler; şartnameden değer yazdıysan false bırak.",
  },
  measurementsConfirmed: {
    label: "Teker Ölçüleri Doğrulandı",
    hint: "Mühendisin teker düzeni ölçülerini gözden geçirdiğini işaretler; şartnameden değer yazdıysan false bırak.",
  },
  sheaveBearingKind: { label: "Makara Yataklama Türü", hint: "Halat katalog satırından gelir." },
  gearboxShaftDirection: { label: "Redüktör Çıkış Mili Yönü", hint: "Redüktör katalog satırından gelir." },
  drumCouplingDivisor: { label: "Tambur Kaplini Tork Bölen Katsayısı", hint: "Uygulama tarafından yönetilir; değiştirme." },
  motorCalcCount: { label: "Gücün Bölüşüldüğü Motor Adedi", hint: "Uygulama tarafından yönetilir; değiştirme." },
  roomPanelWidthsText: {
    label: "Elektrik Odası Pano Genişlikleri",
    hint: "Pano yerleşim düzenleyicisinden yazılır; mm değerleri \"; \" ile ayrılır.",
  },
  hookCapacityKg: { label: "Kanca Taşıma Kapasitesi", unit: "kg", hint: "DIN 15400 tablosundan kanca no + malzeme sınıfına göre gelir; elle yazma." },
  couplingMotorShaftMm: { label: "Kaplin Tarafı Motor Mil Çapı", unit: "mm", hint: "Arabada motor katalog satırından gelir." },
  autoFromGirder: { label: "Panel Ölçüleri Ana Kirişten", hint: "true iken buruşma panel ölçüleri ve kenar gerilmeleri ana kiriş bölümünden türetilir." },
};

function kindOfDef(def: TransferFieldDef): OptionalKind {
  if (def.type === "number") return "number";
  if (def.type === "select" && def.numeric) return "number";
  if (
    def.type === "select" &&
    def.options &&
    def.options.length > 0 &&
    def.options.every((option) => typeof option === "number")
  ) {
    return "number";
  }
  return "text";
}

/**
 * Katalog eşlemesinin yazdığı ama alan tanımı olmayan anahtarların tipi ad
 * sonekinden okunur — bu kod tabanında birim soneki tutarlıdır (`…Kg`,
 * `…Mm`, `…Kn`). Eğri ve iğne listeleri JSON dizisidir.
 */
function kindOfKey(key: string): OptionalKind {
  if (/(Curve|Pins|Points)$/.test(key)) return "json";
  if (/(Kg|Mm|Kn|Knm|Nm|Rpm|Mpm|Kw|Kj|Pct|Count|Qty|Ratio|Nmm2|M2|T|M|C)$/.test(key)) {
    return "number";
  }
  return "text";
}

// ------------------------------------------------------- şablon + isteğe bağlı

/**
 * Şablon nesnesine iliştirilen İSTEĞE BAĞLI anahtar defteri. Sembol anahtar
 * `Object.entries`e ve `JSON.stringify`a görünmez: zorunlu alan akışı olduğu
 * gibi kalır, isteğe bağlı alan yalnız adayda VARSA tipiyle doğrulanıp alınır.
 */
const OPTIONAL_KEYS: unique symbol = Symbol("transferOptionalKeys");

interface OptionalTemplate {
  [OPTIONAL_KEYS]?: Record<string, OptionalKind>;
}

function attachOptional(
  template: Record<string, unknown>,
  optional: Record<string, OptionalKind>
): void {
  const known = Object.keys(template);
  const filtered: Record<string, OptionalKind> = {};
  for (const [key, kind] of Object.entries(optional)) {
    if (!known.includes(key)) filtered[key] = kind;
  }
  Object.defineProperty(template, OPTIONAL_KEYS, {
    value: filtered,
    enumerable: false,
    configurable: true,
    writable: true,
  });
}

function optionalKeysOf(template: unknown): Record<string, OptionalKind> {
  if (!template || typeof template !== "object") return {};
  return (template as OptionalTemplate)[OPTIONAL_KEYS] ?? {};
}

interface ModuleTemplate {
  inputs: Record<string, unknown>;
  selections: Record<string, unknown> | null;
}

function moduleTemplateOf(
  calcInput: CalcInput,
  key: ModuleKey
): ModuleTemplate | null {
  const source = calcInput as unknown as Record<
    string,
    { inputs?: unknown; selections?: unknown } | undefined
  >;
  const state = source[CALC_FIELD[key]];
  if (!state || !isPlainObject(state.inputs)) return null;
  return {
    inputs: state.inputs,
    selections: isPlainObject(state.selections) ? state.selections : null,
  };
}

/** Bölümün isteğe bağlı anahtarları — alan tanımları + otomatik anahtarlar + katalog + ek liste. */
function optionalKeysForModule(key: ModuleKey): {
  inputs: Record<string, OptionalKind>;
  selections: Record<string, OptionalKind>;
} {
  const family = moduleFamily(key);
  const defs = defsForModule(key);
  const inputs: Record<string, OptionalKind> = {};
  const selections: Record<string, OptionalKind> = {};

  for (const def of defs.inputs) {
    // Buruşma panel alanları kökte değil `side`/`top` altında yaşar ve şablon
    // onları zaten taşır.
    if (family === "buckling" && isBucklingPanelKey(def.key)) continue;
    inputs[def.key] = kindOfDef(def);
  }
  for (const flag of new Set(Object.values(autoFlagMapForModule(key)))) inputs[flag] = "boolean";
  for (const [extra, kind] of Object.entries(EXTRA_INPUT_KEYS[family] ?? {})) inputs[extra] = kind;

  for (const def of defs.selections) selections[def.key] = kindOfDef(def);
  for (const field of catalogSelectionFields(key)) {
    if (!(field.sel in selections)) selections[field.sel] = kindOfKey(field.sel);
  }
  for (const [extra, kind] of Object.entries(EXTRA_SELECTION_KEYS[family] ?? {})) {
    selections[extra] = kind;
  }
  return { inputs, selections };
}

function specOptionalKeys(): Record<string, OptionalKind> {
  const out: Record<string, OptionalKind> = {};
  for (const def of transferDefs(SPEC_FIELDS)) out[def.key] = kindOfDef(def);
  return out;
}

// ------------------------------------------------------------ snapshot kurma

function omitKeys(
  source: Record<string, unknown>,
  keys: readonly string[]
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(source)) {
    if (!keys.includes(key)) out[key] = value;
  }
  return out;
}

function inputSnapshotFromCalcInput(
  calcInput: CalcInput,
  disabledModules: readonly string[],
  hiddenSections: readonly string[],
  hiddenDiagrams: readonly string[],
  weightBreakdown: RevisionWeightBreakdown
): Record<string, unknown> {
  const out: Record<string, unknown> = {
    specs: omitKeys(calcInput.specs as unknown as Record<string, unknown>, LEGACY_SPEC_KEYS),
  };
  for (const key of MODULE_ORDER) {
    out[CALC_FIELD[key]] = moduleTemplateOf(calcInput, key)?.inputs ?? null;
  }
  out.disabledModules = [...disabledModules];
  out.hiddenSections = [...hiddenSections];
  out.hiddenDiagrams = [...hiddenDiagrams];
  // `applied` bir İZDİR (hangi ağırlık ne zaman teknik özelliğe yazıldı);
  // yeni raporun kendi yazma olayı olmadan taşınması yanlış bir rozet
  // üretirdi. Kararlar (ezme, not, serbest satır, ayak yüksekliği) taşınır.
  out.weightBreakdown = omitKeys(weightBreakdown as Record<string, unknown>, ["applied"]);
  return jsonClone(out);
}

function selectionSnapshotFromCalcInput(
  calcInput: CalcInput,
  selections: RevisionSelectionsJson | null | undefined
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of MODULE_ORDER) {
    out[CALC_FIELD[key]] = moduleTemplateOf(calcInput, key)?.selections ?? null;
  }
  out.alts = altsFromRevision(selections);
  out.sectionNotes = sectionNotesFromRevision(selections);
  return jsonClone(out);
}

/**
 * Güncel kodun kabul ettiği eksiksiz şablon: yeni iş varsayılanları +
 * isteğe bağlı bilinen anahtarlar. İçe aktarım tipi bununla sınırlanır.
 */
function baselineSnapshot(): {
  inputs: Record<string, unknown>;
  selections: Record<string, unknown>;
} {
  const loaded = loadRevision(null, null);
  const inputs = inputSnapshotFromCalcInput(loaded.full, loaded.disabled, [], [], {});
  const selections = selectionSnapshotFromCalcInput(loaded.full, null);
  // Ağırlık dökümü kararları ve kontrol listeleri genel eşlemeden değil kendi
  // güvenli okuyucularından geçer (`canonicalizeRevision`).
  delete inputs.weightBreakdown;

  attachOptional(inputs.specs as Record<string, unknown>, specOptionalKeys());
  for (const key of MODULE_ORDER) {
    const field = CALC_FIELD[key];
    const optional = optionalKeysForModule(key);
    if (isPlainObject(inputs[field])) attachOptional(inputs[field], optional.inputs);
    if (isPlainObject(selections[field])) attachOptional(selections[field], optional.selections);
  }
  return { inputs, selections };
}

/**
 * İçe aktarımın kabul ettiği bütün anahtarlar (zorunlu + isteğe bağlı) —
 * kapsam testi bunu tiplerle karşılaştırır.
 */
export function transferAcceptedKeys(): {
  specs: string[];
  inputs: string[];
  selections: string[];
  modules: Record<string, { inputs: string[]; selections: string[] }>;
} {
  const baseline = baselineSnapshot();
  const keysOf = (template: unknown): string[] =>
    isPlainObject(template)
      ? [...Object.keys(template), ...Object.keys(optionalKeysOf(template))]
      : [];
  const modules: Record<string, { inputs: string[]; selections: string[] }> = {};
  for (const key of MODULE_ORDER) {
    const field = CALC_FIELD[key];
    modules[field] = {
      inputs: keysOf(baseline.inputs[field]),
      selections: keysOf(baseline.selections[field]),
    };
  }
  return {
    specs: keysOf(baseline.inputs.specs),
    inputs: [...Object.keys(baseline.inputs), "weightBreakdown"],
    selections: Object.keys(baseline.selections),
    modules,
  };
}

// -------------------------------------------------------------- temizleme

function typeName(value: unknown): string {
  if (Array.isArray(value)) return "dizi";
  if (value === null) return "boş";
  if (typeof value === "number") return "sayı";
  if (typeof value === "string") return "metin";
  if (typeof value === "boolean") return "doğru/yanlış";
  if (typeof value === "object") return "nesne";
  return typeof value;
}

function sanitizeOptional(kind: OptionalKind, candidate: unknown, path: string): unknown {
  switch (kind) {
    case "number":
      if (typeof candidate !== "number" || !Number.isFinite(candidate)) {
        throw new OfferReportTransferError(
          `${path} alanı sayı olmalı; ${typeName(candidate)} geldi.`
        );
      }
      return candidate;
    case "text":
      if (typeof candidate !== "string") {
        throw new OfferReportTransferError(
          `${path} alanı metin olmalı; ${typeName(candidate)} geldi.`
        );
      }
      return candidate;
    case "boolean":
      if (typeof candidate !== "boolean") {
        throw new OfferReportTransferError(
          `${path} alanı doğru/yanlış olmalı; ${typeName(candidate)} geldi.`
        );
      }
      return candidate;
    case "json":
      // Güvenlik denetiminden (derinlik, düğüm, yasak anahtar) geçmiş JSON.
      return jsonClone(candidate);
  }
}

/**
 * Aday snapshot'ı, güncel şablonun anahtarları ve ilkel tipleriyle keser.
 * Bilinmeyen anahtarlar sessizce DB'ye taşınmaz; bilinen bir alanın yanlış
 * tipi ise sessiz varsayılana düşmez, dosya yolu ile birlikte açık hata olur.
 * Şablona iliştirilmiş isteğe bağlı anahtarlar yalnız adayda varsa alınır —
 * yokken şablondan uydurma bir varsayılan (`0`, `""`) yazılmaz.
 */
function sanitizeLike(template: unknown, candidate: unknown, path: string): unknown {
  if (candidate === undefined) return jsonClone(template);
  if (template === null) {
    if (
      candidate === null ||
      typeof candidate === "string" ||
      typeof candidate === "boolean" ||
      (typeof candidate === "number" && Number.isFinite(candidate))
    ) {
      return candidate;
    }
    throw new OfferReportTransferError(`${path} alanının veri tipi geçersiz.`);
  }
  if (typeof template === "number") {
    if (typeof candidate !== "number" || !Number.isFinite(candidate)) {
      throw new OfferReportTransferError(
        `${path} alanı sayı olmalı; ${typeName(candidate)} geldi.`
      );
    }
    return candidate;
  }
  if (typeof template === "string") {
    if (typeof candidate !== "string") {
      throw new OfferReportTransferError(
        `${path} alanı metin olmalı; ${typeName(candidate)} geldi.`
      );
    }
    return candidate;
  }
  if (typeof template === "boolean") {
    if (typeof candidate !== "boolean") {
      throw new OfferReportTransferError(
        `${path} alanı doğru/yanlış olmalı; ${typeName(candidate)} geldi.`
      );
    }
    return candidate;
  }
  if (Array.isArray(template)) {
    if (!Array.isArray(candidate)) {
      throw new OfferReportTransferError(`${path} alanı dizi olmalı.`);
    }
    // Boş şablon dizisinde eleman tipi yoktur; güvenlik denetiminden geçmiş
    // JSON aynen alınır. Dolu dizide her eleman ilk örneğin tipiyle sınırlanır.
    if (template.length === 0) return jsonClone(candidate);
    return candidate.map((item, index) =>
      sanitizeLike(template[0], item, `${path}[${index}]`)
    );
  }
  if (isPlainObject(template)) {
    if (!isPlainObject(candidate)) {
      throw new OfferReportTransferError(`${path} alanı nesne olmalı.`);
    }
    const out: Record<string, unknown> = {};
    for (const [key, templateValue] of Object.entries(template)) {
      out[key] = sanitizeLike(templateValue, candidate[key], `${path}.${key}`);
    }
    for (const [key, kind] of Object.entries(optionalKeysOf(template))) {
      if (key in out) continue;
      const value = candidate[key];
      if (value === undefined || value === null) continue;
      out[key] = sanitizeOptional(kind, value, `${path}.${key}`);
    }
    return out;
  }
  return jsonClone(template);
}

function validModuleKeys(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const allowed = new Set<string>(MODULE_ORDER);
  return [
    ...new Set(
      raw.filter((value): value is string => typeof value === "string" && allowed.has(value))
    ),
  ];
}

function validSectionKeys(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const modules = new Set<string>(MODULE_ORDER);
  const result = new Set<string>();
  for (const value of raw) {
    if (typeof value !== "string" || value.length > 120) continue;
    const dash = value.indexOf("-");
    if (dash <= 0 || !modules.has(value.slice(0, dash)) || dash === value.length - 1) continue;
    result.add(value);
  }
  return [...result];
}

function sanitizePartialObject(
  template: Record<string, unknown>,
  candidate: unknown,
  path: string
): Record<string, unknown> {
  if (!isPlainObject(candidate)) return {};
  const optional = optionalKeysOf(template);
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(candidate)) {
    if (key in template) {
      out[key] = sanitizeLike(template[key], value, `${path}.${key}`);
    } else if (key in optional && value !== null && value !== undefined) {
      out[key] = sanitizeOptional(optional[key], value, `${path}.${key}`);
    }
  }
  return out;
}

function sanitizeAlternatives(
  raw: unknown,
  selectionBaseline: Record<string, unknown>
): Record<string, { active: number; options: Record<string, unknown>[] }> {
  if (!isPlainObject(raw)) return {};
  const result: Record<string, { active: number; options: Record<string, unknown>[] }> = {};
  for (const [sectionKey, state] of Object.entries(raw).slice(0, 200)) {
    if (!isPlainObject(state) || !Array.isArray(state.options) || state.options.length === 0) continue;
    const dash = sectionKey.indexOf("-");
    const moduleKey = sectionKey.slice(0, dash) as ModuleKey;
    if (dash <= 0 || !MODULE_ORDER.includes(moduleKey)) continue;
    const field = CALC_FIELD[moduleKey];
    const template = selectionBaseline[field];
    if (!isPlainObject(template)) continue;
    const options = state.options
      .slice(0, 3)
      .map((option, index) =>
        sanitizePartialObject(template, option, `revision.selections.alts.${sectionKey}[${index}]`)
      )
      .filter((option) => Object.keys(option).length > 0);
    if (options.length === 0) continue;
    const active =
      typeof state.active === "number" && Number.isInteger(state.active)
        ? Math.min(Math.max(state.active, 0), options.length - 1)
        : 0;
    result[sectionKey] = { active, options };
  }
  return result;
}

function sanitizeSectionNotes(raw: unknown): Record<string, string> {
  if (!isPlainObject(raw)) return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw).slice(0, 200)) {
    if (typeof value !== "string") continue;
    const note = value.trim();
    if (note && note.length <= 2_000) out[key] = note;
  }
  return out;
}

function canonicalizeRevision(
  rawInputs: Record<string, unknown>,
  rawSelections: Record<string, unknown>
): { inputs: RevisionInputsJson; selections: RevisionSelectionsJson } {
  const baseline = baselineSnapshot();
  const inputs = sanitizeLike(
    baseline.inputs,
    rawInputs,
    "revision.inputs"
  ) as Record<string, unknown>;
  const selections = sanitizeLike(
    baseline.selections,
    rawSelections,
    "revision.selections"
  ) as Record<string, unknown>;

  // Serbest uzunluklu kontrol listeleri genel şablon eşlemesinden sonra kendi
  // sözlükleriyle daraltılır. Alternatif/not haritalarının şablonu boş
  // olduğundan onlar da ayrı, kısmi anahtar doğrulamasından geçer.
  inputs.disabledModules = validModuleKeys(rawInputs.disabledModules);
  inputs.hiddenSections = validSectionKeys(rawInputs.hiddenSections);
  inputs.hiddenDiagrams = validSectionKeys(rawInputs.hiddenDiagrams);
  // Ağırlık dökümü kararları revizyon yükleyicisinin kendi güvenli okuyucusuyla
  // alınır: bozuk satır atlanır, `applied` izi taşınmaz (bkz. dışa aktarım).
  const weightBreakdown = weightBreakdownFromRevision(rawInputs as RevisionInputsJson);
  delete weightBreakdown.applied;
  if (Object.keys(weightBreakdown).length > 0) inputs.weightBreakdown = weightBreakdown;
  selections.alts = sanitizeAlternatives(rawSelections.alts, baseline.selections);
  selections.sectionNotes = sanitizeSectionNotes(rawSelections.sectionNotes);

  return {
    inputs: inputs as RevisionInputsJson,
    selections: selections as RevisionSelectionsJson,
  };
}

// --------------------------------------------------------------- proje künyesi

function emptyCompany(): OfferReportTransferCompany {
  return {
    name: "",
    shortName: "",
    address: "",
    taxOffice: "",
    taxNo: "",
    phone: "",
    fax: "",
    email: "",
    web: "",
  };
}

type CompanyInput = Partial<OfferReportTransferCompany> | null | undefined;

/** Firma künyesini dosya biçimine indirger; adı ve kimliği olmayan kayıt null'dır. */
function normalizeCompany(raw: CompanyInput): OfferReportTransferCompany | null {
  if (!raw) return null;
  const base = emptyCompany();
  const out: OfferReportTransferCompany = { ...base };
  for (const key of Object.keys(base) as (keyof OfferReportTransferCompany)[]) {
    if (key === "id") continue;
    const value = raw[key];
    out[key] = typeof value === "string" ? value.trim() : "";
  }
  const id = typeof raw.id === "string" && UUID_RE.test(raw.id.trim()) ? raw.id.trim() : undefined;
  if (id) out.id = id;
  if (!out.name && !id) return null;
  return out;
}

export interface OfferReportTransferProjectInput {
  documentNo: string;
  name: string;
  customer: string;
  craneType: string;
  craneLocation: string;
  endCustomer?: CompanyInput;
  reportBrand?: CompanyInput;
  issuer?: CompanyInput;
  signatories?: Partial<OfferReportTransferSignatories> | null;
}

function normalizeProject(input: OfferReportTransferProjectInput): OfferReportTransferProject {
  const endCustomer = normalizeCompany(input.endCustomer);
  const customer = input.customer.trim() || endCustomer?.name || "";
  return {
    documentNo: input.documentNo.trim(),
    name: input.name.trim(),
    customer,
    craneType: input.craneType.trim(),
    craneLocation: input.craneLocation.trim(),
    endCustomer,
    reportBrand: normalizeCompany(input.reportBrand),
    issuer: normalizeCompany(input.issuer),
    signatories: {
      preparedBy: input.signatories?.preparedBy?.trim() ?? "",
      checkedBy: input.signatories?.checkedBy?.trim() ?? "",
    },
  };
}

// ------------------------------------------------------------------ rehber

function guideRow(
  path: string,
  def: TransferFieldDef,
  specs: CalcInput["specs"],
  source: Record<string, unknown>,
  extra?: Partial<OfferReportTransferFieldGuide>
): OfferReportTransferFieldGuide {
  const options = def.optionsFrom?.(source) ?? def.optionsFor?.(specs) ?? def.options;
  const hint = [def.hint, extra?.hint].filter(Boolean).join(" ");
  return {
    path,
    label: def.labelFor?.(specs) ?? def.label,
    valueType: def.type,
    ...(def.unit ? { unit: def.unit } : {}),
    ...(options ? { options: [...options] } : {}),
    ...(def.optionLabels ? { optionLabels: def.optionLabels } : {}),
    ...(hint ? { hint } : {}),
    ...(extra?.source ? { source: extra.source } : {}),
  };
}

function valueTypeOfKind(kind: OptionalKind): OfferReportTransferFieldGuide["valueType"] {
  switch (kind) {
    case "number":
      return "number";
    case "boolean":
      return "boolean";
    case "json":
      return "list";
    default:
      return "text";
  }
}

function valueTypeOfValue(value: unknown): OfferReportTransferFieldGuide["valueType"] {
  if (typeof value === "number") return "number";
  if (typeof value === "boolean") return "boolean";
  if (Array.isArray(value)) return "list";
  if (isPlainObject(value)) return "object";
  return "text";
}

const COMPANY_FIELD_LABELS: Record<keyof OfferReportTransferCompany, string> = {
  id: "Defter Kaydı Kimliği",
  name: "Firma Unvanı",
  shortName: "Kısa Ad",
  address: "Adres",
  taxOffice: "Vergi Dairesi",
  taxNo: "Vergi No",
  phone: "Telefon",
  fax: "Faks",
  email: "E-posta",
  web: "Web",
};

function companyGuideRows(
  path: string,
  title: string,
  hint: string,
  source?: OfferReportTransferFieldGuide["source"]
): OfferReportTransferFieldGuide[] {
  return (Object.keys(COMPANY_FIELD_LABELS) as (keyof OfferReportTransferCompany)[]).map(
    (key) => ({
      path: `${path}.${key}`,
      label: `${title} · ${COMPANY_FIELD_LABELS[key]}`,
      valueType: "text",
      ...(key === "id" || key === "name" ? { hint } : {}),
      ...(source ? { source } : {}),
    })
  );
}

function projectGuideRows(): OfferReportTransferFieldGuide[] {
  return [
    { path: "project.documentNo", label: "Doküman No", valueType: "text" },
    { path: "project.name", label: "Rapor / Vinç Adı", valueType: "text", hint: "Kayıtta BÜYÜK HARFE çevrilir." },
    {
      path: "project.customer",
      label: "Müşteri",
      valueType: "text",
      hint: "Serbest metin müşteri adı; boş bırakılırsa project.endCustomer.name kullanılır. Kayıtta BÜYÜK HARFE çevrilir.",
    },
    {
      path: "project.craneType",
      label: "Vinç Tipi",
      valueType: "select",
      options: [...OFFER_CRANE_TYPES],
      hint: `Vinç topolojisinin tohumudur: "${GROUND_CRANE_TYPE}" yürütme/köprü bölümlerini kapatır ve travelArrangement'ı fixed yapar; "Tek Kirişli" / "Çift Kirişli" girderArrangement'ı yazar. Liste dışı serbest metin de kabul edilir.`,
    },
    { path: "project.craneLocation", label: "Vinç Yeri", valueType: "text", hint: "İsteğe bağlı; kayıtta BÜYÜK HARFE çevrilir." },
    ...companyGuideRows(
      "project.endCustomer",
      "Son Kullanıcı",
      "Firma defteriyle eşleşir: önce id, sonra unvan (büyük/küçük harf duyarsız). Eşleşen kayıt BAĞLANIR ve dosyadaki bilgiyle GÜNCELLENMEZ; eşleşme yoksa unvan ve künyeyle YENİ müşteri açılır. Kapak logosu bu kayıttan gelir. Tamamen null bırakılabilir."
    ),
    ...companyGuideRows(
      "project.reportBrand",
      "Rapor Firması",
      "Raporu ORION dışında kendi adıyla sunan firma. Yalnız MEVCUT defter kaydıyla eşleşir (id, sonra unvan ya da kısa ad); bulunamazsa boş kalır ve reviewNotes'a yazılır. null = raporu ORION sunar."
    ),
    ...companyGuideRows(
      "project.issuer",
      "Raporu Üreten Firma",
      "Bizim firmamızın defter kaydı (customers.is_self). Yalnız bilgi; içe aktarım yazmaz, değiştirme.",
      "bilgi"
    ),
    {
      path: "project.signatories.preparedBy",
      label: "Hazırlayan",
      valueType: "text",
      source: "bilgi",
      hint: "Kaynak raporun kapağındaki ad. İçe aktarımda hazırlayan, dosyayı yükleyen kullanıcı olur; değiştirme.",
    },
    {
      path: "project.signatories.checkedBy",
      label: "Kontrol Eden",
      valueType: "text",
      hint: "Kapakta basılacak kontrol eden adı; serbest metin olarak yeni projeye yazılır.",
    },
  ];
}

function controlGuideRows(): OfferReportTransferFieldGuide[] {
  return [
    {
      path: "revision.inputs.specs.travelArrangement",
      label: "Yürütme Düzeni",
      valueType: "select",
      options: ["traveling", "fixed"],
      source: "otomatik",
      hint: `project.craneType'tan yazılır: "${GROUND_CRANE_TYPE}" → fixed, diğer tipler → traveling. Elle değiştirme.`,
    },
    {
      path: "revision.inputs.disabledModules",
      label: "Kapatılan Hesap Bölümleri",
      valueType: "list",
      options: MODULE_ORDER.filter((key) => !REQUIRED_MODULE_KEYS.includes(key)),
      hint: `Listedeki bölüm hesaba ve rapora girmez, girdileri korunur. ${REQUIRED_MODULE_KEYS.join(", ")} kapatılamaz. Vinç tipi kendi kapalı listesini buna EKLER (ör. Yer Vinci).`,
    },
    {
      path: "revision.inputs.hiddenSections",
      label: "Gizlenen Alt Bölümler",
      valueType: "list",
      hint: 'Biçim "modülAnahtarı-bölümNo" (ör. "trolley-5.7"). Gizlenen alt bölüm hesaba girer, PDF/ekipman listesinde basılmaz.',
    },
    {
      path: "revision.inputs.hiddenDiagrams",
      label: "Şeması Gizlenen Alt Bölümler",
      valueType: "list",
      hint: 'Biçim hiddenSections ile aynı; yalnız o bölümün parametrik şeması PDF\'e girmez.',
    },
    {
      path: "revision.inputs.weightBreakdown.overrides",
      label: "Ağırlık Dökümü · Elle Ezilen Kilolar",
      valueType: "object",
      hint: "Kalem/grup anahtarı → kg. Dökümün kendisi hesaptan yeniden türetilir; yalnız mühendisin ezmeleri saklanır. Şartnamede yoksa dokunma.",
    },
    {
      path: "revision.inputs.weightBreakdown.notes",
      label: "Ağırlık Dökümü · Ezme Notları",
      valueType: "object",
      hint: "Kalem/grup anahtarı → neden ezildiği.",
    },
    {
      path: "revision.inputs.weightBreakdown.serbest",
      label: "Ağırlık Dökümü · Elle Açılan Satırlar",
      valueType: "list",
      hint: `Hiçbir hesap bölümünün üretmediği parçalar. Satır: {id: "${AGIRLIK_SERBEST_ON_EKI}<n>", bant: "bridge" | araba anahtarı (trolley, auxTrolley, mono1Trolley, mono2Trolley), grup: dökümdeki grup anahtarı, ad, adet, kg (satırın TOPLAM kilosu; bilinmiyorsa null)}. En çok ${AGIRLIK_SERBEST_SINIRI} satır.`,
    },
    {
      path: "revision.inputs.weightBreakdown.ayakYuksekligiM",
      label: "Portal Ayak Yüksekliği",
      valueType: "number",
      unit: "m",
      hint: "Yalnız portal / yarı portal vinçte; hesap bölümlerinde sorulmayan tek ölçüdür.",
    },
    {
      path: "revision.selections.alts",
      label: "Seçenekli Ekipman",
      valueType: "object",
      hint: 'Anahtar "modülAnahtarı-bölümNo" → {active, options[]}; her seçenek o bölümün seçim alanlarının alt kümesidir (en çok 3). Şartname seçenek istemiyorsa boş bırak.',
    },
    {
      path: "revision.selections.sectionNotes",
      label: "Bölüm Notları",
      valueType: "object",
      hint: 'Anahtar "modülAnahtarı-bölümNo" → mühendis notu (rapora basılır).',
    },
  ];
}

function moduleGuideRows(
  key: ModuleKey,
  calcInput: CalcInput,
  moduleState: ModuleTemplate
): OfferReportTransferFieldGuide[] {
  const field = CALC_FIELD[key];
  const family = moduleFamily(key);
  const defs = defsForModule(key);
  const autoFlags = autoFlagMapForModule(key);
  const specs = calcInput.specs;
  const rows: OfferReportTransferFieldGuide[] = [];
  const seenInputs = new Set<string>();
  const seenSelections = new Set<string>();
  const labelOf = (def: TransferFieldDef) => def.labelFor?.(specs) ?? def.label;

  const autoHint = (target: string) =>
    target in autoFlags
      ? `Otomatik anahtarı: ${autoFlags[target]} — true iken bu değer motor tarafından türetilir ve dosyadaki sayı yok sayılır; elle yazıyorsan anahtarı false yap.`
      : undefined;

  for (const def of defs.inputs) {
    if (family === "buckling" && isBucklingPanelKey(def.key)) {
      // Buruşma panel alanları `side` ve `top` alt nesnelerinde iki kez yaşar.
      for (const panel of ["side", "top"] as const) {
        const source = moduleState.inputs[panel];
        if (isPlainObject(source) && def.key in source) {
          rows.push(
            guideRow(`revision.inputs.${field}.${panel}.${def.key}`, def, specs, source, {
              hint: "autoFromGirder true iken ana kirişten türetilir.",
            })
          );
        }
      }
      continue;
    }
    seenInputs.add(def.key);
    rows.push(
      guideRow(`revision.inputs.${field}.${def.key}`, def, specs, moduleState.inputs, {
        hint: autoHint(def.key),
      })
    );
  }

  // Otomatik türetme anahtarları — hedefin etiketiyle.
  const flagTargets = new Map<string, string[]>();
  for (const [target, flag] of Object.entries(autoFlags)) {
    const def =
      defs.inputs.find((item) => item.key === target) ??
      defs.selections.find((item) => item.key === target);
    const label = def ? labelOf(def) : (EXTRA_KEY_LABELS[target]?.label ?? target);
    const list = flagTargets.get(flag) ?? [];
    list.push(label);
    flagTargets.set(flag, list);
  }
  for (const [flag, targets] of flagTargets) {
    seenInputs.add(flag);
    rows.push({
      path: `revision.inputs.${field}.${flag}`,
      label: `${targets.join(" / ")} — otomatik türetme anahtarı`,
      valueType: "boolean",
      source: "otomatik",
      hint: `true: "${targets.join('", "')}" motor tarafından türetilir, dosyadaki değer yok sayılır. Şartnameden elle değer yazdıysan false yap.`,
    });
  }

  for (const [extra, kind] of Object.entries(EXTRA_INPUT_KEYS[family] ?? {})) {
    if (seenInputs.has(extra)) continue;
    seenInputs.add(extra);
    const meta = EXTRA_KEY_LABELS[extra];
    rows.push({
      path: `revision.inputs.${field}.${extra}`,
      label: meta?.label ?? extra,
      valueType: valueTypeOfKind(kind),
      ...(meta?.unit ? { unit: meta.unit } : {}),
      ...(meta?.hint ? { hint: meta.hint } : {}),
    });
  }

  for (const def of defs.selections) {
    seenSelections.add(def.key);
    const source = def.key in autoFlags ? ("otomatik" as const) : undefined;
    rows.push(
      guideRow(
        `revision.selections.${field}.${def.key}`,
        def,
        specs,
        moduleState.selections ?? {},
        {
          hint: [
            def.type === "multiselect"
              ? 'Birden çok değer virgülle ayrılmış TEK metindir (ör. "SKF, FAG").'
              : undefined,
            autoHint(def.key),
          ]
            .filter(Boolean)
            .join(" "),
          ...(source ? { source } : {}),
        }
      )
    );
  }

  for (const catalogField of catalogSelectionFields(key)) {
    if (seenSelections.has(catalogField.sel)) continue;
    seenSelections.add(catalogField.sel);
    const meta = EXTRA_KEY_LABELS[catalogField.sel];
    rows.push({
      path: `revision.selections.${field}.${catalogField.sel}`,
      label: meta?.label ?? catalogField.label,
      valueType: valueTypeOfKind(kindOfKey(catalogField.sel)),
      ...(meta?.unit ? { unit: meta.unit } : {}),
      source: "katalog",
      hint: "Katalog satırından gelir; elle uydurma. Ürün değişiyorsa marka/model yaz, bu alanı boş bırak ve reviewNotes'a \"katalogdan yeniden seçilecek\" yaz.",
    });
  }

  for (const [extra, kind] of Object.entries(EXTRA_SELECTION_KEYS[family] ?? {})) {
    if (seenSelections.has(extra)) continue;
    seenSelections.add(extra);
    const meta = EXTRA_KEY_LABELS[extra];
    rows.push({
      path: `revision.selections.${field}.${extra}`,
      label: meta?.label ?? extra,
      valueType: valueTypeOfKind(kind),
      source: "katalog",
      ...(meta?.hint ? { hint: meta.hint } : {}),
    });
  }

  // Snapshot'ta durup yukarıdaki hiçbir kaynakta anlatılmayan anahtar
  // kalmasın: AI açıklanmamış bir alan görmemelidir.
  const describeLeftover = (
    scope: "inputs" | "selections",
    source: Record<string, unknown>,
    seen: Set<string>
  ) => {
    for (const [leftover, value] of Object.entries(source)) {
      if (seen.has(leftover)) continue;
      if (family === "buckling" && (leftover === "side" || leftover === "top")) continue;
      seen.add(leftover);
      const meta = EXTRA_KEY_LABELS[leftover];
      rows.push({
        path: `revision.${scope}.${field}.${leftover}`,
        label: meta?.label ?? leftover,
        valueType: valueTypeOfValue(value),
        ...(meta?.unit ? { unit: meta.unit } : {}),
        source: "bilgi",
        hint: meta?.hint ?? "Uygulama tarafından yönetilen alan; değiştirme.",
      });
    }
  };
  describeLeftover("inputs", moduleState.inputs, seenInputs);
  if (moduleState.selections) describeLeftover("selections", moduleState.selections, seenSelections);

  return rows;
}

function createFieldGuide(calcInput: CalcInput): OfferReportTransferFieldGuide[] {
  const guide: OfferReportTransferFieldGuide[] = [...projectGuideRows()];

  const specs = calcInput.specs as unknown as Record<string, unknown>;
  for (const def of transferDefs(SPEC_FIELDS)) {
    guide.push(guideRow(`revision.inputs.specs.${def.key}`, def, calcInput.specs, specs));
  }
  guide.push(...controlGuideRows());

  for (const key of MODULE_ORDER) {
    const moduleState = moduleTemplateOf(calcInput, key);
    if (!moduleState) continue;
    guide.push(...moduleGuideRows(key, calcInput, moduleState));
  }
  return guide;
}

// ---------------------------------------------------------- dışa aktarım

export function buildOfferReportTransferFile(args: {
  project: OfferReportTransferProjectInput;
  revision: {
    revNo: number;
    engineVersion: string | null | undefined;
    inputs: RevisionInputsJson | null;
    selections: RevisionSelectionsJson | null;
  };
  exportedAt?: Date;
}): OfferReportTransferFile {
  const loaded = loadRevision(args.revision.inputs, args.revision.selections);
  const inputs = inputSnapshotFromCalcInput(
    loaded.full,
    loaded.disabled,
    hiddenSectionsFromRevision(args.revision.inputs),
    hiddenDiagramsFromRevision(args.revision.inputs),
    weightBreakdownFromRevision(args.revision.inputs)
  );
  const selections = selectionSnapshotFromCalcInput(
    loaded.full,
    args.revision.selections
  );

  return {
    format: OFFER_REPORT_TRANSFER_FORMAT,
    formatVersion: OFFER_REPORT_TRANSFER_VERSION,
    instructions: [
      "Bu dosya ORION Teklif Hesap Raporu içe aktarım dosyasıdır; JSON yapısını ve anahtar adlarını değiştirme.",
      "Yeni teknik şartnameyi incele; yalnız açıkça bulduğun proje, müşteri, teknik girdi ve seçim değerlerini güncelle.",
      "Birimleri fieldGuide'a göre dönüştür; sayı alanlarına birim eki veya açıklama yazma.",
      "Select alanlarında fieldGuide.options içindeki makine değerini kullan; optionLabels yalnız insan okunur karşılıktır. multiselect alanları virgülle ayrılmış TEK metindir (\"SKF, FAG\").",
      "\"...Auto\": true olan anahtarlar ilgili alanı hesap motoruna türettirir; o alana şartnameden elle değer yazıyorsan anahtarı false yap, yoksa yazdığın değer yok sayılır.",
      "fieldGuide.source = \"katalog\" olan alanlar katalog satırından gelir; uydurma. Ürün değişecekse marka/model yaz, kalan katalog değerlerini boş bırak ve reviewNotes'a \"katalogdan yeniden seçilecek\" notu düş.",
      "project.craneType vinç topolojisini belirler: \"Yer Vinci\" yürütme/köprü bölümlerini kapatır ve travelArrangement'ı fixed yapar; \"Tek Kirişli\" / \"Çift Kirişli\" girderArrangement'ı yazar. Yardımcı kaldırma, monoray ve ayrı yardımcı araba kararları revision.inputs.specs içindedir (auxTrolleyMode, monorailCount) ve disabledModules ile birlikte okunur.",
      "project.endCustomer ve project.reportBrand firma defteriyle eşleşir (önce id, sonra unvan). Son kullanıcı bulunamazsa YENİ müşteri açılır; rapor firması bulunamazsa boş kalır. Mevcut kayıtlar dosyadaki bilgiyle GÜNCELLENMEZ. project.issuer ve project.signatories.preparedBy yalnız bilgidir.",
      "revision.inputs.weightBreakdown yalnız insanın verdiği ağırlık kararlarını taşır (ezme, not, serbest satır, portal ayak yüksekliği); dökümün kendisi hesaptan yeniden türetilir. Şartnamede karşılığı yoksa dokunma.",
      "Şartnamede bulunmayan değerleri uydurma ve silme; örnek rapordaki değeri koru, teyit edilmesi gereken her yolu reviewNotes listesine yaz.",
      "revision.results ekleme: hesap sonuçları dosyadan alınmaz, ORION hesap motoru tarafından yeniden üretilir.",
    ],
    source: {
      documentNo: args.project.documentNo,
      revisionNo: args.revision.revNo,
      engineVersion: args.revision.engineVersion || "bilinmiyor",
      exportedAt: (args.exportedAt ?? new Date()).toISOString(),
    },
    project: normalizeProject(args.project),
    revision: { inputs, selections },
    reviewNotes: [],
    fieldGuide: createFieldGuide(loaded.full),
  };
}

export function stringifyOfferReportTransferFile(file: OfferReportTransferFile): string {
  return `${JSON.stringify(file, null, 2)}\n`;
}

// ---------------------------------------------------------- içe aktarım

/**
 * AI tarafından üretilen dosyayı doğrular ve hesap sonucunu GÜNCEL motorla
 * yeniden kurar. Dönen inputs/selections yalnız bugünün bilinen anahtarlarını
 * taşır; fieldGuide ve dosyaya eklenmiş yabancı nesneler DB'ye girmez.
 */
export function parseOfferReportTransferText(text: string): ParsedOfferReportTransfer {
  const bytes = new TextEncoder().encode(text).byteLength;
  if (bytes === 0) throw new OfferReportTransferError("Dosya boş.");
  if (bytes > OFFER_REPORT_TRANSFER_MAX_BYTES) {
    throw new OfferReportTransferError("Dosya 900 KB sınırını aşıyor.");
  }

  let raw: unknown;
  try {
    raw = JSON.parse(text.replace(/^\uFEFF/, ""));
  } catch {
    throw new OfferReportTransferError("Dosya geçerli JSON değil.");
  }
  assertSafeJson(raw);

  const parsed = transferFileSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const path = first.path.length > 0 ? `${first.path.join(".")}: ` : "";
    throw new OfferReportTransferError(`${path}${first.message}`);
  }

  const project = normalizeProject(parsed.data.project);
  if (!project.customer) {
    throw new OfferReportTransferError(
      "project.customer: Müşteri gerekli (ya da project.endCustomer.name doldurulmalı)."
    );
  }

  const canonical = canonicalizeRevision(
    parsed.data.revision.inputs,
    parsed.data.revision.selections
  );
  // Dosyayla oluşturma `createRevision` yolunu kullanmaz. Bu yüzden vinç
  // tipinin V0 topoloji tohumu burada, hesap yeniden koşturulmadan ÖNCE
  // uygulanır. Böylece AI "Yer Vinci" yazıp yürütme girdilerini bırakamaz;
  // tek/çift kirişli tipi seçtiğinde de kiriş yük paylaşımı aynı snapshot'a
  // açıkça yazılır.
  const effectiveInputs = applyCraneTypeRevisionPreset(
    0,
    project.craneType,
    canonical.inputs as Record<string, unknown>
  ) as RevisionInputsJson;

  let result: CalcResult;
  try {
    const calcInput = calcInputFromRevision(effectiveInputs, canonical.selections);
    result = runCalc(calcInput);
    assertSafeJson(result);
  } catch (error) {
    if (error instanceof OfferReportTransferError) throw error;
    const message = error instanceof Error ? error.message : "Bilinmeyen hesap hatası";
    throw new OfferReportTransferError(`Dosyadaki girdiler hesaplanamadı: ${message}`);
  }

  return {
    project,
    inputs: effectiveInputs,
    selections: canonical.selections,
    results: jsonClone(result),
    reviewNotes: parsed.data.reviewNotes,
    source: parsed.data.source,
  };
}
