// Ekipman listesi EXCEL ÇIKTISI — revizyonun seçim (selections) verilerinden
// iki sayfalık .xlsx üretir:
//   1. "Ekipman Listesi"     — satın alma / montaj için bileşen dökümü
//   2. "Teknik Ressam Özeti" — çizim için ana ölçüler (plaka, teker, tambur...)
// Saf fonksiyondur (DB/HTTP bağımlılığı yok); route handler ve test script'i
// aynı fonksiyonu kullanır.
//
// SATIRLARI KURAN YARI BURADA DEĞİL `@/lib/equipment-list`TEDİR ve aşağıda
// OLDUĞU GİBİ YENİDEN DIŞA VERİLİR — hiçbir çağrı yeri iki dosya bilmek zorunda
// değildir. Ayrımın sebebi `exceljs`tir: bu modülü içe aktaran her yüzey o
// kütüphaneyi de yüklüyordu ve ekipman satırlarını okumak isteyen İSTEMCİ
// ekranlarının (revizyon editörü) buna ihtiyacı yok.

import ExcelJS from "exceljs";
import {
  COL_FILL,
  HAIRLINE,
  HEADER_FILL,
  MONO_FONT,
  MUTED_GRAY,
  ORION_RED,
  PAPER,
  TITLE_FONT,
  autoWidth,
  colLetter,
  writeTitleBlock,
} from "@/lib/excel/brand";
import { trBuyuk } from "@/lib/tr-text";
import type { EquipmentSection } from "@/lib/equipment-sections";
import { type RevisionAlts } from "@/lib/revision-load";
import type { CalcInput, CalcResult } from "@/lib/calc/engine";
import {
  absentModuleGroupNames,
  buildCatalogSheetUrls,
  buildEquipmentGroups,
  buildSummarySections,
  mergeExtras,
  notLineCount,
  qtyCellValue,
  rowDatasheetUrl,
  rowSheetUrl,
  summaryRowValue,
  textOr,
  type EquipmentAttachments,
  type EquipmentDrawingPlan,
  type EquipmentExtraRow,
  type EquipmentMeta,
  type EquipmentNotes,
} from "@/lib/equipment-list";
/** Ekipman listesinin saf çekirdeği — çağrı yerleri tek modül görür. */
export * from "@/lib/equipment-list";


const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: HAIRLINE } },
  bottom: { style: "thin", color: { argb: HAIRLINE } },
  left: { style: "thin", color: { argb: HAIRLINE } },
  right: { style: "thin", color: { argb: HAIRLINE } },
};

/**
 * Ekipman listesinin sütun genişliği sınırı ortak varsayılandan (9..46)
 * geniştir: "Özellikler" ve "Ek Özellikler" sütunları serbest metin taşır ve
 * 46 karakterde satın alma satırı okunmaz hâle geliyordu.
 */
const WIDTH_MIN = 8;
const WIDTH_MAX = 60;

/**
 * Sayfanın marka bandı: kömür başlık + künye + kırmızı ayraç + proje
 * sorumluları. Tablo başlık satırının numarasını döndürür.
 *
 * BAŞLIKTA MARKA ÖNEKİ YOKTUR — İş Takibi ve Teknik Resimler çıktıları
 * "ORION — <MODÜL> · <sayfa>" yazarken burası yalnız belgenin kendi adını
 * ("EKİPMAN LİSTESİ") basar. Bu bir eksik değil KARARDIR: ekipman listesi
 * müşteriye teslim edilen bir belgedir (`scope: "customer"`) ve PDF eşiyle
 * aynı anatomiyi taşır — orada da başlık belgenin/projenin adıdır, marka
 * lockup logoda, doküman satırında ve altbilgide durur. Excel'de de öyledir:
 * `writeFooterRow` her sayfaya "ORION CRANES · … " basar. Öneki eklemek
 * markayı çoğaltmakla kalmaz, teslim edilmiş belgenin görünümünü değiştirirdi.
 */
