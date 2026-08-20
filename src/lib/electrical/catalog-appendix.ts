// EK-F — Elektrik Ekipman Katalog Sayfaları adaptörü.
//
// Tam katalog EK-F'ye girmez. Malzeme sırasındaki doğrulanmış teknik belgeler
// kaynak sayfa kimliğiyle tekilleştirilir ve ürün başına en çok İKİ sayfa
// basılır. İlk yaprak(lar) tıklanabilir bir katalog dizinidir; gerçek üretici
// sayfaları ORION çerçevesinin içine sığdırılır.

import { renderToBuffer } from "@react-pdf/renderer";
import { PDFDocument } from "pdf-lib";
import sharp from "sharp";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AtlananPdf } from "@/lib/pdf/merge";
import { loadCurrentElectricalDoc, loadElectricalParts } from "./data";
import { materialRows } from "./rollup";
import {
  downloadElectricalCatalogDocument,
  loadElectricalCatalogDocuments,
  loadElectricalCatalogReferences,
  type ElectricalCatalogDocument,
} from "./catalog-data";
import {
  CATALOG_PAGE_BOX,
  ElectricalCatalogAppendixPdf,
  catalogAppendixIndexPageCount,
  type ElectricalCatalogAppendixEntry,
} from "./catalog-appendix-pdf";

export interface ElectricalCatalogAppendixResult {
  bytes: Uint8Array<ArrayBuffer>;
  documentCount: number;
  pageCount: number;
  skipped: AtlananPdf[];
  /** Adlandırılmış hedef → ek içindeki 0 tabanlı hedef sayfa. */
  destinations: Record<string, number>;
}

interface CatalogGroup {
  document: ElectricalCatalogDocument;
  label: string;
  extraProducts: number;
}

const emptyResult = (): ElectricalCatalogAppendixResult => ({
  bytes: new Uint8Array(0),
  documentCount: 0,
  pageCount: 0,
  skipped: [],
  destinations: {},
});

/** Aynı kaynak sayfa aralığını kullanan ürünler EK-F'de bir kez basılır. */
function documentGroupKey(document: ElectricalCatalogDocument): string {
  if (document.sourceDocumentId && document.sourcePages.length > 0) {
    return `source:${document.sourceDocumentId}:${document.sourcePages.slice(0, 2).join(",")}`;
  }
  return `document:${document.id}`;
}

