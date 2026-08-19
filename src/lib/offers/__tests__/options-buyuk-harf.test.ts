// TEKLİF DEFTERİ — BÜYÜK HARF KURALI VE MUAFİYETLERİ.
//
// Kural bir kullanıcı cümlesidir (19.08.2026):
//
//   "Tanımlar defterler kısmındaki yazıları BÜYÜK HARFE ÇEVİR. Kapsam Dışı
//    İşler, Notlar ve Kapak Metinleri, Vinç Sınıfı HARİÇ."
//
// Sınanan asıl şey MUAFİYETLERDİR: kural üç yerde birden uygulanıyor (giriş
// kutusu, sunucu action'ı, göç) ve muaf bir listenin bir yerde unutulması
// müşteriye giden belgede bir cümlenin bağırmasıyla sonuçlanır. Kümenin tek
// olduğunu buradaki testler, TS ile SQL'in ayrışmadığını ise dosyanın sonundaki
// göç okuması güvenceye alır (değişmez md. 8).
//
// Örnek değerlerin hepsi defterin GERÇEK maddeleridir (seed'den alınmıştır);
// uydurulmuş bir madde üzerinde sınamak kuralı değil hayali sınardı.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { OFFER_LIST_KEEP_CASE, offerValueUpper } from "../options";

describe("offerValueUpper — muaf listeler DOKUNULMADAN kalır", () => {
  it("Kapsam Dışı İşler bir madde listesi değil cümle listesidir", () => {
    const madde = "Vincin montaj sahasında gerekli olan tüm inşaat işleri";
    expect(offerValueUpper("term.exclusion", madde)).toBe(madde);
  });

  it("Notlar aynen kalır", () => {
    const not = "Belirtilen fiyatlara KDV dahil değildir.";
    expect(offerValueUpper("term.note", not)).toBe(not);
  });

  it("Kapak Metinleri ÖBEĞİNİN İKİ listesi de muaftır", () => {
    // Yalnız giriş paragrafı muaf tutulsaydı hitap eki "BEY," olur ve kapaktaki
    // "Sayın Ahmet Bey," cümlesi bozulurdu.
    expect(offerValueUpper("cover.honorific", "Bey,")).toBe("Bey,");
    expect(offerValueUpper("cover.honorific", "Hanım,")).toBe("Hanım,");
    const giris =
      "Tarafımızdan talep etmiş olduğunuz konu iş için teknik ve ticari teklifimizi aşağıda dikkatinize sunar, kıymetli siparişleriniz bekleriz.";
    expect(offerValueUpper("cover.intro", giris)).toBe(giris);
  });

  it("Vinç Sınıfı bir STANDART gösterimidir — 'FEM 1Am' 'FEM 1AM' olamaz", () => {
    const sinif = "FEM 1Am / ISO M4 - ISO/FEM A4";
    expect(offerValueUpper("val.craneClass", sinif)).toBe(sinif);
    expect(offerValueUpper("val.craneClass", "FEM 2m / ISO M5")).toBe("FEM 2m / ISO M5");
  });

  it("muaf küme BEŞ anahtardır ve hiçbiri marka listesi değildir", () => {
    expect([...OFFER_LIST_KEEP_CASE].sort()).toEqual([
      "cover.honorific",
      "cover.intro",
      "term.exclusion",
      "term.note",
      "val.craneClass",
    ]);
    // Marka dalı muafiyeti sormaz (göçte de sormuyor); kesişme doğarsa o dal
    // sessizce muaf bir listeyi büyütürdü.
    expect([...OFFER_LIST_KEEP_CASE].every((k) => !k.startsWith("brand."))).toBe(true);
  });
});

describe("offerValueUpper — teknik ve ticari değerler tr-TR ile büyür", () => {
  it("Türkçe 'i' noktasını korur", () => {
    expect(offerValueUpper("val.gearboxMounting", "Delik Milli")).toBe("DELİK MİLLİ");
    expect(offerValueUpper("val.controlType", "İnvertör Kontrollü")).toBe("İNVERTÖR KONTROLLÜ");
    expect(offerValueUpper("val.craneType", "Çift Kirişli Gezer Köprülü Vinç")).toBe(
      "ÇİFT KİRİŞLİ GEZER KÖPRÜLÜ VİNÇ"
    );
    expect(offerValueUpper("term.validity", "14 iş günü")).toBe("14 İŞ GÜNÜ");
    expect(offerValueUpper("val.priceUnit", "Kişi")).toBe("KİŞİ");
  });

  it("'ı' büyüğü noktasız 'I'dır", () => {
    expect(offerValueUpper("val.travelSystem", "16 Teker, 8 Boji, 4 Ekolayzır")).toBe(
      "16 TEKER, 8 BOJİ, 4 EKOLAYZIR"
    );
  });

  it("zaten büyük olan madde ve kod değişmez", () => {
    expect(offerValueUpper("val.steelGrade", "S355JR")).toBe("S355JR");
    // "St52" DEĞİŞMEZ: rakam taşıyan sözcük bir ÖLÇÜ/KOD'dur ve standardın
    // kendi yazımıdır (DIN "St 52-3"). Büyütme sözcük sözcük çalışır ve
    // rakamlıya dokunmaz — aynı kural "6x36", "N/mm2", "Q x 1,1" için de
    // geçerli (bkz. `offers/buyuk.ts`).
    expect(offerValueUpper("val.steelGrade", "St52")).toBe("St52");
    expect(offerValueUpper("val.reeving", "4/1")).toBe("4/1");
  });

  it("SERİ listesi marka değildir: 'VR Tipi' → 'VR TİPİ'", () => {
    // `kimlikBuyuk` kullanılsaydı "VR TIPI" olurdu; defterdeki yirmi iki
    // seriden altısı Türkçe sözcük taşıyor.
    expect(offerValueUpper("series.gearbox", "VR Tipi")).toBe("VR TİPİ");
    expect(offerValueUpper("series.gearbox", "HT Sandık Tipi")).toBe("HT SANDIK TİPİ");
    expect(offerValueUpper("series.pendant", "EN-MİD Serisi")).toBe("EN-MİD SERİSİ");
    expect(offerValueUpper("series.drive", "ATV-320")).toBe("ATV-320");
  });
});

