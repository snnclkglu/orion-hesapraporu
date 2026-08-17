// MALİYET ÇALIŞMASININ MODELİ — saf tipler, DB/HTTP/React yok (değişmez md. 7).
//
// Maliyet, teklifin İÇ YÜZÜDÜR: aynı belgeyi bir de bizim tarafımızdan anlatır.
// Teklif "müşteri ne öder" der, maliyet "bize neye mal olur" der. İkisi bir
// arada tek bir soruyu cevaplar: bu işi bu fiyata vermeli miyiz.
//
// PAYLOAD TEKLİFİNKİNDEN AYRI BİR NESNEDİR ve ayrı bir tabloda yaşar
// (`offer_cost_revisions.payload`). Teklifin payload'ına bir `cost` bloğu
// eklemek daha az iş olurdu ama iki şeyi birden bozardı:
//
//   1. MÜŞTERİYE GİDEN BELGE ile maliyet aynı nesnede dururdu ve PDF'i
//      basan yolda tek bir gözden kaçma marjımızı müşteriye yazdırırdı.
//      Ayrı tablo bunu YAPISAL olarak imkânsız kılar (MALIYET-1).
//   2. Yayımlanmış teklif revizyonu KİLİTLİDİR. Maliyet ise teklif
//      gönderildikten sonra da güncellenir (tedarikçi fiyatı değişir, montaj
//      keşfi netleşir) — kilitli bir belgenin içine yazmak gerekirdi.
//
// SATIR = MİKTAR × BİRİM FİYAT. Miktar MODELDEN türer (kg, adet, kW), birim
// fiyat İNSAN tarafından yazılır. Kullanıcı kararı (17.08.2026): *"maliyetlerin
// sabit tablo belli tablolar olması devre dışı; geri kalan hesap modeli yapısı
// ağırlık modeli yapısı kullanılabilir."* Yani fiyat aramalı tablo YOKTUR;
// ağırlık ve mekanizma modeli VARDIR.

import type { CraneClass } from "./params";

// ————————————————————————————————————————————————————————— girdi

/**
 * Bir maliyet kaleminin MÜHENDİSLİK GİRDİLERİ.
 *
 * Çoğu teklifin kendi teknik satırlarından OKUNUR (`inputsFromOfferItem`):
 * kapasite ve açıklık kalem künyesinden, kaldırma yüksekliği/hız/sınıf GENEL
 * ÖZELLİKLER ve KALDIRMA GRUBU satırlarından gelir. Okunamayan alan `null`
 * kalır ve UYDURULMAZ (değişmez md. 4) — modelin o dalı da boş döner.
 */
export interface CostInputs {
  /** Ana kaldırma kapasitesi [ton]. */
  capacityT: number | null;
  /** Yardımcı kaldırma kapasitesi [ton]; yoksa `null`. */
  auxCapacityT: number | null;
  /** Köprü açıklığı (portalde ayak açıklığı) [m]. */
  spanM: number | null;
  /** Kaldırma yüksekliği [m]. */
  liftHeightM: number | null;
  /** Kaldırma hızı [m/dk]. */
  liftSpeedMpm: number | null;
  /** Araba yürüme hızı [m/dk]. */
  trolleySpeedMpm: number | null;
  /** Köprü / portal yürüme hızı [m/dk]. */
  bridgeSpeedMpm: number | null;
  /** FEM mekanizma sınıfı — katsayıların tamamı buradan okunur. */
  craneClass: CraneClass;
  /** Ortam sıcaklığı [°C] — motor artırım katsayısı. */
  ambientC: number;
  /** Ana kiriş adedi (çift kirişli = 2). */
  girderCount: number;
  /** Portal ayak yüksekliği [m]; portal değilse `null`. */
  legHeightM: number | null;
  /** Portal / köprü teker adedi. */
  bridgeWheelCount: number;
  /** Portal (köprü) tahrik adedi. */
  bridgeDriveCount: number;
  /** Araba tahrik adedi. */
  trolleyDriveCount: number;
  /** Vincin PORTAL olup olmadığı — ayak modeli yalnız portalde çalışır. */
  gantry: boolean;
  /** Kapalı operatör kabini var mı. */
  cabin: boolean;
  /** Kabin RAY ÜZERİNDE hareketli mi (ayrı mekanizma ağırlığı). */
  movingCabin: boolean;
  /** Kiriş üstünde izolasyonlu elektrik odası var mı. */
  electricRoom: boolean;
  /** Isı kalkanı var mı (sıcak ortam vinçleri). */
  heatShield: boolean;
}

// ——————————————————————————————————————————————————— türetilen değer

