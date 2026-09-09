"use server";

import { createClient } from "@/lib/supabase/server";
import { canEditOffers } from "@/lib/roles";
import { withDefaults } from "@/lib/offers/payload";
import { activeOfferReportInput, reportInputFromOfferItem } from "@/lib/auto-selection/offer-bridge";
import { runCalc } from "@/lib/calc/engine";
import { CALC_FIELD, loadRevision, type RevisionInputsJson, type RevisionSelectionsJson } from "@/lib/revision-load";
import { MODULE_ORDER } from "@/lib/calc/presentation/module-family";
import { offerDemand, offerDemandDifferences, offerDemandPatch, DEMAND_NUMBERS } from "@/lib/auto-selection/offer-demand";
import { applyCraneTypeRevisionPreset } from "@/lib/crane-types";
import { contentHash } from "@/lib/auto-selection/types";
import type { SupabaseClient } from "@supabase/supabase-js";

const REPORT_COLUMNS = "id,project_id,rev_no,status,inputs,selections,updated_at";
async function reportById(supabase: SupabaseClient, revisionId: string) {
  const { data } = await supabase.from("revisions").select(REPORT_COLUMNS).eq("id", revisionId).maybeSingle();
  if (!data) return null;
  const { data: project } = await supabase.from("projects").select("report_context,crane_type").eq("id", data.project_id).maybeSingle();
  return project?.report_context === "offer" ? { ...data, craneType: project.crane_type as string } : null;
}

