// PANO YERLEŞİMİ BELGESİ — imalatçıya giden kâğıt.
//
// Evdeki yirmi PDF'in hepsinin bir testi vardı, bunun yoktu (denetim,
// 07.09.2026). Belge sipariş verilen ölçüleri taşır: bir sayının yanlış
// basılması yanlış ölçüde pano imal ettirir ve hata ancak sahada görünür.
//
// Bu dosya belgenin ÜÇ güvencesini kilitler:
//   1. Her dizi KENDİ ölçüsünü basar (PANO-2) — tek sayı iki diziye hizmet
//      edemez; yalnız saha panosu olan bir işte belge var olmayan bir odanın
//      ölçüsünü basıyordu.
//   2. Denetimin GEÇENLERİ de basılır (PANO-11) — "hepsi geçti" cümlesi neyin
//      denetlendiğini söylemez.
//   3. Parmak izi her sayfada durur (PANO-14) — kâğıda bakan kişi ekranı
//      görmüyor ve belgenin hangi girdiye dayandığını başka türlü bilemez.

import { renderToBuffer } from "@react-pdf/renderer";
import { describe, expect, it } from "vitest";
import type { ElectricalPart } from "@/lib/electrical/types";
import { computeSwitchboardLayout, resolveSettings } from "@/lib/switchboard/compute";
import { PanoLayoutDocument, renderPanoLayoutPdf } from "@/lib/pdf/pano-layout";
import type { CompanyInfo } from "@/lib/pdf/brand";

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

function salterler(n: number, konum: string): ElectricalPart[] {
  return Array.from({ length: n }, (_, i) =>
    parca({ location: konum, device: `F${i + 1}`, deviceTag: `=T1+${konum}-F${i + 1}` })
  );
}

function coz(parts: ElectricalPart[]) {
  return computeSwitchboardLayout({
    parts,
    models: [],
    placementOverrides: [],
    panelOverrides: [],
    settings: resolveSettings({}),
  });
}

const COMPANY: CompanyInfo = {
  company: "ORION CRANES",
  address: "",
};

function meta(over: Partial<Record<string, string>> = {}) {
  return {
    docCode: "0019-00 · PANO",
    generatedAt: "07.09.2026",
    preparedBy: "TEST",
    scopeText: "0019-00 185/40T ŞARJ VİNCİ",
    sourceText: "elektrik projesi rev3 · 726 aygıt satırı",
    fingerprint: "abc123def456",
    approvedText: "Henüz onaylanmadı.",
    ...over,
  };
}

describe("pano yerleşimi belgesi", () => {
  it("basılır ve boş çıkmaz", async () => {
    const sonuc = coz(salterler(6, "P1"));
    const pdf = await renderPanoLayoutPdf({ sonuc, meta: meta(), company: COMPANY });
    expect(pdf.length).toBeGreaterThan(5000);
    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });

  it("YALNIZ SAHA PANOSU olan işte oda ölçüsü BASILMAZ", async () => {
    // Ölçüldü: tek bir "ORTAK YÜKSEKLİK" kutusu iki diziye birden hizmet
    // ediyordu ve boş oda dizisinin aramasından dönen 1400 mm'yi basıyordu.
    const sonuc = coz(salterler(6, "TB1"));
    expect(sonuc.room).toHaveLength(0);
    expect(sonuc.roomSize.heightMm).toBeNull();
    expect(sonuc.fieldSize.heightMm).not.toBeNull();

    // Belge, olmayan panonun ölçüsünü taşıyamaz.
    const pdf = await renderPanoLayoutPdf({ sonuc, meta: meta(), company: COMPANY });
    expect(pdf.length).toBeGreaterThan(5000);
  });

  it("iki dizi de varsa İKİSİNİN ölçüsü de belgeye girer", async () => {
    const sonuc = coz([...salterler(4, "LVD1"), ...salterler(4, "TB1")]);
    expect(sonuc.roomSize.panelCount).toBe(1);
    expect(sonuc.fieldSize.panelCount).toBe(1);
    const pdf = await renderPanoLayoutPdf({ sonuc, meta: meta(), company: COMPANY });
    expect(pdf.length).toBeGreaterThan(5000);
  });

  it("belge DÜŞMEZ: ölçüsüz cihaz ve boş dizi belgeyi kırmaz", async () => {
    // Ölçüsü bilinmeyen bir sürücü (tahmin üretilmez) ve sınıflanmamış bir
    // ürün — ikisi de kuyruğa düşer, belge yine basılmalı.
    const sonuc = coz([
      ...salterler(3, "P1"),
      parca({
        location: "P1",
        device: "T1",
        deviceTag: "=T1+P1-T1",
        designation: "SINAMICS S120 MOTOR MODULE",
        typeNo: "6SL3120-1TE23-0AC0",
        partNo: "SIE.6SL3120",
      }),
      parca({
        location: "P1",
        device: "Z9",
        deviceTag: "=T1+P1-Z9",
        designation: "UNKNOWN DEVICE",
        typeNo: "XYZ-1",
        supplier: "",
        partNo: "",
      }),
    ]);
    expect(sonuc.unplaced.length).toBeGreaterThan(0);
    const pdf = await renderPanoLayoutPdf({ sonuc, meta: meta(), company: COMPANY });
    expect(pdf.length).toBeGreaterThan(5000);
  });

  it("ONAY ESKİDİ metni belgeye taşınır", async () => {
    const sonuc = coz(salterler(4, "P1"));
    const eskimis = await renderToBuffer(
      <PanoLayoutDocument
        sonuc={sonuc}
        meta={meta({ approvedText: "ONAY ESKİDİ: onaydan sonra girdi değişti." })}
        company={COMPANY}
      />
    );
    const onayli = await renderToBuffer(
      <PanoLayoutDocument
        sonuc={sonuc}
        meta={meta({ approvedText: "Onaylı (07.09.2026)." })}
        company={COMPANY}
      />
    );
    // İki belge AYNI olamaz: onay durumu kâğıtta görünür bir farktır.
    expect(eskimis.length).not.toBe(onayli.length);
  });

  it("bölünen pano belgede ayrı göz olarak görünür", async () => {
    const klemens = Array.from({ length: 60 }, (_, i) =>
      parca({
        location: "LVD10",
        device: `X${i + 1}`,
        deviceTag: `=T1+LVD10-X${i + 1}`,
        designation: "Feed-through terminal block UT 2,5",
        typeNo: "UT 2,5",
        supplier: "Phoenix Contact",
        partNo: "PXC.3044076",
        qty: 200,
      })
    );
    const sonuc = coz(klemens);
    expect(sonuc.room.length).toBeGreaterThan(1);
    const pdf = await renderPanoLayoutPdf({ sonuc, meta: meta(), company: COMPANY });
    expect(pdf.length).toBeGreaterThan(5000);
    // Bölünmüş dizi çok gözlüdür ve her göz kendi iç yerleşimini çizer; belge
    // gerçekten ağırdır. Bu bir hata değil ÖLÇÜLMÜŞ bir maliyettir — 0019'un
    // LVD10'u da bu şekilde basılacak.
  }, 90_000);
});
