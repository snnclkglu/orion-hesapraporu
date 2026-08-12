// baslikDuzeni birim testleri — ekipman listesi hücrelerinin "Baş Harfler
// Büyük" düzenine geçerken kısaltma/birim/model kodu bozulmamalıdır.

import { describe, expect, it } from "vitest";
import { baslikDuzeni, kimlikBuyuk, trBuyuk, trKucuk } from "../tr-text";

describe("baslikDuzeni — temel Türkçe büyütme", () => {
  it("sözcüklerin baş harfini büyütür", () => {
    expect(baslikDuzeni("çelik halat")).toBe("Çelik Halat");
    expect(baslikDuzeni("tambur rulmanı")).toBe("Tambur Rulmanı");
    expect(baslikDuzeni("kanca bloğu mili")).toBe("Kanca Bloğu Mili");
  });

  it("Türkçe i/ı ayrımını doğru yapar", () => {
    // "i" → "İ" (İngilizce toUpperCase "I" verirdi)
    expect(baslikDuzeni("ikaz lambası")).toBe("İkaz Lambası");
    expect(baslikDuzeni("iş güvenliği")).toBe("İş Güvenliği");
    // "ı" → "I"
    expect(baslikDuzeni("ışıklı uyarı")).toBe("Işıklı Uyarı");
  });

  it("boş / tanımsız girdiyi güvenle karşılar", () => {
    expect(baslikDuzeni("")).toBe("");
    expect(baslikDuzeni(null)).toBe("");
    expect(baslikDuzeni(undefined)).toBe("");
  });

  it("boşluk düzenini korur", () => {
    expect(baslikDuzeni("  çelik  halat ")).toBe("  Çelik  Halat ");
    expect(baslikDuzeni("çelik\nhalat")).toBe("Çelik\nHalat");
  });
});

describe("baslikDuzeni — kısaltmalar bozulmaz", () => {
  it("tamamı büyük sözcüklere dokunmaz", () => {
    for (const k of ["PDF", "SKF", "FEM", "DIN", "CMAA", "ISO", "GGG"]) {
      expect(baslikDuzeni(`kaynak ${k} belgesi`)).toBe(`Kaynak ${k} Belgesi`);
    }
  });

  it("Romen rakamlarını korur", () => {
    expect(baslikDuzeni("yükleme durumu III")).toBe("Yükleme Durumu III");
    expect(baslikDuzeni("grup II kaldırma")).toBe("Grup II Kaldırma");
  });

  it("tek harflik büyük simgeleri korur", () => {
    expect(baslikDuzeni("C = 100 kN")).toBe("C = 100 kN");
    expect(baslikDuzeni("Ø630 mm")).toBe("Ø630 mm");
  });
});

describe("baslikDuzeni — birimler bozulmaz", () => {
  it("içinde büyük harf olan birimleri korur", () => {
    expect(baslikDuzeni("motor gücü 15 kW")).toBe("Motor Gücü 15 kW");
    expect(baslikDuzeni("nominal tork 12 kNm")).toBe("Nominal Tork 12 kNm");
    expect(baslikDuzeni("enerji 1,2 kJ")).toBe("Enerji 1,2 kJ");
    expect(baslikDuzeni("fren torku 500 Nm")).toBe("Fren Torku 500 Nm");
  });

  it("küçük harfli birim sözlüğünü korur", () => {
    expect(baslikDuzeni("yiv boyu 1200 mm")).toBe("Yiv Boyu 1200 mm");
    expect(baslikDuzeni("ağırlık 250 kg")).toBe("Ağırlık 250 kg");
    expect(baslikDuzeni("kapasite 5 ton")).toBe("Kapasite 5 ton");
  });

  it("bölü içeren bileşik birimlere dokunmaz", () => {
    expect(baslikDuzeni("tel 180 kg/mm²")).toBe("Tel 180 kg/mm²");
    expect(baslikDuzeni("devir 1450 d/dak")).toBe("Devir 1450 d/dak");
    expect(baslikDuzeni("hız 20 m/dak")).toBe("Hız 20 m/dak");
    expect(baslikDuzeni("çekme 500 N/mm²")).toBe("Çekme 500 N/mm²");
  });

  it("çevrim oranı simgesini korur", () => {
    expect(baslikDuzeni("i = 12,5 çevrim")).toBe("i = 12,5 Çevrim");
  });
});