/**
 * Modelin ürettiği bir sayı — ağırlık ya da hesap.
 *
 * `manual` teklif satırındaki anahtarın ikizidir (TEKLIF-5): makine önerir,
 * insan son sözü söyler. EZİLEN DEĞER AŞAĞIYA AKAR — ana kiriş ağırlığını elle
 * düzelten kullanıcı, köşe yükünün ve portal ayaklarının da onunla birlikte
 * değişmesini bekler. Bu yüzden ezme modelin İÇİNDE, adım adım uygulanır
 * (`hesapla`), sonuç üzerinde bir yama olarak değil.
 */
export interface CostOverride {
  key: string;
  value: number;
}

// ————————————————————————————————————————————————————— maliyet satırı

/**
 * Maliyet satırı — `MİKTAR × BİRİM FİYAT`.
 *
 * MİKTARIN İKİ KAYNAĞI VARDIR VE ASLA TOPLANMAZLAR (Ücret Planı'nın kuralı):
 * `qtySource` doluysa miktar MODELDEN okunur ve kutu salt okunur çizilir;
 * `qtyManual` açıksa insan yazar. Aynı satırda iki sayı yaşasaydı hangisinin
 * geçerli olduğu ekrana bakarak anlaşılamazdı.
 *
 * BİRİM FİYAT HER ZAMAN ELLEDİR. Fiyat aramalı bir tablo bu fazda bilerek
 * yoktur (kullanıcı kararı): ortalama fiyatla hesaplanan bir maliyet, teklifi
 * verirken doğru görünüp iş alındığında tutmayan türden bir sayıdır.
 */
export interface CostLine {
  id: string;
  /** Defterdeki tanımın kimliği; serbest satırda `serbest-…`. */
  key: string;
  /** BASILAN etiket — defterden gelir, düzenlenebilir (OfferRow.label kuralı). */
  label: string;
  /**
   * Miktarın MODEL ANAHTARI (`w.mainGirder`, `c.hoistMotorKw`). Boşsa miktar
   * elle yazılır. Model o anahtarı üretemiyorsa miktar `null` kalır — sıfır
   * DEĞİL (fiyatı olan ama miktarı bilinmeyen satır toplamı sessizce düşürürdü).
   */
  qtySource?: string;
  /** Elle yazılmış miktar; `qtySource` varken yalnız `qtyManual` ile geçerlidir. */
  qty: number | null;
  /** Model miktarını elle EZ. */
  qtyManual?: boolean;
  /** "kg" · "adet" · "kW" · "takım" · "m" — yalnız gösterim. */
  unit: string;
  /** Birim fiyat [para birimi / birim] — ELLE. */
  unitPrice: number | null;
  /** Serbest not (tedarikçi, marka, gerekçe). */
  note?: string;
  /** Satır toplamdan DÜŞER; verisi korunur (gizlemek silmek değildir). */
  hidden?: boolean;
}

/** Maliyet alt grubu — "ÇELİK YAPI", "KALDIRMA GRUBU"… */
export interface CostGroup {
  id: string;
  /** Defterdeki grup tanımının anahtarı; serbest grupta `custom`. */
  key: string;
  title: string;
  lines: CostLine[];
}

// ————————————————————————————————————————————————————— oranlı grup

export const COST_RATE_MODES = ["oran", "kalem"] as const;
export type CostRateMode = (typeof COST_RATE_MODES)[number];

/**
 * ORANLA HESAPLANAN maliyet grubu — sabit gider, sarf, finansman.
 *
 * Kullanıcı kararı (17.08.2026): *"Sarf Finansman ve Sabit Maliyetleri
 * oransal olarak gireceğim. Sarf %2, finansman %2, sabit giderler %15."*
 * TABAN PROJE MALİYETİDİR (kullanıcı seçimi): toplam = proje × (1 + Σoran).
 * Kendi kendini içeren bir taban (proje ÷ (1 − Σoran)) da sorulmuştu ve
 * REDDEDİLDİ — ASTOR örneğinde aradaki fark 8.658 €'dur, yani kararın bedeli
 * gerçektir ve bir varsayıma bırakılamazdı.
 *
 * KİP TEKTİR VE İKİ KAYNAK TOPLANMAZ: `oran` kipinde grup tutarı yüzdeden
 * türer ve satırlar yalnız NOT olarak durur; `kalem` kipinde satırların
 * toplamıdır ve yüzde hiç okunmaz. İkisini toplamak, aynı gideri iki kez
 * saymanın en kısa yoluydu.
 */
export interface CostRateGroup {
  key: string;
  title: string;
  mode: CostRateMode;
  /** Yüzde payı (15 = %15) — `oran` kipinde geçerli. */
  percent: number | null;
  /** `kalem` kipindeki satırlar. */
  lines: CostLine[];
}

