import { describe, expect, it } from "vitest";
import { NEW_WORK_TEMPLATE } from "../defaults";
import { runCalc, type CalcInput } from "../engine";
import { buildEquipmentGroups } from "@/lib/excel/equipment";
import { HOOKBLOCK_SECTIONS } from "../presentation/hookBlockSections";
import { GIRDER_ARRANGEMENT_LABELS } from "../types";

function inputFor(hookSystem: "doubleHookBlock" | "liftingBeam"): CalcInput {
  return {
    ...NEW_WORK_TEMPLATE,
    specs: {
      ...NEW_WORK_TEMPLATE.specs,
      mainCapacityT: 64,
      mainHoistEquipmentArrangement: "doubleDrum",
      mainDoubleDrumHookSystem: hookSystem,
    },
  };
}

function demand(result: ReturnType<typeof runCalc>, id: string): number | undefined {
  const check = result.allChecks.find((item) => item.id === id);
  return check && check.op !== "range" ? check.required : undefined;
}

describe("çift tambur hesabı", () => {
  it("ortak redüktör, motor ve freni tam mekanizma yükünde bırakır", () => {
    const standardInput: CalcInput = {
      ...NEW_WORK_TEMPLATE,
      specs: { ...NEW_WORK_TEMPLATE.specs, mainCapacityT: 64 },
    };
    const standard = runCalc(standardInput).mainHoist!;
    const doubleDrum = runCalc(inputFor("doubleHookBlock")).mainHoist!;

    for (const key of [
      "gearbox.requiredTorque",
      "gearbox.requiredRatio",
      "motor.requiredPower",
      "brake.requiredTorque",
      "rope.load",
    ]) {
      expect(doubleDrum.cells[key], key).toBeCloseTo(Number(standard.cells[key]), 10);
    }
  });

  it("simetrik tamburlardan yalnız birini yarım halat uçlarıyla inceler", () => {
    const standard = runCalc({
      ...NEW_WORK_TEMPLATE,
      specs: { ...NEW_WORK_TEMPLATE.specs, mainCapacityT: 64 },
    }).mainHoist!;
    const doubleDrum = runCalc(inputFor("doubleHookBlock")).mainHoist!;

    expect(doubleDrum.values.ropeLoadPerPointKg)
      .toBeCloseTo(standard.values.ropeLoadPerPointKg / 2, 10);
  });

  it("iki alt grubu 32 tonla, tek kaldırma kirişini tam 64 tonla boyutlandırır", () => {
    const doubleHook = runCalc(inputFor("doubleHookBlock"));
    const liftingBeam = runCalc(inputFor("liftingBeam"));
    const standard = runCalc({
      ...NEW_WORK_TEMPLATE,
      specs: { ...NEW_WORK_TEMPLATE.specs, mainCapacityT: 64 },
    });

    expect(demand(doubleHook, "hookBlock.hook.capacity")).toBe(32_000);
    expect(liftingBeam.hookBlock?.cells["girder.forceMax"])
      .toBeCloseTo(Number(standard.hookBlock?.cells["girder.forceMax"]), 10);
  });

  it("kaldırma kirişi bölümlerini yalnız ilgili çift tambur seçiminde gösterir", () => {
    const beamSections = HOOKBLOCK_SECTIONS.filter((section) => ["4.6", "4.7"].includes(section.id));
    const doubleHookSpecs = inputFor("doubleHookBlock").specs;
    const liftingBeamSpecs = inputFor("liftingBeam").specs;

    expect(beamSections.every((section) => section.visible?.(doubleHookSpecs, "hookBlock") === false)).toBe(true);
    expect(beamSections.every((section) => section.visible?.(liftingBeamSpecs, "hookBlock") === true)).toBe(true);
  });

  it("ekipman listesini iki tambur, tek redüktör ve seçilen alt taşıyıcı adediyle üretir", () => {
    const doubleHookGroups = buildEquipmentGroups(inputFor("doubleHookBlock"));
    const liftingBeamGroups = buildEquipmentGroups(inputFor("liftingBeam"));
    const main = doubleHookGroups.find((group) => group.name === "Ana Kaldırma")!;
    const hooks = doubleHookGroups.find((group) => group.name === "Ana Kanca Bloğu")!;
    const beamHooks = liftingBeamGroups.find((group) => group.name === "Ana Kanca Bloğu")!;

    expect(main.rows.find((row) => row.component === "Tambur")?.qty).toBe(2);
    expect(main.rows.find((row) => row.component === "Redüktör")?.qty).toBe(1);
    expect(hooks.rows.find((row) => row.component === "Kanca")?.qty).toBe(2);
    expect(beamHooks.rows.some((row) => row.component === "Kanca")).toBe(false);
    expect(beamHooks.rows.find((row) => row.component === "Kanca Bloğu Mili")?.qty).toBe(2);
    expect(
      beamHooks.rows.find((row) => row.component === "Kaldırma Kirişi")?.qty,
      JSON.stringify(beamHooks.rows.map((row) => [row.component, row.qty]))
    ).toBe(1);
  });

  it("yeni iş tambur mili malzemesini S355JR ile başlatır", () => {
    expect(NEW_WORK_TEMPLATE.mainHoist?.selections.shaftMaterial).toBe("S355JR");
    expect(NEW_WORK_TEMPLATE.auxHoist?.selections.shaftMaterial).toBe("S355JR");
  });

  it("taşıyıcı kiriş düzeni etiketlerinde açıklama parantezlerini kullanmaz", () => {
    expect(GIRDER_ARRANGEMENT_LABELS.iki).toBe("Çift Kirişli");
    expect(GIRDER_ARRANGEMENT_LABELS.dort).toBe("Dört Kirişli");
  });
});
