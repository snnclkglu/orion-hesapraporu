// FEM 1.001 Appendix A-3.4 — plaka burkulması (buruşma) çekirdeği.
//
// Saf fonksiyonlar; birimler N/mm² ve mm. Buruşma modülü (modules/buckling.ts)
// yalnız bu çekirdeği çağırır, ikinci bir yöntem yazmaz. Standart tabloları da
// buradan tek kaynak olarak okunur (standards/registry.ts dahil).
//
// Zincir:
//   σER (Euler referans gerilmesi)
//     → Kσ, Kτ  (T.A.3.4.1, kenar oranı α ve gerilme oranı ψ'ye bağlı)
//     → σvcr = Kσ·σER,  τvcr = Kτ·σER
//     → σvcr.c (basınç + kayma etkileşimi)
//     → orantı sınırı aşılıyorsa ρ indirgemesi (T.A.3.4.2)
//     → izin verilen gerilme = σvcr.c / νv  (madde 3.4, Booklet 9 T.9.10)
//
// İŞARET KURALI (FEM A-3.4 çözümlü örneğiyle aynı): panel kenar gerilmeleri
// BASINÇ POZİTİF girilir. σ1 mutlak değerce BÜYÜK olan (belirleyici basınç)
// kenardır; σ2 diğer kenardır ve çekme ise NEGATİF'tir. Böylece
// ψ = σ2/σ1 ∈ [−1, +1] olur: ψ = +1 düzgün basınç, ψ = 0 üçgen basınç,
// ψ = −1 saf eğilme. `normalizePanelEdges` bu kuralı zorlar.

/** FEM 1.001 3.4 yükleme durumları. */
export type BucklingLoadCase = 1 | 2 | 3;

/** Orantı sınırı tablosunun tanımlı olduğu çelik sınıfları. */
export type BucklingSteel = "St37" | "St44" | "St52";

/** Normal çelik için elastisite modülü [N/mm²] — FEM A-3.4. */
export const STEEL_ELASTIC_MODULUS_NMM2 = 210_000;

/** Normal çelik için Poisson oranı η — FEM A-3.4. */
export const STEEL_POISSON = 0.3;

/**
 * Euler referans gerilmesi:
 *   σER = π² · E · (e/b)² / [12 · (1 − η²)]
 * E = 210 000 N/mm² ve η = 0,3 için FEM'in kısa yazımı σER = 189 800·(e/b)²
 * ile birebir aynıdır (π²·210000/10,92 = 189 758 ≈ 189 800).
 *
 * @param thickness plaka kalınlığı e [mm]
 * @param width     basınç kuvvetlerine DİK plaka genişliği b [mm]
 */
export function eulerReferenceStress(
  thickness: number,
  width: number,
  elasticModulus = STEEL_ELASTIC_MODULUS_NMM2,
  poisson = STEEL_POISSON
): number {
  if (!(width > 0)) return NaN;
  return (Math.PI ** 2 * elasticModulus * (thickness / width) ** 2) / (12 * (1 - poisson ** 2));
}

// --------------------------------------------------------- Kσ / Kτ (T.A.3.4.1)

/** Kσ tablosunun hangi satırının (durumunun) kullanıldığı — raporda gösterilir. */
export type BucklingCaseNo = 1 | 2 | 3 | 4;

export const BUCKLING_CASE_LABEL: Record<BucklingCaseNo, string> = {
  1: "Durum 1 — düzgün basınç (ψ = +1)",
  2: "Durum 2 — düzgün olmayan basınç (0 ≤ ψ < 1)",
  3: "Durum 3 — saf eğilme ya da çekme baskın eğilme (ψ ≤ −1)",
  4: "Durum 4 — basınç baskın eğilme (−1 < ψ < 0)",
};

/** ψ'nin T.A.3.4.1'deki hangi duruma düştüğü. */
export function bucklingCaseNo(psi: number): BucklingCaseNo {
  if (psi <= -1) return 3;
  if (psi < 0) return 4;
  return psi >= 1 ? 1 : 2;
}

