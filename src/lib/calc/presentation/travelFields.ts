// Yürütme grubu form alanı metadata'sı — UI formları bu tanımlardan üretilir.
// key'ler TravelInputs / TravelSelections alan adlarıyla birebir aynıdır.
// Araba ve köprü aynı alan listesini kullanır; yalnız tek varyantta anlamlı
// olan alanlar yorumda belirtilmiştir ve bölüm tanımları (travelSections)
// hangi alanın nerede sorulacağını belirler.

import {
  CMAA_APPLICATION_CLASSES,
  CMAA_APPLICATION_CLASS_LABELS,
  CMAA_DRIVE_CONTROLS,
  CMAA_DRIVE_CONTROL_LABELS,
  CMAA_MOTOR_CONTROLS,
  CMAA_MOTOR_CONTROL_LABELS,
} from "../derive";
import {
  TRAVEL_MOTOR_POWERS,
  GEARBOX_OUTPUT_FEATURES,
  GEARBOX_OUTPUT_FEATURE_LABELS,
  GEARBOX_MOUNTING_POSITIONS,
  MOTOR_MOUNT_INFO_TEXT,
  MOTOR_MOUNT_TYPES,
  MOTOR_MOUNT_TYPE_LABELS,
  MOTOR_BRAKE_OPTIONS,
  MOTOR_EFFICIENCY_CLASSES,
  MOTOR_ENCODER_OPTIONS,
  MOTOR_INSULATION_CLASSES,
  MOTOR_INSULATION_CLASS_LABELS,
  MOTOR_DUTY_TYPES,
  MOTOR_DUTY_TYPE_LABELS,
  MOTOR_THERMAL_PROTECTIONS,
  MOTOR_THERMAL_PROTECTION_LABELS,
  BRAKE_OPTIONS,
  BRAKE_OPTIONS_HINT,
  GEARBOX_OPTIONS,
  GEARBOX_OPTIONS_HINT,
  COUPLING_SEAL_TYPES,
  BEARING_BRANDS,
  BEARING_BRAND_HINT,
  type FieldDef,
} from "../fields";
import { TRAVEL_NO, TRAVEL_YES } from "../modules/travelGroup";
import type { TravelInputs, TravelSelections, TravelWhich } from "../modules/travelGroup";
import { WHEEL_COUNT_OPTIONS } from "../modules/wheelLoads";
import {
  RAILS,
  RAIL_FAMILIES,
  RAIL_FAMILY_LABELS,
  railCodesOfFamily,
  railFamilyOf,
  railNominalHeadWidthMm,
} from "../tables";

/**
 * Kauçuk tampon gövde malzemesi kaliteleri (Conductix-Wampfler). N ve S
 * standart, diğerleri özel kalitedir (yalnız büyük siparişte). Tam özellik
 * tablosu standarts registry'de "Conductix Kauçuk Kaliteleri" kaydındadır.
 */
export const BUFFER_RUBBER_QUALITIES: readonly string[] = [
  "N", "S", "SBR", "EPDM", "NBR", "VMQ",
];
export const BUFFER_RUBBER_QUALITY_LABELS: Record<string, string> = {
  N: "N — NR (Doğal Kauçuk)",
  S: "S — CR (Kloropren)",
  SBR: "SBR — Stiren-Bütadien (özel)",
  EPDM: "EPDM — Etilen-Propilen (özel)",
  NBR: "NBR — Nitril-Bütadien (özel)",
  VMQ: "VMQ — Silikon (özel)",
};

/** Teker çapı FEM standart serisi [mm] */
export const WHEEL_DIA_SERIES_MM = [
  "200", "250", "315", "400", "500", "630", "710", "800", "900", "1000", "1120", "1250",
] as const;
/**
 * Ray kodlarının TAM listesi — ailelere göre süzülmeden. İkinci kutunun
 * tabanıdır: aile tanınmazsa (çok eski bir kayıt) hiçbir seçenek kaybolmaz.
 */
