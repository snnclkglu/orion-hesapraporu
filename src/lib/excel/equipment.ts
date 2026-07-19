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

const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF1F3864" }, // koyu lacivert
};
const GROUP_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFD9E2F3" }, // açık mavi
};
const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FF9CA3AF" } },
  bottom: { style: "thin", color: { argb: "FF9CA3AF" } },
  left: { style: "thin", color: { argb: "FF9CA3AF" } },
  right: { style: "thin", color: { argb: "FF9CA3AF" } },
};

/** Başlık bloğu (proje / müşteri / doküman no / revizyon / tarih) yazar,
 *  sonraki boş satırın numarasını döndürür. */
function writeTitleBlock(
  ws: ExcelJS.Worksheet,
  title: string,
  meta: EquipmentMeta,
  colCount: number
): void {
  const lastCol = String.fromCharCode(64 + colCount); // 5 -> "E"
  ws.mergeCells(`A1:${lastCol}1`);
  const t = ws.getCell("A1");
  t.value = title;
  t.font = { bold: true, size: 14 };
  t.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 24;

  const metaRows: [string, string][] = [
    ["Proje", meta.projectName],
    ["Müşteri", meta.customer],
    ["Doküman No", meta.docNo],
    ["Revizyon", `V${meta.revNo}${meta.revLabel ? ` — ${meta.revLabel}` : ""}`],
    ["Tarih", meta.date],
  ];
  metaRows.forEach(([k, v], i) => {
    const row = ws.getRow(2 + i);
    row.getCell(1).value = k;
    row.getCell(1).font = { bold: true };
    row.getCell(2).value = v;
  });
}

/** Otomatik sütun genişliği: her sütunun en uzun metnine göre (8..60). */
function autoWidth(ws: ExcelJS.Worksheet, min = 8, max = 60): void {
  ws.columns.forEach((col) => {
    let width = min;
    col.eachCell?.({ includeEmpty: false }, (cell) => {
      const len = String(cell.value ?? "").length + 2;
      if (len > width) width = len;
    });
    col.width = Math.min(width, max);
  });
}

// --- Sayfa 1: Ekipman Listesi ------------------------------------------------

interface EqRow {
  component: string;
  brand: string;
  spec: string;
  qty: number | string;
}

interface EqGroup {
  name: string;
  rows: EqRow[];
}

