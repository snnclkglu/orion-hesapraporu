// Belge kimliği ve İNDİRME DOSYA ADI — tek kaynak.
//
// Dosya adları belge belge farklı düzenlerdeydi (`0055-V1.pdf`,
// `0055-V1-ekipman-listesi.pdf`, `0075 - Muhtelif Vinçler - İş Emri.pdf`) ve
// indirilenler klasöründe hangi dosyanın ne olduğu ancak açılınca anlaşılıyordu.
// Firma kuralı: **İŞ ADI - DOKÜMAN KODU - VERSİYON**, tamamı BÜYÜK HARF, sonda
// belgenin türü/seviyesi.
//
// Büyük harf `tr-TR` ile yapılır: `toUpperCase()` "i" harfini "I" yapar ve
// "İşin adı" → "ISIN ADI" olurdu.

import { trKatla } from "@/lib/drawings/tr-text";
import { offerRevLabel } from "@/lib/offers/no";

/**
 * `ORC-HR-0055-R01` · `ORC-EQ-0055-R01` · `ORC-TR-0057-00-0500-R01` — belge kimliği.
 *
 * `TR` teknik resim paketinin türev çıktılarıdır (satın alma / kesim / imalat
 * listesi) ve doküman numarası olarak KLASÖR KODUNU taşır: bir işin birden çok
 * resim paketi olabilir ve ikisi de aynı iş kalemine bağlıdır, ayırt eden şey
 * grup kodudur.
 */
export function docCode(kind: "HR" | "EQ" | "TR", docNo: string, revNo: number): string {
  return `ORC-${kind}-${docNo}-R${String(revNo).padStart(2, "0")}`;
}

/**
 * `ORC-IE-0063` · `ORC-IE-0063-RA` — İŞ EMRİ (IE) belge kimliği.
 *
 * `docCode` İMZASI BOZULMADI: o fonksiyon revizyonu SAYI olarak ister, iş
 * emrinin revizyonu ise HARFTİR (A · B · C — kullanıcı kararı, 18.08.2026).
 * Ortak bir imzaya zorlamak ikisinden birini yalan söyletirdi; iş listesi ve
 * bordronun (dönemli belgeler) ayrı kimlik üreticileri olmasıyla aynı gerekçe.
 *
 * REVİZYONSUZ İŞ EMRİNDE SON EK HİÇ BASILMAZ. İlk yayın bir revizyon değildir
 * (kullanıcı kararı, 18.08.2026) ve `-R` ile biten bir kod ya da uydurulmuş
 * bir `-RA`, olmamış bir düzeltme geçmişi anlatırdı — teklifin `offerRevLabel`
 * kuralının aynısı, gerekçesi de aynı.
 */
export function workOrderDocCode(jobNo: string, revision: string): string {
  return revision ? `ORC-IE-${jobNo}-R${revision}` : `ORC-IE-${jobNo}`;
}

/** Aylar — belge dönemi ve dosya adı için (tr-TR, büyük harf kullanıma hazır). */
const AYLAR = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
] as const;

/**
 * Güncel İş Listesi'nin dönemi: "Ağustos 2026".
 *
 * REVİZYON NUMARASI YOKTUR ve bu bilinçlidir. Hesap raporu bir PROJENİN
 * sürümlenen belgesidir; iş listesi ise firmanın o AYKİ fotoğrafıdır ve iki
 * kez üretildiğinde ikisi de aynı belgedir. Dönemi ay verir, revizyon değil.
 */
export function jobListPeriod(date: Date): string {
  return `${AYLAR[date.getMonth()]} ${date.getFullYear()}`;
}

