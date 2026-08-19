// Şablon görsel defterinin birim testleri.
//
// KURAL İKİ YERDE YAŞIYOR (değişmez md. 8): defterdeki `file` ve `ratio` ile
// `public/manual-assets/` altındaki gerçek dosya. Ayrışırlarsa belge sessizce
// bozulur — eksik dosyada görsel hiç basılmaz, yanlış oranda ise yerleşim
// yanlış ölçer ve komşu içerik sayfadan taşar. Bu test ikisini de KAYNAĞI
// OKUYARAK karşılaştırır.

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { MANUAL_ASSETS, manualAsset, manualAssetRatios } from "../assets";
import { eksikManualAssets, manualAssetBytes, manualAssetsFor } from "../asset-bytes";
import { manualFromTemplate, allBlocks } from "../payload";

describe("şablon görsel defteri", () => {
  it("defterdeki her dosya GERÇEKTEN vardır", () => {
    expect(eksikManualAssets()).toEqual([]);
  });

  it("anahtarlar tekildir", () => {
    const anahtarlar = MANUAL_ASSETS.map((a) => a.key);
    expect(new Set(anahtarlar).size).toBe(anahtarlar.length);
  });

  it("dosya adları tekildir", () => {
    const dosyalar = MANUAL_ASSETS.map((a) => a.file);
    expect(new Set(dosyalar).size).toBe(dosyalar.length);
  });

  it("DEFTERDEKİ ORAN GERÇEK DOSYAYLA TUTAR", () => {
    // PNG başlığından genişlik/yükseklik okunur (IHDR, 16.–24. baytlar).
    // Bir kitaplık çağırmak yerine baytı okumak bilinçlidir: test, defterin
    // DOSYAYLA aynı şeyi söylediğini bağımsız bir yoldan doğrulamalı.
    for (const a of MANUAL_ASSETS) {
      const bytes = readFileSync(path.join(process.cwd(), "public", "manual-assets", a.file));
      expect(bytes.subarray(1, 4).toString("ascii")).toBe("PNG");
      const w = bytes.readUInt32BE(16);
      const h = bytes.readUInt32BE(20);
      expect(w).toBeGreaterThan(0);
      // Dört ondalık basamak defterde yazılı; tolerans yuvarlamanın kendisi.
      expect(a.ratio).toBeCloseTo(h / w, 3);
    }
  });

  it("baytlar okunur ve ikinci çağrıda AYNI tampon döner", () => {
    const ilk = manualAssetBytes(MANUAL_ASSETS[0].key);
    expect(ilk).not.toBeNull();
    expect(manualAssetBytes(MANUAL_ASSETS[0].key)).toBe(ilk);
  });

  it("tanınmayan anahtar null döner, düşmez", () => {
    expect(manualAsset("uydurma")).toBeNull();
    expect(manualAssetBytes("uydurma")).toBeNull();
    expect(manualAssetsFor(["uydurma"])).toEqual([]);
  });

  it("oran haritası yerleşimin beklediği şekli verir", () => {
    const harita = manualAssetRatios();
    expect(harita.size).toBe(MANUAL_ASSETS.length);
    expect(harita.get("halatHasar1")).toBeCloseTo(0.2066, 4);
  });
});

describe("şablonun kullandığı görseller", () => {
  const anahtarlar = allBlocks(manualFromTemplate().sections)
    .filter((b) => b.kind === "image")
    .map((b) => (b as { assetKey?: string }).assetKey ?? "");

  it("şablon görsel taşır", () => {
    expect(anahtarlar.length).toBeGreaterThan(10);
  });

  it("ŞABLONUN ANDIĞI HER ANAHTAR DEFTERDE VARDIR", () => {
    // Bu ikinci ayrışma yolu: defterde olmayan bir anahtar şablona
    // yazılırsa blok belgede sessizce KAYBOLUR (çizim onu bulamaz).
    const eksik = anahtarlar.filter((k) => !manualAsset(k));
    expect(eksik).toEqual([]);
  });

  it("şablon görsellerinin baytları yüklenebilir", () => {
    expect(manualAssetsFor(anahtarlar).length).toBe(new Set(anahtarlar).size);
  });
});
