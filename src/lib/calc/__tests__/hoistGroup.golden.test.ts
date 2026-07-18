// Golden testler: kaldırma grubu motoru, Excel V5'in hesapladığı TÜM formül
// hücreleriyle birebir karşılaştırılır (ana + yardımcı kaldırma).

import { describe, expect, it } from "vitest";
import {
  V5_AUX_HOIST_INPUTS,
  V5_AUX_HOIST_SELECTIONS,
  V5_MAIN_HOIST_INPUTS,
  V5_MAIN_HOIST_SELECTIONS,
  V5_SPECS,
} from "../defaults";
import { computeHoistGroup } from "../modules/hoistGroup";
import { compareCell, isDecorative, loadFormulaCells } from "./golden";

function runGolden(dumpFile: string, which: "main" | "aux") {
  const result = computeHoistGroup(
    V5_SPECS,
    which,
    which === "main" ? V5_MAIN_HOIST_INPUTS : V5_AUX_HOIST_INPUTS,
    which === "main" ? V5_MAIN_HOIST_SELECTIONS : V5_AUX_HOIST_SELECTIONS
  );
  const dumpCells = loadFormulaCells(dumpFile).filter((c) => !isDecorative(c));
  expect(dumpCells.length).toBeGreaterThan(100);

  const failures: string[] = [];
  for (const dc of dumpCells) {
    const { ok, message } = compareCell(dc.value, result.cells[dc.cell]);
    if (!ok) failures.push(`${dc.cell}: ${message}  [${dc.formula}]`);
  }
  expect(failures, failures.join("\n")).toEqual([]);
  return result;
}

describe("hoistGroup golden — Excel V5", () => {
  it("02-ANA KALDIRMA GRUBU sayfasının tüm formül hücreleriyle eşleşir", () => {
    const result = runGolden("03_02_ANA_KALDIRMA_GRUBU.txt", "main");
    // Excel'deki bilinen durum: redüktör tork kontrolü V5'te başarısız (22 < 22.07 kNm)
    const gearboxCheck = result.checks.find((c) => c.id === "main.gearbox.torque");
    expect(gearboxCheck?.pass).toBe(false);
  });

  it("03-YRD KALDIRMA GRUBU sayfasının tüm formül hücreleriyle eşleşir", () => {
    runGolden("04_03_YRD_KALDIRMA_GRUBU.txt", "aux");
  });
});
