// VİNÇ KİMLİĞİ VE MÜŞTERİ PORTALI — saf veri sözleşmesi.
//
// Otomatik değer ile kullanıcının kararı AYRIDIR. `overrides` yalnız elle
// değiştirilen alanları taşır; "Otomatiğe dön" anahtarı siler. Böylece kaynak
// hesap raporunda değişince taslak kendiliğinden tazelenir, insanın özellikle
// yazdığı değer ise ezilmez. Yayımda `issuedIdentity` donmuş kopyadır.

/*
 * ALAN LİSTESİ YASAL BİR ZORUNLULUĞU TAŞIR — sıra ve kapsam keyfi değildir.
 *
 * 2006/42/AT (Makine Emniyeti) Ek I md. 1.7.3, makinenin üzerinde OKUNAKLI ve
 * SİLİNMEZ biçimde şunları ister: imalatçının ticari unvanı ve TAM ADRESİ, CE
 * işareti, makinenin tanımı, SERİ VEYA TİP TANIMLAMASI, varsa seri numarası ve
 * İMALATIN TAMAMLANDIĞI YIL. Kaldırma makinelerinde md. 4.3.3 ayrıca AZAMİ
 * ÇALIŞMA YÜKÜNÜN "belirgin" işaretlenmesini ister.
 *
 * `manufacturerAddress`, `machineModel` ve `mass` bu yüzden eklendi; öncesinde
 * plaka teknik bir künyeydi, yasal bir isim plakası değildi. Alanların DB
 * karşılığı yoktur — payload JSONB'dir ve `withProductPortalDefaults` eksik
 * anahtarı boş dizeye indirir, o yüzden migration GEREKMEZ.
 */
export const PRODUCT_IDENTITY_FIELDS = [
  "manufacturer",
  "manufacturerAddress",
  "product",
  "craneType",
  "machineModel",
  "projectCode",
  "productionYear",
  "capacity",
  "span",
  "liftHeight",
  "mass",
  "dutyClass",
  "supplyVoltage",
  "controlVoltage",
  "frequency",
  "customer",
  "site",
] as const;

export type ProductIdentityField = (typeof PRODUCT_IDENTITY_FIELDS)[number];

export type ProductIdentityValues = Record<ProductIdentityField, string>;

export interface IdentitySource {
  kind: "project" | "job_item" | "report" | "settings" | "customer" | "system";
  label: string;
  sourceId?: string;
  revisionLabel?: string;
}

export interface ResolvedIdentityField {
  key: ProductIdentityField;
  autoValue: string;
  effectiveValue: string;
  overridden: boolean;
  source: IdentitySource;
}

export const PORTAL_SOURCE_KINDS = [
  "report",
  "equipment",
  "manual",
  "electrical",
  "specification",
  "drawing",
  "custom",
] as const;

export type PortalSourceKind = (typeof PORTAL_SOURCE_KINDS)[number];
export type PortalAccessMode = "view_watermarked" | "download";

export const PORTAL_REPORT_LEVELS = [
  "ozet",
  "standart",
  "detayli",
  "teker_yukleri",
] as const;

export type PortalReportLevel = (typeof PORTAL_REPORT_LEVELS)[number];
export type PortalEquipmentDetail = "standart" | "detayli";

export const PORTAL_FOLDER_OPTIONS = [
  { key: "hesap-raporlari", title: "Hesap Raporları", sort: 10 },
  { key: "ekipman-listeleri", title: "Ekipman Listeleri", sort: 20 },
  { key: "isletme-bakim", title: "İşletme ve Bakım", sort: 30 },
  { key: "elektrik-projeleri", title: "Elektrik Projeleri", sort: 40 },
  { key: "proje-belgeleri", title: "Proje Belgeleri", sort: 50 },
  { key: "teknik-resimler", title: "Teknik Resimler", sort: 60 },
  { key: "diger", title: "Diğer Belgeler", sort: 90 },
] as const;

export type PortalFolderKey = (typeof PORTAL_FOLDER_OPTIONS)[number]["key"];

