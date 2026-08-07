"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { EquipmentExtraRow } from "@/lib/excel/equipment";

const extraRowSchema = z.object({
  group: z.string().trim().max(80).default(""),
  component: z.string().trim().max(120).default(""),
  brand: z.string().trim().max(120).default(""),
  model: z.string().trim().max(120).default(""),
  spec: z.string().trim().max(400).default(""),
  qty: z.string().trim().max(40).default(""),
});

const payloadSchema = z.array(extraRowSchema).max(200);

export type SaveExtrasResult = { ok?: boolean; error?: string };

/** Ekipman listesine eklenen serbest satırları (equipment_extras) kaydeder. */
export async function saveEquipmentExtras(
  projectId: string,
  revisionId: string,
  rows: EquipmentExtraRow[]
): Promise<SaveExtrasResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı" };

  const parsed = payloadSchema.safeParse(rows);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  // Boş (tamamen doldurulmamış) satırları ele
  const clean = parsed.data.filter(
    (r) => r.component || r.brand || r.model || r.spec || r.qty
  );

  const { error } = await supabase.from("equipment_extras").upsert({
    revision_id: revisionId,
    rows: clean,
    updated_at: new Date().toISOString(),
    updated_by: user.id,
  });
  if (error) return { error: error.message };

  revalidatePath(`/projects/${projectId}/revisions/${revisionId}/equipment`);
  return { ok: true };
}

// ------------------------------------------------- Ek Özellikler (madde 34)

const noteSchema = z.object({
  // `<modulKey>:<slug>` — ekipman satırının kararlı kimliği
  rowKey: z.string().trim().min(1).max(120).regex(/^[A-Za-z0-9]+:[A-Za-z0-9]+$/, "Geçersiz satır anahtarı"),
  note: z.string().max(1000),
});

export type SaveNoteResult = { ok?: boolean; error?: string };

/**
 * Bir ekipman satırının "Ek Özellikler" notunu kaydeder (equipment_notes).
 * Not bir hesap değeri değil açıklamadır; yayınlanmış revizyonda da yazılabilir
 * (gerekçe migration yorumunda). Boş not satırı siler — tablo şişmez.
 */
export async function saveEquipmentNote(
  projectId: string,
  revisionId: string,
  rowKey: string,
  note: string
): Promise<SaveNoteResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı" };

  const parsed = noteSchema.safeParse({ rowKey, note });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const temiz = parsed.data.note.trim();
  if (temiz === "") {
    const { error } = await supabase
      .from("equipment_notes")
      .delete()
      .eq("revision_id", revisionId)
      .eq("row_key", parsed.data.rowKey);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from("equipment_notes").upsert(
      {
        revision_id: revisionId,
        row_key: parsed.data.rowKey,
        note: temiz,
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      },
      { onConflict: "revision_id,row_key" }
    );
    if (error) return { error: error.message };
  }

  revalidatePath(`/projects/${projectId}/revisions/${revisionId}/equipment`);
  return { ok: true };
}
