// Tambur emniyet freni — SIBRE SHI kaliper fren kataloğu + seçim hesabı.
//
// Emniyet freni, kaldırma grubunun TAMBURUNA yerleştirilen ikinci frendir:
// motor mili üzerindeki servis freni ile tambur arasındaki aktarma organları
// (kaplin, redüktör, mil) koparsa yükü tutan tek eleman odur. Bu yüzden
// frenleme momenti redüktör ÖNCESİNDE değil, doğrudan tambur miline göre
// hesaplanır ve halat sistemi verimi PAYDAda yer alır (verim düştükçe tamburun
// tutması gereken moment BÜYÜR).
//
// Fren, tamburun flanşını disk olarak kullanır: kaliper flanşın iki yüzünü
// FA sıkma kuvvetiyle kavrar. Frenleme momenti sürtünme yarıçapından doğar:
//
//     M_fren = 2 · FA · µ · (d_flanş/2 − x)
//
// 2 → flanşın iki yüzü, µ → balata sürtünme katsayısı (sinter, 0,4),
// x → kaliper baskı merkezinin flanş dış kenarından içeri mesafesi (modele
// özgü, katalogdaki tork bağıntısından okunur).
//
// Kaynak: SIBRE Siegerland-Bremsen — Caliper Brake SHI / SHI-FC kataloğu.

/** Ayarlanabilir hava aralığı c [mm] — sıkma kuvveti bu ayara göre değişir. */
export type AirGapMm = 1 | 2 | 3;

export interface SafetyBrakeModel {
  /** Katalog tipi, ör. "SHI 105" */
  code: string;
  /**
   * Sıkma kuvveti FA [kN], hava aralığına göre. SHI 231/232 yalnız 2–3 mm
   * aralığında çalışır; c = 1 mm için değer YOKTUR (undefined).
   */
  clampKn: Partial<Record<AirGapMm, number>>;
  /** Tork bağıntısındaki x ölçüsü [mm] — M = 2·FA·µ·(d/2 − x) */
  leverXMm: number;
  /** Katalogun izin verdiği en küçük disk (flanş) dış çapı [mm] */
  minDiscDiaMm: number;
  /**
   * Diskin göbek/tambur çapına göre gerekli fazlası [mm]:
   * katalog `d1 = d − Δ` (d1 = azami göbek/tambur çapı) biçiminde verir.
   * Flanş, tambur çapından en az bu kadar büyük olmalıdır.
   */
  discOverDrumMm: number;
  /** En küçük disk kalınlığı b [mm] */
  minDiscThicknessMm: number;
  /** Açma basıncı PL [bar] — hidrolik ünite seçimi için */
  releasePressureBar: number;
}

/** Balata sürtünme katsayısı µ — sinter balata, çevresel hız ≤ 15 m/s. */
export const SAFETY_BRAKE_FRICTION = 0.4;

/**
 * SIBRE SHI kaliper fren serisi. Değerler katalogdaki "Clamping Force FA",
 * "Torque Calculation" ve "Brake Discs" bloklarından birebir alınmıştır.
 */
