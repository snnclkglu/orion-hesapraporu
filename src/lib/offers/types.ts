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
  /**
   * KAPSAM — bu kalemi kim tedarik ediyor.
   *
   * Kullanıcı isteği (17.08.2026): *"bazen müşteri arabanın frenini ben
   * vereceğim diyebiliyor … Otomatik olarak Orion Kapsamı gelsin, Orion
   * Kapsamı ise PDF'te görünmesine gerek yok. Müşteri Kapsamı seçersem
   * PDF'te görünsün."*
   *
   * Varsayılan `orion`dur ve BELGEDE İZ BIRAKMAZ: bir teklifte satırların
   * neredeyse tamamı zaten bizim kapsamımızdadır, her satıra "Orion Kapsamı"
   * yazmak belgeyi okunmaz yapardı. İstisna görünür olandır.
   */
  scope?: OfferRowScope;
  /** Değerin nereden geldiği; öneri altyapısının kancası (bkz. `suggest.ts`). */
  source?: OfferRowSource;
}

export const OFFER_ROW_SCOPES = ["orion", "customer"] as const;

export type OfferRowScope = (typeof OFFER_ROW_SCOPES)[number];

export const OFFER_ROW_SCOPE_LABELS: Record<OfferRowScope, string> = {
  orion: "Orion Kapsamı",
  customer: "Müşteri Kapsamı",
};

/** Belgede basılan kapsam eki; `orion` için YOKTUR. */
export function offerScopeSuffix(scope: OfferRowScope | undefined): string {
  return scope === "customer" ? " (Müşteri Kapsamında)" : "";
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
  /**
   * BAŞLIK ELLE YAZILDI — türetme (`withAutoTitle`) onu bir daha EZMEZ.
   *
   * Satırdaki `manual` anahtarının kalem düzeyindeki ikizidir ve aynı gerekçeyle
   * vardır (kullanıcı isteği, 17.08.2026: *"otomatik gelsin, istersem
   * düzenleyebileyim"*): kapasite düzeltilince başlık kendiliğinden tazelenir,
   * ama kullanıcı bir kez kendi adını yazdıysa o ad kalır.
   */
  titleManual?: boolean;
  groups: OfferGroup[];
}

// ————————————————————————————————————————————————————————— ticari

/**
 * Ödeme planının bir satırı: "%40 Avans Sipariş ile Nakit".
 *
 * Kullanıcı isteği (17.08.2026): *"Örneğin 4 kutu yaptıysam %30 %30 %20 %20
 * seçeyim kutulara, toplamı kesin %100 olsun. Kutuların yanında bir tane daha
 * kutu olsun, oraya açıklamasını seçeyim."*
 *
 * `text` BASILAN metindir ve `percent` + `desc`ten DERLENİR
 * (`paymentLineText`). Serbest metin olarak da yazılabilir — devralınan
 * tekliflerde yüzde taşımayan satırlar var ("30.000 Euro Sipariş ile Nakit",
 * "Montaj Sonrası Kalan Nakit") ve onları bir yüzdeye zorlamak yanlış olurdu.
 */
export interface OfferPaymentLine {
  id: string;
  text: string;
  /** Yüzde payı; serbest yazılmış satırda `null`. */
  percent?: number | null;
  /** Yüzdenin açıklaması — defterden seçilir ("Avans Sipariş ile Nakit"). */
  desc?: string;
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
  /**
   * Bu satır hangi ANA fiyat satırının alt kalemidir.
   *
   * `null` ise ana satırdır ve 1, 2, 3… diye numaralanır. Önceki bir ana
   * satırın kimliği verilirse PDF'de 1.1, 1.2… görünür. Bağ sıra metniyle
   * değil kimlikle kurulur; üst satırın açıklaması değişince ilişki kopmaz.
   */
  parentLineId?: string | null;
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
  /**
   * SERBEST SATIRIN ELLE GİRİLEN MALİYETİ — yalnız `itemId === null` iken.
   *
   * Kullanıcı isteği (18.08.2026): *"Teklif fiyat kısmında serbest eklediğim
   * satırların maliyetini tabloda kendim girebileyim."* MALIYET-11 serbest
   * satırda maliyeti "—" gösteriyordu ve gerekçesi doğruydu: maliyet
   * belgesinde o satırın karşılığı YOKTUR, uydurma bir sayı yazmak sahte bir
   * kâr üretirdi (değişmez md. 4). Ama İNSANIN yazdığı sayı uydurma değildir:
   * nakliye, montaj kirası ya da bir ara ürünün alış fiyatı tam olarak
   * bilinen şeylerdir.
   *
   * MÜŞTERİYE GİTMEZ. Bu alan teklif payload'ında yaşar ama `printedPayload`
   * onu belgeye BASMAZ — teklif PDF'inde maliyet diye bir sütun yoktur ve
   * olmamalıdır (MALIYET-1'in yapısal ayrımı).
   *
   * KALEME BAĞLI SATIRDA OKUNMAZ: orada maliyet, maliyet belgesinin GENEL GİDER DAHİL
   * maliyetidir. İki kaynak asla toplanmaz — kaleme bağlanan bir satırın elle
   * yazılmış sayısı ekranda görünmez (veri korunur, bağ koparsa geri gelir).
   */
  manualCost?: number | null;
  /**
   * SATIRIN KENDİ TESLİM SÜRESİ — `"6-7"`, `"10"`, `"12-14"`.
   *
   * SAYI DEĞİL METİNDİR: kullanıcının yazdığı şey çoğu zaman bir ARALIKTIR
   * ("6-7") ve tek bir sayı alanı onu taşıyamaz; iki alan (en az / en çok)
   * açmak da sütunu iki kutuya bölerdi. Birim satırda DEĞİL sütun başlığında
   * durur (`OfferPricing.leadTimeUnit`) — her satıra "hafta" yazmak dar bir
   * sütunu okunmaz yapardı.
   *
   * Sütun kapalıyken değer KORUNUR ama basılmaz: kullanıcı sütunu kapatıp
   * yeniden açtığında yazdıkları yerinde durur.
   */
  leadTime?: string;
}

