// EKİPMAN LİSTESİNİN ELEKTRİK BÖLÜMÜ — Supabase adaptörü.
//
// Çekirdek (`equipment-sections.ts`) saftır; bu dosya onunla veritabanı
// arasındaki TEK geçittir. Ekran, indirme ucu ve önizleme üçü de buradan
// okur — üç ayrı sorgu yazılsaydı biri `is_current` süzgecini unutur ve
// ekipman listesi çizim bürosunun ESKİ sürümünü basardı (`ELEKTRIK-1`).

import type { SupabaseClient } from "@supabase/supabase-js";
import { loadCurrentElectricalDoc, loadElectricalParts } from "@/lib/electrical/data";
import { loadElectricalCatalogReferences } from "@/lib/electrical/catalog-data";
import { materialRows } from "@/lib/electrical/rollup";
import type { ElectricalDoc } from "@/lib/electrical/data";
import {
  buildElectricalCatalogUrls,
  buildElectricalEquipmentGroups,
} from "@/lib/equipment-sections";
import type { EqGroup, EquipmentAttachments, EquipmentNotes } from "@/lib/excel/equipment";

export interface ElectricalEquipment {
  /** Listeye giren GÜNCEL yükleme — künye/sürüm belgede görünür. */
  doc: ElectricalDoc;
  groups: EqGroup[];
  /** Ekipman ADINA bağlanan teknik föy adresleri (`rowSheetUrl` sözlüğü). */
  sheetUrls: Map<string, string>;
  /** MODEL hücresine bağlanan tam katalog adresleri (`rowDatasheetUrl` sözlüğü). */
  datasheetUrls: Map<string, string>;
  /** Belgedeki aygıt satırı adedi — malzeme satırı sayısıyla aynı DEĞİLDİR. */
  partCount: number;
}

/**
 * Projenin elektrik ekipman bölümü — elektrik projesi yoksa `null`.
 *
 * `null` bir hata değil bir DURUMDUR: her projede elektrik projesi olmaz ve
 * olmayan bir bölüm hiç basılmaz (`equipment-sections.ts` başlığı).
 */
export async function loadElectricalEquipment(
  supabase: SupabaseClient,
  projectId: string,
  options: {
    notes?: EquipmentNotes;
    attachments?: EquipmentAttachments;
    /** Uygulamanın kök adresi — Excel/PDF dışarıda açıldığı için MUTLAK adres. */
    origin?: string;
  } = {}
): Promise<ElectricalEquipment | null> {
  const doc = await loadCurrentElectricalDoc(supabase, projectId);
  if (!doc) return null;

  const parts = await loadElectricalParts(supabase, doc.id);
  // Malzeme satırı ÖNCE derlenir: aynı ürünün kaç adet geçtiği ve hangi
  // panolarda kullanıldığı ancak bütün aygıt satırları elde varken çıkar
  // (`ELEKTRIK-5`).
  const materials = materialRows(parts);
  const groups = buildElectricalEquipmentGroups(materials, {
    notes: options.notes,
    attachments: options.attachments,
  });
  const references = await loadElectricalCatalogReferences(supabase, materials);
  const { sheetUrls, datasheetUrls } = buildElectricalCatalogUrls(
    groups,
    materials,
    references,
    options.origin ?? ""
  );
  return { doc, groups, sheetUrls, datasheetUrls, partCount: parts.length };
}
