import { MODULE_ORDER } from "@/lib/calc/presentation/module-family";
import { completeElectricalSelection } from "./electrical";
import { prepareSelectionRequest } from "./technical-contract";
import { applyDesignInputs } from "./design-inputs";
import { completeOrderDefaults } from "./order-defaults";
import { normalize, solveSelection as solvePass } from "./solver";
import { assessSelection, improves, type Assessment } from "./assessment";
import { budgetExpired, checkEvidence, SEARCH_POLICY, SEARCH_TIME_BUDGET_MS, type SearchBudget } from "./search-policy";
import { selectionScopeIssues } from "./scope";
import { contentHash, selectionSourceHash, type EquipmentRow, type SelectionAudit, type SelectionProgress, type SelectionProposal, type SelectionRequest } from "./types";

/** Aynı düğme/worker içinde seç → denetle → ilgili grubu düzelt → karşılaştır. */
export function solveSelection(request: SelectionRequest, rows: EquipmentRow[], progress?: (progress: SelectionProgress) => void): SelectionProposal {
  const started = performance.now();
  const budget: SearchBudget = { evaluations: 0, maxEvaluations: 60000, deadline: started + SEARCH_TIME_BUDGET_MS };
  const prepared = prepareSelectionRequest(applyDesignInputs(request));
  if (request.enableStructuralChecks && request.active.includes("girder")) prepared.active = MODULE_ORDER.filter(key => request.active.includes(key) || key === "buckling" || key === "endCarriage");
  let working = prepared;
  let best: SelectionProposal | undefined, bestAssessment: Assessment | undefined;
  let current: SelectionProposal | undefined, assessment: Assessment | undefined;
  const attempts: SelectionAudit["attempts"] = [];
  const seen = new Set<string>();
  let stop: SelectionAudit["stop"] = "limit";
  let initialProblems = new Set<string>();
  for (let iteration = 0; iteration < 4; iteration++) {
    if (budgetExpired(budget)) { stop = "budget"; break; }
    const before = budget.evaluations;
    const targets = iteration ? assessment!.repairModules : undefined;
    const reason = !iteration ? "İlk bağlı seçim" : contentHash(working.specs) !== contentHash(current!.specs) ? "Kütle–kesit–tahrik tutarlılığı" : "Eksik bağlı gruplar ve tasarım hedefleri";
    const previous = current;
    current = solvePass(working, rows, value => progress?.({ ...value, stage: `${iteration + 1}. tur · ${value.stage}`, evaluations: budget.evaluations }), { budget, targets, previousDecisions: previous?.trace.decisions, designBase: prepared.modules });
    current.active = prepared.active;
    if (targets && previous) current.trace.issues.push(...previous.trace.issues.filter(issue => issue.module && !targets.includes(issue.module)));
    completeOrderDefaults(working, current);
    const beforeElectrical = current.trace.evaluations;
    completeElectricalSelection(working, current);
    budget.evaluations += current.trace.evaluations - beforeElectrical;
    progress?.({ stage: `${iteration + 1}. tur · Sonuç, bağlı ekipmanlar ve kütle denetleniyor`, completed: iteration + 1, total: 4, evaluations: budget.evaluations });
    assessment = assessSelection(working, current); budget.evaluations++;
    current.trace.issues = assessment.issues;
    const hash = selectionSourceHash(current.specs, current.modules, prepared.active);
    if (!iteration) {
      // İlk arama da kullanıcının önceden geçen kontrollerini kaybedemez.
      best = { ...current, specs: { ...prepared.specs }, modules: normalize(prepared, structuredClone(prepared.modules)), trace: { ...current.trace, decisions: [], issues: selectionScopeIssues(prepared) } };
      bestAssessment = assessSelection(prepared, best); budget.evaluations++;
      best.trace.issues = bestAssessment.issues;
      initialProblems = new Set([...bestAssessment.failures, ...bestAssessment.targets, ...bestAssessment.incompleteChains.map(key => `chain.${key}`)]);
    }
    const accepted = improves(assessment, bestAssessment!);
    attempts.push({ iteration: iteration + 1, reason, resultHash: hash, accepted,
      explanation: accepted ? iteration ? "Önceki geçen kontroller korundu; sonuç iyileşti." : "İlk seçim denetlendi." : "Yeni hata/hedef kaybı veya iyileşme yok; önceki daha iyi taslak korundu.",
      failures: assessment.failures.length, targets: assessment.targets.length, incompleteChains: assessment.incompleteChains.length, evaluations: budget.evaluations - before });
    if (accepted) { best = structuredClone(current); bestAssessment = assessment; }
    if (!assessment.failures.length && !assessment.targets.length && !assessment.incompleteChains.length && contentHash(assessment.nextSpecs) === contentHash(current.specs)) { stop = "complete"; break; }
    if (seen.has(hash)) { stop = "cycle"; break; }
    seen.add(hash);
    const massChanged = contentHash(assessment.nextSpecs) !== contentHash(current.specs);
    if (!assessment.repairModules.length && !massChanged) { stop = "noRepair"; break; }
    // Kabul edilmeyen bir ara dal en fazla kalan bütçede denenir; kullanıcıya
    // yalnız best döner. Geometri/kütle onarımının iki adımda kapanmasına izin verir.
    working = { ...prepared, specs: assessment.nextSpecs, modules: current.modules };
    if (massChanged && best && iteration < 3) {
      // Yeni kütleyi öğrendikten sonra eski düşük yükteki yeşil hesapla
      // karşılaştırmak yanıltır. İki tasarım da AYNI yeni yükte kıyaslanır.
      best.specs = { ...working.specs };
      best.modules = normalize({ ...prepared, specs: best.specs }, best.modules);
      bestAssessment = assessSelection({ ...prepared, specs: best.specs }, best); budget.evaluations++;
      best.trace.issues = bestAssessment.issues;
    }
    if (iteration === 3) stop = accepted ? "limit" : "noImprovement";
  }
  if (!best || !bestAssessment) throw new Error("Seçim başlatılamadı.");
  if (budgetExpired(budget)) stop = "budget";
  const proposal = best;
  // Bir aday geri alındığında bile fiziksel hesabı değiştirmeyen boş sipariş
  // alanları firma kabulleriyle tamamlanır; kullanıcı değeri/kilidi korunur.
  completeOrderDefaults({ ...prepared, specs: proposal.specs }, proposal);
  const final = assessSelection({ ...prepared, specs: proposal.specs }, proposal); budget.evaluations++;
  proposal.trace.issues = final.issues;
  if (stop === "budget" || stop === "limit" || stop === "cycle" || stop === "noImprovement") proposal.trace.issues.push({ code: "audit.stop", state: "review", category: "human", message: stop === "budget" ? "Ortak süre/hesap bütçesi doldu; denetlenmiş en iyi taslak korundu. Kalan eksikler aşağıda listelenir." : "Otomatik düzeltme turu tamamlandı; iyileştirmeyen veya aynı sonuca dönen deneme uygulanmadı. Denetlenmiş en iyi taslak korundu." });
  const remaining = new Set([...final.failures, ...final.targets, ...final.incompleteChains.map(key => `chain.${key}`)]);
  proposal.trace.audit = { policy: SEARCH_POLICY, source: { specs: structuredClone(request.specs), modules: structuredClone(request.modules), active: [...request.active], sizeDesigns: request.sizeDesigns, speedTolerancePct: request.speedTolerancePct, craneType: request.craneType, weightBreakdown: structuredClone(request.weightBreakdown), enableStructuralChecks: request.enableStructuralChecks }, attempts, stop, elapsedMs: Math.round(performance.now() - started),
    resolved: [...initialProblems].filter(id => !remaining.has(id)).length, remaining: remaining.size, masses: final.masses };
  proposal.trace.weightSourceHash = contentHash(request.weightBreakdown ?? {});
  proposal.trace.design = request.design;
  proposal.trace.series = request.series;
  proposal.trace.issues.push({ code: "motor.rpmPolicy", state: "review", category: "human", message: "Firma kabulü: yeni motor seçiminde standart 1500 dev/dak sınıfı (±%10) kullanılır. Gerçek katalog etiket devri korunur; redüktör referans devrine ±%10 kabul uygulanır, kapasite ölçeklenmez. Kilitli motor korunur; gerçek hareket hızı ayrıca kontrol edilir." });
  if (request.design) proposal.trace.issues.push({ code: "design.assumptions", state: "review", category: "human", message: "Halat donanımı, teker/tahrik adetleri ve raylar başlangıç penceresindeki tasarım kararlarıdır. Her tahrik bir tekeri sürer. Diğer ölçüler ve motor sipariş özellikleri rapordaki firma kabulleriyle hesaplandı; düzenlenebilir." });
  proposal.trace.status = proposal.trace.issues.some(issue => issue.state !== "review") ? "incomplete" : "readyForReview";
  proposal.trace.sourceHash = selectionSourceHash(request.specs, request.modules, request.active);
  proposal.trace.resultHash = selectionSourceHash(proposal.specs, proposal.modules, prepared.active);
  proposal.trace.evaluations = budget.evaluations;
  const checks = new Map(final.result.allChecks.map(check => [check.id, check]));
  for (const decision of proposal.trace.decisions) decision.evidence = decision.checked.flatMap(id => {
    const check = checks.get(id);
    return check ? [checkEvidence(check)] : [];
  });
  progress?.({ stage: "Denetim ve otomatik düzeltme tamamlandı", completed: 4, total: 4, evaluations: budget.evaluations });
  return proposal;
}
