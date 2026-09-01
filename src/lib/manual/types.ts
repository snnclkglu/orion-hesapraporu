// İŞLETME VE BAKIM EL KİTABININ MODELİ — saf tipler, DB/HTTP/React yok
// (değişmez md. 7).
//
// Belgenin TAMAMI tek bir `ManualPayload` nesnesidir ve revizyonun `payload`
// sütununda snapshot olarak durur (TEKLIF-2'nin ikizi). Ekran, PDF ve
// karşılaştırma üçü de aynı nesneyi okur.
//
// ÜÇ KATMAN VE HEPSİ AYNI AĞAÇTA:
//   BÖLÜM  — numaralanır (1 · 1.1 · 1.1.1), gizlenebilir, çocuk taşır
//   BLOK   — bölümün içeriği: paragraf, liste, uyarı kutusu, tablo, görsel
//   OTOMATİK BLOK — içeriği UYGULAMANIN VERİSİNDEN gelen blok
//
// STANDART METİN BİR ÖNTANIMDIR, BİR KİLİT DEĞİL (kullanıcı isteği,
// 19.08.2026: *"bazı başlıkların standart yazı olduğu ama değişebildiği"*).
// Şablondan gelen her blok `fromTemplate` işaretiyle doğar; kullanıcı
// dokununca `edited` açılır ve şablon onu BİR DAHA EZMEZ. Mühendislik
// motorundaki `*Auto` anahtarının ve teklifteki `manual` bayrağının aynısıdır:
// makine önerir, insan son sözü söyler.
//
// GİZLEME BELGEDE İZ BIRAKMAZ (TEKLIF-4 kuralı): gizlenen bölüm ya da blok
// PDF'e HİÇ girmez — boşluk, tire ya da "gizlendi" işareti kalmaz. Bütün
// çocukları gizlenmiş bir bölüm KENDİ BAŞLIĞIYLA düşer, yoksa belgede boş bir
// başlık kalır ve okuyan orada bir şeyin eksildiğini okur. Editörde ise
// gizlenen öğe SOLGUN ama düzenlenebilir kalır: gizlemek silmek değildir.

// ————————————————————————————————————————————————————————————————— blok

/**
 * UYARI DÜZEYLERİ — BEŞ basamak, kaynak kılavuzun kendi çizelgesinden.
 *
 * Sıra ARTAN CİDDİYETTEDİR ve bu bir düzen tercihi değil bir SÖZLEŞMEDİR:
 * ISO 3864-2 / ANSI Z535.4'ün sinyal kelimesi basamakları budur ve firmanın
 * kendi teslim ettiği kılavuz da aynı beşliyi kullanıyor (bkz. şablon
 * varlığı `sinyalKelimeleri`). Dört basamakla başlamıştık; "DİKKAT" eksikti
 * ve onsuz küçük yaralanma riski ile ölüm riski aynı kutuya giriyordu.
 *
 * `not` ile `onemli` ayrımı da oradan gelir: NOT bir kolaylıktır, ÖNEMLİ ise
 * güvenli kullanımın ZORUNLU adımıdır.
 */
export const MANUAL_NOTE_LEVELS = ["not", "onemli", "dikkat", "uyari", "tehlike"] as const;

export type ManualNoteLevel = (typeof MANUAL_NOTE_LEVELS)[number];

export const MANUAL_NOTE_LABELS: Record<ManualNoteLevel, string> = {
  not: "NOT",
  onemli: "ÖNEMLİ",
  dikkat: "DİKKAT",
  uyari: "UYARI",
  tehlike: "TEHLİKE",
};

/** Kutunun altına basılan tanım — okuyan düzeyin ne demek olduğunu bilmeli. */
export const MANUAL_NOTE_MEANING: Record<ManualNoteLevel, string> = {
  not: "Kullanma ipuçları ve faydalı bilgiler.",
  onemli: "Özel bir fonksiyonun güvenli kullanımı için zorunlu adımlar.",
  dikkat: "Küçük fiziksel yaralanmalarla sonuçlanma ihtimali mevcut durum.",
  uyari: "Ciddi yaralanma ve ölümle sonuçlanma ihtimali mevcut durum.",
  tehlike: "Ciddi yaralanma ve ölümle sonuçlanma ihtimali yüksek durum.",
};

