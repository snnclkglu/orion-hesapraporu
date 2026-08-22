// Halat sipariş boyu ve helis dağılımı.
//
// Bu testler yalnız toplam metreyi değil, satın alma satırlarının kaç ayrı
// halata ve hangi helis yönlerine bölündüğünü de kilitler. Aynı toplam metrenin
// yanlışlıkla tek halat yazılması sahada aynı sonucu vermez.

import { describe, expect, it } from "vitest";
import {
  drumGrooveRequirement,
  ropeLengthPlan,
} from "../modules/hoistGroup";
import {
  V5_MAIN_HOIST_INPUTS,
  V5_MAIN_HOIST_SELECTIONS,
} from "../defaults";

const LIFT_HEIGHT_M = 10;

function input(
  reevingLabel: "2/4" | "4/8",
  ropeBalancingType: "equalizerBeam" | "equalizerSheave"
) {
  const [drivenFalls, totalFalls] = reevingLabel.split("/").map(Number);
  return {
    ...V5_MAIN_HOIST_INPUTS,
    reevingLabel,
    drivenFalls,
    totalFalls,
    ropeBalancingType,
  };
}

describe("halat boyu ve denge düzeni", () => {
  it("tek yiv boyunu sarım çevresi + %10 kaldırma payıyla hesaplar", () => {
    const inp = input("2/4", "equalizerBeam");
    const plan = ropeLengthPlan(inp, V5_MAIN_HOIST_SELECTIONS, LIFT_HEIGHT_M);
    const groove = drumGrooveRequirement(inp, V5_MAIN_HOIST_SELECTIONS, LIFT_HEIGHT_M);
    const expected =
      groove.grooves * Math.PI * (V5_MAIN_HOIST_SELECTIONS.drumDiaMm / 1000) +
      0.1 * LIFT_HEIGHT_M * (inp.totalFalls / inp.drivenFalls);

    expect(plan.lengthPerGrooveM).toBeCloseTo(expected, 10);
    expect(plan.totalLengthM).toBeCloseTo(expected * inp.drivenFalls, 10);
  });

  it("2/4 denge traversini bir sağ ve bir sol helis halata böler", () => {
    const plan = ropeLengthPlan(
      input("2/4", "equalizerBeam"),
      V5_MAIN_HOIST_SELECTIONS,
      LIFT_HEIGHT_M
    );

    expect(plan.pieceCount).toBe(2);
    expect(plan.rightLayCount).toBe(1);
    expect(plan.leftLayCount).toBe(1);
    expect(plan.lines.map((line) => [line.lay, line.quantity])).toEqual([
      ["right", 1],
      ["left", 1],
    ]);
    expect(plan.lines[0].lengthPerPieceM).toBeCloseTo(plan.lengthPerGrooveM, 10);
    expect(plan.lines[1].lengthPerPieceM).toBeCloseTo(plan.lengthPerGrooveM, 10);
  });

  it("2/4 denge makarasını iki yivi birleştiren tek sağ helis halat yapar", () => {
    const plan = ropeLengthPlan(
      input("2/4", "equalizerSheave"),
      V5_MAIN_HOIST_SELECTIONS,
      LIFT_HEIGHT_M
    );

    expect(plan.pieceCount).toBe(1);
    expect(plan.rightLayCount).toBe(1);
    expect(plan.leftLayCount).toBe(0);
    expect(plan.lines).toHaveLength(1);
    expect(plan.lines[0].lay).toBe("right");
    expect(plan.lines[0].lengthPerPieceM).toBeCloseTo(plan.lengthPerGrooveM * 2, 10);
  });

  it("4/8 travers düzeninde dört halatı sağ/sol olarak dengeli dağıtır", () => {
    const plan = ropeLengthPlan(
      input("4/8", "equalizerBeam"),
      V5_MAIN_HOIST_SELECTIONS,
      LIFT_HEIGHT_M
    );

    expect(plan.pieceCount).toBe(4);
    expect(plan.rightLayCount).toBe(2);
    expect(plan.leftLayCount).toBe(2);
    expect(plan.lines.map((line) => line.quantity)).toEqual([2, 2]);
  });
});
