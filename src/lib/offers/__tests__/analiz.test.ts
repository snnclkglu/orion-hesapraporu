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

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { siraTarihi, siralaAnaliz } from "@/app/(app)/offers/analiz/analiz-view";
import { tarihKesin, type AnalizSatiriDetay } from "@/app/(app)/offers/analiz/lead-dialog";
import {
  DEFAULT_OFFER_WIN_SCORE,
  DEFAULT_PROJEKSIYON_PENCERE,
  agirlikliTutar,
  aylikKazanimSerisi,
  aylikSeri,
  kararSuresiGun,
  kazanimDonemAraligi,
  kazanimOzeti,
  kazanilanDonemeGirer,
  kazanilanMusteriKirilimi,
  defaultOfferExpectedOn,
  donemSonu,
  musteriKirilimi,
  pencereAraligi,
  pencereBitisi,
  pencereyeGirer,
  projeksiyon,
  puanDagilimi,
  scoreHue,
  scoreLabel,
  siralaKazanilanIsler,
  tekilSatirlar,
  yilSonu,
  type AnalizSatiri,
  type KazanilanIsSatiri,
} from "../analiz";
import { isOfferIncludedInAnalysis, offerStatusLabel } from "../status";

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

  it("geçen yılı tam takvim yılı olarak kurar", () => {
    expect(pencereAraligi("gecenYil", BUGUN)).toEqual({
      bas: "2025-01-01",
      bitis: "2025-12-31",
    });
    expect(pencereBitisi("gecenYil", BUGUN)).toBe("2025-12-31");
  });

  it("tümü SINIRSIZDIR", () => {
    expect(pencereBitisi("tumu", BUGUN)).toBeNull();
  });

  it("ay eklerken yıl döner", () => {
    expect(donemSonu("2026-08-17", 6)).toBe("2027-02-17");
    expect(donemSonu("2026-08-17", 12)).toBe("2027-08-17");
  });
});

describe("yeni teklif analiz varsayılanları", () => {
  it("puanı 5, ekran penceresini 12 ay başlatır", () => {
    expect(DEFAULT_OFFER_WIN_SCORE).toBe(5);
    expect(DEFAULT_PROJEKSIYON_PENCERE).toBe("12ay");
  });

  it("beklenen tarihi teklif tarihinden bir takvim ayı sonra verir", () => {
    expect(defaultOfferExpectedOn("2026-09-03")).toBe("2026-10-03");
    expect(defaultOfferExpectedOn("2026-12-31")).toBe("2027-01-31");
  });

  it("ay sonunu izleyen ayın son gününe kelepçeler", () => {
    expect(defaultOfferExpectedOn("2026-01-31")).toBe("2026-02-28");
    expect(defaultOfferExpectedOn("2028-01-31")).toBe("2028-02-29");
  });

  it("veritabanı yazma yolu aynı 5 puan / bir ay kuralını taşır", () => {
    const migration = readFileSync(
      join(process.cwd(), "supabase/migrations/20260903000001_offer_budgetary_defaults.sql"),
      "utf8"
    );
    expect(migration).toContain("new.win_score := 5");
    expect(migration).toContain("new.issue_date + interval '1 month'");
    expect(migration).toContain("coalesce(win_score, 5)");
  });
});

