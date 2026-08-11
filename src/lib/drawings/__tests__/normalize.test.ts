// Tanım normalizasyonu — KANIT TESTİ.
//
// Buradaki her satır GERÇEK veridir: sol taraf iki teslim klasörünün DEPO /
// ÜRÜN AĞACI Excel'lerinden, sağ taraf satın alma ekibinin İŞ HAZIRLAMA
// LİSTESİ dosyasından (BÜYÜK HARFE çevrilmiş hâliyle — kullanıcı kararı).
//
// Test bir "acaba çalışıyor mu" kontrolü değil, SÖZLÜĞÜN ŞARTNAMESİDİR:
// kural değiştiğinde hangi gerçek satırın bozulduğu buradan görünür.

import { describe, expect, it } from "vitest";
import {
  NORMALIZE_VERSION,
  anaGrupAdaylari,
  anaGrupKodu,
  grupAdlariCikar,
  normAnahtar,
  normalizeTanim,
} from "../normalize";

/** Kısayol — testlerin okunur kalması için. */
const n = (s: string) => normalizeTanim(s).tanim;

describe("normalizeTanim — biçimsel düzeltmeler", () => {
  it("kenar ve gömülü boşlukları temizler", () => {
    // İŞ HAZ. dosyasında 18 hücrede sondaki boşluk, 8 satırda çift boşluk var.
    expect(n("Mil  ")).toBe("MİL");
    expect(n("Boru  ")).toBe("BORU");
    expect(n("Perçin ")).toBe("PERÇİN");
    expect(n("SAPLAMA BORUSU  Ø8x Ø10x44,5")).toBe("SAPLAMA BORUSU Ø8XØ10X44,5");
  });

  it("iki çap simgesini tek biçime indirir (∅ U+2205 → Ø U+00D8)", () => {
    expect(n("KAUÇUK TAMPON ∅30x20")).toBe("KAUÇUK TAMPON Ø30X20");
    expect(n("KAUÇUK TAMPON ∅100x50")).toBe("KAUÇUK TAMPON Ø100X50");
  });

  it("tanımı tr-TR kuralıyla BÜYÜK HARFE çevirir", () => {
    // `toUpperCase()` olsaydı "GALVANIZLI" çıkardı — "i" harfi "I" olurdu.
    expect(n("Cıvata M16x120 DIN 931 Galvanizli")).toBe("CIVATA M16X120 DIN 931 GALVANİZLİ");
    expect(n("Kanca Bloğu")).toBe("KANCA BLOĞU");
  });

  it("DIN normu ile numarasını ayırır", () => {
    expect(n("CİVATA M6x20 DIN933")).toBe("CIVATA M6X20 DIN 933");
    expect(n("Segman Ø65 DIN472")).toBe("SEGMAN Ø65 DIN 472");
    expect(n("GUPİLYA 8x63 DIN94")).toBe("GUPİLYA 8X63 DIN 94");
  });

  it("parantezli kaplamayı sona alır — YENİSİNİ EKLEMEZ", () => {
    expect(n("CİVATA M16x120 DIN931 (GALVANİZLİ)")).toBe("CIVATA M16X120 DIN 931 GALVANİZLİ");
    expect(n("SOMUN M16 DIN934 (GALVANİZLİ)")).toBe("SOMUN M16 DIN 934 GALVANİZLİ");
    // Kaplama yazmıyorsa EKLENMEZ (uydurma yasağı).
    expect(n("SOMUN M6 DIN934")).toBe("SOMUN M6 DIN 934");
  });
});

describe("normalizeTanim — terim sözlüğü", () => {
  it("aynı sözcüğün bozuk yazımını düzeltir", () => {
    // İŞ HAZ. dosyasının kendisinde 10 satır "Civata" (noktalı i) yazıyor.
    expect(n("Civata M10x18 DIN 933 Galvanizli ")).toBe("CIVATA M10X18 DIN 933 GALVANİZLİ");
  });

  it("aynı ürünün iki adını birleştirir", () => {
    expect(n("GİJON M10x105 DIN976")).toBe("SAPLAMA M10X105 DIN 976");
    expect(n("Gresörlük M10x1 DIN 71412 Galvanizli")).toBe("GRES NİPELİ M10X1 DIN 71412 GALVANİZLİ");
    expect(n("MİL SEGMANI Ø30 DIN471")).toBe("SEGMAN Ø30 DIN 471");
    expect(n("DELİK SEGMANI Ø68 DIN472")).toBe("SEGMAN Ø68 DIN 472");
    expect(n("PUL RONDELA M8 DIN125")).toBe("RONDELA M8 DIN 125");
  });

  it("profil öneklerini tamamlar", () => {
    expect(n("NPL 50x50x5")).toBe("KÖŞEBENT NPL 50X50X5");
    expect(n("NPU 80")).toBe("PROFİL NPU 80");
    expect(n("NPI 300")).toBe("PROFİL NPI 300");
  });

  it("terim düzeltmesi sözcük bazındadır — harf dizisi içinde aramaz", () => {
    // "NPL" kuralı harf dizisi içinde arasaydı "KÖŞEBENT NPL" bir kez daha
    // genişler ve fonksiyon değişmez olmazdı.
    expect(n("KÖŞEBENT NPL 40x40x4")).toBe("KÖŞEBENT NPL 40X40X4");
  });
});

