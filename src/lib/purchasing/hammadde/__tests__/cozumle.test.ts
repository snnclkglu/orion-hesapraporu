// HAMMADDE ÇÖZÜCÜSÜ — saf çekirdek testleri.
//
// Örneklerin TAMAMI iki gerçek teslim klasöründen alınmıştır (0043 MTC,
// 0057 MONORAY, 0053 LITEC). Uydurma tanım yoktur: dilbilgisi ancak ressamın
// gerçekten yazdığı satırlarla sınanabilir (md. 21'in "fikstür testi yetmiyor"
// dersi). Geniş ölçüm `npx tsx scripts/test-hammadde.ts`tedir; burada KURALLAR
// dondurulur.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { RAILS } from "@/lib/calc/tables";
import { hammaddeCozumle } from "../cozumle";
import { PROFIL_KESITLERI } from "../profil-kesitleri";
import { CELIK_OZKUTLE_KG_MM3, kaliteAyikla, ozkutleBul } from "../siniflar";

/** Varsayılan bağlam: kodu olan bir imalat parçası. */
function coz(tanim: string, over: { malzeme?: string; kategori?: string; kind?: string } = {}) {
  return hammaddeCozumle({
    tanim,
    malzeme: over.malzeme ?? "S235JR",
    kategori: over.kategori ?? "Testere",
    kind: over.kind ?? "imalat",
    partCode: "0053-01-0000-01",
  });
}

describe("kapsam kapısı", () => {
  it("SATIN ALMA satırı hammadde havuzuna GİRMEZ — bölünme artıksızdır", () => {
    expect(coz("CİVATA M16x70 DIN931", { kind: "satinalma" })).toBeNull();
  });

  it("kodsuz satır da girmez: o EKİPMAN havuzunun satırıdır", () => {
    expect(
      hammaddeCozumle({ tanim: "SOMUN M20 DIN934", kind: "imalat", partCode: "" })
    ).toBeNull();
  });

  it("montaj ve komple satırları girmez", () => {
    expect(coz("ARABA ŞASİ", { kind: "montaj" })).toBeNull();
    expect(coz("KÖPRÜ YÜRÜTME GRUBU", { kategori: "Komple" })).toBeNull();
  });

  it("ölçüsü de malzemesi de olmayan satır bir MONTAJ ADIDIR", () => {
    expect(coz("SPREADER BEAM", { malzeme: "", kategori: "" })).toBeNull();
  });

  it("kauçuk ray altı lastiği SAC DEĞİLDİR — üç ölçüsü ve 'SACLI' adı olsa bile", () => {
    // Kategorisi `Makas`, adında `SACLI` geçiyor ve `8x220x12000` üç ölçü:
    // üç sinyalin üçü de onu sac sanmaya yeter. Plaka yerleşimine girmesi
    // yerleşimi bozardı.
    const c = coz("RAYALTI LASTİĞİ, 8x220x12000mm DKP SACLI", { kategori: "Makas", malzeme: "-" });
    expect(c?.sinif).toBe("DIGER");
  });
});

describe("SAC", () => {
  it("adı SAC olan üç ölçülü satır: ilk ölçü KALINLIKTIR", () => {
    const c = coz("SAC 15x375x1500", { kategori: "Plazma", malzeme: "S355JR" });
    expect(c?.sinif).toBe("SAC");
    expect(c?.olcu.kalinlikMm).toBe(15);
    expect(c?.olcu.enMm).toBe(375);
    expect(c?.olcu.boyMm).toBe(1500);
    expect(c?.stokTanimi).toBe("SAC 15 MM S355JR");
  });

  it("ADI SAC OLMAYAN SAC PARÇASINI KESİM KATEGORİSİ ELE VERİR", () => {
    // Üçü de gerçek: kategorileri `Plazma`dır ve plakadan çıkarlar.
    for (const t of ["KAPAK-1 30x190x190", "EMNIYET PULU 8x50x50", "RULMAN YATAĞI 40x240x240"]) {
      expect(coz(t, { kategori: "Plazma" })?.sinif, t).toBe("SAC");
    }
  });

  it("kalınlığı ondalıklı sac okunur", () => {
    const c = coz("SAC 3,6x590x6000", { kategori: "Plazma", malzeme: "BDS" });
    expect(c?.olcu.kalinlikMm).toBe(3.6);
    expect(c?.stokTanimi).toBe("SAC 3,6 MM BDS");
  });

  it("ağırlık üç ölçünün çarpımıdır", () => {
    const c = coz("SAC 10x1000x2000", { kategori: "Plazma", malzeme: "S355JR" });
    expect(c?.birimAgirlikKg).toBeCloseTo(10 * 1000 * 2000 * CELIK_OZKUTLE_KG_MM3, 3);
  });

  it("KALINLIĞI OKUNAMAYAN SAC uydurulmaz — DİĞER'e düşer ve nedenini söyler", () => {
    const c = coz("HALAT PAPUCU PL", { kategori: "Talaşlı İmalat" });
    expect(c?.sinif).toBe("DIGER");
    expect(c?.eksikler).toContain("sac kalınlığı okunamadı");
  });
});

