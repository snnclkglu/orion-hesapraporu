import { expect, it } from "vitest";
import { NEW_WORK_TEMPLATE } from "@/lib/calc/defaults";
import { moduleState } from "@/lib/calc/presentation/module-access";
import { MODULE_ORDER } from "@/lib/calc/presentation/module-family";
import type { ModulesState } from "@/lib/calc/state";
import { catalogCompatible } from "../compatibility";
import { validateSelectionRequest } from "../preflight";
import type { EquipmentRow, SelectionRequest } from "../types";

const request = (): SelectionRequest => ({ specs: structuredClone(NEW_WORK_TEMPLATE.specs), modules: Object.fromEntries(MODULE_ORDER.map(key => [key, structuredClone(moduleState(NEW_WORK_TEMPLATE, key) ?? { inputs: {}, selections: {} })])) as ModulesState, active: ["main", "trolley"], brands: {}, locks: [], sizeDesigns: true, speedTolerancePct: 5 });
const row = (kind: string, attrs: Record<string, unknown>): EquipmentRow => ({ id: "fixture", kind, brand: "TEST", model: "TEST", attrs });
it("kapasite yeterli olsa bile başka fiziksel fren/tampon ailesini seçmez", () => {
  const req = request(); req.specs.hoistBrakeType = "Manyetik Fren"; req.specs.trolleyBufferType = "hidrolik";
  expect(catalogCompatible(req, req.modules, "main", "2.5", row("brake", { brake_type: "drum", brake_torque_nm: 1000000 }))).toBe(false);
  expect(catalogCompatible(req, req.modules, "trolley", "5.8", row("buffer", { type: "kauçuk", energy_kj: 1000000 }))).toBe(false);
});
it("kanca standardı ve rulman yatağı birebir eşleşir", () => {
  const req = request(); req.specs.hookType = "DIN 15402 Çift Ağız Kanca"; Object.assign(req.modules.hookBlock.selections, { hookStandard: "DIN 15402" });
  expect(catalogCompatible(req, req.modules, "hookBlock", "4.1", { ...row("hook", { hook_nr: 250 }), model: "DIN 15401 Nr 250" })).toBe(false);
  Object.assign(req.modules.main.selections, { bearingBrand: "SKF", bearingCode: "22220 E", bearingBoreMm: 100 });
  expect(catalogCompatible(req, req.modules, "main", "2.2.7", { ...row("bearing_housing", { compatible_bearing: "22220", bearing_bore_mm: 100 }), brand: "SKF" })).toBe(true);
  expect(catalogCompatible(req, req.modules, "main", "2.2.7", { ...row("bearing_housing", { compatible_bearing: "22222", bearing_bore_mm: 110 }), brand: "SKF" })).toBe(false);
});
it("kaplinin azami devrini ve asgari göbek çapını sınır kabul eder", () => {
  const req = request(); Object.assign(req.modules.main.selections, { motorRpm: 1500, motorShaftMm: 42, gearboxInputShaftMm: 50 });
  expect(catalogCompatible(req, req.modules, "main", "2.6", row("coupling", { max_speed_rpm: 1000 }))).toBe(false);
  expect(catalogCompatible(req, req.modules, "main", "2.6", row("coupling", { max_speed_rpm: 3000, min_shaft_dia_mm: 45 }))).toBe(false);
  expect(catalogCompatible(req, req.modules, "main", "2.6", row("coupling", { max_speed_rpm: 3000, min_shaft_dia_mm: 40 }))).toBe(true);
});
it("teknik veri eksikken aramaya veya varsayılan uygun sonuca geçmez", () => {
  const req = request(); req.specs.mainCapacityT = 0;
  expect(() => validateSelectionRequest(req)).toThrow("teknik özellikleri");
});
