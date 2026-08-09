// Parça defteri Excel çıktısı.
//
// SAF: DB/HTTP bağımlılığı yok — route handler veriyi süzer, burası çalışma
// kitabını kurar. Marka dili İş Takibi ve ekipman listesiyle aynı: kömür
// başlık, kırmızı ince ayraç, mono teknik metin, ayrı künye sayfası.
//
// SÜZGEÇ ÖZETİ KÜNYEYE YAZILIR. Bu bir nezaket değil zorunluluk: aynı paketten
// iki farklı süzgeçle alınan iki dosya klasörde yan yana durunca hangisinin ne
// olduğu ancak künyeden anlaşılır.

import ExcelJS from "exceljs";

// Marka renkleri (design-system/readme.md)
const CHARCOAL = "FF262626";
const ORION_RED = "FFA41E1E";
const PAPER_200 = "FFE7E4E2";

const BASLIK_DOLGU: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: CHARCOAL } };
const KIRMIZI_DOLGU: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: ORION_RED } };
const MONTAJ_DOLGU: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: PAPER_200 } };

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

function baslikSatiri(ws: ExcelJS.Worksheet, row: number): void {
  const r = ws.getRow(row);
  SUTUNLAR.forEach((s, i) => {
    const c = r.getCell(i + 1);
    c.value = s.baslik;
    c.fill = BASLIK_DOLGU;
    c.font = { bold: true, size: 9, color: { argb: "FFFFFFFF" } };
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
    views: [{ state: "frozen", ySplit: 4 }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  ws.columns = SUTUNLAR.map((s) => ({ width: s.genislik }));

  ws.mergeCells(1, 1, 1, SUTUNLAR.length);
  const t = ws.getCell(1, 1);
  t.value = meta.packageTitle;
  t.font = { bold: true, size: 13 };
  ws.getRow(1).height = 20;

  ws.mergeCells(2, 1, 2, SUTUNLAR.length);
  const alt = ws.getCell(2, 1);
  alt.value = `${meta.docCode} · kalem ${meta.itemNo || "—"} · ${meta.filterText}`;
  alt.font = { size: 8, color: { argb: "FF666666" }, name: "Consolas" };

  // Kırmızı ince ayraç — marka omurgasının tablodaki karşılığı.
  ws.mergeCells(3, 1, 3, SUTUNLAR.length);
  ws.getCell(3, 1).fill = KIRMIZI_DOLGU;
  ws.getRow(3).height = 3;

  baslikSatiri(ws, 4);

  parts.forEach((p, i) => {
    const r = ws.getRow(5 + i);
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
    r.getCell(1).font = { size: 9, name: "Consolas", bold: p.isMontaj };
    if (p.isMontaj) {
      // Montaj satırı ayırt edilir — ekrandaki kuralın Excel'deki karşılığı.
      for (let c = 1; c <= SUTUNLAR.length; c++) r.getCell(c).fill = MONTAJ_DOLGU;
      r.getCell(2).font = { size: 9, bold: true };
    }
    for (const c of [6, 8, 9, 10]) {
      r.getCell(c).alignment = { horizontal: "right" };
      r.getCell(c).numFmt = c === 10 ? "#,##0.000" : c === 6 || c === 9 ? "#,##0.0" : "#,##0";
    }
    for (const c of [11, 12, 13]) r.getCell(c).alignment = { horizontal: "center" };
  });

  ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: SUTUNLAR.length } };

  // ————————————————————————————————————————————————— Künye
  const k = wb.addWorksheet("Künye");
  k.columns = [{ width: 24 }, { width: 72 }];
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
    const r = k.getRow(i + 1);
    r.getCell(1).value = ad;
    r.getCell(1).font = { bold: true, size: 9 };
    r.getCell(2).value = deger;
    r.getCell(2).font = { size: 9 };
    r.getCell(2).alignment = { wrapText: true };
  });

  return wb;
}
