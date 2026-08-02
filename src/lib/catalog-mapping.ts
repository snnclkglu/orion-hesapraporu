// Katalogdan seçim eşlemeleri — revizyon editöründeki "Katalogdan Seç"
// combobox'unun modül bölümü → cat_equipment kind + attrs → selection alanı
// haritası. Eşlenemeyen attrs alanları doldurulmaz; manuel giriş her zaman
// mümkün kalır (katalog dışı ürün).
//
// Anahtar: bölümün ham id'si (rawId). Ana/yrd kaldırma aynı 2.x bölümlerini,
// araba/köprü aynı 5.x bölümlerini paylaşır — eşlemeler modül grubuna göredir.

export interface CatalogRow {
  id: string;
  brand: string;
  model: string;
  attrs: Record<string, unknown>;
}

/** Seçim alanının katalog satırındaki kaynağı */
type FieldSource =
  | "brand"
  | "model"
  | "brand_model" // "MARKA MODEL" birleşik metni
  | { attr: string };

export interface CatalogFieldMap {
  /** Doldurulacak selection alanı */
  sel: string;
  from: FieldSource;
  /** Sayısal birim dönüşümü (ör. Nm → kNm için 0.001) */
  scale?: number;
  /** Katalogdaki kısa kodu Türkçe karşılığıyla yaz (ör. IWRC → Çelik Öz) */
  translate?: boolean;
}

export interface SectionCatalogMapping {
  /** cat_equipment.kind */
  kind: string;
  fields: CatalogFieldMap[];
}

// ---------------------------------------------------------------- özetler

const numFmt = (v: unknown): string =>
  typeof v === "number" ? v.toLocaleString("tr-TR", { maximumFractionDigits: 2 }) : String(v ?? "");

// ------------------------------------------------- katalog türü yapılandırması

/** Katalog türlerinin Türkçe adları. */
export const CATALOG_KIND_LABELS: Record<string, string> = {
  motor: "Motor",
  gearbox: "Redüktör",
  rope: "Halat",
  brake: "Fren",
  bearing: "Rulman",
  wheel: "Tekerlek",
  hook: "Kanca",
  sheave: "Makara",
  coupling: "Kaplin",
  buffer: "Tampon",
  other: "Diğer",
};

export function catalogKindLabel(kind: string): string {
  return CATALOG_KIND_LABELS[kind] ?? kind;
}

/**
 * Katalog `attrs` anahtarlarının Türkçe adları. Anahtarların kendisi veri
 * sözleşmesidir (snake_case, değişmez); bu harita yalnız GÖSTERİM içindir.
 */
