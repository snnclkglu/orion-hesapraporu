// SATIN ALMANIN KUR REFERANSI — saf çekirdek (DB/HTTP yok).
//
// Kullanıcı kararı (13.08.2026): *"Satın alma teklif girme ve sipariş girme
// pop-up'larında Euro veya USD kuru otomatik gelemez mi? Zaten uygulamada
// personel bölümünde kurları çekmiştik. Referans olarak en yakın tarih son kur
// fiyatı gelsin. Kullanıcı isterse yine değiştirebilsin."*
//
// ————————————————————————————————————— NEDEN AYRI BİR DÖNÜŞÜM GEREKİYOR
//
// `fx_rate_daily` kurları TL CİNSİNDEN tutar (1 USD = x TL, 1 EUR = y TL) —
// TCMB'nin yayımladığı biçim budur. Satın almanın sözleşmesi ise BAŞKADIR
// (AGENTS md. 21): `fx_rate` = **1 avro kaç BİRİM eder**. İkisi karıştırılırsa
// dolarlık bir teklifin avro karşılığı 1000 kat yanlış çıkar ve en ucuz teklif
// olarak yarışı kazanır.
//
//     EUR → 1                      (avro satırında kur her zaman 1)
//     TRY → eur_try                (1 avro kaç lira)
//     USD → eur_try / usd_try      (parite; 1 avro kaç dolar)
//
// PARİTE BÖLMEYLE BULUNUR ve bu burada DOĞRUDUR: `fx/rates.ts`teki
// "parite gün gün ortalanır" kuralı AYLIK ORTALAMA içindir — orada
// `avg(EUR/USD) ≠ avg(EUR/TRY)/avg(USD/TRY)`. Burada tek bir GÜNÜN iki kuru
// bölünüyor, yani ortalama alınmıyor; aynı günün iki değeri arasındaki oran
// tanım gereği o günün paritesidir.
//
// KUR BİR ÖNERİDİR, BİR KİLİT DEĞİL. Ekran alanı doldurur ve kaynağını yazar;
// kullanıcı sözleşmedeki kuru biliyorsa üstüne yazar. Sipariş kuru satırın
// KENDİNDE saklanır (md. 21) — bu yüzden buradan gelen değer bir varsayılan,
// bir bağ değildir.

/** `fx_rate_daily`nin bu modüle giren yüzü. */
export interface GunlukKur {
  /** Kurun ait olduğu gün (ISO). */
  rateDate: string;
  usdTry: number;
  eurTry: number;
}

export interface KurOnerisi {
  /** `fx_rate` alanına yazılacak sayı — 1 avro kaç birim eder. */
  kur: number;
  /** Kurun günü; ekran "13.08.2026 TCMB" diye yazar. */
  gun: string;
  /** Kaç gün eski? Bugünse 0. Ekran bayatlığı buradan söyler. */
  yas: number;
}

/**
 * Para birimi için kur önerisi. Kaynak yoksa ya da sayı bozuksa `null`.
 *
 * `null` DÖNMEK SESSİZ BİR 1'DEN İYİDİR: kuru olmayan fiyat `null` avro üretir
 * ve ekran onu ayrıca sayar (md. 21). Uydurulmuş bir 1, dolarlık bir teklifi
 * avroymuş gibi gösterirdi.
 */
export function kurOnerisi(
  paraBirimi: string,
  son: GunlukKur | null | undefined,
  bugun?: string
): KurOnerisi | null {
  const birim = (paraBirimi || "").toUpperCase();
  if (birim === "EUR") return { kur: 1, gun: son?.rateDate ?? "", yas: 0 };
  if (!son) return null;

  const eurTry = Number(son.eurTry);
  const usdTry = Number(son.usdTry);
  if (!Number.isFinite(eurTry) || eurTry <= 0) return null;

  let kur: number | null = null;
  if (birim === "TRY") kur = eurTry;
  else if (birim === "USD") {
    if (!Number.isFinite(usdTry) || usdTry <= 0) return null;
    kur = eurTry / usdTry;
  }
  if (kur == null || !Number.isFinite(kur) || kur <= 0) return null;

  return { kur, gun: son.rateDate, yas: gunFarkiKisa(son.rateDate, bugun) };
}

/** İki ISO gün arası fark (gün). Okunamazsa 0 — bayatlık uyarısı susar. */
function gunFarkiKisa(gun: string, bugun?: string): number {
  const a = Date.parse(`${gun}T00:00:00Z`);
  const b = Date.parse(`${bugun ?? new Date().toISOString().slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.max(0, Math.round((b - a) / 86400000));
}

/**
 * Kur kutusuna yazılacak metin.
 *
 * BASAMAK PARA BİRİMİNE GÖRE: lira kuru 4 basamak yazılır (35,0305), parite de
 * 4 basamak ister (1,0842) — üç basamak paritede gerçek bir yuvarlama hatası
 * üretir. Sayı `toFixed` ile değil `parseFloat` ile kısaltılır ki sondaki
 * gereksiz sıfırlar kutuda durmasın.
 */
export function kurMetni(kur: number): string {
  return String(parseFloat(kur.toFixed(4)));
}
