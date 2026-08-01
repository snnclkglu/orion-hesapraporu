// Ekipman listesi Excel çıktısı — revizyonun seçim (selections) verilerinden
// iki sayfalık .xlsx üretir:
//   1. "Ekipman Listesi"     — satın alma / montaj için bileşen dökümü
//   2. "Teknik Ressam Özeti" — çizim için ana ölçüler (plaka, teker, tambur...)
// Saf fonksiyondur (DB/HTTP bağımlılığı yok); route handler ve test script'i
// aynı fonksiyonu kullanır.

import ExcelJS from "exceljs";
import type { CalcInput, CalcResult } from "@/lib/calc/engine";
import type { HoistInputs, HoistSelections } from "@/lib/calc/modules/hoistGroup";
import type { TravelInputs, TravelSelections } from "@/lib/calc/modules/travelGroup";
import type { GirderInputs } from "@/lib/calc/modules/mainGirder";
import type { EndCarriageInputs } from "@/lib/calc/modules/endCarriage";
import {
  ENDCARRIAGE_INPUT_FIELDS,
  GIRDER_INPUT_FIELDS,
} from "@/lib/calc/presentation/structuralFields";

export interface EquipmentMeta {
  docNo: string;
  projectName: string;
  customer: string;
  revLabel: string;
  revNo: number;
  date: string;
}

// --- yardımcılar -------------------------------------------------------------

/** Sayı biçimleme: gereksiz ondalık olmadan, NaN/boş için "-" */
const fmt = (n: number | null | undefined, digits = 0): string => {
  if (n === null || n === undefined || Number.isNaN(n)) return "-";
  return Number(n.toFixed(digits)).toString();
};

const textOr = (s: string | null | undefined, fallback = "-"): string =>
  s && s.trim() !== "" ? s.trim() : fallback;

// Marka renkleri (design-system/readme.md): kömür zemin + paper metin, kırmızı yalnız vurgu
const CHARCOAL = "FF262626";
const PAPER = "FFF4F1EF";
const ORION_RED = "FFA41E1E";
const MUTED_GRAY = "FF6F6A64";

const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: CHARCOAL }, // kömür zemin — başlık satırları
};
const RED_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: ORION_RED }, // Orion Kırmızısı — yalnız ince ayraç vurgusu
};
const GROUP_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFE7E4E2" }, // Kağıt 200 — marka nötr skalası
};
const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FF9CA3AF" } },
  bottom: { style: "thin", color: { argb: "FF9CA3AF" } },
  left: { style: "thin", color: { argb: "FF9CA3AF" } },
  right: { style: "thin", color: { argb: "FF9CA3AF" } },
};

/** Başlık bloğu: kömür zeminli başlık + künye satırı, kırmızı ince ayraç,
 *  müşteri satırı. Tablo başlık satırının numarasını döndürür. */