describe("normalizeTanim — ürün aileleri", () => {
  it("RULMAN: kullanıcının açık kuralı — tür sıfatı ve ölçü düşer, kod kalır", () => {
    expect(n("RULMAN EKSENEL 51106")).toBe("RULMAN 51106");
    expect(n("RULMAN EKSENEL 51214")).toBe("RULMAN 51214");
    expect(n("RULMAN ∅90x∅50x23 22210")).toBe("RULMAN 22210");
    expect(n("RULMAN Ø125xØ70x31 22214")).toBe("RULMAN 22214");
    expect(n("RULMAN 6007")).toBe("RULMAN 6007");
  });

  it("RULMAN: sonek KİMLİĞİN PARÇASIDIR, düşürülmez", () => {
    expect(n("Rulman 6005 - Z")).toBe("RULMAN 6005-Z");
    expect(n("RULMAN 6008 - Z")).toBe("RULMAN 6008-Z");
    expect(n("RULMAN 6213-Z")).toBe("RULMAN 6213-Z");
    expect(n("Rulman 6006-ZZ")).toBe("RULMAN 6006-ZZ");
  });

  it("RULMAN YATAĞI rulmanla karışmaz", () => {
    expect(n("RULMAN SY-60-TF")).toBe("RULMAN YATAĞI SY 60 TF");
    expect(n("Rulman Yatağı SY 60 TF")).toBe("RULMAN YATAĞI SY 60 TF");
  });

  it("KEÇE: üretici soneki düşer, iki Ø işaretli kalıba gelir", () => {
    expect(n("YAG KECESİ - 50x62x7  KK-T")).toBe("KEÇE Ø50XØ62X7");
    expect(n("YAG KECESİ_40X52X8 KK-T")).toBe("KEÇE Ø40XØ52X8");
    expect(n("Keçe Ø63xØ80x7")).toBe("KEÇE Ø63XØ80X7");
  });

  it("KAMA: iki yazım tek kalıba gelir, DIN VARSA korunur YOKSA eklenmez", () => {
    expect(n("KAMA 8x7x22 (A-TIP) DIN 6885")).toBe("A TİPİ KAMA 8X7X22 DIN 6885");
    expect(n("A-TİP KAMA 14x9x160 DIN 6885")).toBe("A TİPİ KAMA 14X9X160 DIN 6885");
    // DIN yazmıyorsa EKLENMEZ.
    expect(n("A Tipi Kama 14x9x80")).toBe("A TİPİ KAMA 14X9X80");
  });

  it("TAMPON · KANCA · LOADCELL · LİMİT · ARABACIK", () => {
    expect(n("KAUÇUK TAMPON Ø50x40")).toBe("KAUÇUK TAMPON Ø50X40");
    expect(n("Kauçuk Tampon Ø50x30 M10")).toBe("KAUÇUK TAMPON Ø50X30 M10");
    expect(n("KANCA DIN 15401-Nr 08 S")).toBe("KANCA NR 8-S DIN 15401");
    expect(n("KANCA DIN 15401-NR 8S")).toBe("KANCA NR 8-S DIN 15401");
    expect(n("LOADCELL LPW-1 (1- 5 TON)")).toBe("LOADCELL LPW-1 5T");
    expect(n("LOADCELL LPW-1  10 T")).toBe("LOADCELL LPW-1 10T");
    expect(n("LİMİT_51_67_DZC0Z_499P")).toBe("TAMBUR LİMİT SİVİÇ 51_67_DZC0Z_499P");
    expect(n("ARABACIK VS1028T3-86-4 (HAREKETLİ)")).toBe("ARABACIK VS1028T3-86-4 (HAREKETLİ)");
    expect(n("Kablo Arabacığı VS 1028T5-86/4")).toBe("ARABACIK VS1028T5-86-4");
  });
});

