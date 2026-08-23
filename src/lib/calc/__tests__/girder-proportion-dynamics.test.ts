import { describe, expect, it } from "vitest";
import {
  V5_GIRDER_DEPS,
  V5_GIRDER_INPUTS,
  V5_GIRDER_SELECTIONS,
} from "../defaults/structural";
import { NEW_WORK_SPECS, NEW_WORK_TEMPLATE, V5_SPECS } from "../defaults";
import { runCalc } from "../engine";
import { computeMainGirder } from "../modules/mainGirder";

describe("ana kiriş kutu oranları — CMAA 70 3.5.1", () => {
  it("L/h ve L/b değerlerini gerçek uygunluk kontrollerine bağlar", () => {
    const result = computeMainGirder(
      V5_SPECS,
      "girder",
      V5_GIRDER_INPUTS,
      V5_GIRDER_SELECTIONS,
      V5_GIRDER_DEPS
    );
    const depth = result.checks.find((c) => c.id === "girder.section.spanToDepthRatio");
    const width = result.checks.find((c) => c.id === "girder.section.spanToWidthRatio");
    expect(depth).toMatchObject({ required: 25, op: "<=", standard: "CMAA 70 3.5.1" });
    expect(width).toMatchObject({ required: 65, op: "<=", standard: "CMAA 70 3.5.1" });
    expect(depth?.pass).toBe(result.values.spanToDepthRatio <= 25);
    expect(width?.pass).toBe(result.values.spanToWidthRatio <= 65);
  });

  it("oran sınırı aşılırsa 7.8 kontrolü başarısız olur", () => {
    const result = computeMainGirder(
      { ...V5_SPECS, spanM: 30 },
      "girder",
      { ...V5_GIRDER_INPUTS, aMm: 250 },
      V5_GIRDER_SELECTIONS,
      V5_GIRDER_DEPS
    );
    expect(result.checks.find((c) => c.id === "girder.section.spanToDepthRatio")?.pass)
      .toBe(false);
    expect(result.checks.find((c) => c.id === "girder.section.spanToWidthRatio")?.pass)
      .toBe(false);
  });
});

describe("ana kiriş basit dinamik ön taraması", () => {
  it("statik sehimden doğal frekansı ve tambur frekansı ayrımını üretir", () => {
    const result = computeMainGirder(
      V5_SPECS,
      "girder",
      V5_GIRDER_INPUTS,
      V5_GIRDER_SELECTIONS,
      V5_GIRDER_DEPS
    );
    expect(result.values.naturalPeriodS).toBeGreaterThan(0);
    expect(result.values.naturalFrequencyHz).toBeCloseTo(1 / result.values.naturalPeriodS, 10);
    expect(result.values.hoistExcitationFrequencyHz).toBeCloseTo(V5_GIRDER_DEPS.hoistDrumRpm / 60, 10);
    expect(result.values.frequencySeparationPct).toBeGreaterThanOrEqual(0);
    expect(result.checks.find((c) => c.id === "girder.dynamics.frequencySeparation"))
      .toMatchObject({ required: 20, op: ">=", kind: "firma", severity: "uyari" });
  });
});

describe("yeni rapor otomatikleri ve ölçü onayları", () => {
  it("kanca konumu, dingil açıklığı ve teker basıncı sacı otomatik açık gelir", () => {
    const girder = NEW_WORK_TEMPLATE.girder!.inputs;
    expect(girder.hookTopPositionAuto).toBe(true);
    expect(girder.hookTopPositionM).toBe(NEW_WORK_SPECS.mainLiftHeightM);
    expect(girder.bridgeAxleSpacingAuto).toBe(true);
    expect(girder.bridgeAxleSpacingM).toBe(3);
    expect(girder.wheelContactTAuto).toBe(true);
    expect(girder.wheelContactTMm).toBe(girder.t3Mm);
  });

  it("iki ölçü onayı verilmeden ilgili bölümleri uygun saymaz", () => {
    const result = runCalc(NEW_WORK_TEMPLATE);
    expect(result.allChecks.find((c) => c.id === "wheelLoads.measurements.confirmed")?.pass)
      .toBe(false);
    expect(result.allChecks.find((c) => c.id === "girder.loads.measurements.confirmed")?.pass)
      .toBe(false);
  });
});
