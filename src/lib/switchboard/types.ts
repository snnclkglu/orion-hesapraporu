// PANO YERLEŞİMİ — saf tipler. DB/HTTP/React içe aktarılmaz (değişmez md. 7).
//
// Kaynak, elektrik projesinin okunmuş malzeme listesidir (`lib/electrical`).
// Aygıt etiketinin konum parçası (`+LVD01`) bir PANO adıdır; bu çekirdek o
// panoyu bir GÖVDE olarak modeller ve içindeki aygıtları montaj plakasına
// yerleştirir.
//
// ÖLÇÜ BİLİNMİYORSA `null`DUR VE BU SIFIR DEĞİLDİR (değişmez md. 4). Tahmin
// edilen ölçü ayrı bir alanla (`dimSource`) işaretlenir; ekran onu taralı
// çizer ve sipariş edilebilirlik sayacına katmaz (PANO-12).

/**
 * Aygıt panoda nereye takılır.
 *
 * `zemin` KENDİ BAŞINA BİR TİPTİR (kullanıcı kararı, 09.09.2026): trafo panonun
 * İÇİNDEDİR ama montaj plakasında değil, gövdenin tabanındadır. `govde`
 * ("gövde gereci": lamba, fan, etiket) ile aynı kovaya atmak, 4 kVA'lık bir
 * trafoyu bir aksesuar gibi gösterirdi.
 */
export type MountType =
  /** Montaj plakasındaki DIN rayına oturur. */
  | "din"
  /** Doğrudan montaj plakasına vidalanır (sürücü, reaktör, filtre). */
  | "plaka"
  /**
   * PANO ZEMİNİNE oturur — trafo (kullanıcı kararı, 09.09.2026).
   *
   * Panonun İÇİNDEDİR ve sipariş listesindedir, ama montaj plakasında yer
   * kaplamaz: yerleşim şemasına girmez, cihaz listesinde durur.
   */
  | "zemin"
  /**
   * Kapak üstü kesiti (buton, lamba, priz, HMI).
   *
   * YERLEŞİMİ ÇİZİLMEZ (kullanıcı kararı, 09.09.2026): "kapak üzerinde veya
   * pano içerisinde priz, aydınlatma, buton vs ekipmanlar yerleşimde olmaz."
   * Sınıflandırma korunur çünkü cihazın kapağa takıldığı DOĞRU bir bilgidir ve
   * listede görünür; yalnız plakada/kapakta bir kutu çizilmez.
   */
  | "kapak"
  /** Gövde/kapak gereci (fan, klima, pano lambası). */
  | "govde"
  /**
   * PANO YANINA ASILAN ekipman — siren, korna, ikaz kolonu, projektör.
   *
   * `saha`dan ayrıdır ve ayrım kullanıcının kendi cümlesidir (08.09.2026):
   * "şemada panoların yanında dursun, bunlar genelde sahada oluyor ya da
   * panonun yanına falan asılıyor." Motor ve enkoder vincin üstündedir ve
   * çizilmez; bunlar ise panonun görünür komşusudur ve dizilim şemasında
   * kendi şeridinde durur — ölçüsü sipariş edilecek kadar önemlidir ama
   * montaj plakasında YER KAPLAMAZ.
   */
  | "yan"
  /** Panonun DIŞINDA (motor, enkoder, limit şalteri, kablo). */
  | "saha";

/** Montaj plakasında yukarıdan aşağıya bölge sırası (PANO-7). */
export type Zone = "giris" | "guc" | "motor" | "kumanda" | "klemens";

/**
 * Şemada renk verilen işlev grubu — 25 kategori sekize iner (PANO-13).
 *
 * Yirmi beş renk ayırt edici olmaz: göz bir şemada ancak sekiz-dokuz dolguyu
 * birbirinden ayırır. Dokuzuncu grup `diger` NÖTRDÜR ve bir sınıf değil bir
 * KUYRUKTUR — panoya girmeyen saha aygıtı ile sınıflanmamış ürün oradadır.
 */
export type ColorGroup =
  | "giris"
  | "surucu"
  | "anahtarlama"
  | "kumanda"
  | "otomasyon"
  | "besleme"
  | "klemens"
  | "iklim"
  | "diger";

/** Ölçünün nereden geldiği. `tahmin` ASLA veritabanına yazılmaz (PANO-12). */
export type DimSource = "katalog" | "elle" | "tahmin";

