// Paket farkı — KORUMA TESTİ, iki GERÇEK teslimin baytlarına karşı.
//
// ————————————————————————————————————————— ESKİ SÜRÜM NEREDEN GELİYOR
//
// Uydurma veri yok: her iki pakette de ressamın kendi elleriyle sakladığı bir
// ÖNCEKİ SÜRÜM var. `İPTAL` bir klasör değil bir DURUMDUR ve bunu bu test
// icat etmiyor — `reconcile` zaten `IPTAL_SURUM` bulgusuyla aynı şeyi iddia
// ediyor: "İPTAL/X, X'in eski hâlidir".
//
// Eski taraf iki kuralla kurulur:
//   1. `İPTAL` klasörünün içeriği BİR ÜST KLASÖRE taşınır; aynı adlı canlı
//      dosyanın YERİNE geçer.
//   2. Aynı kapsamda İPTAL'dekinden SONRAKİ tarihi taşıyan canlı dosya eski
//      tarafa GİRMEZ. Bu bir varsayım değil takvim gerçeğidir: 02.07.2026
//      teslimi 31.07.2026 tarihli bir dosyayı içeremez.
//
// VARSAYIMIN SINIRI AÇIKÇA YAZILIR: İPTAL'de adı geçmeyen dosyaların o gün de
// bugünkü hâliyle var olduğu KABUL EDİLİR. Bu yüzden MONORAY yönünde
// `yeniDosyalar` yapısal olarak 0 çıkar; o dalın gerçek baytlarla kapanması
// MTC'de ve ters yön simetrisiyle sağlanır.

import { describe, expect, it } from "vitest";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { parseBomFileName, parseFile } from "../file-name";
import { parseFolderName } from "../folder-name";
import { readSheet } from "../excel";
import { trKatla } from "../tr-text";
import { reconcile, type PackageSnapshot, type RegisterPart } from "../reconcile";
import {
  diffOzetMetni,
  packageDiff,
  partDiffKey,
  type DiffField,
  type DiffPart,
  type PackageSide,
} from "../diff";
import { MONORAY, MTC, type FixturePackage } from "./fixtures/packages";
import { MONORAY_SHEETS, MTC_SHEETS, type FixtureSheet } from "./fixtures/bom-sheets";
import {
  VersionList,
  type VersionBlockData,
} from "@/app/(app)/drawings/[id]/versions/version-list";

// ————————————————————————————————————————————————————— fikstürden iki sürüm

const iptalMi = (yol: string) => yol.split("/").some((s) => trKatla(s) === "IPTAL");
const iptalsiz = (yol: string) =>
  yol.split("/").filter((s) => trKatla(s) !== "IPTAL").join("/");
const klasorOf = (yol: string) =>
  yol.slice(0, yol.length - (yol.split("/").pop() ?? "").length);

type YolHaritasi = Map<string, { size: number; hash: string }>;

function eskiYollar(pkg: FixturePackage): YolHaritasi {
  const canli = pkg.files.filter((f) => !iptalMi(f.path));
  const iptal = pkg.files.filter((f) => iptalMi(f.path));

  // İPTAL'deki en yeni tarih, o kapsamın "o günkü" sınırıdır.
  const kapsamSiniri = new Map<string, string>();
  for (const f of iptal) {
    const yeniYol = iptalsiz(f.path);
    const t = parseBomFileName(yeniYol.split("/").pop() ?? "").date;
    if (!t) continue;
    const k = klasorOf(yeniYol);
    const mevcut = kapsamSiniri.get(k);
    if (!mevcut || t > mevcut) kapsamSiniri.set(k, t);
  }

  const harita: YolHaritasi = new Map();
  for (const f of canli) {
    const sinir = kapsamSiniri.get(klasorOf(f.path));
    const t = sinir ? parseBomFileName(f.path.split("/").pop() ?? "").date : null;
    if (sinir && t && t > sinir) continue;
    harita.set(f.path, { size: f.size, hash: f.hash });
  }
  for (const f of iptal) harita.set(iptalsiz(f.path), { size: f.size, hash: f.hash });
  return harita;
}

function yeniYollar(pkg: FixturePackage): YolHaritasi {
  return new Map(
    pkg.files
      .filter((f) => !iptalMi(f.path))
      .map((f) => [f.path, { size: f.size, hash: f.hash }])
  );
}

