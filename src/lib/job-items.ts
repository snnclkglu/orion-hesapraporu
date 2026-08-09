// İş kalemi çözümleme — "numara METİN, bağlantı TÜREV" sözleşmesinin tek yeri.
//
// İki bölüm aynı soruyu soruyor: İş Takibi bir çizelge satırının, Teknik
// Resimler bir paketin hangi kaleme ait olduğunu bilmek istiyor. Soru aynı
// olduğu için cevap da TEK YERDE durmalı; iki kopya zamanla ayrışır ve o gün
// aynı numara iki ekranda iki farklı işe bağlanır.
//
// KURAL: `item_no` METİN olarak her zaman durur, `job_item_id`/`job_id` ise
// eşleştiği ölçüde dolar ve eşleşmeyen kayıt DÜŞÜRÜLMEZ — ekranda ayrıca
// sayılır ve toplu olarak yeniden bağlanabilir.
//
// Sebebi `autoItemNos` (jobs/schema.ts): bir işe ikinci kalem eklendiğinde
// `0057-00` numarası `0057-01`e KAYAR. Atölyenin çizelgesi ve teknik ressamın
// klasörü o gün değişmez; metne güvenmek, bağlantıya güvenmekten sağlamdır.

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Kalem numarasından iş kökü: "0057-00" → "0057".
 *
 * `slice(0, 4)` DEĞİL: beş haneli bir yazımda ("00057-00") ilk dört karakter
 * "0005" olur ve hiçbir işle eşleşmez. Ayraçtan bölüp fazladan sıfırı ayıklamak
 * hem doğru hem de yazım hatasına dayanıklıdır.
 */
export function jobRootOf(itemNo: string | null | undefined): string {
  const bas = (itemNo ?? "").trim().split("-")[0] ?? "";
  if (!/^\d+$/.test(bas)) return bas;
  const kirpik = bas.replace(/^0+(?=\d{4}$)/, "");
  return kirpik.length >= 4 ? kirpik : kirpik.padStart(4, "0");
}

export interface ResolvedItem {
  jobItemId: string | null;
  jobId: string | null;
}

/**
 * Kalem numarasını sistemdeki kayda bağlar. Üç adım, hiçbiri zorunlu:
 *   1. `job_items.item_no` tam eşleşme
 *   2. yoksa `jobs.job_no` (iş kökü; kalem boş kalır)
 *   3. yoksa bağlantısız — çağıran kaydı YİNE DE oluşturur
 */
export async function resolveItemNo(
  supabase: SupabaseClient,
  itemNo: string
): Promise<ResolvedItem> {
  const no = itemNo.trim();
  if (!no) return { jobItemId: null, jobId: null };

  const { data: item } = await supabase
    .from("job_items")
    .select("id, job_id")
    .eq("item_no", no)
    .limit(1)
    .maybeSingle();
  if (item) {
    const row = item as { id: string; job_id: string };
    return { jobItemId: row.id, jobId: row.job_id };
  }

  const kok = jobRootOf(no);
  if (!kok) return { jobItemId: null, jobId: null };

  const { data: job } = await supabase
    .from("jobs")
    .select("id")
    .eq("job_no", kok)
    .limit(1)
    .maybeSingle();
  return { jobItemId: null, jobId: (job as { id: string } | null)?.id ?? null };
}
