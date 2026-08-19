// MALİYET BELGESİNİN KURULMASI, TAŞINMASI VE TEKLİFTEN TÜRETİLMESİ.
//
// Buradaki testlerin çoğu bir KAYIP'a karşıdır: tazeleme kullanıcının girdiği
// fiyatı silmemeli, elle düzelttiği ölçüyü ezmemeli, teklifte silinen bir
// kalemin maliyetini götürmemelidir. Bir maliyet çalışmasında girilen her
// birim fiyat tedarikçiyle yapılmış bir görüşmedir; sessizce kaybolması kabul
// edilemez.

import { describe, expect, it } from "vitest";
import { emptyItem, emptyPayload, newOfferId } from "../../payload";
import type { OfferItem, OfferPayload } from "../../types";
import {
  costItemFromOfferItem,
  emptyCostPayload,
  inputsFromOfferItem,
  lineQty,
  withCostDefaults,
  withDefaultRates,
  withModelQuantities,
  withOfferSync,
} from "../payload";
import { costTotals } from "../totals";

/** GENEL ÖZELLİKLER ve KALDIRMA satırları dolu bir portal vinç kalemi. */
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
  deger("general", "craneType", "Portal Vinç");
  yaz("mainHoist", "liftSpeed", { range: "4" });
  yaz("trolley", "travelSpeed", { range: "20" });
  yaz("trolley", "motor", { count: "2", brand: "GAMAK", power: "1,5" });
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

describe("teklif kaleminden girdi okuma", () => {
  const i = inputsFromOfferItem(portalKalemi());

  it("kapasite, açıklık, yükseklik ve hızlar okunur", () => {
    expect(i.capacityT).toBe(32);
    expect(i.spanM).toBe(30);
    expect(i.liftHeightM).toBe(12);
    expect(i.liftSpeedMpm).toBe(4);
    expect(i.trolleySpeedMpm).toBe(20);
    expect(i.bridgeSpeedMpm).toBe(20);
    expect(i.legHeightM).toBe(12);
  });

  it("FEM grubundan sınıf çözülür", () => {
    expect(i.craneClass).toBe("M6");
  });

  it("vinç tipinden PORTAL anlaşılır ve teker/tahrik adetleri satırdan gelir", () => {
    expect(i.gantry).toBe(true);
    expect(i.bridgeWheelCount).toBe(8);
    expect(i.bridgeDriveCount).toBe(4);
    expect(i.trolleyDriveCount).toBe(2);
  });

  it("okunamayan değer UYDURULMAZ", () => {
    const bos = inputsFromOfferItem(emptyItem("BOŞ", ["general"]));
    expect(bos.capacityT).toBeNull();
    expect(bos.spanM).toBeNull();
    expect(bos.liftHeightM).toBeNull();
  });

  it("ELLE DÜZELTİLEN GİRDİ EZİLMEZ — tazeleme yalnız boşu doldurur", () => {
    const onceki = { ...inputsFromOfferItem(portalKalemi()), spanM: 19.5 };
    expect(inputsFromOfferItem(portalKalemi(), onceki).spanM).toBe(19.5);
  });
});

describe("kalem iskeleti teklifin bölümlerinden çıkar", () => {
  it("yardımcı kaldırması olmayan vinçte yardımcı grup açılmaz", () => {
    const k = costItemFromOfferItem(portalKalemi(), 1);
    // İMALAT MALİYETİ EN ÜSTTEDİR (kullanıcı isteği 18.08.2026, md. 4).
    expect(k.groups.map((g) => g.key)).toEqual([
      "fabrication", "steel", "hoist", "travel", "electrical", "assembly",
    ]);
  });

  it("yardımcı kaldırması olan vinçte açılır ve defter sırasında durur", () => {
    const item = emptyItem("ÇİFT KANCA", ["general", "mainHoist", "auxHoist", "trolley", "steel"]);
    const k = costItemFromOfferItem(item, 1);
    expect(k.groups.map((g) => g.key)).toEqual([
      "fabrication", "steel", "hoist", "auxHoist", "travel", "electrical", "assembly",
    ]);
  });

  it("satırlar defterden gelir ve miktar kaynağı taşır", () => {
    const k = costItemFromOfferItem(portalKalemi(), 1);
    const celik = k.groups.find((g) => g.key === "steel");
    expect(celik?.lines.map((l) => l.key)).toContain("rawMaterial");
    // SAC DA KESİM DE FİRE DAHİL AĞIRLIĞA BAĞLIDIR (kullanıcı kararları
    // 18.08.2026 ve 19.08.2026): ikisi de tezgâha GİREN levhayı ölçer. Boya
    // ise TOPLAM ağırlığı okur — mekanizmanın üstüne de atılır (MALIYET-14).
    expect(celik?.lines.find((l) => l.key === "rawMaterial")?.qtySource).toBe("w.steelWithFire");
    expect(celik?.lines.find((l) => l.key === "laserCut")?.qtySource).toBe("w.steelWithFire");
    expect(celik?.lines.find((l) => l.key === "paint")?.qtySource).toBe("w.total");
  });
});

