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

/**
 * Ayarlanabilir FREN BOŞLUĞU c [mm] (katalogda "air gap") — balata ile disk
 * arasındaki ayar boşluğu. Boşluk büyüdükçe yay sıkma kuvveti FA DÜŞER.
 */
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
  /** Azami çalışma basıncı Pmax [bar] — hidrolik ünitenin emniyet valfi sınırı */
  maxPressureBar: number;
  /**
   * c = 2,0 mm boşlukta bir kaliperin yuttuğu yağ hacmi Vmax [litre].
   * Hidrolik ünitenin depo ve pompa debisi bu hacimle ölçeklenir.
   */
  volumeLitre: number;
}

/** Balata sürtünme katsayısı µ — sinter balata, çevresel hız ≤ 15 m/s. */
export const SAFETY_BRAKE_FRICTION = 0.4;

/**
 * SIBRE SHI kaliper fren serisi. Değerler katalogdaki "Clamping Force FA",
 * "Torque Calculation" ve "Brake Discs" bloklarından birebir alınmıştır.
 */
export const SAFETY_BRAKES: SafetyBrakeModel[] = [
  // --- SHI 75 serisi: x = 42,5 · d ≥ 400 · d1 = d − 230 · b ≥ 20
  { code: "SHI 75-1", clampKn: { 1: 18.3, 2: 17.9, 3: 17.6 }, leverXMm: 42.5, minDiscDiaMm: 400, discOverDrumMm: 230, minDiscThicknessMm: 20, releasePressureBar: 45, maxPressureBar: 85, volumeLitre: 0.032 },
  { code: "SHI 75-2", clampKn: { 1: 22.4, 2: 20.7, 3: 19.0 }, leverXMm: 42.5, minDiscDiaMm: 400, discOverDrumMm: 230, minDiscThicknessMm: 20, releasePressureBar: 55, maxPressureBar: 85, volumeLitre: 0.032 },
  { code: "SHI 75-3", clampKn: { 1: 25.4, 2: 23.9, 3: 22.4 }, leverXMm: 42.5, minDiscDiaMm: 400, discOverDrumMm: 230, minDiscThicknessMm: 20, releasePressureBar: 65, maxPressureBar: 110, volumeLitre: 0.032 },
  { code: "SHI 75-4", clampKn: { 1: 30.6, 2: 27.6, 3: 24.6 }, leverXMm: 42.5, minDiscDiaMm: 400, discOverDrumMm: 230, minDiscThicknessMm: 20, releasePressureBar: 80, maxPressureBar: 110, volumeLitre: 0.032 },
  { code: "SHI 75-5", clampKn: { 1: 44.5, 2: 41.0, 3: 37.0 }, leverXMm: 42.5, minDiscDiaMm: 400, discOverDrumMm: 230, minDiscThicknessMm: 20, releasePressureBar: 120, maxPressureBar: 150, volumeLitre: 0.032 },
  { code: "SHI 75-6", clampKn: { 1: 49.8, 2: 47.3, 3: 44.4 }, leverXMm: 42.5, minDiscDiaMm: 400, discOverDrumMm: 230, minDiscThicknessMm: 20, releasePressureBar: 135, maxPressureBar: 175, volumeLitre: 0.032 },
  // --- SHI 100 serisi: x = 60 · d ≥ 650 · d1 = d − 280 · b ≥ 20
  { code: "SHI 103", clampKn: { 1: 55.4, 2: 52.2, 3: 48.8 }, leverXMm: 60, minDiscDiaMm: 650, discOverDrumMm: 280, minDiscThicknessMm: 20, releasePressureBar: 60, maxPressureBar: 110, volumeLitre: 0.046 },
  { code: "SHI 104", clampKn: { 1: 74.1, 2: 68.7, 3: 62.7 }, leverXMm: 60, minDiscDiaMm: 650, discOverDrumMm: 280, minDiscThicknessMm: 20, releasePressureBar: 80, maxPressureBar: 110, volumeLitre: 0.046 },
  { code: "SHI 105", clampKn: { 1: 83.2, 2: 77.0, 3: 74.4 }, leverXMm: 60, minDiscDiaMm: 650, discOverDrumMm: 280, minDiscThicknessMm: 20, releasePressureBar: 95, maxPressureBar: 150, volumeLitre: 0.046 },
  { code: "SHI 106", clampKn: { 1: 110, 2: 98, 3: 88 }, leverXMm: 60, minDiscDiaMm: 650, discOverDrumMm: 280, minDiscThicknessMm: 20, releasePressureBar: 145, maxPressureBar: 175, volumeLitre: 0.046 },
  { code: "SHI 107", clampKn: { 1: 140, 2: 115, 3: 94 }, leverXMm: 60, minDiscDiaMm: 650, discOverDrumMm: 280, minDiscThicknessMm: 20, releasePressureBar: 175, maxPressureBar: 205, volumeLitre: 0.046 },
  // --- SHI 160 serisi: x = 62,5 · d ≥ 900 · d1 = d − 325 · b ≥ 20
  { code: "SHI 161", clampKn: { 1: 108, 2: 98, 3: 88 }, leverXMm: 62.5, minDiscDiaMm: 900, discOverDrumMm: 325, minDiscThicknessMm: 20, releasePressureBar: 90, maxPressureBar: 150, volumeLitre: 0.046 },
  { code: "SHI 162", clampKn: { 1: 190, 2: 160, 3: 128 }, leverXMm: 62.5, minDiscDiaMm: 900, discOverDrumMm: 325, minDiscThicknessMm: 20, releasePressureBar: 170, maxPressureBar: 205, volumeLitre: 0.046 },
  // --- SHI 200 serisi: x = 60 · d ≥ 1100 · d1 = d − 360 · b ≥ 20
  { code: "SHI 201", clampKn: { 1: 170, 2: 160, 3: 150 }, leverXMm: 60, minDiscDiaMm: 1100, discOverDrumMm: 360, minDiscThicknessMm: 20, releasePressureBar: 115, maxPressureBar: 150, volumeLitre: 0.071 },
  { code: "SHI 202", clampKn: { 1: 240, 2: 220, 3: 200 }, leverXMm: 60, minDiscDiaMm: 1100, discOverDrumMm: 360, minDiscThicknessMm: 20, releasePressureBar: 160, maxPressureBar: 205, volumeLitre: 0.071 },
  // --- SHI 230 serisi: x = 95 · d ≥ 1100 · d1 = d − 440 · b ≥ 20 · YALNIZ c = 2…3 mm
  { code: "SHI 231", clampKn: { 2: 240, 3: 225 }, leverXMm: 95, minDiscDiaMm: 1100, discOverDrumMm: 440, minDiscThicknessMm: 20, releasePressureBar: 130, maxPressureBar: 175, volumeLitre: 0.071 },
  { code: "SHI 232", clampKn: { 2: 300, 3: 270 }, leverXMm: 95, minDiscDiaMm: 1100, discOverDrumMm: 440, minDiscThicknessMm: 20, releasePressureBar: 170, maxPressureBar: 205, volumeLitre: 0.071 },
  // --- SHI 250 serisi: x = 100 · d ≥ 1200 · d1 = d − 490 · b ≥ 20
  { code: "SHI 251", clampKn: { 1: 335, 2: 302, 3: 270 }, leverXMm: 100, minDiscDiaMm: 1200, discOverDrumMm: 490, minDiscThicknessMm: 20, releasePressureBar: 105, maxPressureBar: 150, volumeLitre: 0.142 },
  { code: "SHI 252", clampKn: { 1: 440, 2: 400, 3: 360 }, leverXMm: 100, minDiscDiaMm: 1200, discOverDrumMm: 490, minDiscThicknessMm: 20, releasePressureBar: 140, maxPressureBar: 175, volumeLitre: 0.142 },
  // --- SHI 280 serisi: x = 112,5 · d ≥ 1600 · d1 = d − 545 · b ≥ 30
  { code: "SHI 281", clampKn: { 1: 455, 2: 425, 3: 395 }, leverXMm: 112.5, minDiscDiaMm: 1600, discOverDrumMm: 545, minDiscThicknessMm: 30, releasePressureBar: 135, maxPressureBar: 175, volumeLitre: 0.142 },
  { code: "SHI 282", clampKn: { 1: 555, 2: 510, 3: 465 }, leverXMm: 112.5, minDiscDiaMm: 1600, discOverDrumMm: 545, minDiscThicknessMm: 30, releasePressureBar: 165, maxPressureBar: 205, volumeLitre: 0.142 },
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
 * Tambur üzerindeki fren yerleşim düzenleri.
 *
 * Düzenler HARFLE kodlanır (A…F): rakam kullanılırsa etiket "1 · Tek fren"
 * biçiminde okunur ve o baştaki 1 kaliper ADEDİYLE karıştırılır — "4 · Çift
 * fren" düzeninde dört değil iki kaliper vardır. Harf, düzen kimliğini adetten
 * ayırır.
 *
 * `angles` kaliperlerin tambur çevresindeki açısal konumudur [derece];
 * 0° sağ, 90° yukarı, saat yönünün tersine artar. Şema bu açıları doğrudan
 * çizer, dolayısıyla düzen değiştiğinde konumlar da GERÇEKTEN değişir.
 */
export interface BrakeArrangementDef {
  /** Düzen kodu — A…F */
  code: string;
  /** Açılır listede görünen tam etiket */
  label: string;
  /** Kaliperlerin açısal konumları [derece] */
  angles: number[];
}

export const BRAKE_ARRANGEMENT_DEFS: BrakeArrangementDef[] = [
  // Alt konsol: kaliper tamburun altına, düşey eksene yakın oturur.
  { code: "A", label: "A · Tek fren — alt konsol", angles: [270] },
  { code: "B", label: "B · Çift fren — karşılıklı alt konsol", angles: [225, 315] },
  // Yatay eksen: kaliper tamburun yanına gelir (montaj payı yanaldır).
  { code: "C", label: "C · Tek fren — yatay eksen", angles: [180] },
  { code: "D", label: "D · Çift fren — yatay eksen", angles: [0, 180] },
  // Tek taraflı yüksek konsol: iki kaliper aynı yanda, üst ve alt çeyrekte.
  { code: "E", label: "E · Çift fren — tek taraflı yüksek konsol", angles: [150, 210] },
  // Çift taraflı yüksek konsol: dört kaliper, çapraz simetrik.
  { code: "F", label: "F · Dört fren — çift taraflı yüksek konsol", angles: [45, 135, 225, 315] },
];

export const BRAKE_ARRANGEMENTS = BRAKE_ARRANGEMENT_DEFS.map((a) => a.label);

export type BrakeArrangement = (typeof BRAKE_ARRANGEMENTS)[number];

/**
 * Etiketten düzen tanımını çözer. Eski revizyonlar rakamlı etiketleri
 * ("2 · Çift fren — karşılıklı alt konsol") taşır; sıra aynı olduğu için
 * baştaki rakam da harfe eşlenir ve kayıtlar bozulmaz.
 */
export function brakeArrangementOf(value: string | undefined): BrakeArrangementDef {
  const raw = (value ?? "").trim();
  const exact = BRAKE_ARRANGEMENT_DEFS.find((a) => a.label === raw);
  if (exact) return exact;
  // Yalnız GERÇEK bir düzen etiketinin baş harfi kabul edilir ("B · Çift…").
  // Baş harfe bakmak yetmez: "bilinmeyen" gibi serbest bir metin de B ile
  // başlar ve sessizce çift frenli düzene düşerdi.
  const m = /^([A-Fa-f1-6])\s*[·.\-)]/.exec(raw);
  if (!m) return BRAKE_ARRANGEMENT_DEFS[0];
  const head = m[1].toUpperCase();
  const byCode = BRAKE_ARRANGEMENT_DEFS.find((a) => a.code === head);
  if (byCode) return byCode;
  // Eski revizyonlar rakamlı etiket taşır ("2 · Çift fren — …"); sıra aynıdır.
  const legacyIndex = "123456".indexOf(head);
  return legacyIndex >= 0 ? BRAKE_ARRANGEMENT_DEFS[legacyIndex] : BRAKE_ARRANGEMENT_DEFS[0];
}

