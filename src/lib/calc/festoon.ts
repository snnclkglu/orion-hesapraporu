// I-kiriş festoon ön seçimi.
//
// Kaynaklar:
// - Conductix-Wampfler KAT0320-0003-EN, Program 0314 / 0320 / 0325 / 0330
// - Vasel Cat.4b/52 I-Beam Festoon System: 2005…2070, VS25 ve VS26 serileri.
// Vasel'in katalog parça kodları I-kiriş penceresi/flanşı ve kablo semeri
// ölçülerine göre tamamlanır. Bu yardımcı, önce aile seviyesini doğrular.

import type {
  FestoonBrand,
  FestoonCableForm,
  FestoonSeries,
  FestoonSpec,
  TechnicalSpecs,
} from "./types";

export interface FestoonProductCodes {
  cableTrolley: string;
  towTrolley?: string;
  endClamp?: string;
}

export interface FestoonSeriesData {
  brand: FestoonBrand;
  series: Exclude<FestoonSeries, "auto">;
  line: string;
  /** Katalogda verilen çalışma yükü [kg/taşıyıcı]. */
  maxTrolleyLoadKg: number;
  /** Kablo formuna bağlı katalog yükü varsa bu değer genel kapasiteyi ezer. */
  maxTrolleyLoadKgByCableForm?: Partial<Record<FestoonCableForm, number>>;
  /** Katalogda açıkça yayımlanmışsa en yüksek hız [m/dak]. */
  maxSpeedMpm?: number;
  cableForms: readonly FestoonCableForm[];
  productCodes?: FestoonProductCodes;
  productCodesByCableForm?: Partial<Record<FestoonCableForm, FestoonProductCodes>>;
}

export const FESTOON_BRANDS: readonly FestoonBrand[] = ["conductixWampfler", "vasel"] as const;

export const FESTOON_BRAND_LABELS: Record<FestoonBrand, string> = {
  conductixWampfler: "Conductix-Wampfler",
  vasel: "Vasel",
};

