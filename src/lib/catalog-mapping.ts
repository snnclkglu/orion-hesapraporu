// Katalogdan seçim eşlemeleri — revizyon editöründeki "Katalogdan Seç"
// combobox'unun modül bölümü → cat_equipment kind + attrs → selection alanı
// haritası. Eşlenemeyen attrs alanları doldurulmaz; manuel giriş her zaman
// mümkün kalır (katalog dışı ürün).
//
// Anahtar: bölümün ham id'si (rawId). Ana/yrd kaldırma aynı 2.x bölümlerini,
// araba/köprü aynı 5.x bölümlerini paylaşır — eşlemeler modül grubuna göredir.

export interface CatalogRow {
  id: string;
  brand: string;
  model: string;
  attrs: Record<string, unknown>;
}

/** Seçim alanının katalog satırındaki kaynağı */
type FieldSource =
  | "brand"
  | "model"
  | "brand_model" // "MARKA MODEL" birleşik metni
  | { attr: string };

export interface CatalogFieldMap {
  /** Doldurulacak selection alanı */
  sel: string;
  from: FieldSource;
  /** Sayısal birim dönüşümü (ör. Nm → kNm için 0.001) */
  scale?: number;
}

export interface SectionCatalogMapping {
  /** cat_equipment.kind */
  kind: string;
  fields: CatalogFieldMap[];
}

// ---------------------------------------------------------------- özetler

const numFmt = (v: unknown): string =>
  typeof v === "number" ? v.toLocaleString("tr-TR", { maximumFractionDigits: 2 }) : String(v ?? "");

/** Combobox satırında marka+model yanında gösterilen ana özellik özeti */
export function catalogRowSummary(kind: string, row: CatalogRow): string {
  const a = row.attrs;
  switch (kind) {
    case "motor":
      return `${numFmt(a.power_kw)} kW · ${numFmt(a.rpm)} d/dak · ${numFmt(a.poles)}K`;
    case "gearbox":
      return `i=${numFmt(a.ratio)} · ${numFmt(a.output_torque_nm)} Nm · n₁=${numFmt(a.input_speed_rpm)}`;
    case "rope":
      return `Ø${numFmt(a.dia_mm)} mm · ${numFmt(a.breaking_load_kn)} kN · ${a.core ?? ""}`;
    case "brake":
      return a.brake_torque_nm !== undefined
        ? `${numFmt(a.brake_torque_nm)} Nm${a.wheel_dia_mm !== undefined ? ` · Ø${numFmt(a.wheel_dia_mm)}` : ""}`
        : `Ø${numFmt(a.wheel_dia_mm)} mm`;
    case "bearing":
      return `C=${numFmt(a.dynamic_load_kn)} kN · C₀=${numFmt(a.static_load_kn)} kN`;
    case "wheel":
      return `Ø${numFmt(a.dia_mm)} mm · ${numFmt(a.max_load_kn)} kN`;
    case "hook":
      return `d₁=${numFmt(a.d1_shaft_mm)} mm · ${a.thread ?? ""}`;
    case "sheave":
      return `Ø${numFmt(a.dia_mm)} mm · halat ≤ ${numFmt(a.max_rope_mm)} mm`;
    case "coupling":
      return `${numFmt(a.nominal_torque_nm)} Nm${a.max_shaft_dia_mm !== undefined ? ` · d ≤ ${numFmt(a.max_shaft_dia_mm)} mm` : ""}`;
    default:
      return "";
  }
}

// ---------------------------------------------------------------- eşlemeler