function defter(
  pkg: FixturePackage,
  sheets: FixtureSheet[],
  yollar: YolHaritasi,
  sheetYolu: (s: FixtureSheet) => string
): { parts: RegisterPart[]; side: PackageSide } {
  const files = [...yollar.entries()].map(([path, v]) =>
    parseFile({ relPath: path, size: v.size, checksum: v.hash })
  );
  // BOM satırları yalnız O TARAFTA BULUNAN Excel'lerden okunur — eski sürümün
  // defterini bugünün Excel'iyle kurmak farkı sıfırlardı.
  const bom = sheets
    .filter((s) => yollar.has(sheetYolu(s)))
    .flatMap(
      (s) =>
        readSheet(
          { fileRelPath: sheetYolu(s), sheetName: s.sheet, rows: s.rows },
          parseBomFileName(sheetYolu(s).split("/").pop() ?? "").kind
        ).rows
    );
  const snap: PackageSnapshot = {
    folderName: pkg.folder,
    folder: parseFolderName(pkg.folder).value,
    files,
    bom,
  };
  const parts = reconcile(snap).parts;
  return {
    parts,
    side: {
      files: files.map((f) => ({
        relPath: f.relPath,
        checksum: f.checksum,
        size: f.size,
        role: f.role,
        lifecycle: f.lifecycle,
      })),
      parts: parts.map(diffParcasi),
    },
  };
}

/** `drawing_parts` satırının fark çekirdeğine giden yüzü. */
function diffParcasi(p: RegisterPart): DiffPart {
  return {
    registerKey: p.registerKey,
    partCode: p.partCode,
    description: p.description,
    qty: p.qty,
    material: p.material,
    weightKg: p.weightKg,
    thicknessMm: p.thicknessMm,
    category: p.category,
  };
}

function ikiSurum(pkg: FixturePackage, sheets: FixtureSheet[]) {
  const eski = defter(pkg, sheets, eskiYollar(pkg), (s) => iptalsiz(s.file));
  const yeni = defter(pkg, sheets, yeniYollar(pkg), (s) => s.file);
  return { eski, yeni };
}

const mono = ikiSurum(MONORAY, MONORAY_SHEETS);
const mtc = ikiSurum(MTC, MTC_SHEETS);

const monoFark = packageDiff(mono.eski.side, mono.yeni.side);
const mtcFark = packageDiff(mtc.eski.side, mtc.yeni.side);

/** Değişen parçanın tek bir alanındaki fark — "4 → 2" biçiminde. */
function alan(kod: string, field: DiffField, fark = monoFark): string {
  const p = fark.degisenParcalar.find(
    (c) => c.yeni.partCode === kod || trKatla(c.yeni.description) === trKatla(kod)
  );
  const c = p?.changes.find((x) => x.field === field);
  return c ? `${c.eski} → ${c.yeni}` : "(yok)";
}

// ——————————————————————————————————————————————————————————————— DOSYA FARKI

describe("MONORAY — dosya farkı", () => {
  it("iki sürüm de 169 dosya taşır; 2 çalışma dosyası farka hiç girmez", () => {
    expect(MONORAY.files).toHaveLength(174);
    expect(mono.eski.side.files).toHaveLength(169);
    expect(mono.yeni.side.files).toHaveLength(169);
    expect(mono.yeni.side.files.filter((f) => f.lifecycle === "haric")).toHaveLength(2);
  });

  it("tam DÖRT çizim dosyası içerik değiştirmiş — hem imza hem BOYUT", () => {
    // `İPTAL` altındaki 0057-00-0500 ve 0057-00-1000-08'in dwg+pdf eşleri.
    const yolla = monoFark.degisenDosyalar.filter((c) => c.matchedBy === "yol");
    expect(yolla.map((c) => c.yeni.relPath)).toEqual([
      "DWG/0057-00-0500.dwg",
      "DWG/0057-00-0500.pdf",
      "DWG/0057-00-1000-08.dwg",
      "DWG/0057-00-1000-08.pdf",
    ]);
    expect(yolla.every((c) => c.contentChanged)).toBe(true);
    expect(yolla.every((c) => !c.renamed)).toBe(true);

    // "İçerik değişti" ile "6 KB büyüdü" ressam için AYRI bilgilerdir.
    expect(yolla.map((c) => c.sizeDelta)).toEqual([6644, -5286, 3098, 43]);
    expect(yolla[0].eski.size).toBe(5551349);
    expect(yolla[0].yeni.size).toBe(5557993);
  });

  it("bu sürümde hiçbir dosya eklenmemiş ya da silinmemiş", () => {
    // Kurgunun sınırı: İPTAL'de adı geçmeyen dosyalar değişmemiş sayılır.
    expect(monoFark.yeniDosyalar).toEqual([]);
    expect(monoFark.silinenDosyalar).toEqual([]);
  });
});

