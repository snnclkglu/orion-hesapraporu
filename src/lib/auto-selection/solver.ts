import { validateSelectionRequest } from "./preflight";
import { DESIGN_FACTORS, DESIGN_PROFILE, DESIGN_SHAFTS, designDimension } from "./design-profile";
import { brakeDrumOptions, hoistServiceBrakeSupported, manufacturerConditionsMatch } from "./manufacturer";
import { catalogCompatible } from "./compatibility";
import { ENGINE_VERSION, runCalc, type CalcInput, type CalcResult } from "@/lib/calc/engine";
import { withDerivedModules, type ModulesState } from "@/lib/calc/state";
import { HOIST_FIELD, moduleResult } from "@/lib/calc/presentation/module-access";
import { MODULE_LABELS, isHoistKey, isHookBlockKey, isTravelKey, type ModuleKey } from "@/lib/calc/presentation/module-family";
import { checkSeverity, type AnyCheck } from "@/lib/calc/types";
import { hoistReeving, hoistSpecView, type HoistInputs } from "@/lib/calc/modules/hoistGroup";
import { travelSpecView } from "@/lib/calc/modules/travelGroup";
import { validateReeving } from "@/lib/calc/reeving";
import { SAFETY_BRAKES, brakesInArrangement, minFlangeDiaMm, recommendHydraulicUnit } from "@/lib/calc/safety-brake";
import { selectionScopeIssues } from "./scope";
import { getCatalogMapping } from "@/lib/catalog-mapping";
import { matchesFacets, missingCatalogFields, normalizeCatalog, positive, replaceCatalogSelection, variantKey } from "./catalog";
import { contentHash, SELECTION_VERSION, selectionSourceHash, type BrandKey, type EquipmentRow, type SelectionDecision, type SelectionIssue, type SelectionProgress, type SelectionProposal, type SelectionRequest } from "./types";

type Stage = { module: ModuleKey; section: string; groups: string[]; label: string; brand?: BrandKey; order?: string };
type Candidate = { modules: ModulesState; decisions: SelectionDecision[]; cost: number };
const BEAM_WIDTH = 4;
const EVALUATION_BUDGET = 18000;
const HUMAN_CHECK = /(?:^|\.)measurements\.confirmed$/;