export const FESTOON_SERIES: readonly FestoonSeriesData[] = [
  // Conductix-Wampfler, Program 0314 / 0320 / 0325 / 0330
  {
    brand: "conductixWampfler", series: "0314", line: "S-Line",
    maxTrolleyLoadKg: 20, maxSpeedMpm: 50, cableForms: ["flat", "round"],
  },
  {
    brand: "conductixWampfler", series: "0320", line: "M-Line",
    maxTrolleyLoadKg: 80, maxSpeedMpm: 100, cableForms: ["flat", "round"],
  },
  {
    brand: "conductixWampfler", series: "0325", line: "M-Line",
    maxTrolleyLoadKg: 125, maxSpeedMpm: 120, cableForms: ["flat", "round"],
  },
  {
    brand: "conductixWampfler", series: "0330", line: "M-Line",
    maxTrolleyLoadKg: 200, maxSpeedMpm: 150, cableForms: ["flat", "round"],
  },

  // Vasel Cat.4b/52. Hız yayımlanmayan seriler için hız kontrolü bilinçli
  // olarak "doğrulanmalı" kalır; uygulama varsayımsal bir limit üretmez.
  // Güncel Vasel ürün sayfası VS2005A-U80 için 15 kg verir; eski tam katalogda
  // 35 kg görüldüğünden aile ön seçimi güvenli tarafta 15 kg ile sınırlandırılır.
  {
    brand: "vasel", series: "VS2005", line: "NPI-80",
    maxTrolleyLoadKg: 15, cableForms: ["flat", "round"],
    productCodes: {
      cableTrolley: "VS2005A-…80", towTrolley: "VS2005T-…80", endClamp: "VS2005E-…80 / VS2005L-80",
    },
  },
  {
    brand: "vasel", series: "VS2010", line: "4W",
    maxTrolleyLoadKg: 20, cableForms: ["flat", "round"],
    productCodesByCableForm: {
      flat: { cableTrolley: "VS2010A-4WF", endClamp: "VS2010E-F-50-64.30" },
      round: { cableTrolley: "VS2010A-4WB", endClamp: "VS2010E-B" },
    },
  },
  {
    brand: "vasel", series: "VS2015", line: "I-Profil",
    maxTrolleyLoadKg: 35, cableForms: ["flat"],
    productCodes: { cableTrolley: "VS2015A", towTrolley: "VS2015T", endClamp: "VS2015E" },
  },
  {
    brand: "vasel", series: "VS2020", line: "I-Profil",
    maxTrolleyLoadKg: 35,
    maxTrolleyLoadKgByCableForm: { flat: 35, round: 30 },
    cableForms: ["flat", "round"],
    productCodesByCableForm: {
      flat: { cableTrolley: "VS2020A-4WF", towTrolley: "VS2020T-4WF", endClamp: "VS2020E-F" },
      round: { cableTrolley: "VS2020A-4WU", towTrolley: "VS2020T-4WU", endClamp: "VS2020E-U" },
    },
  },
  {
    brand: "vasel", series: "VS2050", line: "Ağır Hizmet",
    maxTrolleyLoadKg: 50, maxSpeedMpm: 100, cableForms: ["flat", "round"],
    productCodes: {
      cableTrolley: "VS2050A-FB40A…", towTrolley: "VS2050T-FB40A…", endClamp: "VS2050E-…",
    },
  },
  {
    brand: "vasel", series: "VS2060", line: "Ağır Hizmet",
    maxTrolleyLoadKg: 80, maxSpeedMpm: 120, cableForms: ["flat", "round"],
    productCodes: {
      cableTrolley: "VS2060A-FB50A…", towTrolley: "VS2060T-FB50A…", endClamp: "VS2060E-…",
    },
  },
  {
    brand: "vasel", series: "VS2070", line: "Ağır Hizmet",
    maxTrolleyLoadKg: 125, maxSpeedMpm: 150, cableForms: ["flat", "round"],
    productCodes: {
      cableTrolley: "VS2070A-FB63A…", towTrolley: "VS2070T-FB63A…", endClamp: "VS2070E-…",
    },
  },
  {
    brand: "vasel", series: "VS25-S1", line: "I-Profil · S1",
    maxTrolleyLoadKg: 150, cableForms: ["flat", "round"],
    productCodes: { cableTrolley: "VS25A-S1", towTrolley: "VS25T-S1", endClamp: "VS25E-S1" },
  },
  {
    brand: "vasel", series: "VS25-S2", line: "I-Profil · S2",
    maxTrolleyLoadKg: 150, cableForms: ["flat", "round"],
    productCodes: { cableTrolley: "VS25A-S2", towTrolley: "VS25T-S2", endClamp: "VS25E-S2" },
  },
  {
    brand: "vasel", series: "VS26-S3", line: "I-Profil · S3",
    maxTrolleyLoadKg: 380, cableForms: ["flat", "round"],
    productCodes: { cableTrolley: "VS26A-S3", towTrolley: "VS26T-S3", endClamp: "VS26E-S3" },
  },
  {
    brand: "vasel", series: "VS26-S4", line: "I-Profil · S4",
    maxTrolleyLoadKg: 380, cableForms: ["flat", "round"],
    productCodes: { cableTrolley: "VS26A-S4", towTrolley: "VS26T-S4", endClamp: "VS26E-S4" },
  },
] as const;

export const FESTOON_CABLE_FORMS: readonly FestoonCableForm[] = ["flat", "round"] as const;

export const FESTOON_CABLE_FORM_LABELS: Record<FestoonCableForm, string> = {
  flat: "Yassı kablo",
  round: "Yuvarlak kablo",
};

export const DEFAULT_FESTOON_SPEC: FestoonSpec = {
  brand: "conductixWampfler",
  series: "auto",
  trolleyCount: 1,
  cablePackageWeightKg: 0,
  cableForm: "flat",
  loopHeightM: 1.5,
};

