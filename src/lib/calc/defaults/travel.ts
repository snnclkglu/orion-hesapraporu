// İSDEMİR V5 raporunun yürütme grubu değerleri — yeni revizyon şablonu ve
// golden test fikstürü. Kaynak: reference/excel-dump/06_05_ARABA_YÜRÜTME_GRUBU.txt
// ve 07_06_KÖPRÜ_YÜRÜTME_GRUBU.txt (statik hücreler).

import type {
  TravelDeps,
  TravelInputs,
  TravelSelections,
} from "../modules/travelGroup";

/** Sayfalar arası bağımlılıklar (V5 değerleri) */
export const V5_TRAVEL_DEPS: TravelDeps = {
  hookEquipmentT: 3.5,  // 05!L6 = (02!L14 + 02!L15)/1000 = (3250+250)/1000
  trolleyWeightT: 2.5,  // 06!L5 = 05!L5
};

export const V5_TROLLEY_INPUTS: TravelInputs = {
  trolleyWeightT: 2.5,          // 05!L5 — araba ağırlığı [t]
  bridgeWeightT: 0,             // (sadece köprü — arabada kullanılmaz)
  otherWeightsT: 0,             // (sadece köprü)
  minApproachM: 0,              // (sadece köprü)
  wheelCount: 4,                // 05!L10
  shaftSpanACm: 7.25,           // 05!L38
  shaftSpanBCm: 9,              // 05!L39 (gösterim)
  shaftDiaCm: 11,               // 05!L52
  stressConcFactor: 1,          // 05!L57
  bearingCount: 2,              // 05!L81
  bearingFactorY0: 2.8,         // 05!L94
  bearingFactorY1: 2.8,         // 05!L95
  applicationClass: "",         // (sadece köprü — 06!L116)
  serviceFactorKs: 1,           // 05!L111
  accelTorqueFactorKt: 1.5,     // 05!L112
  reducerStages: 3,             // 05!L113
  accelerationMs2: 0.2,         // 05!L116
  tempFactor: 1,                // 05!L121 (60 °C için)
  motorCalcCount: 1,            // 05!L123
  gearboxServiceFactor: 2.1,    // 05!L151
  brakeServiceFactor: 0,        // (sadece köprü — arabada fren bölümü yok)
  motorCouplingServiceFactor: 1.8, // 05!L163
  wheelCouplingServiceFactor: 2,   // 05!L175
  bufferApproachM: 0,           // (sadece köprü)
};

export const V5_TROLLEY_SELECTIONS: TravelSelections = {
  railCode: "50x50",            // 05!L14
  wheelMaterial: "AISI 4140+QT", // 05!L16
  wheelTensileNmm2: 800,        // 05!L17
  wheelDiaMm: 250,              // 05!L18
  shaftMaterial: "42CrMo4",     // 05!L71
  bearingType: "Çift Sıra Makaralı Rulman", // 05!L85
  bearingCode: "22210",         // 05!L86
  bearingDynCKn: 159,           // 05!L92
  bearingStatC0Kn: 166,         // 05!L93
  motorBrand: "INNOMATICS/SEW/ABB", // 05!L126
  motorPowerKw: 3,              // 05!L127
  motorRpm: 1480,               // 05!L128
  motorCount: 1,                // 05!L129
  motorShaftMm: 38,             // 05!L130
  gearboxModel: "YILMAZ R DT283", // 05!L154
  gearboxRatio: 29,             // 05!L155
  gearboxOutputTorqueKnm: 0.59, // 05!L156
  gearboxInputShaftText: "-",   // 05!L158
  gearboxOutputShaftMm: 60,     // 05!L159
  brakeBrand: "",               // (arabada fren bölümü yok)
  brakeTorqueNm: 0,
  brakeWheelDiaMm: 0,
  couplingMotorShaftMm: 22,     // 05!L166
  motorCouplingBrand: "SİBRE PİN KAPLİN", // 05!L167
  motorCouplingModel: "APC160A", // 05!L168
  motorCouplingTorqueNm: 270,   // 05!L169
  motorCouplingDmaxMm: 48,      // 05!L170
  wheelShaftDiaMm: 60,          // 05!L178
  wheelCouplingBrand: "SİBRE FLEXİBLE KAPLİN", // 05!L179
  wheelCouplingModel: "ALC A 90", // 05!L180
  wheelCouplingTorqueNm: 3600,  // 05!L181
  wheelCouplingDmaxMm: 80,      // 05!L182
  bufferModel: "GLHB 63 100 - TYPE RM", // 05!L213
  bufferStrokeMm: 100,          // 05!L214
  bufferEnergyKj: 15,           // 05!L215
  bufferLoadKn: 170,            // 05!L216
};

