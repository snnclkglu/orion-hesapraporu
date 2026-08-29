// VİNÇ KİMLİĞİ VE MÜŞTERİ PORTALI — saf veri sözleşmesi.
//
// Otomatik değer ile kullanıcının kararı AYRIDIR. `overrides` yalnız elle
// değiştirilen alanları taşır; "Otomatiğe dön" anahtarı siler. Böylece kaynak
// hesap raporunda değişince taslak kendiliğinden tazelenir, insanın özellikle
// yazdığı değer ise ezilmez. Yayımda `issuedIdentity` donmuş kopyadır.

export const PRODUCT_IDENTITY_FIELDS = [
  "manufacturer",
  "product",
  "craneType",
  "projectCode",
  "productionYear",
  "capacity",
  "span",
  "liftHeight",
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
  kind: "project" | "job_item" | "report" | "settings" | "system";
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

export interface PortalDocumentSelection {
  /** Taslakta kararlı kimlik; source kind/id değişse bile sıralama buna bağlıdır. */
  id: string;
  sourceKind: PortalSourceKind;
  sourceId: string;
  sourceLabel: string;
  sourceRevisionLabel: string;
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
  preview?: boolean;
}