/**
 * OTOMATİK BLOĞUN KAYNAĞI — el kitabının öteki bölümlere bağlandığı yer.
 *
 * Bunlar el kitabının VAR OLMA SEBEBİDİR: sınıflandırma tablosu hesap
 * raporunda, ekipman listesi ekipman panelinde, malzeme listesi elektrik
 * projesinde, resim listesi Teknik Resim Takibi'nde zaten YAZILIDIR. Elle
 * kopyalanan her tablo bir gün kaynağıyla ayrışır ve müşteri elindeki
 * kılavuzla vinci karşılaştırdığında farkı görür.
 */
export const MANUAL_AUTO_SOURCES = [
  /** FEM sınıflandırma tablosu (çelik yapı, kaldırma, yürütme grupları). */
  "siniflandirma",
  /** Karakteristik özellikler: kapasite, açıklık, kanca yüksekliği, gerilim. */
  "karakteristik",
  /** Hız çizelgesi (kaldırma, köprü, araba). */
  "hiz",
  /** Ekipman listesi — marka/model dökümü. */
  "ekipman",
  /** Yalnız rulmanlar — yedek parça eki. */
  "rulman",
  /** Yalnız çelik halat(lar). */
  "halat",
  /** Elektrik projesinden ayıklanan malzeme listesi. */
  "elektrikMalzeme",
  /** Elektrik projesinin sayfa dizini (pano · pafta · sayfa). */
  "elektrikSayfa",
  /** Teknik Resim Takibi defterindeki resimler. */
  "teknikResim",
] as const;

export type ManualAutoSource = (typeof MANUAL_AUTO_SOURCES)[number];

export const MANUAL_AUTO_LABELS: Record<ManualAutoSource, string> = {
  siniflandirma: "Sınıflandırma (hesap raporundan)",
  karakteristik: "Karakteristik özellikler (hesap raporundan)",
  hiz: "Hızlar (hesap raporundan)",
  ekipman: "Ekipman listesi (hesap raporundan)",
  rulman: "Rulman listesi (ekipman listesinden)",
  halat: "Halat listesi (ekipman listesinden)",
  elektrikMalzeme: "Elektrik malzeme özeti (elektrik projesinden)",
  elektrikSayfa: "Elektrik projesi sayfa dizini",
  teknikResim: "Teknik resim listesi (Teknik Resim Takibi'nden)",
};

/** Bir tablonun taşınabilir hâli — otomatik blok da elle tablo da bunu üretir. */
export interface ManualTable {
  head: string[];
  rows: string[][];
  /** Tablonun altına basılan açıklama; boş olabilir. */
  caption?: string;
}

interface ManualBlockBase {
  /** Kararlı kimlik — düzenleme, sürükleme ve karşılaştırma buna dayanır. */
  id: string;
  /** Şablondan doğdu; `edited` kapalıyken şablon tazelemesi onu ezebilir. */
  fromTemplate?: boolean;
  /** Kullanıcı dokundu — şablon BİR DAHA EZMEZ. */
  edited?: boolean;
  /** Blok belgeden DÜŞER (bkz. `printedPayload`). */
  hidden?: boolean;
  /**
   * İÇERİĞİ BU VİNCİN VERİSİNDEN TÜRETİLDİ — değeri kuralın kimliğidir
   * (`lib/manual/autofill.ts`).
   *
   * `fromTemplate` ile AYNI ANDA BULUNMAZ ve bu bir testle kilitlidir: bir
   * blok ya şablondan doğar ya kaynaktan türer. İkisi birden olsaydı
   * "Standarda Dön" ile "Kaynaktan Tazele" aynı bloğa iki farklı geçmiş vaat
   * ederdi.
   *
   * Türetilmiş blok MATERYALİZEDİR, canlı değil: üretildiği anda somut
   * metin/tablo olarak snapshot'a yazılır. Bu yüzden yayımda ayrıca
   * dondurulması gerekmez — `frozen` yalnız `kind: "auto"` bloklarına aittir
   * (KITAP-7).
   */
  derived?: string;
}

/** Paragraf — satır sonları KORUNUR, işaretleme yoktur. */
export interface ManualTextBlock extends ManualBlockBase {
  kind: "text";
  text: string;
  /**
   * KENAR NOTU (kaynak kılavuzun `Marginale` stili): paragrafın solunda duran
   * kısa etiket ("Acil Stop Butonları", "Yedek parça ve aşınma parçaları").
   * Belgeyi tarayarak okuyanın gözü bunlara takılır; bir alt başlık AÇMAK
   * yerine kullanılırlar çünkü numaralı bir başlık içindekilere girer ve
   * on beş satırlık bir bölüm otuz maddeye bölünürdü.
   */
  margin?: string;
}