/** Ana / yardımcı kaldırma grubu bileşen satırları (aynı set) */
function hoistRows(inp: HoistInputs, sel: HoistSelections): EqRow[] {
  return [
    {
      component: "Çelik halat",
      brand: textOr(sel.ropeBrand),
      spec: `Ø${fmt(sel.ropeDiaMm)} mm, ${textOr(sel.ropeConstruction)}, öz: ${textOr(sel.ropeCore)}, tel ${fmt(sel.ropeWireStrength)} kg/mm², kopma yükü ${fmt(sel.ropeBreakingLoadKn, 1)} kN`,
      qty: 1,
    },
    {
      component: "Tambur",
      brand: "-",
      spec: `Ø${fmt(sel.drumDiaMm)} mm, malzeme ${textOr(sel.drumMaterial)}, oluk boyu ${textOr(sel.drumGrooveLengthText)} mm`,
      qty: inp.drumCount,
    },
    {
      component: "Tambur rulmanı",
      brand: `${textOr(sel.bearingType)} ${textOr(sel.bearingCode, "")}`.trim(),
      spec: `C = ${fmt(sel.bearingDynCKn, 1)} kN, C0 = ${fmt(sel.bearingStatC0Kn, 1)} kN`,
      qty: 2,
    },
    {
      component: "Redüktör",
      brand: textOr(sel.gearboxModel),
      spec: `i = ${fmt(sel.gearboxRatio, 2)}, nominal tork ${fmt(sel.gearboxNominalTorqueKnm, 1)} kNm, giriş mili Ø${fmt(sel.gearboxInputShaftMm)} / çıkış mili Ø${fmt(sel.gearboxOutputShaftMm)} mm`,
      qty: 1,
    },
    {
      component: "Motor",
      brand: textOr(sel.motorBrand),
      spec: `${fmt(sel.motorPowerKw, 1)} kW, ${fmt(sel.motorRpm)} d/dak, mil Ø${fmt(sel.motorShaftMm)} mm`,
      qty: sel.motorCount,
    },
    {
      component: "Fren",
      brand: `${textOr(sel.brakeBrand)} ${textOr(sel.brakeModel, "")}`.trim(),
      spec: `fren torku ${fmt(sel.brakeTorqueNm)} Nm, kasnak/disk Ø${fmt(sel.brakeWheelDiaMm)} mm`,
      qty: sel.brakeQty,
    },
    {
      component: "Motor-redüktör kaplini",
      brand: `${textOr(sel.motorCouplingBrand)} ${textOr(sel.motorCouplingModel, "")}`.trim(),
      spec: `tork ${fmt(sel.motorCouplingTorqueNm)} Nm, kasnak Ø${fmt(sel.motorCouplingWheelDiaMm)} mm, Dmaks Ø${fmt(sel.motorCouplingDmaxMm)} mm`,
      qty: 1,
    },
    {
      component: "Tambur kaplini",
      brand: `${textOr(sel.drumCouplingBrand)} ${textOr(sel.drumCouplingModel, "")}`.trim(),
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
      component: "Tekerlek",
      brand: "-",
      spec: `Ø${fmt(sel.wheelDiaMm)} mm, malzeme ${textOr(sel.wheelMaterial)} (${fmt(sel.wheelTensileNmm2)} N/mm²), ray ${textOr(sel.railCode)}`,
      qty: inp.wheelCount,
    },
    {
      component: "Teker rulmanı",
      brand: `${textOr(sel.bearingType)} ${textOr(sel.bearingCode, "")}`.trim(),
      spec: `C = ${fmt(sel.bearingDynCKn, 1)} kN, C0 = ${fmt(sel.bearingStatC0Kn, 1)} kN`,
      qty: inp.bearingCount > 0 ? inp.bearingCount : 2,
    },
    {
      component: "Motor",
      brand: textOr(sel.motorBrand),
      spec: `${fmt(sel.motorPowerKw, 2)} kW, ${fmt(sel.motorRpm)} d/dak, mil Ø${fmt(sel.motorShaftMm)} mm`,
      qty: sel.motorCount,
    },
    {
      component: "Redüktör",
      brand: textOr(sel.gearboxModel),
      spec: `i = ${fmt(sel.gearboxRatio, 2)}, çıkış torku ${fmt(sel.gearboxOutputTorqueKnm, 2)} kNm, çıkış mili Ø${fmt(sel.gearboxOutputShaftMm)} mm`,
      qty: sel.motorCount,
    },
  ];

  // Fren bölümü Excel'de sadece köprü sayfasındadır (6.6).
  if (which === "bridge") {
    rows.push({
      component: "Fren",
      brand: textOr(sel.brakeBrand, "Seçilmedi"),
      spec:
        sel.brakeTorqueNm > 0
          ? `fren torku ${fmt(sel.brakeTorqueNm)} Nm, kasnak/disk Ø${fmt(sel.brakeWheelDiaMm)} mm`
          : "Seçim yapılmadı",
      qty: sel.brakeTorqueNm > 0 ? sel.motorCount : "-",
    });
  }

  rows.push(
    {
      component: "Motor kaplini",
      brand: `${textOr(sel.motorCouplingBrand)} ${textOr(sel.motorCouplingModel, "")}`.trim(),
      spec: `tork ${fmt(sel.motorCouplingTorqueNm)} Nm, Dmaks Ø${fmt(sel.motorCouplingDmaxMm)} mm`,
      qty: sel.motorCount,
    },
    {
      component: "Teker kaplini",
      brand: `${textOr(sel.wheelCouplingBrand)} ${textOr(sel.wheelCouplingModel, "")}`.trim(),
      spec: `tork ${fmt(sel.wheelCouplingTorqueNm)} Nm, teker mili Ø${fmt(sel.wheelShaftDiaMm)} mm, Dmaks Ø${fmt(sel.wheelCouplingDmaxMm)} mm`,
      qty: sel.motorCount,
    },
    {
      component: "Tampon",
      brand: textOr(sel.bufferModel),
      spec: `strok ${fmt(sel.bufferStrokeMm)} mm, enerji ${fmt(sel.bufferEnergyKj, 2)} kJ, yük ${fmt(sel.bufferLoadKn, 1)} kN`,
      qty: 2,
    }
  );
  return rows;
}

