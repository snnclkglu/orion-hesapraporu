// TEKLİF ANALİZİ ÇEKİRDEĞİNİN KORUMA TESTLERİ.
//
// Sınanan şey biçim değil KURALDIR. Dördü de sessizce bozulabilecek ve ancak
// yanlış bir projeksiyona bakıp yanlış bir karar verildiğinde anlaşılabilecek
// hatalardır:
//
//   · eksik veri SIFIR SAYILMAZ — puanı ya da tutarı olmayan satır toplamı
//     aşağı çekmez, toplamın DIŞINDA kalır ve ayrıca sayılır;
//   · puansız satır RENKSİZDİR — uydurulmuş bir orta değer, verilmemiş bir
//     kararı verilmiş gibi gösterirdi;
//   · tarihi bilinmeyen satır bir DÖNEME yerleştirilmez;
//   · aylık seri YOĞUNDUR — atlanan bir ay grafikte duraklamayı gizler;
//   · teklife dönüşmüş beklenen iş İKİ KEZ SAYILMAZ.

import { describe, expect, it } from "vitest";
import {
  agirlikliTutar,
  aylikSeri,
  donemSonu,
  musteriKirilimi,
  pencereBitisi,
  pencereyeGirer,
  projeksiyon,
  puanDagilimi,
  scoreHue,
  scoreLabel,
  tekilSatirlar,
  yilSonu,
  type AnalizSatiri,
} from "../analiz";

const BUGUN = "2026-08-17";

/** Satır fabrikası — testler yalnız ilgilendikleri alanı yazar. */
function satir(ozel: Partial<AnalizSatiri> = {}): AnalizSatiri {
  return {
    id: ozel.id ?? "s1",
    kaynak: "teklif",
    offerNo: "TKF-2026-0001",
    customerName: "ETİ BAKIR",
    subject: "Çift kirişli köprü vinç",
    status: "sent",
    expectedOn: "2026-09-15",
    amount: 100_000,
    currency: "EUR",
    score: 5,
    active: true,
    ...ozel,
  };
}

// ————————————————————————————————————————————————————— ağırlıklı tutar

describe("agirlikliTutar", () => {
  it("tutarı puanın onda biriyle çarpar", () => {
    expect(agirlikliTutar({ amount: 100_000, score: 7 })).toBe(70_000);
    expect(agirlikliTutar({ amount: 250_000, score: 10 })).toBe(250_000);
    expect(agirlikliTutar({ amount: 250_000, score: 1 })).toBe(25_000);
  });

  it("puanı ya da tutarı eksik satırda BOŞ döner — sıfır değil", () => {
    expect(agirlikliTutar({ amount: 100_000, score: null })).toBeNull();
    expect(agirlikliTutar({ amount: null, score: 8 })).toBeNull();
    expect(agirlikliTutar({ amount: null, score: null })).toBeNull();
  });

  it("aralık dışı puanı 1–10'a kelepçeler", () => {
    expect(agirlikliTutar({ amount: 100_000, score: 44 })).toBe(100_000);
    expect(agirlikliTutar({ amount: 100_000, score: 0 })).toBe(10_000);
  });
});

describe("projeksiyon", () => {
  it("puansız satır ağırlıklı toplama GİRMEZ ama ham toplamda kalır", () => {
    const ozet = projeksiyon([
      satir({ id: "a", amount: 100_000, score: 8 }),
      satir({ id: "b", amount: 200_000, score: null }),
    ]);
    // Ham toplam iki satırı da sayar (tutarı bilinen iki iş vardır),
    // ağırlıklı toplam yalnız puanlanmışı: 100.000 × 0,8.
    expect(ozet.hamToplam).toBe(300_000);
    expect(ozet.agirlikliToplam).toBe(80_000);
    expect(ozet.adet).toBe(1);
    expect(ozet.eksik).toBe(1);
  });

  it("tutarsız satırı hiçbir toplama katmaz", () => {
    const ozet = projeksiyon([
      satir({ id: "a", amount: 100_000, score: 5 }),
      satir({ id: "b", amount: null, score: 9 }),
    ]);
    expect(ozet.hamToplam).toBe(100_000);
    expect(ozet.agirlikliToplam).toBe(50_000);
    expect(ozet.eksik).toBe(1);
  });

  it("boş listede sıfırlanır", () => {
    expect(projeksiyon([])).toEqual({ adet: 0, hamToplam: 0, agirlikliToplam: 0, eksik: 0 });
  });
});

