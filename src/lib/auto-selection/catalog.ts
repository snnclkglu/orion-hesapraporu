import { applyCatalogPick, type SectionCatalogMapping } from "@/lib/catalog-mapping";
import { contentHash, type EquipmentRow } from "./types";
import { kimlikBuyuk } from "@/lib/tr-text";

export function positive(value: unknown): number | undefined {
  if (typeof value !== "number" && typeof value !== "string") return undefined;
  if (typeof value === "string" && !/^\s*\d+(?:[.,]\d+)?\s*$/.test(value)) return undefined;
  const n = typeof value === "number" ? value : Number(value.trim().replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : undefined;
}
export function variantKey(row: EquipmentRow): string {
  return `${row.kind}:${row.brand}:${row.model}:${contentHash(row.attrs)}`;
}
export function matchesFacets(row: EquipmentRow, mapping: SectionCatalogMapping): boolean {
  return row.kind === mapping.kind && Object.entries(mapping.lockedFacets ?? {}).every(([attr, expected]) =>
    (Array.isArray(expected) ? expected : [expected]).includes(String(row.attrs[attr] ?? "")));
}

/** Ürün değişimi birleştirme değildir: ürüne ait eksik değerler temizlenir. */
export function replaceCatalogSelection(mapping: SectionCatalogMapping, row: EquipmentRow, previous: object): Record<string, unknown> {
  const normalized = { ...row, attrs: { ...row.attrs } };
  for (const field of mapping.fields) {
    if (typeof field.from !== "object") continue;
    const attr = field.from.attr;
    // Sayı alanı olduğu birim/katsayıyla kesin olanlar normalize edilir.
    if (field.scale !== undefined || /(?:_mm|_kn|_nm|_kw|_rpm|_kg|_kg_per_m|_kgmm2|_n|_kj|_mpm)$/.test(attr) || attr === "ratio" || attr === "dia_mm") {
      normalized.attrs[attr] = positive(row.attrs[attr]) ?? null;
    }
  }
  const out = { ...previous } as Record<string, unknown>;
  for (const field of mapping.fields) out[field.sel] = null;
  Object.assign(out, applyCatalogPick(mapping, normalized));
  if ("hookNumber" in out && out.hookNumber != null) out.hookNumber = String(out.hookNumber);
  return out;
}

const REQUIRED: Record<string, string[]> = {
  rope: ["dia_mm", "breaking_load_kn", "weight_kg_per_m"],
  motor: ["power_kw", "rpm", "shaft_mm"],
  gearbox: ["ratio", "input_speed_rpm", "output_torque_nm", "output_shaft_mm"],
  brake: ["brake_torque_nm"], coupling: ["nominal_torque_nm", "max_shaft_dia_mm"],
  bearing: ["bore_mm", "static_load_kn"], wheel: ["dia_mm"], sheave: ["dia_mm"],
  hook: ["hook_nr"], buffer: ["stroke_mm"],
  bearing_housing: ["bearing_bore_mm", "housing_width_mm"],
};
export function missingCatalogFields(row: EquipmentRow): string[] {
  const required = [...(REQUIRED[row.kind] ?? [])];
  if (row.kind === "gearbox" && !(row.attrs.application === "yurutme" && row.attrs.input_configuration === "Motor akuple")) required.push("input_shaft_mm");
  if (row.kind === "coupling" && ["drum", "barrel"].includes(String(row.attrs.coupling_type))) required.push("max_radial_load_n");
  if (row.kind === "gearbox" && row.attrs.application === "kaldirma") required.push("allowed_radial_output_kn");
  return required.filter(key => positive(row.attrs[key]) === undefined);
}

export function normalizeCatalog(rows: EquipmentRow[]): EquipmentRow[] {
  const unique = new Map<string, EquipmentRow>();
  for (const source of rows) {
    const row = { ...source, brand: kimlikBuyuk(source.brand) };
    if (!row.id || !row.brand || !row.model || !row.attrs || row.attrs.unverified === true) continue;
    const key = variantKey(row);
    const old = unique.get(key);
    if (!old || row.id < old.id) unique.set(key, row);
  }
  return [...unique.entries()].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([, row]) => row);
}