describe("normalizeTanim — sözleşme", () => {
  it("DEĞİŞMEZDİR: f(f(x)) === f(x)", () => {
    // Bu kırılırsa saklanmış bir tanım her okumada bir kez daha değişir ve
    // fiyat arşivi kendi kendine bölünür.
    const ornekler = [
      "CİVATA M16x120 DIN931 (GALVANİZLİ)",
      "RULMAN EKSENEL 51106",
      "YAG KECESİ - 50x62x7  KK-T",
      "KAMA 8x7x22 (A-TIP) DIN 6885",
      "NPL 50x50x5 L=23500",
      "BORU    Ø180 ( Ø195)/ Ø150x550 (580)",
      "Rulman 6005 - Z",
      "KANCA DIN 15401-Nr 08 S",
      "TAHRIKLI TEKER MİLİ Ø90x440,5",
      "3/4x1500x3000",
    ];
    for (const o of ornekler) {
      const bir = n(o);
      expect(n(bir), `değişmezlik bozuldu: ${o}`).toBe(bir);
    }
  });

  it("iki yazım AYNI anahtara gelir — fiyat arşivi bölünmez", () => {
    expect(normAnahtar("RULMAN EKSENEL 51106")).toBe(normAnahtar("Rulman 51106"));
    expect(normAnahtar("CİVATA M16x120 DIN931 (GALVANİZLİ)")).toBe(
      normAnahtar("Cıvata M16x120 DIN 931 Galvanizli")
    );
    expect(normAnahtar("YAG KECESİ - 50x62x7  KK-T")).toBe(normAnahtar("Keçe Ø50xØ62x7"));
  });

  it("FARKLI ürünler AYNI anahtara GELMEZ", () => {
    // Yanlış birleştirme, ayrı kalmaktan çok daha pahalıdır.
    expect(normAnahtar("RULMAN 6205")).not.toBe(normAnahtar("RULMAN 6205-Z"));
    expect(normAnahtar("CIVATA M16X120 DIN 931")).not.toBe(
      normAnahtar("CIVATA M16X120 DIN 931 GALVANİZLİ")
    );
    expect(normAnahtar("SOMUN M16 DIN 934")).not.toBe(normAnahtar("SOMUN M18 DIN 934"));
    expect(normAnahtar("ARABACIK VS1028T3-86-4 (HAREKETLİ)")).not.toBe(
      normAnahtar("ARABACIK VS1028T3-86-4 (ÖNCÜ)")
    );
  });

  it("boş girdi boş sonuç verir, çökmez", () => {
    expect(n("")).toBe("");
    expect(n("   ")).toBe("");
    expect(normalizeTanim(null).tanim).toBe("");
    expect(normalizeTanim(undefined).key).toBe("");
  });

  it("tanımadığı tanımı BOZMAZ, yalnız biçimini düzeltir", () => {
    // Kalıbı bilinmeyen bir satır olduğu gibi (büyük harfle) geçer.
    expect(n("DENGE TRAVERSİ CORSBY 14-16 SOKET")).toBe("DENGE TRAVERSİ CORSBY 14-16 SOKET");
    expect(n("HALAT PAPUCU PL 8x25x27")).toBe("HALAT PAPUCU PL 8X25X27");
  });

  it("hangi kuralın çalıştığını söyler", () => {
    const s = normalizeTanim("CİVATA M16x120 DIN931 (GALVANİZLİ)");
    expect(s.kurallar).toContain("DIN");
    expect(s.kurallar).toContain("KAPLAMA");
    // Zaten standart olan tanımda hiçbir kural çalışmaz.
    expect(normalizeTanim("SOMUN M16 DIN 934 GALVANİZLİ").kurallar).toEqual([]);
  });

  it("sürüm numarası taşır", () => {
    expect(NORMALIZE_VERSION).toBeGreaterThan(0);
  });
});

describe("anaGrupKodu — 'son iki hane 00' kuralı YANLIŞTIR", () => {
  it("adayları en özelden en genele sıralar, iş numarasında durur", () => {
    expect(anaGrupAdaylari("0043-00-0802-00-01-04")).toEqual([
      "0043-00-0802-00-01",
      "0043-00-0802-00",
      "0043-00-0802",
    ]);
    expect(anaGrupAdaylari("0043-00-0100-01")).toEqual(["0043-00-0100"]);
    expect(anaGrupAdaylari("0043-00")).toEqual([]);
  });

  it("00 ile bitmeyen ana grupları da bulur", () => {
    // MTC'de 17 grubun 7'si 00 ile bitmiyor.
    const bilinen = new Set(["0043-00-0801", "0043-00-0850", "0043-00-0802"]);
    expect(anaGrupKodu("0043-00-0801-06", bilinen)).toBe("0043-00-0801");
    expect(anaGrupKodu("0043-00-0850-03", bilinen)).toBe("0043-00-0850");
  });

  it("ara seviyeyi ATLAR ve gerçek gruba iner", () => {
    // 0043-00-0802-00 defterde YOKTUR (yer tutucu ara seviye).
    const bilinen = new Set(["0043-00-0802", "0043-00-0802-00-01"]);
    expect(anaGrupKodu("0043-00-0802-00-01-04", bilinen)).toBe("0043-00-0802-00-01");
    expect(anaGrupKodu("0043-00-0802-05", bilinen)).toBe("0043-00-0802");
  });

  it("defter yoksa üç bloklu forma düşer", () => {
    expect(anaGrupKodu("0057-00-0700-07")).toBe("0057-00-0700");
  });
});

