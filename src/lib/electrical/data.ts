// ELEKTRİK PROJESİNİN OKUMA KATMANI — Supabase'ten çekirdeğin tiplerine.
//
// Çekirdek (`parts-list.ts` · `rollup.ts` · `sheet-index.ts`) SAFTIR; bu dosya
// onunla veritabanı arasındaki tek geçittir. Ekran, el kitabı ve indirme ucu
// üçü de buradan okur — üç ayrı sorgu yazılsaydı biri `is_current` süzgecini
// unutur ve el kitabı eski sürümü basardı.

import type { SupabaseClient } from "@supabase/supabase-js";
import { cleanElectricalPart } from "./parts-list";
import type { ElectricalPart, ElectricalSheet, ElectricalTitleBlock } from "./types";
import { BOS_KUNYE } from "./title-block";

/** Depo kovası — yükleme (istemci), okuma (uç) ve silme aynı adı kullanır. */
export const ELECTRICAL_BUCKET = "electrical-projects";

/** Yüklemenin tablodaki hâli. */
export interface ElectricalDoc {
  id: string;
  projectId: string;
  fileName: string;
  revision: string;
  storagePath: string;
  sizeBytes: number;
  pageCount: number;
  titleBlock: ElectricalTitleBlock;
  sheets: ElectricalSheet[];
  /** Malzeme listesinin bulunduğu sayfalar; boşsa liste bulunamamıştır. */
  partsPages: number[];
  /** Okuma notu (`MALZEME_LISTESI_BULUNAMADI` gibi); sorun yoksa "". */
  note: string;
  parsedAt: string | null;
  isCurrent: boolean;
  createdAt: string;
}

const COLUMNS =
  "id, project_id, file_name, revision, storage_path, size_bytes, page_count, meta, parsed_at, is_current, created_at";

function satirdan(r: Record<string, unknown>): ElectricalDoc {
  const meta = (r.meta ?? {}) as Record<string, unknown>;
  return {
    id: String(r.id),
    projectId: String(r.project_id),
    fileName: String(r.file_name ?? ""),
    revision: String(r.revision ?? ""),
    storagePath: String(r.storage_path ?? ""),
    sizeBytes: Number(r.size_bytes ?? 0),
    pageCount: Number(r.page_count ?? 0),
    // JSONB serbest biçimlidir; okuma güvenli olmalı (`revision-load.ts` ilkesi).
    titleBlock: { ...BOS_KUNYE, ...((meta.titleBlock ?? {}) as Partial<ElectricalTitleBlock>) },
    sheets: Array.isArray(meta.sheets) ? (meta.sheets as ElectricalSheet[]) : [],
    partsPages: Array.isArray(meta.partsPages) ? (meta.partsPages as number[]) : [],
    note: String(meta.note ?? ""),
    parsedAt: r.parsed_at ? String(r.parsed_at) : null,
    isCurrent: r.is_current === true,
    createdAt: String(r.created_at ?? ""),
  };
}

/** Projenin bütün yüklemeleri — en yeni önce. */
export async function loadElectricalDocs(
  supabase: SupabaseClient,
  projectId: string
): Promise<ElectricalDoc[]> {
  const { data } = await supabase
    .from("electrical_projects")
    .select(COLUMNS)
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  return ((data ?? []) as Record<string, unknown>[]).map(satirdan);
}

/**
 * GÜNCEL yükleme — el kitabına ve ekipman listesine giren sürüm.
 *
 * `is_current` sütunu okunur, "en son yüklenen" varsayılmaz: kullanıcı yeni
 * bir sürüm yükleyip onu HENÜZ geçerli saymamış olabilir (çizim bürosu bir
 * taslak göndermiştir) ve o durumda el kitabı hâlâ eskisine dayanmalıdır.
 */
export async function loadCurrentElectricalDoc(
  supabase: SupabaseClient,
  projectId: string
): Promise<ElectricalDoc | null> {
  const { data } = await supabase
    .from("electrical_projects")
    .select(COLUMNS)
    .eq("project_id", projectId)
    .eq("is_current", true)
    .maybeSingle();
  return data ? satirdan(data as Record<string, unknown>) : null;
}

/** Bir yüklemenin malzeme satırları — BELGEDEKİ sırayla. */
export async function loadElectricalParts(
  supabase: SupabaseClient,
  docId: string
): Promise<ElectricalPart[]> {
  // SAYFALAMA ZORUNLU: PostgREST öntanımlı olarak 1000 satır döndürür ve
  // gerçek bir projede 726 satır var — bir sonraki proje eşiği aşınca liste
  // SESSİZCE kesilirdi ve el kitabı eksik basardı.
  const out: ElectricalPart[] = [];
  const ADIM = 1000;
  for (let ofset = 0; ; ofset += ADIM) {
    const { data } = await supabase
      .from("electrical_parts")
      .select(
        "device_tag, installation, location, device, qty, designation, type_no, supplier, part_no, page"
      )
      .eq("electrical_project_id", docId)
      .order("sort", { ascending: true })
      .range(ofset, ofset + ADIM - 1);
    const satirlar = (data ?? []) as Record<string, unknown>[];
    for (const r of satirlar) {
      const row = cleanElectricalPart({
        deviceTag: String(r.device_tag ?? ""),
        installation: String(r.installation ?? ""),
        location: String(r.location ?? ""),
        device: String(r.device ?? ""),
        // NULL SIFIR DEĞİLDİR: okunamayan adet bilinmiyordur (değişmez md. 4).
        qty: r.qty === null || r.qty === undefined ? null : Number(r.qty),
        designation: String(r.designation ?? ""),
        typeNo: String(r.type_no ?? ""),
        supplier: String(r.supplier ?? ""),
        partNo: String(r.part_no ?? ""),
        page: Number(r.page ?? 0),
      });
      if (row) out.push(row);
    }
    if (satirlar.length < ADIM) break;
  }
  return out;
}

/** Yüklemenin satır sayısı — listeyi çekmeden özet basmak için. */
export async function countElectricalParts(
  supabase: SupabaseClient,
  docId: string
): Promise<number> {
  const { count } = await supabase
    .from("electrical_parts")
    .select("id", { count: "exact", head: true })
    .eq("electrical_project_id", docId);
  return count ?? 0;
}

/**
 * Dosya adından sürüm etiketi ÖNERİR: `…_rev3.pdf` → `rev3`.
 *
 * ÖNERİDİR, kilit değil (`revision` elle düzenlenebilir): çizim bürolarının
 * yazımı standart değil ve bulunamayan bir sürüm BOŞ kalır — uydurulmaz.
 */
export function suggestElectricalRevision(fileName: string): string {
  const m = /(?:^|[^a-z])(rev\.?\s*[0-9]+[a-z]?)/i.exec(fileName);
  return m ? m[1].replace(/\s+/g, "").toLowerCase() : "";
}
