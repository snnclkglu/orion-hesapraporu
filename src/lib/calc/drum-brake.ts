// Kasnak (tambur) freni — DIN 15435 ölçü ve ağırlık defteri.
//
// Kasnak frenleri DIN 15435 tasarımıdır: ölçü resminin harfleri (A…R, d) ve
// bağlantı ölçüleri STANDARDIN kendisinden gelir, markanın değil. Bu yüzden
// fren bölümünün başındaki şema tek bir üretici kataloğuna değil bu deftere
// bakar; katalogdan hangi marka seçilirse seçilsin aynı ölçü resmi çizilir.
//
// Sayılar SIBRE TE tablosundan alınmıştır (TE 2021_EN.pdf; aynı tablo
// 01_SIBRE_Brake-catalogue.pdf s.76-77'de de basılıdır) ve katalog verisiyle
// (`catalog_data/brakes/sibre_te_drum.json` → `cat_equipment`) BİREBİR aynıdır.
// AYNI SAYILARIN İKİ YERDE YAŞAMASI bilinçlidir ve bedeli bir koruma testiyle
// ödenir (değişmez md. 8): çekirdek SAFTIR, veritabanına bakamaz — şema ise
// hesap motorunun içinden, seçim alanlarından çizilir.
// `__tests__/drum-brake.test.ts` seed migration'ını OKUYARAK iki kopyanın
// ayrışmadığını sınar.
//
// ÖLÇÜLERİN İKİ SINIFI VARDIR:
//   · A · B · H  → İTİCİ boyuna göre değişir (iticinin gövdesi ve kolu),
//   · C · E · F · G · J · K · L · M · N · P · Q · R · d → fren BOYUNUN ortak
//     ölçüsüdür; aynı kasnak çapındaki bütün itici seçeneklerinde aynıdır.
// D ayrıca saklanmaz: DIN 15435'te tip numarası KASNAK ÇAPIDIR (TE 315 → Ø315),
// yani `drumDiaMm` alanının kendisidir.
//
// AĞIRLIK İKİ PARÇADIR. Katalogun kg* sütunu İTİCİ HARİÇTİR (tablonun kendi
// dipnotu: "kg without thruster"); itici ağırlığı üreticinin Eldro teknik
// değerler tablosundan gelir. Mühendisin istediği sayı ikisinin TOPLAMIDIR —
// TE 315/50/6 → 50 + 23 = 73 kg. Katalog Ed 50 / Ed 80 / Ed 301 için ağırlığı
// ARALIK verir (strok 60-120 / 60-120 / 60-150 mm arasında değiştiği için);
// TE frenlerinde kullanılan tipler en kısa strokludur (60 mm) ve ALT SINIR
// alınmıştır, üst sınır `…MaxKg` alanlarında durur ve ekranda aralık olarak
// gösterilir. Uydurma tek sayı yazılmaz (değişmez md. 4).
//
// EB (hidrolik) iticiler defterde YOKTUR: firma Ed tipini kullanır.
// TE 160 de YOKTUR — o AYRI bir ölçü resmidir (M1501 293 E-EN-2020-01, kompakt
// konsol tasarım): harfleri aynı anlamı taşımaz ve katalog yalnız A/B/C/H
// yayımlar. Ölçüsü bilinmeyen bir fren için şema çizilmez; yanlış ölçü resmi
// göstermek hiç göstermemekten kötüdür.

/** DIN 15435 ölçü resminin harfleri [mm]. */
export interface DrumBrakeDims {
  /** Toplam boy — itici dahil (üstteki ölçü zinciri) */
  a: number;
  /** Yandan görünüşte toplam genişlik (itici gövdesi) */
  b: number;
  /** Taban plakası boyu */
  c: number;
  /** Sol kol mesnedinden kasnak eksenine */
  e: number;
  /** Alttan görünüşte pabuç takımı genişliği */
  f: number;
  /** Taban delik aralığı — uzunlamasına */
  g: number;
  /** Toplam yükseklik — itici dahil */
  h: number;
  /** Taban plakası kalınlık kotu (alt yüzeyden mesnet eksenine) */
  j: number;
  /** Alttan görünüşte pabuç genişliği (iki adet) */
  k: number;
  /** Kasnak ekseninin taban üstünden yüksekliği */
  l: number;
  /** Yandan görünüşte taban delik aralığı — enine */
  m: number;
  /** Taban plakası kalınlığı */
  n: number;
  /** Alttan görünüşte pabuç mesnet aralığı */
  p: number;
  /** Alttan görünüşte pabuç astar genişliği */
  q: number;
  /** Yandan görünüşte taban plakası genişliği */
  r: number;
  /** Bağlantı cıvatası delik çapı Ø d */
  boreD: number;
}

