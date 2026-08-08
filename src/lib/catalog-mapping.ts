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
  /** Sayıyı metin alanına yazarken eklenecek birim (ör. " mm") */
  suffix?: string;
}

export interface SectionCatalogMapping {
  /** cat_equipment.kind */
  kind: string;
  fields: CatalogFieldMap[];
  /**
   * Seçici açılırken kilitlenen filtreler. Bir bölüm yalnız kendi kullanım
   * grubuna uygun ürünü göstermeli: kaldırma redüktörü kataloğunda yürütme
   * redüktörü çıkmamalı. Kullanıcı bu adımı değiştiremez; katalogda karşılığı
   * olmayan (alanı boş) satırlar da elenir.
   *
   * Değer bir DİZİ de olabilir: aynı işlevi gören birden çok katalog kodu tek
   * bölüme girer (ör. tambur kaplini ÖZGÜN'de `drum`, JAURE'de `barrel`
   * kodludur — ikisi de aynı bölümün ürünüdür).
   */
  lockedFacets?: Record<string, string | string[]>;
}

/** Kilitli filtrenin değerlerini her zaman dizi olarak verir. */
export function lockedFacetValues(value: string | string[]): string[] {
  return Array.isArray(value) ? value : [value];
}

/**
 * Üretici kataloğuyla doğrulanmamış satır. Seed betiği bu bayrağı yalnız
 * kaynağı firma Excel'i olan (üretici teyidi bulunmayan) ürünlere koyar;
 * seçici bu satırları uyarıyla gösterir.
 */
