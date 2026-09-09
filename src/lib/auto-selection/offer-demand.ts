import type { TechnicalSpecs } from "@/lib/calc/types";
import type { OfferItem } from "@/lib/offers/types";
import { GROUND_CRANE_TYPE } from "@/lib/crane-types";
import { contentHash } from "./types";
import { requestedBrakeFamily } from "./brands";

export interface OfferDemand {
  version: 1;
  craneType: string;
  values: Partial<Record<keyof TechnicalSpecs, string | number | null>>;
  missing: string[];
  fingerprint: string;
}
/** Kapasite aralığı sayı değildir; çift hızda yüksek çalışma hızı alınır. */
export function technicalNumber(text: string, speed = false): number | undefined {
  const normalized = text.trim().replaceAll(",", ".");
  if (/^\d+(?:\.\d+)?$/.test(normalized)) { const value = Number(normalized); return Number.isFinite(value) && value > 0 ? value : undefined; }
  if (speed && /^\d+(?:\.\d+)?\s*[/–-]\s*\d+(?:\.\d+)?$/.test(normalized)) {
    const values = normalized.split(/[/–-]/).map(Number);
    return values.every(value => Number.isFinite(value) && value > 0) ? Math.max(...values) : undefined;
  }
  return undefined;
}
export const DEMAND_NUMBERS = [
  ["mainCapacityT", "general", "capacity", "main", "Ana kapasite", false],
  ["auxCapacityT", "general", "capacity", "aux", "Yardımcı kapasite", false],
  ["spanM", "general", "span", "value", "Açıklık", false],
  ["mainLiftHeightM", "general", "liftHeight", "value", "Kaldırma yüksekliği", false],
  ["mainLiftSpeedMpm", "mainHoist", "liftSpeed", "range", "Kaldırma hızı", true],
  ["auxLiftSpeedMpm", "auxHoist", "liftSpeed", "range", "Yardımcı kaldırma hızı", true],
  ["trolleySpeedMpm", "trolley", "travelSpeed", "range", "Araba hızı", true],
  ["bridgeSpeedMpm", "bridge", "travelSpeed", "range", "Köprü hızı", true],
  ["runwayLengthM", "general", "runway", "value", "Yürüme yolu", false],
] as const;

export function offerDemand(item: OfferItem): OfferDemand {
  const values: OfferDemand["values"] = {};
  const missing: string[] = [];
  const raw: Record<string, unknown> = {};
  const groupKey = (key: string) => key === "bridge" && !item.groups.some(group => group.key === "bridge") ? "gantry" : key;
  const rowOf = (group: string, key: string) => item.groups.find(g => g.key === groupKey(group))?.rows.find(row => row.key === key);
  const get = (group: string, key: string, part?: string) => {
    const row = rowOf(group, key);
    const value = row ? row.manual ? row.value : part ? row.parts?.[part] ?? "" : row.value : "";
    raw[`${group}.${key}.${part ?? "value"}`] = row?.manual ? { manual: value } : value;
    return row?.manual ? "" : value ?? "";
  };
  const auxiliary = technicalNumber(get("general", "capacity", "aux")) !== undefined;
  for (const [field, group, key, part, label, speed] of DEMAND_NUMBERS) {
    const value = technicalNumber(get(group, key, part), speed);
    const required = field === "mainCapacityT" || field === "mainLiftHeightM" || field === "mainLiftSpeedMpm"
      || field === "spanM" && item.craneType !== GROUND_CRANE_TYPE
      || field === "auxLiftSpeedMpm" && auxiliary
      || ["trolleySpeedMpm", "bridgeSpeedMpm"].includes(field) && item.craneType !== GROUND_CRANE_TYPE && !!rowOf(group, key);
    if (value !== undefined) values[field] = value;
    else if (required) { values[field] = null; missing.push(label); }
  }
  const structure = get("general", "craneClass").match(/(?:^|\W)(A[1-8])(?:$|\W)/i)?.[1];
  if (structure) values.structureClass = structure.toUpperCase();
  const hook = get("mainHoist", "hook");
  if (hook.trim()) values.hookType = hook;
  const brakeName: Record<string, string> = { em: "Manyetik Fren", drum: "Eldro Fren", disc: "Disk Fren" };
  const hoistBrake = requestedBrakeFamily(get("mainHoist", "brake", "type"));
  if (hoistBrake) values.hoistBrakeType = brakeName[hoistBrake];
  const travelBrakes = ["trolley", "bridge"].map(group => requestedBrakeFamily(get(group, "brake", "type"))).filter((type): type is string => !!type);
  if (new Set(travelBrakes).size === 1) values.travelBrakeType = brakeName[travelBrakes[0]];
  else if (new Set(travelBrakes).size > 1) { values.travelBrakeType = "Çelişen yürütme freni tipleri"; missing.push("Araba ve köprü için farklı fren tipleri mevcut; ortak yürütme freni alanında ayrı düzenleme gerekiyor"); }
  for (const [field, part] of [["ambientTempMinC", "tempMin"], ["ambientTempMaxC", "tempMax"]] as const) {
    const value = get("general", "environment", part).trim().replace(",", ".");
    if (/^[+-]?\d+(?:\.\d+)?$/.test(value) && Number.isFinite(Number(value))) values[field] = Number(value);
  }
  const place = get("general", "environment", "place").toLocaleLowerCase("tr-TR");
  if (place.includes("açık")) values.installationEnvironment = "outdoor";
  else if (place.includes("kapalı")) values.installationEnvironment = "indoor";
  for (const field of ["supplyVoltage", "controlVoltage"] as const) { const value = get("electrical", field).trim(); if (value) values[field] = value; }
  return { version: 1, craneType: item.craneType ?? "", values, missing, fingerprint: contentHash({ craneType: item.craneType, values, raw }) };
}

export function offerDemandDifferences(item: OfferItem, specs: TechnicalSpecs): string[] {
  const demand = offerDemand(item);
  return Object.entries(demand.values).filter(([key, value]) => {
    if (value == null) return false; // Eksik talep raporda tamamlanabilir; şablonla seçim ön kontrolü geçemez.
    const actual = specs[key as keyof TechnicalSpecs];
    if (key === "hookType") return (String(actual).match(/1540[1278]/)?.[0] ?? String(actual).trim()) !== (String(value).match(/1540[1278]/)?.[0] ?? String(value).trim());
    if (key === "hoistBrakeType" || key === "travelBrakeType") return requestedBrakeFamily(String(actual)) !== requestedBrakeFamily(String(value));
    return typeof value === "number" ? typeof actual !== "number" || Math.abs(actual - value) > 1e-8 * Math.max(1, Math.abs(value)) : actual !== value;
  }).map(([key]) => DEMAND_NUMBERS.find(row => row[0] === key)?.[4] ?? ({ structureClass: "Yapı sınıfı", hookType: "Kanca tipi", installationEnvironment: "Çalışma ortamı", supplyVoltage: "Besleme gerilimi", controlVoltage: "Kumanda gerilimi", ambientTempMinC: "En düşük sıcaklık", ambientTempMaxC: "En yüksek sıcaklık" } as Record<string, string>)[key] ?? key);
}

/** Teklifte sonradan silinen talep temizlenir; baştan boş olup raporda
 * tamamlanan alan ise yeniden açılışta kaybolmaz. */
export function offerDemandPatch(demand: OfferDemand, previous?: Record<string, string | number | null>): OfferDemand["values"] {
  return Object.fromEntries(Object.entries(demand.values).filter(([key, value]) => value !== null || previous?.[key] != null));
}