export function selectionCalcInput(request: Pick<SelectionRequest, "specs" | "active">, modules: ModulesState): CalcInput {
  const input: CalcInput = { specs: request.specs };
  for (const key of request.active) {
    const field = isHoistKey(key) ? HOIST_FIELD[key] : key;
    if (modules[key]) Object.assign(input, { [field]: modules[key] });
  }
  return input;
}
function checksOf(result: CalcResult, stage: Stage): AnyCheck[] {
  return (moduleResult(result, stage.module)?.checks ?? []).filter(c => stage.groups.some(g => c.id.startsWith(`${stage.module}.${g}.`)));
}
function finiteCheck(c: AnyCheck): boolean {
  return Number.isFinite(c.provided) && (c.op === "range" ? Number.isFinite(c.min) && Number.isFinite(c.max) : Number.isFinite(c.required));
}
function passed(checks: AnyCheck[]): boolean { return checks.length > 0 && checks.every(c => finiteCheck(c) && c.pass); }
function record(value: object): Record<string, unknown> { return value as Record<string, unknown>; }
function groupLocked(request: SelectionRequest, module: ModuleKey, section: string): boolean {
  if (request.locks.includes(module) || request.locks.includes(`${module}.${section}`)) return true;
  const mapping = getCatalogMapping(module, section);
  return !!mapping?.fields.some(field => request.locks.includes(`${module}.selections.${field.sel}`));
}
function fieldLocked(request: SelectionRequest, module: ModuleKey, kind: "inputs" | "selections", key: string): boolean {
  return request.locks.includes(module) || request.locks.includes(`${module}.${kind}.${key}`);
}
function normalize(request: SelectionRequest, modules: ModulesState): ModulesState {
  let out = withDerivedModules(modules, request.specs);
  for (const lock of request.locks) {
    const [key, side, field] = lock.split(".") as [ModuleKey, "inputs" | "selections", string];
    if (!side && request.modules[key]) { out = { ...out, [key]: request.modules[key] }; continue; }
    // Bölüm kodunun kendi noktaları vardır: main.2.2.6 → 2.2.6.
    const section = lock.slice(key.length + 1);
    const mapping = section && getCatalogMapping(key, section);
    if (mapping && out[key]) {
      const original = record(request.modules[key].selections);
      out = { ...out, [key]: { ...out[key], selections: { ...out[key].selections, ...Object.fromEntries(mapping.fields.map(item => [item.sel, original[item.sel]])) } } };
    }
    if ((side === "inputs" || side === "selections") && field && out[key]) {
      out = { ...out, [key]: { ...out[key], [side]: { ...out[key][side], [field]: record(request.modules[key][side])[field] } } };
    }
  }
  return out;
}
function patch(request: SelectionRequest, modules: ModulesState, key: ModuleKey, side: "inputs" | "selections", values: Record<string, unknown>): ModulesState {
  const allowed = Object.fromEntries(Object.entries(values).filter(([field]) => !fieldLocked(request, key, side, field)));
  return normalize(request, { ...modules, [key]: { ...modules[key], [side]: { ...modules[key][side], ...allowed } } });
}
function picked(request: SelectionRequest, modules: ModulesState, stage: Stage, row: EquipmentRow): ModulesState {
  const mapping = getCatalogMapping(stage.module, stage.section)!;
  const selections = replaceCatalogSelection(mapping, row, modules[stage.module].selections);
  let out = patch(request, modules, stage.module, "selections", selections);
  if (stage.section === "2.6" && brakeDrumOptions(row).includes(Number(record(out[stage.module].selections).brakeWheelDiaMm))) out = patch(request, out, stage.module, "selections", { motorCouplingWheelDiaMm: Number(record(out[stage.module].selections).brakeWheelDiaMm) });
  if (row.kind === "gearbox") out = patch(request, out, stage.module, "inputs", { gearboxRatioAuto: false, ...(positive(row.attrs.stages) ? { reducerStages: positive(row.attrs.stages) } : {}) });
  if (row.kind === "motor" && isTravelKey(stage.module)) out = patch(request, out, stage.module, "selections", { couplingMotorShaftMm: positive(row.attrs.shaft_mm) });
  if (row.kind === "bearing") {
    const prefix = stage.section === "4.3" ? "sheaveBearing" : stage.section === "4.5" ? "hookBearing" : stage.section === "2.9" ? "balanceBearing" : "bearing";
    out = patch(request, out, stage.module, "selections", { [`${prefix}Brand`]: row.brand });
    out = patch(request, out, stage.module, "inputs", { [`${prefix}BrandAuto`]: false });
  }
  return out;
}
function decision(stage: Stage, row: EquipmentRow, result: CalcResult): SelectionDecision {
  return { module: stage.module, section: stage.section, label: stage.label, variantKey: variantKey(row), row, checked: checksOf(result, stage).map(c => c.id) };
}
function stagesFor(key: ModuleKey): Stage[] {
  const make = (section: string, groups: string[], label: string, brand?: BrandKey, order?: string): Stage => ({ module: key, section, groups, label, brand, order });
  if (isHoistKey(key)) return [
    make("2.1", ["rope"], "Halat", "rope", "dia_mm"),
    make("design-drum", ["drum", "shaft", "drumWeld", "shaftWeld"], "Tambur ve mil ölçüleri"),
    make("2.2.6", ["bearing"], "Tambur rulmanı", "bearing", "bore_mm"),
    make("2.2.7", ["bearing"], "Tambur rulman yatağı", "bearing", "housing_width_mm"),
    make("drive", ["motor", "gearbox"], "Motor ve redüktör", "motor", "power_kw"),
    make("2.5", ["brake"], "Servis freni", "hoistBrake", "brake_torque_nm"),
    make("2.6", ["motorCoupling"], "Motor kaplini", "motorCoupling", "nominal_torque_nm"),
    make("2.7", ["drumCoupling"], "Tambur kaplini", "drumCoupling", "nominal_torque_nm"),
    make("safety", ["safety"], "Emniyet freni"),
    make("2.9", ["balance"], "Denge rulmanı", "bearing", "static_load_kn"),
  ];
  if (isHookBlockKey(key)) return [
    make("4.1", ["hook"], "Kanca", undefined, "hook_nr"),
    make("4.2", ["sheave"], "Kanca makaraları", undefined, "dia_mm"),
    make("design-hook", ["shaft", "girder", "fatigue"], "Kanca bloğu ölçüleri"),
    make("4.3", ["sheaveBearing"], "Makara rulmanı", "bearing", "bore_mm"),
    make("4.5", ["hookBearing"], "Kanca rulmanı", "bearing", "static_load_kn"),
  ];
  if (isTravelKey(key)) return [
    make("5.1", ["wheel"], "Yürütme tekeri", undefined, "dia_mm"),
    make("design-travel", ["shaft"], "Teker mili"),
    make("5.3", ["bearing"], "Teker rulmanı", "bearing", "bore_mm"),
    make("drive", ["motor", "gearbox"], "Yürütme motoru ve redüktörü", "motor", "power_kw"),
    make("5.5b", ["brake"], "Yürütme freni", "travelBrake", "brake_torque_nm"),
    make("5.6", ["motorCoupling"], "Motor kaplini", "motorCoupling", "nominal_torque_nm"),
    make("5.7", ["wheelCoupling"], "Teker kaplini", "wheelCoupling", "nominal_torque_nm"),
    make("5.8", ["buffer"], "Tampon", "buffer", "energy_kj"),
    make("5.9", ["festoon"], "Feston", undefined, "max_trolley_load_kg"),
  ];
  if (key === "girder" || key === "girder2") return [make("design-girder", ["section", "stress", "fatigue", "deflection"], "Ana kiriş kesiti")];
  if (key === "endCarriage") return [make("design-end", ["stress", "fatigue"], "Başkiriş kesiti")];
  if (key === "cabin") return [make("11.1", ["cabinAc"], "Kabin kliması"), make("11.2", ["roomAc"], "Elektrik odası kliması"), make("11.3", ["panelAc"], "Pano kliması")];
  return [];
}

