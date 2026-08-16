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
  SAFETY_FACTOR_PCT,
  type CabinInputs,
  type CabinSelections,
  type CabinValues,
} from "../modules/cabin";
import { GLAZING_KIND_LABELS } from "./cabinFields";
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
  /**
   * Bu bölümün ekipman listesindeki satır slug'ları (`EqRow.rowKey`in
   * `cabin:` sonrası). Bölüm GİZLENDİĞİNDE bu satırlar da listeden düşer
   * (ekran + Excel + PDF); bağ koruma testiyle ölçülür
   * (`hidden-sections-equipment.test.ts`).
   */
  equipmentSlugs?: readonly string[];
}

const n = (v: number | string | undefined, d = 2): string => {
  if (v === undefined) return "?";
  if (typeof v === "string") return v;
  if (Number.isInteger(v)) return String(v);
  return v.toLocaleString("tr-TR", { maximumFractionDigits: d });
};

/**
 * Isı yükü ve klima satırları — üç mahal de aynı kalıptan geçer.
 *
 * Sıralama raporun okunma sırasıdır: önce zarf (U ve iletim), sonra dışarıdan
 * gelenler (güneş · ışınım), sonra içeride üretilen (cihaz · taze hava), en
 * sonda toplam ve seçilen ürünün kapasitesi.
 */
function climateRows(block: "cabinAc" | "roomAc" | "panelAc"): CabinRowDef[] {
  const cell = (x: CabinCtx, key: string): number =>
    typeof x.c[`${block}.${key}`] === "number" ? (x.c[`${block}.${key}`] as number) : 0;
  return [
    {
      key: `${block}.uValue`, label: "Panel Isı Geçirgenliği U",
      formula: "U = 1 / (Rsi + d/λ + Rse) · (1 + ısı köprüsü payı)",
      subst: (x) =>
        `λ, yalıtımın ${n(x.v.insulationMeanTempC ?? 0, 0)} °C ortalama sıcaklığında okunur`,
      unit: "W/m²K", digits: 3,
    },
    {
      key: `${block}.transmission`, label: "İletim Isı Kazancı",
      formula: "Q = Σ U·A·ΔT   (kapılar kendi U değeriyle)",
      subst: (x) => `ΔT = ${n(x.v.ambientTempMaxC)} − ${n(x.v.roomDesignTempC)} = ${n(x.v.ambientTempMaxC - x.v.roomDesignTempC)} K`,
      unit: "kW", digits: 2,
    },
    {
      key: `${block}.solar`, label: "Güneş Isı Kazancı",
      valueFrom: (x) => (x.v.environment === "outdoor" ? cell(x, "solar") : "Kapalı mahal — güneş yok"),
      formula: "güneş-hava sıcaklığı: T_sol = T_dış + α·I/h_o − ΔR/h_o",
      unit: "kW", digits: 2,
    },
    {
      key: `${block}.radiation`, label: "Çevre Işınım Yükü",
      valueFrom: (x) => cell(x, "radiation") || "Girilmedi — hesaba katılmadı",
      formula: "mühendis girdisi; ışınım görüş hattı ister (platform / ısı kalkanı engelleyebilir)",
      unit: "kW", digits: 2,
    },
    {
      key: `${block}.deviceHeat`, label: "Cihaz Isısı",
      formula: "pano kayıpları · kumanda · aydınlatma",
      unit: "kW", digits: 2,
    },
    {
      key: `${block}.freshAir`, label: "Taze Hava Yükü (Duyulur + Gizli)",
      formula: "Q = ṁ_taze · (h_dış − h_iç)",
      subst: (x) =>
        `${n(cell(x, "freshAirFlow"), 2)} m³/h · ortam %${n(x.v.ambientRhPct, 0)} bağıl nem`,
      unit: "kW", digits: 2,
    },
    {
      key: `${block}.calculated`, label: "Hesaplanan Isı Kazancı",
      formula: "iletim + güneş + ışınım + cihaz + taze hava",
      unit: "kW", digits: 2,
    },
    {
      key: `${block}.total`, label: "Toplam Isı Kazancı (Emniyetli)",
      formula: "Q_toplam = Q_hesap · (1 + emniyet katsayısı)",
      subst: (x) => `${n(cell(x, "calculated"), 2)} · 1,${SAFETY_FACTOR_PCT}`,
      unit: "kW", digits: 2,
    },
    {
      key: `${block}.coolingMax`, label: "Katalog Soğutma Kapasitesi",
      valueFrom: (x) => cell(x, "coolingMax") || "Katalogdan ürün seçilmedi",
      formula: "seçilen katalog satırının kapasite bandı üst ucu",
      unit: "kW", digits: 2,
    },
    {
      key: `${block}.ambientMax`, label: "Katalog Ortam Sıcaklığı Üst Sınırı",
      valueFrom: (x) => cell(x, "ambientMax") || "Katalogda yayımlanmamış",
      formula: "seçilen katalog satırı — projenin ortam sıcaklığı üst sınırıyla karşılaştırılır",
      unit: "°C", digits: 0,
    },
    {
      key: `${block}.airFlow`, label: "Gereken Üfleme Havası Debisi",
      formula: "V = Q_toplam / (ρ · cp · ΔT_üfleme)",
      subst: () => "ΔT_üfleme = 8 K (üfleme havası odadan 8 K soğuk)",
      unit: "m³/h", digits: 0,
    },
    {
      key: `${block}.condensate`, label: "Yoğuşan Su (Drenaj)",
      formula: "m_su = ṁ_taze · (w_dış − w_iç) + operatörün gizli ısısı",
      unit: "kg/h", digits: 2,
    },
  ];
}

