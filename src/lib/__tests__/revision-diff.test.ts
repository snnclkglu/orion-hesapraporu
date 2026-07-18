import { describe, expect, it } from "vitest";
import { diffRevisions } from "../revision-diff";
import { runCalc } from "@/lib/calc/engine";
import { V5_TEMPLATE } from "@/lib/calc/defaults";

function snapshotOf(calcInput: typeof V5_TEMPLATE) {
  const result = runCalc(calcInput);
  return {
    inputs: {
      specs: calcInput.specs,
      mainHoist: calcInput.mainHoist!.inputs,
      bridge: calcInput.bridge!.inputs,
      buckling: calcInput.buckling!.inputs,
    } as Record<string, unknown>,
    selections: {
      mainHoist: calcInput.mainHoist!.selections,
      alts: { "main-2.1": { active: 0, options: [{}] } },
    } as Record<string, unknown>,
    results: JSON.parse(JSON.stringify(result)),
  };
}

describe("diffRevisions", () => {
  it("aynı snapshot için fark üretmez", () => {
    const s = snapshotOf(V5_TEMPLATE);
    const d = diffRevisions(s, s);
    expect(d.fields).toEqual([]);
    expect(d.checks).toEqual([]);
  });

  it("girdi, seçim ve kontrol değişimlerini yakalar; alts'ı yok sayar", () => {
    const a = snapshotOf(V5_TEMPLATE);
    const modified = {
      ...V5_TEMPLATE,
      specs: { ...V5_TEMPLATE.specs, mainCapacityT: 8 },
      mainHoist: {
        inputs: V5_TEMPLATE.mainHoist!.inputs,
        selections: { ...V5_TEMPLATE.mainHoist!.selections, gearboxNominalTorqueKnm: 60 },
      },
    };
    const b = snapshotOf(modified);

    const d = diffRevisions(a, b);
    const keys = d.fields.map((f) => `${f.module}.${f.kind}.${f.key}`);
    expect(keys).toContain("specs.input.mainCapacityT");
    expect(keys).toContain("mainHoist.selection.gearboxNominalTorqueKnm");
    expect(keys.some((k) => k.includes("alts"))).toBe(false);

    // Kapasite 8t + 60 kNm redüktörle tork kontrolü düzelir -> durum değişimi yakalanmalı
    const gearbox = d.checks.find((c) => c.id === "main.gearbox.torque");
    expect(gearbox).toBeDefined();
    expect(gearbox!.aPass).toBe(false);
  });

  it("iç içe yapıları (buckling panelleri) bir seviye açar", () => {
    const a = snapshotOf(V5_TEMPLATE);
    const modifiedBuckling = JSON.parse(JSON.stringify(V5_TEMPLATE.buckling!.inputs));
    const firstPanelKey = Object.keys(modifiedBuckling).find(
      (k) => typeof modifiedBuckling[k] === "object" && modifiedBuckling[k] !== null
    )!;
    const firstField = Object.keys(modifiedBuckling[firstPanelKey])[0];
    modifiedBuckling[firstPanelKey][firstField] = 999;
    const b = snapshotOf({ ...V5_TEMPLATE, buckling: { inputs: modifiedBuckling } });

    const d = diffRevisions(a, b);
    expect(
      d.fields.some((f) => f.module === "buckling" && f.key === `${firstPanelKey}.${firstField}`)
    ).toBe(true);
  });
});
