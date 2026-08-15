// Otomatik türetilen girdiler.
//
// Bazı "girdi" alanları aslında başka verilerden hesaplanabilir: halat ağırlığı
// seçilen halatın metre ağırlığından, makara verimi ise makara yataklama
// tipinden. Bu dosya o türetmelerin SAF karşılıklarıdır; sihirbaz, ilgili alanın
// "Otomatik" anahtarı açıkken hesaplanan değeri girdiye yazar. Böylece hesap
// motoru, PDF rapor ve ekipman listesi hep aynı değeri görür ve alan elle
// düzenlenmek istenirse anahtar kapatılıp serbest bırakılabilir.

import { drumGrooveRequirement, drumShaftGeometry, hoistReeving } from "./modules/hoistGroup";
import { commonReevingByLabel } from "./reeving";
import {
  STRUCTURE_AMPLIFY_FACTOR,
  horizontalDynamicFactor,
} from "./modules/mainGirder";
import type { HoistInputs, HoistSelections } from "./modules/hoistGroup";
import type { GirderInputs } from "./modules/mainGirder";
import type { TravelInputs } from "./modules/travelGroup";
import type { MechanismClass, TechnicalSpecs } from "./types";

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

// ------------------------------------------------------------------ Yiv boyu

/**
 * Yiv boyu yuvarlama adımı [mm].
 *
 * İmalat resmine "219,15 mm" yazılmaz; tambur namlusu düzgün bir ölçüye
 * çekilir. 1 metrenin altındaki boylarda 10 mm'lik adım hem yeterince ince hem
 * de okunaklıdır (219,15 → 220); metrenin üstünde 10 mm'lik basamak anlamsız
 * bir hassasiyet iddiasıdır, 50 mm daha düzgün durur (1.284 → 1.300).
 * Yuvarlama HER ZAMAN YUKARIDIR: yiv boyu yetmezse halat tambura sığmaz.
 */
export const GROOVE_LENGTH_ROUND_MM = 10;
export const GROOVE_LENGTH_ROUND_LARGE_MM = 50;
/** Bu boyun üstünde büyük adım kullanılır [mm]. */
export const GROOVE_LENGTH_LARGE_THRESHOLD_MM = 1000;

/** Gerekli yiv boyunu düzgün bir imalat ölçüsüne YUKARI yuvarlar [mm]. */
export function roundGrooveLengthMm(rawMm: number): number | undefined {
  if (!Number.isFinite(rawMm) || rawMm <= 0) return undefined;
  const step =
    rawMm >= GROOVE_LENGTH_LARGE_THRESHOLD_MM
      ? GROOVE_LENGTH_ROUND_LARGE_MM
      : GROOVE_LENGTH_ROUND_MM;
  return Math.ceil(rawMm / step) * step;
}

/**
 * "Yiv Boyu" kutusunun metni: `<tahrikli halat sayısı> x <yiv boyu>`
 * (ör. "2 x 220"). Baştaki sayı tambura sarılan halat kolu adedidir — o kadar
 * ayrı yiv helisi açılır; sondaki sayı BİR helisin yukarı yuvarlanmış boyudur.
 */
export function deriveDrumGrooveLengthText(
  inputs: HoistInputs,
  selections: HoistSelections,
  liftHeightM: number
): string | undefined {
  if (!Number.isFinite(liftHeightM) || liftHeightM <= 0) return undefined;
  if (!(selections.drumDiaMm > 0) || !(selections.ropeDiaMm > 0)) return undefined;
  const rounded = roundGrooveLengthMm(drumGrooveRequirement(inputs, selections, liftHeightM).lengthMm);
  if (rounded === undefined) return undefined;
  const driven = hoistReeving(inputs).drivenFalls;
  if (!Number.isFinite(driven) || driven <= 0) return undefined;
  return `${driven} x ${rounded}`;
}

// ----------------------------------------------------------- Tambur ağırlığı

/** Çelik yoğunluğu [g/cm³] — tambur borusu hacminden ağırlığa. */
export const DRUM_STEEL_DENSITY_G_CM3 = 7.85;

/**
 * Namlu borusunun ağırlığına uygulanan pay katsayısı: yanaklar, göbek, mil
 * bağlantı sacları ve kaynaklar boru ağırlığının kabaca %30'u kadar ekler.
 * Firma tasarım kabulüdür.
 */
