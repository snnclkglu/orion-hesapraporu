// Otomatik türetilen girdiler.
//
// Bazı "girdi" alanları aslında başka verilerden hesaplanabilir: halat ağırlığı
// seçilen halatın metre ağırlığından, makara verimi ise makara yataklama
// tipinden. Bu dosya o türetmelerin SAF karşılıklarıdır; sihirbaz, ilgili alanın
// "Otomatik" anahtarı açıkken hesaplanan değeri girdiye yazar. Böylece hesap
// motoru, PDF rapor ve ekipman listesi hep aynı değeri görür ve alan elle
// düzenlenmek istenirse anahtar kapatılıp serbest bırakılabilir.

import { hoistReeving } from "./modules/hoistGroup";
import { commonReevingByLabel } from "./reeving";
import type { HoistInputs, HoistSelections } from "./modules/hoistGroup";

// ------------------------------------------------------------- Makara verimi

/**
 * Tek makara verimi η_m — firma standardı.
 *
 * ORION vinçlerinde makaralar istisnasız rulmanlı yataklanır; yataklama tipi
 * bir seçim değil sabit bir imalat kabulüdür. CMAA 70 Tablo 5.2.9.1.1.1-1
 * rulmanlı yatak için Es = 0,99 verir; burada imalat toleranslarını da kapsayan
 * biraz daha muhafazakâr 0,985 kullanılır.
 */
export const STANDARD_SHEAVE_EFFICIENCY = 0.985;

/** Standart yataklamanın açıklaması — raporda gösterilir. */
export const STANDARD_SHEAVE_BEARING_TEXT = "Rulmanlı yataklı makara (yüksek verim)";

// ------------------------------------------------------- Kanca bloğu ağırlığı

/** Kanca bloğu / tutucu ağırlığı yuvarlama adımı [kg]. */
export const HOOK_BLOCK_WEIGHT_ROUND_KG = 10;

/** Kanca bloğu ağırlığının kaldırma kapasitesine oranı — firma tasarım kabulü. */
export const HOOK_BLOCK_WEIGHT_RATIO = 0.1;

/**
 * Kanca bloğu / tutucu ağırlığı [kg] = kaldırma kapasitesinin %10'u,
 * 10 kg'ın katına yuvarlanır. Kepçe, mıknatıs gibi özel tutucularda mühendis
 * otomatiği kapatıp gerçek ağırlığı girer.
 */
export function deriveHookBlockWeightKg(capacityT: number): number | undefined {
  if (!Number.isFinite(capacityT) || capacityT <= 0) return undefined;
  const raw = capacityT * 1000 * HOOK_BLOCK_WEIGHT_RATIO;
  return Math.max(
    HOOK_BLOCK_WEIGHT_ROUND_KG,
    Math.round(raw / HOOK_BLOCK_WEIGHT_ROUND_KG) * HOOK_BLOCK_WEIGHT_ROUND_KG
  );
}

// ---------------------------------------------------------- Sıcaklık faktörü

/**
 * Ortam sıcaklığına göre motor gücü düzeltme katsayısı.
 *
 * Sargı sıcaklığı arttıkça motorun sürekli verebileceği güç düşer; gerekli güç
 * bu katsayıyla büyütülür. Değerler firma standardıdır (motor üreticilerinin
 * ortam sıcaklığı derating tablolarıyla uyumlu).
 */
export const MOTOR_TEMP_FACTORS: readonly { maxC: number; factor: number }[] = [
  { maxC: 40, factor: 1 },
  { maxC: 45, factor: 1.05 },
  { maxC: 50, factor: 1.1 },
  { maxC: 55, factor: 1.1 },
  { maxC: 60, factor: 1.15 },
  { maxC: 65, factor: 1.15 },
  { maxC: 70, factor: 1.2 },
  { maxC: 75, factor: 1.25 },
  { maxC: 80, factor: 1.3 },
];

/**
 * Ortam sıcaklığı üst sınırından motor sıcaklık faktörü. Ara değerler bir üst
 * basamağa yuvarlanır (emniyetli taraf); 40 °C altı 1, 80 °C üstü 1,30'dur.
 */
export function motorTempFactor(ambientMaxC: number): number {
  if (!Number.isFinite(ambientMaxC)) return 1;
  for (const row of MOTOR_TEMP_FACTORS) {
    if (ambientMaxC <= row.maxC) return row.factor;
  }
  return MOTOR_TEMP_FACTORS[MOTOR_TEMP_FACTORS.length - 1].factor;
}

// ------------------------------------------------------------ Halat ağırlığı

/** Halat ağırlığı yuvarlama adımı [kg] — imalat pratiği. */
export const ROPE_WEIGHT_ROUND_KG = 50;

