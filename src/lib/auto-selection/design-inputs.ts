import { z } from "zod";
import { MODULE_ORDER, MODULE_LABELS, isHoistKey, isTravelKey } from "@/lib/calc/presentation/module-family";
import { commonReevingByLabel, validateReeving } from "@/lib/calc/reeving";
import { RAILS, railFamilyOf } from "@/lib/calc/tables";
import { DEFAULT_TRAVEL_WHEEL_HARDNESS } from "@/lib/calc/modules/travelGroup";
import { withDerivedModules } from "@/lib/calc/state";
import type { SelectionRequest } from "./types";

const DESIGN_LABELS: Record<string, string> = { reevingLabel: "Halat donanımı", drivenFalls: "Tahrikli halat kolu", totalFalls: "Toplam halat kolu", wheelCount: "Teker sayısı", driveCount: "Tahrik sayısı", wheelsPerMotor: "Tahrik başına teker", motorCountAuto: "Otomatik motor adedi", motorCount: "Motor adedi", railCode: "Ray ölçüsü", railFamily: "Ray ailesi", wheelHardness: "Teker sertliği" };

export const designInputsSchema = z.object({
  reeving: z.partialRecord(z.enum(MODULE_ORDER), z.object({ drivenFalls: z.number().int().min(1).max(32), totalFalls: z.number().int().min(2).max(64) })),
  travel: z.partialRecord(z.enum(MODULE_ORDER), z.object({ wheelCount: z.number().int().min(4).max(24), driveCount: z.number().int().min(1).max(16), railCode: z.string().min(1).max(40) })),
});
export type DesignInputs = z.infer<typeof designInputsSchema>;

/** Pencere raporun güncel kararlarını okur; açılması raporu değiştirmez. */
export function designInputsFrom(request: Pick<SelectionRequest, "active" | "modules">): DesignInputs {
  const design: DesignInputs = { reeving: {}, travel: {} };
  for (const key of request.active) {
    const input = request.modules[key].inputs as Record<string, unknown>;
    const selection = request.modules[key].selections as Record<string, unknown>;
    if (isHoistKey(key)) {
      const preset = commonReevingByLabel(String(input.reevingLabel ?? ""));
      design.reeving[key] = { drivenFalls: preset?.drivenFalls ?? Number(input.drivenFalls), totalFalls: preset?.totalFalls ?? Number(input.totalFalls) };
    }
    if (isTravelKey(key)) design.travel[key] = { wheelCount: Number(input.wheelCount), driveCount: Number(input.driveCount), railCode: String(selection.railCode ?? "") };
  }
  return design;
}

/** Fizik burada tekrarlanmaz: kararlar editörle aynı alanlara ve türetmelere gider. */
export function applyDesignInputs(request: SelectionRequest): SelectionRequest {
  if (!request.design) return request;
  const parsed = designInputsSchema.safeParse(request.design);
  if (!parsed.success) throw new Error("Halat donanımı, teker/tahrik sayıları ve ray seçimlerini tamamlayın.");
  const next = structuredClone(request);
  let geometryChanged = false;
  function put(key: typeof MODULE_ORDER[number], side: "inputs" | "selections", field: string, value: unknown, section?: string) {
    const target = next.modules[key][side] as Record<string, unknown>;
    if (target[field] === value) return;
    if (request.locks.some(lock => lock === key || lock === `${key}.${side}.${field}` || (section && lock === `${key}.${section}`))) throw new Error(`${MODULE_LABELS[key]}: ${DESIGN_LABELS[field] ?? field} kilitli. Tasarım kararını uygulamak için ilgili kilidi kaldırın.`);
    target[field] = value;
    geometryChanged = true;
  }
  for (const key of request.active) {
    if (isHoistKey(key)) {
      const rig = parsed.data.reeving[key];
      if (!rig) throw new Error(`${MODULE_LABELS[key]}: halat donanımını seçin.`);
      const current = next.modules[key].inputs as Record<string, unknown>;
      const errors = validateReeving({ ...rig, fixedSheaveCount: Number(current.fixedSheaveCount), sheaveEfficiency: Number(current.sheaveEfficiency) }).filter(issue => issue.agirlik === "hata");
      if (errors.length || rig.totalFalls % 2 !== 0 || rig.totalFalls % rig.drivenFalls !== 0) throw new Error(`${MODULE_LABELS[key]}: halat donanımı simetrik ve tam sayılı olmalı. ${errors.map(issue => issue.mesaj).join(" ")}`);
      put(key, "inputs", "reevingLabel", `${rig.drivenFalls}/${rig.totalFalls}`);
      put(key, "inputs", "drivenFalls", rig.drivenFalls);
      put(key, "inputs", "totalFalls", rig.totalFalls);
    }
    if (isTravelKey(key)) {
      const travel = parsed.data.travel[key];
      if (!travel || travel.wheelCount % 4 !== 0 || travel.driveCount > travel.wheelCount || !RAILS[travel.railCode]) throw new Error(`${MODULE_LABELS[key]}: geçerli ray, dördün katı teker sayısı ve teker sayısını aşmayan tahrik sayısı gerekli.`);
      put(key, "inputs", "wheelCount", travel.wheelCount);
      put(key, "inputs", "driveCount", travel.driveCount);
      put(key, "inputs", "wheelsPerMotor", 1, "5.4");
      put(key, "inputs", "motorCountAuto", true, "5.4");
      put(key, "selections", "motorCount", travel.driveCount, "5.4");
      put(key, "selections", "railCode", travel.railCode, "5.1");
      put(key, "selections", "railFamily", railFamilyOf(travel.railCode), "5.1");
      if (!(next.modules[key].selections as Record<string, unknown>).wheelHardness) put(key, "selections", "wheelHardness", DEFAULT_TRAVEL_WHEEL_HARDNESS, "5.1");
    }
  }
  if (geometryChanged) {
    if (next.modules.wheelLoads) (next.modules.wheelLoads.inputs as Record<string, unknown>).measurementsConfirmed = false;
    for (const key of ["girder", "girder2"] as const) if (next.modules[key]) (next.modules[key].inputs as Record<string, unknown>).loadMeasurementsConfirmed = false;
  }
  next.modules = withDerivedModules(next.modules, next.specs);
  return next;
}
