// TUTAR ISISI — bir sayının BÜYÜKLÜĞÜNÜ renge çeviren tek kural.
//
// Kullanıcı isteği (22.08.2026, md. 14): *"Maliyet kalemlerinde Tutar kısmı
// büyükse kırmızı küçükse sarı olsun. Gözle yüksek değerli kalemi
// anlayabileyim. Sarıdan kırmızıya renk skalası gibi yaparsın."*
//
// SAF ÇEKİRDEK (değişmez md. 7): burada renk YOKTUR, yalnız 0–1 arası bir
// SEVİYE üretilir. Ton, doygunluk ve parlaklık `globals.css`teki `.oc-amount`
// kuralındadır ve tema başına verilir — `.oc-heat` ve `.oc-tag` ile aynı
// sözleşme (değişmez md. 6: renk hex değil açıdır).

/**
 * TABAN: BELGENİN EN BÜYÜK GÖRÜNEN SATIRI.
 *
 * Üç aday tartıldı:
 *
 * - **Grubun kendi toplamı** — grup içinde "hangi kalem baskın" hemen okunur
 *   ama 500 €'luk bir grubun en büyük satırı, 70.000 €'luk grubunkiyle AYNI
 *   kırmızıyı alır. Kullanıcının sorusu "bu belgede para nereye gidiyor";
 *   grup içi bir ölçek o soruya yanlış cevap verir.
 * - **Mutlak eşik** (ör. 0–50.000 €) — uydurma bir sayıdır (değişmez md. 4)
 *   ve para birimi değiştiğinde anlamsız kalır.
 * - **Belgenin en büyüğü** — "kırmızı = bu belgenin en pahalı kalemi" cümlesi
 *   literal olarak doğrudur. SEÇİLEN BUDUR.
 *
 * ALT UÇ SIFIRDIR, en küçük satır DEĞİL. En küçüğü tabana almak, 12 €'luk bir
 * cıvata satırını "sarı-sıcak" gösterirdi (`personnel/salary-plan.ts`in ölçek
 * kararının aynı gerekçesi).
 */

/**
 * Tutarın ısı seviyesi (0–1); renk verilemiyorsa `null`.
 *
 * `null` DÖNMEK ANLAMLIDIR: miktarı ya da fiyatı girilmemiş satırın tutarı
 * `null`dur ve ekranda "—" görünür. Ona "en soğuk" rengi vermek, BİLİNMEYENİ
 * "küçük" diye göstermek olurdu (değişmez md. 4).
 *
 * KAREKÖK BİR HESAP DEĞİL, BİR SUNUM RAMPASIDIR. Maliyet satırlarının
 * dağılımı ağır kuyrukludur: ASTOR fikstüründe 56 görünür satırın en büyüğü
 * 70.125 €, ortancası 716 €. Doğrusal ölçekte 8.925 €'luk bir satır t = 0,127
 * ile hâlâ sarı görünür ve satırların ellisi birbirinden ayırt edilemez.
 * Karekök o kuyruğu açar: 8.925 € → t = 0,357, yani 716 €'luk satırdan
 * (t = 0,101) gözle ayrılır.
 */
export function costAmountLevel(amount: number | null, largest: number): number | null {
  if (amount === null || !Number.isFinite(amount)) return null;
  if (!Number.isFinite(largest) || largest <= 0) return null;
  if (amount <= 0) return 0;
  return Math.min(1, Math.sqrt(amount / largest));
}

/**
 * Belgedeki EN BÜYÜK satır tutarı — ölçeğin tabanı.
 *
 * BİR KEZ hesaplanır ve aşağı geçirilir. Her tablonun kendi tabanını bulması
 * grup içi bir ölçek demekti (yukarıdaki gerekçe) ve ayrıca aynı sayının
 * belgenin iki yerinde iki farklı renk alması demekti.
 */
export function costLargestAmount(amounts: readonly (number | null)[]): number {
  let en = 0;
  for (const t of amounts) {
    if (t === null || !Number.isFinite(t)) continue;
    if (t > en) en = t;
  }
  return en;
}

/**
 * ISI SEVİYESİNİN KALINLIK KARŞILIĞI — renk TEK TAŞIYICI OLAMAZ (WCAG 1.4.1).
 *
 * Depo bu kuralı iki yerde zaten yazıyor (`globals.css`in `.oc-row-hue` ve
 * `.oc-fieldgroup` yorumları): renkle verilen her ayrım ayrıca renksiz bir
 * işaret taşır. Burada o işaret yazının kalınlığıdır — renk körlüğünde de,
 * siyah beyaz bir çıktıda da okunur.
 *
 * EŞİKLER ÖLÇÜLDÜ, seçilmedi: ASTOR fikstürünün 56 görünür satırında
 * t ≥ 0,45 → 6 satır (belgenin parasının %71'i), t ≥ 0,75 → 2 satır (%56).
 * Yani "kalın" gerçekten seyrek kalır; her satırı kalınlaştıran bir eşik
 * hiçbir şey söylemezdi.
 */
