// Elektrik hesap raporunun izlenebilir, küçük yerel kataloğu.
//
// Sürücü satırları üretici seçim tablolarından; kablo ölçüleri ise ORION'un
// 0019 işinde kullandığı HELUKABEL ürünlerinin yerel üretici kataloğundan
// alınmıştır. Bu dosya bir satınalma/equipment kataloğu değildir: yalnız
// hesap ve fiziksel feston yerleşimi için gereken sayısal özellikleri taşır.

export type ElectricalDriveBrand =
  | "Schneider Electric"
  | "ABB"
  | "Siemens";

export interface ElectricalDriveModel {
  brand: ElectricalDriveBrand;
  series: string;
  model: string;
  /** Ağır hizmette önerilen motor gücü; S120'de katalog tip gücü. */
  motorPowerKw: number;
  /** Üretici tablosundaki sürekli/anma çıkış akımı. */
  outputCurrentA: number;
  projectReference?: "0019" | "0026";
  source: string;
}

const schneider = "Schneider Electric Altivar ürün seçim tabloları";
const abb = "ABB ACS880-01 hardware manual, ağır hizmet değerleri";
const siemens = "Siemens SINAMICS S120 D21.4 katalogu, Booksize Motor Module";

export const ELECTRICAL_DRIVE_MODELS: readonly ElectricalDriveModel[] = [
  // ATV320 — 380…500 V üç faz, kompakt/kitap tip gövdeler.
  { brand: "Schneider Electric", series: "ATV320", model: "ATV320U04N4C", motorPowerKw: 0.37, outputCurrentA: 1.5, source: schneider },
  { brand: "Schneider Electric", series: "ATV320", model: "ATV320U06N4C", motorPowerKw: 0.55, outputCurrentA: 1.9, source: schneider },
  { brand: "Schneider Electric", series: "ATV320", model: "ATV320U07N4C", motorPowerKw: 0.75, outputCurrentA: 2.3, source: schneider },
  { brand: "Schneider Electric", series: "ATV320", model: "ATV320U11N4C", motorPowerKw: 1.1, outputCurrentA: 3, source: schneider },
  { brand: "Schneider Electric", series: "ATV320", model: "ATV320U15N4C", motorPowerKw: 1.5, outputCurrentA: 4.1, source: schneider },
  { brand: "Schneider Electric", series: "ATV320", model: "ATV320U22N4C", motorPowerKw: 2.2, outputCurrentA: 5.5, source: schneider },
  { brand: "Schneider Electric", series: "ATV320", model: "ATV320U30N4C", motorPowerKw: 3, outputCurrentA: 7.1, source: schneider },
  { brand: "Schneider Electric", series: "ATV320", model: "ATV320U40N4C", motorPowerKw: 4, outputCurrentA: 9.5, source: schneider },
  { brand: "Schneider Electric", series: "ATV320", model: "ATV320U55N4C", motorPowerKw: 5.5, outputCurrentA: 14.3, source: schneider },
  { brand: "Schneider Electric", series: "ATV320", model: "ATV320U75N4C", motorPowerKw: 7.5, outputCurrentA: 17, source: schneider },
  { brand: "Schneider Electric", series: "ATV320", model: "ATV320D11N4C", motorPowerKw: 11, outputCurrentA: 27.7, source: schneider },
  { brand: "Schneider Electric", series: "ATV320", model: "ATV320D15N4C", motorPowerKw: 15, outputCurrentA: 33, source: schneider },

  // ATV340 — ağır hizmet (HD) sütunu.
  ...[
    ["ATV340U07N4E", 0.75, 2.2], ["ATV340U15N4E", 1.5, 4],
    ["ATV340U22N4E", 2.2, 5.6], ["ATV340U30N4E", 3, 7.2],
    ["ATV340U40N4E", 4, 9.3], ["ATV340U55N4E", 5.5, 12.7],
    ["ATV340U75N4E", 7.5, 16.5], ["ATV340D11N4E", 11, 24],
    ["ATV340D15N4E", 15, 32], ["ATV340D18N4E", 18.5, 39],
    ["ATV340D22N4E", 22, 46], ["ATV340D30N4E", 30, 61.5],
    ["ATV340D37N4E", 37, 74.5], ["ATV340D45N4E", 45, 88],
    ["ATV340D55N4E", 55, 106], ["ATV340D75N4E", 75, 145],
  ].map(([model, motorPowerKw, outputCurrentA]) => ({
    brand: "Schneider Electric" as const,
    series: "ATV340",
    model: model as string,
    motorPowerKw: motorPowerKw as number,
    outputCurrentA: outputCurrentA as number,
    source: schneider,
  })),

  // ATV930 — 400/480 V, ağır hizmet (150% / 60 s) sütunu. 0026'da geçen
  // D15 ve D90 satırları ayrıca proje referansını taşır.
  ...[
    ["ATV930U07N4", 0.37, 1.5], ["ATV930U15N4", 0.75, 2.2],
    ["ATV930U22N4", 1.5, 4], ["ATV930U30N4", 2.2, 5.6],
    ["ATV930U40N4", 3, 7.2], ["ATV930U55N4", 4, 9.3],
    ["ATV930U75N4", 5.5, 12.7], ["ATV930D11N4", 7.5, 16.5],
    ["ATV930D15N4", 11, 23.5], ["ATV930D18N4", 15, 31.7],
    ["ATV930D22N4", 18.5, 39.2], ["ATV930D30N4", 22, 46.3],
    ["ATV930D37N4", 30, 61.5], ["ATV930D45N4", 37, 74.5],
    ["ATV930D55N4", 45, 88], ["ATV930D75N4", 55, 106],
    ["ATV930D90N4", 75, 145], ["ATV930C11N4C", 90, 173],
    ["ATV930C13N4C", 110, 180], ["ATV930C16N4C", 132, 240],
    ["ATV930C22N4", 160, 246], ["ATV930C25N4C", 220, 301],
    ["ATV930C31N4C", 250, 375],
  ].map(([model, motorPowerKw, outputCurrentA]) => ({
    brand: "Schneider Electric" as const,
    series: "ATV930",
    model: model as string,
    motorPowerKw: motorPowerKw as number,
    outputCurrentA: outputCurrentA as number,
    projectReference:
      model === "ATV930D15N4" || model === "ATV930D90N4"
        ? "0026" as const
        : undefined,
    source: schneider,
  })),

  // ACS880-01, 400 V sınıfı (-3), ağır hizmet sütunu.
  ...[
    ["ACS880-01-02A4-3", 0.55, 1.8], ["ACS880-01-03A3-3", 0.75, 2.4],
    ["ACS880-01-04A0-3", 1.1, 3.3], ["ACS880-01-05A6-3", 1.5, 4],
    ["ACS880-01-07A2-3", 2.2, 5.6], ["ACS880-01-09A4-3", 3, 8],
    ["ACS880-01-12A6-3", 4, 10], ["ACS880-01-017A-3", 5.5, 12.6],
    ["ACS880-01-025A-3", 7.5, 17], ["ACS880-01-032A-3", 11, 25],
    ["ACS880-01-038A-3", 15, 32], ["ACS880-01-045A-3", 18.5, 38],
    ["ACS880-01-061A-3", 22, 45], ["ACS880-01-072A-3", 30, 61],
    ["ACS880-01-087A-3", 37, 72], ["ACS880-01-105A-3", 45, 87],
    ["ACS880-01-145A-3", 55, 105], ["ACS880-01-169A-3", 75, 145],
    ["ACS880-01-206A-3", 90, 169], ["ACS880-01-246A-3", 110, 206],
    ["ACS880-01-293A-3", 132, 246], ["ACS880-01-363A-3", 160, 293],
  ].map(([model, motorPowerKw, outputCurrentA]) => ({
    brand: "ABB" as const,
    series: "ACS880-01",
    model: model as string,
    motorPowerKw: motorPowerKw as number,
    outputCurrentA: outputCurrentA as number,
    source: abb,
  })),

  // 0019'da 30 A ve 132 A gövdeleri kullanıldı.
  ...[
    ["6SL3120-1TE13-0AD0", 1.6, 3], ["6SL3120-1TE15-0AD0", 2.7, 5],
    ["6SL3120-1TE21-0AD0", 4.8, 9], ["6SL3120-1TE21-8AC0", 9.7, 18],
    ["6SL3120-1TE23-0AC0", 16, 30], ["6SL3120-1TE24-5AA3", 24, 45],
    ["6SL3120-1TE26-0AA3", 32, 60], ["6SL3120-1TE28-5AA3", 46, 85],
    ["6SL3120-1TE31-3AA3", 71, 132], ["6SL3120-1TE32-0AA4", 107, 200],
  ].map(([model, motorPowerKw, outputCurrentA]) => ({
    brand: "Siemens" as const,
    series: "SINAMICS S120 Booksize",
    model: model as string,
    motorPowerKw: motorPowerKw as number,
    outputCurrentA: outputCurrentA as number,
    projectReference:
      model === "6SL3120-1TE23-0AC0" || model === "6SL3120-1TE31-3AA3"
        ? "0019" as const
        : undefined,
    source: siemens,
  })),
];

