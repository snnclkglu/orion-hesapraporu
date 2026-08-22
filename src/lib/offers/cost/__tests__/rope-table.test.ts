// HALAT TABLOSU KATALOGLA AYRIŞMASIN — kural iki yerde yaşıyor (değişmez md. 8).
//
// `params.ts`teki `ROPE_TABLE`, üretici kataloğunun (`cat_products`, kind
// `rope`) HASÇELİK 6x36 WS · IWRC · 1960 N/mm² satırlarının kopyasıdır.
// Kopyalanmasının gerekçesi orada yazılı: maliyet çalışması bir SNAPSHOT'tır
// ve çekirdek SAFTIR, veritabanına bakamaz.
//
// Bedeli, aynı sayıların iki yerde yaşamasıdır. Bu test o boşluğu kapatır:
// tohum SQL'ini OKUR ve gömülü tablonun her satırını orada arar. Katalog
// düzeltilirse (ya da gömülü tablo elle değiştirilirse) burada konuşur.
//
// SQL'İ OKUMAK BİLİNÇLİDİR: `terms.test.ts`in deseni. Beklenen değerleri bu
// dosyaya yazmak, üçüncü bir kopya üretmekten başka bir şey yapmazdı.

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ROPE_TABLE } from "../params";

const SEED = path.join(process.cwd(), "supabase/migrations/20260719000005_catalog_seed.sql");

interface KatalogHalati {
  diaMm: number;
  breakingKn: number;
  kgPerM: number;
}

/** Tohumdaki HASÇELİK 6x36 WS · IWRC · 1960 satırları. */
function katalogHalatlari(): KatalogHalati[] {
  const sql = readFileSync(SEED, "utf8");
  const out: KatalogHalati[] = [];
  const kalip = /\('rope',\s*'([^']*)',\s*'[^']*',\s*'(\{.*?\})'::jsonb/g;
  for (const m of sql.matchAll(kalip)) {
    const marka = m[1];
    const a = JSON.parse(m[2]) as Record<string, unknown>;
    if (!marka.startsWith("Ha")) continue;
    if (a.construction !== "6x36 WS" || a.grade_mpa !== 1960 || a.core !== "IWRC") continue;
    out.push({
      diaMm: Number(a.dia_mm),
      breakingKn: Number(a.breaking_load_kn),
      kgPerM: Number(a.weight_kg_per_m),
    });
  }
  return out.sort((a, b) => a.diaMm - b.diaMm);
}

describe("ROPE_TABLE ile üretici kataloğu ayrışmaz", () => {
  const katalog = katalogHalatlari();

  it("tohumda gerçekten bu seri var (fikstür bozulmamış)", () => {
    expect(katalog.length).toBeGreaterThan(40);
  });

  it("gömülü tablonun HER satırı katalogda AYNI sayılarla vardır", () => {
    for (const r of ROPE_TABLE) {
      const k = katalog.find((x) => x.diaMm === r.diaMm);
      expect(k, `Ø${r.diaMm} katalogda yok`).toBeDefined();
      expect(k!.breakingKn, `Ø${r.diaMm} kopma yükü`).toBe(r.breakingKn);
      expect(k!.kgPerM, `Ø${r.diaMm} metre ağırlığı`).toBe(r.kgPerM);
    }
  });

  it("çaplar ARTAN sırada ve kopma yükü de artıyor — `firstAtLeast` buna dayanır", () => {
    for (let i = 1; i < ROPE_TABLE.length; i += 1) {
      expect(ROPE_TABLE[i].diaMm).toBeGreaterThan(ROPE_TABLE[i - 1].diaMm);
      expect(ROPE_TABLE[i].breakingKn).toBeGreaterThan(ROPE_TABLE[i - 1].breakingKn);
    }
  });

  it("Ø58 BİLEREK DIŞARIDADIR: katalog satırında kN ve kg/m takas olmuş", () => {
    // Bu bir "eksik" değil bir KARARDIR ve kaydı burada durur. Katalog
    // düzeltildiğinde test düşer ve satır tabloya alınır.
    const bozuk = katalog.find((x) => x.diaMm === 58);
    expect(bozuk).toBeDefined();
    expect(bozuk!.breakingKn).toBeLessThan(bozuk!.kgPerM);
    expect(ROPE_TABLE.some((r) => r.diaMm === 58)).toBe(false);
  });

  it("kullanıcının örneği tutuyor: 100 kN ihtiyaçta Ø12 önerilir", () => {
    // Kullanıcı isteği (22.08.2026, md. 6): *"örneğin halat 100 kN ihtiyaç
    // çıktı, bir üst en yakın halatı seçip çapını önerecek."*
    const ilk = ROPE_TABLE.find((r) => r.breakingKn >= 100);
    expect(ilk?.diaMm).toBe(12);
    expect(ilk?.breakingKn).toBe(100.5);
  });
});
