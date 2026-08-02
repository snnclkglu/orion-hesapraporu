// Dairesel mil kesitinde gerilme hesabı — tambur mili, kanca bloğu mili,
// teker mili ve benzeri tüm dairesel kesitler için ortak modül.
//
// Kiriş statiği (moment ve kesme kuvveti) `beam.ts` ile çözülür; bu modül
// yalnızca "kesit kuvveti → gerilme" adımını yapar. Kesitin eğilme ve kesme
// çapları ayrı verilebilir: kama kanalı, çentik veya kademeli millerde eğilme
// kritik kesiti ile kesme kritik kesiti farklı olabilir.
//
// KONVANSİYONLAR AÇIK PARAMETREDİR
// Bileşke gerilme ve kayma dağılımı kabulü firmadan firmaya ve standarttan
// standarda değişir. Bu yüzden modül hiçbir varsayılan kabul dayatmaz; çağıran
// modül hangi standarda uyduğunu açıkça bildirir.
//
// Birimler: kuvvet kg, uzunluk cm, moment kg·cm, gerilme kg/cm².

/** Eğilme ve kayma gerilmesinin bileşkeye indirgenme kabulü */
export type CombinedStressConvention =
  /** √(σ² + 3τ²) — şekil değiştirme enerjisi (von Mises) kriteri, CMAA 70 4.11.4.1 */
  | "vonMises"
  /** √(σ² + τ²) — bazı firma kabullerinde kullanılan basit bileşke */
  | "resultant";

/** Kesit üzerindeki kayma gerilmesi dağılımı kabulü */
export type ShearDistribution =
  /** Ortalama kayma gerilmesi: τ = V / A */
  | "ortalama"
  /** Dairesel kesitte tarafsız eksendeki en büyük kayma gerilmesi: τ = (4/3)·V / A */
  | "maksimum";

/**
 * Dolu dairesel kesitte parabolik kayma dağılımının tepe değeri ortalamanın
 * 4/3 katıdır (yaygın olarak 1,33 diye yuvarlanır). Burada kesin oran kullanılır.
 */
export const CIRCULAR_PEAK_SHEAR_FACTOR = 4 / 3;

/** Dairesel kesit tanımı */
export interface ShaftSection {
  /** Kesit çapı [cm] */
  diameterCm: number;
}

/** Mil gerilme hesabı girdisi */
export interface ShaftStressInput {
  /** Kesitteki eğilme momenti [kg·cm] (işareti önemsizdir) */
  momentKgCm: number;
  /** Kesitteki kesme kuvveti [kg] (işareti önemsizdir) */
  shearKg: number;
  /** Eğilme kontrolünün yapıldığı kesitin çapı [cm] */
  bendingDiameterCm: number;
  /** Kesme kontrolünün yapıldığı kesitin çapı [cm];
   *  ayrı bir kesme kesiti yoksa eğilme çapı ile aynı verilir */
  shearDiameterCm: number;
  /** Bileşke gerilme kabulü */
  combined: CombinedStressConvention;
  /** Kayma dağılımı kabulü */
  shear: ShearDistribution;
}

/** Mil gerilme hesabı sonucu */
export interface ShaftStressResult {
  /** Eğilme mukavemet momenti W = π·D³/32 (eğilme çapı ile) [cm³] */
  sectionModulusCm3: number;
  /** Kesme alanı A = π·D²/4 (kesme çapı ile) [cm²] */
  shearAreaCm2: number;
  /** Eğilme gerilmesi σ = |M| / W [kg/cm²] */
  bendingStress: number;
  /** Kayma gerilmesi τ [kg/cm²] */
  shearStress: number;
  /** Bileşke gerilme [kg/cm²] */
  combinedStress: number;
}

/** NaN/Infinity girdileri 0'a indirger */
function finiteOrZero(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

/** Bölen pozitif değilse 0 döndürür — sonuçta NaN/Infinity oluşmaz */
function safeDivide(numerator: number, denominator: number): number {
  return denominator > 0 ? numerator / denominator : 0;
}

/** Dolu dairesel kesitin eğilme mukavemet momenti W = π·D³/32 [cm³] */
export function circularSectionModulusCm3(diameterCm: number): number {
  const diameter = Math.max(0, finiteOrZero(diameterCm));
  return (Math.PI * diameter * diameter * diameter) / 32;
}

/** Dolu dairesel kesitin alanı A = π·D²/4 [cm²] */
export function circularAreaCm2(diameterCm: number): number {
  const diameter = Math.max(0, finiteOrZero(diameterCm));
  return (Math.PI * diameter * diameter) / 4;
}

/**
 * Dairesel mil kesitinde eğilme, kayma ve bileşke gerilmeleri.
 * Geçersiz (sıfır veya negatif) çap verilirse ilgili gerilme 0 döner;
 * hesap hiçbir koşulda NaN veya Infinity üretmez.
 */
export function shaftStress(i: ShaftStressInput): ShaftStressResult {
  const sectionModulusCm3 = circularSectionModulusCm3(i.bendingDiameterCm);
  const shearAreaCm2 = circularAreaCm2(i.shearDiameterCm);

  const bendingStress = safeDivide(
    Math.abs(finiteOrZero(i.momentKgCm)),
    sectionModulusCm3
  );

  const shearFactor =
    i.shear === "maksimum" ? CIRCULAR_PEAK_SHEAR_FACTOR : 1;
  const shearStress =
    shearFactor * safeDivide(Math.abs(finiteOrZero(i.shearKg)), shearAreaCm2);

  // vonMises: √(σ² + 3τ²) — resultant: √(σ² + τ²)
  const shearWeight = i.combined === "vonMises" ? 3 : 1;
  const combinedStress = Math.sqrt(
    bendingStress * bendingStress + shearWeight * shearStress * shearStress
  );

  return {
    sectionModulusCm3,
    shearAreaCm2,
    bendingStress,
    shearStress,
    combinedStress,
  };
}

/**
 * Emniyet kullanım oranı = mevcut gerilme / emniyet gerilmesi.
 * 1'in altı yeterli, üstü yetersiz demektir; emniyet payı (1 − oran) olarak
 * raporlanır. Emniyet gerilmesi geçersizse (≤ 0 veya sonlu değil) 0 döner —
 * bu durumda kontrol sonucu anlamsızdır ve çağıran tarafta ayrıca elenmelidir.
 */
export function stressUtilization(actual: number, allowable: number): number {
  return safeDivide(finiteOrZero(actual), finiteOrZero(allowable));
}