/** Bir kasnak freni boyu + itici birleşimi. */
export interface DrumBrakeSpec {
  /** Üreticinin sipariş kodu — "TE315/50/6" */
  model: string;
  /** Kasnak çapı = DIN 15435 tip numarası [mm] */
  drumDiaMm: number;
  /** İtici (Eldro) tip kodu — "Ed 50/6" */
  thruster: string;
  /** Ayar aralığının alt ucu [Nm] (µ = 0,4) */
  minTorqueNm: number;
  /** Ayar aralığının üst ucu [Nm] (µ = 0,4) */
  maxTorqueNm: number;
  /** Katalogun kg* değeri — İTİCİ HARİÇ [kg] */
  brakeWeightKg: number;
  /** İtici ağırlığı [kg] — aralıklıysa ALT sınır */
  thrusterWeightKg: number;
  /** İtici ağırlığının üst sınırı [kg] — katalog aralık veriyorsa */
  thrusterWeightMaxKg?: number;
  /** Fren + itici [kg] */
  totalWeightKg: number;
  /** Fren + iticinin üst sınırı [kg] — katalog aralık veriyorsa */
  totalWeightMaxKg?: number;
  /** İticinin kaldırma kuvveti [N] */
  thrusterForceN: number;
  /** İtici stroku [mm] */
  thrusterStrokeMm: number;
  /** İtici gücü [W] */
  thrusterPowerW: number;
  /** 400 V / 50 Hz'te itici akımı [A] */
  thrusterCurrentA: number;
  dims: DrumBrakeDims;
}

/**
 * TE 200…710 — DIN 15435 kasnak frenleri.
 *
 * ÜRETİLMİŞ TABLODUR: `catalog_data/brakes/sibre_te_drum.json`tan çıkarılır,
 * elle düzenlenmez. Katalog değişirse tablo yeniden üretilir ve koruma testi
 * ayrışmayı yakalar.
 */
