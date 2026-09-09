import type { CatalogFamily } from "./brands";
import type { CatalogFilter } from "./catalog-scope";
import { contentHash, type EquipmentRow, type SelectionProgress } from "./types";

type Fetcher = typeof fetch;
export interface CatalogManifest { version: number; families: CatalogFamily[] }
const snapshots = new Map<string, EquipmentRow[]>();
async function read(revisionId: string, params: Record<string, string>, signal: AbortSignal, fetcher: Fetcher) {
  const response = await fetcher(`/api/auto-selection/catalog?${new URLSearchParams({ revisionId, ...params })}`, { signal, cache: "no-store" });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "Katalog okunamadı.");
  return data;
}
export async function loadCatalogManifest(revisionId: string, signal: AbortSignal, fetcher: Fetcher = fetch): Promise<CatalogManifest> {
  const data = await read(revisionId, { manifest: "1" }, signal, fetcher);
  if (!Number.isSafeInteger(data.version) || !Array.isArray(data.families)) throw new Error("Katalog aileleri okunamadı.");
  return data;
}
/** Her kullanımda erişim + sürüm yeniden kontrol edilir; yalnız tam aktarım önbelleğe girer. */
export async function loadSelectionCatalog(revisionId: string, version: number, filter: CatalogFilter, signal: AbortSignal, progress?: (value: SelectionProgress) => void, fetcher: Fetcher = fetch): Promise<EquipmentRow[]> {
  const metadata = await read(revisionId, { metadata: "1" }, signal, fetcher);
  if (metadata.version !== version) throw new Error("Katalog değişti. Pencereyi yeniden açıp güncel markalarla başlatın.");
  const cacheKey = `${version}:${contentHash(filter)}`;
  const cached = snapshots.get(cacheKey);
  if (cached) return cached;
  const page = async (index: number) => {
    const data = await read(revisionId, { page: String(index), filter: JSON.stringify(filter) }, signal, fetcher);
    if (!Array.isArray(data.rows) || !Number.isSafeInteger(data.total) || data.total < 0 || data.page !== index || data.version !== version) throw new Error("Katalog aktarımı tutarsız. Yeniden başlatın.");
    return data as { rows: EquipmentRow[]; total: number; page: number; version: number };
  };
  const first = await page(0); const rows = [...first.rows];
  const pages = Math.ceil(first.total / 1000);
  for (let start = 1; start < pages; start += 4) {
    const batch = await Promise.all(Array.from({ length: Math.min(4, pages - start) }, (_, i) => page(start + i)));
    for (const item of batch) { if (item.total !== first.total) throw new Error("Katalog aktarım sırasında değişti."); rows.push(...item.rows); }
    progress?.({ stage: `Seçilen aileler hazırlanıyor · ${rows.length.toLocaleString("tr-TR")} / ${first.total.toLocaleString("tr-TR")} ürün`, completed: rows.length, total: first.total, evaluations: 0 });
  }
  if (signal.aborted) throw new DOMException("İptal edildi", "AbortError");
  if (rows.length !== first.total || new Set(rows.map(row => row.id)).size !== first.total) throw new Error("Katalog aktarımı tamamlanmadı. Eksik katalogla seçim yapılmadı.");
  // Büyük ürün dizileri sınırsız birikmez; son iki seçim filtresi saklanır.
  if (snapshots.size >= 2) snapshots.delete(snapshots.keys().next().value!);
  snapshots.set(cacheKey, rows);
  return rows;
}
