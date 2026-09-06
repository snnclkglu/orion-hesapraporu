// ÖLÇÜ ÇÖZÜMÜ — defter, düzeltme ve tahminin sırası.

import { describe, expect, it } from "vitest";
import { estimateFootprint, footprintFor, kesitOku, kutupOku } from "../footprint";
import { MODULE_PITCH_MM } from "../sizes";
import type { DeviceModel, PlacementOverride } from "../types";

const salter = {
  category: "Şalterler ve Devre Kesiciler",
  designation: "CIRCUIT BREAKER 400V 6KA, 3POLE, C, 10A",
  typeNo: "5SL6310-7",
  supplier: "Siemens",
  partNo: "SIE.5SL6310-7",
};

function defter(over: Partial<DeviceModel> = {}): DeviceModel {
  return {
    lookupKey: "SIEMENS|5SL63107",
    supplier: "Siemens",
    typeNo: "5SL6310-7",
    widthMm: 52.5,
    heightMm: 85,
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

function duzeltme(over: Partial<PlacementOverride> = {}): PlacementOverride {
  return {
    deviceKey: "T1|P1|F1",
    panelCode: null,
    mountType: null,
    zone: null,
    railIndex: null,
    orderInRail: null,
    widthMm: null,
    heightMm: null,
    depthMm: null,
    pinned: false,
    note: "",
    ...over,
  };
}

describe("kutup okuma", () => {
  it("yaygın yazımları tanır", () => {
    expect(kutupOku("3POLE")).toBe(3);
    expect(kutupOku("3 POLE")).toBe(3);
    expect(kutupOku("4P")).toBe(4);
    expect(kutupOku("2-POLE")).toBe(2);
  });

  it("1+N İKİ modüldür — nötr kutbu da yer kaplar", () => {
    expect(kutupOku("1+N")).toBe(2);
    expect(kutupOku("3 + N")).toBe(4);
  });

  it("işaret yoksa null döner", () => {
    expect(kutupOku("CIRCUIT BREAKER 10A")).toBeNull();
  });
});

describe("kesit okuma", () => {
  it("mm2 ve seri adından okur", () => {
    expect(kesitOku("TERMINAL BLOCK 2,5MM2")).toBe(2.5);
    expect(kesitOku("UT 4")).toBe(4);
    expect(kesitOku("UK 10")).toBe(10);
  });
});

describe("tahmin", () => {
  it("modüler cihazın eni kutup sayısının katıdır", () => {
    const t = estimateFootprint(salter);
    expect(t.widthMm).toBe(3 * MODULE_PITCH_MM);
    expect(t.source).toBe("tahmin");
  });

  it("kutup okunamıyorsa TAHMİN EDİLMEZ", () => {
    const t = estimateFootprint({ ...salter, designation: "CIRCUIT BREAKER 10A", typeNo: "" });
    expect(t.widthMm).toBeNull();
    expect(t.source).toBeNull();
  });

  it("klemens eni kesitten gelir — 17,5 mm modül DEĞİLDİR", () => {
    const t = estimateFootprint({
      category: "Fiş, Priz, Klemens ve Bağlantı",
      designation: "TERMINAL BLOCK 2,5MM2",
      typeNo: "UT 2,5",
      supplier: "Phoenix Contact",
      partNo: "PXC.3044076",
    });
    expect(t.widthMm).toBe(5.2);
  });

  it("sürücünün ölçüsü ailesinden ÇIKARILMAZ", () => {
    const t = estimateFootprint({
      category: "Sürücüler ve Güç Elektroniği",
      designation: "SINAMICS S120 MOTOR MODULE 30A",
      typeNo: "6SL3120-1TE23-0AC0",
      supplier: "Siemens",
      partNo: "SIE.6SL3120",
    });
    expect(t.widthMm).toBeNull();
  });

  it("trafo tahmin edilmez, anahtarlamalı güç kaynağı edilir", () => {
    const trafo = estimateFootprint({
      category: "Güç Kaynakları ve Trafolar",
      designation: "CONTROL TRANSFORMER 1000VA",
      typeNo: "4AM5742",
      supplier: "Siemens",
      partNo: "",
    });
    expect(trafo.widthMm).toBeNull();

    const psu = estimateFootprint({
      category: "Güç Kaynakları ve Trafolar",
      designation: "POWER SUPPLY 24VDC 10A",
      typeNo: "6EP1334",
      supplier: "Siemens",
      partNo: "",
    });
    expect(psu.widthMm).toBe(50);
  });
});

describe("kaynak sırası", () => {
  it("defter tahmini yener", () => {
    const f = footprintFor(salter, defter({ widthMm: 54 }), null);
    expect(f.widthMm).toBe(54);
    expect(f.source).toBe("katalog");
  });

  it("elle düzeltme defteri yener", () => {
    const f = footprintFor(salter, defter(), duzeltme({ widthMm: 60 }));
    expect(f.widthMm).toBe(60);
  });

  it("KAYNAK EN ZAYIF HALKAYA GÖRE verilir", () => {
    // Eni defterden, boyu tahminden gelen bir cihaz doğrulanmış SAYILMAZ:
    // sipariş sayacı onu geçerli sayarsa gövde ölçüsü yanlış çıkar.
    const f = footprintFor(salter, defter({ heightMm: null }), null);
    expect(f.widthMm).toBe(52.5);
    expect(f.heightMm).toBe(85);
    expect(f.source).toBe("tahmin");
  });

  it("hiçbiri veremezse ölçü BOŞ kalır — sıfır değil", () => {
    const f = footprintFor(
      { category: "Kamera ve Görüntüleme", designation: "IP CAMERA", typeNo: "DS-2CD", supplier: "Hikvision", partNo: "" },
      null,
      null
    );
    expect(f.widthMm).toBeNull();
    expect(f.source).toBeNull();
  });
});
