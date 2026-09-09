import { bearingHousingCompatibilityKey } from "@/lib/catalog-mapping";
import { isHoistKey, isTravelKey, type ModuleKey } from "@/lib/calc/presentation/module-family";
import { travelBufferCatalogTypes } from "@/lib/calc/modules/travelGroup";
import type { ModulesState } from "@/lib/calc/state";
import { positive } from "./catalog";
import { requestedHookStandard } from "./technical-contract";
import { requestedBrakeFamily } from "./brands";
import { brakeDrumOptions, manufacturerConditionsMatch } from "./manufacturer";
import type { EquipmentRow, SelectionRequest } from "./types";

/** Üretici sınırları ve birebir bağlantı koşulları. Fizik formülü içermez. */
export function catalogCompatible(request: SelectionRequest, modules: ModulesState, key: ModuleKey, section: string, row: EquipmentRow): boolean {
  const sel = modules[key].selections as Record<string, unknown>;
  if (!manufacturerConditionsMatch(row, request.specs)) return false;
  if (row.kind === "hook") {
    const requested = requestedHookStandard(request.specs.hookType);
    if (request.specs.hookType && !requested) return false;
    const standard = requested ?? (typeof sel.hookStandard === "string" ? sel.hookStandard : undefined);
    if (!standard) return false;
    if (!row.model.includes(standard)) return false;
  }
  if (row.kind === "bearing_housing") {
    if (row.brand !== sel.bearingBrand || bearingHousingCompatibilityKey(sel.bearingCode) !== bearingHousingCompatibilityKey(row.attrs.compatible_bearing) || positive(row.attrs.bearing_bore_mm) !== positive(sel.bearingBoreMm)) return false;
  }
  if (row.kind === "buffer" && isTravelKey(key) && !travelBufferCatalogTypes(request.specs, key).includes(String(row.attrs.type))) return false;
  if (row.kind === "brake") {
    const type = requestedBrakeFamily(String(isHoistKey(key) ? request.specs.hoistBrakeType : request.specs.travelBrakeType));
    if (type && row.attrs.brake_type !== type) return false;
  }
  if (row.kind === "coupling") {
    if (section === "2.6" && requestedBrakeFamily(String(request.specs.hoistBrakeType)) === "drum" && !brakeDrumOptions(row).includes(Number(sel.brakeWheelDiaMm))) return false;
    const motorSide = section === "2.6" || section === "5.6";
    const rpm = motorSide ? positive(sel.motorRpm) : positive(sel.motorRpm) && positive(sel.gearboxRatio) ? Number(sel.motorRpm) / Number(sel.gearboxRatio) : undefined;
    const maxRpm = positive(row.attrs.max_speed_rpm);
    // Devri bilinmeyen aday seçim dışıdır; katalog devri yoksa sonuçta veri eksiği yazılır.
    if (!rpm || (maxRpm !== undefined && rpm > maxRpm)) return false;
    const minBore = positive(row.attrs.min_shaft_dia_mm);
    const shafts = motorSide ? [positive(sel.motorShaftMm ?? sel.couplingMotorShaftMm), positive(sel.gearboxInputShaftMm)] : [positive(sel.gearboxOutputShaftMm)];
    if (minBore && shafts.some(shaft => !shaft || shaft < minBore)) return false;
  }
  return true;
}
