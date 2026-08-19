// MALİYET TOPLAMLARININ VE ORAN TABANININ DOĞRULANMASI.
//
// Buradaki en önemli test ORAN TABANIDIR. "Sarf %2, finansman %2, sabit %15
// toplam maliyete oranı" cümlesi iki farklı sayı üretebiliyordu ve fark
// gerçekti: 194.258 €'luk bir proje maliyeti proje tabanıyla 231.167 €,
// kendi kendini içeren tabanla 239.825 € toplam verir. Kullanıcıya SORULDU ve
// PROJE MALİYETİ tabanı seçildi (17.08.2026). Aşağıdaki test o kararı
// donduruyor: taban sessizce değişirse her teklifin kâr marjı kayar.

import { describe, expect, it } from "vitest";
import { emptyItem, emptyPayload } from "../../payload";
import type { OfferPayload } from "../../types";
import { emptyCostPayload, freeCostItem, newCostId } from "../payload";
import {
  costBreakdown,
  costItemPackageTotal,
  costLineAmount,
  costMargin,
  costOverview,
  costPerKg,
  costTotals,
  loadedCostByOfferItem,
  withCostTotals,
} from "../totals";
import type { CostItem, CostLine, CostPayload } from "../types";

function satir(qty: number | null, unitPrice: number | null, extra: Partial<CostLine> = {}): CostLine {
  return { id: newCostId(), key: "x", label: "X", qty, unit: "takım", unitPrice, ...extra };
}

/** Tek kalemli, tek satırlı, ASTOR'un proje maliyetini taşıyan bir belge. */
function astorBelgesi(offerItemId: string | null = "teklif-1"): CostPayload {
  const item: CostItem = {
    ...freeCostItem("ASTOR 32T PORTAL"),
    offerItemId,
    groups: [
      {
        id: newCostId(),
        key: "steel",
        title: "ÇELİK YAPI",
        lines: [satir(1, 194257.74)],
      },
    ],
  };
  return { ...emptyCostPayload("EUR"), items: [item] };
}

describe("satır ve grup toplamı", () => {
  it("miktarı ya da fiyatı eksik satır toplama GİRMEZ, sıfır sayılmaz", () => {
    expect(costLineAmount(satir(null, 100))).toBeNull();
    expect(costLineAmount(satir(2, null))).toBeNull();
    expect(costLineAmount(satir(2, 100))).toBe(200);
  });

  it("gizli satır toplama girmez", () => {
    expect(costLineAmount(satir(2, 100, { hidden: true }))).toBeNull();
  });

  it("hiç tutarı olmayan kalem null döner — sıfır DEĞİL", () => {
    const p = { ...emptyCostPayload(), items: [freeCostItem("BOŞ")] };
    expect(costTotals(p).direct).toBeNull();
    expect(costTotals(p).total).toBeNull();
  });
});

describe("ORAN TABANI PROJE MALİYETİDİR (kullanıcı kararı)", () => {
  const t = costTotals(astorBelgesi());

  it("proje maliyeti satırların toplamıdır", () => {
    expect(t.direct).toBeCloseTo(194257.74, 2);
  });

  it("sabit %15, sarf %2, finansman %2 PROJE maliyeti üzerinden hesaplanır", () => {
    const oran = (k: string) => t.rates.find((r) => r.key === k)?.amount ?? null;
    expect(oran("fixed")).toBeCloseTo(194257.74 * 0.15, 2);
    expect(oran("consumable")).toBeCloseTo(194257.74 * 0.02, 2);
    expect(oran("finance")).toBeCloseTo(194257.74 * 0.02, 2);
  });

  it("toplam maliyet 231.167 € olur — 239.825 € DEĞİL", () => {
    expect(t.total).toBeCloseTo(194257.74 * 1.19, 2);
    expect(t.total).toBeCloseTo(231166.71, 2);
    // Kendi kendini içeren taban seçilseydi çıkacak sayı:
    expect(t.total).not.toBeCloseTo(194257.74 / 0.81, 2);
  });
});

