// Yürütme grubu form alanı metadata'sı — UI formları bu tanımlardan üretilir.
// key'ler TravelInputs / TravelSelections alan adlarıyla birebir aynıdır.
// Araba ve köprü aynı alan listesini kullanır; yalnız tek varyantta anlamlı
// olan alanlar yorumda belirtilmiştir ve bölüm tanımları (travelSections)
// hangi alanın nerede sorulacağını belirler.

import type { FieldDef } from "../fields";
import type { TravelInputs, TravelSelections } from "../modules/travelGroup";

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
  { key: "trolleyWeightT", label: "Araba ağırlığı", unit: "t", type: "number" },
  { key: "bridgeWeightT", label: "Köprü ağırlığı", unit: "t", type: "number" },        // sadece köprü
  { key: "otherWeightsT", label: "Diğer ağırlıklar", unit: "t", type: "number" },      // sadece köprü
  { key: "minApproachM", label: "Minimum araba yanaşması", unit: "m", type: "number" }, // sadece köprü
  { key: "wheelCount", label: "Tekerlek adedi", type: "number" },
  { key: "shaftSpanACm", label: "Mil mesnet ölçüsü a", unit: "cm", type: "number", hint: "Mesnet ile tekerlek yükü arasındaki mesafe; mesnet aralığı 2·a alınır." },
  { key: "shaftSpanBCm", label: "Mil mesnet ölçüsü b", unit: "cm", type: "number" },
  { key: "shaftDiaCm", label: "Teker mili çapı", unit: "cm", type: "number" },
  { key: "stressConcFactor", label: "Gerilme yığılması katsayısı", type: "number" },
  { key: "bearingCount", label: "Rulman adedi", type: "number" },
  { key: "bearingFactorY0", label: "Rulman eşdeğer yük katsayısı Y0 (statik)", type: "number" },
  { key: "bearingFactorY1", label: "Rulman eşdeğer yük katsayısı Y1 (dinamik)", type: "number" },
  { key: "applicationClass", label: "Uygulama sınıfı (H/O/Y)", type: "text" },          // sadece köprü
  { key: "serviceFactorKs", label: "Servis faktörü Ks", type: "number", standardRef: "CMAA 70 5.2.9.1.2.1" },
  { key: "accelTorqueFactorKt", label: "İvmelenme tork faktörü Kt", type: "number", standardRef: "CMAA 70 5.2.9.1.2.1" },
  { key: "reducerStages", label: "Redüktör kademe sayısı", type: "number" },
  { key: "accelerationMs2", label: "İvme a", unit: "m/s²", type: "number" },
  { key: "tempFactor", label: "Sıcaklık faktörü", type: "number" },
  { key: "motorCalcCount", label: "Motor adedi (güç bölüşümü)", type: "number" },
  { key: "gearboxServiceFactor", label: "Redüktör emniyet katsayısı", type: "number" },
  { key: "brakeServiceFactor", label: "Fren emniyet katsayısı", type: "number" },        // sadece köprü
  { key: "motorCouplingServiceFactor", label: "Motor kaplini emniyet katsayısı", type: "number" },
  { key: "wheelCouplingServiceFactor", label: "Teker kaplini emniyet katsayısı", type: "number" },
  { key: "bufferApproachM", label: "Tampon hesabı araba yanaşması", unit: "m", type: "number" }, // sadece köprü
];

export const TRAVEL_SELECTION_FIELDS: FieldDef<TravelSelections>[] = [
  { key: "railCode", label: "Ray", type: "select", options: RAIL_TYPES },
  { key: "wheelMaterial", label: "Tekerlek malzemesi", type: "select", options: WHEEL_MATERIALS },
  { key: "wheelTensileNmm2", label: "Tekerlek malzemesi çekme dayanımı", unit: "N/mm²", type: "number" },
  { key: "wheelDiaMm", label: "Tekerlek çapı", unit: "mm", type: "select", options: WHEEL_DIA_SERIES_MM, numeric: true },
  { key: "shaftMaterial", label: "Mil malzemesi", type: "text" },
  { key: "bearingType", label: "Rulman tipi", type: "text" },
  { key: "bearingCode", label: "Rulman kodu", type: "text" },
  { key: "bearingDynCKn", label: "Dinamik yük katsayısı C", unit: "kN", type: "number" },
  { key: "bearingStatC0Kn", label: "Statik yük katsayısı C0", unit: "kN", type: "number" },
  { key: "motorBrand", label: "Motor markası", type: "text" },
  { key: "motorPowerKw", label: "Seçilen motor gücü", unit: "kW", type: "number" },
  { key: "motorRpm", label: "Seçilen motor devri", unit: "d/dak", type: "number" },
  { key: "motorCount", label: "Motor sayısı", type: "number" },
  { key: "motorShaftMm", label: "Motor mil çapı", unit: "mm", type: "number" },
  { key: "gearboxModel", label: "Seçilen dişli kutusu", type: "text" },
  { key: "gearboxRatio", label: "Tahvil oranı", type: "number" },
  { key: "gearboxOutputTorqueKnm", label: "Redüktör çıkış torku", unit: "kNm", type: "number" },
  { key: "gearboxInputShaftText", label: "Giriş mil çapı", unit: "mm", type: "text" },
  { key: "gearboxOutputShaftMm", label: "Çıkış mil çapı", unit: "mm", type: "number" },
  { key: "brakeBrand", label: "Seçilen fren", type: "text" },                            // sadece köprü
  { key: "brakeTorqueNm", label: "Fren torku", unit: "Nm", type: "number" },              // sadece köprü
  { key: "brakeWheelDiaMm", label: "Fren kasnak/disk çapı", unit: "mm", type: "number" }, // sadece köprü
  { key: "couplingMotorShaftMm", label: "Kapline bağlanan motor mili", unit: "mm", type: "number", hint: "Köprüde motorun kendi mil çapı kullanılır." },
  { key: "motorCouplingBrand", label: "Motor kaplini markası", type: "text" },
  { key: "motorCouplingModel", label: "Seçilen motor kaplini", type: "text" },
  { key: "motorCouplingTorqueNm", label: "Motor kaplini tork kapasitesi", unit: "Nm", type: "number" },
  { key: "motorCouplingDmaxMm", label: "Motor kaplini azami mil çapı", unit: "mm", type: "number" },
  { key: "wheelShaftDiaMm", label: "Teker mili çapı (kaplin)", unit: "mm", type: "number" },
  { key: "wheelCouplingBrand", label: "Teker kaplini markası", type: "text" },
  { key: "wheelCouplingModel", label: "Seçilen teker kaplini", type: "text" },
  { key: "wheelCouplingTorqueNm", label: "Teker kaplini tork kapasitesi", unit: "Nm", type: "number" },
  { key: "wheelCouplingDmaxMm", label: "Teker kaplini azami mil çapı", unit: "mm", type: "number" },
  { key: "bufferModel", label: "Seçilen tampon", type: "text" },
  { key: "bufferStrokeMm", label: "Tampon stroğu", unit: "mm", type: "number" },
  { key: "bufferEnergyKj", label: "Tampon enerji kapasitesi", unit: "kJ", type: "number" },
  { key: "bufferLoadKn", label: "Tampon yük kapasitesi", unit: "kN", type: "number" },
];
