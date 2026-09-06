// PALET ÜÇ DURAKTA BİRDEN YAŞIYOR — ayrışmayı bu test engeller (değişmez md. 8).
//
//   1. `lib/diagrams/panoLayout.ts`      — baskı hex'i (PDF bunu basar)
//   2. `components/diagrams/diagram-svg.tsx` — `THEME_PAINT` eşlemesi (web)
//   3. `app/globals.css`                 — açık ve koyu tema değişkenleri
//
// Biri eksikse hata SESSİZDİR: `THEME_PAINT[hex] ?? paint` kaydedilmemiş bir
// hex'i ham geçirir ve koyu temada açık pastel kalır. `climateRoom.ts`in
// `#F2C94C`/`#E2A05A` renkleri bugün tam olarak bunu yapıyor; bu şemada
// aynısının olmaması için kural teste bağlandı.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PANO_RENK } from "../panoLayout";
import { diagramWebPaint } from "@/components/diagrams/diagram-svg";

// `process.cwd()` kullanılır, `import.meta.url` değil: çalışma alanı yolunda
// boşluk var ve URL biçimi onu `%20` yapıyor (`agent-docs/split.ts` deseni).
const globalsCss = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

describe("pano paleti", () => {
  it("dokuz grubun hepsi ayrı bir renk taşır", () => {
    const renkler = Object.values(PANO_RENK);
    expect(new Set(renkler).size).toBe(renkler.length);
  });

  it("her renk THEME_PAINT'te kayıtlıdır — koyu temada ham geçmez", () => {
    for (const [grup, hex] of Object.entries(PANO_RENK)) {
      const web = diagramWebPaint(hex, true);
      expect(web, `${grup} (${hex}) THEME_PAINT'te yok`).toMatch(/^var\(--oc-diagram-kat-/);
    }
  });

  it("her değişken globals.css'te AÇIK ve KOYU tema için tanımlıdır", () => {
    for (const grup of Object.keys(PANO_RENK)) {
      const ad = `--oc-diagram-kat-${grup}`;
      const kacKez = globalsCss.split(`${ad}:`).length - 1;
      expect(kacKez, `${ad} iki tema bloğunda da olmalı`).toBe(2);
    }
  });

  it("açık temadaki değer BASKI hex'inin aynısıdır", () => {
    // Ekranda görünen ile kâğıda basılan aynı renk olmalıdır; ayrıştığında
    // kullanıcı ekranda onayladığından başka bir belge indirir.
    for (const [grup, hex] of Object.entries(PANO_RENK)) {
      const desen = new RegExp(`--oc-diagram-kat-${grup}:\\s*${hex.toLowerCase()};`);
      expect(desen.test(globalsCss), `${grup} açık tema değeri ${hex} değil`).toBe(true);
    }
  });

  it("themeAware kapalıyken baskı hex'i olduğu gibi kalır — PDF için", () => {
    for (const hex of Object.values(PANO_RENK)) {
      expect(diagramWebPaint(hex, false)).toBe(hex);
    }
  });
});