/** Düzenin içerdiği kaliper adedi. */
export function brakesInArrangement(a: string | undefined): number {
  return brakeArrangementOf(a).angles.length;
}

// ------------------------------------------------------- hidrolik güç ünitesi

/**
 * SIBRE hidrolik güç ünitesi (HPU). Kaliper fren YAYLA KAPANIR, hidrolikle
 * AÇILIR: ünite basıncı kesildiği anda fren devreye girer. Bu yüzden ünite
 * frenin açma basıncını (PL) sağlamalı ve emniyet valfi ayarı frenin azami
 * basıncını (Pmax) AŞMAMALIDIR.
 *
 * İki seri vardır ve seçim ÇEVRİM SAYISINA göre yapılır (katalog "HPU
 * SELECTION GUIDE", M 1501 … EN-2017-12):
 *   · V2   — kompakt ünite, ≤ 50 çevrim/saat. Katalog dipnotu: bir V2 ünitesine
 *            EN ÇOK İKİ fren bağlanması önerilir.
 *   · H-SF 3 (V3) — büyük ünite, yüksek çevrim; 30 l depo, 3 kW motor.
 */
export interface HydraulicUnit {
  /** Sipariş kodu, ör. "V2.1-B" */
  code: string;
  /** Seri: kompakt V2 ya da H-SF 3 (V3) */
  series: "V2" | "H-SF 3";
  /** Açma basıncı [bar] — frenin PL değerini karşılamalıdır */
  releasePressureBar: number;
  /** Emniyet (basınç tahliye) valfi ayarı [bar] */
  reliefValveBar: number;
  /** Basınç şalteri alt/üst ayarı [bar] */
  switchMinBar: number;
  switchMaxBar: number;
  /** Pompa debisi [l/dak] */
  pumpLpm: number;
  /** Motor gücü [kW] */
  motorKw: number;
  /** Depo hacmi [litre] */
  tankLitre: number;
  /** Katalogun verdiği azami çevrim sayısı [çevrim/saat] */
  maxCyclesPerHour: number;
  /** Bir üniteye bağlanabilecek en çok fren adedi (katalog önerisi) */
  maxBrakes: number;
}

