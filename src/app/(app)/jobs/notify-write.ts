// Bildirim yazıcısı — SERVER yardımcı, bir server action DEĞİL (events.ts
// kalıbı). Hedef listesi `lib/jobs/notify.ts`ten (saf, testli) gelir; burası
// yalnız satırları basar.
//
// BİLDİRİM YAZIMI ASIL KAYDI BLOKLAMAZ: migration uygulanmadan önce tablo
// yoktur ve insert hata döner — hata yutulur (olay defteri kuralının aynısı).
// Hedef listesi boşsa HİÇ yazılmaz: sıfır satır, sahte bildirim üretmemenin
// tek güvencesidir.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { NotificationKind } from "@/lib/jobs/notify";
import { randomUUID } from "node:crypto";
import { after } from "next/server";
import { queueNotificationEmails, processNotificationEmails } from "@/lib/email/notifications";

export async function bildirimYaz(
  supabase: SupabaseClient,
  b: {
    targets: readonly string[];
    kind: NotificationKind;
    jobId: string | null;
    jobNo: string;
    /** Basılacak satırın kendisi — okuma anında ad çözülmez. */
    title: string;
    href: string;
    actor: string;
  }
): Promise<void> {
  if (b.targets.length === 0) return;
  const rows = [...new Set(b.targets)].filter((id) => id !== b.actor).map((user_id) => ({
      id: randomUUID(),
      user_id,
      kind: b.kind,
      job_id: b.jobId,
      job_no: b.jobNo,
      title: b.title,
      href: b.href,
      actor: b.actor,
    }));
  if (!rows.length) return;
  try {
    const { error } = await supabase.from("notifications").insert(rows);
    if (error) return;
    await queueNotificationEmails(rows);
    after(async () => {
      try { await processNotificationEmails(); }
      catch { console.error("E-posta kuyruğu sonraki denemeye bırakıldı."); }
    });
  } catch {
    console.error("Bildirim yazımı tamamlanamadı; ana işlem korundu.");
  }
}
