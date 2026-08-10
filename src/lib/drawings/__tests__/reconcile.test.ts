// Eşleştirme — KORUMA TESTİ.
//
// İki gerçek paket baştan sona işlenir ve elle yapılmış çözümleme dondurulur.
// En değerli iddialar SESSİZLİK iddialarıdır: montajların BOM satırı olmaması
// ve satın alınan DIN kalemlerinin resmi olmaması bulgu ÜRETMEZ. Yanlış alarm
// bu modülün en büyük düşmanı — bir kez güvenini kaybeden rapora kimse
// bakmaz.

import { describe, expect, it } from "vitest";
import { parseBomFileName, parseFile } from "../file-name";
import { parseFolderName } from "../folder-name";
import { readSheet } from "../excel";
import { reconcile, type PackageSnapshot, type ReconcileResult } from "../reconcile";
import { MONORAY, MTC, type FixturePackage } from "./fixtures/packages";
import { MONORAY_SHEETS, MTC_SHEETS, type FixtureSheet } from "./fixtures/bom-sheets";

function anlikGoruntu(pkg: FixturePackage, sheets: FixtureSheet[]): PackageSnapshot {
  const files = pkg.files.map((f) =>
    parseFile({ relPath: f.path, size: f.size, checksum: f.hash })
  );
  // İPTAL altındaki Excel'ler eski sürümdür; defter CANLI olandan kurulur.
  const bom = sheets
    .filter((s) => !s.file.split("/").some((seg) => seg === "İPTAL"))
    .flatMap((s) =>
      readSheet(
        { fileRelPath: s.file, sheetName: s.sheet, rows: s.rows },
        parseBomFileName(s.file.split("/").pop() ?? "").kind
      ).rows
    );
  return { folderName: pkg.folder, folder: parseFolderName(pkg.folder).value, files, bom };
}

/** Antetin boş hâli — testte yalnız ilgilenilen alan doldurulur. */
function bosAntet() {
  return {
    drawingNo: "", projectNo: "", jobName: "", parentProject: "", customer: "",
    weightKg: null as number | null, weightNA: false, qty: null as number | null,
    material: "", scale: "", sheetSize: "", sheetNo: "", drawnBy: "",
    approvedBy: "", dateIso: "", approvedDateIso: "", revision: "",
  };
}

const monoray = reconcile(anlikGoruntu(MONORAY, MONORAY_SHEETS));
const mtc = reconcile(anlikGoruntu(MTC, MTC_SHEETS));

const say = (r: ReconcileResult, code: string) => r.findings.filter((f) => f.code === code).length;
const konular = (r: ReconcileResult, code: string) =>
  r.findings.filter((f) => f.code === code).map((f) => f.subject).sort();

describe("MONORAY — elle yapılan çözümleme dondurulur", () => {
  it("tam BİR imalat parçasının hiç resmi yok", () => {
    // MİL Ø45x164 (170) · Normal · Talaşlı İmalat — üretilecek, çizimi yok.
    // Modülün ilk günden kazandırdığı somut kusur budur.
    expect(konular(monoray, "PARCA_RESIMSIZ")).toEqual(["0057-00-0600-00-01-04"]);
  });

  it("bir parçanın kesim dosyası var, ölçülü resmi yok", () => {
    expect(konular(monoray, "KESIM_RESIMSIZ")).toEqual(["0057-00-0700-17"]);
  });

  it("BÜKÜM PDF'lerinin üçü de kopya olarak işaretlenir", () => {
    expect(say(monoray, "KOPYA_DOSYA")).toBe(3);
    const kopya = monoray.fileDecisions.filter((d) => d.lifecycle === "kopya");
    expect(kopya).toHaveLength(3);
    expect(kopya.every((d) => d.duplicateOfRelPath.startsWith("DWG/"))).toBe(true);
  });

  it("İPTAL altındaki dört dosya canlı sürümlerine bağlanır", () => {
    // DWG/İPTAL: 0057-00-0500 ve 0057-00-1000-08'in dwg+pdf'i.
    expect(say(monoray, "IPTAL_SURUM")).toBe(4);
    expect(say(monoray, "IPTAL_YETIM")).toBe(1); // EXCEL/İPTAL'deki eski BOM
  });

  it("beş haneli yazım hatası düzeltilir ve kayda geçer", () => {
    expect(say(monoray, "AD_DUZELTILDI")).toBe(1);
  });

  it("iki _Sheet çalışma dosyası hariç tutulur", () => {
    expect(say(monoray, "YEDEK_DOSYA")).toBe(2);
  });

  it("klasör-dosya malzeme çelişkisi yakalanır", () => {
    expect(say(monoray, "DXF_KLASOR_CELISKISI")).toBe(2);
  });

  it("0900 ile 0901 aynı adı taşıyor — bilgi olarak geçilir", () => {
    expect(konular(monoray, "GRUP_BOLUNMUS")).toEqual(["0900 + 0901"]);
  });

  it("tanıma oranı tam", () => {
    expect(monoray.recognition.unrecognized).toEqual([]);
    expect(monoray.recognition.pct).toBe(100);
  });
});

