// TEKLİF BELGESİNİN MODELİ — saf tipler, DB/HTTP/React yok (değişmez md. 7).
//
// Belgenin TAMAMI tek bir `OfferPayload` nesnesidir ve revizyonun `payload`
// sütununda snapshot olarak durur. Ekran, PDF ve karşılaştırma üçü de aynı
// nesneyi okur; ikinci bir "sunum modeli" yazılsaydı müşteriye giden belge ile
// ekrandaki teklif sessizce ayrışırdı (İş Takibi'nde bir kez yaşandı,
// bkz. `worklog/filters.ts`).

// ————————————————————————————————————————————————————————————— satır

/**
 * Teklif satırı — `Etiket : Değer` biçiminde basılan bir bilgi.
 *
 * SATIR BİR DEĞER TAŞIR, BİR HESAP DEĞİL. `parts` doldurulduğunda `value`
 * ondan DERLENİR (`composeRow`); kullanıcı değeri elle yazarsa `manual` açılır
 * ve derleme onu bir daha ezmez. Mühendislik motorundaki `*Auto` anahtarının
 * aynısıdır: makine önerir, insan son sözü söyler.
 */
export interface OfferRow {
  /** Kanonik anahtar (`motor`, `gearbox`, `rope`…) — defterdeki tanımın kimliği. */
  key: string;
  /**
   * BASILAN etiket. Defterden gelir ama DÜZENLENEBİLİR: teklifler yıllar içinde
   * "Köprü ve Araba Limiti" ile "Araba Limiti" arasında gidip geldi ve ikisi de
   * meşru yazımdır. Kanonik anahtar sabit kalır, etiket belgeye aittir.
   */
  label: string;
  /** BASILAN değer. */
  value: string;
  /** Değeri oluşturan parçalar (marka, güç, devir, seçenekler…). */
  parts?: Record<string, string>;
  /** Değer elle yazıldı — `parts` değişse bile `value` korunur. */
  manual?: boolean;
  /** Satır belgeden DÜŞER (bkz. `printedRows`). */
  hidden?: boolean;
  /** Değerin nereden geldiği; öneri altyapısının kancası (bkz. `suggest.ts`). */
  source?: OfferRowSource;
}

export type OfferRowSource = "manual" | "catalog" | "suggested";

// ————————————————————————————————————————————————————————————— grup

/** Teknik özellik öbeği — `KALDIRMA GRUBU :` gibi bir başlık ve satırları. */
export interface OfferGroup {
  /** Benzersiz kimlik (aynı kalemde iki "custom" grup olabilir). */
  id: string;
  /** Defterdeki grup tanımının anahtarı; serbest grupta `"custom"`. */
  key: string;
  title: string;
  hidden?: boolean;
  rows: OfferRow[];
}

// ————————————————————————————————————————————————————————————— kalem

/**
 * Teklifin bir EKİPMANI: bir vinç, bir kaldırma kirişi, bir kabin.
 *
 * `id` KALICIDIR ve fiyat satırı buna bağlanır. Devralınan tekliflerde teknik
 * bölüm ile fiyat satırı yalnız BAŞLIK METNİYLE eşleşiyordu; 22 vinçlik bir
 * belgede bir satırın tonajı yanlış yazılmıştı ve hata ancak müşteri sorunca
 * görüldü. Bağ bir kimliktir, bir benzerlik değil.
 */
export interface OfferItem {
  id: string;
  /** "20T ÇİFT KİRİŞ GEZER KÖPRÜLÜ VİNÇ" — belgede bölüm başlığı olur. */
  title: string;
  /**
   * KALEM KÜNYESİ — vinç tipi, kapasite ve açıklık.
   *
   * Bunlar teknik özellik SATIRI DEĞİLDİR ve bilerek ayrıdırlar. İki işleri
   * var: teklif listesinde SÜZGEÇ olurlar ("32 tonluk portal vinç teklifim
   * hangisiydi") ve ileride öneri motorunun girdisidirler (`suggest.ts`).
   * Basılan `Kaldırma Kapasiteleri (Q) : 20.000 kg` satırı BUNDAN AYRIDIR;
   * belgenin yazımı yıllar içinde kg, ton ve "30 / 5 Ton" arasında gidip
   * geldi ve o metni bir sayıdan üretmek yazımı kelepçelerdi. Künyedeki sayı
   * ise her zaman TONDUR ve tek anlamlıdır.
   */
  craneType?: string;
  capacityT?: number | null;
  spanM?: number | null;
  hidden?: boolean;
  groups: OfferGroup[];
}

// ————————————————————————————————————————————————————————— ticari

/** Ödeme planının bir satırı: "%40 Avans Sipariş ile Nakit". */
export interface OfferPaymentLine {
  id: string;
  text: string;
  hidden?: boolean;
}

/**
 * Fiyat satırı.
 *
 * `inTotal` YANLIŞ OLABİLİR ve bu gerçek bir ihtiyaçtır: devralınan bir
 * teklifte "Montaj Süpervizör Hizmeti · 1 Kişi · 400 Euro/Gün" satırının
 * toplam hücresi bilerek boş bırakılmış ve TOPLAM'a girmemişti. Satırı
 * silmek bilgiyi, toplama katmak rakamı bozardı.
 */