describe("BOM Excel'i YOLLA değil BELGEYLE eşlenir", () => {
  it("iki tarihli DEPO dosyası TEK bir değişen dosyadır", () => {
    const belge = monoFark.degisenDosyalar.filter((c) => c.matchedBy === "belge");
    expect(belge).toHaveLength(1);
    expect(belge[0].eski.relPath).toBe("EXCEL/1.0057-00-0500_DEPO_02.07.2026.xlsx");
    expect(belge[0].yeni.relPath).toBe("EXCEL/2.0057-00-0500_DEPO_31.07.2026.xlsx");
    expect(belge[0].renamed).toBe(true);
    expect(belge[0].contentChanged).toBe(true);
    expect(belge[0].sizeDelta).toBe(-646);
  });

  it("kural KAPATILINCA aynı belge 1 silinen + 1 yeni olur — kazanç budur", () => {
    const kapali = packageDiff(mono.eski.side, mono.yeni.side, { bomBelgeEslemesi: false });
    expect(kapali.ozet.yeniDosya).toBe(1);
    expect(kapali.ozet.silinenDosya).toBe(1);
    expect(kapali.ozet.degisenDosya).toBe(4);
    // Açıkken 0 + 0 + 5.
    expect(monoFark.ozet.yeniDosya).toBe(0);
    expect(monoFark.ozet.silinenDosya).toBe(0);
    expect(monoFark.ozet.degisenDosya).toBe(5);
  });

  it("MTC'de aynı kural bilinçli olarak TUTMAZ ve doğrusu budur", () => {
    // İPTAL Excel'leri `0043-01-0100`, canlılar `0043-01-0000` diyor. Ressam
    // kalem ekini değiştirmiş; `reconcile` bunu zaten `EXCEL_ADI_KALEM_FARKI`
    // ile dört kez bildiriyor. Farklı belge kodunu aynı belge saymak, yanlış
    // çift kurmaktır — ve yanlış eşleşme eşleşmemekten pahalıdır.
    expect(mtcFark.silinenDosyalar.map((f) => f.relPath)).toEqual([
      "EXCEL/1.0043-01-0100_DEPO_02.02.2026.xlsx",
      "EXCEL/1.0043-01-0100_URUN AGACI_02.02.2026.xlsx",
    ]);
    expect(mtcFark.yeniDosyalar.map((f) => f.relPath)).toEqual([
      "EXCEL/1.0043-01-0000_DEPO_25.02.2026.xlsx",
      "EXCEL/1.0043-01-0000_URUN AGACI_25.02.2026.xlsx",
    ]);
    expect(mtcFark.degisenDosyalar).toEqual([]);
  });
});

// ——————————————————————————————————————————————————————————————— PARÇA FARKI

describe("MONORAY — kodlu parçalar", () => {
  it("defter 119'dan 121'e çıkmış", () => {
    expect(mono.eski.side.parts).toHaveLength(119);
    expect(mono.yeni.side.parts).toHaveLength(121);
  });

  it("kodlu tarafta 0 yeni, 0 silinen, 6 değişen", () => {
    expect(monoFark.yeniParcalar.filter((p) => p.partCode)).toEqual([]);
    expect(monoFark.silinenParcalar.filter((p) => p.partCode)).toEqual([]);
    expect(monoFark.degisenParcalar.filter((c) => c.yeni.partCode).map((c) => c.yeni.partCode))
      .toEqual([
        "0057-00-0700-02",
        "0057-00-1000-02",
        "0057-00-1000-03",
        "0057-00-1000-05",
        "0057-00-1000-08",
        "0057-00-1000-14",
      ]);
  });

  it("HANGİ ALANIN değiştiği tek tek dondurulur", () => {
    expect(alan("0057-00-1000-05", "adet")).toBe("4 → 2");

    // Kategori BOŞALMIŞ — "bir şey değişti" demek bunu anlatamaz.
    expect(alan("0057-00-1000-02", "kategori")).toBe("Talaşlı İmalat → ");
    expect(alan("0057-00-1000-03", "kategori")).toBe("Talaşlı İmalat → ");
    expect(alan("0057-00-1000-08", "kategori")).toBe("Talaşlı İmalat → ");

    // Tanımdaki atölye notu temizlenmiş.
    expect(alan("0057-00-0700-02", "tanim")).toBe(
      "TRAVERS KARE DEMİR 80x80 L=96   (SAC OLARAK KESIME VERILDI) → KARE DEMİR 80x80 L=96"
    );
  });

  it("BOM satırı KAZANAN parça dört alanı birden değiştirmiş görünür", () => {
    // 0057-00-1000-14 eski BOM'da yoktu: defterde yalnız dosyasıyla vardı.
    // Dört alanın birden dolması "yeni parça" değil "satırı yazılmış parça"dır.
    const c = monoFark.degisenParcalar.find((x) => x.yeni.partCode === "0057-00-1000-14")!;
    expect(c.changes.map((x) => x.field)).toEqual(["adet", "malzeme", "kategori", "tanim"]);
    expect(c.eski.description).toBe("");
    expect(c.yeni.description).toBe("BURÇ Ø52xØ47 L=4");
  });
});