/** Panonun dizideki yeri. */
export type PanelKind =
  /** Elektrik odasında duran pano. */
  | "oda"
  /** Saha panosu (öntanım: kodu TB ile başlayanlar). */
  | "saha"
  /** Pano değil — konum kodu bir aygıt yerini gösteriyor (PANO-2). */
  | "haric";

export type DoorConfig = "tek" | "cift";

/** Ürün ölçü defterinin bir satırı (`electrical_device_models`). */
export interface DeviceModel {
  /** `electricalCatalogLookupKey(supplier, typeNo)` çıktısı. */
  lookupKey: string;
  supplier: string;
  typeNo: string;
  widthMm: number | null;
  heightMm: number | null;
  depthMm: number | null;
  /** 17,5 mm modül sayısı; modüler olmayan üründe `null`. */
  moduleUnits: number | null;
  mountType: MountType | null;
  zone: Zone | null;
  clearanceTopMm: number | null;
  clearanceBottomMm: number | null;
  heatW: number | null;
  /** Defterde yalnız ÖLÇÜLMÜŞ değer durur; tahmin buraya yazılmaz. */
  source: "katalog" | "elle";
  note: string;
}

/**
 * Sabitlemenin YÖNÜ: taşınan aygıt komşusunun ÖNÜNE mi ARKASINA mı oturur.
 *
 * Sıra bir indeks değil bir KOMŞULUKTUR (PANO-38). İndeks, ekranın ve
 * çözücünün AYNI listeyi saymasını şart koşar; ölçüldü (0026, 12.09.2026) —
 * first-fit iki listeyi ayırmıştı ve sürüklenen cihaz bırakılan yere
 * gitmiyordu. Komşu anahtarı iki tarafta da aynı anlama gelir.
 */
export type AnchorSide = "once" | "sonra";

/** Kullanıcının bir aygıt için yaptığı düzeltme (`switchboard_placements`). */
export interface PlacementOverride {
  deviceKey: string;
  panelCode: string | null;
  mountType: MountType | null;
  zone: Zone | null;
  railIndex: number | null;
  /**
   * ESKİ BİÇİM sabitleme — mutlak sıra indeksi. 12.09.2026'dan önce yazılan
   * satırlar bunu taşır; okunmaya devam eder (kendi TÜRÜNÜN listesinde
   * sayılır), yenisi yazılmaz. Yeni sabitleme `anchorDeviceKey`dir.
   */
  orderInRail: number | null;
  /** Komşuya bağlı sabitleme: taşınan aygıt bu aygıtın yanına oturur. */
  anchorDeviceKey: string | null;
  anchorSide: AnchorSide | null;
  widthMm: number | null;
  heightMm: number | null;
  depthMm: number | null;
  /** İşaretliyse yeniden yerleştirme bu satırı korur (PANO-9). */
  pinned: boolean;
  note: string;
}

/** Kullanıcının bir pano için yaptığı ölçü seçimi (`switchboard_panels`). */
export interface PanelOverride {
  code: string;
  name: string;
  kind: PanelKind | null;
  widthMm: number | null;
  heightMm: number | null;
  depthMm: number | null;
  baseMm: number | null;
  doorConfig: DoorConfig | null;
  orderIndex: number | null;
  widthLocked: boolean;
  heightLocked: boolean;
  depthLocked: boolean;
  note: string;
}

/**
 * Yerleştirilecek tek bir AYGIT — bir fiziksel kutu.
 *
 * Aynı aygıt etiketi malzeme listesinde birden çok satırda geçebilir (bir
 * aygıt, birkaç sipariş kalemi); bunlar yerleştirmeden ÖNCE tek kutuya
 * indirilir.
 */
