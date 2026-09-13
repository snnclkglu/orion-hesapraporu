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

  it("vinç yolu ve köprü üstü araba rayını ayrı ve açık adlarla gösterir", () => {
    const rails = sections.find((section) => section.name === "Raylar");
    expect(rails?.rows.map((row) => row.label)).toEqual(expect.arrayContaining([
      "Vinç rayı · köprü yürütme",
      "Köprü rayı · ana araba",
    ]));
  });

  it("tambur mili ölçüleriyle şemasını aynı, birlikte tutulacak bölümde taşır", () => {
    const shaft = sections.find((section) => section.name === "Tambur Mili · Ana Kaldırma");
    expect(shaft?.diagram).toBeDefined();
    expect(shaft?.keepTogether).toBe(true);
    expect(shaft?.rows.some((row) => row.label.startsWith("Mil ölçüsü A"))).toBe(true);
    expect(shaft?.rows.some((row) => row.label.startsWith("Mil ölçüsü G"))).toBe(true);
  });

  it("ana kaldırma redüktör yönü sayfasını tork, ağırlık ve mil bilgileriyle doldurur", () => {
    const input = structuredClone(NEW_WORK_TEMPLATE);
    input.mainHoist!.selections.gearboxShaftDirection = "R2";
    const directionalSections = buildSummarySections(input, runCalc(input));
    const gearbox = directionalSections.find(
      (section) => section.name === "Redüktör Mil Yönleri · Ana Kaldırma"
    );
    const labels = gearbox?.rows.map((row) => row.label) ?? [];
    expect(labels).toEqual(expect.arrayContaining([
      "Gerekli tork",
      "Ağırlık",
      "Giriş mili",
      "Çıkış mili",
    ]));
  });
});

import type { DrawingPlanRow } from "@/lib/drawing-plan";

describe("teknik resim çıktı sırası", () => {
  it("notlardan sonra montaj sırasını ve baştaki sıfırları korur; gizlenen satırı basmaz", () => {
    const make = (id: string, code: string, parentId: string | null, sortOrder: number): DrawingPlanRow => ({ id, code, parentId, sortOrder, name: id, status: "bekliyor", drawnBy: null, drawnByName: "", note: "" });
    const rows = [make("ANA ARABA", "1500", null, 1), make("KÖPRÜ", "0100", null, 0), make("KANCA", "2300", "ANA ARABA", 0), { ...make("GİZLİ", "0400", null, 2), suppressed: true }];
    const sections = buildSummarySections(NEW_WORK_TEMPLATE, runCalc(NEW_WORK_TEMPLATE), { itemNo: "0045-00", rows }, "MONTAJ NOTU");
    expect(sections.at(-2)?.name).toBe("Notlar");
    expect(sections.at(-1)?.name).toBe("Teknik Resim Numaralandırması");
    expect(sections.at(-1)?.rows.map(r => r.value)).toEqual(["0045-00-0100", "0045-00-1500", "0045-00-2300"]);
    expect(sections.at(-1)?.rows.at(-1)?.label).toContain("KANCA");
  });
});
