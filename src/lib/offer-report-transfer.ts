// Teklif hesap raporu ↔ yapay zekâ aracı dosyası.
//
// Dosya bir hesap SONUCU taşımaz. Proje künyesini, kullanıcı girdilerini ve
// katalog/seçim snapshot'ını taşır; içe aktarımda sonuçlar güncel hesap
// motoruyla yeniden üretilir. Böylece yerel bir AI agent'ın yazdığı JSON,
// uygulamaya eski ya da uydurulmuş hesap sonuçları sokamaz.

import { z } from "zod";
import { runCalc, type CalcInput, type CalcResult } from "@/lib/calc/engine";
import {
  HOIST_INPUT_FIELDS,
  HOIST_SELECTION_FIELDS,
  SPEC_FIELDS,
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
  WHEELLOAD_INPUT_FIELDS,
  WHEELLOAD_SELECTION_FIELDS,
} from "@/lib/calc/presentation/wheelLoadFields";
import {
  CABIN_INPUT_FIELDS,
  CABIN_SELECTION_FIELDS,
} from "@/lib/calc/presentation/cabinFields";
import {
  MODULE_ORDER,
  moduleFamily,
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
  type RevisionInputsJson,
  type RevisionSelectionsJson,
} from "@/lib/revision-load";
import { applyCraneTypeRevisionPreset } from "@/lib/crane-types";

export const OFFER_REPORT_TRANSFER_FORMAT = "orion-offer-calculation-report";
export const OFFER_REPORT_TRANSFER_VERSION = 1;

/** Server Action varsayılan 1 MB sınırının altında bilinçli pay. */
export const OFFER_REPORT_TRANSFER_MAX_BYTES = 900_000;

const MAX_JSON_DEPTH = 14;
const MAX_JSON_NODES = 30_000;
const FORBIDDEN_KEYS = new Set(["__proto__", "prototype", "constructor"]);

const transferProjectSchema = z.object({
  documentNo: z.string().trim().min(1, "Doküman no gerekli").max(160),
  name: z.string().trim().min(1, "Rapor / vinç adı gerekli").max(500),
  customer: z.string().trim().min(1, "Müşteri gerekli").max(500),
  craneType: z.string().trim().min(1, "Vinç tipi gerekli").max(240),
  craneLocation: z.string().trim().max(240).default(""),
});

const jsonRecordSchema = z.record(z.string(), z.unknown());

const transferFileSchema = z.object({
  format: z.literal(OFFER_REPORT_TRANSFER_FORMAT),
  formatVersion: z.literal(OFFER_REPORT_TRANSFER_VERSION),
  instructions: z.array(z.string().max(2_000)).max(30).optional(),
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
  fieldGuide: z.array(z.unknown()).max(5_000).optional(),
});

export interface OfferReportTransferProject {
  documentNo: string;
  name: string;
  customer: string;
  craneType: string;
  craneLocation: string;
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
  valueType: "number" | "text" | "select" | "multiselect";
  unit?: string;
  options?: (string | number)[];
  optionLabels?: Record<string, string>;
  hint?: string;
}

