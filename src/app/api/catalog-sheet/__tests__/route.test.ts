// Katalog sayfası ucu — davranış testleri.
//
// Uç iki şeyi garanti etmelidir:
//   1. Oturum yoksa dosya HİÇ okunmaz (401).
//   2. Yol, manifestten üretilen izin listesinde birebir yoksa okunmaz (404) —
//      dizin gezme (path traversal) denemesi dosya sistemine ulaşamaz.
// Oturum varken dosyanın gerçekten diskten okunup doğru içerik tipiyle
// döndüğü de burada doğrulanır; tarayıcıda yalnız oturumlu görülebildiği için
// bu testler o yolun tek otomatik kanıtıdır.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { allCatalogSheets } from "@/lib/catalog-sheets";

let signedIn = true;

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({
        data: { user: signedIn ? { id: "test-user" } : null },
      }),
    },
  }),
}));

const { GET } = await import("../[...path]/route");

/** Uç imzasına uygun çağrı yardımcısı. */
function call(segments: string[]) {
  return GET(new Request("http://localhost/api/catalog-sheet"), {
    params: Promise.resolve({ path: segments }),
  });
}

const sheet = allCatalogSheets()[0];

beforeEach(() => {
  signedIn = true;
});

describe("GET /api/catalog-sheet", () => {
  it("oturum yoksa 401 döner", async () => {
    signedIn = false;
    const res = await call(sheet.pdf.split("/"));
    expect(res.status).toBe(401);
  });

  it("defterdeki PDF'i doğru içerik tipiyle verir", async () => {
    const res = await call(sheet.pdf.split("/"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    const body = new Uint8Array(await res.arrayBuffer());
    expect(body.byteLength).toBeGreaterThan(1000);
    // %PDF- imzası
    expect(String.fromCharCode(...body.slice(0, 5))).toBe("%PDF-");
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
    for (const s of allCatalogSheets()) {
      for (const relative of [s.pdf, ...s.images]) {
        const res = await call(relative.split("/"));
        expect(res.status, relative).toBe(200);
      }
    }
  });
});
