// Satın alma talebi Excel'i — SÜZGEÇLENMİŞ ya da SEÇİLİ kalemler.
//
// `drawing-outputs.ts`teki üç sayfalık "satın alma kitabı" ile karıştırılmaz:
// o paketin TAMAMIDIR (satın alınacaklar + sac ihtiyacı + testere kesim) ve
// atölyenin dökümüdür. Bu ise satınalmacının o an ekranda süzdüğü listedir ve
// PDF'in birebir eşidir — ikisi yan yana konduğunda aynı satırları taşımalıdır.
//
// Sipariş durumu ve teslim tarihi SÜTUN OLARAK DURUR: tedarikçiye giden PDF'te
// bu bilgi bir kolaylıktır, firma içinde ise takip listesinin kendisidir.

import ExcelJS from "exceljs";
import {
  MODULE_PREFIX,
  TOTAL_FILL,
  autoWidth,
  styleHeaderRow,
  writeTitleBlock,
} from "./brand";
import type { DrawingExportMeta } from "./drawing-outputs";

const LANDSCAPE: Partial<ExcelJS.PageSetup> = {
  orientation: "landscape",
  fitToPage: true,
  fitToWidth: 1,
  fitToHeight: 0,
};

/** Boş hücrede tire: okuyucu "yazılmamış" ile "sıfır"ı ayırt edebilmeli. */
const YOK = "—";

const SUTUNLAR = [
  "Kategori",
  "Tanım",
  "Adet",
  "Malzeme",
  "Toplam kg",
  "Parça Kodu",
  "Durum",
  "Tahmini Teslim",
  "Defter Satırı",
  "Kaynak",
];

export interface PurchasingSheetRow {
  sinif: string;
  tanim: string;
  adet: number | null;
  malzeme: string;
  malzemeler: string[];
  toplamAgirlikKg: number | null;
  parcaKodu: string;
  sourceRows: number;
  kaynak: string;
  alindi: boolean;
  teslim: boolean;
  /** `YYYY-MM-DD` ya da boş. */
  dueAt: string;
}

function sayiHucresi(row: ExcelJS.Row, kolon: number, deger: number | null): void {
  const h = row.getCell(kolon);
  if (deger == null || !Number.isFinite(deger)) {
    h.value = YOK;
    return;
  }
  h.value = deger;
  h.numFmt = Number.isInteger(deger) ? "#,##0" : "#,##0.000";
}

function durumMetni(r: PurchasingSheetRow): string {
  if (r.teslim) return "Teslim alındı";
  if (r.alindi) return "Satın alındı";
  return "Bekliyor";
}

export function buildPurchasingWorkbook(
  rows: readonly PurchasingSheetRow[],
  meta: DrawingExportMeta,
  filtreMetni: string
): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  wb.creator = "ORION";
  wb.created = new Date();

  const ws = wb.addWorksheet("Satın Alma Talebi", { pageSetup: LANDSCAPE });
  const baslikNo = writeTitleBlock(ws, "Satın Alma Talebi", SUTUNLAR.length, {
    prefix: MODULE_PREFIX.drawings,
    meta: [meta.paketAdi, meta.belgeKodu, meta.generatedAt, meta.preparedBy, `Süzgeç: ${filtreMetni}`],
  });
  const head = ws.getRow(baslikNo);
  SUTUNLAR.forEach((label, i) => (head.getCell(i + 1).value = label));
  styleHeaderRow(head, SUTUNLAR.length);

  rows.forEach((r, i) => {
    const row = ws.getRow(baslikNo + 1 + i);
    row.getCell(1).value = r.sinif;
    row.getCell(2).value = r.tanim || YOK;
    sayiHucresi(row, 3, r.adet);
    // ÇELİŞKİ GİZLENMEZ: aynı kalem iki malzemeyle geçtiyse ikisi de yazılır.
    row.getCell(4).value =
      r.malzemeler.length > 1 ? r.malzemeler.join(" / ") : r.malzeme || YOK;
    sayiHucresi(row, 5, r.toplamAgirlikKg);
    row.getCell(6).value = r.parcaKodu || YOK;
    row.getCell(7).value = durumMetni(r);
    // TARİH GERÇEK TARİH OLARAK YAZILIR, metin olarak değil: satınalmacı
    // Excel'de tarihe göre süzer ve sıralar; metin sütunu bunu yapamaz.
    const teslim = row.getCell(8);
    if (/^\d{4}-\d{2}-\d{2}$/.test(r.dueAt)) {
      teslim.value = new Date(`${r.dueAt}T00:00:00`);
      teslim.numFmt = "dd.mm.yyyy";
    } else {
      teslim.value = YOK;
    }
    sayiHucresi(row, 9, r.sourceRows);
    if (r.sourceRows > 1) row.getCell(9).font = { bold: true };
    row.getCell(10).value = r.kaynak || YOK;
  });

  const toplamNo = baslikNo + 1 + rows.length;
  const toplam = ws.getRow(toplamNo);
  toplam.getCell(1).value = "TOPLAM";
  toplam.getCell(2).value = `${rows.length} kalem`;
  sayiHucresi(toplam, 3, rows.reduce((t, r) => t + (r.adet ?? 0), 0));
  const agirlik = rows.reduce((t, r) => t + (r.toplamAgirlikKg ?? 0), 0);
  sayiHucresi(toplam, 5, agirlik > 0 ? agirlik : null);
  for (let i = 1; i <= SUTUNLAR.length; i++) {
    toplam.getCell(i).fill = TOTAL_FILL;
    toplam.getCell(i).font = { bold: true };
  }

  ws.views = [{ state: "frozen", ySplit: baslikNo }];
  autoWidth(ws);
  return wb;
}
