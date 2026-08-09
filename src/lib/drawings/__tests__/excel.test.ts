// BOM Excel okuma — ONBİR GERÇEK ÇALIŞMA SAYFASINA karşı.
//
// Bu testin varlık sebebi ölçülmüş bir gerçek: iki pakette BEŞ AYRI SÜTUN
// ŞEKLİ (7 · 9 · 11 · 13 · 14) ve üç ayrı sayfa adı (`BOM` · `Sayfa1` ·
// `Sayfa2`) var. Sabit şemaya bağlı bir okuyucu bunların çoğunu kaybederdi.

import { describe, expect, it } from "vitest";
import { parseBomFileName } from "../file-name";
import { readSheet, normalizeHeader, type RawSheet, type SheetRead } from "../excel";
import { MONORAY_SHEETS, MTC_SHEETS, type FixtureSheet } from "./fixtures/bom-sheets";

function oku(s: FixtureSheet): SheetRead {
  const ham: RawSheet = { fileRelPath: s.file, sheetName: s.sheet, rows: s.rows };
  return readSheet(ham, parseBomFileName(s.file.split("/").pop() ?? "").kind);
}

const TUM = [...MONORAY_SHEETS, ...MTC_SHEETS].map(oku);
const bul = (parca: string, sayfa?: string) =>
  TUM.find((r) => r.fileRelPath.includes(parca) && (!sayfa || r.sheetName === sayfa))!;

describe("readSheet — gerçek çalışma sayfalarına karşı", () => {
  it("onbir sayfanın hepsinde başlık satırı bulunur", () => {
    expect(TUM).toHaveLength(11);
    const bulunamayan = TUM.filter((r) => r.headerRowNo === 0);
    expect(bulunamayan.map((r) => `${r.fileRelPath}#${r.sheetName}`)).toEqual([]);
  });

  it("hiçbir sayfa boş dönmez", () => {
    expect(TUM.filter((r) => r.rows.length === 0)).toEqual([]);
  });

  it("beş ayrı sütun şekli de okunur", () => {
    const sekiller = new Set(
      TUM.map((r) => Object.keys(r.mapping).length + r.unmapped.length)
    );
    expect(sekiller.size).toBeGreaterThanOrEqual(4);
  });
});

describe("MONORAY DEPO — dokuz sütunlu klasik", () => {
  const r = bul("2.0057-00-0500_DEPO", "BOM");

  it("112 veri satırı", () => {
    expect(r.rows).toHaveLength(112);
    expect(r.headerRowNo).toBe(1);
  });

  it("Item QTY ile QTY AYRI sütunlardır", () => {
    // İndisle okumanın düştüğü tuzak tam olarak budur.
    expect(r.mapping.itemQtyRaw).toBe(6);
    expect(r.mapping.qtyRaw).toBe(7);
  });

  it("Testere satırlarında QTY bir KESİM BOYUdur, adet değil", () => {
    const testere = r.rows.find((x) => x.partNumber === "0057-00-0700-07")!;
    expect(testere.category).toBe("Testere");
    expect(testere.itemQtyRaw).toBe("1");
    expect(testere.qtyRaw).toBe("169,3 mm");
  });

  it("parça numarası olmayan 50 satır DÜŞÜRÜLMEZ", () => {
    // Satın alma listesi tam olarak o satırlardan çıkar.
    expect(r.rows.filter((x) => !x.partNumber)).toHaveLength(50);
  });

  it("Item sütunu düz sıra numarasıdır, hiyerarşi DEĞİLDİR", () => {
    expect(r.hierarchical).toBe(false);
    expect(r.rows.every((x) => x.itemPath === "")).toBe(true);
  });
});

