// Kabin ve elektrik odası sunum katmanı: 11.1 … 11.3 (ham id; görünen
// numara vince dahil bölümlere göre yeniden dizilir).
// Hesap `modules/cabin.ts`tedir; burası yalnız gösterimdir.
//
// Üç alt bölüm de aynı kalıptadır: mahallin ölçüleri/özellikleri GİRDİ,
// klimanın kendisi KATALOG SEÇİMİ, ortam sıcaklığı ve ürün seçimi KONTROL.
// Bölümler teknik özelliklerdeki yerleşim seçimine göre görünür — elektrik
// odası ve pano tipi birbirini dışlar.

import {
  cabinHasAirConditioner,
  hasElectricalPanels,
  hasElectricalRoom,
  hasOperatorCabin,
  panelHasAirConditioner,
  roomHasAirConditioner,
  type CabinInputs,
  type CabinSelections,
  type CabinValues,
} from "../modules/cabin";
import type { TechnicalSpecs } from "../types";

export interface CabinCtx {
  c: Record<string, number | string>;
  v: CabinValues;
  inp: CabinInputs;
  sel: CabinSelections;
  specs: TechnicalSpecs;
}

export interface CabinRowDef {
  key: string;
  label: string;
  formula?: string;
  valueFrom?: (ctx: CabinCtx) => number | string;
  subst?: (ctx: CabinCtx) => string;
  unit?: string;
  digits?: number;
}

export interface CabinSectionDef {
  id: string;
  title: string;
  description?: string;
  visible?: (specs: TechnicalSpecs) => boolean;
  inputKeys: (keyof CabinInputs & string)[];
  selectionKeys: (keyof CabinSelections & string)[];
  rows: CabinRowDef[];
  /** "cabin." öneki hariç kontrol id sonekleri */
  checkSuffixes: string[];
}

const n = (v: number | string | undefined, d = 2): string => {
  if (v === undefined) return "?";
  if (typeof v === "string") return v;
  if (Number.isInteger(v)) return String(v);
  return v.toLocaleString("tr-TR", { maximumFractionDigits: d });
};

/** Klima seçimi üç mahalde de aynı satırları üretir. */
function climateRows(block: "cabinAc" | "roomAc" | "panelAc"): CabinRowDef[] {
  return [
    {
      key: `${block}.coolingMin`, label: "Katalog Soğutma Kapasitesi (Alt Uç)",
      formula: "seçilen katalog satırı",
      unit: "kW", digits: 2,
    },
    {
      key: `${block}.coolingMax`, label: "Katalog Soğutma Kapasitesi (Üst Uç)",
      formula: "seçilen katalog satırı",
      unit: "kW", digits: 2,
    },
    {
      key: `${block}.ambientMax`, label: "Katalog Ortam Sıcaklığı Üst Sınırı",
      valueFrom: (x) => (x.c[`${block}.ambientMax`] as number) || "Katalogda yayımlanmamış",
      formula: "seçilen katalog satırı — projenin ortam sıcaklığı üst sınırıyla karşılaştırılır",
      unit: "°C", digits: 0,
    },
  ];
}

