import { describe, expect, it } from "vitest";
import { V5_TEMPLATE } from "@/lib/calc/defaults";
import { buildEquipmentGroups } from "@/lib/excel/equipment";

describe("tambur rulmanı ve yatağı ekipman satırları", () => {
  it("SKF SNL/SE yatağını tambur rulmanıyla birlikte listeler", () => {
    const row = buildEquipmentGroups(V5_TEMPLATE)
      .flatMap((group) => group.rows)
      .find((item) => item.kind === "bearing_housing");

    expect(row).toMatchObject({
      kind: "bearing_housing",
      brand: "SKF",
      model: "SE 212",
      qty: 1,
    });
    expect(row?.spec).toContain("22212");
    expect(row?.spec).toContain("105");
  });

  it("standart tamburda 1'er, çift tamburda 2'şer adet verir", () => {
    const standard = structuredClone(V5_TEMPLATE);
    const doubleDrum = structuredClone(V5_TEMPLATE);
    doubleDrum.specs = {
      ...doubleDrum.specs,
      mainHoistEquipmentArrangement: "doubleDrum",
    };

    for (const rowKey of ["main:drumBearing", "main:drumBearingHousing"]) {
      const standardRow = buildEquipmentGroups(standard)
        .flatMap((group) => group.rows)
        .find((item) => item.rowKey === rowKey);
      const doubleDrumRow = buildEquipmentGroups(doubleDrum)
        .flatMap((group) => group.rows)
        .find((item) => item.rowKey === rowKey);

      expect(standardRow?.qty, rowKey).toBe(1);
      expect(doubleDrumRow?.qty, rowKey).toBe(2);
    }
  });
});