export const DRUM_BRAKES: readonly DrumBrakeSpec[] = [
  {
    model: "TE200/23/5",
    drumDiaMm: 200,
    thruster: "Ed 23/5",
    minTorqueNm: 50,
    maxTorqueNm: 300,
    brakeWeightKg: 19,
    thrusterWeightKg: 10,
    totalWeightKg: 29,
    thrusterForceN: 220,
    thrusterStrokeMm: 50,
    thrusterPowerW: 165,
    thrusterCurrentA: 0.5,
    dims: { a: 640, b: 160, c: 515, e: 170, f: 90, g: 160, h: 475, j: 55, k: 145, l: 160, m: 115, n: 10, p: 75, q: 70, r: 96, boreD: 14 },
  },
  {
    model: "TE200/30/5",
    drumDiaMm: 200,
    thruster: "Ed 30/5",
    minTorqueNm: 85,
    maxTorqueNm: 400,
    brakeWeightKg: 19,
    thrusterWeightKg: 14,
    totalWeightKg: 33,
    thrusterForceN: 300,
    thrusterStrokeMm: 50,
    thrusterPowerW: 200,
    thrusterCurrentA: 0.5,
    dims: { a: 640, b: 160, c: 515, e: 170, f: 90, g: 160, h: 475, j: 55, k: 145, l: 160, m: 115, n: 10, p: 75, q: 70, r: 96, boreD: 14 },
  },
  {
    model: "TE250/23/5",
    drumDiaMm: 250,
    thruster: "Ed 23/5",
    minTorqueNm: 40,
    maxTorqueNm: 325,
    brakeWeightKg: 30,
    thrusterWeightKg: 10,
    totalWeightKg: 40,
    thrusterForceN: 220,
    thrusterStrokeMm: 50,
    thrusterPowerW: 165,
    thrusterCurrentA: 0.5,
    dims: { a: 760, b: 160, c: 625, e: 210, f: 110, g: 200, h: 550, j: 65, k: 180, l: 190, m: 133, n: 10, p: 95, q: 90, r: 113, boreD: 18 },
  },
  {
    model: "TE250/30/5",
    drumDiaMm: 250,
    thruster: "Ed 30/5",
    minTorqueNm: 40,
    maxTorqueNm: 450,
    brakeWeightKg: 30,
    thrusterWeightKg: 14,
    totalWeightKg: 44,
    thrusterForceN: 300,
    thrusterStrokeMm: 50,
    thrusterPowerW: 200,
    thrusterCurrentA: 0.5,
    dims: { a: 760, b: 160, c: 625, e: 210, f: 110, g: 200, h: 550, j: 65, k: 180, l: 190, m: 133, n: 10, p: 95, q: 90, r: 113, boreD: 18 },
  },
  {
    model: "TE250/50/6",
    drumDiaMm: 250,
    thruster: "Ed 50/6",
    minTorqueNm: 100,
    maxTorqueNm: 850,
    brakeWeightKg: 30,
    thrusterWeightKg: 23,
    thrusterWeightMaxKg: 26,
    totalWeightKg: 53,
    totalWeightMaxKg: 56,
    thrusterForceN: 500,
    thrusterStrokeMm: 60,
    thrusterPowerW: 210,
    thrusterCurrentA: 0.5,
    dims: { a: 800, b: 195, c: 625, e: 210, f: 110, g: 200, h: 560, j: 65, k: 180, l: 190, m: 133, n: 10, p: 95, q: 90, r: 113, boreD: 18 },
  },
  {
    model: "TE315/23/5",
    drumDiaMm: 315,
    thruster: "Ed 23/5",
    minTorqueNm: 70,
    maxTorqueNm: 420,
    brakeWeightKg: 50,
    thrusterWeightKg: 10,
    totalWeightKg: 60,
    thrusterForceN: 220,
    thrusterStrokeMm: 50,
    thrusterPowerW: 165,
    thrusterCurrentA: 0.5,
    dims: { a: 885, b: 160, c: 735, e: 260, f: 125, g: 240, h: 650, j: 80, k: 220, l: 230, m: 160, n: 10, p: 118, q: 110, r: 135, boreD: 18 },
  },
  {
    model: "TE315/30/5",
    drumDiaMm: 315,
    thruster: "Ed 30/5",
    minTorqueNm: 70,
    maxTorqueNm: 550,
    brakeWeightKg: 50,
    thrusterWeightKg: 14,
    totalWeightKg: 64,
    thrusterForceN: 300,
    thrusterStrokeMm: 50,
    thrusterPowerW: 200,
    thrusterCurrentA: 0.5,
    dims: { a: 885, b: 160, c: 735, e: 260, f: 125, g: 240, h: 650, j: 80, k: 220, l: 230, m: 160, n: 10, p: 118, q: 110, r: 135, boreD: 18 },
  },
  {
    model: "TE315/50/6",
    drumDiaMm: 315,
    thruster: "Ed 50/6",
    minTorqueNm: 75,
    maxTorqueNm: 1050,
    brakeWeightKg: 50,
    thrusterWeightKg: 23,
    thrusterWeightMaxKg: 26,
    totalWeightKg: 73,
    totalWeightMaxKg: 76,
    thrusterForceN: 500,
    thrusterStrokeMm: 60,
    thrusterPowerW: 210,
    thrusterCurrentA: 0.5,
    dims: { a: 925, b: 195, c: 735, e: 260, f: 125, g: 240, h: 660, j: 80, k: 220, l: 230, m: 160, n: 10, p: 118, q: 110, r: 135, boreD: 18 },
  },
  {
    model: "TE315/80/6",
    drumDiaMm: 315,
    thruster: "Ed 80/6",
    minTorqueNm: 90,
    maxTorqueNm: 1700,
    brakeWeightKg: 50,
    thrusterWeightKg: 24,
    thrusterWeightMaxKg: 27,
    totalWeightKg: 74,
    totalWeightMaxKg: 77,
    thrusterForceN: 800,
    thrusterStrokeMm: 60,
    thrusterPowerW: 330,
    thrusterCurrentA: 1.2,
    dims: { a: 925, b: 195, c: 735, e: 260, f: 125, g: 240, h: 660, j: 80, k: 220, l: 230, m: 160, n: 10, p: 118, q: 110, r: 135, boreD: 18 },
  },
  {
    model: "TE400/30/5",
    drumDiaMm: 400,
    thruster: "Ed 30/5",
    minTorqueNm: 80,
    maxTorqueNm: 575,
    brakeWeightKg: 85,
    thrusterWeightKg: 14,
    totalWeightKg: 99,
    thrusterForceN: 300,
    thrusterStrokeMm: 50,
    thrusterPowerW: 200,
    thrusterCurrentA: 0.5,
    dims: { a: 1030, b: 160, c: 900, e: 310, f: 160, g: 300, h: 765, j: 100, k: 270, l: 280, m: 199, n: 12, p: 150, q: 140, r: 167, boreD: 22 },
  },
  {
    model: "TE400/50/6",
    drumDiaMm: 400,
    thruster: "Ed 50/6",
    minTorqueNm: 100,
    maxTorqueNm: 1100,
    brakeWeightKg: 85,
    thrusterWeightKg: 23,
    thrusterWeightMaxKg: 26,
    totalWeightKg: 108,
    totalWeightMaxKg: 111,
    thrusterForceN: 500,
    thrusterStrokeMm: 60,
    thrusterPowerW: 210,
    thrusterCurrentA: 0.5,
    dims: { a: 1075, b: 195, c: 900, e: 310, f: 160, g: 300, h: 775, j: 100, k: 270, l: 280, m: 199, n: 12, p: 150, q: 140, r: 167, boreD: 22 },
  },
  {
    model: "TE400/80/6",
    drumDiaMm: 400,
    thruster: "Ed 80/6",
    minTorqueNm: 100,
    maxTorqueNm: 1800,
    brakeWeightKg: 85,
    thrusterWeightKg: 24,
    thrusterWeightMaxKg: 27,
    totalWeightKg: 109,
    totalWeightMaxKg: 112,
    thrusterForceN: 800,
    thrusterStrokeMm: 60,
    thrusterPowerW: 330,
    thrusterCurrentA: 1.2,
    dims: { a: 1075, b: 195, c: 900, e: 310, f: 160, g: 300, h: 775, j: 100, k: 270, l: 280, m: 199, n: 12, p: 150, q: 140, r: 167, boreD: 22 },
  },
  {
    model: "TE400/121/6",
    drumDiaMm: 400,
    thruster: "Ed 121/6",
    minTorqueNm: 125,
    maxTorqueNm: 2750,
    brakeWeightKg: 85,
    thrusterWeightKg: 39,
    totalWeightKg: 124,
    thrusterForceN: 1250,
    thrusterStrokeMm: 60,
    thrusterPowerW: 330,
    thrusterCurrentA: 1.2,
    dims: { a: 1075, b: 240, c: 900, e: 310, f: 160, g: 300, h: 775, j: 100, k: 270, l: 280, m: 199, n: 12, p: 150, q: 140, r: 167, boreD: 22 },
  },
  {
    model: "TE500/50/6",
    drumDiaMm: 500,
    thruster: "Ed 50/6",
    minTorqueNm: 200,
    maxTorqueNm: 1400,
    brakeWeightKg: 130,
    thrusterWeightKg: 23,
    thrusterWeightMaxKg: 26,
    totalWeightKg: 153,
    totalWeightMaxKg: 156,
    thrusterForceN: 500,
    thrusterStrokeMm: 60,
    thrusterPowerW: 210,
    thrusterCurrentA: 0.5,
    dims: { a: 1225, b: 195, c: 1025, e: 385, f: 190, g: 355, h: 870, j: 130, k: 325, l: 340, m: 242, n: 13, p: 190, q: 180, r: 202, boreD: 22 },
  },
  {
    model: "TE500/80/6",
    drumDiaMm: 500,
    thruster: "Ed 80/6",
    minTorqueNm: 200,
    maxTorqueNm: 2200,
    brakeWeightKg: 130,
    thrusterWeightKg: 24,
    thrusterWeightMaxKg: 27,
    totalWeightKg: 154,
    totalWeightMaxKg: 157,
    thrusterForceN: 800,
    thrusterStrokeMm: 60,
    thrusterPowerW: 330,
    thrusterCurrentA: 1.2,
    dims: { a: 1225, b: 195, c: 1025, e: 385, f: 190, g: 355, h: 870, j: 130, k: 325, l: 340, m: 242, n: 13, p: 190, q: 180, r: 202, boreD: 22 },
  },
  {
    model: "TE500/121/6",
    drumDiaMm: 500,
    thruster: "Ed 121/6",
    minTorqueNm: 200,
    maxTorqueNm: 3400,
    brakeWeightKg: 130,
    thrusterWeightKg: 39,
    totalWeightKg: 169,
    thrusterForceN: 1250,
    thrusterStrokeMm: 60,
    thrusterPowerW: 330,
    thrusterCurrentA: 1.2,
    dims: { a: 1215, b: 240, c: 1025, e: 385, f: 190, g: 355, h: 870, j: 130, k: 325, l: 340, m: 242, n: 13, p: 190, q: 180, r: 202, boreD: 22 },
  },
  {
    model: "TE500/201/6",
    drumDiaMm: 500,
    thruster: "Ed 201/6",
    minTorqueNm: 200,
    maxTorqueNm: 5400,
    brakeWeightKg: 130,
    thrusterWeightKg: 39,
    totalWeightKg: 169,
    thrusterForceN: 2000,
    thrusterStrokeMm: 60,
    thrusterPowerW: 450,
    thrusterCurrentA: 1.3,
    dims: { a: 1215, b: 240, c: 1025, e: 385, f: 190, g: 355, h: 870, j: 130, k: 325, l: 340, m: 242, n: 13, p: 190, q: 180, r: 202, boreD: 22 },
  },
  {
    model: "TE630/121/6",
    drumDiaMm: 630,
    thruster: "Ed 121/6",
    minTorqueNm: 500,
    maxTorqueNm: 3300,
    brakeWeightKg: 206,
    thrusterWeightKg: 39,
    totalWeightKg: 245,
    thrusterForceN: 1250,
    thrusterStrokeMm: 60,
    thrusterPowerW: 330,
    thrusterCurrentA: 1.2,
    dims: { a: 1365, b: 240, c: 1190, e: 465, f: 250, g: 440, h: 1000, j: 170, k: 400, l: 420, m: 295, n: 15, p: 236, q: 225, r: 244, boreD: 27 },
  },
  {
    model: "TE630/201/6",
    drumDiaMm: 630,
    thruster: "Ed 201/6",
    minTorqueNm: 500,
    maxTorqueNm: 5500,
    brakeWeightKg: 206,
    thrusterWeightKg: 39,
    totalWeightKg: 245,
    thrusterForceN: 2000,
    thrusterStrokeMm: 60,
    thrusterPowerW: 450,
    thrusterCurrentA: 1.3,
    dims: { a: 1365, b: 240, c: 1190, e: 465, f: 250, g: 440, h: 1000, j: 170, k: 400, l: 420, m: 295, n: 15, p: 236, q: 225, r: 244, boreD: 27 },
  },
  {
    model: "TE630/301/6",
    drumDiaMm: 630,
    thruster: "Ed 301/6",
    minTorqueNm: 500,
    maxTorqueNm: 8200,
    brakeWeightKg: 206,
    thrusterWeightKg: 40,
    thrusterWeightMaxKg: 50,
    totalWeightKg: 246,
    totalWeightMaxKg: 256,
    thrusterForceN: 3000,
    thrusterStrokeMm: 60,
    thrusterPowerW: 500,
    thrusterCurrentA: 1.4,
    dims: { a: 1365, b: 240, c: 1190, e: 465, f: 250, g: 440, h: 1000, j: 170, k: 400, l: 420, m: 295, n: 15, p: 236, q: 225, r: 244, boreD: 27 },
  },
  {
    model: "TE710/121/6",
    drumDiaMm: 710,
    thruster: "Ed 121/6",
    minTorqueNm: 500,
    maxTorqueNm: 3800,
    brakeWeightKg: 268,
    thrusterWeightKg: 39,
    totalWeightKg: 307,
    thrusterForceN: 1250,
    thrusterStrokeMm: 60,
    thrusterPowerW: 330,
    thrusterCurrentA: 1.2,
    dims: { a: 1500, b: 240, c: 1302, e: 525, f: 270, g: 490, h: 1100, j: 190, k: 450, l: 470, m: 332, n: 15, p: 265, q: 255, r: 276, boreD: 27 },
  },
  {
    model: "TE710/201/6",
    drumDiaMm: 710,
    thruster: "Ed 201/6",
    minTorqueNm: 500,
    maxTorqueNm: 6300,
    brakeWeightKg: 268,
    thrusterWeightKg: 39,
    totalWeightKg: 307,
    thrusterForceN: 2000,
    thrusterStrokeMm: 60,
    thrusterPowerW: 450,
    thrusterCurrentA: 1.3,
    dims: { a: 1500, b: 240, c: 1302, e: 525, f: 270, g: 490, h: 1100, j: 190, k: 450, l: 470, m: 332, n: 15, p: 265, q: 255, r: 276, boreD: 27 },
  },
  {
    model: "TE710/301/6",
    drumDiaMm: 710,
    thruster: "Ed 301/6",
    minTorqueNm: 500,
    maxTorqueNm: 9400,
    brakeWeightKg: 268,
    thrusterWeightKg: 40,
    thrusterWeightMaxKg: 50,
    totalWeightKg: 308,
    totalWeightMaxKg: 318,
    thrusterForceN: 3000,
    thrusterStrokeMm: 60,
    thrusterPowerW: 500,
    thrusterCurrentA: 1.4,
    dims: { a: 1500, b: 240, c: 1302, e: 525, f: 270, g: 490, h: 1100, j: 190, k: 450, l: 470, m: 332, n: 15, p: 265, q: 255, r: 276, boreD: 27 },
  },] as const;

