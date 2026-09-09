// Kazanılan teklif -> iş emri taslağı -> fiyatsız mühendislik aktarımı.
//
// Bu modül SAFTIR: DB/HTTP/React bilmez. Teklif yapısının sabit olduğunu
// varsaymaz; görünür teknik kalemleri ve bağımsız ana fiyat satırlarını aday
// olarak ayırır. Serbest metinden mühendislik sayısı TAHMİN ETMEZ. Yalnız
// kanonik grup/satır/parça anahtarları ile açık kalem künyesi okunur.

import type { TechnicalSpecs } from "@/lib/calc/types";
import { parseNum } from "@/lib/currency";
import type {
  OfferGroup,
  OfferItem,
  OfferPayload,
  OfferPriceLine,
  OfferRow,
} from "./types";

export const OFFER_JOB_MAPPING_VERSION = 1;

export const ENGINEERING_ELIGIBILITIES = [
  "eligible",
  "review",
  "not_applicable",
] as const;

export type EngineeringEligibility =
  (typeof ENGINEERING_ELIGIBILITIES)[number];

export const OFFER_JOB_SOURCE_TYPES = [
  "technicalItem",
  "standalonePriceLine",
] as const;

export type OfferJobSourceType = (typeof OFFER_JOB_SOURCE_TYPES)[number];

export type EngineeringTechnicalFactKey =
  | "mainCapacityT"
  | "auxCapacityT"
  | "spanM"
  | "mainLiftHeightM"
  | "mainLiftSpeedMpm"
  | "auxLiftSpeedMpm"
  | "structureClass"
  | "bridgeSpeedMpm"
  | "trolleySpeedMpm"
  | "ambientTempMinC"
  | "ambientTempMaxC"
  | "installationEnvironment"
  | "supplyVoltage"
  | "controlVoltage"
  | "runwayLengthM";

export type EngineeringTechnicalFacts = Partial<
  Pick<TechnicalSpecs, EngineeringTechnicalFactKey>
>;

export interface EngineeringSnapshotRow {
  key: string;
  label: string;
  value: string;
  parts: Record<string, string>;
  manual: boolean;
  scope: "orion" | "customer";
  source: "manual" | "catalog" | "suggested" | null;
}

export interface EngineeringSnapshotGroup {
  id: string;
  key: string;
  title: string;
  rows: EngineeringSnapshotRow[];
}

/** Ticari fiyat, iskonto, ödeme ve hukuk metni İÇERMEYEN kaynak fotoğrafı. */
export interface EngineeringTechnicalSnapshot {
  sourceType: OfferJobSourceType;
  item?: {
    id: string;
    title: string;
    craneType: string;
    capacityT: number | null;
    spanM: number | null;
    groups: EngineeringSnapshotGroup[];
  };
  standaloneLine?: {
    id: string;
    description: string;
    quantity: number | null;
    unit: string;
    optional: boolean;
    leadTime: string;
  };
}

export interface OfferJobCandidate {
  sourceRef: string;
  sourceType: OfferJobSourceType;
  sourceId: string;
  included: boolean;
  productName: string;
  quantity: string;
  optional: boolean;
  eligibility: EngineeringEligibility;
  craneType: string;
  technicalFacts: EngineeringTechnicalFacts;
  technicalSnapshot: EngineeringTechnicalSnapshot;
  mappedFields: string[];
  warnings: string[];
  unmapped: Array<{ path: string; label: string; value: string }>;
}

export interface OfferJobDraft {
  mappingVersion: number;
  candidates: OfferJobCandidate[];
  deliveryHint: string;
  /** Teklifin genel/kalem bazlı sürelerinden çıkarılan en uzun termin. */
  deliveryDays: number | null;
  shippingHint: string;
  scopeSuggestions: {
    proje: boolean;
    devreyeAlma: boolean;
    malzeme: boolean;
    nakliye: boolean;
    imalat: boolean;
    montaj: boolean;
  };
  warnings: string[];
}

function sourceRef(type: OfferJobSourceType, id: string): string {
  return `${type}:${id}`;
}

function visibleGroups(item: OfferItem): OfferGroup[] {
  return item.groups.filter((group) => !group.hidden);
}

function visibleRows(group: OfferGroup): OfferRow[] {
  return group.rows.filter((row) => !row.hidden);
}

