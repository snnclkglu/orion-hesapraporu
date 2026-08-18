// HAMMADDE FİYAT ŞERİDİ, DEFTER BAĞI VE GÖTÜRÜ KİP.
//
// Buradaki testler kullanıcının 18.08.2026'da tek tek saydığı SEKİZ FİYATI ve
// onların satırlara nasıl bağlandığını donduruyor. Üç şeyi birden korurlar:
//
//   1. RAY İKİ FİYATTIR (kare 0,90 · A tipi 1,20 €/kg). Tek bir "ray" anahtarı
//      kare ray kullanan bir vinçte %33 fazla, A tipi kullanan bir vinçte %25
//      eksik maliyet çıkarırdı ve hangisi olduğu ekrandan okunamazdı.
//   2. FİYATIN İKİ KAYNAĞI ASLA TOPLANMAZ (`lineQty`in ikizi): şeritten okunan
//      fiyat ile satırın elle yazılmış fiyatı aynı satırda yaşamaz. Şeritte
//      fiyat yoksa satır toplamdan DÜŞER, sıfır sayılmaz — girilmemiş bir sac
//      fiyatını sıfır saymak hammaddeyi bedava göstermenin en kısa yoluydu.
//   3. GÖTÜRÜ KİP SATIR SİLMEZ. Elektriği tek fiyata alan bir grup kalem
//      kipine döndüğünde girilmiş bütün tedarikçi fiyatları yerinde durur;
//      her biri bir görüşmedir.
//
// SAYILAR ASTOR FİKSTÜRÜNÜNDÜR: 32 T × 30 m portal vincin modelden çıkan
// 51.000 kg çeliği ve 59.500 kg toplam ağırlığı, kullanıcının kendi açılış
// fiyatlarıyla çarpılınca 97.665 € çelik yapı maliyeti verir. Uydurma yuvarlak
// bir sayı yerine bu kullanılıyor ki bir katsayı ya da bir bağ koptuğunda test
// hangi zincirin kırıldığını da söylesin.

import { describe, expect, it } from "vitest";
import { emptyItem, emptyPayload } from "../../payload";
import type { OfferItem, OfferPayload } from "../../types";
import {
  costGroupFromKey,
  emptyCostPayload,
  freeCostItem,
  linePrice,
  newCostId,
  printedCostPayload,
  withCostDefaults,
  withCostDerived,
  withLumpMode,
  withMaterialPrices,
  withOfferSync,
} from "../payload";
import {
  COST_GROUP_DEF_BY_KEY,
  MATERIAL_PRICE_DEFAULTS,
  MATERIAL_PRICE_DEFS,
  materialPriceDef,
} from "../registry";
import { costGroupTotal, costTotals } from "../totals";
import { costGroupLines, isLumpLine, lumpLineKey } from "../types";
import type { CostGroup, CostItem, CostLine, CostPayload } from "../types";

/** Şeridin bir kopyası — belge fiyatları defteri kirletmesin diye ayrı nesne. */
function serit(uzerine: Record<string, number | null> = {}): Record<string, number | null> {
  return { ...MATERIAL_PRICE_DEFAULTS, ...uzerine };
}

function satir(extra: Partial<CostLine> = {}): CostLine {
  return {
    id: newCostId(),
    key: "rawMaterial",
    label: "Hammadde — Sac",
    qty: 51000,
    unit: "kg",
    unitPrice: null,
    ...extra,
  };
}

/** Serbest bir grup — şerit bağını satır satır sınamak için. */
function grup(lines: CostLine[], key = "custom", title = "DENEME"): CostGroup {
  return { id: newCostId(), key, title, lines };
}