describe("PROFİL", () => {
  it("NPU ≡ UPN, NPI ≡ IPN — atölye yazımı standart koda çevrilir", () => {
    expect(coz("NPU 100 L=12000")?.kesitKodu).toBe("UPN 100");
    expect(coz("NPI 280 L=2248")?.kesitKodu).toBe("IPN 280");
  });

  it("kesim boyu 'L=' ile okunur — PROFİL sözcüğünün L'si boy sanılmaz", () => {
    // `\bL` JavaScript'te "PROFİL"in L'sini yakalar (İ, ASCII \w değildir) ve
    // boyu 50 sanardı. Kural bu satırla dondurulmuştur.
    const c = coz("DİKDÖRTGEN KUTU PROFİL 50x30x3 L=10500");
    expect(c?.sinif).toBe("PROFIL");
    expect(c?.olcu.boyMm).toBe(10500);
  });

  it("NPL'nin L'si de boy sanılmaz", () => {
    expect(coz("NPL 50x50x5 L=17000")?.olcu.boyMm).toBe(17000);
  });

  it("metre ağırlığı ÖNCE TABLODAN gelir", () => {
    const c = coz("NPU 100 L=1150");
    expect(c?.kgPerM).toBe(10.6);
    expect(c?.agirlikKaynagi).toBe("tablo");
  });

  it("tabloda olmayan kesit GEOMETRİDEN hesaplanır ve öyle işaretlenir", () => {
    const c = coz("NPL 50x50x5 L=1000");
    expect(c?.agirlikKaynagi).toBe("geometri");
    // t·(2a − t) = 5·95 = 475 mm² → 3,73 kg/m (standart 3,77; %1 düşük ve
    // bu fark BİLEREK kabul edilmiştir, satır "geometri" diyor).
    expect(c?.kgPerM).toBeCloseTo(3.73, 2);
  });

  it("küçük UPN/IPN boyları DIN defterinden gelir — geometriden çıkarılamazlar", () => {
    expect(coz("NPU 65 L=750")?.kgPerM).toBe(7.09);
    expect(coz("NPU 80 L=225")?.kgPerM).toBe(8.64);
    expect(coz("NPI 80 L=4500")?.kgPerM).toBe(5.94);
  });

  it("HEA 300 tablodaki 'HE 300 A' satırına düşer", () => {
    const c = coz("HEA 300 L=1955");
    expect(c?.kesitKodu).toBe("HEA 300");
    expect(c?.kgPerM).toBe(88.3);
  });

  it("LAMA ve SİLME aynı üründür", () => {
    expect(coz("SİLME 50x5 L=1220 mm")?.kesitKodu).toBe("LAMA 50x5");
    expect(coz("LAMA 120x10 L=3900 mm")?.kesitKodu).toBe("LAMA 120x10");
  });

  it("kutu profilin metre ağırlığı iç boşluk düşülerek bulunur", () => {
    const c = coz("KARE KUTU PROFİL 50x50x3 L=1600");
    const alan = 50 * 50 - 44 * 44;
    expect(c?.kgPerM).toBeCloseTo(alan * CELIK_OZKUTLE_KG_MM3 * 1000, 2);
  });
});

