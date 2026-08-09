// Teknik Resimler — türev çıktıların Excel karşılığı: satın alma, kesim ve
// imalat çalışma kitapları.
//
// Saf sunum katmanıdır: hesap `lib/drawings/derive.ts`te bitmiştir, burada
// yalnız biçim vardır. Marka dili İş Takibi ve Ekipman Listesi ile AYNIDIR —
// kömür başlık, künye satırı, kırmızı ince kural, dondurulmuş başlık, süzgeç.
//
// MARKA YARDIMCILARI NEDEN ÇOĞALTILDI: `work-log.ts` `writeTitleBlock` /
// `styleHeaderRow` / `autoWidth` üçlüsünü DIŞA AKTARMIYOR ve o dosya bu fazın
// sahipliğinde değil. Üçüncü kopya oluştuğu için ortak bir `excel/brand.ts`e
// çıkarılması artık gerekçelidir; bu faz kapsamında yapılmadı, notu ROADMAP'e
// düşülüyor. Renkler design-system/readme.md'den birebir alınmıştır.

import ExcelJS from "exceljs";
import type {
  ImalatKoku,
  ImalatSonucu,
  KesimSonucu,
  SacSonucu,
  SatinAlmaSonucu,
  TestereSonucu,
} from "@/lib/drawings/derive";

const CHARCOAL = "FF262626";
const PAPER = "FFF4F1EF";
const ORION_RED = "FFA41E1E";

const HEADER_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: CHARCOAL } };
const RED_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: ORION_RED } };
const COL_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFE7E4E2" }, // Kağıt 200
};
const TOTAL_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFF1EEEC" }, // Kağıt 150
};

/** Boş hücreye 0 değil TİRE yazılır: "0 kg" ile "bilinmiyor" aynı şey değildir. */
const YOK = "—";

const SAYI = "#,##0.##";
const ALAN = "#,##0.000";

export interface DrawingExportMeta {
  /** "0057-00 MONORAY (1 TON)" — başlığın ikinci satırı */
  paketAdi: string;
  /** "ORC-TR-0057-00-0500-R01" */
  belgeKodu: string;
  /** Ressamın klasörünün ham adı — belgenin hangi teslimden geldiğinin kanıtı */
  klasorAdi: string;
  kalemNo: string;
  generatedAt: string;
  preparedBy: string;
}

// ————————————————————————————————————————————————— marka blokları

