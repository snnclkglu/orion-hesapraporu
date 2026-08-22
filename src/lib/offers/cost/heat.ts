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
