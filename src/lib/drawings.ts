// Teknik çizim takibi — kategori öntanımları ve durum etiketleri.
// Kategoriler app_settings 'drawing_categories' anahtarından okunur
// (Google Drive klasör deseni); tablo boşsa uygulama varsayılanları kullanılır.

import type { SupabaseClient } from "@supabase/supabase-js";

export const DEFAULT_DRAWING_CATEGORIES: string[] = [
  "KÖPRÜ YÜRÜTME GRUBU",
  "TAŞIYICI AYAKLAR",
  "MERDİVEN PLATFORM",
  "FESTON HATTI",
  "KST YERLEŞİMİ",
  "PANO-BAZA VE MUHAFAZA",
  "ARABA KOMPLE",
  "ARABA YÜRÜTME",
  "ARABA ŞASE",
  "TAMBUR",
  "TAMBUR TAHRİK GRUBU",
  "ÜST MAKARA",
  "DENGE TRAVERSİ",
  "ARABA PLATFORM",
  "KANCA BLOĞU",
  "ARABA MUHAFAZA",
  "SPREADER BEAM",
  "ANA KİRİŞ",
  "BAŞKİRİŞ",
  "GENEL GÖRÜNÜŞ",
  "DİĞER",
];

export type DrawingStatus = "draft" | "checking" | "approved";

export const DRAWING_STATUSES: { value: DrawingStatus; label: string }[] = [
  { value: "draft", label: "Taslak" },
  { value: "checking", label: "Kontrolde" },
  { value: "approved", label: "Onaylı" },
];

export const DRAWING_STATUS_LABELS: Record<DrawingStatus, string> = {
  draft: "Taslak",
  checking: "Kontrolde",
  approved: "Onaylı",
};

export async function getDrawingCategories(
  supabase: SupabaseClient
): Promise<string[]> {
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "drawing_categories")
    .maybeSingle();
  const list = Array.isArray(data?.value)
    ? (data.value as unknown[]).filter((v): v is string => typeof v === "string")
    : [];
  return list.length > 0 ? list : DEFAULT_DRAWING_CATEGORIES;
}
