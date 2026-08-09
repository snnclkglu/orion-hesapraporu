// Katalog sayfası defteri — KORUMA testleri.
//
// Defter (`manifest.json`) `scripts/catalog-sheets.py` ile üretilir; bu testler
// defterin DİSKTEKİ dosyalarla ve katalog verisiyle tutarlı kaldığını
// doğrular. Betik koşulmadan bir seri eklenirse ya da bir dosya silinirse
// pop-up sessizce boş açılır — bu testler o sessizliği kırar.

import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  allCatalogSheets,
  catalogSheetFiles,
  catalogSheetPageUrl,
  catalogSheetUrl,
  findCatalogSheet,
  hasCatalogSheets,
} from "../catalog-sheets";

const SHEET_DIR = path.join(process.cwd(), "catalog-sheets");

describe("katalog sayfası defteri", () => {
  const sheets = allCatalogSheets();

  it("tüm ekipman türleri defterde temsil ediliyor", () => {
    expect(sheets.length).toBeGreaterThan(200);
    const kinds = new Set(sheets.map((s) => s.kind));
    for (const kind of [
      "coupling", "bearing", "bearing_housing", "brake", "buffer", "gearbox", "motor",
    ]) {
      expect(kinds.has(kind), `${kind} türünde sayfa yok`).toBe(true);
    }
    expect(sheets.some((s) => s.kind === "brake" && s.brand === "SIBRE"),
      "SIBRE fren sayfası yok").toBe(true);
    for (const brand of ["OZGUN", "SIBRE", "JAURE", "SKF", "ABB", "GAMAK"]) {
      expect(sheets.some((s) => s.brand === brand), `${brand} yok`).toBe(true);
    }
  });

  it("defterdeki her dosya diskte var ve boş değil", () => {
    const missing: string[] = [];
    for (const relative of catalogSheetFiles()) {
      const file = path.join(SHEET_DIR, relative);
      if (!existsSync(file) || statSync(file).size === 0) missing.push(relative);
    }
    expect(
      missing,
      `Eksik/boş sayfa dosyası: ${missing.join(", ")}\n` +
        "YAPILACAK: `python scripts/catalog-sheets.py` çalıştırın."
    ).toEqual([]);
  });

  it("her kaydın en az bir sayfa görüntüsü ve bir modeli var", () => {
    for (const sheet of sheets) {
      expect(sheet.images.length, sheet.id).toBeGreaterThan(0);
      expect(sheet.models.length, sheet.id).toBeGreaterThan(0);
      expect(sheet.images.every((i) => i.endsWith(".webp")), sheet.id).toBe(true);
    }
  });

  it("uç adresi defterdeki yolu birebir taşır", () => {
    const first = sheets[0].images[0];
    expect(catalogSheetUrl(first)).toBe(`/api/catalog-sheet/${first}`);
    // Uç, yolu segmentlerden yeniden kurar; ayrıştırma defterle örtüşmeli.
    const rebuilt = catalogSheetUrl(first)
      .replace("/api/catalog-sheet/", "")
      .split("/")
      .join("/");
    expect(catalogSheetFiles().has(rebuilt)).toBe(true);
  });
});