export const HYDRAULIC_UNITS: HydraulicUnit[] = [
  // V2 — katalog s.66-67 teknik tablosu (depo 4 l, ağırlık ~15 kg, 50 çevrim/s)
  { code: "V2.1-E", series: "V2", releasePressureBar: 55, reliefValveBar: 85, switchMinBar: 55, switchMaxBar: 70, pumpLpm: 9.0, motorKw: 1.5, tankLitre: 4, maxCyclesPerHour: 50, maxBrakes: 2 },
  { code: "V2.1-A", series: "V2", releasePressureBar: 80, reliefValveBar: 110, switchMinBar: 80, switchMaxBar: 95, pumpLpm: 9.0, motorKw: 1.5, tankLitre: 4, maxCyclesPerHour: 50, maxBrakes: 2 },
  { code: "V2.1-B", series: "V2", releasePressureBar: 120, reliefValveBar: 150, switchMinBar: 120, switchMaxBar: 135, pumpLpm: 7.2, motorKw: 1.5, tankLitre: 4, maxCyclesPerHour: 50, maxBrakes: 2 },
  { code: "V2.1-D", series: "V2", releasePressureBar: 145, reliefValveBar: 175, switchMinBar: 145, switchMaxBar: 160, pumpLpm: 5.8, motorKw: 1.5, tankLitre: 4, maxCyclesPerHour: 50, maxBrakes: 2 },
  { code: "V2.1-C", series: "V2", releasePressureBar: 175, reliefValveBar: 205, switchMinBar: 175, switchMaxBar: 190, pumpLpm: 5.8, motorKw: 1.5, tankLitre: 4, maxCyclesPerHour: 50, maxBrakes: 2 },
  // H-SF 3 (V3) — katalog s.68-69 (depo 30 l, motor 3 kW, 90 çevrim/s)
  { code: "V3-E", series: "H-SF 3", releasePressureBar: 55, reliefValveBar: 85, switchMinBar: 55, switchMaxBar: 70, pumpLpm: 20, motorKw: 3, tankLitre: 30, maxCyclesPerHour: 90, maxBrakes: 4 },
  { code: "V3-A", series: "H-SF 3", releasePressureBar: 80, reliefValveBar: 110, switchMinBar: 80, switchMaxBar: 95, pumpLpm: 20, motorKw: 3, tankLitre: 30, maxCyclesPerHour: 90, maxBrakes: 4 },
  { code: "V3-B", series: "H-SF 3", releasePressureBar: 120, reliefValveBar: 150, switchMinBar: 120, switchMaxBar: 135, pumpLpm: 13, motorKw: 3, tankLitre: 30, maxCyclesPerHour: 90, maxBrakes: 4 },
  { code: "V3-D", series: "H-SF 3", releasePressureBar: 145, reliefValveBar: 175, switchMinBar: 145, switchMaxBar: 160, pumpLpm: 9, motorKw: 3, tankLitre: 30, maxCyclesPerHour: 90, maxBrakes: 4 },
  { code: "V3-C", series: "H-SF 3", releasePressureBar: 175, reliefValveBar: 205, switchMinBar: 175, switchMaxBar: 190, pumpLpm: 9, motorKw: 3, tankLitre: 30, maxCyclesPerHour: 90, maxBrakes: 4 },
];

