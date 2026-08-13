// SİPARİŞ NUMARASI — tedarikçi kodundan türer, ama bir kilit değildir.
//
// Kullanıcı kararı (13.08.2026): *"Sipariş Aç pop-up'ında Sipariş No bölümüne
// bu tedarikçi koduna göre benzersiz yeni bir kod önerelim. Ama isterse
// kullanıcı elle değiştirebilsin."*
//
// Son cümle bu dosyanın sözleşmesidir: burada üretilen şey bir ÖNERİdir.
// Uygulama numarayı DAYATMAZ — devralınan bir düzene geçmek ya da tedarikçinin
// kendi numarasını yazmak meşru işlerdir (`SALE_SCOPES` / `PAYMENT_TERMS`
// listelerinin kapalı olmaması kuralının aynısı).
//
// SAF ÇEKİRDEK: DB/UI bağımlılığı yoktur. Öneri ekranda hesaplanır (kullanıcı
// tedarikçiyi seçtiği anda görür, bir gidiş-dönüş beklemez) ve aynı fonksiyon
// sunucuda çakışma denetiminde kullanılır — iki yerde iki kural yazmak, ekranın
// önerdiği numaranın kaydetmede reddedilmesi demekti.

/** Firma kodunun öneki — defterdeki kodlar `TD0001` biçimindedir. */
export const TEDARIKCI_KODU_ONEKI = "TD";

/** Sipariş numarasının sıra bölümü en az bu kadar basamak taşır. */
const SIRA_BASAMAK = 2;

/** Ayraç ELLE SEÇİLDİ: tire, kod ile sırayı gözle ayırır (`TD0007-01`). */
const AYRAC = "-";

function duzelt(v: string | null | undefined): string {
  return (v ?? "").trim().toLocaleUpperCase("tr-TR");
}

function regexKacir(v: string): string {
  return v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Bir tedarikçi koduna göre sıradaki sipariş numarası.
 *
 * KOD YOKSA ÖNERİ DE YOKTUR — boş dizge döner ve kutu boş kalır. Uydurulmuş
 * bir önek (firma adının ilk harfleri gibi) iki firmada çakışır ve numarayı
 * kimliksiz bırakırdı.
 *
 * SIRA MEVCUT NUMARALARDAN OKUNUR, sayılmaz: iptal edilmiş ya da silinmiş bir
 * siparişin numarası yeniden kullanılmamalıdır. `TD0007-03` varken kayıt sayısı
 * 1 olsa bile öneri `TD0007-04`tür.
 */
export function siparisNoOner(tedarikciKodu: string | null | undefined, mevcut: readonly string[]): string {
  const kod = duzelt(tedarikciKodu);
  if (!kod) return "";

  const desen = new RegExp(`^${regexKacir(kod)}${regexKacir(AYRAC)}(\\d+)$`);
  let enBuyuk = 0;
  for (const ham of mevcut) {
    const eslesme = desen.exec(duzelt(ham));
    if (eslesme) enBuyuk = Math.max(enBuyuk, Number(eslesme[1]));
  }

  const sira = enBuyuk + 1;
  return `${kod}${AYRAC}${String(sira).padStart(SIRA_BASAMAK, "0")}`;
}

/**
 * Numara başkasında kullanılıyor mu?
 *
 * `haric` düzenlenen siparişin KENDİ numarasıdır: bir siparişi açıp hiçbir şey
 * değiştirmeden kaydetmek "bu numara zaten var" hatası vermemelidir.
 *
 * BOŞ NUMARA HİÇBİR ZAMAN ÇAKIŞMAZ: numarasız sipariş açmak meşrudur (kullanıcı
 * numarayı sonradan yazar) ve iki boşluğu çakışma saymak o yolu kapatırdı.
 */
export function siparisNoCakisiyorMu(
  no: string | null | undefined,
  mevcut: readonly string[],
  haric?: string | null
): boolean {
  const hedef = duzelt(no);
  if (!hedef) return false;
  const kendi = duzelt(haric);
  return mevcut.some((m) => {
    const v = duzelt(m);
    return v === hedef && v !== kendi;
  });
}