function snapshotOf(item: OfferItem): EngineeringTechnicalSnapshot {
  return {
    sourceType: "technicalItem",
    item: {
      id: item.id,
      title: item.title.trim(),
      craneType: item.craneType?.trim() ?? "",
      capacityT:
        typeof item.capacityT === "number" && Number.isFinite(item.capacityT)
          ? item.capacityT
          : null,
      spanM:
        typeof item.spanM === "number" && Number.isFinite(item.spanM)
          ? item.spanM
          : null,
      groups: visibleGroups(item).map((group) => ({
        id: group.id,
        key: group.key,
        title: group.title.trim(),
        rows: visibleRows(group).map((row) => ({
          key: row.key,
          label: row.label.trim(),
          value: row.value.trim(),
          parts: Object.fromEntries(
            Object.entries(row.parts ?? {})
              .filter(([, value]) => value.trim() !== "")
              .map(([key, value]) => [key, value.trim()])
          ),
          manual: row.manual === true,
          scope: row.scope === "customer" ? "customer" : "orion",
          source:
            row.source === "manual" ||
            row.source === "catalog" ||
            row.source === "suggested"
              ? row.source
              : null,
        })),
      })),
    },
  };
}

function standaloneSnapshot(line: OfferPriceLine): EngineeringTechnicalSnapshot {
  return {
    sourceType: "standalonePriceLine",
    standaloneLine: {
      id: line.id,
      description: line.description.trim(),
      quantity:
        typeof line.qty === "number" && Number.isFinite(line.qty)
          ? line.qty
          : null,
      unit: line.unit.trim(),
      optional: line.optional === true,
      leadTime: line.leadTime?.trim() ?? "",
    },
  };
}

function rowOf(item: OfferItem, groupKey: string, rowKey: string): OfferRow | undefined {
  const group = visibleGroups(item).find((entry) => entry.key === groupKey);
  return group ? visibleRows(group).find((entry) => entry.key === rowKey) : undefined;
}

/**
 * Sayı yalnız TEK bir sayı taşıyan kanonik parçadan okunur. "0,8/5" veya
 * "6-8" gibi aralık/çift hız tek bir mühendislik girdisine zorlanmaz.
 */
function singleNumber(value: string | null | undefined): number | null {
  const text = (value ?? "").trim();
  if (!text) return null;
  const tokens = text.match(/[+-]?\d+(?:[.,]\d+)?/g) ?? [];
  if (tokens.length !== 1) return null;
  const parsed = parseNum(tokens[0]);
  return parsed !== null && Number.isFinite(parsed) ? parsed : null;
}

function positiveNumber(value: string | null | undefined): number | null {
  const parsed = singleNumber(value);
  return parsed !== null && parsed > 0 ? parsed : null;
}

function part(
  item: OfferItem,
  groupKey: string,
  rowKey: string,
  partKey: string
): string {
  const row = rowOf(item, groupKey, rowKey);
  return row && !row.manual ? row.parts?.[partKey]?.trim() ?? "" : "";
}