/** Kalem bazında teslim süresinin birimi — sütun BAŞLIĞINDA görünür. */
export type OfferLeadTimeUnit = "hafta" | "ay";

export interface OfferPricing {
  /** Teklifin TEK para birimi — satır bazında karışık kur teklifte görülmedi. */
  currency: string;
  /**
   * Fiyatlar KDV DAHİL Mİ. Devralınan tekliflerde aynı sayfada hem
   * "KDV Dahil ödeme şekli" hem "fiyatlara KDV dahil değildir" yazıyordu;
   * iki cümle de bu TEK bayraktan türetilir ve çelişemez.
   */
  vatIncluded: boolean;
  /**
   * KALEM BAZINDA TESLİM SÜRESİ SÜTUNU — kapalıysa `null`.
   *
   * Kullanıcı isteği (22.08.2026): *"bazen kalem bazında teslim süresi vermem
   * gerekiyor… ay mı hafta mı olduğunu seçip sütunlara sayı yazayım."*
   * Açıldığında fiyat tablosuna ADET'in SOLUNDA dar bir sütun eklenir ve
   * başlığı birimi taşır ("TESLİM SÜRESİ (HAFTA)").
   *
   * `null` = sütun KAPALI, sıfır ya da boş bir birim DEĞİL: teslim süresi
   * verilmemiş bir teklifte ticari şartlardaki TEK teslim süresi geçerlidir
   * ve boş bir sütun müşteriye "burada bir şey eksik" diye okunurdu.
   */
  leadTimeUnit?: OfferLeadTimeUnit | null;
  lines: OfferPriceLine[];
  /**
   * İSKONTOLU TOPLAM — müşterinin gerçekten ödeyeceği tutar.
   *
   * Kullanıcı isteği (17.08.2026): *"Fiyat kısmının en sonuna iskontolu toplam
   * fiyat girebileceğim bir kısım olsun. İstersem birim fiyatları da o oranda
   * düşürsün, yuvarlama yapsın ama toplam tutsun."*
   *
   * ORAN DEĞİL TUTAR saklanır: pazarlık masasında konuşulan şey "şu fiyata
   * verelim"dir, bir yüzde değil. Yüzde tutardan TÜRETİLİR (`discountPercent`)
   * ve böylece belgede yazan sayı ile kullanıcının yazdığı sayı ayrışamaz —
   * `%7,5` saklanıp yuvarlanmış bir tutar basılsaydı ikisi çelişirdi.
   *
   * `null` = iskonto YOK (sıfır değil): sıfır bir iskonto kararıdır, boş ise
   * kararın hiç verilmemiş olmasıdır.
   */
  discountTotal?: number | null;
  /**
   * Toplam — `effectiveTotal` ile hesaplanır ve payload'a YAZILIR.
   * Veritabanı `total_amount` üretilmiş sütununu buradan okur; liste ekranı
   * belgeyi açmadan tutarı görebilsin diye. İSKONTO VARSA ONU taşır: liste
   * ekranındaki rakam müşterinin ödeyeceği rakamdır.
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
  /**
   * MUHATABIN E-POSTASI (kullanıcı isteği, 22.08.2026, md. 1: *"Müşteriler
   * sayfasında kişi e-postası alıyoruz. Ancak teklifte Kime kısmında e-posta
   * yeri yok. otomatik gelsin. Teklif pdf'e de ekleyelim."*).
   *
   * `fromEmail`in KARŞILIĞIDIR ve ayrı bir alandır: telefonla e-posta aynı
   * satırda taşınsaydı ("0532… · ali@…") kapak künyesi ikisini ayıramaz,
   * yalnız biri bilinen bir muhatapta da ayıraç boşta kalırdı (TEKLIF-36).
   */
  toEmail: string;
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
  /** Ticari sayfanın başlığı — "TESLİM VE ÖDEME ŞEKLİ" (md. 16). */
  terms: {
    title: string;
    rows: OfferRow[];
    paymentLines: OfferPaymentLine[];
  };
  pricing: OfferPricing;
  /** NOTLAR — sırası anlamlı; belgede madde işaretiyle basılır (md. 17). */
  notes: OfferTextLine[];
  /** KAPSAM DIŞI İŞLER — madde işaretli liste. */
  exclusions: OfferTextLine[];
  /** GENEL ŞARTLAR — belgenin son sayfasındaki hukukî beyan. */
  generalTerms: OfferGeneralTerm[];
}