/**
 * Halat ağırlığı [kg] = toplam halat sayısı × halat metre ağırlığı ×
 * kaldırma yüksekliği; sonuç yukarı doğru 50 kg'ın katına yuvarlanır.
 * (Yukarı yuvarlama, toplam yükü emniyetli tarafta bırakır.)
 */
export function deriveRopeWeightKg(
  totalFalls: number,
  ropeWeightKgPerM: number,
  liftHeightM: number
): number | undefined {
  if (
    !Number.isFinite(totalFalls) ||
    !Number.isFinite(ropeWeightKgPerM) ||
    !Number.isFinite(liftHeightM) ||
    totalFalls <= 0 ||
    ropeWeightKgPerM <= 0 ||
    liftHeightM <= 0
  ) {
    return undefined;
  }
  const raw = totalFalls * ropeWeightKgPerM * liftHeightM;
  return Math.max(
    ROPE_WEIGHT_ROUND_KG,
    Math.ceil(raw / ROPE_WEIGHT_ROUND_KG) * ROPE_WEIGHT_ROUND_KG
  );
}

// --------------------------------------------------------- Girdiye uygulama

export type DerivedHoistField = "ropeWeightKg" | "hookBlockWeightKg" | "tempFactor";

export interface HoistDerivation {
  /** Hazır donanım seçiliyse tahrikli halat kolu sayısı */
  drivenFalls?: number;
  /** Hazır donanım seçiliyse toplam halat kolu sayısı */
  totalFalls?: number;
  /** Otomatik hesaplanan halat ağırlığı (anahtar kapalıysa undefined) */
  ropeWeightKg?: number;
  /** Otomatik hesaplanan kanca bloğu / tutucu ağırlığı */
  hookBlockWeightKg?: number;
  /** Otomatik hesaplanan sıcaklık faktörü */
  tempFactor?: number;
  /** Otomatik açık ama kaynak veri eksikse gösterilecek uyarılar */
  warnings: { field: DerivedHoistField; message: string }[];
}

/** Türetmenin teknik özelliklerden okuduğu büyüklükler. */
export interface HoistDeriveContext {
  /** Bu kaldırma grubunun kaldırma yüksekliği [m] */
  liftHeightM: number;
  /** Bu kaldırma grubunun kapasitesi [t] */
  capacityT: number;
  /** Ortam sıcaklığı üst sınırı [°C] */
  ambientTempMaxC: number;
}

/**
 * Bir kaldırma grubunun otomatik alanlarını hesaplar. Yalnız ilgili anahtar
 * açıkken değer döner; kaynak veri eksikse değer yerine uyarı üretilir.
 */
export function deriveHoistInputs(
  inputs: HoistInputs,
  selections: HoistSelections,
  ctx: HoistDeriveContext
): HoistDerivation {
  const out: HoistDerivation = { warnings: [] };

  // Hazır bir halat donanımı seçiliyse ("2/4", "4/8" …) tahrikli ve toplam
  // halat kolu sayıları o donanımdan doldurulur; kullanıcı iki kutuyu elle
  // tutarlı tutmak zorunda kalmaz. "Elle giriş"te alanlar serbesttir.
  const preset = inputs.reevingLabel ? commonReevingByLabel(inputs.reevingLabel) : undefined;
  if (preset) {
    if (preset.drivenFalls !== inputs.drivenFalls) out.drivenFalls = preset.drivenFalls;
    if (preset.totalFalls !== inputs.totalFalls) out.totalFalls = preset.totalFalls;
  }

  if (inputs.ropeWeightAuto) {
    const perM = selections.ropeWeightKgPerM;
    if (!perM || perM <= 0) {
      out.warnings.push({
        field: "ropeWeightKg",
        message:
          "Halat metre ağırlığı bilinmiyor — katalogdan halat seçin ya da " +
          "metre ağırlığını elle girin.",
      });
    } else {
      // Kol sayısı donanım nesnesinden okunur (tek kaynak): hazır bir donanım
      // seçilmişse toplam kol sayısı o seçimden gelir.
      const reeving = hoistReeving(inputs);
      const v = deriveRopeWeightKg(reeving.totalFalls, perM, ctx.liftHeightM);
      if (v === undefined) {
        out.warnings.push({
          field: "ropeWeightKg",
          message: "Toplam halat sayısı ve kaldırma yüksekliği pozitif olmalı.",
        });
      } else {
        out.ropeWeightKg = v;
      }
    }
  }

  if (inputs.hookBlockWeightAuto) {
    const v = deriveHookBlockWeightKg(ctx.capacityT);
    if (v === undefined) {
      out.warnings.push({
        field: "hookBlockWeightKg",
        message: "Kaldırma kapasitesi pozitif olmalı.",
      });
    } else {
      out.hookBlockWeightKg = v;
    }
  }

  if (inputs.tempFactorAuto) {
    out.tempFactor = motorTempFactor(ctx.ambientTempMaxC);
  }

  return out;
}