/** ASTOR 32 T × 30 m tam portal — `payload.test.ts`teki fikstürün aynısı. */
function portalKalemi(title = "32T x 30m ÇİFT KİRİŞ TAM PORTAL VİNÇ"): OfferItem {
  const item = emptyItem(title, ["general", "mainHoist", "trolley", "gantry", "steel", "electrical"]);
  const yaz = (groupKey: string, rowKey: string, parts: Record<string, string>) => {
    const g = item.groups.find((x) => x.key === groupKey);
    const r = g?.rows.find((x) => x.key === rowKey);
    if (r) r.parts = { ...r.parts, ...parts };
  };
  const deger = (groupKey: string, rowKey: string, value: string) => {
    const g = item.groups.find((x) => x.key === groupKey);
    const r = g?.rows.find((x) => x.key === rowKey);
    if (r) r.value = value;
  };
  yaz("general", "capacity", { main: "32" });
  yaz("general", "span", { value: "30" });
  yaz("general", "liftHeight", { value: "12" });
  yaz("general", "gantryLegHeight", { value: "12" });
  deger("general", "craneClass", "FEM 3m / M6");
  yaz("mainHoist", "liftSpeed", { range: "4" });
  yaz("trolley", "travelSpeed", { range: "20" });
  yaz("trolley", "motor", { count: "2" });
  yaz("gantry", "travelSpeed", { range: "20" });
  yaz("gantry", "motor", { count: "4" });
  yaz("gantry", "wheel", { count: "8" });
  item.craneType = "Portal Vinç";
  item.capacityT = 32;
  item.spanM = 30;
  return item;
}

function teklif(items: OfferItem[]): OfferPayload {
  return { ...emptyPayload("EUR"), items };
}

// ————————————————————————————————————————————————————— A) fiyat şeridi

describe("hammadde şeridi — kullanıcının kendi sekiz fiyatı (18.08.2026)", () => {
  it("şerit sekiz anahtarı BU SIRAYLA taşır — sıra ekranın sırasıdır", () => {
    expect(MATERIAL_PRICE_DEFS.map((d) => d.key)).toEqual([
      "sac",
      "profil",
      "rayKare",
      "rayA",
      "kesim",
      "celikIsciligi",
      "boya",
      "boyaIsciligi",
    ]);
  });

  it("varsayılanlar 0,70 · 0,65 · 0,90 · 1,20 · 0,05 · 0,90 · 0,08 · 0,07 €/kg", () => {
    expect(MATERIAL_PRICE_DEFS.map((d) => d.value)).toEqual([
      0.7, 0.65, 0.9, 1.2, 0.05, 0.9, 0.08, 0.07,
    ]);
  });

  it("RAY İKİ AYRI FİYATTIR — tek bir 'ray' anahtarı YOKTUR", () => {
    expect(MATERIAL_PRICE_DEFAULTS.rayKare).toBe(0.9);
    expect(MATERIAL_PRICE_DEFAULTS.rayA).toBe(1.2);
    expect(MATERIAL_PRICE_DEFAULTS.ray).toBeUndefined();
    expect(materialPriceDef("ray")).toBeUndefined();
    expect(materialPriceDef("rayKare")?.label).toBe("Kare Ray");
    expect(materialPriceDef("rayA")?.label).toBe("A Tipi Ray");
  });

  it("YENİ BELGE sekiz fiyatı kendi içine KOPYALAR", () => {
    expect(emptyCostPayload().materialPrices).toEqual({
      sac: 0.7,
      profil: 0.65,
      rayKare: 0.9,
      rayA: 1.2,
      kesim: 0.05,
      celikIsciligi: 0.9,
      boya: 0.08,
      boyaIsciligi: 0.07,
    });
  });

  it("kopyadır: belgede yükseltilen sac fiyatı defteri ve sonraki belgeyi ETKİLEMEZ", () => {
    const p = emptyCostPayload();
    p.materialPrices.sac = 0.82;
    expect(MATERIAL_PRICE_DEFAULTS.sac).toBe(0.7);
    expect(emptyCostPayload().materialPrices.sac).toBe(0.7);
    // İKİNCİ KİLİT: kopya bir gün unutulursa bile defter yazılamaz. Tek bir
    // belgenin sac fiyatı bütün sonraki belgeleri sessizce değiştiremez.
    expect(Object.isFrozen(MATERIAL_PRICE_DEFAULTS)).toBe(true);
  });
});

