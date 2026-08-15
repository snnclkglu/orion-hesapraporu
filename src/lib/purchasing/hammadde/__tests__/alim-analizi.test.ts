// ALIM ANALİZİ — çekirdek koruması.
//
// FİKSTÜR KULLANICININ KENDİ SAYILARIDIR. Devralınan dosyanın "Özet" sayfası
// yıl × kategori matrisini hazır yazıyor; test o satırların BİREBİR yeniden
// üretilebildiğini doğrular. Ortalamanın ağırlıklı olması bu modülün en kolay
// kaçırılacak kuralıdır ve bir kez kayarsa "gidişat" grafiği sessizce yanlış
// bir hikâye anlatır.

import { describe, expect, it } from "vitest";
import {
  alimKategorisi,
  alimToplami,
  aylikOrtalamaKg,
  aylikSeri,
  kalemOzetleri,
  tedarikciOzetleri,
  yilKategoriMatrisi,
  type AlimSatiri,
} from "../alim-analizi";

function satir(x: Partial<AlimSatiri> & { kg: number; tutarEur: number; gun: string }): AlimSatiri {
  return {
    id: x.id ?? `${x.gun}-${x.kg}`,
    kaynak: x.kaynak ?? "devralinan",
    gun: x.gun,
    tedarikci: x.tedarikci ?? "CECELİ DEMİR",
    kategori: x.kategori ?? "SAC",
    tanim: x.tanim ?? "SAC",
    key: x.key ?? "SAC",
    kalite: x.kalite ?? "S235JR",
    kg: x.kg,
    tutarTry: x.tutarTry ?? null,
    tutarUsd: x.tutarUsd ?? null,
    tutarEur: x.tutarEur,
  };
}

describe("alimToplami", () => {
  it("ORTALAMA AĞIRLIKLIDIR — kullanıcının dosyasındaki 2024 profil satırı", () => {
    // Özet sayfası: 38.777,01 kg · 27.836,646694930238 € · ortalama 0,7178647011445761
    const s = [
      satir({ gun: "2024-05-01", kg: 38000, tutarEur: 27000 }),
      satir({ gun: "2024-08-01", kg: 777.01, tutarEur: 836.646694930238 }),
    ];
    const t = alimToplami(s, "EUR");
    expect(t.kg).toBeCloseTo(38777.01, 2);
    expect(t.tutar).toBeCloseTo(27836.65, 2);
    expect(t.ortalama).toBeCloseTo(27836.646694930238 / 38777.01, 12);
  });

  it("aritmetik ortalamadan FARKLIDIR (kural burada kayarsa test düşer)", () => {
    const s = [
      satir({ gun: "2025-01-01", kg: 12000, tutarEur: 6000 }), // 0,50 €/kg
      satir({ gun: "2025-02-01", kg: 40, tutarEur: 60 }), // 1,50 €/kg
    ];
    const t = alimToplami(s, "EUR");
    expect(t.ortalama).toBeCloseTo(6060 / 12040, 10); // ≈ 0,5033
    expect(t.ortalama).not.toBeCloseTo(1.0, 2); // aritmetik ortalama 1,00 olurdu
  });

  it("TUTARI OLMAYAN SATIR kiloya da girmez", () => {
    const s = [
      satir({ gun: "2025-01-01", kg: 100, tutarEur: 80 }),
      { ...satir({ gun: "2025-02-01", kg: 900, tutarEur: 0 }), tutarEur: null },
    ];
    const t = alimToplami(s, "EUR");
    expect(t.kg).toBe(100);
    expect(t.ortalama).toBeCloseTo(0.8, 10);
    expect(t.satir).toBe(1);
  });
});

describe("yilKategoriMatrisi", () => {
  it("yıl ve kategori başına ayrı satır üretir, sırası sabittir", () => {
    const s = [
      satir({ gun: "2024-05-01", kg: 100, tutarEur: 90, kategori: "SAC" }),
      satir({ gun: "2024-06-01", kg: 50, tutarEur: 30, kategori: "PROFIL" }),
      satir({ gun: "2025-01-01", kg: 200, tutarEur: 150, kategori: "SAC" }),
    ];
    const m = yilKategoriMatrisi(s, "EUR");
    expect(m.map((r) => `${r.yil}/${r.kategori}`)).toEqual([
      "2024/SAC",
      "2024/PROFIL",
      "2025/SAC",
    ]);
    expect(m[0].toplam.ortalama).toBeCloseTo(0.9, 10);
  });
});

describe("aylikSeri", () => {
  it("ALIM OLMAYAN AY DİZİDE DURUR ama ortalaması NULL'dur", () => {
    const s = [
      satir({ gun: "2025-01-10", kg: 100, tutarEur: 80 }),
      satir({ gun: "2025-03-05", kg: 200, tutarEur: 140 }),
    ];
    const seri = aylikSeri(s, "EUR");
    expect(seri.map((n) => n.ay)).toEqual(["2025-01", "2025-02", "2025-03"]);
    expect(seri[1].ortalama).toBeNull();
    expect(seri[1].kg).toBe(0);
    expect(seri[2].ortalama).toBeCloseTo(0.7, 10);
  });

  it("yıl sınırını doğru geçer", () => {
    const s = [
      satir({ gun: "2024-11-01", kg: 10, tutarEur: 10 }),
      satir({ gun: "2025-02-01", kg: 10, tutarEur: 10 }),
    ];
    expect(aylikSeri(s, "EUR").map((n) => n.ay)).toEqual([
      "2024-11",
      "2024-12",
      "2025-01",
      "2025-02",
    ]);
  });
});

