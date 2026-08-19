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
  /** Birim fiyat [para birimi / birim] — şeritten ya da ELLE. */
  unitPrice: number | null;
  /**
   * Birim fiyatın HAMMADDE ŞERİDİNDEKİ kaynağı (`sac`, `boya`, `kesim`…).
   *
   * MİKTARIN `qtySource`UNUN İKİZİDİR ve aynı kuralı taşır: İKİ KAYNAK ASLA
   * TOPLANMAZ. Kaynak doluysa fiyat şeritten okunur ve kutu salt okunur
   * çizilir; `priceManual` açıksa bu satırda insan yazar ve şerit ona
   * dokunmaz. Kullanıcı isteği (18.08.2026): *"hammadde birim fiyatlarını en
   * üste sırala, buradan alt bölümler değişsin."*
   *
   * ESKİ BELGELERDE BOŞTUR ve bu bilinçlidir: alan yokken kaydedilmiş bir
   * satırın fiyatı elle girilmiştir, şeridin onu ele geçirmesi girilmiş bir
   * sayıyı sessizce değiştirmek olurdu.
   */
  priceSource?: string;
  /** Şerit fiyatını bu satırda elle EZ. */
  priceManual?: boolean;
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
  /**
   * GÖTÜRÜ KİP — grup tek bir fiyat satırına iner.
   *
   * Kullanıcı isteği (18.08.2026): *"Elektrik Otomasyon fiyatında istersem tek
   * fiyat girebileyim. Bir tuş olsun."* Tedarikçi kimi zaman panoyu, sürücüyü
   * ve işçiliği TEK KALEMDE fiyatlar; o teklifi on üç satıra bölmek uydurma
   * bir dağılım üretirdi (değişmez md. 4).
   *
   * KİP SATIRLARI SİLMEZ, GİZLER: götürüye geçen grubun kalem satırları
   * `hidden` olur ve verisi durur. Geri dönüldüğünde girilmiş bütün fiyatlar
   * yerindedir — her biri bir tedarikçi görüşmesidir.
   */
  lump?: boolean;
}

/**
 * GÖTÜRÜ SATIRIN ANAHTAR ÖNEKİ.
 *
 * Anahtar grup anahtarından türer (`gotur-electrical`) ve SABİTTİR: götürüye
 * geçip geri dönen bir grup aynı satırı bulmalıdır, yoksa girilen götürü
 * fiyat her turda kaybolurdu.
 */
export const LUMP_LINE_PREFIX = "gotur-";

export function lumpLineKey(groupKey: string): string {
  return `${LUMP_LINE_PREFIX}${groupKey}`;
}

export function isLumpLine(line: CostLine): boolean {
  return line.key.startsWith(LUMP_LINE_PREFIX);
}

/**
 * GRUBUN SAYILAN SATIRLARI — kipe göre.
 *
 * Götürü kipte YALNIZ götürü satır, kalem kipinde yalnız kalem satırları
 * okunur. İKİ KAYNAK ASLA TOPLANMAZ (oranlı grubun kipiyle aynı kural,
 * MALIYET-5): ikisini birden saymak, elektriği hem kalem kalem hem de götürü
 * olarak faturalamak demekti. Toplam, ekran ve belge bu tek fonksiyondan
 * geçer ki üçü aynı satırları görsün.
 */