// ————————————————————————————————————————————————————————————— renk

describe("scoreHue", () => {
  it("1 soğuk (mavi), 10 sıcak (kırmızı)", () => {
    expect(scoreHue(1)).toBe(240);
    expect(scoreHue(10)).toBe(25);
  });

  it("ölçek boyunca tek yönde iner — ara puanlar uçların arasındadır", () => {
    const tonlar = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((s) => scoreHue(s) as number);
    for (let i = 1; i < tonlar.length; i += 1) {
      expect(tonlar[i]).toBeLessThan(tonlar[i - 1]);
    }
  });

  it("PUANSIZ SATIR RENKSİZDİR", () => {
    expect(scoreHue(null)).toBeNull();
    expect(scoreHue(undefined)).toBeNull();
    expect(scoreHue(Number.NaN)).toBeNull();
  });
});

describe("scoreLabel", () => {
  it("puanı kullanıcının konuştuğu dile çevirir", () => {
    expect(scoreLabel(10)).toBe("Çok yakın");
    expect(scoreLabel(7)).toBe("Yakın");
    expect(scoreLabel(5)).toBe("Orta");
    expect(scoreLabel(3)).toBe("Uzak");
    expect(scoreLabel(1)).toBe("Çok uzak");
  });

  it("puansızda tire", () => {
    expect(scoreLabel(null)).toBe("—");
  });
});

// ———————————————————————————————————————————————————————————— pencere

describe("pencereBitisi", () => {
  it("bu yıl aralık sonunda, 6/12 ay bugünden sayılarak biter", () => {
    expect(pencereBitisi("yil", BUGUN)).toBe(yilSonu(BUGUN));
    expect(pencereBitisi("6ay", BUGUN)).toBe(donemSonu(BUGUN, 6));
    expect(pencereBitisi("12ay", BUGUN)).toBe(donemSonu(BUGUN, 12));
  });

  it("tümü SINIRSIZDIR", () => {
    expect(pencereBitisi("tumu", BUGUN)).toBeNull();
  });

  it("ay eklerken yıl döner", () => {
    expect(donemSonu("2026-08-17", 6)).toBe("2027-02-17");
    expect(donemSonu("2026-08-17", 12)).toBe("2027-08-17");
  });
});

describe("pencereyeGirer", () => {
  it("BEKLENEN TARİHİ OLMAYAN SATIR yalnız 'tümü'ne girer", () => {
    const tarihsiz = satir({ expectedOn: null });
    expect(pencereyeGirer(tarihsiz, "tumu", BUGUN)).toBe(true);
    expect(pencereyeGirer(tarihsiz, "yil", BUGUN)).toBe(false);
    expect(pencereyeGirer(tarihsiz, "6ay", BUGUN)).toBe(false);
    expect(pencereyeGirer(tarihsiz, "12ay", BUGUN)).toBe(false);
  });

  it("pencere sonundan sonraki tarih dışarıda kalır", () => {
    expect(pencereyeGirer(satir({ expectedOn: "2026-12-31" }), "yil", BUGUN)).toBe(true);
    expect(pencereyeGirer(satir({ expectedOn: "2027-01-01" }), "yil", BUGUN)).toBe(false);
    expect(pencereyeGirer(satir({ expectedOn: "2027-02-17" }), "6ay", BUGUN)).toBe(true);
    expect(pencereyeGirer(satir({ expectedOn: "2027-02-18" }), "6ay", BUGUN)).toBe(false);
  });
});

// ———————————————————————————————————————————————————————————— seriler

