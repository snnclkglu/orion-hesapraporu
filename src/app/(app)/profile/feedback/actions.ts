"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  accountContext,
  accountError,
  checkDb,
  normalizeImage,
  uploadPrivate,
} from "@/lib/account/server";
import { feedbackSchema } from "@/lib/account/model";
export async function beginFeedback(input: unknown) {
  try {
    const p = feedbackSchema.safeParse(input);
    if (!p.success) throw new Error("Metni, türü ve ek sayısını kontrol edin.");
    const { db } = await accountContext();
    const v = p.data;
    const { error } = await db.rpc("feedback_begin", {
      p_id: v.id,
      p_body: v.body,
      p_category: v.category,
      p_section: v.section,
      p_files: v.files,
    });
    checkDb(error);
    return { ok: true };
  } catch (e) {
    return { error: accountError(e) };
  }
}
export async function addFeedbackImage(
  id: string,
  slot: number,
  form: FormData,
) {
  try {
    if (
      !z.uuid().safeParse(id).success ||
      !Number.isInteger(slot) ||
      slot < 0 ||
      slot > 2
    )
      throw new Error("Geçersiz ek.");
    const { db, user } = await accountContext();
    const { data: f, error } = await db
      .from("app_feedback")
      .select("id,user_id,submitted_at,expected_files")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();
    checkDb(error);
    if (!f || slot >= f.expected_files) throw new Error("Gönderi bulunamadı.");
    const path = `${user.id}/${id}/${slot}-${crypto.randomUUID()}.webp`;
    const { data: previous } = await db
      .from("app_feedback_attachments")
      .select("id")
      .eq("feedback_id", id)
      .eq("slot", slot)
      .maybeSingle();
    if (previous) return { ok: true };
    if (f.submitted_at) throw new Error("Gönderilmiş kayıt değiştirilemez.");
    const file = form.get("file");
    if (!(file instanceof File)) throw new Error("Görsel seçin.");
    const bytes = await normalizeImage(file, 1800);
    await uploadPrivate("feedback-images", path, bytes);
    const { error: attach } = await db.rpc("feedback_attach", {
      p_id: id,
      p_slot: slot,
      p_path: path,
      p_name: file.name.replace(/[\\/\x00-\x1f]/g, "_").slice(0, 200),
      p_bytes: bytes.length,
    });
    checkDb(attach);
    // Yarışı kaybeden referans dışı nesne bakımda temizlenir.
    return { ok: true };
  } catch (e) {
    return { error: accountError(e) };
  }
}
export async function submitFeedback(id: string) {
  try {
    if (!z.uuid().safeParse(id).success) throw new Error("Geçersiz gönderi.");
    const { db } = await accountContext();
    const { error } = await db.rpc("feedback_submit", { p_id: id });
    checkDb(error);
    revalidatePath("/profile/feedback");
    revalidatePath("/admin/feedback");
    return { ok: true };
  } catch (e) {
    return { error: accountError(e) };
  }
}
export async function manageFeedback(
  id: string,
  action: string,
  version: number,
) {
  try {
    if (
      !z.uuid().safeParse(id).success ||
      !["read", "unread", "archive", "restore"].includes(action) ||
      !Number.isInteger(version)
    )
      throw new Error("Geçersiz işlem.");
    const { db } = await accountContext();
    const { error } = await db.rpc("feedback_manage", {
      p_id: id,
      p_action: action,
      p_version: version,
    });
    checkDb(error);
    revalidatePath("/admin/feedback", "layout");
    return { ok: true };
  } catch (e) {
    return { error: accountError(e) };
  }
}
