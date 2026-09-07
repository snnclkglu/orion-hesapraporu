// Elektrik hesap raporu sunum tanımları. Dinamik devre/kablo satırları tablo
// olarak kurulur; editör ve PDF aynı bağlamı okur.

import type { TechnicalSpecs } from "../types";
import type {
  ElectricalInputs,
  ElectricalSelections,
  ElectricalValues,
} from "../modules/electrical";

export interface ElectricalCtx {
  c: Record<string, number | string>;
  v: ElectricalValues;
  inp: ElectricalInputs;
  sel: ElectricalSelections;
  specs: TechnicalSpecs;
}

export interface ElectricalRowDef {
  key: string;
  label: string;
  formula?: string;
  unit?: string;
  digits?: number;
}

export interface ElectricalSectionDef {
  id: string;
  title: string;
  description: string;
  editor: "electricalDrives" | "electricalCables" | "electricalFestoon";
  rows: ElectricalRowDef[];
  table: {
    title: string;
    headers: string[];
    build: (ctx: ElectricalCtx) => (string | number)[][];
    note?: string;
  };
  checkSuffixes: string[];
}

const CIRCUITS = [
  "main", "aux", "mono1", "mono2", "trolley", "auxTrolley",
  "mono1Trolley", "mono2Trolley", "bridge",
] as const;

const driveChecks = CIRCUITS.flatMap((key) => [`drive.${key}.power`, `drive.${key}.current`]);
const cableChecks = CIRCUITS.flatMap((key) => [`cable.${key}.ampacity`, `cable.${key}.voltageDrop`]);

function n(value: number, digits = 2): string {
  return value.toLocaleString("tr-TR", { maximumFractionDigits: digits });
}