export const V5_BRIDGE_INPUTS: TravelInputs = {
  trolleyWeightT: 0,            // köprüde deps.trolleyWeightT kullanılır (06!L5 = 05!L5)
  bridgeWeightT: 15,            // 06!L6 — köprü ağırlığı [t]
  otherWeightsT: 2,             // 06!L7 — diğer ağırlıklar [t]
  minApproachM: 1,              // 06!L9 — minimum araba yanaşması [m]
  wheelCount: 4,                // 06!L14
  shaftSpanACm: 7.5,            // 06!L42
  shaftSpanBCm: 14,             // 06!L43 (gösterim)
  shaftDiaCm: 14,               // 06!L56
  stressConcFactor: 1,          // 06!L61
  bearingCount: 2,              // 06!L85
  bearingFactorY0: 2.5,         // 06!L98
  bearingFactorY1: 2.6,         // 06!L99
  applicationClass: "o",        // 06!L116 (H=hafif, O=orta, Y=yüksek)
  serviceFactorKs: 1,           // 06!L118
  accelTorqueFactorKt: 1.5,     // 06!L119
  reducerStages: 3,             // 06!L120
  accelerationMs2: 0.2,         // 06!L123
  tempFactor: 1,                // 06!L128 (60 °C için)
  motorCalcCount: 2,            // 06!L130
  gearboxServiceFactor: 2.1,    // 06!L155
  brakeServiceFactor: 1.6,      // 06!L168
  motorCouplingServiceFactor: 1.8, // 06!L177
  wheelCouplingServiceFactor: 1.8, // 06!L189
  bufferApproachM: 2,           // 06!L203 — tampon hesabı araba yanaşması [m]
};

export const V5_BRIDGE_SELECTIONS: TravelSelections = {
  railCode: "50x50",            // 06!L18
  wheelMaterial: "AISI 4140+QT", // 06!L20
  wheelTensileNmm2: 800,        // 06!L21
  wheelDiaMm: 315,              // 06!L22
  shaftMaterial: "42CrMo4",     // 06!L75
  bearingType: "Çift Sıra Makaralı Rulman", // 06!L89
  bearingCode: "22216",         // 06!L90
  bearingDynCKn: 243,           // 06!L96
  bearingStatC0Kn: 270,         // 06!L97
  motorBrand: "INNOMATICS/SEW/ABB", // 06!L133
  motorPowerKw: 3,              // 06!L134
  motorRpm: 1480,               // 06!L135
  motorCount: 2,                // 06!L136
  motorShaftMm: 28,             // 06!L137
  gearboxModel: "YILMAZ R. MT373", // 06!L158
  gearboxRatio: 24,             // 06!L159
  gearboxOutputTorqueKnm: 0.82, // 06!L160
  gearboxInputShaftText: "-",   // 06!L162
  gearboxOutputShaftMm: 60,     // 06!L163
  // Excel V5'te köprü freni SEÇİLMEMİŞTİR (06!L171:L173 = 0) — kontrol "û" çıkar.
  brakeBrand: "",               // 06!L171
  brakeTorqueNm: 0,             // 06!L172
  brakeWheelDiaMm: 0,           // 06!L173
  couplingMotorShaftMm: 28,     // köprüde kullanılmaz (06!L180 = L137 = motorShaftMm)
  motorCouplingBrand: "SİBRE PİN KAPLİN", // 06!L181
  motorCouplingModel: "APC160A", // 06!L182
  motorCouplingTorqueNm: 270,   // 06!L183
  motorCouplingDmaxMm: 48,      // 06!L184
  wheelShaftDiaMm: 70,          // 06!L192
  wheelCouplingBrand: "SİBRE FLEXİBLE KAPLİN", // 06!L193
  wheelCouplingModel: "ALC A 90", // 06!L194
  wheelCouplingTorqueNm: 3600,  // 06!L195
  wheelCouplingDmaxMm: 80,      // 06!L196
  bufferModel: "GLHB 63 100 - TYPE RM", // 06!L229
  bufferStrokeMm: 100,          // 06!L230
  bufferEnergyKj: 15,           // 06!L231
  bufferLoadKn: 170,            // 06!L232
};
