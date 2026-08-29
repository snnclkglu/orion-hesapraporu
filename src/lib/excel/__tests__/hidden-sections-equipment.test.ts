// Alt bölüm gizleme — ekipman listesi.
//
// Gizlenen alt bölümün ekipman satırları listeden düşer (ekran, Excel ve PDF
// aynı `buildEquipmentGroups`tan geçer). Bölüm → satır bağı bölüm tanımının
// `equipmentSlugs` bildirimindedir; bu dosya o bağı İKİ YÖNDEN ölçer:
//   · bildirilen her slug gerçekten üretilen bir satıra karşılık gelir
//     (yazım hatası "satır düşmüyor"a sessizce dönüşemez)
//   · üretilen her satır bir bölüm tarafından sahiplenilir
//     (yeni eklenen bir ekipman satırı eşlemesiz kalamaz)

import { describe, expect, it } from "vitest";
import { NEW_WORK_TEMPLATE, V5_TEMPLATE } from "@/lib/calc/defaults";
import type { CalcInput } from "@/lib/calc/engine";
import { buildEquipmentGroups } from "@/lib/excel/equipment";
import { HOIST_SECTIONS } from "@/lib/calc/presentation/hoistSections";
import { HOOKBLOCK_SECTIONS } from "@/lib/calc/presentation/hookBlockSections";
import { TRAVEL_SECTIONS } from "@/lib/calc/presentation/travelSections";
import { CABIN_SECTIONS } from "@/lib/calc/presentation/cabinSections";

/** V5 + feston: yürütme ailesinin BÜTÜN satırları (festoon dâhil) üretilsin. */
function fullTravelInput(): CalcInput {
  return {
    ...V5_TEMPLATE,
    trolley: V5_TEMPLATE.trolley
      ? {
          ...V5_TEMPLATE.trolley,
          // Fren satırı seçim olmadığında bilinçli olarak düşer; iki yönlü
          // slug koruması koşullu satırı gerçekten üreten bir fikstür ister.
          selections: { ...V5_TEMPLATE.trolley.selections, brakeTorqueNm: 850 },
        }
      : undefined,
    specs: {
      ...V5_TEMPLATE.specs,
      trolleyPowerSupply: "festoon",
      bridgePowerSupply: "festoon",
      runwayLengthM: 80,
    },
  };
}

/** Kabin + elektrik odası açık şablon (11.1 + 11.2 satırları üretilir). */
function cabinRoomInput(): CalcInput {
  const cabin = NEW_WORK_TEMPLATE.cabin!;
  return {
    ...NEW_WORK_TEMPLATE,
    specs: {
      ...NEW_WORK_TEMPLATE.specs,
      hasOperatorCabin: "yes",
      operatorCabinHasAirConditioner: "yes",
      electricalAccommodationType: "room",
      electricalRoomHasAirConditioner: "yes",
    },
    cabin,
  };
}

/** Pano tipi yerleşim (11.3 satırları üretilir — oda ile birbirini dışlar). */
function cabinPanelInput(): CalcInput {
  const cabin = NEW_WORK_TEMPLATE.cabin!;
  return {
    ...NEW_WORK_TEMPLATE,
    specs: {
      ...NEW_WORK_TEMPLATE.specs,
      electricalAccommodationType: "panel",
      electricalPanelHasAirConditioner: "yes",
    },
    cabin,
  };
}

/** Çift tambur + kaldırma kirişi: koşullu kiriş ekipman satırı üretilsin. */
function doubleDrumLiftingBeamInput(): CalcInput {
  return {
    ...NEW_WORK_TEMPLATE,
    specs: {
      ...NEW_WORK_TEMPLATE.specs,
      mainHoistEquipmentArrangement: "doubleDrum",
      mainDoubleDrumHookSystem: "liftingBeam",
    },
  };
}

const rowKeysOf = (input: CalcInput, hidden?: string[]): string[] =>
  buildEquipmentGroups(input, undefined, undefined, undefined, hidden)
    .flatMap((g) => g.rows)
    .map((r) => r.rowKey)
    .filter((k): k is string => Boolean(k));

const slugsOf = (keys: string[], moduleKey: string): Set<string> =>
  new Set(
    keys
      .filter((k) => k.startsWith(`${moduleKey}:`))
      .map((k) => k.slice(moduleKey.length + 1).split("#")[0])
  );