describe("tekliften tazeleme EKLEYİCİDİR", () => {
  it("teklifte olup maliyette olmayan kalem açılır", () => {
    const t = teklif([portalKalemi()]);
    const { payload, eklenen } = withOfferSync(emptyCostPayload(), t, 0);
    expect(eklenen).toBe(1);
    expect(payload.items).toHaveLength(1);
    expect(payload.items[0].offerItemId).toBe(t.items[0].id);
    expect(payload.sourceRevNo).toBe(0);
  });

  it("GİRİLEN BİRİM FİYAT KORUNUR", () => {
    const t = teklif([portalKalemi()]);
    const ilk = withOfferSync(emptyCostPayload(), t, 0).payload;
    ilk.items[0].groups[0].lines[0].unitPrice = 0.7;

    const ikinci = withOfferSync(ilk, t, 1).payload;
    expect(ikinci.items).toHaveLength(1);
    expect(ikinci.items[0].groups[0].lines[0].unitPrice).toBe(0.7);
  });

  it("teklifte silinen kalemin maliyeti SİLİNMEZ, bağı kopar", () => {
    const t = teklif([portalKalemi()]);
    const ilk = withOfferSync(emptyCostPayload(), t, 0).payload;
    ilk.items[0].groups[0].lines[0].unitPrice = 0.7;

    const sonuc = withOfferSync(ilk, teklif([]), 1);
    expect(sonuc.yetim).toBe(1);
    expect(sonuc.payload.items).toHaveLength(1);
    expect(sonuc.payload.items[0].offerItemId).toBeNull();
    expect(sonuc.payload.items[0].groups[0].lines[0].unitPrice).toBe(0.7);
  });

  it("başlık teklifi izler", () => {
    const t = teklif([portalKalemi("ESKİ AD")]);
    const ilk = withOfferSync(emptyCostPayload(), t, 0).payload;
    t.items[0].title = "YENİ AD";
    expect(withOfferSync(ilk, t, 0).payload.items[0].title).toBe("YENİ AD");
  });
});

