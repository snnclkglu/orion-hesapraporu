import { describe, expect, it } from "vitest";
import { NEW_WORK_TEMPLATE } from "@/lib/calc/defaults";
import { runCalc } from "@/lib/calc/engine";
import { buildSummarySections, summaryRowValue } from "@/lib/excel/equipment";

describe("Teknik Ressam Özeti", () => {
  const sections = buildSummarySections(NEW_WORK_TEMPLATE, runCalc(NEW_WORK_TEMPLATE));

  it("çap ölçülerini üç çıktı için ortak Ø biçimiyle işaretler", () => {
    const row = sections.flatMap((section) => section.rows)
      .find((item) => item.label === "Tambur çapı D");
    expect(row?.diameter).toBe(true);
    expect(row && summaryRowValue(row)).toMatch(/^Ø/);
  });

  it("makara kapak düzeni ile koşullu keçe bilgisini ressama taşır", () => {
    const hook = sections.find((section) => section.name === "Ana Kanca Bloğu");
    expect(hook?.rows.find((row) => row.label === "Makara kapak düzeni")?.value)
      .toBe("Kapaklı ve Keçeli");
    expect(hook?.rows.find((row) => row.label === "Keçe tipi")?.value).toBe("KK-T");
    expect(hook?.rows.some((row) => row.label === "Rulman kapak tipi")).toBe(false);
  });
});
