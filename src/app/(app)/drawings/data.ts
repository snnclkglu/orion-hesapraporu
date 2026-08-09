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

interface SayfaSonucu {
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
async function tumSatirlar<T>(
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
  status: DwgPackageStatus;
  file_count: number;
  bytes_total: number;
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
  "description, capacity, rev_no, status, file_count, bytes_total, part_count, " +
  "unrecognized_count, finding_counts, recognition_pct, reconciled_at, reconciler_version, " +
  "created_at, jobs (job_no, title)";

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
  stored: boolean;
}

export async function loadFiles(supabase: SupabaseClient, packageId: string): Promise<FileRow[]> {
  return tumSatirlar<FileRow>((bas, son) =>
    supabase
      .from("drawing_files")
      .select(
        "id, rel_path, folder, file_name, ext, role, lifecycle, part_code, material, " +
          "thickness_mm, qty, label, recognized_by, size_bytes, storage_path, stored"
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
