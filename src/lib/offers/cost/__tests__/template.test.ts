// VİNÇ TİPİNE GÖRE MALİYET ŞABLONU — çekirdeğin dışarıdan aldığı iskelet.
//
// Buradaki testlerin üçte biri BİR DEĞİŞMEZLİK içindir: şablon defteri
// kurulduktan sonra da, şablonu OLMAYAN bir vinç tipinde belge bugünküyle
// birebir aynı çıkmalıdır. Kalan üçte ikisi kullanıcının kararının gerçekten
// uygulandığını ve bir KAPATMANIN kayıtlı bir belgeden satır SİLMEDİĞİNİ
// ölçer — kapatılan satır fiyatı girilmiş bir maliyet çalışmasında durmaya
// devam eder (MALIYET-9'un "tazeleme ekleyicidir" kuralının aynısı).

import { describe, expect, it } from "vitest";
import { emptyItem, emptyPayload } from "../../payload";
import type { OfferItem, OfferPayload } from "../../types";
import { costItemFromOfferItem, emptyCostPayload, withOfferSync } from "../payload";
import {
  DEFAULT_ITEM_GROUP_KEYS,
  costGroupLineDefs,
  costTemplateFor,
  defaultCostSkeleton,
} from "../registry";
import type { CostTemplate } from "../types";

function kalem(craneType: string, groupKeys: string[] = ["general", "mainHoist", "trolley", "bridge"]): OfferItem {
  const item = emptyItem(`${craneType} — 10T x 20M`, groupKeys);
  item.craneType = craneType;
  return item;
}

function teklif(items: OfferItem[]): OfferPayload {
  return { ...emptyPayload("EUR"), items };
}

const anahtarlar = (item: ReturnType<typeof costItemFromOfferItem>, groupKey: string) =>
  item.groups.find((g) => g.key === groupKey)?.lines.map((l) => l.key) ?? [];

describe("şablon verilmezse bugünkü davranış birebir korunur", () => {
  it("varsayılan grup kümesi defterin kendi listesidir", () => {
    const k = costItemFromOfferItem(kalem("TEK KİRİŞLİ GEZER KÖPRÜLÜ VİNÇ"), 1);
    expect(k.groups.map((g) => g.key)).toEqual([...DEFAULT_ITEM_GROUP_KEYS]);
  });

  it("VARSAYILAN İSKELET ile şablonsuz çıktı AYNI belgeyi kurar", () => {
    // Şablon defterinin tohumu bu iskelettir (`defaultCostSkeleton`). İkisi
    // ayrışsaydı, defteri tohumlanmış bir tip ile hiç şablonu olmayan bir tip
    // farklı maliyet iskeleti üretir ve fark ancak toplamda fark edilirdi.
    const item = kalem("PORTAL VİNÇ", ["general", "mainHoist", "trolley", "gantry"]);
    const sablon: CostTemplate[] = [{ craneType: "PORTAL VİNÇ", skeleton: defaultCostSkeleton() }];
    const sablonsuz = costItemFromOfferItem(item, 1);
    const sablonlu = costItemFromOfferItem(item, 1, sablon);
    const iskelet = (k: typeof sablonsuz) =>
      k.groups.map((g) => ({ key: g.key, lines: g.lines.map((l) => l.key) }));
    expect(iskelet(sablonlu)).toEqual(iskelet(sablonsuz));
  });

  it("bilinmeyen vinç tipinde varsayılana düşülür", () => {
    const sablon: CostTemplate[] = [
      { craneType: "KALDIRMA KİRİŞİ", skeleton: { groupKeys: ["fabrication", "steel"] } },
    ];
    const k = costItemFromOfferItem(kalem("MONORAY VİNÇ"), 1, sablon);
    expect(k.groups.map((g) => g.key)).toEqual([...DEFAULT_ITEM_GROUP_KEYS]);
  });

  it("vinç tipi boşsa varsayılana düşülür", () => {
    expect(costTemplateFor([{ craneType: "PORTAL VİNÇ", skeleton: {} }], "")).toBeUndefined();
    expect(costTemplateFor(undefined, "PORTAL VİNÇ")).toBeUndefined();
  });
});

