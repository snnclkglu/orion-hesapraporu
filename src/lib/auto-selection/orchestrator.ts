import { MODULE_ORDER } from "@/lib/calc/presentation/module-family";
import { completeElectricalSelection } from "./electrical";
import { prepareSelectionRequest } from "./technical-contract";
import { runCalc } from "@/lib/calc/engine";
import { checkDisplay } from "@/lib/calc/types";
import { buildEquipmentGroups } from "@/lib/equipment-list";
import { agirlikDokumu } from "@/lib/weights/topla";
import { selectionCalcInput, solveSelection as solvePass } from "./solver";
import { contentHash, selectionSourceHash, type EquipmentRow, type SelectionIssue, type SelectionProgress, type SelectionProposal, type SelectionRequest } from "./types";

/** Kullanıcının başlattığı işlem içinde kütle → tahrik → kesit bağımlılıklarını kapatır. */
export function solveSelection(request: SelectionRequest, rows: EquipmentRow[], progress?: (progress: SelectionProgress) => void): SelectionProposal {
  let working = prepareSelectionRequest(request);
  if (request.enableStructuralChecks && request.active.includes("girder")) {
    working.active = MODULE_ORDER.filter(key => request.active.includes(key) || key === "buckling" || key === "endCarriage");
  }
  let proposal: SelectionProposal | undefined;
  let evaluations = 0;
  const seen = new Set<string>();
  let massIssues: SelectionIssue[] = [];
  for (let iteration = 0; iteration < 4; iteration++) {
    proposal = solvePass(working, rows, value => progress?.({ ...value, stage: `${iteration + 1}. tur · ${value.stage}`, evaluations: evaluations + value.evaluations }));
    evaluations += proposal.trace.evaluations;
    if (!request.sizeDesigns) break;
    const input = selectionCalcInput(working, proposal.modules);
    const ledger = agirlikDokumu({ input, result: runCalc(input), satirlar: buildEquipmentGroups(input).flatMap(group => group.rows).filter(row => row.alt === undefined), durum: request.weightBreakdown, craneType: request.craneType });
    const nextSpecs = { ...working.specs };
    massIssues = [];
    for (const band of ledger.bantlar) {
      if (!band.specKey || request.locks.includes(`specs.${band.specKey}`)) continue;
      if (band.eksikKalemSayisi > 0 || band.kg === null || band.kg <= 0) {
        const missing = band.gruplar.flatMap(group => group.kalemler).filter(item => item.kg === null && !item.kapsandi).map(item => item.label);
        massIssues.push({ code: `mass.${band.key}`, state: "missing", message: `${band.label}: kütle dökümü eksik (${missing.slice(0, 6).join(", ")}). Teknik özellikteki kütle korundu.` });
        continue;
      }
      // Katalog aralığı varsa üst uç alınır; bir bilinmeyene sıfır yazılmaz.
      const extra = band.gruplar.filter(group => !group.bantToplaminaGirmez && !group.ezildi).flatMap(group => group.kalemler).reduce((sum, item) => sum + (item.kgUst != null && item.kg != null ? Math.max(0, item.kgUst - item.kg) : 0), 0);
      nextSpecs[band.specKey] = Math.ceil((band.kg + extra) / 50) * 0.05;
      if (band.tahminIcerir) massIssues.push({ code: `mass.assumption.${band.key}`, state: "review", message: `${band.label}: kütle dökümünde firma imalat tahminleri var; nihai ağırlık kontrol edilmeli.` });
    }
    const same = contentHash(nextSpecs) === contentHash(working.specs);
    if (same) break;
    const nextHash = contentHash(nextSpecs);
    if (seen.has(nextHash) || iteration === 3) {
      massIssues.push({ code: "mass.convergence", state: "missing", message: "Kütle–ekipman–kesit döngüsü yakınsamadı. Son hesaplanan tutarlı taslak korundu; kütleler ve yerleşim gözden geçirilmeli." });
      break;
    }
    seen.add(contentHash(working.specs));
    working = { ...working, specs: nextSpecs, modules: proposal.modules };
  }
  if (!proposal) throw new Error("Seçim başlatılamadı.");
  proposal.trace.evaluations = evaluations;
  proposal.trace.weightSourceHash = contentHash(request.weightBreakdown ?? {});
  completeElectricalSelection(working, proposal);
  proposal.active = working.active;
  proposal.trace.issues.push(...massIssues);
  proposal.trace.status = proposal.trace.issues.some(issue => issue.state !== "review") ? "incomplete" : "readyForReview";
  proposal.trace.sourceHash = selectionSourceHash(request.specs, request.modules, request.active);
  proposal.trace.resultHash = selectionSourceHash(proposal.specs, proposal.modules, working.active);
  // Son kütle/tahrik/elektrik değişiminden sonra bütün gerekçeler aynı hesaba bağlanır.
  const final = runCalc(selectionCalcInput({ ...working, specs: proposal.specs }, proposal.modules));
  proposal.trace.evaluations++;
  const checks = new Map(final.allChecks.map(check => [check.id, check]));
  const finite = (value: number | undefined) => value === undefined ? undefined : Number.isFinite(value) ? value : null;
  for (const decision of proposal.trace.decisions) decision.evidence = decision.checked.flatMap(id => {
    const check = checks.get(id);
    if (!check) return [];
    const display = checkDisplay(check);
    return [{ id, label: check.label, computed: finite(display.computed) ?? null, limit: finite(display.limit),
      min: finite(display.min), max: finite(display.max), operator: display.operator, unit: display.unit,
      pass: check.pass && Number.isFinite(display.computed) && (display.operator === "…" ? Number.isFinite(display.min) && Number.isFinite(display.max) : Number.isFinite(display.limit)), standard: check.standard }];
  });
  return proposal;
}