export async function openOfferItemCalculation(offerRevisionId: string, itemId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı." };
  const [{ data: profile }, { data: offerRevision }] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(),
    supabase.from("offer_revisions").select("id,status,payload").eq("id", offerRevisionId).maybeSingle(),
  ]);
  if (!profile || !canEditOffers(profile.role) || !offerRevision || offerRevision.status !== "draft") return { error: "Teklif düzenleme yetkisi veya taslak bulunamadı." };
  const item = withDefaults(offerRevision.payload).items.find(item => item.id === itemId);
  if (!item) return { error: "Önce teklif kalemini kaydedin." };
  const { data: link } = await supabase.from("offer_item_calculations").select("revision_id").eq("offer_revision_id", offerRevisionId).eq("item_id", itemId).maybeSingle();
  let sourceId: string | undefined = link?.revision_id;
  if (!sourceId && item.calculationOrigin) {
    const { data: origin } = await supabase.from("offer_item_calculations").select("revision_id")
      .eq("offer_revision_id", item.calculationOrigin.offerRevisionId ?? offerRevisionId).eq("item_id", item.calculationOrigin.itemId).maybeSingle();
    sourceId = origin?.revision_id;
  }
  sourceId ??= item.calculationSource?.revisionId;
  const previous = sourceId ? await reportById(supabase, sourceId) : null;
  if (sourceId && !previous) return { error: "Kaynak hesaba erişilemiyor; kopyanın hesap içeriği korunarak açılması için kaynak rapor erişimini kontrol edin." };
  const demand = offerDemand(item);
  const prepared = reportInputFromOfferItem(item);
  const inputs: RevisionInputsJson = previous ? structuredClone(previous.inputs) : { specs: prepared.input.specs, disabledModules: prepared.disabled };
  const selections: RevisionSelectionsJson = previous ? structuredClone(previous.selections) : {};
  let changes: string[] = [];
  if (previous) {
    const loaded = loadRevision(inputs, selections);
    changes = offerDemandDifferences(item, loaded.full.specs);
    const patch = offerDemandPatch(demand, inputs.offerTechnicalSource?.values);
    changes.push(...Object.entries(patch).filter(([, value]) => value === null).map(([key]) => `${DEMAND_NUMBERS.find(value => value[0] === key)?.[4] ?? key} temizlendi`));
    const oldType = inputs.offerTechnicalSource?.craneType ?? previous.craneType;
    if (oldType !== item.craneType) changes.push("Vinç tipi");
    if (link && previous.status === "draft" && !changes.length && inputs.offerTechnicalSource?.fingerprint === demand.fingerprint) return loadOfferItemCalculation(offerRevisionId, itemId);
    const preset = oldType !== item.craneType
      ? applyCraneTypeRevisionPreset(0, item.craneType, { specs: loaded.full.specs, disabledModules: inputs.disabledModules ?? [] }) : { specs: loaded.full.specs, disabledModules: inputs.disabledModules };
    inputs.specs = { ...(preset.specs as typeof loaded.full.specs), ...patch } as typeof loaded.full.specs;
    inputs.disabledModules = preset.disabledModules as string[] | undefined;
    if (demand.values.auxCapacityT && !loaded.input.auxHoist) inputs.disabledModules = (inputs.disabledModules ?? []).filter(key => key !== "aux" && key !== "auxHookBlock");
    if (inputs.autoSelection && (!link || changes.length)) delete inputs.autoSelection.review;
  } else for (const key of MODULE_ORDER) {
    const field = CALC_FIELD[key]; const state = prepared.input[field as keyof typeof prepared.input] as { inputs?: object; selections?: object } | undefined;
    if (state?.inputs) Object.assign(inputs, { [field]: state.inputs });
    if (state?.selections) Object.assign(selections, { [field]: state.selections });
  }
  inputs.offerTechnicalSource = { offerRevisionId, itemId, warnings: prepared.warnings, fingerprint: demand.fingerprint, craneType: item.craneType, values: demand.values };
  const loaded = loadRevision(inputs, selections);
  const result = runCalc(activeOfferReportInput(loaded.full, inputs.disabledModules ?? []));
  const rawItem = (offerRevision.payload as { items: { id: string }[] }).items.find(value => value.id === itemId);
  const { data, error } = await supabase.rpc("open_offer_item_calculation_v2", {
    p_offer_revision_id: offerRevisionId, p_item_id: itemId, p_expected_item: rawItem,
    p_source_revision_id: previous?.id ?? null, p_source_updated_at: previous?.updated_at ?? null,
    p_inputs: inputs, p_selections: selections, p_results: JSON.parse(JSON.stringify(result)), p_engine_version: result.engineVersion,
  });
  if (error || !data?.[0]) return { error: error?.message ?? "Hesap raporu açılamadı." };
  return { ...await loadOfferItemCalculation(offerRevisionId, itemId), syncNotice: changes.length ? `Tekliften güncellendi: ${changes.join(", ")}. Mevcut ekipmanlar korundu; hızlı seçimi yeniden çalıştırıp raporu kaydedin.` : !link && previous ? "Kaynak hesabın manuel seçimleri bağımsız hesap kopyasına taşındı." : undefined };
}

export async function loadOfferItemCalculation(offerRevisionId: string, itemId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı." };
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (!profile || !canEditOffers(profile.role)) return { error: "Teklif düzenleme yetkisi gerekli." };
  const { data: link, error } = await supabase.from("offer_item_calculations").select("project_id,revision_id").eq("offer_revision_id", offerRevisionId).eq("item_id", itemId).maybeSingle();
  if (error || !link) return { error: "Bağlı hesap bulunamadı." };
  const revision = await reportById(supabase, link.revision_id);
  if (!revision) return { error: "Hesap revizyonu bulunamadı." };
  const inputs = revision.inputs as RevisionInputsJson;
  const selections = revision.selections as RevisionSelectionsJson;
  const loaded = loadRevision(inputs, selections);
  return { report: { projectId: link.project_id, revisionId: revision.id, revisionNo: revision.rev_no, status: revision.status,
    updatedAt: revision.updated_at, full: loaded.full, input: loaded.input, inputs, selections, craneType: inputs.offerTechnicalSource?.craneType ?? revision.craneType,
    snapshotHash: contentHash({ inputs, selections }) } };
}