describe("RAY", () => {
  it("A serisi vinç rayı DIN 536-1 anma kütlesini alır", () => {
    const c = coz("RAY - A65 - DIN536 GRADE 70 L=12000");
    expect(c?.sinif).toBe("RAY");
    expect(c?.kesitKodu).toBe("A65");
    expect(c?.kgPerM).toBe(43.1);
    expect(c?.olcu.boyMm).toBe(12000);
  });

  it("KARE DEMİR bir dikdörtgen raydır (kullanıcı kuralı)", () => {
    const c = coz("KARE DEMİR 60x40x17456", { malzeme: "C 1040" });
    expect(c?.sinif).toBe("RAY");
    expect(c?.kesitKodu).toBe("KARE 60x40");
    expect(c?.olcu.boyMm).toBe(17456);
    expect(c?.kgPerM).toBeCloseTo(60 * 40 * CELIK_OZKUTLE_KG_MM3 * 1000, 2);
  });

  it("KARE DEMİR boyunu L= ile de yazabilir", () => {
    expect(coz("KARE DEMİR 130x130 L=214", { malzeme: "S355JR" })?.olcu.boyMm).toBe(214);
  });

  it("ray tablosu hesap motorunun RAILS defteriyle AYRIŞMAZ", () => {
    // İki tablo bilinçli olarak birbirinden bağımsızdır (satın alma hesap
    // motoruna bağlanmaz) ama SAYILARI aynı standarttan gelir.
    for (const kod of ["A45", "A55", "A65", "A75", "A100", "A120", "A150"]) {
      const c = coz(`RAY - ${kod} - DIN536 L=12000`);
      expect(c?.kgPerM, kod).toBe(RAILS[kod].massKgPerM);
    }
  });
});

describe("BORU", () => {
  it("İKİ Ø = içi boş; küçüğü iç, büyüğü dış çaptır", () => {
    const c = coz("İÇ BİLEZİK Ø80xØ65x35", { kategori: "Talaşlı İmalat" });
    expect(c?.sinif).toBe("BORU");
    expect(c?.olcu.disCapMm).toBe(80);
    expect(c?.olcu.icCapMm).toBe(65);
    expect(c?.olcu.boyMm).toBe(35);
  });

  it("çapların YAZILIŞ SIRASI önemsizdir", () => {
    // Canlı veride hem "Ø140xØ90" hem "Ø8xØ10" yazımı var.
    const c = coz("SAPLAMA BORUSU Ø8x Ø10x44,5", { kategori: "Testere" });
    expect(c?.olcu.disCapMm).toBe(10);
    expect(c?.olcu.icCapMm).toBe(8);
  });

  it("eğik çizgili yazım da okunur", () => {
    const c = coz("RULMAN YATAĞI Ø34/Ø140 L=64");
    expect(c?.olcu.disCapMm).toBe(140);
    expect(c?.olcu.icCapMm).toBe(34);
  });

  it("DİKİŞLİ BORU'da ikinci sayı ET KALINLIĞIDIR, iç çap değil", () => {
    const c = coz("DİKİŞLİ BORU Ø33,7x3,25 L=13774", { malzeme: "S195T (St33)" });
    expect(c?.sinif).toBe("BORU");
    expect(c?.olcu.disCapMm).toBe(33.7);
    expect(c?.olcu.kalinlikMm).toBe(3.25);
    expect(c?.olcu.icCapMm).toBeCloseTo(27.2, 6);
    expect(c?.olcu.boyMm).toBe(13774);
  });
});

describe("DOLU", () => {
  it("TEK Ø = dolu malzeme; ikinci sayı boydur", () => {
    const c = coz("MİL Ø90x453", { kategori: "Talaşlı İmalat" });
    expect(c?.sinif).toBe("DOLU");
    expect(c?.olcu.disCapMm).toBe(90);
    expect(c?.olcu.boyMm).toBe(453);
    expect(c?.stokTanimi).toBe("DOLU Ø90 S235JR");
  });

  it("teker, makara, pim ve nervürlü demir de dolu malzemedir", () => {
    expect(coz("TEKER Ø315x105", { malzeme: "C 4140" })?.sinif).toBe("DOLU");
    expect(coz("MAKARA Ø470x74", { malzeme: "S355JR" })?.sinif).toBe("DOLU");
    expect(coz("PIM Ø48 L=180", { malzeme: "S355JR" })?.sinif).toBe("DOLU");
    expect(coz("NERVÜRLÜ DEMİR Ø22 L=1128,000 mm")?.olcu.boyMm).toBe(1128);
  });

  it("mm eki boyu bozmaz", () => {
    expect(coz("KANCA MİL Ø110 mm L=582 mm", { malzeme: "Ck45" })?.olcu.boyMm).toBe(582);
  });

  it("BOYU OLMAYAN parça yine de sınıflanır ama BOY BOŞ KALIR", () => {
    const c = coz("AVARE KASNAK Ø250", { malzeme: "S355JR", kategori: "Talaşlı imalat" });
    expect(c?.sinif).toBe("DOLU");
    expect(c?.olcu.boyMm).toBeNull();
    expect(c?.birimAgirlikKg).toBeNull();
    expect(c?.eksikler).toContain("boy okunamadı");
  });
});

