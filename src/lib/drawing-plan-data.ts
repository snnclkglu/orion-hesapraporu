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
import { emptyDrawingPlanState, type DrawingPlanDocument } from "./drawing-plan/types";
import { orderedDrawingPlan } from "./drawing-plan/presentation";

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
const PLAN_COLUMNS_TREE = `${PLAN_COLUMNS_ZENGIN},parent_id,sort_order,source_key,origin,generated_values,overrides,suppressed,reason`;

function planRow(r: Record<string, unknown>): DrawingPlanRow {
  return { id: String(r.id), code: String(r.code ?? ""), name: String(r.name ?? ""), status: toDrawingStatus(r.status),
    drawnBy: r.drawn_by ? String(r.drawn_by) : null, drawnByName: cizenAdi(r.cizen), note: String(r.note ?? ""),
    parentId: r.parent_id ? String(r.parent_id) : null, sortOrder: r.sort_order == null ? undefined : Number(r.sort_order),
    sourceKey: r.source_key ? String(r.source_key) : null, origin: r.origin as DrawingPlanRow["origin"],
    generated: r.generated_values as DrawingPlanRow["generated"], overrides: (r.overrides ?? []) as DrawingPlanRow["overrides"],
    suppressed: r.suppressed === true, reason: String(r.reason ?? "") };
}

/** Otomatik yazma yolunda sorgu hatası hiçbir zaman boş defter sayılmaz. */
export async function loadDrawingPlanDocument(supabase: SupabaseClient, projectId: string): Promise<DrawingPlanDocument> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const before = await supabase.from("project_drawing_plan_state").select("version").eq("project_id", projectId).maybeSingle();
    const plan = await supabase.from("project_drawing_plan").select(PLAN_COLUMNS_TREE).eq("project_id", projectId);
    const state = await supabase.from("project_drawing_plan_state").select("*").eq("project_id", projectId).maybeSingle();
    if (before.error || plan.error || state.error) throw new Error("Teknik resim planı okunamadı. Güncel veriler yüklenmeden değişiklik yapılmadı.");
    if ((before.data?.version ?? 0) !== (state.data?.version ?? 0)) continue;
    const value = state.data;
    return { rows: (plan.data as unknown as Record<string, unknown>[]).map(planRow), state: value ? {
      version: Number(value.version), sourceRevisionId: value.source_revision_id, sourceRevisionLabel: value.source_revision_label,
      sourceUpdatedAt: value.source_updated_at, fingerprint: value.fingerprint, numbering: value.numbering,
    } : emptyDrawingPlanState() };
  }
  throw new Error("Resim planı düzenleniyor; birkaç saniye sonra yeniden açın.");
}

/** Gömülü ilişki tekil de dizi de dönebilir; adı iki biçimden de çıkarır. */
function cizenAdi(value: unknown): string {
  const kayit = Array.isArray(value) ? value[0] : value;
  const ad = (kayit as { full_name?: unknown } | null | undefined)?.full_name;
  return typeof ad === "string" ? ad : "";
}

/** Projenin görünür montaj sırası. Okuma hatası boş liste sayılmaz. */
export async function loadDrawingPlan(
  supabase: SupabaseClient,
  projectId: string
): Promise<DrawingPlanRow[]> {
  const tree = await supabase.from("project_drawing_plan").select(PLAN_COLUMNS_TREE).eq("project_id", projectId);
  if (!tree.error) return orderedDrawingPlan((tree.data as unknown as Record<string, unknown>[]).map(planRow)).map(r => r.row);
  // Yalnız eski şemaya geçiş; ağ/yetki hatası planı görünmez yapmaz.
  if (!["42703", "PGRST200", "PGRST204"].includes(tree.error.code)) throw new Error("Teknik resim listesi okunamadı; tekrar deneyin.");
  const sorgu = (columns: string) =>
    supabase
      .from("project_drawing_plan")
      .select(columns)
      .eq("project_id", projectId)
      .order("code", { ascending: true });

  const zengin = await sorgu(PLAN_COLUMNS_ZENGIN);
  if (zengin.error && !["42703", "PGRST200", "PGRST204"].includes(zengin.error.code)) throw new Error("Teknik resim listesi okunamadı.");
  const legacy = zengin.error ? await sorgu(PLAN_COLUMNS_DAR) : zengin;
  if (legacy.error) throw new Error("Teknik resim listesi okunamadı.");
  const data = legacy.data;

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
