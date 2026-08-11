// Türkçe metin karşılaştırma — teknik resim paketlerinde YOL SEMANTİKTİR.
//
// `İPTAL` klasörü bir dizin değil bir DURUMDUR: içindeki dosya, canlı bir adın
// eski sürümüdür. O klasörü tanıyamamak süperse zincirini kurmamak, yani aynı
// resmi iki farklı içerikle canlı göstermek demektir.
//
// Ve `"İPTAL".toLowerCase()` İngilizce yerelde `"i̇ptal"` verir — noktalı i
// üstüne bir de birleşen nokta (U+0307) ekler; `"iptal"` ile EŞİT DEĞİLDİR.
// Bu yüzden bu dosyadaki karşılaştırmalar küçültme değil BÜYÜTME üzerinden
// gider ve büyütme her zaman tr-TR yerelindedir.

/** tr-TR büyük harf. `toUpperCase()` "i" harfini "I" yapar; bu doğru değildir. */
export function trBuyuk(value: string): string {
  return value.toLocaleUpperCase("tr-TR");
}

/**
 * Karşılaştırma anahtarı: NFC + tr-TR büyük + kenar boşlukları atılmış.
 *
 * NFC ZORUNLUDUR: macOS ve bazı Windows API'leri `İ`yi ayrık (`I` + U+0307)
 * verir; birleşik biçimle karşılaştırmak sessizce başarısız olur.
 */
export function trAnahtar(value: string): string {
  return trBuyuk(value.normalize("NFC").trim());
}

/**
 * KATLAMA — eşleştirme için, gösterim için DEĞİL.
 *
 * `trBuyuk` gösterime doğrudur ama EŞLEŞTİRMEYE YANLIŞTIR ve bu fark bir
 * gerçek hataya mal oldu:
 *
 *     "Description".toLocaleUpperCase("tr-TR")  →  "DESCRİPTİON"
 *
 * Türkçede küçük `i`nin büyüğü noktalı `İ`dir. Inventor'ın İNGİLİZCE sütun
 * başlıkları (`Description` · `Title` · `Material`) tr-TR ile büyütülünce
 * sözlükteki `DESCRIPTION` ile eşleşmez ve o sütunlar SESSİZCE kaybolur.
 * Ters yönü de bozuktur: `Agaci` → `AGACİ`, `AGACI` ile tutmaz.
 *
 * Katlama i ailesinin dördünü (`i` `ı` `İ` `I`) tek harfe indirir ve Türkçe
 * aksanlarını ASCII karşılığına düşürür. Böylece `Açıklama` · `ACIKLAMA` ·
 * `açiklama` aynı anahtara gelir — ressamın hangi klavyeyle yazdığı sorun
 * olmaz.
 */
const KATLAMA: Record<string, string> = {
  i: "I", ı: "I", İ: "I", I: "I",
  ç: "C", Ç: "C",
  ğ: "G", Ğ: "G",
  ö: "O", Ö: "O",
  ş: "S", Ş: "S",
  ü: "U", Ü: "U",
};

export function trKatla(value: string): string {
  return value
    .normalize("NFC")
    .trim()
    .replace(/[iıİIçÇğĞöÖşŞüÜ]/g, (h) => KATLAMA[h] ?? h)
    .toUpperCase();
}

/**
 * GÖSTERİM İÇİN TEK BİÇİM — aynı sözcüğün iki yazımını birleştirir.
 *
 * Gerçek bir pakette Excel'in kategori sütununda hem `Talaşlı imalat` hem
 * `Talaşlı İmalat` geçiyordu ve süzgeç açılırında İKİ AYRI seçenek oluyordu;
 * kullanıcı birini seçince diğerinin parçaları listeden düşüyordu. Ressamın
 * elindeki tabloyu düzeltmesini beklemek bu modülün ilkesine aykırıdır
 * (md. 18/1: hiçbir kural bir yüklemeyi engellemez) — düzeltmeyi kod yapar.
 *
 * SAKLANAN VERİ DEĞİŞMEZ, yalnız gösterim ve süzgeç birleşir. Deftere
 * normalleştirilmiş yazmak `diff.ts`in `kategori` karşılaştırmasını tetikler ve
 * bir sonraki revizyonda YÜZLERCE parça "gözden geçirilecek" işareti alırdı;
 * işaret o anda anlamını yitirir (md. 18/3'ün ta kendisi).
 *
 * Kural: her sözcüğün ilk harfi tr-TR büyük, kalanı tr-TR küçük. Tamamı büyük
 * yazılmış sözcükler (`DIN`, `NPL`, `UCF`) OLDUĞU GİBİ kalır — onlar yazım
 * tercihi değil kısaltmadır ve küçültmek bilgi kaybıdır.
 */