export const ATTR_LABELS: Record<string, string> = {
  // ortak
  series: "Seri",
  weight_kg: "Ağırlık [kg]",
  // motor
  power_kw: "Güç [kW]",
  poles: "Kutup Sayısı",
  rpm: "Devir [d/dak]",
  speed_rpm: "Devir [d/dak]",
  current_a: "Akım [A]",
  torque_nm: "Tork [Nm]",
  efficiency_pct: "Verim [%]",
  power_factor: "Güç Katsayısı",
  frame_size: "Gövde Ölçüsü",
  // redüktör
  ratio: "Çevrim Oranı",
  output_torque_nm: "Çıkış Torku [Nm]",
  output_speed_rpm: "Çıkış Devri [d/dak]",
  input_speed_rpm: "Giriş Devri [d/dak]",
  nominal_power_kw: "Nominal Güç [kW]",
  thermal_power_kw: "Termik Güç [kW]",
  service_factor: "Servis Faktörü",
  output_shaft_mm: "Çıkış Mili [mm]",
  // halat
  dia_mm: "Çap [mm]",
  core: "Öz Tipi",
  construction: "Halat Yapısı",
  grade_mpa: "Tel Mukavemeti [MPa]",
  wire_strength_kgmm2: "Tel Mukavemeti [kg/mm²]",
  breaking_load_kn: "Kopma Yükü [kN]",
  weight_kg_per_m: "Metre Ağırlığı [kg/m]",
  // fren
  brake_type: "Fren Tipi",
  brake_torque_nm: "Fren Torku [Nm]",
  min_torque_nm: "En Küçük Tork [Nm]",
  max_torque_nm: "En Büyük Tork [Nm]",
  wheel_dia_mm: "Kasnak / Disk Çapı [mm]",
  drum_diameter_mm: "Kasnak Çapı [mm]",
  disc_diameter_mm: "Disk Çapı [mm]",
  thruster_type: "İtici Tipi",
  power_w: "Güç [W]",
  hub_standard: "Göbek Standardı",
  // kaplin
  coupling_type: "Kaplin Tipi",
  sub_type: "Alt Tip",
  size: "Boy",
  nominal_torque_nm: "Nominal Tork [Nm]",
  max_speed_rpm: "En Yüksek Devir [d/dak]",
  max_shaft_dia_mm: "En Büyük Mil Çapı [mm]",
  min_shaft_dia_mm: "En Küçük Mil Çapı [mm]",
  max_radial_load_n: "En Büyük Radyal Yük [N]",
  outer_dia_mm: "Dış Çap [mm]",
  hub_dia_mm: "Göbek Çapı [mm]",
  // rulman
  type: "Rulman Serisi",
  bore_mm: "İç Çap [mm]",
  width_mm: "Genişlik [mm]",
  dynamic_load_kn: "Dinamik Yük C [kN]",
  static_load_kn: "Statik Yük C₀ [kN]",
  limiting_speed_rpm: "Sınır Devir [d/dak]",
  // kanca
  hook_nr: "Kanca No",
  d1_shaft_mm: "d₁ Mil Çapı [mm]",
  d2_shank_mm: "d₂ Sap Çapı [mm]",
  thread: "Vida",
  shank_length_mm: "Sap Boyu [mm]",
  // makara
  pitch_dia_mm: "Yiv Çapı [mm]",
  groove_radius_mm: "Yiv Yarıçapı [mm]",
  max_rope_mm: "En Büyük Halat Çapı [mm]",
  bearing_ref: "Rulman Referansı",
  shaft_dia_mm: "Mil Çapı [mm]",
  // tekerlek
  typical_rail: "Uygun Ray",
  typical_application: "Tipik Kullanım",
  max_load_kn: "En Büyük Teker Yükü [kN]",
  tread_width_mm: "Bandaj Genişliği [mm]",
  bearing_bore_mm: "Rulman İç Çapı [mm]",
};

/** Bir attrs anahtarının ekranda gösterilecek adı (yoksa anahtarın kendisi). */
export function attrLabel(attr: string): string {
  return ATTR_LABELS[attr] ?? attr;
}

/** Katalog verisindeki kısa kodların Türkçe karşılıkları. */
export const ATTR_VALUE_LABELS: Record<string, Record<string, string>> = {
  core: {
    FC: "Elyaf Öz (FC)",
    IWRC: "Çelik Öz (IWRC)",
    WSC: "Çelik Halat Öz (WSC)",
  },
  brake_type: {
    drum: "Kasnaklı (Tambur) Fren",
    disc: "Diskli Fren",
    caliper: "Kaliperli Disk Fren",
    em: "Elektromanyetik Fren",
  },
  coupling_type: {
    gear: "Dişli Kaplin",
    pin: "Pimli (Elastik) Kaplin",
    flexible: "Elastik Kaplin",
    drum: "Kasnaklı Kaplin",
    barrel: "Fıçı Tipi Dişli Kaplin",
  },
};

/** Bir attrs değerinin ekranda gösterilecek hâli. */
export function attrValueLabel(attr: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  const map = ATTR_VALUE_LABELS[attr];
  if (map && typeof value === "string" && map[value]) return map[value];
  if (typeof value === "number") {
    return value.toLocaleString("tr-TR", { maximumFractionDigits: 3 });
  }
  return String(value);
}

/** Kademeli seçimdeki bir filtre adımı. */
export interface CatalogFacet {
  attr: string;
  label: string;
  unit?: string;
}

/** Sonuç tablosunun bir sütunu. */
export interface CatalogColumn {
  /** attrs anahtarı, ya da satırın kendi alanı */
  attr: string | "model" | "brand";
  label: string;
  unit?: string;
}

