// Malzeme listesi okuyucusunun birim testleri.
//
// FİKSTÜR ELLE YAZILMIŞTIR ve gerçek belgeden ÖLÇÜLEREK alınmıştır (185/40T
// Şarj Vinci elektrik projesi, s. 145 ve 157): sütun kenarları 43 · 252 · 281
// · 575 · 780 · 927, başlıklar 98,6 · 221,6 · 396,7 · 643,1 · 829 · 1013,4.
// 12 MB'lık müşteri belgesi repoya GİRMEZ; onun üzerindeki duman testi
// `scripts/test-electrical-read.ts`tir.

import { describe, expect, it } from "vitest";
import { cleanElectricalPart, readPartsList, type PdfSpan } from "../parts-list";
import { parseDeviceTag } from "../device-tag";
import { materialRows, rollupBy } from "../rollup";
import { groupSheetsByLocation, isPageListRoot, parseSheetTitle } from "../sheet-index";

const H = 6.34;

function span(text: string, x: number, y: number, h = H): PdfSpan {
  return { text, x, y, w: text.length * 0.5 * h, h };
}

/** Gerçek belgenin başlık satırı — ORTALANMIŞ başlıklar. */
const BASLIK: PdfSpan[] = [
  span("Device tag", 98.6, 744.8, 8.8),
  span("Quantity", 221.6, 744.8, 8.8),
  span("Designation", 396.7, 744.8, 8.8),
  span("Type number", 643.1, 744.8, 8.8),
  span("Supplier", 829, 744.8, 8.8),
  span("Part number", 1013.4, 744.8, 8.8),
];

/** Çizim çerçevesinin sütun numaraları — tabloya karışmamalı. */
const CERCEVE: PdfSpan[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) =>
  span(String(n), 58.1 + n * 119.05, 831.6, 5.28)
);

function satir(y: number, tag: string, qty: string, desig: string, type: string, sup: string, part: string): PdfSpan[] {
  const out: PdfSpan[] = [];
  if (qty) out.push(span(qty, 251.7, y + 0.1));
  if (tag) out.push(span(tag, 42.5, y));
  if (desig) out.push(span(desig, 280.6, y));
  if (type) out.push(span(type, 575.4, y));
  if (sup) out.push(span(sup, 779.5, y));
  if (part) out.push(span(part, 926.9, y));
  return out;
}