describe("parantez içi ölçü SATIN ALMA ölçüsüdür", () => {
  it("TAMBUR BORUSU örneğinde dış çap ve boy PAYLI değere geçer", () => {
    // Kullanıcının kendi örneği: "405 dış çap 358 iç çap 1870 mm … ressam pay
    // vermiş 415 dış çap, Ø358 iç çap ve 1900 mm olarak satın al demek istiyor."
    const c = coz("TAMBUR BORUSU Ø405 ( Ø415)/ Ø358x1870 (1900)", { malzeme: "S275JR" });
    expect(c?.sinif).toBe("BORU");
    expect(c?.olcu.disCapMm).toBe(415);
    expect(c?.olcu.icCapMm).toBe(358);
    expect(c?.olcu.boyMm).toBe(1900);
    expect(c?.payUygulandi).toBe(true);
  });

  it("tek ölçülü pay da uygulanır", () => {
    const c = coz("MİL Ø45x164 (170)", { malzeme: "S355JR" });
    expect(c?.olcu.boyMm).toBe(170);
    expect(c?.payUygulandi).toBe(true);
  });

  it("payı olmayan tanımda bayrak KAPALIDIR", () => {
    expect(coz("MİL Ø90x453")?.payUygulandi).toBe(false);
  });
});

describe("malzeme ve özkütle", () => {
  it("'Steel, Mild' bir KALİTE DEĞİLDİR — stok adına yazılmaz", () => {
    expect(kaliteAyikla("Steel, Mild")).toBe("");
    expect(kaliteAyikla("Generic")).toBe("");
    expect(kaliteAyikla("-")).toBe("");
    expect(kaliteAyikla("S355JR")).toBe("S355JR");
  });

  it("kalitesi yazılmamış satır bunu SÖYLER", () => {
    expect(coz("SAC 10x100x200", { kategori: "Plazma", malzeme: "-" })?.eksikler).toContain(
      "kalite yazılmamış"
    );
  });

  it("ÇELİK OLMAYAN malzeme sessizce çelik sayılmaz", () => {
    const c = coz("KILAVUZ - 01 Ø375xØ311 L=90", { malzeme: "Kestamid", kategori: "" });
    expect(c?.celikVarsayildi).toBe(false);
    expect(c?.ozkutleKgMm3).toBeCloseTo(1.15e-6, 12);
    // Aynı geometri çelik olsaydı yedi kat ağır çıkardı.
    const celik = coz("KILAVUZ - 02 Ø375xØ311 L=90", { malzeme: "S235JR", kategori: "" });
    expect((celik?.birimAgirlikKg ?? 0) / (c?.birimAgirlikKg ?? 1)).toBeCloseTo(7.85 / 1.15, 1);
  });

  it("tanınmayan malzeme çelik VARSAYILIR ve bu açıkça işaretlenir", () => {
    expect(ozkutleBul("S355JR").celikVarsayildi).toBe(true);
    expect(ozkutleBul("S355JR").kgMm3).toBe(CELIK_OZKUTLE_KG_MM3);
  });
});

describe("değişmezlik ve saflık", () => {
  it("aynı girdi aynı çıktıyı verir", () => {
    const a = coz("SAC 15x375x1500", { kategori: "Plazma", malzeme: "S355JR" });
    const b = coz("SAC 15x375x1500", { kategori: "Plazma", malzeme: "S355JR" });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("stok anahtarı stok tanımının katlanmışıdır", () => {
    const c = coz("SAC 15x375x1500", { kategori: "Plazma", malzeme: "S355JR" });
    expect(c?.stokAnahtari).toBe("SAC 15 MM S355JR");
  });

  it("çekirdek DB/HTTP/dosya sistemi içe aktarmaz", () => {
    for (const dosya of ["cozumle.ts", "havuz.ts", "nesting.ts", "siniflar.ts"]) {
      const kaynak = readFileSync(
        join(process.cwd(), "src/lib/purchasing/hammadde", dosya),
        "utf-8"
      );
      for (const yasak of ["@supabase", "next/", "node:", "exceljs", "react"]) {
        expect(kaynak.includes(`"${yasak}`), `${dosya} → ${yasak}`).toBe(false);
      }
    }
  });

  it("üretilmiş profil tablosu boş değildir ve kg/m pozitiftir", () => {
    expect(PROFIL_KESITLERI.length).toBeGreaterThan(400);
    for (const k of PROFIL_KESITLERI) expect(k.kgPerM, k.kod).toBeGreaterThan(0);
  });
});