export const RAIL_TYPES: readonly string[] = Object.keys(RAILS);
/**
 * Ray kodunun okunur etiketi: kod + anma baş genişliği (+ metre ağırlığı).
 *
 * Kod tek başına ("S24", "A75") ölçü söylemez; mühendis listeden seçerken
 * rayın başını ve ağırlığını görmelidir. Çubuk raylarda metre ağırlığı
 * kesitten hesaplandığı için (bkz. `railMassKgPerM`) etikete yazılmaz —
 * çelik yoğunluğu hesabın girdisidir, listenin değil.
 */
export const RAIL_CODE_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(RAILS).map(([code, row]) => {
    if (row.family === "bar") {
      const [a, b] = code.split(/[xX]/);
      return [code, `${a} × ${b} mm`];
    }
    const head = railNominalHeadWidthMm(code);
    const parts = [`baş ${head.toLocaleString("tr-TR", { maximumFractionDigits: 0 })} mm`];
    if (row.massKgPerM !== undefined) {
      parts.push(`${row.massKgPerM.toLocaleString("tr-TR")} kg/m`);
    }
    return [code, `${code} — ${parts.join(" · ")}`];
  })
);

export const WHEEL_MATERIALS = ["AISI 4140+QT", "42CrMo4", "C60", "GS-70"] as const;
export const WHEEL_TENSILE_OPTIONS = Array.from({ length: 11 }, (_, i) => String(500 + i * 50));
export const WHEEL_SHAFT_MATERIALS = ["42CrMo4", "42CrMo4+QT", "S355JR", "CK45"] as const;

/** İki durumlu tampon girdilerinin seçenekleri (kayıtta metin olarak durur). */
export const YES_NO = [TRAVEL_NO, TRAVEL_YES] as const;

/**
 * YALNIZ TEK VARYANTTA SORULAN GİRDİLER: alan → o alanın sahibi varyant.
 *
 * Araba ve köprü aynı alan listesini paylaşır; bazı büyüklükler ise yalnız
 * KÖPRÜ hesabına girer. Bunlar arabada da kutu olarak açılıyordu ve mühendis
 * hesaba hiç girmeyen bir sayı doldurmuş oluyordu (kullanıcı bildirimi,
 * 23.08.2026: *"minimum araba yanaşması değerini alıyoruz ama kullanmıyoruz"*).
 * Sunum adaptörü (`travelAdapter`) bu haritayı okuyup kutuyu ilgisiz
 * varyanttan düşürür — DEĞER KORUNUR, yalnız sorulmaz.
 *
 * Fren emniyet katsayısı (`brakeServiceFactor`) burada YOKTUR: onun bölümü
 * (5.5b) zaten `bridgeOnly` olduğu için arabada hiç açılmaz.
 */
export const TRAVEL_INPUT_VARIANT: Record<string, TravelWhich> = {
  // Araba açıklık üzerinde konumlanır → köprü teker yükü eksantrikliği.
  // Arabanın kendi teker yükü dört tekere eşit paylaştırılır; yanaşmayla
  // ilgisi yoktur.
  minApproachM: "bridge",
  // NOT: `bufferApproachM` (5.8) de yalnız köprü dalında kullanılır ama
  // kullanıcı kararı henüz o kutuyu kapsamıyor; kaldırılacaksa buraya bir
  // satır eklemek yeter.
};

