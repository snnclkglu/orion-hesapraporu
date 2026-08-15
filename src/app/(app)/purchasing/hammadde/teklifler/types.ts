// TEKLİFLER EKRANININ TİPLERİ — sunucu ile istemcinin ortak sözleşmesi.
//
// Ayrı bir dosyada durmalarının sebebi bir düzen zevki değil: tipleri görünüm
// dosyasında tutmak, `batch-dialog.tsx` gibi bir PENCERENİN listeyi çizen
// bileşeni import etmesine yol açıyordu — pencere listeyi hiç bilmiyor ve
// bilmemeli.

import type { KarsilastirmaTablosu } from "@/lib/purchasing/hammadde/karsilastirma";

export type Pay = { itemNo: string; packageId: string; partKey: string; adet: number };

/** Bir FİRMANIN teklifi — ekrana giden yüzü; sunucuda kurulur. */
export interface PartiOzeti {
  id: string;
  code: string;
  supplier: string;
  quotedAt: string;
  status: string;
  note: string;
  cancelReason: string;
  vadeGun: number;
  paraBirimi: string;
  kur: number | null;
  toplamEur: number;
  kalemSayisi: number;
  /** Miktarı bilinmediği için tutarı hesaplanamayan kalem sayısı. */
  miktarsizKalem: number;
  satirlar: {
    quoteId: string;
    key: string;
    tanim: string;
    miktar: number | null;
    birim: string;
    birimFiyat: number;
    paraBirimi: string;
    kur: number | null;
    birimFiyatEur: number | null;
    tutarEur: number | null;
    teslimGun: number | null;
  }[];
}

/**
 * BİR TEKLİF — yani SORULAN SORU (`TT0003`).
 *
 * Kullanıcı kararı (15.08.2026): *"Birkaç firmadan aynı teklifi aldığımda
 * burada görebileyim. Teklifin üstüne tıkladığımda bir pop up açılsın ve hangi
 * firma ne teklif verdi görebileyim."* Listenin satırı budur; firmaların
 * cevapları `partiler` altındadır.
 */
export interface TalepGorunumu {
  /** Talep kimliği; talebi olmayan (devralınan) parti için `parti:<id>`. */
  id: string;
  code: string;
  baslik: string;
  /** Talebin kendi kaydı var mı? Yoksa ad değiştirme ve birleştirme kapalıdır. */
  gercek: boolean;
  partiler: PartiOzeti[];
  /** YALNIZ AÇIK partilerden kurulmuş karşılaştırma. */
  tablo: KarsilastirmaTablosu;
  kalemSayisi: number;
  firmaSayisi: number;
  ilkTarih: string;
  sonTarih: string;
  /** Bütün partileri iptal edilmiş bir teklif listede soluk durur. */
  tamameniIptal: boolean;
}
