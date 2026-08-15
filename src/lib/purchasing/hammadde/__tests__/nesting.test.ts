// SAC PLAKA YERLEŞİMİ — saf çekirdek testleri.
//
// Bu modülde sınanacak şey "algoritma iyi mi" değil, **SÖZLEŞMESİNİ TUTUYOR
// MU**dur: pay gerçekten sağlandı mı, parçalar çakışıyor mu, plakadan taşan
// var mı, kaybolan parça var mı, aynı girdi aynı planı veriyor mu. Doluluk
// oranı bir kalite ölçüsüdür ve ayrı bir testte GERİLEME EŞİĞİ olarak durur.

import { describe, expect, it } from "vitest";
import {
  enIyiPlakaSecimi,
  EN_COK_PARCA,
  sacYerlesimi,
  yerlesimiDenetle,
  type YerlesimParcasi,
} from "../nesting";
import { PLAKA_BOYLARI, PLAKA_ENLERI, VARSAYILAN_KESIM_PAYI } from "../siniflar";

const PLAKA = { enMm: 1500, boyMm: 6000 };
const AYAR = { payMm: VARSAYILAN_KESIM_PAYI, dondur: true };

/** 0053 LITEC paketinin BOJİ grubu — gerçek parçalar, gerçek adetler. */
const BOJI: YerlesimParcasi[] = [
  { id: "a", ad: "SAC 15x375x1500", enMm: 375, boyMm: 1500, adet: 8 },
  { id: "b", ad: "SAC 15x300x1500", enMm: 300, boyMm: 1500, adet: 4 },
  { id: "c", ad: "SAC 15x300x850", enMm: 300, boyMm: 850, adet: 4 },
  { id: "d", ad: "SAC 15x150x225", enMm: 150, boyMm: 225, adet: 8 },
  { id: "e", ad: "SAC 15x23x150", enMm: 23, boyMm: 150, adet: 16 },
  { id: "f", ad: "SAC 15x225x365", enMm: 225, boyMm: 365, adet: 8 },
  { id: "g", ad: "SAC 15x180x300", enMm: 180, boyMm: 300, adet: 16 },
  { id: "h", ad: "SAC 15x120x170", enMm: 120, boyMm: 170, adet: 8 },
];

describe("sözleşme", () => {
  it("hiçbir parça kaybolmaz: yerleşen + sığmayan = toplam", () => {
    const s = sacYerlesimi(BOJI, PLAKA, AYAR);
    const sigmayan = s.sigmayanlar.reduce((t, x) => t + x.adet, 0);
    expect(s.yerlesenParca + sigmayan).toBe(s.toplamParca);
    expect(s.toplamParca).toBe(BOJI.reduce((t, p) => t + p.adet, 0));
  });

  it("PAY HEM PARÇALAR ARASINDA HEM KENARDA sağlanır", () => {
    for (const pay of [3, 5, 8]) {
      const s = sacYerlesimi(BOJI, PLAKA, { ...AYAR, payMm: pay });
      expect(yerlesimiDenetle(s), `pay ${pay}`).toBeNull();
    }
  });

  it("kenar payı GERÇEKTEN uygulanır — hiçbir parça x=0'a oturmaz", () => {
    const s = sacYerlesimi(BOJI, PLAKA, { ...AYAR, payMm: 5 });
    for (const plaka of s.plakalar) {
      for (const p of plaka.parcalar) {
        expect(p.x).toBeGreaterThanOrEqual(5);
        expect(p.y).toBeGreaterThanOrEqual(5);
        expect(p.x + p.enMm).toBeLessThanOrEqual(plaka.enMm - 5);
        expect(p.y + p.boyMm).toBeLessThanOrEqual(plaka.boyMm - 5);
      }
    }
  });

  it("aynı girdi aynı planı verir (deterministik)", () => {
    const a = sacYerlesimi(BOJI, PLAKA, AYAR);
    const b = sacYerlesimi(BOJI, PLAKA, AYAR);
    expect(JSON.stringify(a.plakalar)).toBe(JSON.stringify(b.plakalar));
  });

  it("PARÇA SIRASI SONUCU DEĞİŞTİRMEZ — sıralama içeride yapılır", () => {
    const ters = [...BOJI].reverse();
    const a = sacYerlesimi(BOJI, PLAKA, AYAR);
    const b = sacYerlesimi(ters, PLAKA, AYAR);
    expect(b.plakalar.length).toBe(a.plakalar.length);
    expect(b.kullanilanAlanMm2).toBe(a.kullanilanAlanMm2);
  });

  it("kullanılan alan parçaların gerçek alanıdır", () => {
    const s = sacYerlesimi(BOJI, PLAKA, AYAR);
    const beklenen = BOJI.reduce((t, p) => t + p.enMm * p.boyMm * p.adet, 0);
    expect(s.kullanilanAlanMm2).toBe(beklenen);
  });
});