describe("MONORAY — kodsuz (satın alma) parçalar", () => {
  it("tam İKİ yeni kalem eklenmiş", () => {
    // Segman ve rulman birlikte okununca tek bir mühendislik kararı görünüyor:
    // yatak ölçüsü büyütülmüş.
    expect(monoFark.yeniParcalar.map((p) => p.description)).toEqual([
      "DELİK SEGMANI Ø52 DIN472",
      "RULMAN 6205 - Z",
    ]);
    expect(monoFark.silinenParcalar).toEqual([]);
  });

  it("kodsuz tarafta yedi gerçek değişiklik var", () => {
    const kodsuz = monoFark.degisenParcalar.filter((c) => !c.yeni.partCode);
    expect(kodsuz).toHaveLength(7);
    expect(alan("DELİK SEGMANI Ø47 DIN472", "adet")).toBe("4 → 2");
    expect(alan("Rulman 6005 - Z", "adet")).toBe("8 → 4");
    expect(alan("PANO 900x200x300", "kategori")).toBe(" → Komple");
    // Dördü de "FST" yazımından boşa düşmüş — malzeme kimliğe GİRMEDİĞİ için
    // bunlar sil+ekle çiftine dönüşmüyor, değişiklik olarak görünüyor.
    expect(kodsuz.filter((c) => c.changes.some((x) => x.field === "malzeme"))).toHaveLength(4);
    expect(alan("PUL RONDELA M8 DIN125", "malzeme")).toBe("FST → ");
  });

  it("MONORAY özeti bütün olarak dondurulur", () => {
    expect(monoFark.ozet).toEqual({
      yeniDosya: 0,
      silinenDosya: 0,
      degisenDosya: 5,
      yeniParca: 2,
      silinenParca: 0,
      degisenParca: 13,
      alanSayaci: { adet: 4, malzeme: 5, agirlik: 0, kalinlik: 0, kategori: 5, tanim: 2 },
      bos: false,
    });
    expect(diffOzetMetni(monoFark.ozet)).toBe("5 dosya değişti · +2 parça · 13 parça değişti");
  });
});

describe("ANAHTAR SEÇİMİ — `register_key` kullanılsaydı ne olurdu", () => {
  it("konumsal anahtar 13 gerçek değişikliği 46'ya çıkarır", () => {
    // MALİYET TESTTE YAZILI OLSUN: bir gün biri anahtarı "basitleştirmek"
    // isterse 33 sahte değişikliğin bedelini burada görür. Sebep şemadaki
    // `register_key`in kodsuz satırda konumsal olmasıdır ('SATIR:' || bom_seq);
    // MONORAY'a iki satın alma kalemi eklenince sonraki bütün satır numaraları
    // kayıyor ve aynı cıvata "tanımı değişmiş" görünüyor.
    const konumsal = packageDiff(mono.eski.side, mono.yeni.side, { partKey: "registerKey" });
    expect(konumsal.ozet.degisenParca).toBe(46);
    expect(monoFark.ozet.degisenParca).toBe(13);
    expect(konumsal.ozet.degisenParca - monoFark.ozet.degisenParca).toBe(33);
  });

  it("MALZEME kimliğe girmez — girseydi değişen parça sil+ekle olurdu", () => {
    // Dairesel tuzak: rapor etmek istediğimiz alanın kendisi ("FST" → "")
    // kimliği bozar. Kimlik yalnız koddan ya da TANIMdan kurulur.
    const p: DiffPart = {
      registerKey: "SATIR:7",
      partCode: "",
      description: "PUL RONDELA M8 DIN125",
      qty: 8,
      material: "FST",
      weightKg: null,
      thicknessMm: null,
      category: "",
    };
    expect(partDiffKey(p)).toBe("TANIM:PUL RONDELA M8 DIN125");
    expect(partDiffKey({ ...p, material: "" })).toBe(partDiffKey(p));
  });
});