function writeBand(
  ws: ExcelJS.Worksheet,
  title: string,
  meta: EquipmentMeta,
  colCount: number
): number {
  return writeTitleBlock(ws, title, colCount, {
    meta: [
      textOr(meta.projectName),
      textOr(meta.docNo),
      `REV V${meta.revNo}${meta.revLabel ? ` — ${meta.revLabel}` : ""}`,
      meta.date,
    ],
    details: [
      ["Müşteri", textOr(meta.customer)],
      ["Hazırlayan", textOr(meta.preparedBy)],
      ["Kontrol", textOr(meta.checkedBy)],
    ],
  });
}

const HYPERLINK_FONT = { color: { argb: "FF1155CC" }, underline: true as const };

function writeEquipmentSheet(
  ws: ExcelJS.Worksheet,
  sections: readonly EquipmentSection[],
  meta: EquipmentMeta,
  datasheetUrls?: Map<string, string>,
  /** Ekipman ADINA bağlanan katalog sayfası adresleri (mutlak) */
  sheetUrls?: Map<string, string>,
  /** Ekipman listesinin üstünde açılan müşteri ana pafta bağlantısı. */
  mainDrawingUrl?: string,
  /** Bant başlığı — bölüm seçildiyse belgenin adı onu söyler. */
  bandTitle = "EKİPMAN LİSTESİ"
): number {
  // Sütunlar: # · Ekipman · Marka · Model · Özellikler · Ek Özellikler · Ek Belge · Adet
  const COL_COUNT = 8;
  const QTY_COL = 8;
  const ATTACH_COL = 7;
  let headerRowNo = writeBand(ws, bandTitle, meta, COL_COUNT);

  if (mainDrawingUrl) {
    ws.mergeCells(`A${headerRowNo}:${colLetter(COL_COUNT)}${headerRowNo}`);
    const link = ws.getCell(`A${headerRowNo}`);
    link.value = { text: "Proje Ana Paftasını Aç ↗", hyperlink: mainDrawingUrl };
    link.font = { ...HYPERLINK_FONT, name: TITLE_FONT, size: 10 };
    link.alignment = { vertical: "middle" };
    ws.getRow(headerRowNo).height = 19;
    headerRowNo += 1;
  }

  // Tablo başlığı — müşteriye teslim edilebilir profesyonel sütunlar.
  // Ortak `styleHeaderRow` KULLANILMAZ: o, açık (Kağıt 200) zeminli iç
  // çıktıların başlığıdır; müşteri belgesi kömür zeminli, çerçeveli ve adet
  // sütunu sağa dayalı başlık taşır.
  const header = ws.getRow(headerRowNo);
  ["#", "Ekipman", "Marka", "Model", "Özellikler", "Ek Özellikler", "Ek Belge", "Adet"].forEach((h, i) => {
    const cell = header.getCell(i + 1);
    cell.value = h;
    cell.font = { name: TITLE_FONT, bold: true, color: { argb: PAPER } };
    cell.fill = HEADER_FILL;
    cell.border = THIN_BORDER;
    cell.alignment = {
      horizontal: i + 1 === QTY_COL ? "right" : "left",
      vertical: "middle",
    };
  });
  header.height = 18;

  // Başlığa kadar dondur + başlık satırında filtre
  ws.views = [{ state: "frozen", ySplit: headerRowNo }];
  ws.autoFilter = {
    from: { row: headerRowNo, column: 1 },
    to: { row: headerRowNo, column: COL_COUNT },
  };

  let rowNo = headerRowNo + 1;
  let componentCount = 0;

  // BÖLÜM BANDI ANCAK AYIRACAK BİR ŞEY VARSA basılır (`showSectionBands`):
  // tek bölümlü bir belgede başlık hiçbir şeyi ayırmaz, adı zaten bantta yazar.
  const bands = sections.length > 1;

  sections.forEach((section) => {
    if (bands) {
      // Bölüm başlığı grup başlığından BİR TON KOYUDUR: ikisi aynı görünseydi
      // "Elektrik Ekipmanları" ile "Kontaktörler" aynı düzeyde okunurdu.
      ws.mergeCells(`A${rowNo}:${colLetter(COL_COUNT)}${rowNo}`);
      const sc = ws.getCell(`A${rowNo}`);
      sc.value = trBuyuk(section.name);
      sc.font = { name: TITLE_FONT, bold: true, size: 11, color: { argb: PAPER } };
      sc.fill = HEADER_FILL;
      sc.alignment = { vertical: "middle" };
      for (let c = 1; c <= COL_COUNT; c++) {
        ws.getRow(rowNo).getCell(c).border = THIN_BORDER;
      }
      ws.getRow(rowNo).height = 20;
      rowNo += 1;
    }

    section.groups.forEach((group) => {
      // Grup başlığı: birleşik satır (marka kırmızısı üst çizgi, nötr dolgu)
      ws.mergeCells(`A${rowNo}:${colLetter(COL_COUNT)}${rowNo}`);
      const gc = ws.getCell(`A${rowNo}`);
      gc.value = group.name;
      gc.font = { bold: true };
      gc.fill = COL_FILL;
      for (let c = 1; c <= COL_COUNT; c++) {
        ws.getRow(rowNo).getCell(c).border = {
          ...THIN_BORDER,
          top: { style: "medium", color: { argb: ORION_RED } },
        };
      }
      rowNo += 1;

      group.rows.forEach((r) => {
        const row = ws.getRow(rowNo);
      const sequence = componentCount + 1;
      row.getCell(1).value = sequence;
      row.getCell(1).font = { name: MONO_FONT, color: { argb: MUTED_GRAY } };
      // Ekipman adı: katalog sayfası varsa müşteriye açık görüntüleyiciye köprü.
      // Excel dosyası uygulamanın dışında açıldığı için adres MUTLAKTIR.
      const sheetUrl = rowSheetUrl(r, sheetUrls);
      if (sheetUrl) {
        row.getCell(2).value = { text: r.component, hyperlink: sheetUrl };
        row.getCell(2).font = HYPERLINK_FONT;
      } else {
        row.getCell(2).value = r.component;
      }
      row.getCell(3).value = r.brand;
      // Model hücresi: üreticinin teknik föyü varsa köprüle. Anahtar KATALOG
      // kimliğidir, görünen model değil (bkz. `rowDatasheetUrl`). Klima
      // satırlarında website bağlantısı müşteri çıktılarında gösterilmez.
      const url = rowDatasheetUrl(r, datasheetUrls);
      if (url && r.model && r.model !== "-") {
        row.getCell(4).value = { text: r.model, hyperlink: url };
        row.getCell(4).font = HYPERLINK_FONT;
      } else {
        row.getCell(4).value = r.model;
      }
      row.getCell(5).value = r.spec;
      row.getCell(6).value = r.note ?? "";
      // "Ek Belge": baytlar Excel'e GİRMEZ; hücre yalnız kompakt bir ek
      // göstergesi taşır. Ekin kendisi DETAYLI PDF'in sonundadır; çalışma kitabına
      // gömülü bir PDF, dosyayı hem şişirir hem de her açanda güven uyarısı
      // çıkarırdı.
      row.getCell(ATTACH_COL).value = r.attachments?.length
        ? `EK${r.attachments.reduce((sum, item) => sum + item.pageCount, 0) > 1
          ? ` · ${r.attachments.reduce((sum, item) => sum + item.pageCount, 0)} sf`
          : ""}`
        : "";
      // OKUNAMAYAN ADET HÜCREYİ BOŞ BIRAKIR (`qtyCellValue`): "—" bir metindir
      // ve adet sütununu metne çevirip sıralamayı bozardı; `0` ise yalan olurdu.
      row.getCell(QTY_COL).value = qtyCellValue(r.qty);
      // Adet: sayılar TR ayraçlı, sağa dayalı, mono
      if (typeof r.qty === "number") {
        row.getCell(QTY_COL).numFmt = Number.isInteger(r.qty) ? "#,##0" : "#,##0.00";
        row.getCell(QTY_COL).font = { name: MONO_FONT };
      }
      for (let c = 1; c <= COL_COUNT; c++) {
        const cell = row.getCell(c);
        cell.border = THIN_BORDER;
        cell.alignment = {
          horizontal: c === QTY_COL ? "right" : "left",
          vertical: "middle",
          wrapText: c === 5 || c === 6,
          // Alternatif satır ana satırın altında GİRİNTİLİ durur: satın alma
          // listesinde hangi satırın asıl seçim olduğu tek bakışta görünsün.
          indent: r.alt && c === 2 ? 1 : undefined,
        };
        if (sequence % 2 === 0) {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFF3F3F2" },
          };
        }
        // Alternatifler ikincil bilgidir: eğik ve soluk yazılır. Köprülü
        // hücrelerin (ekipman adı, model) rengi bozulmaz — bağlantı mavisi
        // kalmazsa tıklanabilir olduğu anlaşılmaz.
        if (r.alt && !cell.font?.underline) {
          cell.font = { ...(cell.font ?? {}), italic: true, color: { argb: MUTED_GRAY } };
        }
      }
        rowNo += 1;
        componentCount += 1;
      });
    });
  });

  writeFooterRow(ws, rowNo + 1, COL_COUNT, bandTitle, meta);

  autoWidth(ws, WIDTH_MIN, WIDTH_MAX);
  ws.getColumn(1).width = 6; // sıra
  ws.getColumn(2).width = 28; // ekipman: önceki düzene göre yaklaşık %20 geniş
  ws.getColumn(3).width = 18; // marka: önceki düzene göre yaklaşık %20 geniş
  ws.getColumn(4).width = 22; // model
  ws.getColumn(5).width = 55; // özellikler: önceki 46'dan yaklaşık %20 geniş
  ws.getColumn(6).width = 22; // ek özellikler: önceki 32'den yaklaşık %30 dar
  ws.getColumn(ATTACH_COL).width = 9; // yalnız kompakt ek göstergesi
  ws.getColumn(QTY_COL).width = 9;
  return componentCount;
}

