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
import { queueNotificationEmails } from "@/lib/email/notifications";
import { processEmailCenter } from '@/lib/email-center/worker';

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
  try {
    if(rows.length) {
      const { error } = await supabase.from("notifications").insert(rows);
      if (error) return;
    }
    // Olayın ilgili kişisi yokken de açıkça rol/kişi seçilmiş bir e-posta kuralı olabilir.
    // Bu durumda zil tablosuna sahte satır eklenmez; olay ayrı kaydedilir.
    await queueNotificationEmails(rows.length?rows:[{id:randomUUID(),user_id:'',title:b.title,href:b.href,kind:b.kind,job_id:b.jobId,actor:b.actor,job_no:b.jobNo}]);
    after(async () => {
      try { await processEmailCenter(1); }
      catch { console.error("E-posta kuyruğu sonraki denemeye bırakıldı."); }
    });
  } catch {
    console.error("Bildirim yazımı tamamlanamadı; ana işlem korundu.");
  }
}