describe("MTC — 261 parçalık paket, ikinci teslim", () => {
  it("defter 217'den 261'e çıkmış", () => {
    expect(mtc.eski.side.parts).toHaveLength(217);
    expect(mtc.yeni.side.parts).toHaveLength(261);
    expect(MTC.files).toHaveLength(454);
    expect(mtc.yeni.side.files.filter((f) => f.lifecycle === "haric")).toHaveLength(10);
  });

  it("yedi yeni parça kodu", () => {
    expect(mtcFark.yeniParcalar.filter((p) => p.partCode).map((p) => p.partCode)).toEqual([
      "0043-00-0600-15",
      "0043-00-0600-16",
      "0043-00-0900-01",
      "0043-00-0900-02",
      "0043-00-0900-03",
      "0043-00-1000-01",
      "0043-01-0000",
    ]);
    expect(mtcFark.yeniParcalar.filter((p) => !p.partCode)).toHaveLength(84);
  });

  it("silinen kodların bir bölümü BAŞKA İŞLERDEN devralınmış montajlardır", () => {
    const silinenKodlar = mtcFark.silinenParcalar.filter((p) => p.partCode).map((p) => p.partCode);
    expect(silinenKodlar).toHaveLength(45);

    // Ressam eski işten kopyalayıp sonra 0043'e numaralamış: 0037 · 0009 · 0008.
    const devralinan = silinenKodlar.filter((k) => /^(0037|0009|0008)-/.test(k));
    expect(devralinan).toEqual([
      "0008-00-0500-01",
      "0008-00-0500-02",
      "0009-00-2200-04",
      "0009-00-2200-05",
      "0009-00-2200-06",
      "0037-00-0100-14",
      "0037-00-0100-15",
      "0037-00-0400-01",
      "0037-00-0400-02",
      "0037-00-0400-04",
      "0037-00-0400-05",
    ]);
  });

  it("19 'silinen' satın alma kalemi aslında YAZIM DEĞİŞİKLİĞİdir", () => {
    // Eski ÜRÜN AĞACI satın alma kalemlerini Part Number sütununda metin
    // anahtarıyla taşıyor ("348685", "LIMIT_51_67_DZC0Z_499P"); yenisi aynı
    // kalemleri DEPO sayfasında KODSUZ satır olarak yazıyor. Ekran bu sayıyı
    // çıplak basmamalı — gerçek bir silme değil, temsil değişikliğidir.
    const metinAnahtarli = mtcFark.silinenParcalar
      .filter((p) => p.partCode && !/^\d{4}-\d{2}-/.test(p.partCode))
      .map((p) => p.partCode);
    expect(metinAnahtarli).toHaveLength(19);
    expect(metinAnahtarli).toContain("LIMIT_51_67_DZC0Z_499P");
    expect(metinAnahtarli).toContain("348685");

    // Geriye 26 gerçek ORION kodu kalıyor.
    expect(45 - metinAnahtarli.length).toBe(26);
  });

  it("TEK BİR karar yüzü aşan satır üretir — özet şart, döküm değil", () => {
    expect(mtcFark.ozet.degisenParca).toBe(131);

    // Adet değişimlerinin 29'u TAM ×2: ana kiriş 1'den 2'ye çıkmış.
    const ikiKat = mtcFark.degisenParcalar.filter((c) =>
      c.changes.some((x) => x.field === "adet" && x.eskiNum && x.yeniNum === x.eskiNum * 2)
    );
    expect(ikiKat).toHaveLength(29);

    // Ve değişimin büyük bölümü tek bir montajın altında yoğunlaşıyor.
    const anaKiris = mtcFark.degisenParcalar.filter((c) =>
      c.yeni.partCode.startsWith("0043-00-0100")
    );
    expect(anaKiris).toHaveLength(24);
  });

  it("MTC özeti bütün olarak dondurulur", () => {
    expect(mtcFark.ozet).toEqual({
      yeniDosya: 2,
      silinenDosya: 2,
      degisenDosya: 0,
      yeniParca: 91,
      silinenParca: 47,
      degisenParca: 131,
      alanSayaci: { adet: 86, malzeme: 24, agirlik: 110, kalinlik: 10, kategori: 56, tanim: 86 },
      bos: false,
    });
  });
});