/** Altbilgi: gri küçük mono satır — "ORION CRANES · {sayfa} · {doküman no}" */
function writeFooterRow(
  ws: ExcelJS.Worksheet,
  rowNo: number,
  colCount: number,
  sheetLabel: string,
  meta: EquipmentMeta
): void {
  const lastCol = colLetter(colCount);
  ws.mergeCells(`A${rowNo}:${lastCol}${rowNo}`);
  const cell = ws.getCell(`A${rowNo}`);
  cell.value = `ORION CRANES · ${sheetLabel} · ${textOr(meta.docNo)}`;
  cell.font = { name: MONO_FONT, size: 8, color: { argb: MUTED_GRAY } };
  cell.alignment = { horizontal: "left", vertical: "middle" };
}


function writeSummarySheet(
  ws: ExcelJS.Worksheet,
  input: CalcInput,
  result: CalcResult,
  meta: EquipmentMeta,
  drawingPlan?: EquipmentDrawingPlan,
  drawingNote?: string
): void {
  const headerRowNo = writeBand(ws, "TEKNİK RESSAM ÖZETİ", meta, 3);

  const header = ws.getRow(headerRowNo);
  ["Ölçü / Özellik", "Değer", "Birim"].forEach((h, i) => {
    const cell = header.getCell(i + 1);
    cell.value = h;
    cell.font = { name: TITLE_FONT, bold: true, color: { argb: PAPER } };
    cell.fill = HEADER_FILL;
    cell.border = THIN_BORDER;
    cell.alignment = { horizontal: i === 1 ? "right" : "left", vertical: "middle" };
  });
  header.height = 18;

  // Başlığa kadar dondur + başlık satırında filtre
  ws.views = [{ state: "frozen", ySplit: headerRowNo }];
  ws.autoFilter = { from: { row: headerRowNo, column: 1 }, to: { row: headerRowNo, column: 3 } };

  let rowNo = headerRowNo + 1;
  const sections = buildSummarySections(input, result, drawingPlan, drawingNote);
  /** Bölüm başlığı bandı — üç hücresi de kenarlıklıdır (merge kenarlığı A'da kalmaz). */
  const sectionBand = (title: string) => {
    ws.mergeCells(`A${rowNo}:C${rowNo}`);
    const sc = ws.getCell(`A${rowNo}`);
    sc.value = title;
    sc.font = { bold: true };
    sc.fill = COL_FILL;
    for (let c = 1; c <= 3; c += 1) ws.getRow(rowNo).getCell(c).border = THIN_BORDER;
    rowNo += 1;
  };

  for (const section of sections) {
    // ŞEMALAR EXCEL'E GİRMEZ. ExcelJS yalnız raster basar (png/jpeg/gif) ve
    // diyagramlar vektördür; hücre ızgarasına oturmayan bir görüntü, tablo
    // filtrelendiğinde yerinde kalır. Şema yalnız PDF ve ekrandadır ve bunu
    // BÖLÜM ATLANMADAN söyleriz — sessiz bir boşluk "unutulmuş" okunurdu.
    if (section.kind === "notes") {
      // NOTLAR filtre bölgesinden bir boş satırla ayrılır: merge'lü çok
      // satırlı bir hücre otomatik süzgecin içinde kalırsa Excel uyarır.
      rowNo += 1;
      sectionBand(section.name);
      ws.mergeCells(`A${rowNo}:C${rowNo}`);
      const nc = ws.getCell(`A${rowNo}`);
      nc.value = section.text ?? "";
      nc.alignment = { wrapText: true, vertical: "top", horizontal: "left" };
      nc.border = THIN_BORDER;
      // Yükseklik hem SATIR SAYISINDAN hem uzunluktan türer: yalnız uzunluğa
      // bakmak, kısa ama madde madde yazılmış bir notu tek satıra sıkıştırır.
      const satirSayisi = notLineCount(section.text ?? "");
      ws.getRow(rowNo).height = Math.max(16, satirSayisi * 14);
      rowNo += 1;
      continue;
    }

    sectionBand(section.name);

    if (section.rows.length === 0 && section.diagram) {
      const row = ws.getRow(rowNo);
      row.getCell(1).value = "Şema — yalnız PDF ve ekran";
      row.getCell(1).font = { italic: true, color: { argb: MUTED_GRAY } };
      for (let c = 1; c <= 3; c += 1) row.getCell(c).border = THIN_BORDER;
      rowNo += 1;
      continue;
    }

    for (const r of section.rows) {
      const row = ws.getRow(rowNo);
      // AÇIKLAMA ETİKETİN İÇİNE GİRER, dördüncü bir sütun AÇILMAZ: bant
      // genişliği, filtre aralığı, merge ve kenarlık döngüsü sütun sayısına
      // beş ayrı yerde bağlıdır ve biri unutulursa sessizce bozulur.
      row.getCell(1).value = r.note ? `${r.label}  —  ${r.note}` : r.label;
      row.getCell(2).value = r.diameter ? summaryRowValue(r) : r.value;
      row.getCell(3).value = r.unit ?? "";
      // Değer kolonu: sayılar TR ayraçlı, sağa dayalı, mono
      if (typeof r.value === "number" && !r.diameter) {
        row.getCell(2).numFmt = Number.isInteger(r.value) ? "#,##0" : "#,##0.00";
        row.getCell(2).font = { name: MONO_FONT };
      }
      for (let c = 1; c <= 3; c++) {
        const cell = row.getCell(c);
        cell.border = THIN_BORDER;
        cell.alignment = { horizontal: c === 1 ? "left" : "right", vertical: "middle" };
      }
      rowNo += 1;
    }
  }

  writeFooterRow(ws, rowNo + 1, 3, "TEKNİK RESSAM ÖZETİ", meta);

  autoWidth(ws, WIDTH_MIN, WIDTH_MAX);
}