/** Madde listesi — sıra ÖNEMLİYSE `ordered` açılır (kaynak kılavuzun OL/UL ayrımı). */
export interface ManualListBlock extends ManualBlockBase {
  kind: "list";
  ordered?: boolean;
  items: string[];
  /**
   * SONUÇ SATIRI (kaynak kılavuzun `Reaktion` stili): numaralı bir işlem
   * listesinin beklenen sonucu, okla basılır. Ayrı bir blok olsaydı listeden
   * kopabilir ve yanlış adımın altına düşerdi.
   */
  result?: string;
}

/** ÖNEMLİ / UYARI / TEHLİKE kutusu. */
export interface ManualNoteBlock extends ManualBlockBase {
  kind: "note";
  level: ManualNoteLevel;
  /** Kutunun kendi başlığı; boşsa düzeyin etiketi basılır. */
  title?: string;
  text: string;
}

/** Elle yazılan tablo. */
export interface ManualTableBlock extends ManualBlockBase {
  kind: "table";
  table: ManualTable;
}

/**
 * Görsel — İKİ KAYNAKTAN BİRİ, ikisi birden DEĞİL.
 *
 * `imageId` YÜKLENEN görseldir: baytları `manual_images` kaydında ve
 * `manual-images` kovasındadır, revizyona bağlıdır (o vincin fotoğrafı).
 * `assetKey` ŞABLON VARLIĞIDIR: baytları repodadır (`lib/manual/assets.ts`)
 * ve şablondan doğan her kılavuza hazır gelir (uyarı piktogramı, DIN 15020
 * halat hasar şekli). Şablon görselinin üzerine yükleme yapılırsa `imageId`
 * yazılır ve `assetKey` düşer — biri ötekini gölgelemez.
 */
export interface ManualImageBlock extends ManualBlockBase {
  kind: "image";
  /** Yüklenen görselin kimliği; şablon varlığında BOŞTUR. */
  imageId?: string;
  /** Şablon varlığının anahtarı (`lib/manual/assets.ts`); yüklemede BOŞTUR. */
  assetKey?: string;
  caption?: string;
  /** KABIN genişliğinin yüzdesi (10–100); verilmezse 100. */
  widthPct?: number;
  /**
   * Görsel SAYFANIN TAMAMINA yayılsın mı.
   *
   * Verilmezse `widthPct`ten çıkarılır. AÇIK İSTEK gereklidir çünkü ikisi
   * ayrı sorudur: halat hasar şekli sütunun TAMAMINI ister (`widthPct` 100)
   * ama sayfanın tamamını İSTEMEZ — iki kolona yayılınca sayfa yarı yarıya
   * kısalır. HMI ekran görüntüsü ise tersidir.
   */
  fullWidth?: boolean;
}

/**
 * Kaynağı uygulamanın verisi olan blok.
 *
 * TASLAKTA CANLI, YAYIMDA DONMUŞ. Taslakta her açılışta kaynaktan yeniden
 * üretilir — hesap raporu revize edilirse kılavuz kendiliğinden tazelenir.
 * Yayımlanan revizyonda ise çözülmüş tablo `frozen`a yazılır ve belge bir
 * daha değişmez; aksi hâlde teslim edilmiş bir kılavuz, kaynağı sonradan
 * düzeltilince sessizce başka bir şey söylerdi.
 */
export interface ManualAutoBlock extends ManualBlockBase {
  kind: "auto";
  source: ManualAutoSource;
  /** Yayımda dondurulmuş tablo; taslakta yoktur. */
  frozen?: ManualTable;
  /** Kaynak boşsa bölümde ne yazacağı — boşsa blok hiç basılmaz. */
  emptyText?: string;
  /**
   * KAYNAĞIN NE KADARININ BASILACAĞI — kapsam paketinin bloğa yazdığı ayar.
   *
   * Bugün yalnız `ekipman` kaynağı okur (`standart` · `detayli` · `kataloglu`);
   * tanınmayan değer öntanıma iner. VARYANT BLOĞUN KENDİSİNDE YAŞAR, ayrı bir
   * arama tablosunda değil: çözücü (`autoTableFor`) zaten bloğu alıyor ve
   * ikinci bir tablo tutmak, bloğun kopyalandığı her yerde (yeni revizyon,
   * metin parçası) ayrışması demekti.
   */
  variant?: string;
}