export const CABIN_SECTIONS: CabinSectionDef[] = [
  {
    id: "11.1",
    title: "Operatör Kabini",
    description:
      "Kabin ölçüleri, izolasyonu, camı ve kabin kliması. Kabin bir elektrik " +
      "odası DEĞİLDİR: içinde İNSAN vardır ve büyük bir CAM yüzeyi taşır. Bu " +
      "iki kalem yükü belirler — cam panelin birkaç katı ısı geçirir ve açık " +
      "havada güneşi doğrudan içeri alır; operatörün hem ısısı hem de temiz " +
      "hava ihtiyacı vardır ve o ihtiyaç çoğu zaman basınçlandırma " +
      "sızıntısından büyüktür. Yalıtım iletkenliği λ, yalıtımın ORTALAMA " +
      "sıcaklığında okunur. Nihai kapasite üreticinin proje bazlı teyidine " +
      "tabidir.",
    visible: (specs) => hasOperatorCabin(specs),
    equipmentSlugs: ["operator-cabin", "cabinAc"],
    inputKeys: [
      "cabinWidthM", "cabinLengthM", "cabinHeightM", "cabinInsulation",
      "cabinDoorCount", "cabinGlazingAreaM2", "cabinGlazingKind",
      "cabinOccupantCount", "cabinDeviceHeatKw", "cabinRadiationKw",
    ],
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
      {
        key: "cabinAc.glazingArea", label: "Cam Alanı",
        valueFrom: (x) =>
          (x.c["cabinAc.glazingArea"] as number) || "Cam girilmedi",
        formula: "cam duvar panelinden düşülür; kendi U değeriyle hesaplanır",
        subst: (x) => `${GLAZING_KIND_LABELS[x.inp.cabinGlazingKind] ?? "—"}`,
        unit: "m²", digits: 2,
      },
      {
        key: "cabinAc.occupant", label: "Operatör Isısı (Duyulur + Gizli)",
        formula: "kişi başına 75 W duyulur + 55 W gizli (oturur, hafif iş)",
        subst: (x) => `${n(x.inp.cabinOccupantCount, 0)} kişi × 130 W`,
        unit: "kW", digits: 2,
      },
      {
        key: "cabinAc.freshAirFlow", label: "Taze Hava Debisi",
        formula:
          "maks(basınçlandırma sızıntısı · kişi başı 5 L/s temiz hava) — " +
          "insanın hava ihtiyacı basınçlandırmadan bağımsız bir sağlık gereğidir",
        subst: (x) =>
          `maks(${n(x.c["cabinAc.infiltration"] as number, 2)} · ` +
          `${n(x.inp.cabinOccupantCount * 18, 1)}) m³/h`,
        unit: "m³/h", digits: 2,
      },
      ...climateRows("cabinAc"),
    ],
    checkSuffixes: [
      "cabinAc.selected", "cabinAc.ambient", "cabinAc.capacity", "cabinAc.radiationScope",
    ],
  },
  {
    id: "11.2",
    title: "Elektrik Odası",
    description:
      "Oda ölçüleri, izolasyonu, kapı adedi ve kurulu yedek (1+1) klima düzeni. " +
      "PANO KAYIP GÜCÜ seçilmiş motor güçlerinden otomatik türetilir (ABB " +
      "ACS880 katalog kayıpları, ağır hizmet seçimi); sürücü gücü ayrıca " +
      "sorulmaz. Kurulu yedekte kapasite kontrolü TEK üniteye göre yapılır — " +
      "ikincisi yedektir, yükü paylaşmaz.",
    visible: (specs) => hasElectricalRoom(specs),
    equipmentSlugs: ["electrical-room", "roomAc"],
    inputKeys: [
      "roomWidthM", "roomLengthM", "roomHeightM", "roomInsulation",
      "roomDoorCount", "roomDeviceHeatKw", "roomRadiationKw", "roomAcRedundancy",
    ],
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
    checkSuffixes: [
      "roomAc.selected", "roomAc.ambient", "roomAc.capacity", "roomAc.radiationScope",
    ],
  },
  {
    id: "11.3",
    title: "Elektrik Panoları",
    description:
      "Yan yana pano yerleşimi. Oda izolasyonu yerine panonun kendi IP " +
      "koruması geçerlidir; klima adedi ve soğutma yükü pano başına " +
      "hesaplanır. Sızıntı yolu olarak kapı yerine pano kapakları sayılır.",
    visible: (specs) => hasElectricalPanels(specs),
    equipmentSlugs: ["electrical-panel", "panelAc"],
    inputKeys: [
      "panelCount", "panelIpClass", "panelDeviceHeatKw", "panelRadiationKw",
      "panelAcRedundancy",
    ],
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
    checkSuffixes: [
      "panelAc.selected", "panelAc.ambient", "panelAc.capacity", "panelAc.radiationScope",
    ],
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