describe("model miktarları satırlara yazılır", () => {
  const t = teklif([portalKalemi()]);
  const p = withModelQuantities(withOfferSync(emptyCostPayload(), t, 0).payload);
  const celik = p.items[0].groups.find((g) => g.key === "steel");

  it("hammadde miktarı ÇELİK + FİRE ağırlığıdır", () => {
    // Kullanıcı kararı 18.08.2026: sac fireli kilodan fiyatlanır — faturaya
    // giren, kesilen kilo değil GELEN kilodur.
    expect(celik?.lines.find((l) => l.key === "rawMaterial")?.qty).toBeCloseTo(56100, 6);
  });

  it("işçilik miktarı fire dahil ağırlıktır — ve KENDİ ANA BAŞLIĞINDADIR", () => {
    // Satır 18.08.2026'da ÇELİK YAPI'dan alınıp İMALAT MALİYETİ grubuna
    // taşındı (md. 4); çelikte bir kopyası KALMAZ, yoksa aynı işçilik iki kez
    // sayılırdı.
    const imalat = p.items[0].groups.find((g) => g.key === "fabrication");
    expect(imalat?.lines.find((l) => l.key === "fabrication")?.qty).toBeCloseTo(56100, 6);
    expect(celik?.lines.some((l) => l.key === "fabrication")).toBe(false);
  });

  it("boya miktarı TOPLAM vinç ağırlığıdır", () => {
    expect(celik?.lines.find((l) => l.key === "paint")?.qty).toBe(59500);
  });

  it("teker ve tahrik adetleri modelden gelir", () => {
    const yur = p.items[0].groups.find((g) => g.key === "travel");
    expect(yur?.lines.find((l) => l.key === "bridgeWheels")?.qty).toBe(8);
    expect(yur?.lines.find((l) => l.key === "trolleyWheels")?.qty).toBe(4);
    expect(yur?.lines.find((l) => l.key === "bridgeMotor")?.qty).toBe(4);
  });

  it("ELLE GİRİLEN MİKTAR EZİLMEZ", () => {
    const elle = withOfferSync(emptyCostPayload(), t, 0).payload;
    const g = elle.items[0].groups.find((x) => x.key === "steel");
    const satir = g!.lines.find((l) => l.key === "rawMaterial")!;
    satir.qtyManual = true;
    satir.qty = 48000;
    const sonra = withModelQuantities(elle);
    const yeni = sonra.items[0].groups
      .find((x) => x.key === "steel")!
      .lines.find((l) => l.key === "rawMaterial")!;
    expect(yeni.qty).toBe(48000);
  });

  it("miktar kaynağı olmayan satır elle kalır", () => {
    expect(lineQty({ id: "1", key: "x", label: "X", qty: 3, unit: "adet", unitPrice: null }, undefined)).toBe(3);
  });
});

describe("ASTOR maliyet iskeleti uçtan uca", () => {
  it("çelik satırlarına €/kg girilince toplam devralınan çalışmayla tutar", () => {
    const t = teklif([portalKalemi()]);
    const p = withModelQuantities(withOfferSync(emptyCostPayload(), t, 0).payload);
    const celik = p.items[0].groups.find((g) => g.key === "steel")!;
    const fiyat = (key: string, v: number) => {
      const l = celik.lines.find((x) => x.key === key);
      if (l) l.unitPrice = v;
    };
    // Devralınan çalışmanın birim oranları — burada ELLE girilir, hiçbir
    // tablodan aranmaz (kullanıcı kararı).
    fiyat("rawMaterial", 0.7);
    fiyat("laserCut", 0.05);
    fiyat("paint", 0.15);
    // İŞÇİLİK ARTIK KENDİ GRUBUNDADIR (md. 4).
    const imalat = p.items[0].groups.find((g) => g.key === "fabrication")!;
    const isc = imalat.lines.find((x) => x.key === "fabrication");
    if (isc) isc.unitPrice = 1.25;

    const t2 = costTotals(p);
    // BAŞLIK DEĞİŞTİ, TOPLAM DEĞİŞMEDİ: doğrudan maliyet imalatı da kapsar.
    // 56.100×0,70 + 56.100×1,25 + 56.100×0,05 + 59.500×0,15
    // Sac VE kesim fire dahil kilodan fiyatlanır (19.08.2026); boya toplam
    // vinç ağırlığından.
    expect(t2.direct).toBeCloseTo(39270 + 70125 + 2805 + 8925, 4);
    expect(t2.fabrication).toBeCloseTo(70125, 4);
    expect(t2.project).toBeCloseTo(39270 + 2805 + 8925, 4);
  });
});