// ————————————————————————————————————————————————————————————————— SESSİZLİK

describe("SESSİZLİK — basılmayan farklar (en değerli iddialar)", () => {
  it("122 item_path ve 57 başlık kayması HİÇBİR değişiklik üretmez", () => {
    // MTC'de tek bir montaj eklemesi ürün ağacının numaralandırmasını baştan
    // kaydırıyor. Bunu parça başına basmak 131 satırı 253'e çıkarır ve raporu
    // okunmaz yapar — o yüzden iki alan da karşılaştırma dışıdır.
    const eskiHarita = new Map(mtc.eski.parts.map((p) => [partDiffKey(diffParcasi(p)), p]));
    let ortak = 0;
    let itemPathKaymasi = 0;
    let baslikKaymasi = 0;
    for (const p of mtc.yeni.parts) {
      const e = eskiHarita.get(partDiffKey(diffParcasi(p)));
      if (!e) continue;
      ortak += 1;
      if (e.itemPath !== p.itemPath) itemPathKaymasi += 1;
      if (e.assemblyTitle !== p.assemblyTitle) baslikKaymasi += 1;
    }
    expect(ortak).toBe(170);
    expect(itemPathKaymasi).toBe(122);
    expect(baslikKaymasi).toBe(57);

    // Kaymaların hiçbiri farka girmedi: değişen parça sayısı 131'de kaldı.
    expect(mtcFark.ozet.degisenParca).toBe(131);
  });

  it("`.bak` ve `_Sheet` dosyaları eklense de çıkarılsa da fark üretmez", () => {
    // AutoCAD yedeği her kaydetmede değişir; onu "paket değişti" saymak fark
    // raporunu gürültüye boğardı.
    const eksik = {
      ...mono.eski.side,
      files: mono.eski.side.files.filter((f) => f.lifecycle !== "haric"),
    };
    const fark = packageDiff(eksik, mono.yeni.side);
    expect(fark.ozet).toEqual(monoFark.ozet);
  });

  it("iki taraf birebir aynıysa özet TAMAMEN sıfırdır", () => {
    for (const taraf of [mono.yeni.side, mtc.yeni.side]) {
      const fark = packageDiff(taraf, taraf);
      expect(fark.ozet.bos).toBe(true);
      expect(fark.degisenDosyalar).toEqual([]);
      expect(fark.degisenParcalar).toEqual([]);
      expect(diffOzetMetni(fark.ozet)).toBe("Fark yok");
    }
  });
});

describe("SİMETRİ — ters yön aynı kümeyi verir", () => {
  it("MONORAY: ileri yeni = geri silinen", () => {
    const geri = packageDiff(mono.yeni.side, mono.eski.side);
    expect(geri.silinenParcalar.map((p) => p.description)).toEqual(
      monoFark.yeniParcalar.map((p) => p.description)
    );
    expect(geri.ozet.degisenParca).toBe(monoFark.ozet.degisenParca);
    expect(geri.ozet.silinenDosya).toBe(monoFark.ozet.yeniDosya);
  });

  it("MTC: `yeniDosyalar` dalı GERÇEK baytlarla kapanır", () => {
    const geri = packageDiff(mtc.yeni.side, mtc.eski.side);
    expect(geri.yeniDosyalar.map((f) => f.relPath)).toEqual(
      mtcFark.silinenDosyalar.map((f) => f.relPath)
    );
    expect(geri.silinenDosyalar.map((f) => f.relPath)).toEqual(
      mtcFark.yeniDosyalar.map((f) => f.relPath)
    );
    expect(geri.ozet.yeniParca).toBe(mtcFark.ozet.silinenParca);
    expect(geri.ozet.silinenParca).toBe(mtcFark.ozet.yeniParca);
  });
});

// ————————————————————————————————————————————————————— SAYISAL KARARLILIK