function factCollector(item: OfferItem): {
  facts: EngineeringTechnicalFacts;
  mapped: string[];
  warnings: string[];
} {
  const facts: EngineeringTechnicalFacts = {};
  const mapped: string[] = [];
  const warnings: string[] = [];

  const setNumber = (
    key: keyof EngineeringTechnicalFacts,
    value: number | null,
    path: string,
    positive = true
  ) => {
    if (value === null || !Number.isFinite(value) || (positive && value <= 0)) return;
    (facts as Record<string, unknown>)[key] = value;
    mapped.push(path);
  };
  const setText = (
    key: keyof EngineeringTechnicalFacts,
    value: string,
    path: string
  ) => {
    const clean = value.trim();
    if (!clean) return;
    (facts as Record<string, unknown>)[key] = clean;
    mapped.push(path);
  };

  const capacityFromItem =
    typeof item.capacityT === "number" && Number.isFinite(item.capacityT)
      ? item.capacityT
      : null;
  setNumber(
    "mainCapacityT",
    capacityFromItem ?? positiveNumber(part(item, "general", "capacity", "main")),
    capacityFromItem !== null ? "item.capacityT" : "groups.general.capacity.parts.main"
  );
  setNumber(
    "auxCapacityT",
    positiveNumber(part(item, "general", "capacity", "aux")),
    "groups.general.capacity.parts.aux"
  );

  const spanFromItem =
    typeof item.spanM === "number" && Number.isFinite(item.spanM)
      ? item.spanM
      : null;
  setNumber(
    "spanM",
    spanFromItem ?? positiveNumber(part(item, "general", "span", "value")),
    spanFromItem !== null ? "item.spanM" : "groups.general.span.parts.value"
  );
  setNumber(
    "mainLiftHeightM",
    positiveNumber(part(item, "general", "liftHeight", "value")),
    "groups.general.liftHeight.parts.value"
  );
  setNumber(
    "runwayLengthM",
    positiveNumber(part(item, "general", "runway", "value")),
    "groups.general.runway.parts.value"
  );

  const mainSpeedRaw = part(item, "mainHoist", "liftSpeed", "range");
  const mainSpeed = positiveNumber(mainSpeedRaw);
  setNumber(
    "mainLiftSpeedMpm",
    mainSpeed,
    "groups.mainHoist.liftSpeed.parts.range"
  );
  if (mainSpeedRaw && mainSpeed === null) {
    warnings.push(`Ana kaldırma hızı tek değere indirgenemedi: “${mainSpeedRaw}”.`);
  }

  const auxSpeedRaw = part(item, "auxHoist", "liftSpeed", "range");
  const auxSpeed = positiveNumber(auxSpeedRaw);
  setNumber(
    "auxLiftSpeedMpm",
    auxSpeed,
    "groups.auxHoist.liftSpeed.parts.range"
  );
  if (auxSpeedRaw && auxSpeed === null) {
    warnings.push(`Yardımcı kaldırma hızı tek değere indirgenemedi: “${auxSpeedRaw}”.`);
  }

  const trolleySpeedRaw = part(item, "trolley", "travelSpeed", "range");
  const trolleySpeed = positiveNumber(trolleySpeedRaw);
  setNumber(
    "trolleySpeedMpm",
    trolleySpeed,
    "groups.trolley.travelSpeed.parts.range"
  );
  if (trolleySpeedRaw && trolleySpeed === null) {
    warnings.push(`Araba yürüme hızı tek değere indirgenemedi: “${trolleySpeedRaw}”.`);
  }

  const bridgeGroup = visibleGroups(item).some((group) => group.key === "bridge")
    ? "bridge"
    : "gantry";
  const bridgeSpeedRaw = part(item, bridgeGroup, "travelSpeed", "range");
  const bridgeSpeed = positiveNumber(bridgeSpeedRaw);
  setNumber(
    "bridgeSpeedMpm",
    bridgeSpeed,
    `groups.${bridgeGroup}.travelSpeed.parts.range`
  );
  if (bridgeSpeedRaw && bridgeSpeed === null) {
    warnings.push(`Köprü/portal yürüme hızı tek değere indirgenemedi: “${bridgeSpeedRaw}”.`);
  }

  const classValue = rowOf(item, "general", "craneClass")?.value.trim() ?? "";
  const classToken = classValue.toUpperCase().match(/(?:^|[^A-Z0-9])(A[1-8])(?:$|[^A-Z0-9])/)?.[1];
  if (classToken) {
    facts.structureClass = classToken as TechnicalSpecs["structureClass"];
    mapped.push("groups.general.craneClass.value");
  } else if (classValue) {
    warnings.push(`Vinç sınıfından A1–A8 yapı sınıfı okunamadı: “${classValue}”.`);
  }

  const environment = rowOf(item, "general", "environment");
  const tempMin = singleNumber(environment?.manual ? undefined : environment?.parts?.tempMin);
  const tempMax = singleNumber(environment?.manual ? undefined : environment?.parts?.tempMax);
  setNumber(
    "ambientTempMinC",
    tempMin,
    "groups.general.environment.parts.tempMin",
    false
  );
  setNumber(
    "ambientTempMaxC",
    tempMax,
    "groups.general.environment.parts.tempMax",
    false
  );
  const place = environment?.manual ? "" : environment?.parts?.place?.trim() ?? "";
  if (/açık/i.test(place)) {
    facts.installationEnvironment = "outdoor";
    mapped.push("groups.general.environment.parts.place");
  } else if (/kapalı/i.test(place)) {
    facts.installationEnvironment = "indoor";
    mapped.push("groups.general.environment.parts.place");
  } else if (place) {
    warnings.push(`Çalışma ortamı açık/kapalı olarak eşleştirilemedi: “${place}”.`);
  }

  setText(
    "supplyVoltage",
    rowOf(item, "electrical", "supplyVoltage")?.value ?? "",
    "groups.electrical.supplyVoltage.value"
  );
  setText(
    "controlVoltage",
    rowOf(item, "electrical", "controlVoltage")?.value ?? "",
    "groups.electrical.controlVoltage.value"
  );

  return { facts, mapped, warnings };
}