/** Kaldırma grupları (ana 2.x / yrd 3.x — rawId 2.x) */
const HOIST_MAP: Record<string, SectionCatalogMapping> = {
  // 2.1 Halat
  "2.1": {
    kind: "rope",
    fields: [
      { sel: "ropeBrand", from: "brand" },
      { sel: "ropeDiaMm", from: { attr: "dia_mm" } },
      { sel: "ropeConstruction", from: { attr: "construction" } },
      { sel: "ropeCore", from: { attr: "core" } },
      { sel: "ropeWireStrength", from: { attr: "wire_strength_kgmm2" } },
      { sel: "ropeBreakingLoadKn", from: { attr: "breaking_load_kn" } },
    ],
  },
  // 2.2.6 Tambur rulmanı
  "2.2.6": {
    kind: "bearing",
    fields: [
      { sel: "bearingType", from: { attr: "type" } },
      { sel: "bearingCode", from: "model" },
      { sel: "bearingDynCKn", from: { attr: "dynamic_load_kn" } },
      { sel: "bearingStatC0Kn", from: { attr: "static_load_kn" } },
    ],
  },
  // 2.3 Redüktör
  "2.3": {
    kind: "gearbox",
    fields: [
      { sel: "gearboxModel", from: "model" },
      { sel: "gearboxRatio", from: { attr: "ratio" } },
      { sel: "gearboxNominalTorqueKnm", from: { attr: "output_torque_nm" }, scale: 0.001 },
      { sel: "gearboxOutputShaftMm", from: { attr: "output_shaft_mm" } },
    ],
  },
  // 2.4 Motor
  "2.4": {
    kind: "motor",
    fields: [
      { sel: "motorBrand", from: "brand" },
      { sel: "motorPowerKw", from: { attr: "power_kw" } },
      { sel: "motorRpm", from: { attr: "rpm" } },
    ],
  },
  // 2.5 Fren
  "2.5": {
    kind: "brake",
    fields: [
      { sel: "brakeBrand", from: "brand" },
      { sel: "brakeModel", from: "model" },
      { sel: "brakeTorqueNm", from: { attr: "brake_torque_nm" } },
      { sel: "brakeWheelDiaMm", from: { attr: "wheel_dia_mm" } },
    ],
  },
  // 2.6 Motor — redüktör kaplini
  "2.6": {
    kind: "coupling",
    fields: [
      { sel: "motorCouplingBrand", from: "brand" },
      { sel: "motorCouplingModel", from: "model" },
      { sel: "motorCouplingTorqueNm", from: { attr: "nominal_torque_nm" } },
      { sel: "motorCouplingDmaxMm", from: { attr: "max_shaft_dia_mm" } },
    ],
  },
  // 2.7 Tambur kaplini
  "2.7": {
    kind: "coupling",
    fields: [
      { sel: "drumCouplingBrand", from: "brand" },
      { sel: "drumCouplingModel", from: "model" },
      { sel: "drumCouplingTorqueNm", from: { attr: "nominal_torque_nm" } },
      { sel: "drumCouplingRadialN", from: { attr: "max_radial_load_n" } },
      { sel: "drumCouplingDmaxMm", from: { attr: "max_shaft_dia_mm" } },
    ],
  },
};

/** Kanca bloğu (4.x) */
const HOOKBLOCK_MAP: Record<string, SectionCatalogMapping> = {
  // 4.1 Kanca
  "4.1": {
    kind: "hook",
    fields: [{ sel: "hookDesignation", from: "model" }],
  },
  // 4.2 Makaralar
  "4.2": {
    kind: "sheave",
    fields: [{ sel: "sheaveDiaMm", from: { attr: "dia_mm" } }],
  },
  // 4.3 Makara rulmanları
  "4.3": {
    kind: "bearing",
    fields: [
      { sel: "sheaveBearingType", from: { attr: "type" } },
      { sel: "sheaveBearingCode", from: "model" },
      { sel: "sheaveBearingDynCKn", from: { attr: "dynamic_load_kn" } },
      { sel: "sheaveBearingStatC0Kn", from: { attr: "static_load_kn" } },
    ],
  },
  // 4.5 Kanca rulmanı
  "4.5": {
    kind: "bearing",
    fields: [
      { sel: "hookBearingType", from: { attr: "type" } },
      { sel: "hookBearingCode", from: "model" },
      { sel: "hookBearingStatC0Kn", from: { attr: "static_load_kn" } },
    ],
  },
};