describe("çok plakalı dizilim", () => {
  it("bir plakaya sığmayan seçim BİRDEN ÇOK plakaya dizilir", () => {
    // 700×2900'lük parçanın paylı kutusu 705×2905; kullanılabilir alan
    // 1495×5995. Ene iki (1410 ≤ 1495), boya iki (5810 ≤ 5995) ⇒ plaka başına
    // DÖRT parça. On parça üç plaka eder ve sonuncusu yarı doludur.
    const parcalar: YerlesimParcasi[] = [
      { id: "x", ad: "SAC 20x700x2900", enMm: 700, boyMm: 2900, adet: 10 },
    ];
    const s = sacYerlesimi(parcalar, PLAKA, AYAR);
    expect(s.plakalar.length).toBe(3);
    expect(s.plakalar[0].parcalar).toHaveLength(4);
    expect(s.sigmayanlar).toHaveLength(0);
    expect(yerlesimiDenetle(s)).toBeNull();
  });

  it("plaka sıraları 1'den başlar ve boşluksuz artar", () => {
    const s = sacYerlesimi(BOJI, PLAKA, AYAR);
    expect(s.plakalar.map((p) => p.sira)).toEqual(s.plakalar.map((_, i) => i + 1));
  });
});

describe("sığmayan parça", () => {
  it("PLAKADAN BÜYÜK parça SESSİZCE DÜŞÜRÜLMEZ, nedeniyle raporlanır", () => {
    const s = sacYerlesimi(
      [{ id: "dev", ad: "SAC 10x1300x11990", enMm: 1300, boyMm: 11990, adet: 2 }],
      PLAKA,
      AYAR
    );
    expect(s.plakalar).toHaveLength(0);
    expect(s.sigmayanlar).toHaveLength(1);
    expect(s.sigmayanlar[0].adet).toBe(2);
    expect(s.sigmayanlar[0].neden).toContain("sığmıyor");
  });

  it("PAY SIĞMAYI BELİRLER: plaka enini tam dolduran parça payla girmez", () => {
    // Döndürme KAPALI tutulur ki sınanan şey yalnız pay olsun; açık olsaydı
    // parça 90° dönüp uzun kenara sığar ve kural görünmezdi.
    const tam: YerlesimParcasi[] = [
      { id: "t", ad: "SAC 10x1500x1000", enMm: 1500, boyMm: 1000, adet: 1 },
    ];
    expect(sacYerlesimi(tam, PLAKA, { payMm: 5, dondur: false }).sigmayanlar).toHaveLength(1);
    // Payı sıfırlamak sığdırır — kural gerçekten paydan geliyor.
    expect(sacYerlesimi(tam, PLAKA, { payMm: 0, dondur: false }).sigmayanlar).toHaveLength(0);
  });

  it("döndürme KAPALIYKEN sığmayan parça, AÇIKKEN sığabilir", () => {
    const dar: YerlesimParcasi[] = [
      { id: "u", ad: "SAC 10x5000x1000", enMm: 5000, boyMm: 1000, adet: 1 },
    ];
    expect(sacYerlesimi(dar, PLAKA, { payMm: 5, dondur: false }).sigmayanlar).toHaveLength(1);
    const acik = sacYerlesimi(dar, PLAKA, { payMm: 5, dondur: true });
    expect(acik.sigmayanlar).toHaveLength(0);
    expect(acik.plakalar[0].parcalar[0].dondu).toBe(true);
  });
});

