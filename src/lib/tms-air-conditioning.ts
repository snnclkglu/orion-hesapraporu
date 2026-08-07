// TMS'nin kamuya açık seri sayfalarından derlenen iklimlendirme tipleri.
// Bu liste kapasite hesabı değildir: nihai kapasite; ısı yükü, dış ortam,
// montaj ve bakım erişimine göre TMS ile proje bazında doğrulanır.

import type { AirConditioningType } from "@/lib/calc/types";

export interface TmsAirConditionerModel {
  model: string;
  series: string;
  application: AirConditioningType;
  capacity: string;
  operatingRange: string;
  sourceUrl: string;
}

export const AIR_CONDITIONING_TYPE_OPTIONS = [
  "none", "standard", "panel", "industrial", "heavyIndustrial",
] as const;

export const AIR_CONDITIONING_TYPE_LABELS: Record<AirConditioningType, string> = {
  none: "Yok",
  standard: "Standart Klima",
  panel: "Pano Kliması",
  industrial: "Endüstriyel Klima",
  heavyIndustrial: "Ağır Hizmet Tipi Endüstriyel Klima",
};

export const TMS_AIR_CONDITIONER_MODELS: readonly TmsAirConditionerModel[] = [
  { model: "PKS-PO", series: "PKS Serisi", application: "panel", capacity: "2–4 kW", operatingRange: "-10…+80 °C", sourceUrl: "https://tmsgrup.com/tr/pks-serisi/" },
  { model: "WMU", series: "WMU Serisi", application: "industrial", capacity: "8–100 kW", operatingRange: "Proje bazında", sourceUrl: "https://tmsgrup.com/tr/wmu-serisi/" },
  { model: "VKS-VM", series: "VKS Serisi — Orta Hizmet Tipi", application: "industrial", capacity: "2–8 kW", operatingRange: "-15…+80 °C", sourceUrl: "https://tmsgrup.com/tr/vks-serisi/" },
  { model: "VKS-VC", series: "VKS Serisi — Kompakt Tip", application: "heavyIndustrial", capacity: "2–8 kW", operatingRange: "+95 °C üst ortam sınırı", sourceUrl: "https://tmsgrup.com/tr/vks-serisi/" },
  { model: "VKS-VP", series: "VKS Serisi — Paket / Monoblok Tip", application: "heavyIndustrial", capacity: "2,5–28 kW", operatingRange: "+95 °C üst ortam sınırı", sourceUrl: "https://tmsgrup.com/tr/vks-serisi/" },
  { model: "VKS-VS", series: "VKS Serisi — Split Tip", application: "heavyIndustrial", capacity: "2,5–48 kW", operatingRange: "+95 °C üst ortam sınırı", sourceUrl: "https://tmsgrup.com/tr/vks-serisi/" },
] as const;

export function airConditionerModelsFor(type: AirConditioningType | undefined): readonly TmsAirConditionerModel[] {
  return TMS_AIR_CONDITIONER_MODELS.filter((model) => model.application === type);
}

/** Seçilen tip için teknik özellik formunda gösterilecek katalog seçenekleri. */
export function airConditionerModelOptions(type: AirConditioningType | undefined): string[] {
  if (type === "standard") return ["Projeye özel seçim"];
  return airConditionerModelsFor(type).map((model) => model.model);
}

export function tmsAirConditionerModel(model: string | undefined): TmsAirConditionerModel | undefined {
  return TMS_AIR_CONDITIONER_MODELS.find((item) => item.model === model);
}
