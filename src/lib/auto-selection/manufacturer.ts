import type { EquipmentRow } from "./types";
import type { TechnicalSpecs } from "@/lib/calc/types";
import { positive } from "./catalog";

/** Dereli DYF: yay baskılı, enerji verilince açılan seri. Kaynak: üretici
 * derelifren.com.tr ve catalog_data/brakes/dereli_dyf_em.json seri künyesi.
 * Seri bilgisi montaj/çevrim/ısıl enerji onayı yerine geçmez. */
export function hoistServiceBrakeSupported(row: EquipmentRow): boolean {
  return row.attrs.brake_type === "drum" ? !!positive(row.attrs.wheel_dia_mm)
    : row.attrs.brake_type === "em" && (row.attrs.spring_applied === true || (row.brand === "Dereli" && /^DYF\d+$/.test(row.model)));
}
export function brakeDrumOptions(row: EquipmentRow): number[] {
  return [row.attrs.brake_drum_diameter_mm, ...(Array.isArray(row.attrs.brake_dia_options_mm) ? row.attrs.brake_dia_options_mm : [])].flatMap(value => positive(value) ?? []);
}
/** Yalnız açık katalog sınırı eler. Eksik sınır uygunluk onayı oluşturmaz. */
export function manufacturerConditionsMatch(row: EquipmentRow, specs: TechnicalSpecs): boolean {
  if (row.kind !== "motor") return true;
  const supply = String(specs.supplyVoltage ?? "");
  const voltage = Number(/(\d+(?:[.,]\d+)?)\s*V(?:AC|DC)?\b/i.exec(supply)?.[1]?.replace(",", "."));
  const frequency = Number(/(\d+(?:[.,]\d+)?)\s*Hz\b/i.exec(supply)?.[1]?.replace(",", "."));
  const voltages = Array.isArray(row.attrs.voltages_v) ? row.attrs.voltages_v.flatMap(value => positive(value) ?? []) : positive(row.attrs.voltage_v) ? [Number(row.attrs.voltage_v)] : [];
  if (voltage && voltages.length && !voltages.includes(voltage)) return false;
  if (frequency && positive(row.attrs.frequency_hz) && Number(row.attrs.frequency_hz) !== frequency) return false;
  return true;
}
