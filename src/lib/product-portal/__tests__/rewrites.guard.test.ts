import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { productPortalUrl } from "../nameplate";

/*
 * PORTALIN ADRESLERİ `next.config.ts`TE YAŞIYOR — VE ORASI GÖRÜNMEZ BİR BAĞDIR.
 *
 * Vercel Hobby fonksiyon bütçesi yüzünden vinç portalının HTML ve işlem yüzleri
 * KENDİ route dosyalarına sahip DEĞİLDİR; istekler mevcut teknik-resim paylaşım
 * fonksiyonuna rewrite edilir. `src/app/(public)/paylas/vinc/**` altında hiçbir
 * dosya yoktur (boş klasörler de silindi — git'te yaşamıyorlardı ve rewrite'ı
 * gölgeleme riski taşıyorlardı).
 *
 * Bunun bedeli şudur: bir gün biri `next.config.ts`teki bir satırı silerse
 * DERLEME GEÇER, TEST GEÇER, ama plakaya kazınmış QR 404 döner. Bu dosya o
 * sessiz kopmayı engeller: kaynağı okur ve dört kuralın da yerinde olduğunu,
 * QR'ın ürettiği adresle birebir eşleştiğini doğrular (değişmez md. 8).
 */
const CONFIG = readFileSync(path.join(process.cwd(), "next.config.ts"), "utf8");

const REQUIRED_REWRITES = [
  {
    source: "/paylas/vinc/:code/belge/:documentId/content",
    destination: "/paylas/resim/:code/content?portal=vinc&action=content&documentId=:documentId",
  },
  {
    source: "/paylas/vinc/:code/belge/:documentId/indir",
    destination: "/paylas/resim/:code/content?portal=vinc&action=indir&documentId=:documentId",
  },
  {
    source: "/paylas/vinc/:code/giris",
    destination: "/paylas/resim/:code/content?portal=vinc&action=giris",
  },
  {
    source: "/paylas/vinc/:code/cikis",
    destination: "/paylas/resim/:code/content?portal=vinc&action=cikis",
  },
  {
    source: "/paylas/vinc/:code",
    destination: "/paylas/resim/:code?portal=vinc",
  },
  // Plakaya kazınan KALICI adres; `productPortalUrl` bunu üretir.
  {
    source: "/qr/:code",
    destination: "/paylas/resim/:code?portal=vinc",
  },
];

describe("vinç portalı rewrite bağı", () => {
  it("beş kuralın hepsi next.config.ts içinde durur", () => {
    for (const rule of REQUIRED_REWRITES) {
      expect(CONFIG, rule.source).toContain(`source: "${rule.source}"`);
      expect(CONFIG, rule.destination).toContain(`destination: "${rule.destination}"`);
    }
  });

  it("en genel kural EN SONDA durur; yoksa alt yolları yutar", () => {
    // `/paylas/vinc/:code` deseni `/giris` ve `/belge/...` yollarını da
    // eşleştirebilir; Next kuralları SIRAYLA dener.
    // Sıra kuralı YALNIZ aynı önekteki kurallar için geçerlidir: `/qr/:code`
    // başka bir öneke oturur, `/paylas/vinc/:code` onu yutamaz.
    const generic = CONFIG.indexOf('source: "/paylas/vinc/:code"');
    const sameFamily = REQUIRED_REWRITES.filter(
      (entry) => entry.source.startsWith("/paylas/vinc/") && entry.source !== "/paylas/vinc/:code"
    );
    expect(sameFamily.length).toBeGreaterThan(0);
    for (const rule of sameFamily) {
      expect(CONFIG.indexOf(`source: "${rule.source}"`), rule.source).toBeLessThan(generic);
    }
  });

  it("portalın kendi route dosyaları YOKTUR — bağ yalnız rewrite'tır", () => {
    // Klasör geri gelirse rewrite sessizce gölgelenir ve bu test onu yakalar.
    expect(existsSync(path.join(process.cwd(), "src", "app", "(public)", "paylas", "vinc"))).toBe(false);
  });

  it("plakadaki adres ile rewrite kaynağı aynı yolu gösterir", () => {
    // `productPortalUrl` ile `next.config.ts` iki ayrı yerde yaşıyor; ayrışırsa
    // basılmış her QR ölür (değişmez md. 8).
    const url = productPortalUrl("https://portal.orioncranes.com", "23456789ABCDEFGH");
    const yol = new URL(url).pathname;
    expect(yol).toBe("/qr/23456789ABCDEFGH");
    expect(CONFIG).toContain('source: "/qr/:code"');
  });

  it("proxy `/qr/` yolunu oturumdan muaf tutar", () => {
    // Muafiyet olmadan QR'ı okutan müşteri giriş sayfasına düşer.
    const proxy = readFileSync(path.join(process.cwd(), "src", "proxy.ts"), "utf8");
    expect(proxy).toContain('startsWith("/qr/")');
  });

  it("CSP tarayıcı tarafı PDF üretimine izin verir", () => {
    // Plaka PDF'i yoga WASM'ını `data:` adresinden çeker ve fflate'in blob
    // worker'ını kullanır; iki direktif de kalkarsa düğme sessizce asılı kalır.
    expect(CONFIG).toContain("worker-src 'self' blob:");
    expect(CONFIG).toContain("connect-src 'self' data: blob:");
  });
});