describe("taşıma eski kayıtları bozmaz", () => {
  it("boş nesne bugünkü şekle taşınır", () => {
    const p = withCostDefaults({}, "TRY");
    expect(p.currency).toBe("TRY");
    expect(p.items).toEqual([]);
    expect(p.rates.map((r) => r.key)).toEqual(["fixed", "consumable", "finance"]);
    expect(p.params.fireRate).toBe(0.1);
  });

  it("belgeye yazılmış katsayı VARSAYILANLA EZİLMEZ", () => {
    const p = withCostDefaults({ params: { fireRate: 0.05 } });
    expect(p.params.fireRate).toBe(0.05);
  });

  it("taşıma varsayılan ORANLARI GERİ GETİRMEZ (kullanıcı bilerek silmiş olabilir)", () => {
    const p = withCostDefaults({ rates: [{ key: "fixed", mode: "oran", percent: null }] });
    expect(p.rates.find((r) => r.key === "fixed")?.percent).toBeNull();
  });

  it("yeni belgede varsayılan oranlar uygulanır", () => {
    const p = withDefaultRates(emptyCostPayload());
    expect(p.rates.find((r) => r.key === "fixed")?.percent).toBe(15);
    expect(p.rates.find((r) => r.key === "consumable")?.percent).toBe(2);
    expect(p.rates.find((r) => r.key === "finance")?.percent).toBe(2);
  });

  it("bilinmeyen kimlikli satıra yeni kimlik verilir, veri korunur", () => {
    const p = withCostDefaults({
      items: [{ title: "X", groups: [{ key: "steel", lines: [{ key: "rawMaterial", unitPrice: 0.7 }] }] }],
    });
    expect(p.items[0].id).toMatch(/[0-9a-f-]{36}/);
    expect(p.items[0].groups[0].lines[0].unitPrice).toBe(0.7);
  });
});

// ——————————————————————————————————————————————— 19.08.2026 turu

describe("BORVERK İŞLEME satırı (kullanıcı isteği 19.08.2026)", () => {
  const k = costItemFromOfferItem(
    emptyItem("ÇİFT KANCALI PORTAL", ["general", "mainHoist", "auxHoist", "trolley", "gantry"]),
    1
  );
  const anahtarlar = (groupKey: string) =>
    k.groups.find((g) => g.key === groupKey)?.lines.map((l) => l.key) ?? [];

  it("kaldırma, YARDIMCI kaldırma ve yürütme gruplarının hepsinde açılır", () => {
    // Kullanıcı "hem kaldırma hem yürütme teker grubuna" dedi. Yardımcı
    // kaldırma ana kaldırmanın AYNI listesinden kurulur (`kaldirmaSatirlari`):
    // iki ayrı liste yazılsaydı orada unutulan satır en geç fark edilen
    // eksiklik olurdu — yardımcı kaldırma zaten seyrek kullanılır.
    expect(anahtarlar("hoist")).toContain("borverk");
    expect(anahtarlar("auxHoist")).toContain("borverk");
    expect(anahtarlar("travel")).toContain("borverk");
  });

  it("miktarı modelden gelir ve BİRDİR; birim takım, fiyat ELLE girilir", () => {
    const l = k.groups.find((g) => g.key === "hoist")!.lines.find((x) => x.key === "borverk")!;
    expect(l.qtySource).toBe("c.one");
    expect(l.unit).toBe("takım");
    // Hammadde şeridine BAĞLI DEĞİLDİR: borverk saati bir €/kg değildir.
    expect(l.priceSource).toBeUndefined();
  });

  it("aynı anahtar üç grupta yaşar ama GRUP İÇİNDE tekildir", () => {
    // `costLineDef` grup + satır anahtarıyla arar; belge genelinde tekillik
    // aranmaz (`coupling` bugün üç grupta yaşıyor). Grup İÇİNDE bir çift
    // anahtar ise satırı iki kez çizer ve iki kez toplardı.
    for (const g of k.groups) {
      const ks = g.lines.map((l) => l.key);
      expect(ks.length, g.key).toBe(new Set(ks).size);
    }
  });
});

