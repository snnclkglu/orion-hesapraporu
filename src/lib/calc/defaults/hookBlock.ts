// İSDEMİR V5 raporunun kanca bloğu değerleri — yeni revizyon şablonu ve
// golden test fikstürü. Kaynak: reference/excel-dump/05_04_KANCA_BLOĞU.txt
// (statik hücreler) + 03_02_ANA_KALDIRMA_GRUBU.txt (deps hücreleri).

import type {
  HookBlockDeps,
  HookBlockInputs,
  HookBlockSelections,
} from "../modules/hookBlock";

export const V5_HOOKBLOCK_INPUTS: HookBlockInputs = {
  shaftSpanACm: 5,                // L60 — mesnet ölçüsü a
  shaftSpanCCm: 5,                // L61 — mesnet ölçüsü c
  shaftDiaCm: 6.5,                // L63 — mil çapı D
  girderSpanMm: 4800,             // L101 — a
  loadOffsetMm: 550,              // L102 — b
  midTopPlateThkMm: 15,           // L111 — orta kesit üst sac
  midTopPlateWidthMm: 980,        // N111
  midWebPlateThkMm: 10,           // L112 — orta kesit yan sac
  midWebPlateHeightMm: 980,       // N112
  midBottomPlateThkMm: 15,        // L113 — orta kesit alt sac
  midBottomPlateWidthMm: 980,     // N113
  thickTopPlateThkMm: 15,         // P111 — kalın kesit üst sac
  thickTopPlateWidthMm: 980,      // R111
  thickWebPlateThkMm: 60,         // P112 — kalın kesit yan sac
  thickWebPlateHeightMm: 980,     // R112
  thickBottomPlateThkMm: 60,      // P113 — kalın kesit alt sac
  thickBottomPlateWidthMm: 980,   // R113
  hoistClass: "B6",               // L122 — kaldırma sınıfı
  dynamicFactorK: 1.4,            // L126 — k (DIN 15018 Tablo 2)
  dynamicFactorL: 0.0088,         // L127 — l
  loadGroup: "B6",                // L148 — yük sınıfı
  notchClass: "K3",               // L149 — kaynak sınıfı (bkz. A207 notu)
  fatigueMaterial: "S235JR",      // YENİ girdi — Excel'de silinmiş dropdown (#ref!);
                                  // 07-ANA KİRİŞ!F405 (S235JR) ile uyumlu varsayılan
};

export const V5_HOOKBLOCK_SELECTIONS: HookBlockSelections = {
  hookDesignation: "DIN 15401 Nr 10 S", // A5
  hookCapacityKg: 16000,          // L6 (DIN 15400)
  sheaveDiaMm: 450,               // L14 — halat ekseninde makara çapı
  sheaveBearingType: "Bilyalı Rulman", // L22
  sheaveBearingCode: "6213",      // L23
  sheaveBearingDynCKn: 58.5,      // L29
  sheaveBearingStatC0Kn: 40,      // L30
  shaftMaterial: "C45",           // L69
  hookBearingType: "Eksenel Rulman", // L80
  hookBearingCode: "51214",       // L81
  hookBearingStatC0Kn: 160,       // L82
};

/** '02-ANA KALDIRMA GRUBU' sayfasından çekilen V5 değerleri */
export const V5_HOOKBLOCK_DEPS: HookBlockDeps = {
  ropeDiaMm: 18,                  // 02!L24
  ropeLoadKg: 3750,               // 02!L19
  loadKg: 4000,                   // 02!L13
  hookBlockWeightKg: 3250,        // 02!L14
  ropeWeightKg: 250,              // 02!L15
  totalLoadKg: 7500,              // 02!L16
  drumRpm: 27.8521385667767,      // 02!L149
  drumDiaMm: 400,                 // 02!L39
};
