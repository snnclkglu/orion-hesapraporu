import type { OfferItem } from "../types";
import type { CostItem } from "./types";

/** Mühendislikten maliyete tek yön: fiyat ve ticari katsayı taşımaz. */
export function withReportCostSource(cost: CostItem, offer: OfferItem): CostItem {
  const source = offer.calculationSource;
  if (!source) return cost;
  const values: Record<string, number> = {};
  const put = (key: string, value: unknown) => { if (typeof value === "number" && Number.isFinite(value) && value > 0) values[key] = value; };
  for (const [field, prefix] of [["mainHoist", "hoist"], ["auxHoist", "auxHoist"], ["trolley", "trolley"], ["bridge", "bridge"]] as const) {
    const state = source.input[field]; if (!state) continue;
    const selections = state.selections as unknown as Record<string, unknown>;
    if (source.rows[`${field}.motor`]) put(`c.${prefix}MotorKw`, selections.motorPowerKw);
    if (source.rows[`${field}.gearbox`]) { put(`c.${prefix}GearRatio`, selections.gearboxRatio); put(`c.${prefix}GearboxKg`, selections.gearboxWeightKg); }
    if (field === "trolley" || field === "bridge") {
      if (source.rows[`${field}.motor`]) put(`c.${prefix}DriveCount`, selections.motorCount);
      if (source.rows[`${field}.wheel`]) {
      put(`c.${prefix}WheelCount`, (state.inputs as unknown as Record<string, unknown>).wheelCount);
      put(`c.${prefix}WheelDiaMm`, selections.wheelDiaMm);
      put(`c.${prefix}WheelEffDiaMm`, selections.wheelDiaMm); }
    } else {
      if (source.rows[`${field}.rope`]) { put(`c.${prefix}DrumDiaMm`, selections.drumDiaMm); put(`c.${prefix}RopeDiaMm`, selections.ropeDiaMm); }
    }
  }
  const motors = Object.entries(source.input).flatMap(([field, state]) => {
    if (field === "specs" || !state || !("selections" in state) || !("motorPowerKw" in state.selections)) return [];
    const key = field.replace(/Hoist$/, "");
    const group = key === "main" ? "mainHoist" : key === "aux" ? "auxHoist" : key;
    const qty = source.equipment.find(row => row.key === `${key}:motor`)?.qty;
    return [{ power: state.selections.motorPowerKw, qty, selected: !!source.rows[`${group}.motor`] }];
  });
  if (motors.length && motors.every(motor => motor.selected && typeof motor.power === "number" && Number.isFinite(motor.power) && motor.power > 0 && typeof motor.qty === "number" && Number.isFinite(motor.qty) && motor.qty > 0)) put("c.installedKw", motors.reduce((sum, motor) => sum + Number(motor.power) * Number(motor.qty), 0));
  const overrides = { ...cost.overrides };
  const previous = cost.reportSource?.values ?? {};
  for (const key of Object.keys(previous)) if (!(key in values) && overrides[key] === previous[key]) delete overrides[key];
  for (const [key, value] of Object.entries(values)) if (!(key in overrides) || overrides[key] === previous[key]) overrides[key] = value;
  return { ...cost, overrides, reportSource: { hash: source.hash, revisionId: source.revisionId, values } };
}
