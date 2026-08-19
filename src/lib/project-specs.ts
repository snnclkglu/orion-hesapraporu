// ŞARTNAME — projenin dayandığı müşteri belgesinin okuma katmanı.
//
// Hesap raporu bir ŞARTNAMEYE cevap verir: kapasite, açıklık, sınıflandırma,
// hız ve ortam koşulları hep oradan gelir. Belge bugüne kadar e-postada
// duruyordu; artık projenin yanında durur ve İşletme ve Bakım El Kitabı onu
// EK olarak taşır (müşterinin kendi listesindeki yedinci madde).

import type { SupabaseClient } from "@supabase/supabase-js";

/** Depo kovası — yükleme (istemci), okuma (uç) ve silme aynı adı kullanır. */
export const SPEC_BUCKET = "project-specs";

export interface ProjectSpec {
  id: string;
  projectId: string;
  fileName: string;
  storagePath: string;
  contentType: string;
  sizeBytes: number;
  /** PDF ise sunucunun OKUYARAK saydığı sayfa adedi; başka biçimde 0. */
  pageCount: number;
  revision: string;
  note: string;
  isCurrent: boolean;
  createdAt: string;
}

const COLUMNS =
  "id, project_id, file_name, storage_path, content_type, size_bytes, page_count, revision, note, is_current, created_at";

function satirdan(r: Record<string, unknown>): ProjectSpec {
  return {
    id: String(r.id),
    projectId: String(r.project_id),
    fileName: String(r.file_name ?? ""),
    storagePath: String(r.storage_path ?? ""),
    contentType: String(r.content_type ?? ""),
    sizeBytes: Number(r.size_bytes ?? 0),
    pageCount: Number(r.page_count ?? 0),
    revision: String(r.revision ?? ""),
    note: String(r.note ?? ""),
    isCurrent: r.is_current === true,
    createdAt: String(r.created_at ?? ""),
  };
}

/** Projenin GÜNCEL şartnamesi — düğme bunu açar. */
export async function loadCurrentSpec(
  supabase: SupabaseClient,
  projectId: string
): Promise<ProjectSpec | null> {
  const { data } = await supabase
    .from("project_specs")
    .select(COLUMNS)
    .eq("project_id", projectId)
    .eq("is_current", true)
    .maybeSingle();
  return data ? satirdan(data as Record<string, unknown>) : null;
}

/** Bütün sürümler — en yeni önce. Eskiler SİLİNMEZ (bkz. migration başlığı). */
export async function loadSpecs(
  supabase: SupabaseClient,
  projectId: string
): Promise<ProjectSpec[]> {
  const { data } = await supabase
    .from("project_specs")
    .select(COLUMNS)
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  return ((data ?? []) as Record<string, unknown>[]).map(satirdan);
}

/**
 * Depo yolunun uzantısı — anahtar OPAKTIR ama biçim bilgisi korunur.
 *
 * Gerçek dosya adını anahtar yapmak Türkçe "İ" (U+0130) taşıyan yollarda
 * imzalı bağlantıyı sessizce bozuyor (`drawings/file-open-button.tsx` dersi);
 * uzantı ise tarayıcının belgeyi açıp açmayacağını belirler ve kaybolmamalı.
 */
export function specExtension(fileName: string): string {
  const nokta = fileName.lastIndexOf(".");
  if (nokta < 0 || nokta === fileName.length - 1) return "pdf";
  return fileName.slice(nokta + 1).toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8) || "pdf";
}
