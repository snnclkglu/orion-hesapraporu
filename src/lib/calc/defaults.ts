// İSDEMİR V5 raporunun değerleri — yeni revizyonlar için başlangıç şablonu
// ve golden testlerin fikstürü. Kaynak: reference/excel-dump (statik hücreler).

import type { CalcInput } from "./engine";
import type { HoistInputs, HoistSelections } from "./modules/hoistGroup";
import type { TechnicalSpecs } from "./types";

export const V5_SPECS: TechnicalSpecs = {
  mainCapacityT: 4,              // P4
  mainLiftHeightM: 10,           // P5
  mainLiftSpeedMpm: 35,          // P6
  auxCapacityT: 5,               // P7
  auxLiftHeightM: 22,            // P8
  auxLiftSpeedMpm: 8,            // P9
  structureClass: "A6",          // P10
  hoistLoadClass: "H3/B4",       // P11
  hoistMechanismClass: "M6",     // P12
  hoistUsageClass: "T6",         // P13
  bridgeSpeedMpm: 60,            // P14
  bridgeMechanismClass: "M6",    // P15
  bridgeUsageClass: "T6",        // P16
  trolleySpeedMpm: 40,           // P17
  trolleyMechanismClass: "M6",   // P18
  trolleyUsageClass: "T6",       // P19
  hookType: "Kepçe",             // P20
  controlType: "Sabit Kabin + Uzaktan Kumanda", // P21
  ambientTempMinC: -10,          // R22
  ambientTempMaxC: 40,           // T22
  supplyVoltage: "380 VAC, 3 Faz, 50 Hz", // P23
  controlVoltage: "24 VDC",      // P24
  spanM: 17.5,                   // P27
};

export const V5_MAIN_HOIST_INPUTS: HoistInputs = {
  drivenFalls: 2,               // L5
  totalFalls: 2,                // O5
  sheaveEfficiency: 0.985,      // L7
  fixedSheaveCount: 0,          // L8
  hookBlockWeightKg: 3250,      // L14 (kepçe)
  ropeWeightKg: 250,            // L15
  drumWallThicknessMm: 16,      // L42
  safetyGrooveCount: 3,         // L58
  drumWeightKg: 800,            // L69
  shaftSpanACm: 60,             // L70
  shaftSpanBCm: 5,              // L71
  shaftSpanCCm: 60,             // L72
  shaftMomentArmCm: 6,          // L73
  shaftArm2Cm: 6,               // L74
  shaftDiaCm: 6,                // L76
  shaftShearDiaCm: 5,           // L77
  drumWeldThicknessCm: 1.5,     // L99
  drumWeldAllowable: 1600,      // L101
  shaftWeldThicknessCm: 1,      // L115
  shaftWeldAllowable: 1600,     // L117
  bearingFactorY1: 2.8,         // L142
  bearingFactorY2: 2.8,         // L143
  drumCount: 1,                 // L163
  gearboxServiceFactor: 1.5,    // L166
  reducerStages: 3,             // L195
  stageEfficiency: 0.99,        // L196
  tempFactor: 1,                // L203 (40 °C)
  motorDivisor: 1,              // L205
  brakeServiceFactor: 1.7,      // L219
  motorCouplingServiceFactor: 2, // L234
  drumCouplingDivisor: 1,       // L248
  drumCouplingServiceFactor: 1.7, // L250
};

export const V5_MAIN_HOIST_SELECTIONS: HoistSelections = {
  ropeBrand: "Hasçelik",        // L23
  ropeDiaMm: 18,                // L24
  ropeConstruction: "6x36",     // L25
  ropeCore: "Çelik Öz",         // L26
  ropeWireStrength: 200,        // L27
  ropeBreakingLoadKn: 226,      // Q28
  drumDiaMm: 400,               // L39
  drumMaterial: "S355",         // L40
  drumGrooveLengthText: "2 x 220", // L63
  shaftMaterial: "C30",         // L90
  bearingType: "Çift Sıra Makaralı Rulman", // L133
  bearingCode: "22212",         // L134
  bearingDynCKn: 159,           // L140
  bearingStatC0Kn: 166,         // L141
  gearboxModel: "YILMAZ HT0823", // L174
  gearboxRatio: 52.57,          // L175
  gearboxNominalTorqueKnm: 22,  // L176
  gearboxInputShaftMm: 55,      // L177
  gearboxOutputShaftMm: 120,    // L178
  gearboxWeightKg: 775,         // L180
  gearboxAllowedRadialKn: 60,   // L188
  motorPowerKw: 55,             // L208
  motorRpm: 1480,               // O208
  motorShaftMm: 70,             // L209
  motorBrand: "GAMAK",          // L210
  motorCount: 1,                // L211
  brakeBrand: "SİBRE",          // L222
  brakeModel: "SIBRE TE250 Ed 50/6", // L223
  brakeTorqueNm: 850,           // L224
  brakeWheelDiaMm: 250,         // L225
  brakeQty: 2,                  // L226 / O228
  motorCouplingBrand: "ÖZGÜN",  // L237
  motorCouplingModel: "B3-3",   // L238
  motorCouplingWheelDiaMm: 200, // L239
  motorCouplingTorqueNm: 5500,  // L240
  motorCouplingDmaxMm: 75,      // L241
  drumCouplingBrand: "ÖZGÜN",   // L256
  drumCouplingModel: "J7",      // L257
  drumCouplingTorqueNm: 37000,  // L258
  drumCouplingRadialN: 88000,   // L259
  drumCouplingDmaxMm: 150,      // L260
};

export const V5_AUX_HOIST_INPUTS: HoistInputs = {
  ...V5_MAIN_HOIST_INPUTS,
  totalFalls: 4,                // O5 (donanım 2/4)
  hookBlockWeightKg: 150,       // L14
  ropeWeightKg: 50,             // L15
  safetyGrooveCount: 2,         // L58
  gearboxServiceFactor: 1.8,    // L166
  tempFactor: 1.1,              // L203 (60 °C)
  brakeServiceFactor: 1.6,      // L219
  drumCouplingServiceFactor: 1.8, // L250
};

export const V5_AUX_HOIST_SELECTIONS: HoistSelections = {
  ...V5_MAIN_HOIST_SELECTIONS,
  ropeDiaMm: 12,                // L24
  ropeBreakingLoadKn: 100.5,    // Q28
  drumDiaMm: 290,               // L39
  drumGrooveLengthText: "2 x 730", // L63
  gearboxModel: "SEW X3FS100",  // L174
  gearboxRatio: 86,             // L175
  gearboxNominalTorqueKnm: 6.8, // L176
  gearboxOutputShaftMm: 90,     // L178
  motorPowerKw: 11,             // L208
  brakeModel: "TE200 Ed 23/5",  // L223
  brakeTorqueNm: 350,           // L224
  brakeWheelDiaMm: 315,         // L225
  drumCouplingModel: "J5",      // L257
  drumCouplingTorqueNm: 36800,  // L258
  drumCouplingRadialN: 18400,   // L259
  drumCouplingDmaxMm: 110,      // L260
};

/** V5 raporunun tam girdi seti — yeni revizyon şablonu */
export const V5_TEMPLATE: CalcInput = {
  specs: V5_SPECS,
  mainHoist: { inputs: V5_MAIN_HOIST_INPUTS, selections: V5_MAIN_HOIST_SELECTIONS },
  auxHoist: { inputs: V5_AUX_HOIST_INPUTS, selections: V5_AUX_HOIST_SELECTIONS },
};