export function isUnverifiedRow(row: CatalogRow): boolean {
  return row.attrs.unverified === true;
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
  air_conditioner: "Klima",
  bearing_housing: "Rulman Yatağı",
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
  efficiency_class: "Verim Sınıfı",
  power_factor: "Güç Katsayısı",
  frame_size: "Gövde Ölçüsü",
  ip_class: "Koruma Sınıfı",
  // Motor mil çapı: kaplin mili çapını besler (maks(motor mili, redüktör
  // giriş mili)); redüktördeki output_shaft_mm / input_shaft_mm ile aynı desen.
  shaft_mm: "Mil Çapı [mm]",
  shaft_source: "Mil Çapı Kaynağı",
  // redüktör
  application: "Kullanım Grubu",
  ratio: "Çevrim Oranı",
  ratio_range: "Çevrim Oranı Aralığı",
  output_torque_nm: "Çıkış Torku [Nm]",
  output_speed_rpm: "Çıkış Devri [d/dak]",
  input_speed_rpm: "Giriş Devri [d/dak]",
  nominal_power_kw: "Nominal Güç [kW]",
  thermal_power_kw: "Termik Güç [kW]",
  thermal_power_fan_kw: "Termik Güç — Fanlı [kW]",
  service_factor: "Servis Faktörü",
  output_shaft_mm: "Çıkış Mili [mm]",
  input_shaft_mm: "Giriş Mili [mm]",
  hollow_bore_mm: "Delik Mil Çapı [mm]",
  shrinkdisc_bore_mm: "Sıkma Bileziği Delik Çapı [mm]",
  allowed_radial_output_kn: "İzin Verilen Radyal Yük — Çıkış [kN]",
  allowed_radial_input_kn: "İzin Verilen Radyal Yük — Giriş [kN]",
  stages: "Kademe Sayısı",
  dimension_page: "Katalog Ölçü Sayfası",
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
  brake_dia_options_mm: "Fren Kasnağı Çap Seçenekleri [mm]",
  max_bore_aluminium_mm: "En Büyük Delik — Alüminyum Göbek [mm]",
  weight_min_kg: "Ağırlık — En Küçük Delik [kg]",
  weight_max_kg: "Ağırlık — En Büyük Delik [kg]",
  // tampon
  // `type` anahtarı hem rulman serisini hem tampon tipini taşır; etiket
  // ikisini de karşılayacak biçimde nötrdür (sütun/adım etiketleri türe
  // özgü olarak CATALOG_KINDS içinde ayrıca verilir).
  type: "Tip / Seri",
  stroke_mm: "Strok [mm]",
  energy_kj: "Enerji Kapasitesi [kJ]",
  energy_j: "Enerji Kapasitesi [J]",
  energy_static_kj: "Enerji Kapasitesi — Statik [kJ]",
  max_force_kn: "En Büyük Kuvvet [kN]",
  diameter_mm: "Çap [mm]",
  height_mm: "Yükseklik [mm]",
  max_compression_pct: "İzin Verilen Sıkışma [%]",
  program: "Katalog Programı",
  form: "Biçim",
  mounting: "Bağlantı",
  packing_unit: "Paket Adedi",
  standard_range: "Standart Program",
  damping_efficiency: "Sönümleme Verimi",
  design_mass_t_max: "En Büyük Tasarım Kütlesi [t]",
  metering_pin_code: "Kısma İğnesi Kodu",
  metering_pins: "Kısma İğnesi Tablosu",
  force_matrix: "Darbe Kuvveti Matrisi",
  energy_curve: "Enerji Eğrisi",
  force_curve: "Kuvvet Eğrisi",
  curve_units: "Eğri Birimleri",
  curve_source_page: "Eğri Katalog Sayfası",
  max_restoring_energy_kn: "Geri Getirme Kuvveti [kN]",
  max_impact_speed_mps: "En Büyük Çarpma Hızı [m/s]",
  plunger_dia_d2_mm: "Piston Çapı d₂ [mm]",
  bolt_hole_d3_mm: "Cıvata Deliği d₃ [mm]",
  unverified: "Üretici Teyidi Yok",
  source: "Kaynak",
  // rulman
  bore_mm: "İç Çap [mm]",
  width_mm: "Genişlik [mm]",
  dynamic_load_kn: "Dinamik Yük C [kN]",
  static_load_kn: "Statik Yük C₀ [kN]",
  limiting_speed_rpm: "Sınır Devir [d/dak]",
  // tambur rulman yatağı
  housing_series: "Yatak Serisi",
  compatible_bearing: "Uyumlu Rulman",
  bearing_outer_dia_mm: "Rulman Dış Çapı [mm]",
  housing_width_mm: "Yatak Genişliği A₂ [mm]",
  seat_type: "Yataklama Tipi",
  catalog_page: "Katalog Tablosu",
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
  // Klima
  cooling_capacity_kw_min: "Soğutma Kapasitesi — En Küçük [kW]",
  cooling_capacity_kw_max: "Soğutma Kapasitesi — En Büyük [kW]",
  ambient_temp_min_c: "Ortam Sıcaklığı — En Küçük [°C]",
  ambient_temp_max_c: "Ortam Sıcaklığı — En Büyük [°C]",
  service_class: "Hizmet Sınıfı",
  dust_resistance: "Toz Dayanımı",
  corrosion_resistance: "Korozyon Dayanımı",
  vibration_resistance: "Titreşim Dayanımı",
  features: "Özellikler",
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
    brake: "Fren Kasnaklı Kaplin",
    disc: "Diskli (Lamelli) Kaplin",
    chain: "Zincirli Kaplin",
  },
  application: {
    kaldirma: "Kaldırma",
    yurutme: "Yürütme",
  },
  // Tampon tipi — değerler katalog verisinde zaten Türkçedir, burada yalnız
  // baş harfi büyütülür. (`type` anahtarı rulmanda seri kodunu taşır; oradaki
  // değerler bu anahtarlarla çakışmaz.)
  type: {
    hidrolik: "Hidrolik",
    kauçuk: "Kauçuk",
    hücresel: "Hücresel",
    bilinmiyor: "Bilinmiyor",
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
  if (typeof value === "boolean") return value ? "Evet" : "Hayır";
  // Tamponlarda attrs bir tabloyu (darbe kuvveti matrisi, kısma iğneleri) ya
  // da bir eğriyi taşıyabilir; ham JSON "[object Object]" olarak basılmasın.
  if (Array.isArray(value)) {
    return value.every((v) => typeof v === "number" || typeof v === "string")
      ? value.join(" · ")
      : `${value.length} satır`;
  }
  if (typeof value === "object") return `${Object.keys(value).length} alan`;
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
      { attr: "efficiency_class", label: "Verim Sınıfı" },
    ],
    minFilter: { attr: "power_kw", label: "En Az Güç", unit: "kW" },
    columns: [
      { attr: "model", label: "Tip Kodu" },
      { attr: "power_kw", label: "Güç", unit: "kW" },
      { attr: "poles", label: "Kutup" },
      { attr: "rpm", label: "Devir", unit: "d/dak" },
      { attr: "torque_nm", label: "Tork", unit: "Nm" },
      { attr: "frame_size", label: "Gövde" },
      // Mil çapı kaplin bölümünü besler; seçim ekranında görünmesi gerekir.
      { attr: "shaft_mm", label: "Mil Çapı", unit: "mm" },
      { attr: "efficiency_pct", label: "Verim", unit: "%" },
      { attr: "efficiency_class", label: "Verim Sınıfı" },
      { attr: "weight_kg", label: "Ağırlık", unit: "kg" },
    ],
    sortBy: "power_kw",
  },
  gearbox: {
    label: "Redüktör",
    facets: [
      { attr: "application", label: "Kullanım Grubu" },
      { attr: "series", label: "Seri" },
      { attr: "input_speed_rpm", label: "Giriş Devri", unit: "d/dak" },
    ],
    minFilter: { attr: "output_torque_nm", label: "En Az Çıkış Torku", unit: "Nm" },
    columns: [
      { attr: "model", label: "Model" },
      { attr: "ratio", label: "Çevrim Oranı" },
      { attr: "output_torque_nm", label: "Çıkış Torku", unit: "Nm" },
      { attr: "output_speed_rpm", label: "Çıkış Devri", unit: "d/dak" },
      { attr: "allowed_radial_output_kn", label: "İzin Ver. Radyal Yük", unit: "kN" },
      { attr: "output_shaft_mm", label: "Çıkış Mili", unit: "mm" },
      { attr: "input_shaft_mm", label: "Giriş Mili", unit: "mm" },
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
    // Madde 14: SERİ ilk adımdır — kaplin kataloğu marka başına onlarca
    // seriye ayrıldı (ÖZGÜN 28 tip, SIBRE 11 seri, JAURE MT alt serileri) ve
    // mühendis önce seriyi seçer. Kaplin tipi kilitli olan bölümlerde
    // (2.6/2.7/5.6) bu adım listeden düşer, başlıkta rozet olur.
    facets: [
      { attr: "series", label: "Seri" },
      { attr: "coupling_type", label: "Kaplin Tipi" },
    ],
    minFilter: { attr: "nominal_torque_nm", label: "En Az Nominal Tork", unit: "Nm" },
    columns: [
      { attr: "model", label: "Model" },
      { attr: "series", label: "Seri" },
      { attr: "nominal_torque_nm", label: "Nominal Tork", unit: "Nm" },
      { attr: "max_torque_nm", label: "Maks. Tork", unit: "Nm" },
      { attr: "min_shaft_dia_mm", label: "Min. Mil Ø", unit: "mm" },
      { attr: "max_shaft_dia_mm", label: "Maks. Mil Ø", unit: "mm" },
      { attr: "max_radial_load_n", label: "Radyal Yük", unit: "N" },
      { attr: "weight_kg", label: "Ağırlık", unit: "kg" },
    ],
    sortBy: "nominal_torque_nm",
  },
  // (Madde 20, 21) Tampon — üç aile (hidrolik / kauçuk / hücresel) tek kind
  // altında birleştirildi; ortak anahtarlar seed betiğinde üretilir.
  buffer: {
    label: "Tampon",
    facets: [
      { attr: "type", label: "Tampon Tipi" },
      { attr: "stroke_mm", label: "Strok", unit: "mm" },
    ],
    minFilter: { attr: "energy_kj", label: "En Az Enerji Kapasitesi", unit: "kJ" },
    columns: [
      { attr: "model", label: "Model" },
      { attr: "type", label: "Tip" },
      { attr: "stroke_mm", label: "Strok", unit: "mm" },
      { attr: "energy_kj", label: "Enerji", unit: "kJ" },
      { attr: "max_force_kn", label: "Maks. Kuvvet", unit: "kN" },
      { attr: "diameter_mm", label: "Çap", unit: "mm" },
      { attr: "height_mm", label: "Yükseklik", unit: "mm" },
      { attr: "weight_kg", label: "Ağırlık", unit: "kg" },
    ],
    sortBy: "energy_kj",
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
  bearing_housing: {
    label: "Rulman Yatağı",
    facets: [
      { attr: "housing_series", label: "Yatak Serisi" },
      { attr: "compatible_bearing", label: "Uyumlu Rulman" },
    ],
    columns: [
      { attr: "model", label: "Yatak Kodu" },
      { attr: "housing_series", label: "Seri" },
      { attr: "compatible_bearing", label: "Uyumlu Rulman" },
      { attr: "bearing_bore_mm", label: "İç Çap", unit: "mm" },
      { attr: "bearing_outer_dia_mm", label: "Dış Çap", unit: "mm" },
      { attr: "housing_width_mm", label: "Genişlik A₂", unit: "mm" },
      { attr: "seat_type", label: "Yataklama" },
    ],
    sortBy: "bearing_bore_mm",
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
      return `i=${numFmt(a.ratio ?? a.ratio_range)} · ${numFmt(a.output_torque_nm)} Nm${a.input_speed_rpm !== undefined ? ` · n₁=${numFmt(a.input_speed_rpm)}` : ""}`;
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
    case "buffer":
      return `${attrValueLabel("type", a.type)} · ${numFmt(a.stroke_mm)} mm · ${numFmt(a.energy_kj)} kJ · ${numFmt(a.max_force_kn)} kN`;
    case "bearing_housing":
      return `${numFmt(a.compatible_bearing)} · Ø${numFmt(a.bearing_bore_mm)} / Ø${numFmt(a.bearing_outer_dia_mm)} mm · A₂ ${numFmt(a.housing_width_mm)} mm`;
    default:
      return "";
  }
}

/** SKF temel rulman kodunu, E soneki olan/olmayan kayıtlarda ortak anahtara indirger. */
export function bearingHousingCompatibilityKey(bearingCode: unknown): string {
  if (typeof bearingCode !== "string") return "";
  return bearingCode.trim().replace(/\s+E(?:\s.*)?$/i, "");
}

// ---------------------------------------------------------------- eşlemeler

/**
 * [Madde 13] TAMBUR KAPLİNİ olarak seçilebilecek katalog kodları.
 *
 * ÖZGÜN markasında tambur kaplini TİP J'dir ve veri de böyle üretilmiştir
 * (`coupling_type: "drum"`). Ama tambur kaplini bir ÖZGÜN ürünü değil bir
 * İŞLEVDİR: SIBRE ABC-V de (`drum`), JAURE TCBR de (`barrel`) aynı yere
 * takılır — üçü de tamburu redüktör çıkış miline bağlar ve üçü de radyal yük
 * kapasitesi (`max_radial_load_n`) basan tek kaplin ailesidir; bölüm 2.7'nin
 * `drumCoupling.radial` kontrolü tam olarak o alanı okur. Kilidi yalnız
 * "drum" koduna daraltmak JAURE TCBR'yi listeden düşürürdü.
 */
const DRUM_COUPLING_TYPES: string[] = ["drum", "barrel"];

/**
 * MOTOR — REDÜKTÖR kaplini olarak seçilebilecek katalog kodları.
 *
 * Motor mili ile redüktör giriş mili arasındaki kaplin dişli, elastik, pimli
 * ya da diskli olabilir. "brake" (ÖZGÜN B1/B2/B3) de buraya girer: o seri
 * fren kasnağını KAPLİNİN ÜZERİNDE taşıyan bir motor kaplinidir — bölüm 2.5
 * servis frenini kasnak çapıyla seçtiği için kasnak bu kapline aittir. Dışta
 * kalanlar tambur kaplinleri (`drum`, `barrel`) ve zincirli kaplindir
 * (`chain`, ÖZGÜN E — vinç tahrikinde kullanılmaz, güç tablosu bile HP
 * cinsindendir).
 */
const MOTOR_COUPLING_TYPES: string[] = ["gear", "flexible", "pin", "disc", "brake"];

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
  // 2.2.7 Tambur rulman yatağı — `compatible_bearing` filtresi editörde
  // seçilen rulman kodundan dinamik eklenir; katalogda uyumsuz yatak görünmez.
  "2.2.7": {
    kind: "bearing_housing",
    fields: [
      { sel: "bearingHousingBrand", from: "brand" },
      { sel: "bearingHousingCode", from: "model" },
      { sel: "bearingHousingSeries", from: { attr: "housing_series" } },
      { sel: "bearingHousingCompatibleBearing", from: { attr: "compatible_bearing" } },
      { sel: "bearingHousingBoreMm", from: { attr: "bearing_bore_mm" } },
      { sel: "bearingHousingWidthMm", from: { attr: "housing_width_mm" } },
      { sel: "bearingHousingSeatType", from: { attr: "seat_type" } },
    ],
  },
  // 2.3 Redüktör — kaldırma grubu kataloğu
  "2.3": {
    kind: "gearbox",
    lockedFacets: { application: "kaldirma" },
    fields: [
      { sel: "gearboxModel", from: "brand_model" },
      { sel: "gearboxRatio", from: { attr: "ratio" } },
      { sel: "gearboxNominalTorqueKnm", from: { attr: "output_torque_nm" }, scale: 0.001 },
      { sel: "gearboxOutputShaftMm", from: { attr: "output_shaft_mm" } },
      { sel: "gearboxInputShaftMm", from: { attr: "input_shaft_mm" } },
      { sel: "gearboxWeightKg", from: { attr: "weight_kg" } },
      // Engelleyici `gearbox.radial` kontrolünü besler; katalogda yoksa
      // mühendisin elle girdiği değer korunur.
      { sel: "gearboxAllowedRadialKn", from: { attr: "allowed_radial_output_kn" } },
    ],
  },
  // 2.4 Motor
  "2.4": {
    kind: "motor",
    fields: [
      { sel: "motorBrand", from: "brand" },
      { sel: "motorPowerKw", from: { attr: "power_kw" } },
      // Devir KATALOGTAKİ GERÇEK yüklü devirdir (1465, 1470, …) ve senkron
      // devire YUVARLANMAZ: motorRpm gerekli çevrim oranını (n/n_tambur),
      // gerçekleşen kaldırma hızını ve gerekli motor gücünü doğrudan
      // besliyor (hoistGroup.ts) — 1465 yerine 1500 yazmak bu üç sonucu da
      // %2,4 kaydırır, yani yuvarlama HESAP HATASIDIR.
      { sel: "motorRpm", from: { attr: "rpm" } },
      // Motor mili: maks(motorShaftMm, gearboxInputShaftMm) ile kaplin mil
      // çapını belirler (2.6 motorCoupling.shaftDia → motorCoupling.bore
      // kontrolü). Katalogda karşılığı olmayan bir alan applyCatalogPick
      // tarafından SESSİZCE atlandığı için eşlemesi zorunludur.
      { sel: "motorShaftMm", from: { attr: "shaft_mm" } },
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
    lockedFacets: { coupling_type: MOTOR_COUPLING_TYPES },
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
    lockedFacets: { coupling_type: DRUM_COUPLING_TYPES },
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
      // Gerçek yüklü devir — travelGroup.ts gerçekleşen yürüyüş hızını,
      // gerekli çevrim oranını, giriş torkunu ve tampon tahrik kuvvetini
      // bu sayıdan üretir; senkron devire yuvarlamak hepsini kaydırır.
      { sel: "motorRpm", from: { attr: "rpm" } },
      // Köprüde kaplin mili doğrudan motorShaftMm'den okunur
      // (travelGroup.ts: isTrolley ? couplingMotorShaftMm : motorShaftMm).
      { sel: "motorShaftMm", from: { attr: "shaft_mm" } },
    ],
  },
  // 5.5 Yürütme dişli kutusu — yürütme grubu kataloğu
  "5.5": {
    kind: "gearbox",
    lockedFacets: { application: "yurutme" },
    fields: [
      { sel: "gearboxModel", from: "brand_model" },
      { sel: "gearboxRatio", from: { attr: "ratio" } },
      { sel: "gearboxOutputTorqueKnm", from: { attr: "output_torque_nm" }, scale: 0.001 },
      { sel: "gearboxOutputShaftMm", from: { attr: "output_shaft_mm" } },
      { sel: "gearboxInputShaftText", from: { attr: "input_shaft_mm" }, suffix: " mm" },
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
    lockedFacets: { coupling_type: MOTOR_COUPLING_TYPES },
    fields: [
      { sel: "motorCouplingBrand", from: "brand" },
      { sel: "motorCouplingModel", from: "model" },
      { sel: "motorCouplingTorqueNm", from: { attr: "nominal_torque_nm" } },
      { sel: "motorCouplingDmaxMm", from: { attr: "max_shaft_dia_mm" } },
    ],
  },
  // 5.7 Teker — dişli kutusu kaplini
  // KİLİTLİ SÜZGEÇ YOK: teker mili bağlantısında dişli, elastik ve fıçı tipi
  // kaplinlerin hepsi kullanılabilir (kaçıklık toleransı yüksek olan tercih
  // edilir); bir tipi baştan elemek mühendisi kısıtlardı.
  "5.7": {
    kind: "coupling",
    fields: [
      { sel: "wheelCouplingBrand", from: "brand" },
      { sel: "wheelCouplingModel", from: "model" },
      { sel: "wheelCouplingTorqueNm", from: { attr: "nominal_torque_nm" } },
      { sel: "wheelCouplingDmaxMm", from: { attr: "max_shaft_dia_mm" } },
    ],
  },
  // 5.8 Tampon — (Madde 20, 21) hidrolik / kauçuk / hücresel tek katalogda.
  // Bu alanlar tampon hesabının doğrudan girdisidir (travelGroup.ts):
  // bufferStrokeMm yürütme enerjisini (D·s) ve tampon yükünü,
  // bufferEnergyKj ile bufferLoadKn `buffer.energy` / `buffer.load`
  // kontrollerini besler.
  "5.8": {
    kind: "buffer",
    fields: [
      { sel: "bufferModel", from: "brand_model" },
      { sel: "bufferCatalogType", from: { attr: "type" } },
      { sel: "bufferStrokeMm", from: { attr: "stroke_mm" } },
      { sel: "bufferEnergyKj", from: { attr: "energy_kj" } },
      { sel: "bufferLoadKn", from: { attr: "max_force_kn" } },
      // Kauçukta gerçek sıkışma ve kuvvet, yalnız katalog yük eğrilerinden
      // okunabilir; ürün seçildiğinde bu eğriler hesap girdisine de taşınır.
      { sel: "bufferEnergyCurve", from: { attr: "energy_curve" } },
      { sel: "bufferForceCurve", from: { attr: "force_curve" } },
      { sel: "bufferMaxCompressionPct", from: { attr: "max_compression_pct" } },
      // SIBRE SP kısma iğnesi tablosu da seçilen strokla birlikte gelir;
      // kod hesaplanan tampon başına kütleden otomatik türetilir.
      { sel: "bufferMeteringPins", from: { attr: "metering_pins" } },
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

/**
 * Bölümün seçim alanları içinde ürünün KİMLİĞİNİ taşıyanlar.
 *
 * Katalog sayfası (`lib/catalog-sheets.ts`) marka + model ile bulunur; hangi
 * seçim alanının markayı, hangisinin modeli tuttuğu bölümden bölüme değişir
 * (`motorCouplingBrand` / `wheelCouplingBrand` / `drumCouplingBrand` …). Bu
 * bilgi eşlemede zaten vardır — `from: "brand"` ve `from: "model"` — ve burada
 * tek yerden okunur; hiçbir bölüm için elle liste tutulmaz.
 *
 * `brand_model` birleşik alanı kimlik olarak KULLANILMAZ: metni geri ayırmak
 * marka adında boşluk olan ürünlerde (ör. "Marka Belirsiz (Firma Excel'i)")
 * sessizce yanlış eşleme üretirdi.
 */
export function catalogIdentityFields(mapping: SectionCatalogMapping): {
  brandField?: string;
  modelField?: string;
} {
  const find = (source: "brand" | "model") =>
    mapping.fields.find((f) => f.from === source)?.sel;
  return { brandField: find("brand"), modelField: find("model") };
}

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
    if (f.suffix !== undefined) v = `${numFmt(v)}${f.suffix}`;
    out[f.sel] = v;
  }
  return out;
}