export interface DeviceBox {
  /** `installation|location|device` — yeniden okumada kararlı (ELEKTRIK-6). */
  key: string;
  /** Ekranda görünen aygıt kodu, ör. F31. */
  label: string;
  /** Aygıtın ait olduğu konum kodu (LVD01). */
  panelCode: string;
  designation: string;
  typeNo: string;
  supplier: string;
  partNo: string;
  /** `lib/electrical/category.ts` taksonomisinden. */
  category: string;
  colorGroup: ColorGroup;
  mountType: MountType | null;
  zone: Zone | null;
  /**
   * Aygıtın TEK BİRİMİNİN eni [mm]. Klemens şeridinde bu bir klemensin
   * enidir, şeridin tamamı değil.
   */
  widthMm: number | null;
  heightMm: number | null;
  depthMm: number | null;
  clearanceTopMm: number;
  clearanceBottomMm: number;
  dimSource: DimSource | null;
  /**
   * Kaç birim. Klemens şeridinde bir aygıt etiketi (`-X1`) yüzlerce klemens
   * demektir ve adet ENDİR: 200 × 5,2 mm = 1040 mm, hiçbir panoya tek rayda
   * sığmaz. Öteki ailelerde adet yedek/aksesuar sayısıdır ve en'i büyütmez.
   */
  unitCount: number;
  /**
   * Şerit alt raya DEVAM EDEBİLİR mi? Klemens şeridi edebilir (gerçek panoda
   * da eder); bir kontaktör edemez.
   */
  splittable: boolean;
  /** Belgedeki sıra — eşitlik bozucu son kıstas (PANO-11). */
  sort: number;
  /**
   * Kullanıcı bu aygıtı ŞEMADA başka bir yere taşıdı mı?
   *
   * SABİTLEME SIRAYI KORUR, KOORDİNATI DEĞİL (PANO-23): bir aygıtı taşımak
   * onu o KOMŞULUĞA taşımaktır. Koordinat yeniden hesaplanır, çünkü komşu bir
   * cihazın eni değişince bu cihazın yeri de değişmelidir; donmuş bir
   * koordinat bir sonraki yerleştirmede çakışma üretirdi.
   */
  pinned: boolean;
  /**
   * ESKİ BİÇİM: kullanıcının bıraktığı mutlak sıra. `null` = yok.
   * Kendi TÜRÜNÜN (DIN/plaka) listesinde sayılır (PANO-38).
   */
  pinnedOrder: number | null;
  /** Kullanıcının bıraktığı ray — bilgi amaçlı; sıra baskındır. */
  pinnedRail: number | null;
  /** Komşuya bağlı sabitleme (PANO-38): bu aygıt `anchorKey`nin yanındadır. */
  anchorKey: string | null;
  anchorSide: AnchorSide | null;
}

/** Bir aygıtın montaj plakasındaki yeri [mm, plakanın sol üstünden]. */
export interface Placement {
  deviceKey: string;
  label: string;
  panelCode: string;
  colorGroup: ColorGroup;
  mountType: MountType;
  zone: Zone;
  /** Ray satırı sırası; plaka montajında ait olduğu blok sırası. */
  railIndex: number;
  xMm: number;
  yMm: number;
  /** Bu parçanın TOPLAM eni (birim eni × bu parçadaki birim sayısı). */
  widthMm: number;
  heightMm: number;
  depthMm: number;
  /** Bu parçadaki birim sayısı — bölünmüş şeritte şeridin bir dilimi. */
  unitCount: number;
  dimSource: DimSource;
  pinned: boolean;
}

/** Montaj plakasındaki bir ray satırı. */
export interface Rail {
  index: number;
  zone: Zone;
  /**
   * `din` satırında TS35 rayı çizilir; `plaka` satırında cihaz doğrudan
   * plakaya vidalıdır ve ray yoktur.
   */
  kind: "din" | "plaka";
  /** Rayın üst kenarı, plakanın üstünden [mm]. */
  yMm: number;
  /** Satırın toplam yüksekliği (cihaz + ısı payı + kanal). */
  heightMm: number;
  /**
   * Rayın sol kenarı, RAY BAŞLANGICINDAN [mm] (dikey kanal + kenar payı
   * sonrası). Tam enli rayda 0; bir CEP rayında cebin solu + sütun payı
   * (PANO-39). Çizim ve denetim bunu okur; `0` varsaymak cep raylarını
   * sürücünün üstüne çizerdi.
   */
  xMm: number;
  /** Bu satırda kullanılan genişlik [mm]. */
  usedMm: number;
  /** Satırda kullanılabilir genişlik [mm] — cep rayında cebin eni kadar. */
  capacityMm: number;
  /** Satırın altındaki kablo kanalı yüksekliği [mm]. */
  ductMm: number;
  /**
   * Bu ray bir plaka bandının CEBİNDE mi? Cebi açan plaka rayının indeksi;
   * tam enli rayda `null`. Çizim cebin solundaki dikey kanalı buna bakarak
   * çizer.
   */
  pocketOf: number | null;
}

/** Yerleşemeyen aygıtın sebebi — sessizce düşmez (PANO-10). */
export type UnplacedReason =
  | "olcusuz"
  | "siniflanmamis"
  | "sigmadi"
  | "etiketsiz"
  /**
   * Aygıt etiketi var ama ÜRÜN YOK — tedarikçi, tip ve parça numarası boş.
   *
   * Bu bir hata değil bir BOŞLUKTUR: 0026'da `-Y64`…`-Y75` fren bobinleri
   * redüktörle birlikte geliyor ve elektrik projesinde malzeme satırı
   * açılmamış. Altı satır "Sınıflanmamış" kuyruğunda hata gibi duruyordu ve
   * gerçek eksikleri (ölçüsüz sürücü) gölgeliyordu.
   */
  | "urunsuz"
  | "saha";

