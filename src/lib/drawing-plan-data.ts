// Teknik Resim Takibi defterinin OKUMA katmanı (sunucu).
//
// Çekirdek (`drawing-plan.ts`) saftır ve veritabanı bilmez; burası o çekirdeğe
// veri taşıyan tek yerdir. Üç ekran aynı iki soruyu soruyor — proje sayfası,
// ekipman paneli ve ekipman indirme ucu — ve üçü de aynı cevabı almalıdır:
// ikinci bir kopya yazılsaydı ekrandaki numara ile indirilen Excel'deki numara
// zamanla ayrışırdı (İş Takibi süzgeçlerinin dersinin aynısı, AGENTS WORKLOG-17).

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  toDrawingStatus,
  type DrawingAuthor,
  type DrawingPlanRow,
} from "@/lib/drawing-plan";
import { DRAWING_AUTHOR_ROLES } from "@/lib/roles";

/**
 * `project_drawing_plan` satırının okunan sütunları — ZENGİN ve DAR.
 *
 * "Sütun olmayabilir" varsayımı her okumada geçerlidir (AGENTS SATIN-21):
 * `drawn_by` 20260812150001 ile geliyor ve o migration uygulanmadan önce onu
 * isteyen bir `select` BÜTÜN listeyi düşürürdü — proje sayfası, ekipman paneli
 * ve indirilen Excel numaralandırmayı birden kaybederdi. Bir sütunun eksikliği
 * yüzünden defteri kaybetmek, eksikliğin kendisinden pahalıdır.
 *
 * Çizenin ADI gömülü ilişkiyle gelir (`profiles!drawn_by`): ikinci bir sorgu
 * yazmak, aynı satır kümesini iki kez okuyup elde birleştirmek olurdu.
 */
const PLAN_COLUMNS_ZENGIN =
  "id, code, name, status, note, drawn_by, cizen:profiles!drawn_by ( full_name )";
const PLAN_COLUMNS_DAR = "id, code, name, status, note";

/** Gömülü ilişki tekil de dizi de dönebilir; adı iki biçimden de çıkarır. */
function cizenAdi(value: unknown): string {
  const kayit = Array.isArray(value) ? value[0] : value;
  const ad = (kayit as { full_name?: unknown } | null | undefined)?.full_name;
  return typeof ad === "string" ? ad : "";
}

/**
 * Projenin ana grup numaralandırması. Tablo yoksa/erişilemezse BOŞ döner —
 * numaralandırma bir teslim belgesinin süsü değil ama yokluğu da ekipman
 * listesini düşürmemelidir.
 */
export async function loadDrawingPlan(
  supabase: SupabaseClient,
  projectId: string
): Promise<DrawingPlanRow[]> {
  const sorgu = (columns: string) =>
    supabase
      .from("project_drawing_plan")
      .select(columns)
      .eq("project_id", projectId)
      .order("code", { ascending: true });

  const zengin = await sorgu(PLAN_COLUMNS_ZENGIN);
  const data = zengin.error ? (await sorgu(PLAN_COLUMNS_DAR)).data : zengin.data;

  return ((data ?? []) as unknown as Record<string, unknown>[]).map((r) => ({
    id: String(r.id),
    code: String(r.code ?? ""),
    name: String(r.name ?? ""),
    // Tanınmayan durum satırı DÜŞÜRMEZ, "Bekliyor"a düşer (bkz. çekirdek).
    status: toDrawingStatus(r.status),
    drawnBy: r.drawn_by ? String(r.drawn_by) : null,
    drawnByName: cizenAdi(r.cizen),
    note: String(r.note ?? ""),
  })) satisfies DrawingPlanRow[];
}

/**
 * "Çizen" seçicisinin listesi: Teknik Ressam ve Mühendis rolündeki kişiler,
 * ÖNCE RESSAMLAR (kullanıcı kararı, 12.08.2026).
 *
 * Sıralama SUNUCUDA yapılır ve `DRAWING_AUTHOR_ROLES`in sırasından çıkar;
 * ekranda ikinci bir sıralama yazılsaydı iki liste bir gün ayrışırdı. Rol
 * içinde ad sırası tr-TR'dir — "Çağrı" ile "Cem"i İngilizce sıralamak, adını
 * arayan kullanıcıyı listenin yanlış yerine baktırır.
 */
export async function loadDrawingAuthors(
  supabase: SupabaseClient
): Promise<DrawingAuthor[]> {
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, email, role")
    .in("role", DRAWING_AUTHOR_ROLES as readonly string[]);

  const sira = (rol: string) => {
    const i = DRAWING_AUTHOR_ROLES.indexOf(rol as (typeof DRAWING_AUTHOR_ROLES)[number]);
    return i === -1 ? DRAWING_AUTHOR_ROLES.length : i;
  };

  return ((data ?? []) as { id: string; full_name: string | null; email: string | null; role: string }[])
    .map((p) => ({
      id: p.id,
      // Adı girilmemiş profil listeden DÜŞMEZ: e-postasıyla görünür, yoksa
      // hiç seçilemeyen ama var olan bir kullanıcı olurdu.
      name: (p.full_name ?? "").trim() || (p.email ?? "").trim() || "—",
      role: p.role,
    }))
    .sort(
      (a, b) => sira(a.role) - sira(b.role) || a.name.localeCompare(b.name, "tr")
    );
}

/**
 * Projenin İŞ KALEMİ NUMARASI — resim numarasının kökü ve kırıntı yolunun son
 * durağı ("0055-00").
 *
 * SIRA ÖNEMLİDİR ve gerekçesi AGENTS IS-14'tedir:
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