function quantityText(qty: number, unit: string): string {
  const number = Number.isInteger(qty) ? String(qty) : String(qty).replace(".", ",");
  return unit.trim() ? `${number} ${unit.trim()}` : number;
}

function quantityFor(lines: OfferPriceLine[]): {
  quantity: string;
  optional: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];
  const primary = lines.filter((line) => !line.hidden && !line.parentLineId);
  const required = primary.filter((line) => !line.optional);
  const relevant = required.length > 0 ? required : primary;
  const optional = primary.length > 0 && required.length === 0;
  if (relevant.length === 0) {
    return { quantity: "", optional: false, warnings: ["Teklifte bu kalem için açık adet bulunamadı."] };
  }
  if (relevant.some((line) => line.qty === null || !Number.isFinite(line.qty))) {
    return { quantity: "", optional, warnings: ["Fiyat satırlarının birinde adet boş; kullanıcı kontrolü gerekli."] };
  }
  const variants = new Set(
    relevant.map((line) => `${line.qty}|${line.unit.trim().toLocaleLowerCase("tr-TR")}`)
  );
  if (variants.size !== 1) {
    return { quantity: "", optional, warnings: ["Bağlı fiyat satırlarında adet veya birim çelişiyor."] };
  }
  const first = relevant[0];
  return {
    quantity: quantityText(first.qty as number, first.unit),
    optional,
    warnings,
  };
}

function unmappedRows(item: OfferItem, mapped: readonly string[]) {
  const mappedSet = new Set(mapped);
  const out: Array<{ path: string; label: string; value: string }> = [];
  for (const group of visibleGroups(item)) {
    for (const row of visibleRows(group)) {
      const base = `groups.${group.key}.${row.key}`;
      const rowMapped = [...mappedSet].some((path) => path.startsWith(`${base}.`));
      if (!rowMapped && (row.value.trim() || Object.values(row.parts ?? {}).some(Boolean))) {
        out.push({ path: base, label: row.label.trim(), value: row.value.trim() });
      }
    }
  }
  return out;
}

function supportedCraneType(type: string): boolean {
  const normalized = type.toLocaleLowerCase("tr-TR");
  return normalized.includes("vinç") || normalized.includes("vinc");
}

function candidateFromItem(item: OfferItem, priceLines: OfferPriceLine[]): OfferJobCandidate {
  const linked = priceLines.filter((line) => line.itemId === item.id);
  const quantity = quantityFor(linked);
  const technical = factCollector(item);
  const craneType = item.craneType?.trim() ?? "";
  const factCount = Object.keys(technical.facts).length;
  const eligibility: EngineeringEligibility =
    supportedCraneType(craneType) && factCount > 0
      ? "eligible"
      : visibleGroups(item).length > 0 || craneType
        ? "review"
        : "not_applicable";
  const warnings = [...quantity.warnings, ...technical.warnings];
  if (!item.title.trim()) warnings.push("Teknik kalemin ürün adı boş; iş emrinde doldurulmalı.");
  if (eligibility === "review") {
    warnings.push("Bu kalemin hesap raporuna uygunluğu mühendis tarafından doğrulanmalı.");
  }
  return {
    sourceRef: sourceRef("technicalItem", item.id),
    sourceType: "technicalItem",
    sourceId: item.id,
    included: !quantity.optional,
    productName: item.title.trim(),
    quantity: quantity.quantity,
    optional: quantity.optional,
    eligibility,
    craneType,
    technicalFacts: technical.facts,
    technicalSnapshot: snapshotOf(item),
    mappedFields: technical.mapped,
    warnings,
    unmapped: unmappedRows(item, technical.mapped),
  };
}

