// TEKLİF KARŞILAŞTIRMA — saf çekirdek testleri.
//
// Fikstür kullanıcının gösterdiği çalışma dosyasının SAYILARIDIR (HEA 120/200/
// 240, üç firma, 90/90/60 gün vade) — uydurma sayılarla bakmak, "en ucuz birim
// fiyat en ucuz teklif değildir" kuralının gerçekten çalıştığını göstermez.

import { describe, expect, it } from "vitest";
import {
  karsilastirmaKur,
  teslimYazisi,
  vadeYazisi,
  type KarsilastirmaKalemi,
  type KarsilastirmaTeklifi,
} from "../karsilastirma";

const KALEMLER: KarsilastirmaKalemi[] = [
  { key: "HEA120", tanim: "HEA 120 S235JR", miktar: 360, birim: "Kg" },
  { key: "HEA200", tanim: "HEA 200 S235JR", miktar: 2550, birim: "Kg" },
  { key: "HEA240", tanim: "HEA 240 S235JR", miktar: 3620, birim: "Kg" },
];

function t(
  key: string,
  tedarikci: string,
  fiyat: number,
  vade: number,
  teslim: number | null
): KarsilastirmaTeklifi {
  return {
    key,
    tedarikci,
    birimFiyat: fiyat,
    paraBirimi: "EUR",
    birimFiyatEur: fiyat,
    vadeGun: vade,
    teslimGun: teslim,
  };
}

/** Kullanıcının tablosundaki üç firma, dokuz fiyat. */
const TEKLIFLER: KarsilastirmaTeklifi[] = [
  t("HEA120", "EAG DEMİR", 38.0, 90, 20),
  t("HEA200", "EAG DEMİR", 38.0, 90, 0),
  t("HEA240", "EAG DEMİR", 43.0, 90, 0),
  t("HEA120", "RZK", 37.5, 90, 0),
  t("HEA200", "RZK", 37.5, 90, 0),
  t("HEA240", "RZK", 42.0, 90, 0),
  t("HEA120", "HAKAN SAC METAL", 42.5, 60, 0),
  t("HEA200", "HAKAN SAC METAL", 43.7, 60, 0),
  t("HEA240", "HAKAN SAC METAL", 47.5, 60, 0),
];

describe("karşılaştırma matrisi", () => {
  const tablo = karsilastirmaKur(KALEMLER, TEKLIFLER);

  it("sütun TEDARİKÇİDİR — aynı firmanın üç teklifi tek sütunda toplanır", () => {
    expect(tablo.sutunlar.map((s) => s.tedarikci)).toEqual([
      "EAG DEMİR",
      "HAKAN SAC METAL",
      "RZK",
    ]);
  });

  it("TUTAR MİKTARLA ÇARPILIR — kullanıcının tablosundaki sayılar", () => {
    const hea120 = tablo.satirlar[0];
    expect(hea120.hucreler.get("EAG DEMİR")?.tutarEur).toBeCloseTo(13680, 0);
    expect(hea120.hucreler.get("RZK")?.tutarEur).toBeCloseTo(13500, 0);
    expect(hea120.hucreler.get("HAKAN SAC METAL")?.tutarEur).toBeCloseTo(15300, 0);
  });

  it("firma toplamları kullanıcının tablosuyla birebir", () => {
    const bul = (ad: string) => tablo.sutunlar.find((s) => s.tedarikci === ad)!;
    expect(bul("EAG DEMİR").toplamEur).toBeCloseTo(266240, 0);
    expect(bul("RZK").toplamEur).toBeCloseTo(261165, 0);
    expect(bul("HAKAN SAC METAL").toplamEur).toBeCloseTo(298685, 0);
  });

  it("satır satır EN UCUZ işaretlenir", () => {
    for (const s of tablo.satirlar) {
      expect(s.enUcuzTedarikci, s.kalem.tanim).toBe("RZK");
      expect(s.hucreler.get("RZK")?.enUcuz).toBe(true);
      expect(s.hucreler.get("EAG DEMİR")?.enUcuz).toBe(false);
    }
  });

  it("tek firmadan en ucuz seçenek hesaplanır", () => {
    expect(tablo.enIyiTekFirma?.tedarikci).toBe("RZK");
    expect(tablo.enIyiTekFirma?.toplamEur).toBeCloseTo(261165, 0);
  });

  it("bölünmüş sipariş bu fikstürde tek firmayla AYNIDIR — RZK her satırda ucuz", () => {
    expect(tablo.enIyiBolunmusToplamEur).toBeCloseTo(261165, 0);
  });
});

