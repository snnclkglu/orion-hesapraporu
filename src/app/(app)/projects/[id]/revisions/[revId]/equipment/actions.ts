"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { EquipmentExtraRow } from "@/lib/excel/equipment";
import { DRAWING_NOTE_KEY } from "@/lib/equipment-drawing-note";
import { customerDrawingPathOf } from "@/lib/equipment-customer-link";

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

// ------------------------------------------- Teknik Ressam Özeti · Notlar
//
// `DRAWING_NOTE_KEY` BURADA TANIMLANMAZ, `lib/equipment-drawing-note.ts`ten
// içe aktarılır: `"use server"` dosyasının BÜTÜN dışa aktarımları async
// fonksiyon olmak zorundadır. Buraya konan bir sabit dosyayı "hiç dışa
// aktarımı yok" hâline düşürüyor ve derleme, sabiti değil `saveEquipmentNote`i
// bulamadığını söyleyen bir hatayla kırılıyordu (`tsc --noEmit` bunu görmez —
// kural Next'in derleyicisindedir).

const drawingNoteSchema = z.object({
  // Ek Özellikler notundan (1000) CÖMERTTİR: burası bir hücre değil bir
  // paragraf alanıdır ve ressama madde madde yazılır.
  note: z.string().max(4000),
});

/**
 * Teknik ressam özetinin "Notlar" bölümünü kaydeder
 * (`equipment_drawing_notes`). Satır notlarıyla AYNI ilke: not bir hesap
 * değeri değil teslim katmanıdır, yayınlanmış revizyonda da yazılabilir.
 * Boş not satırı siler — tablo şişmez.
 */
export async function saveDrawingNote(
  projectId: string,
  revisionId: string,
  note: string
): Promise<SaveNoteResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı" };

  const parsed = drawingNoteSchema.safeParse({ note });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const temiz = parsed.data.note.trim();
  if (temiz === "") {
    const { error } = await supabase
      .from("equipment_drawing_notes")
      .delete()
      .eq("revision_id", revisionId)
      .eq("note_key", DRAWING_NOTE_KEY);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from("equipment_drawing_notes").upsert(
      {
        revision_id: revisionId,
        note_key: DRAWING_NOTE_KEY,
        note: temiz,
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      },
      { onConflict: "revision_id,note_key" }
    );
    if (error) return { error: error.message };
  }

  revalidatePath(`/projects/${projectId}/revisions/${revisionId}/equipment`);
  return { ok: true };
}

// ------------------------------------------------------ Müşteri ana paftası

/**
 * Teknik Resimler'de üretilen tek-PDF müşteri linkini ekipman listesine bağlar.
 * Mutlak alan adı saklanmaz; çıktı alınırken isteğin canlı origin'i eklenir.
 */
export async function saveCustomerDrawingLink(
  projectId: string,
  revisionId: string,
  value: string
): Promise<SaveExtrasResult & { path?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı" };

  const path = customerDrawingPathOf(value);
  if (path === null) {
    return { error: "Yalnız Teknik Resimler bölümünde üretilen müşteri linki kullanılabilir." };
  }

  if (path === "") {
    const { error } = await supabase
      .from("equipment_customer_drawing_links")
      .delete()
      .eq("revision_id", revisionId);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from("equipment_customer_drawing_links").upsert({
      revision_id: revisionId,
      share_path: path,
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    });
    if (error) return { error: error.message };
  }

  revalidatePath(`/projects/${projectId}/revisions/${revisionId}/equipment`);
  return { ok: true, path };
}
