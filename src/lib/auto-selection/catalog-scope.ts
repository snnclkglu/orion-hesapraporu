import { z } from "zod";
import { isHoistKey, isHookBlockKey, isTravelKey } from "@/lib/calc/presentation/module-family";
import { activeBrandKeys, BRAND_KINDS } from "./brands";
import type { SelectionRequest } from "./types";

export const CATALOG_KINDS = ["air_conditioner", "bearing", "bearing_housing", "brake", "buffer", "coupling", "festoon", "gearbox", "hook", "motor", "rope", "sheave", "wheel"] as const;
export const catalogFilterSchema = z.array(z.object({ kind: z.enum(CATALOG_KINDS), brands: z.array(z.string().min(1).max(200)).max(100).nullable(), application: z.enum(["kaldirma", "yurutme"]).optional(), series: z.string().min(1).max(200).optional() })).max(20);
export type CatalogFilter = z.infer<typeof catalogFilterSchema>;
export function selectionCatalogFilter(request: Pick<SelectionRequest, "active" | "brands" | "series">): CatalogFilter {
  const kinds = new Set<string>();
  for (const key of request.active) {
    const values = isHoistKey(key) ? ["rope", "bearing", "bearing_housing", "motor", "gearbox", "brake", "coupling"]
      : isTravelKey(key) ? ["wheel", "bearing", "motor", "gearbox", "brake", "coupling", "buffer", "festoon"]
        : isHookBlockKey(key) ? ["hook", "sheave", "bearing"] : key === "cabin" ? ["air_conditioner"] : [];
    values.forEach(value => kinds.add(value));
  }
  const keys = activeBrandKeys(request);
  return CATALOG_KINDS.filter(kind => kinds.has(kind)).flatMap((kind): CatalogFilter => {
    if (kind === "rope") return [{ kind, brands: request.brands.rope ? [request.brands.rope] : null,
      ...(request.series?.rope ? { series: request.series.rope } : {}) }];
    if (kind === "gearbox") return [
      ...(request.active.some(isHoistKey) ? [{ kind, brands: request.brands.hoistGearbox ? [request.brands.hoistGearbox] : null, application: "kaldirma" as const, ...(request.series?.hoistGearbox ? { series: request.series.hoistGearbox } : {}) }] : []),
      ...(request.active.some(isTravelKey) ? [{ kind, brands: request.brands.travelGearbox ? [request.brands.travelGearbox] : null, application: "yurutme" as const, ...(request.series?.travelGearbox ? { series: request.series.travelGearbox } : {}) }] : []),
    ];
    const preferences = keys.filter(key => BRAND_KINDS[key] === (kind === "bearing_housing" ? "bearing" : kind)).map(key => request.brands[key] ?? "");
    return [{ kind, brands: !preferences.length || preferences.some(value => !value) ? null : [...new Set(preferences)].sort() }];
  });
}
