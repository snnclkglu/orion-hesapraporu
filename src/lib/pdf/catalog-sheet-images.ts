// Katalog sayfası görüntülerini PDF'e hazırlar (yalnız sunucu — dosya sistemi).
//
// Kaynak sayfalar `.webp`tir; react-pdf yalnız PNG ve JPEG çözer. Dönüştürme
// PDF katmanına DEĞİL buraya konur: `equipment-report.tsx` saf kalsın ve
// hazır tampon (buffer) alsın diye.
//
// JPEG seçilir, PNG değil: kaynak sayfalar taranmış görüntüdür (fotoğrafik),
// PNG'de dosya birkaç katına çıkar ve 30+ sayfalık bir ekte PDF onlarca MB
// olurdu. Genişlik 1400 pikselle sınırlanır — A4 dikey sayfada 487 pt genişliğe
// basılan bir görüntü için ~205 dpi eder, ölçü tablosu okunur ve dosya makul
// kalır.

import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { findCatalogSheet } from "@/lib/catalog-sheets";
import { catalogIdentityOf, dsKey, type EqGroup } from "@/lib/excel/equipment";
import type { CatalogSheetPage } from "@/lib/pdf/equipment-report";

const MAX_WIDTH = 1400;
const JPEG_QUALITY = 78;

async function loadImage(relativePath: string): Promise<Buffer | null> {
  try {
    const raw = await readFile(path.join(process.cwd(), "catalog-sheets", relativePath));
    return await sharp(raw)
      .resize({ width: MAX_WIDTH, withoutEnlargement: true })
      .flatten({ background: "#ffffff" }) // saydam zemin PDF'te siyah basılır
      .jpeg({ quality: JPEG_QUALITY, progressive: false })
      .toBuffer();
  } catch {
    // Defterde var ama diskte yok (sayfa üretimi koşulmamış) ya da bozuk
    // dosya: EK O ÜRÜNSÜZ üretilir. Tüm indirmeyi düşürmek, kataloğu olan
    // otuz ürünü bir eksik dosya yüzünden cezalandırırdı.
    return null;
  }
}

/**
 * Ekipman listesindeki ürünlerin katalog sayfaları — listedeki SIRAYLA, her
 * ürün bir kez.
 *
 * Aynı katalog sayfasına düşen iki ürün (ör. aynı seri iki kaplin) sayfayı iki
 * kez bastırmaz: ek, sayfa kimliğine göre tekilleştirilir ve ikinci ürünün
 * bağlantısı da aynı çapaya gider.
 */
export async function collectCatalogSheetPages(
  groups: EqGroup[]
): Promise<CatalogSheetPage[]> {
  const seenProduct = new Set<string>();
  /** katalog sayfası kimliği → ek yaprağı */
  const bySheetId = new Map<string, CatalogSheetPage>();
  const pages: CatalogSheetPage[] = [];

  for (const group of groups) {
    for (const row of group.rows) {
      const id = catalogIdentityOf(row);
      if (!id) continue;
      // Anahtar GÖRÜNEN sütunlardan üretilir (listedeki bağlantıyla aynı),
      // arama ise satırın katalog kimliğiyle yapılır.
      const key = dsKey(row.kind!, row.brand, row.model);
      if (seenProduct.has(key)) continue;
      seenProduct.add(key);

      const sheet = findCatalogSheet(id.kind, id.brand, id.model);
      if (!sheet) continue;

      // Aynı sayfa: yaprak bir kez basılır, ikinci ürün de aynı çapaya bağlanır.
      const already = bySheetId.get(sheet.id);
      if (already) {
        already.keys.push(key);
        continue;
      }

      const images: CatalogSheetPage["images"] = [];
      for (const image of sheet.images) {
        const data = await loadImage(image);
        if (data) images.push({ data, format: "jpg" });
      }
      if (images.length === 0) continue;

      const page: CatalogSheetPage = {
        keys: [key],
        title: sheet.title,
        model: row.model,
        source: sheet.source,
        printedPages: sheet.printedPages,
        images,
      };
      bySheetId.set(sheet.id, page);
      pages.push(page);
    }
  }
  return pages;
}
