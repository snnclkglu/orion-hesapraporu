// PARÇA ÖLÇÜSÜ DÜZELTMESİ — metin yeniden yazma koruması.
//
// Bu çekirdeğin tek işi TANIMDAKİ DOĞRU SAYIYI değiştirmektir ve yanlış sayıyı
// değiştirmesi sessiz bir hatadır: ekranda ad değişmiş görünür, ölçü ise başka
// bir şeye dönüşür ve atölye yanlış sacı keser. Testler tam da o karışıklıkları
// hedefler — aynı sayının iki alanda geçmesi, `L=` yazımı, ondalık ölçü.

import { describe, expect, it } from "vitest";
import { hammaddeCozumle } from "../cozumle";
import {
  duzenlenebilirOlculer,
  parcaOlcuAnahtari,
  tanimiOlcuyleYaz,
} from "../olcu-duzelt";

/** Tanımı çözer ve resim ölçüsünü döndürür — düzeltme onun üstüne yazılır. */
function coz(tanim: string, malzeme = "S355JR", kategori = "Plazma") {
  const c = hammaddeCozumle({ tanim, malzeme, kategori, kind: "imalat", partCode: "0043-00-1000-01" });
  if (!c) throw new Error(`çözülemedi: ${tanim}`);
  return c;
}

describe("tanimiOlcuyleYaz", () => {
  it("sacın enini değiştirir, kalınlık ve boya dokunmaz", () => {
    const c = coz("SAC 15x375x1500");
    const s = tanimiOlcuyleYaz("SAC 15x375x1500", "SAC", c.resimOlcusu, { enMm: 400 });
    expect(s.tanim).toBe("SAC 15x400x1500");
    expect(s.yazilamayan).toEqual([]);
  });

  it("AYNI SAYI İKİ ALANDA GEÇİYORSA sırayı korur", () => {
    // `SAC 10x100x100` — en de boy da 100. Jetonlar SOLDAN SAĞA tüketilir,
    // yani "en" ilk 100'ü, "boy" ikincisini alır.
    const c = coz("SAC 10x100x100");
    expect(c.resimOlcusu.enMm).toBe(100);
    expect(c.resimOlcusu.boyMm).toBe(100);

    const en = tanimiOlcuyleYaz("SAC 10x100x100", "SAC", c.resimOlcusu, { enMm: 120 });
    expect(en.tanim).toBe("SAC 10x120x100");

    const boy = tanimiOlcuyleYaz("SAC 10x100x100", "SAC", c.resimOlcusu, { boyMm: 250 });
    expect(boy.tanim).toBe("SAC 10x100x250");
  });

  it("adı olmayan sac parçasında da çalışır (kategori kanıtı)", () => {
    const c = coz("KAPAK-1 30x190x190");
    const s = tanimiOlcuyleYaz("KAPAK-1 30x190x190", "SAC", c.resimOlcusu, {
      kalinlikMm: 25,
      boyMm: 200,
    });
    expect(s.tanim).toBe("KAPAK-1 25x190x200");
  });

  it("`L=` yazımında boy jetonunu kesit ölçüsüyle karıştırmaz", () => {
    const tanim = "NPL 120x120x10 L=2150";
    const c = coz(tanim, "S235JR", "Testere");
    expect(c.sinif).toBe("PROFIL");
    const s = tanimiOlcuyleYaz(tanim, "PROFIL", c.resimOlcusu, { boyMm: 2400 });
    expect(s.tanim).toBe("NPL 120x120x10 L=2400");
  });

  it("boy değeri kesit ölçüsüne EŞİTSE yine `L=` jetonunu seçer", () => {
    const tanim = "NPL 120x120x10 L=120";
    const c = coz(tanim, "S235JR", "Testere");
    const s = tanimiOlcuyleYaz(tanim, "PROFIL", c.resimOlcusu, { boyMm: 900 });
    expect(s.tanim).toBe("NPL 120x120x10 L=900");
  });

  it("dolu malzemede çapı değiştirir; pay OTOMATİK yeniden uygulanır", () => {
    const tanim = "MİL Ø90x1500";
    const c = coz(tanim, "CK45", "Talaşlı İmalat");
    expect(c.sinif).toBe("DOLU");
    // Resimde Ø90, satın almada payla Ø95.
    expect(c.resimOlcusu.disCapMm).toBe(90);
    expect(c.olcu.disCapMm).toBe(95);

    const s = tanimiOlcuyleYaz(tanim, "DOLU", c.resimOlcusu, { disCapMm: 100 });
    expect(s.tanim).toBe("MİL Ø100x1500");

    // Yeni tanım yeniden çözülünce pay da yeniden hesaplanır: 100 + %5 = 105.
    const yeni = coz(s.tanim, "CK45", "Talaşlı İmalat");
    expect(yeni.olcu.disCapMm).toBe(105);
  });

  it("borunun iç çapına dokunmadan dış çapı değiştirir", () => {
    const tanim = "BURÇ Ø140xØ90x300";
    const c = coz(tanim, "S355JR", "Talaşlı İmalat");
    expect(c.sinif).toBe("BORU");
    const s = tanimiOlcuyleYaz(tanim, "BORU", c.resimOlcusu, { disCapMm: 150 });
    expect(s.tanim).toBe("BURÇ Ø150xØ90x300");
  });

  it("ondalıklı ölçüyü tr-TR yazımıyla yazar", () => {
    const c = coz("SAC 15x375x1500");
    const s = tanimiOlcuyleYaz("SAC 15x375x1500", "SAC", c.resimOlcusu, { kalinlikMm: 12.5 });
    expect(s.tanim).toBe("SAC 12,5x375x1500");
  });

  it("değişmeyen ölçü tanımı DEĞİŞTİRMEZ", () => {
    const c = coz("SAC 15x375x1500");
    const s = tanimiOlcuyleYaz("SAC 15x375x1500", "SAC", c.resimOlcusu, {
      kalinlikMm: 15,
      enMm: 375,
      boyMm: 1500,
    });
    expect(s.tanim).toBe("SAC 15x375x1500");
  });

  it("metinde karşılığı olmayan ölçüyü UYDURMAZ, söyler", () => {
    // Sahte bir "eski" değer: tanımda 999 diye bir sayı yok.
    const s = tanimiOlcuyleYaz(
      "SAC 15x375x1500",
      "SAC",
      { kalinlikMm: 999, enMm: 375, boyMm: 1500, disCapMm: null, icCapMm: null },
      { kalinlikMm: 20 }
    );
    expect(s.tanim).toBe("SAC 15x375x1500");
    expect(s.yazilamayan).toEqual(["kalinlikMm"]);
  });

  it("DÜZELTME ÜSTÜNE DÜZELTME yapılabilir (değişmezlik)", () => {
    const bir = coz("SAC 15x375x1500");
    const ilk = tanimiOlcuyleYaz("SAC 15x375x1500", "SAC", bir.resimOlcusu, { enMm: 400 });
    const iki = coz(ilk.tanim);
    const ikinci = tanimiOlcuyleYaz(ilk.tanim, "SAC", iki.resimOlcusu, { boyMm: 1600 });
    expect(ikinci.tanim).toBe("SAC 15x400x1600");
  });
});