// ————————————————————————————————————————————————————————— kalem

/**
 * Maliyetin bir EKİPMANI — teklifin bir kalemine karşılık gelir.
 *
 * `offerItemId` KİMLİK bağıdır, başlık benzerliği değil (TEKLIF-7'nin dersi:
 * devralınan bir belgede teknik bölüm ile fiyat satırı yalnız metinle
 * eşleşiyordu ve bir satırın tonajı yanlış yazılmıştı). Teklif kalemi
 * silinirse bağ KOPAR, maliyet kalemi serbest kalır — silinseydi girilen
 * fiyatlar sessizce kaybolurdu.
 */
export interface CostItem {
  id: string;
  /** Bağlı teklif kaleminin kimliği; serbest maliyet kaleminde `null`. */
  offerItemId: string | null;
  title: string;
  craneType: string;
  /** Bu üründen KAÇ ADET — paket maliyet = birim maliyet × adet. */
  qty: number | null;
  inputs: CostInputs;
  /** Modelin ürettiği sayıların ELLE EZİLMİŞ olanları (`w.*` / `c.*`). */
  overrides: Record<string, number>;
  /** PROJE MALİYETİ alt grupları. */
  groups: CostGroup[];
}

// ————————————————————————————————————————————————————————— belge

export interface CostPayload {
  version: number;
  /**
   * HANGİ TEKLİF REVİZYONUNDAN kuruldu — FOTOĞRAF.
   *
   * Maliyetin kendi revizyon zinciri vardır (kullanıcı kararı: *"ayrı zincir,
   * bağı kayıtlı"*) ve teklif R1'e geçtiğinde maliyet M0'da kalabilir. Bu alan
   * ekranın "bu maliyet R0'a göre kuruldu, teklif R1'de" diyebilmesi içindir —
   * sessiz bir ayrışma, kâr marjını yanlış gösterirdi.
   */
  sourceRevNo: number | null;
  currency: string;
  /**
   * MODEL KATSAYILARI — belgeye AİTTİR, koda değil.
   *
   * Açılışta koddaki varsayılanlardan kopyalanır (`COST_PARAM_DEFS`) ve o andan
   * sonra bu maliyet çalışmasının kendi sayılarıdır. Excel'de her iş için
   * çalışma kitabı kopyalanıp katsayılar o işe göre ayarlanıyordu ("V3: ayaklar
   * -%10"); model bunu olduğu gibi taşır. Global bir defter yapılsaydı geçmiş
   * bir maliyet çalışması, bugün değişen bir katsayı yüzünden başka bir sayı
   * gösterirdi.
   */
  params: Record<string, number>;
  items: CostItem[];
  /**
   * PROJE GENELİ giderler — tek bir vince atfedilemeyen kalemler
   * (dokümantasyon, saha genel giderleri, nakliye organizasyonu).
   * Excel'de de ayrı bir öbektir ("PROJE GENELİ KALEMLER (götürü)").
   */
  general: CostGroup;
  /** Sabit · sarf · finansman — sırası ekranda ve belgede aynıdır. */
  rates: CostRateGroup[];
  notes: string;
  /**
   * PROJE MALİYETİ — oranların TABANI. Türetilir (`withCostTotals`), elle
   * girilmez; veritabanındaki `direct_amount` üretilmiş sütunu bunu okur.
   */
  direct: number | null;
  /**
   * TOPLAM MALİYET = proje maliyeti + oranlı gruplar.
   *
   * Payload'a YAZILIR çünkü `offer_cost_revisions.total_amount` üretilmiş
   * sütunu onu okur ve teklif paneli maliyet belgesini açmadan kâr marjını
   * gösterebilir. Ekranda hesaplanıp yazılmasaydı iki farklı toplam dolaşırdı
   * (teklifteki `pricing.total` ile aynı gerekçe).
   */
  total: number | null;
}

// ————————————————————————————————————————————————— defter (registry)

/** Maliyet satırının defterdeki tanımı. */
export interface CostLineDef {
  key: string;
  label: string;
  unit: string;
  /** Miktarı besleyen model anahtarı (`w.*` ağırlık, `c.*` hesap). */
  qtySource?: string;
  /** Alanın altındaki kısa açıklama. */
  hint?: string;
}

export interface CostGroupDef {
  key: string;
  title: string;
  lines: CostLineDef[];
}

/** Vinç tipine göre maliyet iskeleti — `offer_cost_templates.skeleton`. */
export interface CostTemplateSkeleton {
  groupKeys?: string[];
}
