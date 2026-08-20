import "server-only";

// EK-F — Elektrik Ekipman Katalog Sayfaları adaptörü.
//
// EK-F'ye TAM KATALOG GİRMEZ. Güncel elektrik projesinin malzeme sırası
// korunur, her malzemenin yalnız birincil TEKNİK FÖYÜ alınır ve aynı föy iki
// üründe kullanılıyorsa bir kez basılır. Veritabanındaki `page_count` ilk
// savunmadır; 1-6 dışındaki bir belge yanlışlıkla teknik bağ yapılsa bile
// teslim paketine giremez.

import type { SupabaseClient } from "@supabase/supabase-js";
import { pdfBirlestir, type AtlananPdf } from "@/lib/pdf/merge";
import { loadCurrentElectricalDoc, loadElectricalParts } from "./data";
import { materialRows } from "./rollup";
import {
  downloadElectricalCatalogDocument,
  loadElectricalCatalogDocuments,
  loadElectricalCatalogReferences,
} from "./catalog-data";

export interface ElectricalCatalogAppendixResult {
  bytes: Uint8Array<ArrayBuffer>;
  documentCount: number;
  pageCount: number;
  skipped: AtlananPdf[];
}

export async function buildElectricalCatalogAppendix(
  supabase: SupabaseClient,
  projectId: string
): Promise<ElectricalCatalogAppendixResult> {
  const current = await loadCurrentElectricalDoc(supabase, projectId);
  if (!current) return { bytes: new Uint8Array(0), documentCount: 0, pageCount: 0, skipped: [] };

  const parts = await loadElectricalParts(supabase, current.id);
  const materials = materialRows(parts);
  const references = await loadElectricalCatalogReferences(supabase, materials);
  const byMaterial = new Map(references.map((r) => [r.materialKey, r]));

  // Sıra MALZEME LİSTESİDİR; sorgunun dönüş sırası değildir.
  const orderedIds: string[] = [];
  const labels = new Map<string, string>();
  const seen = new Set<string>();
  for (const material of materials) {
    const id = byMaterial.get(material.key)?.technicalDocumentId;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    orderedIds.push(id);
    labels.set(
      id,
      [material.supplier, material.typeNo, material.designation].filter((v) => v.trim()).join(" · ")
    );
  }

  const documents = await loadElectricalCatalogDocuments(supabase, orderedIds);
  const byId = new Map(documents.map((d) => [d.id, d]));
  const inputs: { ad: string; bytes: Uint8Array }[] = [];
  const skipped: AtlananPdf[] = [];

  for (const id of orderedIds) {
    const document = byId.get(id);
    const ad = labels.get(id) || document?.title || "Teknik föy";
    if (!document) {
      skipped.push({ ad, sebep: "veritabanı kaydı bulunamadı" });
      continue;
    }
    if (document.pageCount < 1 || document.pageCount > 6) {
      skipped.push({ ad, sebep: `teknik föy sayfa sınırı dışında (${document.pageCount} sayfa)` });
      continue;
    }
    const bytes = await downloadElectricalCatalogDocument(supabase, document);
    if (!bytes) {
      skipped.push({ ad, sebep: "depo nesnesi indirilemedi" });
      continue;
    }
    inputs.push({ ad, bytes });
  }

  const merged = await pdfBirlestir(inputs, {
    baslik: "EK-F Elektrik Ekipman Katalog Sayfaları",
    konu: `${projectId} projesinin elektrik malzeme listesine bağlı teknik föyleri`,
    uretici: "ORION CRANES",
    olusturan: "ORION İş Yönetim Sistemi",
  });
  return {
    bytes: merged.bytes,
    documentCount: merged.birlesen,
    pageCount: merged.sayfaSayisi,
    skipped: [...skipped, ...merged.atlananlar],
  };
}