export interface CatalogKindConfig {
  label: string;
  /** Sırayla sunulan filtre adımları (marka adımından sonra) */
  facets: CatalogFacet[];
  /** "En az" sayısal filtre — genellikle bileşenin kapasite değeri */
  minFilter?: { attr: string; label: string; unit?: string };
  /** Sonuç tablosu sütunları */
  columns: CatalogColumn[];
  /** Tabloyu bu attrs anahtarına göre artan sırala */
  sortBy?: string;
}

export const CATALOG_KINDS: Record<string, CatalogKindConfig> = {
  rope: {
    label: "Halat",
    facets: [
      { attr: "construction", label: "Halat Yapısı" },
      { attr: "grade_mpa", label: "Tel Mukavemeti", unit: "MPa" },
      { attr: "core", label: "Öz Tipi" },
    ],
    minFilter: { attr: "breaking_load_kn", label: "En Az Kopma Yükü", unit: "kN" },
    columns: [
      { attr: "dia_mm", label: "Çap", unit: "mm" },
      { attr: "core", label: "Öz" },
      { attr: "grade_mpa", label: "Mukavemet", unit: "MPa" },
      { attr: "breaking_load_kn", label: "Kopma Yükü", unit: "kN" },
      { attr: "weight_kg_per_m", label: "Metre Ağırlığı", unit: "kg/m" },
    ],
    sortBy: "dia_mm",
  },
  motor: {
    label: "Motor",
    facets: [
      { attr: "series", label: "Seri" },
      { attr: "poles", label: "Kutup Sayısı" },
    ],
    minFilter: { attr: "power_kw", label: "En Az Güç", unit: "kW" },
    columns: [
      { attr: "power_kw", label: "Güç", unit: "kW" },
      { attr: "poles", label: "Kutup" },
      { attr: "rpm", label: "Devir", unit: "d/dak" },
      { attr: "torque_nm", label: "Tork", unit: "Nm" },
      { attr: "frame_size", label: "Gövde" },
      { attr: "efficiency_pct", label: "Verim", unit: "%" },
      { attr: "weight_kg", label: "Ağırlık", unit: "kg" },
    ],
    sortBy: "power_kw",
  },
  gearbox: {
    label: "Redüktör",
    facets: [
      { attr: "series", label: "Seri" },
      { attr: "input_speed_rpm", label: "Giriş Devri", unit: "d/dak" },
    ],
    minFilter: { attr: "output_torque_nm", label: "En Az Çıkış Torku", unit: "Nm" },
    columns: [
      { attr: "model", label: "Model" },
      { attr: "ratio", label: "Çevrim Oranı" },
      { attr: "output_torque_nm", label: "Çıkış Torku", unit: "Nm" },
      { attr: "output_speed_rpm", label: "Çıkış Devri", unit: "d/dak" },
      { attr: "output_shaft_mm", label: "Çıkış Mili", unit: "mm" },
      { attr: "weight_kg", label: "Ağırlık", unit: "kg" },
    ],
    sortBy: "output_torque_nm",
  },
  brake: {
    label: "Fren",
    facets: [
      { attr: "series", label: "Seri" },
      { attr: "brake_type", label: "Fren Tipi" },
      { attr: "wheel_dia_mm", label: "Kasnak / Disk Çapı", unit: "mm" },
    ],
    minFilter: { attr: "brake_torque_nm", label: "En Az Fren Torku", unit: "Nm" },
    columns: [
      { attr: "model", label: "Model" },
      { attr: "brake_torque_nm", label: "Fren Torku", unit: "Nm" },
      { attr: "min_torque_nm", label: "Min. Tork", unit: "Nm" },
      { attr: "max_torque_nm", label: "Maks. Tork", unit: "Nm" },
      { attr: "wheel_dia_mm", label: "Kasnak Ø", unit: "mm" },
      { attr: "thruster_type", label: "İtici" },
      { attr: "weight_kg", label: "Ağırlık", unit: "kg" },
    ],
    sortBy: "brake_torque_nm",
  },
  coupling: {
    label: "Kaplin",
    facets: [
      { attr: "series", label: "Seri" },
      { attr: "coupling_type", label: "Kaplin Tipi" },
    ],
    minFilter: { attr: "nominal_torque_nm", label: "En Az Nominal Tork", unit: "Nm" },
    columns: [
      { attr: "model", label: "Model" },
      { attr: "nominal_torque_nm", label: "Nominal Tork", unit: "Nm" },
      { attr: "max_torque_nm", label: "Maks. Tork", unit: "Nm" },
      { attr: "max_shaft_dia_mm", label: "Maks. Mil Ø", unit: "mm" },
      { attr: "max_radial_load_n", label: "Radyal Yük", unit: "N" },
      { attr: "weight_kg", label: "Ağırlık", unit: "kg" },
    ],
    sortBy: "nominal_torque_nm",
  },
  bearing: {
    label: "Rulman",
    facets: [
      { attr: "type", label: "Rulman Serisi" },
      { attr: "bore_mm", label: "İç Çap", unit: "mm" },
    ],
    minFilter: { attr: "dynamic_load_kn", label: "En Az Dinamik Yük C", unit: "kN" },
    columns: [
      { attr: "model", label: "Kod" },
      { attr: "bore_mm", label: "İç Çap", unit: "mm" },
      { attr: "outer_dia_mm", label: "Dış Çap", unit: "mm" },
      { attr: "width_mm", label: "Genişlik", unit: "mm" },
      { attr: "dynamic_load_kn", label: "Dinamik C", unit: "kN" },
      { attr: "static_load_kn", label: "Statik C₀", unit: "kN" },
      { attr: "limiting_speed_rpm", label: "Sınır Devir", unit: "d/dak" },
    ],
    sortBy: "bore_mm",
  },
  wheel: {
    label: "Tekerlek",
    facets: [
      { attr: "typical_rail", label: "Uygun Ray" },
      { attr: "dia_mm", label: "Teker Çapı", unit: "mm" },
    ],
    minFilter: { attr: "max_load_kn", label: "En Az Teker Yükü", unit: "kN" },
    columns: [
      { attr: "dia_mm", label: "Çap", unit: "mm" },
      { attr: "max_load_kn", label: "Maks. Yük", unit: "kN" },
      { attr: "tread_width_mm", label: "Bandaj Genişliği", unit: "mm" },
      { attr: "typical_rail", label: "Ray" },
      { attr: "bearing_bore_mm", label: "Rulman İç Çapı", unit: "mm" },
      { attr: "weight_kg", label: "Ağırlık", unit: "kg" },
    ],
    sortBy: "dia_mm",
  },
  hook: {
    label: "Kanca",
    facets: [{ attr: "thread", label: "Vida" }],
    minFilter: { attr: "hook_nr", label: "En Az Kanca No" },
    columns: [
      { attr: "model", label: "Kanca" },
      { attr: "hook_nr", label: "Kanca No" },
      { attr: "d1_shaft_mm", label: "d₁ Mil", unit: "mm" },
      { attr: "d2_shank_mm", label: "d₂ Sap", unit: "mm" },
      { attr: "thread", label: "Vida" },
      { attr: "shank_length_mm", label: "Sap Boyu", unit: "mm" },
      { attr: "weight_kg", label: "Ağırlık", unit: "kg" },
    ],
    sortBy: "hook_nr",
  },
  sheave: {
    label: "Makara",
    facets: [{ attr: "dia_mm", label: "Anma Çapı", unit: "mm" }],
    minFilter: { attr: "max_rope_mm", label: "En Az Halat Çapı", unit: "mm" },
    columns: [
      { attr: "dia_mm", label: "Anma Çapı", unit: "mm" },
      { attr: "pitch_dia_mm", label: "Yiv Çapı", unit: "mm" },
      { attr: "outer_dia_mm", label: "Dış Çap", unit: "mm" },
      { attr: "bore_mm", label: "İç Çap", unit: "mm" },
      { attr: "width_mm", label: "Genişlik", unit: "mm" },
      { attr: "max_rope_mm", label: "Maks. Halat Ø", unit: "mm" },
      { attr: "shaft_dia_mm", label: "Mil Çapı", unit: "mm" },
    ],
    sortBy: "dia_mm",
  },
};

