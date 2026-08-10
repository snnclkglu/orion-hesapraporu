// Parça defteri Excel çıktısı.
//
// SAF: DB/HTTP bağımlılığı yok — route handler veriyi süzer, burası çalışma
// kitabını kurar. Marka dili Teknik Resimler'in diğer üç Excel çıktısıyla
// AYNIDIR ve tanımı `excel/brand.ts`tedir: kömür başlık bandı, kırmızı ince
// ayraç, mono teknik metin, ayrı künye sayfası.
//
// Bu dosya bandı uzun süre HİÇ BASMIYORDU: başlık dolgusuz, varsayılan yazı
// tipiyle düz siyah yazılıyordu. Aynı paketin dört dosyasını yan yana açan
// kullanıcı birinin markasız olduğunu görüyordu; sapma buradan kapandı.
//
// SÜZGEÇ ÖZETİ KÜNYEYE YAZILIR. Bu bir nezaket değil zorunluluk: aynı paketten
// iki farklı süzgeçle alınan iki dosya klasörde yan yana durunca hangisinin ne
// olduğu ancak künyeden anlaşılır.

import ExcelJS from "exceljs";
import {
  COL_FILL,
  HEADER_FILL,
  MODULE_PREFIX,
  MONO_FONT,
  PAPER,
  writeTitleBlock,
} from "@/lib/excel/brand";

export interface RegisterPartOut {
  partCode: string;
  description: string;
  assemblyTitle: string;
  kindLabel: string;
  material: string;
  category: string;
  qty: number | null;
  cutLengthMm: number | null;
  thicknessMm: number | null;
  weightKg: number | null;
  hasModel: boolean;
  hasSheet: boolean;
  hasCut: boolean;
  isMontaj: boolean;
}

export interface RegisterMeta {
  packageTitle: string;
  folderName: string;
  itemNo: string;
  groupCode: string;
  docCode: string;
  filterText: string;
  generatedAt: string;
  preparedBy: string;
  recognitionPct: number | null;
}

const SUTUNLAR: { baslik: string; genislik: number; sag?: boolean }[] = [
  { baslik: "Kod", genislik: 24 },
  { baslik: "Tanım", genislik: 40 },
  { baslik: "Montaj", genislik: 24 },
  { baslik: "Tür", genislik: 12 },
  { baslik: "Malzeme", genislik: 12 },
  { baslik: "Kalınlık (mm)", genislik: 13, sag: true },
  { baslik: "Kategori", genislik: 15 },
  { baslik: "Adet", genislik: 8, sag: true },
  { baslik: "Kesim Boyu (mm)", genislik: 15, sag: true },
  { baslik: "Ağırlık (kg)", genislik: 12, sag: true },
  { baslik: "Model", genislik: 7 },
  { baslik: "Resim", genislik: 7 },
  { baslik: "Kesim", genislik: 7 },
];

/**
 * Sayfanın marka bandı — kardeş çıktılarla (satın alma · kesim · imalat) AYNI
 * önek ve AYNI künye düzeni.
 *
 * Künyeye paket adı da girer: bu dosyanın başlığı sayfanın adıdır ("Parça
 * Defteri"), hangi pakete ait olduğu ancak künye satırından okunur. Boş
 * alanları `writeTitleBlock` kendisi eler; kalem numarası olmayan (eşleşmemiş)
 * paketlerde satır kısalır, "kalem —" gibi bir yer tutucu basılmaz.
 */
function markaBandi(
  ws: ExcelJS.Worksheet,
  baslik: string,
  meta: RegisterMeta,
  sutunSayisi: number
): number {
  return writeTitleBlock(ws, baslik, sutunSayisi, {
    prefix: MODULE_PREFIX.drawings,
    meta: [
      meta.packageTitle,
      meta.docCode,
      meta.itemNo ? `kalem ${meta.itemNo}` : null,
      meta.filterText,
      meta.generatedAt,
      meta.preparedBy,
    ],
  });
}

/**
 * Tablo başlığı. Ortak `styleHeaderRow` KULLANILMAZ: o açık zeminli ve tek
 * satırlıktır; on üç sütunlu defterde başlıklar ancak SARILARAK sığıyor ve
 * sağa dayalı sayı sütunları başlıkta da sağa dayanmalı.
 */