describe("baslikDuzeni — model kodları bozulmaz", () => {
  it("rakam içeren sözcüklere dokunmaz", () => {
    expect(baslikDuzeni("redüktör HT0823")).toBe("Redüktör HT0823");
    expect(baslikDuzeni("rulman 22212 E")).toBe("Rulman 22212 E");
    expect(baslikDuzeni("motor M3BP 160")).toBe("Motor M3BP 160");
    expect(baslikDuzeni("kanca no 12")).toBe("Kanca No 12");
  });

  it("kod içindeki tireyi bölmez", () => {
    expect(baslikDuzeni("tip SHI-25")).toBe("Tip SHI-25");
    expect(baslikDuzeni("kod 22212-E")).toBe("Kod 22212-E");
  });

  it("harf-tire-harf birleşik sözcüğü parça parça büyütür", () => {
    expect(baslikDuzeni("motor-redüktör kaplini")).toBe("Motor-Redüktör Kaplini");
  });
});

describe("baslikDuzeni — bağlaçlar", () => {
  it("ilk sözcük değilse bağlaç küçük kalır", () => {
    expect(baslikDuzeni("halat ve tambur")).toBe("Halat ve Tambur");
    expect(baslikDuzeni("motor ile redüktör")).toBe("Motor ile Redüktör");
    expect(baslikDuzeni("kaldırma için fren")).toBe("Kaldırma için Fren");
    expect(baslikDuzeni("kaplin veya kasnak")).toBe("Kaplin veya Kasnak");
  });

  it("ilk sözcük ise bağlaç da büyür", () => {
    expect(baslikDuzeni("ve tambur")).toBe("Ve Tambur");
    expect(baslikDuzeni("için gerekli")).toBe("İçin Gerekli");
  });
});

describe("baslikDuzeni — gerçek ekipman satırları", () => {
  it("halat özellik metnini bozmaz", () => {
    expect(
      baslikDuzeni("Ø22 mm, öz: çelik, tel 180 kg/mm², kopma yükü 245 kN")
    ).toBe("Ø22 mm, Öz: Çelik, Tel 180 kg/mm², Kopma Yükü 245 kN");
  });

  it("redüktör özellik metnini bozmaz", () => {
    expect(
      baslikDuzeni("i = 12,50, nominal tork 25 kNm, giriş mili Ø48 mm")
    ).toBe("i = 12,50, Nominal Tork 25 kNm, Giriş Mili Ø48 mm");
  });

  it("kanca özellik metnini bozmaz", () => {
    expect(baslikDuzeni("kapasite 12500 kg (DIN 15400)")).toBe(
      "Kapasite 12500 kg (DIN 15400)"
    );
  });

  it("boş değer göstergesine dokunmaz", () => {
    expect(baslikDuzeni("-")).toBe("-");
    expect(baslikDuzeni("=")).toBe("=");
  });

  it("idempotenttir — iki kez uygulamak sonucu değiştirmez", () => {
    const kaynak = "kasnak/disk Ø200 mm, fren torku 500 Nm ve SKF 22212 E";
    const bir = baslikDuzeni(kaynak);
    expect(baslikDuzeni(bir)).toBe(bir);
  });
});

describe("trBuyuk / trKucuk", () => {
  it("Türkçe kurallarıyla dönüştürür", () => {
    expect(trBuyuk("işletme")).toBe("İŞLETME");
    expect(trBuyuk("ışık")).toBe("IŞIK");
    expect(trKucuk("İŞLETME")).toBe("işletme");
    expect(trKucuk("IŞIK")).toBe("ışık");
  });
});

describe("kimlikBuyuk — marka ve model kodu", () => {
  it("Türk üreticiyi tr-TR ile büyütür", () => {
    expect(kimlikBuyuk("Haşçelik")).toBe("HAŞÇELİK");
    expect(kimlikBuyuk("Yılmaz Redüktör")).toBe("YILMAZ REDÜKTÖR");
    expect(kimlikBuyuk("İzmit A.Ş.")).toBe("İZMİT A.Ş.");
    expect(kimlikBuyuk("Özgün")).toBe("ÖZGÜN");
  });

  it("yabancı markanın 'i' harfini NOKTALI yapmaz", () => {
    // Asıl gerekçe budur: `adBuyuk` burada "CONDUCTİX-WAMPFLER" üretiyordu ve
    // müşteriye giden ekipman listesine öyle basılıyordu.
    expect(kimlikBuyuk("Conductix-Wampfler")).toBe("CONDUCTIX-WAMPFLER");
    expect(kimlikBuyuk("Galvi Newcomen")).toBe("GALVI NEWCOMEN");
    expect(kimlikBuyuk("Innomotics")).toBe("INNOMOTICS");
  });

  it("katalog kodunu ve boş değeri bozmaz", () => {
    expect(kimlikBuyuk("1LE1603-1CB2")).toBe("1LE1603-1CB2");
    expect(kimlikBuyuk("SNL 218")).toBe("SNL 218");
    expect(kimlikBuyuk("-")).toBe("-");
    expect(kimlikBuyuk(null)).toBe("");
  });
});
