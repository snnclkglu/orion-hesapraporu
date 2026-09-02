// KLİMA AĞIRLIK DEFTERİ — seri + gereken soğutma yükü → ünite ağırlığı.
//
// NEDEN AYRI BİR DEFTER: uygulamanın klima kataloğu (`air_conditioner` türü)
// SERİ düzeyindedir — mühendis "VKS-VP" seçer, "VKS-VP 850" değil. Üretici ise
// ağırlığı ALT MODEL başına yayımlar. İki düzey arasında bir eşleme olmadığı
// için katalog satırına tek bir `weight_kg` yazılamaz; yazılsaydı 2,5 kW'lık
// bir üniteyle 28 kW'lık ünite aynı kiloyu alırdı.
//
// Bu yüzden ağırlık BURADA, GEREKEN SOĞUTMA YÜKÜNDEN türetilir: hesabın kendi
// `cabinAc.total` (kW) hücresi hangi alt modelin ısmarlanacağını belirler.
// Çıkan sayı bir KATALOG DEĞERİ DEĞİL, katalog verisine dayanan bir TAHMİNDİR
// ve ağırlık dökümünde `Tahmin` rozetiyle durur.
//
// KAYNAK (erişim 02.09.2026): TMS Grup ürün sayfalarının kendi teknik
// tabloları — `tmsgrup.com/products/` altındaki PKS, VKS-VM, VKS-VC, VKS-VP,
// VKS-VS ve WMU serileri. Değerler NET ağırlıktır (nakliye/brüt DEĞİL; TMS'de
// brüt tipik olarak net + %15…%35'tir). Yerel bir TMS PDF'i workspace'te YOKTUR
// — arandı, bulunamadı; bu yüzden `catalog_data`ya YAZILMAZ (oranın kuralı
// "basılı sayfada olmayan alan hiç yazılmaz"), defterde durur ve kaynağı bu
// başlıktır.
//
// EKSEN, MODEL KODU DEĞİL KAPASİTEDİR: üreticinin her satırı bir soğutma
// BANDI verir (ör. "2,66 – 4,12 kW"); eksene bandın ALT UCU alınır, çünkü o
// yüksek ortam sıcaklığındaki gerçek kapasitedir ve seçim ona göre yapılır.
//
// ÜRETİCİ TABLOSU KENDİ İÇİNDE TUTARSIZ (ham HTML'den birebir doğrulandı):
// VKS-VP 420 (280 kg) bir küçüğü VP 350'den (385 kg) hafif; VP 1200 (510 kg)
// VP 1050'den (590 kg) hafif; PKS-PO 3000 (100 kg) PO 2000'den (105 kg) hafif.
// Sayılar DÜZELTİLMEDİ — uydurulmuş bir "düzeltme", yayımlanmış bir tuhaflıktan
// kötüdür. Ara değer alınırken bu satırlar eğriyi yerel olarak aşağı çeker;
// kritik bir işte üreticiye yazılı teyit ettirilmelidir.

// `interpolate` FİRMA DEFTERİNİN TEK DİKİŞ YERİNDEN gelir: `lib/weights`
// hiçbir dosyası `offers/cost`a doğrudan bağlanmaz (koruma testi ölçüyor).
import { interpolate } from "./firma-tablolari";

export interface KlimaAgirlikNoktasi {
  /** Bandın ALT ucu [kW] — yüksek ortam sıcaklığındaki kapasite. */
  kw: number;
  /** Ünitenin NET ağırlığı [kg]. */
  kg: number;
}

/**
 * SERİ → (kapasite, ağırlık) noktaları. Anahtar, katalog satırının `model`
 * alanıdır (`air_conditioner` türü: PKS-PO · WMU · VKS-VM · VKS-VC · VKS-VP ·
 * VKS-VS).
 */