describe("otomatik plaka seçimi", () => {
  const ADAYLAR = PLAKA_ENLERI.flatMap((enMm) => PLAKA_BOYLARI.map((boyMm) => ({ enMm, boyMm })));

  it("en az plakayla biten, eşitlikte en küçük alanlı plakayı seçer", () => {
    const s = enIyiPlakaSecimi(BOJI, ADAYLAR, AYAR);
    expect(s).not.toBeNull();
    expect(s!.sigmayanlar).toHaveLength(0);
    for (const aday of ADAYLAR) {
      const alt = sacYerlesimi(BOJI, aday, AYAR);
      if (alt.sigmayanlar.length > 0) continue;
      if (alt.plakalar.length < s!.plakalar.length) throw new Error("daha az plakalı aday atlandı");
      if (alt.plakalar.length === s!.plakalar.length) {
        expect(s!.plakaAlaniMm2).toBeLessThanOrEqual(alt.plakaAlaniMm2);
      }
    }
  });

  it("hiçbir plakaya sığmayan seçimde EN AZ sığmayan bırakanı döndürür", () => {
    const dev: YerlesimParcasi[] = [
      { id: "d", ad: "SAC 10x2800x11500", enMm: 2800, boyMm: 11500, adet: 1 },
    ];
    const s = enIyiPlakaSecimi(dev, ADAYLAR, AYAR);
    expect(s!.sigmayanlar).toHaveLength(0);
    expect(s!.plaka.enMm).toBe(3000);
    expect(s!.plaka.boyMm).toBe(12000);
  });
});

describe("ağırlık ve fire", () => {
  it("plaka ve parça ağırlığı kalınlıktan hesaplanır", () => {
    const s = sacYerlesimi(BOJI, PLAKA, { ...AYAR, kalinlikMm: 15 });
    expect(s.plakaAgirlikKg).toBeCloseTo(s.plakaAlaniMm2 * 15 * 7.85e-6, 1);
    expect(s.parcaAgirlikKg).toBeCloseTo(s.kullanilanAlanMm2 * 15 * 7.85e-6, 1);
  });

  it("kalınlık verilmezse ağırlık UYDURULMAZ", () => {
    const s = sacYerlesimi(BOJI, PLAKA, AYAR);
    expect(s.plakaAgirlikKg).toBeNull();
    expect(s.parcaAgirlikKg).toBeNull();
  });

  it("doluluk + fire = %100", () => {
    const s = sacYerlesimi(BOJI, PLAKA, AYAR);
    expect(s.dolulukYuzde + s.fireYuzde).toBeCloseTo(100, 1);
  });

  it("GERİLEME EŞİĞİ: gerçek bir grupta doluluk %80'in altına düşmemeli", () => {
    // BOJİ grubu 1500×6000'de %90 civarında yerleşiyor. Eşik bir kalite
    // vaadi değil bir ALARMdır: algoritma değişince fark burada görünür.
    const s = sacYerlesimi(BOJI, PLAKA, AYAR);
    expect(s.plakalar[0].dolulukYuzde).toBeGreaterThan(80);
  });
});

describe("sınırlar", () => {
  it("boş seçim boş sonuç verir, patlamaz", () => {
    const s = sacYerlesimi([], PLAKA, AYAR);
    expect(s.plakalar).toHaveLength(0);
    expect(s.toplamParca).toBe(0);
    expect(s.dolulukYuzde).toBe(0);
  });

  it("adet sınırı aşılırsa hesap YAPILMAZ ve sebebi söylenir", () => {
    const cok: YerlesimParcasi[] = [
      { id: "z", ad: "SAC 10x50x50", enMm: 50, boyMm: 50, adet: EN_COK_PARCA + 1 },
    ];
    expect(() => sacYerlesimi(cok, PLAKA, AYAR)).toThrow(/parçaya kadar/);
  });

  it("adedi sıfır olan satır yok sayılır", () => {
    const s = sacYerlesimi([{ id: "s", ad: "SAC", enMm: 100, boyMm: 100, adet: 0 }], PLAKA, AYAR);
    expect(s.toplamParca).toBe(0);
  });
});