describe("TAŞIMA YOLU VARSAYILAN UYGULAMAZ (katsayıların tersi)", () => {
  it("bilerek boşaltılmış sac fiyatı 0,70'e GERİ DÖNMEZ", () => {
    const p = withCostDefaults({ materialPrices: { sac: null, profil: 0.62 } });
    expect(p.materialPrices.sac).toBeNull();
    expect(p.materialPrices.profil).toBe(0.62);
  });

  it("şeridi hiç yazmamış eski belgede fiyatlar BOŞ gelir, katsayılar varsayılana düşer", () => {
    const p = withCostDefaults({});
    expect(p.materialPrices).toEqual({});
    expect(p.materialPrices.sac).toBeUndefined();
    // Katsayı ise modelin çalışması için gereklidir; o varsayılana DÜŞER.
    expect(p.params.fireRate).toBe(0.1);
  });

  it("belgede yazılı fiyat olduğu gibi taşınır", () => {
    const p = withCostDefaults({ materialPrices: { sac: 0.82, rayA: 1.35 } });
    expect(p.materialPrices.sac).toBe(0.82);
    expect(p.materialPrices.rayA).toBe(1.35);
  });
});

// ———————————————————————————————————————— B) fiyatın iki kaynağı

describe("FİYATIN İKİ KAYNAĞI ASLA TOPLANMAZ", () => {
  it("şerit bağı varsa fiyat ŞERİTTEN okunur — satırın kendi sayısı değil", () => {
    expect(linePrice(satir({ priceSource: "sac", unitPrice: 9.99 }), serit())).toBe(0.7);
    expect(linePrice(satir({ priceSource: "rayKare" }), serit())).toBe(0.9);
    expect(linePrice(satir({ priceSource: "rayA" }), serit())).toBe(1.2);
  });

  it("priceManual açıksa SATIRIN KENDİ fiyatı geçerlidir, şerit ona dokunmaz", () => {
    const l = satir({ priceSource: "sac", priceManual: true, unitPrice: 0.82 });
    expect(linePrice(l, serit())).toBe(0.82);
    expect(withMaterialPrices({ ...emptyCostPayload(), general: grup([l]) }).general.lines[0].unitPrice).toBe(0.82);
  });

  it("şerit bağı olmayan satır her zaman ELLEDİR", () => {
    expect(linePrice(satir({ unitPrice: 12000 }), serit())).toBe(12000);
  });

  it("ŞERİTTE FİYAT YOKSA null döner ve satır toplama GİRMEZ — sıfır sayılmaz", () => {
    expect(linePrice(satir({ priceSource: "sac" }), serit({ sac: null }))).toBeNull();
    expect(linePrice(satir({ priceSource: "sac" }), {})).toBeNull();
    expect(linePrice(satir({ priceSource: "sac" }), undefined)).toBeNull();

    const p = withMaterialPrices({
      ...emptyCostPayload(),
      materialPrices: serit({ sac: null }),
      general: grup([satir({ priceSource: "sac" })]),
    });
    expect(p.general.lines[0].unitPrice).toBeNull();
    // 51.000 kg × "—" sıfır değildir: grup hiç tutar taşımaz.
    expect(costGroupTotal(p.general)).toBeNull();
  });

  it("withMaterialPrices YALNIZ şerit satırlarını yazar", () => {
    const p = withMaterialPrices({
      ...emptyCostPayload(),
      general: grup([
        satir({ key: "rawMaterial", priceSource: "sac" }),
        satir({ key: "profile", priceSource: "profil", priceManual: true, unitPrice: 0.62 }),
        satir({ key: "serbest-1", unitPrice: 12000 }),
      ]),
    });
    expect(p.general.lines.map((l) => l.unitPrice)).toEqual([0.7, 0.62, 12000]);
  });
});