export const TRAVEL_INPUT_FIELDS: FieldDef<TravelInputs>[] = [
  // Ağırlıklar teknik özelliklerdeki "Ağırlıklar" grubundan gelir; burada sorulmaz.
  { key: "minApproachM", label: "Minimum Araba Yanaşması", unit: "m", type: "number" }, // sadece köprü
  {
    key: "wheelCount", label: "Tekerlek Adedi", type: "select",
    options: WHEEL_COUNT_OPTIONS.map(String), numeric: true,
    hint: "Vinç dört köşesinde eşit tekerle yürür; adet dördün katıdır. 16 teker = köşe başına 4, ray başına 8.",
  },
  {
    key: "driveCount", label: "Tahrik Sayısı", type: "select",
    options: ["1", "2", "4", "8", "16"], numeric: true,
    hint:
      "Bağımsız yürütme tahriki adedidir. Motor adedi otomatikken bu sayıya " +
      "eşitlenir; tahrikli teker sayısı = tahrik sayısı × motor başına teker.",
  },
  {
    key: "wheelsPerMotor", label: "Motor Başına Tahrikli Teker", type: "select",
    options: ["1", "2"], numeric: true,
    hint: "Tek tahrik bir mil üzerinden iki tekeri birden döndürebilir. Tahrikli teker sayısı = tahrik sayısı × bu değer.",
  },
  { key: "shaftSpanAMm", label: "Mil Mesnet Ölçüsü A", unit: "mm", type: "number", hint: "Mesnet ile tekerlek yükü arasındaki mesafe; mesnet aralığı 2·a alınır." },
  { key: "shaftSpanBMm", label: "Mil Mesnet Ölçüsü B", unit: "mm", type: "number" },
  { key: "shaftDiaMm", label: "Teker Mili Çapı", unit: "mm", type: "number", diameter: true },
  {
    key: "wheelWidthMm", label: "Teker Genişliği", unit: "mm", type: "number",
    hint:
      "Tekerin mile bastığı bandaj genişliği. Teker yükü bu genişlik boyunca " +
      "YAYILI kabul edilir (q = Pmaks / b); boş ya da 0 bırakılırsa yük tekil " +
      "kuvvet olarak alınır.",
  },
  { key: "stressConcFactor", label: "Gerilme Yığılması Katsayısı", type: "number" },
  { key: "bearingCount", label: "Rulman Adedi", type: "number" },
  { key: "bearingFactorY0", label: "Rulman Eşdeğer Yük Katsayısı Y0 (Statik)", type: "number" },
  { key: "bearingFactorY1", label: "Rulman Eşdeğer Yük Katsayısı Y1 (Dinamik)", type: "number" },
  {
    key: "applicationClass", label: "Uygulama Sınıfı", type: "select",
    options: CMAA_APPLICATION_CLASSES, optionLabels: CMAA_APPLICATION_CLASS_LABELS,
    standardRef: "CMAA 70 5.2.9.1.2.1",
    hint:
      "CMAA 70 servis sınıfı. Otomatik: FEM mekanizma sınıfından getirilir " +
      "(M1/M2/M3→A · M4→B · M5→C · M6→D · M7→E · M8→F). Bu eşleme hiçbir " +
      "standartta normatif değildir; yaygın karşılığa dayanan firma kabulüdür " +
      "ve anahtar kapatılıp elle düzeltilebilir.",
  },
  {
    key: "driveControl", label: "Tahrik / Kumanda Tipi", type: "select",
    options: CMAA_DRIVE_CONTROLS, optionLabels: CMAA_DRIVE_CONTROL_LABELS,
    standardRef: "CMAA 70 T.5.2.9.1.2.1-E",
    hint:
      "CMAA 70 Tablo 5.2.9.1.2.1-E'nin SÜTUNU. Servis faktörü Ks yalnız " +
      "uygulama sınıfından seçilemez; tabloda kumanda tipi ikinci eksendir.",
  },
  {
    key: "serviceFactorKs", label: "Servis Faktörü Ks", type: "number",
    standardRef: "CMAA 70 T.5.2.9.1.2.1-E",
    hint:
      "Otomatik: CMAA 70 Tablo 5.2.9.1.2.1-E'den uygulama sınıfı (satır) × " +
      "tahrik/kumanda tipi (sütun) ile seçilir. Tabloda \"N/A\" olan hücrelerde " +
      "(E ve F sınıfı, 30 dakikalık DC sütunu) otomatik seçim yapılmaz.",
  },
  {
    key: "motorControl", label: "Motor / Kumanda Tipi", type: "select",
    options: CMAA_MOTOR_CONTROLS, optionLabels: CMAA_MOTOR_CONTROL_LABELS,
    standardRef: "CMAA 70 T.5.2.9.1.2.1-C",
    hint:
      "CMAA 70 Tablo 5.2.9.1.2.1-C'nin SATIRI. Kt uygulama sınıfına BAĞLI " +
      "DEĞİLDİR; tablo yalnız motor ve kumanda tipiyle indislenir.",
  },
  {
    key: "accelTorqueFactorKt", label: "İvmelenme Tork Faktörü Kt", type: "number",
    standardRef: "CMAA 70 T.5.2.9.1.2.1-C",
    hint:
      "Otomatik: CMAA 70 Tablo 5.2.9.1.2.1-C. Aralık verilen satırlarda ALT uç " +
      "seçilir (tablo dipnotu 2: sürekli kayma direncinde alt uç önerilir); " +
      "alt uç aynı zamanda gerekli gücü artıran muhafazakâr taraftır.",
  },
  { key: "reducerStages", label: "Redüktör Kademe Sayısı", type: "number" },
  {
    key: "accelerationMs2", label: "İvme a", unit: "m/s²", type: "number",
    hint: "Otomatik: M1–M4 0,12 · M5 0,13 · M6 0,15 · M7 0,2 · M8 0,25.",
    info:
      "Yürütme ivmesi mekanizma sınıfına göre öntanımlı gelir: ağır hizmet " +
      "sınıfı daha sık ve daha sert kalkış demektir, ivme sınıfla birlikte " +
      "büyür.\n\n" +
      "Eşleme hiçbir standartta normatif DEĞİLDİR — FEM 1.001 ve CMAA 70 " +
      "ivmeyi işletme koşullarına bırakır. Bu bir ORION tasarım kabulüdür; " +
      "anahtarı kapatıp işin kendi koşuluna göre elle girebilirsiniz.\n\n" +
      "İvme iki yere birden girer: kalkış süresi t = V / 60 / a ve CMAA 70 " +
      "ivmelenme faktörü Ka. Büyütmek gerekli motor gücünü artırır.",
  },
  { key: "tempFactor", label: "Sıcaklık Faktörü", type: "number" },
  {
    key: "gearboxServiceFactor", label: "Redüktör Emniyet Katsayısı", type: "number",
    hint: "Otomatik: M1–M4 1,4 · M5 1,5 · M6 1,6 · M7 1,9 · M8 2,1.",
  },
  { key: "brakeServiceFactor", label: "Fren Emniyet Katsayısı", type: "number" },        // sadece köprü
  { key: "motorCouplingServiceFactor", label: "Motor Kaplini Emniyet Katsayısı", type: "number" },
  { key: "wheelCouplingServiceFactor", label: "Teker Kaplini Emniyet Katsayısı", type: "number" },
  { key: "bufferApproachM", label: "Tampon Hesabı Araba Yanaşması", unit: "m", type: "number" }, // sadece köprü
  {
    key: "bufferCount", label: "Kurulu Tampon Adedi", type: "select",
    options: ["1", "2", "4"], numeric: true,
    hint:
      "Varsayılan 2'dir: tek çarpma yönünde iki tampon aynı anda yük alır. " +
      "4, iki hareket yönünde ikişer tampon kurulu olduğunu gösterir; tek çarpmada " +
      "yalnız çarpılan taraftaki iki tampon aktiftir. KAT0170, s.6'daki yerleşim " +
      "şeması için aşağıdaki 'Yerleşim rehberi'ne bakın.",
  },
  {
    key: "bufferLoadRigidlyGuided", label: "Yük Rijit Kılavuzlu", type: "select",
    options: YES_NO, optionLabels: { Hayır: "Hayır — Yük Salınabilir", Evet: "Evet — Rijit Kılavuz" },
    standardRef: "FEM 1.001 2.2.3.4.1",
    hint:
      "FEM 1.001 md. 2.2.3.4.1: yük salınabiliyorsa çarpışan kütleye GİRMEZ. " +
      "Rijit kılavuz (kepçe kolonu, teleskopik kılavuz) varsa kapasite ve " +
      "kanca donanımı da kütleye eklenir.",
  },
  {
    key: "bufferFrequentEndApproach", label: "Yürüyüş Sınırına Sık Ulaşılıyor",
    type: "select", options: YES_NO,
    standardRef: "FEM 1.001 7.7.1.2",
    hint:
      "FEM 1.001 md. 7.7.1.2: normal işletmede yürüyüş sınırına sık " +
      "ulaşılıyorsa azami yavaşlama 5 m/s² yerine 2,5 m/s² ile sınırlıdır.",
  },
  // --- Feston (5.9). Hareket mesafesi ve hız SORULMAZ: teknik özelliklerden
  // okunur (arabada açıklık, köprüde yürüme yolu uzunluğu).
  { key: "festoonTrolleyCount", label: "Kablo Taşıyıcı Adedi", unit: "adet", type: "number" },
  {
    key: "festoonCablePackageWeightKg", label: "Hareketli Kablo Paketi", unit: "kg", type: "number",
    hint: "Taşıyıcılara asılan kabloların toplam ağırlığı; taşıyıcı adedine eşit dağıtılır.",
  },
  {
    key: "festoonLoopHeightM", label: "Azami Loop Yüksekliği", unit: "m", type: "number",
    hint: "Kablo sarkmasının izin verilen en büyük derinliği; şemada gösterilir.",
  },
];

