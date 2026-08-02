// Otomatik türetilen girdiler.
//
// Bazı "girdi" alanları aslında başka verilerden hesaplanabilir: halat ağırlığı
// seçilen halatın metre ağırlığından, makara verimi ise makara yataklama
// tipinden. Bu dosya o türetmelerin SAF karşılıklarıdır; sihirbaz, ilgili alanın
// "Otomatik" anahtarı açıkken hesaplanan değeri girdiye yazar. Böylece hesap
// motoru, PDF rapor ve ekipman listesi hep aynı değeri görür ve alan elle
// düzenlenmek istenirse anahtar kapatılıp serbest bırakılabilir.

import { hoistReeving } from "./modules/hoistGroup";
import type { HoistInputs, HoistSelections } from "./modules/hoistGroup";

// ------------------------------------------------------------- Makara verimi

export interface SheaveBearingOption {
  value: string;
  /** Tek makara verimi η_m */
  efficiency: number;
}

/**
 * Makara yataklama tipi → tek makara verimi.
 * Rulmanlı yatakta sürtünme kaybı belirgin biçimde düşüktür; burçlu (kaymalı)
 * yatakta kayıp artar. CMAA 70 Tablo 5.2.9.1.1.1-1 aynı ayrımı Es = 0,99
 * (rulmanlı) / 0,98 (kaymalı) değerleriyle verir; aşağıdaki değerler vinç
 * imalatında yaygın kullanılan daha muhafazakâr kabullerdir.
 */
export const SHEAVE_BEARING_OPTIONS: readonly SheaveBearingOption[] = [
  { value: "Rulmanlı yataklı makara", efficiency: 0.98 },
  { value: "Rulmanlı yataklı makara (yüksek verim)", efficiency: 0.985 },
  { value: "Burçlu (kaymalı) yataklı makara", efficiency: 0.96 },
] as const;

export const SHEAVE_BEARING_KINDS = SHEAVE_BEARING_OPTIONS.map((o) => o.value);

/** Yataklama tipinin verimi; tanınmayan/boş tip için undefined. */
export function sheaveEfficiencyFor(kind: string | undefined): number | undefined {
  if (!kind) return undefined;
  return SHEAVE_BEARING_OPTIONS.find((o) => o.value === kind)?.efficiency;
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

export interface HoistDerivation {
  /** Otomatik hesaplanan halat ağırlığı (anahtar kapalıysa undefined) */
  ropeWeightKg?: number;
  /** Otomatik hesaplanan makara verimi (anahtar kapalıysa undefined) */
  sheaveEfficiency?: number;
  /** Otomatik açık ama kaynak veri eksikse gösterilecek uyarılar */
  warnings: { field: "ropeWeightKg" | "sheaveEfficiency"; message: string }[];
}

/**
 * Bir kaldırma grubunun otomatik alanlarını hesaplar. Yalnız ilgili anahtar
 * açıkken değer döner; kaynak veri eksikse değer yerine uyarı üretilir.
 */
export function deriveHoistInputs(
  inputs: HoistInputs,
  selections: HoistSelections,
  liftHeightM: number
): HoistDerivation {
  const out: HoistDerivation = { warnings: [] };

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
      const v = deriveRopeWeightKg(reeving.totalFalls, perM, liftHeightM);
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

  if (inputs.sheaveEfficiencyAuto) {
    const eff = sheaveEfficiencyFor(selections.sheaveBearingKind);
    if (eff === undefined) {
      out.warnings.push({
        field: "sheaveEfficiency",
        message: "Makara yataklama tipi seçilmedi.",
      });
    } else {
      out.sheaveEfficiency = eff;
    }
  }

  return out;
}
