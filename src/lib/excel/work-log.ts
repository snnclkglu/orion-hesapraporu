// İş Takibi Excel çıktısı — süzgeçten geçen kayıtların dört sayfalık dökümü:
//   1. "Kayıtlar"        — satır satır ham veri (Excel'de kendi pivotunu kuran
//                          kullanıcı için asıl sayfa budur)
//   2. "Aylık Özet"      — ay × imalat türü çapraz tablosu
//   3. "İş Kalemi Özeti" — kalem × imalat türü çapraz tablosu
//   4. "Parça Özeti"     — parça × imalat türü çapraz tablosu
//
// Saf fonksiyondur (DB/HTTP bağımlılığı yok): route handler veriyi çeker,
// burası çalışma kitabını kurar. Marka dili (kömür başlık, kırmızı ince ayraç,
// mono teknik metin) artık burada TANIMLI DEĞİL, `excel/brand.ts`ten gelir:
// aynı bant dört Excel çıktısında birden basılıyor.

import ExcelJS from "exceljs";
import {
  MODULE_PREFIX,
  TOTAL_FILL,
  autoWidth,
  styleHeaderRow,
  writeTitleBlock,
} from "@/lib/excel/brand";
import {
  breakdown,
  bucketKey,
  bucketLabel,
  cellKey,
  dimensionValue,
  summarize,
  type WorkDimension,
  type WorkLogRow,
} from "@/lib/work-log";

export interface WorkLogExportMeta {
  /** Süzgeçlerin insan okunur özeti */
  filterText: string;
  /** Dosyanın üretildiği an (tr-TR) */
  generatedAt: string;
  /** Üreten kullanıcı */
  preparedBy: string;
}

/**
 * Sayfanın marka bandı. Künye üç parçalıdır ve boş üreten (arka plan işi)
 * satırı `writeTitleBlock` kendisi eler.
 */
function writeBand(
  ws: ExcelJS.Worksheet,
  title: string,
  meta: WorkLogExportMeta,
  colCount: number
): number {
  return writeTitleBlock(ws, title, colCount, {
    prefix: MODULE_PREFIX.workLog,
    meta: [meta.filterText, meta.generatedAt, meta.preparedBy],
  });
}

// ---------------------------------------------------------------- 1. Kayıtlar

const DETAIL_COLUMNS = [
  "Tarih",
  "İş No",
  "Kalem No",
  "Müşteri",
  "Ürün",
  "Grup Kodu",
  "Parça",
  "İmalat Türü",
  "Adam",
  "Saat",
  "Adam·Saat",
  "Not",
];