export const TRAVEL_SELECTION_FIELDS: FieldDef<TravelSelections>[] = [
  // RAY SEÇİMİ İKİ KUTULUDUR (kullanıcı kararı, 23.08.2026): önce aile, sonra
  // o ailenin ölçüleri. Tek kutuda A serisi, S serisi ve çubuk raylar alt
  // alta akıyordu ve liste büyüdükçe okunmaz hâle geliyordu. Araba ve köprü
  // AYNI iki kutuyu kullanır.
  {
    key: "railFamily", label: "Ray Tipi", type: "select",
    options: RAIL_FAMILIES, optionLabels: RAIL_FAMILY_LABELS,
    hint: "Aile değişince alttaki ölçü listesi de o ailenin raylarına döner.",
  },
  {
    key: "railCode", label: "Ray Ölçüsü", type: "select", options: RAIL_TYPES,
    // Liste SEÇİLEN AİLEDEN gelir. Kayıtlı kod ailesiz bir eski revizyondan
    // geliyorsa kendi ailesi çözülür — kutu boş açılmaz.
    optionsFrom: (sel) => {
      const family = String(sel.railFamily ?? "").trim() ||
        railFamilyOf(sel.railCode as string | undefined);
      const codes = railCodesOfFamily(family);
      return codes.length > 0 ? codes : RAIL_TYPES;
    },
    optionLabels: RAIL_CODE_LABELS,
  },
  { key: "wheelMaterial", label: "Tekerlek Malzemesi", type: "select", options: WHEEL_MATERIALS },
  {
    key: "wheelTensileNmm2", label: "Tekerlek Malzemesi Çekme Dayanımı",
    unit: "N/mm²", type: "select", options: WHEEL_TENSILE_OPTIONS,
    numeric: true, allowCustom: true,
    hint: "500–1000 N/mm² arası 50'şer basamakla önerilir; malzeme sertifikasındaki değer listede yoksa Elle Gir ile yazılabilir.",
  },
  { key: "wheelDiaMm", label: "Tekerlek Çapı", unit: "mm", type: "select", options: WHEEL_DIA_SERIES_MM, numeric: true, diameter: true },
  { key: "shaftMaterial", label: "Mil Malzemesi", type: "select", options: WHEEL_SHAFT_MATERIALS },
  {
    key: "bearingBrand", label: "Rulman Markası", type: "multiselect",
    options: BEARING_BRANDS as unknown as string[],
    hint: BEARING_BRAND_HINT,
  },
  { key: "bearingType", label: "Rulman Tipi", type: "text" },
  { key: "bearingCode", label: "Rulman Kodu", type: "text" },
  { key: "bearingDynCKn", label: "Dinamik Yük Katsayısı C", unit: "kN", type: "number" },
  { key: "bearingStatC0Kn", label: "Statik Yük Katsayısı C0", unit: "kN", type: "number" },
  { key: "bearingBoreMm", label: "Rulman İç Çapı", unit: "mm", type: "number", diameter: true, hint: "Teker mili çapıyla birebir eşleşmelidir." },
  { key: "bearingOuterDiaMm", label: "Rulman Dış Çapı", unit: "mm", type: "number", diameter: true },
  { key: "bearingWidthMm", label: "Rulman Genişliği", unit: "mm", type: "number" },
  { key: "motorBrand", label: "Motor Markası", type: "text" },
  {
    key: "motorPowerKw", label: "Seçilen Motor Gücü", unit: "kW", type: "select",
    options: TRAVEL_MOTOR_POWERS.options, optionLabels: TRAVEL_MOTOR_POWERS.optionLabels,
    numeric: true,
  },
  {
    // Bkz. `fields.ts` motorRpm: katalog gerçek yüklü devri verir ve bu değer
    // gerçekleşen yürüyüş hızı, çevrim oranı, giriş torku ve tampon tahrik
    // kuvvetine doğrudan girer — anma devri açılır listesi yanıltıcıydı.
    key: "motorRpm", label: "Seçilen Motor Devri", unit: "d/dak", type: "number",
    hint: "Katalogdan gelen gerçek yüklü devir (anma devri değil).",
  },
  {
    key: "motorCount", label: "Motor Sayısı", type: "select",
    options: ["1", "2", "4", "8", "16"], numeric: true,
    hint:
      "Otomatikken Tahrik Sayısına eşittir. Anahtar kapatılırsa katalogdaki " +
      "gerçek motor adedi elle seçilebilir.",
  },
  { key: "motorShaftMm", label: "Motor Mil Çapı", unit: "mm", type: "number", diameter: true },
  {
    key: "motorMountType", label: "Motor Bağlantı Biçimi", type: "select",
    options: MOTOR_MOUNT_TYPES as unknown as string[], optionLabels: MOTOR_MOUNT_TYPE_LABELS,
    hint: "IEC montaj biçimi (B5 büyük flanşlı, B14 yüz flanşlı). Sipariş için gerekli.",
    infoGuide: "motorMount",
    info: MOTOR_MOUNT_INFO_TEXT,
  },
  {
    key: "motorBrakeType", label: "Motor Freni", type: "select",
    options: MOTOR_BRAKE_OPTIONS as unknown as string[],
    hint: "Motor kendinden frenli (fren motoru) mi.",
  },
  {
    key: "motorEfficiencyClass", label: "Verim Sınıfı", type: "select",
    options: MOTOR_EFFICIENCY_CLASSES as unknown as string[],
    hint: "IEC verim sınıfı (IE1…IE4). İki sınıflı beyanlar için IE2/IE3 ve IE3/IE4 de seçilebilir.",
  },
  {
    key: "motorEncoder", label: "Enkoder", type: "select",
    options: MOTOR_ENCODER_OPTIONS as unknown as string[],
    hint: "Motorda enkoder var mı.",
  },
  {
    key: "motorInsulationClass", label: "Yalıtım Sınıfı", type: "select",
    options: MOTOR_INSULATION_CLASSES as unknown as string[],
    optionLabels: MOTOR_INSULATION_CLASS_LABELS,
    standardRef: "IEC 60034-1 Yalıtım Sınıfı",
    hint: "Sargı yalıtımının sürekli dayandığı en yüksek sıcaklık. ORION standardı F (155 °C).",
  },
  {
    key: "motorDutyType", label: "Çalışma Sınıfı", type: "select",
    options: MOTOR_DUTY_TYPES as unknown as string[],
    optionLabels: MOTOR_DUTY_TYPE_LABELS,
    standardRef: "IEC 60034-1 Çalışma Sınıfı",
    hint: "Yük/dinlenme rejimi (S1…S10) — motorun termal boyutlandırmasını belirler. Standart S1.",
  },
  {
    key: "motorThermalProtection", label: "Sargı Koruma (PTC/PT100)", type: "select",
    options: MOTOR_THERMAL_PROTECTIONS as unknown as string[],
    optionLabels: MOTOR_THERMAL_PROTECTION_LABELS,
    hint: "PTC eşik anahtarıdır, PT100 sıcaklığı ölçer. Siparişte ayrıca istenir; standart Yok.",
  },
  { key: "gearboxModel", label: "Seçilen Dişli Kutusu", type: "text" },
  {
    key: "gearboxOutputFeature", label: "Redüktör Özelliği (Çıkış)", type: "select",
    options: GEARBOX_OUTPUT_FEATURES as unknown as string[],
    optionLabels: GEARBOX_OUTPUT_FEATURE_LABELS,
    hint: "Sipariş kodunun son parçası (ör. DT472.03). Delik milli, flanşlı vb.",
  },
  {
    key: "gearboxMountingPosition", label: "Redüktör Montaj Pozisyonu", type: "select",
    options: GEARBOX_MOUNTING_POSITIONS as unknown as string[],
    standardRef: "Redüktör Montaj Pozisyonları",
    hint: "Redüktörün montaj konumu (YILMAZ D serisi M1…M6). Sipariş için raporda görünür.",
  },
  {
    key: "gearboxOptions", label: "Redüktör Opsiyonları", type: "multiselect",
    options: GEARBOX_OPTIONS as unknown as string[],
    hint: GEARBOX_OPTIONS_HINT,
  },
  {
    key: "gearboxRatio", label: "Tahvil Oranı", type: "number",
    hint:
      "Kutu KIRMIZI: oran gereken orana eşitlenmiş, redüktör henüz seçilmedi. " +
      "Bölüm bu hâlde uygun değildir. Motoru seçtikten sonra katalogdan " +
      "redüktörü seçin ya da anahtarı kapatıp gerçek oranı elle girin.",
    info:
      "Tahvil oranı kutusu ilk açılışta ve her teker çapı değişiminde GEREKEN " +
      "ORANA (i = n_motor / n_teker) eşitlenir.\n\n" +
      "Gerekçe: gerçekleşen hız V = (n_motor / i) · π · D bağıntısıyla " +
      "orandan çıkar ve gerekli güç doğrudan V ile büyür. Oran gereken " +
      "orandan uzaksa hız da anma hızından uzaklaşır ve güç hesabı YANLIŞ " +
      "MOTOR seçtirir. Eşitleme, motor seçilirken hızın anma hızına " +
      "oturmasını garanti eder.\n\n" +
      "Katalogdan bir redüktör seçilince anahtar kendiliğinden kapanır ve " +
      "sapma bir alt satırda ölçülür.",
  },
  { key: "gearboxOutputTorqueKnm", label: "Redüktör Çıkış Torku", unit: "kNm", type: "number" },
  { key: "gearboxInputShaftText", label: "Giriş Mil Çapı (Eski Kayıt)", unit: "mm", type: "text", diameter: true },
  { key: "gearboxInputShaftMm", label: "Giriş Mil Çapı", unit: "mm", type: "number", diameter: true },
  { key: "gearboxOutputShaftMm", label: "Çıkış Mil Çapı", unit: "mm", type: "number", diameter: true },
  { key: "brakeBrand", label: "Seçilen Fren", type: "text" },                            // sadece köprü
  { key: "brakeTorqueNm", label: "Fren Torku", unit: "Nm", type: "number" },              // sadece köprü
  {
    key: "brakeOptions", label: "Fren Opsiyonları", type: "multiselect",                  // sadece köprü
    options: BRAKE_OPTIONS as unknown as string[],
    hint: BRAKE_OPTIONS_HINT,
  },
  { key: "brakeWheelDiaMm", label: "Fren Kasnak / Disk Çapı", unit: "mm", type: "number", diameter: true }, // sadece köprü
  { key: "motorCouplingBrand", label: "Motor Kaplini Markası", type: "text" },
  { key: "motorCouplingModel", label: "Seçilen Motor Kaplini", type: "text" },
  { key: "motorCouplingTorqueNm", label: "Motor Kaplini Tork Kapasitesi", unit: "Nm", type: "number" },
  { key: "motorCouplingDmaxMm", label: "Motor Kaplini Azami Mil Çapı", unit: "mm", type: "number", diameter: true },
  {
    key: "motorCouplingSealType", label: "Keçe Tipi", type: "select",
    options: COUPLING_SEAL_TYPES as unknown as string[],
    hint: "Standart O-Ring ekipman listesine yazılmaz; Keçeli ayrıca belirtilir.",
  },
  { key: "wheelShaftDiaMm", label: "Teker Mili Çapı (Kaplin)", unit: "mm", type: "number", diameter: true },
  { key: "wheelCouplingBrand", label: "Teker Kaplini Markası", type: "text" },
  { key: "wheelCouplingModel", label: "Seçilen Teker Kaplini", type: "text" },
  { key: "wheelCouplingTorqueNm", label: "Teker Kaplini Tork Kapasitesi", unit: "Nm", type: "number" },
  { key: "wheelCouplingDmaxMm", label: "Teker Kaplini Azami Mil Çapı", unit: "mm", type: "number", diameter: true },
  {
    key: "wheelCouplingSealType", label: "Keçe Tipi", type: "select",
    options: COUPLING_SEAL_TYPES as unknown as string[],
    hint: "Standart O-Ring ekipman listesine yazılmaz; Keçeli ayrıca belirtilir.",
  },
  { key: "bufferModel", label: "Seçilen Tampon", type: "text" },
  {
    // Kauçuk tampon gövde malzemesi kalitesi (Conductix). Yalnız KAUÇUK
    // seçildiğinde görünür (`bufferCatalogType` = "kauçuk"); hücresel/hidrolikte
    // gizli. Hesaba girmez — sipariş ve rapor için taşınır. Varsayılan N.
    key: "bufferRubberQuality", label: "Kauçuk Cinsi", type: "select",
    options: BUFFER_RUBBER_QUALITIES,
    optionLabels: BUFFER_RUBBER_QUALITY_LABELS,
    standardRef: "Conductix Kauçuk Kaliteleri",
    hint: "Kauçuk tamponun gövde malzemesi. Standart: N (doğal kauçuk).",
    visibleWhen: (sel) =>
      String((sel as { bufferCatalogType?: unknown }).bufferCatalogType ?? "")
        .toLocaleLowerCase("tr-TR") === "kauçuk",
  },
  {
    key: "bufferCatalogType", label: "Seçilen Tampon Alt Türü", type: "text",
    hint: "Katalog satırından gelir; Kauçuk ailesinde kauçuk veya hücresel poliüretan olabilir.",
  },
  {
    key: "bufferStrokeMm", label: "Tampon Kullanılabilir Sıkışma Yolu", unit: "mm", type: "number",
    hint:
      "Hidrolik tamponda tam strok; kauçuk ve hücresel tamponlarda katalogdaki " +
      "izinli en büyük sıkışmaya karşılık gelen yoldur. Gövde yüksekliği değildir.",
  },
  { key: "bufferEnergyKj", label: "Tampon Enerji Kapasitesi", unit: "kJ", type: "number" },
  {
    key: "bufferLoadKn", label: "Tampon Azami Son Kuvveti", unit: "kN", type: "number",
    hint: "Katalogun bastığı azami son kuvvet (SIBRE SP: \"max. End Force\").",
  },
  // --- Feston (5.9) — hepsi katalogdan gelir; katalog dışı ürün için elle de
  // girilebilir (uygulamanın her yerinde olduğu gibi).
  { key: "festoonBrand", label: "Feston Markası", type: "text" },
  { key: "festoonSeries", label: "Feston Serisi", type: "text" },
  { key: "festoonLine", label: "Ürün Hattı", type: "text" },
  { key: "festoonCableForm", label: "Kablo Formu", type: "text" },
  { key: "festoonTrolleyLoadKg", label: "Katalog Taşıyıcı Yükü", unit: "kg", type: "number" },
  {
    key: "festoonMaxSpeedMpm", label: "Katalog Hız Sınırı", unit: "m/dak", type: "number",
    hint: "Katalogda yayımlanmamışsa boş kalır; hız üreticiyle teyit edilir.",
  },
  { key: "festoonTrolleyCode", label: "Kablo Arabası Kodu", type: "text" },
  { key: "festoonTowTrolleyCode", label: "Öncü Araba Kodu", type: "text" },
  { key: "festoonEndClampCode", label: "Başlangıç Askısı / Sonlandırıcı", type: "text" },
];
