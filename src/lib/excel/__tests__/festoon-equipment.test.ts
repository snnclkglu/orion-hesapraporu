import { describe, expect, it } from "vitest";
import { V5_TEMPLATE } from "@/lib/calc/defaults";
import { buildEquipmentGroups } from "@/lib/excel/equipment";

/**
 * Feston artık yürütme grubunun KATALOG bölümüdür (5.9): satırı da o grubun
 * kendi satırlarıyla birlikte listelenir, ayrı bir "Enerji Besleme" grubu
 * açılmaz. Seçim alanları katalogdan (kind = "festoon") gelir.
 */
describe("festoon ekipman listesi", () => {
  const withFestoon = () => ({
    ...V5_TEMPLATE,
    specs: {
      ...V5_TEMPLATE.specs,
      trolleyPowerSupply: "festoon" as const,
      bridgePowerSupply: "festoon" as const,
      runwayLengthM: 80,
    },
    trolley: {
      inputs: {
        ...V5_TEMPLATE.trolley!.inputs,
        festoonTrolleyCount: 4,
        festoonCablePackageWeightKg: 160,
        festoonLoopHeightM: 1.5,
      },
      selections: {
        ...V5_TEMPLATE.trolley!.selections,
        festoonBrand: "Conductix-Wampfler",
        festoonSeries: "0320",
        festoonLine: "M-Line",
        festoonCableForm: "Yassı",
        festoonTrolleyLoadKg: 80,
        festoonMaxSpeedMpm: 100,
      },
    },
    bridge: {
      inputs: {
        ...V5_TEMPLATE.bridge!.inputs,
        festoonTrolleyCount: 2,
        festoonCablePackageWeightKg: 120,
        festoonLoopHeightM: 2,
      },
      selections: {
        ...V5_TEMPLATE.bridge!.selections,
        festoonBrand: "Vasel",
        festoonSeries: "VS2060",
        festoonLine: "Ağır Hizmet",
        festoonCableForm: "Yassı",
        festoonTrolleyLoadKg: 80,
        festoonMaxSpeedMpm: 120,
        festoonTrolleyCode: "VS2060A-FB50A…",
      },
    },
  });

  it("feston satırını ilgili yürütme grubunun içine koyar", () => {
    const groups = buildEquipmentGroups(withFestoon());
    const trolleyRow = groups
      .flatMap((group) => group.rows)
      .find((row) => row.rowKey === "trolley:festoon");

    // Marka ve model listede BÜYÜK HARFTİR (12.08.2026 kararı). "i" harfi
    // TÜRKÇE büyütülmez: yabancı marka "CONDUCTİX" olurdu (`kimlikBuyuk`).
    expect(trolleyRow).toMatchObject({
      kind: "festoon",
      brand: "CONDUCTIX-WAMPFLER",
      model: "0320",
      qty: 4,
    });
    // 160 kg / 4 taşıyıcı = 40 kg; katalog sınırı 80 kg.
    expect(trolleyRow?.spec).toContain("40");
    expect(trolleyRow?.spec).toContain("80");
    // Ayrı bir enerji besleme grubu AÇILMAZ.
    expect(groups.some((group) => group.name.includes("Enerji Besleme"))).toBe(false);
  });

  it("Vasel seçimini marka, seri ve katalog parça koduyla taşır", () => {
    const bridgeRow = buildEquipmentGroups(withFestoon())
      .flatMap((group) => group.rows)
      .find((row) => row.rowKey === "bridge:festoon");

    expect(bridgeRow).toMatchObject({ brand: "VASEL", model: "VS2060", qty: 2 });
    expect(bridgeRow?.spec).toContain("VS2060A-FB50A…");
  });

  it("enerji beslemesi feston değilken satır üretmez", () => {
    const rows = buildEquipmentGroups(V5_TEMPLATE).flatMap((group) => group.rows);
    expect(rows.some((row) => row.rowKey?.endsWith(":festoon"))).toBe(false);
  });
});
