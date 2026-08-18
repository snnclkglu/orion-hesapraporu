// TEKLİF METNİNDEN SAYI OKUMA — maliyetin tek ayrıştırıcısı.
//
// Kullanıcı isteği (18.08.2026, md. 1): *"Tabi teklifte istenen kaldırma
// hızına göre otomatik hızı ayarlasın."* O cümlenin çalışabilmesi için önce
// teklifte YAZAN sayının okunabilmesi gerekiyor ve bu, sanıldığından zordu.
//
// `lib/drawings`in `trSayi`si BU İŞİ GÖRMEZ ve değiştirilemez (başka
// modüllerin çekirdeğidir, değişmez md. 7). Ölçüldü:
//
//     trSayi("1-6")     → null      ← teklifte hızlar ARALIKLA yazılır
//     trSayi("20 - 30") → null
//     trSayi("4/1")     → 41        ← bölü işaretini siler, iki sayıyı birleştirir
//
// Sonuç sessiz ve ağırdı: aralıkla yazılmış bir kaldırma hızı `null` düşüyor,
// `inputs.liftSpeedMpm` boş kalıyor ve KALDIRMA MEKANİZMASININ TAMAMI
// (halat hızı → tahvil → motor momenti → hesap gücü → SEÇİLEN MOTOR → sürücü)
// hiç hesaplanmıyordu. Ekranda yalnız "—" görünüyordu; hangi girdinin
// eksikliğinden olduğu ancak `eksik` cümlesinden anlaşılıyordu.
//
// AYRI DOSYADIR ÇÜNKÜ İKİ TARAF DA OKUR: `payload.ts` girdileri teklifden
// doldururken, `compare.ts` şeridi çizerken. `compare.ts` zaten `payload.ts`ten
// `travelGroupKey` alıyor; tersine bir bağ DÖNGÜ kurardı.

/**
 * Metindeki bütün sayıları çıkarır — Türkçe yazımla.
 *
 * Nokta BİNLİK, virgül ONDALIK ayracıdır ("1.500" bin beş yüz, "5,5" beş
 * buçuk). Aralıklar ("1-6", "20 - 30") iki ayrı sayı verir; çağıran hangisini
 * istediğini kendi söyler.
 */
export function costNumbersIn(text: string | null | undefined): number[] {
  if (!text) return [];
  const parcalar = text.match(/\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:,\d+)?/g) ?? [];
  const out: number[] = [];
  for (const p of parcalar) {
    const n = Number(p.replace(/\./g, "").replace(",", "."));
    if (Number.isFinite(n)) out.push(n);
  }
  return out;
}

/**
 * ARALIĞIN ÜST UCU — "istenen" sayı.
 *
 * "1-6 m/dk" yazan bir teklifte vincin karşılaması gereken hız 6'dır; alt uç
 * ağır yükteki yavaş kademedir. Alt ucu almak, kapasitesi yetmeyen bir motoru
 * "uygun" göstermenin en kısa yoluydu.
 */
export function costUpperBound(text: string | null | undefined): number | null {
  const sayilar = costNumbersIn(text);
  return sayilar.length ? Math.max(...sayilar) : null;
}

/** İLK SAYI — halat donanımında ("4/1" → 4 kat) ve tekil değerlerde. */
export function costFirstNumber(text: string | null | undefined): number | null {
  const sayilar = costNumbersIn(text);
  return sayilar.length ? sayilar[0] : null;
}
