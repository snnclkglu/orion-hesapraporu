// Denge rulmanı katalog süzgeci — KİLİTLİ SERİ ADLARI GERÇEKTEN VAR MI?
//
// Kural iki yerde yaşıyor: seri adı `catalog_data/bearings/skf.json`ta üretilir
// ve `catalog-mapping.ts`teki kilitli süzgeçte tekrar yazılır. Bir harf sapması
// hiçbir yerde hata üretmez — katalog seçici sessizce "kayıt yok" der ve
// mühendis rulmanı seçemez. Bu test AYRIŞMAYI kaynak dosyayı okuyarak
// engeller (`terms.test.ts` deseni): karşılaştırma, seed migration'ının
// gerçekten bastığı `attrs.type` değerlerine karşıdır.

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getCatalogMapping } from "@/lib/catalog-mapping";

const MIGRATION = path.resolve(
  process.cwd(),
  "supabase/migrations/20260824000009_bearing_na_nnf_reseed.sql"
);

/** Seed migration'ının bastığı bütün rulman seri adları (`attrs.type`). */
function seededSeries(): Set<string> {
  const sql = readFileSync(MIGRATION, "utf8");
  const out = new Set<string>();
  for (const m of sql.matchAll(/"type":"([^"]+)"/g)) out.add(m[1]);
  return out;
}

describe("denge rulmanı katalog eşlemesi", () => {
  it("denge traversi ve denge makarası AYNI eşlemeyi paylaşır", () => {
    // İki bölüm de aynı NA/NNF rulmanı taşır; ayrı eşleme yazmak birinde
    // güncellenip ötekinde eskimenin en kısa yoludur.
    const beam = getCatalogMapping("main", "2.9");
    const sheave = getCatalogMapping("main", "2.10");
    expect(beam).toBeDefined();
    expect(sheave).toBe(beam);
  });

  it("bütün kaldırma grupları denge rulmanını katalogdan seçebilir", () => {
    for (const key of ["main", "aux", "mono1", "mono2"]) {
      expect(getCatalogMapping(key, "2.9"), key).toBeDefined();
      expect(getCatalogMapping(key, "2.10"), key).toBeDefined();
    }
  });

  it("süzgeç NA/NNF serilerine kilitlidir", () => {
    const mapping = getCatalogMapping("main", "2.9");
    const locked = mapping?.lockedFacets?.type;
    expect(Array.isArray(locked)).toBe(true);
    const series = locked as string[];
    expect(series.length).toBeGreaterThan(0);
    // Kilit yalnız NA ve NNF ailelerini geçirir: küresel makaralı bir tambur
    // rulmanı bu kutuya seçilemez.
    for (const s of series) expect(s).toMatch(/^(NA|NNF) /);
  });

  it("kilitli seri adlarının hepsi seed migration'ında GERÇEKTEN vardır", () => {
    const series = getCatalogMapping("main", "2.9")?.lockedFacets?.type as string[];
    const seeded = seededSeries();
    const eksik = series.filter((s) => !seeded.has(s));
    expect(
      eksik,
      "Kilitli süzgeçteki seri adı katalogda yok — seçici boş liste gösterir " +
        `ve hata vermez:\n${eksik.join("\n")}`
    ).toEqual([]);
  });

  it("seed migration'ı NA ve NNF ailelerinin ikisini de taşır", () => {
    const seeded = [...seededSeries()];
    expect(seeded.some((s) => s.startsWith("NA 49"))).toBe(true);
    expect(seeded.some((s) => s.startsWith("NA 69"))).toBe(true);
    expect(seeded.some((s) => s.startsWith("NNF 50"))).toBe(true);
  });

  it("eşleme rulmanın tipini, kodunu ve iki yük sayısını doldurur", () => {
    const fields = getCatalogMapping("main", "2.10")?.fields ?? [];
    const targets = fields.map((f) => f.sel);
    expect(targets).toEqual([
      "balanceBearingType",
      "balanceBearingCode",
      "balanceBearingDynCKn",
      "balanceBearingStatC0Kn",
    ]);
  });
});