describe("bütçesel durum", () => {
  it("etiketi görünür ama teklif Analiz'e girmez", () => {
    expect(offerStatusLabel("budgetary")).toBe("Bütçesel");
    expect(isOfferIncludedInAnalysis("budgetary")).toBe(false);
    expect(isOfferIncludedInAnalysis("draft")).toBe(true);
    expect(isOfferIncludedInAnalysis("sent")).toBe(true);
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

  it("geçen yılı önceki yılın sınırlarıyla ayırır", () => {
    expect(pencereyeGirer(satir({ expectedOn: "2025-01-01" }), "gecenYil", BUGUN)).toBe(true);
    expect(pencereyeGirer(satir({ expectedOn: "2025-12-31" }), "gecenYil", BUGUN)).toBe(true);
    expect(pencereyeGirer(satir({ expectedOn: "2024-12-31" }), "gecenYil", BUGUN)).toBe(false);
    expect(pencereyeGirer(satir({ expectedOn: "2026-01-01" }), "gecenYil", BUGUN)).toBe(false);
  });

  it("ileri pencerelere bugünden eski beklenen tarih girmez", () => {
    expect(pencereyeGirer(satir({ expectedOn: "2026-08-16" }), "yil", BUGUN)).toBe(false);
    expect(pencereyeGirer(satir({ expectedOn: BUGUN }), "yil", BUGUN)).toBe(true);
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

// ——————————————————————————————————————————————————— kazanılan işler

function kazanilan(ozel: Partial<KazanilanIsSatiri> = {}): KazanilanIsSatiri {
  return {
    id: ozel.id ?? "k1",
    offerNo: ozel.offerNo ?? "TETR-20260801-1",
    customerName: ozel.customerName ?? "ASTOR ENERJİ A.Ş.",
    subject: ozel.subject ?? "32T PORTAL VİNÇ",
    issuedOn: ozel.issuedOn ?? "2026-06-01",
    wonOn: ozel.wonOn === undefined ? "2026-08-01" : ozel.wonOn,
    amount: ozel.amount === undefined ? 100_000 : ozel.amount,
    currency: ozel.currency ?? "EUR",
    jobId: ozel.jobId === undefined ? null : ozel.jobId,
    ...ozel,
  };
}

describe("kazanılan işler dönemi", () => {
  it("bu yılı on iki ay, son 12 ayı bugünden geriye kurar", () => {
    expect(kazanimDonemAraligi("yil", BUGUN)).toEqual({
      bas: "2026-01-01",
      bitis: "2026-12-31",
    });
    expect(kazanimDonemAraligi("12ay", BUGUN)).toEqual({
      bas: "2025-08-17",
      bitis: BUGUN,
    });
  });

  it("geçen yılı tam takvim yılı olarak kurar", () => {
    expect(kazanimDonemAraligi("gecenYil", BUGUN)).toEqual({
      bas: "2025-01-01",
      bitis: "2025-12-31",
    });
  });

  it("bu yılın aylık grafiği yıl bitmeden de 12 ayı gösterir", () => {
    const aralik = kazanimDonemAraligi("yil", BUGUN);
    expect(aylikKazanimSerisi([], aralik.bas, aralik.bitis)).toHaveLength(12);
  });

  it("tümü görünümünü bilinen ilk kazanımdan bugüne yoğunlaştırır", () => {
    expect(
      kazanimDonemAraligi("tumu", BUGUN, [
        kazanilan({ wonOn: "2024-05-10" }),
        kazanilan({ wonOn: "2026-03-01" }),
        kazanilan({ wonOn: null }),
      ])
    ).toEqual({ bas: "2024-05-10", bitis: BUGUN });
  });

  it("kazanılma tarihi bilinmeyen satırı yalnız Tümü görünümünde korur", () => {
    const tarihsiz = kazanilan({ wonOn: null });
    expect(kazanilanDonemeGirer(tarihsiz, "yil", BUGUN)).toBe(false);
    expect(kazanilanDonemeGirer(tarihsiz, "gecenYil", BUGUN)).toBe(false);
    expect(kazanilanDonemeGirer(tarihsiz, "12ay", BUGUN)).toBe(false);
    expect(kazanilanDonemeGirer(tarihsiz, "tumu", BUGUN)).toBe(true);
  });
});

describe("kazanimOzeti", () => {
  it("para birimlerini birleştirmez, eksikleri ve iş emri bağını ayrıca sayar", () => {
    const ozet = kazanimOzeti([
      kazanilan({ id: "a", amount: 100_000, currency: "EUR", jobId: "j1" }),
      kazanilan({ id: "b", amount: 300_000, currency: "EUR", wonOn: null }),
      kazanilan({ id: "c", amount: 50_000, currency: "USD" }),
      kazanilan({ id: "d", amount: null, currency: "EUR" }),
    ]);
    expect(ozet).toEqual({
      adet: 4,
      eurAdet: 2,
      eurToplam: 400_000,
      eurOrtalama: 200_000,
      digerPara: 1,
      tutariEksik: 1,
      tarihiEksik: 1,
      isEmirli: 1,
    });
  });
});

describe("aylikKazanimSerisi", () => {
  it("boş ayları atlamaz ve yalnız tarih/tutarı bilinen satırı toplar", () => {
    const seri = aylikKazanimSerisi(
      [
        kazanilan({ id: "a", wonOn: "2026-01-10", amount: 100_000 }),
        kazanilan({ id: "b", wonOn: "2026-03-20", amount: 50_000 }),
        kazanilan({ id: "c", wonOn: null, amount: 999_000 }),
        kazanilan({ id: "d", wonOn: "2026-03-21", amount: null }),
      ],
      "2026-01-01",
      "2026-03-31"
    );
    expect(seri).toEqual([
      { ay: "2026-01", tutar: 100_000, adet: 1 },
      { ay: "2026-02", tutar: 0, adet: 0 },
      { ay: "2026-03", tutar: 50_000, adet: 1 },
    ]);
  });
});

describe("kazanılan iş kırılımları", () => {
  it("müşterileri alınan tutara göre sıralar", () => {
    const kirilim = kazanilanMusteriKirilimi([
      kazanilan({ id: "a", customerName: "ETİ BAKIR", amount: 100_000 }),
      kazanilan({ id: "b", customerName: "ETİ BAKIR", amount: 100_000 }),
      kazanilan({ id: "c", customerName: "ASTOR", amount: 300_000 }),
    ]);
    expect(kirilim.map((k) => k.musteri)).toEqual(["ASTOR", "ETİ BAKIR"]);
    expect(kirilim[1]).toMatchObject({ tutar: 200_000, adet: 2 });
  });

  it("gönderimden kazanıma karar süresini ölçer; eksik ve ters tarihte boş döner", () => {
    expect(kararSuresiGun(kazanilan({ issuedOn: "2026-06-01", wonOn: "2026-06-21" }))).toBe(20);
    expect(kararSuresiGun(kazanilan({ issuedOn: null }))).toBeNull();
    expect(kararSuresiGun(kazanilan({ issuedOn: "2026-09-01", wonOn: "2026-08-01" }))).toBeNull();
  });

  it("yeniden eskiye dizer ve tarihi bilinmeyeni sona bırakır", () => {
    const sirali = siralaKazanilanIsler([
      kazanilan({ id: "eski", wonOn: "2026-01-01" }),
      kazanilan({ id: "tarihsiz", wonOn: null }),
      kazanilan({ id: "yeni", wonOn: "2026-08-01" }),
    ]);
    expect(sirali.map((s) => s.id)).toEqual(["yeni", "eski", "tarihsiz"]);
  });
});

describe("kazanılma tarihi veri sözleşmesi", () => {
  const migration = readFileSync(
    join(process.cwd(), "supabase/migrations/20260904000002_offer_won_analysis.sql"),
    "utf8"
  );

  it("durum geçişinde günü dondurur ve ortak listeye taşır", () => {
    expect(migration).toContain("new.won_on := coalesce(new.won_on, current_date)");
    expect(migration).toContain("o.won_on");
    expect(migration).toContain("offers_won_on_status_check");
  });

  it("geçmiş tarihi yalnız denetim defterindeki açık kazanım olayından tamamlar", () => {
    expect(migration).toContain("from public.audit_log");
    expect(migration).toContain("detail #>> '{yeni,status}' = 'won'");
    expect(migration).not.toContain("set won_on = updated_at");
    expect(migration).not.toContain("set won_on = issue_date");
  });
});

// ═══════════════════════════════════════════════════ EKRANIN KENDİ KURALLARI
//
// Aşağıdakiler çekirdekte DEĞİL sayfada yaşar (`analiz-view.tsx`,
// `lead-dialog.tsx`) çünkü projeksiyon matematiği ikisini de okumaz: biri
// çizelgenin DİZİLİŞİ, öteki bir GİRDİNİN ne zaman kaydedileceği. Yine de
// sessizce bozulabilecek ve ancak yanlış bir kayıt yapıldığında anlaşılabilecek
// kurallardır — koruma testleri bu yüzden burada durur.

// ——————————————————————————————————————————————————————————— sıralama

/** Çizelge satırı fabrikası — testler yalnız ilgilendikleri alanı yazar. */
function detay(ozel: Partial<AnalizSatiriDetay> = {}): AnalizSatiriDetay {
  return {
    ...satir(),
    customerId: null,
    notes: "",
    verilisTarihi: "2026-08-01",
    ...ozel,
  };
}

describe("siraTarihi", () => {
  it("TEKLİFTE VERİLME GÜNÜDÜR, beklenen tarih değil", () => {
    const s = detay({ kaynak: "teklif", verilisTarihi: "2026-08-10", expectedOn: "2026-12-01" });
    expect(siraTarihi(s)).toBe("2026-08-10");
  });

  it("beklenen işte beklenen gündür — verilme günü YOKTUR", () => {
    const s = detay({
      kaynak: "beklenen",
      verilisTarihi: null,
      expectedOn: "2026-10-05",
      offerNo: null,
    });
    expect(siraTarihi(s)).toBe("2026-10-05");
  });

  it("iki tarihi de olmayan satırda boştur", () => {
    expect(siraTarihi(detay({ kaynak: "beklenen", verilisTarihi: null, expectedOn: null }))).toBeNull();
    expect(siraTarihi(detay({ kaynak: "teklif", verilisTarihi: null }))).toBeNull();
  });
});

describe("siralaAnaliz", () => {
  it("YENİDEN ESKİYE dizer ve teklifin BEKLENEN tarihine bakmaz", () => {
    // "eski" teklifi beklenen tarihiyle sıralasaydık en üste çıkardı.
    const sirali = siralaAnaliz([
      detay({ id: "eski", verilisTarihi: "2026-06-01", expectedOn: "2027-12-31" }),
      detay({ id: "yeni", verilisTarihi: "2026-08-15", expectedOn: "2026-09-01" }),
      detay({ id: "orta", verilisTarihi: "2026-07-20", expectedOn: "2026-10-01" }),
    ]);
    expect(sirali.map((s) => s.id)).toEqual(["yeni", "orta", "eski"]);
  });

  it("TARİHİ OLMAYAN SATIR SONA DÜŞER — listeden kaybolmaz", () => {
    const sirali = siralaAnaliz([
      detay({ id: "tarihsiz", kaynak: "beklenen", verilisTarihi: null, expectedOn: null, offerNo: null }),
      detay({ id: "tarihli", verilisTarihi: "2026-08-15" }),
    ]);
    expect(sirali.map((s) => s.id)).toEqual(["tarihli", "tarihsiz"]);
    expect(sirali).toHaveLength(2);
  });

  it("iki kaynağı TEK eksende buluşturur", () => {
    const sirali = siralaAnaliz([
      detay({ id: "teklif", verilisTarihi: "2026-08-01" }),
      detay({
        id: "beklenen",
        kaynak: "beklenen",
        verilisTarihi: null,
        expectedOn: "2026-09-01",
        offerNo: null,
      }),
    ]);
    expect(sirali.map((s) => s.id)).toEqual(["beklenen", "teklif"]);
  });

  it("KARARLIDIR: aynı gün iki satır her çağrıda aynı sırada durur", () => {
    const girdi = [
      detay({ id: "b", offerNo: "TKF-2026-0002", verilisTarihi: "2026-08-15" }),
      detay({ id: "a", offerNo: "TKF-2026-0009", verilisTarihi: "2026-08-15" }),
    ];
    const bir = siralaAnaliz(girdi).map((s) => s.id);
    const iki = siralaAnaliz([...girdi].reverse()).map((s) => s.id);
    expect(bir).toEqual(iki);
  });

  it("girdiyi YERİNDE DEĞİŞTİRMEZ", () => {
    const girdi = [
      detay({ id: "eski", verilisTarihi: "2026-06-01" }),
      detay({ id: "yeni", verilisTarihi: "2026-08-15" }),
    ];
    siralaAnaliz(girdi);
    expect(girdi.map((s) => s.id)).toEqual(["eski", "yeni"]);
  });
});

// ————————————————————————————————————————————————————— beklenen tarih

describe("tarihKesin", () => {
  it("YARIM YIL KABUL ETMEZ — kullanıcı hâlâ yazıyor demektir", () => {
    // `<input type="date">` dolu bir alanda ilk rakamda "0002" üretir; biçim
    // doğrudur ama karar verilmiş değildir (md. 25).
    expect(tarihKesin("0002-09-15")).toBe(false);
    expect(tarihKesin("0020-09-15")).toBe(false);
    expect(tarihKesin("0202-09-15")).toBe(false);
    expect(tarihKesin("2026-09-15")).toBe(true);
  });

  it("tam ve gerçek günü kabul eder", () => {
    expect(tarihKesin("2026-02-28")).toBe(true);
    expect(tarihKesin("2028-02-29")).toBe(true);
  });

  it("takvimde olmayan günü reddeder", () => {
    expect(tarihKesin("2026-02-31")).toBe(false);
    expect(tarihKesin("2026-13-01")).toBe(false);
    expect(tarihKesin("2026-00-10")).toBe(false);
  });

  it("boş ya da eksik biçimi reddeder — boşluğun karşılığı `null`dır, bu değil", () => {
    expect(tarihKesin("")).toBe(false);
    expect(tarihKesin("2026-09")).toBe(false);
    expect(tarihKesin("15.09.2026")).toBe(false);
  });
});

describe("sunucu ucu ayrışmamalı", () => {
  /**
   * Yıl alt sınırı hem ekranda (`tarihKesin`) hem sunucuda (`tarihAlani`)
   * yaşıyor (değişmez md. 8). Sunucudaki kontrol kaldırılırsa ekran hatasız
   * görünür ama veritabanına `0002` yazılabilir hâle gelir — `terms.test.ts`in
   * kaynak okuma kalıbı bunu engelliyor.
   */
  const actions = readFileSync(
    join(process.cwd(), "src/app/(app)/offers/analiz/actions.ts"),
    "utf8"
  );

  it("tarih şeması yılın alt sınırını da sınıyor", () => {
    expect(actions).toContain("Number(v.slice(0, 4)) >= 1000");
  });
});
