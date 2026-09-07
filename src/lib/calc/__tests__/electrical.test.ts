import { describe, expect, it } from "vitest";
import { NEW_WORK_SPECS, NEW_WORK_TEMPLATE } from "@/lib/calc/defaults";
import { activeModules, moduleAllowedByConfig } from "@/lib/calc/engine";
import { buildEquipmentGroups } from "@/lib/equipment-list";
import { loadRevision } from "@/lib/revision-load";
import {
  DEFAULT_ELECTRICAL_INPUTS,
  DEFAULT_ELECTRICAL_SELECTIONS,
  computeElectrical,
  type ElectricalDeps,
} from "@/lib/calc/modules/electrical";
import { ELECTRICAL_CABLE_MODELS, driveModelsFor } from "@/lib/calc/electrical-catalog";

const oneMotor: ElectricalDeps = {
  motors: [{ key: "main", label: "Ana Kaldırma", motorPowerKw: 75, motorCount: 1 }],
};

describe("elektrik hesap raporu", () => {
  it("yalnız teknik özellikte açıldığında aktif olur", () => {
    expect(moduleAllowedByConfig(NEW_WORK_SPECS, "electrical")).toBe(false);
    expect(activeModules(NEW_WORK_SPECS).has("electrical")).toBe(false);

    const specs = { ...NEW_WORK_SPECS, hasElectricalCalculation: "yes" as const };
    expect(moduleAllowedByConfig(specs, "electrical")).toBe(true);
    expect(activeModules(specs).has("electrical")).toBe(true);

    // Bu teknik alan eklenmeden önce KAYDEDİLMİŞ bir revizyon (0026 gibi)
    // bölümü raporun sonunda açık görür. Kullanıcı bundan sonra "Yok" seçerse
    // açık tercih snapshot'ta saklanır ve göç yeniden devreye girmez.
    const legacySpecs = structuredClone(NEW_WORK_SPECS);
    delete (legacySpecs as unknown as Record<string, unknown>).hasElectricalCalculation;
    const legacy = loadRevision({
      specs: legacySpecs,
      mainHoist: NEW_WORK_TEMPLATE.mainHoist?.inputs,
    }, null);
    expect(legacy.full.specs.hasElectricalCalculation).toBe("yes");
    expect(legacy.input.electrical).toBeDefined();

    // Henüz kaydedilmemiş yeni revizyon varsayılan seçimini korur.
    const unsaved = loadRevision({ specs: legacySpecs }, null);
    expect(unsaved.full.specs.hasElectricalCalculation).toBe("no");
    expect(unsaved.input.electrical).toBeUndefined();
  });

  it("0026'da kullanılan ATV930D90N4 seçimini katalog gücü ve akımıyla doğrular", () => {
    expect(driveModelsFor("Schneider Electric", "ATV930")).toHaveLength(23);
    const result = computeElectrical(
      { ...NEW_WORK_SPECS, hasElectricalCalculation: "yes" },
      { ...DEFAULT_ELECTRICAL_INPUTS, lineVoltageV: 400, lineVoltageAuto: false },
      {
        ...DEFAULT_ELECTRICAL_SELECTIONS,
        drives: {
          main: {
            brand: "Schneider Electric",
            series: "ATV930",
            model: "ATV930D90N4",
          },
        },
      },
      oneMotor
    );
    expect(result.values.drives[0].drive?.model).toBe("ATV930D90N4");
    expect(result.values.drives[0].drive?.projectReference).toBe("0026");
    expect(result.checks.find((x) => x.id === "electrical.drive.main.power")?.pass).toBe(true);
    expect(result.checks.find((x) => x.id === "electrical.drive.main.current")?.pass).toBe(true);
  });

  it("motor kablosunda gerçek katalog çapını, ağırlığını ve gerilim düşümünü taşır", () => {
    const result = computeElectrical(
      NEW_WORK_SPECS,
      { ...DEFAULT_ELECTRICAL_INPUTS, defaultMotorCableLengthM: 45 },
      {
        ...DEFAULT_ELECTRICAL_SELECTIONS,
        motorCables: { main: { articleNo: "22971", parallelRuns: 1 } },
      },
      { motors: [{ key: "main", label: "Ana Kaldırma", motorPowerKw: 4, motorCount: 1 }] }
    );
    const cable = result.values.motorCables[0];
    expect(cable.selectedCable).toMatchObject({
      articleNo: "22971",
      family: "TOPFLEX 611-C-PUR",
      widthMm: 13.5,
      weightKgPerM: 0.34,
    });
    expect(cable.voltageDropPct).toBeGreaterThan(0);
    expect(Number.isFinite(cable.voltageDropPct)).toBe(true);
  });

  it("HELUKABEL ve ÜNTEL kataloglarını marka ile yuvarlak/yassı biçimde sunar", () => {
    const combinations = new Set(ELECTRICAL_CABLE_MODELS.map((cable) => `${cable.brand}:${cable.shape}`));
    expect(combinations).toEqual(new Set([
      "HELUKABEL:round", "HELUKABEL:flat", "ÜNTEL:round", "ÜNTEL:flat",
    ]));
    expect(ELECTRICAL_CABLE_MODELS.find((cable) => cable.family === "NGFLCGÖU" && cable.sectionMm2 === 10)).toMatchObject({
      brand: "ÜNTEL", shape: "flat", shielded: true, festoonSuitable: true,
      widthMm: 35.6, heightMm: 11.7, weightKgPerM: 0.952,
    });
  });

  it("gerilim, motor, feston devreleri ve loop yüksekliğini üst bölümlerden otomatik alır", () => {
    const result = computeElectrical(
      { ...NEW_WORK_SPECS, supplyVoltage: "400 VAC, 3 Faz, 50 Hz" },
      DEFAULT_ELECTRICAL_INPUTS,
      DEFAULT_ELECTRICAL_SELECTIONS,
      {
        motors: [
          { key: "main", label: "Ana Kaldırma", motorPowerKw: 11, motorCount: 1 },
          { key: "trolley", label: "Ana Araba Yürütme", motorPowerKw: 3, motorCount: 2 },
        ],
        festoon: { circuitKeys: ["main", "trolley"], loopHeightM: 2.25, trolleyCount: 8, sourceLabel: "Ana araba" },
      }
    );
    expect(result.values.settings.lineVoltageV).toBe(400);
    expect(result.values.festoon.loopHeightM).toBe(2.25);
    expect(result.values.festoon.circuitKeys).toEqual(["main", "trolley"]);
    expect(result.values.motorCables.every((row) => row.selectedCable?.brand === "ÜNTEL" && row.selectedCable.shape === "flat")).toBe(true);
  });

  it("sabit tesis VFD kablosu feston paketine seçilirse ayrıca uyarır", () => {
    const result = computeElectrical(
      NEW_WORK_SPECS,
      {
        ...DEFAULT_ELECTRICAL_INPUTS,
        festoonCircuitKeys: ["main"],
        festoonCircuitKeysAuto: false,
        circuits: { main: { cableAuto: false } },
      },
      {
        ...DEFAULT_ELECTRICAL_SELECTIONS,
        motorCables: { main: { articleNo: "UNTEL-2XSLCH-J-4G10", parallelRuns: 1 } },
      },
      { motors: [{ key: "main", label: "Ana Kaldırma", motorPowerKw: 4, motorCount: 1 }] }
    );
    expect(result.values.festoon.fitsCableApplication).toBe(false);
    expect(result.checks.find((check) => check.id === "electrical.festoon.application")?.pass).toBe(false);
  });

  it("çift sıra seçimi geniş kablo paketini daraltır ve ağırlık merkezini ortalar", () => {
    const deps: ElectricalDeps = {
      motors: [{ key: "main", label: "Ana Kaldırma", motorPowerKw: 4, motorCount: 4 }],
    };
    const common = {
      ...DEFAULT_ELECTRICAL_INPUTS,
      usableHeightMm: 60,
      festoonCircuitKeys: ["main" as const],
      extraCables: [{
        id: "control",
        label: "Kumanda",
        articleNo: "10369",
        quantity: 2,
        purpose: "control" as const,
      }],
    };
    const single = computeElectrical(NEW_WORK_SPECS, { ...common, rowCount: 1, rowCountAuto: false }, DEFAULT_ELECTRICAL_SELECTIONS, deps);
    const double = computeElectrical(NEW_WORK_SPECS, { ...common, rowCount: 2, rowCountAuto: false }, DEFAULT_ELECTRICAL_SELECTIONS, deps);

    expect(double.values.festoon.packageWidthMm).toBeLessThan(single.values.festoon.packageWidthMm);
    expect(Math.abs(double.values.festoon.centerOffsetMm)).toBeLessThanOrEqual(2);
    expect(double.values.festoon.placements).toHaveLength(6);
    expect(new Set(double.values.festoon.placements.map((x) => x.color)).size).toBe(2);
  });

  it("açıldığında mekanik/EPLAN ekipman listesine hesap katalog satırı eklemez", () => {
    const withElectrical = structuredClone(NEW_WORK_TEMPLATE);
    withElectrical.specs.hasElectricalCalculation = "yes";
    const withoutElectrical = structuredClone(withElectrical);
    withoutElectrical.specs.hasElectricalCalculation = "no";
    delete withoutElectrical.electrical;

    const rowKeys = (input: typeof withElectrical) =>
      buildEquipmentGroups(input).flatMap((group) => group.rows.map((row) => row.rowKey));
    expect(rowKeys(withElectrical)).toEqual(rowKeys(withoutElectrical));
  });
});