export const HYDRAULIC_UNIT_CODES = HYDRAULIC_UNITS.map((u) => u.code);

export function hydraulicUnitByCode(code: string | undefined): HydraulicUnit | undefined {
  return HYDRAULIC_UNITS.find((u) => u.code === code);
}

/**
 * Katalogun HPU SELECTION GUIDE tablosu: fren tipi → önerilen ünite.
 * Sol sütun V2 (≤ 50 çevrim/saat), sağ sütun V3 (yüksek çevrim). Basınç
 * kademeleri aynı olduğundan tek harf iki seriyi de belirler.
 */
const HPU_GUIDE: Record<string, string> = {
  "SHI 75-1": "E", "SHI 75-2": "E", "SHI 75-3": "A", "SHI 75-4": "A",
  "SHI 75-5": "B", "SHI 75-6": "D",
  "SHI 103": "A", "SHI 104": "A", "SHI 105": "B", "SHI 106": "D", "SHI 107": "C",
  "SHI 161": "B", "SHI 162": "C",
  "SHI 201": "B", "SHI 202": "C",
  "SHI 231": "D", "SHI 232": "C",
  "SHI 251": "B", "SHI 252": "D",
  "SHI 281": "D", "SHI 282": "C",
};

/**
 * Frene uygun hidrolik üniteyi katalog tablosundan seçer.
 *
 * Seri, KALİPER ADEDİNE göre belirlenir: katalog bir V2 ünitesine en çok iki
 * fren bağlanmasını önerir, dolayısıyla üç ve daha çok kaliperli düzenlerde
 * H-SF 3 (V3) seçilir. Basınç kademesi her iki seride de aynı harfi taşır.
 */
export function recommendHydraulicUnit(
  brake: SafetyBrakeModel | undefined,
  brakeCount: number
): HydraulicUnit | undefined {
  if (!brake) return undefined;
  const letter = HPU_GUIDE[brake.code];
  if (!letter) return undefined;
  const series: HydraulicUnit["series"] = brakeCount > 2 ? "H-SF 3" : "V2";
  return HYDRAULIC_UNITS.find((u) => u.series === series && u.code.endsWith(`-${letter}`));
}