function writeTitleBlock(
  ws: ExcelJS.Worksheet,
  title: string,
  meta: EquipmentMeta,
  colCount: number
): number {
  const lastCol = String.fromCharCode(64 + colCount); // 5 -> "E"

  // Satır 1: sayfa başlığı — kömür zemin, paper metin
  ws.mergeCells(`A1:${lastCol}1`);
  const t = ws.getCell("A1");
  t.value = title;
  t.font = { name: "Archivo", bold: true, size: 14, color: { argb: PAPER } };
  t.alignment = { horizontal: "left", vertical: "middle" };
  ws.getRow(1).height = 26;

  // Satır 2: rapor künyesi — tek birleşik hücre, mono teknik etiket
  ws.mergeCells(`A2:${lastCol}2`);
  const k = ws.getCell("A2");
  k.value = `${textOr(meta.projectName)} · ${textOr(meta.docNo)} · REV V${meta.revNo}${
    meta.revLabel ? ` — ${meta.revLabel}` : ""
  } · ${meta.date}`;
  k.font = { name: "IBM Plex Mono", size: 9, color: { argb: PAPER } };
  k.alignment = { horizontal: "left", vertical: "middle" };
  ws.getRow(2).height = 16;

  // Birleşik hücrelerin tüm kolonlarına zemin (merge sonrası kenar hücreler boyasız kalmasın)
  for (let r = 1; r <= 2; r++) {
    for (let c = 1; c <= colCount; c++) {
      ws.getRow(r).getCell(c).fill = HEADER_FILL;
    }
  }

  // Satır 3: kırmızı ince ayraç — markanın tek kırmızı vurgusu
  ws.mergeCells(`A3:${lastCol}3`);
  for (let c = 1; c <= colCount; c++) {
    ws.getRow(3).getCell(c).fill = RED_FILL;
  }
  ws.getRow(3).height = 3;

  // Satır 4: müşteri (künyede yer almayan tek alan)
  const m = ws.getRow(4);
  m.getCell(1).value = "Müşteri";
  m.getCell(1).font = { bold: true };
  m.getCell(2).value = textOr(meta.customer);

  return 6; // satır 5 boş; tablo başlığı 6. satırda
}

/** Otomatik sütun genişliği: her sütunun en uzun metnine göre (8..60).
 *  Birleşik hücreler (künye, grup başlığı, altbilgi) tek kolona sığmak
 *  zorunda olmadığından ölçüme katılmaz. */
