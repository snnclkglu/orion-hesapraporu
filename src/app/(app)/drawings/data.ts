// Teknik Resimler — sunucu tarafı okumalar.
//
// Sayfalama PostgREST'in `max_rows` sınırı yüzünden AÇIKÇA yapılır: bir pakette
// 454 dosya ve 261 parça var, öntanımlı 1000 satır sınırı bugün yetiyor ama
// iki paket birleşince yetmez. `range()` ile sayfa sayfa okumak, sınırın bir
// gün sessizce satır kırpmasını engeller.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { DwgPackageStatus, FileLifecycle, FileRole, FindingKind, PartKind } from "@/lib/drawings/types";

/** Bir seferde okunacak satır sayısı — PostgREST öntanımının altında. */
const SAYFA = 900;

export interface SayfaSonucu {
  data: unknown[] | null;
  error: { message: string } | null;
}

/**
 * Sayfa sayfa okur; PostgREST'in `max_rows` sınırı satırları sessizce kırpamaz.
 *
 * Getirici, sorgu kurucusunun kendisini değil YALNIZ SONUCU döndürür. Kurucuyu
 * genel bir tipe sarmaya çalışmak supabase-js'in derin jeneriklerinde
 * "excessively deep" hatası veriyordu; sınır sayfalamanın kendisi zaten basit
 * bir döngü, akıllı tipe ihtiyacı yok.
 */
export async function tumSatirlar<T>(
  getir: (bas: number, son: number) => PromiseLike<SayfaSonucu>
): Promise<T[]> {
  const sonuc: T[] = [];
  for (let bas = 0; ; bas += SAYFA) {
    const { data, error } = await getir(bas, bas + SAYFA - 1);
    if (error) throw new Error(error.message);
    const dilim = (data ?? []) as T[];
    sonuc.push(...dilim);
    if (dilim.length < SAYFA) break;
  }
  return sonuc;
}

export interface PackageRow {
  id: string;
  folder_name: string;
  recognized_by: string;
  item_no: string;
  job_id: string | null;
  job_item_id: string | null;
  job_code: string;
  group_code: string;
  description: string;
  capacity: string;
  rev_no: number;
  supersedes_id: string | null;
  status: DwgPackageStatus;
  /** İSTEMCİNİN BEYANI: paket açılırken yazılır, satır sayısıdır. */
  file_count: number;
  bytes_total: number;
  /**
   * ÖLÇÜM: `verifyStorage` bucket'ı listeleyerek yazar.
   *
   * `file_count` ile arasındaki fark ya ATLANMIŞ (skipped_count) ya da
   * ULAŞMAMIŞ dosyadır; ekranlar bu ikisini asla karıştırmamalıdır.
   */
  stored_count: number;
  stored_bytes: number;
  skipped_count: number;
  skipped_bytes: number;
  verified_at: string | null;
  part_count: number;
  unrecognized_count: number;
  finding_counts: Partial<Record<FindingKind, number>>;
  recognition_pct: number | null;
  reconciled_at: string | null;
  reconciler_version: number;
  created_at: string;
  jobs: { job_no: string; title: string } | null;
}

const PAKET_ALANLARI =
  "id, folder_name, recognized_by, item_no, job_id, job_item_id, job_code, group_code, " +
  "description, capacity, rev_no, supersedes_id, status, file_count, bytes_total, " +
  "stored_count, stored_bytes, skipped_count, skipped_bytes, verified_at, part_count, " +
  "unrecognized_count, finding_counts, recognition_pct, reconciled_at, reconciler_version, " +
  "created_at, jobs (job_no, title)";

/**
 * Paketin DEPO DURUMU — üç sayı, üç ayrı soru.
 *
 * Ekranların hiçbiri bu hesabı kendi yapmaz: "kaç dosya bekleniyor" sorusunun
 * cevabı `file_count` DEĞİLDİR (atlananlar düşülür) ve her ekranda yeniden
 * yazılsaydı biri er geç yanlış sayardı.
 */
export interface StorageState {
  /** Depoda KENDİ nesnesi olması gereken satır sayısı. */
  expected: number;
  /** Gerçekten olan. */
  stored: number;
  /** Bilerek yüklenmemiş (yedek dosya + bayt bayt kopya). */
  skipped: number;
  /** Kayıt var, bayt yok. */
  missing: number;
  storedBytes: number;
  /**
   * Depoda OLMASI GEREKEN bayt = bütün satırlar − atlananlar.
   *
   * `bytes_total` ile doğrudan karşılaştırmak elmayla armuttu: o toplam
   * atlananları (yedek dosyalar + bayt bayt kopyalar) İÇERİR, `stored_bytes`
   * ise bucket'taki nesnelerdir ve atlananların nesnesi hiç yoktur. Fark bu
   * yüzden hiçbir bayt kaybetmemiş HER pakette kalıcı olarak görünüyordu —
   * MTC ölçüsüyle "91,6 MB / 107 MB". Gerçek bir kayıp olduğunda da aynı yerde
   * büyüdüğü için ikisi ayırt edilemezdi.
   */
  expectedBytes: number;
  /** Hiç doğrulanmadıysa sayılar DEVRALINMIŞTIR, ölçülmemiştir. */
  verifiedAt: string | null;
}