export function trTekBicim(value: string): string {
  return value
    .normalize("NFC")
    .trim()
    .split(/(\s+)/)
    .map((parca) => {
      if (!parca.trim()) return parca;
      // Kısaltma mı? İki+ harfin tamamı büyükse dokunulmaz.
      const harfler = parca.replace(/[^\p{L}]/gu, "");
      if (harfler.length >= 2 && harfler === trBuyuk(harfler)) return parca;
      return trBuyuk(parca.slice(0, 1)) + parca.slice(1).toLocaleLowerCase("tr-TR");
    })
    .join(" ")
    .replace(/\s+/g, " ");
}

/**
 * `İPTAL` klasörü mü?
 *
 * Noktasız yazım (`IPTAL`) da kabul edilir: ressam Türkçe klavye kullanmadan
 * ya da başka bir bilgisayardan yazmış olabilir ve bu bir hata değildir —
 * niyet açıktır. Tanımamak, tanımaya çalışmaktan daha pahalıdır.
 */
export function isIptalKlasoru(segment: string): boolean {
  return trKatla(segment) === "IPTAL";
}

/** Yol parçasında "BÜKÜM" geçiyor mu? (`BUKUM PDF`, `BÜKÜM`, `Bukum Pdf`…) */
export function isBukumKlasoru(segment: string): boolean {
  return trKatla(segment).includes("BUKUM");
}

/** `STEP 3D` gibi 3B model klasörü mü? */
export function isStepKlasoru(segment: string): boolean {
  const a = trKatla(segment);
  return a.includes("STEP") || a.includes("3D");
}

/**
 * tr-TR ondalık sayı okuma: "169,3" → 169.3, "1498,457 kg" → 1498.457.
 *
 * Binlik ayracı da nokta olabildiği için ("1.498,457") kural şudur: SON virgül
 * ondalık ayracıdır; ondan öncesindeki bütün nokta ve virgüller binliktir.
 * Hiç virgül yoksa tek bir nokta ondalık sayılır — "3.6MM" yazan bir dosya
 * adı da gerçekte var.
 */
export function trSayi(value: string | null | undefined): number | null {
  if (value == null) return null;
  const ham = String(value).replace(/[^\d.,-]/g, "").trim();
  if (!ham) return null;

  const sonVirgul = ham.lastIndexOf(",");
  let normal: string;
  if (sonVirgul >= 0) {
    normal = ham.slice(0, sonVirgul).replace(/[.,]/g, "") + "." + ham.slice(sonVirgul + 1);
  } else {
    // Birden çok nokta varsa hepsi binliktir ("1.498" → 1498).
    normal = (ham.match(/\./g) ?? []).length > 1 ? ham.replace(/\./g, "") : ham;
  }

  const n = Number(normal);
  return Number.isFinite(n) ? n : null;
}

/**
 * `GG.AA.YYYY` ya da `GG,AA,YYYY` tarihini ISO'ya çevirir.
 *
 * İki gerçek klasörde iki ayrı ayraç kullanılmış (`31.07.2026` ve
 * `04,06,2026`); ayracı şart koşmak, dosyanın tarihini kaybetmekten başka bir
 * işe yaramazdı. Geçersiz tarih `null` döner — hata değil, bilgi yokluğudur.
 */
export function trTarih(value: string): string | null {
  // BÜTÜN eşleşmeler denenir, ilki değil. Dosya adı tarihten önce parça kodu
  // taşıyor: `2.0057-00-0500_DEPO_31.07.2026` içinde `57-00-0500` de kalıba
  // uyar. İlk eşleşmede durup geçersiz bulunca vazgeçmek, gerçek tarihi
  // hiç görmemek demekti.
  for (const m of value.matchAll(/(\d{1,2})[.,\-/](\d{1,2})[.,\-/](\d{4})/g)) {
    const gun = Number(m[1]);
    const ay = Number(m[2]);
    const yil = Number(m[3]);
    if (gun < 1 || gun > 31) continue;
    if (ay < 1 || ay > 12) continue;
    // Yıl süzgeci `0500`ü yıl saymayı engeller — kod segmentleri dört hanelidir.
    if (yil < 1990 || yil > 2100) continue;
    return `${yil}-${String(ay).padStart(2, "0")}-${String(gun).padStart(2, "0")}`;
  }
  return null;
}
