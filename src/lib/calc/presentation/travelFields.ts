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
  type FieldDef,
} from "../fields";
import { TRAVEL_NO, TRAVEL_YES } from "../modules/travelGroup";
import type { TravelInputs, TravelSelections } from "../modules/travelGroup";
import { WHEEL_COUNT_OPTIONS } from "../modules/wheelLoads";

/** Teker çapı FEM standart serisi [mm] */
export const WHEEL_DIA_SERIES_MM = [
  "200", "250", "315", "400", "500", "630", "710", "800", "900", "1000", "1120", "1250",
] as const;
export const RAIL_TYPES = [
  "A150", "A120", "A100", "A75", "A65", "A55", "A45",
  "30x30", "40x40", "50x50", "60x60", "70x40", "80x80",
] as const;
export const WHEEL_MATERIALS = ["AISI 4140+QT", "42CrMo4", "C60", "GS-70"] as const;

/** İki durumlu tampon girdilerinin seçenekleri (kayıtta metin olarak durur). */
export const YES_NO = [TRAVEL_NO, TRAVEL_YES] as const;

export const TRAVEL_INPUT_FIELDS: FieldDef<TravelInputs>[] = [
  // Ağırlıklar teknik özelliklerdeki "Ağırlıklar" grubundan gelir; burada sorulmaz.
  { key: "minApproachM", label: "Minimum Araba Yanaşması", unit: "m", type: "number" }, // sadece köprü
  {
    key: "wheelCount", label: "Tekerlek Adedi", type: "select",
    options: WHEEL_COUNT_OPTIONS.map(String), numeric: true,
    hint: "Vinç dört köşesinde eşit tekerle yürür; adet dördün katıdır. 16 teker = köşe başına 4, ray başına 8.",
  },
  {
    key: "wheelsPerMotor", label: "Motor Başına Tahrikli Teker", type: "select",
    options: ["1", "2"], numeric: true,
    hint: "Tek motor bir mil üzerinden iki tekeri birden tahrik edebilir. Tahrikli teker sayısı = motor adedi × bu değer.",
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
  { key: "accelerationMs2", label: "İvme a", unit: "m/s²", type: "number" },
  { key: "tempFactor", label: "Sıcaklık Faktörü", type: "number" },
  { key: "motorCalcCount", label: "Motor Adedi (Güç Bölüşümü)", type: "number" },
  { key: "gearboxServiceFactor", label: "Redüktör Emniyet Katsayısı", type: "number" },
  { key: "brakeServiceFactor", label: "Fren Emniyet Katsayısı", type: "number" },        // sadece köprü
  { key: "motorCouplingServiceFactor", label: "Motor Kaplini Emniyet Katsayısı", type: "number" },
  { key: "wheelCouplingServiceFactor", label: "Teker Kaplini Emniyet Katsayısı", type: "number" },
  { key: "bufferApproachM", label: "Tampon Hesabı Araba Yanaşması", unit: "m", type: "number" }, // sadece köprü
  {
    key: "bufferCount", label: "Tampon Adedi", type: "select",
    options: ["1", "2", "4"], numeric: true,
    hint:
      "Çarpışmada AYNI ANDA temas eden tampon adedi. Araba iki kirişin, köprü " +
      "iki rayın ucundaki durdurucuya çarpar → tipik değer 2. Çarpışan kütle " +
      "bu adede paylaştırılır.",
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
];

export const TRAVEL_SELECTION_FIELDS: FieldDef<TravelSelections>[] = [
  { key: "railCode", label: "Ray", type: "select", options: RAIL_TYPES },
  { key: "wheelMaterial", label: "Tekerlek Malzemesi", type: "select", options: WHEEL_MATERIALS },
  { key: "wheelTensileNmm2", label: "Tekerlek Malzemesi Çekme Dayanımı", unit: "N/mm²", type: "number" },
  { key: "wheelDiaMm", label: "Tekerlek Çapı", unit: "mm", type: "select", options: WHEEL_DIA_SERIES_MM, numeric: true, diameter: true },
  { key: "shaftMaterial", label: "Mil Malzemesi", type: "text" },
  { key: "bearingType", label: "Rulman Tipi", type: "text" },
  { key: "bearingCode", label: "Rulman Kodu", type: "text" },
  { key: "bearingDynCKn", label: "Dinamik Yük Katsayısı C", unit: "kN", type: "number" },
  { key: "bearingStatC0Kn", label: "Statik Yük Katsayısı C0", unit: "kN", type: "number" },
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
  { key: "motorCount", label: "Motor Sayısı", type: "number" },
  { key: "motorShaftMm", label: "Motor Mil Çapı", unit: "mm", type: "number", diameter: true },
  { key: "gearboxModel", label: "Seçilen Dişli Kutusu", type: "text" },
  { key: "gearboxRatio", label: "Tahvil Oranı", type: "number" },
  { key: "gearboxOutputTorqueKnm", label: "Redüktör Çıkış Torku", unit: "kNm", type: "number" },
  { key: "gearboxInputShaftText", label: "Giriş Mil Çapı", unit: "mm", type: "text", diameter: true },
  { key: "gearboxOutputShaftMm", label: "Çıkış Mil Çapı", unit: "mm", type: "number", diameter: true },
  { key: "brakeBrand", label: "Seçilen Fren", type: "text" },                            // sadece köprü
  { key: "brakeTorqueNm", label: "Fren Torku", unit: "Nm", type: "number" },              // sadece köprü
  { key: "brakeWheelDiaMm", label: "Fren Kasnak / Disk Çapı", unit: "mm", type: "number", diameter: true }, // sadece köprü
  { key: "couplingMotorShaftMm", label: "Kapline Bağlanan Motor Mili", unit: "mm", type: "number", diameter: true, hint: "Köprüde motorun kendi mil çapı kullanılır." },
  { key: "motorCouplingBrand", label: "Motor Kaplini Markası", type: "text" },
  { key: "motorCouplingModel", label: "Seçilen Motor Kaplini", type: "text" },
  { key: "motorCouplingTorqueNm", label: "Motor Kaplini Tork Kapasitesi", unit: "Nm", type: "number" },
  { key: "motorCouplingDmaxMm", label: "Motor Kaplini Azami Mil Çapı", unit: "mm", type: "number", diameter: true },
  { key: "wheelShaftDiaMm", label: "Teker Mili Çapı (Kaplin)", unit: "mm", type: "number", diameter: true },
  { key: "wheelCouplingBrand", label: "Teker Kaplini Markası", type: "text" },
  { key: "wheelCouplingModel", label: "Seçilen Teker Kaplini", type: "text" },
  { key: "wheelCouplingTorqueNm", label: "Teker Kaplini Tork Kapasitesi", unit: "Nm", type: "number" },
  { key: "wheelCouplingDmaxMm", label: "Teker Kaplini Azami Mil Çapı", unit: "mm", type: "number", diameter: true },
  { key: "bufferModel", label: "Seçilen Tampon", type: "text" },
  {
    key: "bufferCatalogType", label: "Seçilen Tampon Alt Türü", type: "text",
    hint: "Katalog satırından gelir; Kauçuk ailesinde kauçuk veya hücresel poliüretan olabilir.",
  },
  {
    key: "bufferStrokeMm", label: "Tampon Stroğu / Yüksekliği", unit: "mm", type: "number",
    hint:
      "Hidrolik tamponda TAM STROK s; kauçuk tamponda tamponun GÖVDE " +
      "YÜKSEKLİĞİ h (sıkışma yolu f′ = sıkışma % · h / 100 olarak yük " +
      "diyagramından çıkar).",
  },
  { key: "bufferEnergyKj", label: "Tampon Enerji Kapasitesi", unit: "kJ", type: "number" },
  {
    key: "bufferLoadKn", label: "Tampon Azami Son Kuvveti", unit: "kN", type: "number",
    hint: "Katalogun bastığı azami son kuvvet (SIBRE SP: \"max. End Force\").",
  },
];
