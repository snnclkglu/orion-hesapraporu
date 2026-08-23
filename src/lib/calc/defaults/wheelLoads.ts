// Teker yükleri bölümünün başlangıç girdileri.
//
// Alanların çoğu OTOMATİKTİR: teker konumları dingil mesafesine eşit aralıklı
// dağıtılır, kılavuz elemanları arası mesafe dingil mesafesinden okunur, bağlı
// teker çifti adedi tahrikli tekerlerden türetilir. Mühendis yalnız dingil
// mesafesini ve kılavuz boşluğunu vermek zorundadır.

import type { WheelLoadInputs, WheelLoadSelections } from "../modules/wheelLoads";

export const V5_WHEELLOAD_INPUTS: WheelLoadInputs = {
  measurementsConfirmed: true,
  // 4 tekerli vinç: rayda iki teker, aralarındaki mesafe dingil mesafesidir.
  // Teker adedi köprü yürütme bölümünden değiştiğinde görsel düzenleyici
  // mesafe listesini yeni teker sayısına göre yeniden kurar.
  wheelSpacingsText: "3000",
  guideSpacingMm: 3000,
  guideSpacingAuto: true,
  // Teker flanşı ile ray başı arasında her tarafta bırakılan boşluk.
  guideClearanceMm: 10,
  coupledPairCount: 2,
  coupledPairAuto: true,
  // Sürünme hızı verilmemişse ana kaldırma hızının onda biri makul bir
  // başlangıçtır; HD2/HD3 seçilirse mühendis gerçek değeri girer.
  creepSpeedMpm: 0.5,
};

export const V5_WHEELLOAD_SELECTIONS: WheelLoadSelections = {
  // Genel amaçlı kancalı vinç: normal kaldırma, sürünme hızı zorunlu değil.
  hoistingClass: "HC2",
  hoistDriveClass: "HD1",
  // Standart gezer köprülü vinçte iki başkiriş de yanal sabittir; tekerler
  // arası mekanik/elektriksel bağ varsayılan olarak kabul edilir (emniyetli
  // taraf: kılavuz kuvveti en büyük çıkar).
  wheelPairMode: "CFF",
  guideMeans: "flange",
};
