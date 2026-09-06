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
import { driveModelsFor } from "@/lib/calc/electrical-catalog";

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

    // Bu teknik alan eklenmeden önce kaydedilmiş bir revizyon yeni bölümü
    // kendiliğinden açmamalı; varsayılan "no" geriye dönük davranışı korur.
    const legacySpecs = structuredClone(NEW_WORK_SPECS);
    delete (legacySpecs as unknown as Record<string, unknown>).hasElectricalCalculation;
    const legacy = loadRevision({
      specs: legacySpecs,
      mainHoist: NEW_WORK_TEMPLATE.mainHoist?.inputs,
    }, null);
    expect(legacy.full.specs.hasElectricalCalculation).toBe("no");
    expect(legacy.input.electrical).toBeUndefined();
  });

  it("0026'da kullanılan ATV930D90N4 seçimini katalog gücü ve akımıyla doğrular", () => {
    expect(driveModelsFor("Schneider Electric", "ATV930")).toHaveLength(23);
    const result = computeElectrical(
      { ...NEW_WORK_SPECS, hasElectricalCalculation: "yes" },
      { ...DEFAULT_ELECTRICAL_INPUTS, lineVoltageV: 400 },
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
    const single = computeElectrical(NEW_WORK_SPECS, { ...common, rowCount: 1 }, DEFAULT_ELECTRICAL_SELECTIONS, deps);
    const double = computeElectrical(NEW_WORK_SPECS, { ...common, rowCount: 2 }, DEFAULT_ELECTRICAL_SELECTIONS, deps);

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