describe("kalemOzetleri", () => {
  it("ilk ve son alımın birim fiyatından değişimi çıkarır", () => {
    const s = [
      satir({ gun: "2024-04-01", kg: 100, tutarEur: 80, key: "A", tanim: "SAC 10" }),
      satir({ gun: "2026-04-01", kg: 100, tutarEur: 100, key: "A", tanim: "SAC 10" }),
    ];
    const [o] = kalemOzetleri(s, "EUR");
    expect(o.ilkBirim).toBeCloseTo(0.8, 10);
    expect(o.sonBirim).toBeCloseTo(1.0, 10);
    expect(o.degisimOran).toBeCloseTo(0.25, 10);
    expect(o.enUcuzBirim).toBeCloseTo(0.8, 10);
    expect(o.enPahaliBirim).toBeCloseTo(1.0, 10);
  });

  it("TEK ALIMDA DEĞİŞİM YOKTUR — %0 yazılmaz", () => {
    const s = [satir({ gun: "2025-04-01", kg: 100, tutarEur: 80, key: "B" })];
    const [o] = kalemOzetleri(s, "EUR");
    expect(o.degisimOran).toBeNull();
  });

  it("tutara göre büyükten küçüğe sıralar", () => {
    const s = [
      satir({ gun: "2025-01-01", kg: 10, tutarEur: 10, key: "KUCUK", tanim: "K" }),
      satir({ gun: "2025-01-01", kg: 1000, tutarEur: 900, key: "BUYUK", tanim: "B" }),
    ];
    expect(kalemOzetleri(s, "EUR").map((o) => o.key)).toEqual(["BUYUK", "KUCUK"]);
  });
});

describe("tedarikciOzetleri", () => {
  it("firma başına kilo, tutar ve kalem sayısı", () => {
    const s = [
      satir({ gun: "2025-01-01", kg: 100, tutarEur: 80, tedarikci: "A", key: "X" }),
      satir({ gun: "2025-02-01", kg: 300, tutarEur: 210, tedarikci: "A", key: "Y" }),
      satir({ gun: "2025-03-01", kg: 50, tutarEur: 45, tedarikci: "B", key: "X" }),
    ];
    const o = tedarikciOzetleri(s, "EUR");
    expect(o[0].tedarikci).toBe("A");
    expect(o[0].toplam.kg).toBe(400);
    expect(o[0].kalemSayisi).toBe(2);
    expect(o[0].ilkGun).toBe("2025-01-01");
    expect(o[0].sonGun).toBe("2025-02-01");
  });
});

describe("aylikOrtalamaKg", () => {
  it("payda GERÇEKTEN GEÇEN AYDIR, takvim yılı değil", () => {
    const s = [
      satir({ gun: "2024-04-15", kg: 30000, tutarEur: 20000 }),
      satir({ gun: "2024-10-15", kg: 30000, tutarEur: 20000 }),
    ];
    const o = aylikOrtalamaKg(s)!;
    expect(o.gun).toBe(183);
    expect(o.kgAylik).toBeCloseTo(60000 / (183 / 30), 6);
  });
});

describe("alimKategorisi", () => {
  it("stok adından aileyi çıkarır", () => {
    expect(alimKategorisi("SAC 10 MM S355JR")).toBe("SAC");
    expect(alimKategorisi("SAC 10 X 1500 X 6000 ST37")).toBe("SAC");
    expect(alimKategorisi("BAKLAVA DESENLİ SAC")).toBe("SAC");
    expect(alimKategorisi("UPN 100 S235JR")).toBe("PROFIL");
    expect(alimKategorisi("PROFİL NPU 120")).toBe("PROFIL");
    expect(alimKategorisi("KÖŞEBENT NPL 50X50X5")).toBe("PROFIL");
    expect(alimKategorisi("LAMA 10X20")).toBe("PROFIL");
    expect(alimKategorisi("RAY A65 S235JR")).toBe("RAY");
    expect(alimKategorisi("BORU Ø140/Ø90 S235JR")).toBe("BORU");
    expect(alimKategorisi("DOLU Ø90 CK45")).toBe("DOLU");
  });

  it("tanımadığını DİĞER'e atar, uydurmaz", () => {
    expect(alimKategorisi("RULMAN 6205-Z")).toBe("DIGER");
    expect(alimKategorisi("")).toBe("DIGER");
  });

  it("RAY, PROFİL'den ÖNCE sorulur (öncelik sırası)", () => {
    // "RAY KARE 60x40" hem RAY hem KARE anahtarını taşır; ray kazanmalı.
    expect(alimKategorisi("RAY KARE 60X40")).toBe("RAY");
  });
});