export type CablePurpose = "power" | "control" | "signal";
export type CableShape = "round" | "flat";
export type CableBrand = "HELUKABEL" | "ÜNTEL";

export interface ElectricalCableModel {
  brand: CableBrand;
  articleNo: string;
  family: string;
  construction: string;
  purpose: CablePurpose;
  shape: CableShape;
  widthMm: number;
  heightMm: number;
  weightKgPerM: number;
  bendRadiusFactor: number;
  sectionMm2?: number;
  cores?: number;
  shielded: boolean;
  /** Üreticinin hareketli/feston kullanımına açıkça uygun gördüğü ürün. */
  festoonSuitable: boolean;
  source: string;
  sourceUrl?: string;
}

const helu = "HELUKABEL Kablo ve İletkenler katalogu (yerel 0019 kaynak seti)";

function round(
  articleNo: string,
  family: string,
  construction: string,
  purpose: CablePurpose,
  diameterMm: number,
  weightKgPerKm: number,
  bendRadiusFactor: number,
  sectionMm2: number | undefined,
  cores: number | undefined,
  shielded: boolean
): ElectricalCableModel {
  return {
    brand: "HELUKABEL", articleNo, family, construction, purpose, shape: "round",
    widthMm: diameterMm, heightMm: diameterMm,
    weightKgPerM: weightKgPerKm / 1000,
    bendRadiusFactor, sectionMm2, cores, shielded,
    festoonSuitable: family.startsWith("TOPFLEX") || family.startsWith("ROBOFLEX") || family.includes("PUR"),
    source: helu,
  };
}

