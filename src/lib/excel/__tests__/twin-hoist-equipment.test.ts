import { describe, expect, it } from "vitest";
import { NEW_WORK_TEMPLATE } from "@/lib/calc/defaults";
import { SPEC_FIELDS } from "@/lib/calc/fields";
import { runCalc } from "@/lib/calc/engine";
import { hoistEquipmentArrangement } from "@/lib/calc/types";
import { buildEquipmentGroups, buildSummarySections } from "@/lib/excel/equipment";

describe("ikiz kaldırma donanımı", () => {
  it("yeni işte standart donanım seçili gelir ve eski alanı olmayan kayıtları da standart okur", () => {
    expect(NEW_WORK_TEMPLATE.specs.mainHoistEquipmentArrangement).toBe("standard");
    expect(hoistEquipmentArrangement(
      { ...NEW_WORK_TEMPLATE.specs, mainHoistEquipmentArrangement: undefined },
      "main"
    )).toBe("standard");

    const field = SPEC_FIELDS.find((item) => item.key === "mainHoistEquipmentArrangement");
    expect(field?.optionLabels?.standard).toBe("Standart Donanım");
    expect(field?.optionLabels?.twin).toBe("İkiz Donanım");
  });

  it("ikiz seçimde yalnız ana kaldırmanın hazır ekipman adetlerini iki katına çıkarır", () => {
    const standard = structuredClone(NEW_WORK_TEMPLATE);
    const twin = structuredClone(NEW_WORK_TEMPLATE);
    twin.specs = { ...twin.specs, mainHoistEquipmentArrangement: "twin" };

    // Hesap ve katalog seçimi tek kaldırma grubu üzerinden aynen kalır.
    expect(runCalc(twin).mainHoist?.values).toEqual(runCalc(standard).mainHoist?.values);

    const standardGroup = buildEquipmentGroups(standard).find((group) => group.name === "Ana Kaldırma");
    const twinGroup = buildEquipmentGroups(twin).find((group) => group.name === "Ana Kaldırma");
    expect(standardGroup?.rows.length).toBeGreaterThan(0);
    expect(twinGroup?.rows).toHaveLength(standardGroup?.rows.length ?? 0);

    for (const row of standardGroup?.rows ?? []) {
      const twinRow = twinGroup?.rows.find((candidate) => candidate.rowKey === row.rowKey);
      expect(twinRow).toBeDefined();
      expect(twinRow?.qty).toBe(typeof row.qty === "number" ? row.qty * 2 : row.qty);
    }

    const summary = buildSummarySections(twin, runCalc(twin));
    const general = summary.find((section) => section.name === "Genel Ölçüler ve Kapasiteler");
    expect(general?.rows).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: "Ana Kaldırma donanımı", value: "İkiz Donanım" }),
    ]));
  });
});