/** Durum 2 — düzgün olmayan basınç. ψ = 1'de durum 1'i (Kσ = 4 / (α+1/α)²) verir. */
function factorSigmaCase2(alpha: number, psi: number): number {
  return alpha >= 1
    ? 8.4 / (psi + 1.1)
    : (2.1 * (alpha + 1 / alpha) ** 2) / (psi + 1.1);
}

/** Durum 3 — saf eğilme / çekme baskın eğilme. */
function factorSigmaCase3(alpha: number): number {
  return alpha >= 2 / 3 ? 23.9 : 15.87 + 1.87 / alpha ** 2 + 8.6 * alpha ** 2;
}

/**
 * Kσ — FEM 1.001 Tablo T.A.3.4.1, dört kenarından mesnetli dikdörtgen panel.
 *
 * Durum 4 (−1 < ψ < 0) diğer iki durumun ara değeridir:
 *   Kσ = (1 + ψ)·K′ − ψ·K″ + 10·ψ·(1 + ψ)
 *   K′ = durum 2'nin ψ = 0 değeri, K″ = durum 3 (saf eğilme) değeri.
 * Her iki alt değer de α'ya göre kendi eşiğinden okunur; bu yüzden ortak
 * yardımcılar çağrılır (α ≤ 2/3'te K″ sabit 23,9 DEĞİLDİR).
 */
export function bucklingFactorSigma(alpha: number, psi: number): number {
  if (!(alpha > 0)) return NaN;
  if (psi <= -1) return factorSigmaCase3(alpha);
  if (psi < 0) {
    const kPrime = factorSigmaCase2(alpha, 0);
    const kSecond = factorSigmaCase3(alpha);
    return (1 + psi) * kPrime - psi * kSecond + 10 * psi * (1 + psi);
  }
  return factorSigmaCase2(alpha, psi);
}

/** Kτ — FEM 1.001 Tablo T.A.3.4.1, durum 5 (saf kayma). */
export function bucklingFactorTau(alpha: number): number {
  if (!(alpha > 0)) return NaN;
  return alpha >= 1 ? 5.34 + 4 / alpha ** 2 : 4 + 5.34 / alpha ** 2;
}

// ------------------------------------------------- Bileşik basınç + kayma

/**
 * Kritik karşılaştırma gerilmesi σvcr.c — FEM 1.001 A-3.4:
 *
 *   σvcr.c = √(σ² + 3τ²) / { (1+ψ)/4 · (σ/σvcr) + √( [0,25·(3−ψ)·σ/σvcr]² + [τ/τvcr]² ) }
 *
 * DİKKAT — basılı FEM metninde karekökün içindeki iki terim arasında ÇARPMA
 * işareti görünür; bu bir DİZGİ HATASIDIR. Standardın kendi çözümlü örneği
 * (σ=28, τ=47, ψ=−0,79, σvcr=158,5, τvcr=99 → σvcr.c = 168 N/mm²) yalnız
 * TOPLAMA ile çıkar; çarpma yorumu 965 N/mm² verir. Toplama yorumu ayrıca
 * τ = 0'da σvcr.c = σvcr'ye dejenere olur (fiziksel olarak zorunlu koşul),
 * çarpma yorumu ise σvcr'nin katlarını verir. Kaynak DIN 4114 bağıntısı da
 * toplamalıdır. Bkz. docs/standards/fem-1001-notes.md §6.
 *
 * @param sigma  panelin belirleyici basınç gerilmesi (POZİTİF) [N/mm²]
 * @param tau    panel kayma gerilmesi (işareti önemsiz) [N/mm²]
 * @param psi    kenar gerilme oranı σ2/σ1 ∈ [−1, +1]
 */