export const SAFETY_BRAKES: SafetyBrakeModel[] = [
  // --- SHI 75 serisi: x = 42,5 · d ≥ 400 · d1 = d − 230 · b ≥ 20
  { code: "SHI 75-1", clampKn: { 1: 18.3, 2: 17.9, 3: 17.6 }, leverXMm: 42.5, minDiscDiaMm: 400, discOverDrumMm: 230, minDiscThicknessMm: 20, releasePressureBar: 45 },
  { code: "SHI 75-2", clampKn: { 1: 22.4, 2: 20.7, 3: 19.0 }, leverXMm: 42.5, minDiscDiaMm: 400, discOverDrumMm: 230, minDiscThicknessMm: 20, releasePressureBar: 55 },
  { code: "SHI 75-3", clampKn: { 1: 25.4, 2: 23.9, 3: 22.4 }, leverXMm: 42.5, minDiscDiaMm: 400, discOverDrumMm: 230, minDiscThicknessMm: 20, releasePressureBar: 65 },
  { code: "SHI 75-4", clampKn: { 1: 30.6, 2: 27.6, 3: 24.6 }, leverXMm: 42.5, minDiscDiaMm: 400, discOverDrumMm: 230, minDiscThicknessMm: 20, releasePressureBar: 80 },
  { code: "SHI 75-5", clampKn: { 1: 44.5, 2: 41.0, 3: 37.0 }, leverXMm: 42.5, minDiscDiaMm: 400, discOverDrumMm: 230, minDiscThicknessMm: 20, releasePressureBar: 120 },
  { code: "SHI 75-6", clampKn: { 1: 49.8, 2: 47.3, 3: 44.4 }, leverXMm: 42.5, minDiscDiaMm: 400, discOverDrumMm: 230, minDiscThicknessMm: 20, releasePressureBar: 135 },
  // --- SHI 100 serisi: x = 60 · d ≥ 650 · d1 = d − 280 · b ≥ 20
  { code: "SHI 103", clampKn: { 1: 55.4, 2: 52.2, 3: 48.8 }, leverXMm: 60, minDiscDiaMm: 650, discOverDrumMm: 280, minDiscThicknessMm: 20, releasePressureBar: 60 },
  { code: "SHI 104", clampKn: { 1: 74.1, 2: 68.7, 3: 62.7 }, leverXMm: 60, minDiscDiaMm: 650, discOverDrumMm: 280, minDiscThicknessMm: 20, releasePressureBar: 80 },
  { code: "SHI 105", clampKn: { 1: 83.2, 2: 77.0, 3: 74.4 }, leverXMm: 60, minDiscDiaMm: 650, discOverDrumMm: 280, minDiscThicknessMm: 20, releasePressureBar: 95 },
  { code: "SHI 106", clampKn: { 1: 110, 2: 98, 3: 88 }, leverXMm: 60, minDiscDiaMm: 650, discOverDrumMm: 280, minDiscThicknessMm: 20, releasePressureBar: 145 },
  { code: "SHI 107", clampKn: { 1: 140, 2: 115, 3: 94 }, leverXMm: 60, minDiscDiaMm: 650, discOverDrumMm: 280, minDiscThicknessMm: 20, releasePressureBar: 175 },
  // --- SHI 160 serisi: x = 62,5 · d ≥ 900 · d1 = d − 325 · b ≥ 20
  { code: "SHI 161", clampKn: { 1: 108, 2: 98, 3: 88 }, leverXMm: 62.5, minDiscDiaMm: 900, discOverDrumMm: 325, minDiscThicknessMm: 20, releasePressureBar: 90 },
  { code: "SHI 162", clampKn: { 1: 190, 2: 160, 3: 128 }, leverXMm: 62.5, minDiscDiaMm: 900, discOverDrumMm: 325, minDiscThicknessMm: 20, releasePressureBar: 170 },
  // --- SHI 200 serisi: x = 60 · d ≥ 1100 · d1 = d − 360 · b ≥ 20
  { code: "SHI 201", clampKn: { 1: 170, 2: 160, 3: 150 }, leverXMm: 60, minDiscDiaMm: 1100, discOverDrumMm: 360, minDiscThicknessMm: 20, releasePressureBar: 115 },
  { code: "SHI 202", clampKn: { 1: 240, 2: 220, 3: 200 }, leverXMm: 60, minDiscDiaMm: 1100, discOverDrumMm: 360, minDiscThicknessMm: 20, releasePressureBar: 160 },
  // --- SHI 230 serisi: x = 95 · d ≥ 1100 · d1 = d − 440 · b ≥ 20 · YALNIZ c = 2…3 mm
  { code: "SHI 231", clampKn: { 2: 240, 3: 225 }, leverXMm: 95, minDiscDiaMm: 1100, discOverDrumMm: 440, minDiscThicknessMm: 20, releasePressureBar: 130 },
  { code: "SHI 232", clampKn: { 2: 300, 3: 270 }, leverXMm: 95, minDiscDiaMm: 1100, discOverDrumMm: 440, minDiscThicknessMm: 20, releasePressureBar: 170 },
  // --- SHI 250 serisi: x = 100 · d ≥ 1200 · d1 = d − 490 · b ≥ 20
  { code: "SHI 251", clampKn: { 1: 335, 2: 302, 3: 270 }, leverXMm: 100, minDiscDiaMm: 1200, discOverDrumMm: 490, minDiscThicknessMm: 20, releasePressureBar: 105 },
  { code: "SHI 252", clampKn: { 1: 440, 2: 400, 3: 360 }, leverXMm: 100, minDiscDiaMm: 1200, discOverDrumMm: 490, minDiscThicknessMm: 20, releasePressureBar: 140 },
  // --- SHI 280 serisi: x = 112,5 · d ≥ 1600 · d1 = d − 545 · b ≥ 30
  { code: "SHI 281", clampKn: { 1: 455, 2: 425, 3: 395 }, leverXMm: 112.5, minDiscDiaMm: 1600, discOverDrumMm: 545, minDiscThicknessMm: 30, releasePressureBar: 135 },
  { code: "SHI 282", clampKn: { 1: 555, 2: 510, 3: 465 }, leverXMm: 112.5, minDiscDiaMm: 1600, discOverDrumMm: 545, minDiscThicknessMm: 30, releasePressureBar: 165 },
];