describe("alt bölüm gizleme — ekipman listesi", () => {
  it("gizlenen 5.7 yalnız o modülün teker kaplini satırını düşürür", () => {
    const keys = rowKeysOf(fullTravelInput(), ["trolley-5.7"]);
    expect(keys).not.toContain("trolley:wheelCoupling");
    // Komşu satırlar ve AYNI ham bölümün köprüdeki karşılığı yerinde kalır.
    expect(keys).toContain("trolley:motorCoupling");
    expect(keys).toContain("trolley:wheel");
    expect(keys).toContain("bridge:wheelCoupling");
  });

  it("gizlenen bölümün alternatif satırı da ana satırıyla birlikte düşer", () => {
    const input = fullTravelInput();
    const alts = {
      "trolley-5.7": {
        active: 0,
        options: [
          {},
          { wheelCouplingModel: "SEÇENEK-MODEL", wheelCouplingTorqueNm: 9999 },
        ],
      },
    };
    const withAlt = buildEquipmentGroups(input, undefined, alts)
      .flatMap((g) => g.rows)
      .map((r) => r.rowKey);
    // Önce alternatifin gerçekten üretildiğini kanıtla — yoksa süzme testi boş.
    expect(withAlt).toContain("trolley:wheelCoupling#5.7-2");

    const hidden = buildEquipmentGroups(input, undefined, alts, undefined, ["trolley-5.7"])
      .flatMap((g) => g.rows)
      .map((r) => r.rowKey);
    expect(hidden).not.toContain("trolley:wheelCoupling");
    expect(hidden).not.toContain("trolley:wheelCoupling#5.7-2");
  });

  it("bir modülün bütün bölümleri gizlenince grubu da listeden düşer", () => {
    const allTravelHidden = TRAVEL_SECTIONS.map((s) => `trolley-${s.id}`);
    const groups = buildEquipmentGroups(
      fullTravelInput(), undefined, undefined, undefined, allTravelHidden
    );
    expect(groups.flatMap((g) => g.rows).some((r) => r.rowKey?.startsWith("trolley:"))).toBe(false);
    expect(groups.some((g) => g.name === "Ana Araba Yürütme")).toBe(false);
    // Köprü grubu etkilenmez.
    expect(groups.some((g) => g.name === "Köprü Yürütme")).toBe(true);
  });

  // ---- Koruma: bölüm bildirimi ↔ satır üreticisi iki yönde de tutarlı ----

  it("bildirilen her equipmentSlugs değeri gerçekten üretilen bir satırdır", () => {
    const travelKeys = rowKeysOf(fullTravelInput());
    const newWorkKeys = rowKeysOf(NEW_WORK_TEMPLATE);
    const produced: Record<string, Set<string>> = {
      // Tarihsel V5 denge makaralıdır ve yalnız `rope` üretir; yeni iş
      // traversli olduğundan `ropeLeft` de üretir. Aile iki geçerli düzenin
      // birleşimiyle ölçülür.
      hoist: new Set([
        ...slugsOf(travelKeys, "main"),
        ...slugsOf(newWorkKeys, "main"),
      ]),
      hookBlock: new Set([
        ...slugsOf(travelKeys, "hookBlock"),
        ...slugsOf(rowKeysOf(doubleDrumLiftingBeamInput()), "hookBlock"),
      ]),
      // Yürütme ailesi bütün ortak satırlarını iki varyantta da üretir.
      travel: new Set([
        ...slugsOf(travelKeys, "trolley"),
        ...slugsOf(travelKeys, "bridge"),
      ]),
      // Oda ile pano birbirini dışlar; kabin ailesi iki fikstürün birleşimidir.
      cabin: new Set([
        ...slugsOf(rowKeysOf(cabinRoomInput()), "cabin"),
        ...slugsOf(rowKeysOf(cabinPanelInput()), "cabin"),
      ]),
    };
    const families: [string, readonly { id: string; equipmentSlugs?: readonly string[] }[]][] = [
      ["hoist", HOIST_SECTIONS],
      ["hookBlock", HOOKBLOCK_SECTIONS],
      ["travel", TRAVEL_SECTIONS],
      ["cabin", CABIN_SECTIONS],
    ];
    for (const [family, sections] of families) {
      for (const section of sections) {
        for (const slug of section.equipmentSlugs ?? []) {
          expect(
            produced[family].has(slug),
            `${family} ${section.id} bölümünün "${slug}" slug'ı hiçbir satırda üretilmiyor`
          ).toBe(true);
        }
      }
    }
  });

  it("üretilen her satır bir bölüm tarafından sahiplenilir (yetim slug yok)", () => {
    const claimed = (defs: readonly { equipmentSlugs?: readonly string[] }[]): Set<string> =>
      new Set(defs.flatMap((s) => [...(s.equipmentSlugs ?? [])]));
    const claims: [string, Set<string>][] = [
      ["main", claimed(HOIST_SECTIONS)],
      ["hookBlock", claimed(HOOKBLOCK_SECTIONS)],
      ["trolley", claimed(TRAVEL_SECTIONS)],
      ["bridge", claimed(TRAVEL_SECTIONS)],
      ["cabin", claimed(CABIN_SECTIONS)],
    ];
    const allKeys = [
      ...rowKeysOf(fullTravelInput()),
      ...rowKeysOf(cabinRoomInput()),
      ...rowKeysOf(cabinPanelInput()),
      ...rowKeysOf(doubleDrumLiftingBeamInput()),
    ];
    for (const [moduleKey, claimedSlugs] of claims) {
      for (const slug of slugsOf(allKeys, moduleKey)) {
        expect(
          claimedSlugs.has(slug),
          `"${moduleKey}:${slug}" satırını sahiplenen bölüm yok — yeni satır ` +
            "eklendiyse ilgili bölümün equipmentSlugs bildirimine de eklenmeli"
        ).toBe(true);
      }
    }
  });
});
