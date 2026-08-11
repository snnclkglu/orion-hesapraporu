// Talep havuzu çekirdeği + resim çarpanı.
//
// Buradaki sayılar uydurma değil: çarpan kuralı kullanıcının 11.08.2026
// tarihli kararından, birleştirme davranışı `derive.ts`in iki gerçek pakette
// ölçülmüş kuralından geliyor.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  drawingCarpani,
  talepHavuzu,
  type HavuzPaketi,
  type HavuzSatiri,
  type KalemAdedi,
} from "../demand";
import { isPurchaseRow } from "@/lib/drawings/progress";
import { normAnahtar } from "@/lib/drawings/normalize";

// ————————————————————————————————————————————————————————— fikstürler

const KALEMLER: KalemAdedi[] = [
  { id: "a", itemNo: "0075-01", qty: 3, sharesWith: null },
  { id: "b", itemNo: "0075-02", qty: 2, sharesWith: "a" },
  { id: "c", itemNo: "0075-03", qty: null, sharesWith: null },
  { id: "d", itemNo: "0080-00", qty: 1, sharesWith: null },
];

function paket(over: Partial<HavuzPaketi> = {}): HavuzPaketi {
  return {
    packageId: "p1",
    label: "0100 · ANA KİRİŞ",
    itemNo: "0075-01",
    jobNo: "0075",
    jobTitle: "MUHTELİF VİNÇLER",
    customer: "ASTOR",
    carpan: 1,
    carpanBelirsiz: false,
    ...over,
  };
}

function satir(over: Partial<HavuzSatiri> = {}): HavuzSatiri {
  return {
    packageId: "p1",
    partKey: "SATINALMA:CIVATA",
    partCode: "",
    tanim: "CİVATA M16x120 DIN931 (GALVANİZLİ)",
    material: "8.8",
    qty: 10,
    weightKg: null,
    groupCode: "",
    groupName: "",
    ...over,
  };
}

// ═════════════════════════════════════════════════════════════ ÇARPAN

describe("drawingCarpani — resim çarpanı", () => {
  it("tek kalemde kendi adedini verir", () => {
    expect(drawingCarpani("d", "0080-00", KALEMLER)).toEqual({
      carpan: 1,
      belirsiz: false,
      katilanlar: ["0080-00"],
    });
  });

  it("resimleri PAYLAŞAN kalemlerin adetlerini TOPLAR", () => {
    // Kullanıcı kararı: iki kalem yalnız montaj konumunda ayrılıyorsa ressam
    // tek takım çizer; imalat ikisinin toplamı kadar üretir.
    const c = drawingCarpani("a", "0075-01", KALEMLER);
    expect(c.carpan).toBe(5); // 3 + 2
    expect(c.katilanlar).toEqual(["0075-01", "0075-02"]);
    expect(c.belirsiz).toBe(false);
  });

  it("ödünç alan kalemden çağrılsa da TAŞIYICIYA çıkar", () => {
    // Resim taşıyıcıda yaşar; iki uçtan da aynı çarpan okunmalıdır.
    expect(drawingCarpani("b", "0075-02", KALEMLER).carpan).toBe(5);
  });

  it("adedi bilinmeyen kalem 1 SAYILIR ama BELİRSİZ işaretlenir", () => {
    // Sessiz varsayım ile açık varsayım arasındaki fark: ekran bunu yazar.
    const c = drawingCarpani("c", "0075-03", KALEMLER);
    expect(c.carpan).toBe(1);
    expect(c.belirsiz).toBe(true);
  });

  it("kalem hiç bulunamazsa 1 ve BELİRSİZ döner — sessizce doğru varsaymaz", () => {
    const c = drawingCarpani(null, "9999-99", KALEMLER);
    expect(c).toEqual({ carpan: 1, belirsiz: true, katilanlar: [] });
  });

  it("kimlik yoksa NUMARAYLA bulur (item_no metni tek bağ olabilir)", () => {
    expect(drawingCarpani(null, "0075-01", KALEMLER).carpan).toBe(5);
  });
});

// ═══════════════════════════════════════════════════════════════ HAVUZ