export async function buildElectricalCatalogAppendix(
  supabase: SupabaseClient,
  projectId: string
): Promise<ElectricalCatalogAppendixResult> {
  // PDF.js'in yeni sürümü Node 24'te henüz bulunmayan bu yerleşiği çağırır.
  const math = Math as typeof Math & { sumPrecise?: (values: Iterable<number>) => number };
  math.sumPrecise ??= (values) => {
    let total = 0;
    for (const value of values) total += value;
    return total;
  };
  const { renderPageAsImage } = await import("unpdf");
  const current = await loadCurrentElectricalDoc(supabase, projectId);
  if (!current) return emptyResult();

  const parts = await loadElectricalParts(supabase, current.id);
  const materials = materialRows(parts);
  const references = await loadElectricalCatalogReferences(supabase, materials);
  const byMaterial = new Map(references.map((reference) => [reference.materialKey, reference]));
  const orderedIds = materials
    .map((material) => byMaterial.get(material.key)?.technicalDocumentId ?? null)
    .filter((id): id is string => Boolean(id));
  const documents = await loadElectricalCatalogDocuments(supabase, orderedIds);
  const byId = new Map(documents.map((document) => [document.id, document]));

  const groups = new Map<string, CatalogGroup>();
  const skipped: AtlananPdf[] = [];
  for (const material of materials) {
    const id = byMaterial.get(material.key)?.technicalDocumentId;
    if (!id) continue;
    const document = byId.get(id);
    const label = [material.supplier, material.typeNo, material.designation]
      .filter((value) => value.trim())
      .join(" · ");
    if (!document) {
      skipped.push({ ad: label || "Teknik föy", sebep: "veritabanı kaydı bulunamadı" });
      continue;
    }
    if (document.pageCount < 1 || document.pageCount > 6) {
      skipped.push({
        ad: label || document.title,
        sebep: `teknik föy sayfa sınırı dışında (${document.pageCount} sayfa)`,
      });
      continue;
    }
    const key = documentGroupKey(document);
    const existing = groups.get(key);
    if (existing) existing.extraProducts += 1;
    else groups.set(key, { document, label: label || document.title, extraProducts: 0 });
  }

  // Belge indirme ve açma önce tamamlanır; bozuk bir kaynak dizinde görünmez.
  const prepared: { group: CatalogGroup; bytes: Uint8Array; pageCount: number }[] = [];
  for (const group of groups.values()) {
    const bytes = await downloadElectricalCatalogDocument(supabase, group.document);
    if (!bytes) {
      skipped.push({ ad: group.label, sebep: "depo nesnesi indirilemedi" });
      continue;
    }
    try {
      const source = await PDFDocument.load(bytes, { updateMetadata: false });
      const pageCount = Math.min(2, source.getPageCount());
      if (pageCount < 1) throw new Error("belgede sayfa yok");
      prepared.push({ group, bytes, pageCount });
    } catch (error) {
      skipped.push({
        ad: group.label,
        sebep: error instanceof Error ? `okunamadı: ${error.message.slice(0, 160)}` : "okunamadı",
      });
    }
  }
  if (prepared.length === 0) return { ...emptyResult(), skipped };

  const entries: ElectricalCatalogAppendixEntry[] = prepared.map((item, index) => ({
    anchor: `ekf-entry-${index + 1}`,
    label:
      item.group.extraProducts > 0
        ? `${item.group.label} (+${item.group.extraProducts} ürün)`
        : item.group.label,
    pageCount: item.pageCount,
  }));
  const indexPageCount = catalogAppendixIndexPageCount(entries.length);
  const shellBytes = await renderToBuffer(ElectricalCatalogAppendixPdf({ entries }));
  const target = await PDFDocument.load(shellBytes, { updateMetadata: false });
  const destinations: Record<string, number> = {};
  let targetPageIndex = indexPageCount;

  for (let i = 0; i < prepared.length; i++) {
    const item = prepared[i];
    const entry = entries[i];
    const source = await PDFDocument.load(item.bytes, { updateMetadata: false });
    destinations[entry.anchor] = targetPageIndex;
    for (let pageIndex = 0; pageIndex < item.pageCount; pageIndex++) {
      const page = target.getPage(targetPageIndex++);
      const sourceSize = source.getPage(pageIndex).getSize();
      const scale = Math.min(
        CATALOG_PAGE_BOX.width / sourceSize.width,
        CATALOG_PAGE_BOX.height / sourceSize.height
      );
      const width = sourceSize.width * scale;
      const height = sourceSize.height * scale;
      const x = CATALOG_PAGE_BOX.x + (CATALOG_PAGE_BOX.width - width) / 2;
      const y = CATALOG_PAGE_BOX.y + (CATALOG_PAGE_BOX.height - height) / 2;
      try {
        // EK-F teslim kopyasıdır; tam vektör katalog UI'daki Katalog düğmesinde
        // korunur. 1600 px / JPEG 80, ince teknik yazıyı okunur bırakırken bazı
        // tek sayfada 10 MB'a çıkan üretici akışlarını yüzlerce KB'a indirir.
        // Kopya verilmezse PDF.js worker'ı kaynak ArrayBuffer'ı ayırabilir.
        const png = await renderPageAsImage(new Uint8Array(item.bytes), pageIndex + 1, {
          canvasImport: () => import("@napi-rs/canvas"),
          width: 1600,
        });
        const jpeg = await sharp(Buffer.from(png))
          .flatten({ background: "#ffffff" })
          .jpeg({ quality: 80, mozjpeg: true })
          .toBuffer();
        const image = await target.embedJpg(jpeg);
        page.drawImage(image, { x, y, width, height });
      } catch (rasterError) {
        throw new Error(
          `${entry.label} sayfa ${pageIndex + 1} çizilemedi: ${
            rasterError instanceof Error ? rasterError.message : "bilinmeyen hata"
          }`
        );
      }
    }
  }

  target.setTitle("EK-F Elektrik Ekipman Katalog Sayfaları");
  target.setSubject(`${projectId} projesinin elektrik malzeme listesine bağlı teknik sayfaları`);
  target.setProducer("ORION CRANES");
  target.setCreator("ORION İş Yönetim Sistemi");
  const saved = await target.save({ useObjectStreams: true, objectsPerTick: 2000 });
  return {
    bytes: new Uint8Array(saved.buffer as ArrayBuffer, saved.byteOffset, saved.byteLength),
    documentCount: prepared.length,
    pageCount: target.getPageCount(),
    skipped,
    destinations,
  };
}
