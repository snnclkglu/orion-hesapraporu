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
      { key: "system.installedPower", label: "Toplam Kurulu Motor Gücü", formula: "Σ(P_motor × adet)", unit: "kW", digits: 2 },
      { key: "system.mainCurrent", label: "Ana Besleme Tasarım Akımı", formula: "Σ I_motor × eşzamanlılık", unit: "A", digits: 2 },
    ],
    table: {
      title: "Mekanizma Bazında Sürücü Seçimleri",
      headers: ["Mekanizma", "Motor", "Tasarım Akımı", "Seçilen Sürücü", "HD/Tip Gücü", "Çıkış Akımı"],
      build: (ctx) => ctx.v.drives.map((row) => [
        row.circuit.label,
        `${n(row.circuit.motorPowerKw)} kW × ${row.circuit.motorCount}`,
        `${n(row.designCurrentA)} A`,
        row.drive
          ? `${row.drive.brand} ${row.drive.series} · ${row.drive.model}${row.drive.projectReference ? ` · Ref. ${row.drive.projectReference}` : ""}`
          : "Uygun katalog satırı yok",
        row.drive ? `${n(row.drive.motorPowerKw)} kW` : "—",
        row.drive ? `${n(row.drive.outputCurrentA)} A` : "—",
      ]),
      note: "Sürücü seçimi ön boyutlandırmadır; motor etiket akımı, frenleme çevrimi, rejeneratif çalışma ve üretici uygulama notları nihai projede doğrulanır.",
    },
    checkSuffixes: driveChecks,
  },
  {
    id: "12.2",
    title: "Motor ve Ana Besleme Kabloları",
    description:
      "Akım taşıma ile üç faz gerilim düşümünü birlikte kontrol eder. Motor tarafında ekranlı TOPFLEX 611-C-PUR, ana girişte JZ-600 fiziksel ölçüleri kullanılır; kullanıcı başka yerel HELUKABEL satırını ve paralel damar adedini seçebilir.",
    editor: "electricalCables",
    rows: [
      { key: "mainCable.requiredSection", label: "Ana Besleme Gereken Kesiti", unit: "mm²", digits: 1 },
      { key: "mainCable.selected", label: "Ana Besleme Seçimi" },
      { key: "mainCable.voltageDrop", label: "Ana Besleme Gerilim Düşümü", formula: "√3·I·L·ρ·cosφ/(A·n·U)", unit: "%", digits: 2 },
    ],
    table: {
      title: "Kablo Çapı, Ağırlığı ve Elektriksel Kontrol",
      headers: ["Devre", "Seçilen Kablo", "Dış Ölçü", "Ağırlık", "Paralel", "Akım / Kapasite", "ΔU"],
      build: (ctx) => {
        const rows = ctx.v.motorCables.map((row) => {
          const cable = row.selectedCable;
          return [
            row.circuit.label,
            cable ? `${cable.family} ${cable.construction} · ${cable.articleNo}` : "Kablo bulunamadı",
            cable ? (cable.shape === "round" ? `Ø${n(cable.widthMm, 1)} mm` : `${n(cable.widthMm, 1)} × ${n(cable.heightMm, 1)} mm`) : "—",
            cable ? `${n(cable.weightKgPerM, 3)} kg/m` : "—",
            row.selectedRuns,
            `${n(row.designCurrentA)} / ${n(row.ampacityA)} A`,
            `${n(row.voltageDropPct)} %`,
          ];
        });
        const main = ctx.v.mainCable;
        const cable = main.selectedCable;
        rows.push([
          "Ana Besleme",
          cable ? `${cable.family} ${cable.construction} · ${cable.articleNo}` : "Kablo bulunamadı",
          cable ? (cable.shape === "round" ? `Ø${n(cable.widthMm, 1)} mm` : `${n(cable.widthMm, 1)} × ${n(cable.heightMm, 1)} mm`) : "—",
          cable ? `${n(cable.weightKgPerM, 3)} kg/m` : "—",
          main.selectedRuns,
          `${n(main.designCurrentA)} / ${n(main.ampacityA)} A`,
          `${n(main.voltageDropPct)} %`,
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
      { key: "festoon.packageWidth", label: "Kablo Paketi Genişliği", unit: "mm", digits: 1 },
      { key: "festoon.packageHeight", label: "Kablo Paketi Yüksekliği", unit: "mm", digits: 1 },
      { key: "festoon.packageWeight", label: "Kablo Paketi Birim Ağırlığı", unit: "kg/m", digits: 3 },
      { key: "festoon.centerOffset", label: "Enine Ağırlık Merkezi Sapması", unit: "mm", digits: 1 },
      { key: "festoon.minimumDiameter", label: "Gereken Minimum Taşıyıcı Çapı", unit: "mm", digits: 1 },
    ],
    table: {
      title: "Feston Arabasındaki Kablolar",
      headers: ["Sıra", "Kablo", "Tür", "Ürün", "Ölçü", "kg/m", "Min. Bükülme Ø"],
      build: (ctx) => ctx.v.festoon.placements.map((p) => [
        p.row + 1,
        p.label,
        p.purpose === "power" ? "Güç" : p.purpose === "control" ? "Kumanda" : "Sinyal",
        `${p.family} ${p.construction} · ${p.articleNo}`,
        `${n(p.widthMm, 1)} × ${n(p.heightMm, 1)} mm`,
        n(p.weightKgPerM, 3),
        `${n(p.minimumBendDiameterMm, 1)} mm`,
      ]),
      note: "Yerleşim, kablo ağırlık merkezini araba orta eksenine yaklaştıracak şekilde otomatik dengelenir. Nihai bağlama sırası üretici montaj talimatıyla doğrulanır.",
    },
    checkSuffixes: ["festoon.width", "festoon.height", "festoon.bend", "festoon.load", "festoon.cog"],
  },
];
