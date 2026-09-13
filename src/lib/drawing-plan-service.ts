// Sunucu orkestrasyonu: kaynak rapor okunur, saf çekirdek çalışır, tek RPC kaydeder.
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadDrawingPlanDocument } from "./drawing-plan-data";
import {
  calcInputFromRevision,
  type RevisionInputsJson,
  type RevisionSelectionsJson,
} from "./revision-load";
import { deriveDrawingPlan } from "./drawing-plan/derive";
import { reconcileDrawingPlan } from "./drawing-plan/reconcile";
import type {
  DrawingPlanDocument,
  DrawingPlanState,
} from "./drawing-plan/types";
import type { DrawingPlanRow } from "./drawing-plan";

export async function drawingPlanSource(
  supabase: SupabaseClient,
  projectId: string,
  revisionId?: string | null,
) {
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("crane_type,report_context")
    .eq("id", projectId)
    .maybeSingle();
  if (projectError || !project || project.report_context === "offer")
    throw new Error("Mühendislik projesi bulunamadı.");
  let query = supabase
    .from("revisions")
    .select("id,label,inputs,selections,updated_at")
    .eq("project_id", projectId);
  if (revisionId) query = query.eq("id", revisionId);
  const { data, error } = await query
    .order("rev_no", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) throw new Error("Kaynak hesap raporu bulunamadı.");
  const raw = data.inputs as RevisionInputsJson;
  return {
    revision: data,
    derivation: deriveDrawingPlan(
      calcInputFromRevision(raw, data.selections as RevisionSelectionsJson),
      raw,
      project.crane_type ?? "",
    ),
  };
}

export async function persistDrawingPlan(
  supabase: SupabaseClient,
  projectId: string,
  document: DrawingPlanDocument,
  rows: DrawingPlanRow[],
  state: DrawingPlanState,
  sourceStamp: string | null,
) {
  const { data, error } = await supabase.rpc("save_drawing_plan_document", {
    p_project_id: projectId,
    p_expected_version: document.state.version,
    p_rows: rows,
    p_state: state,
    p_source_updated_at: sourceStamp,
  });
  if (error) throw new Error(error.message);
  return {
    rows,
    state: { ...state, version: Number(data), sourceUpdatedAt: sourceStamp },
  };
}

export async function syncDrawingPlanAfterSave(
  supabase: SupabaseClient,
  projectId: string,
  revisionId: string,
): Promise<string | undefined> {
  const document = await loadDrawingPlanDocument(supabase, projectId);
  if (
    document.state.sourceRevisionId &&
    document.state.sourceRevisionId !== revisionId
  )
    return "Teknik resim planının kaynağı başka bir revizyon. Kaynağı Teknik Resim Takibi'nden değiştirebilirsiniz.";
  // Kaynağı silinmiş mevcut deftere yeni kaynağı sessizce atamayız.
  if (!document.state.sourceRevisionId && document.rows.length > 0)
    return "Mevcut teknik resim planı korundu. Hesapla eşlemek için Teknik Resim Takibi'ni açın.";
  const source = await drawingPlanSource(supabase, projectId, revisionId);
  if (document.state.fingerprint === source.derivation.fingerprint)
    return undefined;
  const result = reconcileDrawingPlan(
    document.rows,
    source.derivation.candidates,
    document.state.numbering,
  );
  const state = {
    ...document.state,
    sourceRevisionId: revisionId,
    sourceRevisionLabel: source.revision.label,
    fingerprint: source.derivation.fingerprint,
  };
  await persistDrawingPlan(
    supabase,
    projectId,
    document,
    result.rows,
    state,
    source.revision.updated_at,
  );
  const pending = result.changes.filter(
    (c) => c.kind !== "add" || !result.rows.some((r) => r.sourceKey === c.key),
  );
  return pending.length
    ? `Teknik resim planında ${pending.length} değişiklik incelenmeli.`
    : `Teknik resim planı hazır · ${result.rows.filter((r) => !r.suppressed).length} grup.`;
}
