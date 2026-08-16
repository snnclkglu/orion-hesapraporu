"use server";

// Bildirim okundu işaretleri. Okuma yolu İSTEMCİDEDİR (zil 60 sn'de bir
// kendi satırlarını sayar, RLS zaten kişiye kelepçeli); buradaki iki action
// yalnız YAZAR.

import { createClient } from "@/lib/supabase/server";

export type NotificationActionResult = { error?: string };

export async function markNotificationRead(
  id: string
): Promise<NotificationActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı" };

  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .is("read_at", null);
  return {};
}

export async function markAllNotificationsRead(): Promise<NotificationActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı" };

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .is("read_at", null)
    .eq("user_id", user.id);
  if (error) return { error: error.message };

  // FIRSATÇI TEMİZLİK (cron yok): 90 günden eski OKUNMUŞ satırlar burada
  // silinir. Okunmamış satır asla silinmez — görülmemiş bir bildirimi zaman
  // aşımına uğratmak, onu hiç yazmamaktan kötüdür.
  const sinir = new Date();
  sinir.setDate(sinir.getDate() - 90);
  await supabase
    .from("notifications")
    .delete()
    .eq("user_id", user.id)
    .not("read_at", "is", null)
    .lt("created_at", sinir.toISOString());

  return {};
}
