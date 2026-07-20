// Uygulama ayarları (app_settings tablosu) — panelden düzenlenebilir.
// Okuyucular her zaman DEFAULT_REPORT_SETTINGS ile birleştirir; tablo boşsa
// uygulama varsayılanlarla çalışır.

import type { SupabaseClient } from "@supabase/supabase-js";

export interface ReportSettings {
  company: string;
  city: string;
  title_tr: string;
  title_en: string;
  default_crane_type: string;
  /** Rapor altbilgisi — kurumsal iletişim (opsiyonel) */
  address?: string;
  phone?: string;
  email?: string;
  web?: string;
}

export const DEFAULT_REPORT_SETTINGS: ReportSettings = {
  company: "ORION CRANES",
  city: "ANKARA · TÜRKİYE",
  title_tr: "HESAP RAPORU",
  title_en: "DESIGN CALCULATION REPORT",
  default_crane_type: "Çift Kirişli Gezer Köprülü Vinç",
  address: "",
  phone: "",
  email: "",
  web: "orioncranes.com",
};

export async function getReportSettings(
  supabase: SupabaseClient
): Promise<ReportSettings> {
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "report")
    .maybeSingle();
  return { ...DEFAULT_REPORT_SETTINGS, ...((data?.value as Partial<ReportSettings>) ?? {}) };
}