describe("oranlı grupta İKİ KAYNAK TOPLANMAZ", () => {
  it("oran kipinde satırlar okunmaz", () => {
    const p = astorBelgesi();
    p.rates = p.rates.map((r) =>
      r.key === "fixed" ? { ...r, mode: "oran", percent: 15, lines: [satir(1, 999999)] } : r
    );
    const sabit = costTotals(p).rates.find((r) => r.key === "fixed");
    expect(sabit?.amount).toBeCloseTo(194257.74 * 0.15, 2);
  });

  it("kalem kipinde yüzde okunmaz", () => {
    const p = astorBelgesi();
    p.rates = p.rates.map((r) =>
      r.key === "fixed" ? { ...r, mode: "kalem", percent: 15, lines: [satir(1, 12000)] } : r
    );
    const sabit = costTotals(p).rates.find((r) => r.key === "fixed");
    expect(sabit?.amount).toBe(12000);
  });
});

describe("paket maliyet ve proje geneli", () => {
  it("adet birim maliyeti çarpar", () => {
    const p = astorBelgesi();
    p.items[0].qty = 3;
    expect(costItemPackageTotal(p.items[0])).toBeCloseTo(194257.74 * 3, 2);
    expect(costTotals(p).direct).toBeCloseTo(194257.74 * 3, 2);
  });

  it("proje geneli oran tabanına GİRER", () => {
    const p = astorBelgesi();
    p.general.lines = [satir(1, 10000)];
    const t = costTotals(p);
    expect(t.general).toBe(10000);
    expect(t.direct).toBeCloseTo(204257.74, 2);
    expect(t.rates.find((r) => r.key === "fixed")?.amount).toBeCloseTo(204257.74 * 0.15, 2);
  });
});

describe("yüklü maliyetin teklif kalemine dağıtımı", () => {
  it("proje geneli ve oranlar doğrudan maliyet payına göre dağılır", () => {
    const p = astorBelgesi();
    p.general.lines = [satir(1, 10000)];
    const t = costTotals(p);
    const yuklu = loadedCostByOfferItem(t);
    // Tek kalem var: bütün yük ona düşer, yani toplam maliyetin tamamı.
    expect(yuklu["teklif-1"]).toBeCloseTo(t.total as number, 6);
  });

  it("iki kalemde dağıtım doğrudan maliyet oranındadır", () => {
    const p = astorBelgesi("teklif-1");
    p.items.push({
      ...freeCostItem("İKİNCİ VİNÇ"),
      offerItemId: "teklif-2",
      groups: [{ id: newCostId(), key: "steel", title: "ÇELİK YAPI", lines: [satir(1, 100000)] }],
    });
    p.general.lines = [satir(1, 6000)];
    const t = costTotals(p);
    const yuklu = loadedCostByOfferItem(t);
    const toplam = (yuklu["teklif-1"] ?? 0) + (yuklu["teklif-2"] ?? 0);
    expect(toplam).toBeCloseTo(t.total as number, 4);
    expect(yuklu["teklif-1"]).toBeGreaterThan(yuklu["teklif-2"]);
  });

  it("teklif kalemine bağlı olmayan maliyet kalemi dağıtıma girmez", () => {
    const p = astorBelgesi(null);
    expect(Object.keys(loadedCostByOfferItem(costTotals(p)))).toHaveLength(0);
  });
});

describe("kırılım", () => {
  it("grup toplamları ve payları proje maliyetine göredir", () => {
    const p = astorBelgesi();
    p.general.lines = [satir(1, 5742.26)];
    const t = costTotals(p);
    const k = costBreakdown(p, t);
    const celik = k.find((r) => r.key === "steel");
    expect(celik?.amount).toBeCloseTo(194257.74, 2);
    expect(celik?.share).toBeCloseTo(194257.74 / 200000, 6);
    expect(k.find((r) => r.key === "general")?.amount).toBeCloseTo(5742.26, 2);
  });
});

