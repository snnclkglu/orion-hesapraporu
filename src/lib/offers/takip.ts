// TEKLİF TAKİBİ — "gönderdim, ne kadar oldu?"
//
// Kullanıcı isteği (17.08.2026): *"Bu tarihten kaç gün hafta geçtiyse yanında
// yazsın. 14 güne kadar gün, 14 günden sonra hafta saysın, bu sarı renkten
// kırmızıya doğru gitsin büyüdükçe, bana uyarı gibi olur çok süre geçtiyse
// müşteriyi arıyorum takip ediyorum."*
//
// SAYAÇ BİR UYARIDIR, BİR SÜRE SINIRI DEĞİL. Teklifin kendi geçerlilik süresi
// (14 iş günü) belgenin bir maddesidir ve bu sayaçla KARIŞTIRILMAZ: buradaki
// rakam "müşteriyi aramanın zamanı geldi mi" sorusunu cevaplar, teklifin
// geçerliliğini değil.
//
// BİRİM DEĞİŞTİRME EŞİĞİ 14 GÜNDÜR ve bu keyfî değil kullanıcının kendi
// çalışma ritmidir: ilk iki hafta gün gün takip edilir, sonrası hafta olarak
// konuşulur ("üç haftadır cevap yok").

/** Sayacın renk ve vurgu düzeyi — 0 taze, 4 en geç kalmış. */
export type TakipSeviye = 0 | 1 | 2 | 3 | 4;

export interface TakipYasi {
  /** Gönderimden bu yana geçen tam gün. */
  gun: number;
  /** Ekranda basılan metin: "3 gün" · "6 hafta". */
  etiket: string;
  seviye: TakipSeviye;
  /** OKLCH ton açısı — sarıdan kırmızıya (bkz. `takipTonu`). */
  hue: number;
}

/** Gün cinsinden fark; ikisi de ISO tarih (YYYY-MM-DD). */
export function gunFarki(baslangicIso: string, bitisIso: string): number {
  const a = Date.parse(`${baslangicIso.slice(0, 10)}T00:00:00Z`);
  const b = Date.parse(`${bitisIso.slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}

/**
 * RENK BİR AÇIDIR, HEX DEĞİL (değişmez md. 6).
 *
 * Sarı (75°) → kırmızı (20°) arasında doğrusal iner ve 60 GÜNDE dibe vurur:
 * daha uzun bir ölçek, ilk haftalardaki farkı gözle ayırt edilemez yapardı —
 * oysa asıl karar orada veriliyor. Doygunluk ve parlaklık `.oc-tag` kuralında,
 * tema başına ayrı verilir; buradan yalnız ton geçer.
 */
export function takipTonu(gun: number): number {
  const SARI = 75;
  const KIRMIZI = 20;
  const DIP = 60;
  if (gun <= 0) return SARI;
  if (gun >= DIP) return KIRMIZI;
  return Math.round(SARI - ((SARI - KIRMIZI) * gun) / DIP);
}

function seviyeOf(gun: number): TakipSeviye {
  if (gun < 7) return 0;
  if (gun < 14) return 1;
  if (gun < 28) return 2;
  if (gun < 56) return 3;
  return 4;
}

/**
 * Metin: 14 güne kadar GÜN, sonrası HAFTA.
 *
 * Hafta AŞAĞI yuvarlanır: 20 gün "3 hafta" değil "2 hafta"dır. Yukarı
 * yuvarlamak, geçmemiş bir haftayı geçmiş göstermek olurdu ve bu sayacın tek
 * işi doğru bir aciliyet duygusu vermektir.
 */
export function takipEtiketi(gun: number): string {
  if (gun <= 0) return "bugün";
  if (gun <= 14) return `${gun} gün`;
  return `${Math.floor(gun / 7)} hafta`;
}

export function takipYasi(gonderimIso: string, bugunIso: string): TakipYasi {
  const gun = Math.max(0, gunFarki(gonderimIso, bugunIso));
  return { gun, etiket: takipEtiketi(gun), seviye: seviyeOf(gun), hue: takipTonu(gun) };
}

/**
 * Sayaç HANGİ TEKLİFLERDE görünür.
 *
 * Yalnız GÖNDERİLMİŞ ve HENÜZ SONUÇLANMAMIŞ tekliflerde. Kazanılmış bir
 * teklifin üstünde "8 hafta" yazması bir uyarı değil bir gürültüdür — takip
 * edilecek bir şey kalmamıştır. Hiç yayımlanmamış taslakta da yoktur: sayaç
 * müşteriye gönderimden sayar, masada geçen süreden değil.
 */
export function takipGorunur(status: string, issuedOn: string | null | undefined): boolean {
  return Boolean(issuedOn) && (status === "sent" || status === "draft");
}
