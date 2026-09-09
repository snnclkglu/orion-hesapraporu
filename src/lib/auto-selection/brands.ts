import { isHoistKey, isTravelKey } from "@/lib/calc/presentation/module-family";
import { getCatalogMapping } from "@/lib/catalog-mapping";
import { travelBufferCatalogTypes } from "@/lib/calc/modules/travelGroup";
import { BRAND_LABELS, type BrandKey, type Brands, type SelectionRequest } from "./types";

export interface CatalogFamily { kind: string; brand: string; attrs: Record<string, unknown>; count?: number }
export const BRAND_KINDS: Record<BrandKey, string> = {
  motor: "motor", hoistGearbox: "gearbox", travelGearbox: "gearbox", brake: "brake", hoistBrake: "brake", travelBrake: "brake",
  motorCoupling: "coupling", wheelCoupling: "coupling", drumCoupling: "coupling", bearing: "bearing", rope: "rope", buffer: "buffer",
};
export function normalizedBrands(brands: Brands): Brands {
  const next = { ...brands };
  if (brands.brake) { next.hoistBrake ??= brands.brake; next.travelBrake ??= brands.brake; delete next.brake; }
  return next;
}
export function activeBrandKeys(request: Pick<SelectionRequest, "active">): BrandKey[] {
  return (Object.keys(BRAND_LABELS) as BrandKey[]).filter(key => key !== "brake" && (
    ["hoistGearbox", "hoistBrake", "rope", "drumCoupling"].includes(key) ? request.active.some(isHoistKey)
      : ["travelGearbox", "travelBrake", "wheelCoupling", "buffer"].includes(key) ? request.active.some(isTravelKey) : true));
}
export function requestedBrakeFamily(value: string): string | undefined {
  return /manyetik/i.test(value) ? "em" : /eldro|kasnak/i.test(value) ? "drum" : /disk/i.test(value) ? "disc" : undefined;
}
export function familyMatchesBrandKey(row: CatalogFamily, key: BrandKey, request: Pick<SelectionRequest, "active" | "specs">): boolean {
  if (row.kind !== BRAND_KINDS[key]) return false;
  if (key === "hoistGearbox") return row.attrs.application === "kaldirma";
  if (key === "travelGearbox") return row.attrs.application === "yurutme";
  if (key === "hoistBrake" || key === "travelBrake") {
    const family = requestedBrakeFamily(String((key === "hoistBrake" ? request.specs.hoistBrakeType : request.specs.travelBrakeType) ?? ""));
    return !!family && row.attrs.brake_type === family;
  }
  if (key === "motorCoupling" || key === "drumCoupling") {
    const mapping = getCatalogMapping("main", key === "motorCoupling" ? "2.6" : "2.7")!;
    return Object.entries(mapping.lockedFacets ?? {}).every(([attr, values]) => (Array.isArray(values) ? values : [values]).includes(String(row.attrs[attr])));
  }
  if (key === "buffer") return request.active.filter(isTravelKey).some(module => travelBufferCatalogTypes(request.specs, module).includes(String(row.attrs.type)));
  if (key === "rope") return /vinç|crane/i.test(String(row.attrs.typical_application));
  return true;
}
export function availableBrands(rows: CatalogFamily[], key: BrandKey, request: Pick<SelectionRequest, "active" | "specs">): string[] {
  return [...new Set(rows.filter(row => familyMatchesBrandKey(row, key, request)).map(row => row.brand))].sort((a, b) => a.localeCompare(b, "tr"));
}