describe("MTC — ikinci paket, farklı yapı", () => {
  it("454 dosyanın hepsi işlenir, 10 yedek hariç tutulur", () => {
    expect(mtc.fileDecisions).toHaveLength(454);
    expect(say(mtc, "YEDEK_DOSYA")).toBe(10);
  });

  it("tam BİR imalat parçasının resmi eksik — 12 testere kalemi yanlış alarm DEĞİL", () => {
    // İlk sürüm 13 bulgu basıyordu; 12'si `NPL 50x50x5 L=23500` gibi boya
    // kesilen standart profildi ve tanımın kendisi imalat talimatıdır.
    expect(konular(mtc, "PARCA_RESIMSIZ")).toEqual(["0043-00-0802-00-01-04"]);
  });

  it("iki farklı parça aynı PDF'i taşıyor — çelişki olarak bildirilir", () => {
    // Gerçek ressam hatası: -04'ün PDF'i -02'nin içeriği. Bunu "kopya" sayıp
    // birini düşürmek, hangisinin yanlış olduğunu bildiğimizi varsaymak olurdu.
    expect(konular(mtc, "AYNI_ICERIK_FARKLI_PARCA")).toEqual(["0043-00-0400-04"]);
    const kararlar = mtc.fileDecisions.filter((d) =>
      d.relPath.includes("0043-00-0400-04.pdf")
    );
    expect(kararlar[0].lifecycle).toBe("canli");
  });

  it("Excel dosya adındaki kalem eki hatası yakalanır", () => {
    // Ad `0043-01-0000` diyor; klasör ve bütün satırlar `0043-00` diyor.
    expect(say(mtc, "EXCEL_ADI_KALEM_FARKI")).toBe(4);
  });

  it("ürün ağacı ile koddan türetilen ağaç çeliştiğinde ürün ağacı kazanır", () => {
    // Koda göre `0043-00-0802-00-01`in üstü `0043-00-0802-00` olurdu; ürün
    // ağacı ise araya bir düzey KOYMAZ — `-00-` yalnız bir numaralandırma
    // boşluğu, Inventor'da karşılığı olan bir montaj değil.
    expect(say(mtc, "AGAC_CELISKISI")).toBe(2);
    const p = mtc.parts.find((x) => x.partCode === "0043-00-0802-00-01")!;
    expect(p.itemPath).toBe("6.9.1");
    expect(p.parentCode).toBe("0043-00-0802");

    // Bir alt düzeyde iki kaynak zaten uyuşuyor; orada çelişki basılmaz.
    const alt = mtc.parts.find((x) => x.partCode === "0043-00-0802-00-01-01")!;
    expect(alt.parentCode).toBe("0043-00-0802-00-01");
  });

  it("ürün ağacı ağırlıkları deftere geçer — PDF okunmadan", () => {
    const agirlikli = mtc.parts.filter((p) => p.weightKg != null);
    expect(agirlikli.length).toBeGreaterThan(200);
    const anakiris = mtc.parts.find((p) => p.partCode === "0043-00-0100")!;
    expect(anakiris.weightKg).toBeCloseTo(1498.457, 3);
  });

  it("ürün ağacı hiyerarşisi deftere geçer", () => {
    const derin = mtc.parts.find((p) => p.partCode === "0043-00-0802-00-01-01")!;
    expect(derin.itemPath).toBe("6.9.1.1");
  });

  it("tanıma oranı yüksek", () => {
    expect(mtc.recognition.pct).toBeGreaterThanOrEqual(90);
  });

  it("kesim boyları kirli QTY sütunundan çıkarılır", () => {
    const boylu = mtc.parts.filter((p) => p.cutLengthMm != null);
    expect(boylu.length).toBeGreaterThan(0);
  });
});