/** Serbest metin maddesi (not / kapsam dışı) — gizlenebilir olması için nesne. */
export interface OfferTextLine {
  id: string;
  text: string;
  hidden?: boolean;
}

/**
 * GENEL ŞART MADDESİ — son sayfada küçük ve silik basılan hukukî metnin bir maddesi.
 *
 * Kullanıcı isteği (18.08.2026, md. 9): *"Teklifin son sayfasına daha küçük ve
 * biraz silik bir yazı ile genel şartlar yazsın. Bu şart maddelerini ben
 * istersem bazılarını açıp kapatabileyim … yeni madde açabileyim
 * değiştirebileyim. Madde numaraları da buna göre düzelsin."*
 *
 * `OfferTextLine` YETMEZ; üç sebeple ayrı bir tiptir:
 *
 * **BAŞLIK VE GÖVDE İKİ ALANDIR** çünkü belgede iki türlü dizilirler: başlık
 * satır başında ve koyu, paragraf altında ve silik. Tek bir `text` alanında
 * ikisi ancak bir ayraçla ("ilk satır başlıktır" ya da "**…**") taşınabilirdi
 * ve o ayracı belgeyi dizen tarafın ÇÖZMESİ gerekirdi — biçim veriye gömülmüş
 * olurdu.
 *
 * **NUMARA VERİ DEĞİLDİR.** Gizlenen madde numarasını da götürür — kullanıcının
 * isteğinin ta kendisi budur. Numara metne gömülseydi ("3. Fiyat ve Ödeme")
 * üçüncü madde kapatıldığında belge "1, 2, 4, 5…" diye basar, düzeltmek için de
 * on maddenin metnini elden geçirmek gerekirdi. Bu yüzden numara hiçbir yerde
 * SAKLANMAZ; süzgeçten SONRA sıradan türetilir (`printedGeneralTerms`).
 *
 * **ANAHTAR MADDEYİ TANITIR** (`OfferRow.key` kuralının aynısı): defterden
 * gelen madde ile kullanıcının kendi yazdığı madde anahtarla ayrışır, elle
 * eklenen maddenin anahtarı BOŞTUR. Eşleşme metne bırakılsaydı 500 karakterlik
 * bir paragrafta tek bir kelime düzeltilince madde defterden kopardı.
 */
export interface OfferGeneralTerm {
  id: string;
  /** Defterdeki maddenin kimliği (`scope`, `price`…); elle eklenen maddede boş. */
  key: string;
  title: string;
  body: string;
  /** Madde belgeden DÜŞER — numarasını da beraberinde götürür. */
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
  /**
   * DEĞER "1" İSE PARÇA BASILMAZ.
   *
   * Adet parçalarında geçerlidir: firmanın on dört teklifinde tek motor
   * `Motor : GAMAK 22 kW 1500 d/dak` diye yazılıyor, `1 x 22 kW` diye DEĞİL —
   * "bir adet" bilgi taşımaz, çünkü yazılmadığında da bir adet anlaşılır.
   * Fren satırı BUNUN İSTİSNASIDIR ve bilerek işaretsizdir: belgelerde
   * `SIBRE Kasnak Fren x 1 Adet` yazımı geçiyor (İDÇ teklifi) — orada adet,
   * ikinci bir frenin olmadığını SÖYLEYEN bir bilgidir.
   */
  hideWhenOne?: boolean;
  /**
   * DEĞERİ BAŞKA PARÇALARDAN TÜRER (`derivedParts`) — kutusu salt okunurdur.
   *
   * `powerTotal` = güç × adet. Kip bir ETİKETTİR, bir formül değil: hesabın
   * kendisi `compose.ts`tedir, defter yalnız "bu alan türetilir" der. Böylece
   * bir alanın elle mi yazıldığı yoksa hesaplandığı mı sorusunun cevabı TEK
   * yerdedir ve arayüz onu okuyarak kutuyu kilitler.
   */
  derived?: "powerTotal";
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

/**
 * Defterdeki GENEL ŞART maddesi (`GENERAL_TERM_DEFS`).
 *
 * `OfferRowDef`ten farkı, seçilecek bir LİSTE değil basılacak bir METİN
 * taşımasıdır: madde bir değer önerisi değil bir hukukî beyandır. Defterdeki
 * hâli sabittir, belgedeki hâli düzenlenebilir — ikisi `key` ile bağlıdır.
 */
export interface OfferGeneralTermDef {
  key: string;
  title: string;
  body: string;
}