function baslikSatiri(ws: ExcelJS.Worksheet, row: number): void {
  const r = ws.getRow(row);
  SUTUNLAR.forEach((s, i) => {
    const c = r.getCell(i + 1);
    c.value = s.baslik;
    c.fill = HEADER_FILL;
    c.font = { bold: true, size: 9, color: { argb: PAPER } };
    c.alignment = { vertical: "middle", horizontal: s.sag ? "right" : "left", wrapText: true };
  });
  r.height = 22;
}

export function buildRegisterWorkbook(
  parts: RegisterPartOut[],
  meta: RegisterMeta
): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Orion Cranes — İş Yönetim Sistemi";

  // ————————————————————————————————————————————————— Parça Defteri
  const ws = wb.addWorksheet("Parça Defteri", {
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  // Sütun genişlikleri ELLE verilir (`SUTUNLAR`), `autoWidth` ile ölçülmez:
  // tanım ve montaj sütunları uzun metin taşır ve ölçüme bırakılırsa tablo
  // yatay sığmaz — defter tek sayfa enine basılan bir atölye belgesidir.
  ws.columns = SUTUNLAR.map((s) => ({ width: s.genislik }));

  const baslikNo = markaBandi(ws, "Parça Defteri", meta, SUTUNLAR.length);
  baslikSatiri(ws, baslikNo);
  ws.views = [{ state: "frozen", ySplit: baslikNo }];

  parts.forEach((p, i) => {
    const r = ws.getRow(baslikNo + 1 + i);
    r.values = [
      p.partCode || "—",
      p.description,
      p.assemblyTitle,
      p.kindLabel,
      p.material,
      p.thicknessMm,
      p.category,
      p.qty,
      p.cutLengthMm,
      p.weightKg,
      p.hasModel ? "✓" : "",
      p.hasSheet ? "✓" : "",
      p.hasCut ? "✓" : "",
    ];
    r.font = { size: 9 };
    // Parça kodu mono yazılır ve mono ARTIK MARKANINKİDİR: aynı paketin imalat
    // listesi kodu IBM Plex Mono ile basıyordu, defter Consolas ile — yan yana
    // duran iki dosya iki ayrı belge gibi görünüyordu.
    r.getCell(1).font = { size: 9, name: MONO_FONT, bold: p.isMontaj };
    if (p.isMontaj) {
      // Montaj satırı ayırt edilir — ekrandaki kuralın Excel'deki karşılığı.
      for (let c = 1; c <= SUTUNLAR.length; c++) r.getCell(c).fill = COL_FILL;
      r.getCell(2).font = { size: 9, bold: true };
    }
    for (const c of [6, 8, 9, 10]) {
      r.getCell(c).alignment = { horizontal: "right" };
      r.getCell(c).numFmt = c === 10 ? "#,##0.000" : c === 6 || c === 9 ? "#,##0.0" : "#,##0";
    }
    for (const c of [11, 12, 13]) r.getCell(c).alignment = { horizontal: "center" };
  });

  ws.autoFilter = {
    from: { row: baslikNo, column: 1 },
    to: { row: baslikNo, column: SUTUNLAR.length },
  };

  // ————————————————————————————————————————————————— Künye
  const k = wb.addWorksheet("Künye");
  k.columns = [{ width: 24 }, { width: 72 }];
  // Künye sayfası da bandı basar: bir kullanıcı dosyayı ikinci sekmesinden
  // açtığında belgeyi tanıyabilmeli — kardeş çıktıların künyesi de böyledir.
  const kunyeBas = markaBandi(k, "Künye", meta, 2);
  const satirlar: [string, string][] = [
    ["Paket", meta.packageTitle],
    ["Klasör adı", meta.folderName],
    ["İş kalemi", meta.itemNo || "eşleşmemiş"],
    ["Grup", meta.groupCode || "—"],
    ["Doküman kodu", meta.docCode],
    ["Tanıma oranı", meta.recognitionPct == null ? "—" : `%${meta.recognitionPct}`],
    ["Süzgeç", meta.filterText],
    ["Satır sayısı", String(parts.length)],
    ["Üretildi", meta.generatedAt],
    ["Üreten", meta.preparedBy],
  ];
  satirlar.forEach(([ad, deger], i) => {
    const r = k.getRow(kunyeBas + i);
    r.getCell(1).value = ad;
    r.getCell(1).font = { bold: true, size: 9 };
    r.getCell(2).value = deger;
    r.getCell(2).font = { size: 9 };
    r.getCell(2).alignment = { wrapText: true };
  });

  return wb;
}
