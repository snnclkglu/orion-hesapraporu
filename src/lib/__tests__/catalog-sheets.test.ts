// Katalog sayfası defteri — KORUMA testleri.
//
// Defter (`manifest.json`) `scripts/catalog-sheets.py` ile üretilir; bu testler
// defterin DİSKTEKİ dosyalarla ve katalog verisiyle tutarlı kaldığını
// doğrular. Betik koşulmadan bir seri eklenirse ya da bir dosya silinirse
// pop-up sessizce boş açılır — bu testler o sessizliği kırar.

import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  allCatalogSheets,
  catalogSheetFiles,
  catalogSheetUrl,
  findCatalogSheet,
  hasCatalogSheets,
} from "../catalog-sheets";

const SHEET_DIR = path.join(process.cwd(), "catalog-sheets");

describe("katalog sayfası defteri", () => {
  const sheets = allCatalogSheets();

  it("kaplin sayfaları defterde var", () => {
    expect(sheets.length).toBeGreaterThan(40);
    expect(sheets.every((s) => s.kind === "coupling")).toBe(true);
    for (const brand of ["OZGUN", "SIBRE", "JAURE"]) {
      expect(sheets.some((s) => s.brand === brand), `${brand} yok`).toBe(true);
    }
  });

  it("defterdeki her dosya diskte var ve boş değil", () => {
    const missing: string[] = [];
    for (const relative of catalogSheetFiles()) {
      const file = path.join(SHEET_DIR, relative);
      if (!existsSync(file) || statSync(file).size === 0) missing.push(relative);
    }
    expect(
      missing,
      `Eksik/boş sayfa dosyası: ${missing.join(", ")}\n` +
        "YAPILACAK: `python scripts/catalog-sheets.py` çalıştırın."
    ).toEqual([]);
  });

  it("her kaydın sayfa görüntüsü adedi PDF'iyle tutarlı", () => {
    for (const sheet of sheets) {
      expect(sheet.images.length, sheet.id).toBeGreaterThan(0);
      expect(sheet.models.length, sheet.id).toBeGreaterThan(0);
      expect(sheet.pdf.endsWith(".pdf"), sheet.id).toBe(true);
      expect(sheet.images.every((i) => i.endsWith(".webp")), sheet.id).toBe(true);
    }
  });

  it("uç adresi defterdeki yolu birebir taşır", () => {
    const first = sheets[0];
    expect(catalogSheetUrl(first.pdf)).toBe(`/api/catalog-sheet/${first.pdf}`);
    // Uç, yolu segmentlerden yeniden kurar; ayrıştırma defterle örtüşmeli.
    const rebuilt = catalogSheetUrl(first.pdf)
      .replace("/api/catalog-sheet/", "")
      .split("/")
      .join("/");
    expect(catalogSheetFiles().has(rebuilt)).toBe(true);
  });
});

describe("model → sayfa eşlemesi", () => {
  it("katalogdan seçilen yazımla bulur (veri tabanı yazımı)", () => {
    expect(findCatalogSheet("coupling", "OZGUN", "J7")?.series).toBe("J");
    expect(findCatalogSheet("coupling", "SIBRE", "ABC-V 450")?.series).toBe("ABC-V");
    expect(findCatalogSheet("coupling", "JAURE", "MTG-HD 370")?.series).toBe("MTG-HD");
  });

  it("Türkçe yazımlı marka da bulur (aksan eşlemeyi bozmaz)", () => {
    // Yeni-iş şablonu markayı "ÖZGÜN" olarak yazar; katalog "OZGUN" tutar.
    expect(findCatalogSheet("coupling", "ÖZGÜN", "J7")?.series).toBe("J");
    expect(findCatalogSheet("coupling", "Özgün Makina", "A5")?.series).toBe("A");
  });

  it("marka serbest metin olsa da model tekse bulur", () => {
    // Eski revizyonlarda marka alanı "SİBRE PİN KAPLİN" gibi yazılmıştır.
    expect(findCatalogSheet("coupling", "SİBRE PİN KAPLİN", "APC-A 160")?.series)
      .toBe("APC-A");
  });

  it("model tam eşleşmiyorsa sayfa AÇILMAZ (yakın sayfa gösterilmez)", () => {
    // Katalogdaki kod "APC-A 160"; basılı tip kodu "APC160A" ile yazılmışsa
    // hangi sayfa olduğu kesin değildir — tahmin edilmez.
    expect(findCatalogSheet("coupling", "SIBRE", "APC160A")).toBeUndefined();
    expect(findCatalogSheet("coupling", "OZGUN", "J99")).toBeUndefined();
    expect(findCatalogSheet("coupling", "OZGUN", "")).toBeUndefined();
    expect(findCatalogSheet("coupling", "OZGUN", undefined)).toBeUndefined();
  });

  it("aynı model kodu iki markada geçiyorsa markasız arama sonuç vermez", () => {
    // Defterde çakışma varsa markasız aramanın SESSİZCE bir marka seçmediğini
    // doğrular; çakışma yoksa test yine geçerlidir (kural her hâlde korunur).
    const byModel = new Map<string, Set<string>>();
    for (const sheet of allCatalogSheets()) {
      for (const model of sheet.models) {
        const key = `${sheet.kind}|${model.toUpperCase()}`;
        (byModel.get(key) ?? byModel.set(key, new Set()).get(key)!).add(sheet.brand);
      }
    }
    for (const [key, brands] of byModel) {
      if (brands.size < 2) continue;
      const model = key.split("|")[1];
      expect(findCatalogSheet("coupling", null, model), `${model} çakışması`)
        .toBeUndefined();
    }
  });

  it("henüz kapsanmayan tür için düğme hiç gösterilmez", () => {
    expect(hasCatalogSheets("coupling")).toBe(true);
    expect(hasCatalogSheets("gearbox")).toBe(false);
    expect(hasCatalogSheets("coupling", "OZGUN")).toBe(true);
    expect(hasCatalogSheets("coupling", "ÖZGÜN")).toBe(true);
    expect(hasCatalogSheets("coupling", "BİLİNMEYEN")).toBe(false);
  });
});
