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
  await supabase.from("notifications").insert(
    b.targets.map((user_id) => ({
      user_id,
      kind: b.kind,
      job_id: b.jobId,
      job_no: b.jobNo,
      title: b.title,
      href: b.href,
      actor: b.actor,
    }))
  );
}