export interface Unplaced {
  device: DeviceBox;
  reason: UnplacedReason;
  note: string;
}

/** Bir panonun çözülmüş hâli. */
export interface PanelLayout {
  code: string;
  name: string;
  kind: PanelKind;
  widthMm: number;
  heightMm: number;
  depthMm: number;
  baseMm: number;
  doorConfig: DoorConfig;
  /** Kullanıcının kilitlediği ölçüler — arama bunları atlamıştır. */
  widthLocked: boolean;
  heightLocked: boolean;
  depthLocked: boolean;
  rails: Rail[];
  placements: Placement[];
  /**
   * ÇÖZÜCÜNÜN NİHAİ AYGIT SIRASI — plakaya giren aygıt anahtarları, sabitleme
   * uygulanmış hâliyle (PANO-38). Ekran sürükle-bırak hedefini BU listeden
   * okur, çizim sırasından türetmez: iki liste bir kez ayrıştı ve cihaz
   * bırakılan yere gitmedi.
   */
  order: string[];
  /** Kapak üstü aygıtlar (ayrı görünüş). */
  doorPlacements: Placement[];
  /** Gövde gereçleri — yerleşimi çizilmez, listede durur. */
  bodyDevices: DeviceBox[];
  /**
   * Pano YANINA asılan ekipman (siren, korna, ikaz kolonu, projektör).
   *
   * Montaj plakasında yer kaplamaz ama dizilim şemasında kendi şeridinde
   * çizilir: kullanıcı bunları görmek istedi ve bugün `govde` sayılanları
   * hiçbir yerde göremiyordu (PANO-27).
   */
  sideDevices: DeviceBox[];
  /** Bu panonun gerektirdiği derinlik (ortak derinlik seçilmeden önce). */
  requiredDepthMm: number;
  /** Kullanılan ray genişliğinin kapasiteye oranı [0..1]. */
  fillRatio: number;
  /** Bölünmüş panonun kaynağı (LVD10 → LVD10-A). */
  splitOf: string | null;
  /** Kullanıcıya taşınan uyarılar. */
  warnings: string[];
}

/**
 * BİR DİZİNİN sipariş ölçüleri — kullanıcının İSTEĞİ, çözülmüş sonuç değil.
 *
 * `null` = "sistem karar versin" (PANO-9). Oda ve saha dizileri bu tercihleri
 * AYRI AYRI taşır: kullanıcının kendi cümlesiyle "oda panosu ile saha pano
 * ölçüleri birbirine bağlı değil, tamamen ayrı" (08.09.2026). Tek bir alan
 * ikisine birden dayatıldığında duvara asılan bir klemens kutusu, elektrik
 * odasındaki 2000 mm'lik gövdeyle aynı boya çıkıyordu.
 */
export interface LineupPrefs {
  heightMm: number | null;
  depthMm: number | null;
  baseMm: number;
}

/** Yerleştiricinin ayarları — hepsi kullanıcı tarafından değiştirilebilir. */
export interface LayoutSettings {
  /** Elektrik odası dizisinin sipariş ölçüleri. */
  room: LineupPrefs;
  /** Saha dizisinin sipariş ölçüleri — ODANINKİNDEN BAĞIMSIZ. */
  field: LineupPrefs;
  /** Bu ön eklerle başlayan konumlar SAHA panosudur. */
  fieldPrefixes: string[];
  /** Montaj plakası payları (PANO-3). */
  plateSideMm: number;
  plateTopMm: number;
  plateBottomMm: number;
  sideDuctMm: number;
  /** Ray satırları arasındaki kablo kanalı yüksekliği. */
  railDuctMm: number;
  /** Cihaz ile plaka kenarı arasındaki pay. */
  edgeGapMm: number;
  /** Farklı aileden iki cihaz arasındaki pay. */
  familyGapMm: number;
  /** Defterde ısı payı yoksa kullanılan öntanım. */
  defaultClearanceMm: number;
  /** Derinlikte arka pay. */
  backGapMm: number;
  /** Kapak cihazının kapak arkasında istediği pay. */
  doorGapMm: number;
  /** Hedef doluluk üst sınırı — aşılırsa UYARI, engel değil. */
  fillWarnRatio: number;
  /**
   * SÜTUNLU YERLEŞİM (PANO-39): uzun plaka cihazının (sürücü) yanında kalan
   * boşluğa DIN rayı açılır mı? Kapalıyken eski tam-enli raf modeli çalışır
   * ve çıktı bit-aynıdır — gerileme bu anahtarla ölçülür.
   */
  columnsEnabled: boolean;
  /** Bir cep rayının açılabileceği en küçük en [mm]; altı kanal + tek cihaz bile almaz. */
  minRailMm: number;
  /** Uzun plaka cihazı ile cep rayı arasındaki sütun payı [mm] — kablo iniş yolu ve soğuma. */
  columnGapMm: number;
}