function buildEquipmentGroups(input: CalcInput): EqGroup[] {
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
          component: "Kanca",
          brand: textOr(sel.hookDesignation),
          spec: `kapasite ${fmt(sel.hookCapacityKg)} kg (DIN 15400)`,
          qty: 1,
        },
        {
          component: "Halat makarası",
          brand: "-",
          spec: `halat ekseninde Ø${fmt(sel.sheaveDiaMm)} mm`,
          qty: "-",
        },
        {
          component: "Makara rulmanı",
          brand: `${textOr(sel.sheaveBearingType)} ${textOr(sel.sheaveBearingCode, "")}`.trim(),
          spec: `C = ${fmt(sel.sheaveBearingDynCKn, 1)} kN, C0 = ${fmt(sel.sheaveBearingStatC0Kn, 1)} kN`,
          qty: 2,
        },
        {
          component: "Kanca (eksenel) rulmanı",
          brand: `${textOr(sel.hookBearingType)} ${textOr(sel.hookBearingCode, "")}`.trim(),
          spec: `C0 = ${fmt(sel.hookBearingStatC0Kn, 1)} kN`,
          qty: 1,
        },
        {
          component: "Kanca bloğu mili",
          brand: "-",
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

function writeEquipmentSheet(
  ws: ExcelJS.Worksheet,
  input: CalcInput,
  meta: EquipmentMeta
): number {
  writeTitleBlock(ws, "EKİPMAN LİSTESİ", meta, 5);

  // Tablo başlığı
  const headerRowNo = 8;
  const header = ws.getRow(headerRowNo);
  ["Grup", "Bileşen", "Marka/Model", "Teknik Özellik", "Adet"].forEach((h, i) => {
    const cell = header.getCell(i + 1);
    cell.value = h;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = HEADER_FILL;
    cell.border = THIN_BORDER;
    cell.alignment = { horizontal: i === 4 ? "center" : "left", vertical: "middle" };
  });
  header.height = 18;

  const groups = buildEquipmentGroups(input);
  let rowNo = headerRowNo + 1;
  let componentCount = 0;

  groups.forEach((group, gi) => {
    // Grup değişiminde ayraç: gruplar arasında boş satır
    if (gi > 0) rowNo += 1;

    group.rows.forEach((r, ri) => {
      const row = ws.getRow(rowNo);
      row.getCell(1).value = ri === 0 ? group.name : "";
      row.getCell(2).value = r.component;
      row.getCell(3).value = r.brand;
      row.getCell(4).value = r.spec;
      row.getCell(5).value = r.qty;
      for (let c = 1; c <= 5; c++) {
        const cell = row.getCell(c);
        cell.border = THIN_BORDER;
        cell.alignment = {
          horizontal: c === 5 ? "center" : "left",
          vertical: "middle",
          wrapText: c === 4,
        };
      }
      if (ri === 0) {
        row.getCell(1).font = { bold: true };
        row.getCell(1).fill = GROUP_FILL;
        // Grup başlangıcında kalın üst çizgi
        for (let c = 1; c <= 5; c++) {
          row.getCell(c).border = {
            ...THIN_BORDER,
            top: { style: "medium", color: { argb: "FF1F3864" } },
          };
        }
      }
      rowNo += 1;
      componentCount += 1;
    });
  });

  autoWidth(ws);
  ws.getColumn(4).width = 60; // teknik özellik metni uzun; sabit geniş + wrap
  return componentCount;
}

// --- Sayfa 2: Teknik Ressam Özeti --------------------------------------------

interface SummaryRow {
  label: string;
  value: number | string;
  unit?: string;
}

interface SummarySection {
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

function buildSummarySections(input: CalcInput, result: CalcResult): SummarySection[] {
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
  writeTitleBlock(ws, "TEKNİK RESSAM ÖZETİ", meta, 3);

  const headerRowNo = 8;
  const header = ws.getRow(headerRowNo);
  ["Ölçü / Özellik", "Değer", "Birim"].forEach((h, i) => {
    const cell = header.getCell(i + 1);
    cell.value = h;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = HEADER_FILL;
    cell.border = THIN_BORDER;
    cell.alignment = { horizontal: i === 0 ? "left" : "center", vertical: "middle" };
  });
  header.height = 18;

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
      for (let c = 1; c <= 3; c++) {
        const cell = row.getCell(c);
        cell.border = THIN_BORDER;
        cell.alignment = { horizontal: c === 1 ? "left" : "center", vertical: "middle" };
      }
      rowNo += 1;
    }
  }

  autoWidth(ws);
}

// --- ana giriş ---------------------------------------------------------------

export function buildEquipmentWorkbook(
  calcInput: CalcInput,
  calcResult: CalcResult,
  meta: EquipmentMeta
): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  wb.creator = "ORION Hesap Raporu";
  wb.created = new Date();

  const wsEquipment = wb.addWorksheet("Ekipman Listesi", {
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  writeEquipmentSheet(wsEquipment, calcInput, meta);

  const wsSummary = wb.addWorksheet("Teknik Ressam Özeti", {
    pageSetup: { orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  writeSummarySheet(wsSummary, calcInput, calcResult, meta);

  return wb;
}