describe("kâr", () => {
  it("marj satış, markup maliyet üzerindendir ve ikisi FARKLIDIR", () => {
    const m = costMargin(259010.32, 194257.74);
    expect(m.profit).toBeCloseTo(64752.58, 2);
    expect(m.marginPercent).toBeCloseTo(25, 4);
    expect(m.markupPercent).toBeCloseTo(33.333, 3);
  });

  it("fiyat ya da maliyet yoksa kâr hesaplanmaz", () => {
    expect(costMargin(null, 100).profit).toBeNull();
    expect(costMargin(100, null).marginPercent).toBeNull();
  });

  it("€/kg ağırlık yoksa hesaplanmaz", () => {
    expect(costPerKg(194257.74, 59500)).toBeCloseTo(3.2648, 4);
    expect(costPerKg(194257.74, null)).toBeNull();
    expect(costPerKg(194257.74, 0)).toBeNull();
  });
});

// ————————————————————————————————————————————————————————— özet

/**
 * Üç fiyat satırlı bir teklif: biri KALEME BAĞLI, ikisi serbest.
 *
 * Kaleme bağlı satırın `manualCost`u bilerek DOLUDUR — ekran onu okumaz
 * (MALIYET-11) ve özet de okumamalıdır; bağ koparsa veri geri gelsin diye
 * belgede durur. Üçüncü satır toplama girmez (`inTotal: false`).
 */
function teklifBelgesi(): OfferPayload {
  const p = emptyPayload("EUR");
  return {
    ...p,
    pricing: {
      ...p.pricing,
      lines: [
        {
          id: "f1",
          itemId: "teklif-1",
          description: "ASTOR 32T PORTAL VİNÇ",
          qty: 1,
          unit: "Takım",
          unitPrice: 259010.32,
          inTotal: true,
          manualCost: 99999,
        },
        {
          id: "f2",
          itemId: null,
          description: "NAKLİYE",
          qty: 1,
          unit: "Takım",
          unitPrice: 8000,
          inTotal: true,
          manualCost: 6200,
        },
        {
          id: "f3",
          itemId: null,
          description: "MOBİL VİNÇ — GÜNLÜK",
          qty: 1,
          unit: "Gün",
          unitPrice: 3000,
          inTotal: false,
          manualCost: 2500,
        },
      ],
    },
  };
}

