// Ray defteri ve İKİ KUTULU ray seçimi.
//
// Ray seçimi 23.08.2026'da tek kutudan iki kutuya çıktı: önce AİLE (A tipi /
// S tipi / kare-dikdörtgen), sonra o ailenin ölçüleri. Bu dosya defterin
// kendisini (aile bütünlüğü, baş genişliği, metre ağırlığı) ve iki kutunun
// birbirine bağlanışını kilitler.

import { describe, expect, it } from "vitest";
import {
  RAILS,
  RAIL_FAMILIES,
  RAIL_FAMILY_LABELS,
  railCodesOfFamily,
  railFamilyOf,
  railMassKgPerM,
  railNominalHeadWidthMm,
} from "../tables";
import { RAIL_CODE_LABELS, TRAVEL_SELECTION_FIELDS } from "../presentation/travelFields";
import { railCodeFrom } from "@/lib/offers/cost/payload";
import { CALC_FIELD, loadRevision, migrateRailFamily } from "@/lib/revision-load";
import { NEW_WORK_SPECS } from "../defaults";
import { MODULE_ORDER, isTravelKey } from "../presentation/module-family";
import type { TravelSelections } from "../modules/travelGroup";

/** Çelik yoğunluğu [kg/cm³] — çubuk rayın metre ağırlığı bundan çıkar. */
const STEEL = 0.00785;

const railCodeField = TRAVEL_SELECTION_FIELDS.find((f) => f.key === "railCode")!;
const railFamilyField = TRAVEL_SELECTION_FIELDS.find((f) => f.key === "railFamily")!;

describe("ray defteri", () => {
  it("her rayın ailesi tanımlı ve tanınan bir ailedir", () => {
    for (const [code, row] of Object.entries(RAILS)) {
      expect(RAIL_FAMILIES as readonly string[], code).toContain(row.family);
    }
  });

  it("her ailenin adı ve en az bir rayı vardır", () => {
    for (const family of RAIL_FAMILIES) {
      expect(RAIL_FAMILY_LABELS[family], family).toBeTruthy();
      expect(railCodesOfFamily(family).length, family).toBeGreaterThan(0);
    }
  });

  it("aile listeleri defteri TAM ve ÇAKIŞMASIZ böler", () => {
    const parcalar = RAIL_FAMILIES.flatMap((f) => railCodesOfFamily(f));
    expect(new Set(parcalar).size).toBe(parcalar.length); // çakışma yok
    expect(parcalar.sort()).toEqual(Object.keys(RAILS).sort()); // eksik yok
  });

  it("A ve S serisinde metre ağırlığı TABLODAN gelir, çubukta kesitten", () => {
    for (const [code, row] of Object.entries(RAILS)) {
      const mass = railMassKgPerM(code, STEEL);
      expect(mass, code).not.toBeNull();
      if (row.family === "bar") {
        expect(row.massKgPerM, code).toBeUndefined();
        const [a, b] = code.split("x").map(Number);
        expect(mass!, code).toBeCloseTo(((a * b) / 100) * 100 * STEEL, 6);
      } else {
        expect(row.massKgPerM, code).toBeGreaterThan(0);
        expect(mass, code).toBe(row.massKgPerM);
      }
    }
  });

  it("A serisinde baş genişliği ile metre ağırlığı bir arada BÜYÜR", () => {
    // A serisi TEK standarttır (DIN 536-1 Form A): kesit ailesi kendi içinde
    // ölçeklenir, daha ağır ray daha dar başlı olamaz. S serisinde bu kural
    // GEÇMEZ — orada satırlar dört ayrı normdan gelir (aşağıdaki teste bakın).
    const rows = railCodesOfFamily("a")
      .map((code) => ({
        code,
        head: railNominalHeadWidthMm(code),
        mass: RAILS[code].massKgPerM!,
      }))
      .sort((x, y) => x.mass - y.mass);
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i].head, `${rows[i].code} vs ${rows[i - 1].code}`)
        .toBeGreaterThan(rows[i - 1].head);
    }
  });

  it("S serisinde TİP NUMARASI metre ağırlığını söyler", () => {
    // S serisi dört ayrı normdan derlenmiştir (DIN 5901 · DIN 17100 ·
    // NF A 45-310 · E1), o yüzden baş genişliği ağırlıkla birlikte sıralanmaz
    // (S31 S30'dan ağır ama daha dar başlıdır — daha yüksek kesit). Ortak
    // dilbilgisi tip numarasıdır: "S24" ≈ 24 kg/m.
    const rows = railCodesOfFamily("s").map((code) => ({
      code,
      nr: Number(code.slice(1)),
      mass: RAILS[code].massKgPerM!,
    }));
    for (const r of rows) {
      expect(Math.abs(r.mass - r.nr) / r.nr, r.code).toBeLessThan(0.11);
    }
    const artan = [...rows].sort((x, y) => x.nr - y.nr);
    for (let i = 1; i < artan.length; i++) {
      expect(artan[i].mass, `${artan[i].code} vs ${artan[i - 1].code}`)
        .toBeGreaterThan(artan[i - 1].mass);
    }
  });

  it("S serisi kullanıcı çizelgesini birebir taşır", () => {
    // Baş genişliği C [mm] ve kg/m — üretici hafif ray çizelgesi.
    const beklenen: Record<string, [number, number]> = {
      S10: [33, 11.0], S14: [38, 14.0], S18: [43, 18.3], S20: [44, 21.0],
      S24: [53, 24.43], S30: [60, 30.03], S31: [56, 31.57], S39: [66, 39.8],
      S41: [63, 40.0], S46: [64, 46.0], S49: [67, 49.46],
    };
    expect(railCodesOfFamily("s").sort()).toEqual(Object.keys(beklenen).sort());
    for (const [code, [head, mass]] of Object.entries(beklenen)) {
      expect(RAILS[code].headWidth, code).toBe(head);
      expect(RAILS[code].massKgPerM, code).toBe(mass);
      // Köşe yarıçapı yayımlanmadığı için etkin genişlik = anma genişliği.
      expect(railNominalHeadWidthMm(code), code).toBe(head);
    }
  });

  it("kare/dikdörtgen kodunun İLK sayısı ray başının genişliğidir", () => {
    for (const code of railCodesOfFamily("bar")) {
      expect(RAILS[code].headWidth, code).toBe(Number(code.split("x")[0]));
    }
  });

  it("kullanıcı çizelgesindeki çubuk ölçüleri defterde vardır", () => {
    for (const code of [
      "40x40", "40x30", "50x50", "50x30", "60x60", "60x40",
      "100x100", "100x50", "120x80",
    ]) {
      expect(RAILS[code], code).toBeDefined();
      expect(RAILS[code].family, code).toBe("bar");
    }
  });
});