/**
 * PARAMETRİK ŞEMA — hesap motorunun ürettiği diyagramın DONMUŞ hâli.
 *
 * RASTERLENMEZ. `Diagram` saf bir SVG veri modelidir ve iki çizici zaten
 * vardır: `components/diagrams/diagram-svg.tsx` (ekran) ve `lib/pdf/diagram.tsx`
 * (PDF). Rasterlemek teslim belgesinde halat donanımı şemasını bulanıklaştırır
 * ve dosyayı büyütürdü. Ölçüldü (30.08.2026): seksen şemanın en büyüğü 38 KB,
 * ortalaması 10 KB — modelin snapshot'ta taşınması ucuzdur.
 *
 * DONMUŞ, CANLI DEĞİL (KITAP-7'nin dersi): şema EKLEME ANINDA çözülür ve
 * payload'a yazılır. Canlı olsaydı yayımlanmış bir kılavuz, hesap sonradan
 * revize edilince sessizce başka bir şey söylerdi.
 *
 * Oran modelin kendi `width`/`height`ından okunur; yerleşim dosyaya bakmadan
 * ölçer (KITAP-12'nin "oran defterdedir" kuralının ikizi).
 */
export interface ManualDiagramBlock extends ManualBlockBase {
  kind: "diagram";
  /** Hangi modül/bölümden geldi ("main:2.5") — "Kaynaktan Tazele" bunu okur. */
  diagramKey: string;
  /** Çizim modeli; `lib/diagrams/model.ts` şeklindedir. */
  diagram: ManualDiagramModel;
  caption?: string;
  /** KABIN genişliğinin yüzdesi (10–100); verilmezse 100. */
  widthPct?: number;
  fullWidth?: boolean;
}

/**
 * Şema modelinin el kitabındaki YÜZÜ.
 *
 * `lib/diagrams/model.ts`teki `Diagram` tipi burada YENİDEN TANIMLANMAZ —
 * çekirdek onu yalnız TAŞIR ve ölçer; çizen taraflar kendi tipini kullanır.
 * Saklanan JSON'un şekli çizim modelinin sözleşmesidir ve `withManualDefaults`
 * onu doğrulamaz: doğrulasaydı çizim modeline eklenen her yeni eleman türü
 * eski kılavuzları açılmaz yapardı.
 */
export interface ManualDiagramModel {
  width: number;
  height: number;
  els: unknown[];
  /** viewBox köşesi — içerik 0'ın soluna taşarsa kutu o yöne büyütülür. */
  x0?: number;
  y0?: number;
}

export type ManualBlock =
  | ManualTextBlock
  | ManualListBlock
  | ManualNoteBlock
  | ManualTableBlock
  | ManualImageBlock
  | ManualDiagramBlock
  | ManualAutoBlock;

// ———————————————————————————————————————————————————————————————— bölüm

export interface ManualSection {
  id: string;
  /** Şablondaki bölümün anahtarı (`guvenlik.kullanimAmaci`); serbest bölümde boş. */
  key?: string;
  title: string;
  hidden?: boolean;
  /** Başlık elle yazıldı — şablon tazelemesi onu ezmez. */
  titleEdited?: boolean;
  blocks: ManualBlock[];
  children: ManualSection[];
  /**
   * EK BÖLÜMÜ: gövdesi bir PDF EKİDİR, blok değil.
   *
   * Müşterinin listesi (mekanik projeler, katalog sayfaları, elektrik
   * projeleri, şartname) belgeye AYRI DOSYALAR olarak girer; gövde onlara
   * bir ayraç kapağı ve bir atıf verir. Birleştirmeyi indirme ucu yapar
   * (`pdf/merge.ts`), gövde PDF'i kendisi taşımaz — ekleriyle birlikte
   * yüz megabaytı bulan bir belge her önizlemede yeniden üretilemez.
   */
  appendix?: ManualAppendixKind;
}

/** Ek yaprağının kaynağı — müşterinin istediği yedi başlık. */
export const MANUAL_APPENDIX_KINDS = [
  /** Hesap raporu PDF'i (mekanik hesaplamalar). */
  "mekanikHesap",
  /** Teknik resim paketinden birleştirilmiş montaj resimleri. */
  "mekanikProje",
  /** Hazır mekanik ekipmanların katalog sayfaları. */
  "mekanikKatalog",
  /** Elektrik hesaplamaları (mühendisin yüklediği belge). */
  "elektrikHesap",
  /** Elektrik projesi PDF'i. */
  "elektrikProje",
  /** Hazır elektrik ekipmanlarının katalog sayfaları. */
  "elektrikKatalog",
  /** Teknik şartname (müşteri belgesi). */
  "sartname",
] as const;