export const DRUM_WEIGHT_EXTRA_FACTOR = 1.3;

/** Tambur ağırlığı yuvarlama adımı [kg]. */
export const DRUM_WEIGHT_ROUND_KG = 10;

/**
 * Tambur ağırlığı [kg].
 *
 * Et kalınlığı yiv DİBİNDEN ölçülür; yiv, halat çapının yarısı kadar derin
 * açıldığından taşıyıcı gövdenin gerçek et kalınlığı
 *   s = s_yivdibi + d_halat / 2
 * olur. Tambur çapı D DIŞ çaptır (yiv tepesi); boru kesiti bu yüzden
 *   A = π/4 · (D² − (D − 2s)²)
 * ile bulunur. Boy, yiv boyu değil YANAKLAR ARASI NAMLU boyudur — yivsiz orta
 * bölge ve yanak payları da imal edilen borunun parçasıdır. Sonuç yanak/göbek/
 * kaynak payı için 1,3 ile çarpılır ve 10 kg'a YUKARI yuvarlanır (ağır tambur,
 * mil ve rulman tarafında emniyetli taraftır).
 *
 * Kullanıcının örneği (D = 400, s_yivdibi = 12, d = 18, L = 2000):
 *   s = 12 + 9 = 21 mm → A = π/4·(400² − 358²) = 25.004 mm²
 *   V = 25.004 · 2.000 = 50.008.120 mm³ = 50.008,1 cm³
 *   W = 50.008,1 · 7,85 g/cm³ = 392,6 kg → ×1,3 = 510,3 kg → 520 kg
 */
export function deriveDrumWeightKg(p: {
  /** Tambur DIŞ çapı [mm] */
  drumDiaMm: number;
  /** Yiv dibi et kalınlığı [mm] */
  grooveWallThicknessMm: number;
  /** Halat çapı [mm] */
  ropeDiaMm: number;
  /** Yanaklar arası namlu boyu [mm] */
  barrelLengthMm: number;
}): number | undefined {
  const { drumDiaMm: D, grooveWallThicknessMm, ropeDiaMm, barrelLengthMm: L } = p;
  const s = grooveWallThicknessMm + ropeDiaMm / 2;
  if (
    !Number.isFinite(D) || !Number.isFinite(s) || !Number.isFinite(L) ||
    D <= 0 || s <= 0 || L <= 0 || 2 * s >= D
  ) {
    return undefined;
  }
  const areaMm2 = (Math.PI / 4) * (D ** 2 - (D - 2 * s) ** 2);
  const volumeCm3 = (areaMm2 * L) / 1000;           // mm³ → cm³
  const kg = (volumeCm3 * DRUM_STEEL_DENSITY_G_CM3) / 1000 * DRUM_WEIGHT_EXTRA_FACTOR;
  return Math.max(
    DRUM_WEIGHT_ROUND_KG,
    Math.ceil(kg / DRUM_WEIGHT_ROUND_KG) * DRUM_WEIGHT_ROUND_KG
  );
}

/** Tambur ağırlığı formülünün kısa metni — arayüzde alan ipucu (tooltip). */
export const DRUM_WEIGHT_FORMULA_HINT =
  "Otomatik: s = yiv dibi eti + halat çapı / 2 · " +
  "W = π/4 · (D² − (D − 2s)²) · L_namlu · 7,85 g/cm³ × 1,3 " +
  "(yanak, göbek ve kaynak payı). L_namlu = B+C+D+E+F ölçü zinciri.";

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

