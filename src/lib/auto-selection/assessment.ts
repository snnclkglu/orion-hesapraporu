import { girderPlateRatioValid } from "./design-profile";
import { runCalc, type CalcResult } from "@/lib/calc/engine";
import { checkSeverity } from "@/lib/calc/types";
import { moduleResult } from "@/lib/calc/presentation/module-access";
import { isHoistKey, isTravelKey, MODULE_LABELS, type ModuleKey } from "@/lib/calc/presentation/module-family";
import { hoistSpecView } from "@/lib/calc/modules/hoistGroup";
import { travelSpecView } from "@/lib/calc/modules/travelGroup";
import { getCatalogMapping } from "@/lib/catalog-mapping";
import { buildEquipmentGroups } from "@/lib/equipment-list";
import { agirlikDokumu } from "@/lib/weights/topla";
import { selectionCalcInput } from "./solver";
import { checkEvidence, checkPass, failedChecks, finiteCheck, gearboxSpeedMatches, humanCheck } from "./search-policy";
import { contentHash, type SelectionAudit, type SelectionIssue, type SelectionProposal, type SelectionRequest } from "./types";

export interface Assessment {
  result: CalcResult;
  issues: SelectionIssue[];
  failures: string[];
  targets: string[];
  incompleteChains: ModuleKey[];
  repairModules: ModuleKey[];
  nextSpecs: SelectionRequest["specs"];
  masses: SelectionAudit["masses"];
  cost: number;
  verifiedSelections: number;
}
export function lockedSection(request: SelectionRequest, key: ModuleKey, section: string): boolean {
  return request.locks.includes(key) || request.locks.includes(`${key}.${section}`)
    || !!getCatalogMapping(key, section)?.fields.some(field => request.locks.includes(`${key}.selections.${field.sel}`));
}
/** Son seçimi bağımsız olarak ortak motorla inceler; yeni fizik formülü içermez. */
export function assessSelection(request: SelectionRequest, proposal: SelectionProposal): Assessment {
  const active = proposal.active ?? request.active;
  const input = selectionCalcInput({ specs: proposal.specs, active }, proposal.modules);
  const result = runCalc(input);
  // Aday aşamasına ait sayısal notlar atılır. Son hesap yeniden tek kaynaktır.
  const allIds = new Set(result.allChecks.map(check => check.id));
  const issues: SelectionIssue[] = proposal.trace.issues.filter(issue => !allIds.has(issue.code) && !/^(?:mass\.|audit\.|dependency\.)/.test(issue.code)).map(issue => ({ ...issue,
    category: issue.category ?? (issue.code.startsWith("selection.") ? "data" : /^(?:thermal|speed|mounting|braking|duty|gearbox\.mounting)\./.test(issue.code) ? "human" : issue.state === "unsupported" ? "constraint" : "human") }));
  const failures: string[] = [], targets: string[] = [];
  const repair = new Set<ModuleKey>();
  for (const check of result.allChecks) {
    if (checkPass(check)) continue;
    const key = check.id.split(".")[0] as ModuleKey;
    const human = humanCheck(check.id);
    issues.push({ code: check.id, module: active.includes(key) ? key : undefined, state: human ? "review" : finiteCheck(check) ? "failed" : "missing", category: human ? "human" : request.locks.includes(key) ? "constraint" : "repairable", message: check.label, evidence: checkEvidence(check) });
    if (human) continue;
    (checkSeverity(check) === "engelleyici" || !finiteCheck(check) ? failures : targets).push(check.id);
    if (active.includes(key)) repair.add(key);
  }
  const incompleteChains: ModuleKey[] = [];
  for (const key of active) {
    const moduleOutput = moduleResult(result, key);
    if (!moduleOutput) { failures.push(`audit.module.${key}`); issues.push({ code: `audit.module.${key}`, module: key, state: "missing", category: "data", message: "Etkin bölümün hesap sonucu yok." }); }
    if (request.sizeDesigns && (key === "girder" || key === "girder2") && !girderPlateRatioValid(proposal.modules[key].inputs as unknown as Record<string, unknown>)) {
      const code = `audit.girderRatio.${key}`;
      failures.push(code); repair.add(key);
      issues.push({ code, module: key, state: "failed", category: request.locks.includes(key) ? "constraint" : "repairable", message: "Yan sac yüksekliği / üst sac genişliği oranı 1,5–3 arasında olmalı." });
    }
    if (!isHoistKey(key) && !isTravelKey(key)) continue;
    const hoist = isHoistKey(key);
    const sections = hoist ? ["2.4", "2.3"] : ["5.4", "5.5"];
    const driveChecks = (moduleOutput?.checks ?? []).filter(check => new RegExp(`^${key}\\.(motor|gearbox)\\.`).test(check.id));
    const chosen = sections.every(section => lockedSection(request, key, section) || proposal.trace.decisions.some(d => d.module === key && d.section === section));
    const selection = proposal.modules[key].selections as Record<string, unknown>;
    const gear = proposal.trace.decisions.find(d => d.module === key && d.section === sections[1]);
    const point = !gear || gearboxSpeedMatches(Number(selection.motorRpm), gear.row);
    const desired = hoist ? hoistSpecView(proposal.specs, key).liftSpeedMpm : travelSpecView(proposal.specs, key, { hookEquipmentT: 0, trolleyWeightT: 0 }).speedMpm;
    const values = moduleOutput?.values as Record<string, number> | undefined;
    const actual = values?.[hoist ? "actualLiftSpeedMpm" : "actualSpeedMpm"];
    const speedOk = desired > 0 && actual !== undefined && Number.isFinite(actual) && Math.abs(actual / desired - 1) * 100 <= request.speedTolerancePct + 1e-9;
    if (!speedOk) { failures.push(`audit.speed.${key}`); issues.push({ code: `audit.speed.${key}`, module: key, state: "failed", category: "repairable", message: `${MODULE_LABELS[key]}: gerçek hareket hızı ${actual?.toFixed(2) ?? "—"} m/dak; ${desired} m/dak talebi ±%${request.speedTolerancePct} içinde sağlanmıyor.` }); }
    if (!chosen || !point || !driveChecks.length || driveChecks.some(check => !checkPass(check)) || !speedOk) {
      incompleteChains.push(key); repair.add(key);
      issues.push({ code: `audit.chain.${key}`, module: key, state: "missing", category: request.locks.includes(key) ? "constraint" : "repairable", message: `${MODULE_LABELS[key]}: motor–redüktör zinciri kesinleşmedi. Bağlı fren/kaplin değerleri geçicidir ve teklife aktarılmaz.` });
    }
    for (const d of proposal.trace.decisions.filter(d => d.module === key)) d.provisional = incompleteChains.includes(key) && ["2.4", "2.3", "2.5", "2.6", "2.7", "5.4", "5.5", "5.5b", "5.6", "5.7"].includes(d.section);
  }
  const ledger = agirlikDokumu({ input, result, satirlar: buildEquipmentGroups(input).flatMap(group => group.rows).filter(row => row.alt === undefined), durum: request.weightBreakdown, craneType: request.craneType });
  const nextSpecs = { ...proposal.specs };
  const masses: SelectionAudit["masses"] = [];
  for (const band of ledger.bantlar) {
    if (!band.specKey) continue;
    const sources: Record<string, number> = {};
    for (const group of band.gruplar.filter(group => !group.bantToplaminaGirmez)) {
      if (group.ezildi) { sources.elle = (sources.elle ?? 0) + (group.kg ?? 0); continue; }
      for (const item of group.kalemler.filter(item => !item.kapsandi && item.kg !== null)) sources[item.kaynak] = (sources[item.kaynak] ?? 0) + item.kg!;
    }
    const inputKg = Number(proposal.specs[band.specKey]) * 1000;
    masses.push({ key: band.key, inputKg: Number.isFinite(inputKg) ? inputKg : null, modelKg: band.kg, unknown: band.eksikKalemSayisi, estimated: band.tahminIcerir, sources });
    const extra = band.gruplar.filter(group => !group.bantToplaminaGirmez && !group.ezildi).flatMap(group => group.kalemler).reduce((sum, item) => sum + (item.kgUst != null && item.kg != null ? Math.max(0, item.kgUst - item.kg) : 0), 0);
    const modelKg = band.kg === null ? null : band.kg + extra;
    const conflict = modelKg !== null && Number.isFinite(modelKg) && modelKg > inputKg + 50;
    if (conflict) {
      failures.push(`mass.conflict.${band.key}`);
      issues.push({ code: `mass.conflict.${band.key}`, state: "failed", category: request.locks.includes(`specs.${band.specKey}`) ? "constraint" : "repairable", message: `${band.label}: tasarımın ${Math.round(modelKg!)} kg ${band.eksikKalemSayisi ? "kısmi " : ""}kütle modeli, hesapta kullanılan ${Math.round(inputKg)} kg değerini aşıyor. Bu toplam ölçülmüş ağırlık değildir; kütle ve kesit birlikte doğrulanmalı.` });
    }
    if (band.eksikKalemSayisi || modelKg === null) {
      const missing = band.gruplar.filter(group => !group.ezildi && !group.bantToplaminaGirmez).flatMap(group => group.kalemler).filter(item => item.kg === null && !item.kapsandi).map(item => item.label).slice(0, 6);
      issues.push({ code: `mass.${band.key}`, state: "missing", category: "data", message: `${band.label}: ${modelKg === null ? "kütle toplamı hesaplanamadı" : `${band.eksikKalemSayisi} kalemin ağırlığı eksik`}${missing.length ? ` (${missing.join(", ")})` : ""}; kısmi toplam tam ağırlık veya ölçüm sayılmaz. Bilinmeyen ağırlıklar boş bırakıldı.` });
    }
    if (band.tahminIcerir) issues.push({ code: `mass.assumption.${band.key}`, state: "review", category: "human", message: `${band.label}: kütle modelinde firma tahminleri var; nihai ağırlık doğrulanmalı.` });
    // Kullanıcının ölçü önerisi yetkisi içinde altındaki hesabı büyüten kısmi
    // model yalnız tasarım kabulünü yükseltir; eksik kalemler tamamlandı denmez.
    if (request.sizeDesigns && !request.locks.includes(`specs.${band.specKey}`) && modelKg !== null && modelKg > 0 && Number.isFinite(modelKg) && (!band.eksikKalemSayisi || conflict)) nextSpecs[band.specKey] = Math.ceil(modelKg / 50) * 0.05;
  }
  const massChanged = contentHash(nextSpecs) !== contentHash(proposal.specs);
  // Yük değişikliği bütün mekanik bağımlıları etkiler; formüller yine runCalc'ta.
  if (massChanged) for (const key of active) if (key !== "electrical" && key !== "cabin") repair.add(key);
  if (repair.has("buckling") || repair.has("wheelLoads")) { if (active.includes("girder")) repair.add("girder"); }
  if (repair.has("girder") || repair.has("girder2")) for (const key of active) if (isTravelKey(key) || key === "endCarriage") repair.add(key);
  if (repair.has("main") && active.includes("hookBlock")) repair.add("hookBlock");
  if (repair.has("aux") && active.includes("auxHookBlock")) repair.add("auxHookBlock");
  const repairModules = active.filter(key => repair.has(key) && !request.locks.includes(key));
  const cost = active.reduce((sum, key) => {
    const cells = moduleResult(result, key)?.cells;
    const v = key === "girder" || key === "girder2" ? Number(cells?.["section.weightPerLength"]) : isHoistKey(key) || isTravelKey(key) ? Number((proposal.modules[key].selections as Record<string, unknown>).motorPowerKw) : 0;
    const dimensions = Object.entries(proposal.modules[key].inputs).reduce((total, [field, value]) => total + (/^shaftD|^shaftDia|^drumWallThickness/.test(field) && typeof value === "number" && Number.isFinite(value) ? value / 1000 : 0), 0);
    return sum + (Number.isFinite(v) ? v : 0) + dimensions;
  }, 0);
  return { result, issues: [...new Map(issues.map(issue => [issue.code, issue])).values()], failures, targets, incompleteChains, repairModules, nextSpecs, masses, cost, verifiedSelections: proposal.trace.decisions.filter(d => !d.provisional && d.checked.length > 0 && d.checked.every(id => result.allChecks.some(check => check.id === id && checkPass(check)))).length };
}
/** Yeni sayısal hata/hedef kaybı üreten tur, toplam hata sayısı düşse de alınmaz. */
export function improves(next: Assessment, previous: Assessment): boolean {
  const oldPass = new Set(previous.result.allChecks.filter(check => !humanCheck(check.id) && checkPass(check)).map(check => check.id));
  if (failedChecks(next.result.allChecks).some(check => oldPass.has(check.id))) return false;
  const oldProblems = new Set([...previous.failures, ...previous.targets]);
  if ([...next.failures, ...next.targets].some(id => !oldProblems.has(id))) return false;
  const a = [next.failures.length, next.incompleteChains.length, next.targets.length, -next.verifiedSelections, next.cost];
  const b = [previous.failures.length, previous.incompleteChains.length, previous.targets.length, -previous.verifiedSelections, previous.cost];
  for (let i = 0; i < a.length; i++) if (Math.abs(a[i] - b[i]) > 1e-6) return a[i] < b[i];
  return false;
}
