// Golden test: buruşma kontrolü motoru, Excel V5 "08-BURUŞMA KONTROLÜ"
// sayfasının hesapladığı TÜM sağlam formül hücreleriyle karşılaştırılır.

import { describe, expect, it } from "vitest";
import { V5_BUCKLING_INPUTS } from "../defaults/structural";
import { computeBuckling } from "../modules/buckling";
import { compareCell, isDecorative, loadFormulaCells } from "./golden";

/** Karşılaştırma dışı hücreler (sebepli) — 08 sayfasında yok */
const EXCLUDE: Record<string, string> = {};

describe("buckling golden — Excel V5", () => {
  it("08-BURUŞMA KONTROLÜ sayfasının tüm sağlam formül hücreleriyle eşleşir", () => {
    const result = computeBuckling(V5_BUCKLING_INPUTS);
    const dumpCells = loadFormulaCells("09_08_BURUŞMA_KONTROLÜ.txt")
      .filter((c) => !isDecorative(c))
      .filter((c) => !(typeof c.value === "string" && (c.value.startsWith("#") || c.value === "None")))
      .filter((c) => !(c.cell in EXCLUDE));
    expect(dumpCells.length).toBeGreaterThan(25);

    const failures: string[] = [];
    for (const dc of dumpCells) {
      const { ok, message } = compareCell(dc.value, result.cells[dc.cell]);
      if (!ok) failures.push(`${dc.cell}: ${message}  [${dc.formula}]`);
    }
    expect(failures, failures.join("\n")).toEqual([]);

    // Excel'deki durum: her iki panel de buruşma açısından emniyetlidir.
    expect(result.checks.every((c) => c.pass)).toBe(true);
  });
});