describe("model → sayfa eşlemesi", () => {
  it("katalogdan seçilen yazımla bulur (veri tabanı yazımı)", () => {
    expect(findCatalogSheet("coupling", "OZGUN", "J7")?.series).toBe("J");
    expect(findCatalogSheet("coupling", "SIBRE", "ABC-V 450")?.series).toBe("ABC-V");
    expect(findCatalogSheet("coupling", "JAURE", "MTG-HD 370")?.series).toBe("MTG-HD");
  });

  it("Türkçe yazımlı marka da bulur (aksan eşlemeyi bozmaz)", () => {
    // Yeni-iş şablonu markayı "ÖZGÜN" olarak yazar; katalog "OZGUN" tutar.
    expect(findCatalogSheet("coupling", "ÖZGÜN", "J7")?.series).toBe("J");
    expect(findCatalogSheet("coupling", "Özgün Makina", "A5")?.series).toBe("A");
  });

  it("marka serbest metin olsa da model tekse bulur", () => {
    // Eski revizyonlarda marka alanı "SİBRE PİN KAPLİN" gibi yazılmıştır.
    expect(findCatalogSheet("coupling", "SİBRE PİN KAPLİN", "APC-A 160")?.series)
      .toBe("APC-A");
  });

  it("model tam eşleşmiyorsa sayfa AÇILMAZ (yakın sayfa gösterilmez)", () => {
    // Katalogdaki kod "APC-A 160"; basılı tip kodu "APC160A" ile yazılmışsa
    // hangi sayfa olduğu kesin değildir — tahmin edilmez.
    expect(findCatalogSheet("coupling", "SIBRE", "APC160A")).toBeUndefined();
    expect(findCatalogSheet("coupling", "OZGUN", "J99")).toBeUndefined();
    expect(findCatalogSheet("coupling", "OZGUN", "")).toBeUndefined();
    expect(findCatalogSheet("coupling", "OZGUN", undefined)).toBeUndefined();
  });

  it("aynı model kodu iki markada geçiyorsa markasız arama sonuç vermez", () => {
    // Defterde çakışma varsa markasız aramanın SESSİZCE bir marka seçmediğini
    // doğrular; çakışma yoksa test yine geçerlidir (kural her hâlde korunur).
    const byModel = new Map<string, Set<string>>();
    for (const sheet of allCatalogSheets()) {
      for (const model of sheet.models) {
        const key = `${sheet.kind}|${model.toUpperCase()}`;
        (byModel.get(key) ?? byModel.set(key, new Set()).get(key)!).add(sheet.brand);
      }
    }
    for (const [key, brands] of byModel) {
      if (brands.size < 2) continue;
      const model = key.split("|")[1];
      expect(findCatalogSheet("coupling", null, model), `${model} çakışması`)
        .toBeUndefined();
    }
  });

  it("diğer türlerin ürünleri de sayfa bulur", () => {
    expect(findCatalogSheet("bearing", "SKF", "22320 E")?.kind).toBe("bearing");
    expect(findCatalogSheet("bearing_housing", "SKF", "SNL 205")?.kind).toBe("bearing_housing");
    expect(findCatalogSheet("motor", "GAMAK", "AGM2E 80 M 2a")?.kind).toBe("motor");
    expect(findCatalogSheet("gearbox", "Yılmaz Redüktör", "DT072")?.kind).toBe("gearbox");
  });

  it("rulman tasarım soneki eşlemeyi bozmaz (22212 ↔ 22212 E)", () => {
    // Mühendis çoğu zaman temel kodu girer; katalog kodu sonekle basar.
    const withSuffix = findCatalogSheet("bearing", "SKF", "22212 E");
    const withoutSuffix = findCatalogSheet("bearing", "SKF", "22212");
    expect(withSuffix, "22212 E defterde yok").toBeDefined();
    expect(withoutSuffix?.id).toBe(withSuffix?.id);
    // 2.2.6 tambur rulmanı bölümünün eşlemesinde MARKA alanı yoktur:
    // marka bilinmeden de bulunmalıdır.
    expect(findCatalogSheet("bearing", null, "22212")?.id).toBe(withSuffix?.id);
  });

  it("model alanına yazılmış marka öneki eşlemeyi bozmaz", () => {
    // Eski/şablon kayıtlarda model alanı "SIBRE TE 250 Ed 50/6" gibi markayı
    // da taşıyabilir; katalogdaki kod yalnız "TE 250 Ed 50/6"dır.
    const plain = findCatalogSheet("brake", "SIBRE", "TE 250 Ed 23/5");
    expect(plain, "TE 250 Ed 23/5 defterde yok").toBeDefined();
    expect(findCatalogSheet("brake", "SİBRE", "SIBRE TE250 Ed 23/5")?.id).toBe(plain?.id);
  });

  /**
   * KORUMA: bölümün seçim alanlarından katalog KİMLİĞİNİ çıkarma yolu.
   *
   * Redüktör (2.3 / 5.5), yürütme freni (5.5b) ve tampon (5.8) eşlemelerinde
   * ürünün kimliğini tek bir "MARKA MODEL" alanı taşır; motorda ise ayrı bir
   * model alanı vardı ki YOKTU. Bu üç yol bozulduğunda hiçbir derleme/test
   * hatası çıkmaz — düğme sessizce pasif kalır. Aşağıdaki durumlar o sessizliği
   * kırar; değerler editörün gerçekten yazdığı biçimdedir.
   */
  it("bölümlerin seçim alanından gelen kimlikle sayfa bulunur", () => {
    const cases: [kind: string, brand: string | undefined, model: string][] = [
      // gearboxModel = "MARKA MODEL" (from: "brand_model")
      ["gearbox", undefined, "Yılmaz Redüktör DT072"],
      ["gearbox", undefined, "FLENDER H3-14"],
      // motorBrand + motorModel (from: "brand" + "model")
      ["motor", "GAMAK", "AGM2E 80 M 2a"],
      ["motor", "INNOMATICS", "1LE1603-1CB2"],
      // 5.5b brakeBrand = "MARKA MODEL"
      ["brake", undefined, "SIBRE TE 160 Ed 23/5"],
      // 5.8 bufferModel = "MARKA MODEL"
      ["buffer", undefined, "Conductix-Wampfler 017110-040x032N"],
      ["buffer", undefined, "SIBRE SP 65 FF 100"],
      // 5.9 festoonBrand + festoonTrolleyCode (from: "model") — festonda
      // ürün kimliği KABLO ARABASININ sipariş kodudur, seri kodu değil.
      ["festoon", "Vasel", "VS2020A-4WU"],
      ["festoon", "Vasel", "VS2005A-CT80"],
      ["festoon", "Conductix-Wampfler", "032252-250x160"],
      ["festoon", "Conductix-Wampfler", "022134-350"],
      // 2.1 ropeBrand + ... — HALATTA MODEL KODU YOKTUR: seed onu ölçüden
      // kurar ("Ø14 Eurolift IWRC 1960 MPa") ve defter AYNI dizgiyi üretmek
      // zorundadır. İki kural birbirinden habersiz iki dosyada (seed-catalog.ts
      // ve catalog-sheets.py `db_model`) yaşadığı için bağ sessizce kopar.
      ["rope", "CASAR", "Ø14 Eurolift IWRC 1960 MPa"],
      // Mukavemet sınıfı BASILI OLMAYAN ürün: model dizgisinde "… MPa" yoktur.
      ["rope", "CASAR", "Ø16 Starlift Xtra IWRC"],
      ["rope", "DIEPA", "Ø20 8 demetli plastik dolgulu (H 43) IWRC-PI 1960 MPa"],
      ["rope", "Haşçelik", "Ø12 8xK26/K31/K36 WS (H 8K PI) IWRC-PI 2160 MPa"],
    ];
    for (const [kind, brand, model] of cases) {
      expect(
        findCatalogSheet(kind, brand, model),
        `${kind} / ${brand ?? "-"} / ${model} için katalog sayfası bulunamadı`
      ).toBeDefined();
    }
  });

  it("kaynak katalogda ölçü sayfası olmayan ürüne sayfa yazılmaz", () => {
    // FLENDER ölçü bölümü H2'de boy 4'ten başlar; H2-03 tip/boy matrisinde
    // vardır ama ölçü sayfası YOKTUR. Yakın bir sayfa göstermek yanlış ölçü
    // tablosuna baktırırdı.
    expect(findCatalogSheet("gearbox", undefined, "FLENDER H2-03")).toBeUndefined();
    // Vasel broşürü 2050/2060/2070 ve VS25/VS26 ailelerini YALNIZ fotoğraf ve
    // "Katg. No" referansıyla verir — parça kodu ve ölçü tablosu tam katalogda
    // (Cat.4b/52 s.27-41) olduğu için o ailelere sayfa yazılmaz.
    expect(findCatalogSheet("festoon", "Vasel", "VS2050")).toBeUndefined();
    expect(findCatalogSheet("festoon", "Vasel", "VS26-S3")).toBeUndefined();
  });

  it("henüz kapsanmayan tür için düğme hiç gösterilmez", () => {
    expect(hasCatalogSheets("coupling")).toBe(true);
    expect(hasCatalogSheets("gearbox")).toBe(true);
    // Halat kataloglarının kaynak PDF'i 2026-08-09'da workspace'e girdi
    // (CASAR · Haşçelik · OLIVEIRA · DIEPA); kanca, makara ve tekerinki hâlâ yok.
    expect(hasCatalogSheets("rope")).toBe(true);
    expect(hasCatalogSheets("hook")).toBe(false);
    expect(hasCatalogSheets("sheave")).toBe(false);
    expect(hasCatalogSheets("wheel")).toBe(false);
    // Feston: iki markanın da kaynak kataloğu workspace'tedir — Vasel
    // Cat.4b/52 broşürü ve Conductix KAT0320-0003b-EN ürün kataloğu.
    // (Workspace'teki FB0300-0005-E ise bir SORU FORMUDUR ve deftere girmez.)
    expect(hasCatalogSheets("festoon", "Vasel")).toBe(true);
    expect(hasCatalogSheets("festoon", "Conductix-Wampfler")).toBe(true);
    expect(hasCatalogSheets("coupling", "OZGUN")).toBe(true);
    expect(hasCatalogSheets("coupling", "ÖZGÜN")).toBe(true);
    expect(hasCatalogSheets("coupling", "BİLİNMEYEN")).toBe(false);
  });
});