export function costAmountWeight(level: number | null): "" | "font-medium" | "font-semibold" {
  if (level === null) return "";
  if (level >= 0.75) return "font-semibold";
  if (level >= 0.45) return "font-medium";
  return "";
}

// ————————————————————————————————————— belgedeki karşılığı (PDF · Excel)

/**
 * `.oc-amount` RAMPASININ KATSAYILARI — `globals.css` ile BİREBİR.
 *
 * Kullanıcı isteği (23.08.2026, md. 4): *"İndirilen teklif maliyet pdf ve
 * excellerde de renklendirme kullan."* Ekran rengi bir CSS değişkeniyle
 * verilir (`--oc-level`); @react-pdf ve exceljs ise CSS okumaz, HAZIR bir renk
 * ister. Rampanın sayıları bu yüzden burada da durmak zorundadır.
 *
 * İKİ YERDE YAŞAYAN BİR KURAL BİR TESTLE KİLİTLENİR (değişmez md. 8):
 * `__tests__/heat.test.ts` `globals.css`i OKUYUP bu sayılarla karşılaştırır.
 * Kopya sessizce ayrışırsa ekran bir rengi, belge başkasını gösterirdi ve
 * kusur ancak ikisi yan yana konunca görülürdü.
 *
 * AÇIK TEMANIN ŞERİDİ KULLANILIR ve bu bilinçlidir: hem PDF hem Excel BEYAZ
 * kâğıdın karşılığıdır; koyu tema şeridi orada okunmaz.
 */
export const COST_HEAT_RAMP = {
  /** L: 0,58 → 0,48. Sarı uçta 0,58'i geçmez (WCAG AA, `.oc-amount` yorumu). */
  lightness: { base: 0.58, span: -0.1 },
  /** C: 0,07 → 0,16. */
  chroma: { base: 0.07, span: 0.09 },
  /** H: 95° (sarı) → 25° (kiremit kırmızısı). */
  hue: { base: 95, span: -70 },
} as const;

/** Isı seviyesinin OKLCH karşılığı — ekrandaki `.oc-amount` ile aynı sayı. */
export function costHeatOklch(level: number): { l: number; c: number; h: number } {
  const t = Math.min(1, Math.max(0, level));
  return {
    l: COST_HEAT_RAMP.lightness.base + COST_HEAT_RAMP.lightness.span * t,
    c: COST_HEAT_RAMP.chroma.base + COST_HEAT_RAMP.chroma.span * t,
    h: COST_HEAT_RAMP.hue.base + COST_HEAT_RAMP.hue.span * t,
  };
}

/** sRGB gama eğrisi — doğrusal kanaldan 0–255 bileşene. */
function gama(v: number): number {
  const s = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
  return Math.round(Math.min(1, Math.max(0, s)) * 255);
}

/**
 * OKLCH → `#RRGGBB`.
 *
 * Dönüşüm Björn Ottosson'un Oklab tanımıdır (oklch → oklab → LMS → doğrusal
 * sRGB → gama). Bir tabloya bakarak sabit hex yazmak daha kısa olurdu ve
 * değişmez md. 6'yı kırardı: renk bir AÇIDIR; hex yalnız ÇIKTININ biçimidir ve
 * o çıktı burada, tek yerde üretilir.
 *
 * GAMUT DIŞI DEĞER KIRPILIR: rampanın uçları sRGB içindedir (ölçüldü), ama
 * kırpma yine de yazılır — dışarı taşan bir kanal `NaN` değil, en yakın basılı
 * renk vermelidir.
 */
export function oklchToHex(l: number, c: number, hDeg: number): string {
  const h = (hDeg * Math.PI) / 180;
  const a = c * Math.cos(h);
  const b = c * Math.sin(h);

  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;

  const L = l_ * l_ * l_;
  const M = m_ * m_ * m_;
  const S = s_ * s_ * s_;

  const r = 4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S;
  const g = -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S;
  const bl = -0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S;

  const hex = (n: number) => n.toString(16).padStart(2, "0");
  return `#${hex(gama(r))}${hex(gama(g))}${hex(gama(bl))}`.toUpperCase();
}

/**
 * Tutarın (ya da ağırlığın) BELGEDEKİ rengi — renk verilemiyorsa `null`.
 *
 * `null` DÖNMEK ANLAMLIDIR (`costAmountLevel` ile aynı gerekçe): girilmemiş bir
 * sayı "—"dir ve ona "en soğuk" rengi vermek BİLİNMEYENİ küçük göstermek
 * olurdu. Çağıran taraf `null`da kendi varsayılan mürekkebini kullanır.
 */
export function costHeatHex(amount: number | null, largest: number): string | null {
  const t = costAmountLevel(amount, largest);
  if (t === null) return null;
  const { l, c, h } = costHeatOklch(t);
  return oklchToHex(l, c, h);
}

/** Excel ARGB — alfa ÖNDE ve tam opak; `#RRGGBB` doğrudan yapıştırılamaz. */
export function costHeatArgb(amount: number | null, largest: number): string | null {
  const hex = costHeatHex(amount, largest);
  return hex === null ? null : `FF${hex.slice(1)}`;
}
