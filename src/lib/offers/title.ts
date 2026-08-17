// KALEM BAŞLIĞI — "32/5T x 19,5m ÇİFT KİRİŞLİ GEZER KÖPRÜLÜ VİNÇ".
//
// Kullanıcı isteği (17.08.2026): *"Kalem başlığını da otomatize edelim hata
// olmasın. Ana Kaldırma / Yardımcı Kaldırma (varsa) x Aks + Vinç Tipi olarak
// otomatik gelsin. İstersem düzenleyebileyim."*
//
// BİÇİM UYDURULMADI, firmanın kendi belgelerinden ÇIKARILDI. Devralınan on dört
// teklifin bölüm başlıkları:
//     32/5T x 19.5m ÇİFT KİRİŞ GEZER KÖPRÜLÜ VİNÇ
//     200/20T x 15m ÇİFT KİRİŞ GEZER KÖPRÜLÜ VİNÇ
//     32T x 30m ÇİFT KİRİŞ TAM PORTAL VİNÇ
//     20T ÇİFT KİRİŞ GEZER KÖPRÜLÜ VİNÇ        (açıklık yazılmamış)
//     3T MONORAY VİNÇ
// Yani sıra `kapasite → açıklık → tip`tir, yardımcı kaldırma varsa kapasiteye
// eğik çizgiyle eklenir ve BULUNMAYAN parça sessizce düşer — "20T x m" gibi
// yarım bir başlık hiç oluşmaz. Kullanıcının tarifi ile belgelerin yazımı
// birebir aynı; ikisi birbirini doğruluyor.
//
// "AKS" = KÖPRÜ AÇIKLIĞI. Kullanıcının kelimesi budur ve belgelerdeki `x 19.5m`
// sayısı GENEL ÖZELLİKLER'deki `Köprü Açıklığı` satırıyla birebir tutuyor.
//
// SAYI OLDUĞU GİBİ TAŞINIR, yeniden biçimlenmez. Kullanıcı "19,5" yazdıysa
// başlıkta "19,5" durur; ondalık ayıracını çevirmek ya da basamak gruplamak,
// aynı sayının belgede iki yazımla görünmesi demekti (`Kaldırma Kapasiteleri
// (Q)` satırı da kullanıcının yazdığı metni basar). Türetme bir OKUMADIR, bir
// hesap değil.

import { adBuyuk } from "@/lib/tr-text";
import { generalRowPart, generalRowValue } from "./registry";
import type { OfferItem } from "./types";

/**
 * KALEM BAŞLIĞININ BÜYÜK HARFİ — ölçüyü koruyarak.
 *
 * Düz `adBuyuk` BURADA KULLANILAMAZ (değişmez md. 3'ün alan-adı kuralı bir
 * BELGE BAŞLIĞINA olduğu gibi uygulanamaz): başlık ölçü taşır ve `x 19,5m`
 * yazımı belgelerin kendi yazımıdır — körlemesine büyütmek onu `X 19,5M`
 * yapardı. Bu yüzden RAKAM İÇEREN sözcük ("19,5m", "32/5T") ve çarpım işareti
 * "x" olduğu gibi bırakılır, geri kalan her sözcük Türkçe kuralıyla büyür
 * (`baslikDuzeni`nin koruma mantığının aynası; oradaki gerekçeler burada da
 * geçerli).
 */
export function kalemBasligiBuyuk(metin: string | null | undefined): string {
  return (metin ?? "")
    .split(" ")
    .map((kelime) => (/\d/.test(kelime) || kelime === "x" ? kelime : adBuyuk(kelime)))
    .join(" ");
}

/** Başlık türetmesinin okuduğu en küçük şekil — testler bunu doğrudan kurar. */
interface BasliktakiGruplar {
  readonly key: string;
  readonly rows: readonly {
    key: string;
    value?: string;
    parts?: Record<string, string>;
  }[];
}

/**
 * VARSAYILAN KALEM ADI — "VİNÇ - 1".
 *
 * Kullanıcı isteği (17.08.2026): *"Girdiğim teklif konusu ekleyeceğim vinç ile
 * aynı olmayabilir. Konu Kapak bölümüne gelsin, ilk vinç Vinç - 1 olarak
 * gelsin."* Teklif KONUSU belgenin tamamını anlatır ("YENİ FABRİKA VİNÇ
 * TEKLİFLERİ"); kalem ise tek bir ekipmandır. İkisini eşitlemek, üç vinçlik bir
 * teklifin ilk vincine belgenin adını takmak olurdu.
 *
 * Ad bir YER TUTUCU DEĞİLDİR (değişmez md. 5): kutuda gri bir öneri olarak
 * durmaz, gerçekten kaydedilir — kullanıcı ya üstüne yazar ya da teknik
 * satırları doldurdukça başlık kendiliğinden gerçek adına kavuşur.
 */
export function defaultItemTitle(sira: number): string {
  return `VİNÇ - ${sira}`;
}

/** Varsayılan adla mı duruyor — otomatik başlık onu ezmekte serbesttir. */
export function isDefaultItemTitle(title: string): boolean {
  return /^VİNÇ\s*-\s*\d+$/u.test((title ?? "").trim());
}

/**
 * Teknik satırlardan başlığı derler; okunacak bir şey yoksa BOŞ döner.
 *
 * Boş dönmek anlamlıdır: çağıran o zaman mevcut başlığa DOKUNMAZ. Yeni açılmış
 * bir kalemde henüz kapasite de tip de yoktur ve başlığı silmek, bölüm rayında
 * adsız bir sekme bırakırdı.
 */
export function composeItemTitle(groups: readonly BasliktakiGruplar[]): string {
  const ana = generalRowPart(groups, "capacity", "main");
  const yardimci = generalRowPart(groups, "capacity", "aux");
  // AÇIKLIK İKİ SATIRDAN GELEBİLİR: gezer köprülü vinçte `Köprü Açıklığı`,
  // pergelde `Bom Açıklığı` — ikisi de belgede aynı yeri tutar ve bir kalemde
  // yalnız biri doludur.
  const aks =
    generalRowPart(groups, "span", "value") || generalRowPart(groups, "boomSpan", "value");
  const tip = generalRowValue(groups, "craneType");

  const kapasite = ana ? `${ana}${yardimci ? `/${yardimci}` : ""}T` : "";
  const olcu = [kapasite, aks ? `x ${aks}m` : ""].filter(Boolean).join(" ");
  return kalemBasligiBuyuk([olcu, tip].filter(Boolean).join(" ").trim());
}

/**
 * Kalemi, başlığı türetilmiş hâliyle döndürür.
 *
 * `titleManual` AÇIKSA DOKUNULMAZ — satır düzenleyicideki `manual` anahtarının
 * aynısı ve aynı gerekçeyle: makine önerir, insan son sözü söyler. Kullanıcı
 * başlığı elle yazdıysa bir sonraki kapasite düzeltmesi onu SESSİZCE geri
 * almamalıdır; bir belge editöründe girdiğini kaybetmek kabul edilemez
 * (bkz. `guncelleIle`, TEKLIF-16).
 */
export function withAutoTitle(item: OfferItem): OfferItem {
  if (item.titleManual) return item;
  const baslik = composeItemTitle(item.groups);
  if (!baslik || baslik === item.title) return item;
  return { ...item, title: baslik };
}