function flat(
  articleNo: string,
  construction: string,
  widthMm: number,
  heightMm: number,
  weightKgPerKm: number,
  sectionMm2: number,
  cores: number
): ElectricalCableModel {
  return {
    brand: "HELUKABEL", articleNo, family: "PVC Flat", construction, purpose: "power", shape: "flat",
    widthMm, heightMm, weightKgPerM: weightKgPerKm / 1000,
    // Üretici hareketli kullanım için kablo KALINLIĞININ 10 katını verir.
    bendRadiusFactor: 10, sectionMm2, cores, shielded: false, festoonSuitable: true, source: helu,
  };
}

const untelFlatSource = "ÜNTEL üretici ürün tablosu — vinç/feston kabloları";
const untelSourceUrl = "https://www.untel.com.tr/en/crane-cables/";

/** ÜNTEL tablolarındaki kalınlık × genişlik ve serbest hareket bükülme yarıçapı. */
function untelFlat(
  family: "H07VVH6-F (UNFLAT)" | "NGFLCGÖU",
  construction: string,
  thicknessMm: number,
  widthMm: number,
  weightKgPerKm: number,
  bendRadiusMm: number,
  sectionMm2: number,
  cores: number,
  shielded: boolean
): ElectricalCableModel {
  return {
    brand: "ÜNTEL",
    articleNo: `UNTEL-${family.startsWith("NG") ? "NGFLCGOU" : "H07VVH6F"}-${construction.replace(/[^0-9A-Za-z]+/g, "-")}`,
    family,
    construction,
    purpose: "power",
    shape: "flat",
    widthMm,
    heightMm: thicknessMm,
    weightKgPerM: weightKgPerKm / 1000,
    bendRadiusFactor: bendRadiusMm / thicknessMm,
    sectionMm2,
    cores,
    shielded,
    festoonSuitable: true,
    source: untelFlatSource,
    sourceUrl: untelSourceUrl,
  };
}

function untelRound(
  family: "ÜNFLEX PUR" | "2XSLCH-J",
  construction: string,
  diameterMm: number,
  weightKgPerKm: number,
  bendRadiusFactor: number,
  sectionMm2: number,
  cores: number,
  shielded: boolean,
  festoonSuitable: boolean
): ElectricalCableModel {
  return {
    brand: "ÜNTEL",
    articleNo: `UNTEL-${family === "ÜNFLEX PUR" ? "UNFLEX-PUR" : "2XSLCH-J"}-${construction.replace(/[^0-9A-Za-z]+/g, "-")}`,
    family,
    construction,
    purpose: sectionMm2 <= 2.5 && cores > 4 ? "control" : "power",
    shape: "round",
    widthMm: diameterMm,
    heightMm: diameterMm,
    weightKgPerM: weightKgPerKm / 1000,
    bendRadiusFactor,
    sectionMm2,
    cores,
    shielded,
    festoonSuitable,
    source: family === "ÜNFLEX PUR"
      ? "ÜNTEL ÜNFLEX PUR üretici ürün tablosu"
      : "ÜNTEL 2XSLCH-J üretici ürün tablosu — VFD motor kablosu, sabit tesis",
    sourceUrl: family === "ÜNFLEX PUR"
      ? "https://www.untel.com.tr/en/industrial-cables/unflex-pur/"
      : "https://www.untel.com.tr/en/industrial-cables/2xslch-j/",
  };
}