export function criticalComparisonStress(
  sigma: number,
  tau: number,
  psi: number,
  sigmaVcr: number,
  tauVcr: number
): number {
  const s = Math.abs(sigma);
  const t = Math.abs(tau);
  const comparison = Math.sqrt(s ** 2 + 3 * t ** 2);
  // Yalnız kayma varsa (σ = 0) bağıntı τ eksenine dejenere olur: σvcr.c = √3·τvcr
  const ratioSigma = sigmaVcr > 0 ? s / sigmaVcr : 0;
  const ratioTau = tauVcr > 0 ? t / tauVcr : 0;
  const denominator =
    ((1 + psi) / 4) * ratioSigma +
    Math.sqrt((0.25 * (3 - psi) * ratioSigma) ** 2 + ratioTau ** 2);
  if (!(denominator > 0)) return Infinity;
  return comparison / denominator;
}

/** √3 — kayma/normal gerilme dönüşüm sabiti (von Mises). */
export const SQRT3 = Math.sqrt(3);

/** Karşılaştırma gerilmesi σcp = √(σ² + 3τ²) — FEM 1.001 md. 3.2.1.3. */
export function comparisonStress(sigma: number, tau: number): number {
  return Math.sqrt(sigma ** 2 + 3 * tau ** 2);
}

// ------------------------------------------ Orantı sınırı ve ρ (T.A.3.4.2)

/**
 * Orantı sınırı [N/mm²] — FEM A-3.4.
 * Standart yalnız St 37 (190) ve St 52 (290) için değer verir. St 44 için
 * FİRMA KABULÜ olarak EMNİYETLİ tarafta kalan St 37 satırı kullanılır
 * (indirgeme daha erken başlar, kritik gerilme daha küçük çıkar).
 */
export const PROPORTIONALITY_LIMIT_NMM2: Record<BucklingSteel, number> = {
  St37: 190,
  St44: 190,
  St52: 290,
};

/** ρ tablosunun okunduğu çelik bloğu (St 44 → St 37 bloğu). */
export const RHO_TABLE_STEEL: Record<BucklingSteel, "St37" | "St52"> = {
  St37: "St37",
  St44: "St37",
  St52: "St52",
};

export interface RhoRow {
  /** Elastik formülden çıkan kritik gerilme [N/mm²] */
  calculated: number;
  /** İndirgeme katsayısı ρ */
  rho: number;
  /** İndirgenmiş kritik gerilme [N/mm²] */
  reduced: number;
}

/**
 * Tablo T.A.3.4.2 — ρ ve indirgenmiş kritik gerilmeler.
 *
 * Standardın τ sütunları burada TEKRARLANMAZ: τ değerleri σ/√3'tür
 * (110 = 190/√3, 128 = 221/√3 …) ve `reduceCriticalShear` bu ilişkiyi
 * kullanarak aynı tablodan okur — tek kaynak ilkesi.
 */
export const RHO_TABLE: Record<"St37" | "St52", RhoRow[]> = {
  // St 37 (Fe 360)
  St37: [
    { calculated: 190, rho: 1.0, reduced: 190 },
    { calculated: 200, rho: 0.97, reduced: 194 },
    { calculated: 210, rho: 0.94, reduced: 197 },
    { calculated: 220, rho: 0.91, reduced: 200 },
    { calculated: 230, rho: 0.88, reduced: 202 },
    { calculated: 240, rho: 0.85, reduced: 204 },
    { calculated: 250, rho: 0.82, reduced: 206 },
    { calculated: 260, rho: 0.8, reduced: 208 },
    { calculated: 280, rho: 0.76, reduced: 212 },
    { calculated: 300, rho: 0.72, reduced: 215 },
    { calculated: 340, rho: 0.65, reduced: 221 },
  ],
  // St 52 (Fe 510)
  St52: [
    { calculated: 290, rho: 1.0, reduced: 290 },
    { calculated: 300, rho: 0.98, reduced: 294 },
    { calculated: 310, rho: 0.96, reduced: 297 },
    { calculated: 320, rho: 0.94, reduced: 300 },
    { calculated: 330, rho: 0.92, reduced: 303 },
    { calculated: 340, rho: 0.9, reduced: 306 },
    { calculated: 350, rho: 0.88, reduced: 308 },
    { calculated: 360, rho: 0.86, reduced: 309 },
    { calculated: 380, rho: 0.82, reduced: 312 },
    { calculated: 400, rho: 0.79, reduced: 316 },
    { calculated: 440, rho: 0.73, reduced: 322 },
  ],
};