/** Türe ait yapılandırma; tanımsızsa yalnız marka + model listesi gösterilir. */
export function catalogKindConfig(kind: string): CatalogKindConfig {
  return (
    CATALOG_KINDS[kind] ?? {
      label: catalogKindLabel(kind),
      facets: [],
      columns: [{ attr: "model", label: "Model" }],
    }
  );
}

/** Satırdan bir sütun/facet değerini okur ("model"/"brand" satırın kendi alanı). */
export function catalogCellValue(row: CatalogRow, attr: string): unknown {
  if (attr === "model") return row.model;
  if (attr === "brand") return row.brand;
  return row.attrs[attr];
}

/** Combobox satırında marka+model yanında gösterilen ana özellik özeti */
export function catalogRowSummary(kind: string, row: CatalogRow): string {
  const a = row.attrs;
  switch (kind) {
    case "motor":
      return `${numFmt(a.power_kw)} kW · ${numFmt(a.rpm)} d/dak · ${numFmt(a.poles)}K`;
    case "gearbox":
      return `i=${numFmt(a.ratio)} · ${numFmt(a.output_torque_nm)} Nm · n₁=${numFmt(a.input_speed_rpm)}`;
    case "rope":
      return `Ø${numFmt(a.dia_mm)} mm · ${numFmt(a.breaking_load_kn)} kN · ${attrValueLabel("core", a.core)}`;
    case "brake":
      return a.brake_torque_nm !== undefined
        ? `${numFmt(a.brake_torque_nm)} Nm${a.wheel_dia_mm !== undefined ? ` · Ø${numFmt(a.wheel_dia_mm)}` : ""}`
        : `Ø${numFmt(a.wheel_dia_mm)} mm`;
    case "bearing":
      return `C=${numFmt(a.dynamic_load_kn)} kN · C₀=${numFmt(a.static_load_kn)} kN`;
    case "wheel":
      return `Ø${numFmt(a.dia_mm)} mm · ${numFmt(a.max_load_kn)} kN`;
    case "hook":
      return `d₁=${numFmt(a.d1_shaft_mm)} mm · ${a.thread ?? ""}`;
    case "sheave":
      return `Ø${numFmt(a.dia_mm)} mm · halat ≤ ${numFmt(a.max_rope_mm)} mm`;
    case "coupling":
      return `${numFmt(a.nominal_torque_nm)} Nm${a.max_shaft_dia_mm !== undefined ? ` · d ≤ ${numFmt(a.max_shaft_dia_mm)} mm` : ""}`;
    default:
      return "";
  }
}

