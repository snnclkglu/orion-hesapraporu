// ÜRÜN ÖLÇÜ DEFTERİ — satır derleme, arama ve süzgeç.

import { describe, expect, it } from "vitest";
import type { ElectricalPart } from "@/lib/electrical/types";
import {
  EMPTY_BOOK_FILTER,
  bookCounts,
  bookFilterIsEmpty,
  bookSourceBucket,
  buildBook,
  filterBook,
} from "../book";
import type { DeviceModel } from "../types";

function parca(over: Partial<ElectricalPart> = {}): ElectricalPart {
  return {
    deviceTag: "=T1+P1-F1",
    installation: "T1",
    location: "P1",
    device: "F1",
    qty: 1,
    designation: "CIRCUIT BREAKER 400V 6KA, 3POLE, C, 10A",
    typeNo: "5SL6310-7",
    supplier: "Siemens",
    partNo: "SIE.5SL6310-7",
    page: 145,
    ...over,
  };
}

const KLEMENS = {
  designation: "Feed-through terminal block PT 2,5",
  typeNo: "PT 2,5",
  supplier: "Phoenix Contact",
  partNo: "PXC.3209510",
};

function defterSatiri(over: Partial<DeviceModel> = {}): DeviceModel {
  return {
    lookupKey: "SIEMENS|5SL63107",
    supplier: "Siemens",
    typeNo: "5SL6310-7",
    widthMm: 54,
    heightMm: 90,
    depthMm: 70,
    moduleUnits: 3,
    mountType: "din",
    zone: "giris",
    clearanceTopMm: null,
    clearanceBottomMm: null,
    heatW: null,
    source: "katalog",
    note: "",
    ...over,
  };
}

describe("defter satırları", () => {
  it("aynı ürünün aygıtlarını tek satırda toplar", () => {
    const rows = buildBook({
      parts: [
        parca({ device: "F1", deviceTag: "=T1+P1-F1" }),
        parca({ device: "F2", deviceTag: "=T1+P1-F2" }),
        parca({ device: "F3", deviceTag: "=T1+P1-F3" }),
      ],
      models: [],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].deviceCount).toBe(3);
  });

  it("aynı aygıtın ikinci satırı ürünü İKİ KEZ saymaz", () => {
    // Bir kontaktör + yardımcı kontak bloğu aynı etiketle iki satır olur.
    const rows = buildBook({
      parts: [parca({ device: "K1", deviceTag: "=T1+P1-K1" }), parca({ device: "K1", deviceTag: "=T1+P1-K1" })],
      models: [],
    });
    expect(rows[0].deviceCount).toBe(1);
  });

  it("klemens şeridinde ADET birim sayısıdır", () => {
    const rows = buildBook({
      parts: [parca({ ...KLEMENS, device: "X1", deviceTag: "=T1+P1-X1", qty: 200 })],
      models: [],
    });
    expect(rows[0].unitCount).toBe(200);
    // 200 × 5,2 mm — defteri doldurma sırasını bu belirler.
    expect(Math.round(rows[0].railMm)).toBe(1040);
  });

  it("defter kaydı tahmini yener ve kaynağı `katalog` yapar", () => {
    const rows = buildBook({ parts: [parca()], models: [defterSatiri()] });
    expect(rows[0].widthMm).toBe(54);
    expect(bookSourceBucket(rows[0])).toBe("katalog");
    expect(rows[0].inBook).toBe(true);
  });

  it("defterde olup projede geçmeyen ürün de görünür", () => {
    const rows = buildBook({
      parts: [parca()],
      models: [defterSatiri(), defterSatiri({ lookupKey: "ABB|AF30", supplier: "ABB", typeNo: "AF30" })],
    });
    const abb = rows.find((r) => r.typeNo === "AF30");
    expect(abb).toBeDefined();
    expect(abb!.deviceCount).toBe(0);
  });

  it("panoya girmeyen ürün ölçü İSTEMEZ", () => {
    const rows = buildBook({
      parts: [
        parca({
          device: "M1",
          deviceTag: "=T1+P1-M1",
          designation: "ASYNCHRONOUS MOTOR 15KW",
          typeNo: "1LE1001",
          partNo: "SIE.1LE1001",
        }),
      ],
      models: [],
    });
    expect(rows[0].needsDimensions).toBe(false);
    expect(bookCounts(rows).panoya).toBe(0);
  });
});

describe("arama ve süzgeç", () => {
  const rows = buildBook({
    parts: [
      parca({ device: "F1", deviceTag: "=T1+P1-F1" }),
      parca({ ...KLEMENS, device: "X1", deviceTag: "=T1+P1-X1", qty: 100 }),
      parca({
        device: "T1",
        deviceTag: "=T1+P1-T1",
        designation: "SINAMICS S120 MOTOR MODULE",
        typeNo: "6SL3120-1TE23-0AC0",
        supplier: "Siemens",
        partNo: "SIE.6SL3120",
      }),
    ],
    models: [],
  });

  it("boş süzgeç her şeyi geçirir", () => {
    expect(bookFilterIsEmpty(EMPTY_BOOK_FILTER)).toBe(true);
    expect(filterBook(rows, EMPTY_BOOK_FILTER)).toHaveLength(rows.length);
  });

  it("arama TÜRKÇE katlanır — büyük/küçük İ tuzağı", () => {
    // Tarayıcıda /SIEMENS/i "Siemens"i bulur ama `trKatla` olmadan "İ" taşıyan
    // bir marka aramada kaybolurdu (`turkce-i-regex-tuzagi`).
    expect(filterBook(rows, { ...EMPTY_BOOK_FILTER, q: "siemens" }).length).toBeGreaterThan(0);
    expect(filterBook(rows, { ...EMPTY_BOOK_FILTER, q: "PHOENIX" })).toHaveLength(1);
  });

  it("kaynak süzgeci `eksik` kovasını da tanır", () => {
    const eksik = filterBook(rows, { ...EMPTY_BOOK_FILTER, source: "eksik" });
    expect(eksik).toHaveLength(1);
    expect(eksik[0].typeNo).toBe("6SL3120-1TE23-0AC0");
  });

  it("yalnız doğrulanmamış: ölçülmüş ürünü eler", () => {
    const olculu = buildBook({ parts: [parca()], models: [defterSatiri()] });
    expect(filterBook(olculu, { ...EMPTY_BOOK_FILTER, onlyUnverified: true })).toHaveLength(0);
  });

  it("marka süzgeci", () => {
    expect(filterBook(rows, { ...EMPTY_BOOK_FILTER, supplier: "Phoenix Contact" })).toHaveLength(1);
  });

  it("öntanım sıra ETKİYE göredir — en çok ray belirleyen üstte", () => {
    const sirali = filterBook(rows, EMPTY_BOOK_FILTER);
    expect(sirali[0].typeNo).toBe("PT 2,5");
  });

  it("sayaçlar süzgeçten BAĞIMSIZ toplamı verir", () => {
    const s = bookCounts(rows);
    expect(s.panoya).toBe(3);
    expect(s.tahmin).toBe(2);
    expect(s.eksik).toBe(1);
    expect(s.olculdu).toBe(0);
  });
});