describe("ray ailesi çözümü", () => {
  it("defterdeki her kodu kendi ailesine çözer", () => {
    for (const [code, row] of Object.entries(RAILS)) {
      expect(railFamilyOf(code), code).toBe(row.family);
    }
  });

  it("defterde olmayan kodu YAZIMINDAN çıkarır (eski kayıtlar)", () => {
    expect(railFamilyOf("A130")).toBe("a");
    expect(railFamilyOf("S7")).toBe("s");
    expect(railFamilyOf("90x60")).toBe("bar");
    expect(railFamilyOf(undefined)).toBe("bar");
  });
});

describe("iki kutulu ray seçimi", () => {
  it("aile kutusu bütün aileleri adlarıyla listeler", () => {
    expect(railFamilyField.options).toEqual(RAIL_FAMILIES);
    for (const family of RAIL_FAMILIES) {
      expect(railFamilyField.optionLabels?.[family], family).toBe(RAIL_FAMILY_LABELS[family]);
    }
  });

  it("ölçü kutusu YALNIZ seçilen ailenin raylarını gösterir", () => {
    for (const family of RAIL_FAMILIES) {
      const opts = railCodeField.optionsFrom!({ railFamily: family, railCode: "" });
      expect([...opts].sort(), family).toEqual(railCodesOfFamily(family).sort());
    }
  });

  it("aile alanı boş eski kayıtta liste KODUN ailesinden kurulur", () => {
    const opts = railCodeField.optionsFrom!({ railCode: "A75" });
    expect(opts).toContain("A75");
    expect(opts).not.toContain("50x50");
  });

  it("tanınmayan bir ailede liste boş kalmaz — tam defter düşer", () => {
    const opts = railCodeField.optionsFrom!({ railFamily: "yok", railCode: "" });
    expect([...opts].sort()).toEqual(Object.keys(RAILS).sort());
  });

  it("her kodun okunur bir etiketi vardır ve kodu ya da ölçüsünü söyler", () => {
    for (const [code, row] of Object.entries(RAILS)) {
      const label = RAIL_CODE_LABELS[code];
      expect(label, code).toBeTruthy();
      if (row.family === "bar") {
        expect(label, code).toContain(code.split("x")[0]);
      } else {
        expect(label, code).toContain(code);
      }
    }
  });
});

describe("serbest ray metninden katalog kodu", () => {
  it("A serisi, S serisi ve çubuk yazımlarını tanır", () => {
    expect(railCodeFrom("A55 DIN 536")).toBe("A55");
    expect(railCodeFrom("ray S 24")).toBe("S24");
    expect(railCodeFrom("60x40 ray")).toBe("60x40");
  });

  it("defterde olmayan kodu BOŞ döndürür (sessiz NaN üretmez)", () => {
    expect(railCodeFrom("A99")).toBe("");
    expect(railCodeFrom("S99")).toBe("");
    expect(railCodeFrom("77x33")).toBe("");
    expect(railCodeFrom(null)).toBe("");
  });
});

describe("eski kayıtta ray ailesi", () => {
  it("aile alanı yoksa KAYDIN KENDİ kodundan çözülür", () => {
    expect(
      (migrateRailFamily({ railCode: "A75" }, { railFamily: "bar", railCode: "A75" }) as
        { railFamily: string }).railFamily
    ).toBe("a");
  });

  it("kayıtta aile varsa göç HİÇ ÇALIŞMAZ (birleşmiş nesne olduğu gibi döner)", () => {
    // Kayıtta alan varsa `withDefaults` onu zaten taşımıştır; göçün orada
    // yapacağı bir iş yoktur ve nesneyi yeniden kurmaz.
    const merged = { railFamily: "s", railCode: "S24" };
    expect(migrateRailFamily({ railFamily: "s", railCode: "S24" }, merged)).toBe(merged);
  });

  it("yükleyici her yürütme ekseninde aileyi koda uydurur", () => {
    // A serisi rayla kaydedilmiş, aile alanı HİÇ olmayan eski bir revizyon.
    const stored: Record<string, unknown> = { specs: NEW_WORK_SPECS, disabledModules: [] };
    const sel: Record<string, unknown> = {};
    const travelKeys = MODULE_ORDER.filter(isTravelKey);
    for (const key of travelKeys) sel[CALC_FIELD[key]] = { railCode: "A65" };
    const loaded = loadRevision(stored, sel);
    const full = loaded.full as unknown as Record<string, { selections: TravelSelections }>;
    for (const key of travelKeys) {
      expect(full[CALC_FIELD[key]].selections.railFamily, key).toBe("a");
      expect(full[CALC_FIELD[key]].selections.railCode, key).toBe("A65");
    }
  });
});