export type DerivedHoistField =
  | "ropeWeightKg"
  | "hookBlockWeightKg"
  | "tempFactor"
  | "sheaveEfficiency"
  | "drumWeightKg"
  | "drumGrooveLengthText";

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
  /** Otomatik makara verimi (firma standardı) */
  sheaveEfficiency?: number;
  /** Otomatik hesaplanan tambur ağırlığı [kg] */
  drumWeightKg?: number;
  /**
   * Otomatik yiv boyu metni ("2 x 220"). Bu bir GİRDİ değil KATALOG SEÇİMİ
   * alanıdır (`HoistSelections.drumGrooveLengthText`); editör türetilen değeri
   * seçime yazar.
   */
  drumGrooveLengthText?: string;
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

  if (inputs.sheaveEfficiencyAuto) {
    out.sheaveEfficiency = STANDARD_SHEAVE_EFFICIENCY;
  }

  if (inputs.drumWeightAuto) {
    const barrelCm = drumShaftGeometry(inputs).barrelCm;
    const v = deriveDrumWeightKg({
      drumDiaMm: selections.drumDiaMm,
      grooveWallThicknessMm: inputs.drumWallThicknessMm,
      ropeDiaMm: selections.ropeDiaMm,
      barrelLengthMm: barrelCm * 10,
    });
    if (v === undefined) {
      out.warnings.push({
        field: "drumWeightKg",
        message:
          "Tambur ağırlığı türetilemedi — tambur çapı, halat çapı, yiv dibi et " +
          "kalınlığı ve B…F namlu ölçüleri pozitif olmalı (et kalınlığı çapın " +
          "yarısını aşamaz).",
      });
    } else {
      out.drumWeightKg = v;
    }
  }

  if (inputs.drumGrooveLengthAuto) {
    const text = deriveDrumGrooveLengthText(inputs, selections, ctx.liftHeightM);
    if (text === undefined) {
      out.warnings.push({
        field: "drumGrooveLengthText",
        message:
          "Yiv boyu türetilemedi — kaldırma yüksekliği, tambur çapı ve halat " +
          "çapı pozitif olmalı.",
      });
    } else {
      out.drumGrooveLengthText = text;
    }
  }

  return out;
}

// ------------------------------------- Yürütme: CMAA uygulama (servis) sınıfı

/** CMAA 70 servis / uygulama sınıfları. */
export const CMAA_APPLICATION_CLASSES = ["A", "B", "C", "D", "E", "F"] as const;
export type CmaaApplicationClass = (typeof CMAA_APPLICATION_CLASSES)[number];

/** Sınıfların Türkçe açıklamaları — açılır listede gösterilir. */
export const CMAA_APPLICATION_CLASS_LABELS: Record<string, string> = {
  A: "A — Beklemede / Seyrek Kullanım",
  B: "B — Hafif Hizmet",
  C: "C — Orta Hizmet",
  D: "D — Ağır Hizmet",
  E: "E — Çok Ağır Hizmet",
  F: "F — Sürekli Ağır Hizmet",
};

/**
 * FEM 1.001 mekanizma sınıfı (M1…M8) → CMAA 70 servis sınıfı (A…F).
 *
 * DİKKAT — bu eşleme HİÇBİR STANDARTTA NORMATİF DEĞİLDİR. FEM mekanizmayı
 * çalışma süresi + yük tayfından, CMAA 70 ise vincin kullanım alanından
 * (depo, makine atölyesi, dökümhane…) sınıflandırır; ikisi farklı eksenlerdir
 * ve resmî bir dönüşüm tablosu yoktur. Aşağıdaki karşılık sektörde YAYGIN olan
 * ve ORION'un kendi işlerinde kullandığı `kind:"firma"` tasarım kabulüdür;
 * mühendis anahtarı kapatıp listeden başka bir sınıf seçebilir.
 *
 * M1/M2/M3→A · M4→B · M5→C · M6→D · M7→E · M8→F
 */
export const FEM_TO_CMAA_APPLICATION_CLASS: Record<MechanismClass, CmaaApplicationClass> = {
  M1: "A",
  M2: "A",
  M3: "A",
  M4: "B",
  M5: "C",
  M6: "D",
  M7: "E",
  M8: "F",
};

/** Mekanizma sınıfından uygulama sınıfı; tanınmayan sınıfta en ağır kabul. */
export function travelApplicationClass(mech: MechanismClass | undefined): CmaaApplicationClass {
  return (mech && FEM_TO_CMAA_APPLICATION_CLASS[mech]) ?? "F";
}

// ------------------------------------ CMAA 70 Tablo 5.2.9.1.2.1-E: servis faktörü Ks

/**
 * Tablo 5.2.9.1.2.1-E'nin SÜTUNLARI — tahrik ve kumanda tipi.
 *
 * Tablo iki eksenlidir: satır CMAA servis sınıfı (A…F), SÜTUN tahrik/kumanda
 * tipidir. Yani Ks yalnız sınıftan seçilemez; kumanda tipi de bilinmelidir.
 * Sütun adları katalogdaki başlıkların birebir karşılığıdır.
 */
