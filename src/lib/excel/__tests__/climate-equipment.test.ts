import { describe, expect, it } from "vitest";
import { NEW_WORK_TEMPLATE } from "@/lib/calc/defaults";
import { buildEquipmentGroups, buildSummarySections } from "@/lib/excel/equipment";
import { runCalc } from "@/lib/calc/engine";
import { SPEC_FIELDS } from "@/lib/calc/fields";

describe("operatör kabini ve elektrik yerleşimi", () => {
  it("kabin ile elektrik odasını klima tipi ve 1+1 yedekle ekipman listesine taşır", () => {
    const input = structuredClone(NEW_WORK_TEMPLATE);
    input.specs = {
      ...input.specs,
      hasOperatorCabin: "yes",
      operatorCabinWidthM: 2.2,
      operatorCabinLengthM: 2.8,
      operatorCabinHeightM: 2.4,
      operatorCabinInsulation: "rockWool50",
      operatorCabinAirConditioning: "heavyIndustrial",
      operatorCabinAirConditionerModel: "VKS-VS",
      electricalAccommodationType: "room",
      electricalRoomWidthM: 3,
      electricalRoomLengthM: 5,
      electricalRoomHeightM: 2.6,
      electricalRoomInsulation: "rockWool100",
      electricalRoomAirConditioning: "industrial",
      electricalRoomAirConditionerModel: "WMU",
      electricalRoomAirConditioningRedundancy: "nPlusOne",
    };

    const group = buildEquipmentGroups(input).find(
      (item) => item.name === "Operatör Kabini ve Elektrik Yerleşimi"
    );
    expect(group?.rows).toEqual(expect.arrayContaining([
      expect.objectContaining({ component: "Operatör Kabini", model: "İzole operatör kabini" }),
      expect.objectContaining({ kind: "air_conditioner", brand: "TMS", model: "VKS-VS", qty: 1 }),
      expect.objectContaining({ kind: "air_conditioner", brand: "TMS", model: "WMU", qty: "2 (1+1)" }),
    ]));
    expect(group?.rows.find((row) => row.model === "WMU")?.spec).toContain("1+1");

    const summary = buildSummarySections(input, runCalc(input));
    expect(summary.map((section) => section.name)).toEqual(expect.arrayContaining([
      "Operatör Kabini", "Elektrik Odası",
    ]));
  });

  it("pano tipinde oda izolasyonu yerine pano IP sınıfını listeler", () => {
    const input = structuredClone(NEW_WORK_TEMPLATE);
    input.specs = {
      ...input.specs,
      electricalAccommodationType: "panel",
      electricalPanelCount: 3,
      electricalPanelIpClass: "IP55",
      electricalPanelAirConditioning: "panel",
      electricalPanelAirConditionerModel: "PKS-PO",
      electricalPanelAirConditioningRedundancy: "nPlusOne",
    };

    const group = buildEquipmentGroups(input).find(
      (item) => item.name === "Operatör Kabini ve Elektrik Yerleşimi"
    );
    const panel = group?.rows.find((row) => row.component === "Elektrik Panosu");
    expect(panel).toMatchObject({ qty: 3 });
    expect(panel?.spec).toContain("IP55");
    expect(panel?.spec).toContain("Oda İzolasyonu Uygulanmaz");
    expect(panel?.spec).not.toContain("Taş Yünü");
    expect(group?.rows).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "air_conditioner", model: "PKS-PO", qty: "2 (1+1)" }),
    ]));
  });

  it("rapora da taşınan alan görünürlüğünde oda ve pano ayrımını korur", () => {
    const panelSpecs = { ...NEW_WORK_TEMPLATE.specs, electricalAccommodationType: "panel" as const };
    const roomSpecs = { ...NEW_WORK_TEMPLATE.specs, electricalAccommodationType: "room" as const };
    const roomInsulation = SPEC_FIELDS.find((field) => field.key === "electricalRoomInsulation");
    const panelIp = SPEC_FIELDS.find((field) => field.key === "electricalPanelIpClass");

    expect(roomInsulation?.visible?.(panelSpecs)).toBe(false);
    expect(roomInsulation?.visible?.(roomSpecs)).toBe(true);
    expect(panelIp?.visible?.(panelSpecs)).toBe(true);
    expect(panelIp?.visible?.(roomSpecs)).toBe(false);
  });
});