// --- ana giriş ---------------------------------------------------------------

export interface EquipmentWorkbookOptions {
  /** kind|brand|model → datasheet URL (Model hücresi köprülenir) */
  datasheetUrls?: Map<string, string>;
  /**
   * "full"    → Ekipman Listesi + Teknik Ressam Özeti (dahili, varsayılan)
   * "customer"→ yalnızca Ekipman Listesi (müşteriye teslim edilecek dosya)
   */
  scope?: "full" | "customer";
  /** Panelden eklenen ek ekipman/özellik satırları */
  extras?: EquipmentExtraRow[];
  /** row_key → "Ek Özellikler" notu (equipment_notes) */
  notes?: EquipmentNotes;
  /** row_key → "Ek Belge" yüklemeleri (equipment_attachments) */
  attachments?: EquipmentAttachments;
  /** Alternatif (seçenekli) seçimler — `selections.alts` (altsFromRevision) */
  alts?: RevisionAlts;
  /**
   * Uygulamanın kök adresi (`https://…`). Verilirse ekipman ADI, ürünün katalog
   * sayfasını açan uygulama adresine köprülenir. Excel dosyası uygulamanın
   * dışında açıldığından adresin MUTLAK olması şarttır; kök bilinmiyorsa
   * (ör. birim testi) bağlantı hiç kurulmaz.
   */
  appOrigin?: string;
  /** Müşterinin üyelik olmadan açacağı seçilmiş proje ana paftası (mutlak). */
  mainDrawingUrl?: string;
  /**
   * Teknik Resim Takibi defteri — Teknik Ressam Özeti sayfasının sonuna ana
   * grup numaralandırması olarak basılır. Yalnız `scope: "full"` çıktısında
   * görünür (özet sayfasının kendisi gibi).
   */
  drawingPlan?: EquipmentDrawingPlan;
  /** Mühendisin ressama yazdığı serbest not — özetin en sonundaki Notlar bölümü. */
  drawingNote?: string;
  /** Gizlenen alt bölümler — satırları listeye girmez (buildEquipmentGroups). */
  hiddenSections?: readonly string[];
  /**
   * Hazır bölüm kümesi. Verilirse liste satırları yeniden hesaplanmaz; indirme
   * ucu mekanik + elektrik birleşimini burada tek sözleşmeyle taşır.
   */
  sections?: readonly EquipmentSection[];
  /** Ekipman sayfasının sekme/bant adı (Mekanik · Elektrik · Tüm). */
  sheetTitle?: string;
  /** Ekipman ADINA bağlanan hazır katalog/föy adresleri. */
  sheetUrls?: Map<string, string>;
}

