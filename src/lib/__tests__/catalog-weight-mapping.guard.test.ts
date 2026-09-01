// KATALOG AĞIRLIĞI KORUMA TESTİ — ürünün kilosu revizyona akıyor mu.
//
// NEDEN: katalog ağırlığı uzun süre YALNIZ İKİ yerde revizyona yazılıyordu
// (halat kg/m ve KALDIRMA redüktörü). Motor, fren, kaplin, rulman, teker,
// kanca, makara ve tampon ağırlıkları `cat_equipment.attrs.weight_kg` içinde
// VARDI ama snapshot'a hiç girmiyordu; boşluk sessizdi çünkü hiçbir hesap o
// sayıyı okumuyordu. YÜRÜTME redüktörü (5.5) tam bu sessizliğin içinde
// kalmıştı: kardeş bölümü 2.3 ağırlığı taşırken o taşımıyordu.
//
// Bu dosya o sessizliği kırar: ağırlık taşıyan bir katalog türünü kullanan her
// bölüm eşlemesinde bir `*WeightKg` alanı BULUNMAK ZORUNDADIR. Bulunmuyorsa
// ya eşleme eksiktir ya da gerekçesi aşağıdaki muafiyet listesine yazılmalıdır
// — ikisi de bilinçli bir karardır, sessiz bir boşluk değil.
//
// Kaynak `catalog_data/` klasörü DEPONUN DIŞINDADIR (workspace kökünde) ve
// git'te tutulmaz; test bu yüzden onu okumaz. Ağırlık taşıyan türler burada
// açıkça sayılır ve türün değişmesi bu listenin de güncellenmesini gerektirir.

import { describe, expect, it } from "vitest";
import {
  applyCatalogPick,
  getCatalogMapping,
  type SectionCatalogMapping,
} from "../catalog-mapping";
import { buildEquipmentGroups } from "../excel/equipment";
import { NEW_WORK_TEMPLATE } from "../calc/defaults";
import type { CalcInput } from "../calc/engine";
import { HOIST_SECTIONS } from "../calc/presentation/hoistSections";
import { HOOKBLOCK_SECTIONS } from "../calc/presentation/hookBlockSections";
import { TRAVEL_SECTIONS } from "../calc/presentation/travelSections";
import { CABIN_SECTIONS } from "../calc/presentation/cabinSections";

/**
 * `attrs.weight_kg` (halatta `weight_kg_per_m`) yayımlayan katalog türleri.
 * Ölçüm `catalog_data/` üzerinde yapıldı: 12 türün 12'sinde ağırlık var.
 */
const AGIRLIK_TASIYAN_TURLER = new Set([
  "motor",
  "gearbox",
  "brake",
  "bearing",
  "coupling",
  "buffer",
  "wheel",
  "hook",
  "sheave",
  "rope",
  "load_cell",
  "wedge_socket",
]);

/**
 * Katalogda ağırlık YAYIMLANMAYAN türler — eşleme eklenmez, uydurulmaz
 * (değişmez md. 4). Döküm bu satırlarda "—" basar ve sebebini yazar.
 */
const AGIRLIKSIZ_TURLER = new Set(["bearing_housing", "air_conditioner", "festoon"]);

/**
 * Gerekçeli muafiyetler: ağırlık taşıyan bir türü kullandığı hâlde ağırlığı
 * revizyona yazmayan bölümler. Liste BOŞ değilse her satırın sebebi buradadır.
 */
const MUAFLAR: Record<string, string> = {
  // Halat AĞIRLIĞI adet × metre ağırlığı × boy olarak türetilir; katalogda
  // toplam kilo yoktur, `weight_kg_per_m` vardır ve o zaten eşlenmiştir.
  "2.1": "halatta metre ağırlığı eşlenir (`ropeWeightKgPerM`), toplam kilo türetilir",
};

const BOLUMLER: { modul: string; idler: readonly string[] }[] = [
  { modul: "main", idler: HOIST_SECTIONS.map((s) => s.id) },
  { modul: "hookBlock", idler: HOOKBLOCK_SECTIONS.map((s) => s.id) },
  { modul: "trolley", idler: TRAVEL_SECTIONS.map((s) => s.id) },
  { modul: "cabin", idler: CABIN_SECTIONS.map((s) => s.id) },
];

function agirlikAlanlari(mapping: SectionCatalogMapping): string[] {
  return mapping.fields.filter((f) => f.sel.endsWith("WeightKg")).map((f) => f.sel);
}

