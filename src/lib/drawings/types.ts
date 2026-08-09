// Teknik Resimler — paylaşılan tipler ve sözcük dağarcığı.
//
// Veritabanındaki `dwg_*` enum'larının birebir karşılığıdır; iki taraf
// ayrışırsa RLS'in ve arayüzün konuştuğu dil ikiye bölünür.

/** Dosyanın işlevi. Bilinmeyen uzantı `diger`dir — bu bir hata değildir. */
export const FILE_ROLES = ["model", "resim", "kesim", "bukum", "bom", "model3d", "diger"] as const;
export type FileRole = (typeof FILE_ROLES)[number];

export const FILE_ROLE_LABELS: Record<FileRole, string> = {
  model: "Model (DWG)",
  resim: "Resim (PDF)",
  kesim: "Kesim (DXF)",
  bukum: "Büküm",
  bom: "Ürün ağacı / BOM",
  model3d: "3B model",
  diger: "Diğer",
};

/**
 * Dosyanın yaşam döngüsü.
 *
 * `haric` REDDEDİLMİŞ demek DEĞİLDİR: dosya yine yüklenir ve arşivde durur,
 * yalnızca deftere ve sayımlara girmez. AutoCAD'in `.bak` yedeği ile Inventor'ın
 * `_Sheet` çalışma dosyası buraya düşer — ressamın klasörünü temizlemesini
 * beklemek yerine sistem onları görmezden gelir.
 */
export const FILE_LIFECYCLES = ["canli", "superse", "iptal", "kopya", "haric"] as const;
export type FileLifecycle = (typeof FILE_LIFECYCLES)[number];

export const FILE_LIFECYCLE_LABELS: Record<FileLifecycle, string> = {
  canli: "Canlı",
  superse: "Süperse",
  iptal: "İptal",
  kopya: "Kopya",
  haric: "Hariç",
};

export const PART_KINDS = ["montaj", "imalat", "satinalma", "bilinmiyor"] as const;
export type PartKind = (typeof PART_KINDS)[number];

export const PART_KIND_LABELS: Record<PartKind, string> = {
  montaj: "Montaj",
  imalat: "İmalat",
  satinalma: "Satın alma",
  bilinmiyor: "Belirsiz",
};

/**
 * Bulgu düzeyi — ÜÇ TANE VAR VE HİÇBİRİ ENGELLEYİCİ DEĞİLDİR.
 *
 * Hesap motorunda `engelleyici` bir kontrolün sağlanmadan revizyonun
 * yayınlanmaması demektir. BURADA öyle bir karşılık YOKTUR ve olmamalıdır:
 * yükleme her zaman başarılıdır, rapor yalnız insanın neye bakması gerektiğini
 * söyler. Bir teknik ressamın klasörünü sistemin reddetmesi, o ressamın bir
 * daha sistemi kullanmaması demektir.
 *
 *   eksik   — bir şey yok ve muhtemelen olmalıydı (insan bakmalı)
 *   celiski — iki kaynak farklı söylüyor (hangisinin kazandığı yazılır)
 *   bilgi   — sistem böyle yorumladı; sorun değil, kayda geçsin
 */
export const FINDING_KINDS = ["eksik", "celiski", "bilgi"] as const;
export type FindingKind = (typeof FINDING_KINDS)[number];

export const FINDING_KIND_LABELS: Record<FindingKind, string> = {
  eksik: "Eksik",
  celiski: "Çelişki",
  bilgi: "Bilgi",
};

export interface Finding {
  /** Makine kodu: PARCA_RESIMSIZ, TANINMADI… */
  code: string;
  kind: FindingKind;
  /** Parça kodu ya da dosya yolu — rapordan ağaca/gezgine bağlanır */
  subject: string;
  /** Tek Türkçe cümle. SUÇLAMAZ: "tanıyamadım", "standart dışı" değil. */
  title: string;
  /** Öneri. Emir kipinden kaçınılır. */
  detail?: string;
  data?: Record<string, unknown>;
  /** İlgili öneri maddesi (Ö-1…Ö-9) — rapordan belgeye bağlanır */
  hintId?: string;
}

/** Bir dosyanın yol + addan çözülmüş hâli. Bütün alanlar boş OLABİLİR. */
export interface ParsedFile {
  /** Kök klasör atılmış, NFC, "/" ayraçlı yol */
  relPath: string;
  folder: string;
  fileName: string;
  /** Noktasız, küçük harf: "dwg", "pdf", "dxf", "xlsx", "bak" */
  ext: string;
  role: FileRole;
  lifecycle: FileLifecycle;
  /** Normalize parça kodu; çözülemezse "" */
  partCode: string;
  /** Kodun ham hâli düzeltildiyse (00057 → 0057) */
  codeNormalized: boolean;
  /** "S355JR" | "BDS" | "Kestamid" — desen DAYATILMAZ */
  material: string;
  thicknessMm: number | null;
  qty: number | null;
  /** Addaki serbest açıklama: "KANCA ASKI SACI" */
  label: string;
  /** Hangi tanıyıcı tuttu; "" ise hiçbiri (dosya yine saklanır) */
  recognizedBy: string;
  /** Klasör adının beyan ettiği malzeme/kalınlık — dosya adıyla çelişebilir */
  folderMaterial: string;
  folderThicknessMm: number | null;
  size: number;
  checksum: string;
}

/** BOM Excel'inin türü — dosya adından okunur, içeriği değiştirmez. */
export const BOM_SOURCE_KINDS = ["depo", "urun_agaci", "bilinmiyor"] as const;
export type BomSourceKind = (typeof BOM_SOURCE_KINDS)[number];

export const BOM_SOURCE_KIND_LABELS: Record<BomSourceKind, string> = {
  depo: "Depo (satın alma)",
  urun_agaci: "Ürün ağacı",
  bilinmiyor: "Belirsiz",
};

/** Bir Excel satırının çözülmüş hâli. Her alan boş olabilir. */
export interface BomRow {
  fileRelPath: string;
  sheetName: string;
  sourceKind: BomSourceKind;
  /** Çalışma sayfasındaki gerçek satır numarası (1 tabanlı) */
  rowNo: number;
  /** ÜRÜN AĞACI "Item" sütunu: "1", "1.2", "6.9.1.1" */
  itemPath: string;
  partNumber: string;
  bomStructure: string;
  description: string;
  title: string;
  materialRaw: string;
  itemQtyRaw: string;
  qtyRaw: string;
  category: string;
  massRaw: string;
  revRaw: string;
  /** Sözlükte karşılığı olmayan sütunlar — atılmaz, saklanır */
  extra: Record<string, string>;
}