describe("grupAdlariCikar — ad UYDURULMAZ, kaynaktan çıkarılır", () => {
  const p = (partCode: string, description = "", assemblyTitle = "") => ({
    partCode,
    description,
    assemblyTitle,
    name: "",
  });

  it("grubun KENDİ satırı varsa tanımı ad olur (ÜRÜN AĞACI)", () => {
    const adlar = grupAdlariCikar([
      p("0043-00-0600", "15 TON KANCA BLOĞU", "ARABA GENEL GÖRÜNÜŞÜ"),
      p("0043-00-0600-01", "SAC 20x160x445", "15 TON KANCA BLOĞU"),
    ]);
    expect(adlar).toContainEqual({
      groupCode: "0043-00-0600",
      name: "15 TON KANCA BLOĞU",
      kaynak: "satir",
    });
  });

  it("kendi satırı yoksa alt parçaların başlığı OYBİRLİĞİYLE ad olur (DEPO)", () => {
    const adlar = grupAdlariCikar([
      p("0057-00-0700-01", "SAC 20x160x445", "1 TON KANCA BLOĞU"),
      p("0057-00-0700-07", "MİL Ø40 L=169,3", "1 TON KANCA BLOĞU"),
    ]);
    expect(adlar).toContainEqual({
      groupCode: "0057-00-0700",
      name: "1 TON KANCA BLOĞU",
      kaynak: "baslik",
    });
  });

  it("başlıklar ÇELİŞİYORSA ad ÜRETİLMEZ", () => {
    // MTC'de 0043-00-0801 üç farklı başlık taşıyor; yanlış bir grup adı
    // adsız bir gruptan çok daha pahalıdır.
    const adlar = grupAdlariCikar([
      p("0043-00-0801-01", "SAC 10x100x200", "ARABA ŞASİ"),
      p("0043-00-0801-02", "SAC 10x100x200", "ARABA YÜRÜTME GRUBU"),
    ]);
    expect(adlar.find((a) => a.groupCode === "0043-00-0801")).toBeUndefined();
  });

  it("kendi satırı, çelişen başlıklara RAĞMEN kazanır", () => {
    const adlar = grupAdlariCikar([
      p("0043-00-0300", "KÖPRÜ YÜRÜTME GRUBU", "ANAKİRİŞ"),
      p("0043-00-0300-01", "TEKER Ø315x105", "ARABA YÜRÜTME GRUBU"),
      p("0043-00-0300-02", "MİL Ø90x440", "KÖPRÜ YÜRÜTME GRUBU"),
    ]);
    expect(adlar.find((a) => a.groupCode === "0043-00-0300")).toEqual({
      groupCode: "0043-00-0300",
      name: "KÖPRÜ YÜRÜTME GRUBU",
      kaynak: "satir",
    });
  });
});

describe("normalizeTanim — gerçek havuzda yakalanan boşluklar", () => {
  it("KAMA: DIN parantezin İÇİNDE de olabilir", () => {
    // Canlı veride üç yazım birden geçiyor ve üçü de aynı kamadır.
    expect(n("KAMA 25x14x110 (A-TİPİ DIN 6885)")).toBe("A TİPİ KAMA 25X14X110 DIN 6885");
    expect(n("KAMA 8x7x22 (A-TIP) DIN 6885")).toBe("A TİPİ KAMA 8X7X22 DIN 6885");
    expect(n("A-TİP KAMA 14x9x160 DIN 6885")).toBe("A TİPİ KAMA 14X9X160 DIN 6885");
    // Üçü de AYNI anahtara gelmez (ölçüler farklı) ama aynı ölçü gelmelidir.
    expect(normAnahtar("KAMA 8x7x22 (A-TİPİ DIN 6885)")).toBe(
      normAnahtar("A-TİP KAMA 8x7x22 DIN 6885")
    );
  });

  it("SEGMAN: iki yazım canlı veride birleşti", () => {
    expect(normAnahtar("DELİK SEGMANI Ø180 DIN472")).toBe(normAnahtar("SEGMAN Ø180 DIN472"));
  });
});
