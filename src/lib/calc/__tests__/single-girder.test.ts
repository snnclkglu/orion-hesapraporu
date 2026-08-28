// TEK KİRİŞLİ KÖPRÜ — konfigürasyon, V0 tohumu, yük paylaşımı ve rapor izi.
//
// Tek kirişli düzen yeni bir hesap ailesi değildir: aynı ana kiriş hesabında
// köprü öz ağırlığı ile araba/kaldırma yükü artık ikiye bölünmeden tek kirişe
// gelir. Bu test çift kirişli mevcut davranışın da aynı kaldığını birlikte
// kilitler.

import { describe, expect, it } from "vitest";
import {
  DOUBLE_GIRDER_CRANE_TYPE,
  SINGLE_GIRDER_CRANE_TYPE,
  applyCraneTypeRevisionPreset,
  girderArrangementForCraneType,
} from "@/lib/crane-types";
import { NEW_WORK_SPECS, NEW_WORK_TEMPLATE } from "../defaults";
import { activeModules, runCalc } from "../engine";
import { SPEC_FIELDS } from "../fields";
import { GIRDER_SECTIONS } from "../presentation/girderSections";
import {
  GIRDER_ARRANGEMENTS,
  girderArrangement,
  girdersInBridge,
  liveLoadGirderCount,
  type GirderArrangement,
} from "../types";
import { skewPlanDiagram } from "@/lib/diagrams/wheelLoads";

const resultFor = (arrangement: GirderArrangement) =>
  runCalc({
    ...NEW_WORK_TEMPLATE,
    specs: { ...NEW_WORK_SPECS, girderArrangement: arrangement },
  });

const cell = (
  result: ReturnType<typeof resultFor>,
  key: string
): number => {
  const value = result.girder?.cells[key];
  expect(typeof value, key).toBe("number");
  return value as number;
};

describe("tek kirişli vinç konfigürasyonu", () => {
  it("teknik özellik seçimine tek/çift/dört düzenlerini birlikte sunar", () => {
    expect(GIRDER_ARRANGEMENTS).toEqual(["tek", "iki", "dort"]);

    const field = SPEC_FIELDS.find((item) => item.key === "girderArrangement");
    expect(field?.options).toEqual(GIRDER_ARRANGEMENTS);
    expect(field?.optionLabels).toMatchObject({
      tek: "Tek Kirişli",
      iki: "Çift Kirişli",
      dort: "Dört Kirişli",
    });
  });

  it("eski revizyonu çift kirişli okur; kiriş ve hareketli yük paylarını ayırır", () => {
    expect(girderArrangement({ ...NEW_WORK_SPECS, girderArrangement: undefined })).toBe("iki");
    expect(girdersInBridge({ ...NEW_WORK_SPECS, girderArrangement: "tek" })).toBe(1);
    expect(girdersInBridge({ ...NEW_WORK_SPECS, girderArrangement: "iki" })).toBe(2);
    expect(girdersInBridge({ ...NEW_WORK_SPECS, girderArrangement: "dort" })).toBe(4);
    expect(liveLoadGirderCount({ ...NEW_WORK_SPECS, girderArrangement: "tek" })).toBe(1);
    expect(liveLoadGirderCount({ ...NEW_WORK_SPECS, girderArrangement: "dort" })).toBe(2);
  });

  it("tek ve çift kirişli tipleri yalnız V0 teknik snapshot'ına önerir", () => {
    expect(girderArrangementForCraneType(SINGLE_GIRDER_CRANE_TYPE)).toBe("tek");
    expect(girderArrangementForCraneType(DOUBLE_GIRDER_CRANE_TYPE)).toBe("iki");

    const inherited = {
      specs: { ...NEW_WORK_SPECS, girderArrangement: "dort" as const, mainCapacityT: 25 },
      disabledModules: ["cabin"],
      ozelAlan: "korunur",
    };
    const single = applyCraneTypeRevisionPreset(0, SINGLE_GIRDER_CRANE_TYPE, inherited);
    expect((single.specs as typeof inherited.specs).girderArrangement).toBe("tek");
    expect((single.specs as typeof inherited.specs).mainCapacityT).toBe(25);
    expect(single.disabledModules).toEqual(["cabin"]);
    expect(single.ozelAlan).toBe("korunur");

    const double = applyCraneTypeRevisionPreset(0, DOUBLE_GIRDER_CRANE_TYPE, inherited);
    expect((double.specs as typeof inherited.specs).girderArrangement).toBe("iki");
    expect(applyCraneTypeRevisionPreset(1, SINGLE_GIRDER_CRANE_TYPE, inherited)).toBe(inherited);
  });

  it("tek kirişli düzende ikinci ana kiriş bölümü açmaz", () => {
    const active = activeModules(
      { ...NEW_WORK_SPECS, girderArrangement: "tek" },
      []
    );
    expect(active.has("girder")).toBe(true);
    expect(active.has("girder2")).toBe(false);
  });
});