describe("MTC ÜRÜN AĞACI — ağırlık ve gerçek ürün ağacı", () => {
  const r = bul("1.0043-01-0000_URUN AGACI", "BOM");

  it("246 satır, ürün ağacı olarak tanınır", () => {
    expect(r.sourceKind).toBe("urun_agaci");
    expect(r.rows).toHaveLength(246);
  });

  it("Item sütunu GERÇEK hiyerarşidir", () => {
    expect(r.hierarchical).toBe(true);
    expect(r.rows[0].itemPath).toBe("1");
    expect(r.rows[1].itemPath).toBe("1.1");
    expect(r.rows.some((x) => x.itemPath === "6.9.1.1")).toBe(true);
  });

  it("AĞIRLIK BURADADIR — 246/246 satır dolu", () => {
    // Faz 1'de ağırlığın PDF okumadan gelmesinin sebebi bu sütun.
    expect(r.mapping.massRaw).toBeDefined();
    expect(r.rows.filter((x) => x.massRaw)).toHaveLength(246);
    expect(r.rows[0].massRaw).toBe("1498,457 kg");
  });

  it("sözlükte olmayan sütunlar ATILMAZ, extra'da durur", () => {
    expect(r.unmapped.map((u) => u.header)).toContain("Web Link");
    expect(r.rows[0].extra["Web Link"]).toBe("MTC PASLANMAZ");
  });

  it("bölünmez boşluk taşıyan hücre okunur", () => {
    // İlk satırın Title'ı "15Tx24M KÖPRÜLÜ TAVAN VİNÇ" — U+00A0 içerir.
    expect(r.rows[0].title).toContain("KÖPRÜLÜ TAVAN");
  });
});

describe("MTC DEPO — tek dosyada ÜÇ sayfa", () => {
  it("BOM sayfası satın alma kalemlerini taşır", () => {
    const r = bul("1.0043-01-0000_DEPO", "BOM");
    expect(r.rows.length).toBeGreaterThan(200);
    expect(r.rows[0].description).toContain("YILMAZ REDUKTOR");
  });

  it("Sayfa1 sac parçalarını taşır — 'yalnız BOM oku' kuralı bunu kaybederdi", () => {
    const r = bul("1.0043-01-0000_DEPO", "Sayfa1");
    expect(r.rows.length).toBeGreaterThan(100);
    expect(r.rows[0].partNumber).toBe("0043-00-0100-01");
    expect(r.rows[0].category).toBe("Plazma");
  });

  it("Sayfa2 profil kesim boylarını taşır", () => {
    const r = bul("1.0043-01-0000_DEPO", "Sayfa2");
    expect(r.rows[0]).toMatchObject({
      partNumber: "0043-00-0200-10",
      description: "NPU 100 L=225",
      itemQtyRaw: "2",
      qtyRaw: "450 mm",
    });
  });
});

describe("HALAT KLAVUZU DEPO — yedi sütun, eksik sütunlar UYARI ÜRETMEZ", () => {
  const r = bul("1.0043-00-0850_DEPO", "BOM");

  it("Item QTY ve Category yok ama sayfa okunur", () => {
    expect(r.mapping.itemQtyRaw).toBeUndefined();
    expect(r.mapping.category).toBeUndefined();
    expect(r.rows.length).toBeGreaterThan(0);
  });

  it("olmayan sütun boş string döner, çökmez", () => {
    expect(r.rows[0].itemQtyRaw).toBe("");
    expect(r.rows[0].category).toBe("");
  });

  it("çelik olmayan malzeme de okunur", () => {
    expect(r.rows[0].materialRaw).toBe("Kestamid");
  });
});

describe("normalizeHeader", () => {
  it("bölünmez boşluk normal boşluk sayılır", () => {
    expect(normalizeHeader("ITEM QTY")).toBe("ITEM QTY");
  });

  it("İNGİLİZCE başlıklar tr-TR büyütmesinde bozulmaz", () => {
    // Gerçek hata: "Description".toLocaleUpperCase("tr-TR") → "DESCRİPTİON".
    // Sözlükteki DESCRIPTION ile eşleşmez ve sütun sessizce kaybolurdu.
    for (const h of ["Description", "Title", "Material"]) {
      expect(normalizeHeader(h)).toBe(h.toUpperCase());
    }
  });

  it("Türkçe yazımların dört hâli aynı anahtara gelir", () => {
    const hepsi = ["Açıklama", "AÇIKLAMA", "ACIKLAMA", "açiklama"].map(normalizeHeader);
    expect(new Set(hepsi).size).toBe(1);
  });
});

describe("başlık bulunamayan sayfa", () => {
  it("satır üretmez ama sessizce yok olmaz", () => {
    const r = readSheet(
      { fileRelPath: "x.xlsx", sheetName: "Notlar", rows: [["ölçüler"], ["a", "b"]] },
      "bilinmiyor"
    );
    expect(r.headerRowNo).toBe(0);
    expect(r.rows).toEqual([]);
    expect(r.sheetName).toBe("Notlar");
  });
});