/** Bütün işin çözülmüş hâli. */
/**
 * Bir DİZİNİN çözülmüş ortak ölçüsü.
 *
 * Bu, kullanıcının AYARI değil aramanın SONUCUdur ve iki dizi için AYRI
 * çözülür: saha panoları elektrik odasına girmez, kendi yükseklik ve
 * derinliklerini kendi içlerinde uzlaştırırlar (PANO-2).
 *
 * Dizi boşsa `null`. Ölçüldü (07.09.2026): tek bir sonuç alanı iki diziye
 * birden hizmet edince, yalnız saha panosu olan bir projede ekran ve
 * İMALATÇIYA GİDEN PDF boş oda dizisinin aramasından dönen 1400 mm'yi
 * basıyordu — hiç var olmayan bir panonun ölçüsünü.
 */
export interface LineupSize {
  /**
   * Ortak yükseklik; ortak DEĞİLSE en yüksek gövdeninki (PANO-33).
   *
   * `sharedHeight` false iken bu sayıyı tek başına "dizinin yüksekliği" diye
   * yazmak yanlıştır — ekran ve çıktı "kutu başına" der.
   */
  heightMm: number | null;
  depthMm: number | null;
  panelCount: number;
  /** Gözler ortak yükseklik paylaşıyor mu? Sahada HAYIR. */
  sharedHeight: boolean;
}

export interface LayoutResult {
  /** Elektrik odası dizisi, soldan sağa. */
  room: PanelLayout[];
  /** Saha panoları dizisi, soldan sağa. */
  field: PanelLayout[];
  /** Pano sayılmayan konumlar. */
  excluded: { code: string; devices: number }[];
  unplaced: Unplaced[];
  /**
   * Kullanıcının İSTEĞİ — çözülmüş ölçü DEĞİL. `heightMm`/`depthMm` burada
   * `null` ise "sistem karar versin" demektir; sonucu `roomSize`/`fieldSize`
   * taşır. İkisini tek alanda toplamak, "ne istendi" ile "ne çıktı" sorularını
   * birbirine karıştırırdı.
   */
  settings: LayoutSettings;
  /** Elektrik odası dizisinin çözülmüş ortak ölçüsü. */
  roomSize: LineupSize;
  /** Saha dizisinin çözülmüş ortak ölçüsü — ODANINKİNDEN FARKLI olabilir. */
  fieldSize: LineupSize;
  /**
   * Oda dizisinin yanına asılan ekipmanlar — dizilim şemasında çizilir.
   *
   * Pano AÇMAYAN konumlardakiler de buraya girer: bir siren tek başına bir
   * gövde açmaz (PANO-2) ama o yüzden KAYBOLMAMALIDIR.
   */
  roomSideDevices: DeviceBox[];
  /** Saha dizisinin yanına asılan ekipmanlar. */
  fieldSideDevices: DeviceBox[];
  /**
   * BU İŞTE GEÇEN BÜTÜN AYGIT KUTULARI, anahtarına göre.
   *
   * `Placement` yalnız GEOMETRİDİR: nerede, ne kadar geniş, hangi rayda.
   * "Bu ne?" sorusunun cevabı (üretici, tip numarası, kategori, ölçü kaynağı)
   * `DeviceBox`tadır. Kimliği `Placement`a kopyalamak yerine burada bir kez
   * taşınır — bölünmüş bir klemens şeridi onlarca dilim üretir ve aynı kimliği
   * onlarca kez taşırdı.
   *
   * Şemada bir cihaza tıklandığında açılan bilgi baloncuğu buradan okur.
   */
  devices: DeviceBox[];
  /** Ölçüsü doğrulanmamış (tahmin) aygıt sayısı — sipariş kapısı (PANO-12). */
  estimatedCount: number;
  /** Girdinin kararlı parmak izi — onayın eskidiğini bu gösterir. */
  fingerprint: string;
}