describe("katalog ağırlığı revizyona akar", () => {
  it("ağırlık taşıyan her katalog türünde eşleme bir *WeightKg alanı yazar", () => {
    const eksik: string[] = [];
    for (const { modul, idler } of BOLUMLER) {
      for (const id of idler) {
        const mapping = getCatalogMapping(modul, id);
        if (!mapping) continue;
        if (!AGIRLIK_TASIYAN_TURLER.has(mapping.kind)) continue;
        if (MUAFLAR[id] !== undefined) continue;
        if (agirlikAlanlari(mapping).length === 0) {
          eksik.push(`${modul} ${id} (${mapping.kind})`);
        }
      }
    }
    expect(eksik).toEqual([]);
  });

  it("ağırlığı katalogda yayımlanmayan türe UYDURMA eşleme yazılmaz", () => {
    const uydurma: string[] = [];
    for (const { modul, idler } of BOLUMLER) {
      for (const id of idler) {
        const mapping = getCatalogMapping(modul, id);
        if (!mapping || !AGIRLIKSIZ_TURLER.has(mapping.kind)) continue;
        if (agirlikAlanlari(mapping).length > 0) {
          uydurma.push(`${modul} ${id} (${mapping.kind})`);
        }
      }
    }
    expect(uydurma).toEqual([]);
  });

  it("iki kardeş redüktör bölümü de ağırlık taşır (5.5'teki eski boşluk)", () => {
    const kaldirma = getCatalogMapping("main", "2.3")!;
    const yurutme = getCatalogMapping("trolley", "5.5")!;
    expect(agirlikAlanlari(kaldirma)).toContain("gearboxWeightKg");
    expect(agirlikAlanlari(yurutme)).toContain("gearboxWeightKg");
  });

  it("aralıklı katalog ağırlığında alt sınır ve ÜST sınır ayrı alanlara gider", () => {
    // Jaure kaplinleri kiloyu `weight_min_kg`/`weight_max_kg` olarak yayımlar;
    // tek sayıya indirmek katalogda olmayan bir kesinlik uydurmak olurdu.
    for (const [modul, id, alt, ust] of [
      ["main", "2.6", "motorCouplingWeightKg", "motorCouplingWeightMaxKg"],
      ["main", "2.7", "drumCouplingWeightKg", "drumCouplingWeightMaxKg"],
      ["trolley", "5.6", "motorCouplingWeightKg", "motorCouplingWeightMaxKg"],
      ["trolley", "5.7", "wheelCouplingWeightKg", "wheelCouplingWeightMaxKg"],
    ] as const) {
      const mapping = getCatalogMapping(modul, id)!;
      const selAdlari = mapping.fields.map((f) => f.sel);
      expect(selAdlari, `${modul} ${id}`).toContain(alt);
      expect(selAdlari, `${modul} ${id}`).toContain(ust);
      // Alt sınır İKİ kaynaktan doldurulur: `weight_kg` yoksa `weight_min_kg`.
      // İkisi aynı üründe bulunmaz (ölçüldü: 0 dosya), yani sıra bir tercih
      // değil bir yedektir.
      const altKaynaklar = mapping.fields
        .filter((f) => f.sel === alt)
        .map((f) => (typeof f.from === "object" ? f.from.attr : f.from));
      expect(altKaynaklar, `${modul} ${id}`).toEqual(["weight_kg", "weight_min_kg"]);
    }
  });
});

// ————————————————————————— uçtan uca: katalogdan satıra

describe("katalog ağırlığı satıra kadar gelir", () => {
  it("applyCatalogPick motor ağırlığını seçime yazar", () => {
    const mapping = getCatalogMapping("trolley", "5.4")!;
    const secim = applyCatalogPick(mapping, {
      id: "x",
      brand: "GAMAK",
      model: "11 kW 4K 160M",
      attrs: { power_kw: 11, rpm: 1460, shaft_mm: 42, weight_kg: 116 },
    });
    expect(secim.motorWeightKg).toBe(116);
  });

  it("ekipman satırı ağırlığı taşır; olmayan üründe alan HİÇ YAZILMAZ", () => {
    const temel = NEW_WORK_TEMPLATE;
    const input: CalcInput = {
      ...temel,
      bridge: {
        ...temel.bridge!,
        selections: { ...temel.bridge!.selections, motorWeightKg: 116 },
      },
    };
    const satirlar = buildEquipmentGroups(input).flatMap((g) => g.rows);
    const motor = satirlar.find((r) => r.rowKey === "bridge:motor");
    expect(motor?.weightKg).toBe(116);

    // Ağırlığı seçilmemiş bir ürün `0` DEĞİL, ALANSIZ gelir (değişmez md. 4):
    // döküm o satırda "—" basar, sıfır sayıp toplamı küçültmez.
    const teker = satirlar.find((r) => r.rowKey === "bridge:wheel");
    expect(teker).toBeDefined();
    expect(teker && "weightKg" in teker).toBe(false);
  });

  it("kasnak freninde ağırlık FREN + İTİCİdir (HESAP-27), katalogun kg* değeri değil", () => {
    const temel = NEW_WORK_TEMPLATE;
    const input: CalcInput = {
      ...temel,
      mainHoist: {
        ...temel.mainHoist!,
        selections: {
          ...temel.mainHoist!.selections,
          brakeModel: "TE315/50/6",
          // Katalogun kg* sütunu İTİCİ HARİÇTİR; defter toplamı kazanmalı.
          brakeWeightKg: 50,
        },
      },
    };
    const fren = buildEquipmentGroups(input)
      .flatMap((g) => g.rows)
      .find((r) => r.rowKey === "main:brake");
    // TE 315/50/6 → 50 kg fren + 23 kg Eldro Ed 50/6 = 73 kg.
    expect(fren?.weightKg).toBe(73);
  });
});
