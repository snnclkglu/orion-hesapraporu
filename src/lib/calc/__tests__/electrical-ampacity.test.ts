import { describe, expect, it } from "vitest";
import {
  VDE_RAW_AMPACITY_A,
  ambientCorrectionFactor,
  ampacityTrace,
  intermittentCorrectionFactor,
  loadedConductorCorrectionFactor,
} from "@/lib/calc/electrical-ampacity";
import { NEW_WORK_SPECS } from "@/lib/calc/defaults";
import {
  DEFAULT_ELECTRICAL_INPUTS,
  DEFAULT_ELECTRICAL_SELECTIONS,
  computeElectrical,
} from "@/lib/calc/modules/electrical";
import { electricalFestoonDiagram } from "@/lib/diagrams/electricalFestoon";

describe("VDE 0298-4 kullanıcı eki akım taşıma tablosu", () => {
  it("ham tabloyu yerleşim biçimine göre aynen taşır", () => {
    expect(VDE_RAW_AMPACITY_A[70]).toEqual({
      singleOnGround: 250,
      festoonFreeAir: 263,
      multiReel1: 200,
      multiReel2: 153,
      multiReel3: 123,
      multiReel4: 105,
      multiReel5: 85,
      monoReelRound: 200,
      monoReelFlat: 125,
    });
    expect(VDE_RAW_AMPACITY_A[300].festoonFreeAir).toBe(651);
  });

  it("40 °C ortam ve yüklü damar katsayılarını ek tablodan seçer", () => {
    expect(ambientCorrectionFactor(40)).toMatchObject({ factor: 0.89, tableKey: 40, exact: true });
    expect(loadedConductorCorrectionFactor(6)).toMatchObject({ factor: 0.65, tableKey: 7, exact: false });
    expect(loadedConductorCorrectionFactor(41).valid).toBe(false);
  });

  it("kesintili çalışma artışını yalnız görev çevrimi girildiğinde uygular", () => {
    expect(intermittentCorrectionFactor(70)).toMatchObject({ factor: 1, tableKey: 100 });
    expect(intermittentCorrectionFactor(70, 40)).toMatchObject({ factor: 1.38, tableKey: 40, exact: true });
    expect(intermittentCorrectionFactor(70, 50)).toMatchObject({ factor: 1.18, tableKey: 60, exact: false });
  });

  it("ham kapasite ile bütün çarpanları denetlenebilir hesap izinde gösterir", () => {
    const trace = ampacityTrace({
      sectionMm2: 70,
      installationMode: "festoonFreeAir",
      ambientTemperatureC: 40,
      loadedConductors: 3,
      groupingFactor: 0.8,
      projectFactor: 0.95,
      parallelRuns: 2,
    });
    expect(trace.rawAmpacityA).toBe(263);
    expect(trace.correctedAmpacityA).toBeCloseTo(263 * 0.89 * 1 * 0.8 * 0.95 * 1 * 2, 8);
  });

  it("0026 yük örneğinde 0,75 ile akımı azaltmaz ve 40 °C VDE kapasitesini kullanır", () => {
    const result = computeElectrical(
      { ...NEW_WORK_SPECS, ambientTempMaxC: 40 },
      {
        ...DEFAULT_ELECTRICAL_INPUTS,
        lineVoltageV: 380,
        lineVoltageAuto: false,
        powerFactor: 0.85,
        powerFactorAuto: false,
        motorEfficiencyPct: 90,
        motorEfficiencyAuto: false,
        mainCableAuto: false,
      },
      {
        ...DEFAULT_ELECTRICAL_SELECTIONS,
        mainCable: { articleNo: "UNTEL-JZ600-4G70", parallelRuns: 1 },
      },
      {
        motors: [
          { key: "main", label: "Ana Kaldırma", motorPowerKw: 75, motorCount: 1 },
          { key: "trolley", label: "Ana Araba Yürütme", motorPowerKw: 5.5, motorCount: 2 },
          { key: "bridge", label: "Köprü Yürütme", motorPowerKw: 5.5, motorCount: 4 },
        ],
      },
    );
    expect(result.values.settings.mainDemandFactor).toBe(1);
    expect(result.values.mainCable.designCurrentA).toBeCloseTo(214.495, 2);
    expect(result.values.mainCable.ampacityTrace.rawAmpacityA).toBe(250);
    expect(result.values.mainCable.ampacityA).toBeCloseTo(222.5, 6);
  });

  it("seçili motorun katalog anma akımını genel %90 varsayımından önce kullanır", () => {
    const result = computeElectrical(
      NEW_WORK_SPECS,
      DEFAULT_ELECTRICAL_INPUTS,
      DEFAULT_ELECTRICAL_SELECTIONS,
      { motors: [{
        key: "main",
        label: "Ana Kaldırma",
        motorPowerKw: 75,
        motorCount: 1,
        ratedCurrentA: 141.2,
        efficiencyPct: 95.1,
        powerFactor: 0.88,
        catalogSource: "Örnek Motor M75",
      }] },
    );
    expect(result.values.drives[0]).toMatchObject({
      designCurrentA: 141.2,
      currentSource: "catalogNameplate",
      resolvedEfficiencyPct: 95.1,
      resolvedPowerFactor: 0.88,
    });
  });

  it("tek şemada yan görünüş ve dinamik çift kat A-A kesiti üretir", () => {
    const inputs = { ...DEFAULT_ELECTRICAL_INPUTS, rowCount: 2 as const, rowCountAuto: false };
    const result = computeElectrical(
      NEW_WORK_SPECS,
      inputs,
      DEFAULT_ELECTRICAL_SELECTIONS,
      { motors: [{ key: "main", label: "Ana Kaldırma", motorPowerKw: 4, motorCount: 2 }] },
    );
    const diagram = electricalFestoonDiagram(inputs, result.values.festoon);
    const text = diagram.els.flatMap((el) => el.kind === "text" ? [el.text] : []).join(" ");
    expect(text).toContain("YAN GÖRÜNÜŞ");
    expect(text).toContain("A-A KESİTİ · ÇİFT KAT");
    expect(diagram.els.filter((el) => el.kind === "rect" && el.fill === "#C9C5C2" && el.y >= 133)).toHaveLength(2);
  });
});