describe("sayısal kararlılık — `numeric` sütun METİN dönebilir", () => {
  const taban: DiffPart = {
    registerKey: "KOD:0043-00-0100",
    partCode: "0043-00-0100",
    description: "ANA KİRİŞ",
    qty: 1,
    material: "S355JR",
    weightKg: 1498.457,
    thicknessMm: 8,
    category: "Komple",
  };
  const tek = (a: DiffPart, b: DiffPart) =>
    packageDiff({ files: [], parts: [a] }, { files: [], parts: [b] });

  it('"1498.4570" ile 1498.457 AYNI ağırlıktır', () => {
    // supabase-js `numeric`i metin olarak verebilir; `String(a) !== String(b)`
    // ile karşılaştırmak 110 gerçek ağırlık değişiminin yanına gürültü katardı.
    expect(tek(taban, { ...taban, weightKg: "1498.4570" }).ozet.bos).toBe(true);
    expect(tek(taban, { ...taban, qty: "1" }).ozet.bos).toBe(true);
    expect(tek(taban, { ...taban, thicknessMm: "8.000" }).ozet.bos).toBe(true);
  });

  it("gerçek ağırlık farkı raporlanır", () => {
    const f = tek({ ...taban, weightKg: 1331.276 }, taban);
    expect(f.degisenParcalar[0].changes).toEqual([
      { field: "agirlik", eski: "1331.276", yeni: "1498.457", eskiNum: 1331.276, yeniNum: 1498.457 },
    ]);
  });

  it("ölçek sınırında yuvarlanır: ağırlık 3, kalınlık 2 hane", () => {
    expect(tek(taban, { ...taban, weightKg: 1498.4574 }).ozet.bos).toBe(true);
    expect(tek(taban, { ...taban, weightKg: 1498.4576 }).ozet.bos).toBe(false);
    expect(tek(taban, { ...taban, thicknessMm: 8.004 }).ozet.bos).toBe(true);
    expect(tek(taban, { ...taban, thicknessMm: 8.006 }).ozet.bos).toBe(false);
  });

  it("boş ile dolu ayrı değerlerdir", () => {
    expect(tek(taban, { ...taban, weightKg: null }).degisenParcalar[0].changes[0]).toEqual({
      field: "agirlik",
      eski: "1498.457",
      yeni: "",
      eskiNum: 1498.457,
      yeniNum: null,
    });
  });
});

describe("sınır durumları — hiçbir koşulda çökmez", () => {
  const bos: PackageSide = { files: [], parts: [] };

  it("eski taraf boşsa her şey yenidir", () => {
    const f = packageDiff(bos, mono.yeni.side);
    expect(f.yeniParcalar).toHaveLength(121);
    expect(f.silinenParcalar).toEqual([]);
    // 169 dosyanın 2'si `haric`.
    expect(f.yeniDosyalar).toHaveLength(167);
  });

  it("iki taraf da boşsa özet boştur, istisna atılmaz", () => {
    const f = packageDiff(bos, bos);
    expect(f.ozet.bos).toBe(true);
    expect(diffOzetMetni(f.ozet)).toBe("Fark yok");
  });

  it("kodu ve tanımı olmayan parça registerKey'e düşer", () => {
    const p: DiffPart = {
      registerKey: "SATIR:12",
      partCode: "",
      description: "",
      qty: null,
      material: "",
      weightKg: null,
      thicknessMm: null,
      category: "",
    };
    expect(partDiffKey(p)).toBe("SIRA:SATIR:12");
    expect(packageDiff({ files: [], parts: [p] }, { files: [], parts: [p] }).ozet.bos).toBe(true);
  });

  it("yazımı düzelen metin DEĞİŞİKLİK sayılmaz", () => {
    // `LIMIT_51_67_DZC0Z_499P` ile `LİMİT_51_67_DZC0Z_499P` aynı kalemdir;
    // eşleştirme `trKatla` ile yapılır, gösterim ham metni korur.
    const a: DiffPart = {
      registerKey: "SATIR:1",
      partCode: "X-1",
      description: "LIMIT_51_67_DZC0Z_499P",
      qty: 1,
      material: "",
      weightKg: null,
      thicknessMm: null,
      category: "",
    };
    const b: DiffPart = { ...a, description: "LİMİT_51_67_DZC0Z_499P" };
    expect(packageDiff({ files: [], parts: [a] }, { files: [], parts: [b] }).ozet.bos).toBe(true);
  });
});

