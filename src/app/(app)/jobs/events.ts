// İş olayı yazıcısı — SERVER yardımcı, bir server action DEĞİL.
//
// "use server" TAŞIMAZ: bu dosya bir uç açmaz; `jobs/actions.ts`,
// `sales/actions.ts` ve ileride görev/yorum action'ları tarafından içe
// aktarılır. Action dosyasına konsaydı dışa açık bir uca dönerdi.
//
// OLAY YAZIMI İŞ KAYDINI ASLA BLOKLAMAZ: migration uygulanmadan önce tablo
// yoktur ve insert hata döner — hata YUTULUR (iki-denemeli okuma kuralının
// yazma karşılığı: bir defter satırının eksikliği yüzünden iş emri kaydını
// kaybetmek, eksikliğin kendisinden çok daha pahalıdır).

import type { SupabaseClient } from "@supabase/supabase-js";

/** Olay adları ASCII slug'dır; Türkçe karşılıkları sunum katmanındadır. */
export type JobEventKind =
  | "olusturuldu"
  | "guncellendi"
  | "revize"
  | "durum"
  | "durum_oto"
  | "silindi"
  | "gorev_acildi"
  | "gorev_kapandi"
  | "gorev_atandi"
  | "yorum"
  | "carpan";

export async function isOlayiYaz(
  supabase: SupabaseClient,
  olay: {
    jobId: string | null;
    /** Kopyalanır — silinmiş işin olayı da kimliğini taşısın. */
    jobNo: string;
    event: JobEventKind;
    detail?: Record<string, unknown>;
    actor: string | null;
  }
): Promise<void> {
  await supabase.from("job_events").insert({
    job_id: olay.jobId,
    job_no: olay.jobNo,
    event: olay.event,
    detail: olay.detail ?? {},
    actor: olay.actor,
  });
  // Dönen hata bilinçli olarak okunmaz: olay defteri bir güvence değil bir
  // kolaylıktır ve asıl kaydın başarısını etkileyemez.
}
