// Teknik Resim Takibi defterinin OKUMA katmanı (sunucu).
//
// Çekirdek (`drawing-plan.ts`) saftır ve veritabanı bilmez; burası o çekirdeğe
// veri taşıyan tek yerdir. Üç ekran aynı iki soruyu soruyor — proje sayfası,
// ekipman paneli ve ekipman indirme ucu — ve üçü de aynı cevabı almalıdır:
// ikinci bir kopya yazılsaydı ekrandaki numara ile indirilen Excel'deki numara
// zamanla ayrışırdı (İş Takibi süzgeçlerinin dersinin aynısı, AGENTS md. 17).

import type { SupabaseClient } from "@supabase/supabase-js";
import { toDrawingStatus, type DrawingPlanRow } from "@/lib/drawing-plan";

/** `project_drawing_plan` satırının okunan sütunları. */
const PLAN_COLUMNS = "id, code, name, status, note";

/**
 * Projenin ana grup numaralandırması. Tablo yoksa/erişilemezse BOŞ döner —
 * numaralandırma bir teslim belgesinin süsü değil ama yokluğu da ekipman
 * listesini düşürmemelidir.
 */
export async function loadDrawingPlan(
  supabase: SupabaseClient,
  projectId: string
): Promise<DrawingPlanRow[]> {
  const { data } = await supabase
    .from("project_drawing_plan")
    .select(PLAN_COLUMNS)
    .eq("project_id", projectId)
    .order("code", { ascending: true });

  return ((data ?? []) as unknown as Record<string, unknown>[]).map((r) => ({
    id: String(r.id),
    code: String(r.code ?? ""),
    name: String(r.name ?? ""),
    // Tanınmayan durum satırı DÜŞÜRMEZ, "Bekliyor"a düşer (bkz. çekirdek).
    status: toDrawingStatus(r.status),
    note: String(r.note ?? ""),
  })) satisfies DrawingPlanRow[];
}

/**
 * Projenin İŞ KALEMİ NUMARASI — resim numarasının kökü ve kırıntı yolunun son
 * durağı ("0055-00").
 *
 * SIRA ÖNEMLİDİR ve gerekçesi AGENTS md. 14'tedir:
 *   1. `job_items.item_no` — SİSTEMİN kendi numarası. `assignProjectToJob`
 *      yazar, kimse elle düzenlemez.
 *   2. `projects.doc_no` — mühendisin yazdığı belge kodu beyanı. Eski
 *      kayıtlarda kalemsiz ("0055") kalmıştır ve BİLİNÇLİ olarak
 *      dönüştürülmedi: yayınlanmış raporların kodu teslim edilmiş PDF'lerle
 *      aynı kalmalıdır. Bu yüzden ekranda kalem numarası varsa O gösterilir,
 *      `doc_no` yalnız hiçbir kaleme bağlanmamış raporlarda kalır.
 *
 * Hiçbiri yoksa boş dizge döner; uydurma bir kök üretmek ressamın antedine
 * yanlış bir iş numarası geçirirdi.
 */
export async function resolveProjectItemNo(
  supabase: SupabaseClient,
  projectId: string,
  docNo?: string | null
): Promise<string> {
  const { data } = await supabase
    .from("job_items")
    .select("item_no")
    .eq("project_id", projectId)
    .order("item_no", { ascending: true })
    .limit(1);

  const kalem = ((data ?? []) as { item_no: string | null }[])[0]?.item_no ?? "";
  const temiz = kalem.trim();
  if (temiz) return temiz;
  return (docNo ?? "").trim();
}