function colLetter(n: number): string {
  let s = "";
  let x = n;
  while (x > 0) {
    const rem = (x - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    x = Math.floor((x - 1) / 26);
  }
  return s;
}

/** Kömür başlık + künye + kırmızı ayraç. Tablo başlığının satır numarasını döner. */
function writeTitleBlock(
  ws: ExcelJS.Worksheet,
  title: string,
  meta: DrawingExportMeta,
  colCount: number
): number {
  const last = colLetter(Math.max(colCount, 1));

  ws.mergeCells(`A1:${last}1`);
  const t = ws.getCell("A1");
  t.value = `ORION — TEKNİK RESİMLER · ${title}`;
  t.font = { name: "Archivo", bold: true, size: 14, color: { argb: PAPER } };
  t.alignment = { horizontal: "left", vertical: "middle" };
  ws.getRow(1).height = 26;

  ws.mergeCells(`A2:${last}2`);
  const k = ws.getCell("A2");
  k.value = [meta.paketAdi, meta.belgeKodu, meta.generatedAt, meta.preparedBy]
    .filter(Boolean)
    .join(" · ");
  k.font = { name: "IBM Plex Mono", size: 9, color: { argb: PAPER } };
  k.alignment = { horizontal: "left", vertical: "middle" };
  ws.getRow(2).height = 16;

  // Birleşik hücrelerin kenar kolonları merge sonrası boyasız kalmasın.
  for (let r = 1; r <= 2; r++) {
    for (let c = 1; c <= colCount; c++) ws.getRow(r).getCell(c).fill = HEADER_FILL;
  }

  ws.mergeCells(`A3:${last}3`);
  for (let c = 1; c <= colCount; c++) ws.getRow(3).getCell(c).fill = RED_FILL;
  ws.getRow(3).height = 3;

  return 5; // satır 4 boş; tablo başlığı 5. satırda
}

function styleHeaderRow(row: ExcelJS.Row, colCount: number): void {
  row.height = 18;
  for (let c = 1; c <= colCount; c++) {
    const cell = row.getCell(c);
    cell.fill = COL_FILL;
    cell.font = { name: "Archivo", bold: true, size: 10 };
    cell.border = { bottom: { style: "thin", color: { argb: "FF9CA3AF" } } };
  }
}

function autoWidth(ws: ExcelJS.Worksheet, min = 9, max = 46): void {
  ws.columns.forEach((col) => {
    let width = min;
    col.eachCell?.({ includeEmpty: false }, (cell) => {
      if (cell.isMerged) return;
      const len = String(cell.value ?? "").length + 2;
      if (len > width) width = len;
    });
    col.width = Math.min(width, max);
  });
}

function writeHeader(ws: ExcelJS.Worksheet, baslik: string, sutunlar: readonly string[], meta: DrawingExportMeta): number {
  const headerRow = writeTitleBlock(ws, baslik, meta, sutunlar.length);
  const head = ws.getRow(headerRow);
  sutunlar.forEach((label, i) => (head.getCell(i + 1).value = label));
  styleHeaderRow(head, sutunlar.length);
  return headerRow;
}

function totalRow(ws: ExcelJS.Worksheet, rowNo: number, colCount: number): ExcelJS.Row {
  const row = ws.getRow(rowNo);
  for (let c = 1; c <= colCount; c++) {
    row.getCell(c).fill = TOTAL_FILL;
    row.getCell(c).font = { bold: true };
  }
  return row;
}

function sayiHucresi(row: ExcelJS.Row, col: number, value: number | null, fmt = SAYI): void {
  const cell = row.getCell(col);
  if (value == null || !Number.isFinite(value)) {
    cell.value = YOK;
    cell.alignment = { horizontal: "right" };
    return;
  }
  cell.value = value;
  cell.numFmt = fmt;
  cell.alignment = { horizontal: "right" };
}

const LANDSCAPE: Partial<ExcelJS.PageSetup> = {
  orientation: "landscape",
  fitToPage: true,
  fitToWidth: 1,
  fitToHeight: 0,
};

/**
 * Künye sayfası — dosyanın KAPSAMINI kendi içinde taşır.
 *
 * Bir Excel e-postayla dolaşır ve bağlamı geride kalır. Satınalma "tedarikçi
 * sütunu neden yok", kesimci "yerleşim payı nereden çıktı", üretim "bu ağırlık
 * neyi sayıyor" diye sorduğunda cevabın dosyanın İÇİNDE olması gerekir.
 */
function writeKunye(
  wb: ExcelJS.Workbook,
  meta: DrawingExportMeta,
  facts: [string, string | number][],
  kapsam: string[]
): void {
  const ws = wb.addWorksheet("Künye", { pageSetup: { orientation: "portrait" } });
  const bas = writeTitleBlock(ws, "Künye", meta, 2);

  const tum: [string, string | number][] = [
    ["Paket", meta.paketAdi],
    ["Klasör", meta.klasorAdi],
    ["İş kalemi", meta.kalemNo || YOK],
    ["Belge kodu", meta.belgeKodu],
    ["Üretim zamanı", meta.generatedAt],
    ["Üreten", meta.preparedBy || YOK],
    ...facts,
  ];
  tum.forEach(([label, value], i) => {
    const row = ws.getRow(bas + i);
    row.getCell(1).value = label;
    row.getCell(1).font = { bold: true };
    row.getCell(2).value = value;
    if (typeof value === "number") row.getCell(2).numFmt = SAYI;
  });

  let satir = bas + tum.length + 1;
  const kapsamBasligi = ws.getRow(satir);
  kapsamBasligi.getCell(1).value = "KAPSAM";
  kapsamBasligi.getCell(1).font = { name: "Archivo", bold: true, size: 11 };
  satir += 1;
  for (const cumle of kapsam) {
    const row = ws.getRow(satir);
    ws.mergeCells(`A${satir}:B${satir}`);
    row.getCell(1).value = cumle;
    row.getCell(1).alignment = { wrapText: true, vertical: "top" };
    row.height = Math.max(16, Math.ceil(cumle.length / 90) * 14);
    satir += 1;
  }

  autoWidth(ws, 14, 90);
}

// —————————————————————————————————————————————————— 1. Satın alma kitabı

const SATIN_ALMA_SUTUNLARI = [
  "Sınıf",
  "Tanım",
  "Malzeme",
  "Adet",
  "Birim kg",
  "Toplam kg",
  "Parça Kodu",
  "Kaynak",
];

function writeSatinAlmaSheet(
  ws: ExcelJS.Worksheet,
  veri: SatinAlmaSonucu,
  meta: DrawingExportMeta
): void {
  const bas = writeHeader(ws, "Satın Alınacaklar", SATIN_ALMA_SUTUNLARI, meta);

  veri.satirlar.forEach((s, i) => {
    const row = ws.getRow(bas + 1 + i);
    row.getCell(1).value = s.sinif;
    row.getCell(2).value = s.tanim || YOK;
    row.getCell(3).value = s.malzeme || YOK;
    sayiHucresi(row, 4, s.adet);
    sayiHucresi(row, 5, s.birimAgirlikKg);
    sayiHucresi(row, 6, s.toplamAgirlikKg);
    row.getCell(7).value = s.parcaKodu || YOK;
    row.getCell(8).value = s.kaynak || YOK;
  });

  const toplam = totalRow(ws, bas + 1 + veri.satirlar.length, SATIN_ALMA_SUTUNLARI.length);
  toplam.getCell(1).value = "TOPLAM";
  toplam.getCell(2).value = `${veri.satirlar.length} satır`;
  sayiHucresi(toplam, 4, veri.toplamAdet);
  sayiHucresi(toplam, 6, veri.toplamAgirlikKg);
  toplam.getCell(6).font = { bold: true };

  ws.autoFilter = {
    from: { row: bas, column: 1 },
    to: { row: bas + veri.satirlar.length, column: SATIN_ALMA_SUTUNLARI.length },
  };
  ws.views = [{ state: "frozen", ySplit: bas }];
  autoWidth(ws);
}

const SAC_SUTUNLARI = [
  "Malzeme",
  "Kalınlık (mm)",
  "Parça",
  "Adet",
  "Net Alan (m²)",
  "Yerleşim Payı",
  "Brüt Alan (m²)",
  "Ölçüsü Bilinmeyen",
];

function writeSacSheet(ws: ExcelJS.Worksheet, veri: SacSonucu, meta: DrawingExportMeta): void {
  const bas = writeHeader(ws, "Sac İhtiyacı", SAC_SUTUNLARI, meta);

  veri.gruplar.forEach((g, i) => {
    const row = ws.getRow(bas + 1 + i);
    row.getCell(1).value = g.malzeme;
    sayiHucresi(row, 2, g.kalinlikMm);
    sayiHucresi(row, 3, g.parcaSayisi);
    sayiHucresi(row, 4, g.adet);
    sayiHucresi(row, 5, g.netAlanMm2 / 1_000_000, ALAN);
    sayiHucresi(row, 6, veri.yerlesimPayi);
    sayiHucresi(row, 7, g.brutAlanMm2 / 1_000_000, ALAN);
    sayiHucresi(row, 8, g.olcusuzParca);
  });

  const toplam = totalRow(ws, bas + 1 + veri.gruplar.length, SAC_SUTUNLARI.length);
  toplam.getCell(1).value = "TOPLAM";
  sayiHucresi(toplam, 3, veri.gruplar.reduce((t, g) => t + g.parcaSayisi, 0));
  sayiHucresi(toplam, 4, veri.gruplar.reduce((t, g) => t + g.adet, 0));
  sayiHucresi(toplam, 5, veri.netAlanMm2 / 1_000_000, ALAN);
  sayiHucresi(toplam, 7, veri.brutAlanMm2 / 1_000_000, ALAN);
  sayiHucresi(toplam, 8, veri.olcusuzSayisi);

  // Yerleşim payının GİRDİ olduğu sayfanın kendisinde yazar; kullanıcı bunu
  // "sistemin tahmini" sanmamalı.
  let satir = bas + veri.gruplar.length + 3;
  ws.getRow(satir).getCell(1).value =
    `Yerleşim payı ${veri.yerlesimPayi.toLocaleString("tr-TR")} — bu bir GİRDİDİR, hesaplanmış değildir.`;
  ws.getRow(satir).getCell(1).font = { italic: true };
  satir += 1;
  ws.getRow(satir).getCell(1).value =
    "Net alan = Σ(en × boy × adet). Brüt alan = net × yerleşim payı.";
  ws.getRow(satir).getCell(1).font = { italic: true };

  // Ölçüsü çıkarılamayan parçalar TEK TEK yazılır — gruptan düşürülmedikleri
  // için toplamları etkilemezler ama listede görünmeleri gerekir.
  const olcusuz = veri.gruplar.flatMap((g) =>
    g.parcalar.filter((p) => !p.olculu).map((p) => ({ g, p }))
  );
  if (olcusuz.length) {
    satir += 2;
    ws.getRow(satir).getCell(1).value = "ÖLÇÜSÜ ÇIKARILAMAYAN PARÇALAR (gruptan düşürülmedi)";
    ws.getRow(satir).getCell(1).font = { name: "Archivo", bold: true, size: 10 };
    for (const { g, p } of olcusuz) {
      satir += 1;
      const row = ws.getRow(satir);
      row.getCell(1).value = p.parcaKodu || YOK;
      row.getCell(2).value = `${g.malzeme} ${g.kalinlikMm} mm`;
      row.getCell(3).value = p.tanim || YOK;
      sayiHucresi(row, 4, p.adet);
    }
  }

  ws.views = [{ state: "frozen", ySplit: bas }];
  autoWidth(ws);
}

const TESTERE_SUTUNLARI = [
  "Parça Kodu",
  "Kesit",
  "Tanım",
  "Malzeme",
  "Adet",
  "Birim Boy (mm)",
  "Defterdeki Toplam (mm)",
  "Beklenen (adet × birim)",
  "Durum",
];

function writeTestereSheet(
  ws: ExcelJS.Worksheet,
  veri: TestereSonucu,
  meta: DrawingExportMeta
): void {
  const bas = writeHeader(ws, "Profil / Testere Kesim", TESTERE_SUTUNLARI, meta);

  veri.satirlar.forEach((s, i) => {
    const row = ws.getRow(bas + 1 + i);
    row.getCell(1).value = s.parcaKodu || YOK;
    row.getCell(2).value = s.kesit || YOK;
    row.getCell(3).value = s.tanim || YOK;
    row.getCell(4).value = s.malzeme || YOK;
    sayiHucresi(row, 5, s.adet);
    sayiHucresi(row, 6, s.birimBoyMm);
    sayiHucresi(row, 7, s.toplamBoyMm);
    sayiHucresi(row, 8, s.beklenenToplamMm);
    const durum = row.getCell(9);
    durum.value = s.tutarli === false ? "Uyuşmuyor" : s.tutarli === null ? YOK : "Tamam";
    if (s.tutarli === false) {
      durum.font = { bold: true, color: { argb: ORION_RED } };
    }
  });

  const toplam = totalRow(ws, bas + 1 + veri.satirlar.length, TESTERE_SUTUNLARI.length);
  toplam.getCell(1).value = "TOPLAM";
  toplam.getCell(2).value = `${veri.satirlar.length} satır`;
  sayiHucresi(toplam, 7, veri.toplamBoyMm);
  toplam.getCell(9).value = veri.uyusmazlik ? `${veri.uyusmazlik} uyuşmazlık` : "—";

  // KESİT ÖZETİ satınalmanın asıl istediği sayıdır: hangi profilden kaç metre.
  // Toplam DEFTERİN BEYANINDAN alınır (kaynağın kendi sayısı), çarpımdan değil.
  let satir = bas + veri.satirlar.length + 3;
  ws.getRow(satir).getCell(1).value = "KESİT ÖZETİ (toplamlar defterin kendi beyanıdır, çarpım DEĞİLDİR)";
  ws.getRow(satir).getCell(1).font = { name: "Archivo", bold: true, size: 10 };
  satir += 1;
  const ozetBas = ws.getRow(satir);
  ["Malzeme", "Kesit", "Satır", "Toplam Boy (mm)", "Toplam Boy (m)"].forEach(
    (l, i) => (ozetBas.getCell(i + 1).value = l)
  );
  styleHeaderRow(ozetBas, 5);
  for (const k of veri.kesitler) {
    satir += 1;
    const row = ws.getRow(satir);
    row.getCell(1).value = k.malzeme;
    row.getCell(2).value = k.kesit;
    sayiHucresi(row, 3, k.satirSayisi);
    sayiHucresi(row, 4, k.toplamBoyMm);
    sayiHucresi(row, 5, k.toplamBoyMm / 1000, ALAN);
  }
  satir += 1;
  const ozetToplam = totalRow(ws, satir, 5);
  ozetToplam.getCell(1).value = "TOPLAM";
  sayiHucresi(ozetToplam, 4, veri.toplamBoyMm);
  sayiHucresi(ozetToplam, 5, veri.toplamBoyMm / 1000, ALAN);

  if (veri.uyusmazlik) {
    satir += 2;
    ws.getRow(satir).getCell(1).value =
      `${veri.uyusmazlik} satırda adet × birim boy, defterdeki toplam boy ile uyuşmuyor. ` +
      "İki sayı iki ayrı Excel sayfasından geliyor; hangisinin doğru olduğu " +
      "kaynakta yazmıyor, bu yüzden hiçbiri çarpılıp değiştirilmedi.";
    ws.getRow(satir).getCell(1).font = { italic: true };
  }

  ws.views = [{ state: "frozen", ySplit: bas }];
  autoWidth(ws);
}

export function buildSatinAlmaWorkbook(
  veri: { satinAlma: SatinAlmaSonucu; sac: SacSonucu; testere: TestereSonucu },
  meta: DrawingExportMeta
): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  wb.creator = "ORION";
  wb.created = new Date();

  writeSatinAlmaSheet(
    wb.addWorksheet("Satın Alınacaklar", { pageSetup: LANDSCAPE }),
    veri.satinAlma,
    meta
  );
  writeSacSheet(wb.addWorksheet("Sac İhtiyacı", { pageSetup: LANDSCAPE }), veri.sac, meta);
  writeTestereSheet(
    wb.addWorksheet("Profil-Testere Kesim", { pageSetup: LANDSCAPE }),
    veri.testere,
    meta
  );

  writeKunye(
    wb,
    meta,
    [
      ["Satın alma satırı", veri.satinAlma.satirlar.length],
      ["Toplam adet", veri.satinAlma.toplamAdet],
      ["Malzemesi yazılı satır", veri.satinAlma.malzemesiBilinen],
      ["Ağırlığı bilinen satır", veri.satinAlma.agirligiBilinen],
      ["Sac grubu", veri.sac.gruplar.length],
      ["Net sac alanı (m²)", Number((veri.sac.netAlanMm2 / 1_000_000).toFixed(3))],
      ["Yerleşim payı", veri.sac.yerlesimPayi],
      ["Brüt sac alanı (m²)", Number((veri.sac.brutAlanMm2 / 1_000_000).toFixed(3))],
      ["Ölçüsü bilinmeyen sac parçası", veri.sac.olcusuzSayisi],
      ["Testere satırı", veri.testere.satirlar.length],
      ["Testere toplam boy (m)", Number((veri.testere.toplamBoyMm / 1000).toFixed(2))],
      ["Testere uyuşmazlığı", veri.testere.uyusmazlik],
    ],
    [
      "TEDARİKÇİ VE FİYAT SÜTUNU YOKTUR. Bu bilgi kaynak dosyalarda hiç geçmiyor; " +
        "boş bir sütun dosyayı eksik doldurulmuş gösterir, doldurulmuş bir sütun ise " +
        "satınalmaya olmayan bir bilgiyi verirdi.",
      `Yerleşim payı ${veri.sac.yerlesimPayi.toLocaleString("tr-TR")} bir GİRDİDİR. ` +
        "Net kesim alanı geometriden çıkar ve kesindir; firenin ne kadar olacağı " +
        "sac boyutuna ve yerleşim yazılımına bağlıdır, uygulama bunu bilemez.",
      veri.sac.olcusuzSayisi > 0
        ? `${veri.sac.olcusuzSayisi} parçanın en × boy ölçüsü tanımdan çıkarılamadı. ` +
          "Bu parçalar listeden DÜŞÜRÜLMEDİ: grubunda görünürler, alanları sıfır " +
          "sayılır ve 'Sac İhtiyacı' sayfasının altında tek tek listelenir."
        : "Bütün sac parçalarının en × boy ölçüsü tanımdan okunabildi.",
      veri.satinAlma.agirligiBilinen > 0
        ? "Ağırlıklar ürün ağacı Excel'inin Mass sütunundan gelir."
        : "Bu pakette ürün ağacı yok; ağırlık sütunları boştur. Bu bir eksik değil, " +
          "kaynakta o bilginin hiç bulunmamasıdır.",
      veri.testere.uyusmazlik > 0
        ? `${veri.testere.uyusmazlik} testere satırında adet ile toplam boy birbirini tutmuyor. ` +
          "Adet depo sayfasından, toplam boy ürün ağacından gelir ve kaynağında " +
          "tutarsızdır. Hiçbir çarpma yapılmadı; üç sayı da yan yana basıldı."
        : "Testere satırlarında adet ile toplam boy birbirini tutuyor.",
      "Satın alma listesi iki kaynağı birleştirir: BOM'da 'Purchased' yapısındaki " +
        "satırlar ve parça numarası olmayan satırlar (cıvata, segman, rulman…).",
    ]
  );

  return wb;
}

