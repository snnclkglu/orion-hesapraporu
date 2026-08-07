import { describe, expect, it } from "vitest";
import { V5_TEMPLATE } from "@/lib/calc/defaults";
import { buildEquipmentGroups } from "@/lib/excel/equipment";

describe("tambur rulman yatağı ekipman satırı", () => {
  it("SKF SNL/SE yatağını tambur rulmanıyla birlikte listeler", () => {
    const row = buildEquipmentGroups(V5_TEMPLATE)
      .flatMap((group) => group.rows)
      .find((item) => item.kind === "bearing_housing");

    expect(row).toMatchObject({
      kind: "bearing_housing",
      brand: "SKF",
      model: "SE 212",
      qty: 2,
    });
    expect(row?.spec).toContain("22212");
    expect(row?.spec).toContain("105");
  });
});