describe("duzenlenebilirOlculer", () => {
  it("sacda kalınlık, en ve boy açıktır", () => {
    const c = coz("SAC 15x375x1500");
    expect(duzenlenebilirOlculer("SAC", c.resimOlcusu)).toEqual([
      "kalinlikMm",
      "enMm",
      "boyMm",
    ]);
  });

  it("profilde YALNIZ BOY açıktır — kesit kodu kilitli", () => {
    const c = coz("NPL 120x120x10 L=2150", "S235JR", "Testere");
    expect(duzenlenebilirOlculer("PROFIL", c.resimOlcusu)).toEqual(["boyMm"]);
  });

  it("okunamayan ölçü düzenlenemez (uydurulmuş sayı yazılmaz)", () => {
    const c = coz("AVARE KASNAK Ø250", "S355JR", "Talaşlı İmalat");
    expect(c.resimOlcusu.boyMm).toBeNull();
    expect(duzenlenebilirOlculer("DOLU", c.resimOlcusu)).toEqual(["disCapMm"]);
  });
});

describe("parcaOlcuAnahtari", () => {
  it("iş kalemi ve parça kodunu birlikte katlar", () => {
    expect(parcaOlcuAnahtari("0043-00", "0043-00-1000-01")).toBe(
      parcaOlcuAnahtari(" 0043-00 ", "0043-00-1000-01")
    );
    expect(parcaOlcuAnahtari("0043-00", "0043-00-1000-01")).not.toBe(
      parcaOlcuAnahtari("0057-00", "0043-00-1000-01")
    );
  });
});
