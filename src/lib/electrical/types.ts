// ELEKTRİK PROJESİNİN OKUNMUŞ HÂLİ — saf tipler, DB/HTTP/React yok
// (değişmez md. 7).
//
// Kaynak bir EPLAN (ya da benzeri) dışa aktarımıdır: yüzlerce sayfalık tek bir
// PDF. Uygulama onu ARŞİVLER ama içindekileri de OKUR — çünkü aynı bilgi üç
// yerde bir daha elle yazılacaktı: ekipman listesinde, satın almada ve
// İşletme ve Bakım El Kitabı'nın elektrik ekinde.
//
// OKUNAN HER ALAN BOŞ OLABİLİR VE BU BİR HATA DEĞİLDİR (`titleblock.ts` ile
// aynı ilke): tanınmayan bir şablon kapsam kaybıdır, veri uydurmak için sebep
// değil (değişmez md. 4).

/** Aygıt etiketinin çözülmüş hâli: `=185T+LVD01-F31`. */
export interface DeviceTag {
  /** `=185T` — tesis (installation) kodu, `=` olmadan. */
  installation: string;
  /** `+LVD01` — konum/pano kodu, `+` olmadan. Panel dökümünün anahtarı. */
  location: string;
  /** `-F31` — aygıt kodu, `-` olmadan. */
  device: string;
}

/** Malzeme listesinin (Parts list) bir satırı. */
export interface ElectricalPart {
  /** Ham aygıt etiketi (`=185T+LVD01-F31`) — belgede yazdığı gibi. */
  deviceTag: string;
  installation: string;
  location: string;
  device: string;
  /**
   * Adet. BEYAN DEĞİL OKUMADIR ve okunamadıysa `null`dur — `1` varsayılmaz
   * (değişmez md. 4: sessiz bir varsayım yanlış adet sipariş ettirir).
   */
  qty: number | null;
  /** `CIRCUIT BREAKER 400V 6KA, 3POLE, C, 10A` */
  designation: string;
  /** Üreticinin tip numarası: `5SL6210-7` */
  typeNo: string;
  /** `Siemens` */
  supplier: string;
  /** Projenin kendi malzeme kodu: `SIE.5SL6210-7` */
  partNo: string;
  /** 1 tabanlı PDF sayfa numarası — satır belgede nerede yazıyor. */
  page: number;
}

/** Sayfa dizininin bir satırı — PDF yer imi ağacındaki "Page list" kökünden. */
export interface ElectricalSheet {
  /** 1 tabanlı PDF sayfası. */
  page: number;
  installation: string;
  location: string;
  /** `1`, `12`, `0` — pafta numarası (metindir, sayı değil: `1.2` de olabilir). */
  sheetNo: string;
  /** `Ana Dağıtım-1` */
  title: string;
}

/** İlk sayfanın antedinden okunanlar. HEPSİ boş olabilir. */
export interface ElectricalTitleBlock {
  /** `028.00 185-40T Şarj Vinci` — PDF üstverisindeki proje adı. */
  projectName: string;
  /** `185/40T ŞARJ VİNCİ` — antetteki proje tanımı. */
  projectDescription: string;
  /** `028.00` — çizim bürosunun iş numarası (BİZİM iş no'muz DEĞİL). */
  jobNumber: string;
  /** `KARÇEL A.Ş.` */
  company: string;
  /** `KARDEMİR` */
  location: string;
  /** `H.ORAN` */
  drawnBy: string;
  /** Belgedeki toplam sayfa beyanı; gerçek sayfa adedi ayrıca ölçülür. */
  declaredPages: number | null;
  /** ISO tarih; okunamadıysa "". */
  dateIso: string;
}

/** Tek bir PDF'in okunmuş hâli. */
export interface ElectricalRead {
  /** Sözleşme sürümü — ileride göç için. */
  v: 1;
  /** Okumanın yapıldığı an (ISO). */
  readAt: string;
  /** GERÇEK sayfa adedi (ölçüm). */
  pageCount: number;
  titleBlock: ElectricalTitleBlock;
  sheets: ElectricalSheet[];
  parts: ElectricalPart[];
  /**
   * Malzeme listesinin bulunduğu 1 tabanlı sayfalar. Boşsa liste bulunamamış
   * demektir ve bu görünür olmalıdır — sessiz bir boşluk "proje malzeme
   * taşımıyor" diye okunurdu.
   */
  partsPages: number[];
  /** Tanıma notu; sorun yoksa "". */
  note: string;
}

/** Malzemenin panel/tedarikçi dökümündeki toplanmış hâli. */
export interface ElectricalRollupRow {
  key: string;
  label: string;
  /** Kaç ayrı satır. */
  lines: number;
  /** Adet toplamı; hiçbiri okunamadıysa `null`. */
  qty: number | null;
}

/** Aynı ürünün bütün satırları toplanmış hâli — sipariş edilebilir liste. */
export interface ElectricalMaterialRow {
  /** Gruplama anahtarı: `partNo` varsa o, yoksa `supplier|typeNo`. */
  key: string;
  partNo: string;
  typeNo: string;
  supplier: string;
  designation: string;
  /** Ürün bilgilerinden saf sınıflandırıcıyla türetilen işlev ailesi. */
  category: import("./category").ElectricalCategory;
  qty: number | null;
  /** Bu ürünün geçtiği konumlar (pano kodları), belgedeki sırayla. */
  locations: string[];
}