// ---------------------------------------------------------------------------

describe("katalog sayfası adresi (ekipman listesi bağlantıları)", () => {
  it("adres ürün kimliğini taşır ve aynı sayfaya geri çözülür", () => {
    // Uygulama, Excel ve PDF aynı adresi üretir; `/katalog` sayfası onu
    // `findCatalogSheet` ile geri çözer. Bu tur kapanmazsa bağlantı sessizce
    // "sayfa bulunamadı"ya düşer.
    const kimlikler: [string, string | null, string][] = [
      ["coupling", "OZGUN", "B3-3"],
      ["bearing", null, "22212"],
      ["gearbox", "FLENDER", "B3SH 13"],
    ];
    for (const [kind, brand, model] of kimlikler) {
      const beklenen = findCatalogSheet(kind, brand, model);
      if (!beklenen) continue; // katalog verisi değişmiş olabilir; ayrı test kapsar
      const url = new URL(catalogSheetPageUrl(kind, brand, model, "https://ornek"));
      const sp = url.searchParams;
      expect(url.pathname).toBe("/katalog");
      const cozulen = findCatalogSheet(sp.get("tur")!, sp.get("marka"), sp.get("model")!);
      expect(cozulen?.id, `${kind} ${model} adresten geri çözülemedi`).toBe(beklenen.id);
    }
  });

  it("kök verilmezse göreli, verilirse mutlak adres üretir", () => {
    expect(catalogSheetPageUrl("coupling", "OZGUN", "B3-3")).toMatch(/^\/katalog\?/);
    expect(catalogSheetPageUrl("coupling", "OZGUN", "B3-3", "https://a.b")).toMatch(
      /^https:\/\/a\.b\/katalog\?/
    );
  });

  it("marka alanı yoksa (\"-\") adrese yazılmaz", () => {
    const url = new URL(catalogSheetPageUrl("gearbox", "-", "B3SH 13", "https://ornek"));
    expect(url.searchParams.has("marka")).toBe(false);
  });
});

