// TEKLİF BELGESİNİN DİLİ — tek tanım yeri.
//
// Dil teklif numarasının İÇİNDEDİR (`TETR-…` / `TEEN-…`) ve bu yüzden bir
// sunum tercihi değil bir KAYIT alanıdır: sonradan eklenseydi yayımlanmış
// numaraları yeniden yorumlamak gerekirdi.
//
// BUGÜN YALNIZ TÜRKÇE ÜRETİLİR (kullanıcı kararı: *"En sonunda ingilizce
// türkçe seçeneğin de ekleyeceğiz ama başlangıç olarak sadece TR yapalım."*).
// `en` değeri şemada ve tiplerde vardır, seçici onu bugün göstermez —
// yarım bir çeviri, yanlış bir belge demektir.

export const OFFER_LANGS = ["tr", "en"] as const;

export type OfferLang = (typeof OFFER_LANGS)[number];

export const OFFER_LANG_LABELS: Record<OfferLang, string> = {
  tr: "Türkçe",
  en: "İngilizce",
};

/** Bugün seçilebilen diller — tek maddelik liste bilinçlidir. */
export const OFFER_LANGS_ACTIVE: readonly OfferLang[] = ["tr"];

export function offerLangOf(value: string | null | undefined): OfferLang {
  return (OFFER_LANGS as readonly string[]).includes(value ?? "")
    ? (value as OfferLang)
    : "tr";
}

export function offerLangLabel(value: string | null | undefined): string {
  return OFFER_LANG_LABELS[offerLangOf(value)];
}
