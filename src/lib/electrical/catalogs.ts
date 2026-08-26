// ELEKTRİK MALZEMESİ ↔ KATALOG KİMLİĞİ — saf çekirdek.
//
// `electrical_parts` yeniden okumada silinip üretildiği için katalog bağı bir
// aygıt satırının UUID'sine dayanamaz. Normal durumda üretici + tip numarası
// ürünün kararlı kimliğidir. HELUKABEL satırlarında ise tedarikçi boş ve tip no
// bir ürün ailesidir; projenin `HELU.<makale no>` malzeme kodu kesin üretici
// kimliğini taşır. Noktalama/harf büyüklüğü yalnız eşleme için katlanır.

import type { ElectricalMaterialRow } from "./types";

export type ElectricalCatalogUsage = "technical" | "catalog";

/** Malzeme tablosunun iki küçük düğmesini besleyen çözülmüş bağ. */
export interface ElectricalCatalogReference {
  materialKey: string;
  productId: string;
  technicalDocumentId: string | null;
  catalogDocumentId: string | null;
}

/**
 * Yalnız eşleme için ASCII-benzeri anahtar.
 *
 * Eğik çizgi/tire/boşluk üretici kaynaklarında tutarlı değildir
 * (`DS-7104NI-Q1/4P/M` ↔ `DS-7104NI-Q1-4P-M`). Bunları kaldırmak doğru ürünü
 * buldurur; kullanıcıya gösterilen tip numarasına dokunulmaz.
 */
export function catalogIdentityPart(value: string): string {
  return value
    .trim()
    .toLocaleUpperCase("tr-TR")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/İ/g, "I")
    .replace(/[^A-Z0-9]+/g, "");
}

export function electricalCatalogLookupKey(supplier: string, typeNo: string): string {
  return `${catalogIdentityPart(supplier)}|${catalogIdentityPart(typeNo)}`;
}

export interface ElectricalCatalogIdentity {
  supplier: string;
  typeNo: string;
  lookupKey: string;
}

/** `HELU.10721` gibi proje kodundan HELUKABEL makale numarasını çözer. */
export function helukabelArticleNumber(partNo: string): string | null {
  return /^HELU(\d+)$/.exec(catalogIdentityPart(partNo))?.[1] ?? null;
}

/**
 * Malzemenin katalogdaki kararlı ürün kimliği.
 *
 * Kablo ailesi (`JZ-600 / OZ-600`) tek başına sipariş edilebilir ürünü
 * belirlemez; kesit/varyant için HELUKABEL makale numarası kullanılır.
 */
export function materialCatalogIdentity(
  material: Pick<ElectricalMaterialRow, "supplier" | "typeNo" | "partNo">
): ElectricalCatalogIdentity {
  const helukabelArticle = helukabelArticleNumber(material.partNo);
  const supplier = helukabelArticle ? "HELUKABEL" : material.supplier;
  const typeNo = helukabelArticle ?? material.typeNo;
  return {
    supplier,
    typeNo,
    lookupKey: electricalCatalogLookupKey(supplier, typeNo),
  };
}

export function materialCatalogLookupKey(
  material: Pick<ElectricalMaterialRow, "supplier" | "typeNo" | "partNo">
): string {
  return materialCatalogIdentity(material).lookupKey;
}

/** Seri hâle getirilebilir listeyi istemcinin hızlı anahtar sözlüğüne çevirir. */
export function catalogReferencesByMaterial(
  references: readonly ElectricalCatalogReference[]
): ReadonlyMap<string, ElectricalCatalogReference> {
  return new Map(references.map((r) => [r.materialKey, r]));
}