describe("MALİYET ÖZETİ — teklif ve maliyet TEK yapıda", () => {
  const p = astorBelgesi();
  p.items[0].qty = 2;
  const t = costTotals(p, { [p.items[0].id]: 59500 });
  const ozet = costOverview(t, teklifBelgesi(), { [p.items[0].id]: 51000 });

  it("ağırlıklar ADETLE ÇARPILIR; birim ağırlık ayrı sütunda kalır", () => {
    // `CostTotals.items[].weightKg` BİR adedin ağırlığıdır. Çarpmayı unutmak
    // iki vinçlik bir teklifte toplam ağırlığı yarı gösterirdi.
    expect(ozet.items[0].steelKg).toBe(51000);
    expect(ozet.items[0].weightKg).toBe(59500);
    expect(ozet.items[0].steelPackageKg).toBe(102000);
    expect(ozet.items[0].weightPackageKg).toBe(119000);
    expect(ozet.steelKg).toBe(102000);
    expect(ozet.weightKg).toBe(119000);
  });

  it("birim ve paket maliyet toplamlardan gelir, yeniden hesaplanmaz", () => {
    expect(ozet.items[0].unit).toBeCloseTo(194257.74, 2);
    expect(ozet.items[0].package).toBeCloseTo(194257.74 * 2, 2);
    expect(ozet.documentTotal).toBeCloseTo(t.total as number, 6);
  });

  it("YALNIZ SERBEST satırın elle maliyeti eklenir — kaleme bağlı satırınki ZATEN belgededir", () => {
    // Kaleme bağlı satırın maliyeti maliyet belgesinin içindedir; ikinci kez
    // eklemek onu ÇİFT SAYARDI (MALIYET-11).
    expect(ozet.manualLines.map((l) => l.description)).toEqual(["NAKLİYE"]);
    expect(ozet.manualTotal).toBe(6200);
    expect(ozet.margin.cost).toBeCloseTo((t.total as number) + 6200, 6);
  });

  it("toplama girmeyen satır (inTotal: false) maliyete de girmez", () => {
    // Teklifin toplamına girmeyen bir satırın maliyetini saymak kârı
    // olduğundan DÜŞÜK gösterirdi; süzgeç teklifin kendi süzgecidir.
    expect(ozet.manualLines.some((l) => l.description.startsWith("MOBİL"))).toBe(false);
  });

  it("teklif tutarı ve iki kâr oranı birlikte verilir", () => {
    expect(ozet.margin.price).toBeCloseTo(259010.32 + 8000, 2);
    expect(ozet.margin.profit).toBeCloseTo(
      267010.32 - ((t.total as number) + 6200),
      6
    );
    expect(ozet.margin.marginPercent).not.toBeNull();
    expect(ozet.margin.markupPercent).not.toBeNull();
  });

  it("KÂR İSKONTOLU tutardan hesaplanır — pazarlıkta konuşulan odur", () => {
    const teklif = teklifBelgesi();
    const iskontolu: OfferPayload = {
      ...teklif,
      pricing: { ...teklif.pricing, discountTotal: 250000 },
    };
    const o = costOverview(t, iskontolu, {});
    expect(o.margin.price).toBe(250000);
    expect(o.margin.profit).toBeCloseTo(250000 - (o.margin.cost as number), 6);
  });

  it("maliyeti açılmamış teklif kalemi SAYILMAZ ama SÖYLENİR", () => {
    // Teklifte duran, maliyette karşılığı olmayan bir vinç fiyat toplamına
    // girer ve maliyet toplamına girmez; sessizce atlamak kârı olduğundan
    // yüksek gösterirdi.
    const teklif = teklifBelgesi();
    const iki: OfferPayload = {
      ...teklif,
      items: [
        { ...emptyItem("ASTOR 32T PORTAL VİNÇ", ["general"]), id: "teklif-1" },
        { ...emptyItem("İKİNCİ VİNÇ — MALİYETSİZ", ["general"]), id: "teklif-2" },
      ],
    };
    const o = costOverview(t, iki, {});
    expect(o.items.map((i) => i.offerItemId)).toEqual(["teklif-1"]);
    expect(o.uncostedItems.map((i) => i.id)).toEqual(["teklif-2"]);
  });

  it("hiç tutar yoksa null döner — SIFIR DEĞİL", () => {
    const bos = { ...emptyCostPayload(), items: [freeCostItem("BOŞ")] };
    const o = costOverview(costTotals(bos), emptyPayload("EUR"));
    expect(o.documentTotal).toBeNull();
    expect(o.manualTotal).toBeNull();
    expect(o.margin.cost).toBeNull();
    expect(o.margin.price).toBeNull();
    expect(o.steelKg).toBeNull();
    expect(o.weightKg).toBeNull();
  });
});

describe("toplam payload'a yazılır", () => {
  it("withCostTotals direct ve total alanlarını doldurur", () => {
    const p = withCostTotals(astorBelgesi());
    expect(p.direct).toBeCloseTo(194257.74, 2);
    expect(p.total).toBeCloseTo(231166.71, 2);
  });

  it("değişmemişse AYNI nesne döner (gereksiz kaydetme tetiklenmesin)", () => {
    const p = withCostTotals(astorBelgesi());
    expect(withCostTotals(p)).toBe(p);
  });
});