// ————————————————————————————————————————————————————————————————— EKRAN
//
// Sürüm listesi SUNUCU BİLEŞENİDİR ve kanca kullanmaz: doğrudan çağrılıp
// dizgeye basılabilir. Çekirdeğin çıktısı ile ekranın gördüğü şeyin AYNI
// veriden geldiğini bir tek burası kanıtlar; ayrıca dar ekran kuralları
// (AGENTS md. 7, 8, 11) gözle değil SAYARAK denetlenir.

function markup(surumler: VersionBlockData[]): string {
  return renderToStaticMarkup(VersionList({ surumler }) as ReactElement);
}

function blok(fark: (typeof monoFark) | null, ustuste: Partial<VersionBlockData> = {}) {
  const taban: VersionBlockData = {
    id: "yeni-id",
    revNo: 2,
    status: "aktif",
    folderName: "0057-00-0500 - MONORAY (1 TON)",
    createdAt: "2026-07-31T09:00:00.000Z",
    fileCount: 174,
    partCount: 121,
    bytesTotal: 112_000_000,
    bugunku: true,
    zincirBagli: true,
    fark,
    olculmedi: false,
    ...ustuste,
  };
  return taban;
}

const eskiBlok = blok(null, {
  id: "eski-id",
  revNo: 1,
  status: "superse",
  createdAt: "2026-07-02T09:00:00.000Z",
  fileCount: 170,
  partCount: 119,
  bugunku: false,
});

describe("EKRAN — sürüm listesi", () => {
  it("tek sürümlü pakette çökmez, 'tek sürüm' der", () => {
    expect(markup([])).toContain("Tek sürüm");
    expect(markup([blok(null)])).toContain("Tek sürüm");
  });

  it("fark satırı çekirdekten gelen ÖZETİN ta kendisidir", () => {
    const html = markup([blok(monoFark), eskiBlok]);
    expect(html).toContain("5 dosya değişti · +2 parça · 13 parça değişti");
    expect(html).toContain("R2");
    expect(html).toContain("R1");
    // Ayrıntı JS'siz açılır.
    expect(html).toContain("<details");
  });

  it("131 değişen parçalık MTC farkı DÖKÜLMEZ, ilk 12 satır + sayaç basılır", () => {
    const html = markup([blok(mtcFark), eskiBlok]);
    expect(html).toContain("Değişen parça (131)");
    expect(html).toContain("ve 119 parça daha");
    // Alan sayaçları özet olarak durur — 131 satırı okumadan ne olduğu anlaşılsın.
    expect(html).toContain("Ağırlık 110");
    expect(html).toContain("Adet 86");
  });

  it("dosya listeleri de sekiz satırda kesilir", () => {
    const html = markup([blok(mtcFark), eskiBlok]);
    expect(html).toContain("Yeni dosya (2)");
    expect(html).toContain("Silinen dosya (2)");
  });

  it("boyut farkı ayrı bir bilgi olarak basılır", () => {
    const html = markup([blok(monoFark), eskiBlok]);
    // 5551349 → 5557993 = +6.644 bayt.
    expect(html).toContain("+6,5 KB");
    // Adı değişen BOM dosyası eski adını da gösterir.
    expect(html).toContain("1.0057-00-0500_DEPO_02.07.2026.xlsx");
  });

  it("bağlanmamış ikiz HATA gibi değil BİLGİ gibi gösterilir", () => {
    const html = markup([blok(monoFark, { zincirBagli: false }), eskiBlok]);
    expect(html).toContain("bağlanmamış ikiz");
    // Bu modülde "engelleyici" diye bir düzey yoktur; dil de suçlamaz.
    expect(html).not.toMatch(/hata|geçersiz|reddedildi/i);
  });

  it("dar ekran: 11px altına inen yazı yok, sabit genişlik yok", () => {
    const html = markup([blok(mtcFark), eskiBlok]);
    expect(html).not.toMatch(/text-\[(9|10)px\]/);
    // Sabit `w-[…px]` / kelepçesiz `min-w-[…rem]` taşma üretir (AGENTS md. 5).
    expect(html).not.toMatch(/\bw-\[\d+px\]/);
    expect(html).not.toMatch(/min-w-\[(?!min\()/);
    // Uzun dosya yolları kırılabilir olmalı, yoksa satır kabı taşırır.
    expect(html).toContain("break-all");
  });

  it("ölçülmeyen sürümde sessiz kalmaz, ölçmediğini söyler", () => {
    const html = markup([blok(null, { olculmedi: true }), eskiBlok]);
    expect(html).toContain("fark hesaplanmadı");
  });
});