describe("aylikSeri", () => {
  it("YOĞUNDUR — aradaki boş ay atlanmaz", () => {
    const seri = aylikSeri(
      [
        satir({ id: "a", expectedOn: "2026-09-10", amount: 100_000, score: 10 }),
        satir({ id: "b", expectedOn: "2026-12-05", amount: 50_000, score: 4 }),
      ],
      BUGUN,
      "2026-12-31"
    );
    expect(seri.map((n) => n.ay)).toEqual([
      "2026-08",
      "2026-09",
      "2026-10",
      "2026-11",
      "2026-12",
    ]);
    // Kayıtsız aylar sıfırla durur; grafikte duraklama görünmelidir.
    expect(seri.filter((n) => n.adet === 0).map((n) => n.ay)).toEqual([
      "2026-08",
      "2026-10",
      "2026-11",
    ]);
  });

  it("yıl sınırını doğru geçer", () => {
    const seri = aylikSeri([], "2026-11-01", "2027-02-28");
    expect(seri.map((n) => n.ay)).toEqual(["2026-11", "2026-12", "2027-01", "2027-02"]);
  });

  it("ham ve ağırlıklı tutarı ayrı toplar; puansız satır ağırlıklıya girmez", () => {
    const seri = aylikSeri(
      [
        satir({ id: "a", expectedOn: "2026-09-10", amount: 100_000, score: 8 }),
        satir({ id: "b", expectedOn: "2026-09-20", amount: 60_000, score: null }),
      ],
      "2026-09-01",
      "2026-09-30"
    );
    expect(seri).toHaveLength(1);
    expect(seri[0].ham).toBe(160_000);
    expect(seri[0].agirlikli).toBe(80_000);
    expect(seri[0].adet).toBe(2);
  });

  it("pencere dışındaki satırı hiçbir kovaya yazmaz", () => {
    const seri = aylikSeri(
      [satir({ expectedOn: "2028-01-01", amount: 100_000, score: 9 })],
      "2026-09-01",
      "2026-10-31"
    );
    expect(seri.map((n) => n.ham)).toEqual([0, 0]);
  });
});

describe("musteriKirilimi", () => {
  it("aynı müşterinin satırlarını toplar ve ağırlıklıya göre sıralar", () => {
    const kirilim = musteriKirilimi([
      satir({ id: "a", customerName: "ETİ BAKIR", amount: 100_000, score: 5 }),
      satir({ id: "b", customerName: "ETİ BAKIR", amount: 100_000, score: 5 }),
      satir({ id: "c", customerName: "ASTOR", amount: 300_000, score: 9 }),
    ]);
    expect(kirilim.map((k) => k.musteri)).toEqual(["ASTOR", "ETİ BAKIR"]);
    expect(kirilim[1].agirlikli).toBe(100_000);
    expect(kirilim[1].adet).toBe(2);
  });
});

describe("puanDagilimi", () => {
  it("puansız satırı saymaz, sıcaktan soğuğa dizer", () => {
    const dagilim = puanDagilimi([
      satir({ id: "a", score: 3, amount: 10_000 }),
      satir({ id: "b", score: 9, amount: 20_000 }),
      satir({ id: "c", score: 9, amount: 5_000 }),
      satir({ id: "d", score: null, amount: 99_000 }),
    ]);
    expect(dagilim.map((d) => d.score)).toEqual([9, 3]);
    expect(dagilim[0]).toEqual({ score: 9, adet: 2, tutar: 25_000 });
  });
});

// ——————————————————————————————————————————————————————— çift sayım

describe("tekilSatirlar", () => {
  it("TEKLİFE DÖNÜŞMÜŞ beklenen işi düşürür", () => {
    const satirlar = [
      satir({ id: "teklif", kaynak: "teklif", offerNo: "TKF-2026-0007" }),
      satir({ id: "lead", kaynak: "beklenen", offerNo: null, offerId: "teklif" }),
    ];
    expect(tekilSatirlar(satirlar).map((s) => s.id)).toEqual(["teklif"]);
  });

  it("henüz teklife dönüşmemiş beklenen işi KORUR", () => {
    const satirlar = [
      satir({ id: "teklif", kaynak: "teklif" }),
      satir({ id: "lead", kaynak: "beklenen", offerNo: null, offerId: null }),
    ];
    expect(tekilSatirlar(satirlar)).toHaveLength(2);
  });

  it("teklif satırını hiçbir koşulda düşürmez", () => {
    const satirlar = [satir({ id: "teklif", kaynak: "teklif", offerId: "teklif" })];
    expect(tekilSatirlar(satirlar)).toHaveLength(1);
  });

  it("düşen satır projeksiyonu iki kez saydırmaz", () => {
    const satirlar = [
      satir({ id: "teklif", kaynak: "teklif", amount: 100_000, score: 6 }),
      satir({ id: "lead", kaynak: "beklenen", offerId: "teklif", amount: 100_000, score: 6 }),
    ];
    expect(projeksiyon(tekilSatirlar(satirlar)).agirlikliToplam).toBe(60_000);
  });
});