// ---------------------------------------------------------------- eşlemeler

/** Kaldırma grupları (ana 2.x / yrd 3.x — rawId 2.x) */
const HOIST_MAP: Record<string, SectionCatalogMapping> = {
  // 2.1 Halat
  "2.1": {
    kind: "rope",
    fields: [
      { sel: "ropeBrand", from: "brand" },
      { sel: "ropeDiaMm", from: { attr: "dia_mm" } },
      { sel: "ropeConstruction", from: { attr: "construction" } },
      { sel: "ropeCore", from: { attr: "core" }, translate: true },
      { sel: "ropeWireStrength", from: { attr: "wire_strength_kgmm2" } },
      { sel: "ropeBreakingLoadKn", from: { attr: "breaking_load_kn" } },
      // Halat ağırlığının otomatik hesabı için metre ağırlığı (bkz. calc/derive.ts)
      { sel: "ropeWeightKgPerM", from: { attr: "weight_kg_per_m" } },
    ],
  },
  // 2.2.6 Tambur rulmanı
  "2.2.6": {
    kind: "bearing",
    fields: [
      { sel: "bearingType", from: { attr: "type" } },
      { sel: "bearingCode", from: "model" },
      { sel: "bearingDynCKn", from: { attr: "dynamic_load_kn" } },
      { sel: "bearingStatC0Kn", from: { attr: "static_load_kn" } },
    ],
  },
  // 2.3 Redüktör
  "2.3": {
    kind: "gearbox",
    fields: [
      { sel: "gearboxModel", from: "model" },
      { sel: "gearboxRatio", from: { attr: "ratio" } },
      { sel: "gearboxNominalTorqueKnm", from: { attr: "output_torque_nm" }, scale: 0.001 },
      { sel: "gearboxOutputShaftMm", from: { attr: "output_shaft_mm" } },
    ],
  },
  // 2.4 Motor
  "2.4": {
    kind: "motor",
    fields: [
      { sel: "motorBrand", from: "brand" },
      { sel: "motorPowerKw", from: { attr: "power_kw" } },
      { sel: "motorRpm", from: { attr: "rpm" } },
    ],
  },
  // 2.5 Fren
  "2.5": {
    kind: "brake",
    fields: [
      { sel: "brakeBrand", from: "brand" },
      { sel: "brakeModel", from: "model" },
      { sel: "brakeTorqueNm", from: { attr: "brake_torque_nm" } },
      { sel: "brakeWheelDiaMm", from: { attr: "wheel_dia_mm" } },
    ],
  },
  // 2.6 Motor — redüktör kaplini
  "2.6": {
    kind: "coupling",
    fields: [
      { sel: "motorCouplingBrand", from: "brand" },
      { sel: "motorCouplingModel", from: "model" },
      { sel: "motorCouplingTorqueNm", from: { attr: "nominal_torque_nm" } },
      { sel: "motorCouplingDmaxMm", from: { attr: "max_shaft_dia_mm" } },
    ],
  },
  // 2.7 Tambur kaplini
  "2.7": {
    kind: "coupling",
    fields: [
      { sel: "drumCouplingBrand", from: "brand" },
      { sel: "drumCouplingModel", from: "model" },
      { sel: "drumCouplingTorqueNm", from: { attr: "nominal_torque_nm" } },
      { sel: "drumCouplingRadialN", from: { attr: "max_radial_load_n" } },
      { sel: "drumCouplingDmaxMm", from: { attr: "max_shaft_dia_mm" } },
    ],
  },
};