describe("withCostDerived — miktar, fiyat ve toplam BİRLİKTE tazelenir", () => {
  const p = withCostDerived(withOfferSync(emptyCostPayload(), teklif([portalKalemi()]), 0).payload);
  const celik = p.items[0].groups.find((g) => g.key === "steel") as CostGroup;
  const l = (key: string) => celik.lines.find((x) => x.key === key) as CostLine;

  it("sac satırı 51.000 kg çeliği 0,70 €/kg ile fiyatlar", () => {
    expect(l("rawMaterial").qty).toBe(51000);
    expect(l("rawMaterial").unitPrice).toBe(0.7);
  });

  it("boya TOPLAM ağırlıktan gelir; boya işçiliği AYRI bir fiyattır", () => {
    expect(l("paint").qty).toBe(59500);
    expect(l("paint").unitPrice).toBe(0.08);
    expect(l("paintLabour").qty).toBe(59500);
    expect(l("paintLabour").unitPrice).toBe(0.07);
  });

  it("işçilik fire dahil ağırlığı 0,90 €/kg, kesim çelik ağırlığını 0,05 €/kg ile fiyatlar", () => {
    expect(l("fabrication").qty).toBeCloseTo(56100, 6);
    expect(l("fabrication").unitPrice).toBe(0.9);
    expect(l("laserCut").qty).toBe(51000);
    expect(l("laserCut").unitPrice).toBe(0.05);
  });

  it("iki ray satırının FİYATI yazılır ama MİKTARI boştur — ikisi de toplama girmez", () => {
    expect(l("rail").unitPrice).toBe(0.9);
    expect(l("railA").unitPrice).toBe(1.2);
    expect(l("rail").qty).toBeNull();
    expect(l("railA").qty).toBeNull();
    expect(l("profile").unitPrice).toBe(0.65);
    expect(l("profile").qty).toBeNull();
  });

  it("çelik yapı 97.665 € olur ve toplam maliyet 116.221,35 €'ya çıkar", () => {
    // 51.000×0,70 + 56.100×0,90 + 51.000×0,05 + 59.500×0,08 + 59.500×0,07
    expect(costGroupTotal(celik)).toBeCloseTo(35700 + 50490 + 2550 + 4760 + 4165, 4);
    expect(p.direct).toBeCloseTo(97665, 4);
    // Oran tabanı PROJE MALİYETİDİR: 97.665 × 1,19.
    expect(p.total).toBeCloseTo(116221.35, 4);
  });

  it("elle girilmiş fiyat tazelemeden SAĞ ÇIKAR", () => {
    const ilk = withOfferSync(emptyCostPayload(), teklif([portalKalemi()]), 0).payload;
    const g = ilk.items[0].groups.find((x) => x.key === "steel") as CostGroup;
    const sac = g.lines.find((x) => x.key === "rawMaterial") as CostLine;
    sac.priceManual = true;
    sac.unitPrice = 0.82;

    const sonra = withCostDerived(ilk);
    const yeni = (sonra.items[0].groups.find((x) => x.key === "steel") as CostGroup).lines.find(
      (x) => x.key === "rawMaterial"
    ) as CostLine;
    expect(yeni.unitPrice).toBe(0.82);
    expect(yeni.qty).toBe(51000);
  });
});

// ————————————————————————————————————————————————————— C) defter bağı

describe("defterin çelik satırları şeride BAĞLIDIR", () => {
  const celik = COST_GROUP_DEF_BY_KEY.steel.lines;
  const kaynak = (key: string) => celik.find((l) => l.key === key)?.priceSource;

  it("ray satırları İKİ FARKLI fiyata bağlanır", () => {
    expect(kaynak("rail")).toBe("rayKare");
    expect(kaynak("railA")).toBe("rayA");
  });

  it("'rail' ANAHTARI KORUNMUŞTUR — eski belgedeki ray satırı yetim kalmaz", () => {
    expect(celik.map((l) => l.key)).toContain("rail");
  });

  it("sac, profil, kesim, işçilik ve iki boya satırı kendi fiyatına bağlıdır", () => {
    expect(kaynak("rawMaterial")).toBe("sac");
    expect(kaynak("profile")).toBe("profil");
    expect(kaynak("laserCut")).toBe("kesim");
    expect(kaynak("fabrication")).toBe("celikIsciligi");
    expect(kaynak("paint")).toBe("boya");
    expect(kaynak("paintLabour")).toBe("boyaIsciligi");
  });

  it("bağların hepsi ŞERİTTE GERÇEKTEN VARDIR — yazım hatası sessiz kalmasın", () => {
    for (const g of Object.values(COST_GROUP_DEF_BY_KEY)) {
      for (const line of g.lines) {
        if (!line.priceSource) continue;
        expect(materialPriceDef(line.priceSource), `${g.key}/${line.key}`).toBeDefined();
      }
    }
  });
});