const topflexRows = [
  ["22970", 1.5, 11.3, 220], ["22971", 2.5, 13.5, 340],
  ["22972", 4, 16, 490], ["22973", 6, 17.8, 680],
  ["22974", 10, 22.2, 1035], ["22975", 16, 27.2, 1460],
  ["22976", 25, 31.2, 1990], ["22977", 35, 35.2, 2535],
  ["22982", 50, 42.5, 3360], ["22983", 70, 48.8, 4650],
  ["22984", 95, 54.6, 6090], ["22985", 120, 58.5, 7380],
] as const;

const jz600Rows = [
  ["10659", 1.5, 9.7, 139], ["10692", 2.5, 11.3, 203],
  ["10711", 4, 13, 310], ["10717", 6, 14.6, 430],
  ["10721", 10, 18.6, 790], ["10725", 16, 22.4, 1100],
  ["10729", 25, 27.4, 1600], ["10733", 35, 30.4, 2400],
  ["10736", 50, 35.8, 3400], ["10738", 70, 40.7, 4400],
  ["10740", 95, 46.6, 6010], ["10741", 120, 51.6, 7500],
  ["10745", 150, 57.4, 8640],
] as const;

const flatRows = [
  ["26980", 0.75, 4, 12.6, 4.3, 90], ["26981", 0.75, 5, 16.1, 4.3, 115],
  ["26983", 0.75, 9, 26.4, 4.3, 198], ["26984", 0.75, 10, 30.1, 4.3, 224],
  ["26990", 1, 3, 10.8, 4.5, 80], ["26991", 1, 4, 13.4, 4.5, 104],
  ["27001", 1.5, 4, 13.7, 4.5, 133], ["27002", 1.5, 5, 17.9, 4.5, 169],
  ["27003", 1.5, 7, 23.5, 4.5, 235], ["27004", 1.5, 8, 26.8, 4.5, 265],
  ["27005", 1.5, 10, 33.5, 4.5, 332], ["27006", 1.5, 12, 38.9, 4.5, 421],
  ["27007", 2.5, 4, 17, 5.5, 205], ["27008", 2.5, 5, 21.5, 5.5, 256],
  ["27009", 2.5, 7, 30.3, 5.5, 344], ["27010", 2.5, 8, 31.9, 5.5, 389],
  ["27011", 2.5, 12, 47.1, 5.8, 580], ["27013", 4, 4, 21.8, 7, 344],
  ["27016", 6, 4, 24.8, 8.2, 424], ["27019", 10, 4, 29.6, 10, 710],
  ["27020", 16, 4, 34.4, 11.2, 1014], ["27021", 25, 4, 42.6, 13.7, 1365],
  ["27022", 35, 4, 47.6, 15.4, 2100], ["27023", 50, 4, 57, 18.2, 2940],
  ["27024", 70, 4, 64.2, 20, 4090],
] as const;

// ÜNTEL H07VVH6-F: ekranlamasız, 450/750 V, vinç/feston için yassı güç ve
// kumanda kablosu. Üretici tablosundaki 4 damarlı güç satırları.
const untelH07FlatRows = [
  [1.5, 5.3, 14.9, 154, 27], [2.5, 5.4, 17.2, 202, 27],
  [4, 6.3, 19.2, 282, 32], [6, 6.8, 21.2, 367, 34],
  [10, 8.9, 28, 624, 45], [16, 9.8, 28, 861, 49],
  [25, 12.4, 40.8, 1342, 74], [35, 13.6, 45.3, 1747, 82],
  [50, 17, 56.2, 2603, 102], [70, 19.4, 64.5, 3597, 116],
  [95, 21, 77.4, 4657, 126], [120, 24.8, 84.2, 5999, 149],
  [150, 26.6, 95.9, 7350, 160],
] as const;

// ÜNTEL NGFLCGÖU: kalaylı bakır örgü ekranlı, 300/500 V, doğrudan feston
// uygulaması için üretici tarafından yayımlanan 4 damarlı güç satırları.
const untelScreenedFlatRows = [
  [1.5, 6.8, 20.4, 290, 20], [2.5, 8.1, 23.1, 422, 32],
  [4, 9.2, 26.7, 498, 37], [6, 10, 32.1, 677, 40],
  [10, 11.7, 35.6, 952, 47], [16, 13.5, 44.1, 1341, 68],
  [25, 15, 54, 2004, 75], [35, 16, 56, 2470, 80],
  [50, 19.5, 63.5, 3130, 98], [70, 21.5, 73.8, 4588, 108],
  [95, 24.1, 79.2, 5206, 121], [120, 27.8, 91.4, 7246, 139],
] as const;

