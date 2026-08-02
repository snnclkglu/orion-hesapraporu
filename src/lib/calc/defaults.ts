// İSDEMİR V5 işinin girdi seti — yeni revizyonlar için başlangıç şablonu ve
// tarihsel doğrulama fikstürünün girdi tarafı.

import type { CalcInput } from "./engine";
import { ROPE_POSITION_AUTO, type HoistInputs, type HoistSelections } from "./modules/hoistGroup";
import type { TechnicalSpecs } from "./types";
import { V5_HOOKBLOCK_INPUTS, V5_HOOKBLOCK_SELECTIONS } from "./defaults/hookBlock";
import {
  V5_BRIDGE_INPUTS,
  V5_BRIDGE_SELECTIONS,
  V5_TROLLEY_INPUTS,
  V5_TROLLEY_SELECTIONS,
} from "./defaults/travel";
import {
  V5_BUCKLING_INPUTS,
  V5_ENDCARRIAGE_INPUTS,
  V5_ENDCARRIAGE_SELECTIONS,
  V5_GIRDER_INPUTS,
  V5_GIRDER_SELECTIONS,
} from "./defaults/structural";

export const V5_SPECS: TechnicalSpecs = {
  mainCapacityT: 4,
  mainLiftHeightM: 10,
  mainLiftSpeedMpm: 35,
  auxCapacityT: 5,
  auxLiftHeightM: 22,
  auxLiftSpeedMpm: 8,
  structureClass: "A6",
  hoistLoadClass: "H3/B4",
  hoistMechanismClass: "M6",
  hoistUsageClass: "T6",
  bridgeSpeedMpm: 60,
  bridgeMechanismClass: "M6",
  bridgeUsageClass: "T6",
  trolleySpeedMpm: 40,
  trolleyMechanismClass: "M6",
  trolleyUsageClass: "T6",
  hookType: "Kepçe",
  controlType: "Sabit Kabin + Uzaktan Kumanda",
  hoistBrakeType: "Eldro Fren",
  hoistSafetyBrake: "Yok",
  travelBrakeType: "Eldro Fren",
  ambientTempMinC: -10,
  ambientTempMaxC: 40,
  supplyVoltage: "380 VAC, 3 Faz, 50 Hz",
  controlVoltage: "24 VDC",
  spanM: 17.5,
};

export const V5_MAIN_HOIST_INPUTS: HoistInputs = {
  reevingLabel: "2/2",          // tahrikli/toplam halat kolu — hazır donanım
  drivenFalls: 2,
  totalFalls: 2,
  sheaveEfficiency: 0.985,
  fixedSheaveCount: 0,
  hookBlockWeightKg: 3250,      // kepçe
  ropeWeightKg: 250,
  drumWallThicknessMm: 16,
  safetyGrooveCount: 3,
  drumWeightKg: 800,            // tambur ağırlığı W
  // Tambur mili ölçü zinciri (A…G, cm) — mesnetler arası 130 cm, her iki
  // yanda 6 cm konsol (moment kolu), 2 x 220 mm yiv bölgesi.
  drumSpanACm: 6,
  drumSpanBCm: 5,
  drumSpanCCm: 22,
  drumSpanDCm: 64,
  drumSpanECm: 22,
  drumSpanFCm: 5,
  drumSpanGCm: 6,
  ropeLoadPosition: ROPE_POSITION_AUTO,
  shaftD1Cm: 6,                 // D1 — eğilme gerilmesi kesiti
  shaftD2Cm: 5,                 // D2 — yatak oturma çapı (kesme kesiti)
  drumWeldThicknessCm: 1.5,
  drumWeldAllowable: 156.9,     // kaynak izin gerilmesi [MPa] (≈1600 kg/cm²)
  shaftWeldThicknessCm: 1,
  shaftWeldAllowable: 156.9,    // kaynak izin gerilmesi [MPa] (≈1600 kg/cm²)
  bearingFactorY1: 2.8,
  bearingFactorY2: 2.8,
  drumCount: 1,
  gearboxServiceFactor: 1.5,
  reducerStages: 3,
  stageEfficiency: 0.99,
  tempFactor: 1,                // 40 °C
  motorDivisor: 1,
  brakeServiceFactor: 1.7,
  motorCouplingServiceFactor: 2,
  drumCouplingDivisor: 1,
  drumCouplingServiceFactor: 1.7,
};

export const V5_MAIN_HOIST_SELECTIONS: HoistSelections = {
  ropeBrand: "Hasçelik",
  ropeDiaMm: 18,
  ropeConstruction: "6x36",
  ropeCore: "Çelik Öz",
  ropeWireStrength: 200,
  ropeBreakingLoadKn: 226,
  drumDiaMm: 400,
  drumMaterial: "S355",
  drumGrooveLengthText: "2 x 220",
  shaftMaterial: "C30",
  bearingType: "Çift Sıra Makaralı Rulman",
  bearingCode: "22212",
  bearingDynCKn: 159,
  bearingStatC0Kn: 166,
  gearboxModel: "YILMAZ HT0823",
  gearboxRatio: 52.57,
  gearboxNominalTorqueKnm: 22,
  gearboxInputShaftMm: 55,
  gearboxOutputShaftMm: 120,
  gearboxWeightKg: 775,
  gearboxAllowedRadialKn: 60,
  motorPowerKw: 55,
  motorRpm: 1480,
  motorShaftMm: 70,
  motorBrand: "GAMAK",
  motorCount: 1,
  brakeBrand: "SİBRE",
  brakeModel: "SIBRE TE250 Ed 50/6",
  brakeTorqueNm: 850,
  brakeWheelDiaMm: 250,
  brakeQty: 2,
  motorCouplingBrand: "ÖZGÜN",
  motorCouplingModel: "B3-3",
  motorCouplingWheelDiaMm: 200,
  motorCouplingTorqueNm: 5500,
  motorCouplingDmaxMm: 75,
  drumCouplingBrand: "ÖZGÜN",
  drumCouplingModel: "J7",
  drumCouplingTorqueNm: 37000,
  drumCouplingRadialN: 88000,
  drumCouplingDmaxMm: 150,
};