/** `ORC-IL-2026-08` — Güncel İş Listesi belge kimliği (IL = İş Listesi). */
export function jobListDocCode(date: Date): string {
  return `ORC-IL-${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * `ORC-BR-2026-08` — ücret pusulası (BR = Bordro) belge kimliği.
 *
 * `docCode` İMZASI BOZULMADI ve bu bilinçli: o fonksiyon `<kod>-<no>-R<rev>`
 * biçimindedir ve REVİZYON NUMARASI ister. Bordronun revizyonu yoktur, DÖNEMİ
 * vardır — iş listesiyle (`jobListDocCode`) aynı gerekçe: aynı ayın bordrosu
 * iki kez basıldığında ikisi de aynı belgedir. Kişi kimliği koda GİRMEZ;
 * dosya adı zaten kişinin adını taşır ve TC/sicil no bir belge kodunda
 * dolaşmamalıdır.
 */
export function payslipDocCode(period: string): string {
  return `ORC-BR-${period.slice(0, 7).replace("-", "-")}`;
}

/** Bordro dönem etiketi: `2026-08` → "AĞUSTOS 2026". */
export function payslipPeriodLabel(period: string): string {
  const [y, m] = period.slice(0, 7).split("-");
  const ay = AYLAR[Number(m) - 1] ?? m;
  return `${ay} ${y}`.toLocaleUpperCase("tr-TR");
}

/**
 * Windows/macOS dosya adında kullanılamayan karakterler.
 * Nokta ve tire KALIR: doküman kodunun bir parçasıdırlar.
 */
function safe(part: string): string {
  return part.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Parçaları " - " ile birleştirip büyük harfe çevirir ve `.pdf`/`.xlsx` uzantısını
 * ekler. Boş parçalar düşer — versiyonu olmayan belge (iş emri) sessizce
 * kısalır, ada boşluk ya da çift ayraç girmez.
 */
export function downloadFileName(
  parts: readonly (string | null | undefined)[],
  ext: "pdf" | "xlsx" | "json" = "pdf"
): string {
  const name = parts
    .map((p) => safe((p ?? "").toString()))
    .filter(Boolean)
    .join(" - ")
    .toLocaleUpperCase("tr-TR");
  return `${name || "ORION"}.${ext}`;
}

/**
 * Teklif belgesinin dosya adı:
 *
 *     ORİON VİNÇ - HABAŞ DÖRTYOL 20T VİNÇ - TETR-20260127-1 - REV 02.pdf
 *
 * **ÖNEK HAZIRLAYAN FİRMADIR**; standart teklifte "ORİON VİNÇ", partner
 * teklifinde partnerin snapshot unvanıdır. ORION varsayılanı kullanıcı
 * isteğidir (22.08.2026: *"Konu ne olursa olsun inen teklif pdf isimlendirmesi
 * ORİON VİNÇ - KONU şeklinde olsun."*). Kullanıcı bunu bugüne kadar KONUNUN
 * İÇİNE elle yazıyordu ve
 * yazmayı unuttuğu teklifte müşterinin indirdiği dosya kimden geldiğini
 * söylemiyordu; müşterinin indirilenler klasöründe on tedarikçinin teklifi
 * yan yana durur.
 *
 * Geri kalanı firmanın **İŞ ADI - DOKÜMAN KODU - VERSİYON** düzenidir;
 * "doküman kodu" yerini TEKLİF NUMARASI alır çünkü müşteriyle yazışmada geçen
 * referans odur (`offers/no.ts`), `ORC-…` iç kodu değil.
 *
 * NUMARA VE REVİZYON DÜŞMEDİ ve bu bir gereklilik: yayımlanan teklif PDF'i
 * `offer-pdf` kovasına `${offerId}/${dosyaAdı}` yoluyla arşivlenir
 * (`issueOfferRevision`). Ad yalnız önek ve konudan kursaydı, aynı teklifin
 * R1 ve R2 revizyonları AYNI dosya adını taşır ve ikincisi birincinin üstüne
 * yazardı — müşteriye giden ilk kâğıdın karşılığı arşivden silinirdi.
 *
 * REVİZYON PARÇASI R0'DA DÜŞER (`offerRevLabel`): ilk teklif bir revizyon
 * değildir ve dosya adında "REV 00" görmek, müşteriye hiç var olmamış bir
 * düzeltme geçmişi anlatırdı.
 */
export const OFFER_FILE_PREFIX = "ORİON VİNÇ";

export function offerFileName(
  subject: string,
  offerNo: string,
  revNo: number,
  issuerName = OFFER_FILE_PREFIX
): string {
  const prefix = issuerName.trim() || OFFER_FILE_PREFIX;
  return downloadFileName([prefix, konuAdi(subject, prefix), offerNo, offerRevLabel(revNo)]);
}

/**
 * Konuyu dosya adına hazırlar — ÖNEK İKİ KEZ YAZILMAZ.
 *
 * Kullanıcı öneki bugüne kadar KONUNUN İÇİNE yazıyordu ("ORİON VİNÇ - 80T VE
 * 32T PORTAL VİNÇ TEKLİFLER"); artık uygulama ekliyor. Eski tekliflerde ikisi
 * üst üste binerdi ve dosya adı "ORİON VİNÇ - ORİON VİNÇ - …" olurdu.
 * Karşılaştırma `trKatla` iledir: "ORİON", "Orion" ve "ORION" aynı öneki
 * anlatır.
 */
function konuAdi(subject: string, prefix = OFFER_FILE_PREFIX): string {
  const temiz = (subject ?? "").trim();
  const katlanmis = trKatla(temiz);
  // Partner teklifine dönüştürülen eski bir konu ORION öneki taşıyabilir;
  // dosya adında iki farklı hazırlayan firma yan yana kalmamalıdır.
  const bulunan = [prefix, OFFER_FILE_PREFIX].find((aday) =>
    katlanmis.startsWith(trKatla(aday))
  );
  if (!bulunan) return temiz;
  // Öneki ve ardındaki ayracı ("-", "–", ":") düşür.
  return temiz.slice(bulunan.length).replace(/^[\s\-–—:·]+/, "").trim();
}

/**
 * MALİYET ÇALIŞMASININ dosya adı:
 *
 *     ASTOR 32T PORTAL VİNÇ - TETR-20260817-1 - MALİYET M1 - İÇ BELGE.pdf
 *
 * İKİ İŞARET BİLEREK VAR. "MALİYET" olmadan dosya teklifin kendisiyle
 * karışırdı — indirilenler klasöründe yan yana duran iki PDF'in hangisinin
 * müşteriye gideceği ancak açılınca anlaşılırdı. "İÇ BELGE" ise adın SONUNDA
 * durur, yani dosya adı kısaltılarak gösterilse bile e-posta ekinde ilk
 * bakılan yerdedir. Bu belgenin müşteriye gitmesi, bu bölümde olabilecek en
 * pahalı hatadır.
 *
 * REVİZYON M0'DA DA YAZILIR (teklifin `offerRevLabel` kuralının TERSİ):
 * teklifte R0 gizlenir çünkü müşteri "REV 00" görünce var olmamış bir
 * düzeltme geçmişi okur. Maliyet iç belgedir ve orada asıl soru "bu hangi
 * maliyet çalışması" olduğu için numara her zaman görünür.
 */
export function offerCostFileName(subject: string, offerNo: string, revNo: number): string {
  return downloadFileName([subject, offerNo, `Maliyet M${revNo}`, "İç Belge"]);
}

/** Rapor seviyesinin dosya adındaki karşılığı. */
export const REPORT_LEVEL_LABELS: Record<string, string> = {
  detayli: "Detaylı",
  standart: "Standart",
  ozet: "Özet",
  teker_yukleri: "Teker Yükleri",
};