function writeDetailSheet(
  ws: ExcelJS.Worksheet,
  rows: readonly WorkLogRow[],
  meta: WorkLogExportMeta
): void {
  const headerRow = writeBand(ws, "Kayıtlar", meta, DETAIL_COLUMNS.length);

  const head = ws.getRow(headerRow);
  DETAIL_COLUMNS.forEach((label, i) => (head.getCell(i + 1).value = label));
  styleHeaderRow(head, DETAIL_COLUMNS.length);

  // Tarihe göre ARTAN: dışa aktarılan dosya bir defterdir, defter baştan okunur.
  const sorted = [...rows].sort(
    (a, b) => a.date.localeCompare(b.date) || a.itemNo.localeCompare(b.itemNo, "tr")
  );

  sorted.forEach((r, i) => {
    const row = ws.getRow(headerRow + 1 + i);
    // Tarih GERÇEK tarih olarak yazılır — Excel'de süzme ve gruplama ancak
    // böyle çalışır; metin yazılsaydı kullanıcının kendi pivotu kurulamazdı.
    row.getCell(1).value = new Date(`${r.date}T00:00:00Z`);
    row.getCell(1).numFmt = "dd.mm.yyyy";
    row.getCell(2).value = r.jobNo || "";
    row.getCell(3).value = r.itemNo || "";
    row.getCell(4).value = r.customer || "";
    row.getCell(5).value = r.productName || "";
    row.getCell(6).value = r.partCode || "";
    row.getCell(7).value = r.partName;
    row.getCell(8).value = r.categoryName;
    row.getCell(9).value = r.people;
    row.getCell(10).value = r.hours;
    row.getCell(11).value = r.manHours;
    row.getCell(12).value = r.note || "";
    for (const c of [9, 10, 11]) {
      row.getCell(c).numFmt = "#,##0.##";
      row.getCell(c).alignment = { horizontal: "right" };
    }
    row.getCell(11).font = { bold: true };
  });

  const totalRow = ws.getRow(headerRow + 1 + sorted.length);
  totalRow.getCell(8).value = "TOPLAM";
  totalRow.getCell(9).value = sorted.reduce((s, r) => s + r.people, 0);
  totalRow.getCell(11).value = sorted.reduce((s, r) => s + r.manHours, 0);
  for (let c = 1; c <= DETAIL_COLUMNS.length; c++) {
    totalRow.getCell(c).fill = TOTAL_FILL;
    totalRow.getCell(c).font = { bold: true };
  }
  totalRow.getCell(9).numFmt = "#,##0.##";
  totalRow.getCell(11).numFmt = "#,##0.##";

  // Süzgeç ve dondurulmuş başlık: kullanıcının dosyada yapacağı ilk iki şey.
  ws.autoFilter = {
    from: { row: headerRow, column: 1 },
    to: { row: headerRow + sorted.length, column: DETAIL_COLUMNS.length },
  };
  ws.views = [{ state: "frozen", ySplit: headerRow }];
  autoWidth(ws);
}

// ------------------------------------------------------------- 2..4. Özetler

/**
 * Çapraz tablo sayfası: satır ekseni × imalat türü.
 *
 * KIRPMA YOK — ekranda en büyük 25 satır gösterilir, dosyada TAMAMI olur.
 * Dışa aktarım zaten "ekranın söylemediğini de görmek" için istenir.
 */
function writeCrossSheet(
  ws: ExcelJS.Worksheet,
  rows: readonly WorkLogRow[],
  meta: WorkLogExportMeta,
  title: string,
  rowDim: WorkDimension | "month",
  colDim: WorkDimension
): void {
  const colBuckets = breakdown(rows, colDim);
  const cells = new Map<string, number>();
  const rowTotals = new Map<string, { label: string; hint: string; total: number; records: number }>();

  for (const r of rows) {
    const rk =
      rowDim === "month" ? bucketKey(r.date, "month") : dimensionValue(r, rowDim).key;
    const rl =
      rowDim === "month" ? bucketLabel(rk, "month") : dimensionValue(r, rowDim).label;
    const rh = rowDim === "month" ? "" : dimensionValue(r, rowDim).hint;
    const ck = dimensionValue(r, colDim).key;
    cells.set(cellKey(rk, ck), (cells.get(cellKey(rk, ck)) ?? 0) + r.manHours);
    const cur = rowTotals.get(rk) ?? { label: rl, hint: rh, total: 0, records: 0 };
    cur.total += r.manHours;
    cur.records += 1;
    if (!cur.hint && rh) cur.hint = rh;
    rowTotals.set(rk, cur);
  }

  const ordered =
    rowDim === "month"
      ? [...rowTotals.entries()].sort((a, b) => a[0].localeCompare(b[0]))
      : [...rowTotals.entries()].sort((a, b) => b[1].total - a[1].total);

  const colCount = 2 + colBuckets.length + 2; // ad + açıklama + türler + kayıt + toplam
  const headerRow = writeBand(ws, title, meta, colCount);

  const head = ws.getRow(headerRow);
  head.getCell(1).value = rowDim === "month" ? "Ay" : "Ad";
  head.getCell(2).value = rowDim === "month" ? "" : "Açıklama";
  colBuckets.forEach((c, i) => (head.getCell(3 + i).value = c.label));
  head.getCell(3 + colBuckets.length).value = "Kayıt";
  head.getCell(4 + colBuckets.length).value = "Toplam Adam·Saat";
  styleHeaderRow(head, colCount);

  ordered.forEach(([key, info], i) => {
    const row = ws.getRow(headerRow + 1 + i);
    row.getCell(1).value = info.label;
    row.getCell(2).value = info.hint;
    colBuckets.forEach((c, j) => {
      const v = cells.get(cellKey(key, c.key)) ?? 0;
      const cell = row.getCell(3 + j);
      if (v > 0) cell.value = v;
      cell.numFmt = "#,##0.##";
    });
    row.getCell(3 + colBuckets.length).value = info.records;
    const total = row.getCell(4 + colBuckets.length);
    total.value = info.total;
    total.numFmt = "#,##0.##";
    total.font = { bold: true };
  });

  const totalRow = ws.getRow(headerRow + 1 + ordered.length);
  totalRow.getCell(1).value = "TOPLAM";
  colBuckets.forEach((c, j) => {
    const cell = totalRow.getCell(3 + j);
    cell.value = c.manHours;
    cell.numFmt = "#,##0.##";
  });
  totalRow.getCell(3 + colBuckets.length).value = rows.length;
  totalRow.getCell(4 + colBuckets.length).value = rows.reduce((s, r) => s + r.manHours, 0);
  totalRow.getCell(4 + colBuckets.length).numFmt = "#,##0.##";
  for (let c = 1; c <= colCount; c++) {
    totalRow.getCell(c).fill = TOTAL_FILL;
    totalRow.getCell(c).font = { bold: true };
  }

  ws.views = [{ state: "frozen", ySplit: headerRow, xSplit: 1 }];
  autoWidth(ws);
}

