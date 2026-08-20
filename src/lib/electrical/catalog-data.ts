// ELEKTRİK KATALOG DEFTERİ — Supabase adaptörü.
//
// Ekran ve EK-F aynı sorguyu kullanır. Yalnız `is_primary` bağları çözülür:
// bütün kaynak belgeler veritabanında kalır ama iki küçük düğmenin ve teslim
// ekinin hangi belgeyi açacağı tek ve belirgindir.

import type { SupabaseClient } from "@supabase/supabase-js";
import { pdfBirlestir } from "@/lib/pdf/merge";
import { materialRows } from "./rollup";
import type { ElectricalMaterialRow, ElectricalPart } from "./types";
import {
  materialCatalogLookupKey,
  type ElectricalCatalogReference,
  type ElectricalCatalogUsage,
} from "./catalogs";

export const ELECTRICAL_CATALOG_BUCKET = "electrical-catalogs";

export interface ElectricalCatalogDocument {
  id: string;
  title: string;
  fileName: string;
  storagePath: string;
  storageParts: string[];
  pageCount: number;
  sourceDocumentId: string | null;
  sourcePages: number[];
}

interface ProductRow {
  id: string;
  lookup_key: string;
}

interface LinkRow {
  product_id: string;
  document_id: string;
  usage: ElectricalCatalogUsage;
}

/**
 * Malzeme satırlarının birincil föy/katalog bağlarını yükler.
 *
 * `.in()` listesi boşken sorgu yapılmaz; PostgREST'in boş IN davranışına
 * güvenmek yerine boş liste açıkça boş sonuç üretir.
 */
export async function loadElectricalCatalogReferences(
  supabase: SupabaseClient,
  materials: readonly ElectricalMaterialRow[]
): Promise<ElectricalCatalogReference[]> {
  const byLookup = new Map<string, ElectricalMaterialRow[]>();
  for (const material of materials) {
    if (!material.typeNo.trim()) continue;
    const key = materialCatalogLookupKey(material);
    const existing = byLookup.get(key);
    if (existing) existing.push(material);
    else byLookup.set(key, [material]);
  }
  const lookupKeys = [...byLookup.keys()];
  if (lookupKeys.length === 0) return [];

  const products: ProductRow[] = [];
  // PostgREST URL ve ifade boyunu sınırlı tut; 0019 bugün 163 malzemedir ama
  // çekirdek daha büyük projelerde de sessizce kesilmemelidir.
  const CHUNK = 100;
  for (let i = 0; i < lookupKeys.length; i += CHUNK) {
    const { data } = await supabase
      .from("electrical_catalog_products")
      .select("id, lookup_key")
      .in("lookup_key", lookupKeys.slice(i, i + CHUNK));
    products.push(...((data ?? []) as ProductRow[]));
  }
  if (products.length === 0) return [];

  const productIds = products.map((p) => p.id);
  const links: LinkRow[] = [];
  for (let i = 0; i < productIds.length; i += CHUNK) {
    const { data } = await supabase
      .from("electrical_catalog_product_documents")
      .select("product_id, document_id, usage")
      .in("product_id", productIds.slice(i, i + CHUNK))
      .eq("is_primary", true);
    links.push(...((data ?? []) as LinkRow[]));
  }

  const byProduct = new Map<
    string,
    { technicalDocumentId: string | null; catalogDocumentId: string | null }
  >();
  for (const link of links) {
    const pair = byProduct.get(link.product_id) ?? {
      technicalDocumentId: null,
      catalogDocumentId: null,
    };
    if (link.usage === "technical") pair.technicalDocumentId = link.document_id;
    else pair.catalogDocumentId = link.document_id;
    byProduct.set(link.product_id, pair);
  }

  const out: ElectricalCatalogReference[] = [];
  for (const product of products) {
    const pair = byProduct.get(product.id);
    if (!pair) continue;
    for (const material of byLookup.get(product.lookup_key) ?? []) {
      out.push({ materialKey: material.key, productId: product.id, ...pair });
    }
  }
  return out;
}

export async function loadElectricalCatalogReferencesForParts(
  supabase: SupabaseClient,
  parts: readonly ElectricalPart[]
): Promise<ElectricalCatalogReference[]> {
  return loadElectricalCatalogReferences(supabase, materialRows(parts));
}

export async function loadElectricalCatalogDocuments(
  supabase: SupabaseClient,
  ids: readonly string[]
): Promise<ElectricalCatalogDocument[]> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return [];
  const { data } = await supabase
    .from("electrical_catalog_documents")
    .select("id, title, file_name, storage_path, storage_parts, page_count, source_document_id, source_pages")
    .in("id", unique);
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: String(r.id),
    title: String(r.title ?? ""),
    fileName: String(r.file_name ?? ""),
    storagePath: String(r.storage_path ?? ""),
    storageParts:
      Array.isArray(r.storage_parts) && r.storage_parts.length > 0
        ? r.storage_parts.map(String)
        : [String(r.storage_path ?? "")],
    pageCount: Number(r.page_count ?? 0),
    sourceDocumentId: r.source_document_id ? String(r.source_document_id) : null,
    sourcePages: Array.isArray(r.source_pages) ? r.source_pages.map(Number) : [],
  }));
}

/** Parçalı büyük katalogları kullanıcıya yine tek PDF olarak sunar. */
export async function downloadElectricalCatalogDocument(
  supabase: SupabaseClient,
  document: ElectricalCatalogDocument
): Promise<Uint8Array | null> {
  const parts: { ad: string; bytes: Uint8Array }[] = [];
  for (let i = 0; i < document.storageParts.length; i++) {
    const storagePath = document.storageParts[i];
    const { data, error } = await supabase.storage
      .from(ELECTRICAL_CATALOG_BUCKET)
      .download(storagePath);
    if (error || !data) return null;
    parts.push({
      ad: `${document.title} (${i + 1}/${document.storageParts.length})`,
      bytes: new Uint8Array(await data.arrayBuffer()),
    });
  }
  if (parts.length === 1) return parts[0].bytes;
  const merged = await pdfBirlestir(parts, {
    baslik: document.title,
    konu: "Parçalı saklanan elektrik kataloğu",
    uretici: "ORION CRANES",
    olusturan: "ORION İş Yönetim Sistemi",
  });
  return merged.bytes;
}