export interface OfferPriceLine {
  id: string;
  /** Hangi teknik kalemi fiyatlandırıyor — serbest satırda `null`. */
  itemId: string | null;
  description: string;
  qty: number | null;
  /** "Takım" · "Adet" · "Kişi" · "Metre" — defterden seçilir. */
  unit: string;
  unitPrice: number | null;
  /** Toplama girsin mi. */
  inTotal: boolean;
  /** Belgede "(Opsiyonel)" rozetiyle görünür. */
  optional?: boolean;
  hidden?: boolean;
}

export interface OfferPricing {
  /** Teklifin TEK para birimi — satır bazında karışık kur teklifte görülmedi. */
  currency: string;
  /**
   * Fiyatlar KDV DAHİL Mİ. Devralınan tekliflerde aynı sayfada hem
   * "KDV Dahil ödeme şekli" hem "fiyatlara KDV dahil değildir" yazıyordu;
   * iki cümle de bu TEK bayraktan türetilir ve çelişemez.
   */
  vatIncluded: boolean;
  lines: OfferPriceLine[];
  /**
   * Toplam — `offerTotal` ile hesaplanır ve payload'a YAZILIR.
   * Veritabanı `total_amount` üretilmiş sütununu buradan okur; liste ekranı
   * belgeyi açmadan tutarı görebilsin diye.
   */
  total: number | null;
}

// ————————————————————————————————————————————————————————— kapak

export interface OfferSignatory {
  name: string;
  title: string;
}

export interface OfferCover {
  /** KİMDEN — teklifi hazırlayan. */
  fromName: string;
  fromTitle: string;
  fromEmail: string;
  /** KİME — muhatap. */
  toName: string;
  toDept: string;
  toPhone: string;
  /** Müşterinin kendi talep/sipariş numarası (varsa). */
  customerRef: string;
  /** "Sn. … Bey," — hitap satırı. */
  greeting: string;
  /** Giriş paragrafı. */
  intro: string;
  signatories: OfferSignatory[];
  hidden?: boolean;
}

// ————————————————————————————————————————————————————————— belge

/** TEST YÜKÜ bloğu — belgede iki farklı yerde durabiliyor. */
export interface OfferTestLoad {
  enabled: boolean;
  title: string;
  /** "teknik" = son kalemin ardında · "ticari" = ticari şartların üstünde. */
  position: "teknik" | "ticari";
  rows: OfferRow[];
}

export interface OfferPayload {
  /** Şema sürümü — `withDefaults` eski kayıtları buna bakarak taşır. */
  version: number;
  cover: OfferCover;
  items: OfferItem[];
  testLoad: OfferTestLoad;
  /** "FİYAT, TESLİM VE ÖDEME ŞEKLİ" künyesi. */
  terms: {
    title: string;
    rows: OfferRow[];
    paymentLines: OfferPaymentLine[];
  };
  pricing: OfferPricing;
  /** NOTLAR — sırası anlamlı, madde işareti yok. */
  notes: OfferTextLine[];
  /** KAPSAM DIŞI İŞLER — madde işaretli liste. */
  exclusions: OfferTextLine[];
}

/** Serbest metin maddesi (not / kapsam dışı) — gizlenebilir olması için nesne. */
export interface OfferTextLine {
  id: string;
  text: string;
  hidden?: boolean;
}

// ————————————————————————————————————————————— defter (registry) tipleri

/**
 * Bir satırın değerini oluşturan PARÇA.
 *
 * Parçalar SIRALIDIR ve boş olan sessizce düşer: motor markası girilmemişse
 * değer "22 kW 1500 d/dak" olur, başında boşlukla değil.
 */
export interface OfferPartDef {
  key: string;
  label: string;
  /** `offer_options.list_key` — bu parça bir açılır listeden seçilir. */
  list?: string;
  /**
   * Liste KADEMELİDİR: seçenekleri, adı verilen parçanın seçili değerinin
   * ÇOCUKLARIDIR (marka → tip/seri).
   */
  childOf?: string;
  /** Sayı kutusu olarak çizilir (yine metin saklanır — "22,5" meşrudur). */
  numeric?: boolean;
  prefix?: string;
  suffix?: string;
  /**
   * Bu parça ve sonrasındakiler değere VİRGÜLLE eklenir:
   * "GAMAK 22 kW 1500 d/dak, Encoderli, F/S3".
   */
  comma?: boolean;
}

export interface OfferRowDef {
  key: string;
  label: string;
  /** Parçasız satır: değer doğrudan yazılır ya da tek listeden seçilir. */
  list?: string;
  parts?: OfferPartDef[];
  /** Alanın altındaki kısa açıklama. */
  hint?: string;
}

export interface OfferGroupDef {
  key: string;
  title: string;
  /** Şablon bu grubu kurduğunda hangi satırlar gelsin. */
  rows: OfferRowDef[];
}