describe("tazeleme defterin YENİ satırlarını ekler, eskisini silmez", () => {
  /** Ray alanı ikiye ayrılmadan önce kaydedilmiş bir çelik grubu. */
  const eski = withCostDefaults({
    items: [
      {
        title: "ESKİ BELGE",
        groups: [
          {
            key: "steel",
            title: "ÇELİK YAPI",
            lines: [
              { key: "rawMaterial", label: "Hammadde — Sac", unit: "kg", qty: 51000, unitPrice: 0.7 },
              { key: "rail", label: "Ray", unit: "kg", qty: 1200, unitPrice: 0.95 },
              { key: "paint", label: "Boya", unit: "kg", qty: 59500, unitPrice: null },
            ],
          },
        ],
      },
    ],
  });
  const yeni = withOfferSync(eski, teklif([]), 1).payload;
  const celik = yeni.items[0].groups[0];
  const l = (key: string) => celik.lines.find((x) => x.key === key) as CostLine;

  it("'railA' EKLENİR, mevcut satırlar yerinde ve sırada kalır", () => {
    expect(celik.lines.map((x) => x.key)).toEqual([
      "rawMaterial",
      "rail",
      "paint",
      "profile",
      "railA",
      "fabrication",
      "laserCut",
      "paintLabour",
    ]);
  });

  it("FİYATI GİRİLMİŞ satıra bağ kurulurken priceManual AÇILIR — girilen sayı ezilmez", () => {
    expect(l("rail").priceSource).toBe("rayKare");
    expect(l("rail").priceManual).toBe(true);
    expect(l("rail").unitPrice).toBe(0.95);
    expect(l("rawMaterial").priceManual).toBe(true);
    expect(l("rawMaterial").unitPrice).toBe(0.7);
  });

  it("fiyatı GİRİLMEMİŞ satır doğrudan şeride bağlanır", () => {
    expect(l("paint").priceSource).toBe("boya");
    expect(l("paint").priceManual).toBe(false);
  });

  it("bir sonraki fiyat yazımında 0,95 kalır, yeni ray satırı şeritten 1,20 alır", () => {
    const dolu = withMaterialPrices({ ...yeni, materialPrices: serit() });
    const g = dolu.items[0].groups[0];
    expect(g.lines.find((x) => x.key === "rail")?.unitPrice).toBe(0.95);
    expect(g.lines.find((x) => x.key === "railA")?.unitPrice).toBe(1.2);
    expect(g.lines.find((x) => x.key === "paint")?.unitPrice).toBe(0.08);
  });
});

// ————————————————————————————————————————————————————— D) götürü kip

/** Kalem kalem fiyatlanmış bir elektrik grubu — 18.000 + 4.200 = 22.200 €. */
function elektrikGrubu(): CostGroup {
  const g = costGroupFromKey("electrical");
  const yaz = (key: string, qty: number, unitPrice: number) => {
    const l = g.lines.find((x) => x.key === key);
    if (l) {
      l.qty = qty;
      l.unitPrice = unitPrice;
    }
  };
  yaz("panels", 1, 18000);
  yaz("hoistDrive", 1, 4200);
  return g;
}

