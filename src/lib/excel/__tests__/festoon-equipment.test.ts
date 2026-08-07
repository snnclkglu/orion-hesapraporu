import { describe, expect, it } from "vitest";
import { V5_TEMPLATE } from "@/lib/calc/defaults";
import { buildEquipmentGroups } from "@/lib/excel/equipment";

describe("festoon ekipman listesi", () => {
  it("seçilmiş ana araba ve köprü festoonunu ayrı ekipman gruplarına ekler", () => {
    const input = {
      ...V5_TEMPLATE,
      specs: {
        ...V5_TEMPLATE.specs,
        trolleyPowerSupply: "festoon" as const,
        trolleyFestoon: {
          series: "0320" as const,
          cableForm: "flat" as const,
          trolleyCount: 4,
          cablePackageWeightKg: 160,
        },
        bridgePowerSupply: "festoon" as const,
        runwayLengthM: 80,
        bridgeFestoon: {
          series: "auto" as const,
          cableForm: "round" as const,
          trolleyCount: 2,
          cablePackageWeightKg: 200,
        },
      },
    };

    const groups = buildEquipmentGroups(input);
    const trolley = groups.find((group) => group.name === "Ana Araba Enerji Besleme");
    const bridge = groups.find((group) => group.name === "Köprü Enerji Besleme");

    expect(trolley?.rows[0]).toMatchObject({
      brand: "Conductix-Wampfler",
      model: "0320 · M-Line",
      qty: 4,
    });
    expect(bridge?.rows[0]).toMatchObject({ model: "0325 · M-Line", qty: 2 });
  });
});