export interface OfferReportTransferFile {
  format: typeof OFFER_REPORT_TRANSFER_FORMAT;
  formatVersion: typeof OFFER_REPORT_TRANSFER_VERSION;
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

function jsonClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function inputSnapshotFromCalcInput(
  calcInput: CalcInput,
  disabledModules: readonly string[],
  hiddenSections: readonly string[],
  hiddenDiagrams: readonly string[]
): Record<string, unknown> {
  const source = calcInput as unknown as Record<
    string,
    { inputs?: object; selections?: object } | undefined
  >;
  const out: Record<string, unknown> = { specs: calcInput.specs };
  for (const key of MODULE_ORDER) {
    const field = CALC_FIELD[key];
    out[field] = source[field]?.inputs ?? null;
  }
  out.disabledModules = [...disabledModules];
  out.hiddenSections = [...hiddenSections];
  out.hiddenDiagrams = [...hiddenDiagrams];
  return jsonClone(out);
}

function selectionSnapshotFromCalcInput(
  calcInput: CalcInput,
  selections: RevisionSelectionsJson | null | undefined
): Record<string, unknown> {
  const source = calcInput as unknown as Record<
    string,
    { inputs?: object; selections?: object } | undefined
  >;
  const out: Record<string, unknown> = {};
  for (const key of MODULE_ORDER) {
    const field = CALC_FIELD[key];
    out[field] = source[field]?.selections ?? null;
  }
  out.alts = altsFromRevision(selections);
  out.sectionNotes = sectionNotesFromRevision(selections);
  return jsonClone(out);
}

/** Güncel kodun kabul ettiği eksiksiz snapshot; içe aktarım tipi bununla sınırlanır. */
function baselineSnapshot(): {
  inputs: Record<string, unknown>;
  selections: Record<string, unknown>;
} {
  const loaded = loadRevision(null, null);
  return {
    inputs: inputSnapshotFromCalcInput(loaded.full, loaded.disabled, [], []),
    selections: selectionSnapshotFromCalcInput(loaded.full, null),
  };
}

function typeName(value: unknown): string {
  if (Array.isArray(value)) return "dizi";
  if (value === null) return "boş";
  if (typeof value === "number") return "sayı";
  if (typeof value === "string") return "metin";
  if (typeof value === "boolean") return "doğru/yanlış";
  if (typeof value === "object") return "nesne";
  return typeof value;
}

/**
 * Aday snapshot'ı, güncel şablonun anahtarları ve ilkel tipleriyle keser.
 * Bilinmeyen anahtarlar sessizce DB'ye taşınmaz; bilinen bir alanın yanlış
 * tipi ise sessiz varsayılana düşmez, dosya yolu ile birlikte açık hata olur.
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
    return out;
  }
  return jsonClone(template);
}

function validModuleKeys(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const allowed = new Set<string>(MODULE_ORDER);
  return [...new Set(raw.filter((value): value is string => typeof value === "string" && allowed.has(value)))];
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
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(candidate)) {
    if (!(key in template)) continue;
    out[key] = sanitizeLike(template[key], value, `${path}.${key}`);
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
  selections.alts = sanitizeAlternatives(rawSelections.alts, baseline.selections);
  selections.sectionNotes = sanitizeSectionNotes(rawSelections.sectionNotes);

  return {
    inputs: inputs as RevisionInputsJson,
    selections: selections as RevisionSelectionsJson,
  };
}

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

function guideRow(
  path: string,
  def: TransferFieldDef,
  specs: CalcInput["specs"],
  source: Record<string, unknown>
): OfferReportTransferFieldGuide {
  const options = def.optionsFrom?.(source) ?? def.optionsFor?.(specs) ?? def.options;
  return {
    path,
    label: def.labelFor?.(specs) ?? def.label,
    valueType: def.type,
    ...(def.unit ? { unit: def.unit } : {}),
    ...(options ? { options: [...options] } : {}),
    ...(def.optionLabels ? { optionLabels: def.optionLabels } : {}),
    ...(def.hint ? { hint: def.hint } : {}),
  };
}

function createFieldGuide(calcInput: CalcInput): OfferReportTransferFieldGuide[] {
  const guide: OfferReportTransferFieldGuide[] = [
    { path: "project.documentNo", label: "Doküman No", valueType: "text" },
    { path: "project.name", label: "Rapor / Vinç Adı", valueType: "text" },
    { path: "project.customer", label: "Müşteri", valueType: "text" },
    { path: "project.craneType", label: "Vinç Tipi", valueType: "text" },
    { path: "project.craneLocation", label: "Vinç Yeri", valueType: "text" },
  ];

  const specs = calcInput.specs as unknown as Record<string, unknown>;
  for (const def of transferDefs(SPEC_FIELDS)) {
    guide.push(guideRow(`revision.inputs.specs.${def.key}`, def, calcInput.specs, specs));
  }

  const modules = calcInput as unknown as Record<
    string,
    { inputs?: Record<string, unknown>; selections?: Record<string, unknown> } | undefined
  >;
  for (const key of MODULE_ORDER) {
    const field = CALC_FIELD[key];
    const moduleState = modules[field];
    if (!moduleState) continue;
    const defs = defsForModule(key);
    for (const def of defs.inputs) {
      // Buruşma panel alanları `side` ve `top` alt nesnelerinde iki kez yaşar;
      // kök ek alanlar ise doğrudan buckling inputs'tadır.
      if (key === "buckling" && BUCKLING_PANEL_FIELDS.some((item) => item.key === def.key)) {
        for (const panel of ["side", "top"] as const) {
          const source = moduleState.inputs?.[panel];
          if (isPlainObject(source) && def.key in source) {
            guide.push(
              guideRow(
                `revision.inputs.${field}.${panel}.${def.key}`,
                def,
                calcInput.specs,
                source
              )
            );
          }
        }
        continue;
      }
      if (moduleState.inputs && def.key in moduleState.inputs) {
        guide.push(
          guideRow(
            `revision.inputs.${field}.${def.key}`,
            def,
            calcInput.specs,
            moduleState.inputs
          )
        );
      }
    }
    for (const def of defs.selections) {
      if (moduleState.selections && def.key in moduleState.selections) {
        guide.push(
          guideRow(
            `revision.selections.${field}.${def.key}`,
            def,
            calcInput.specs,
            moduleState.selections
          )
        );
      }
    }
  }
  return guide;
}

export function buildOfferReportTransferFile(args: {
  project: OfferReportTransferProject;
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
    hiddenDiagramsFromRevision(args.revision.inputs)
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
      "Yeni teknik şartnameyi incele; yalnız açıkça bulduğun proje, teknik girdi ve seçim değerlerini güncelle.",
      "Birimleri fieldGuide'a göre dönüştür; sayı alanlarına birim eki veya açıklama yazma.",
      "Select alanlarında mümkünse fieldGuide.options içindeki makine değerini kullan; optionLabels yalnız insan okunur karşılıktır.",
      "Şartnamede bulunmayan değerleri uydurma ve silme; örnek rapordaki değeri koru, teyit edilmesi gereken her yolu reviewNotes listesine yaz.",
      "revision.results ekleme: hesap sonuçları dosyadan alınmaz, ORION hesap motoru tarafından yeniden üretilir.",
    ],
    source: {
      documentNo: args.project.documentNo,
      revisionNo: args.revision.revNo,
      engineVersion: args.revision.engineVersion || "bilinmiyor",
      exportedAt: (args.exportedAt ?? new Date()).toISOString(),
    },
    project: { ...args.project },
    revision: { inputs, selections },
    reviewNotes: [],
    fieldGuide: createFieldGuide(loaded.full),
  };
}

export function stringifyOfferReportTransferFile(file: OfferReportTransferFile): string {
  return `${JSON.stringify(file, null, 2)}\n`;
}

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

  const canonical = canonicalizeRevision(
    parsed.data.revision.inputs,
    parsed.data.revision.selections
  );
  // Dosyayla oluşturma `createRevision` yolunu kullanmaz. Bu yüzden vinç
  // tipinin V0 topoloji tohumu burada, hesap yeniden koşturulmadan ÖNCE
  // uygulanır. AI "Yer Vinci" yazıp örnek raporun yürütme girdilerini bıraksa
  // bile sonuçta araba/köprü yürütmesi DB'ye giremez.
  const effectiveInputs = applyCraneTypeRevisionPreset(
    0,
    parsed.data.project.craneType,
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
    project: parsed.data.project,
    inputs: effectiveInputs,
    selections: canonical.selections,
    results: jsonClone(result),
    reviewNotes: parsed.data.reviewNotes,
    source: parsed.data.source,
  };
}