/** Seri yalnız aday üretir; izin gerilmesi/kapasite hesabı ortak motordadır. */
function designCandidates(request: SelectionRequest, candidate: Candidate, stage: Stage, result: CalcResult): ModulesState[] {
  if (!request.sizeDesigns || groupLocked(request, stage.module, stage.section)) return [candidate.modules];
  const key = stage.module;
  const base = record(candidate.modules[key].inputs);
  const out: ModulesState[] = [candidate.modules];
  if (stage.section === "design-drum") {
    const minDia = checksOf(result, { ...stage, groups: ["drum"] }).find(c => c.id.endsWith(".dia"));
    const required = minDia && minDia.op !== "range" ? minDia.required : NaN;
    const dia = [160, 200, 250, 315, 400, 500, 630, 800, 1000, 1250, 1600, 2000].find(d => d >= required);
    for (const factor of DESIGN_FACTORS) {
      let next = candidate.modules;
      if (dia) next = patch(request, next, key, "selections", { drumDiaMm: dia });
      const values: Record<string, number> = {};
      for (const field of ["drumWallThicknessMm", "shaftD1Mm", "shaftD2Mm", "drumWeldThicknessMm", "shaftWeldThicknessMm"]) {
        const n = positive(base[field]);
        const sized = n && designDimension(field, n * factor);
        if (sized) values[field] = sized;
      }
      next = patch(request, next, key, "inputs", values); out.push(next);
    }
  } else if (stage.section === "design-travel" || stage.section === "design-hook") {
    const field = stage.section === "design-travel" ? "shaftDiaMm" : "shaftD1Mm";
    for (const value of DESIGN_SHAFTS) out.push(patch(request, candidate.modules, key, "inputs", { [field]: value }));
  } else {
    const fields = stage.section === "design-travel" ? ["shaftDiaMm"] : stage.section === "design-hook" ? ["shaftD1Mm"] : stage.section === "design-end" ? ["topPlateThicknessMm", "sidePlateThicknessMm", "sidePlateHeightMm", "bottomPlateThicknessMm"] : ["h3Mm", "t1Mm", "t2Mm", "t3Mm", "t4Mm", "t5Mm"];
    for (const factor of DESIGN_FACTORS) {
      const values: Record<string, number> = {};
      for (const field of fields) { const n = positive(base[field]); const sized = n && designDimension(field, n * factor); if (sized) values[field] = sized; }
      out.push(patch(request, candidate.modules, key, "inputs", values));
    }
  }
  const score = (modules: ModulesState) => Object.entries(record(modules[key].inputs)).reduce((sum, [field, value]) => sum + (/Thickness|shaftD|shaftDia|^h3|^t[1-5]Mm$/.test(field) && typeof value === "number" ? value : 0), 0);
  return [...new Map(out.map(modules => [contentHash(modules), modules])).values()].sort((a, b) => score(a) - score(b));
}

