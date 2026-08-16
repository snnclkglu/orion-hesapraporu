// İşler listesinin Excel çıktısı — ekranda GÖRÜNEN (süzülmüş + sıralanmış)
// listenin birebir dökümü.
//
// Satırlar bu dosyaya SÜZÜLMÜŞ gelir: süzgeç kuralı `lib/jobs/filter.ts`tedir
// ve ekranla ortaktır (İş Takibi dersinin aynısı — iki ayrı süzgeç yazımı,
// indirilen dosya ile tabloyu sessizce ayrıştırırdı). Künye satırı hangi
// süzgeçle alındığını YAZAR: ada bakan, dökümün neyin dökümü olduğunu bilir.

import ExcelJS from "exceljs";
import {
  HAIRLINE,
  MODULE_PREFIX,
  MONO_FONT,
  autoWidth,
  styleHeaderRow,
  writeTitleBlock,
} from "./brand";
import { JOB_STATUS_LABELS, jobStatusOf } from "@/lib/job-status";
import { customerTag } from "@/lib/tags";
import { fmtJobDate, type JobListRow } from "@/lib/jobs/filter";

export interface JobsExportMeta {
  /** Süzgeç özeti (describeJobFilters çıktısı). */
  filterText: string;
  generatedAt: string;
  preparedBy: string;
}

const HEADERS = [
  "İş No",
  "İşin Adı",
  "Müşteri",
  "Tam Unvan",
  "Kalem",
  "Rapor",
  "Tarih",
  "Durum",
] as const;

export function buildJobsWorkbook(
  rows: readonly JobListRow[],
  meta: JobsExportMeta
): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  wb.creator = "ORION Hesap Raporu";
  wb.created = new Date();

  const ws = wb.addWorksheet("İşler", {
    pageSetup: {
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    },
  });

  const headerRowNo = writeTitleBlock(ws, "İş Listesi", HEADERS.length, {
    prefix: MODULE_PREFIX.jobs,
    meta: [
      meta.filterText,
      `${rows.length} iş`,
      meta.generatedAt,
      meta.preparedBy,
    ],
  });

  const header = ws.getRow(headerRowNo);
  HEADERS.forEach((h, i) => {
    header.getCell(i + 1).value = h;
  });
  styleHeaderRow(header, HEADERS.length);

  rows.forEach((j, idx) => {
    const r = ws.getRow(headerRowNo + 1 + idx);
    const tag = customerTag({ name: j.customer, shortName: j.customerShort });
    r.getCell(1).value = j.job_no;
    r.getCell(1).font = { name: MONO_FONT, size: 10 };
    r.getCell(2).value = j.title;
    r.getCell(3).value = tag.short;
    // Kısaltma listeler içindir; resmî unvan da yanında durur — Excel çoğu
    // zaman firma dışına gider ve "İSDEMİR" tek başına bir unvan değildir.
    r.getCell(4).value = j.customer;
    r.getCell(5).value = j.itemCount;
    r.getCell(6).value = j.craneCount;
    r.getCell(7).value = fmtJobDate(j.work_order_date || j.created_at);
    r.getCell(7).font = { name: MONO_FONT, size: 10 };
    r.getCell(8).value = JOB_STATUS_LABELS[jobStatusOf(j.status)];
    for (let c = 1; c <= HEADERS.length; c++) {
      r.getCell(c).border = {
        bottom: { style: "thin", color: { argb: HAIRLINE } },
      };
    }
  });

  autoWidth(ws);
  return wb;
}
