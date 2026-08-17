// Türev çıktılar — KORUMA TESTİ.
//
// İki gerçek paket baştan sona işlenir, üç çıktı da üretilir ve ÖLÇÜLEN
// SAYILAR dondurulur. Bu dosyanın en değerli iddiaları dört tanedir ve dördü de
// gerçek veride bir kez yanlış yapılmış işlerdir:
//
//   1. SINIFLANDIRMA baş sözcüğe indirgenirse "YAYLI RONDELA" bağlantı elemanı
//      olmaktan çıkar (MTC'de tek başına 17 defter satırı).
//   2. TESTERE satırında adet × birim boy ÇARPILIRSA satınalmaya iki katı
//      metraj gider (`0043-00-0100-13`: 94 000 mm yerine 47 000 mm).
//   3. AĞIRLIK bütün satırlardan toplanırsa vinç iki katından ağır görünür
//      (MTC: 21 209 kg yerine 9 259,3 kg).
//   4. SATIN ALMA KİMLİĞİ `progress.ts` ile aynı olmalıdır. Ayrıştığında iki
//      belge aynı paket için iki farklı sayı söylüyordu (MTC 90 ↔ 68) ve
//      `SOMUN M16` dört ayrı satırda kalıp hiçbir hücrede toplanmıyordu.
//      Bu iddia bilinçli olarak ÇAPRAZ testtir: `progress.test.ts`teki
//      dondurulmuş sayılarla karşılaştırılır, çünkü çatlak tam da iki dosyanın
//      birbirinden habersiz dondurulmasıyla oluşmuştu.
//
// Beşincisi SESSİZLİK iddiasıdır: ölçüsü çıkarılamayan parça listeden
// DÜŞMEZ. Düşseydi MTC'de iki koca sac grubu (S355JR 60 mm ve 70 mm) hiç
// var olmamış gibi görünürdü.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseBomFileName, parseFile } from "../file-name";
import { parseFolderName } from "../folder-name";
import { readSheet } from "../excel";
import { reconcile, type PackageSnapshot } from "../reconcile";
import {
  imalatKokleri,
  imalatListesi,
  kesimListesi,
  sacIhtiyaci,
  satinAlmaListesi,
  satinAlmaKategoriSirasi,
  satinAlmaSinifi,
  testereKesim,
  type KesimDosyasi,
  type TurevParca,
} from "../derive";
import { PURCHASE_PREFIX, trackedParts } from "../progress";
import { docCode, downloadFileName } from "@/lib/pdf/doc-naming";
import {
  buildImalatWorkbook,
  buildKesimWorkbook,
  buildSatinAlmaWorkbook,
} from "@/lib/excel/drawing-outputs";
import { trKatla } from "../tr-text";
import { MONORAY, MTC, type FixturePackage } from "./fixtures/packages";
import { MONORAY_SHEETS, MTC_SHEETS, type FixtureSheet } from "./fixtures/bom-sheets";

