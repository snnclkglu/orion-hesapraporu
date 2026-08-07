// Türkçe metin yardımcıları.
//
// `baslikDuzeni` ekipman listesi hücrelerini "Baş Harfler Büyük" (title case)
// biçimine getirir. Tek başına `toLocaleUpperCase("tr-TR")` yetmez: liste
// metinlerinde kısaltma (PDF, SKF, FEM, DIN, CMAA), birim (kW, kNm, mm, kg/mm²,
// d/dak, Ø) ve model kodu (HT0823, 22212 E, M3BP) birlikte geçer; hepsini
// körlemesine büyütmek teknik anlamı bozar. Bu yüzden dönüşüm SÖZCÜK BAZINDA
// yapılır ve aşağıdaki durumlarda sözcüğe DOKUNULMAZ.
//
// Dokunulmama kuralları (sırayla):
//   1. Sözcükte harf yoksa            → "-", "=", "·"
//   2. Sözcükte rakam varsa           → "HT0823", "M3BP", "Ø630", "22212"
//   3. Sözcükte "/" varsa             → "kg/mm²", "d/dak", "N/mm²", "kasnak/disk"
//   4. Harfleri tümüyle büyükse       → "PDF", "DIN", "SKF", "C", "Ø", "III" (Romen)
//   5. İlk harften sonra büyük harf   → "kW", "kNm", "kJ", "kN", "mPa"
//   6. Korunan birim/simge sözlüğünde → "mm", "cm", "kg", "ton", "i"
//
// Bağlaç kararı: Türkçe başlık geleneğinde bağlaçlar da çoğu zaman büyük
// yazılır, ancak kullanıcının isteği "kelimelerin baş harfleri büyük olsun"dur
// ve "Halat ve Tambur" biçimi bir ekipman satırında "Halat Ve Tambur"dan daha
// okunaklıdır. Bu yüzden BAGLACLAR listesindeki sözcükler İLK sözcük değilse
// küçük bırakılır; ilk sözcükse büyütülür.
//
// Sözcüğün ilk harfinden sonrası OLDUĞU GİBİ bırakılır (küçültülmez): kaynak
// veri zaten karışık kip içerebilir ve küçültmek "SKF"yi "Skf" yapma riskini
// arka kapıdan geri getirir.

/** İlk harfi büyütülmeyecek birim ve simgeler (hepsi küçük harfle yazılır). */
const KORUNAN_BIRIMLER = new Set([
  "mm",
  "cm",
  "dm",
  "m",
  "km",
  "mt",
  "kg",
  "g",
  "t",
  "ton",
  "sn",
  "dak",
  "dk",
  "rpm",
  "bar",
  "hz",
  "i", // çevrim oranı simgesi ("i = 12,5")
  "x", // çarpı işareti ("40 x 60")
]);

/** İlk sözcük değilse küçük kalan bağlaçlar. */
const BAGLACLAR = new Set(["ve", "ile", "için", "veya", "ya", "ki", "da", "de"]);

/** Türkçe büyük harf — "i" → "İ", "ı" → "I". */
export function trBuyuk(text: string): string {
  return text.toLocaleUpperCase("tr-TR");
}

/** Türkçe küçük harf — "I" → "ı", "İ" → "i". */
export function trKucuk(text: string): string {
  return text.toLocaleLowerCase("tr-TR");
}

/** Sözcüğün korunması (olduğu gibi bırakılması) gerekiyor mu? */
function korunurMu(kelime: string, ilkSozcuk: boolean): boolean {
  if (!/\p{L}/u.test(kelime)) return true; // 1. harf yok
  if (/\d/.test(kelime)) return true; // 2. rakam içeriyor → model kodu / ölçü
  if (kelime.includes("/")) return true; // 3. birleşik birim

  const harfler = kelime.replace(/[^\p{L}]/gu, "");
  if (harfler === trBuyuk(harfler)) return true; // 4. tümü büyük (kısaltma / Romen)
  if (/\p{Lu}/u.test(harfler.slice(1))) return true; // 5. içeride büyük harf (kW, kNm)

  const kucuk = trKucuk(harfler);
  if (KORUNAN_BIRIMLER.has(kucuk)) return true; // 6. birim sözlüğü
  if (!ilkSozcuk && BAGLACLAR.has(kucuk)) return true; // bağlaç, ilk sözcük değil
  return false;
}

/** Sözcüğün ilk HARFİNİ Türkçe kurallarıyla büyütür ("(halat" → "(Halat"). */
function ilkHarfiBuyut(kelime: string): string {
  const m = /\p{L}/u.exec(kelime);
  if (!m || m.index === undefined) return kelime;
  const i = m.index;
  const harf = kelime[i];
  return kelime.slice(0, i) + trBuyuk(harf) + kelime.slice(i + harf.length);
}

/** Tek bir sözcük (boşluksuz parça) — tire ile birleşikler parça parça işlenir. */
function sozcukDuzeni(kelime: string, ilkSozcuk: boolean): string {
  // "motor-redüktör" → "Motor-Redüktör"; ancak yalnız "-" (boş değer göstergesi)
  // ya da "22212-E" gibi kodlar korunma kurallarına takılır.
  if (/\p{L}-\p{L}/u.test(kelime) && !/\d/.test(kelime)) {
    return kelime
      .split("-")
      .map((parca, idx) => sozcukDuzeni(parca, ilkSozcuk && idx === 0))
      .join("-");
  }
  if (korunurMu(kelime, ilkSozcuk)) return kelime;
  return ilkHarfiBuyut(kelime);
}

/**
 * Ekipman listesi başlık düzeni: her sözcüğün baş harfi büyük, kısaltmalar,
 * birimler ve model kodları bozulmadan.
 *
 * ```
 * baslikDuzeni("çelik halat")                  → "Çelik Halat"
 * baslikDuzeni("ışıklı ikaz lambası")          → "Işıklı İkaz Lambası"
 * baslikDuzeni("tel 180 kg/mm², kopma 245 kN") → "Tel 180 kg/mm², Kopma 245 kN"
 * baslikDuzeni("redüktör HT0823 ve motor")     → "Redüktör HT0823 ve Motor"
 * ```
 */
export function baslikDuzeni(text: string | null | undefined): string {
  if (!text) return text ?? "";
  let ilkGorulmedi = true;
  // Boşlukları yakalayarak böl — çok boşluklu / satır sonlu metinler korunur.
  return text
    .split(/(\s+)/)
    .map((parca) => {
      if (parca === "" || /^\s+$/.test(parca)) return parca;
      const sonuc = sozcukDuzeni(parca, ilkGorulmedi);
      ilkGorulmedi = false;
      return sonuc;
    })
    .join("");
}
