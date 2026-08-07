// İSDEMİR V5 işinin kanca bloğu değerleri — yeni revizyon şablonu ve tarihsel
// doğrulama fikstürü için başlangıç verisi.

import type {
  HookBlockDeps,
  HookBlockInputs,
  HookBlockSelections,
} from "../modules/hookBlock";

export const V5_HOOKBLOCK_INPUTS: HookBlockInputs = {
  // Mil ölçü zinciri: A yan sac → ilk makara, B küme içi makara adımı,
  // D iki makara kümesi arası (kanca sapı geçişi)
  shaftEdgeGapMm: 50,             // A
  shaftSheavePitchMm: 100,        // B
  shaftCenterGapMm: 150,          // D
  shaftD1Mm: 65,                  // D1 — mil gerilme kesiti çapı
  girderSpanMm: 4800,             // a — kiriş açıklığı
  loadOffsetMm: 550,              // b — yükün mesnede uzaklığı
  midTopPlateThkMm: 15,           // orta kesit üst sac
  midTopPlateWidthMm: 980,
  midWebPlateThkMm: 10,           // orta kesit yan sac
  midWebPlateHeightMm: 980,
  midBottomPlateThkMm: 15,        // orta kesit alt sac
  midBottomPlateWidthMm: 980,
  thickTopPlateThkMm: 15,         // kalın (mesnet) kesit üst sac
  thickTopPlateWidthMm: 980,
  thickWebPlateThkMm: 60,         // kalın kesit yan sac
  thickWebPlateHeightMm: 980,
  thickBottomPlateThkMm: 60,      // kalın kesit alt sac
  thickBottomPlateWidthMm: 980,
  // ψ katsayısı elle EZİLMEZ: teknik özelliklerdeki kaldırma sınıfından
  // (H3/B4 → H3) DIN 15018 Tablo 2 satırı okunur → k = 1,3 · l = 0,0066.
  loadGroup: "B6",                // yorulma yük grubu
  notchClass: "K3",               // kaynak / çentik sınıfı
  fatigueMaterial: "S235JR",      // kaldırma kirişi malzemesi
};

export const V5_HOOKBLOCK_SELECTIONS: HookBlockSelections = {
  hookDesignation: "DIN 15401 Nr 10 S",
  hookNumber: "10",               // DIN 15400 kanca no
  hookStrengthClass: "S",         // DIN 15400 mukavemet sınıfı
  hookCapacityKg: 16000,          // tablo dışı kanca için yedek değer
  sheaveDiaMm: 450,               // halat ekseninde makara çapı
  sheaveBearingType: "Bilyalı Rulman",
  sheaveBearingCode: "6213",
  sheaveBearingDynCKn: 58.5,
  sheaveBearingStatC0Kn: 40,
  sheaveBearingBoreMm: 65,        // 6213 iç çapı — mil çapı D1 = 6,5 cm ile eşleşir
  shaftMaterial: "C45",
  hookBearingType: "Eksenel Rulman",
  hookBearingCode: "51214",
  hookBearingStatC0Kn: 160,
};

/** Ana kaldırma grubundan gelen V5 değerleri */
export const V5_HOOKBLOCK_DEPS: HookBlockDeps = {
  ropeDiaMm: 18,                  // halat çapı
  ropeLoadKg: 3750,               // bir halat kolundaki yük T
  loadKg: 4000,                   // kaldırılan yük
  hookBlockWeightKg: 3250,        // kanca bloğu / tutucu ağırlığı
  ropeWeightKg: 250,              // halat ağırlığı
  totalLoadKg: 7500,              // toplam yük
  drumRpm: 27.8521385667767,      // tambur devri
  drumDiaMm: 400,                 // tambur çapı
  // Donanım 2/2 → hareketli makara adedi = toplam halat / 2 = 1
  blockSheaveCount: 1,
};
