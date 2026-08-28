import { describe, expect, it } from "vitest";
import { climateRoomDiagram, type ClimateRoomParams } from "../climateRoom";

const room: ClimateRoomParams = {
  title: "Elektrik Odası",
  widthM: 2.6,
  lengthM: 3,
  heightM: 2.8,
  insulationMm: 50,
  doorCount: 1,
  doorWidthMm: 800,
  doorHeightMm: 2000,
  ambientTempC: 45,
  ambientRhPct: 50,
  roomTempC: 25,
  roomRhPct: 50,
  outdoor: false,
  transmissionKw: 1,
  solarKw: 0,
  radiationKw: 0,
  deviceHeatKw: 1.1,
  occupantKw: 0,
  freshAirKw: 0.3,
  totalKw: 2.8,
  freshAirM3h: 12,
  airFlowM3h: 1100,
  glazingAreaM2: 0,
  occupantCount: 0,
  deviceCount: 3,
  deviceLabel: "Pano",
  panelWidthsMm: [400, 600, 800],
  panelHeightMm: 1800,
  panelDepthMm: 600,
  panelBaseHeightMm: 200,
};

describe("elektrik odası ön ve yan görünüşü", () => {
  it("kapı, pano satırları, baza ve yürüme mesafesini ölçülendirir", () => {
    const diagram = climateRoomDiagram(room);
    const texts = diagram.els
      .filter((element) => element.kind === "text")
      .map((element) => element.text);

    expect(texts).toContain("ÖN GÖRÜNÜŞ");
    expect(texts).toContain("YAN GÖRÜNÜŞ");
    expect(texts).toContain("P1 · 400");
    expect(texts).toContain("P2 · 600");
    expect(texts).toContain("P3 · 800");
    expect(texts.some((text) => text.includes("800 × 2.000 mm"))).toBe(true);
    expect(texts).toContain("Yürüme Mesafesi 2.000 mm");
    expect(diagram.height).toBeGreaterThan(500);
  });
});