describe("readPartsList", () => {
  it("gerçek yerleşimde satırları ve sütunları doğru okur", () => {
    const spans = [
      ...CERCEVE,
      ...BASLIK,
      ...satir(717.5, "=185T+SD1-F15", "1", "CIRCUIT BREAKER 400V 6KA, 3POLE, C, 63A", "5SL6363-7", "Siemens", "SIE.5SL6363-7"),
      ...satir(706.1, "=185T+SD1-Q12", "1", "SIRCO 3x1250A 0-I Load Break Switch", "26003121", "SOCOMEC", "SOC.26003121"),
    ];
    const { found, parts } = readPartsList(spans, 145);
    expect(found).toBe(true);
    expect(parts).toHaveLength(2);
    expect(parts[0]).toMatchObject({
      deviceTag: "=185T+SD1-F15",
      installation: "185T",
      location: "SD1",
      device: "F15",
      qty: 1,
      designation: "CIRCUIT BREAKER 400V 6KA, 3POLE, C, 63A",
      typeNo: "5SL6363-7",
      supplier: "Siemens",
      partNo: "SIE.5SL6363-7",
      page: 145,
    });
  });

  it("ADET SÜTUNU SOLA DAYALI DEĞİLDİR: iki haneli adet tek haneliyi düşürmez", () => {
    // Gerçek belgenin 157. sayfasındaki hata: "1" x=251,7'de, "24" x=248,3'te
    // başlıyor ve iki ayrı sütun kümesi doğuruyordu; yedinci küme altı
    // başlıkla eşlemeyi kaydırıp tek haneli bütün adetleri düşürüyordu.
    const spans = [...BASLIK];
    for (let i = 0; i < 6; i++) {
      const y = 717.5 - i * 11.3;
      const cift = i % 2 === 0;
      spans.push(
        span(cift ? "24" : "1", cift ? 248.3 : 251.7, y + 0.1),
        span(`=185T+TB1-X${i}`, 42.5, y),
        span("Feed-through terminal block PT 2,5", 280.6, y),
        span("PT 2,5", 575.4, y),
        span("Phoenix Contact", 779.5, y),
        span("PXC.3209510", 926.9, y)
      );
    }
    const { parts } = readPartsList(spans, 157);
    expect(parts).toHaveLength(6);
    expect(parts.map((p) => p.qty)).toEqual([24, 1, 24, 1, 24, 1]);
  });

  it("sarmış hücreyi aynı kayda ekler, çerçeve yazısını almaz", () => {
    const spans = [
      ...CERCEVE,
      ...BASLIK,
      ...satir(717.5, "=185T+LVD01-A111", "1", "SINAMICS S120 CONTROL", "6SL3040-1MA01-0AA0", "Siemens", "SIE.6SL3040"),
      // Devam satırı: tanım ikinci satıra sarmış.
      span("UNIT CU320-2 PN", 280.6, 711.2),
      // Sayfa altbilgisi — tablodan uzak, alınmamalı.
      span("F01_0011", 1118.3, 40),
    ];
    const { parts } = readPartsList(spans, 145);
    expect(parts).toHaveLength(1);
    expect(parts[0].designation).toBe("SINAMICS S120 CONTROL UNIT CU320-2 PN");
    expect(parts[0].partNo).toBe("SIE.6SL3040");
  });

  it("tabloya yakın EPLAN antedini son ürüne eklemez ve REVISION'ı ürün saymaz", () => {
    const spans = [
      ...CERCEVE,
      ...BASLIK,
      ...satir(717.5, "=A3+LVD0-F25", "1", "Auxiliary switch", "5ST3010", "Siemens", "SIE.5ST3010"),
      span("DATE NAME DRAW 8.08.2026", 280.6, 711.2),
      span("SIGN ALİAĞA / İZMİR", 575.4, 711.2),
      span("2 SHEET FORM DATE NAME", 926.9, 711.2),
      ...satir(700, "REVISION", "", "DATE APPROVAL", "Parts list", "HABAŞ", "DRAWING NO = Sheet 1"),
    ];
    const { parts } = readPartsList(spans, 109);
    expect(parts).toHaveLength(1);
    expect(parts[0]).toMatchObject({
      designation: "Auxiliary switch",
      typeNo: "5ST3010",
      partNo: "SIE.5ST3010",
    });
  });

  it("antette tek başına kalan sayfa numarasını malzeme koduna eklemez", () => {
    const spans = [
      ...CERCEVE,
      ...BASLIK,
      ...satir(717.5, "=A3+LVD0-F25", "1", "Auxiliary switch", "5ST3010", "Siemens", "SIE.5ST3010"),
      span("2", 926.9, 711.2),
    ];
    expect(readPartsList(spans, 109).parts[0].partNo).toBe("SIE.5ST3010");
  });

  it("restore edilmiş eski satırdaki antet eklerini temizler", () => {
    const eski = {
      deviceTag: "=A3+LVD0-F25",
      installation: "A3",
      location: "LVD0",
      device: "F25",
      qty: 1,
      designation: "Auxiliary switch DATE NAME DRAW 8.08.2026 H.ORAN",
      typeNo: "5ST3010 SIGN ALİAĞA / İZMİR",
      supplier: "Siemens",
      partNo: "SIE.5ST3010 2 SHEET FORM DATE NAME SIGN A3",
      page: 109,
    };
    expect(cleanElectricalPart(eski)).toMatchObject({
      designation: "Auxiliary switch",
      typeNo: "5ST3010",
      partNo: "SIE.5ST3010",
    });
    expect(cleanElectricalPart({ ...eski, partNo: "SIE.5ST3010 2" })?.partNo).toBe(
      "SIE.5ST3010"
    );
    expect(cleanElectricalPart({ ...eski, typeNo: "5ST3010 İMZA KARDEMİR" })?.typeNo).toBe(
      "5ST3010"
    );
    expect(
      cleanElectricalPart({
        ...eski,
        designation: "Auxiliary switch TARİH İSİM ÇİZEN 27.06.2026 H.ORAN",
        partNo: "SIE.5ST3010 2 KAĞIT FORMU TARİH İSİM İMZA A3",
      })
    ).toMatchObject({
      designation: "Auxiliary switch",
      partNo: "SIE.5ST3010",
    });
    expect(cleanElectricalPart({ ...eski, deviceTag: "REVISION" })).toBeNull();
    expect(
      cleanElectricalPart({
        ...eski,
        supplier: "SE ASTOR",
        partNo: "SE.5ST3010 KAĞIT FORMU TARİH İSİM İMZA A3",
      })
    ).toMatchObject({ supplier: "SE", partNo: "SE.5ST3010" });
  });

  it("başlık yoksa BOŞ döner — uydurma satır üretmez", () => {
    const spans = [...CERCEVE, span("=185T+SD1-F15", 42.5, 717.5), span("1", 251.7, 717.5)];
    expect(readPartsList(spans, 3)).toEqual({ parts: [], found: false });
  });

  it("okunamayan adet null kalır, 1 varsayılmaz (değişmez md. 4)", () => {
    const spans = [
      ...BASLIK,
      ...satir(717.5, "=185T+SD1-F15", "", "CIRCUIT BREAKER", "5SL6363-7", "Siemens", "SIE.5SL6363-7"),
    ];
    const { parts } = readPartsList(spans, 145);
    expect(parts[0].qty).toBeNull();
  });

  it("Türkçe başlıklı bir dışa aktarımı da tanır", () => {
    const spans = [
      span("Cihaz Kodu", 98.6, 744.8, 8.8),
      span("Adet", 221.6, 744.8, 8.8),
      span("Tanım", 396.7, 744.8, 8.8),
      span("Tip No", 643.1, 744.8, 8.8),
      span("Tedarikçi", 829, 744.8, 8.8),
      span("Malzeme No", 1013.4, 744.8, 8.8),
      ...satir(717.5, "=1T+P1-F1", "2", "OTOMATİK SİGORTA", "5SL6210-7", "Siemens", "SIE.5SL6210-7"),
    ];
    const { found, parts } = readPartsList(spans, 9);
    expect(found).toBe(true);
    expect(parts[0]).toMatchObject({ qty: 2, supplier: "Siemens", typeNo: "5SL6210-7" });
  });
});

