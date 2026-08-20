// GÜVENLİK İŞARETLERİNİN GEOMETRİSİ — saf veri (React yok, @react-pdf yok).
//
// İKİ ÇİZİCİ VARDIR ve ŞEKİL TEKTİR: belge (`pdf/manual-marks.tsx`,
// @react-pdf'in Svg ilkelleri) ve editörün kâğıt önizlemesi (tarayıcı SVG'si).
// Şekli iki yerde yazmak, önizlemedeki üçgen ile belgedeki üçgenin bir gün
// ayrışması demekti — ve önizlemenin TEK işi belgeyi doğru söylemektir.
//
// ŞEKİL BİR STANDART GEREĞİDİR, BİR MARKA ÖĞESİ DEĞİL. Marka kılavuzu
// "the brand has no amber; warnings ride on red" der; bu EKRAN ve PAZARLAMA
// için doğrudur. Ama ISO 3864-2'de genel tehlike işareti SARI zeminli siyah
// kenarlı üçgen, zorunluluk işareti MAVİ dairedir. O üçgeni markanın
// kırmızısına boyamak, operatörün sahada gördüğü etiketle belgedeki işareti
// ayrıştırırdı — bir güvenlik kılavuzunda kabul edilemez.
//
// ÜÇ DÜZEY AYNI ÜÇGENİ PAYLAŞIR: ISO 3864-2'de genel tehlike işareti TEKTİR,
// tehlike/uyarı/dikkat ayrımını SİNYAL KELİMESİ yapar (KITAP-16).

import type { ManualNoteLevel } from "./types";

/** ISO 3864-4 güvenlik renkleri — standardın kendi değerleri. */
export const ISO_SAFETY = {
  /** Güvenlik sarısı (ISO 3864-4, RAL 1003'e yakın). */
  sari: "#F9C900",
  /** Güvenlik mavisi (ISO 3864-4). */
  mavi: "#0B5CA8",
  /** Kontrast rengi — kenar ve simge. */
  siyah: "#1A1A1A",
  beyaz: "#FFFFFF",
} as const;

/** Bir şeklin tek parçası — çizici bunu kendi ilkeline çevirir. */
export type MarkShape =
  | { t: "polygon"; points: string; fill: string }
  | { t: "path"; d: string; fill: string }
  | { t: "circle"; cx: number; cy: number; r: number; fill: string }
  | { t: "rect"; x: number; y: number; w: number; h: number; fill: string };

export interface MarkDef {
  /** Görüntü kutusu — çizici `viewBox` olarak verir. */
  vb: { w: number; h: number };
  parts: MarkShape[];
}

/**
 * GENEL TEHLİKE ÜÇGENİ (ISO 7010 W001).
 *
 * 100×88 birimlik kutu: eşkenara yakın üçgen, ISO 3864-2'nin oranı.
 */
export const MARK_UCGEN: MarkDef = {
  vb: { w: 100, h: 88 },
  parts: [
    { t: "polygon", points: "50,2 98,86 2,86", fill: ISO_SAFETY.siyah },
    { t: "polygon", points: "50,14 88,80 12,80", fill: ISO_SAFETY.sari },
    { t: "path", d: "M45.5,34 L54.5,34 L53.2,62 L46.8,62 Z", fill: ISO_SAFETY.siyah },
    { t: "circle", cx: 50, cy: 71, r: 4.4, fill: ISO_SAFETY.siyah },
  ],
};

/**
 * ZORUNLULUK İŞARETİ (ISO 7010 M001 ailesi) — mavi daire, beyaz ünlem.
 *
 * "ÖNEMLİ" bir tehlike değil bir ZORUNLULUKTUR (`types.ts`: "güvenli
 * kullanımın ZORUNLU adımı"), o yüzden üçgen değil daire taşır.
 */
export const MARK_ONEMLI: MarkDef = {
  vb: { w: 100, h: 100 },
  parts: [
    { t: "circle", cx: 50, cy: 50, r: 48, fill: ISO_SAFETY.mavi },
    { t: "path", d: "M45.5,22 L54.5,22 L53.2,60 L46.8,60 Z", fill: ISO_SAFETY.beyaz },
    { t: "circle", cx: 50, cy: 72, r: 5.2, fill: ISO_SAFETY.beyaz },
  ],
};

/**
 * BİLGİ İŞARETİ — mavi daire, beyaz "i".
 *
 * Eski sürümde bu şekil defterde YOKTU: sinyal çizelgesi görselinden mavi
 * piksellerin sınır kutusu bulunarak 64×101 piksel olarak kırpılmıştı ve
 * belgede bulanık basılıyordu. Vektörde kırpma diye bir şey yoktur.
 */
export const MARK_NOT: MarkDef = {
  vb: { w: 100, h: 100 },
  parts: [
    { t: "circle", cx: 50, cy: 50, r: 48, fill: ISO_SAFETY.mavi },
    { t: "circle", cx: 50, cy: 27, r: 8, fill: ISO_SAFETY.beyaz },
    { t: "rect", x: 42, y: 41, w: 16, h: 34, fill: ISO_SAFETY.beyaz },
  ],
};

/** Düzey → şekil. Kutu da çizelge de burayı çağırır; ikinci eşleme YOKTUR. */
export function markForLevel(level: ManualNoteLevel): MarkDef {
  if (level === "not") return MARK_NOT;
  if (level === "onemli") return MARK_ONEMLI;
  return MARK_UCGEN;
}

/**
 * ÜÇGEN DAİREDEN GENİŞ ÇİZİLİR — bu bir hata değil OPTİK DENGEDİR.
 *
 * Aynı kenar uzunluğunda bir üçgenin alanı dairenin yarısı kadardır
 * (0,43·e² ve 0,79·e²); yan yana dizildiklerinde üçgen küçük görünür.
 * ÖLÇEK YÜKSEKLİĞE göre verilir: kutunun ilk satırı üç düzeyde de aynı
 * yerden başlamalıdır, o yüzden yükseklik sabittir ve genişlik ondan çıkar.
 */
export function markWidthForHeight(mark: MarkDef, yukseklik: number): number {
  return (yukseklik * mark.vb.w) / mark.vb.h;
}

/** Üç düzeyin de sığdığı slot genişliği — hizalama bunun üzerinden yapılır. */
export function markSlotWidth(yukseklik: number): number {
  return markWidthForHeight(MARK_UCGEN, yukseklik);
}
