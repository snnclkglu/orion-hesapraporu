// MARKA PALETİ VE ÖLÇÜ YARDIMCILARI — SAF (fs yok, React yok, server-only yok).
//
// NEDEN AYRI DOSYA: `pdf/brand.tsx` `node:fs` ile font ve logo okur, yani
// YALNIZ SUNUCUDA çalışır. El kitabı editöründeki KÂĞIT ÖNİZLEMESİ ise bir
// istemci bileşenidir ve belgeyle AYNI renkleri kullanmak zorundadır —
// ekranda gördüğü kırmızı ile bastığı kırmızı ayrışırsa önizleme yalan söyler.
//
// İkinci bir palet yazmak, bir gün ikisinin ayrışması demekti (değişmez md. 8:
// "bir kural iki yerde yaşıyorsa ayrışmayı bir test engeller"). Burada tek
// tanım vardır; `brand.tsx` onu YENİDEN DIŞA AKTARIR, kopyalamaz.
//
// Değerler Marka Kimliği Kılavuzu REV 01 · 2026'dan ve
// `design-system/tokens/colors.css` ile BİREBİRDİR.

/** mm → pt (react-pdf point kullanır; CSS önizlemesinde 1 pt = 1 px). */
export const mm = (n: number): number => n * 2.834645669;

/** Marka renkleri (tokens/colors.css ile birebir) */
export const BRAND = {
  red: "#A41E1E",
  redDeep: "#7D1717",
  redPale: "#F1C9C7",
  ink: "#262626",
  inkDeep: "#211F1D",
  /** Kömür zemin üzerindeki HAYALET işaret — çapraz şerit dokusunun çizgisi. */
  inkGhost: "#2F2E2C",
  /** Kömür zemin üzerindeki kıl çizgi — vurgusuz bölüm ayracı. */
  inkLine: "#3A3633",
  /** Mercan — YALNIZ kömür zemin üzerinde kicker rengi (kılavuz: dijital vurgu). */
  coral: "#E8736F",
  steel: "#1F5C7A",
  slate: "#37474F",
  paper50: "#FAF8F7",
  paper100: "#F4F1EF",
  paper150: "#F1EEEC",
  paper200: "#E7E4E2",
  hairline: "#EDEAE8",
  line300: "#DCD9D7",
  line350: "#C6C2BF",
  gray400: "#B8B2AE",
  gray450: "#9A9591",
  gray500: "#8A8480",
  gray600: "#6B6663",
  gray700: "#48433F",
  white: "#FFFFFF",
  success: "#1F8A5B",
} as const;

/** A4 sayfa anatomisi (kılavuz: 8mm omurga, 16/16/14/11mm marjlar) */
export const PAGE = {
  spine: mm(8),
  marginTop: mm(16),
  marginOuter: mm(16),
  marginInner: mm(14),
  marginBottom: mm(13),
  /** İçerik alanı sol kenarı = omurga + iç marj */
  contentLeft: mm(8) + mm(14),
} as const;

/**
 * Türkçe büyük harf. @react-pdf'in `textTransform: "uppercase"` uygulaması
 * locale'siz `toUpperCase()` çağırır; bu da "i" harfini "I" yapar
 * ("Müşteri Bilgileri" → "MÜŞTERI BILGILERI"). Bu yüzden PDF şablonlarında
 * `textTransform` KULLANILMAZ, metin çağrı yerinde bu yardımcıyla büyütülür.
 * Önizleme de aynı dönüşümü yapar — CSS `text-transform` orada da "i"yi
 * bozardı.
 */
export function trUpper(text: string): string {
  return text.toLocaleUpperCase("tr-TR");
}
