import { NEW_WORK_TEMPLATE, NEW_WORK_DISABLED_MODULES } from "@/lib/calc/defaults";
import { activeModules, runCalc, type CalcInput } from "@/lib/calc/engine";
import { MODULE_ORDER, isHoistKey, isTravelKey } from "@/lib/calc/presentation/module-family";
import { moduleState } from "@/lib/calc/presentation/module-access";
import { buildEquipmentGroups, ropeWireGradeMpa } from "@/lib/equipment-list";
import { withComposedValue } from "@/lib/offers/compose";
import { offerRowDef } from "@/lib/offers/registry";
import type { OfferItem } from "@/lib/offers/types";
import { contentHash, type SelectionTrace } from "./types";
import { selectionReviewComplete, selectionChecksComplete } from "./trace";
import { applyCraneTypeRevisionPreset } from "@/lib/crane-types";
import { moduleResult } from "@/lib/calc/presentation/module-access";
import { DEMAND_NUMBERS, offerDemand, offerDemandDifferences } from "./offer-demand";
export { technicalNumber } from "./offer-demand";

export type { OfferCalculationSource } from "./offer-source";
import type { OfferCalculationSource } from "./offer-source";
export function reportInputFromOfferItem(item: OfferItem): { input: CalcInput; disabled: string[]; warnings: string[] } {
  const input = structuredClone(NEW_WORK_TEMPLATE);
  const demand = offerDemand(item);
  const warnings: string[] = [];
  for (const [field, group, key, part, label, speed] of DEMAND_NUMBERS) {
    const value = demand.values[field];
    if (value === null) warnings.push(`${group}/${key}: ${label} eksik. Teknik özelliklerde tamamlayın; boş alanla otomatik seçim başlamaz.`);
    const row = item.groups.find(g => g.key === group)?.rows.find(row => row.key === key);
    if (value != null && speed && !row?.manual && /[/–-]/.test(row?.parts?.[part] ?? "")) warnings.push(`${label}: üst çalışma hızı ${value} m/dak alındı; düşük hız ve kumanda şartı korunmalı.`);
  }
  const disabled: string[] = [...NEW_WORK_DISABLED_MODULES];
  if (demand.values.auxCapacityT) { for (const key of ["aux", "auxHookBlock"]) { const index = disabled.indexOf(key); if (index >= 0) disabled.splice(index, 1); } }
  warnings.push("Mekanizma ve kullanım sınıfları, ortam ve besleme koşulları raporda doğrulanmalı; kapasiteden sınıf türetilmedi.");
  warnings.push(...demand.missing.filter(message => message.includes("fren")));
  const preset = applyCraneTypeRevisionPreset(0, item.craneType, { specs: input.specs, disabledModules: disabled });
  input.specs = preset.specs as typeof input.specs;
  // Kritik eksik alan gerçek bir talepmiş gibi şablondan devralınmaz.
  // CalcInput'ın eski sayısal sözleşmesi korunur; boş JSON alanını ön kontrol reddeder.
  Object.assign(input.specs, demand.values);
  return { input, disabled: preset.disabledModules as string[], warnings };
}
const text = (value: unknown) => typeof value === "number" ? (Number.isFinite(value) ? String(value).replace(".", ",") : "") : typeof value === "string" ? value : "";
export function reportTechnicalRows(input: CalcInput, trace?: SelectionTrace): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = {};
  const equipment = buildEquipmentGroups(input).flatMap(group => group.rows).filter(row => row.alt === undefined);
  const result = runCalc(input);
  const externallyReviewed = trace && selectionReviewComplete(trace, input);
  const qty = (key: string) => text(equipment.find(row => row.rowKey === key)?.qty);
  for (const key of MODULE_ORDER) {
    if (!isHoistKey(key) && !isTravelKey(key)) continue;
    const state = moduleState(input, key); if (!state) continue;
    const selection = state.selections as Record<string, unknown>;
    const eligible = (section: string, checkGroup: string) => {
      if (!selectionChecksComplete((moduleResult(result, key)?.checks ?? []).filter(check => check.id.startsWith(`${key}.${checkGroup}.`)))) return false;
      if (trace && ["motor", "gearbox", "brake"].includes(checkGroup)) {
        const drive = (moduleResult(result, key)?.checks ?? []).filter(check => new RegExp(`^${key}\\.(motor|gearbox)\\.`).test(check.id));
        if (!selectionChecksComplete(drive)) return false;
        if (!externallyReviewed && trace.issues.some(issue => issue.code === `audit.chain.${key}`)) return false;
      }
      if (!externallyReviewed && trace?.decisions.some(decision => decision.module === key && decision.section === section && decision.provisional)) return false;
      return !trace || externallyReviewed || trace.decisions.some(decision => decision.module === key && decision.section === section && !decision.provisional);
    };
    const hoist = isHoistKey(key);
    const group = key === "main" ? "mainHoist" : key === "aux" ? "auxHoist" : key;
    const motor = equipment.find(row => row.rowKey === `${key}:motor`);
    const gearbox = equipment.find(row => row.rowKey === `${key}:gearbox`);
    if (eligible(hoist ? "2.4" : "5.4", "motor")) out[`${group}.motor`] = { brand: motor?.brand ?? text(selection.motorBrand), count: qty(`${key}:motor`), power: text(selection.motorPowerKw), rpm: text(selection.motorRpm) };
    if (eligible(hoist ? "2.3" : "5.5", "gearbox")) out[`${group}.gearbox`] = { brand: gearbox?.brand ?? "", series: gearbox?.model ?? text(selection.gearboxModel), safety: text((state.inputs as Record<string, unknown>).gearboxServiceFactor) };
    const brake = equipment.find(row => row.rowKey === `${key}:brake`);
    if (eligible(hoist ? "2.5" : "5.5b", "brake")) {
      const chosen = trace?.decisions.find(decision => decision.module === key && decision.section === (hoist ? "2.5" : "5.5b"))?.row;
      const combined = text(selection.brakeBrand);
      const matching = chosen && (combined === chosen.brand || combined === `${chosen.brand} ${chosen.model}`);
      out[`${group}.brake`] = { brand: matching ? chosen.brand : brake?.brand ?? combined, type: matching ? chosen.model : brake?.model === "-" ? "" : brake?.model ?? text(selection.brakeModel), count: qty(`${key}:brake`) };
    }
    if (isTravelKey(key) && eligible("5.1", "wheel")) out[`${group}.wheel`] = { count: qty(`${key}:wheel`), dia: text(selection.wheelDiaMm), material: text(selection.wheelMaterial) };
    if (hoist && eligible("2.1", "rope")) out[`${group}.rope`] = { dia: text(selection.ropeDiaMm), construction: text(selection.ropeConstruction), grade: ropeWireGradeMpa(Number(selection.ropeWireStrength)) ? `${ropeWireGradeMpa(Number(selection.ropeWireStrength))} MPa` : text(selection.ropeWireStrength) ? `${text(selection.ropeWireStrength)} kg/mm²` : "", core: text(selection.ropeCore) };
  }
  return out;
}
export function applyReportToOfferItem(item: OfferItem, source: Omit<OfferCalculationSource, "rows" | "equipment" | "hash" | "importedAt">, trace?: SelectionTrace): { item: OfferItem; preserved: string[] } {
  const differences = offerDemandDifferences(item, source.input.specs);
  if (source.craneType && source.craneType !== item.craneType) differences.push("Vinç tipi");
  if (differences.length) throw new Error(`Teklif ile hesap uyuşmuyor: ${differences.join(", ")}. Hızlı hesap raporunu açıp güncel teknik özelliklerle yeniden hesaplayın ve kaydedin.`);
  const rows = reportTechnicalRows(source.input, trace);
  // Raporda tamamlanan boş teknik girdiler teklife de taşınır. Mevcut dolu
  // teknik talep yukarıda doğrulandığı için farklı kapasite sessizce ezilemez.
  for (const [field, group, key, part] of DEMAND_NUMBERS) {
    if ((field === "auxCapacityT" || group === "auxHoist") && !source.input.auxHoist) continue;
    if (group === "trolley" && !source.input.trolley || group === "bridge" && !source.input.bridge) continue;
    const targetGroup = group === "bridge" && !item.groups.some(value => value.key === "bridge") ? "gantry" : group;
    const existing = item.groups.find(value => value.key === targetGroup)?.rows.find(row => row.key === key);
    if (!existing || existing.parts?.[part]?.trim()) continue;
    const value = source.input.specs[field];
    if (typeof value === "number" && Number.isFinite(value) && value > 0) {
      const target = `${group}.${key}`;
      rows[target] = { ...rows[target], [part]: text(value) };
    }
  }
  const preserved: string[] = [];
  const groups = item.groups.map(group => ({ ...group, rows: group.rows.map(row => {
    const key = `${group.key === "gantry" ? "bridge" : group.key}.${row.key}`;
    const values = rows[key];
    const previous = item.calculationSource?.rows[key];
    if (!values && !previous) return row;
    const changed = previous && Object.keys(previous).some(part => (row.parts?.[part] ?? "") !== previous[part]);
    if (row.manual || row.scope === "customer" || row.source === "manual" || changed) { preserved.push(`${group.title} · ${row.label}`); return row; }
    const parts = { ...row.parts };
    if (!values && previous) for (const part of Object.keys(previous)) delete parts[part];
    return withComposedValue({ ...row, parts: { ...parts, ...values }, source: "catalog" }, offerRowDef(group.key, row.key));
  }) }));
  const equipment = buildEquipmentGroups(source.input).flatMap(group => group.rows).filter(row => row.alt === undefined).map(row => ({ key: row.rowKey ?? "", component: row.component, brand: row.brand, model: row.model, spec: row.spec, qty: row.qty }));
  const snapshotInput = JSON.parse(JSON.stringify(source.input)) as CalcInput;
  const snapshot: OfferCalculationSource = { ...source, input: snapshotInput, rows, equipment, pending: trace?.issues.filter(issue => issue.state !== "review").map(issue => issue.message), hash: contentHash(snapshotInput), importedAt: new Date().toISOString() };
  return { item: { ...item, groups, calculationSource: snapshot }, preserved };
}
export function activeOfferReportInput(input: CalcInput, disabled: string[]): CalcInput {
  const active = activeModules(input.specs, disabled);
  const result: CalcInput = { specs: input.specs };
  for (const key of MODULE_ORDER) if (active.has(key)) { const state = moduleState(input, key); if (state) Object.assign(result, { [key === "main" ? "mainHoist" : key === "aux" ? "auxHoist" : key === "mono1" ? "mono1Hoist" : key === "mono2" ? "mono2Hoist" : key]: state }); }
  return result;
}
