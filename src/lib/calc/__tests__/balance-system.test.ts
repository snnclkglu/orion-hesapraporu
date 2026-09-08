import { describe, expect, it } from "vitest";
import { NEW_WORK_TEMPLATE } from "../defaults";
import { loadCellForLoad } from "../load-cell";
import { computeHoistGroup } from "../modules/hoistGroup";
import { buildEquipmentGroups } from "../../equipment-list";

describe("halat dengeleme sistemi", () => {
  it("ESİT PL/PLI seçimini güncel kod ve A…F ölçüleriyle yapar", () => {
    const pl = loadCellForLoad(19_000, "Esit", "PL");
    const pli = loadCellForLoad(19_000, "Esit", "PLI");

    expect(pl).toMatchObject({
      model: "PL-20",
      productCode: "152-061503500-0004",
      aMm: 265,
      bMm: 10,
      cMm: 10,
      dMm: 10.5,
      eMm: 75,
      fMm: 64.5,
    });
    expect(pli).toMatchObject({
      model: "PLI-20",
      productCode: "152-061503500-0003",
    });
  });

  it("yeni işte rulmanlı başlar; Rulman Yok seçilince kontrolü ve ekipman satırını kaldırır", () => {
    expect(NEW_WORK_TEMPLATE.mainHoist!.inputs.balanceBearingUsage).toBe("bearing");

    const input = structuredClone(NEW_WORK_TEMPLATE);
    input.mainHoist!.inputs.balanceBearingUsage = "none";
    input.mainHoist!.selections.balanceBearingStatC0Kn = 100;

    const result = computeHoistGroup(
      input.specs,
      "main",
      input.mainHoist!.inputs,
      input.mainHoist!.selections
    );
    expect(result.checks.some((check) => check.id === "main.balance.bearing")).toBe(false);

    const rows = buildEquipmentGroups(input).flatMap((group) => group.rows);
    expect(rows.some((row) => row.rowKey === "main:balanceBearing")).toBe(false);
  });

  it("seçilen loadpin kodunu ve ölçülerini ekipman listesine taşır", () => {
    const input = structuredClone(NEW_WORK_TEMPLATE);
    input.mainHoist!.selections.balanceLoadcellSeries = "PLI";
    const row = buildEquipmentGroups(input)
      .flatMap((group) => group.rows)
      .find((item) => item.rowKey === "main:balanceLoadcell");

    expect(row?.model).toMatch(/^PLI-/);
    expect(row?.spec).toContain("Ürün Kodu 152-");
    expect(row?.spec).toMatch(/A \d/);
    expect(row?.spec).toContain("· F ");
  });
});