export const V5_AUX_HOIST_INPUTS: HoistInputs = {
  ...V5_MAIN_HOIST_INPUTS,
  reevingLabel: "2/4",
  totalFalls: 4,
  hookBlockWeightKg: 150,
  ropeWeightKg: 50,
  safetyGrooveCount: 2,
  gearboxServiceFactor: 1.8,
  tempFactor: 1.1,              // 60 °C
  brakeServiceFactor: 1.6,
  drumCouplingServiceFactor: 1.8,
};

export const V5_AUX_HOIST_SELECTIONS: HoistSelections = {
  ...V5_MAIN_HOIST_SELECTIONS,
  ropeDiaMm: 12,
  ropeBreakingLoadKn: 100.5,
  drumDiaMm: 290,
  drumGrooveLengthText: "2 x 730",
  gearboxModel: "SEW X3FS100",
  gearboxRatio: 86,
  gearboxNominalTorqueKnm: 6.8,
  gearboxOutputShaftMm: 90,
  motorPowerKw: 11,
  brakeModel: "TE200 Ed 23/5",
  brakeTorqueNm: 350,
  brakeWheelDiaMm: 315,
  drumCouplingModel: "J5",
  drumCouplingTorqueNm: 36800,
  drumCouplingRadialN: 18400,
  drumCouplingDmaxMm: 110,
};

/** V5 işinin tam girdi seti — yeni revizyon şablonu */
export const V5_TEMPLATE: CalcInput = {
  specs: V5_SPECS,
  mainHoist: { inputs: V5_MAIN_HOIST_INPUTS, selections: V5_MAIN_HOIST_SELECTIONS },
  auxHoist: { inputs: V5_AUX_HOIST_INPUTS, selections: V5_AUX_HOIST_SELECTIONS },
  hookBlock: { inputs: V5_HOOKBLOCK_INPUTS, selections: V5_HOOKBLOCK_SELECTIONS },
  trolley: { inputs: V5_TROLLEY_INPUTS, selections: V5_TROLLEY_SELECTIONS },
  bridge: { inputs: V5_BRIDGE_INPUTS, selections: V5_BRIDGE_SELECTIONS },
  girder: { inputs: V5_GIRDER_INPUTS, selections: V5_GIRDER_SELECTIONS },
  buckling: { inputs: V5_BUCKLING_INPUTS },
  endCarriage: { inputs: V5_ENDCARRIAGE_INPUTS, selections: V5_ENDCARRIAGE_SELECTIONS },
};

/**
 * Yeni iş başlangıç şablonu — V5_TEMPLATE ile aynı, yalnız kullanıcı tercihleri:
 * iki perde arası 1500 mm, sehim sınırı 1/1000, ve otomatik hesaplanan girdiler
 * (halat ağırlığı, makara verimi) açık. Tarihsel doğrulama V5_TEMPLATE'i
 * (2000/750 ve otomatik alanlar kapalı) kullandığından bu ayrı tutulur; boş
 * girdiler için varsayılan kaynak (revision-load / editor) burasıdır.
 *
 * Makara yataklama tipi, V5'teki 0,985 verimiyle birebir örtüşen "yüksek verim"
 * seçeneğidir — otomatik açılınca sayı değişmez. Halat metre ağırlıkları seçili
 * halatların (Ø18 / Ø12, 6x36 çelik öz) katalog değerleridir.
 */
const HIGH_EFF_SHEAVE = "Rulmanlı yataklı makara (yüksek verim)";

export const NEW_WORK_TEMPLATE: CalcInput = {
  ...V5_TEMPLATE,
  mainHoist: {
    inputs: { ...V5_MAIN_HOIST_INPUTS, ropeWeightAuto: true, sheaveEfficiencyAuto: true },
    selections: {
      ...V5_MAIN_HOIST_SELECTIONS,
      ropeWeightKgPerM: 1.33,
      sheaveBearingKind: HIGH_EFF_SHEAVE,
    },
  },
  auxHoist: {
    inputs: { ...V5_AUX_HOIST_INPUTS, ropeWeightAuto: true, sheaveEfficiencyAuto: true },
    selections: {
      ...V5_AUX_HOIST_SELECTIONS,
      ropeWeightKgPerM: 0.59,
      sheaveBearingKind: HIGH_EFF_SHEAVE,
    },
  },
  girder: {
    inputs: { ...V5_GIRDER_INPUTS, diaphragmSpacingMm: 1500, deflectionLimitRatio: 1000 },
    selections: V5_GIRDER_SELECTIONS,
  },
};
