// ELEKTRİK MALZEMESİ ↔ KATALOG KİMLİĞİ — saf çekirdek.
//
// `electrical_parts` yeniden okumada silinip üretildiği için katalog bağı bir
// aygıt satırının UUID'sine dayanamaz. Üretici + tip numarası ürünün kararlı
// kimliğidir; noktalama ve harf büyüklüğü yalnız eşleme için katlanır, ekranda
// gösterilen asıl değerler değiştirilmez.

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

export function materialCatalogLookupKey(
  material: Pick<ElectricalMaterialRow, "supplier" | "typeNo">
): string {
  return electricalCatalogLookupKey(material.supplier, material.typeNo);
}

/** Seri hâle getirilebilir listeyi istemcinin hızlı anahtar sözlüğüne çevirir. */
export function catalogReferencesByMaterial(
  references: readonly ElectricalCatalogReference[]
): ReadonlyMap<string, ElectricalCatalogReference> {
  return new Map(references.map((r) => [r.materialKey, r]));
}