describe("tek kirişli ana kiriş yük paylaşımı", () => {
  const single = resultFor("tek");
  const double = resultFor("iki");
  const four = resultFor("dort");

  it("köprü öz ağırlığının tamamını tek kirişe verir", () => {
    expect(cell(single, "load.girderCount")).toBe(1);
    expect(cell(double, "load.girderCount")).toBe(2);
    expect(cell(four, "load.girderCount")).toBe(4);
    expect(cell(single, "load.bridgeDeadWeight")).toBeCloseTo(
      2 * cell(double, "load.bridgeDeadWeight"),
      10
    );
    expect(cell(four, "load.bridgeDeadWeight")).toBeCloseTo(
      cell(double, "load.bridgeDeadWeight") / 2,
      10
    );
  });

  it("araba ve nominal kaldırma yükünü ikiye bölmeden tek kirişe verir", () => {
    expect(cell(single, "load.liveLoadGirderCount")).toBe(1);
    expect(cell(double, "load.liveLoadGirderCount")).toBe(2);
    expect(cell(four, "load.liveLoadGirderCount")).toBe(2);

    for (const key of [
      "load.trolleyWeightOnGirder",
      "load.hoistLoadOnGirder",
      "load.totalLiveLoadOnGirder",
      "load.trolleyWheelLoad",
      "load.hoistWheelLoad",
    ]) {
      expect(cell(single, key), key).toBeCloseTo(2 * cell(double, key), 10);
      expect(cell(four, key), `${key} dört kiriş`).toBeCloseTo(cell(double, key), 10);
    }
  });

  it("canlı yük sehimini iki katına çıkarır; çift kirişli sonucu değiştirmez", () => {
    expect(cell(single, "deflection.value")).toBeCloseTo(
      2 * cell(double, "deflection.value"),
      10
    );
    expect(cell(four, "deflection.value")).toBeCloseTo(
      cell(double, "deflection.value"),
      10
    );
  });

  it("rapor satırlarında toplam ve bir kirişe düşen yükü ayrı gösterir", () => {
    const loadSection = GIRDER_SECTIONS.find((section) => section.id === "7.2");
    const keys = loadSection?.rows.map((row) => row.key) ?? [];
    expect(keys).toContain("load.liveLoadGirderCount");
    expect(keys).toContain("load.trolleyWeightOnGirder");
    expect(keys).toContain("load.hoistLoadOnGirder");
    expect(keys).toContain("load.totalLiveLoadOnGirder");
  });
});

describe("teker yükleri plan şeması", () => {
  const diagramFor = (girderCount: number) =>
    skewPlanDiagram({
      spanM: 20,
      girderCount,
      wheels: [
        { code: "A1", distanceM: 0, lateralNearN: 100, lateralFarN: 80, longitudinalN: 50 },
        { code: "A2", distanceM: 1, lateralNearN: 90, lateralFarN: 70, longitudinalN: 50 },
        { code: "B1", distanceM: 4, lateralNearN: 70, lateralFarN: 90, longitudinalN: 50 },
        { code: "B2", distanceM: 5, lateralNearN: 80, lateralFarN: 100, longitudinalN: 50 },
      ],
      alphaRad: 0.004,
      poleDistanceM: 2.5,
      mu: 0.5,
      guideForceN: 500,
      guideMeans: "flange",
      applicable: true,
    });

  it("konfigürasyondaki ana kiriş adedini şema etiketine taşır", () => {
    const texts = (count: number) =>
      diagramFor(count).els.flatMap((element) =>
        element.kind === "text" ? [element.text] : []
      );
    expect(texts(1)).toContain("ANA KİRİŞ (1 Adet)");
    expect(texts(2)).toContain("ANA KİRİŞLER (2 Adet)");
    expect(texts(4)).toContain("ANA KİRİŞLER (4 Adet)");
  });
});