export interface FestoonAxis {
  key: "trolley" | "auxTrolley" | "mono1Trolley" | "mono2Trolley" | "bridge";
  title: string;
  spec: FestoonSpec | undefined;
  selected: boolean;
  travelDistanceM: number | undefined;
  travelSpeedMpm: number | undefined;
}

/** Tüm hareket eksenlerinin aynı isim/sürat/mesafe eşlemesi. */
export function festoonAxes(specs: TechnicalSpecs): FestoonAxis[] {
  return [
    {
      key: "trolley",
      title: "Ana Araba",
      spec: specs.trolleyFestoon,
      selected: specs.trolleyPowerSupply === "festoon",
      travelDistanceM: specs.spanM,
      travelSpeedMpm: specs.trolleySpeedMpm,
    },
    {
      key: "auxTrolley",
      title: "Yardımcı Araba",
      spec: specs.auxTrolleyFestoon,
      selected: specs.auxTrolleyPowerSupply === "festoon",
      travelDistanceM: specs.spanM,
      travelSpeedMpm: specs.auxTrolleySpeedMpm,
    },
    {
      key: "mono1Trolley",
      title: "Monoray 1 Arabası",
      spec: specs.mono1TrolleyFestoon,
      selected: specs.mono1TrolleyPowerSupply === "festoon",
      travelDistanceM: specs.spanM,
      travelSpeedMpm: specs.mono1TrolleySpeedMpm,
    },
    {
      key: "mono2Trolley",
      title: "Monoray 2 Arabası",
      spec: specs.mono2TrolleyFestoon,
      selected: specs.mono2TrolleyPowerSupply === "festoon",
      travelDistanceM: specs.spanM,
      travelSpeedMpm: specs.mono2TrolleySpeedMpm,
    },
    {
      key: "bridge",
      title: "Köprü",
      spec: specs.bridgeFestoon,
      selected: specs.bridgePowerSupply === "festoon",
      travelDistanceM: specs.runwayLengthM,
      travelSpeedMpm: specs.bridgeSpeedMpm,
    },
  ];
}

export interface FestoonSelectionResult {
  brand: FestoonBrand;
  travelDistanceM: number;
  travelSpeedMpm: number;
  trolleyCount: number;
  cablePackageWeightKg: number;
  loadPerTrolleyKg: number | null;
  /** Seçilen kablo formu için katalog yük limiti. */
  trolleyLoadLimitKg: number | null;
  selected: FestoonSeriesData | null;
  autoSuggested: FestoonSeriesData | null;
  capacityPass: boolean | null;
  /** Katalogda limit yayımlanmamışsa null; kullanıcıya doğrulama uyarısı verilir. */
  speedPass: boolean | null;
  complete: boolean;
  pass: boolean | null;
}

function finiteNonNegative(value: number | undefined): number {
  return Number.isFinite(value) && (value ?? 0) >= 0 ? (value as number) : 0;
}

function count(value: number | undefined): number {
  return Number.isFinite(value) && (value ?? 0) > 0 ? Math.floor(value as number) : 0;
}

/** Eski kayıtlarda marka yoktur; onların Conductix-Wampfler seçimi korunur. */
export function festoonBrand(spec: FestoonSpec | null | undefined): FestoonBrand {
  return spec?.brand === "vasel" ? "vasel" : "conductixWampfler";
}

export function festoonSeriesOptions(
  brand: FestoonBrand,
  cableForm?: FestoonCableForm
): FestoonSeries[] {
  return [
    "auto",
    ...FESTOON_SERIES
      .filter((row) => row.brand === brand && (!cableForm || row.cableForms.includes(cableForm)))
      .map((row) => row.series),
  ];
}

export function festoonTrolleyLoadLimit(
  series: FestoonSeriesData,
  cableForm: FestoonCableForm
): number {
  return series.maxTrolleyLoadKgByCableForm?.[cableForm] ?? series.maxTrolleyLoadKg;
}