export const KLIMA_AGIRLIK_EGRILERI: Readonly<Record<string, readonly KlimaAgirlikNoktasi[]>> = {
  // Pano tipi, ağır hizmet.
  "PKS-PO": [
    { kw: 2.22, kg: 105 },
    { kw: 2.54, kg: 100 },
    { kw: 4.09, kg: 115 },
  ],
  // Vinç kabini, orta hizmet. 350 gövdesi iki yerleşimde yayımlanmış
  // (115 ve 105 kg); AĞIR OLANI alınır — hafif olanı seçmek, dökümü
  // sistematik olarak düşük gösterirdi.
  "VKS-VM": [
    { kw: 2.25, kg: 115 },
    { kw: 2.73, kg: 100 },
    { kw: 3.39, kg: 130 },
    { kw: 4.67, kg: 140 },
  ],
  // Vinç kabini, kompakt ağır hizmet.
  "VKS-VC": [
    { kw: 2.66, kg: 280 },
    { kw: 3.44, kg: 330 },
    { kw: 4.15, kg: 370 },
  ],
  // Vinç kabini, paket / monoblok ağır hizmet.
  "VKS-VP": [
    { kw: 2.66, kg: 385 },
    { kw: 3.44, kg: 280 },
    { kw: 4.15, kg: 445 },
    { kw: 5.62, kg: 440 },
    { kw: 6.69, kg: 525 },
    { kw: 8.09, kg: 590 },
    { kw: 9.39, kg: 510 },
    { kw: 12.43, kg: 675 },
    { kw: 14.52, kg: 910 },
  ],
  // SPLIT: yayımlanan ağırlık DIŞ ÜNİTENİNDİR. Buradaki değer dış ünite + o
  // kapasiteye uyan WT tipi iç ünitedir; ikisi de vincin üzerindedir ve tek
  // bir "VS850 ağırlığı" eksik hesap verirdi.
  "VKS-VS": [
    { kw: 3.44, kg: 330 },
    { kw: 4.15, kg: 350 },
    { kw: 5.62, kg: 430 },
    { kw: 6.69, kg: 450 },
    { kw: 8.09, kg: 510 },
    { kw: 9.39, kg: 505 },
    { kw: 12.43, kg: 635 },
    { kw: 14.52, kg: 690 },
    { kw: 20.82, kg: 705 },
    { kw: 26.42, kg: 1025 },
  ],
  // Duvara montajlı endüstriyel tip. TEK gövde ("Single") değeridir; "Twin"
  // iki ayrı ünitedir ve adet ekipman satırından gelir.
  WMU: [
    { kw: 8.11, kg: 468 },
    { kw: 12.37, kg: 552 },
    { kw: 17.49, kg: 676 },
    { kw: 25.77, kg: 840 },
    { kw: 28.82, kg: 984 },
  ],
};

/** Bir serinin yayımlanmış kapasite aralığı — gerekçe metni bunu yazar. */
export function klimaKapasiteAraligi(seri: string): { min: number; max: number } | null {
  const egri = KLIMA_AGIRLIK_EGRILERI[seri.trim()];
  if (!egri || egri.length === 0) return null;
  return { min: egri[0].kw, max: egri[egri.length - 1].kw };
}

/**
 * Ünite başına ağırlık [kg] — seri tanınmıyorsa ya da yük bilinmiyorsa `null`.
 *
 * ARA DEĞER ALINIR (bu bir ürün seçimi değil bir ağırlık kestirimidir);
 * bandın DIŞINDA uç noktaya sabitlenir (`interpolate` deseni), çünkü serinin
 * yayımlanmış en büyük ünitesinden daha ağır bir üniteyi uydurmak yanlış olur
 * — bu durumda gerekçe "seri bandının dışında" der.
 */
export function klimaAgirligiKg(seri: string | undefined, gerekenKw: number | null): number | null {
  const egri = KLIMA_AGIRLIK_EGRILERI[(seri ?? "").trim()];
  if (!egri || egri.length === 0) return null;
  if (gerekenKw === null || !Number.isFinite(gerekenKw) || gerekenKw <= 0) return null;
  return interpolate(egri, gerekenKw, (p) => p.kw, (p) => p.kg);
}