export const ELECTRICAL_SECTIONS: readonly ElectricalSectionDef[] = [
  {
    id: "12.1",
    title: "Sürücü Ön Seçimi",
    description:
      "Hesaptaki seçilmiş motor güçlerini okur; Schneider ATV320/340/930, ABB ACS880-01 ve Siemens SINAMICS S120 ağır hizmet/anma değerleriyle karşılaştırır. Motor etiket akımı biliniyorsa hesaplanan akımın yerine girilebilir.",
    editor: "electricalDrives",
    rows: [
      { key: "system.voltage", label: "Hesap Hat Gerilimi", unit: "V", digits: 0 },
      { key: "system.powerFactor", label: "Hesap Güç Katsayısı cosφ", digits: 2 },
      { key: "system.motorEfficiency", label: "Hesap Motor Verimi η", unit: "%", digits: 1 },
      { key: "system.installedPower", label: "Toplam Kurulu Motor Gücü", formula: "Σ(P_motor × adet)", unit: "kW", digits: 2 },
      { key: "system.mainCurrent", label: "Ana Besleme Tasarım Akımı", formula: "Σ I_motor × eşzamanlılık", unit: "A", digits: 2 },
    ],
    table: {
      title: "Mekanizma Bazında Akım Hesabı ve Sürücü Seçimleri",
      headers: ["Mekanizma", "Motor", "Akım Hesabı / Kaynağı", "Tasarım Akımı", "Seçilen Sürücü", "Güç Payı", "Akım Payı"],
      build: (ctx) => ctx.v.drives.map((row) => [
        row.circuit.label,
        `${n(row.circuit.motorPowerKw)} kW × ${row.circuit.motorCount}`,
        row.ratedCurrentAutomatic
          ? `${n(row.circuit.motorPowerKw)}·1000 / (√3·${n(ctx.v.settings.lineVoltageV, 0)}·${n(ctx.v.settings.powerFactor)}·${n(ctx.v.settings.motorEfficiencyPct / 100, 3)})`
          : "Motor etiket akımı · manuel",
        `${n(row.designCurrentA)} A`,
        row.drive
          ? `${row.drive.brand} ${row.drive.series} · ${row.drive.model}${row.drive.projectReference ? ` · Ref. ${row.drive.projectReference}` : ""}`
          : "Uygun katalog satırı yok",
        row.drive ? `${n(row.drive.motorPowerKw - row.circuit.motorPowerKw)} kW (${n(row.drive.motorPowerKw)} ≥ ${n(row.circuit.motorPowerKw)})` : "—",
        row.drive ? `${n(row.drive.outputCurrentA - row.designCurrentA)} A (${n(row.drive.outputCurrentA)} ≥ ${n(row.designCurrentA)})` : "—",
      ]),
      note: "Sürücü seçimi ön boyutlandırmadır; motor etiket akımı, frenleme çevrimi, rejeneratif çalışma ve üretici uygulama notları nihai projede doğrulanır.",
    },
    checkSuffixes: driveChecks,
  },
  {
    id: "12.2",
    title: "Motor ve Ana Besleme Kabloları",
    description:
      "Akım taşıma ile üç faz gerilim düşümünü birlikte kontrol eder. HELUKABEL ve ÜNTEL katalogları marka, yuvarlak/yassı biçim ve ürün sırasıyla seçilebilir; ürünün gerçek dış ölçüsü, ağırlığı, ekranı ve hareketli kullanım niteliği hesapla birlikte raporlanır.",
    editor: "electricalCables",
    rows: [
      { key: "system.ambientTemperature", label: "Azami Ortam Sıcaklığı", unit: "°C", digits: 1 },
      { key: "system.ambientFactor", label: "Ortam Sıcaklığı Katsayısı", digits: 2 },
      { key: "system.extraDerating", label: "Ek Akım Düzeltme Katsayısı", digits: 2 },
      { key: "system.totalDerating", label: "Toplam Akım Düzeltme Katsayısı", formula: "k_toplam = k_ortam × k_ek", digits: 3 },
      { key: "system.voltageDropLimit", label: "İzinli Gerilim Düşümü", unit: "%", digits: 2 },
      { key: "system.demandFactor", label: "Ana Besleme Eşzamanlılık Katsayısı", digits: 2 },
      { key: "mainCable.length", label: "Ana Besleme Tek Yön Boyu", unit: "m", digits: 1 },
      { key: "mainCable.requiredSection", label: "Ana Besleme Gereken Kesiti", unit: "mm²", digits: 1 },
      { key: "mainCable.selected", label: "Ana Besleme Seçimi" },
      { key: "mainCable.ampacity", label: "Ana Besleme Düzeltilmiş Kapasitesi", formula: "I_z,tablo × k_toplam × paralel", unit: "A", digits: 2 },
      { key: "mainCable.voltageDrop", label: "Ana Besleme Gerilim Düşümü", formula: "√3·I·L·ρ·cosφ/(A·n·U)", unit: "%", digits: 2 },
    ],
    table: {
      title: "Kablo Boyutlandırma, Fiziksel Veri ve Elektriksel Kontrol",
      headers: ["Devre / Boy", "Marka · Ürün", "Biçim / Dış Ölçü", "Ağırlık", "Gereken / Seçilen", "Akım / Düzeltilmiş Kapasite", "Gerilim Düşümü Hesabı"],
      build: (ctx) => {
        const rows = ctx.v.motorCables.map((row) => {
          const cable = row.selectedCable;
          return [
            `${row.circuit.label} · ${n(row.lengthM, 1)} m`,
            cable ? `${cable.brand} · ${cable.family} ${cable.construction} · ${cable.articleNo}` : "Kablo bulunamadı",
            cable ? `${cable.shape === "round" ? "Yuvarlak" : "Yassı"} · ${cable.shape === "round" ? `Ø${n(cable.widthMm, 1)} mm` : `${n(cable.widthMm, 1)} × ${n(cable.heightMm, 1)} mm`}${cable.shielded ? " · ekranlı" : ""}` : "—",
            cable ? `${n(cable.weightKgPerM, 3)} kg/m` : "—",
            `${row.recommendedRuns}×${n(row.requiredSectionMm2, 1)} / ${row.selectedRuns}×${n(cable?.sectionMm2 ?? 0, 1)} mm²`,
            `${n(row.designCurrentA)} / ${n(row.ampacityA)} A`,
            `√3·${n(row.designCurrentA)}·${n(row.lengthM, 1)}·0,0225·${n(ctx.v.settings.powerFactor)} / (${n(cable?.sectionMm2 ?? 0, 1)}·${row.selectedRuns}·${n(ctx.v.settings.lineVoltageV, 0)}) = ${n(row.voltageDropPct)} %`,
          ];
        });
        const main = ctx.v.mainCable;
        const cable = main.selectedCable;
        rows.push([
          `Ana Besleme · ${n(main.lengthM, 1)} m`,
          cable ? `${cable.brand} · ${cable.family} ${cable.construction} · ${cable.articleNo}` : "Kablo bulunamadı",
          cable ? `${cable.shape === "round" ? "Yuvarlak" : "Yassı"} · ${cable.shape === "round" ? `Ø${n(cable.widthMm, 1)} mm` : `${n(cable.widthMm, 1)} × ${n(cable.heightMm, 1)} mm`}${cable.shielded ? " · ekranlı" : ""}` : "—",
          cable ? `${n(cable.weightKgPerM, 3)} kg/m` : "—",
          `${main.recommendedRuns}×${n(main.requiredSectionMm2, 1)} / ${main.selectedRuns}×${n(cable?.sectionMm2 ?? 0, 1)} mm²`,
          `${n(main.designCurrentA)} / ${n(main.ampacityA)} A`,
          `√3·${n(main.designCurrentA)}·${n(main.lengthM, 1)}·0,0225·${n(ctx.v.settings.powerFactor)} / (${n(cable?.sectionMm2 ?? 0, 1)}·${main.selectedRuns}·${n(ctx.v.settings.lineVoltageV, 0)}) = ${n(main.voltageDropPct)} %`,
        ]);
        return rows;
      },
      note: "Akım taşıma değerleri ORION ön boyutlandırma kabulüdür. Döşeme biçimi, demetleme, ortam düzeltmesi, harmonikler, kısa devre dayanımı ve koruma koordinasyonu elektrik projesinde ayrıca doğrulanır.",
    },
    checkSuffixes: [...cableChecks, "cable.main.ampacity", "cable.main.voltageDrop"],
  },
  {
    id: "12.3",
    title: "Feston Kablo Yerleşimi",
    description:
      "Seçilen motor, kumanda ve sinyal kablolarını tek/çift sıraya yerleştirir; kablo paketi enini, yüksekliğini, hareketli bükülme çapını, araba yükünü ve enine ağırlık merkezi sapmasını kontrol eder. Güç kırmızı, kumanda mavi, sinyal yeşil gösterilir.",
    editor: "electricalFestoon",
    rows: [
      { key: "festoon.trolley", label: "Feston Arabası" },
      { key: "festoon.usableWidth", label: "Araba Kullanılabilir Eni b2", unit: "mm", digits: 1 },
      { key: "festoon.usableHeight", label: "Araba Kullanılabilir Yüksekliği s", unit: "mm", digits: 1 },
      { key: "festoon.supportDiameter", label: "Kablo Mesnedi Çapı D", unit: "mm", digits: 1 },
      { key: "festoon.packageWidth", label: "Kablo Paketi Genişliği", unit: "mm", digits: 1 },
      { key: "festoon.packageHeight", label: "Kablo Paketi Yüksekliği", unit: "mm", digits: 1 },
      { key: "festoon.packageWeight", label: "Kablo Paketi Birim Ağırlığı", unit: "kg/m", digits: 3 },
      { key: "festoon.loopHeight", label: "Loop Yüksekliği h", unit: "m", digits: 2 },
      { key: "festoon.loopCableLength", label: "Araba Başına Taşınan Yaklaşık Kablo Boyu", formula: "L_loop ≈ 2h", unit: "m", digits: 2 },
      { key: "festoon.trolleyCableLoad", label: "Araba Kablo Yükü", formula: "m_araba = m_paket × 2h", unit: "kg", digits: 2 },
      { key: "festoon.maxCableLoad", label: "Katalog Azami Kablo Yükü", unit: "kg", digits: 1 },
      { key: "festoon.centerOffset", label: "Enine Ağırlık Merkezi Sapması", unit: "mm", digits: 1 },
      { key: "festoon.minimumDiameter", label: "Gereken Minimum Taşıyıcı Çapı", unit: "mm", digits: 1 },
    ],
    table: {
      title: "Feston Arabasındaki Kablolar",
      headers: ["Sıra", "Kablo", "Tür", "Marka · Ürün", "Ölçü", "kg/m", "Min. Bükülme Ø / Kullanım"],
      build: (ctx) => ctx.v.festoon.placements.map((p) => [
        p.row + 1,
        p.label,
        p.purpose === "power" ? "Güç" : p.purpose === "control" ? "Kumanda" : "Sinyal",
        `${p.brand} · ${p.family} ${p.construction} · ${p.articleNo}`,
        `${n(p.widthMm, 1)} × ${n(p.heightMm, 1)} mm`,
        n(p.weightKgPerM, 3),
        `${n(p.minimumBendDiameterMm, 1)} mm · ${ctx.v.festoon.unsuitableCableLabels.some((x) => x.includes(p.articleNo)) ? "sabit tesis" : "hareketli"}`,
      ]),
      note: "Yerleşim, kablo ağırlık merkezini araba orta eksenine yaklaştıracak şekilde otomatik dengelenir. Nihai bağlama sırası üretici montaj talimatıyla doğrulanır.",
    },
    checkSuffixes: ["festoon.width", "festoon.height", "festoon.bend", "festoon.load", "festoon.application", "festoon.cog"],
  },
];