export interface PortalDocumentSelection {
  /** Taslakta kararlı kimlik; source kind/id değişse bile sıralama buna bağlıdır. */
  id: string;
  sourceKind: PortalSourceKind;
  sourceId: string;
  sourceLabel: string;
  sourceRevisionLabel: string;
  /** Kaynağın kendi resmî çıktı seçimi; eski kayıtlarda güvenli varsayıma iner. */
  reportLevel?: PortalReportLevel;
  equipmentDetail?: PortalEquipmentDetail;
  title: string;
  folderKey: string;
  folderTitle: string;
  folderSort: number;
  fileSort: number;
  accessMode: PortalAccessMode;
  included: boolean;
  automatic: boolean;
  ready: boolean;
  unavailableReason?: string;
}

export interface ProductPortalPayload {
  v: 1;
  serialBase: string;
  plate: {
    widthMm: number;
    heightMm: number;
    /** Üretim kararıdır; bilinmiyorsa çizimde delik basılmaz. */
    holeDiameterMm?: number;
    holeInsetMm?: number;
    /**
     * CE İŞARETİ BİR BEYANDIR, SÜS DEĞİLDİR.
     *
     * İşaret yalnız makine uygunsa ve AT Uygunluk Beyanı düzenlenmişse
     * iliştirilir. Varsayılan AÇIKTIR (ORION CE kapsamında üretir), ama
     * kapatılabilir olması şart: uygunluk değerlendirmesi tamamlanmamış bir
     * makineye CE basmak, eksik bir plakadan çok daha ağır bir hatadır.
     */
    ceMark?: boolean;
    /**
     * TEK RENK KAZIMA. Metal plakada lazer/pantograf tek renk iz bırakır;
     * kömür–kâğıt–kırmızı marka kompozisyonu orada okunmaz. Bu kip bütün
     * dolguları mürekkep/kâğıda indirger ve zeminleri boşaltır.
     */
    monochrome?: boolean;
  };
  overrides: Partial<Record<ProductIdentityField, string>>;
  hiddenFields: ProductIdentityField[];
  portal: {
    title: string;
    note: string;
    supportEmail: string;
  };
  documents: PortalDocumentSelection[];
  /** Yalnız yayımlanmış sürümde vardır; müşteri sonradan değişen kaynağı görmez. */
  issuedIdentity?: ProductIdentityValues;
}

export interface CraneUnitRow {
  id: string;
  ordinal: number;
  suffix: string;
  serialNo: string;
  publicCode: string;
  hasPassword: boolean;
  passwordVersion: number;
  portalEnabled: boolean;
}

export interface ProductPortalRevisionRow {
  id: string;
  revNo: number;
  status: "draft" | "issued";
  payload: ProductPortalPayload;
  createdAt: string;
  issuedAt: string | null;
}

export interface ProductPortalFileDto {
  id: string;
  folderKey: string;
  folderTitle: string;
  folderSort: number;
  fileSort: number;
  title: string;
  fileName: string;
  revisionLabel: string;
  accessMode: PortalAccessMode;
  sizeBytes: number;
  pageCount: number;
}

/** Dış bileşene verilebilecek en küçük yüz; iç kimlikler ve storage yolu yoktur. */
export interface CustomerPortalDto {
  company: string;
  portalTitle: string;
  note: string;
  supportEmail: string;
  product: string;
  craneType: string;
  serialNo: string;
  productionYear: string;
  projectCode: string;
  revisionLabel: string;
  publishedAt: string;
  files: ProductPortalFileDto[];
  publicCode: string;
  /*
   * MÜŞTERİNİN KENDİ MARKASI — portal ona ait hissettirmelidir.
   *
   * Plaka zaten çift markalıdır (ORION + müşteri logosu, Yönetim → Müşteriler'den).
   * QR'ı okutan kişi kendi fabrikasının vincine bakıyor; karşısına yalnız
   * tedarikçinin markası çıkması yabancı bir yüzdür. Logo `customers.logo_path`ten
   * gelir; müşteri alanı plakada gizlenmişse portalda da gösterilmez.
   */
  customerName: string;
  customerLogoDataUrl: string | null;
  preview?: boolean;
}