describe("şablon verilirse uygulanır", () => {
  const sablon: CostTemplate[] = [
    {
      craneType: "KALDIRMA KİRİŞİ",
      // Kaldırma kirişinde yürütme, elektrik ve saha montajı yoktur: çelik bir
      // yapı ve onun imalatıdır. Kullanıcının md. 10'daki örneği tam olarak bu
      // ayrımdır ("hangi grup vinçte hangi bölümler gelsin").
      skeleton: { groupKeys: ["fabrication", "steel"], closedLines: { steel: ["rail", "railA"] } },
    },
  ];

  it("yalnız şablondaki gruplar açılır", () => {
    const k = costItemFromOfferItem(kalem("KALDIRMA KİRİŞİ"), 1, sablon);
    expect(k.groups.map((g) => g.key)).toEqual(["fabrication", "steel"]);
  });

  it("kapatılan defter satırı belgede hiç açılmaz, kardeşleri durur", () => {
    const k = costItemFromOfferItem(kalem("KALDIRMA KİRİŞİ"), 1, sablon);
    expect(anahtarlar(k, "steel")).not.toContain("rail");
    expect(anahtarlar(k, "steel")).not.toContain("railA");
    expect(anahtarlar(k, "steel")).toContain("rawMaterial");
    expect(anahtarlar(k, "steel")).toContain("laserCut");
  });

  it("eşleşme KATLANMIŞ metinledir — yazım farkı tipi ayırmaz", () => {
    const kucuk = costItemFromOfferItem(kalem("Kaldırma Kirişi"), 1, sablon);
    expect(kucuk.groups.map((g) => g.key)).toEqual(["fabrication", "steel"]);
  });

  it("YARDIMCI KALDIRMA şablonun üstündedir — teklifte varsa yine açılır", () => {
    // Yardımcı kaldırma bir TERCİH değil bir OLGUDUR: teklif kalemi o bölümü
    // taşıyorsa vinçte ikinci bir kaldırma mekanizması gerçekten vardır ve
    // maliyeti bir şablon ayarı yüzünden hiç sorulmadan geçilemez.
    const item = kalem("KALDIRMA KİRİŞİ", ["general", "mainHoist", "auxHoist"]);
    const k = costItemFromOfferItem(item, 1, sablon);
    expect(k.groups.map((g) => g.key)).toEqual(["fabrication", "steel", "auxHoist"]);
  });

  it("şablona elle eklenen grup teklifte olmasa da açılır", () => {
    const genis: CostTemplate[] = [
      { craneType: "MONORAY VİNÇ", skeleton: { groupKeys: [...DEFAULT_ITEM_GROUP_KEYS, "auxHoist"] } },
    ];
    const k = costItemFromOfferItem(kalem("MONORAY VİNÇ"), 1, genis);
    expect(k.groups.map((g) => g.key)).toContain("auxHoist");
  });
});

describe("KAPATMA SİLME DEĞİLDİR", () => {
  const sablon: CostTemplate[] = [
    { craneType: "MONORAY VİNÇ", skeleton: { closedLines: { steel: ["railA"] } } },
  ];

  it("tazeleme kapatılan satırı geri koymaz", () => {
    const item = kalem("MONORAY VİNÇ");
    const p = { ...emptyCostPayload("EUR"), items: [costItemFromOfferItem(item, 1, sablon)] };
    const sonra = withOfferSync(p, teklif([item]), 0, sablon).payload;
    const celik = sonra.items[0].groups.find((g) => g.key === "steel")!;
    expect(celik.lines.map((l) => l.key)).not.toContain("railA");
  });

  it("belgede ZATEN duran satır kapatılsa da silinmez ve fiyatı korunur", () => {
    // Sonradan kapatılan bir kalemin girilmiş birim fiyatı tedarikçiyle
    // yapılmış bir görüşmedir; bir defter ayarı onu sessizce götüremez.
    const item = kalem("MONORAY VİNÇ");
    const p = { ...emptyCostPayload("EUR"), items: [costItemFromOfferItem(item, 1)] };
    const celik = p.items[0].groups.find((g) => g.key === "steel")!;
    const rayA = celik.lines.find((l) => l.key === "railA")!;
    rayA.qty = 120;
    rayA.unitPrice = 1.2;

    const sonra = withOfferSync(p, teklif([item]), 0, sablon).payload;
    const kalan = sonra.items[0].groups
      .find((g) => g.key === "steel")!
      .lines.find((l) => l.key === "railA");
    expect(kalan?.unitPrice).toBe(1.2);
    expect(kalan?.qty).toBe(120);
  });

  it("kapatılan satırın fiyat bağı da korunur — tazeleme onu kopyalamaz sanılmasın", () => {
    const acik = costGroupLineDefs("steel").map((l) => l.key);
    const kapali = costGroupLineDefs("steel", { closedLines: { steel: ["railA"] } }).map((l) => l.key);
    expect(acik).toContain("railA");
    expect(kapali).not.toContain("railA");
    expect(kapali.length).toBe(acik.length - 1);
  });
});