export interface ReducedCritical {
  /** Elastik formülden çıkan değer [N/mm²] */
  calculated: number;
  /** Uygulanan indirgeme katsayısı ρ (indirgeme yoksa 1) */
  rho: number;
  /** Kullanılacak kritik gerilme [N/mm²] */
  reduced: number;
  /** Orantı sınırı aşıldı mı — indirgeme uygulandı mı */
  applied: boolean;
  /** Tablonun son satırının ötesine düşüldü mü (sabitleme uygulandı) */
  clamped: boolean;
  /** Kullanılan orantı sınırı [N/mm²] */
  limit: number;
}

/**
 * Kritik NORMAL gerilmenin orantı sınırı üzerindeki indirgemesi (T.A.3.4.2).
 *
 * Ara değerlerde İNDİRGENMİŞ DEĞER üzerinden doğrusal enterpolasyon yapılır
 * (ρ üzerinden enterpolasyonla farkı binde birkaçtır; indirgenmiş değer
 * üzerinden gitmek sonucun tablodaki gibi MONOTON artmasını garanti eder).
 *
 * Tablonun son satırının ötesinde indirgenmiş değer SABİT tutulur. Gerçek eğri
 * akma sınırına doğru çok yavaş yükselmeye devam eder; sabitlemek kapasiteyi
 * olduğundan küçük gösterir, yani EMNİYETLİ taraftadır.
 */
export function reduceCriticalStress(
  calculated: number,
  steel: BucklingSteel
): ReducedCritical {
  const limit = PROPORTIONALITY_LIMIT_NMM2[steel];
  const rows = RHO_TABLE[RHO_TABLE_STEEL[steel]];
  if (!Number.isFinite(calculated) || calculated <= limit) {
    return { calculated, rho: 1, reduced: calculated, applied: false, clamped: false, limit };
  }
  const last = rows[rows.length - 1];
  if (calculated >= last.calculated) {
    return {
      calculated,
      rho: last.reduced / calculated,
      reduced: last.reduced,
      applied: true,
      clamped: true,
      limit,
    };
  }
  for (let i = 1; i < rows.length; i++) {
    const a = rows[i - 1];
    const b = rows[i];
    if (calculated <= b.calculated) {
      const f = (calculated - a.calculated) / (b.calculated - a.calculated);
      const reduced = a.reduced + f * (b.reduced - a.reduced);
      return { calculated, rho: reduced / calculated, reduced, applied: true, clamped: false, limit };
    }
  }
  // Buraya düşülmez (calculated > limit ve < last.calculated her zaman bir aralıktadır)
  return { calculated, rho: 1, reduced: calculated, applied: false, clamped: false, limit };
}

/**
 * Kritik KAYMA gerilmesinin indirgemesi. FEM'in koşulu τ için ayrıdır:
 * "√3·τvcr orantı sınırının altında olmalı". Bu yüzden √3·τvcr bir normal
 * gerilme gibi indirgenir ve sonuç tekrar √3'e bölünür — tablonun τ sütunları
 * (110, 113, … 128 ve 168, 169, … 185) bu işlemle birebir yeniden üretilir.
 */
export function reduceCriticalShear(
  calculated: number,
  steel: BucklingSteel
): ReducedCritical {
  const r = reduceCriticalStress(calculated * SQRT3, steel);
  return {
    calculated,
    rho: r.rho,
    reduced: r.reduced / SQRT3,
    applied: r.applied,
    clamped: r.clamped,
    limit: r.limit / SQRT3,
  };
}

// ------------------------------------------------ Emniyet katsayısı νv (3.4)

