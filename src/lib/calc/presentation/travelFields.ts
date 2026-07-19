// Yürütme grubu form alanı metadata'sı — UI formları bu tanımlardan üretilir.
// key'ler TravelInputs / TravelSelections alan adlarıyla birebir aynıdır.
// excelCell araba (05) sayfası adresidir; sadece köprüde bulunan alanlar
// köprü (06) adresini taşır (yorumlarda belirtilmiştir).

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
  { key: "trolleyWeightT", label: "Araba ağırlığı", unit: "t", type: "number", excelCell: "L5" },
  { key: "bridgeWeightT", label: "Köprü ağırlığı", unit: "t", type: "number", excelCell: "L6" },   // 06!L6 (sadece köprü)
  { key: "otherWeightsT", label: "Diğer ağırlıklar", unit: "t", type: "number", excelCell: "L7" }, // 06!L7 (sadece köprü)
  { key: "minApproachM", label: "Minimum araba yanaşması", unit: "m", type: "number", excelCell: "L9" }, // 06!L9 (sadece köprü)
  { key: "wheelCount", label: "Tekerlek adedi", type: "number", excelCell: "L10" },                // 06!L14
  { key: "shaftSpanACm", label: "Mil mesnet ölçüsü a", unit: "cm", type: "number", excelCell: "L38" }, // 06!L42
  { key: "shaftSpanBCm", label: "Mil mesnet ölçüsü b", unit: "cm", type: "number", excelCell: "L39" }, // 06!L43
  { key: "shaftDiaCm", label: "Teker mili çapı", unit: "cm", type: "number", excelCell: "L52" },   // 06!L56
  { key: "stressConcFactor", label: "Gerilme yığılması katsayısı", type: "number", excelCell: "L57" }, // 06!L61
  { key: "bearingCount", label: "Rulman adedi", type: "number", excelCell: "L81" },                // 06!L85
  { key: "bearingFactorY0", label: "Rulman eşdeğer yük katsayısı Y0 (statik)", type: "number", excelCell: "L94" }, // 06!L98
  { key: "bearingFactorY1", label: "Rulman eşdeğer yük katsayısı Y1 (dinamik)", type: "number", excelCell: "L95" }, // 06!L99
  { key: "applicationClass", label: "Uygulama sınıfı (H/O/Y)", type: "text", excelCell: "L116" },  // 06!L116 (sadece köprü)
  { key: "serviceFactorKs", label: "Servis faktörü Ks", type: "number", excelCell: "L111" },       // 06!L118
  { key: "accelTorqueFactorKt", label: "İvmelenme tork faktörü Kt", type: "number", excelCell: "L112" }, // 06!L119
  { key: "reducerStages", label: "Redüktör kademe sayısı", type: "number", excelCell: "L113" },    // 06!L120
  { key: "accelerationMs2", label: "İvme a", unit: "m/s²", type: "number", excelCell: "L116" },    // 06!L123
  { key: "tempFactor", label: "Sıcaklık faktörü", type: "number", excelCell: "L121" },             // 06!L128
  { key: "motorCalcCount", label: "Motor adedi (güç bölüşümü)", type: "number", excelCell: "L123" }, // 06!L130
  { key: "gearboxServiceFactor", label: "Redüktör emniyet katsayısı", type: "number", excelCell: "L151" }, // 06!L155
  { key: "brakeServiceFactor", label: "Fren emniyet katsayısı", type: "number", excelCell: "L168" }, // 06!L168 (sadece köprü)
  { key: "motorCouplingServiceFactor", label: "Motor kaplini emniyet katsayısı", type: "number", excelCell: "L163" }, // 06!L177
  { key: "wheelCouplingServiceFactor", label: "Teker kaplini emniyet katsayısı", type: "number", excelCell: "L175" }, // 06!L189
  { key: "bufferApproachM", label: "Tampon hesabı araba yanaşması", unit: "m", type: "number", excelCell: "L203" }, // 06!L203 (sadece köprü)
];

