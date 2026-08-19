// VİNÇ ARABASI RAPORU — ekipman listesi.
//
// Yalnız arabanın yenilendiği işte köprü tarafı hesaba GİRMEZ; ekipman listesi
// (ekran + Excel + PDF aynı `buildEquipmentGroups`tan geçer) ve teknik ressam
// özeti bunu kendiliğinden yansıtmalıdır. Dört bağ kilitlenir:
//   1. Kapalı modülün grubu listede HİÇ görünmez (boş başlık da basılmaz).
//   2. Ressam özetindeki "Köprü ağırlığı" satırı, o sayıyı okuyan bir hesap
//      kalmadıysa basılmaz.
//   3. Sıfır satır üreten bir bölüm grup bandı açmaz.
//   4. Elle eklenen ek satır, kapalı bir bölümün başlığını DİRİLTMEZ.

import { describe, expect, it } from "vitest";
import { NEW_WORK_TEMPLATE } from "@/lib/calc/defaults";
import { activeModules, runCalc, type CalcInput } from "@/lib/calc/engine";
import { CALC_FIELD } from "@/lib/revision-load";
import { MODULE_ORDER } from "@/lib/calc/presentation/module-family";
import {
  absentModuleGroupNames,
  buildEquipmentGroups,
  buildSummarySections,
  mergeExtras,
} from "@/lib/excel/equipment";
import { TROLLEY_ONLY_DISABLED_MODULES } from "@/lib/crane-types";

const SPECS = NEW_WORK_TEMPLATE.specs;

/** Kapalı listeye göre hesaba giren girdi seti (loadRevision ile aynı ilke). */
function calcFor(disabled: readonly string[]): CalcInput {
  const src = NEW_WORK_TEMPLATE as unknown as Record<string, unknown>;
  const active = activeModules(SPECS, disabled);
  const out: Record<string, unknown> = { specs: SPECS };
  for (const key of MODULE_ORDER) {
    if (!active.has(key)) continue;
    out[CALC_FIELD[key]] = src[CALC_FIELD[key]];
  }
  return out as unknown as CalcInput;
}

const TROLLEY_ONLY = calcFor([...TROLLEY_ONLY_DISABLED_MODULES]);
const FULL = calcFor([]);

describe("kapalı modül — ekipman listesi", () => {
  it("köprü kapalıyken 'Köprü Yürütme' grubu listede YOKTUR", () => {
    const tam = buildEquipmentGroups(FULL).map((g) => g.name);
    expect(tam).toContain("Köprü Yürütme");

    const araba = buildEquipmentGroups(TROLLEY_ONLY).map((g) => g.name);
    expect(araba).not.toContain("Köprü Yürütme");
    // Arabanın kendi grubu yerinde durur — düşen yalnız köprüdür.
    expect(araba).toContain("Ana Araba Yürütme");
    expect(araba).toContain("Ana Kaldırma");
  });

  it("hiçbir grup BOŞ satır listesiyle basılmaz", () => {
    for (const g of buildEquipmentGroups(TROLLEY_ONLY)) {
      expect(g.rows.length, g.name).toBeGreaterThan(0);
    }
  });

  it("köprüye özgü satırlar (yürütme freni) listeden düşer", () => {
    const keys = (input: CalcInput) =>
      buildEquipmentGroups(input).flatMap((g) => g.rows.map((r) => r.rowKey));
    expect(keys(FULL)).toContain("bridge:brake");
    expect(keys(TROLLEY_ONLY)).not.toContain("bridge:brake");
  });
});

describe("teknik ressam özeti", () => {
  it("köprü ağırlığı satırı yalnız onu OKUYAN bir hesap varken basılır", () => {
    const satirlar = (input: CalcInput) =>
      buildSummarySections(input, runCalc(input))
        .flatMap((s) => s.rows)
        .map((r) => r.label);

    expect(satirlar(FULL)).toContain("Köprü ağırlığı");
    expect(satirlar(TROLLEY_ONLY)).not.toContain("Köprü ağırlığı");
    // Arabanın kendi ağırlığı her hâlükârda kalır.
    expect(satirlar(TROLLEY_ONLY)).toContain("Ana araba ağırlığı");
  });

  it("başkiriş açıkken köprü ağırlığı GERİ GELİR", () => {
    // Başkiriş köprü ağırlığını okur; yalnız köprü yürütmeye bağlansaydı
    // hesaba giren bir sayı belgeden sessizce düşerdi.
    const yalnizBaskiris = calcFor(["bridge", "wheelLoads", "girder", "girder2", "buckling"]);
    const satirlar = buildSummarySections(yalnizBaskiris, runCalc(yalnizBaskiris))
      .flatMap((s) => s.rows)
      .map((r) => r.label);
    expect(satirlar).toContain("Köprü ağırlığı");
  });
});

describe("elle eklenen satırlar (extras)", () => {
  it("kapalı bölümün adını taşıyan ek satır o başlığı DİRİLTMEZ", () => {
    const groups = mergeExtras(
      buildEquipmentGroups(TROLLEY_ONLY),
      [
        {
          group: "Köprü Yürütme",
          component: "Elle eklenen kalem",
          brand: "",
          model: "",
          spec: "",
          qty: "1",
        },
      ],
      absentModuleGroupNames(TROLLEY_ONLY)
    );
    const adlar = groups.map((g) => g.name);
    expect(adlar).not.toContain("Köprü Yürütme");
    // Satır SİLİNMEZ — kullanıcının kendi kalemidir, yalnız başlığı gitmez.
    expect(adlar).toContain("Ek Ekipman");
    expect(
      groups.find((g) => g.name === "Ek Ekipman")!.rows.map((r) => r.component)
    ).toContain("Elle Eklenen Kalem");
  });

  it("açık bölümün adını taşıyan ek satır kendi grubuna katılır", () => {
    const groups = mergeExtras(
      buildEquipmentGroups(TROLLEY_ONLY),
      [
        {
          group: "Ana Araba Yürütme",
          component: "Ek kalem",
          brand: "",
          model: "",
          spec: "",
          qty: "1",
        },
      ],
      absentModuleGroupNames(TROLLEY_ONLY)
    );
    expect(groups.map((g) => g.name)).not.toContain("Ek Ekipman");
    expect(
      groups.find((g) => g.name === "Ana Araba Yürütme")!.rows.some((r) => r.custom)
    ).toBe(true);
  });
});