export function festoonSeriesOptionLabel(
  brand: FestoonBrand,
  series: FestoonSeries,
  cableForm?: FestoonCableForm
): string {
  if (series === "auto") return "Otomatik — en küçük uygun seri";
  const data = FESTOON_SERIES.find((row) => row.brand === brand && row.series === series);
  if (!data) return series;
  const forms = data.cableForms.length === 2 ? "yassı/yuvarlak" : "yassı";
  const speed = data.maxSpeedMpm ? ` / ${data.maxSpeedMpm} m/dak` : " / hız teyidi";
  const effectiveForm = cableForm && data.cableForms.includes(cableForm) ? cableForm : data.cableForms[0];
  return `${data.series} · ${data.line} · ${festoonTrolleyLoadLimit(data, effectiveForm)} kg${speed} · ${forms}`;
}

/** Ekipman listesi ve PDF'de kullanılacak katalog kod şablonları. */
export function festoonProductCodeSummary(
  series: FestoonSeriesData | null,
  cableForm?: FestoonCableForm
): string | null {
  const codes = cableForm ? series?.productCodesByCableForm?.[cableForm] ?? series?.productCodes : series?.productCodes;
  if (!codes) return null;
  return [
    `Taşıyıcı ${codes.cableTrolley}`,
    codes.towTrolley ? `öncü ${codes.towTrolley}` : undefined,
    codes.endClamp ? `sonlandırıcı ${codes.endClamp}` : undefined,
  ].filter(Boolean).join(" · ");
}

/**
 * Katalog ailesi ön seçimi. Ağırlık, seçilmiş taşıyıcı adedine eşit dağıtılır;
 * bu bir seçim kontrolüdür, kablo sarkması/askı yerleşimi hesabı değildir.
 */
export function selectFestoon(
  spec: FestoonSpec | null | undefined,
  travelDistanceM: number | undefined,
  travelSpeedMpm: number | undefined
): FestoonSelectionResult {
  const brand = festoonBrand(spec);
  const cableForm = spec?.cableForm ?? "flat";
  const trolleyCount = count(spec?.trolleyCount);
  const cablePackageWeightKg = finiteNonNegative(spec?.cablePackageWeightKg);
  const speed = finiteNonNegative(travelSpeedMpm);
  const loadPerTrolleyKg = trolleyCount > 0 ? cablePackageWeightKg / trolleyCount : null;
  const complete = trolleyCount > 0 && cablePackageWeightKg > 0;
  const catalogue = FESTOON_SERIES.filter(
    (row) => row.brand === brand && row.cableForms.includes(cableForm)
  );
  const suitable = complete && loadPerTrolleyKg !== null
    ? catalogue.find((row) => {
        const speedSuitable = row.maxSpeedMpm === undefined || row.maxSpeedMpm >= speed;
        return festoonTrolleyLoadLimit(row, cableForm) >= loadPerTrolleyKg && speedSuitable;
      }) ?? null
    : null;
  const selected = spec?.series && spec.series !== "auto"
    ? catalogue.find((row) => row.series === spec.series) ?? null
    : suitable;
  const trolleyLoadLimitKg = selected ? festoonTrolleyLoadLimit(selected, cableForm) : null;
  const capacityPass = complete && selected && loadPerTrolleyKg !== null && trolleyLoadLimitKg !== null
    ? loadPerTrolleyKg <= trolleyLoadLimitKg
    : null;
  const speedPass = complete && selected && selected.maxSpeedMpm !== undefined
    ? speed <= selected.maxSpeedMpm
    : null;

  return {
    brand,
    travelDistanceM: finiteNonNegative(travelDistanceM),
    travelSpeedMpm: speed,
    trolleyCount,
    cablePackageWeightKg,
    loadPerTrolleyKg,
    trolleyLoadLimitKg,
    selected,
    autoSuggested: suitable,
    capacityPass,
    speedPass,
    complete,
    pass: capacityPass === null ? null : capacityPass && speedPass !== false,
  };
}

export function festoonSeriesLabel(series: FestoonSeriesData | null): string {
  if (!series) return "Uygun katalog serisi bulunamadı";
  return `${series.series} · ${series.line}`;
}