export type ManualAppendixKind = (typeof MANUAL_APPENDIX_KINDS)[number];

export const MANUAL_APPENDIX_LABELS: Record<ManualAppendixKind, string> = {
  mekanikHesap: "Mekanik Hesaplamalar",
  mekanikProje: "Mekanik Projeler",
  mekanikKatalog: "Mekanik Ekipman Katalog Sayfaları",
  elektrikHesap: "Elektrik Hesaplamaları",
  elektrikProje: "Elektrik Projeleri",
  elektrikKatalog: "Elektrik Ekipman Katalog Sayfaları",
  sartname: "Teknik Şartname",
};

// ———————————————————————————————————————————————————————————————— künye

/**
 * KAPAK KÜNYESİ — kaynak kılavuzun "Tanım" sayfasındaki iki tablo.
 *
 * Alanların ÇOĞU PROJEDEN TÜRETİLİR (müşteri, vinç tipi, kapasite) ama
 * ÜRETİCİ ve SAHA müşterinin kendi belgesinden gelir ve uygulamada karşılığı
 * yoktur. Bilinmeyen alan BOŞ kalır; "—" bile yazılmaz (değişmez md. 4·5).
 */
export interface ManualIdentity {
  manufacturer: string;
  /**
   * Üretici künyesinin geldiği MÜŞTERİ DEFTERİ kaydı (`customers.id`).
   *
   * Ad ve adres yine snapshot olarak yukarıda durur (KITAP-2: defterde
   * sonradan yapılan bir düzeltme teslim edilmiş bir kılavuzu değiştirmez);
   * bu alan yalnız "hangi firmadan alındı" sorusunu cevaplar ve editörde
   * seçicinin hangi satırda duracağını söyler. Boş = elle yazıldı.
   */
  manufacturerCustomerId?: string;
  product: string;
  craneType: string;
  serialNo: string;
  productionYear: string;
  customer: string;
  site: string;
  /** Üreticinin adres bloğu — serbest metin, satır sonları korunur. */
  manufacturerAddress: string;
  customerDocNo: string;
  customerRevision: string;
  preparedOn: string;
  revisedOn: string;
  /** Telif satırı; şablondan gelir, düzenlenebilir. */
  copyright: string;
}

/**
 * EL KİTABI ORTAK MARKALARI — Orion solda sabittir; iki partner yüklenen
 * görsellerden seçilir ve üst bantta orta/sağ yuvalara yerleşir.
 *
 * Kimlikler `manual_images` kayıtlarına aittir. Alanların opsiyonel olması,
 * tek partnerli ve partnersiz belgelerin aynı yerleşim sözleşmesini
 * kullanmasını sağlar; boş bir kimlik logo değildir.
 */
export interface ManualPartnerLogos {
  centerImageId?: string;
  rightImageId?: string;
  /**
   * MÜŞTERİ DEFTERİNDEN SEÇİLEN FİRMA — logo baytları defterin kendi
   * kovasından çözülür (`customers.logo_path`), belgeye kopyalanmaz.
   *
   * Kullanıcı kararı (01.09.2026): *"Künye'de logoları seçmeyi değiştirelim.
   * Firma seçeyim. Firmalarım zaten Müşteriler kısmında kayıtlı ve logoları
   * mevcut."* Elle yükleme (`*ImageId`) GERİYE DÖNÜK YEDEK olarak kalır:
   * defterde olmayan bir kurum için hâlâ tek yol odur.
   *
   * ÖNCELİK: bu alan > proje rapor firması > elle yüklenmiş görsel. Ortadaki
   * basamak KITAP-18'in kuralıdır ve bozulmadı; buradaki seçim yalnızca
   * "bu kılavuzda başka bir firma" demenin yoludur.
   */
  centerCustomerId?: string;
  rightCustomerId?: string;
}

// ——————————————————————————————————————————————————————————————— kapsam

/**
 * TESLİM PAKETLERİ — belgenin kapsamının hazır üç ayarı.
 *
 * Kullanıcı isteği (30.08.2026): *"bir müşteriye projeleri vermeyebilirim
 * diğerine verebilirim; birine ekipman listesini detaylı kataloglu veririm
 * diğerine standart versiyonu."* Paket bu kararların adı konmuş hâlidir.
 */
export const MANUAL_PACKAGES = ["standart", "detayli", "tamTeknik"] as const;

