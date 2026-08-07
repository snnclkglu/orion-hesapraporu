// I-kiriş festoon ön seçimi.
//
// Kaynak: Conductix-Wampfler KAT0320-0003-EN, Program 0314 / 0320 / 0325 /
// 0330. Katalog her aile için taşıyıcı başına izin verilen yükü ve en yüksek
// hızı verir. Bu yardımcı, aile seviyesinde seçimi doğrular; kesin parça kodu
// için I-kiriş flanş ölçüsü ile kablo paket geometrisi ayrıca doğrulanmalıdır.

import type { FestoonCableForm, FestoonSeries, FestoonSpec, TechnicalSpecs } from "./types";

export interface FestoonSeriesData {
  series: Exclude<FestoonSeries, "auto">;
  line: "S-Line" | "M-Line";
  maxTrolleyLoadKg: number;
  maxSpeedMpm: number;
}

export const FESTOON_SERIES: readonly FestoonSeriesData[] = [
  { series: "0314", line: "S-Line", maxTrolleyLoadKg: 20, maxSpeedMpm: 50 },
  { series: "0320", line: "M-Line", maxTrolleyLoadKg: 80, maxSpeedMpm: 100 },
  { series: "0325", line: "M-Line", maxTrolleyLoadKg: 125, maxSpeedMpm: 120 },
  { series: "0330", line: "M-Line", maxTrolleyLoadKg: 200, maxSpeedMpm: 150 },
] as const;

export const FESTOON_SERIES_OPTIONS = ["auto", ...FESTOON_SERIES.map((x) => x.series)] as const;

export const FESTOON_SERIES_LABELS: Record<FestoonSeries, string> = {
  auto: "Otomatik — en küçük uygun seri",
  "0314": "0314 · S-Line · 20 kg / 50 m/dak",
  "0320": "0320 · M-Line · 80 kg / 100 m/dak",
  "0325": "0325 · M-Line · 125 kg / 120 m/dak",
  "0330": "0330 · M-Line · 200 kg / 150 m/dak",
};

export const FESTOON_CABLE_FORMS: readonly FestoonCableForm[] = ["flat", "round"] as const;

export const FESTOON_CABLE_FORM_LABELS: Record<FestoonCableForm, string> = {
  flat: "Yassı kablo",
  round: "Yuvarlak kablo",
};

export const DEFAULT_FESTOON_SPEC: FestoonSpec = {
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
  travelDistanceM: number;
  travelSpeedMpm: number;
  trolleyCount: number;
  cablePackageWeightKg: number;
  loadPerTrolleyKg: number | null;
  selected: FestoonSeriesData | null;
  autoSuggested: FestoonSeriesData | null;
  capacityPass: boolean | null;
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

/**
 * Katalog ailesi ön seçimi. Ağırlık, seçilmiş taşıyıcı adedine eşit dağıtılır;
 * bu bir seçim kontrolüdür, kablo sarkması/askı yerleşimi hesabı değildir.
 */
export function selectFestoon(
  spec: FestoonSpec | null | undefined,
  travelDistanceM: number | undefined,
  travelSpeedMpm: number | undefined
): FestoonSelectionResult {
  const trolleyCount = count(spec?.trolleyCount);
  const cablePackageWeightKg = finiteNonNegative(spec?.cablePackageWeightKg);
  const speed = finiteNonNegative(travelSpeedMpm);
  const loadPerTrolleyKg = trolleyCount > 0 ? cablePackageWeightKg / trolleyCount : null;
  const complete = trolleyCount > 0 && cablePackageWeightKg > 0;
  const suitable = complete && loadPerTrolleyKg !== null
    ? FESTOON_SERIES.find(
        (row) => row.maxTrolleyLoadKg >= loadPerTrolleyKg && row.maxSpeedMpm >= speed
      ) ?? null
    : null;
  const selected = spec?.series && spec.series !== "auto"
    ? FESTOON_SERIES.find((row) => row.series === spec.series) ?? null
    : suitable;
  const capacityPass = complete && selected && loadPerTrolleyKg !== null
    ? loadPerTrolleyKg <= selected.maxTrolleyLoadKg
    : null;
  const speedPass = complete && selected
    ? speed <= selected.maxSpeedMpm
    : null;

  return {
    travelDistanceM: finiteNonNegative(travelDistanceM),
    travelSpeedMpm: speed,
    trolleyCount,
    cablePackageWeightKg,
    loadPerTrolleyKg,
    selected,
    autoSuggested: suitable,
    capacityPass,
    speedPass,
    complete,
    pass: capacityPass === null || speedPass === null ? null : capacityPass && speedPass,
  };
}

export function festoonSeriesLabel(series: FestoonSeriesData | null): string {
  if (!series) return "Uygun katalog serisi bulunamadı";
  return `${series.series} · ${series.line}`;
}