const untelVfdRows = [
  [1.5, 10.6, 160], [2.5, 12, 225], [10, 17.5, 592],
  [16, 20.3, 866], [25, 25.8, 1315], [35, 28.3, 1750],
  [50, 32.9, 2380], [70, 38.7, 3432], [95, 42.8, 4315],
  [120, 47.8, 5441], [150, 52.6, 6675],
] as const;

const untelControlRows = [
  [7, 1.5, 9.6, 161], [12, 1.5, 12.6, 280],
  [18, 1.5, 14.8, 396], [21, 1.5, 15.6, 450],
  [25, 1.5, 17.8, 565], [32, 1.5, 19.3, 686],
] as const;

export const ELECTRICAL_CABLE_MODELS: readonly ElectricalCableModel[] = [
  ...topflexRows.map(([article, section, od, weight]) =>
    round(article, "TOPFLEX 611-C-PUR", `4G${section}`, "power", od, weight, 10, section, 4, true)),
  ...jz600Rows.map(([article, section, od, weight]) =>
    round(article, "JZ-600", `4G${section}`, "power", od, weight, 7.5, section, 4, false)),
  ...flatRows.map(([article, section, cores, width, height, weight]) =>
    flat(article, `${cores}G${section}`, width, height, weight, section, cores)),
  ...untelH07FlatRows.map(([section, thickness, width, weight, bendRadius]) =>
    untelFlat("H07VVH6-F (UNFLAT)", `4G${section}`, thickness, width, weight, bendRadius, section, 4, false)),
  ...untelScreenedFlatRows.map(([section, thickness, width, weight, bendRadius]) =>
    untelFlat("NGFLCGÖU", `4G${section}`, thickness, width, weight, bendRadius, section, 4, true)),
  ...untelVfdRows.map(([section, diameter, weight]) =>
    untelRound("2XSLCH-J", `4G${section}`, diameter, weight, 10, section, 4, true, false)),
  ...untelControlRows.map(([cores, section, diameter, weight]) =>
    untelRound("ÜNFLEX PUR", `${cores}G${section}`, diameter, weight, 10, section, cores, false, true)),
  round("10365", "JZ-500", "3G1.5", "control", 6.8, 90, 7.5, 1.5, 3, false),
  round("10366", "JZ-500", "4G1.5", "control", 7.6, 109, 7.5, 1.5, 4, false),
  round("10367", "JZ-500", "5G1.5", "control", 8.3, 131, 7.5, 1.5, 5, false),
  round("10368", "JZ-500", "7G1.5", "control", 9.2, 184, 7.5, 1.5, 7, false),
  round("10369", "JZ-500", "12G1.5", "control", 12.2, 309, 7.5, 1.5, 12, false),
  round("16405", "F-CY-JZ", "21G1.5", "control", 16.7, 560, 10, 1.5, 21, true),
  round("16501", "TRONIC-CY", "3x1.5", "control", 7.4, 100, 10, 1.5, 3, true),
  round("16505", "TRONIC-CY", "7x1.5", "control", 9.8, 208, 10, 1.5, 7, true),
  round("19104", "SUPER-PAAR-TRONIC-C-PUR", "4x2x0.25", "signal", 7.7, 90, 7.5, 0.25, 8, true),
  round("705221", "TOPGEBER 512 PUR", "4x2x0.25", "signal", 7.5, 88, 10, 0.25, 8, true),
  round("25474", "ROBOFLEX 2001", "18G1", "control", 15.4, 306, 7.5, 1, 18, false),
];

export const CABLE_BRANDS = ["HELUKABEL", "ÜNTEL"] as const;

export const DRIVE_BRANDS = ["Schneider Electric", "ABB", "Siemens"] as const;

export function driveSeriesFor(brand: string): string[] {
  return [...new Set(ELECTRICAL_DRIVE_MODELS.filter((x) => x.brand === brand).map((x) => x.series))];
}

export function driveModelsFor(brand: string, series: string): ElectricalDriveModel[] {
  return ELECTRICAL_DRIVE_MODELS.filter((x) => x.brand === brand && x.series === series);
}

export function cableByArticle(articleNo: string): ElectricalCableModel | undefined {
  return ELECTRICAL_CABLE_MODELS.find((x) => x.articleNo === articleNo);
}
