// SATIN ALMA / ÜRETİM BÖLÜNMESİ — KORUMA TESTİ.
//
// `purchasing/data.ts` bu dosyaya bir süre ATIF YAPTI ama dosya yoktu
// (13.08.2026'da fark edildi). Atıf boşta durduğu için kural üç ayrı yerde
// üç farklı yazımla yaşıyordu ve hiçbiri diğerini kırmıyordu:
//
//   1. TypeScript  `isPurchaseRow`          → `!partCode?.trim()`
//   2. Veritabanı  `drawing_parts.register_key` → `btrim(part_code) <> ''`
//   3. Havuz sorgusu `purchasing/data.ts`    → `part_code.eq.` (TAM `''`)
//
// Üçüncüsü diğer ikisinden AYRIDIR: `part_code = '  '` olan bir satır TS'e
// göre satın almadır, sorguya göre değildir. Böyle bir satır bugün
// üretilmiyor (aşağıda ölçülüyor) ama üretilse ekranlardan HİÇBİRİNDE
// görünmezdi — md. 18'in "bir satır ya Satın Alma'da ya Üretim'de olur, ikisinde
// birden ya da hiçbirinde olamaz" kuralının sessizce çiğnenmesi.
//
// Test üç şeyi birden tutar: sorgu dizgisinin kendisi, iki kuralın GERÇEK
// fikstürlerde aynı kümeyi vermesi, ve bölünmenin ARTIKSIZ olması.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseBomFileName, parseFile } from "../../drawings/file-name";
import { parseFolderName } from "../../drawings/folder-name";
import { readSheet } from "../../drawings/excel";
import { reconcile, type PackageSnapshot } from "../../drawings/reconcile";
import { isPurchaseRow } from "../../drawings/progress";
import { MONORAY, MTC, type FixturePackage } from "../../drawings/__tests__/fixtures/packages";
import {
  MONORAY_SHEETS,
  MTC_SHEETS,
  type FixtureSheet,
} from "../../drawings/__tests__/fixtures/bom-sheets";

function anlikGoruntu(pkg: FixturePackage, sheets: FixtureSheet[]): PackageSnapshot {
  const files = pkg.files.map((f) => parseFile({ relPath: f.path, size: f.size, checksum: f.hash }));
  const bom = sheets
    .filter((s) => !s.file.split("/").some((seg) => seg === "İPTAL"))
    .flatMap(
      (s) =>
        readSheet(
          { fileRelPath: s.file, sheetName: s.sheet, rows: s.rows },
          parseBomFileName(s.file.split("/").pop() ?? "").kind
        ).rows
    );
  return { folderName: pkg.folder, folder: parseFolderName(pkg.folder).value, files, bom };
}

const monoray = reconcile(anlikGoruntu(MONORAY, MONORAY_SHEETS));
const mtc = reconcile(anlikGoruntu(MTC, MTC_SHEETS));

/** `part_code.eq.` ile `kind.eq.satinalma`nın SQL anlamı — birebir. */
function sqlKurali(p: { kind: string; partCode: string }): boolean {
  return p.kind === "satinalma" || p.partCode === "";
}

const HAVUZ_SORGUSU = join(process.cwd(), "src/app/(app)/purchasing/data.ts");

describe("havuz sorgusu ile isPurchaseRow AYRIŞAMAZ", () => {
  it("sorgudaki `.or(...)` dizgisi beklenen iki dalı taşır", () => {
    const kaynak = readFileSync(HAVUZ_SORGUSU, "utf8");
    const es = kaynak.match(/\.or\(\s*"([^"]+)"\s*\)/);
    expect(es, "purchasing/data.ts içinde bir .or(\"…\") bekleniyordu").not.toBeNull();
    // Dizgi DEĞİŞİRSE bu test kırılır ve değiştiren kişi `isPurchaseRow`u da
    // güncellemek zorunda kalır. Sessiz ayrışmanın tek panzehiri budur.
    expect(es![1]).toBe("kind.eq.satinalma,part_code.eq.");
  });

  it("iki gerçek pakette İKİ KURAL AYNI KÜMEYİ verir", () => {
    for (const [ad, r] of [
      ["MONORAY", monoray],
      ["MTC", mtc],
    ] as const) {
      const ts = r.parts.filter((p) => isPurchaseRow({ kind: p.kind, partCode: p.partCode }));
      const sql = r.parts.filter((p) => sqlKurali(p));
      expect(ts.length, `${ad}: TS kuralı`).toBe(sql.length);
      expect(new Set(ts.map((p) => p.registerKey))).toEqual(
        new Set(sql.map((p) => p.registerKey))
      );
    }
  });

  it("AYRIŞMANIN TEK YOLU kapalı: boşluktan ibaret parça kodu üretilmez", () => {
    // İki kural yalnız `part_code` boşluk taşıdığında ayrılır. `bomBirlestir`
    // kodsuz satırı `!partNumber.trim()` ile seçtiği için böyle bir değer
    // doğamaz — ama bu bir DAVRANIŞ, bir tip garantisi değil; ölçülür.
    for (const r of [monoray, mtc]) {
      for (const p of r.parts) {
        expect(p.partCode === "" || p.partCode.trim() !== "").toBe(true);
      }
    }
  });
});