export const CMAA_DRIVE_CONTROLS = [
  "dcSabit60",
  "dcSabit30",
  "acManyetik",
  "acStatik",
] as const;
export type CmaaDriveControl = (typeof CMAA_DRIVE_CONTROLS)[number];

export const CMAA_DRIVE_CONTROL_LABELS: Record<string, string> = {
  dcSabit60: "DC Sabit Gerilim (AISE seri mil motoru) — 60 dak",
  dcSabit30: "DC Sabit Gerilim (AISE seri mil motoru) — 30 dak",
  acManyetik: "AC Manyetik / Ayarlı Gerilim + DC Şönt Motor",
  acStatik: "AC Statik, Sabit Sekonder Direnç (Sürekli Kayma)",
};

/**
 * CMAA 70 Tablo 5.2.9.1.2.1-E — "Recommended Values of Travel Drive Service
 * Class Factor Ks". Değerler CMAA Specification #70 PDF'inin 60. sayfasından
 * (basılı s. 59) BİREBİR okunmuştur.
 *
 * `null` = katalogda "N/A": o servis sınıfı o kumanda tipiyle önerilmez.
 */
export const CMAA_SERVICE_FACTOR_KS: Record<
  CmaaApplicationClass,
  Record<CmaaDriveControl, number | null>
> = {
  A: { dcSabit60: 0.75, dcSabit30: 1.0, acManyetik: 1.0, acStatik: 1.2 },
  B: { dcSabit60: 0.75, dcSabit30: 1.0, acManyetik: 1.0, acStatik: 1.2 },
  C: { dcSabit60: 0.75, dcSabit30: 1.0, acManyetik: 1.0, acStatik: 1.2 },
  D: { dcSabit60: 0.85, dcSabit30: 1.15, acManyetik: 1.1, acStatik: 1.3 },
  E: { dcSabit60: 1.0, dcSabit30: null, acManyetik: 1.2, acStatik: 1.4 },
  F: { dcSabit60: 1.4, dcSabit30: null, acManyetik: 1.4, acStatik: 1.6 },
};

/**
 * Servis faktörü Ks. Sınıf–kumanda çifti tabloda "N/A" ise (E ve F sınıfı,
 * 30 dakikalık DC sütunu) UYDURULMAZ: `undefined` döner ve otomatik seçim
 * yapılmaz — mühendis kumanda tipini düzeltmeli ya da değeri elle girmelidir.
 */
export function cmaaServiceFactorKs(
  applicationClass: string | undefined,
  driveControl: string | undefined
): number | undefined {
  const row = CMAA_SERVICE_FACTOR_KS[applicationClass as CmaaApplicationClass];
  if (!row) return undefined;
  const v = row[driveControl as CmaaDriveControl];
  return typeof v === "number" ? v : undefined;
}

// ------------------------ CMAA 70 Tablo 5.2.9.1.2.1-C: ivmelenme tork faktörü Kt

/**
 * Tablo 5.2.9.1.2.1-C satırları — MOTOR TİPİ × KUMANDA TİPİ.
 *
 * DİKKAT: Kt, CMAA servis sınıfına (A…F) BAĞLI DEĞİLDİR. Tablo yalnız motor ve
 * kumanda tipiyle indislenir; bu yüzden Kt "uygulama sınıfından otomatik
 * seçilemez" — otomatiği besleyen alan motor/kumanda tipidir.
 *
 * `min`/`max`: katalogda aralık verilen satırlar. Katalog dipnotu 2:
 * "Low end of range is recommended when permanent slip resistance is used" —
 * uygulama SÜREKLİ KAYMA DİRENCİ kullanıldığını kabul edip aralığın ALT ucunu
 * seçer (bu, gerekli gücü ARTIRAN muhafazakâr taraftır: Ka ~ 1/Kt).
 */
export const CMAA_MOTOR_CONTROLS = [
  "acBilezikliKontaktor",
  "acBilezikliStatik",
  "acBilezikliMillKontaktor",
  "acSincapKafesBalast",
  "dcSontAyarliGerilim",
  "dcSeriKontaktor",
] as const;
export type CmaaMotorControl = (typeof CMAA_MOTOR_CONTROLS)[number];