// ————————————————————————————————————————————————————— 2. Kesim kitabı

/**
 * Çalışma sayfası adı — Excel'in üç kuralı birden.
 *
 * 31 karakter sınırı, `[]:*?/\` yasağı ve YİNELENEN ADA HATA. Sonuncusu
 * gerçek bir risktir: kesim listesi malzeme-kalınlık başına sayfa açar ve iki
 * malzeme adı kırpıldıktan sonra aynı dizgeye inebilir. Sayaçla tekilleştirilir.
 */
function sheetName(ham: string, kullanilan: Set<string>): string {
  const temiz = ham.replace(/[[\]:*?/\\]+/g, " ").replace(/\s+/g, " ").trim() || "Sayfa";
  let ad = temiz.slice(0, 31);
  let n = 2;
  while (kullanilan.has(ad)) {
    const ek = ` (${n})`;
    ad = `${temiz.slice(0, 31 - ek.length)}${ek}`;
    n += 1;
  }
  kullanilan.add(ad);
  return ad;
}

const KESIM_SUTUNLARI = ["Dosya", "Parça Kodu", "Tanım", "Adet", "Boyut (KB)", "Yol"];

export function buildKesimWorkbook(
  veri: { kesim: KesimSonucu },
  meta: DrawingExportMeta
): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  wb.creator = "ORION";
  wb.created = new Date();

  // ÖZET İLK SAYFADIR: kesimci dosyayı açtığında önce kaç grup ve kaç dosya
  // olduğunu görmeli, sonra grubuna gitmeli.
  const ozet = wb.addWorksheet("Özet", { pageSetup: LANDSCAPE });
  const ozetBas = writeHeader(
    ozet,
    "Kesim Listesi — Özet",
    ["Malzeme", "Kalınlık (mm)", "Dosya", "Adet", "Boyut (MB)", "Sayfa"],
    meta
  );

  const kullanilan = new Set<string>(["Özet", "Künye"]);
  const sayfaAdlari: string[] = [];
  for (const g of veri.kesim.gruplar) {
    const ham = g.bagsiz
      ? "Koda bağlanmayan"
      : `${g.malzeme} ${g.kalinlikMm == null ? "?" : g.kalinlikMm} mm`;
    sayfaAdlari.push(sheetName(ham, kullanilan));
  }

  veri.kesim.gruplar.forEach((g, i) => {
    const row = ozet.getRow(ozetBas + 1 + i);
    row.getCell(1).value = g.bagsiz ? "Koda bağlanmayan" : g.malzeme;
    sayiHucresi(row, 2, g.kalinlikMm);
    sayiHucresi(row, 3, g.dosyalar.length);
    sayiHucresi(row, 4, g.adet);
    sayiHucresi(row, 5, g.boyutBayt / 1024 / 1024, ALAN);
    row.getCell(6).value = sayfaAdlari[i];
  });
  const ozetToplam = totalRow(ozet, ozetBas + 1 + veri.kesim.gruplar.length, 6);
  ozetToplam.getCell(1).value = "TOPLAM";
  sayiHucresi(ozetToplam, 3, veri.kesim.dosyaSayisi);
  sayiHucresi(ozetToplam, 4, veri.kesim.gruplar.reduce((t, g) => t + g.adet, 0));
  sayiHucresi(ozetToplam, 5, veri.kesim.boyutBayt / 1024 / 1024, ALAN);
  ozet.views = [{ state: "frozen", ySplit: ozetBas }];
  autoWidth(ozet);

  veri.kesim.gruplar.forEach((g, i) => {
    const ws = wb.addWorksheet(sayfaAdlari[i], { pageSetup: LANDSCAPE });
    const baslik = g.bagsiz
      ? "Koda bağlanamayan DXF'ler"
      : `${g.malzeme} · ${g.kalinlikMm == null ? "kalınlık bilinmiyor" : `${g.kalinlikMm} mm`}`;
    const bas = writeHeader(ws, baslik, KESIM_SUTUNLARI, meta);

    g.dosyalar.forEach((d, j) => {
      const row = ws.getRow(bas + 1 + j);
      row.getCell(1).value = d.fileName;
      row.getCell(2).value = d.parcaKodu || YOK;
      row.getCell(3).value = d.tanim || YOK;
      sayiHucresi(row, 4, d.adet);
      sayiHucresi(row, 5, d.boyutBayt / 1024);
      row.getCell(6).value = d.relPath;
    });

    const t = totalRow(ws, bas + 1 + g.dosyalar.length, KESIM_SUTUNLARI.length);
    t.getCell(1).value = "TOPLAM";
    t.getCell(2).value = `${g.dosyalar.length} dosya`;
    sayiHucresi(t, 4, g.adet);
    sayiHucresi(t, 5, g.boyutBayt / 1024);

    ws.autoFilter = {
      from: { row: bas, column: 1 },
      to: { row: bas + g.dosyalar.length, column: KESIM_SUTUNLARI.length },
    };
    ws.views = [{ state: "frozen", ySplit: bas }];
    autoWidth(ws);
  });

  writeKunye(
    wb,
    meta,
    [
      ["DXF dosyası", veri.kesim.dosyaSayisi],
      ["Grup (malzeme × kalınlık)", veri.kesim.gruplar.length],
      ["Toplam boyut (MB)", Number((veri.kesim.boyutBayt / 1024 / 1024).toFixed(1))],
      ["Koda bağlanamayan dosya", veri.kesim.bagsizDosya],
    ],
    [
      "Bu liste DOSYALARIN belgesidir: pakette gerçekten bulunan, canlı DXF'ler " +
        "sayılır. 'Sac İhtiyacı' sayfası ise DEFTERİN (BOM) belgesidir ve aynı " +
        "grupları vermek zorunda değildir — bir parça hem testere kalemi hem DXF'li " +
        "olabilir.",
      "Kopya ve süperse edilmiş dosyalar listeye girmez; arşivde dururlar.",
      veri.kesim.bagsizDosya > 0
        ? `${veri.kesim.bagsizDosya} DXF bir parça koduna bağlanamadı ve ayrı bir sayfada listelendi. ` +
          "Dosya kaybolmaz; kesimciye yine gider."
        : "Bütün DXF'ler bir parça koduna bağlandı.",
      "Malzeme ve kalınlık önce DXF dosya adından, yoksa defterdeki parçadan okunur.",
    ]
  );

  return wb;
}

