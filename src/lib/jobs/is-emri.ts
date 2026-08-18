// İş emri formunun SAF kuralları — sonraki iş no, hızlı termin, revizyon harfi.
//
// Üçü de bir "sonraki değeri" hesaplar ve üçü de İKİ yerden çağrılır (form ile
// server action / sayfa). Çekirdek DB/React bilmez (AGENTS md. 7); böylece
// kural tek yerde durur ve testi kaynak dosyayı okuyarak dondurulabilir.

/**
 * Defterdeki EN BÜYÜK iş numarasının bir fazlası — yeni iş emrinin ÖNERİSİ.
 *
 * Numara serbest metindir ve devralınan kayıtlarda son ek taşıyabilir
 * (`0043-00-0000`); KÖK alınır, yani ilk tire öncesi (`autoItemNos` ile aynı
 * okuma). Sayı olmayan kökler (elle yazılmış bir etiket) sessizce atlanır —
 * öneri bir kelepçe değil kolaylıktır, kullanıcı alanı her zaman değiştirebilir.
 *
 * DOLGU GENİŞLİĞİ VERİDEN OKUNUR: defterde numaralar `0063` biçiminde dört
 * hanelidir ve öneri de öyle olmalıdır. Sabit bir `4` yazılsaydı beş haneye
 * geçildiği gün öneri geriye düşerdi; en geniş kök kadar dolgu yapılır.
 *
 * Defter boşsa `0001` döner — bu bir uydurma veri değil, ilk işin numarasıdır.
 */
export function sonrakiIsNo(mevcut: readonly (string | null | undefined)[]): string {
  let enBuyuk = 0;
  let genislik = 4;
  for (const ham of mevcut) {
    const kok = String(ham ?? "").split("-")[0].trim();
    if (!/^\d+$/.test(kok)) continue;
    const n = parseInt(kok, 10);
    if (n > enBuyuk) enBuyuk = n;
    if (kok.length > genislik) genislik = kok.length;
  }
  return String(enBuyuk + 1).padStart(genislik, "0");
}

/** Tarih birimi — hızlı termin seçiminde kullanıcı ikisinden birini seçer. */
export type TerminBirimi = "hafta" | "ay";

export const TERMIN_BIRIM_ADLARI: Record<TerminBirimi, string> = {
  hafta: "Hafta",
  ay: "Ay",
};

/** Hızlı seçim adımları — 1…8 hafta / 1…8 ay (kullanıcı isteği, 18.08.2026). */
export const TERMIN_ADIMLARI = [1, 2, 3, 4, 5, 6, 7, 8] as const;

function isoYaz(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
}

/**
 * Tabana n hafta ya da n ay ekler; `YYYY-MM-DD` döner (taban okunamazsa boş).
 *
 * HESAP UTC'DEDİR: yerel `Date` ile yapılsaydı yaz saati geçişinde gün bir
 * kayabilirdi ve termin tarihi bir gün eksik yazılırdı.
 *
 * AY EKLEMESİ AYIN SONUNA KELEPÇELENİR: 31.01 + 1 ay = 28.02 (artık yılda
 * 29.02), 03.03 değil. `setUTCMonth` ham hâliyle taşırır ve kullanıcı ay
 * seçtiğinde bir sonraki ayın başına düşerdi.
 */
export function tarihEkle(
  taban: string | null | undefined,
  miktar: number,
  birim: TerminBirimi
): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(taban ?? "").trim());
  if (!m) return "";
  const yil = Number(m[1]);
  const ay = Number(m[2]) - 1;
  const gun = Number(m[3]);

  if (birim === "hafta") {
    return isoYaz(new Date(Date.UTC(yil, ay, gun + miktar * 7)));
  }

  const hedef = ay + miktar;
  const hedefYil = yil + Math.floor(hedef / 12);
  const hedefAy = ((hedef % 12) + 12) % 12;
  // Ayın son günü: bir sonraki ayın "0."ıncı günü.
  const sonGun = new Date(Date.UTC(hedefYil, hedefAy + 1, 0)).getUTCDate();
  return isoYaz(new Date(Date.UTC(hedefYil, hedefAy, Math.min(gun, sonGun))));
}

/**
 * Revizyon harfi — geçersiz/boş değer `A`ya düşer.
 *
 * Büyütme `toLocaleUpperCase("tr-TR")` DEĞİL düz `toUpperCase()`tur ve bu
 * AGENTS md. 3'ün istisnası değil kapsamı dışıdır: alan bir AD değil ASCII bir
 * sıra işaretidir ve yalnız `A–Z` kabul eder. Türkçe büyütme "i"yi "İ" yapar,
 * "İ" ise harf kümesinde yoktur — kullanıcının küçük harfle yazdığı "i"
 * sessizce `A`ya düşerdi.
 */
export function revizyonHarfi(v: unknown): string {
  const s = String(v ?? "").trim().toUpperCase();
  return /^[A-Z]{1,3}$/.test(s) ? s : "A";
}

/**
 * Bir sonraki revizyon harfi: A → B → … → Z → AA → AB.
 *
 * Z'den sonra harf ÜRETİLİR, başa dönülmez: 26. revizyonda numaranın `A`ya
 * dönmesi iki ayrı belgeye aynı kimliği verirdi. Pratikte bir iş emri o kadar
 * revize edilmez ama kural belirsiz kalmamalıdır.
 */
export function sonrakiRevizyon(v: unknown): string {
  const harfler = revizyonHarfi(v).split("");
  for (let i = harfler.length - 1; i >= 0; i--) {
    if (harfler[i] !== "Z") {
      harfler[i] = String.fromCharCode(harfler[i].charCodeAt(0) + 1);
      return harfler.join("");
    }
    harfler[i] = "A";
  }
  return `A${harfler.join("")}`;
}
