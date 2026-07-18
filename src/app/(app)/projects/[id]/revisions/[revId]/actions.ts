"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { runCalc, type CalcInput } from "@/lib/calc/engine";

export type SaveResult = { error?: string; ok?: boolean };

/**
 * Taslak revizyonu yayınlar (issue): durum 'issued' olur, DB trigger'ı
 * issued_at/issued_by damgalar ve kaydı kilitler. Sonraki değişiklikler
 * yeni revizyon gerektirir.
 */
export async function issueRevision(
  projectId: string,
  revisionId: string,
  label: string
): Promise<SaveResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı" };

  const { data: revision, error } = await supabase
    .from("revisions")
    .update({ status: "issued", label: label.trim() || undefined })
    .eq("id", revisionId)
    .eq("status", "draft")
    .select("rev_no")
    .single();

  if (error || !revision) {
    return { error: error?.message ?? "Revizyon bulunamadı veya zaten yayınlanmış" };
  }

  await supabase.from("audit_log").insert({
    project_id: projectId,
    revision_id: revisionId,
    actor: user.id,
    action: "revision.issue",
    detail: { rev_no: revision.rev_no, label: label.trim() },
  });

  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/revisions/${revisionId}`);
  return { ok: true };
}

/**
 * Taslak revizyonu kaydeder: girdiler + seçimler + sunucuda yeniden hesaplanan
 * sonuç snapshot'ı. Hesap her zaman sunucuda da koşturulur (istemciye güven yok).
 */
export async function saveRevision(
  projectId: string,
  revisionId: string,
  calcInput: CalcInput,
  alts?: Record<string, { active: number; options: Record<string, unknown>[] }>
): Promise<SaveResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı" };

  const result = runCalc(calcInput);

  const { data: updated, error } = await supabase
    .from("revisions")
    .update({
      inputs: {
        specs: calcInput.specs,
        mainHoist: calcInput.mainHoist?.inputs ?? null,
        auxHoist: calcInput.auxHoist?.inputs ?? null,
        hookBlock: calcInput.hookBlock?.inputs ?? null,
        trolley: calcInput.trolley?.inputs ?? null,
        bridge: calcInput.bridge?.inputs ?? null,
        girder: calcInput.girder?.inputs ?? null,
        buckling: calcInput.buckling?.inputs ?? null,
        endCarriage: calcInput.endCarriage?.inputs ?? null,
      },
      selections: {
        mainHoist: calcInput.mainHoist?.selections ?? null,
        auxHoist: calcInput.auxHoist?.selections ?? null,
        hookBlock: calcInput.hookBlock?.selections ?? null,
        trolley: calcInput.trolley?.selections ?? null,
        bridge: calcInput.bridge?.selections ?? null,
        girder: calcInput.girder?.selections ?? null,
        endCarriage: calcInput.endCarriage?.selections ?? null,
        alts: alts ?? {},
      },
      results: JSON.parse(JSON.stringify(result)),
      engine_version: result.engineVersion,
    })
    .eq("id", revisionId)
    .eq("status", "draft")
    .select("id");

  if (error) {
    return {
      error: error.message.includes("Yayınlanmış")
        ? "Bu revizyon yayınlanmış; düzenlenemez."
        : error.message,
    };
  }
  if (!updated || updated.length === 0) {
    return { error: "Bu revizyon yayınlanmış; düzenlenemez. Yeni revizyon oluşturun." };
  }

  await supabase.from("audit_log").insert({
    project_id: projectId,
    revision_id: revisionId,
    actor: user.id,
    action: "revision.save",
    detail: { engine_version: result.engineVersion, all_pass: result.allPass },
  });

  revalidatePath(`/projects/${projectId}/revisions/${revisionId}`);
  return { ok: true };
}
