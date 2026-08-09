// Öneri defteri ↔ belge ↔ bulgular — ÜÇ YÖNLÜ tutarlılık.
//
// `standards/registry.ts` + `anchors.guard.test.ts` deseninin aynısı: bir
// defter maddesi karşılıksız kalınca hiçbir test kırılmaz ve madde SESSİZCE
// süse döner. Burada üç kopma noktası var, üçü de sınanır:
//
//   1. Kodda olan bir madde belgede yoksa → rapordaki bağlantı ölü açılır.
//   2. Belgede olan bir madde kodda yoksa → o maddeye hiçbir bulgu bağlanamaz.
//   3. Bir bulgunun `hintId`si defterde yoksa → rozet tıklanınca hiçbir yere
//      gitmez.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { NAMING_HINTS, NAMING_HINT_IDS, namingHint } from "../standard";
import { parseBomFileName, parseFile } from "../file-name";
import { parseFolderName } from "../folder-name";
import { readSheet } from "../excel";
import { reconcile } from "../reconcile";
import type { BomRow } from "../types";
import { MONORAY, MTC, type FixturePackage } from "./fixtures/packages";
import { MONORAY_SHEETS, MTC_SHEETS, type FixtureSheet } from "./fixtures/bom-sheets";

const BELGE = readFileSync(
  join(process.cwd(), "docs", "teknik-resim-adlandirma-onerileri.md"),
  "utf-8"
);

function bulgular(pkg: FixturePackage, sheets: FixtureSheet[]) {
  const files = pkg.files.map((f) => parseFile({ relPath: f.path, size: f.size, checksum: f.hash }));
  const bom: BomRow[] = sheets
    .filter((s) => !s.file.split("/").some((seg) => seg === "İPTAL"))
    .flatMap(
      (s) =>
        readSheet(
          { fileRelPath: s.file, sheetName: s.sheet, rows: s.rows },
          parseBomFileName(s.file.split("/").pop() ?? "").kind
        ).rows
    );
  return reconcile({
    folderName: pkg.folder,
    folder: parseFolderName(pkg.folder).value,
    files,
    bom,
  }).findings;
}

const TUM_BULGULAR = [...bulgular(MONORAY, MONORAY_SHEETS), ...bulgular(MTC, MTC_SHEETS)];

describe("öneri defteri ↔ belge", () => {
  it("koddaki her madde belgede bir başlık olarak geçer", () => {
    const eksik = NAMING_HINTS.filter((h) => !BELGE.includes(`## ${h.id} ·`)).map((h) => h.id);
    expect(eksik).toEqual([]);
  });

  it("belgedeki her madde kodda tanımlıdır", () => {
    const belgedeki = [...BELGE.matchAll(/^## (Ö-\d+) ·/gm)].map((m) => m[1]);
    expect(belgedeki.length).toBeGreaterThan(0);
    expect(belgedeki.filter((id) => !NAMING_HINT_IDS.includes(id))).toEqual([]);
  });

  it("kimlikler tekildir ve sırayla numaralanır", () => {
    expect(new Set(NAMING_HINT_IDS).size).toBe(NAMING_HINT_IDS.length);
    expect(NAMING_HINT_IDS).toEqual(NAMING_HINTS.map((_, i) => `Ö-${i + 1}`));
  });

  it("her maddenin bir KAZANCI yazılıdır", () => {
    // Dil kuralı: madde "şunu kazanırsın" der, "şunu yapmazsan hata alırsın"
    // demez — çünkü hata almazsınız. Boş bir `gain` bu sözü boşa çıkarır.
    expect(NAMING_HINTS.filter((h) => !h.gain.trim())).toEqual([]);
  });
});

describe("bulgular ↔ öneri defteri", () => {
  it("bulguların taşıdığı her hintId defterde tanımlıdır", () => {
    const kullanilan = [...new Set(TUM_BULGULAR.map((f) => f.hintId).filter(Boolean))] as string[];
    expect(kullanilan.length).toBeGreaterThan(0);
    const olmayan = kullanilan.filter((id) => !namingHint(id));
    expect(olmayan).toEqual([]);
  });

  it("belge, önerisi olmayan bulguların da var olabileceğini varsayar", () => {
    // Her bulgunun bir öneriye bağlanması ZORUNLU DEĞİLDİR: "GRUP_BOLUNMUS"
    // gibi salt bilgilendirme satırlarının verilecek bir öğüdü yok. Bu test
    // o boşluğun bilinçli olduğunu belgeler.
    const hintsiz = TUM_BULGULAR.filter((f) => !f.hintId).map((f) => f.code);
    expect(hintsiz.length).toBeGreaterThan(0);
  });
});

describe("belgenin sözü", () => {
  it("hiçbir maddenin yüklemeyi engellediğini söylemez", () => {
    // Modülün temel ilkesi: sistem klasöre biçim dayatmaz. Belge bir gün
    // "zorunludur" diye yazılırsa kod ile söz ayrışır.
    expect(BELGE).toContain("Hiçbir madde bir yüklemeyi engellemez");
  });
});
