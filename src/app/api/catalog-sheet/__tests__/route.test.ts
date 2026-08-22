// Katalog sayfası ucu — davranış testleri.
//
// Uç iki şeyi garanti etmelidir:
//   1. Müşteri üyelik olmadan izin listesindeki sayfayı açabilir.
//   2. Yol, manifestten üretilen izin listesinde birebir yoksa okunmaz (404) —
//      dizin gezme (path traversal) denemesi dosya sistemine ulaşamaz.
// Dosyanın gerçekten diskten okunup doğru içerik tipiyle döndüğü de burada
// doğrulanır; açık uç, manifest dışındaki hiçbir dosyayı sunmamalıdır.

import { describe, expect, it } from "vitest";
import { allCatalogSheets } from "@/lib/catalog-sheets";

const { GET } = await import("../[...path]/route");

/** Uç imzasına uygun çağrı yardımcısı. */
function call(segments: string[]) {
  return GET(new Request("http://localhost/api/catalog-sheet"), {
    params: Promise.resolve({ path: segments }),
  });
}

const sheet = allCatalogSheets()[0];

describe("GET /api/catalog-sheet", () => {
  it("üyelik olmadan izin listesindeki katalog sayfasını verir", async () => {
    const res = await call(sheet.images[0].split("/"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toContain("public");
  });

  it("PDF uzantısı sunulmaz (defterde yalnız görüntü vardır)", async () => {
    const res = await call(sheet.images[0].replace(/\.webp$/, ".pdf").split("/"));
    expect(res.status).toBe(404);
  });

  it("defterdeki sayfa görüntüsünü webp olarak verir", async () => {
    const res = await call(sheet.images[0].split("/"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/webp");
    const body = new Uint8Array(await res.arrayBuffer());
    // RIFF....WEBP kabı
    expect(String.fromCharCode(...body.slice(0, 4))).toBe("RIFF");
    expect(String.fromCharCode(...body.slice(8, 12))).toBe("WEBP");
  });

  it("defterde olmayan yol 404 döner", async () => {
    expect((await call(["coupling", "olmayan-sayfa.pdf"])).status).toBe(404);
    expect((await call([])).status).toBe(404);
  });

  it("dizin gezme denemesi dosya sistemine ulaşamaz", async () => {
    for (const attempt of [
      ["..", "..", ".env.local"],
      ["coupling", "..", "..", "package.json"],
      ["coupling", "../../next.config.ts"],
    ]) {
      const res = await call(attempt);
      expect(res.status, attempt.join("/")).toBe(404);
    }
  });

  it("izin listesindeki her dosya gerçekten okunabiliyor", async () => {
    // Defter büyüdükçe tek tek elle denenmez; hepsi burada bir kez geçer.
    // Aynı görüntüyü birden çok seri paylaşabildiği için yol kümesi kullanılır.
    const paths = new Set(allCatalogSheets().flatMap((s) => s.images));
    for (const relative of paths) {
      const res = await call(relative.split("/"));
      expect(res.status, relative).toBe(200);
    }
  }, 60_000);
});
