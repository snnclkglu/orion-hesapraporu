// YER VİNCİ — zemine/kaideye sabit, yürütmesiz teklif hesap raporu.
//
// Vinç tipi motor girdisi değildir. Tip V0 doğarken teknik topoloji tohumu
// üretir; bu test hem tohumun hem motorun yalnız kaldırma zincirini bıraktığını
// kilitler.

import { describe, expect, it } from "vitest";
import {
  GROUND_CRANE_DISABLED_MODULES,
  GROUND_CRANE_TYPE,
  applyCraneTypeRevisionPreset,
  craneTypeOptions,
  offerCraneTypeOptions,
} from "@/lib/crane-types";
import {
  NEW_WORK_DISABLED_MODULES,
  NEW_WORK_SPECS,
} from "@/lib/calc/defaults";
import { activeModules, runCalc } from "@/lib/calc/engine";
import { loadRevision } from "@/lib/revision-load";
import {
  buildEquipmentGroups,
  buildSummarySections,
} from "@/lib/excel/equipment";
import { summarySpecsForReport } from "@/lib/pdf/report";

const TRAVEL_MODULES = [
  "trolley",
  "auxTrolley",
  "mono1Trolley",
  "mono2Trolley",
  "bridge",
] as const;

function groundSnapshot() {
  return applyCraneTypeRevisionPreset(0, GROUND_CRANE_TYPE, {
    specs: { ...NEW_WORK_SPECS },
    disabledModules: [...NEW_WORK_DISABLED_MODULES],
  });
}

describe("Yer Vinci tipi", () => {
  it("yalnız teklif hesap raporu seçeneklerinde görünür", () => {
    expect(offerCraneTypeOptions()).toContain(GROUND_CRANE_TYPE);
    expect(craneTypeOptions()).not.toContain(GROUND_CRANE_TYPE);
    // Serbest metin koruması: mühendislik bağlamına taşınmış mevcut kayıt
    // seçim kutusu açılınca sessizce başka tipe dönüşmez.
    expect(craneTypeOptions(GROUND_CRANE_TYPE)[0]).toBe(GROUND_CRANE_TYPE);
  });

  it("V0 tohumunda şablonu korur, sabit topolojiyi ve köprüsüz kapsamı yazar", () => {
    const seeded = applyCraneTypeRevisionPreset(0, GROUND_CRANE_TYPE, {
      specs: { ...NEW_WORK_SPECS, mainCapacityT: 25 },
      disabledModules: ["cabin"],
      ozelAlan: "korunur",
    });
    const specs = seeded.specs as Record<string, unknown>;
    const disabled = seeded.disabledModules as string[];

    expect(specs.mainCapacityT).toBe(25);
    expect(specs.travelArrangement).toBe("fixed");
    expect(seeded.ozelAlan).toBe("korunur");
    expect(disabled).toContain("cabin");
    for (const key of GROUND_CRANE_DISABLED_MODULES) {
      expect(disabled, key).toContain(key);
    }
  });

  it("sonraki revizyonu vinç tipine bakarak yeniden şekillendirmez", () => {
    const inherited = { specs: { ...NEW_WORK_SPECS }, disabledModules: [] };
    expect(applyCraneTypeRevisionPreset(1, GROUND_CRANE_TYPE, inherited)).toBe(
      inherited
    );
  });
});

describe("Yer Vinci hesap topolojisi", () => {
  const loaded = loadRevision(groundSnapshot() as never, {} as never);
  const active = activeModules(loaded.input.specs, loaded.disabled);
  const result = runCalc(loaded.input);

  it("yalnız ana kaldırma ve kanca bloğunu hesaplar", () => {
    expect([...active]).toEqual(["main", "hookBlock"]);
    expect(result.mainHoist).toBeDefined();
    expect(result.hookBlock).toBeDefined();
  });

  it("ana araba dahil hiçbir yürütme ve köprü/yapı sonucu üretmez", () => {
    for (const key of TRAVEL_MODULES) {
      expect(active.has(key), key).toBe(false);
      expect(
        (result as unknown as Record<string, unknown>)[key],
        `${key} sonucu`
      ).toBeUndefined();
    }
    for (const key of GROUND_CRANE_DISABLED_MODULES) {
      expect(active.has(key), key).toBe(false);
    }
  });

  it("kapatılan yürütme girdilerini silmez ve kalan hesap sonlu kalır", () => {
    expect(loaded.full.trolley).toBeDefined();
    expect(loaded.input.trolley).toBeUndefined();
    expect(result.allChecks.length).toBeGreaterThan(0);
    for (const check of result.allChecks) {
      expect(Number.isFinite(check.provided), check.id).toBe(true);
    }
  });

  it("ekipman listesine hiçbir yürütme veya köprü grubu sızdırmaz", () => {
    const groups = buildEquipmentGroups(loaded.input).map((group) => group.name);
    expect(groups).toContain("Ana Kaldırma");
    expect(groups.some((name) => name.includes("Yürütme"))).toBe(false);
    expect(groups.some((name) => name.includes("Köprü"))).toBe(false);
    expect(groups.some((name) => name.includes("Ana Kiriş"))).toBe(false);
    expect(groups.some((name) => name.includes("Başkiriş"))).toBe(false);

    const summaryLabels = buildSummarySections(loaded.input, result)
      .flatMap((section) => section.rows)
      .map((row) => row.label);
    expect(summaryLabels).not.toContain("Ana araba ağırlığı");
    expect(summaryLabels).not.toContain("Köprü ağırlığı");
  });

  it("PDF teknik özetinde açıklık/araba/köprü alanlarını ve ağırlıklarını basmaz", () => {
    const { defs, source } = summarySpecsForReport(loaded.input);
    const keys = defs.map((field) => field.key);
    for (const key of [
      "spanM",
      "mainTrolleyWeightT",
      "trolleySpeedMpm",
      "bridgeSpeedMpm",
      "bridgeWeightT",
      "runwayLengthM",
    ]) {
      expect(keys, key).not.toContain(key);
    }
    expect(source.summaryCraneTotalWeightT).toBeCloseTo(
      loaded.input.mainHoist!.inputs.hookBlockWeightKg / 1000,
      6
    );
  });
});