// ------------------------------------------------------------------ kitap

export function buildWorkLogWorkbook(
  rows: readonly WorkLogRow[],
  meta: WorkLogExportMeta
): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  wb.creator = "ORION Hesap Raporu";
  wb.created = new Date();

  const landscape: Partial<ExcelJS.PageSetup> = {
    orientation: "landscape",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
  };

  writeDetailSheet(wb.addWorksheet("Kayıtlar", { pageSetup: landscape }), rows, meta);
  writeCrossSheet(
    wb.addWorksheet("Aylık Özet", { pageSetup: landscape }),
    rows,
    meta,
    "Aylık Özet",
    "month",
    "category"
  );
  writeCrossSheet(
    wb.addWorksheet("İş Kalemi Özeti", { pageSetup: landscape }),
    rows,
    meta,
    "İş Kalemi Özeti",
    "item",
    "category"
  );
  writeCrossSheet(
    wb.addWorksheet("Parça Özeti", { pageSetup: landscape }),
    rows,
    meta,
    "Parça Özeti",
    "part",
    "category"
  );

  // Künye sayfası: dosyanın hangi süzgeçle, ne zaman ve kim tarafından
  // üretildiği. Bir Excel dosyası e-postayla dolaşır; bağlamını kendi
  // taşımalıdır.
  const info = wb.addWorksheet("Künye", { pageSetup: { orientation: "portrait" } });
  const infoHeader = writeBand(info, "Künye", meta, 2);
  const s = summarize(rows);
  const facts: [string, string | number][] = [
    ["Süzgeç", meta.filterText],
    ["Üretim zamanı", meta.generatedAt],
    ["Üreten", meta.preparedBy],
    ["Kayıt sayısı", rows.length],
    ["Toplam adam·saat", s.manHours],
    ["Çalışılan gün", s.days],
    ["Günlük ortalama adam·saat", Number(s.dailyAverage.toFixed(1))],
    ["Farklı iş kalemi", s.items],
    ["Farklı parça", s.parts],
    ["İşe bağlanmamış kayıt", s.unmatched],
  ];
  facts.forEach(([label, value], i) => {
    const row = info.getRow(infoHeader + i);
    row.getCell(1).value = label;
    row.getCell(1).font = { bold: true };
    row.getCell(2).value = value;
    if (typeof value === "number") row.getCell(2).numFmt = "#,##0.##";
  });
  autoWidth(info, 12, 70);

  return wb;
}