describe("talepHavuzu", () => {
  it("adetleri iş kalemi adediyle ÇARPAR", () => {
    const h = talepHavuzu([paket({ carpan: 3 })], [satir({ qty: 10 })]);
    expect(h.satirlar).toHaveLength(1);
    expect(h.satirlar[0].adet).toBe(30);
    expect(h.satirlar[0].paylar[0].birimAdet).toBe(10);
    expect(h.satirlar[0].paylar[0].carpan).toBe(3);
  });

  it("İKİ AYRI YAZIMI tek kalemde birleştirir", () => {
    // Havuzun paket listesinden en önemli farkı: iki proje aynı somunu iki
    // yazımla yazmışsa satınalmacı TEK sipariş açmalıdır.
    const h = talepHavuzu(
      [paket({ packageId: "p1", itemNo: "0075-01" }), paket({ packageId: "p2", itemNo: "0080-00" })],
      [
        satir({ packageId: "p1", tanim: "CİVATA M16x120 DIN931 (GALVANİZLİ)", qty: 10 }),
        satir({ packageId: "p2", tanim: "Cıvata M16x120 DIN 931 Galvanizli", qty: 4 }),
      ]
    );
    expect(h.satirlar).toHaveLength(1);
    expect(h.satirlar[0].adet).toBe(14);
    expect(h.satirlar[0].isSayisi).toBe(2);
    expect(h.satirlar[0].hamTanimlar).toHaveLength(2);
    expect(h.cokIsliKalem).toBe(1);
  });

  it("FARKLI ürünleri birleştirmez", () => {
    const h = talepHavuzu(
      [paket()],
      [satir({ tanim: "RULMAN 6205", qty: 2 }), satir({ tanim: "RULMAN 6205-Z", qty: 3 })]
    );
    expect(h.satirlar).toHaveLength(2);
  });

  it("belirsiz çarpan kaleme YAYILIR", () => {
    const h = talepHavuzu(
      [
        paket({ packageId: "p1", carpan: 2, carpanBelirsiz: false }),
        paket({ packageId: "p2", carpan: 1, carpanBelirsiz: true }),
      ],
      [satir({ packageId: "p1" }), satir({ packageId: "p2" })]
    );
    expect(h.satirlar[0].carpanBelirsiz).toBe(true);
    expect(h.belirsizKalem).toBe(1);
  });

  it("malzeme ÇELİŞKİSİNİ gizlemez", () => {
    const h = talepHavuzu(
      [paket()],
      [satir({ material: "S235JR" }), satir({ material: "S355JR" })]
    );
    expect(h.satirlar[0].malzemeler).toEqual(["S235JR", "S355JR"]);
  });

  it("birim ağırlık ancak BÜTÜN satırlar aynı değeri söylerse yazılır", () => {
    const ayni = talepHavuzu([paket()], [satir({ weightKg: 2 }), satir({ weightKg: 2 })]);
    expect(ayni.satirlar[0].birimAgirlikKg).toBe(2);

    const ayrisan = talepHavuzu([paket()], [satir({ weightKg: 2 }), satir({ weightKg: 3 })]);
    expect(ayrisan.satirlar[0].birimAgirlikKg).toBeNull();

    // Bir satırın ağırlığı hiç yoksa da TEK BİR birim ağırlık yoktur.
    const eksik = talepHavuzu([paket()], [satir({ weightKg: 2 }), satir({ weightKg: null })]);
    expect(eksik.satirlar[0].birimAgirlikKg).toBeNull();
  });

  it("kategori DÜZELTMESİ sözlüğü yener", () => {
    const h = talepHavuzu([paket()], [satir({ tanim: "RULMAN 6205" })], {
      duzeltmeler: new Map([[normAnahtar("RULMAN 6205"), "Hidrolik"]]),
    });
    expect(h.satirlar[0].sinif).toBe("Hidrolik");
  });

  it("TANIMSIZ satır havuza girmez — adı olmayan kalem sipariş edilemez", () => {
    const h = talepHavuzu([paket()], [satir({ tanim: "" })]);
    expect(h.satirlar).toHaveLength(0);
  });

  it("paketi bilinmeyen satır DÜŞÜRÜLÜR (çarpan bilinemez)", () => {
    const h = talepHavuzu([paket({ packageId: "p1" })], [satir({ packageId: "yok" })]);
    expect(h.satirlar).toHaveLength(0);
  });

  it("ana grup adlarını toplar — 'hangi grubun cıvatası' sorusu", () => {
    const h = talepHavuzu(
      [paket()],
      [
        satir({ groupName: "ANA KİRİŞ" }),
        satir({ groupName: "KÖPRÜ YÜRÜTME GRUBU" }),
        satir({ groupName: "ANA KİRİŞ" }),
      ]
    );
    expect(h.satirlar[0].anaGruplar).toEqual(["ANA KİRİŞ", "KÖPRÜ YÜRÜTME GRUBU"]);
  });
});

// ═══════════════════════════════════ SQL SÜZGECİ ↔ isPurchaseRow KORUMASI

describe("satın alma satırı kuralı TEK YERDEDİR", () => {
  /**
   * `data.ts` havuzu okurken süzgeci VERİTABANINA yaptırır (otuz bin satırı
   * istemciye çekmemek için) ve o süzgeç `isPurchaseRow`un SQL karşılığıdır:
   *
   *     .or("kind.eq.satinalma,part_code.eq.")
   *
   * İki tanım ayrışırsa havuz ya eksik ya fazla satır gösterir ve bunu hiçbir
   * ekran fark etmez — bu yüzden dosya OKUNARAK sınanır (`progress.test.ts`in
   * migration dosyasını okuma kalıbının aynısı).
   */
  const kaynak = readFileSync(
    join(process.cwd(), "src/app/(app)/purchasing/data.ts"),
    "utf8"
  );

  it("SQL süzgeci hâlâ iki koşulu da taşıyor", () => {
    expect(kaynak).toContain('.or("kind.eq.satinalma,part_code.eq.")');
  });

  it("TS kuralı da aynı iki koşulu söylüyor", () => {
    // Satın alma yapısındaki satır…
    expect(isPurchaseRow({ kind: "satinalma", partCode: "0043-00-0100-01" })).toBe(true);
    // …ya da parça numarası olmayan satır.
    expect(isPurchaseRow({ kind: "imalat", partCode: "" })).toBe(true);
    expect(isPurchaseRow({ kind: "imalat", partCode: "   " })).toBe(true);
    // Kodlu imalat parçası satın alma DEĞİLDİR — o Üretim tahtasında durur.
    expect(isPurchaseRow({ kind: "imalat", partCode: "0043-00-0100-01" })).toBe(false);
  });
});