/**
 * Buruşma emniyet katsayısı νv — FEM 1.001 md. 3.4 (Booklet 9 md. 9.10 ile
 * aynı değerleri verir, T.9.10).
 *
 *   Durum I   : 1,70 + 0,175·(ψ − 1)   → ψ=+1'de 1,70 ; ψ=−1'de 1,35
 *   Durum II  : 1,50 + 0,125·(ψ − 1)   → 1,50 … 1,25
 *   Durum III : 1,35 + 0,075·(ψ − 1)   → 1,35 … 1,20
 *
 * Düzgün basınç (ψ = +1) burkulma açısından en tehlikeli hâldir; katsayı orada
 * en büyüktür. ψ tanım gereği [−1, +1] aralığındadır ve kelepçelenir.
 */
export const BUCKLING_SAFETY_COEFFICIENTS: Record<
  BucklingLoadCase,
  { base: number; slope: number }
> = {
  1: { base: 1.7, slope: 0.175 },
  2: { base: 1.5, slope: 0.125 },
  3: { base: 1.35, slope: 0.075 },
};

export const LOAD_CASE_LABEL: Record<BucklingLoadCase, string> = {
  1: "Yükleme Durumu I — normal işletme",
  2: "Yükleme Durumu II — rüzgârlı işletme",
  3: "Yükleme Durumu III — test / olağanüstü",
};

export function bucklingSafety(psi: number, loadCase: BucklingLoadCase): number {
  const { base, slope } = BUCKLING_SAFETY_COEFFICIENTS[loadCase];
  return base + slope * (clampPsi(psi) - 1);
}

// ------------------------------------------------------------- Yardımcılar

/** ψ'yi standardın tanım aralığına [−1, +1] kelepçeler. */
export function clampPsi(psi: number): number {
  if (!Number.isFinite(psi)) return 1;
  return Math.min(1, Math.max(-1, psi));
}

export interface PanelEdges {
  /** BASINÇ kenarı gerilmesi (iki kenarın büyüğü), basınç POZİTİF */
  sigma1: number;
  /** Karşı kenar; çekme ise negatif */
  sigma2: number;
  /**
   * ψ = σ2/σ1 — HAM değer. −1'in altına inebilir: T.A.3.4.1 durum 3 başlığı
   * "saf eğilme (ψ = −1) YA DA çekme baskın eğilme"dir, yani ψ < −1 meşrudur
   * ve Kσ = 23,9 (ya da kısa panel bağıntısı) ile karşılanır. Emniyet
   * katsayısı νv ise madde 3.4'ün tanım aralığında kalmak için
   * `clampPsi` ile [−1, +1]'e kelepçelenir.
   */
  psi: number;
  /** Kelepçelenmiş ψ — νv ve etkileşim bağıntısı için */
  psiClamped: number;
  /** Girilen sırada σ2 basınç kenarıydı (σ1 ile yer değiştirildi) */
  reordered: boolean;
  /** Her iki kenar da çekmede — panelde burkulma söz konusu değil */
  allTension: boolean;
}

/**
 * Kenar gerilmelerini FEM'in kuralına sokar.
 *
 * σ1 = panelin BASINÇ kenarı = iki kenar gerilmesinin BÜYÜĞÜ (basınç pozitif
 * kabulünde). MUTLAK DEĞERE göre sıralama YAPILMAZ: çekmenin baskın olduğu
 * panellerde |σ2| > |σ1| olması normaldir ve ψ < −1 verir — FEM T.A.3.4.1
 * durum 3 bu hâli açıkça kapsar ("bending with tension preponderant").
 * Mutlak değere göre takas etmek, çekme baskın panellerde σ1'i çekme yapıp
 * paneli yanlışlıkla "tamamen çekmede" göstererek kontrolü DÜŞÜRÜR.
 *
 * Her iki kenar da çekmedeyse (σ1 ≤ 0) panelde basınç yoktur; burkulma
 * kontrolü uygulanmaz.
 */
export function normalizePanelEdges(sigma1: number, sigma2: number): PanelEdges {
  const reordered = sigma2 > sigma1;
  const s1 = reordered ? sigma2 : sigma1;
  const s2 = reordered ? sigma1 : sigma2;
  const allTension = !(s1 > 0);
  const psi = s1 > 0 ? s2 / s1 : 1;
  return { sigma1: s1, sigma2: s2, psi, psiClamped: clampPsi(psi), reordered, allTension };
}