function candidateFromStandalone(line: OfferPriceLine): OfferJobCandidate {
  const quantity =
    line.qty !== null && Number.isFinite(line.qty)
      ? quantityText(line.qty, line.unit)
      : "";
  return {
    sourceRef: sourceRef("standalonePriceLine", line.id),
    sourceType: "standalonePriceLine",
    sourceId: line.id,
    included: false,
    productName: line.description.trim(),
    quantity,
    optional: line.optional === true,
    eligibility: "not_applicable",
    craneType: "",
    technicalFacts: {},
    technicalSnapshot: standaloneSnapshot(line),
    mappedFields: [],
    warnings: [
      "Teknik kaleme bağlı olmayan fiyat satırı; iş emrine eklenmesi kullanıcı onayı gerektirir.",
      ...(quantity ? [] : ["Bu satırın adedi açık değil."]),
    ],
    unmapped: [],
  };
}

function visibleTerm(payload: OfferPayload, key: string): OfferRow | undefined {
  return payload.terms.rows.find((row) => row.key === key && !row.hidden);
}

function durationUnit(text: string): "day" | "week" | "month" | null {
  const normalized = text.toLocaleLowerCase("tr-TR");
  if (/\b(gün|gun|day|days)\b/.test(normalized)) return "day";
  if (/\b(hafta|week|weeks)\b/.test(normalized)) return "week";
  if (/\b(ay|month|months)\b/.test(normalized)) return "month";
  return null;
}

function unitDays(unit: "day" | "week" | "month"): number {
  return unit === "day" ? 1 : unit === "week" ? 7 : 30;
}

/**
 * Serbest teslim metnindeki bütün sayıları tarar ve aralığın EN UZUN ucunu
 * gün olarak döndürür. Birim bilinmiyorsa sayı tek başına yorumlanmaz.
 */
export function offerLeadTimeDays(text: string, unitHint = ""): number | null {
  const unit = durationUnit(unitHint) ?? durationUnit(text);
  if (!unit) return null;
  const numbers = (text.match(/\d+(?:[.,]\d+)?/g) ?? [])
    .map((token) => Number(token.replace(",", ".")))
    .filter((value) => Number.isFinite(value) && value >= 0);
  if (numbers.length === 0) return null;
  return Math.round(Math.max(...numbers) * unitDays(unit));
}

function deliveryRowDays(row: OfferRow | undefined): number | null {
  if (!row) return null;
  const unit = row.parts?.unit ?? "";
  const range = [row.parts?.from, row.parts?.to].filter(Boolean).join("-");
  return offerLeadTimeDays(range || row.value, unit || row.value);
}

function deliveryHintOf(row: OfferRow | undefined): string {
  if (!row) return "";
  if (row.value.trim()) return row.value.trim();
  const range = [row.parts?.from, row.parts?.to].filter(Boolean).join("-");
  return [row.parts?.trigger, range, row.parts?.unit].filter(Boolean).join(" ").trim();
}

function dateInIstanbul(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((entry) => entry.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function addDays(value: string, days: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return "";
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + days));
  return date.toISOString().slice(0, 10);
}

export interface OfferJobSchedule {
  contractDate: string;
  deliveryDate: string;
  workshopExitDate: string;
  deliveryDays: number | null;
  workshopBufferDays: number | null;
}

/** Yayım günü + azami termin; atölye çıkışı toplam sürenin %10'u erkendir. */
export function offerJobSchedule(
  issuedAt: string | null | undefined,
  deliveryDays: number | null
): OfferJobSchedule {
  const contractDate = issuedAt ? dateInIstanbul(issuedAt) : "";
  if (!contractDate || deliveryDays === null || deliveryDays < 0) {
    return {
      contractDate,
      deliveryDate: "",
      workshopExitDate: "",
      deliveryDays: null,
      workshopBufferDays: null,
    };
  }
  const normalizedDays = Math.round(deliveryDays);
  const deliveryDate = addDays(contractDate, normalizedDays);
  const workshopBufferDays = Math.max(1, Math.round(normalizedDays * 0.1));
  return {
    contractDate,
    deliveryDate,
    workshopExitDate: addDays(deliveryDate, -workshopBufferDays),
    deliveryDays: normalizedDays,
    workshopBufferDays,
  };
}