describe("markası olmayan satır — \"-\" gerçek marka sayılmaz", () => {
  // Ekipman listesi markasız satırlara MARKA sütununda "-" yazar. Bu metin
  // marka sanıldığı sürece kimliği tek birleşik "MARKA MODEL" alanında duran
  // bölümlerin (redüktör 2.3/5.5, tampon 5.8, yürütme freni 5.5b) HİÇBİRİ
  // katalog sayfası bulamıyordu: `<tür>|-|<model>` anahtarı tutmuyor, marka
  // önekini modelden ayıklayan yol ise `brand` dolu göründüğü için hiç
  // çalışmıyordu.
  it("birleşik \"MARKA MODEL\" alanı \"-\" markayla da çözülür", () => {
    for (const model of [
      "Yılmaz Redüktör HT0823",
      "FLENDER B2-04",
      "SEW-EURODRIVE X3160e/HC",
    ]) {
      expect(findCatalogSheet("gearbox", "-", model), `${model} bulunamadı`).toBeDefined();
      // Marka hiç verilmediğinde de aynı sayfa bulunmalı.
      expect(findCatalogSheet("gearbox", null, model)?.id).toBe(
        findCatalogSheet("gearbox", "-", model)?.id
      );
    }
  });

  it("tampon (5.8) katalog sayfası bulur — satırın markası yoktur", () => {
    expect(findCatalogSheet("buffer", "-", "SIBRE SP 65 FF 200")).toBeDefined();
    expect(findCatalogSheet("buffer", "-", "Conductix-Wampfler 017111-100N")).toBeDefined();
  });

  it("yürütme freninin kimliği MARKA sütunundadır ve o metinle bulunur", () => {
    // 5.5b eşlemesinde ürün kimliğini yalnız `brakeBrand` taşır; ekipman satırı
    // onu `catalogModel` olarak verir (model sütunu "-"dir).
    expect(findCatalogSheet("brake", null, "SIBRE TE 250 Ed 30/5")).toBeDefined();
  });

  it("boş marka ve em-dash da marka sayılmaz", () => {
    const beklenen = findCatalogSheet("gearbox", null, "FLENDER B2-04")?.id;
    expect(findCatalogSheet("gearbox", "", "FLENDER B2-04")?.id).toBe(beklenen);
    expect(findCatalogSheet("gearbox", "—", "FLENDER B2-04")?.id).toBe(beklenen);
    expect(findCatalogSheet("gearbox", "  ", "FLENDER B2-04")?.id).toBe(beklenen);
  });

  it("gerçek marka hâlâ süzgeç görevi görür — yanlış markanın sayfası açılmaz", () => {
    expect(findCatalogSheet("gearbox", "FLENDER", "FLENDER B2-04")).toBeDefined();
    expect(findCatalogSheet("gearbox", "SEW-EURODRIVE", "FLENDER B2-04")).toBeUndefined();
  });
});
