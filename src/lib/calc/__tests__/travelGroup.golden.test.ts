// Golden testler: yürütme grubu motoru, Excel V5'in hesapladığı TÜM formül
// hücreleriyle birebir karşılaştırılır (araba + köprü yürütme).

import { describe, expect, it } from "vitest";
import { V5_SPECS } from "../defaults";
import {
  V5_BRIDGE_INPUTS,
  V5_BRIDGE_SELECTIONS,
  V5_TRAVEL_DEPS,
  V5_TROLLEY_INPUTS,
  V5_TROLLEY_SELECTIONS,
} from "../defaults/travel";
import { computeTravelGroup } from "../modules/travelGroup";
import { compareCell, isDecorative, loadFormulaCells } from "./golden";

/** Dosya bazlı hariç tutulan hücreler (sebepleriyle) */
const EXCLUDES: Record<string, Record<string, string>> = {
  "06_05_ARABA_YÜRÜTME_GRUBU.txt": {},
  "07_06_KÖPRÜ_YÜRÜTME_GRUBU.txt": {
    // Excel kusuru: =IF(L160>=H156/1000,...) boş H156'ya bakar (doğrusu L156)
    // ve daima "ü" verir. Motor bu hücreyi üretmez; doğru kontrol
    // bridge.gearbox.torque AnyCheck'i olarak eklendi (bkz. AGENTS.md).
    O160: "boş H156 referansı — düzeltilmiş kontrol bridge.gearbox.torque",
  },
};

function runGolden(dumpFile: string, which: "trolley" | "bridge") {
  const result = computeTravelGroup(
    V5_SPECS,
    which,
    which === "trolley" ? V5_TROLLEY_INPUTS : V5_BRIDGE_INPUTS,
    which === "trolley" ? V5_TROLLEY_SELECTIONS : V5_BRIDGE_SELECTIONS,
    V5_TRAVEL_DEPS
  );
  const excludes = EXCLUDES[dumpFile] ?? {};
  const dumpCells = loadFormulaCells(dumpFile)
    .filter((c) => !isDecorative(c))
    .filter((c) => !(c.cell in excludes))
    // Excel hata değerleri (#DIV/0! vb.) veya boş sonuçlar karşılaştırılmaz
    .filter((c) => !(typeof c.value === "string" && (c.value.startsWith("#") || c.value === "None")));
  expect(dumpCells.length).toBeGreaterThan(90);

  const failures: string[] = [];
  for (const dc of dumpCells) {
    const { ok, message } = compareCell(dc.value, result.cells[dc.cell]);
    if (!ok) failures.push(`${dc.cell}: ${message}  [${dc.formula}]`);
  }
  expect(failures, failures.join("\n")).toEqual([]);
  return result;
}

describe("travelGroup golden — Excel V5", () => {
  it("05-ARABA YÜRÜTME GRUBU sayfasının tüm formül hücreleriyle eşleşir", () => {
    const result = runGolden("06_05_ARABA_YÜRÜTME_GRUBU.txt", "trolley");
    // Arabada fren bölümü yoktur
    expect(result.checks.find((c) => c.id === "trolley.brake.torque")).toBeUndefined();
  });

  it("06-KÖPRÜ YÜRÜTME GRUBU sayfasının tüm formül hücreleriyle eşleşir", () => {
    const result = runGolden("07_06_KÖPRÜ_YÜRÜTME_GRUBU.txt", "bridge");
    // Excel V5'te köprü freni seçilmemiştir (6.6): kontrol "û" / pass=false
    const brake = result.checks.find((c) => c.id === "bridge.brake.torque");
    expect(brake?.pass).toBe(false);
    expect(result.cells.R172).toBe("û");
    // Düzeltilmiş redüktör tork kontrolü (Excel'in bozuk O160'ı yerine): 0.82 >= 0.814 kNm
    const torque = result.checks.find((c) => c.id === "bridge.gearbox.torque");
    expect(torque?.pass).toBe(true);
    // Bozuk hücre üretilmemeli
    expect(result.cells.O160).toBeUndefined();
  });
});