describe("bölünmüş sipariş gerçekten kazandırıyorsa gösterir", () => {
  it("en ucuz firma her satırda aynı değilse bölünmüş toplam DAHA DÜŞÜKTÜR", () => {
    const tablo = karsilastirmaKur(KALEMLER, [
      t("HEA120", "A", 30, 0, 0),
      t("HEA200", "A", 45, 0, 0),
      t("HEA240", "A", 45, 0, 0),
      t("HEA120", "B", 40, 0, 0),
      t("HEA200", "B", 40, 0, 0),
      t("HEA240", "B", 40, 0, 0),
    ]);
    // A: 360×30 + 2550×45 + 3620×45 = 288.450 · B: 6530×40 = 261.200
    expect(tablo.enIyiTekFirma?.tedarikci).toBe("B");
    expect(tablo.enIyiTekFirma?.toplamEur).toBeCloseTo(261200, 0);
    // Bölünmüş: HEA120 A'dan (10.800) + kalanı B'den (102.000 + 144.800)
    expect(tablo.enIyiBolunmusToplamEur).toBeCloseTo(257600, 0);
    expect(tablo.enIyiBolunmusToplamEur).toBeLessThan(tablo.enIyiTekFirma!.toplamEur);
  });
});

describe("eksik ve geçersiz teklifler", () => {
  it("EKSİK TEKLİF SAYILIR ve toplam KARŞILAŞTIRILAMAZ diye işaretlenir", () => {
    const tablo = karsilastirmaKur(KALEMLER, [
      t("HEA120", "A", 30, 0, 0),
      t("HEA200", "A", 30, 0, 0),
      t("HEA120", "B", 40, 0, 0),
      t("HEA200", "B", 40, 0, 0),
      t("HEA240", "B", 40, 0, 0),
    ]);
    const a = tablo.sutunlar.find((s) => s.tedarikci === "A")!;
    expect(a.eksikKalem).toBe(1);
    expect(a.tamKapsam).toBe(false);
    // TAM KAPSAMLI OLMAYAN FİRMA "tek firmadan en ucuz" YARIŞINA GİRMEZ:
    // 87.300 € ile 261.200 €'yu karşılaştırmak sahte bir kazanan üretirdi.
    expect(tablo.enIyiTekFirma?.tedarikci).toBe("B");
  });

  it("KURU OLMAYAN TEKLİF YARIŞA GİRMEZ", () => {
    const tablo = karsilastirmaKur(KALEMLER.slice(0, 1), [
      { ...t("HEA120", "A", 30, 0, 0), birimFiyatEur: null },
      t("HEA120", "B", 40, 0, 0),
    ]);
    expect(tablo.sutunlar.map((s) => s.tedarikci)).toEqual(["A", "B"]);
    expect(tablo.satirlar[0].hucreler.has("A")).toBe(false);
    expect(tablo.satirlar[0].enUcuzTedarikci).toBe("B");
  });

  it("aynı firma iki kez fiyat verdiyse UCUZ OLANI kalır", () => {
    const tablo = karsilastirmaKur(KALEMLER.slice(0, 1), [
      t("HEA120", "A", 40, 0, 0),
      t("HEA120", "A", 35, 0, 0),
    ]);
    expect(tablo.satirlar[0].hucreler.get("A")?.birimFiyatEur).toBe(35);
  });

  it("TESLİMİ BİLİNMEYEN VARSA 'en geç teslim' de BİLİNMEZ", () => {
    const tablo = karsilastirmaKur(KALEMLER.slice(0, 2), [
      t("HEA120", "A", 30, 0, 10),
      t("HEA200", "A", 30, 0, null),
    ]);
    expect(tablo.sutunlar[0].enGecTeslimGun).toBeNull();
  });

  it("miktarı bilinmeyen kalemde tutar hesaplanmaz", () => {
    const tablo = karsilastirmaKur([{ key: "X", tanim: "X", miktar: null, birim: "Kg" }], [
      t("X", "A", 30, 0, 0),
    ]);
    expect(tablo.satirlar[0].hucreler.get("A")?.tutarEur).toBeNull();
    expect(tablo.satirlar[0].enUcuzTutarEur).toBeNull();
  });
});

describe("insan okunur yazımlar", () => {
  it("teslim süresi: 0 Hazır, null tire", () => {
    expect(teslimYazisi(0)).toBe("Hazır");
    expect(teslimYazisi(20)).toBe("20 Gün");
    expect(teslimYazisi(null)).toBe("—");
  });

  it("vade: 0 peşin", () => {
    expect(vadeYazisi(0)).toBe("Peşin");
    expect(vadeYazisi(90)).toBe("90 Gün");
  });
});