export const CMAA_MOTOR_CONTROL_LABELS: Record<string, string> = {
  acBilezikliKontaktor: "AC Bilezikli Rotor + Kontaktör-Direnç",
  acBilezikliStatik: "AC Bilezikli Rotor + Statik Kademesiz",
  acBilezikliMillKontaktor: "AC Bilezikli Rotor (Mill) + Kontaktör-Direnç",
  acSincapKafesBalast: "AC Sincap Kafes + Balast Direnç",
  dcSontAyarliGerilim: "DC Şönt Sargılı + Ayarlı Gerilim",
  dcSeriKontaktor: "DC Seri Sargılı + Kontaktör-Direnç",
};

/**
 * CMAA 70 Tablo 5.2.9.1.2.1-C — "Recommended Values of Kt (Accelerating Torque
 * Factor)". CMAA Specification #70 PDF s. 59'dan (basılı s. 58) birebir.
 */
export const CMAA_ACCEL_TORQUE_KT: Record<
  CmaaMotorControl,
  { min: number; max: number }
> = {
  acBilezikliKontaktor: { min: 1.3, max: 1.5 },
  acBilezikliStatik: { min: 1.3, max: 1.5 },
  acBilezikliMillKontaktor: { min: 1.5, max: 1.7 },
  acSincapKafesBalast: { min: 1.3, max: 1.3 },
  dcSontAyarliGerilim: { min: 1.5, max: 1.5 },
  dcSeriKontaktor: { min: 1.35, max: 1.35 },
};

/** İvmelenme tork faktörü Kt — aralıklı satırlarda ALT uç (bkz. tablo notu). */
export function cmaaAccelTorqueKt(motorControl: string | undefined): number | undefined {
  const row = CMAA_ACCEL_TORQUE_KT[motorControl as CmaaMotorControl];
  return row ? row.min : undefined;
}

/** Yürütme grubunun türetmesinin okuduğu büyüklükler. */
export interface TravelDeriveContext {
  /** Ortam sıcaklığı üst sınırı [°C] */
  ambientTempMaxC: number;
  /** Bu yürütme grubunun FEM mekanizma sınıfı (bkz. `travelSpecView`) */
  mechanismClass: MechanismClass;
}

export interface TravelDerivation {
  /** Otomatik hesaplanan sıcaklık faktörü */
  tempFactor?: number;
  /** Otomatik seçilen CMAA uygulama sınıfı */
  applicationClass?: string;
  /** Otomatik seçilen CMAA servis faktörü Ks (T.5.2.9.1.2.1-E) */
  serviceFactorKs?: number;
  /** Otomatik seçilen CMAA ivmelenme tork faktörü Kt (T.5.2.9.1.2.1-C) */
  accelTorqueFactorKt?: number;
  /** Otomatik açık ama tablodan değer okunamadıysa gösterilecek uyarılar */
  warnings: { field: "serviceFactorKs" | "accelTorqueFactorKt"; message: string }[];
}

/**
 * Bir yürütme grubunun otomatik alanları — kaldırma tarafıyla aynı mekanizma:
 * yalnız ilgili anahtar açıkken değer döner, editör değeri girdiye yazar.
 *
 * Ks otomatiği, uygulama sınıfı otomatiği açıksa MEKANİZMA SINIFINDAN türetilen
 * sınıfı kullanır; kapalıysa mühendisin seçtiği sınıfı. Böylece iki kutu her
 * zaman tutarlı kalır.
 */
export function deriveTravelInputs(
  inputs: TravelInputs,
  ctx: TravelDeriveContext
): TravelDerivation {
  const out: TravelDerivation = { warnings: [] };
  if (inputs.tempFactorAuto) out.tempFactor = motorTempFactor(ctx.ambientTempMaxC);

  const applicationClass = inputs.travelApplicationClassAuto
    ? travelApplicationClass(ctx.mechanismClass)
    : inputs.applicationClass;
  if (inputs.travelApplicationClassAuto) out.applicationClass = applicationClass;

  if (inputs.serviceFactorKsAuto) {
    const ks = cmaaServiceFactorKs(applicationClass, inputs.driveControl);
    if (ks === undefined) {
      out.warnings.push({
        field: "serviceFactorKs",
        message:
          `CMAA 70 Tablo 5.2.9.1.2.1-E, "${applicationClass ?? "?"}" sınıfı için ` +
          "seçilen tahrik/kumanda tipinde değer vermiyor (N/A). Kumanda tipini " +
          "değiştirin ya da anahtarı kapatıp Ks'yi elle girin.",
      });
    } else {
      out.serviceFactorKs = ks;
    }
  }

  if (inputs.accelTorqueFactorKtAuto) {
    const kt = cmaaAccelTorqueKt(inputs.motorControl);
    if (kt === undefined) {
      out.warnings.push({
        field: "accelTorqueFactorKt",
        message:
          "CMAA 70 Tablo 5.2.9.1.2.1-C'de bu motor/kumanda tipi yok — tipi " +
          "seçin ya da anahtarı kapatıp Kt'yi elle girin.",
      });
    } else {
      out.accelTorqueFactorKt = kt;
    }
  }

  return out;
}