export const SAFETY_BRAKE_CODES = SAFETY_BRAKES.map((b) => b.code);

export function safetyBrakeByCode(code: string | undefined): SafetyBrakeModel | undefined {
  return SAFETY_BRAKES.find((b) => b.code === code);
}

/** Seçilen modelin verilen hava aralığındaki sıkma kuvveti [kN]. */
export function clampForceKn(
  model: SafetyBrakeModel | undefined,
  airGapMm: number
): number | undefined {
  if (!model) return undefined;
  const gap = Math.round(airGapMm) as AirGapMm;
  return model.clampKn[gap];
}

// Tamburun tutması gereken moment AYRICA HESAPLANMAZ: kaldırma modülü zaten
// tambur torkunu üretiyor —
//     M_tambur = (d/2) · n_tahrik · F_halat / n_tambur
// ve halat kuvveti F_halat halat donanımı verimini içeriyor. Emniyet freni
// hesabı bu değeri (`drum.torquePerDrum`) doğrudan okur; aynı fizik ikinci kez
// yazılırsa iki sonuç zamanla ayrışır.

/**
 * Bir kaliperin sağladığı frenleme momenti [Nm].
 *
 *     M_fren = 2 · FA · µ · (d_flanş/2 − x)
 *
 * FA [N], çaplar [mm] → sonuç [Nm] için milimetre metreye çevrilir.
 */
export function brakeTorqueNm(p: {
  clampForceN: number;
  frictionCoeff: number;
  flangeDiaMm: number;
  leverXMm: number;
}): number {
  const radiusMm = p.flangeDiaMm / 2 - p.leverXMm;
  if (!(radiusMm > 0)) return 0;
  return (2 * p.clampForceN * p.frictionCoeff * radiusMm) / 1000;
}

/**
 * Flanş (fren diski) dış çapı için katalogdan doğan alt sınır [mm].
 *
 * İki koşul birlikte sağlanmalıdır:
 *   1. d ≥ katalogun en küçük disk çapı,
 *   2. d ≥ tambur çapı + Δ   (Δ = katalogdaki d − d1 farkı; kaliper gövdesinin
 *      tambur gövdesine çarpmadan oturabilmesi için gereken radyal pay).
 * Mühendisin eklediği montaj payı bunun üstüne biner.
 */
export function minFlangeDiaMm(p: {
  model: SafetyBrakeModel | undefined;
  drumDiaMm: number;
  clearanceMm: number;
}): number {
  if (!p.model) return Number.NaN;
  const geometric = p.drumDiaMm + p.model.discOverDrumMm;
  return Math.max(p.model.minDiscDiaMm, geometric) + Math.max(0, p.clearanceMm);
}

/**
 * Tambur üzerindeki fren yerleşim düzenleri. Atölye montaj çizimindeki altı
 * standart düzenle birebir eşleşir: fren adedi ve konsol tipi birlikte seçilir.
 */
export const BRAKE_ARRANGEMENTS = [
  "1 · Tek fren — alt konsol",
  "2 · Çift fren — karşılıklı alt konsol",
  "3 · Tek fren — yatay eksen",
  "4 · Çift fren — yatay eksen",
  "5 · Çift fren — tek taraflı yüksek konsol",
  "6 · Dört fren — çift taraflı yüksek konsol",
] as const;

export type BrakeArrangement = (typeof BRAKE_ARRANGEMENTS)[number];

/** Düzenin içerdiği kaliper adedi — etiketin başındaki numaradan çözülür. */
export function brakesInArrangement(a: string | undefined): number {
  switch ((a ?? "").trim().charAt(0)) {
    case "1":
    case "3":
      return 1;
    case "2":
    case "4":
    case "5":
      return 2;
    case "6":
      return 4;
    default:
      return 1;
  }
}