function autoWidth(ws: ExcelJS.Worksheet, min = 8, max = 60): void {
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

// --- Sayfa 1: Ekipman Listesi ------------------------------------------------

export interface EqRow {
  /** cat_equipment kind (datasheet link eşlemesi için) */
  kind?: string;
  component: string;
  brand: string;
  model: string;
  spec: string;
  qty: number | string;
  /** Panelden eklenen serbest satır (silinebilir/düzenlenebilir) */
  custom?: boolean;
}

export interface EqGroup {
  name: string;
  rows: EqRow[];
}

/** Panelden eklenen ek ekipman/özellik satırı (equipment_extras.rows) */
export interface EquipmentExtraRow {
  group: string;
  component: string;
  brand: string;
  model: string;
  spec: string;
  qty: string;
}

/** Ana / yardımcı kaldırma grubu bileşen satırları (aynı set) */
function hoistRows(inp: HoistInputs, sel: HoistSelections): EqRow[] {
  return [
    {
      kind: "rope",
      component: "Çelik halat",
      brand: textOr(sel.ropeBrand),
      model: textOr(sel.ropeConstruction),
      spec: `Ø${fmt(sel.ropeDiaMm)} mm, öz: ${textOr(sel.ropeCore)}, tel ${fmt(sel.ropeWireStrength)} kg/mm², kopma yükü ${fmt(sel.ropeBreakingLoadKn, 1)} kN`,
      qty: 1,
    },
    {
      component: "Tambur",
      brand: "-",
      model: "-",
      spec: `Ø${fmt(sel.drumDiaMm)} mm, malzeme ${textOr(sel.drumMaterial)}, oluk boyu ${textOr(sel.drumGrooveLengthText)} mm`,
      qty: inp.drumCount,
    },
    {
      kind: "bearing",
      component: "Tambur rulmanı",
      brand: textOr(sel.bearingType),
      model: textOr(sel.bearingCode),
      spec: `C = ${fmt(sel.bearingDynCKn, 1)} kN, C0 = ${fmt(sel.bearingStatC0Kn, 1)} kN`,
      qty: 2,
    },
    {
      kind: "gearbox",
      component: "Redüktör",
      brand: "-",
      model: textOr(sel.gearboxModel),
      spec: `i = ${fmt(sel.gearboxRatio, 2)}, nominal tork ${fmt(sel.gearboxNominalTorqueKnm, 1)} kNm, giriş mili Ø${fmt(sel.gearboxInputShaftMm)} / çıkış mili Ø${fmt(sel.gearboxOutputShaftMm)} mm`,
      qty: 1,
    },
    {
      kind: "motor",
      component: "Motor",
      brand: textOr(sel.motorBrand),
      model: "-",
      spec: `${fmt(sel.motorPowerKw, 1)} kW, ${fmt(sel.motorRpm)} d/dak, mil Ø${fmt(sel.motorShaftMm)} mm`,
      qty: sel.motorCount,
    },
    {
      kind: "brake",
      component: "Fren",
      brand: textOr(sel.brakeBrand),
      model: textOr(sel.brakeModel),
      spec: `fren torku ${fmt(sel.brakeTorqueNm)} Nm, kasnak/disk Ø${fmt(sel.brakeWheelDiaMm)} mm`,
      qty: sel.brakeQty,
    },
    {
      kind: "coupling",
      component: "Motor-redüktör kaplini",
      brand: textOr(sel.motorCouplingBrand),
      model: textOr(sel.motorCouplingModel),
      spec: `tork ${fmt(sel.motorCouplingTorqueNm)} Nm, kasnak Ø${fmt(sel.motorCouplingWheelDiaMm)} mm, Dmaks Ø${fmt(sel.motorCouplingDmaxMm)} mm`,
      qty: 1,
    },
    {
      kind: "coupling",
      component: "Tambur kaplini",
      brand: textOr(sel.drumCouplingBrand),
      model: textOr(sel.drumCouplingModel),
      spec: `tork ${fmt(sel.drumCouplingTorqueNm)} Nm, radyal yük ${fmt(sel.drumCouplingRadialN)} N, Dmaks Ø${fmt(sel.drumCouplingDmaxMm)} mm`,
      qty: 1,
    },
  ];
}

/** Araba / köprü yürütme grubu bileşen satırları */
function travelRows(
  which: "trolley" | "bridge",
  inp: TravelInputs,
  sel: TravelSelections
): EqRow[] {
  const rows: EqRow[] = [
    {
      kind: "wheel",
      component: "Tekerlek",
      brand: "-",
      model: "-",
      spec: `Ø${fmt(sel.wheelDiaMm)} mm, malzeme ${textOr(sel.wheelMaterial)} (${fmt(sel.wheelTensileNmm2)} N/mm²), ray ${textOr(sel.railCode)}`,
      qty: inp.wheelCount,
    },
    {
      kind: "bearing",
      component: "Teker rulmanı",
      brand: textOr(sel.bearingType),
      model: textOr(sel.bearingCode),
      spec: `C = ${fmt(sel.bearingDynCKn, 1)} kN, C0 = ${fmt(sel.bearingStatC0Kn, 1)} kN`,
      qty: inp.bearingCount > 0 ? inp.bearingCount : 2,
    },
    {
      kind: "motor",
      component: "Motor",
      brand: textOr(sel.motorBrand),
      model: "-",
      spec: `${fmt(sel.motorPowerKw, 2)} kW, ${fmt(sel.motorRpm)} d/dak, mil Ø${fmt(sel.motorShaftMm)} mm`,
      qty: sel.motorCount,
    },
    {
      kind: "gearbox",
      component: "Redüktör",
      brand: "-",
      model: textOr(sel.gearboxModel),
      spec: `i = ${fmt(sel.gearboxRatio, 2)}, çıkış torku ${fmt(sel.gearboxOutputTorqueKnm, 2)} kNm, çıkış mili Ø${fmt(sel.gearboxOutputShaftMm)} mm`,
      qty: sel.motorCount,
    },
  ];

  // Fren bölümü yalnızca köprü grubunda seçilir.
  if (which === "bridge") {
    rows.push({
      kind: "brake",
      component: "Fren",
      brand: textOr(sel.brakeBrand, "Seçilmedi"),
      model: "-",
      spec:
        sel.brakeTorqueNm > 0
          ? `fren torku ${fmt(sel.brakeTorqueNm)} Nm, kasnak/disk Ø${fmt(sel.brakeWheelDiaMm)} mm`
          : "Seçim yapılmadı",
      qty: sel.brakeTorqueNm > 0 ? sel.motorCount : "-",
    });
  }

  rows.push(
    {
      kind: "coupling",
      component: "Motor kaplini",
      brand: textOr(sel.motorCouplingBrand),
      model: textOr(sel.motorCouplingModel),
      spec: `tork ${fmt(sel.motorCouplingTorqueNm)} Nm, Dmaks Ø${fmt(sel.motorCouplingDmaxMm)} mm`,
      qty: sel.motorCount,
    },
    {
      kind: "coupling",
      component: "Teker kaplini",
      brand: textOr(sel.wheelCouplingBrand),
      model: textOr(sel.wheelCouplingModel),
      spec: `tork ${fmt(sel.wheelCouplingTorqueNm)} Nm, teker mili Ø${fmt(sel.wheelShaftDiaMm)} mm, Dmaks Ø${fmt(sel.wheelCouplingDmaxMm)} mm`,
      qty: sel.motorCount,
    },
    {
      component: "Tampon",
      brand: "-",
      model: textOr(sel.bufferModel),
      spec: `strok ${fmt(sel.bufferStrokeMm)} mm, enerji ${fmt(sel.bufferEnergyKj, 2)} kJ, yük ${fmt(sel.bufferLoadKn, 1)} kN`,
      qty: 2,
    }
  );
  return rows;
}

/** Ek satırları gruplara katar: eşleşen grup varsa ona ekler, yoksa yeni grup. */
export function mergeExtras(groups: EqGroup[], extras?: EquipmentExtraRow[]): EqGroup[] {
  if (!extras || extras.length === 0) return groups;
  const merged = groups.map((g) => ({ name: g.name, rows: [...g.rows] }));
  for (const ex of extras) {
    const groupName = ex.group.trim() || "Ek Ekipman";
    const row: EqRow = {
      component: ex.component,
      brand: ex.brand || "-",
      model: ex.model || "-",
      spec: ex.spec,
      qty: ex.qty || "-",
      custom: true,
    };
    const existing = merged.find((g) => g.name === groupName);
    if (existing) existing.rows.push(row);
    else merged.push({ name: groupName, rows: [row] });
  }
  return merged;
}

export function buildEquipmentGroups(input: CalcInput): EqGroup[] {
  const groups: EqGroup[] = [];

  if (input.mainHoist) {
    groups.push({
      name: "Ana Kaldırma",
      rows: hoistRows(input.mainHoist.inputs, input.mainHoist.selections),
    });
  }
  if (input.auxHoist) {
    groups.push({
      name: "Yrd Kaldırma",
      rows: hoistRows(input.auxHoist.inputs, input.auxHoist.selections),
    });
  }
  if (input.hookBlock) {
    const sel = input.hookBlock.selections;
    groups.push({
      name: "Kanca Bloğu",
      rows: [
        {
          kind: "hook",
          component: "Kanca",
          brand: "-",
          model: textOr(sel.hookDesignation),
          spec: `kapasite ${fmt(sel.hookCapacityKg)} kg (DIN 15400)`,
          qty: 1,
        },
        {
          kind: "sheave",
          component: "Halat makarası",
          brand: "-",
          model: "-",
          spec: `halat ekseninde Ø${fmt(sel.sheaveDiaMm)} mm`,
          qty: "-",
        },
        {
          kind: "bearing",
          component: "Makara rulmanı",
          brand: textOr(sel.sheaveBearingType),
          model: textOr(sel.sheaveBearingCode),
          spec: `C = ${fmt(sel.sheaveBearingDynCKn, 1)} kN, C0 = ${fmt(sel.sheaveBearingStatC0Kn, 1)} kN`,
          qty: 2,
        },
        {
          kind: "bearing",
          component: "Kanca (eksenel) rulmanı",
          brand: textOr(sel.hookBearingType),
          model: textOr(sel.hookBearingCode),
          spec: `C0 = ${fmt(sel.hookBearingStatC0Kn, 1)} kN`,
          qty: 1,
        },
        {
          component: "Kanca bloğu mili",
          brand: "-",
          model: "-",
          spec: `malzeme ${textOr(sel.shaftMaterial)}, Ø${fmt((input.hookBlock.inputs.shaftDiaCm ?? 0) * 10)} mm`,
          qty: 1,
        },
      ],
    });
  }
  if (input.trolley) {
    groups.push({
      name: "Araba Yürütme",
      rows: travelRows("trolley", input.trolley.inputs, input.trolley.selections),
    });
  }
  if (input.bridge) {
    groups.push({
      name: "Köprü Yürütme",
      rows: travelRows("bridge", input.bridge.inputs, input.bridge.selections),
    });
  }
  return groups;
}

const HYPERLINK_FONT = { color: { argb: "FF1155CC" }, underline: true as const };

function writeEquipmentSheet(
  ws: ExcelJS.Worksheet,
  groups: EqGroup[],
  meta: EquipmentMeta,
  datasheetUrls?: Map<string, string>
): number {
  const headerRowNo = writeTitleBlock(ws, "EKİPMAN LİSTESİ", meta, 5);

  // Tablo başlığı — müşteriye teslim edilebilir profesyonel sütunlar
  const header = ws.getRow(headerRowNo);
  ["Ekipman", "Marka", "Model", "Özellikler", "Adet"].forEach((h, i) => {
    const cell = header.getCell(i + 1);
    cell.value = h;
    cell.font = { name: "Archivo", bold: true, color: { argb: PAPER } };
    cell.fill = HEADER_FILL;
    cell.border = THIN_BORDER;
    cell.alignment = { horizontal: i === 4 ? "right" : "left", vertical: "middle" };
  });
  header.height = 18;

  // Başlığa kadar dondur + başlık satırında filtre
  ws.views = [{ state: "frozen", ySplit: headerRowNo }];
  ws.autoFilter = { from: { row: headerRowNo, column: 1 }, to: { row: headerRowNo, column: 5 } };

  let rowNo = headerRowNo + 1;
  let componentCount = 0;

  groups.forEach((group) => {
    // Grup başlığı: birleşik satır (marka kırmızısı üst çizgi, nötr dolgu)
    ws.mergeCells(`A${rowNo}:E${rowNo}`);
    const gc = ws.getCell(`A${rowNo}`);
    gc.value = group.name;
    gc.font = { bold: true };
    gc.fill = GROUP_FILL;
    for (let c = 1; c <= 5; c++) {
      ws.getRow(rowNo).getCell(c).border = {
        ...THIN_BORDER,
        top: { style: "medium", color: { argb: "FFA41E1E" } },
      };
    }
    rowNo += 1;

    group.rows.forEach((r) => {
      const row = ws.getRow(rowNo);
      row.getCell(1).value = r.component;
      row.getCell(2).value = r.brand;
      // Model hücresi: katalog datasheet linki varsa köprüle
      const url = r.kind ? datasheetUrls?.get(dsKey(r.kind, r.brand, r.model)) : undefined;
      if (url && r.model && r.model !== "-") {
        row.getCell(3).value = { text: r.model, hyperlink: url };
        row.getCell(3).font = HYPERLINK_FONT;
      } else {
        row.getCell(3).value = r.model;
      }
      row.getCell(4).value = r.spec;
      row.getCell(5).value = r.qty;
      // Adet: sayılar TR ayraçlı, sağa dayalı, mono
      if (typeof r.qty === "number") {
        row.getCell(5).numFmt = Number.isInteger(r.qty) ? "#,##0" : "#,##0.00";
        row.getCell(5).font = { name: "IBM Plex Mono" };
      }
      for (let c = 1; c <= 5; c++) {
        const cell = row.getCell(c);
        cell.border = THIN_BORDER;
        cell.alignment = {
          horizontal: c === 5 ? "right" : "left",
          vertical: "middle",
          wrapText: c === 4,
        };
      }
      rowNo += 1;
      componentCount += 1;
    });
  });

  writeFooterRow(ws, rowNo + 1, 5, "EKİPMAN LİSTESİ", meta);

  autoWidth(ws);
  ws.getColumn(4).width = 56; // özellik metni uzun; sabit geniş + wrap
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
  const lastCol = String.fromCharCode(64 + colCount);
  ws.mergeCells(`A${rowNo}:${lastCol}${rowNo}`);
  const cell = ws.getCell(`A${rowNo}`);
  cell.value = `ORION CRANES · ${sheetLabel} · ${textOr(meta.docNo)}`;
  cell.font = { name: "IBM Plex Mono", size: 8, color: { argb: MUTED_GRAY } };
  cell.alignment = { horizontal: "left", vertical: "middle" };
}

/** Datasheet link eşleme anahtarı (kind|brand|model, normalize) */
export function dsKey(kind: string, brand: string, model: string): string {
  const norm = (s: string) => (s ?? "").trim().toLocaleLowerCase("tr");
  return `${norm(kind)}|${norm(brand)}|${norm(model)}`;
}

// --- Sayfa 2: Teknik Ressam Özeti --------------------------------------------

export interface SummaryRow {
  label: string;
  value: number | string;
  unit?: string;
}

export interface SummarySection {
  name: string;
  rows: SummaryRow[];
}

/** GirderInputs / EndCarriageInputs plaka alanlarını etiketleriyle listeler */
function plateRows<T extends object>(
  fields: { key: keyof T & string; label: string; unit?: string }[],
  keys: (keyof T & string)[],
  values: T
): SummaryRow[] {
  return keys.map((key) => {
    const def = fields.find((f) => f.key === key);
    const raw = values[key];
    return {
      label: def?.label ?? key,
      value: typeof raw === "number" ? Number(raw.toFixed(2)) : String(raw),
      unit: def?.unit,
    };
  });
}

const GIRDER_PLATE_KEYS: (keyof GirderInputs & string)[] = [
  "railHeightMm", "t1Mm", "b1Mm", "t2Mm", "b2Mm", "t3Mm", "h3Mm",
  "t4Mm", "t5Mm", "b5Mm", "t6Mm", "b6Mm", "aMm", "xMm",
];

const ENDCARRIAGE_PLATE_KEYS: (keyof EndCarriageInputs & string)[] = [
  "wheelSpanAMm", "loadOffsetBMm",
  "topPlateThicknessMm", "topPlateWidthMm",
  "sidePlateThicknessMm", "sidePlateHeightMm",
  "bottomPlateThicknessMm", "bottomPlateWidthMm",
];

export function buildSummarySections(input: CalcInput, result: CalcResult): SummarySection[] {
  const specs = input.specs;
  const sections: SummarySection[] = [];

  sections.push({
    name: "Genel Ölçüler ve Kapasiteler",
    rows: [
      { label: "Açıklık (L)", value: specs.spanM, unit: "m" },
      { label: "Ana kaldırma kapasitesi", value: specs.mainCapacityT, unit: "ton" },
      { label: "Ana kaldırma yüksekliği", value: specs.mainLiftHeightM, unit: "m" },
      { label: "Ana kaldırma hızı", value: specs.mainLiftSpeedMpm, unit: "m/dak" },
      { label: "Yrd kaldırma kapasitesi", value: specs.auxCapacityT, unit: "ton" },
      { label: "Yrd kaldırma yüksekliği", value: specs.auxLiftHeightM, unit: "m" },
      { label: "Yrd kaldırma hızı", value: specs.auxLiftSpeedMpm, unit: "m/dak" },
      { label: "Araba yürütme hızı", value: specs.trolleySpeedMpm, unit: "m/dak" },
      { label: "Köprü yürütme hızı", value: specs.bridgeSpeedMpm, unit: "m/dak" },
      { label: "Kanca / tutucu tipi", value: specs.hookType },
    ],
  });

  const trolleyRows: SummaryRow[] = [];
  if (input.trolley) {
    trolleyRows.push(
      { label: "Araba ray tipi", value: textOr(input.trolley.selections.railCode) },
      { label: "Araba teker çapı", value: input.trolley.selections.wheelDiaMm, unit: "mm" },
      { label: "Araba teker adedi", value: input.trolley.inputs.wheelCount, unit: "adet" }
    );
  }
  if (input.bridge) {
    trolleyRows.push(
      { label: "Köprü ray tipi", value: textOr(input.bridge.selections.railCode) },
      { label: "Köprü teker çapı", value: input.bridge.selections.wheelDiaMm, unit: "mm" },
      { label: "Köprü teker adedi", value: input.bridge.inputs.wheelCount, unit: "adet" }
    );
  }
  if (trolleyRows.length > 0) {
    sections.push({ name: "Ray ve Tekerlekler", rows: trolleyRows });
  }

  const drumRows: SummaryRow[] = [];
  if (input.mainHoist) {
    drumRows.push(
      { label: "Ana tambur çapı", value: input.mainHoist.selections.drumDiaMm, unit: "mm" },
      { label: "Ana tambur oluk boyu (seçilen)", value: textOr(input.mainHoist.selections.drumGrooveLengthText), unit: "mm" },
      {
        label: "Ana tambur gerekli oluk boyu",
        value: fmt(result.mainHoist?.values.requiredGrooveLengthMm, 0),
        unit: "mm",
      }
    );
  }
  if (input.auxHoist) {
    drumRows.push(
      { label: "Yrd tambur çapı", value: input.auxHoist.selections.drumDiaMm, unit: "mm" },
      { label: "Yrd tambur oluk boyu (seçilen)", value: textOr(input.auxHoist.selections.drumGrooveLengthText), unit: "mm" },
      {
        label: "Yrd tambur gerekli oluk boyu",
        value: fmt(result.auxHoist?.values.requiredGrooveLengthMm, 0),
        unit: "mm",
      }
    );
  }
  if (drumRows.length > 0) {
    sections.push({ name: "Tamburlar", rows: drumRows });
  }

  if (input.girder) {
    const rows = plateRows(GIRDER_INPUT_FIELDS, GIRDER_PLATE_KEYS, input.girder.inputs);
    if (result.girder) {
      rows.push(
        { label: "Kiriş toplam yüksekliği (hesap)", value: Number(result.girder.values.heightMm.toFixed(0)), unit: "mm" },
        { label: "Kiriş birim ağırlığı (hesap)", value: Number(result.girder.values.weightPerM.toFixed(1)), unit: "kg/m" }
      );
    }
    sections.push({ name: "Ana Kiriş Plaka Ölçüleri", rows });
  }

  if (input.endCarriage) {
    const rows = plateRows(
      ENDCARRIAGE_INPUT_FIELDS,
      ENDCARRIAGE_PLATE_KEYS,
      input.endCarriage.inputs
    );
    if (result.endCarriage) {
      rows.push({
        label: "Başkiriş birim ağırlığı (hesap)",
        value: Number(result.endCarriage.values.weightPerM.toFixed(1)),
        unit: "kg/m",
      });
    }
    sections.push({ name: "Başkiriş Plaka Ölçüleri", rows });
  }

  if (input.hookBlock) {
    const sel = input.hookBlock.selections;
    sections.push({
      name: "Kanca Bloğu",
      rows: [
        { label: "Kanca tanımı", value: textOr(sel.hookDesignation) },
        { label: "Kanca kapasitesi", value: sel.hookCapacityKg, unit: "kg" },
        { label: "Makara çapı (halat ekseni)", value: sel.sheaveDiaMm, unit: "mm" },
        { label: "Mil çapı", value: input.hookBlock.inputs.shaftDiaCm * 10, unit: "mm" },
        ...(input.mainHoist
          ? [{ label: "Kanca bloğu ağırlığı", value: input.mainHoist.inputs.hookBlockWeightKg, unit: "kg" }]
          : []),
      ],
    });
  }

  const weightRows: SummaryRow[] = [];
  if (input.trolley) {
    weightRows.push({ label: "Araba ağırlığı", value: input.trolley.inputs.trolleyWeightT, unit: "t" });
  }
  if (input.bridge) {
    weightRows.push(
      { label: "Köprü ana kirişleri ağırlığı", value: input.bridge.inputs.bridgeWeightT, unit: "t" },
      { label: "Başkirişler ve diğer ağırlıklar", value: input.bridge.inputs.otherWeightsT, unit: "t" }
    );
    const craneT = result.bridge?.values.craneWeightT;
    if (craneT !== null && craneT !== undefined) {
      weightRows.push({ label: "Toplam vinç ağırlığı (hesap)", value: Number(craneT.toFixed(2)), unit: "t" });
    }
  }
  if (weightRows.length > 0) {
    sections.push({ name: "Ağırlıklar", rows: weightRows });
  }

  return sections;
}

function writeSummarySheet(
  ws: ExcelJS.Worksheet,
  input: CalcInput,
  result: CalcResult,
  meta: EquipmentMeta
): void {
  const headerRowNo = writeTitleBlock(ws, "TEKNİK RESSAM ÖZETİ", meta, 3);

  const header = ws.getRow(headerRowNo);
  ["Ölçü / Özellik", "Değer", "Birim"].forEach((h, i) => {
    const cell = header.getCell(i + 1);
    cell.value = h;
    cell.font = { name: "Archivo", bold: true, color: { argb: PAPER } };
    cell.fill = HEADER_FILL;
    cell.border = THIN_BORDER;
    cell.alignment = { horizontal: i === 1 ? "right" : "left", vertical: "middle" };
  });
  header.height = 18;

  // Başlığa kadar dondur + başlık satırında filtre
  ws.views = [{ state: "frozen", ySplit: headerRowNo }];
  ws.autoFilter = { from: { row: headerRowNo, column: 1 }, to: { row: headerRowNo, column: 3 } };

  let rowNo = headerRowNo + 1;
  const sections = buildSummarySections(input, result);
  for (const section of sections) {
    // Bölüm başlığı (birleşik hücre, dolgu)
    ws.mergeCells(`A${rowNo}:C${rowNo}`);
    const sc = ws.getCell(`A${rowNo}`);
    sc.value = section.name;
    sc.font = { bold: true };
    sc.fill = GROUP_FILL;
    sc.border = THIN_BORDER;
    rowNo += 1;

    for (const r of section.rows) {
      const row = ws.getRow(rowNo);
      row.getCell(1).value = r.label;
      row.getCell(2).value = r.value;
      row.getCell(3).value = r.unit ?? "";
      // Değer kolonu: sayılar TR ayraçlı, sağa dayalı, mono
      if (typeof r.value === "number") {
        row.getCell(2).numFmt = Number.isInteger(r.value) ? "#,##0" : "#,##0.00";
        row.getCell(2).font = { name: "IBM Plex Mono" };
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

  autoWidth(ws);
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

  const groups = mergeExtras(buildEquipmentGroups(calcInput), options.extras);

  const wsEquipment = wb.addWorksheet("Ekipman Listesi", {
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  writeEquipmentSheet(wsEquipment, groups, meta, options.datasheetUrls);

  // Teknik ressam özeti dahili bir çıktıdır; müşteri dosyasına dahil edilmez.
  if (options.scope !== "customer") {
    const wsSummary = wb.addWorksheet("Teknik Ressam Özeti", {
      pageSetup: { orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    });
    writeSummarySheet(wsSummary, calcInput, calcResult, meta);
  }

  return wb;
}
