import { isHoistKey, isTravelKey } from "@/lib/calc/presentation/module-family";
import { getCatalogMapping } from "@/lib/catalog-mapping";
import { travelBufferCatalogTypes } from "@/lib/calc/modules/travelGroup";
import { BRAND_LABELS, type BrandKey, type Brands, type SelectionRequest } from "./types";
import { kimlikBuyuk } from "@/lib/tr-text";

export const DEFAULT_BRANDS: Brands = {
  motor: "GAMAK", hoistGearbox: "YILMAZ REDÜKTÖR", travelGearbox: "YILMAZ REDÜKTÖR",
  hoistBrake: "SIBRE", travelBrake: "DERELI", motorCoupling: "SIBRE",
  wheelCoupling: "OZGUN", drumCoupling: "OZGUN", bearing: "SKF", rope: "HAŞÇELİK", buffer: "SIBRE",
};
export const SERIES_KEYS: BrandKey[] = ["rope", "hoistGearbox", "travelGearbox", "motorCoupling", "wheelCoupling", "drumCoupling"];
export function defaultSeries(key: BrandKey, brand: string): string {
  const name = kimlikBuyuk(brand);
  if (key === "rope" && ["HAŞÇELİK", "İZMİT A.Ş."].includes(name)) return "6x36 WS";
  if (name === "FLENDER" && ["hoistGearbox", "travelGearbox"].includes(key)) return "H";
  return name === "YILMAZ REDÜKTÖR" ? (key === "hoistGearbox" ? "H" : key === "travelGearbox" ? "DR" : "")
    : name === "SIBRE" && key === "motorCoupling" ? "APC-AT" : name === "OZGUN" && key === "drumCoupling" ? "J" : "";
}
export function initialBrands(saved: Brands = {}): Brands { return { ...DEFAULT_BRANDS, ...normalizedBrands(saved) }; }

export interface CatalogFamily { kind: string; brand: string; attrs: Record<string, unknown>; count?: number }
export function catalogSeries(row: CatalogFamily, key: BrandKey): string {
  const value = String((key === "rope" ? row.attrs.construction : row.attrs.series) ?? "");
  return row.kind === "gearbox" && kimlikBuyuk(row.brand) === "FLENDER" && /^H[1-4]$/.test(value) ? "H" : value;
}
export const BRAND_KINDS: Record<BrandKey, string> = {
  motor: "motor", hoistGearbox: "gearbox", travelGearbox: "gearbox", brake: "brake", hoistBrake: "brake", travelBrake: "brake",
  motorCoupling: "coupling", wheelCoupling: "coupling", drumCoupling: "coupling", bearing: "bearing", rope: "rope", buffer: "buffer",
};
export function normalizedBrands(brands: Brands): Brands {
  const next = Object.fromEntries(Object.entries(brands).map(([key, value]) => [key, kimlikBuyuk(value).trim()])) as Brands;
  if (next.brake) { next.hoistBrake ??= next.brake; next.travelBrake ??= next.brake; delete next.brake; }
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
  if (key === "motorCoupling" || key === "drumCoupling" || key === "wheelCoupling") {
    const mapping = getCatalogMapping(key === "wheelCoupling" ? "trolley" : "main", key === "motorCoupling" ? "2.6" : key === "wheelCoupling" ? "5.7" : "2.7")!;
    return Object.entries(mapping.lockedFacets ?? {}).every(([attr, values]) => (Array.isArray(values) ? values : [values]).includes(String(row.attrs[attr])));
  }
  if (key === "buffer") return request.active.filter(isTravelKey).some(module => travelBufferCatalogTypes(request.specs, module).includes(String(row.attrs.type)));
  if (key === "rope") return /vinç|crane/i.test(String(row.attrs.typical_application));
  return true;
}
export function availableBrands(rows: CatalogFamily[], key: BrandKey, request: Pick<SelectionRequest, "active" | "specs">): string[] {
  return [...new Set(rows.filter(row => familyMatchesBrandKey(row, key, request)).map(row => kimlikBuyuk(row.brand)))].sort((a, b) => a.localeCompare(b, "tr"));
}

export function availableSeries(rows: CatalogFamily[], key: BrandKey, brand: string, request: Pick<SelectionRequest, "active" | "specs">): string[] {
  return [...new Set(rows.filter(row => (!brand || kimlikBuyuk(row.brand) === kimlikBuyuk(brand)) && familyMatchesBrandKey(row, key, request)).map(row => catalogSeries(row, key)).filter(Boolean))].sort((a, b) => a.localeCompare(b, "tr", { numeric: true }));
}
