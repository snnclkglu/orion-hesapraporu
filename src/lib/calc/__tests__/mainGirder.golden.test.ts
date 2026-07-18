// Golden test: ana kiriş motoru, Excel V5 "07-ANA KİRİŞ" sayfasının
// hesapladığı TÜM sağlam formül hücreleriyle birebir karşılaştırılır.

import { describe, expect, it } from "vitest";
import { V5_SPECS } from "../defaults";
import {
  V5_GIRDER_DEPS,
  V5_GIRDER_INPUTS,
  V5_GIRDER_SELECTIONS,
} from "../defaults/structural";
import { computeMainGirder } from "../modules/mainGirder";
import { compareCell, isDecorative, loadFormulaCells } from "./golden";

/** Karşılaştırma dışı hücreler (sebepli) — 07 sayfasında yok */
const EXCLUDE: Record<string, string> = {};

describe("mainGirder golden — Excel V5", () => {
  it("07-ANA KİRİŞ sayfasının tüm sağlam formül hücreleriyle eşleşir", () => {
    const result = computeMainGirder(
      V5_SPECS,
      V5_GIRDER_INPUTS,
      V5_GIRDER_SELECTIONS,
      V5_GIRDER_DEPS
    );
    const dumpCells = loadFormulaCells("08_07_ANA_KİRİŞ.txt")
      .filter((c) => !isDecorative(c))
      .filter((c) => !(typeof c.value === "string" && (c.value.startsWith("#") || c.value === "None")))
      .filter((c) => !(c.cell in EXCLUDE));
    expect(dumpCells.length).toBeGreaterThan(150);

    const failures: string[] = [];
    for (const dc of dumpCells) {
      const { ok, message } = compareCell(dc.value, result.cells[dc.cell]);
      if (!ok) failures.push(`${dc.cell}: ${message}  [${dc.formula}]`);
    }
    expect(failures, failures.join("\n")).toEqual([]);

    // Excel'deki durum: tüm yorulma kontrolleri (H422/H428/H433/H435) geçer.
    for (const id of [
      "girder.fatigue.sigmaX",
      "girder.fatigue.sigmaY",
      "girder.fatigue.tau",
      "girder.fatigue.combined",
    ]) {
      expect(result.checks.find((c) => c.id === id)?.pass, id).toBe(true);
    }
  });
});