function speedPass(request: SelectionRequest, result: CalcResult, key: ModuleKey): boolean {
  const values = moduleResult(result, key)?.values as Record<string, number> | undefined;
  if (!values) return false;
  const required = isHoistKey(key) ? hoistSpecView(request.specs, key).liftSpeedMpm : isTravelKey(key) ? travelSpecView(request.specs, key, { hookEquipmentT: 0, trolleyWeightT: 0 }).speedMpm : NaN;
  const actual = isHoistKey(key) ? values.actualLiftSpeedMpm : values.actualSpeedMpm;
  return required > 0 && Number.isFinite(actual) && Math.abs(actual / required - 1) * 100 <= request.speedTolerancePct;
}

export function solveSelection(request: SelectionRequest, inputRows: EquipmentRow[], progress?: (value: SelectionProgress) => void): SelectionProposal {
  if (!Number.isFinite(request.speedTolerancePct) || request.speedTolerancePct < 0 || request.speedTolerancePct > 10) throw new Error("Hız toleransı %0–10 arasında olmalı.");
  validateSelectionRequest(request);
  const rows = normalizeCatalog(inputRows);
  const byKind = new Map<string, EquipmentRow[]>();
  for (const row of rows) { const list = byKind.get(row.kind) ?? []; list.push(row); byKind.set(row.kind, list); }
  const issues: SelectionIssue[] = selectionScopeIssues(request);
  let evaluations = 0;
  const cache = new WeakMap<ModulesState, CalcResult>();
  const calc = (modules: ModulesState) => { const old = cache.get(modules); if (old) return old; evaluations++; const result = runCalc(selectionCalcInput(request, modules)); cache.set(modules, result); return result; };
  const stageList = request.active.flatMap(stagesFor);
  let beam: Candidate[] = [{ modules: normalize(request, structuredClone(request.modules)), decisions: [], cost: 0 }];
  const optionCache = new Map<string, EquipmentRow[]>();
  const candidatesFor = (stage: Stage): EquipmentRow[] => {
    const cacheKey = `${stage.module}.${stage.section}`;
    const cached = optionCache.get(cacheKey); if (cached) return cached;
    const mapping = getCatalogMapping(stage.module, stage.section);
    if (!mapping) return [];
    const brand = stage.brand ? request.brands[stage.brand] ?? (["hoistBrake", "travelBrake"].includes(stage.brand) ? request.brands.brake : undefined) : undefined;
    const options = (byKind.get(mapping.kind) ?? []).filter(row => (!brand || row.brand === brand) && matchesFacets(row, mapping) && missingCatalogFields(row).length === 0)
      .filter(row => row.kind !== "rope" || /vinç|crane/i.test(String(row.attrs.typical_application ?? "")))
      .filter(row => row.kind !== "bearing" || ["4.5", "2.9"].includes(stage.section) || (/^22[23]/.test(row.model) && !/K(?:\d|\s|\/|$)/.test(row.model)))
      .filter(row => row.kind !== "brake" || !isHoistKey(stage.module) || hoistServiceBrakeSupported(row))
      .filter(row => manufacturerConditionsMatch(row, request.specs))
      .filter(row => row.kind !== "brake" || catalogCompatible(request, request.modules, stage.module, stage.section, row))
      .sort((a, b) => (positive(a.attrs[stage.order ?? "weight_kg"]) ?? Infinity) - (positive(b.attrs[stage.order ?? "weight_kg"]) ?? Infinity) || variantKey(a).localeCompare(variantKey(b), "en"));
    optionCache.set(cacheKey, options); return options;
  };
  // Bir bağlantının kapasitesi yeterli olsa da sonraki göbek/rulman oturması
  // imkânsız olabilir. Önce bağlı zincirin varlığını dene, sonra dalları daralt.
  const dependencies = (stage: Stage): Stage[] => {
    const sections: Record<string, string[]> = {
      "design-drum": ["2.2.6", "2.2.7"], "2.2.6": ["2.2.7"],
      "design-travel": ["5.3"], "design-hook": ["4.3"],
      drive: isHoistKey(stage.module) ? ["2.7", "2.5", "2.6"] : ["5.7", "5.6", "5.5b"],
      "2.5": ["2.6", "2.7"], "5.5b": ["5.6", "5.7"],
    };
    return (sections[stage.section] ?? []).flatMap(section => stageList.filter(value => value.module === stage.module && value.section === section));
  };
  const capacityPrefilter = (modules: ModulesState, stage: Stage, row: EquipmentRow): boolean => {
    if (row.kind !== "coupling" && row.kind !== "brake") return true;
    // Bu kapasiteler yeni ürün takılmadan önceki TALEPLE kıyaslanabilir:
    // formül ortak motorun kontrol sonucudur; burada yalnız katalog sınırı okunur.
    const attrs: Record<string, [string, string]> = row.kind === "coupling"
      ? { torque: ["nominal_torque_nm", "Nm"], bore: ["max_shaft_dia_mm", "mm"], radial: ["max_radial_load_n", "N"] }
      : { torque: ["brake_torque_nm", "Nm"] };
    return checksOf(calc(modules), stage).every(check => {
      const attr = attrs[check.id.split(".").at(-1)!];
      if (!attr || check.op !== ">=" || check.unit !== attr[1] || !Number.isFinite(check.required)) return true;
      const capacity = positive(row.attrs[attr[0]]);
      return capacity !== undefined && capacity >= check.required;
    });
  };
  const candidateFits = (modules: ModulesState, stage: Stage, row: EquipmentRow): ModulesState | undefined => {
    if (!catalogCompatible(request, modules, stage.module, stage.section, row)) return undefined;
    if (!capacityPrefilter(modules, stage, row)) return undefined;
    if (row.kind === "bearing" && !["4.5", "2.9"].includes(stage.section)) {
      const inputs = record(modules[stage.module].inputs);
      const shaft = inputs[stage.section === "4.3" ? "shaftD1Mm" : isHoistKey(stage.module) ? "shaftD2Mm" : "shaftDiaMm"];
      if (positive(shaft) !== positive(row.attrs.bore_mm) || !positive(row.attrs.dynamic_load_kn)) return undefined;
    }
    if (evaluations >= EVALUATION_BUDGET) return undefined;
    const next = picked(request, modules, stage, row);
    return passed(checksOf(calc(next), stage)) ? next : undefined;
  };
  const chainFeasible = (modules: ModulesState, chain: Stage[], index = 0): boolean => {
    if (index >= chain.length) return true;
    const stage = chain[index];
    if (groupLocked(request, stage.module, stage.section)) {
      return passed(checksOf(calc(modules), stage)) && chainFeasible(modules, chain, index + 1);
    }
    const options = candidatesFor(stage);
    // Hiç katalog verisi olmayan bölüm ayrı eksik olarak kalır; başka bir
    // redüktör o kataloğu yaratamayacağı için bütün arama orada tüketilmez.
    if (!options.length) return chainFeasible(modules, chain, index + 1);
    for (const row of options) {
      if (evaluations >= EVALUATION_BUDGET) break;
      const next = candidateFits(modules, stage, row);
      if (next && chainFeasible(next, chain, index + 1)) return true;
    }
    return false;
  };
  for (const [index, stage] of stageList.entries()) {
    progress?.({ stage: `${MODULE_LABELS[stage.module]} · ${stage.label}`, completed: index, total: stageList.length, evaluations });
    if (evaluations >= EVALUATION_BUDGET) { issues.push({ code: "budget", state: "missing", message: "Arama bütçesi doldu; kalan seçimler tamamlanmadı." }); break; }
    if (groupLocked(request, stage.module, stage.section)) continue;
    if (["2.9", "5.9", "safety", "11.1", "11.2", "11.3"].includes(stage.section) && checksOf(calc(beam[0].modules), stage).length === 0) continue;
    const next: Candidate[] = [];
    const partial: Candidate[] = [];
    const chain = dependencies(stage);
    const retain = (candidate: Candidate): boolean => {
      if (chainFeasible(candidate.modules, chain)) { next.push(candidate); return true; }
      if (partial.length < BEAM_WIDTH) partial.push(candidate);
      return false;
    };
    for (const candidate of beam) {
      if (stage.section.startsWith("design-")) {
        let accepted = 0;
        for (const modules of designCandidates(request, candidate, stage, calc(candidate.modules))) {
          const result = calc(modules);
          const structural = stage.section === "design-girder" || stage.section === "design-end";
          const checks = structural ? [ ...(moduleResult(result, stage.module)?.checks ?? []), ...(stage.module === "girder" && request.active.includes("buckling") ? result.buckling?.checks ?? [] : []) ].filter(c => !HUMAN_CHECK.test(c.id) && checkSeverity(c) === "engelleyici") : checksOf(result, stage);
          if (passed(checks)) {
            // Bir sonraki rulman/kaplin adımı için birkaç uygun geometri dalı korunur.
            const inputs = record(modules[stage.module].inputs);
            const dimensionCost = Object.entries(inputs).filter(([field, value]) => /(?:Thickness|Dia|^shaftD|^h3)/.test(field) && typeof value === "number").reduce((sum, [, value]) => sum + Number(value), 0) / 10000;
            if (retain({ ...candidate, modules, cost: candidate.cost + dimensionCost }) && ++accepted >= BEAM_WIDTH) break;
          }
        }
      } else if (stage.section === "safety") {
        const state = candidate.modules[stage.module];
        const selections = record(state.selections);
        const inputs = record(state.inputs);
        for (const model of SAFETY_BRAKES) {
          const gap = Number(selections.safetyBrakeAirGapMm);
          if (!model.clampKn[gap as 1 | 2 | 3]) continue;
          const flange = minFlangeDiaMm({ model, drumDiaMm: Number(selections.drumDiaMm), clearanceMm: Number(inputs.safetyBrakeFlangeClearanceMm) });
          const unit = recommendHydraulicUnit(model, brakesInArrangement(String(selections.safetyBrakeArrangement)));
          const modules = patch(request, candidate.modules, stage.module, "selections", { safetyBrakeModel: model.code,
            safetyBrakeHydraulicUnit: unit?.code ?? null,
            ...(request.sizeDesigns ? { safetyBrakeFlangeDiaMm: Math.ceil(flange / 10) * 10, safetyBrakeFlangeThicknessMm: Math.max(model.minDiscThicknessMm, Number(selections.safetyBrakeFlangeThicknessMm)) } : {}),
          });
          const result = calc(modules);
          if (!passed(checksOf(result, stage))) continue;
          const row: EquipmentRow = { id: `sibre:${model.code}`, kind: "brake", brand: "SIBRE", model: model.code, attrs: { ...model, source: "SIBRE SHI / SHI-FC · calc/safety-brake.ts" } };
          next.push({ modules, decisions: [...candidate.decisions, decision(stage, row, result)], cost: candidate.cost + model.weightKg / 10000 });
          break;
        }
      } else if (stage.section === "drive") {
        const hoist = isHoistKey(stage.module);
        const motorStage: Stage = { ...stage, section: hoist ? "2.4" : "5.4", label: "Motor", groups: ["motor"], brand: "motor" };
        const gearboxStage: Stage = { ...stage, section: hoist ? "2.3" : "5.5", label: "Redüktör", groups: ["gearbox"], brand: hoist ? "hoistGearbox" : "travelGearbox", order: "output_torque_nm" };
        const motorLocked = groupLocked(request, stage.module, motorStage.section);
        const gearboxLocked = groupLocked(request, stage.module, gearboxStage.section);
        const motors: (EquipmentRow | undefined)[] = motorLocked ? [undefined] : candidatesFor(motorStage);
        const gearboxes: (EquipmentRow | undefined)[] = gearboxLocked ? [undefined] : candidatesFor(gearboxStage);
        let accepted = 0;
        for (const motor of motors) {
          const m = motor ? picked(request, candidate.modules, motorStage, motor) : candidate.modules;
          const motorRpm = positive(record(m[stage.module].selections).motorRpm);
          if (!motorRpm) continue;
          const requiredRatioResult = calc(m);
          const ratioCheck = checksOf(requiredRatioResult, gearboxStage).find(c => c.id.endsWith(".ratio"));
          // Gereken oran hücresi ortak motor tarafından üretilir.
          const cells = moduleResult(requiredRatioResult, stage.module)?.cells ?? {};
          const requiredRatio = Number(cells["gearbox.requiredRatio"]);
          if (!Number.isFinite(requiredRatio) || !ratioCheck) continue;
          // Anma hızındaki güç alt sınırı: fiziksel formül tekrar yazılmaz.
          let ideal = patch(request, m, stage.module, "inputs", { gearboxRatioAuto: false });
          ideal = patch(request, ideal, stage.module, "selections", { gearboxRatio: requiredRatio });
          const idealResult = calc(ideal);
          const power = checksOf(idealResult, motorStage)[0];
          if (!power || power.op === "range" || !Number.isFinite(power.required) || power.provided < power.required * (1 - request.speedTolerancePct / 100)) continue;
          const idealCells = moduleResult(idealResult, stage.module)?.cells ?? {};
          const torqueCheck = checksOf(idealResult, gearboxStage).find(c => c.id.endsWith(".torque"));
          const requiredOutputNm = hoist && torqueCheck && torqueCheck.op !== "range" ? torqueCheck.required * 1000 : Number(idealCells["gearbox.requiredOutputTorque"]);
          const radialCheck = checksOf(idealResult, gearboxStage).find(c => c.id.endsWith(".radial"));
          for (const gearbox of gearboxes) {
            if (evaluations >= EVALUATION_BUDGET) break;
            if (gearbox) {
              const ratio = positive(gearbox.attrs.ratio)!;
              if (Math.abs(requiredRatio / ratio - 1) * 100 > request.speedTolerancePct) continue;
              const catalogRpm = positive(gearbox.attrs.input_speed_rpm)!;
              // Katalog giriş devri bir çalışma noktasıdır; keyfi ölçeklenmez.
              if (motorRpm > catalogRpm || motorRpm < catalogRpm * 0.9) continue;
              if (positive(gearbox.attrs.output_torque_nm)! < requiredOutputNm * 0.94) continue;
              if (radialCheck && radialCheck.op !== "range" && positive(gearbox.attrs.allowed_radial_output_kn)! < radialCheck.required) continue;
            }
            const modules = gearbox ? picked(request, m, gearboxStage, gearbox) : m;
            const result = calc(modules);
            if (!passed(checksOf(result, stage)) || !speedPass(request, result, stage.module)) continue;
            const thermal = positive(gearbox?.attrs.thermal_power_kw);
            const demand = Number(moduleResult(result, stage.module)?.cells[hoist ? "motor.requiredPower" : "motor.powerPerMotor"]);
            if (thermal && thermal < demand) continue;
            const decisions = [...candidate.decisions];
            if (motor) decisions.push(decision(motorStage, motor, result));
            if (gearbox) decisions.push(decision(gearboxStage, gearbox, result));
            const complete = retain({ modules, decisions, cost: candidate.cost + Number(record(modules[stage.module].selections).motorPowerKw) + (positive(gearbox?.attrs.weight_kg) ?? 100000) / 10000 });
            if (complete) accepted++;
            if (accepted >= BEAM_WIDTH * 3) break;
          }
          if (accepted >= BEAM_WIDTH * 3 || evaluations >= EVALUATION_BUDGET) break;
        }
      } else {
        const options = candidatesFor(stage);
        let accepted = 0;
        for (const row of options) {
          if (evaluations >= EVALUATION_BUDGET) break;
          if (!catalogCompatible(request, candidate.modules, stage.module, stage.section, row)) continue;
          if (!capacityPrefilter(candidate.modules, stage, row)) continue;
          // Fiziksel oturma çapı bir üst kapasite değildir: tam eşleşir.
          if (row.kind === "bearing" && stage.section !== "4.5" && stage.section !== "2.9") {
            const input = record(candidate.modules[stage.module].inputs);
            const bore = positive(input[stage.section === "4.3" ? "shaftD1Mm" : isHoistKey(stage.module) ? "shaftD2Mm" : "shaftDiaMm"]);
            if (bore !== positive(row.attrs.bore_mm) || !positive(row.attrs.dynamic_load_kn)) continue;
          }
          if (stage.section === "4.5" && !/512|513|514|294|293|292|811|812|thrust|eksenel/i.test(`${row.model} ${row.attrs.type}`)) continue;
          const modules = picked(request, candidate.modules, stage, row);
          const result = calc(modules);
          const checks = checksOf(result, stage).filter(c => stage.section !== "2.9" || c.id.endsWith(".bearing"));
          if (!passed(checks)) continue;
          if (retain({ modules, decisions: [...candidate.decisions, decision(stage, row, result)], cost: candidate.cost + (positive(row.attrs[stage.order ?? "weight_kg"]) ?? 100000) / 1e6 }) && ++accepted >= BEAM_WIDTH) break;
        }
      }
    }
    if (!next.length && partial.length) {
      next.push(...partial);
      issues.push({ code: `search.dependencies.${stage.module}.${stage.section}`, module: stage.module, state: "missing", message: `${stage.label}: bağlı ekipman zinciri bu arama içinde tamamlanamadı. Kısmi aday korundu; tam uygun kombinasyon olduğu doğrulanmadı.` });
    }
    if (next.length) beam = [...new Map(next.map(candidate => [contentHash(candidate.modules), candidate])).values()].sort((a, b) => a.cost - b.cost || contentHash(a.decisions).localeCompare(contentHash(b.decisions), "en")).slice(0, BEAM_WIDTH);
    else issues.push({ code: `selection.${stage.module}.${stage.section}`, module: stage.module, state: "missing", message: `${stage.label}: ${candidatesFor(stage).length ? "taranan adaylarda bağlı hesap ve bağlantı koşulları birlikte sağlanamadı; sınırlı arama tüm kombinasyonların imkânsız olduğunu kanıtlamaz" : "marka/ürün ailesi ve zorunlu verileri sağlayan katalog adayı yok"}. Mevcut değer korundu.` });
  }
  const ranked = beam.map(candidate => ({ candidate, result: calc(candidate.modules) })).sort((a, b) => a.result.allChecks.filter(c => !c.pass && checkSeverity(c) === "engelleyici").length - b.result.allChecks.filter(c => !c.pass && checkSeverity(c) === "engelleyici").length || a.candidate.cost - b.candidate.cost);
  const { candidate: best, result } = ranked[0];
  for (const c of result.allChecks) {
    if (!finiteCheck(c) || !c.pass) issues.push({ code: c.id, state: HUMAN_CHECK.test(c.id) ? "review" : !finiteCheck(c) ? "missing" : checkSeverity(c) === "uyari" ? "review" : "failed", message: c.label });
  }
  for (const key of request.active) {
    if (!moduleResult(result, key)) issues.push({ code: `module.${key}`, module: key, state: "missing", message: "Etkin bölümün hesap sonucu yok." });
    if (isHoistKey(key)) for (const problem of validateReeving(hoistReeving(best.modules[key].inputs as HoistInputs))) issues.push({ code: `reeving.${key}.${problem.alan}`, module: key, state: problem.agirlik === "hata" ? "failed" : "review", message: problem.mesaj });
  }
  for (const d of best.decisions) {
    if (d.row.kind === "gearbox" && !positive(d.row.attrs.thermal_power_kw)) issues.push({ code: `thermal.${d.module}`, module: d.module, state: "missing", message: `${d.row.brand} ${d.row.model}: termik kapasite / çalışma çevrimi doğrulaması eksik.` });
    if (d.row.kind === "coupling" && !positive(d.row.attrs.max_speed_rpm)) issues.push({ code: `speed.${d.module}.${d.section}`, module: d.module, state: "missing", message: `${d.row.brand} ${d.row.model}: kaplinin azami devri ve göbek bağlantısı üreticiyle doğrulanmalı.` });
    if (d.row.kind === "brake" && d.row.attrs.brake_type === "em") issues.push({ code: `mounting.${d.module}.${d.section}`, module: d.module, state: "missing", message: `${d.row.brand} ${d.row.model}: elektromanyetik frenin motor miline montajı ve açma çevrimi doğrulanmalı.` });
    if (d.row.kind === "brake" && d.section !== "safety") issues.push({ code: `braking.${d.module}.${d.section}`, module: d.module, state: "missing", message: `${d.row.brand} ${d.row.model}: duruş başına enerji, saatlik çevrim, sürtünme/ortam koşulları ve bobin veya itici beslemesi üretici belgesiyle doğrulanmalı.` });
    if (d.row.kind === "motor") issues.push({ code: `duty.${d.module}`, module: d.module, state: "missing", message: "Motorun görev çevrimi, besleme, montaj ve sürücü uygunluğu üreticiyle doğrulanmalı." });
  }
  issues.push({ code: "layout", state: "review", message: "Yerleşim, imalat ölçüleri ve girilmiş araba/köprü kütleleri tasarım kabulleridir; ölçü onayı verilmedi." });
  issues.push({ code: "scope.validation", state: "review", message: "Sonuç mevcut hesap motorunun kapsamındaki ön seçimdir; üretici bağlantı/termik koşulları ve mühendislik kontrolü tamamlanmalı." });
  const uniqueIssues = [...new Map(issues.map(issue => [issue.code, issue])).values()];
  progress?.({ stage: "Son kontroller", completed: stageList.length, total: stageList.length, evaluations });
  return { specs: request.specs, modules: best.modules, trace: {
    version: SELECTION_VERSION, engineVersion: ENGINE_VERSION, createdAt: new Date().toISOString(),
    designProfile: request.sizeDesigns ? DESIGN_PROFILE : undefined,
    sourceHash: selectionSourceHash(request.specs, request.modules, request.active), resultHash: selectionSourceHash(request.specs, best.modules, request.active),
    catalogHash: contentHash(rows.map(variantKey)), brands: request.brands, locks: request.locks, decisions: best.decisions,
    issues: uniqueIssues, evaluations, status: uniqueIssues.some(i => i.state !== "review") ? "incomplete" : "readyForReview", search: "bounded",
  } };
}
