// TEKNİK SATIRIN BÜYÜK HARFİ — etiket ve değer için AYRI kurallar.
//
// Kullanıcı isteği (19.08.2026, md. 18): *"Teklifteki Özellikleri yazılarının
// ve detaylarının tamamı büyük harf olsa daha profesyonel durur."*
//
// DÜZ BİR `toUpperCase()` BU BELGEDE ÜÇ AYRI ŞEYİ BOZAR ve üçü de mühendislik
// belgesinde yazım hatasıdır:
//   1. Türkçe "i" → "I" ("Vinç" → "VINÇ"). Depoda `textTransform` bu yüzden
//      yasak (`pdf/brand.tsx`).
//   2. SI BİRİMLERİ BÜYÜK/KÜÇÜK DUYARLIDIR: "kW" ≠ "KW", "m" metre iken "M"
//      mega önekidir, "mm" ≠ "MM". Bir teklifte "22 KW" yazmak, okuyan
//      mühendise belgeyi hazırlayanın birimi bilmediğini söyler.
//   3. Ölçü ve kod yazımı VERİDİR: "Ø20 6x36", "12.44m", "IP55", "35-42 HRC",
//      "4 x Ø400" — firmanın kendi belgelerindeki yazımıyla taşınır (aynı
//      gerekçe `title.ts` `kalemBasligiBuyuk`ta da verildi).
//
// KORUMA KURALLARI `tr-text.ts` `korunurMu`NUN AYNASIDIR ve orada zaten
// gerekçelendirilmiştir: rakam içeren sözcük, eğik çizgili birleşik birim
// ("d/dak"), tümü büyük kısaltma ("HRC", "DIN15090") ve İÇİNDE büyük harf
// taşıyan birim ("kW", "kVA", "kNm") olduğu gibi kalır. O listenin yakalamadığı
// tek sınıf, tamamı küçük harfli birimlerdir ("m", "kg", "mm") — sözlük yalnız
// onlar için vardır.

import { trBuyuk } from "@/lib/tr-text";

/**
 * TAMAMI KÜÇÜK HARFLİ BİRİMLER — `korunurMu` mantığının yakalayamadığı sınıf.
 *
 * Liste UYDURULMADI: teklif defterindeki (`registry.ts`) ve devralınan on dört
 * teklifin teknik satırlarındaki birimlerden çıkarıldı. "adet", "kat", "hafta"
 * gibi TÜRKÇE SÖZCÜKLER bilerek YOKTUR — onlar birim değil metindir ve
 * belgede büyük harfle durmaları doğrudur ("x 2 ADET").
 */
const KUCUK_BIRIMLER: ReadonlySet<string> = new Set([
  "m", "mm", "cm", "km", "m²", "m³",
  "kg", "g", "gr", "t", "ton",
  "bar", "sn",
]);

/** Sözcüğün ucundaki noktalama — sözlük eşleşmesi çekirdeğe bakar. */
function cekirdek(kelime: string): string {
  return kelime.replace(/^[^\p{L}\p{N}°º²³/]+/u, "").replace(/[^\p{L}\p{N}°º²³/]+$/u, "");
}

/** Sözcük olduğu gibi mi kalmalı? */
function korunur(kelime: string): boolean {
  if (!/\p{L}/u.test(kelime)) return true; // harf yok: "Ø20", "-10", "/", "º"
  if (/\d/.test(kelime)) return true; // rakam: ölçü ya da model kodu
  if (kelime.includes("/")) return true; // birleşik birim: "d/dak", "N/mm2"
  if (kelime === "x" || kelime === "×") return true; // çarpım işareti
  const c = cekirdek(kelime);
  if (KUCUK_BIRIMLER.has(c)) return true;
  const harfler = kelime.replace(/[^\p{L}]/gu, "");
  if (harfler === trBuyuk(harfler)) return true; // zaten büyük: "HRC", "GAMAK"
  // İÇERİDE BÜYÜK HARF — ama YALNIZ KISA sözcükte. Kural birim yazımı içindir
  // ("kW", "kVA", "kNm"); uzunluk sınırı olmasaydı tireli marka adları da
  // korunurdu ("Conductix-Wampfler" içindeki "W") ve değer yarı büyük kalırdı.
  if (harfler.length <= 4 && /\p{Lu}/u.test(harfler.slice(1))) return true;
  return false;
}

/**
 * ETİKET TAMAMEN BÜYÜR. Etiketler defterin kendi Türkçe adlarıdır ("Kaldırma
 * Kapasiteleri (Q)", "Çalışma Ortamı / Sıcaklığı"); birim taşımazlar.
 */
export function teknikEtiketBuyuk(metin: string | null | undefined): string {
  return trBuyuk(metin ?? "");
}

/**
 * DEĞER, ÖLÇÜSÜ KORUNARAK BÜYÜR.
 *
 * "GAMAK 22 kW 1500 d/dak, Encoderli" → "GAMAK 22 kW 1500 d/dak, ENCODERLİ".
 *
 * DİL SÖZCÜK SÖZCÜK VE VARSAYILAN TÜRKÇE OKUNUR. Belirsizlik tek harftedir:
 * "i" Türkçede "İ", yabancı yazımda "I" olur. Bu değerlerdeki sözcüklerin
 * ezici çoğunluğu Türkçedir ("Elektromanyetik Motor Freni", "Kasnak", "Tipi",
 * "Encoderli") ve çoğunda Türkçe'ye ÖZGÜ bir harf (ş/ğ/ı/İ/ç/ö/ü) BULUNMAZ —
 * yani `kimlikBuyuk`ün "özgü harf var mı" kuralı burada yanlış cevap verir ve
 * belgeye "FRENI", "ELEKTROHIDROLIK" yazdırır.
 *
 * YABANCI YAZIM AYRI BİR İZDEN OKUNUR: Türk alfabesinde q, w, x YOKTUR ve
 * "ph", "sch", "ck" öbekleri Türkçe yazımda geçmez. Bu izleri taşıyan sözcük
 * markadır ve yerelsiz büyür ("Conductix-Wampfler", "Phoenix", "Schneider").
 * Zaten büyük yazılmış markalar (GAMAK, SIBRE, SCHNEIDER) `korunur` kuralına
 * takılıp hiç dokunulmadan geçer — bu ayrım yalnız KARIŞIK yazılmış sözcükler
 * içindir ve orada Türkçe sayılmak, yabancı sayılmaktan çok daha sık doğrudur.
 */
const YABANCI_IZ = /[qwx]|ph|sch|ck/i;

function sozcukBuyuk(kelime: string): string {
  return YABANCI_IZ.test(kelime) ? kelime.toUpperCase() : trBuyuk(kelime);
}

export function teknikDegerBuyuk(metin: string | null | undefined): string {
  const s = metin ?? "";
  if (!s) return s;
  // Boşluk KORUNARAK bölünür: `join(" ")` çift boşluğu ve satır sonunu
  // sessizce tek boşluğa indirirdi.
  return s
    .split(/(\s+)/)
    .map((p) => (p === "" || /^\s+$/.test(p) || korunur(p) ? p : sozcukBuyuk(p)))
    .join("");
}