export function buildEquipmentWorkbook(
  calcInput: CalcInput,
  calcResult: CalcResult,
  meta: EquipmentMeta,
  options: EquipmentWorkbookOptions = {}
): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  wb.creator = "ORION Hesap Raporu";
  wb.created = new Date();

  const sections: readonly EquipmentSection[] = options.sections ?? [
    {
      key: "mechanical",
      name: "Mekanik Ekipmanlar",
      groups: mergeExtras(
        buildEquipmentGroups(
          calcInput, options.notes, options.alts, options.attachments, options.hiddenSections
        ),
        options.extras,
        absentModuleGroupNames(calcInput)
      ),
    },
  ];
  const groups = sections.flatMap((section) => section.groups);
  const sheetTitle = options.sheetTitle?.trim() || "Ekipman Listesi";

  const wsEquipment = wb.addWorksheet(sheetTitle, {
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  const sheetUrls = options.sheetUrls ?? (
    options.appOrigin ? buildCatalogSheetUrls(groups, options.appOrigin) : undefined
  );
  writeEquipmentSheet(
    wsEquipment,
    sections,
    meta,
    options.datasheetUrls,
    sheetUrls,
    options.mainDrawingUrl,
    trBuyuk(sheetTitle)
  );

  // Teknik ressam özeti dahili bir çıktıdır; müşteri dosyasına dahil edilmez.
  if (options.scope !== "customer") {
    // YATAY: özet çizelgesi genişledi (ölçü + değer + birim ve uzun açıklama
    // satırları) ve dikey A4'te etiket sütunu kırpılıyordu. Ekipman Listesi
    // sayfası da yataydır; workbook artık kendi içinde tutarlı.
    const wsSummary = wb.addWorksheet("Teknik Ressam Özeti", {
      pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    });
    writeSummarySheet(
      wsSummary, calcInput, calcResult, meta, options.drawingPlan, options.drawingNote
    );
  }

  return wb;
}