/** Yürütme grupları (araba 5.x / köprü 6.x — rawId 5.x) */
const TRAVEL_MAP: Record<string, SectionCatalogMapping> = {
  // 5.1 Tekerlekler
  "5.1": {
    kind: "wheel",
    fields: [{ sel: "wheelDiaMm", from: { attr: "dia_mm" } }],
  },
  // 5.3 Tekerlek rulmanı
  "5.3": {
    kind: "bearing",
    fields: [
      { sel: "bearingType", from: { attr: "type" } },
      { sel: "bearingCode", from: "model" },
      { sel: "bearingDynCKn", from: { attr: "dynamic_load_kn" } },
      { sel: "bearingStatC0Kn", from: { attr: "static_load_kn" } },
    ],
  },
  // 5.4 Yürütme motoru
  "5.4": {
    kind: "motor",
    fields: [
      { sel: "motorBrand", from: "brand" },
      { sel: "motorPowerKw", from: { attr: "power_kw" } },
      { sel: "motorRpm", from: { attr: "rpm" } },
    ],
  },
  // 5.5 Yürütme dişli kutusu
  "5.5": {
    kind: "gearbox",
    fields: [
      { sel: "gearboxModel", from: "model" },
      { sel: "gearboxRatio", from: { attr: "ratio" } },
      { sel: "gearboxOutputTorqueKnm", from: { attr: "output_torque_nm" }, scale: 0.001 },
      { sel: "gearboxOutputShaftMm", from: { attr: "output_shaft_mm" } },
    ],
  },
  // 5.5b Yürütme freni (köprü)
  "5.5b": {
    kind: "brake",
    fields: [
      { sel: "brakeBrand", from: "brand_model" },
      { sel: "brakeTorqueNm", from: { attr: "brake_torque_nm" } },
      { sel: "brakeWheelDiaMm", from: { attr: "wheel_dia_mm" } },
    ],
  },
  // 5.6 Motor — dişli kutusu kaplini
  "5.6": {
    kind: "coupling",
    fields: [
      { sel: "motorCouplingBrand", from: "brand" },
      { sel: "motorCouplingModel", from: "model" },
      { sel: "motorCouplingTorqueNm", from: { attr: "nominal_torque_nm" } },
      { sel: "motorCouplingDmaxMm", from: { attr: "max_shaft_dia_mm" } },
    ],
  },
  // 5.7 Teker — dişli kutusu kaplini
  "5.7": {
    kind: "coupling",
    fields: [
      { sel: "wheelCouplingBrand", from: "brand" },
      { sel: "wheelCouplingModel", from: "model" },
      { sel: "wheelCouplingTorqueNm", from: { attr: "nominal_torque_nm" } },
      { sel: "wheelCouplingDmaxMm", from: { attr: "max_shaft_dia_mm" } },
    ],
  },
};

const MAP_BY_MODULE: Record<string, Record<string, SectionCatalogMapping>> = {
  main: HOIST_MAP,
  aux: HOIST_MAP,
  hookBlock: HOOKBLOCK_MAP,
  trolley: TRAVEL_MAP,
  bridge: TRAVEL_MAP,
};

/** Bölümün katalog eşlemesi (yoksa combobox gösterilmez) */
export function getCatalogMapping(
  moduleKey: string,
  rawSectionId: string
): SectionCatalogMapping | undefined {
  return MAP_BY_MODULE[moduleKey]?.[rawSectionId];
}

/** Seçilen katalog satırını selection alanlarına çevirir (eşlenemeyenler atlanır) */
export function applyCatalogPick(
  mapping: SectionCatalogMapping,
  row: CatalogRow
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of mapping.fields) {
    let v: unknown;
    if (f.from === "brand") v = row.brand;
    else if (f.from === "model") v = row.model;
    else if (f.from === "brand_model") v = `${row.brand} ${row.model}`.trim();
    else v = row.attrs[f.from.attr];
    if (v === undefined || v === null || v === "") continue;
    if (f.scale !== undefined && typeof v === "number") v = v * f.scale;
    out[f.sel] = v;
  }
  return out;
}
