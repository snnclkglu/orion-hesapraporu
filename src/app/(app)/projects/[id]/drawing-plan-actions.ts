"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { DRAWING_PLAN_STATUSES, type DrawingPlanRow } from "@/lib/drawing-plan";
import { loadDrawingPlanDocument } from "@/lib/drawing-plan-data";
import {
  drawingPlanSource,
  persistDrawingPlan,
} from "@/lib/drawing-plan-service";
import { adBuyuk } from "@/lib/tr-text";
import { numberingError } from "@/lib/drawing-plan/numbering";
import type { DrawingNumbering } from "@/lib/drawing-plan/types";

const rowSchema = z.object({
  id: z.uuid(),
  code: z.string().regex(/^[0-9]{4}$/),
  name: z.string().trim().min(1).max(120).transform(adBuyuk),
  status: z.enum(DRAWING_PLAN_STATUSES.map((s) => s.status)),
  drawnBy: z.uuid().nullable(),
  note: z.string().max(300),
  parentId: z.uuid().nullable().optional(),
  sortOrder: z.number().int().nonnegative().optional(),
  sourceKey: z.string().max(100).nullable().optional(),
  suppressed: z.boolean().optional(),
  origin: z.enum(["auto", "manual", "legacy"]).optional(),
  overrides: z
    .array(z.enum(["name", "code", "parentId", "sortOrder"]))
    .max(4)
    .optional(),
});
export type DrawingPlanInput = z.input<typeof rowSchema>;

export async function getDrawingPlanEditor(
  projectId: string,
  revisionId?: string | null,
) {
  try {
    z.uuid().parse(projectId);
    if (revisionId) z.uuid().parse(revisionId);
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Oturum bulunamadı.");
    const document = await loadDrawingPlanDocument(supabase, projectId);
    const { data: revisions, error } = await supabase
      .from("revisions")
      .select("id,label")
      .eq("project_id", projectId)
      .order("rev_no", { ascending: false });
    if (error) throw new Error("Revizyonlar okunamadı.");
    let source: Awaited<ReturnType<typeof drawingPlanSource>> | null = null;
    if (revisions.length)
      source = await drawingPlanSource(
        supabase,
        projectId,
        revisionId ?? document.state.sourceRevisionId,
      );
    return {
      document,
      derivation: source?.derivation ?? null,
      revisionId: source?.revision.id ?? null,
      revisions,
      error: undefined,
    };
  } catch (cause) {
    return {
      error: cause instanceof Error ? cause.message : "Resim planı okunamadı.",
    };
  }
}

export async function saveDrawingPlan(
  projectId: string,
  rows: DrawingPlanInput[],
  expectedVersion: number,
  revisionId: string | null,
  numbering: DrawingNumbering,
) {
  try {
    z.uuid().parse(projectId);
    z.number().int().nonnegative().parse(expectedVersion);
    if (revisionId) z.uuid().parse(revisionId);
    const clean = z.array(rowSchema).max(120).parse(rows);
    const invalid = numberingError(numbering);
    if (invalid) throw new Error(invalid);
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Oturum bulunamadı.");
    const document = await loadDrawingPlanDocument(supabase, projectId);
    if (document.state.version !== expectedVersion)
      throw new Error(
        "Resim planı değişti. Taslağınız korundu; güncel planı yeniden açın.",
      );
    const source = revisionId
      ? await drawingPlanSource(supabase, projectId, revisionId)
      : null;
    const candidates = new Map(
      source?.derivation.candidates.map((c) => [c.key, c]) ?? [],
    );
    const current = new Map(document.rows.map((r) => [r.id, r]));
    const prepared: DrawingPlanRow[] = clean.map((row) => {
      const old = current.get(row.id);
      const candidate = row.sourceKey
        ? candidates.get(row.sourceKey)
        : undefined;
      if (row.sourceKey && !candidate && old?.sourceKey !== row.sourceKey)
        throw new Error("Otomatik grubun kaynağı hesapta bulunamadı.");
      return {
        ...row,
        drawnByName: old?.drawnByName ?? "",
        sourceKey: row.sourceKey ?? null,
        origin: row.sourceKey
          ? row.origin === "manual"
            ? "manual"
            : "auto"
          : old?.origin === "legacy"
            ? "legacy"
            : "manual",
        generated: candidate
          ? {
              name: candidate.name,
              parentKey: candidate.parentKey,
              code: row.overrides?.includes("code")
                ? (old?.generated?.code ?? row.code)
                : row.code,
            }
          : row.sourceKey
            ? old?.generated
            : null,
        reason:
          candidate?.reason ??
          (row.sourceKey
            ? (old?.reason ?? "")
            : "Mühendis tarafından düzenlendi."),
      };
    });
    // Otomatik satırın çıkarılması kalıcı bir tercih olarak saklanır.
    for (const old of document.rows)
      if (old.sourceKey && !prepared.some((r) => r.id === old.id))
        prepared.push({ ...old, suppressed: true });
    const state = {
      ...document.state,
      numbering,
      sourceRevisionId: revisionId,
      sourceRevisionLabel: source?.revision.label ?? "",
      fingerprint: source?.derivation.fingerprint ?? "",
    };
    await persistDrawingPlan(
      supabase,
      projectId,
      document,
      prepared,
      state,
      source?.revision.updated_at ?? null,
    );
    revalidatePath(`/projects/${projectId}`, "layout");
    return {
      ok: true,
      document: await loadDrawingPlanDocument(supabase, projectId),
    };
  } catch (cause) {
    return {
      error:
        cause instanceof z.ZodError
          ? "Alanları kontrol edin: ad, dört haneli numara ve geçerli satır bilgisi gerekli."
          : cause instanceof Error
            ? cause.message
            : "Kaydedilemedi; taslağınız korundu.",
    };
  }
}