/** Kanca bloğu (4.x) */
const HOOKBLOCK_MAP: Record<string, SectionCatalogMapping> = {
  // 4.1 Kanca — kapasite DIN 15400 Tablo 3'ten türetilir, katalog yalnız
  // tanım ve kanca numarasını doldurur.
  "4.1": {
    kind: "hook",
    fields: [
      { sel: "hookDesignation", from: "model" },
      { sel: "hookNumber", from: { attr: "hook_nr" } },
    ],
  },
  // 4.2 Makaralar
  "4.2": {
    kind: "sheave",
    fields: [{ sel: "sheaveDiaMm", from: { attr: "dia_mm" } }],
  },
  // 4.3 Makara rulmanları — iç çap mil çapı D1 ile eşleşmelidir
  "4.3": {
    kind: "bearing",
    fields: [
      { sel: "sheaveBearingType", from: { attr: "type" } },
      { sel: "sheaveBearingCode", from: "model" },
      { sel: "sheaveBearingBoreMm", from: { attr: "bore_mm" } },
      { sel: "sheaveBearingDynCKn", from: { attr: "dynamic_load_kn" } },
      { sel: "sheaveBearingStatC0Kn", from: { attr: "static_load_kn" } },
    ],
  },
  // 4.5 Kanca rulmanı
  "4.5": {
    kind: "bearing",
    fields: [
      { sel: "hookBearingType", from: { attr: "type" } },
      { sel: "hookBearingCode", from: "model" },
      { sel: "hookBearingStatC0Kn", from: { attr: "static_load_kn" } },
    ],
  },
};

