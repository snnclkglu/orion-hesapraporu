import { describe, expect, it } from "vitest";
import { NEW_WORK_TEMPLATE } from "../defaults";
import { cabinDepsFrom, runCalc, type CalcInput } from "../engine";
import {
  ROOM_PANEL_BASE_HEIGHT_MM,
  cabinInputsForDisplay,
  roomPanelLayout,
  roomPanelWidths,
} from "../modules/cabin";
import { CABIN_SECTIONS, type CabinCtx } from "../presentation/cabinSections";

function roomInput(): CalcInput {
  return {
    ...NEW_WORK_TEMPLATE,
    specs: {
      ...NEW_WORK_TEMPLATE.specs,
      electricalAccommodationType: "room",
      electricalRoomHasAirConditioner: "yes",
      ambientTempMaxC: 45,
    },
    cabin: {
      inputs: {
        ...NEW_WORK_TEMPLATE.cabin!.inputs,
        roomWidthM: 2.6,
        roomLengthM: 3,
        roomHeightM: 2.8,
        roomDoorWidthMm: 800,
        roomDoorHeightMm: 2000,
        panelCount: 3,
        roomPanelWidthsText: "400; 600; 1000",
        roomPanelHeightMm: 1800,
        roomPanelDepthMm: 600,
        roomDeviceHeatKw: 0,
        roomDeviceHeatAuto: true,
      },
      selections: {
        ...NEW_WORK_TEMPLATE.cabin!.selections,
        roomAcBrand: "TMS",
        roomAcModel: "WMU",
        roomAcCoolingKwMax: 20,
        roomAcAmbientMaxC: 60,
      },
    },
  };
}

describe("elektrik odası pano yerleşimi", () => {
  it("pano adedi kadar eni korur; yeni satırı 800 mm standartla tamamlar", () => {
    expect(roomPanelWidths("400; 600", 4)).toEqual([400, 600, 800, 800]);
  });

  it("baza, toplam dizi ve pano önü yürüme mesafesini hesaplar", () => {
    const layout = roomPanelLayout(roomInput().cabin!.inputs);
    expect(layout.widthsMm).toEqual([400, 600, 1000]);
    expect(layout.totalWidthMm).toBe(2000);
    expect(layout.baseHeightMm).toBe(ROOM_PANEL_BASE_HEIGHT_MM);
    expect(layout.overallHeightMm).toBe(2000);
    expect(layout.walkingClearanceMm).toBe(2000);
    expect(layout.doorWidthMm).toBe(800);
    expect(layout.doorHeightMm).toBe(2000);
  });

  it("pano dizisini oda boyu, yüksekliği ve derinliğine karşı kontrol eder", () => {
    const input = roomInput();
    const checks = runCalc(input).cabin!.checks;
    expect(checks.find((c) => c.id === "cabin.room.panelWidthFit")?.pass).toBe(true);
    expect(checks.find((c) => c.id === "cabin.room.panelHeightFit")?.pass).toBe(true);
    expect(checks.find((c) => c.id === "cabin.room.panelDepthFit")?.pass).toBe(true);

    input.cabin = {
      ...input.cabin!,
      inputs: { ...input.cabin!.inputs, roomLengthM: 1.5, roomWidthM: 0.5 },
    };
    const failed = runCalc(input).cabin!.checks;
    expect(failed.find((c) => c.id === "cabin.room.panelWidthFit")?.pass).toBe(false);
    expect(failed.find((c) => c.id === "cabin.room.panelDepthFit")?.pass).toBe(false);
  });
});

describe("otomatik pano kayıp gücü", () => {
  it("aktif motor gruplarını sürücü sınıfı ve atık ısıyla listeler", () => {
    const input = roomInput();
    const deps = cabinDepsFrom(input);
    expect(deps.driveHeatItems.length).toBeGreaterThan(0);
    expect(deps.driveHeatItems.every((item) => item.selectedHeavyDutyKw >= item.motorPowerKw))
      .toBe(true);
    expect(deps.inverterLossKw).toBeGreaterThan(0);
    expect(deps.auxiliaryLossKw).toBeCloseTo(deps.inverterLossKw * 0.8, 8);
    expect(deps.panelHeatKw).toBeCloseTo(
      (deps.inverterLossKw + deps.auxiliaryLossKw) * 0.6,
      8
    );
  });

  it("hesap ve kontroller tablosunda her cihazın seçim yöntemini gösterir", () => {
    const input = roomInput();
    const result = runCalc(input).cabin!;
    const section = CABIN_SECTIONS.find((candidate) => candidate.id === "11.2")!;
    const rows = section.table!.build({
      c: result.cells,
      v: result.values,
      inp: input.cabin!.inputs,
      sel: input.cabin!.selections,
      specs: input.specs,
    } satisfies CabinCtx);

    expect(rows.some((row) => row[0] === "Ana Kaldırma")).toBe(true);
    expect(rows.some((row) => String(row[3]).includes("ACS880-104 · P_Hd"))).toBe(true);
    expect(rows.at(-1)?.[0]).toBe("Otomatik Pano Kayıp Gücü");
    expect(String(rows.at(-1)?.[3])).toContain("0,6 eşzamanlılık");
  });

  it("otomatik kutu ve rapor girdisi kayıt içindeki 0 yerine hesaplanan değeri gösterir", () => {
    const input = roomInput();
    const result = runCalc(input);
    const heat = result.cabin!.cells["drive.panelHeat"] as number;
    expect(heat).toBeGreaterThan(0);
    expect(result.cabin!.values.roomLoad?.deviceHeatKw).toBeCloseTo(heat, 8);

    const shown = cabinInputsForDisplay(input.cabin!.inputs, result.cabin!.cells);
    expect(shown.roomDeviceHeatKw).toBe(Math.round(heat * 1000) / 1000);
    expect(input.cabin!.inputs.roomDeviceHeatKw).toBe(0);
  });

  it("otomatik kutudaki ikili kayan nokta artığını kullanıcıya göstermez", () => {
    const input = roomInput();
    const shown = cabinInputsForDisplay(input.cabin!.inputs, {
      "drive.panelHeat": 1.7280000000000002,
    });
    expect(shown.roomDeviceHeatKw).toBe(1.728);
  });

  it("otomatik kapalıysa mühendisin elle girdiği değeri değiştirmez", () => {
    const input = roomInput();
    input.cabin = {
      ...input.cabin!,
      inputs: {
        ...input.cabin!.inputs,
        roomDeviceHeatAuto: false,
        roomDeviceHeatKw: 4.25,
      },
    };
    const result = runCalc(input);
    const shown = cabinInputsForDisplay(input.cabin!.inputs, result.cabin!.cells);
    expect(shown.roomDeviceHeatKw).toBe(4.25);
    expect(result.cabin!.values.roomLoad?.deviceHeatKw).toBe(4.25);
  });
});