describe("offerValueUpper — MARKA kimlik olarak büyür", () => {
  it("yabancı marka Türkçe kuralıyla BOZULMAZ", () => {
    expect(offerValueUpper("brand.busbar", "Conductix-Wampfler")).toBe("CONDUCTIX-WAMPFLER");
    expect(offerValueUpper("brand.switchgear", "Schneider")).toBe("SCHNEIDER");
    expect(offerValueUpper("brand.powerSupply", "Phoenix")).toBe("PHOENIX");
    // Defterde brand.drive altında ZATEN "SCHNEIDER" var; tr-TR ile büyütmek
    // aynı markayı iki yazıma bölerdi.
    expect(offerValueUpper("brand.switchgear", "Siemens")).toBe(
      offerValueUpper("brand.motor", "SIEMENS")
    );
  });

  it("Türkçe harfli marka tr-TR ile büyür", () => {
    expect(offerValueUpper("brand.cable", "Üntel")).toBe("ÜNTEL");
    expect(offerValueUpper("brand.gearbox", "Yılmaz R.")).toBe("YILMAZ R.");
    expect(offerValueUpper("brand.panel", "Öntel")).toBe("ÖNTEL");
  });

  it("KABUL EDİLEN SINIR: ASCII yazılmış Türkçe marka noktasız büyür", () => {
    // "Dereli" içinde Türkçe'ye özgü harf yok, bu yüzden yerelsiz büyür ve
    // "DERELI" olur — defterde madde "DERELİ" olarak duruyor ve kullanıcı
    // noktalı yazdığında (aşağıdaki sav) kip Türkçeye döner, yani düzeltme
    // kalıcıdır. Ayrımı markanın ülkesinden okumak, her marka için ayrı bir
    // liste tutmak demekti.
    expect(offerValueUpper("brand.brake", "Dereli")).toBe("DERELI");
    expect(offerValueUpper("brand.brake", "DERELİ")).toBe("DERELİ");
  });
});

describe("offerValueUpper — ikinci koşu bir şey değiştirmez", () => {
  const ornekler: [string, string][] = [
    ["brand.busbar", "Conductix-Wampfler"],
    ["series.gearbox", "VR Tipi"],
    ["val.craneType", "Çift Kirişli Gezer Köprülü Vinç"],
    ["term.exclusion", "Vinç barası"],
    ["val.craneClass", "FEM 3m / ISO M6"],
  ];

  it("sabit noktadır (ekranda onBlur, sunucuda action, göçte SQL — üçü üst üste gelir)", () => {
    for (const [listKey, deger] of ornekler) {
      const bir = offerValueUpper(listKey, deger);
      expect(offerValueUpper(listKey, bir)).toBe(bir);
    }
  });
});

// —————————————————————————————————————————————— SQL karşılığı ayrışmasın

describe("göç, TS'teki muaf kümeyle aynı listeyi yazıyor", () => {
  const migration = readFileSync(
    join(process.cwd(), "supabase/migrations/20260821000003_offer_options_buyuk_harf.sql"),
    "utf8"
  );

  it("`not in (...)` süzgeci muaf kümenin BİREBİR kendisidir", () => {
    const eslesme = /list_key not in \(([^)]*)\)/.exec(migration);
    expect(eslesme).not.toBeNull();
    const sqlKume = [...eslesme![1].matchAll(/'([^']+)'/g)].map((m) => m[1]).sort();
    expect(sqlKume).toEqual([...OFFER_LIST_KEEP_CASE].sort());
  });

  it("büyütme Türkçe farkındadır — çıplak `upper(value)` yazılmamıştır", () => {
    // Postgres'in `upper()`ı "iş"i "IS" yapar; göç önce i→İ / ı→I çevirir.
    expect(migration).toContain("upper(translate(t, 'iıçğöşü', 'İIÇĞÖŞÜ'))");
    expect(migration).not.toMatch(/set value = upper\(/);
    expect(migration).not.toMatch(/set crane_type = upper\(/);
  });

  it("marka dalı ayrıdır ve şablonun vinç tipi de büyür", () => {
    expect(migration).toContain("where o.list_key like 'brand.%'");
    // Şablonun vinç tipi de TEKNİK değer gibi büyür: "40x30" ve "12,5T" gibi
    // ölçüler taşıyabilir ve düz büyütme onları bozardı.
    expect(migration).toContain("set crane_type = public.gecici_teknik_buyuk(t.crane_type)");
  });

  it("ÖLÇÜ VE BİRİM SQL tarafında da korunur — TS ile aynı kural", () => {
    // İki taraf ayrışırsa göç, uygulamanın yazmayacağı bir yazım üretir.
    expect(migration).toContain("create or replace function public.gecici_teknik_buyuk");
    expect(migration).toContain("set value = public.gecici_teknik_buyuk(o.value)");
    for (const iz of ["'[0-9]'", "position('/' in parca)", "'x', '×'", "'kg','g','gr'", "'Hz','kHz'"]) {
      expect(migration).toContain(iz);
    }
  });

  it("geçici yardımcılar dosyanın sonunda düşürülür", () => {
    expect(migration).toContain("drop function public.gecici_tr_buyuk(text);");
    expect(migration).toContain("drop function public.gecici_kimlik_buyuk(text);");
  });
});