export function storageState(p: {
  file_count: number;
  bytes_total: number;
  stored_count: number;
  stored_bytes: number;
  skipped_count: number;
  skipped_bytes: number;
  verified_at: string | null;
}): StorageState {
  const expected = Math.max(0, Number(p.file_count ?? 0) - Number(p.skipped_count ?? 0));
  const stored = Number(p.stored_count ?? 0);
  return {
    expected,
    stored,
    skipped: Number(p.skipped_count ?? 0),
    missing: Math.max(0, expected - stored),
    storedBytes: Number(p.stored_bytes ?? 0),
    expectedBytes: Math.max(0, Number(p.bytes_total ?? 0) - Number(p.skipped_bytes ?? 0)),
    verifiedAt: p.verified_at ?? null,
  };
}

export async function loadPackages(supabase: SupabaseClient): Promise<PackageRow[]> {
  return tumSatirlar<PackageRow>((bas, son) =>
    supabase
      .from("drawing_packages")
      .select(PAKET_ALANLARI)
      .order("created_at", { ascending: false })
      .range(bas, son)
  );
}

export async function loadPackage(
  supabase: SupabaseClient,
  id: string
): Promise<PackageRow | null> {
  const { data } = await supabase
    .from("drawing_packages")
    .select(PAKET_ALANLARI)
    .eq("id", id)
    .maybeSingle();
  return (data as unknown as PackageRow) ?? null;
}

export interface FileRow {
  id: string;
  rel_path: string;
  folder: string;
  file_name: string;
  ext: string;
  role: FileRole;
  lifecycle: FileLifecycle;
  part_code: string;
  material: string;
  thickness_mm: number | null;
  qty: number | null;
  label: string;
  recognized_by: string;
  size_bytes: number;
  storage_path: string;
  /** Bu satırın KENDİ nesnesi depoda var mı (`verifyStorage` yazar). */
  stored: boolean;
  /** Baytları BİLEREK gönderilmedi: yedek dosya ya da bayt bayt kopya. */
  upload_skipped: boolean;
  /** Ulaşmadıysa SEBEBİ — bu metin eskiden atılıyordu. */
  upload_error: string;
  /** Okunmuş içerik (antet / DXF başlığı). İçerik okunmadıysa boş nesne. */
  meta: Record<string, unknown> | null;
}

export async function loadFiles(supabase: SupabaseClient, packageId: string): Promise<FileRow[]> {
  return tumSatirlar<FileRow>((bas, son) =>
    supabase
      .from("drawing_files")
      .select(
        "id, rel_path, folder, file_name, ext, role, lifecycle, part_code, material, " +
          "thickness_mm, qty, label, recognized_by, size_bytes, storage_path, stored, " +
          "upload_skipped, upload_error, meta"
      )
      .eq("package_id", packageId)
      .order("rel_path")
      .range(bas, son)
  );
}

export interface PartRow {
  id: string;
  register_key: string;
  part_code: string;
  parent_code: string;
  item_path: string;
  level: number;
  kind: PartKind;
  name: string;
  description: string;
  assembly_title: string;
  material: string;
  category: string;
  qty: number | null;
  cut_length_mm: number | null;
  thickness_mm: number | null;
  weight_kg: number | null;
  extents_x_mm: number | null;
  extents_y_mm: number | null;
  has_model: boolean;
  has_sheet: boolean;
  has_cut: boolean;
  has_3d: boolean;
  sheet_file_id: string | null;
  cut_file_id: string | null;
  sort: number;
}

export async function loadParts(supabase: SupabaseClient, packageId: string): Promise<PartRow[]> {
  return tumSatirlar<PartRow>((bas, son) =>
    supabase
      .from("drawing_parts")
      .select(
        "id, register_key, part_code, parent_code, item_path, level, kind, name, description, " +
          "assembly_title, material, category, qty, cut_length_mm, thickness_mm, weight_kg, " +
          "extents_x_mm, extents_y_mm, " +
          "has_model, has_sheet, has_cut, has_3d, sheet_file_id, cut_file_id, sort"
      )
      .eq("package_id", packageId)
      .order("sort")
      .range(bas, son)
  );
}

export interface FindingRow {
  id: string;
  code: string;
  kind: FindingKind;
  subject: string;
  title: string;
  detail: string;
  hint_id: string;
}

export async function loadFindings(
  supabase: SupabaseClient,
  packageId: string
): Promise<FindingRow[]> {
  return tumSatirlar<FindingRow>((bas, son) =>
    supabase
      .from("drawing_findings")
      .select("id, code, kind, subject, title, detail, hint_id")
      .eq("package_id", packageId)
      .order("code")
      .range(bas, son)
  );
}

export async function loadAcks(
  supabase: SupabaseClient,
  packageId: string
): Promise<Set<string>> {
  const { data } = await supabase
    .from("drawing_finding_acks")
    .select("code, subject")
    .eq("package_id", packageId);
  return new Set((data ?? []).map((a) => `${a.code}|${a.subject}`));
}

/** Kalem eşleştirme kartı için iş kalemi seçenekleri. */
export async function loadItemOptions(
  supabase: SupabaseClient
): Promise<{ id: string; itemNo: string; label: string }[]> {
  const { data } = await supabase
    .from("job_items")
    .select("id, item_no, product_name, jobs (job_no, title)")
    .order("item_no");
  return (data ?? []).map((r) => {
    const job = r.jobs as unknown as { job_no: string; title: string } | null;
    return {
      id: r.id as string,
      itemNo: (r.item_no as string) ?? "",
      label: [r.item_no, r.product_name || job?.title].filter(Boolean).join(" · "),
    };
  });
}