describe("kalem ADLARI BÜYÜK HARF SAKLANIR (kullanıcı isteği 19.08.2026)", () => {
  it("kayıtlı belgedeki küçük harfli ad OKUMA GEÇİDİNDE büyür", () => {
    const p = withCostDefaults({
      items: [
        {
          title: "X",
          groups: [
            {
              key: "steel",
              title: "Çelik Yapı",
              lines: [{ key: "rawMaterial", label: "Hammadde — Sac", unit: "kg", unitPrice: 0.7 }],
            },
          ],
        },
      ],
    });
    // DÖNÜŞÜM VERİDEDİR, çizimde değil: ad belgeye kopyalanır ve PDF onu ham
    // basar; yalnız ekranda büyütmek kayıt ile belgeyi ayrıştırırdı (md. 3).
    expect(p.items[0].groups[0].lines[0].label).toBe("HAMMADDE — SAC");
    expect(p.items[0].groups[0].title).toBe("ÇELİK YAPI");
    // GİRİLMİŞ FİYAT dönüşümden etkilenmez — ad bir tutar değildir.
    expect(p.items[0].groups[0].lines[0].unitPrice).toBe(0.7);
  });

  it("düz `toUpperCase` KULLANILMAZ — 'i' harfi bozulmaz", () => {
    const p = withCostDefaults({
      items: [
        {
          title: "X",
          groups: [
            {
              key: "custom",
              title: "özel bölüm",
              lines: [{ key: "serbest-1", label: "Çelik İmalat İşçiliği" }],
            },
          ],
        },
      ],
    });
    expect(p.items[0].groups[0].lines[0].label).toBe("ÇELİK İMALAT İŞÇİLİĞİ");
    expect(p.items[0].groups[0].lines[0].label).not.toBe("Çelik İmalat İşçiliği".toUpperCase());
    expect(p.items[0].groups[0].title).toBe("ÖZEL BÖLÜM");
  });
});

describe("defterde DEĞİŞEN miktar kaynağı TAZELEMEDE yenilenir", () => {
  /** Kesim satırı `w.steel` ile kaydedilmiş bir belge — 19.08.2026 öncesi. */
  function eskiBelge() {
    return withCostDefaults({
      items: [
        {
          title: "ESKİ BELGE",
          groups: [
            {
              key: "steel",
              title: "ÇELİK YAPI",
              lines: [
                {
                  key: "laserCut",
                  label: "LAZER / CNC KESİM",
                  unit: "kg",
                  qtySource: "w.steel",
                  qty: 51000,
                  unitPrice: 0.05,
                },
              ],
            },
          ],
        },
      ],
    });
  }

  it("OKUMA yolu kaynağa DOKUNMAZ — yayımlanmış belgenin tutarı kaymaz", () => {
    // `withCostDefaults` her açılışta koşar; burada kaynağı değiştirmek
    // kilitli bir M revizyonunu ekranda büyütür, veritabanındaki
    // `total_amount` ise eski kalırdı (MALIYET-2).
    expect(eskiBelge().items[0].groups[0].lines[0].qtySource).toBe("w.steel");
  });

  it("TAZELEME defterin yeni kaynağını getirir", () => {
    const yeni = withOfferSync(eskiBelge(), teklif([]), 1).payload;
    expect(yeni.items[0].groups[0].lines[0].qtySource).toBe("w.steelWithFire");
  });

  it("miktarı ELLE DEVRALINMIŞ satır tazelemede de elde kalır", () => {
    // İnsanın kararı `qtyManual`dır; defter onu ezemez (MALIYET-4).
    const p = eskiBelge();
    p.items[0].groups[0].lines[0].qtyManual = true;
    const l = withOfferSync(p, teklif([]), 1).payload.items[0].groups[0].lines[0];
    expect(l.qtySource).toBe("w.steel");
    expect(l.qty).toBe(51000);
  });

  it("kullanıcının DÜZELTTİĞİ AD tazelemede ezilmez", () => {
    // Ad ekranda düzenlenebilir bir kutudur; defterden tazelemek "LAZER
    // KESİM — TEDARİKÇİ B" düzeltmesini sessizce silerdi.
    const p = eskiBelge();
    p.items[0].groups[0].lines[0].label = "LAZER KESİM — TEDARİKÇİ B";
    const l = withOfferSync(p, teklif([]), 1).payload.items[0].groups[0].lines[0];
    expect(l.label).toBe("LAZER KESİM — TEDARİKÇİ B");
  });
});

describe("kimlikler benzersizdir", () => {
  it("iki kalem aynı kimliği taşımaz", () => {
    const a = costItemFromOfferItem(portalKalemi(), 1);
    const b = costItemFromOfferItem(portalKalemi(), 2);
    expect(a.id).not.toBe(b.id);
    expect(newOfferId()).not.toBe(newOfferId());
  });
});