describe("SESSİZLİK — yanlış alarm basılmayan durumlar", () => {
  it("BOM satırı olmayan montaj kodları bulgu üretmez", () => {
    // 0057-00-0500 · 0510 · 0600 · 0700 · 0800 · 0900 · 0901 · 1000 —
    // hepsi montajın kendisi; parça listesinde satırları olmaması doğrudur.
    const montajlar = ["0057-00-0500", "0057-00-0510", "0057-00-0600", "0057-00-1000"];
    for (const kod of montajlar) {
      const p = monoray.parts.find((x) => x.partCode === kod);
      expect(p, `${kod} defterde olmalı`).toBeDefined();
      expect(p!.kind).toBe("montaj");
      expect(monoray.findings.filter((f) => f.subject === kod && f.kind === "eksik")).toEqual([]);
    }
  });

  it("satın alınan DIN kalemlerinin resmi olmaması bulgu üretmez", () => {
    const dinler = [
      "0057-00-0700-14", // GİJON M6x72 DIN976
      "0057-00-1000-11", // KAMA 6x6x70 DIN 6885
      "0057-00-1000-12",
      "0057-00-1000-13",
    ];
    for (const kod of dinler) {
      const p = monoray.parts.find((x) => x.partCode === kod);
      expect(p, `${kod} defterde olmalı`).toBeDefined();
      expect(p!.kind).toBe("satinalma");
      expect(monoray.findings.filter((f) => f.subject === kod && f.kind === "eksik")).toEqual([]);
    }
  });

  it("boya kesilen standart profil için resim BEKLENMEZ", () => {
    // NPL · NPU · LAMA · KARE DEMİR · BORU — testereciye verilecek başka bilgi
    // yoktur, tanımın kendisi imalat talimatıdır.
    const testereler = [
      "0043-00-0100-13", // NPL 50x50x5 L=23500
      "0043-00-0100-14", // KARE DEMİR 30x40x24000
      "0043-00-0400-11", // DİKİŞLİ BORU Ø33,7x3,25 L=23274
      "0043-00-0900-02", // LAMA 120x10 L=6000 mm
    ];
    for (const kod of testereler) {
      const p = mtc.parts.find((x) => x.partCode === kod);
      expect(p, `${kod} defterde olmalı`).toBeDefined();
      expect(p!.category).toBe("Testere");
      expect(mtc.findings.filter((f) => f.subject === kod && f.kind === "eksik")).toEqual([]);
    }
  });

  it("alt montajdan DXF beklenmez", () => {
    // TAMBUR SEHBASI kategorisi Plazma yazılmış ama altı parçalı bir montaj.
    const p = mtc.parts.find((x) => x.partCode === "0043-00-0802-00-02")!;
    expect(p.kind).toBe("montaj");
    expect(mtc.findings.filter((f) => f.subject === p.partCode && f.code === "DXF_BEKLENEN_YOK"))
      .toEqual([]);
  });

  it("aynı başlığı paylaşan ALT montajlar grup bölünmesi sayılmaz", () => {
    // MTC'de 0051/0052/0053 hepsi "BARA AKIM ALMA KOLU" başlığını taşır ve bu
    // doğrudur. Gevşek kural yedi yanlış alarm üretiyordu.
    expect(say(mtc, "GRUP_BOLUNMUS")).toBe(0);
    // MONORAY'daki gerçek durum (bitişik iki grup) yakalanmaya devam eder.
    expect(say(monoray, "GRUP_BOLUNMUS")).toBe(1);
  });

  it("içerik okunmadı uyarısı PAKET BAŞINA TEK bulgudur", () => {
    // Dosya başına yazılsaydı MONORAY 104, MTC 270 satır üretirdi ve rapordaki
    // gerçek bulgular (16 ve 31 bilgi) o gürültünün içinde kaybolurdu.
    expect(say(monoray, "ICERIK_OKUNMADI")).toBe(1);
    expect(say(mtc, "ICERIK_OKUNMADI")).toBe(1);
  });

  it("içerik verilmediğinde hiçbir bulgu KAYMAZ", () => {
    // İçerik okuma İSTEĞE BAĞLIDIR: `content` yokken defter Faz 1 davranışında
    // kalır. Eksik ve çelişki sayıları içerik zincirinden ÖNCEKİ ölçümle aynı.
    expect(monoray.findings.filter((f) => f.kind === "eksik")).toHaveLength(2);
    expect(monoray.findings.filter((f) => f.kind === "celiski")).toHaveLength(2);
    expect(mtc.findings.filter((f) => f.kind === "eksik")).toHaveLength(5);
    expect(mtc.findings.filter((f) => f.kind === "celiski")).toHaveLength(9);
  });

  it("içerik verildiğinde ağırlık antetten gelir ve kaynağı yazılır", () => {
    // MONORAY'da ürün ağacı YOK: 62 kodlu parçanın hiçbirinin ağırlığı bilinmiyor.
    // Antet okunduğunda o boşluk dolar — V2'nin bu pakette var oluş sebebi bu.
    const kod = "0057-00-0510-01";
    const resim = MONORAY.files.find((f) => f.path === `DWG/${kod}.pdf`);
    expect(resim, "fikstürde bu resim olmalı").toBeDefined();

    const icerikli = reconcile({
      ...anlikGoruntu(MONORAY, MONORAY_SHEETS),
      content: {
        [resim!.path]: {
          titleBlock: { ...bosAntet(), weightKg: 4.1, material: "S235JR" },
        },
      },
    });

    const p = icerikli.parts.find((x) => x.partCode === kod)!;
    expect(p.weightKg).toBeCloseTo(4.1, 3);
    expect(p.weightSource).toBe("antet");

    // Ve Excel'den gelen bir ağırlık antetle EZİLMEZ.
    const mtcAgirlikli = mtc.parts.find((x) => x.partCode === "0043-00-0100")!;
    expect(mtcAgirlikli.weightSource).toBe("excel");
  });

  it("depo eksiği BİLDİRİLMEDİĞİNDE hiçbir bulgu üretilmez", () => {
    // `missingStorage` İSTEĞE BAĞLIDIR ve çekirdek deponun varlığından
    // habersizdir. Verilmediğinde bulgu SUSAR — fikstürler, betikler ve
    // önizleme sayfası bu yüzden hiç değişmedi.
    expect(say(monoray, "DOSYA_DEPODA_YOK")).toBe(0);
    expect(say(mtc, "DOSYA_DEPODA_YOK")).toBe(0);
  });

  it("depoya ulaşmayan dosyalar PAKET BAŞINA TEK bulgu üretir", () => {
    // Dosya başına yazılsaydı 162 satır ederdi; `ICERIK_OKUNMADI` dersinde
    // bunun bedelini zaten ölçtük.
    const eksikli = reconcile({
      ...anlikGoruntu(MONORAY, MONORAY_SHEETS),
      missingStorage: MONORAY.files.slice(0, 162).map((f) => f.path),
    });
    const bulgular = eksikli.findings.filter((f) => f.code === "DOSYA_DEPODA_YOK");
    expect(bulgular).toHaveLength(1);
    expect(bulgular[0].kind).toBe("eksik");
    expect(bulgular[0].title).toContain("162");
    // Ve eksik düzeyi 2'den 3'e çıkar — bulgu gerçekten sayılıyor.
    expect(eksikli.findings.filter((f) => f.kind === "eksik")).toHaveLength(3);
  });

  it("depo eksiği varken “sonra okunabilir” DENMEZ", () => {
    // Baytlar yoksa okuma hiç gerçekleşemez; eski metin kullanıcıyı boşuna
    // "İçerikleri Yeniden Oku" düğmesine bastırıyordu.
    const eksikli = reconcile({
      ...anlikGoruntu(MONORAY, MONORAY_SHEETS),
      missingStorage: [MONORAY.files[0].path],
    });
    const icerik = eksikli.findings.find((f) => f.code === "ICERIK_OKUNMADI")!;
    expect(icerik.detail).toContain("depoya hiç ulaşmadığı");
    expect(icerik.detail).not.toContain("Yeniden Oku");
  });

  it("hiçbir bulgu ENGELLEYİCİ değildir — öyle bir düzey yoktur", () => {
    for (const r of [monoray, mtc]) {
      for (const f of r.findings) {
        expect(["eksik", "celiski", "bilgi"]).toContain(f.kind);
      }
    }
  });
});

describe("defter", () => {
  it("parça numarası olmayan satın alma satırları deftere girer", () => {
    // Satın alma listesi tam olarak onlardan çıkar; düşürmek modülün
    // sebeplerinden birini yok ederdi.
    const kodsuz = monoray.parts.filter((p) => !p.partCode);
    expect(kodsuz.length).toBe(50);
    expect(kodsuz.every((p) => p.registerKey.startsWith("SATIR:"))).toBe(true);
  });

  it("aynı parça iki sayfada geçse bile defterde BİR satırdır", () => {
    const kodlar = mtc.parts.filter((p) => p.partCode).map((p) => p.partCode);
    expect(new Set(kodlar).size).toBe(kodlar.length);
  });

  it("Testere satırında adet ile kesim boyu KARIŞMAZ", () => {
    const p = monoray.parts.find((x) => x.partCode === "0057-00-0700-07")!;
    expect(p.qty).toBe(1);
    expect(p.cutLengthMm).toBeCloseTo(169.3, 1);
  });
});