describe("GÖTÜRÜ KİP — 'tek fiyat gir' (kullanıcı isteği 18.08.2026)", () => {
  it("götürüye geçen grup kalem satırlarını SİLMEZ, tek satır EKLER", () => {
    const kalem = elektrikGrubu();
    const gotur = withLumpMode(kalem, true);
    expect(gotur.lump).toBe(true);
    expect(gotur.lines).toHaveLength(kalem.lines.length + 1);
    expect(gotur.lines.filter(isLumpLine)).toHaveLength(1);
    expect(gotur.lines.find(isLumpLine)?.key).toBe(lumpLineKey("electrical"));
    expect(gotur.lines.find((x) => x.key === "panels")?.unitPrice).toBe(18000);
  });

  it("kip sayılan satırları değiştirir: götürüde yalnız götürü satırı, kalemde yalnız kalemler", () => {
    const gotur = withLumpMode(elektrikGrubu(), true);
    expect(costGroupLines(gotur).map((x) => x.key)).toEqual([lumpLineKey("electrical")]);
    expect(costGroupLines({ ...gotur, lump: false }).some(isLumpLine)).toBe(false);
    expect(costGroupLines({ ...gotur, lump: false })).toHaveLength(gotur.lines.length - 1);
  });

  it("İKİSİ ASLA TOPLANMAZ: götürüde 26.500 €, kalemde 22.200 € — 48.700 € DEĞİL", () => {
    const gotur = withLumpMode(elektrikGrubu(), true);
    const goturSatir = gotur.lines.find(isLumpLine) as CostLine;
    goturSatir.unitPrice = 26500;

    expect(costGroupTotal(gotur)).toBe(26500);
    expect(costGroupTotal({ ...gotur, lump: false })).toBe(22200);
    expect(costGroupTotal(gotur)).not.toBe(48700);
  });

  it("götürü fiyatı girilmemişse grup tutarı null'dır — kalem fiyatlarına DÜŞMEZ", () => {
    expect(costGroupTotal(withLumpMode(elektrikGrubu(), true))).toBeNull();
  });

  it("götürüye geçip GERİ DÖNÜNCE girilmiş kalem fiyatları yerindedir", () => {
    const gotur = withLumpMode(elektrikGrubu(), true);
    (gotur.lines.find(isLumpLine) as CostLine).unitPrice = 26500;

    const geri = withLumpMode(gotur, false);
    expect(geri.lump).toBe(false);
    expect(geri.lines.find((x) => x.key === "panels")?.unitPrice).toBe(18000);
    expect(geri.lines.find((x) => x.key === "hoistDrive")?.unitPrice).toBe(4200);
    expect(costGroupTotal(geri)).toBe(22200);
  });

  it("tekrar götürüye geçilince AYNI satır bulunur — ikinci bir götürü satır eklenmez", () => {
    const gotur = withLumpMode(elektrikGrubu(), true);
    (gotur.lines.find(isLumpLine) as CostLine).unitPrice = 26500;
    const tekrar = withLumpMode(withLumpMode(gotur, false), true);

    expect(tekrar.lines.filter(isLumpLine)).toHaveLength(1);
    expect(tekrar.lines.find(isLumpLine)?.key).toBe(lumpLineKey("electrical"));
    // Girilen götürü fiyat her turda kaybolsaydı kip bir kez kullanılırdı.
    expect(costGroupTotal(tekrar)).toBe(26500);
  });
});

describe("götürü kip belgeye de yansır", () => {
  /** Tek kalemli, tek gruplu bir maliyet belgesi — kipi dışarıdan verilir. */
  function belge(lump: boolean): CostPayload {
    const g = withLumpMode(elektrikGrubu(), lump);
    const goturSatir = g.lines.find(isLumpLine);
    if (goturSatir) goturSatir.unitPrice = 26500;
    const item: CostItem = { ...freeCostItem("ELEKTRİKLİ VİNÇ"), groups: [g] };
    return { ...emptyCostPayload(), items: [item] };
  }

  it("götürü kipte YALNIZ götürü satırı basılır", () => {
    const basilan = printedCostPayload(belge(true));
    expect(basilan.items[0].groups[0].lines.map((l) => l.key)).toEqual([lumpLineKey("electrical")]);
  });

  it("kalem kipte kalem satırları basılır, götürü satırı BASILMAZ", () => {
    const basilan = printedCostPayload(belge(false));
    const keys = basilan.items[0].groups[0].lines.map((l) => l.key);
    expect(keys).toEqual(["hoistDrive", "panels"]);
    expect(keys).not.toContain(lumpLineKey("electrical"));
  });

  it("belgenin toplamı da kipi izler", () => {
    expect(costTotals(belge(true)).direct).toBe(26500);
    expect(costTotals(belge(false)).direct).toBe(22200);
  });
});