// ----------------------------------- Ana kiriş: yükler ve yükleme durumları

/** Ana kiriş türetmesinin diğer bölümlerden okuduğu büyüklükler. */
export interface GirderDeriveContext {
  /** Kanca bloğu / tutucu ağırlığı [kg] (taşınan kaldırma grubunun girdisinden) */
  mainHookBlockWeightKg: number;
  /** Askıdaki halat ağırlığı [kg] (taşınan kaldırma grubunun girdisinden) */
  mainRopeWeightKg: number;
  /**
   * Bu kirişin TAŞIDIĞI kaldırma yükü [kg]. Verilmezse ana kaldırma kapasitesi
   * kullanılır — dört kirişli köprüde ikinci takım YARDIMCI kaldırmayı taşır ve
   * kütle oranı (dolayısıyla ψhA / ψhK) o yükten çıkar.
   */
  hoistLoadKg?: number;
  /**
   * Bu kirişin altındaki arabanın ağırlığı [t]. Verilmezse ana araba. Yardımcı
   * kaldırmanın kendi arabası varsa ikinci takımda o kullanılır.
   */
  trolleyWeightT?: number;
}

export interface GirderDerivation {
  /** Otomatik yatay dinamik katsayı ψhA (araba) */
  psiHAOverride?: number;
  /** Otomatik yatay dinamik katsayı ψhK (köprü) */
  psiHKOverride?: number;
  /** Otomatik arttırma katsayısı γc */
  amplifyYcOverride?: number;
}

/**
 * Ana kirişin 7.2 "Yükler" ve 7.3 "Yükleme Durumları" bölümlerindeki üç kutu
 * artık elle sorulmaz.
 *
 * · ψhA / ψhK — FEM 1.001 A.2.2.3: kütle oranı µ = asılı yük / hareket eden
 *   eşdeğer kütle. Araba için eşdeğer kütle arabanın kendisi, köprü için
 *   köprü + arabadır. Motorun kendi türetmesiyle (`horizontalDynamicFactor`)
 *   AYNI fonksiyon kullanılır; kutuya yazılan sayı motorun hesapladığının
 *   birebir aynısıdır.
 * · γc — FEM 1.001 T.2.3.4: çelik yapı sınıfının (A1…A8) sabit karşılığı.
 *
 * Anahtar kapatıldığında alan serbest kalır ve motor mühendisin değerini
 * kullanır.
 */
export function deriveGirderInputs(
  inputs: GirderInputs,
  specs: TechnicalSpecs,
  ctx: GirderDeriveContext
): GirderDerivation {
  const out: GirderDerivation = {};
  const hoistLoadKg = ctx.hoistLoadKg ?? specs.mainCapacityT * 1000;
  const totalLiveLoadKg = hoistLoadKg + ctx.mainHookBlockWeightKg + ctx.mainRopeWeightKg;
  const trolleyWeightKg = (ctx.trolleyWeightT ?? specs.mainTrolleyWeightT) * 1000;
  const bridgeMovingMassKg = specs.bridgeWeightT * 1000 + trolleyWeightKg;

  if (inputs.psiHAAuto) {
    out.psiHAOverride = horizontalDynamicFactor(totalLiveLoadKg / trolleyWeightKg);
  }
  if (inputs.psiHKAuto) {
    out.psiHKOverride = horizontalDynamicFactor(totalLiveLoadKg / bridgeMovingMassKg);
  }
  if (inputs.amplifyYcAuto) {
    out.amplifyYcOverride = STRUCTURE_AMPLIFY_FACTOR[specs.structureClass];
  }
  return out;
}