describe("bölünme ARTIKSIZDIR", () => {
  it("her parça ya Satın Alma'da ya Üretim'de — ikisinde birden değil", () => {
    for (const [ad, r] of [
      ["MONORAY", monoray],
      ["MTC", mtc],
    ] as const) {
      const satinAlma = r.parts.filter((p) =>
        isPurchaseRow({ kind: p.kind, partCode: p.partCode })
      );
      const uretim = r.parts.filter(
        (p) => !isPurchaseRow({ kind: p.kind, partCode: p.partCode })
      );
      expect(satinAlma.length + uretim.length, `${ad}: toplam`).toBe(r.parts.length);
      const kesisim = new Set(satinAlma.map((p) => p.registerKey));
      for (const p of uretim) expect(kesisim.has(p.registerKey), `${ad}: ${p.registerKey}`).toBe(false);
    }
  });
});

describe("KODSUZ SATIRIN KAZANAN SAYFASI GRUP BAŞINADIR", () => {
  // Kural bir süre PAKET BAŞINA tek sayfa seçiyordu ve başka grupların satın
  // alma listesi bütünüyle düşüyordu (ölçüldü 13.08.2026: MTC'de altı satır,
  // `0043-00-0050` ve `0043-00-0850`). Ressam grup grup Excel verdiğinde —
  // firmanın numaralandırması tam olarak bunu teşvik ediyor — paketin satın
  // alma listesi tek bir gruba iniyordu.
  /** Kodsuz parçaların KAYNAK DOSYASINA göre sayımı — iddia budur. */
  function kodsuzKaynakSayisi(dosyaParcasi: string): number {
    return mtc.parts.filter(
      (p) => !p.partCode && (p.bomRef?.file ?? "").includes(dosyaParcasi)
    ).length;
  }

  it("MTC'de her iki küçük grubun kodsuz satırları da deftere girer", () => {
    // İDDİA TANIM METNİNE DEĞİL KAYNAK DOSYAYA dayanır. Tanım metni bir
    // sözlük kuralıyla (ör. galvaniz eki) değişebilir ve test o zaman
    // kuralı değil KENDİ varsayımını sınamış olurdu; "şu Excel'in satırları
    // deftere girdi mi" sorusu ise kuralın tam olarak sorduğu sorudur.
    expect(kodsuzKaynakSayisi("1.0043-00-0050_DEPO"), "0043-00-0050 DEPO").toBe(3);
    expect(kodsuzKaynakSayisi("0043-00-0850"), "0043-00-0850 (tek sayfa)").toBe(3);
  });

  it("AYNI GRUBUN iki sayfası hâlâ İKİ KEZ SAYILMAZ", () => {
    // `0043-00-0850`in DEPO'su ile ÜRÜN AĞACI'nın ikisi de aynı ÜÇ satırı
    // taşıyor. Grup başına tek sayfa alındığı için toplam altı değil ÜÇtür;
    // kuralın gevşetilmediğinin kanıtı budur.
    expect(kodsuzKaynakSayisi("1.0043-00-0850_DEPO")).toBe(0);
    expect(kodsuzKaynakSayisi("1.0043-00-0850_URUN AGACI")).toBe(3);
  });

  it("FİRMA KABULLERİ DEFTERE YAZILMIŞTIR — ekranda hesaplanmaz", () => {
    // `firmaKabulleri` (13.08.2026) `reconcile` içinde çalışır; üç ekran da
    // aynı satırı okuduğu için burada ölçülmesi üçünü birden korur.
    const kodsuz = mtc.parts.filter((p) => !p.partCode);
    const civataSomun = kodsuz.filter((p) =>
      /^(?:İMBUS\s+)?CİVATA\b|^SOMUN\b/.test(p.description.toUpperCase())
    );
    expect(civataSomun.length).toBeGreaterThan(20);
    for (const p of civataSomun) {
      expect(p.description.toUpperCase(), p.description).toContain("GALVAN");
      expect(p.material, p.description).not.toBe("");
    }
    const yayli = kodsuz.filter((p) => /^YAYLI\s+RONDELA\b/.test(p.description.toUpperCase()));
    expect(yayli.length).toBeGreaterThan(10);
    for (const p of yayli) expect(p.material).toBe("YAY ÇELİĞİ");
  });

  it("KODSUZ SATIRIN GRUBU ÜRÜN AĞACINDAN ÇÖZÜLÜR — ürün ağacı yoksa çözülmez", () => {
    // Kullanıcı şartı: *"Eğer ürün ağacı yoksa yine sistem kilitlenmesin,
    // DEPO exceline göre devam etsin."* MONORAY'da ürün ağacı HİÇ YOK ve
    // paket sorunsuz kuruluyor; MTC'de var ve satırların ezici çoğunluğu
    // grubuna bağlanıyor.
    const mtcKodsuz = mtc.parts.filter((p) => !p.partCode);
    const bagli = mtcKodsuz.filter((p) => p.parentCode);
    expect(bagli.length / mtcKodsuz.length).toBeGreaterThan(0.9);

    const monKodsuz = monoray.parts.filter((p) => !p.partCode);
    expect(monKodsuz.length).toBeGreaterThan(40); // paket YİNE kuruldu
    expect(monKodsuz.every((p) => !p.itemPath)).toBe(true); // ağaç gerçekten yok
  });
});
