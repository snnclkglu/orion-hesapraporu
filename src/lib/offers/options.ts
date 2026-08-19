// DEFTER MADDESİNİN KURALLARI — ebeveyn çözümlemesi ve yazım kipi.
//
// Kurallar arayüzde değil BURADA durur çünkü DOMAİN kurallarıdır: "seri,
// markanın çocuğudur ve marka çok değerliyse ebeveyn İLK markadır" ve "defter
// maddesi BÜYÜK HARF saklanır, şu listeler hariç". Editörün içinde yazılıydılar
// ve orada sınanamıyorlardı — kademeli listenin çalıştığını görmek için açılır
// kutuyu açmak gerekiyor, açılır kutu ise gizli bir tarayıcı sekmesinde odak
// olayı almıyor (ölçüldü, 17.08.2026). Kuralı saf tutmak, onu testle
// doğrulanabilir yapar.
//
// Dosya SAF kalır (React/DB/`node:*` içe aktarmaz): aynı fonksiyonu hem istemci
// bileşeni (Tanımlar ekranı), hem sunucu action'ı, hem de bir migration'ı
// üreten `tsx` betiği çağırabilsin diye. `src/lib/pdf/brand.tsx` içindeki
// `trUpper` BURADA KULLANILAMAZ — o dosya modül tepesinde `node:fs` ile logo
// okur ve istemciye giremez.

import { trKatla } from "@/lib/drawings/tr-text";
import { kimlikBuyuk } from "@/lib/tr-text";
import { teknikDegerBuyuk } from "./buyuk";
import { firstMulti } from "./multi";

/**
 * BÜYÜK HARFTEN MUAF LİSTELER (kullanıcı kararı, 19.08.2026).
 *
 * Kullanıcının isteği *"Tanımlar defterler kısmındaki yazıları BÜYÜK HARFE
 * ÇEVİR. Kapsam Dışı İşler, Notlar ve Kapak Metinleri, Vinç Sınıfı HARİÇ."*
 * İstisnaların ortak yanı, büyütmenin metni BOZMASIDIR:
 *
 *   · `term.exclusion` / `term.note` — tam cümlelerdir ("Vincin montaj
 *     sahasında gerekli olan tüm inşaat işleri"); büyütülünce belgede bir
 *     madde listesi değil bir bağırma olur.
 *   · `cover.honorific` / `cover.intro` — kapak hitabı ve giriş paragrafı;
 *     "Sayın Ahmet Bey," cümlesinin eki "BEY," olarak basılamaz. İkisi birden
 *     muaftır çünkü kullanıcı "Kapak Metinleri" derken EKRANDAKİ ÖBEĞİ
 *     kastetti ve o öbekte iki liste var (`offerListGroup(k) === "kapak"`).
 *   · `val.craneClass` — "FEM 1Am / ISO M4" bir standart gösterimidir;
 *     "FEM 1AM" standarda aykırıdır. Muafiyet tesadüf değil.
 *
 * Küme TEK YERDE durur; çağrı yerlerine `if (listKey === ...)` serpiştirmek
 * beşinci anahtarın (kapak öbeğinin ikinci listesi) bir yerde unutulmasının en
 * kısa yoluydu. Aynı küme migration'da da yazılıdır ve ayrışmayı bir test
 * SQL metnini OKUYARAK engeller (değişmez md. 8).
 */
export const OFFER_LIST_KEEP_CASE: ReadonlySet<string> = new Set([
  "term.exclusion",
  "term.note",
  "cover.honorific",
  "cover.intro",
  "val.craneClass",
]);

/**
 * Defter maddesinin SAKLANACAK yazımı.
 *
 * Dönüşüm GÖSTERİMDE DEĞİL VERİDE yapılır: değer teklif payload'ına metin
 * olarak girer ve PDF onu olduğu gibi basar; ekranı CSS ile büyütmek belgeyi
 * hiç değiştirmez ve ekran belgenin yalanını söylerdi. (PDF tarafında
 * `textTransform` zaten yasaktır — @react-pdf locale'siz büyütür.)
 *
 * BÜYÜTME `teknikDegerBuyuk`TİR, DÜZ BİR `adBuyuk` DEĞİL.
 *
 * Defter maddeleri belgeye TEKNİK DEĞER olarak girer ve içlerinde ölçü ile
 * birim taşırlar: "400 VAC 50 Hz", "Ø16 6x36 Halat 1960 N/mm2", "Q x 1,1",
 * "St52", "40x30 Ray". Düz bir büyütme bunları "50 HZ", "6X36", "N/MM2",
 * "Q X 1,1" yapar — SI birimleri büyük/küçük duyarlıdır ve müşteriye giden
 * teknik şartnamede bu yazım hatasıdır. `teknikDegerBuyuk` sözcük sözcük
 * çalışır: rakam içeren sözcüğü, eğik çizgili birleşik birimi, çarpım
 * işaretini ve küçük harfli birimi olduğu gibi bırakır (gerekçesi
 * `offers/buyuk.ts`te; aynı kural PDF'in teknik satırlarında da uygulanır).
 *
 * MARKA LİSTELERİ AYRI KALIR (`kimlikBuyuk`). Marka bir Türkçe ad değil bir
 * firma kimliğidir ve `kimlikBuyuk` tam bunun için yazıldı: metin Türkçe'ye
 * özgü harf taşıyorsa tr-TR ("Üntel" → "ÜNTEL"), taşımıyorsa yerelsiz
 * ("Siemens" → "SIEMENS", "Conductix-Wampfler" → "CONDUCTIX-WAMPFLER").
 * Defterde brand.drive altında ZATEN "SCHNEIDER" var; Türkçe kuralıyla
 * büyütmek aynı markayı iki yazıma bölerdi.
 *
 * KABUL EDİLEN SINIR: ASCII yazılan Türkçe bir marka ("Dereli") noktasız
 * büyür. Kullanıcı maddeyi noktalı yazdığında ("DERELİ") kip Türkçeye döner ve
 * düzeltme kalıcıdır; ayrımı markanın ÜLKESİNDEN okumak, her marka için elde
 * tutulan ve eskiyen bir liste demekti.
 *
 * Düz `toUpperCase()` hiçbir dalda kullanılmaz ("İş" → "IS" olurdu).
 */
export function offerValueUpper(listKey: string, value: string): string {
  if (OFFER_LIST_KEEP_CASE.has(listKey)) return value;
  if (listKey.startsWith("brand.")) return kimlikBuyuk(value);
  return teknikDegerBuyuk(value);
}

/** `offer_options` satırının çözümleme için gereken en küçük şekli. */
export interface OfferOptionLike {
  id: string;
  value: string;
}

/**
 * Ebeveyn maddeyi bulur.
 *
 * Eşleşme KATLANMIŞ metinledir (`trKatla`): defterdeki "SİBRE" ile kutuya
 * yazılan "sibre " tek maddedir (`offer_options.match_key` ile birebir aynı
 * kural). Çok değerli markada İLK marka okunur — "SEW/FLENDER" diye bir marka
 * yoktur, SEW vardır ve seri listesi onun çocuklarıdır.
 */
export function parentOption<T extends OfferOptionLike>(
  secenekler: readonly T[],
  ebeveynDeger: string
): T | undefined {
  const ad = firstMulti(ebeveynDeger ?? "");
  if (!ad) return undefined;
  const anahtar = trKatla(ad);
  return secenekler.find((o) => trKatla(o.value) === anahtar);
}
