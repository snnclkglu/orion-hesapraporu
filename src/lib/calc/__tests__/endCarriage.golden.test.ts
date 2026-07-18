// Golden test: başkiriş motoru, Excel V5 "09-BAŞKİRİŞ" sayfasının SAĞLAM
// formül hücreleriyle karşılaştırılır. Excel'in bozuk yorulma bloğu
// (aşağıdaki EXCLUDE listesi) hariç tutulur; motor bu bloğu 07-ANA KİRİŞ'in
// çalışan DIN 15018 mantığıyla yeniden hesaplar (bkz. endCarriage.ts).

import { describe, expect, it } from "vitest";
import { V5_SPECS } from "../defaults";
import {
  V5_ENDCARRIAGE_DEPS,
  V5_ENDCARRIAGE_INPUTS,
  V5_ENDCARRIAGE_SELECTIONS,
} from "../defaults/structural";
import { computeEndCarriage } from "../modules/endCarriage";
import { compareCell, isDecorative, loadFormulaCells } from "./golden";

/** Karşılaştırma dışı hücreler (sebepli).
 * Not: Bu hücrelerin dökümdeki VALUE'ları zaten "#" ile başladığından
 * genel skip kuralına da takılırlar; sebep belgelemek için listelenmiştir. */
const EXCLUDE: Record<string, string> = {
  L70: "Bozuk formül: `#ref!` içeren HLOOKUP (VALUE=#NAME?)",
  L71: "L70'e bağlı (VALUE=#NAME?)",
  L73: "L71'e bağlı (VALUE=#NAME?)",
  L85: "Bozuk L73 + ArrayFormula artığı L82'ye bağlı (VALUE=#VALUE!)",
  L88: "L85'e bağlı (VALUE=#VALUE!)",
  N88: "L88'e bağlı kontrol hücresi (VALUE=#VALUE!)",
  L93: "Bozuk formül: `#ref!` içeren HLOOKUP (VALUE=#NAME?)",
  L94: "L93'e bağlı; ayrıca hatalı birim dönüşümü ·9,81 (VALUE=#NAME?)",
  L96: "L94'e bağlı (VALUE=#NAME?)",
  L99: "L96'ya bağlı (VALUE=#NAME?)",
  N99: "L99'a bağlı kontrol hücresi (VALUE=#NAME?)",
  I104: "L88/L99'a bağlı (VALUE=#VALUE!)",
  N104: "I104'e bağlı kontrol hücresi (VALUE=#VALUE!)",
};

describe("endCarriage golden — Excel V5", () => {
  it("09-BAŞKİRİŞ sayfasının tüm sağlam formül hücreleriyle eşleşir", () => {
    const result = computeEndCarriage(
      V5_SPECS,
      V5_ENDCARRIAGE_INPUTS,
      V5_ENDCARRIAGE_SELECTIONS,
      V5_ENDCARRIAGE_DEPS
    );
    const dumpCells = loadFormulaCells("10_09_BAŞKİRİŞ.txt")
      .filter((c) => !isDecorative(c))
      .filter((c) => !(typeof c.value === "string" && (c.value.startsWith("#") || c.value === "None")))
      .filter((c) => !(c.cell in EXCLUDE));
    expect(dumpCells.length).toBeGreaterThan(20);

    const failures: string[] = [];
    for (const dc of dumpCells) {
      const { ok, message } = compareCell(dc.value, result.cells[dc.cell]);
      if (!ok) failures.push(`${dc.cell}: ${message}  [${dc.formula}]`);
    }
    expect(failures, failures.join("\n")).toEqual([]);

    // Bozuk Excel adresleri cells'e bilinçli olarak konmaz.
    for (const cell of Object.keys(EXCLUDE)) {
      expect(result.cells[cell], `${cell} cells'e konmamalı`).toBeUndefined();
    }

    // Excel'deki durum: statik kontrol geçer (P47 = "ü").
    expect(result.cells.P47).toBe("ü");
    // Yeniden yazılan yorulma kontrolleri V5 değerleriyle geçer.
    expect(result.checks.every((c) => c.pass)).toBe(true);
  });
});