/**
 * Model kodundan fren boyu + itici tipi.
 *
 * Aynı ürün üç yazımla karşımıza çıkar ve üçü de kabul edilir:
 *   · üreticinin sipariş düzeni  — "TE315/50/6"
 *   · eski revizyonların yazımı  — "TE 315 Ed 50/6" · "TE 315 50/6"
 *   · marka önekiyle             — "SIBRE TE250 Ed 50/6"
 * (Katalog sayfası defteri aynı üç yazımı `catalog-sheets.ts`te normalleştirir.)
 *
 * Yalnız ASCII harfler eşleştirilir; `i` bayrağı Türkçe ı/İ tuzağına düşmez
 * çünkü kalıpta yalnız T · E · D geçer.
 */
export function parseDrumBrakeModel(
  text: string | null | undefined
): { drumDiaMm: number; thruster: string } | null {
  if (!text) return null;
  const m = /\bTE\s*(\d{3})\s*[/\s]\s*(?:ED\s*)?(\d{2,3})\s*\/\s*(\d)\b/i.exec(text);
  if (!m) return null;
  return { drumDiaMm: Number(m[1]), thruster: `Ed ${m[2]}/${m[3]}` };
}

/**
 * Seçilen frenin ölçü/ağırlık kaydı — bulunamazsa `null`.
 *
 * `drumDiaMm` yalnız model kodu ÇÖZÜLEMEDİĞİNDE kullanılır ve tek başına
 * yetmez: A/B/H iticiye bağlıdır, itici bilinmeden şema çizilemez. Bu yüzden
 * kasnak çapı bilinip iticisi bilinmeyen bir fren `null` döner — eksik ölçülü
 * bir ölçü resmi, hiç resim olmamasından kötüdür.
 */
export function drumBrakeSpec(model: string | null | undefined): DrumBrakeSpec | null {
  const parsed = parseDrumBrakeModel(model);
  if (!parsed) return null;
  return (
    DRUM_BRAKES.find(
      (b) => b.drumDiaMm === parsed.drumDiaMm && b.thruster === parsed.thruster
    ) ?? null
  );
}

/**
 * Ağırlığı ekrana yazar. Katalog aralık veriyorsa ARALIK basılır — tek sayıya
 * indirmek katalogda olmayan bir kesinlik uydurmak olurdu (değişmez md. 4).
 */
export function drumBrakeWeightText(
  min: number,
  max: number | undefined,
  factor = 1
): string {
  const fmt = (v: number) =>
    (v * factor).toLocaleString("tr-TR", { maximumFractionDigits: 1 });
  return max !== undefined && max !== min ? `${fmt(min)} – ${fmt(max)}` : fmt(min);
}