/** Yürütme grupları (araba 5.x / köprü 6.x — rawId 5.x) */
const TRAVEL_MAP: Record<string, SectionCatalogMapping> = {
  // 5.1 Tekerlekler
  "5.1": {
    kind: "wheel",
    fields: [{ sel: "wheelDiaMm", from: { attr: "dia_mm" } }],
  },
  // 5.3 Tekerlek rulmanı
  "5.3": {
    kind: "bearing",
    fields: [
      { sel: "bearingType", from: { attr: "type" } },
      { sel: "bearingCode", from: "model" },
      { sel: "bearingDynCKn", from: { attr: "dynamic_load_kn" } },
      { sel: "bearingStatC0Kn", from: { attr: "static_load_kn" } },
    ],
  },
  // 5.4 Yürütme motoru
  "5.4": {
    kind: "motor",
    fields: [
      { sel: "motorBrand", from: "brand" },
      { sel: "motorPowerKw", from: { attr: "power_kw" } },
      { sel: "motorRpm", from: { attr: "rpm" } },
    ],
  },
  // 5.5 Yürütme dişli kutusu
  "5.5": {
    kind: "gearbox",
    fields: [
      { sel: "gearboxModel", from: "model" },
      { sel: "gearboxRatio", from: { attr: "ratio" } },
      { sel: "gearboxOutputTorqueKnm", from: { attr: "output_torque_nm" }, scale: 0.001 },
      { sel: "gearboxOutputShaftMm", from: { attr: "output_shaft_mm" } },
    ],
  },
  // 5.5b Yürütme freni (köprü)
  "5.5b": {
    kind: "brake",
    fields: [
      { sel: "brakeBrand", from: "brand_model" },
      { sel: "brakeTorqueNm", from: { attr: "brake_torque_nm" } },
      { sel: "brakeWheelDiaMm", from: { attr: "wheel_dia_mm" } },
    ],
  },
  // 5.6 Motor — dişli kutusu kaplini
  "5.6": {
    kind: "coupling",
    fields: [
      { sel: "motorCouplingBrand", from: "brand" },
      { sel: "motorCouplingModel", from: "model" },
      { sel: "motorCouplingTorqueNm", from: { attr: "nominal_torque_nm" } },
      { sel: "motorCouplingDmaxMm", from: { attr: "max_shaft_dia_mm" } },
    ],
  },
  // 5.7 Teker — dişli kutusu kaplini
  "5.7": {
    kind: "coupling",
    fields: [
      { sel: "wheelCouplingBrand", from: "brand" },
      { sel: "wheelCouplingModel", from: "model" },
      { sel: "wheelCouplingTorqueNm", from: { attr: "nominal_torque_nm" } },
      { sel: "wheelCouplingDmaxMm", from: { attr: "max_shaft_dia_mm" } },
    ],
  },
};

// Aynı aileye giren tüm bölümler aynı katalog eşlemesini kullanır: ana,
// yardımcı ve monoray kaldırma grupları HOIST_MAP; her kanca bloğu
// HOOKBLOCK_MAP; tüm arabalar ve köprü TRAVEL_MAP.
const MAP_BY_MODULE: Record<string, Record<string, SectionCatalogMapping>> = {
  main: HOIST_MAP,
  aux: HOIST_MAP,
  mono1: HOIST_MAP,
  mono2: HOIST_MAP,
  hookBlock: HOOKBLOCK_MAP,
  auxHookBlock: HOOKBLOCK_MAP,
  mono1HookBlock: HOOKBLOCK_MAP,
  mono2HookBlock: HOOKBLOCK_MAP,
  trolley: TRAVEL_MAP,
  auxTrolley: TRAVEL_MAP,
  mono1Trolley: TRAVEL_MAP,
  mono2Trolley: TRAVEL_MAP,
  bridge: TRAVEL_MAP,
};

/** Bölümün katalog eşlemesi (yoksa combobox gösterilmez) */
export function getCatalogMapping(
  moduleKey: string,
  rawSectionId: string
): SectionCatalogMapping | undefined {
  return MAP_BY_MODULE[moduleKey]?.[rawSectionId];
}

/** Seçilen katalog satırını selection alanlarına çevirir (eşlenemeyenler atlanır) */
export function applyCatalogPick(
  mapping: SectionCatalogMapping,
  row: CatalogRow
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of mapping.fields) {
    let v: unknown;
    if (f.from === "brand") v = row.brand;
    else if (f.from === "model") v = row.model;
    else if (f.from === "brand_model") v = `${row.brand} ${row.model}`.trim();
    else v = row.attrs[f.from.attr];
    if (v === undefined || v === null || v === "") continue;
    if (f.scale !== undefined && typeof v === "number") v = v * f.scale;
    if (f.translate && f.from !== "brand" && f.from !== "model" && f.from !== "brand_model") {
      v = attrValueLabel(f.from.attr, v);
    }
    out[f.sel] = v;
  }
  return out;
}