export function costGroupLines(group: CostGroup): CostLine[] {
  return group.lump ? group.lines.filter(isLumpLine) : group.lines.filter((l) => !isLumpLine(l));
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
  /**
   * HAMMADDE BİRİM FİYATLARI — belgeye AİTTİR, koda değil (`params`in kardeşi).
   *
   * Kullanıcı isteği (18.08.2026): *"Proje maliyetlerinin en üstünde hammadde
   * birim fiyatlarını girebileceğim yer olsun … buradan alt bölümler
   * değişsin."* Sac fiyatı bir maliyet çalışmasında bir kez yazılır ve
   * hammadde, kesim, boya, imalat işçiliği satırlarının hepsini birden
   * besler; her satıra ayrı ayrı yazmak aynı sayıyı beş kez girmek olurdu.
   *
   * BELGEDE YAŞAR, GLOBAL BİR DEFTERDE DEĞİL — `params`in gerekçesiyle aynı
   * (MALIYET-6): sac bugün 0,80 €'ya çıktı diye geçen ayın maliyet çalışması
   * başka bir rakam göstermemelidir.
   *
   * GİRİLMEMİŞ FİYAT `null`DIR, sıfır değil: bağlı satır "—" gösterir ve
   * toplama girmez (değişmez md. 4).
   */
  materialPrices: Record<string, number | null>;
  items: CostItem[];
  /**
   * MALİYETTEN ÇIKARILMIŞ teklif kalemlerinin kimlikleri.
   *
   * Kullanıcı isteği (18.08.2026, md. 1): *"Teklif kısmından bir kalemi
   * silebiliyorum ama maliyet kısmından silemiyorum."* Silme eklendi ve tek
   * başına YETMEDİ: `withOfferSync` EKLEYİCİDİR (MALIYET-9) ve teklifte
   * duran bir kalemi ilk tazelemede geri getirirdi. Kullanıcı sildiğini geri
   * gelmiş görünce silmenin çalışmadığını düşünürdü.
   *
   * KARARIN KENDİSİ SAKLANIR, sonucu değil: liste "bu teklif kalemini
   * maliyetlemiyoruz" der. Ekran bunu görünür tutar ve geri alma sunar —
   * sessizce eksilen bir kalem, maliyeti olduğundan ucuz gösterirdi.
   */
  removedOfferItemIds: string[];
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
  /** Birim fiyatı besleyen hammadde şeridi anahtarı (`sac`, `boya`…). */
  priceSource?: string;
  /** Alanın yanındaki kısa açıklama. */
  hint?: string;
}

/** Hammadde şeridindeki bir birim fiyatın tanımı. */
export interface CostMaterialPriceDef {
  key: string;
  label: string;
  /** Birim ("€/kg" değil "kg" — para birimi belgeden gelir). */
  unit: string;
  /**
   * ÖN TANIMLI FİYAT — yalnız gerçekten bilinen bir sayı için doldurulur.
   * Bilinmeyen fiyat `null` kalır; ortalama ya da temsilî bir sayı yazmak
   * maliyeti "girildi" göstermenin en kısa yoluydu (değişmez md. 4).
   */
  value: number | null;
  hint?: string;
}

export interface CostGroupDef {
  key: string;
  title: string;
  lines: CostLineDef[];
}

/**
 * VİNÇ TİPİNE GÖRE MALİYET İSKELETİ — `offer_cost_templates.skeleton`.
 *
 * Kullanıcı isteği (19.08.2026, md. 10): *"Maliyet bölümüne hangi grup vinçte
 * örneğin Tek Kirişli Vinçte, maliyet bölümlerinin ve o bölümlerin içinde
 * hangi kalemlerin geldiğini gösteren, bunlara ekleme yapabileceğim bir sayfa
 * yapsak. Kontrolü daha kolay olur."*
 *
 * İSKELET ETİKET/BİRİM/MİKTAR KAYNAĞI TAŞIMAZ, yalnız ANAHTAR taşır. Defterin
 * kendisi (`registry.ts`) tek kaynaktır; kopyalansaydı defter genişlediğinde
 * şablonlar eskir ve iki yer birbirinden ayrışırdı (`offer_templates`in aynı
 * gerekçesi).
 *
 * SATIR TARAFI BEYAZ LİSTE DEĞİL KARA LİSTEDİR (`closedLines`). Bir vinç
 * tipinde "hangi satırlar gelsin" diye seçilenleri saklamak, kaydedildiği
 * ANDAKİ defteri dondururdu: koda sonradan eklenen bir kalem (BORVERK
 * İŞLEME gibi) o tiplerde hiç açılmaz ve eksikliği ancak aylar sonra fark
 * edilirdi. Kapatılanı saklamak tersini yapar — defter büyüdükçe yeni satır
 * her tipte kendiliğinden görünür, kullanıcının verdiği KARAR ise korunur.
 *
 * GRUP TARAFI AÇIK LİSTEDİR çünkü kullanıcının kararının kendisi odur:
 * "Kaldırma Kirişi'nde yürütme grubu hiç açılmasın" bir eksiklik değil bir
 * tercihtir ve sekiz grubun listesi ekranda bütünüyle görünür.
 */
export interface CostTemplateSkeleton {
  /** Bu tipte açılacak maliyet grupları; verilmezse defterin varsayılan kümesi. */
  groupKeys?: string[];
  /** Grup başına AÇILMAYACAK defter satırları — kapatma, silme değil. */
  closedLines?: Record<string, string[]>;
}

/** Defterdeki bir maliyet şablonu satırı — vinç tipi ↔ iskelet. */
export interface CostTemplate {
  /** Teklif kaleminin `craneType` metniyle eşleşir (katlanmış karşılaştırma). */
  craneType: string;
  skeleton: CostTemplateSkeleton;
}