/** Değişken teklif belgesini düzenlenebilir iş emri adaylarına ayırır. */
export function buildJobDraftFromOffer(payload: OfferPayload): OfferJobDraft {
  const visibleItems = payload.items.filter((item) => !item.hidden);
  const technical = visibleItems.map((item) =>
    candidateFromItem(item, payload.pricing.lines)
  );
  const standalone = payload.pricing.lines
    .filter(
      (line) =>
        line.itemId === null &&
        !line.hidden &&
        !line.parentLineId &&
        line.description.trim() !== ""
    )
    .map(candidateFromStandalone);

  const delivery = visibleTerm(payload, "deliveryTime");
  const freight = visibleTerm(payload, "freight");
  const deliveryPlace = visibleTerm(payload, "deliveryPlace");
  const deliveryHint = deliveryHintOf(delivery);
  const lineDeliveryDays = payload.pricing.lines
    .filter((line) => !line.hidden && !line.optional && line.leadTime?.trim())
    .map((line) => offerLeadTimeDays(line.leadTime ?? "", payload.pricing.leadTimeUnit ?? ""))
    .filter((value): value is number => value !== null);
  const deliveryCandidates = [deliveryRowDays(delivery), ...lineDeliveryDays].filter(
    (value): value is number => value !== null
  );
  const deliveryDays = deliveryCandidates.length > 0 ? Math.max(...deliveryCandidates) : null;
  const shippingHint =
    freight?.parts?.place?.trim() || deliveryPlace?.value.trim() || "";

  const warnings: string[] = [];
  if (technical.length === 0) {
    warnings.push("Teklifte görünür teknik kalem yok; iş kalemlerini kullanıcı eklemeli.");
  }
  if (standalone.length > 0) {
    warnings.push(`${standalone.length} bağımsız fiyat satırı ayrıca iş kalemi adayı olarak gösteriliyor.`);
  }

  return {
    mappingVersion: OFFER_JOB_MAPPING_VERSION,
    candidates: [...technical, ...standalone],
    deliveryHint,
    deliveryDays,
    shippingHint,
    scopeSuggestions: {
      proje: true,
      devreyeAlma: true,
      malzeme: true,
      nakliye: true,
      imalat: true,
      montaj: true,
    },
    warnings,
  };
}

/**
 * DB'den veya istemciden gelen aktarım olgusunu hesap girdisine taşınabilecek
 * dar beyaz listeye çevirir. Selections alanına hiçbir şey yazmaz.
 */
export function engineeringSpecsPatch(
  value: unknown
): EngineeringTechnicalFacts {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const raw = value as Record<string, unknown>;
  const out: EngineeringTechnicalFacts = {};
  const positiveKeys: EngineeringTechnicalFactKey[] = [
    "mainCapacityT",
    "auxCapacityT",
    "spanM",
    "mainLiftHeightM",
    "mainLiftSpeedMpm",
    "auxLiftSpeedMpm",
    "bridgeSpeedMpm",
    "trolleySpeedMpm",
    "runwayLengthM",
  ];
  for (const key of positiveKeys) {
    const number = raw[key];
    if (typeof number === "number" && Number.isFinite(number) && number > 0) {
      (out as Record<string, unknown>)[key] = number;
    }
  }
  for (const key of ["ambientTempMinC", "ambientTempMaxC"] as const) {
    const number = raw[key];
    if (typeof number === "number" && Number.isFinite(number)) out[key] = number;
  }
  if (typeof raw.structureClass === "string" && /^A[1-8]$/.test(raw.structureClass)) {
    out.structureClass = raw.structureClass as TechnicalSpecs["structureClass"];
  }
  if (raw.installationEnvironment === "indoor" || raw.installationEnvironment === "outdoor") {
    out.installationEnvironment = raw.installationEnvironment;
  }
  if (typeof raw.supplyVoltage === "string" && raw.supplyVoltage.trim()) {
    out.supplyVoltage = raw.supplyVoltage.trim().slice(0, 120);
  }
  if (typeof raw.controlVoltage === "string" && raw.controlVoltage.trim()) {
    out.controlVoltage = raw.controlVoltage.trim().slice(0, 120);
  }
  return out;
}