// ———————————————————————————————————————————————————— 3. İmalat kitabı

const IMALAT_SUTUNLARI = [
  "Düzey",
  "Parça Kodu",
  "Tanım",
  "Malzeme",
  "Tür",
  "Adet",
  "Birim kg",
  "Toplam kg",
  "Resim",
  "DXF",
  "Model",
];

const TUR_ETIKETLERI: Record<string, string> = {
  montaj: "Montaj",
  imalat: "İmalat",
  satinalma: "Satın alma",
  bilinmiyor: "Belirsiz",
};

export function buildImalatWorkbook(
  veri: { imalat: ImalatSonucu; kokler: readonly ImalatKoku[] },
  meta: DrawingExportMeta
): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  wb.creator = "ORION";
  wb.created = new Date();

  const ws = wb.addWorksheet("İmalat Listesi", { pageSetup: LANDSCAPE });
  const bas = writeHeader(ws, "İmalat Listesi", IMALAT_SUTUNLARI, meta);

  veri.imalat.satirlar.forEach((s, i) => {
    const row = ws.getRow(bas + 1 + i);
    sayiHucresi(row, 1, s.duzey);
    // Girinti düzeyi GÖRSEL olarak da verilir: ağaç sırası bir listede ancak
    // böyle okunur. Sayı sütunu süzme için, girinti göz için.
    const kod = row.getCell(2);
    kod.value = `${"    ".repeat(Math.max(0, s.duzey - 1))}${s.partCode}`;
    kod.font = { name: "IBM Plex Mono", size: 10, bold: s.duzey === 1 };
    row.getCell(3).value = s.tanim || YOK;
    row.getCell(4).value = s.malzeme || YOK;
    row.getCell(5).value = TUR_ETIKETLERI[s.kind] ?? s.kind;
    sayiHucresi(row, 6, s.adet);
    sayiHucresi(row, 7, s.birimAgirlikKg);
    sayiHucresi(row, 8, s.toplamAgirlikKg);
    row.getCell(9).value = s.hasSheet ? "✓" : "";
    row.getCell(10).value = s.hasCut ? "✓" : "";
    row.getCell(11).value = s.hasModel ? "✓" : "";
    for (const c of [9, 10, 11]) row.getCell(c).alignment = { horizontal: "center" };
  });

  const toplam = totalRow(ws, bas + 1 + veri.imalat.satirlar.length, IMALAT_SUTUNLARI.length);
  toplam.getCell(2).value = "TOPLAM";
  toplam.getCell(3).value = `${veri.imalat.satirlar.length} satır · ${veri.imalat.resimliSatir} resimli`;
  // TOPLAM YALNIZ YAPRAK SATIRLARDAN: montaj satırının ağırlığı çocuklarını
  // zaten içerir, hepsini toplamak vinci iki katı ağır gösterirdi.
  sayiHucresi(toplam, 8, veri.imalat.yaprakAgirlikKg);

  ws.autoFilter = {
    from: { row: bas, column: 1 },
    to: { row: bas + veri.imalat.satirlar.length, column: IMALAT_SUTUNLARI.length },
  };
  ws.views = [{ state: "frozen", ySplit: bas }];
  autoWidth(ws);

  const kokAdi = veri.imalat.kokKod
    ? veri.kokler.find((k) => k.partCode === veri.imalat.kokKod)?.etiket ?? veri.imalat.kokKod
    : "Tümü";

  writeKunye(
    wb,
    meta,
    [
      ["Kapsam", veri.imalat.kokKod ? `${veri.imalat.kokKod} · ${kokAdi}` : "Tümü (bütün kökler)"],
      ["Satır", veri.imalat.satirlar.length],
      ["Ölçülü resmi olan satır", veri.imalat.resimliSatir],
      ["Ölçülü resmi olmayan satır", veri.imalat.resimsizSatir],
      [
        "Yaprak ağırlık toplamı (kg)",
        veri.imalat.yaprakAgirlikKg == null
          ? YOK
          : Number(veri.imalat.yaprakAgirlikKg.toFixed(1)),
      ],
      [
        "Kök beyan ağırlıkları toplamı (kg)",
        veri.imalat.kokAgirlikKg == null ? YOK : Number(veri.imalat.kokAgirlikKg.toFixed(1)),
      ],
      ["Kök sayısı (paketin tamamında)", veri.kokler.length],
    ],
    [
      "AĞIRLIK ÜST ÜSTE EKLENMEZ. Ürün ağacında montaj satırının ağırlığı " +
        "çocuklarının toplamına eşittir; bütün satırları toplamak gerçeğin iki " +
        "katına yakın bir sayı üretirdi. Toplam yalnız YAPRAK satırlardan alınır.",
      "Künyede iki toplam birden yazar: yaprakların toplamı ile köklerin kendi " +
        "beyan ağırlıklarının toplamı. İkisi tam eşit çıkmaz — aradaki fark " +
        "ürün ağacındaki yuvarlamalar ve ağırlığı yazılmamış satırlardır.",
      "Sıralama ağaç sırasıdır ve yeniden hesaplanmaz: ürün ağacı varsa Inventor'ın " +
        "Item yolu, yoksa parça kodu belirler. Ekrandaki ağaç ile bu liste aynı sırayı " +
        "gösterir.",
      "Birleşik PDF (bütün resimlerin tek dosyada birleştirilmesi) bu sürümde yoktur; " +
        "liste hangi resimlerin var olduğunu 'Resim' sütununda gösterir.",
      veri.imalat.yaprakAgirlikKg == null
        ? "Bu pakette ürün ağacı yok; hiçbir satırda ağırlık bulunmuyor. Toplam yerine " +
          "tire basıldı — sıfır yazmak 'ağırlıksız' demek olurdu."
        : "Ağırlıklar ürün ağacı Excel'inin Mass sütunundan gelir.",
    ]
  );

  return wb;
}
