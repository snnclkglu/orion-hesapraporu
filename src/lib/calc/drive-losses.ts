// Sürücü (frekans konvertörü) atık ısısı — pano kayıp gücünün ana kalemi.
//
// KAYNAK: ABB ACS880 drive modules katalogu, hava soğutmalı invertör üniteleri
// ACS880-104, 400 V tablosu. Katalog her modelin yanında "Heat dissipation
// (kW)" sütununu YAYIMLAR; buradaki sayılar tahmin değil, o sütundur.
//
// SEÇİM KURALI — "bir büyük": vinç tahrikinde sürücü ağır hizmet (heavy-duty)
// sütunundan seçilir; ağır hizmette aynı gövde daha küçük motor gücü taşır,
// yani motorun anma gücüne göre BİR BÜYÜK gövde gelir. Uygulama bu yüzden
// motor gücünü karşılayan en küçük P_Hd satırını arar. Mühendisten ayrıca
// sürücü gücü İSTENMEZ.
//
// KAPSAM: bu tablo yalnız invertör modülünün kendi kaybıdır. Besleme ünitesi,
// trafo, PLC, UPS ve aydınlatma ayrıca eklenir (bkz. AUXILIARY_LOSS_FACTOR).

/** Katalog satırı: ağır hizmet motor gücü ve modülün atık ısısı. */
interface DriveRow {
  /** P_Hd — ağır hizmet kullanımda tipik motor gücü [kW] */
  heavyDutyKw: number;
  /** Modülün ısı kaybı [kW] */
  lossKw: number;
}

/**
 * ABB ACS880-104, 400 V (380–415 V) hava soğutmalı invertör modülleri.
 * Artan sırada; arama ilk `heavyDutyKw >= motor gücü` satırında durur.
 */
const ACS880_104_400V: readonly DriveRow[] = [
  { heavyDutyKw: 1.5, lossKw: 0.07 },
  { heavyDutyKw: 2.2, lossKw: 0.09 },
  { heavyDutyKw: 3, lossKw: 0.11 },
  { heavyDutyKw: 4, lossKw: 0.14 },
  { heavyDutyKw: 5.5, lossKw: 0.17 },
  { heavyDutyKw: 7.5, lossKw: 0.2 },
  { heavyDutyKw: 11, lossKw: 0.3 },
  { heavyDutyKw: 15, lossKw: 0.35 },
  { heavyDutyKw: 22, lossKw: 0.41 },
  { heavyDutyKw: 30, lossKw: 0.6 },
  { heavyDutyKw: 37, lossKw: 0.74 },
  { heavyDutyKw: 55, lossKw: 1.1 },
  { heavyDutyKw: 75, lossKw: 1.8 },
  { heavyDutyKw: 90, lossKw: 2 },
  { heavyDutyKw: 110, lossKw: 2.5 },
  { heavyDutyKw: 132, lossKw: 3.1 },
  { heavyDutyKw: 160, lossKw: 4.8 },
  { heavyDutyKw: 250, lossKw: 6.7 },
  { heavyDutyKw: 315, lossKw: 8 },
  { heavyDutyKw: 355, lossKw: 10 },
  { heavyDutyKw: 500, lossKw: 13 },
  { heavyDutyKw: 630, lossKw: 16 },
  { heavyDutyKw: 710, lossKw: 20 },
] as const;

/**
 * Besleme ünitesi, trafo, kumanda, UPS ve aydınlatma payı.
 *
 * Katalog rakamlarına göre besleme ünitesinin kaybı invertörlerinkiyle
 * karşılaştırılabilir büyüklüktedir (diyot besleme ≈ %1,5, rejeneratif IGBT
 * besleme ≈ %4 — yani rejeneratif beslemede besleme ünitesi tek başına bütün
 * invertörlerden fazla ısınır). Ayrı bir girdi istememek için invertör
 * toplamının bu oranı kadar yardımcı yük eklenir; mühendis pano kayıp gücünü
 * elle girerek bu kabulü tamamen atlayabilir.
 */
export const AUXILIARY_LOSS_FACTOR = 0.8;

/**
 * Vinç kesikli çalışır: kaldırma çalışırken yürütme durur ve kaldırmanın
 * kendisi de kesikli görevdir. Klima, mahallin termal zaman sabiti (dakikalar)
 * üzerinden ORTALAMA kaybı görür; bütün sürücüleri aynı anda tam yükte kabul
 * etmek klimayı gereksiz büyütür. Firma kabulü.
 */
export const DUTY_DIVERSITY_FACTOR = 0.6;

/** Motor gücünü karşılayan sürücünün atık ısısı [kW]. */
export function driveLossKw(motorPowerKw: number): number {
  if (!Number.isFinite(motorPowerKw) || motorPowerKw <= 0) return 0;
  const row = ACS880_104_400V.find((r) => r.heavyDutyKw >= motorPowerKw);
  // Tablonun üstünü aşan güçte son satırın kayıp oranıyla ölçeklenir; vinç
  // tahriklerinde bu banda çıkılmaz, sessizce sıfır dönmek yanlış olurdu.
  if (!row) {
    const last = ACS880_104_400V[ACS880_104_400V.length - 1];
    return (last.lossKw / last.heavyDutyKw) * motorPowerKw;
  }
  return row.lossKw;
}

/** Bir tahrik grubunun (motor gücü × adet) toplam sürücü kaybı [kW]. */
export function driveGroupLossKw(motorPowerKw: number, motorCount: number): number {
  const count = Number.isFinite(motorCount) && motorCount > 0 ? Math.floor(motorCount) : 1;
  return driveLossKw(motorPowerKw) * count;
}

/**
 * Panoya/odaya düşen toplam ısı [kW]: sürücü kayıpları + yardımcı ekipman payı,
 * eşzamanlılık katsayısıyla ortalamaya indirilmiş.
 */
export function panelHeatKw(inverterLossKw: number): number {
  return inverterLossKw * (1 + AUXILIARY_LOSS_FACTOR) * DUTY_DIVERSITY_FACTOR;
}
