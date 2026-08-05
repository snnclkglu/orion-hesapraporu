// Yürütme grubu form alanı metadata'sı — UI formları bu tanımlardan üretilir.
// key'ler TravelInputs / TravelSelections alan adlarıyla birebir aynıdır.
// Araba ve köprü aynı alan listesini kullanır; yalnız tek varyantta anlamlı
// olan alanlar yorumda belirtilmiştir ve bölüm tanımları (travelSections)
// hangi alanın nerede sorulacağını belirler.

import {
  MOTOR_RPM_LABELS,
  MOTOR_RPM_SERIES,
  TRAVEL_MOTOR_POWERS,
  type FieldDef,
} from "../fields";
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
  { key: "shaftSpanACm", label: "Mil Mesnet Ölçüsü A", unit: "cm", type: "number", hint: "Mesnet ile tekerlek yükü arasındaki mesafe; mesnet aralığı 2·a alınır." },
  { key: "shaftSpanBCm", label: "Mil Mesnet Ölçüsü B", unit: "cm", type: "number" },
  { key: "shaftDiaCm", label: "Teker Mili Çapı", unit: "cm", type: "number" },
  { key: "stressConcFactor", label: "Gerilme Yığılması Katsayısı", type: "number" },
  { key: "bearingCount", label: "Rulman Adedi", type: "number" },
  { key: "bearingFactorY0", label: "Rulman Eşdeğer Yük Katsayısı Y0 (Statik)", type: "number" },
  { key: "bearingFactorY1", label: "Rulman Eşdeğer Yük Katsayısı Y1 (Dinamik)", type: "number" },
  { key: "applicationClass", label: "Uygulama Sınıfı (H/O/Y)", type: "text" },          // sadece köprü
  { key: "serviceFactorKs", label: "Servis Faktörü Ks", type: "number", standardRef: "CMAA 70 5.2.9.1.2.1" },
  { key: "accelTorqueFactorKt", label: "İvmelenme Tork Faktörü Kt", type: "number", standardRef: "CMAA 70 5.2.9.1.2.1" },
  { key: "reducerStages", label: "Redüktör Kademe Sayısı", type: "number" },
  { key: "accelerationMs2", label: "İvme a", unit: "m/s²", type: "number" },
  { key: "tempFactor", label: "Sıcaklık Faktörü", type: "number" },
  { key: "motorCalcCount", label: "Motor Adedi (Güç Bölüşümü)", type: "number" },
  { key: "gearboxServiceFactor", label: "Redüktör Emniyet Katsayısı", type: "number" },
  { key: "brakeServiceFactor", label: "Fren Emniyet Katsayısı", type: "number" },        // sadece köprü
  { key: "motorCouplingServiceFactor", label: "Motor Kaplini Emniyet Katsayısı", type: "number" },
  { key: "wheelCouplingServiceFactor", label: "Teker Kaplini Emniyet Katsayısı", type: "number" },
  { key: "bufferApproachM", label: "Tampon Hesabı Araba Yanaşması", unit: "m", type: "number" }, // sadece köprü
];

export const TRAVEL_SELECTION_FIELDS: FieldDef<TravelSelections>[] = [
  { key: "railCode", label: "Ray", type: "select", options: RAIL_TYPES },
  { key: "wheelMaterial", label: "Tekerlek Malzemesi", type: "select", options: WHEEL_MATERIALS },
  { key: "wheelTensileNmm2", label: "Tekerlek Malzemesi Çekme Dayanımı", unit: "N/mm²", type: "number" },
  { key: "wheelDiaMm", label: "Tekerlek Çapı", unit: "mm", type: "select", options: WHEEL_DIA_SERIES_MM, numeric: true },
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
    key: "motorRpm", label: "Seçilen Motor Devri", unit: "d/dak", type: "select",
    options: MOTOR_RPM_SERIES, optionLabels: MOTOR_RPM_LABELS, numeric: true,
  },
  { key: "motorCount", label: "Motor Sayısı", type: "number" },
  { key: "motorShaftMm", label: "Motor Mil Çapı", unit: "mm", type: "number" },
  { key: "gearboxModel", label: "Seçilen Dişli Kutusu", type: "text" },
  { key: "gearboxRatio", label: "Tahvil Oranı", type: "number" },
  { key: "gearboxOutputTorqueKnm", label: "Redüktör Çıkış Torku", unit: "kNm", type: "number" },
  { key: "gearboxInputShaftText", label: "Giriş Mil Çapı", unit: "mm", type: "text" },
  { key: "gearboxOutputShaftMm", label: "Çıkış Mil Çapı", unit: "mm", type: "number" },
  { key: "brakeBrand", label: "Seçilen Fren", type: "text" },                            // sadece köprü
  { key: "brakeTorqueNm", label: "Fren Torku", unit: "Nm", type: "number" },              // sadece köprü
  { key: "brakeWheelDiaMm", label: "Fren Kasnak / Disk Çapı", unit: "mm", type: "number" }, // sadece köprü
  { key: "couplingMotorShaftMm", label: "Kapline Bağlanan Motor Mili", unit: "mm", type: "number", hint: "Köprüde motorun kendi mil çapı kullanılır." },
  { key: "motorCouplingBrand", label: "Motor Kaplini Markası", type: "text" },
  { key: "motorCouplingModel", label: "Seçilen Motor Kaplini", type: "text" },
  { key: "motorCouplingTorqueNm", label: "Motor Kaplini Tork Kapasitesi", unit: "Nm", type: "number" },
  { key: "motorCouplingDmaxMm", label: "Motor Kaplini Azami Mil Çapı", unit: "mm", type: "number" },
  { key: "wheelShaftDiaMm", label: "Teker Mili Çapı (Kaplin)", unit: "mm", type: "number" },
  { key: "wheelCouplingBrand", label: "Teker Kaplini Markası", type: "text" },
  { key: "wheelCouplingModel", label: "Seçilen Teker Kaplini", type: "text" },
  { key: "wheelCouplingTorqueNm", label: "Teker Kaplini Tork Kapasitesi", unit: "Nm", type: "number" },
  { key: "wheelCouplingDmaxMm", label: "Teker Kaplini Azami Mil Çapı", unit: "mm", type: "number" },
  { key: "bufferModel", label: "Seçilen Tampon", type: "text" },
  { key: "bufferStrokeMm", label: "Tampon Stroğu", unit: "mm", type: "number" },
  { key: "bufferEnergyKj", label: "Tampon Enerji Kapasitesi", unit: "kJ", type: "number" },
  { key: "bufferLoadKn", label: "Tampon Yük Kapasitesi", unit: "kN", type: "number" },
];
