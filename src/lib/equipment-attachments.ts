// "Ek Belge" sütununun okuma katmanı — ekipman satırına ELLE yüklenmiş PDF'ler.
//
// KATALOG SAYFASINDAN AYRIDIR ve ikisi bir arada yaşar:
//   · Katalog sayfası — `catalog-sheets/manifest.json` defterinden gelir,
//     kaynak PDF'i workspace'te olan üreticileri kapsar, otomatik bulunur.
//   · Ek belge      — mühendisin kendi elindeki yapraktır. Defterin kapsamı
//     dışındaki her ürün (kanca, makara, teker, ray, müşteriye özel imalat)
//     ancak böyle bir sayfa taşıyabilir.
//
// Detaylı ekipman listesinde ikisi de belgenin sonuna basılır: önce katalog
// sayfaları, sonra ek belgeler.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { EqGroup, EquipmentAttachments } from "@/lib/excel/equipment";

/** Depo kovası — yükleme (istemci), okuma (uç) ve silme aynı adı kullanır. */
export const EQUIPMENT_ATTACHMENT_BUCKET = "equipment-attachments";

/** Ekin tablodaki hâli. */
export interface EquipmentAttachmentRow {
  id: string;
  rowKey: string;
  fileName: string;
  storagePath: string;
  /** Sunucunun OKUYARAK saydığı sayfa adedi (0 = dosya açılamamış) */
  pageCount: number;
  sort: number;
}

const COLUMNS = "id, row_key, file_name, storage_path, page_count, sort, created_at";

/**
 * Revizyonun bütün ekleri — satır anahtarına ve kullanıcının verdiği sıraya
 * göre dizili.
 */
export async function loadEquipmentAttachments(
  supabase: SupabaseClient,
  revisionId: string
): Promise<EquipmentAttachmentRow[]> {
  const { data } = await supabase
    .from("equipment_attachments")
    .select(COLUMNS)
    .eq("revision_id", revisionId)
    .order("row_key", { ascending: true })
    .order("sort", { ascending: true })
    .order("created_at", { ascending: true });

  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: String(r.id),
    rowKey: String(r.row_key ?? ""),
    fileName: String(r.file_name ?? ""),
    storagePath: String(r.storage_path ?? ""),
    pageCount: Number(r.page_count ?? 0),
    sort: Number(r.sort ?? 0),
  }));
}

/** row_key → listedeki görünen özet (sayfa adedi + dosya adı). */
export function attachmentsByRowKey(
  rows: readonly EquipmentAttachmentRow[]
): EquipmentAttachments {
  const map: EquipmentAttachments = {};
  for (const r of rows) {
    if (!r.rowKey) continue;
    (map[r.rowKey] ??= []).push({ fileName: r.fileName, pageCount: r.pageCount });
  }
  return map;
}

/** Ek yaprağının belgedeki sırası — kapağında hangi ekipmanın yazacağı dahil. */
export interface OrderedAttachment extends EquipmentAttachmentRow {
  /** Kapakta basılan ekipman adı (listede görünen hâli) */
  component: string;
}

/**
 * Ekleri EKİPMAN LİSTESİNİN SIRASINA dizer.
 *
 * Deste tabloyu izler: okuyan, listede yukarıdan aşağı gittikçe ekleri de aynı
 * sırada bulur. Tablodan bağımsız (ör. yükleme zamanına göre) bir sıra, otuz
 * yapraklık bir ekte hiçbir şey ifade etmezdi — `pdfBirlestir`in "sıra
 * çağıranındır ve yeniden sıralanmaz" ilkesinin aynısı.
 *
 * Aynı `rowKey` iki kez GEÇMEZ: alternatif (seçenekli) satırlar ana satırın
 * anahtarını taşıyabilir ve ek iki kez basılırdı.
 */
export function orderAttachmentsForAppendix(
  groups: readonly EqGroup[],
  rows: readonly EquipmentAttachmentRow[]
): OrderedAttachment[] {
  const byRow = new Map<string, EquipmentAttachmentRow[]>();
  for (const r of rows) {
    if (!r.rowKey) continue;
    const list = byRow.get(r.rowKey);
    if (list) list.push(r);
    else byRow.set(r.rowKey, [r]);
  }

  const gorulen = new Set<string>();
  const sirali: OrderedAttachment[] = [];
  for (const group of groups) {
    for (const row of group.rows) {
      const key = row.rowKey;
      if (!key || gorulen.has(key)) continue;
      const list = byRow.get(key);
      if (!list) continue;
      gorulen.add(key);
      for (const ek of list) sirali.push({ ...ek, component: row.component });
    }
  }
  return sirali;
}
