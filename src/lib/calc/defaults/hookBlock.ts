// İSDEMİR V5 işinin kanca bloğu değerleri — yeni revizyon şablonu ve tarihsel
// doğrulama fikstürü için başlangıç verisi.

import type {
  HookBlockDeps,
  HookBlockInputs,
  HookBlockSelections,
} from "../modules/hookBlock";

export const V5_HOOKBLOCK_INPUTS: HookBlockInputs = {
  // Simetrik merkez ölçüleri; V5 2/2 donanımında tek makara merkezde.
  shaftSupportOffsetMm: 50,
  shaftSheaveOffsetsText: "",
  shaftD1Mm: 65,                  // D1 — mil gerilme kesiti çapı
  // Kaldırma kirişi ölçü zinciri x · y · z. Referans işin eski girdisi
  // simetrikti (a = 4800, b = 550) ve zincirin karşılığı birebir budur:
  // x = z = 550, y = 4800 − 2·550 = 3700.
  beamXMm: 550,
  beamYMm: 3700,
  beamZMm: 550,
  midTopPlateThkMm: 15,           // Kesit 1 (açıklık ortası) üst sac
  midTopPlateWidthMm: 980,
  midWebPlateThkMm: 10,           // Kesit 1 yan sac
  midWebPlateHeightMm: 980,
  midBottomPlateThkMm: 15,        // Kesit 1 alt sac
  midBottomPlateWidthMm: 980,
  thickTopPlateThkMm: 15,         // Kesit 2 (mesnet/yük bölgesi) üst sac
  thickTopPlateWidthMm: 980,
  thickWebPlateThkMm: 60,         // Kesit 2 yan sac
  thickWebPlateHeightMm: 980,
  thickBottomPlateThkMm: 60,      // Kesit 2 alt sac
  thickBottomPlateWidthMm: 980,
  // ψ katsayısı elle EZİLMEZ: teknik özelliklerdeki kaldırma sınıfından
  // (H3/B4 → H3) DIN 15018 Tablo 2 satırı okunur → k = 1,3 · l = 0,0066.
  loadGroup: "B6",                // yorulma yük grubu
  notchClass: "K3",               // kaynak / çentik sınıfı
  fatigueMaterial: "S235JR",      // kaldırma kirişi malzemesi
  // Kancanın tam tanımı standart + numaradan türetilir; mühendis anahtarı
  // kapatıp elle yazabilir. Eski revizyonlarda anahtar hiç yoktur ve
  // `revision-load` onları kapalı sayar (teslim edilmiş tanım değişmesin).
  hookDesignationAuto: true,
};

export const V5_HOOKBLOCK_SELECTIONS: HookBlockSelections = {
  hookStandard: "DIN 15401",      // tek ağızlı dövme kanca
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
