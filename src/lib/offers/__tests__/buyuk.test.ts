// TEKNİK SATIRIN BÜYÜK HARFİ — birimler ve ölçüler bozulmuyor mu.
//
// Sınanan şey güzellik değil DOĞRULUKTUR: "22 kW" yerine "22 KW" basan bir
// teklif, okuyan mühendise birimin bilinmediğini söyler; "12.44m" → "12.44M"
// ise metreyi mega önekine çevirir. Büyütme bir SUNUM kararıdır ve verinin
// anlamını değiştirmemelidir.

import { describe, expect, it } from "vitest";
import { teknikDegerBuyuk, teknikEtiketBuyuk, teknikKapasiteDegerBuyuk } from "../buyuk";

describe("teknikEtiketBuyuk", () => {
  it("Türkçe kuralıyla büyütür — 'i' bozulmaz", () => {
    expect(teknikEtiketBuyuk("Vinç Sınıfı / Çelik Yapı")).toBe("VİNÇ SINIFI / ÇELİK YAPI");
    expect(teknikEtiketBuyuk("Kaldırma Kapasiteleri (Q)")).toBe("KALDIRMA KAPASİTELERİ (Q)");
  });
});

describe("teknikDegerBuyuk", () => {
  it("BİRİM OLDUĞU GİBİ KALIR — kW, m, d/dak", () => {
    // VARSAYILAN TÜRKÇEDİR: "Encoderli" içinde Türkçe'ye özgü harf yok ama
    // sözcük Türkçedir ve "I" ile büyütmek belgede yazım hatasıdır.
    expect(teknikDegerBuyuk("GAMAK 22 kW 1500 d/dak, Encoderli")).toBe(
      "GAMAK 22 kW 1500 d/dak, ENCODERLİ"
    );
    // Devralınan tekliflerin en sık iki satırı — düz büyütmede "FRENI" olurdu.
    expect(teknikDegerBuyuk("SIBRE Elektrohidrolik Kasnak Fren x 2 Adet")).toBe(
      "SIBRE ELEKTROHİDROLİK KASNAK FREN x 2 ADET"
    );
    expect(teknikDegerBuyuk("Elektromanyetik Motor Freni x 2 Adet")).toBe(
      "ELEKTROMANYETİK MOTOR FRENİ x 2 ADET"
    );
    expect(teknikDegerBuyuk("Kapalı Alan, -10 / +40 º C")).toBe("KAPALI ALAN, -10 / +40 º C");
    // BAŞ HARFİ BÜYÜK BİRİMLER — defterin göç provasında yakalanan boşluk:
    // "içeride büyük harf" kuralı bunları kaçırıyor ve hertz "HZ" oluyordu.
    expect(teknikDegerBuyuk("400 VAC 50 Hz")).toBe("400 VAC 50 Hz");
    expect(teknikDegerBuyuk("Fren Momenti 250 Nm")).toBe("FREN MOMENTİ 250 Nm");
    // Kullanıcı büyük yazdıysa öyle kalır — defterin yazımı dayatılmaz.
    expect(teknikDegerBuyuk("400 VAC 50 HZ")).toBe("400 VAC 50 HZ");
  });

  it("RAKAM İÇEREN SÖZCÜK ÖLÇÜDÜR, dokunulmaz", () => {
    expect(teknikDegerBuyuk("Ø20 6x36 Halat 1960 N/mm2 Çelik Özlü")).toBe(
      "Ø20 6x36 HALAT 1960 N/mm2 ÇELİK ÖZLÜ"
    );
    expect(teknikDegerBuyuk("4 x Ø400 DIN15090 C4140 35-42 HRC")).toBe(
      "4 x Ø400 DIN15090 C4140 35-42 HRC"
    );
    expect(teknikDegerBuyuk("12.44 m")).toBe("12.44 m");
  });

  it("YABANCI MARKA yerelsiz büyür — 'i' harfi Türkçeleşmez", () => {
    // Türk alfabesinde q/w/x yoktur, "ph"/"sch"/"ck" öbekleri de geçmez —
    // bu izleri taşıyan sözcük marka sayılır ve yerelsiz büyür.
    expect(teknikDegerBuyuk("Conductix-Wampfler")).toBe("CONDUCTIX-WAMPFLER");
    expect(teknikDegerBuyuk("Phoenix")).toBe("PHOENIX");
    expect(teknikDegerBuyuk("Schneider")).toBe("SCHNEIDER");
    expect(teknikDegerBuyuk("Elfatek EN-MİD Serisi")).toBe("ELFATEK EN-MİD SERİSİ");
  });

  it("boşluk düzeni korunur, boş değer boş kalır", () => {
    expect(teknikDegerBuyuk("")).toBe("");
    expect(teknikDegerBuyuk(null)).toBe("");
    expect(teknikDegerBuyuk("İnvertör  Kontrollü")).toBe("İNVERTÖR  KONTROLLÜ");
  });
});

describe("teknikKapasiteDegerBuyuk", () => {
  it("kapasite birimini de büyük basar — uygulamadaki küçük yazımdan bağımsız", () => {
    expect(teknikKapasiteDegerBuyuk("15 ton / 5 ton")).toBe("15 TON / 5 TON");
    expect(teknikKapasiteDegerBuyuk("15 Ton / 5 TON")).toBe("15 TON / 5 TON");
  });
});
