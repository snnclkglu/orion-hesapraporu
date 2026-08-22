// Mühendislik seçimlerinden ekipman listesine aktarılan kritik adetler.
// Ekran, Excel ve ekipman PDF'i aynı `buildEquipmentGroups` sonucunu kullandığı
// için bu test üç çıktıyı birlikte korur.

import { describe, expect, it } from "vitest";
import { NEW_WORK_TEMPLATE } from "@/lib/calc/defaults";
import type { CalcInput } from "@/lib/calc/engine";
import { buildEquipmentGroups, type EqRow } from "../equipment";

function row(input: CalcInput, rowKey: string): EqRow {
  const found = buildEquipmentGroups(input)
    .flatMap((group) => group.rows)
    .find((candidate) => candidate.rowKey === rowKey);
  expect(found, `${rowKey} ekipman satırı bulunamadı`).toBeDefined();
  return found!;
}

describe("mühendislik ekipman adetleri", () => {
  it("Nr 16 · P · 3m/M7 kancasını tabloda yazan 20.000 kg olarak basar", () => {
    const input: CalcInput = {
      ...NEW_WORK_TEMPLATE,
      specs: { ...NEW_WORK_TEMPLATE.specs, hoistMechanismClass: "M7" },
      hookBlock: {
        inputs: { ...NEW_WORK_TEMPLATE.hookBlock!.inputs },
        selections: {
          ...NEW_WORK_TEMPLATE.hookBlock!.selections,
          hookStandard: "DIN 15401",
          hookNumber: "16",
          hookStrengthClass: "P",
          // Eski ekipman yolu bu bayat değeri yazıyordu; test özellikle farklı
          // tutar ve standardın satırının üstün geldiğini kanıtlar.
          hookCapacityKg: 16_000,
        },
      },
    };

    expect(row(input, "hookBlock:hook").spec).toContain("20000");
    expect(row(input, "hookBlock:hook").spec).not.toContain("16000");
  });

  it("dört tekerde ikişer rulmanı 8 adet olarak verir", () => {
    const input: CalcInput = {
      ...NEW_WORK_TEMPLATE,
      trolley: {
        inputs: {
          ...NEW_WORK_TEMPLATE.trolley!.inputs,
          wheelCount: 4,
          bearingCount: 2,
        },
        selections: { ...NEW_WORK_TEMPLATE.trolley!.selections },
      },
    };

    expect(row(input, "trolley:wheel").qty).toBe(4);
    expect(row(input, "trolley:wheelBearing").qty).toBe(8);
  });

  it("makara adedini seçimden, makara rulmanını bunun iki katı olarak verir", () => {
    const input: CalcInput = {
      ...NEW_WORK_TEMPLATE,
      hookBlock: {
        inputs: { ...NEW_WORK_TEMPLATE.hookBlock!.inputs, sheaveCountAuto: false },
        selections: { ...NEW_WORK_TEMPLATE.hookBlock!.selections, sheaveCount: 6 },
      },
    };

    expect(row(input, "hookBlock:sheave").qty).toBe(6);
    expect(row(input, "hookBlock:sheaveBearing").qty).toBe(12);
  });

  it("traversli halatı sağ ve sol helis olarak iki ayrı sipariş satırına böler", () => {
    const input: CalcInput = {
      ...NEW_WORK_TEMPLATE,
      mainHoist: {
        inputs: {
          ...NEW_WORK_TEMPLATE.mainHoist!.inputs,
          reevingLabel: "2/4",
          drivenFalls: 2,
          totalFalls: 4,
          ropeBalancingType: "equalizerBeam",
        },
        selections: { ...NEW_WORK_TEMPLATE.mainHoist!.selections },
      },
    };

    const right = row(input, "main:rope");
    const left = row(input, "main:ropeLeft");
    expect(right.model).toContain("SAĞ HELİS");
    expect(left.model).toContain("SOL HELIS");
    expect(right.spec).toMatch(/boy .* m\/adet/i);
    expect(left.spec).toMatch(/boy .* m\/adet/i);
    expect(right.qty).toBe(1);
    expect(left.qty).toBe(1);
  });

  it("denge makaralı düzende tek sağ helis halat satırı üretir", () => {
    const input: CalcInput = {
      ...NEW_WORK_TEMPLATE,
      mainHoist: {
        inputs: {
          ...NEW_WORK_TEMPLATE.mainHoist!.inputs,
          reevingLabel: "2/4",
          drivenFalls: 2,
          totalFalls: 4,
          ropeBalancingType: "equalizerSheave",
        },
        selections: { ...NEW_WORK_TEMPLATE.mainHoist!.selections },
      },
    };
    const keys = buildEquipmentGroups(input)
      .flatMap((group) => group.rows)
      .map((candidate) => candidate.rowKey);

    expect(row(input, "main:rope").model).toContain("SAĞ HELİS");
    expect(keys).not.toContain("main:ropeLeft");
  });
});