export const TRAVEL_SELECTION_FIELDS: FieldDef<TravelSelections>[] = [
  { key: "railCode", label: "Ray", type: "select", options: RAIL_TYPES, excelCell: "L14" },        // 06!L18
  { key: "wheelMaterial", label: "Tekerlek malzemesi", type: "select", options: WHEEL_MATERIALS, excelCell: "L16" }, // 06!L20
  { key: "wheelTensileNmm2", label: "Tekerlek malzemesi çekme dayanımı", unit: "N/mm²", type: "number", excelCell: "L17" }, // 06!L21
  { key: "wheelDiaMm", label: "Tekerlek çapı", unit: "mm", type: "select", options: WHEEL_DIA_SERIES_MM, numeric: true, excelCell: "L18" }, // 06!L22
  { key: "shaftMaterial", label: "Mil malzemesi", type: "text", excelCell: "L71" },                // 06!L75
  { key: "bearingType", label: "Rulman tipi", type: "text", excelCell: "L85" },                    // 06!L89
  { key: "bearingCode", label: "Rulman kodu", type: "text", excelCell: "L86" },                    // 06!L90
  { key: "bearingDynCKn", label: "Dinamik yük katsayısı C", unit: "kN", type: "number", excelCell: "L92" }, // 06!L96
  { key: "bearingStatC0Kn", label: "Statik yük katsayısı C0", unit: "kN", type: "number", excelCell: "L93" }, // 06!L97
  { key: "motorBrand", label: "Motor markası", type: "text", excelCell: "L126" },                  // 06!L133
  { key: "motorPowerKw", label: "Seçilen motor gücü", unit: "kW", type: "number", excelCell: "L127" }, // 06!L134
  { key: "motorRpm", label: "Seçilen motor devri", unit: "d/dak", type: "number", excelCell: "L128" }, // 06!L135
  { key: "motorCount", label: "Motor sayısı", type: "number", excelCell: "L129" },                 // 06!L136
  { key: "motorShaftMm", label: "Motor mil çapı", unit: "mm", type: "number", excelCell: "L130" }, // 06!L137
  { key: "gearboxModel", label: "Seçilen dişli kutusu", type: "text", excelCell: "L154" },         // 06!L158
  { key: "gearboxRatio", label: "Tahvil oranı", type: "number", excelCell: "L155" },               // 06!L159
  { key: "gearboxOutputTorqueKnm", label: "Redüktör çıkış torku", unit: "kNm", type: "number", excelCell: "L156" }, // 06!L160
  { key: "gearboxInputShaftText", label: "Giriş mil çapı", unit: "mm", type: "text", excelCell: "L158" }, // 06!L162
  { key: "gearboxOutputShaftMm", label: "Çıkış mil çapı", unit: "mm", type: "number", excelCell: "L159" }, // 06!L163
  { key: "brakeBrand", label: "Seçilen fren", type: "text", excelCell: "L171" },                   // 06!L171 (sadece köprü)
  { key: "brakeTorqueNm", label: "Fren torku", unit: "Nm", type: "number", excelCell: "L172" },    // 06!L172 (sadece köprü)
  { key: "brakeWheelDiaMm", label: "Fren kasnak/disk çapı", unit: "mm", type: "number", excelCell: "L173" }, // 06!L173 (sadece köprü)
  { key: "couplingMotorShaftMm", label: "Kapline bağlanan motor mili", unit: "mm", type: "number", excelCell: "L166" }, // köprüde 06!L180 = L137
  { key: "motorCouplingBrand", label: "Motor kaplini markası", type: "text", excelCell: "L167" },  // 06!L181
  { key: "motorCouplingModel", label: "Seçilen motor kaplini", type: "text", excelCell: "L168" },  // 06!L182
  { key: "motorCouplingTorqueNm", label: "Motor kaplini tork kapasitesi", unit: "Nm", type: "number", excelCell: "L169" }, // 06!L183
  { key: "motorCouplingDmaxMm", label: "Motor kaplini azami mil çapı", unit: "mm", type: "number", excelCell: "L170" }, // 06!L184
  { key: "wheelShaftDiaMm", label: "Teker mili çapı (kaplin)", unit: "mm", type: "number", excelCell: "L178" }, // 06!L192
  { key: "wheelCouplingBrand", label: "Teker kaplini markası", type: "text", excelCell: "L179" },  // 06!L193
  { key: "wheelCouplingModel", label: "Seçilen teker kaplini", type: "text", excelCell: "L180" },  // 06!L194
  { key: "wheelCouplingTorqueNm", label: "Teker kaplini tork kapasitesi", unit: "Nm", type: "number", excelCell: "L181" }, // 06!L195
  { key: "wheelCouplingDmaxMm", label: "Teker kaplini azami mil çapı", unit: "mm", type: "number", excelCell: "L182" }, // 06!L196
  { key: "bufferModel", label: "Seçilen tampon", type: "text", excelCell: "L213" },                // 06!L229
  { key: "bufferStrokeMm", label: "Tampon stroğu", unit: "mm", type: "number", excelCell: "L214" }, // 06!L230
  { key: "bufferEnergyKj", label: "Tampon enerji kapasitesi", unit: "kJ", type: "number", excelCell: "L215" }, // 06!L231
  { key: "bufferLoadKn", label: "Tampon yük kapasitesi", unit: "kN", type: "number", excelCell: "L216" }, // 06!L232
];