export type ManualPackageKey = (typeof MANUAL_PACKAGES)[number];

export const MANUAL_PACKAGE_LABELS: Record<ManualPackageKey, string> = {
  standart: "Standart",
  detayli: "Detaylı",
  tamTeknik: "Tam Teknik",
};

/** Ekipman listesinin ayrıntı basamağı — `ManualAutoBlock.variant` değeri. */
export const MANUAL_EQUIPMENT_VARIANTS = ["standart", "detayli", "kataloglu"] as const;

export type ManualEquipmentVariant = (typeof MANUAL_EQUIPMENT_VARIANTS)[number];

export const MANUAL_EQUIPMENT_VARIANT_LABELS: Record<ManualEquipmentVariant, string> = {
  standart: "Standart — ekipman, marka, model, adet",
  detayli: "Detaylı — teknik özellik sütunu da basılır",
  kataloglu: "Kataloglu — katalog föyü sütunu ve katalog ekleri",
};

/**
 * EKİN SEÇENEĞİ — indirme ucuna taşınan tek ayar.
 *
 * Ekin belgeye GİRİP GİRMEYECEĞİ burada DEĞİLDİR: o `section.hidden`'dır ve
 * `manualAppendixOrder` zaten `printedManual`'ı okur (KITAP-6 · KITAP-8).
 * Burada yalnız "girecekse hangi biçimde" durur: mekanik hesap eki hangi
 * rapor seviyesiyle, elektrik katalog eki ürün başına kaç teknik föyle.
 * Bunların başka bir evi yoktur — ağaçta bir karşılıkları yok.
 */
export interface ManualAppendixOption {
  kind: ManualAppendixKind;
  /** `mekanikHesap` → ReportLevel · `elektrikKatalog` → föy sayısı. */
  option?: string;
  /** Kullanıcı elle değiştirdi — paket yeniden uygulanınca EZİLMEZ. */
  edited?: boolean;
}

/**
 * BELGENİN KAPSAMI.
 *
 * GÖRÜNÜRLÜK BURADA DEĞİLDİR ve bu bir eksiklik değil bir SÖZLEŞMEDİR: paket
 * uygulamak `section.hidden` yazan bir İŞLEMDİR, ikinci bir görünürlük deposu
 * değil. İki depo olsaydı gizlenen bölüm ekrandan düşer ama belgeye girmeye
 * devam ederdi (KITAP-6'nın anlattığı en pahalı hata).
 *
 * Burada yalnız başka evi olmayan üç şey durur: hangi paket uygulandı,
 * kullanıcı paketten nerede saptı, eklerin seçenekleri.
 */
export interface ManualScope {
  /** Son uygulanan paket; BOŞ ise "serbest kapsam" (eski belgeler burada). */
  packageKey: ManualPackageKey | "";
  /** Uygulandığı an (ISO); sapma listesi bundan sonrasını sayar. */
  appliedAt: string;
  /**
   * Paket uygulandıktan SONRA görünürlüğüne ELLE dokunulan bölüm anahtarları.
   * KITAP-4'ün (`edited`) kapsam düzeyindeki ikizidir: paket yeniden
   * uygulandığında bunlara DOKUNULMAZ — makine önerir, insan son sözü söyler.
   */
  keptSections: string[];
  appendixOptions: ManualAppendixOption[];
}

export interface ManualPayload {
  /** Sözleşme sürümü — `withManualDefaults` eski kayıtları bugüne taşır. */
  v: 1;
  /** Kapakta basılan belge adı; öntanımı `MANUAL_DOC_TITLE`. */
  docTitle: string;
  /** Kapağın üst satırı ("185/40 TON KAPASİTELİ ŞARJ VİNCİ"). */
  coverTitle: string;
  /** Kapak görselinin kimliği; yoksa kapak yalın basılır. */
  coverImageId?: string;
  /** Üst banttaki opsiyonel orta ve sağ partner logoları. */
  partnerLogos: ManualPartnerLogos;
  identity: ManualIdentity;
  /** Teslim kapsamı — paket, sapmalar ve ek seçenekleri. */
  scope: ManualScope;
  sections: ManualSection[];
  /**
   * Şablonun hangi sürümünden doğdu. Şablon büyüdüğünde eski belgeye YENİ
   * BÖLÜM EKLENMEZ — belge kullanıcınındır; editör yalnız "şablonda yeni
   * bölümler var" der ve eklemeyi kullanıcı seçer.
   */
  templateVersion: number;
}