describe("parseDeviceTag", () => {
  it("tesis · konum · aygıt olarak ayırır", () => {
    expect(parseDeviceTag("=185T+LVD01-F31")).toEqual({
      installation: "185T",
      location: "LVD01",
      device: "F31",
    });
  });

  it("sıra değişse de ön eki okur", () => {
    expect(parseDeviceTag("+LVD01=185T-F31")).toEqual({
      installation: "185T",
      location: "LVD01",
      device: "F31",
    });
  });

  it("ön eksiz etiket AYGIT sayılır", () => {
    expect(parseDeviceTag("F31")).toEqual({ installation: "", location: "", device: "F31" });
  });

  it("boş girdi boş döner", () => {
    expect(parseDeviceTag("  ")).toEqual({ installation: "", location: "", device: "" });
  });
});

describe("sheet-index", () => {
  it("yer imi başlığını çözer", () => {
    expect(parseSheetTitle("=185T+LVD01/12 Ana Besleme/ CU320 I/O Kontrol-1", 13)).toEqual({
      page: 13,
      installation: "185T",
      location: "LVD01",
      sheetNo: "12",
      title: "Ana Besleme/ CU320 I/O Kontrol-1",
    });
  });

  it("konumsuz kapak sayfasını da çözer", () => {
    expect(parseSheetTitle("=185T/1 Başlık / kapak sayfası", 1)).toMatchObject({
      installation: "185T",
      location: "",
      sheetNo: "1",
      title: "Başlık / kapak sayfası",
    });
  });

  it("kökü adından tanır", () => {
    expect(isPageListRoot("Page list")).toBe(true);
    expect(isPageListRoot("Sayfa Listesi")).toBe(true);
    expect(isPageListRoot("Page tree")).toBe(false);
  });

  it("panoya göre öbekler, BELGEDEKİ sırayı korur", () => {
    const s = [
      parseSheetTitle("=1T+A/1 a", 1),
      parseSheetTitle("=1T+A/2 b", 2),
      parseSheetTitle("=1T+B/1 c", 3),
    ];
    expect(groupSheetsByLocation(s).map((g) => g.location)).toEqual(["A", "B"]);
  });
});

describe("rollup", () => {
  const parts = [
    { deviceTag: "=1T+A-F1", installation: "1T", location: "A", device: "F1", qty: 2, designation: "SİGORTA", typeNo: "T1", supplier: "Siemens", partNo: "SIE.T1", page: 1 },
    { deviceTag: "=1T+B-F2", installation: "1T", location: "B", device: "F2", qty: 3, designation: "SİGORTA", typeNo: "T1", supplier: "Siemens", partNo: "SIE.T1", page: 1 },
    { deviceTag: "=1T+B-K1", installation: "1T", location: "B", device: "K1", qty: null, designation: "KONTAKTÖR", typeNo: "T2", supplier: "Siemens", partNo: "SIE.T2", page: 2 },
  ];

  it("aynı ürünü tek satıra indirir ve konumlarını sayar", () => {
    const rows = materialRows(parts);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ partNo: "SIE.T1", qty: 5, locations: ["A", "B"] });
  });

  it("ürün atanmamış aygıtı sipariş edilebilir malzemeye çevirmez", () => {
    const urunsuz = {
      deviceTag: "=1T+B-U64",
      installation: "1T",
      location: "B",
      device: "U64",
      qty: 0,
      designation: "",
      typeNo: "",
      supplier: "",
      partNo: "",
      page: 2,
    };
    expect(materialRows([...parts, urunsuz])).toHaveLength(2);
  });

  it("hiç adet okunamadıysa toplam null kalır — sıfır DEĞİL", () => {
    expect(materialRows(parts)[1].qty).toBeNull();
  });

  it("panel dökümünü adete göre sıralar", () => {
    expect(rollupBy(parts, "location").map((r) => r.label)).toEqual(["+B", "+A"]);
  });
});