function anlikGoruntu(pkg: FixturePackage, sheets: FixtureSheet[]): PackageSnapshot {
  const files = pkg.files.map((f) => parseFile({ relPath: f.path, size: f.size, checksum: f.hash }));
  // İPTAL altındaki Excel'ler eski sürümdür; defter CANLI olandan kurulur.
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

/** Eşleştirme çıktısını türev katmanın girdilerine çevirir. */
function paket(pkg: FixturePackage, sheets: FixtureSheet[]) {
  const snap = anlikGoruntu(pkg, sheets);
  const r = reconcile(snap);
  const kararlar = new Map(r.fileDecisions.map((d) => [d.relPath, d.lifecycle]));
  const files: KesimDosyasi[] = snap.files.map((f) => ({
    relPath: f.relPath,
    fileName: f.fileName,
    role: f.role,
    lifecycle: kararlar.get(f.relPath) ?? f.lifecycle,
    partCode: f.partCode,
    material: f.material,
    thicknessMm: f.thicknessMm,
    qty: f.qty,
    size: f.size,
  }));
  return { parts: r.parts as TurevParca[], files, itemNo: snap.folder?.itemNo ?? "" };
}

const monoray = paket(MONORAY, MONORAY_SHEETS);
const mtc = paket(MTC, MTC_SHEETS);

const sinif = (sonuc: ReturnType<typeof satinAlmaListesi>) =>
  Object.fromEntries(sonuc.siniflar.map((s) => [s.sinif, s.satirSayisi]));

// ————————————————————————————————————————————————————— 1. Satın alma

describe("satın alma listesi — MONORAY", () => {
  const sa = satinAlmaListesi(monoray.parts);

  it("55 defter satırı → 54 kalem: 49 kodsuz + 5 kodlu, toplam 323 adet", () => {
    expect(sa.satirlar).toHaveLength(54);
    expect(sa.kaynakSatiri).toBe(55);
    expect(sa.kodsuzKalem).toBe(49);
    expect(sa.satirlar.filter((s) => s.parcaKodu)).toHaveLength(5);
    // ADET BİRLEŞTİRMEDEN ETKİLENMEZ: satırların toplamı ile kalemlerin
    // toplamı aynı sayıdır — birleştirme bir kayıp değil, bir toplamadır.
    expect(sa.toplamAdet).toBe(323);
  });

  it("tek birleşme: CİVATA M6x20 iki montajda 4'er adet", () => {
    expect(sa.birlesenKalem).toBe(1);
    const civata = sa.satirlar.find((s) => s.tanim.startsWith("CİVATA M6x20"))!;
    expect(civata.sourceRows).toBe(2);
    expect(civata.adet).toBe(8);
    expect(civata.izler).toHaveLength(2);
  });

  it("bu pakette ürün ağacı yok — ağırlık toplamı 0 DEĞİL null", () => {
    // 0 yazmak "sıfır kilo" demektir; doğru cevap "bilinmiyor"dur.
    expect(sa.agirligiBilinen).toBe(0);
    expect(sa.toplamAgirlikKg).toBeNull();
    // 5 → 25 (13.08.2026): bağlantı elemanının KALİTESİ artık malzeme
    // sütunundadır. `malzemeNormalize` "8.8" ve "8" değerlerini sayısal
    // oldukları için atıyordu; oysa satınalmacının aradığı "Kalite" tam olarak
    // odur (`firmaKabulleri`).
    expect(sa.malzemesiBilinen).toBe(25);
  });

  it("ürün ağacı yoksa kaynak izi EXCEL SATIRIDIR", () => {
    // Montaj bilgisi ürün ağacından çıkar; o yoksa iz defterin dosya · sayfa ·
    // satır üçlüsüne düşer. Boş bırakmak, izi tamamen kaybetmek olurdu.
    const civata = sa.satirlar.find((s) => s.tanim.startsWith("CİVATA M6x20"))!;
    expect(civata.izler.every((i) => i.montajKodu === "")).toBe(true);
    expect(civata.kaynak).toContain("DEPO");
    // Aynı sayfadan gelen iki satır TEK izde toplanır: dosya adı iki kez yazılmaz.
    expect(civata.kaynak.split(" · ").filter((p) => p.endsWith(".xlsx"))).toHaveLength(1);
  });

  it("kategori dağılımı dondurulur — hiçbir satır Diğer'e düşmüyor", () => {
    expect(sinif(sa)).toEqual({
      Redüktör: 3,
      Rulman: 6,
      Motor: 1,
      "Halat ve Zincir": 1,
      Tampon: 1,
      "Keçe ve Sızdırmazlık": 1,
      Yağlama: 1,
      "Elektrik ve Otomasyon": 4,
      "Bağlantı Elemanı": 36,
    });
    // BOŞ KATEGORİ YAZILMAZ: sözlük on beş kategori tanıyor, bu paket dokuzunu
    // kullanıyor ve kalan altısı listeye hiç girmiyor.
    expect(sa.siniflar.every((s) => s.satirSayisi > 0)).toBe(true);
  });

  it("sınıf toplamı kalem sayısına eşittir — hiçbir satır düşmez", () => {
    expect(sa.siniflar.reduce((t, s) => t + s.satirSayisi, 0)).toBe(sa.satirlar.length);
    expect(sa.satirlar.reduce((t, s) => t + s.sourceRows, 0)).toBe(sa.kaynakSatiri);
  });
});

describe("satın alma listesi — MTC", () => {
  const sa = satinAlmaListesi(mtc.parts);

  it("96 defter satırı → 74 kalem: 70 kodsuz + 4 kodlu, toplam 611 adet", () => {
    // SAYILAR 13.08.2026'DA 90/72/68'DEN YÜKSELDİ ve sebebi bir kural
    // düzeltmesidir: `bomBirlestir` kodsuz satırların kazanan sayfasını PAKET
    // BAŞINA seçiyordu, artık GRUP BAŞINA seçiyor. `0043-00-0050` ve
    // `0043-00-0850` gruplarının kendi DEPO Excel'lerindeki altı satır bu
    // yüzden hiç görünmüyordu (ölçüldü: kazanan sayfada karşılıkları YOKTU).
    //
    // Gelenler galvanizsiz bağlantı elemanlarıdır ve galvanizli eşlerinden
    // AYRI kalem sayılırlar — SATIN-21'in kuralı: yazmayana galvaniz eklenmez.
    // 78 → 74 (13.08.2026): galvanizli ve galvanizsiz yazılmış AYNI cıvata
    // artık tek kalemdir (`firmaKabulleri` — firma her zaman galvanizli alıyor).
    // Kaynak satır sayısı DEĞİŞMEDİ (96): kaybolan satır yok, BİRLEŞEN var.
    expect(sa.satirlar).toHaveLength(74);
    expect(sa.kaynakSatiri).toBe(96);
    expect(sa.kodsuzKalem).toBe(70);
    expect(sa.satirlar.filter((s) => s.parcaKodu)).toHaveLength(4);
    expect(sa.toplamAdet).toBe(611);
    expect(sa.birlesenKalem).toBe(13);
  });

  it("ürün ağacı olan pakette ağırlık gelir — SATIR SATIR toplanmış", () => {
    // Toplam 829,487 kg BİRLEŞTİRMEDEN ÖNCEKİ ile aynı sayıdır: birleşik adet
    // × birim ağırlık ile yeniden hesaplansaydı ağırlığı yazılmamış satırlar
    // sessizce kaybolur ya da yuvarlama sapması eklenirdi.
    expect(sa.agirligiBilinen).toBe(72);
    expect(sa.toplamAgirlikKg).toBeCloseTo(829.576, 3);
    // 15 → 39: bağlantı elemanı kalitesi (8.8 / 8) artık malzeme sütununda.
    expect(sa.malzemesiBilinen).toBe(39);
    const satirToplami = mtc.parts
      .filter((p) => (p.kind === "satinalma" || !p.partCode) && p.weightKg != null)
      .reduce((t, p) => t + (p.weightKg as number) * (p.qty ?? 1), 0);
    expect(sa.toplamAgirlikKg).toBeCloseTo(satirToplami, 6);
  });

  it("kategori dağılımı dondurulur — Diğer 11'den 1'e indi", () => {
    // Üç sınıflı eski sözlükte 11 kalem "Diğer"deydi (keçe, gresörlük, dirsek,
    // feston arabası…). Kategoriler ürün ailesine bölününce geriye YALNIZ bir
    // satır kaldı: "ÇEKME YAYI IKI UCU KANCALI". Yay için kategori AÇILMADI —
    // `YAY` ön eki 17 satırlık "YAYLI RONDELA"yı da yakalardı ve bir satırı
    // kazanmak için kırk ikisini kaybetmek olurdu.
    expect(sinif(sa)).toEqual({
      Redüktör: 3,
      Rulman: 6,
      "Halat ve Zincir": 2,
      Tampon: 2,
      "Kaldırma Aksesuarı": 1,
      "Keçe ve Sızdırmazlık": 4,
      Yağlama: 2,
      "Elektrik ve Otomasyon": 4,
      "Enerji İletim": 3,
      "Hazır Malzeme": 2,
      // 42 → 48 (grup başına kazanan sayfa) → 44 (galvaniz birleşmesi).
      // Sınıflandırma sözlüğü hiç değişmedi; iki kural kapsamı büyüttü,
      // üçüncüsü aynı ürünün iki yazımını tek kaleme indirdi.
      "Bağlantı Elemanı": 44,
      Diğer: 1,
    });
  });

  it("MALZEME ilk dolu değerden gelir; çelişki YUTULMAZ", () => {
    // Ölçüldü: iki gerçek pakette de aynı kalem iki farklı malzemeyle hiç
    // geçmiyor. Yani bu işaret bir yanlış alarm kaynağı DEĞİLDİR — ama
    // tetiklendiğinde satırda görünür olmalıdır.
    expect(sa.malzemeCeliskisi).toBe(0);
    expect(sa.satirlar.every((s) => s.malzemeler.length <= 1)).toBe(true);
    expect(sa.satirlar.every((s) => !s.malzeme || s.malzemeler[0] === s.malzeme)).toBe(true);
  });
});

// ————————————————————————————— 1b. Kimlik: derive ↔ progress

describe("SATIN ALMA KİMLİĞİ — tahta ile aynı kalem sayılır", () => {
  const sa = satinAlmaListesi(mtc.parts);
  const defter = trackedParts(mtc.parts);

  it("MTC'de kodsuz kalem sayısı progress.test.ts'teki 70 ile UYUŞUR", () => {
    // İki dosya ayrı ayrı dondurulduğu için çatlak fark edilmemişti: satın alma
    // Excel'i 90, tahta 68 diyordu. Bu iddia iki çekirdeği birbirine bağlar.
    expect(defter.purchases).toHaveLength(70);
    expect(sa.kodsuzKalem).toBe(defter.purchases.length);
  });

  it("anahtar uzayı da AYNIDIR — kodsuzda SATINALMA:, kodluda kodun kendisi", () => {
    const tahtaAnahtarlari = new Set(defter.purchases.map((p) => p.key));
    const kodsuzKalemler = sa.satirlar.filter((s) => !s.parcaKodu);
    for (const s of kodsuzKalemler) {
      expect(s.key.startsWith(PURCHASE_PREFIX)).toBe(true);
      expect(s.key).not.toContain("SATIR:"); // konumsal anahtar kimlik olamaz
      expect(tahtaAnahtarlari.has(s.key)).toBe(true);
    }
    for (const s of sa.satirlar.filter((x) => x.parcaKodu)) {
      expect(s.key).toBe(s.parcaKodu);
    }
  });

  it("aynı tanım iki satırda geçince TEK satır olur ve adetler TOPLANIR", () => {
    // SOMUN M16 DIN934 defterde dört satırdır: 2 + 4 + 4 + 51 = 61. Dosyada bu
    // dördü toplayan hiçbir hücre yoktu; satınalmacı ya eksik ya mükerrer
    // sipariş verirdi.
    //
    // BEŞİNCİ SATIR 13.08.2026'DA KATILDI. `0043-00-0050`nin DEPO'sunda aynı
    // somun GALVANİZSİZ yazılmıştı; `firmaKabulleri` ona da galvaniz ekleyince
    // ikisi TEK kalem oldu (kullanıcı kararı: "her zaman galvanizli alıyoruz").
    // Kaleme giren tek şey ADET değil, ondan önce KİMLİK: aynı ürünü iki
    // yazımla sipariş etmek satınalmacının en pahalı hatasıydı.
    const somun = sa.satirlar.filter((s) => s.tanim.startsWith("SOMUN M16 DIN934"));
    expect(somun).toHaveLength(1);
    expect(somun[0].tanim).toBe("SOMUN M16 DIN934 (GALVANİZLİ)");
    expect(somun[0].sourceRows).toBe(5);
    expect(somun[0].adet).toBe(65);
    expect(somun[0].izler.map((i) => i.adet)).toEqual([4, 2, 4, 4, 51]);
    // BİRİM AĞIRLIK ARTIK YAZILAMAZ ve bu DOĞRUDUR: katılan beşinci satırın
    // ağırlığı hiç yok, yani "her satır aynı birim ağırlığı söylüyor" şartı
    // bozuldu. Toplam ağırlık ise satır satır toplandığı için değişmedi —
    // birleşik adetle yeniden çarpılsaydı 2,074 yerine 2,21 çıkardı.
    expect(somun[0].birimAgirlikKg).toBeNull();
    expect(somun[0].toplamAgirlikKg).toBeCloseTo(2.074, 3);

    // Tahtadaki karşılığı BİREBİR aynı kalemdir.
    const tahtada = defter.purchases.find(
      (p) => p.label === "SOMUN M16 DIN934 (GALVANİZLİ)"
    )!;
    expect(tahtada.key).toBe(somun[0].key);
    expect(tahtada.qty).toBe(somun[0].adet);
    expect(tahtada.sourceRows).toBe(somun[0].sourceRows);
  });

  it("KAYNAK İZİ KAYBOLMAZ: hangi montajdan geldiği satırda durur", () => {
    const somun = sa.satirlar.find((s) => s.tanim === "SOMUN M16 DIN934 (GALVANİZLİ)")!;
    expect(somun.izler.map((i) => i.montajKodu)).toEqual([
      "", // `0043-00-0050`nin DEPO'su — o dosyada ürün ağacı yok, yol da yok
      "0043-00-0300",
      "0043-00-0803",
      "0043-00-0800",
      "", // ürün ağacının en üst düzeyi — gerçekten bir montajın altında değil
    ]);
    expect(somun.izler[1].montajAdi).toBe("KÖPRÜ YÜRÜTME GRUBU");
    // İZİ ÇÖZÜLEMEYEN SATIR SİLİNMEZ, EXCEL SATIRINA DÜŞER. Beşinci kaynağın
    // montajı bilinmiyor ama HANGİ DOSYANIN kaçıncı satırından geldiği yazıyor;
    // satınalmacı "bu 4 adet nereden çıktı" diye sorduğunda cevap var.
    expect(somun.kaynak).toContain("0043-00-0300 (3.14) ×2");
    expect(somun.kaynak).toContain("ürün ağacı 10 ×51");
    expect(somun.kaynak).toContain("1.0043-00-0050_DEPO_04,06,2026.xlsx");
    // Hiçbir kalem izsiz kalmaz.
    expect(sa.satirlar.every((s) => s.kaynak !== "")).toBe(true);
  });

  // Aşağıdaki iki iddia SENTETİK veriyle kurulur: iki gerçek pakette de bu
  // hâller hiç görülmedi (malzeme çelişkisi 0, birim ağırlık ayrışması 0). Yine
  // de kural buradadır, çünkü tetiklendiğinde sessiz kalırsa satınalmaya yanlış
  // bir sayı gider.
  const kodsuzOrnek = () => mtc.parts.find((p) => !p.partCode)!;

  it("birim ağırlık ancak BÜTÜN kaynak satırlar aynı sayıyı söylüyorsa yazılır", () => {
    const iki = (a: Partial<TurevParca>, b: Partial<TurevParca>) =>
      satinAlmaListesi([
        { ...kodsuzOrnek(), description: "PİM Ø20", qty: 2, weightKg: 1, ...a },
        { ...kodsuzOrnek(), description: "PİM Ø20", qty: 3, weightKg: 1, ...b },
      ]).satirlar[0];

    const ayni = iki({}, {});
    expect(ayni.sourceRows).toBe(2);
    expect(ayni.birimAgirlikKg).toBe(1);
    expect(ayni.toplamAgirlikKg).toBe(5); // 1×2 + 1×3

    const ayrisan = iki({}, { weightKg: 2 });
    expect(ayrisan.birimAgirlikKg).toBeNull(); // tek bir birim ağırlık YOKTUR
    expect(ayrisan.toplamAgirlikKg).toBe(8); // 1×2 + 2×3 — satır satır

    const eksik = iki({}, { weightKg: null });
    expect(eksik.birimAgirlikKg).toBeNull();
    expect(eksik.toplamAgirlikKg).toBe(2); // yalnız ağırlığı bilinen satır
  });

  it("aynı tanım FARKLI malzemeyle geçerse İKİSİ DE satırda durur", () => {
    const sa = satinAlmaListesi([
      { ...kodsuzOrnek(), description: "PİM Ø20", material: "S235JR", qty: 1 },
      { ...kodsuzOrnek(), description: "PİM Ø20", material: "S355JR", qty: 1 },
    ]);
    expect(sa.satirlar).toHaveLength(1);
    expect(sa.satirlar[0].malzeme).toBe("S235JR"); // ilk dolu değer
    expect(sa.satirlar[0].malzemeler).toEqual(["S235JR", "S355JR"]);
    expect(sa.malzemeCeliskisi).toBe(1);
  });

  it("TANIM KURALI da aynıdır: assemblyTitle kodsuz satırda yedek DEĞİLDİR", () => {
    // `tanimOf` üçüncü yedek olarak montaj başlığını kullanır; tahta
    // kullanmaz. Kodsuz satırda bu ayrım aynı kalemi iki ada bölerdi.
    const sahte: TurevParca[] = [
      { ...mtc.parts.find((p) => !p.partCode)!, description: "", name: "", assemblyTitle: "ANAKİRİŞ", qty: 3 },
      { ...mtc.parts.find((p) => !p.partCode)!, description: "", name: "", assemblyTitle: "BAŞKİRİŞ", qty: 5 },
    ];
    const tek = satinAlmaListesi(sahte);
    expect(tek.satirlar).toHaveLength(1);
    expect(tek.satirlar[0].adet).toBe(8);
    expect(tek.satirlar[0].key).toBe(`${PURCHASE_PREFIX}?`);
    expect(tek.satirlar[0].key).toBe(trackedParts(sahte).purchases[0].key);
  });
});

describe("SINIFLANDIRMA — baş sözcük tuzağı", () => {
  // Bu dört iddia, birileri kuralı ileride "tanımın BAŞ SÖZCÜĞÜ" hâline
  // indirirse anında kırılır. MTC'de tek başına "YAYLI RONDELA" 17 satırdır.
  it("niteleyici ile başlayan tanımlar da bağlantı elemanıdır", () => {
    expect(satinAlmaSinifi("YAYLI RONDELA M10 DIN127   (GALVANİZLİ)")).toBe("Bağlantı Elemanı");
    expect(satinAlmaSinifi("DÜZ RONDELA M12 DIN125")).toBe("Bağlantı Elemanı");
    expect(satinAlmaSinifi("İMBUS CİVATA M6x10 DIN7984")).toBe("Bağlantı Elemanı");
    expect(satinAlmaSinifi("DELİK SEGMANI Ø68 DIN472")).toBe("Bağlantı Elemanı");
  });

  it("eşleşme TAM değil ÖN EK'tir — Türkçe iyelik eki sözcüğü değiştirir", () => {
    expect(satinAlmaSinifi("MİL SEGMANI Ø30 DIN471")).toBe("Bağlantı Elemanı");
    expect(satinAlmaSinifi("SOMUN M6 DIN934")).toBe("Bağlantı Elemanı");
  });

  it("öncelik: bağlantı elemanı EN SONDADIR", () => {
    // "RULMAN YATAĞI SOMUNU" bir rulman kalemidir, somun değil.
    expect(satinAlmaSinifi("RULMAN YATAĞI SOMUNU")).toBe("Rulman");
  });

  it("MOTORLU REDÜKTÖR redüktördür — sipariş redüktör tedarikçisine gider", () => {
    // İki sözcük de tanımda geçiyor; kazanan SIRAdır. Bu iddia, birileri
    // kategori listesini alfabetik sıralarsa anında kırılır.
    expect(satinAlmaSinifi("YILMAZ REDUKTOR DR373-3E90L-4D - i57.79 - MOTOR 1,5kW 1500d-d")).toBe(
      "Redüktör"
    );
    expect(satinAlmaSinifi("KALDIRMA MOTOR 1.1 kW 1500 d-d")).toBe("Motor");
  });

  it("KANCA tam sözcüktür, ön ek değil — 'KANCALI' bir yaydır", () => {
    // MTC "ÇEKME YAYI IKI UCU KANCALI Ø8xØ6 L=500" gerçek bir satırdır ve
    // `KANCA` ön ek olsaydı kaldırma aksesuarı sanılırdı.
    expect(satinAlmaSinifi("KANCA DIN15401 No:10")).toBe("Kaldırma Aksesuarı");
    expect(satinAlmaSinifi("ÇEKME YAYI IKI UCU KANCALI  Ø8xØ6 L=500")).toBe("Diğer");
  });

  it("YAYLI RONDELA bağlantı elemanıdır — yay kategorisi bilerek yoktur", () => {
    expect(satinAlmaSinifi("YAYLI RONDELA M10 DIN127   (GALVANİZLİ)")).toBe("Bağlantı Elemanı");
  });

  it("ÜNSÜZ YUMUŞAMASI: 'SÜBAP' ön eki 'SÜBABI'yı tutmaz, ikinci gövde şarttır", () => {
    // 0053-01 paketinde satır "BASINÇ TAHLİYE SÜBABI M10x1" olarak geçiyor.
    // Bu iddia, birileri `SÜBAB` gövdesini gereksiz sanıp silerse kırılır.
    expect(satinAlmaSinifi("BASINÇ TAHLİYE SÜBABI M10x1")).toBe("Bağlantı Elemanı");
    expect(satinAlmaSinifi("SÜBAP M10x1")).toBe("Bağlantı Elemanı");
  });

  it("marka da bir anahtardır: YILMAZ redüktöre, YATAK rulmana gider", () => {
    expect(satinAlmaSinifi("ARABA_YILMAZ_HT0824-i-118,42_M1 (Cift giris Tek cıkıs Sag Tertip)")).toBe(
      "Redüktör"
    );
    expect(satinAlmaSinifi("KARE YATAK - UCF 208")).toBe("Rulman");
  });

  it("DÜZELTME SÖZLÜĞÜ YENER — insanın kararı tahmine yenilmez", () => {
    // Sözlük bir tahmin, düzeltme bir karardır. "STEP AP214" hiçbir anahtara
    // uymaz ve "Diğer"e düşer; kullanıcı onu taşıdığında bir sonraki
    // eşleştirmede geri dönmemelidir.
    const parca = mtc.parts.find((p) => !p.partCode && p.description)!;
    const duzeltmeler = new Map([[trKatla(parca.description), "Hidrolik"]]);
    const sa = satinAlmaListesi(mtc.parts, { duzeltmeler, ekKategoriler: ["Hidrolik"] });
    const satir = sa.satirlar.find((s) => s.tanim === parca.description)!;
    expect(satir.sinif).toBe("Hidrolik");
    expect(satir.duzeltilmis).toBe(true);
    expect(sa.duzeltilmisKalem).toBe(1);
    // Dağılım da düzeltmeyi görür — özet ile satırlar ayrışamaz.
    expect(sa.siniflar.find((s) => s.sinif === "Hidrolik")?.satirSayisi).toBe(1);
  });

  it("KATEGORİ SIRASI: sözlük → kullanıcı kategorileri → Diğer", () => {
    // "Diğer" alfabetik olarak ortalara düşerdi; bir ürün ailesi gibi
    // görünmesin diye HER ZAMAN sondadır. Kullanıcının eklediği kategori
    // sözlüğün sırasını bozmaz, arkasına eklenir.
    const sira = satinAlmaKategoriSirasi(["Hidrolik", "Ambalaj"]);
    expect(sira[0]).toBe("Redüktör");
    expect(sira[sira.length - 1]).toBe("Diğer");
    expect(sira.slice(-3)).toEqual(["Hidrolik", "Ambalaj", "Diğer"]);
    // Sözlükte zaten olan bir ad ikinci kez eklenmez.
    expect(satinAlmaKategoriSirasi(["Rulman"])).toEqual(satinAlmaKategoriSirasi());
  });

  it("sınıflanamayan satır Diğer'e düşer ama LİSTEDEN DÜŞMEZ", () => {
    expect(satinAlmaSinifi("PLASTİK TAPA")).toBe("Diğer");
    const sa = satinAlmaListesi(monoray.parts);
    expect(sa.satirlar.some((s) => s.tanim.startsWith("DÜZ GRESÖRLÜK"))).toBe(true);
  });

  it("gerçek fikstürdeki dört tuzak satır grubu bağlantı elemanına düşer", () => {
    const sa = satinAlmaListesi(mtc.parts);
    const bul = (parca: string) =>
      sa.satirlar.filter((s) => s.tanim.includes(parca));
    // KALEM sayısı DEFTER SATIRI sayısından azdır (birleştirme); tuzağın
    // kendisi satır sayısında değil, sınıflandırmanın doğruluğundadır.
    // 7→8: `0043-00-0850`den geri gelen YAYLI RONDELA M8 (grup başına kazanan
    // sayfa kuralı). İMBUS CİVATA ise 3→4→3: aynı kural onu da geri getirdi,
    // sonra galvaniz birleşmesi galvanizsiz eşiyle tek kaleme indirdi.
    expect(bul("YAYLI RONDELA")).toHaveLength(8);
    expect(bul("YAYLI RONDELA").reduce((t, s) => t + s.sourceRows, 0)).toBe(18);
    expect(bul("YAYLI RONDELA").every((s) => s.sinif === "Bağlantı Elemanı")).toBe(true);
    expect(bul("İMBUS CİVATA")).toHaveLength(3);
    expect(bul("DELİK SEGMANI").every((s) => s.sinif === "Bağlantı Elemanı")).toBe(true);
    expect(bul("GUPİLYA").every((s) => s.sinif === "Bağlantı Elemanı")).toBe(true);
  });
});

// ————————————————————————————————————————————————————— 2. Sac ihtiyacı

describe("sac ihtiyacı", () => {
  const m = sacIhtiyaci(monoray.parts);
  const t = sacIhtiyaci(mtc.parts);

  it("MONORAY: 35 aday · 34 ölçülü · 15 grup · net 1,475 m²", () => {
    expect(m.adaySayisi).toBe(35);
    expect(m.olculuSayisi).toBe(34);
    expect(m.olcusuzSayisi).toBe(1);
    expect(m.gruplar).toHaveLength(15);
    expect(m.netAlanMm2).toBeCloseTo(1_475_468, 0);
    expect(m.brutAlanMm2).toBeCloseTo(1_844_335, 0);
  });

  it("MTC: 103 aday · 100 ölçülü · 26 grup · net 200,667 m²", () => {
    expect(t.adaySayisi).toBe(103);
    expect(t.olculuSayisi).toBe(100);
    expect(t.olcusuzSayisi).toBe(3);
    expect(t.gruplar).toHaveLength(26);
    expect(t.netAlanMm2 / 1e6).toBeCloseTo(200.667, 3);
    expect(t.brutAlanMm2 / 1e6).toBeCloseTo(250.833, 3);
  });

  it("en büyük grup MTC S355JR 8 mm: 34 parça · 103 adet · 162,438 m²", () => {
    const g = t.gruplar.find((x) => x.malzeme === "S355JR" && x.kalinlikMm === 8)!;
    expect(g.parcaSayisi).toBe(34);
    expect(g.adet).toBe(103);
    expect(g.netAlanMm2 / 1e6).toBeCloseTo(162.438, 3);
  });

  it("SESSİZLİK: ölçüsü çıkmayan parça gruptan DÜŞMEZ", () => {
    // Düşürülseydi bu iki grup listede hiç görünmezdi ve 60/70 mm sac
    // ihtiyacı sessizce sıfırlanırdı.
    const g60 = t.gruplar.find((x) => x.malzeme === "S355JR" && x.kalinlikMm === 60)!;
    expect(g60).toBeDefined();
    expect(g60.parcaSayisi).toBe(2);
    expect(g60.adet).toBe(3);
    expect(g60.netAlanMm2).toBe(0);
    expect(g60.olcusuzParca).toBe(2);
    expect(g60.parcalar.map((p) => p.tanim).sort()).toEqual(["MAKARA Ø280", "MAKARA Ø350"]);

    const g70 = t.gruplar.find((x) => x.malzeme === "S355JR" && x.kalinlikMm === 70)!;
    expect(g70.olcusuzParca).toBe(1);
    expect(g70.parcalar[0].tanim).toBe("KARE DEMİR 130x130 L=214");
  });

  it("YERLEŞİM PAYI bir GİRDİDİR: net değişmez, brüt orantılı değişir", () => {
    const bir = sacIhtiyaci(mtc.parts, { yerlesimPayi: 1 });
    const birBucuk = sacIhtiyaci(mtc.parts, { yerlesimPayi: 1.6 });
    expect(bir.netAlanMm2).toBe(t.netAlanMm2);
    expect(birBucuk.netAlanMm2).toBe(t.netAlanMm2);
    expect(bir.brutAlanMm2).toBe(bir.netAlanMm2);
    expect(birBucuk.brutAlanMm2 / 1e6).toBeCloseTo(321.067, 3);
    // Payın TAHMİN değil GİRDİ olduğu belgede görünmeli.
    expect(t.payKaynagi).toBe("girdi");
    expect(t.yerlesimPayi).toBe(1.25);
  });

  it("ölçü kaynağı kayda geçer — Faz V2 extents'i doldurunca değişecek", () => {
    const olculu = t.gruplar.flatMap((g) => g.parcalar).filter((p) => p.olculu);
    expect(olculu.every((p) => p.olcuKaynagi === "tanim")).toBe(true);

    // extents gelirse tanımın önüne geçer.
    const sahte = sacIhtiyaci([
      { ...mtc.parts.find((p) => p.partCode === "0043-00-0600-04")!, extentsXMm: 400, extentsYMm: 350 },
    ]);
    expect(sahte.gruplar[0].parcalar[0].olcuKaynagi).toBe("extents");
    expect(sahte.gruplar[0].olcusuzParca).toBe(0);
  });
});

// ———————————————————————————————————————————————————— 3. Testere kesim

describe("testere / profil kesim", () => {
  const m = testereKesim(monoray.parts);
  const t = testereKesim(mtc.parts);

  it("MONORAY: 6 satır · 837,3 mm · 3 uyuşmazlık", () => {
    expect(m.satirlar).toHaveLength(6);
    expect(m.toplamBoyMm).toBeCloseTo(837.3, 1);
    expect(m.uyusmazlik).toBe(3);
  });

  it("MONORAY 0057-00-0700-07 → 169,3 mm ve satır TUTARLI", () => {
    const s = m.satirlar.find((x) => x.parcaKodu === "0057-00-0700-07")!;
    expect(s.adet).toBe(1);
    expect(s.birimBoyMm).toBeCloseTo(169.3, 1);
    expect(s.toplamBoyMm).toBeCloseTo(169.3, 1);
    expect(s.kesit).toBe("MİL Ø40");
    expect(s.tutarli).toBe(true);
  });

  it("MTC: 23 satır · 14 kesit · 307,32 m · 7 uyuşmazlık", () => {
    expect(t.satirlar).toHaveLength(23);
    expect(t.kesitler).toHaveLength(14);
    expect(t.toplamBoyMm).toBe(307_322);
    expect(t.uyusmazlik).toBe(7);
  });

  it("ÇARPMA YAPILMAZ: 0043-00-0100-13 üç sayıyı da taşır", () => {
    // Defter "4 adet" ve "47 000 mm" diyor; çarpım 94 000 mm eder. İkisi iki
    // ayrı Excel sayfasından geliyor ve kaynağında tutarsız — hiçbiri
    // diğerinden türetilmez, uyuşmazlık işaretlenir.
    const s = t.satirlar.find((x) => x.parcaKodu === "0043-00-0100-13")!;
    expect(s.adet).toBe(4);
    expect(s.birimBoyMm).toBe(23_500);
    expect(s.toplamBoyMm).toBe(47_000);
    expect(s.beklenenToplamMm).toBe(94_000);
    expect(s.tutarli).toBe(false);

    // Toplam metraja DEFTERİN sayısı girer, çarpım değil.
    const npl = t.kesitler.find((k) => k.kesit === "NPL 50x50x5")!;
    expect(npl.satirSayisi).toBe(3);
    expect(npl.toplamBoyMm).toBe(92_900); // 47000 + 45600 + 300
  });

  it("kesit anahtarı boy kuyruğu atılarak kurulur", () => {
    expect(t.kesitler.find((k) => k.kesit === "NPU 80")!.toplamBoyMm).toBe(11_670);
    expect(t.kesitler.find((k) => k.kesit === "LAMA 120x10")!.toplamBoyMm).toBe(93_900);
    // `L=` taşımayan yazımda boy ölçü zincirinin SONUNCUSUDUR.
    const kare = t.satirlar.find((x) => x.parcaKodu === "0043-00-0900-01")!;
    expect(kare.tanim).toBe("KARE DEMİR 30x40x23800");
    expect(kare.kesit).toBe("KARE DEMİR 30x40");
    expect(kare.birimBoyMm).toBe(23_800);
  });

  it("iki sayılı kesitte son sayı BOY DEĞİLDİR", () => {
    // "LAMA 120x10" bir kesittir; 10'u boy saymak metrajı yok ederdi.
    const lama = t.satirlar.find((x) => x.parcaKodu === "0043-00-0900-03")!;
    expect(lama.kesit).toBe("LAMA 120x10");
    expect(lama.birimBoyMm).toBe(3_900);
  });
});

// ———————————————————————————————————————————————————— 4. Kesim listesi

describe("kesim listesi (DXF)", () => {
  const m = kesimListesi(monoray.parts, monoray.files);
  const t = kesimListesi(mtc.parts, mtc.files);

  it("MONORAY: 35 DXF · 15 grup · 12,1 MB", () => {
    expect(m.dosyaSayisi).toBe(35);
    expect(m.gruplar).toHaveLength(15);
    expect(m.boyutBayt).toBe(12_115_847);
    expect(m.bagsizDosya).toBe(0);
  });

  it("MTC: 99 DXF · 23 grup · 35,6 MB", () => {
    expect(t.dosyaSayisi).toBe(99);
    expect(t.gruplar).toHaveLength(23);
    expect(t.boyutBayt).toBe(35_551_977);
    expect(t.bagsizDosya).toBe(0);
  });

  it("DEFTERİN grupları ile DOSYALARIN grupları aynı olmak zorunda değil", () => {
    // MONORAY'da `S355JR 35 mm` iki listede de var ama sac ihtiyacında ölçüsüz
    // duruyor: `0057-00-0700-02` hem testere kalemi hem DXF'li. İki fonksiyonu
    // birleştirmek, kesimciye giden dosya sayısını defterin yorumuna bağlardı.
    expect(m.gruplar.some((g) => g.malzeme === "S355JR" && g.kalinlikMm === 35)).toBe(true);
    expect(sacIhtiyaci(monoray.parts).gruplar).toHaveLength(15);
  });

  it("kopya ve süperse edilmiş dosyalar listeye girmez", () => {
    const tumDxf = monoray.files.filter((f) => f.role === "kesim");
    expect(tumDxf.length).toBeGreaterThanOrEqual(m.dosyaSayisi);
    expect(m.gruplar.flatMap((g) => g.dosyalar).length).toBe(m.dosyaSayisi);
  });
});

// ——————————————————————————————————————————————————— 5. İmalat listesi

describe("imalat listesi", () => {
  const monoKok = imalatKokleri(monoray.parts, monoray.itemNo);
  const mtcKok = imalatKokleri(mtc.parts, mtc.itemNo);
  const monoTum = imalatListesi(monoray.parts);
  const mtcTum = imalatListesi(mtc.parts);

  it("MONORAY: 9 kök · 71 satır · ağırlık yok", () => {
    expect(monoKok).toHaveLength(9);
    expect(monoTum.satirlar).toHaveLength(71);
    // Ürün ağacı olmayan pakette toplam 0 DEĞİL null olmalı.
    expect(monoTum.yaprakAgirlikKg).toBeNull();
    expect(monoTum.kokAgirlikKg).toBeNull();
  });

  it("KOPMUŞ DAL da köktür — yoksa beş parça hiçbir seçimde görünmezdi", () => {
    // `0057-00-0600-00-01`in ürün ağacındaki üstü `0057-00-0600-00` defterde
    // YOK. Yalnız "üstü boş" olanları kök saysaydık bu dal ve dört çocuğu
    // kaybolurdu.
    const kopuk = monoKok.filter((k) => k.kopuk);
    expect(kopuk.map((k) => k.partCode)).toEqual(["0057-00-0600-00-01"]);
    expect(kopuk[0].parcaSayisi).toBe(5);
    // Köklerin alt ağaçlarının toplamı bütün kodlu parçaları KAPSAR.
    expect(monoKok.reduce((t, k) => t + k.parcaSayisi, 0)).toBe(monoTum.satirlar.length);
  });

  it("MTC: 13 kök · 175 satır", () => {
    expect(mtcKok).toHaveLength(13);
    expect(mtcTum.satirlar).toHaveLength(175);
    expect(mtcKok.reduce((t, k) => t + k.parcaSayisi, 0)).toBe(mtcTum.satirlar.length);
  });

  it("ÇİFT SAYIM YOK: toplam yaprak satırlardan alınır", () => {
    // Naif toplam (bütün satırlar) 21 209 kg der; gerçek 9 259,3 kg'dır.
    const naif = mtc.parts.reduce((t, p) => t + (p.weightKg ?? 0) * (p.qty ?? 1), 0);
    expect(naif).toBeCloseTo(21_209.0, 0);
    expect(mtcTum.yaprakAgirlikKg).toBeCloseTo(9_259.3, 1);
    expect(mtcTum.kokAgirlikKg).toBeCloseTo(10_047.8, 1);
    expect(mtcTum.yaprakAgirlikKg).toBeLessThan(naif / 2);
  });

  it("ANAKİRİŞ alt ağacı: montajın ağırlığı çocuklarının toplamıdır", () => {
    const alt = imalatListesi(mtc.parts, "0043-00-0100");
    expect(alt.satirlar).toHaveLength(25);
    // Kökün KENDİ beyanı 1498,457 × 2 = 2996,914; 24 çocuğun toplamı 2996,920.
    expect(alt.kokAgirlikKg).toBeCloseTo(2996.914, 3);
    expect(alt.yaprakAgirlikKg).toBeCloseTo(2996.92, 2);
    // İkisi BİRBİRİNE eklenmez: fark 0,01 kg'dır, 2996 kg değil.
    expect(Math.abs((alt.yaprakAgirlikKg ?? 0) - (alt.kokAgirlikKg ?? 0))).toBeLessThan(1);
  });

  it("kök seçimi süzer, sıralama `sort` alanından gelir", () => {
    const alt = imalatListesi(mtc.parts, "0043-00-0800");
    expect(alt.satirlar).toHaveLength(92);
    expect(alt.satirlar[0].partCode).toBe("0043-00-0800");
    expect(alt.satirlar[0].duzey).toBe(1);
    const siralar = alt.satirlar.map((s) => s.partCode);
    const defterSirasi = mtc.parts
      .filter((p) => siralar.includes(p.partCode))
      .sort((a, b) => a.sort - b.sort)
      .map((p) => p.partCode);
    expect(siralar).toEqual(defterSirasi);
  });

  it("kök etiketi description'dan gelir; MONORAY'da çıplak koddur", () => {
    // MTC köklerinde `assembly_title` bütün vincin adıdır ("15Tx24M KÖPRÜLÜ
    // TAVAN VİNÇ") ve ayırt etmez; ayırt eden `description`dır.
    expect(mtcKok.find((k) => k.partCode === "0043-00-0100")!.etiket).toBe("ANAKİRİŞ");
    expect(mtcKok.find((k) => k.partCode === "0043-00-0900")!.etiket).toBe("RAY YURUME YOLU");
    // MONORAY'da üçü de boş — bu normaldir, kod etiketin kendisi olur.
    expect(monoKok.find((k) => k.partCode === "0057-00-0700")!.etiket).toBe("0057-00-0700");
  });

  it("HAYALET KÖK gizlenmez, işaretlenir", () => {
    // `0043-01-0000` yanlış adlandırılmış bir Excel'den gelir ve klasörle
    // çelişir. Silmek veri kaybı olurdu.
    const hayalet = mtcKok.filter((k) => k.baskaKalem);
    expect(hayalet.map((k) => k.partCode)).toEqual(["0043-01-0000"]);
  });

  it("'tumu' anahtarı bütün ormanı seçer", () => {
    expect(imalatListesi(mtc.parts, "tumu").satirlar).toHaveLength(175);
    expect(imalatListesi(mtc.parts, "").satirlar).toHaveLength(175);
  });
});

// ————————————————————————————————————————————— 6. Belge kimliği ve saflık

describe("belge kimliği", () => {
  it("docCode 'TR' türünü tanır, HR/EQ davranışı değişmez", () => {
    expect(docCode("TR", "0057-00-0500", 1)).toBe("ORC-TR-0057-00-0500-R01");
    expect(docCode("HR", "0055", 1)).toBe("ORC-HR-0055-R01");
    expect(docCode("EQ", "0055", 12)).toBe("ORC-EQ-0055-R12");
  });

  it("indirme adı firma düzenini izler", () => {
    expect(
      downloadFileName(
        ["0057-00 MONORAY (1 TON)", docCode("TR", "0057-00-0500", 1), "Satın Alma Listesi"],
        "xlsx"
      )
    ).toBe("0057-00 MONORAY (1 TON) - ORC-TR-0057-00-0500-R01 - SATIN ALMA LİSTESİ.xlsx");
  });
});

// ————————————————————————————————————————————— 7. Çalışma kitapları
//
// Excel katmanı `derive`in tek tüketicisidir ve iki hatası birim testiyle
// yakalanır: SAYFA ADI ÇAKIŞMASI (exceljs yinelenen ada hata fırlatır) ve
// kitabın hiç kurulamaması. Dosyanın gerçekten yazılıp geri okunduğu duman
// testindedir (`scripts/test-drawings-outputs.ts`).

describe("çalışma kitapları", () => {
  const meta = {
    paketAdi: "0043-00 MTC PASLANMAZ",
    belgeKodu: docCode("TR", "0043-00-0000", 1),
    klasorAdi: "0043-00-0000_MTC PASLANMAZ",
    kalemNo: "0043-00",
    generatedAt: "10.08.2026 09:00",
    preparedBy: "Koruma Testi",
  };

  const satinAlmaKitabi = () =>
    buildSatinAlmaWorkbook(
      {
        satinAlma: satinAlmaListesi(mtc.parts),
        sac: sacIhtiyaci(mtc.parts),
        testere: testereKesim(mtc.parts),
      },
      meta
    );

  it("satın alma kitabı dört sayfadır", () => {
    expect(satinAlmaKitabi().worksheets.map((w) => w.name)).toEqual([
      "Satın Alınacaklar",
      "Sac İhtiyacı",
      "Profil-Testere Kesim",
      "Künye",
    ]);
  });

  it("künye BİRLEŞTİRMEYİ açıkça söyler ve TOPLAM birleşik sayıyı yazar", () => {
    // Dosya e-postayla dolaşır; "74 kalem" gören satınalmacı defterde 96 satır
    // olduğunu ve hangilerinin birleştiğini dosyanın İÇİNDEN öğrenebilmeli.
    const wb = satinAlmaKitabi();
    const metin: string[] = [];
    wb.getWorksheet("Künye")!.eachRow((row) => row.eachCell((c) => metin.push(String(c.value ?? ""))));
    expect(metin.some((t) => t.includes("TEK SATIRDA BİRLEŞTİRİLDİ"))).toBe(true);
    expect(metin.some((t) => t.includes("96 defter satırı 74 kaleme indi"))).toBe(true);
    expect(metin).toContain("Satın alma kalemi");
    expect(metin).toContain("Kaynak defter satırı");

    const liste = wb.getWorksheet("Satın Alınacaklar")!;
    const toplamSatiri = liste.getRow(5 + 1 + 74);
    expect(String(toplamSatiri.getCell(1).value)).toBe("TOPLAM");
    expect(String(toplamSatiri.getCell(2).value)).toBe(
      "74 kalem · 96 defter satırı (13 kalem birleşti)"
    );
    expect(toplamSatiri.getCell(4).value).toBe(611);
    expect(toplamSatiri.getCell(8).value).toBe(96);
  });

  it("MALZEME ÇELİŞKİSİ Excel hücresinde de görünür", () => {
    const celiskili: TurevParca[] = [
      { ...mtc.parts.find((p) => !p.partCode)!, description: "PİM Ø20", material: "S235JR", qty: 1 },
      { ...mtc.parts.find((p) => !p.partCode)!, description: "PİM Ø20", material: "S355JR", qty: 1 },
    ];
    const wb = buildSatinAlmaWorkbook(
      {
        satinAlma: satinAlmaListesi(celiskili),
        sac: sacIhtiyaci(celiskili),
        testere: testereKesim(celiskili),
      },
      meta
    );
    expect(String(wb.getWorksheet("Satın Alınacaklar")!.getRow(6).getCell(3).value)).toBe(
      "S235JR / S355JR"
    );
  });

  it("SOMUN M16'nın dört kaynağı Excel hücresinde durur", () => {
    const liste = satinAlmaKitabi().getWorksheet("Satın Alınacaklar")!;
    let bulundu = 0;
    liste.eachRow((row) => {
      if (String(row.getCell(2).value ?? "") !== "SOMUN M16 DIN934 (GALVANİZLİ)") return;
      bulundu += 1;
      expect(row.getCell(4).value).toBe(65);
      expect(row.getCell(8).value).toBe(5);
      expect(String(row.getCell(9).value)).toContain("0043-00-0300 (3.14) ×2");
    });
    // TEK SATIR: galvanizsiz yazılmış eşi ayrı bir satır olarak KALMAZ.
    expect(bulundu).toBe(1);
  });

  it("kesim kitabı grup başına sayfa açar; adlar TEKİL ve ≤31 karakterdir", () => {
    const wb = buildKesimWorkbook({ kesim: kesimListesi(mtc.parts, mtc.files) }, meta);
    const adlar = wb.worksheets.map((w) => w.name);
    expect(adlar).toHaveLength(25); // 23 grup + Özet + Künye
    expect(adlar[0]).toBe("Özet");
    expect(adlar[adlar.length - 1]).toBe("Künye");
    expect(new Set(adlar).size).toBe(adlar.length);
    expect(adlar.every((a) => a.length <= 31)).toBe(true);
  });

  it("SAYFA ADI ÇAKIŞMASI sayaçla çözülür — exceljs yinelenen ada hata verir", () => {
    // Malzeme adı uzunsa 31 karakterde kırpılır ve iki ayrı grup aynı dizgeye
    // inebilir. Sentetik iki grup tam olarak bu durumu kurar.
    const uzun = "PASLANMAZ ÇELİK AISI 304 KALİTE ÖZEL";
    const sahte = [
      { ...mtc.parts.find((p) => p.partCode === "0043-00-0100-01")!, material: uzun, thicknessMm: 8 },
      { ...mtc.parts.find((p) => p.partCode === "0043-00-0100-02")!, material: `${uzun} B`, thicknessMm: 8 },
    ];
    const dosyalar: KesimDosyasi[] = sahte.map((p, i) => ({
      relPath: `DXF/${p.partCode}.dxf`,
      fileName: `${p.partCode}.dxf`,
      role: "kesim" as const,
      lifecycle: "canli" as const,
      partCode: p.partCode,
      material: i === 0 ? uzun : `${uzun} B`,
      thicknessMm: 8,
      qty: 1,
      size: 1000,
    }));
    const wb = buildKesimWorkbook({ kesim: kesimListesi(sahte, dosyalar) }, meta);
    const adlar = wb.worksheets.map((w) => w.name);
    expect(new Set(adlar).size).toBe(adlar.length);
    expect(adlar.filter((a) => a.startsWith("PASLANMAZ"))).toHaveLength(2);
  });

  it("imalat kitabı kök seçimini künyesine yazar", () => {
    const kokler = imalatKokleri(mtc.parts, mtc.itemNo);
    const wb = buildImalatWorkbook(
      { imalat: imalatListesi(mtc.parts, "0043-00-0100"), kokler },
      meta
    );
    expect(wb.worksheets.map((w) => w.name)).toEqual(["İmalat Listesi", "Künye"]);
    const kunye = wb.getWorksheet("Künye")!;
    const metin: string[] = [];
    kunye.eachRow((row) => row.eachCell((c) => metin.push(String(c.value ?? ""))));
    expect(metin.some((t) => t.includes("0043-00-0100") && t.includes("ANAKİRİŞ"))).toBe(true);
    // Künye ağırlığın neden yaprak bazında toplandığını AÇIKÇA söylemeli.
    expect(metin.some((t) => t.includes("AĞIRLIK ÜST ÜSTE EKLENMEZ"))).toBe(true);
  });

  it("ürün ağacı olmayan pakette künye 'ağırlık yok' der, sıfır demez", () => {
    const wb = buildImalatWorkbook(
      { imalat: imalatListesi(monoray.parts), kokler: imalatKokleri(monoray.parts) },
      meta
    );
    const kunye = wb.getWorksheet("Künye")!;
    const metin: string[] = [];
    kunye.eachRow((row) => row.eachCell((c) => metin.push(String(c.value ?? ""))));
    expect(metin).toContain("—"); // yaprak toplamı yerine tire
    expect(metin.some((t) => t.includes("ürün ağacı yok"))).toBe(true);
  });
});

describe("çekirdek SAF kalır", () => {
  it("derive.ts DB/HTTP/dosya sistemi içe aktarmaz", () => {
    const kaynak = readFileSync(join(process.cwd(), "src/lib/drawings/derive.ts"), "utf-8");
    const importlar = [...kaynak.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]);
    // `./progress` de bu klasörün saf çekirdeğidir ve satın alma kimliğinin
    // TEK sahibidir: anahtar kuralını burada ikinci kez yazmak, iki belgenin
    // aynı paket için farklı sayı söylemesine yol açan çatlağı geri getirirdi.
    expect(importlar.sort()).toEqual(["./progress", "./tr-text", "./types"]);
    for (const yasak of ["@supabase", "next/", "node:", "exceljs"]) {
      expect(kaynak.includes(yasak), `${yasak} çekirdeğe girmemeli`).toBe(false);
    }
  });
});