export const CABIN_SECTIONS: CabinSectionDef[] = [
  {
    id: "11.1",
    title: "Operatör Kabini",
    description:
      "Kabin ölçüleri, taş yünü izolasyonu ve kabin kliması. Klimanın VARLIĞI " +
      "teknik özelliklerde belirlenir; ürün buradan TMS kataloğundan seçilir. " +
      "Isı yükü hesaplanmaz — nihai kapasite üretici tarafından proje bazında " +
      "doğrulanır; uygulama ortam sıcaklığı sınırını ve ürün seçiminin " +
      "yapıldığını denetler.",
    visible: (specs) => hasOperatorCabin(specs),
    inputKeys: ["cabinWidthM", "cabinLengthM", "cabinHeightM", "cabinInsulation"],
    selectionKeys: [
      "cabinAcBrand", "cabinAcModel", "cabinAcSeries", "cabinAcApplication",
      "cabinAcCoolingKwMin", "cabinAcCoolingKwMax", "cabinAcAmbientMaxC",
    ],
    rows: [
      {
        key: "cabin.floorArea", label: "Kabin Taban Alanı",
        formula: "A = genişlik × uzunluk",
        subst: (x) => `${n(x.inp.cabinWidthM)} × ${n(x.inp.cabinLengthM)}`,
        unit: "m²", digits: 2,
      },
      {
        key: "cabin.volume", label: "Kabin Hacmi",
        formula: "V = A × yükseklik",
        subst: (x) => `${n(x.v.cabinFloorAreaM2)} × ${n(x.inp.cabinHeightM)}`,
        unit: "m³", digits: 2,
      },
      ...climateRows("cabinAc"),
    ],
    checkSuffixes: ["cabinAc.selected", "cabinAc.ambient", "cabinAc.capacity"],
  },
  {
    id: "11.2",
    title: "Elektrik Odası",
    description:
      "Oda ölçüleri, izolasyonu ve kurulu yedek (1+1) klima düzeni. Yedek " +
      "seçildiğinde ekipman listesine iki ünite girer.",
    visible: (specs) => hasElectricalRoom(specs),
    inputKeys: ["roomWidthM", "roomLengthM", "roomHeightM", "roomInsulation", "roomAcRedundancy"],
    selectionKeys: [
      "roomAcBrand", "roomAcModel", "roomAcSeries", "roomAcApplication",
      "roomAcCoolingKwMin", "roomAcCoolingKwMax", "roomAcAmbientMaxC",
    ],
    rows: [
      {
        key: "room.floorArea", label: "Oda Taban Alanı",
        formula: "A = genişlik × uzunluk",
        subst: (x) => `${n(x.inp.roomWidthM)} × ${n(x.inp.roomLengthM)}`,
        unit: "m²", digits: 2,
      },
      {
        key: "room.volume", label: "Oda Hacmi",
        formula: "V = A × yükseklik",
        subst: (x) => `${n(x.v.roomFloorAreaM2)} × ${n(x.inp.roomHeightM)}`,
        unit: "m³", digits: 2,
      },
      {
        key: "room.acUnitCount", label: "Klima Ünitesi Adedi",
        formula: "kurulu yedek 1+1 ise 2, değilse 1",
        subst: (x) => (x.inp.roomAcRedundancy === "nPlusOne" ? "1 + 1" : "1"),
        unit: "adet", digits: 0,
      },
      ...climateRows("roomAc"),
    ],
    checkSuffixes: ["roomAc.selected", "roomAc.ambient", "roomAc.capacity"],
  },
  {
    id: "11.3",
    title: "Elektrik Panoları",
    description:
      "Yan yana pano yerleşimi. Oda izolasyonu yerine panonun kendi IP " +
      "koruması geçerlidir; klima adedi pano başına hesaplanır.",
    visible: (specs) => hasElectricalPanels(specs),
    inputKeys: ["panelCount", "panelIpClass", "panelAcRedundancy"],
    selectionKeys: [
      "panelAcBrand", "panelAcModel", "panelAcSeries", "panelAcApplication",
      "panelAcCoolingKwMin", "panelAcCoolingKwMax", "panelAcAmbientMaxC",
    ],
    rows: [
      {
        key: "panel.count", label: "Pano Adedi",
        formula: "mühendis girdisi",
        subst: (x) => `${n(x.inp.panelCount)}`,
        unit: "adet", digits: 0,
      },
      {
        key: "panel.acUnitCount", label: "Toplam Klima Ünitesi Adedi",
        formula: "pano adedi × (kurulu yedek 1+1 ise 2, değilse 1)",
        subst: (x) =>
          `${n(x.inp.panelCount)} × ${x.inp.panelAcRedundancy === "nPlusOne" ? 2 : 1}`,
        unit: "adet", digits: 0,
      },
      ...climateRows("panelAc"),
    ],
    checkSuffixes: ["panelAc.selected", "panelAc.ambient", "panelAc.capacity"],
  },
];

/** Klima seçimi olan mahaller — ekipman listesi ve rapor aynı listeyi okur. */
export const CABIN_CLIMATE_SITES = [
  {
    block: "cabinAc" as const,
    label: "Operatör kabini kliması",
    rowKey: "cabinAc",
    selected: cabinHasAirConditioner,
  },
  {
    block: "roomAc" as const,
    label: "Elektrik odası kliması",
    rowKey: "roomAc",
    selected: roomHasAirConditioner,
  },
  {
    block: "panelAc" as const,
    label: "Pano kliması",
    rowKey: "panelAc",
    selected: panelHasAirConditioner,
  },
];
