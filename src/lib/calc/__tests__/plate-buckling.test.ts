// FEM 1.001 A-3.4 çekirdeğinin STANDARDA karşı doğrulaması.
//
// Referans, standardın kendi çözümlü örneğidir (FEM 1.001 3rd Ed., PDF s.126-128):
// St 37 kiriş, açıklık 10 m, yükseklik 1,50 m, gövde 10 mm, perde aralığı 1,25 m,
// q = 162 kN/m. Mesnetten 0,625 m uzaktaki MN kesitinde
//   σ1 = −28 N/mm² (basınç), σ2 = +22 N/mm² (çekme), τ = 47 N/mm²
// → ψ = −0,79 · α = 0,83 · κ′ = 7,90 · κ″ = 23,9 · Kσ = 18,88 · σER = 8,4
// → σvcr = 158,6 · Kτ = 11,75 · τvcr = 99 · σvcr.c = 168 · σcp = 86 · νV ≈ 1,4

import { describe, expect, it } from "vitest";
import {
  BUCKLING_SAFETY_COEFFICIENTS,
  PROPORTIONALITY_LIMIT_NMM2,
  RHO_TABLE,
  SQRT3,
  bucklingCaseNo,
  bucklingFactorSigma,
  bucklingFactorTau,
  bucklingSafety,
  clampPsi,
  comparisonStress,
  criticalComparisonStress,
  eulerReferenceStress,
  normalizePanelEdges,
  reduceCriticalShear,
  reduceCriticalStress,
} from "../plate-buckling";

describe("FEM 1.001 A-3.4 — çözümlü örnek", () => {
  const e = 10, b = 1500, a = 1250;
  const sigma = 28, tau = 47;
  // FEM ara sonuçları YUVARLAYARAK ilerler (α = 0,83 · ψ = −0,79 · σER = 8,4).
  // Standardın aritmetiğini birebir yeniden üretmek için aynı yuvarlanmış
  // değerler kullanılır; tam değerlerle (α = 0,8333 · ψ = −0,7857) sonuçlar
  // %0,5 içinde aynıdır.
  const alpha = 0.83;                  // FEM'in yazdığı yuvarlanmış a/b
  const alphaExact = a / b;            // 0,8333
  const psi = -0.79;                   // FEM'in yazdığı yuvarlanmış σ2/σ1

  it("Euler referans gerilmesi σER = 8,4 N/mm²", () => {
    expect(eulerReferenceStress(e, b)).toBeCloseTo(8.4, 1);
  });

  it("kısa yazım σER = 189 800·(e/b)² ile aynıdır", () => {
    // FEM'in E=210000, η=0,3 için verdiği pratik biçim
    expect(eulerReferenceStress(e, b)).toBeCloseTo(189_800 * (e / b) ** 2, 1);
  });

  it("Kσ durum 4 ara değeri 18,88'dir", () => {
    // κ′ = 2,1·(α+1/α)²/1,1 = 7,90 ; κ″ = 23,9
    expect(bucklingFactorSigma(alpha, psi)).toBeCloseTo(18.88, 1);
    // Yuvarlanmamış α ve ψ ile de aynı mertebede kalır (%0,5 içinde)
    expect(bucklingFactorSigma(alphaExact, 22 / -28) / 18.88).toBeCloseTo(1, 2);
  });

  it("Kτ = 11,75", () => {
    expect(bucklingFactorTau(alpha)).toBeCloseTo(11.75, 1);
  });

  it("kritik gerilmeler σvcr ≈ 158,6 ve τvcr ≈ 99 N/mm²", () => {
    // FEM σER'i 8,4'e yuvarlayıp öyle çarpar
    const sigmaER = 8.4;
    expect(bucklingFactorSigma(alpha, psi) * sigmaER).toBeCloseTo(158.6, 0);
    expect(bucklingFactorTau(alpha) * sigmaER).toBeCloseTo(99, 0);
    // Yuvarlanmamış σER ile fark %0,5'in altındadır
    expect((bucklingFactorSigma(alpha, psi) * eulerReferenceStress(e, b)) / 158.6)
      .toBeCloseTo(1, 2);
  });

  it("karşılaştırma gerilmesi σcp = 86 N/mm²", () => {
    expect(comparisonStress(sigma, tau)).toBeCloseTo(86, 0);
  });

  it("etkileşimli kritik gerilme σvcr.c = 168 N/mm²", () => {
    // FEM'in kendi ara sonuçlarıyla (σvcr = 158,5 · τvcr = 99)
    expect(criticalComparisonStress(sigma, tau, -0.79, 158.5, 99)).toBeCloseTo(168, 0);
  });

  it("standardın basılı ÇARPMA yorumu örneği üretmez (dizgi hatası)", () => {
    const s = sigma / 158.5, t = tau / 99, p = -0.79;
    const hatali = comparisonStress(sigma, tau) /
      (((1 + p) / 4) * s + Math.sqrt((0.25 * (3 - p) * s) ** 2 * t ** 2));
    // Çarpma yorumu 168 yerine ~965 N/mm² verir — kapasiteyi 5,7 kat şişirir
    expect(hatali).toBeGreaterThan(900);
    expect(hatali / 168).toBeGreaterThan(5);
  });

  it("emniyet katsayısı νV ≈ 1,4 ve izin verilen gerilme 120 N/mm²", () => {
    const vv = bucklingSafety(psi, 1);
    expect(vv).toBeCloseTo(1.39, 2);
    expect(168 / 1.4).toBeCloseTo(120, 0);
    // Kontrol: σcp = 86 ≤ 120 → uygun
    expect(comparisonStress(sigma, tau)).toBeLessThan(168 / vv);
  });
});

describe("σvcr.c — sınır davranışı", () => {
  it("τ = 0'da σvcr.c tam olarak σvcr'ye eşittir", () => {
    // Fiziksel zorunluluk: kayma yokken etkileşim yoktur.
    for (const psi of [-1, -0.5, 0, 0.5, 1]) {
      expect(criticalComparisonStress(120, 0, psi, 300, 180)).toBeCloseTo(300, 6);
    }
  });

  it("σ = 0'da σvcr.c = √3·τvcr olur (saf kayma)", () => {
    expect(criticalComparisonStress(0, 60, 0.4, 300, 180)).toBeCloseTo(SQRT3 * 180, 6);
  });

  it("kayma arttıkça etkileşimli kritik gerilme düşer", () => {
    const a = criticalComparisonStress(100, 10, 0.5, 300, 180);
    const b = criticalComparisonStress(100, 60, 0.5, 300, 180);
    expect(b).toBeLessThan(a);
  });
});

describe("Kσ — Tablo T.A.3.4.1 dalları", () => {
  it("ψ = +1'de durum 2 formülü durum 1'i verir (Kσ = 4 ve (α+1/α)²)", () => {
    expect(bucklingFactorSigma(2, 1)).toBeCloseTo(4, 10);
    expect(bucklingFactorSigma(0.5, 1)).toBeCloseTo((0.5 + 2) ** 2, 10);
  });

  it("ψ ≤ −1'de saf eğilme değerleri (23,9 ve α ≤ 2/3 bağıntısı)", () => {
    expect(bucklingFactorSigma(1.5, -1)).toBeCloseTo(23.9, 10);
    const al = 0.5;
    expect(bucklingFactorSigma(al, -1)).toBeCloseTo(15.87 + 1.87 / al ** 2 + 8.6 * al ** 2, 10);
  });

  it("α ≤ 2/3 ve −1 < ψ < 0'da κ″ sabit 23,9 DEĞİL, α'ya bağlı bağıntıdır", () => {
    const al = 0.5, ps = -0.5;
    const kPrime = (2.1 * (al + 1 / al) ** 2) / 1.1;
    const kSecond = 15.87 + 1.87 / al ** 2 + 8.6 * al ** 2;  // = 25,50 (> 23,9)
    const beklenen = (1 + ps) * kPrime - ps * kSecond + 10 * ps * (1 + ps);
    expect(bucklingFactorSigma(al, ps)).toBeCloseTo(beklenen, 10);
    // Kısa panel (α ≤ 2/3) eğilmede daha rijittir: κ″ 23,9'un ÜSTÜNDEDİR;
    // sabit 23,9 kullanmak kapasiteyi olduğundan küçük gösterirdi.
    expect(kSecond).toBeGreaterThan(23.9);
    const sabitle = (1 + ps) * kPrime - ps * 23.9 + 10 * ps * (1 + ps);
    expect(bucklingFactorSigma(al, ps)).toBeGreaterThan(sabitle);
    // İlk portun (Excel) 8,6/α² yazımı ise κ″'yü 57,8'e çıkarıp kapasiteyi
    // EMNİYETSİZ biçimde şişiriyordu.
    const excelKSecond = 15.87 + 1.87 / al ** 2 + 8.6 / al ** 2;
    expect(excelKSecond).toBeGreaterThan(kSecond * 2);
  });

  it("dal sınırlarında süreklidir (ψ = 0 ve ψ = −1)", () => {
    for (const al of [0.5, 0.75, 1, 2, 6]) {
      expect(bucklingFactorSigma(al, 1e-9)).toBeCloseTo(bucklingFactorSigma(al, -1e-9), 6);
      expect(bucklingFactorSigma(al, -1 + 1e-9)).toBeCloseTo(bucklingFactorSigma(al, -1), 5);
    }
  });

  it("α = 1 ve α = 2/3 geçişlerinde süreklidir", () => {
    for (const psi of [0.5, 0, -0.5, -1]) {
      expect(bucklingFactorSigma(1 - 1e-9, psi)).toBeCloseTo(bucklingFactorSigma(1 + 1e-9, psi), 5);
    }
    // α = 2/3'te durum 3 bağıntısı 23,9'a oturur
    const al = 2 / 3;
    expect(15.87 + 1.87 / al ** 2 + 8.6 * al ** 2).toBeCloseTo(23.9, 1);
  });

  it("Kτ dal sınırında (α = 1) süreklidir ve 9,34 verir", () => {
    expect(bucklingFactorTau(1)).toBeCloseTo(9.34, 10);
    expect(bucklingFactorTau(1 - 1e-9)).toBeCloseTo(bucklingFactorTau(1 + 1e-9), 6);
  });

  it("durum numarası ψ'ye göre doğru seçilir", () => {
    expect(bucklingCaseNo(1)).toBe(1);
    expect(bucklingCaseNo(0.4)).toBe(2);
    expect(bucklingCaseNo(-0.5)).toBe(4);
    expect(bucklingCaseNo(-1)).toBe(3);
  });
});

describe("ρ indirgemesi — Tablo T.A.3.4.2", () => {
  it("orantı sınırının altında indirgeme yapılmaz", () => {
    const r = reduceCriticalStress(150, "St37");
    expect(r.applied).toBe(false);
    expect(r.reduced).toBe(150);
    expect(r.rho).toBe(1);
  });

  it("tablonun her satırını birebir üretir (St 37 ve St 52)", () => {
    for (const steel of ["St37", "St52"] as const) {
      for (const row of RHO_TABLE[steel]) {
        const r = reduceCriticalStress(row.calculated, steel);
        expect(r.reduced).toBeCloseTo(row.reduced, 6);
        // ρ tablodaki yuvarlanmış değerle 0,01 içinde uyuşur
        expect(r.rho).toBeCloseTo(row.rho, 2);
      }
    }
  });

  it("kayma sütunları σ/√3 ilişkisinden yeniden üretilir", () => {
    // Tablonun τ sütunları tam sayıya yuvarlanmıştır; 1 N/mm² tolerans yeter.
    const yakin = (a: number, b: number) => expect(Math.abs(a - b)).toBeLessThan(1.2);
    // St 37: 110 → 110 (sınır) ; 197 → 128 (son satır)
    yakin(reduceCriticalShear(110, "St37").reduced, 110);
    yakin(reduceCriticalShear(197, "St37").reduced, 128);
    // St 52: 168 → 168 (sınır) ; 254 → 185 (son satır)
    yakin(reduceCriticalShear(168, "St52").reduced, 168);
    yakin(reduceCriticalShear(254, "St52").reduced, 185);
    // Ara satır: St 37 · τ = 145 → 119
    yakin(reduceCriticalShear(145, "St37").reduced, 119);
  });

  it("tablo ötesinde son indirgenmiş değere sabitlenir (emniyetli)", () => {
    const r = reduceCriticalStress(2000, "St52");
    expect(r.clamped).toBe(true);
    expect(r.reduced).toBeCloseTo(322, 6);
    expect(r.rho).toBeLessThan(0.2);
  });

  it("indirgenmiş değer hesaplanan değerle MONOTON artar ve akmayı aşmaz", () => {
    let prev = 0;
    for (let v = 190; v <= 1000; v += 10) {
      const r = reduceCriticalStress(v, "St37");
      expect(r.reduced).toBeGreaterThanOrEqual(prev - 1e-9);
      prev = r.reduced;
      // St 37 akma sınırı 240 N/mm²; indirgenmiş kritik gerilme onu aşamaz
      expect(r.reduced).toBeLessThanOrEqual(240);
    }
  });

  it("St 44 emniyetli tarafta St 37 satırlarını kullanır", () => {
    expect(PROPORTIONALITY_LIMIT_NMM2.St44).toBe(PROPORTIONALITY_LIMIT_NMM2.St37);
    expect(reduceCriticalStress(300, "St44").reduced)
      .toBeCloseTo(reduceCriticalStress(300, "St37").reduced, 10);
    // St 52 aynı girdide daha büyük kapasite verir
    expect(reduceCriticalStress(300, "St52").reduced)
      .toBeGreaterThan(reduceCriticalStress(300, "St44").reduced);
  });
});

describe("Emniyet katsayısı νv — FEM 3.4 / Booklet 9 T.9.10", () => {
  it("üç yükleme durumunun uç değerleri standartla uyuşur", () => {
    expect(bucklingSafety(1, 1)).toBeCloseTo(1.7, 10);
    expect(bucklingSafety(-1, 1)).toBeCloseTo(1.35, 10);
    expect(bucklingSafety(1, 2)).toBeCloseTo(1.5, 10);
    expect(bucklingSafety(-1, 2)).toBeCloseTo(1.25, 10);
    expect(bucklingSafety(1, 3)).toBeCloseTo(1.35, 10);
    expect(bucklingSafety(-1, 3)).toBeCloseTo(1.2, 10);
  });

  it("düzgün basınç (ψ = +1) en tehlikeli hâldir — katsayı orada en büyüktür", () => {
    for (const lc of [1, 2, 3] as const) {
      expect(bucklingSafety(1, lc)).toBeGreaterThan(bucklingSafety(-1, lc));
      expect(BUCKLING_SAFETY_COEFFICIENTS[lc].slope).toBeGreaterThan(0);
    }
  });

  it("durum sıralaması I > II > III (test durumunda emniyet payı azalır)", () => {
    for (const psi of [1, 0, -1]) {
      expect(bucklingSafety(psi, 1)).toBeGreaterThan(bucklingSafety(psi, 2));
      expect(bucklingSafety(psi, 2)).toBeGreaterThan(bucklingSafety(psi, 3));
    }
  });

  it("ψ tanım aralığının dışına çıkarsa kelepçelenir", () => {
    expect(clampPsi(2.5)).toBe(1);
    expect(clampPsi(-4)).toBe(-1);
    expect(bucklingSafety(9, 1)).toBeCloseTo(1.7, 10);
  });
});

describe("Kenar gerilmelerinin normalleştirilmesi", () => {
  it("σ1 daima BASINÇ kenarıdır (iki kenarın büyüğü); sıra bozuksa düzeltilir", () => {
    const r = normalizePanelEdges(50, 110);
    expect(r.reordered).toBe(true);
    expect(r.sigma1).toBe(110);
    expect(r.psi).toBeCloseTo(50 / 110, 10);
  });

  it("çekme baskın eğilmede ψ < −1 KORUNUR, kenarlar takas edilmez", () => {
    // Gerçek bir gövde paneli: üst kenar +49,13 basınç, alt kenar −59,63 çekme.
    // Mutlak değere göre takas edilseydi σ1 çekme olur ve panel yanlışlıkla
    // "tamamen çekmede" sayılıp kontrol DÜŞERDİ (FEM T.A.3.4.1 durum 3:
    // "saf eğilme YA DA çekme baskın eğilme").
    const r = normalizePanelEdges(49.13, -59.63);
    expect(r.reordered).toBe(false);
    expect(r.sigma1).toBeCloseTo(49.13, 6);
    expect(r.allTension).toBe(false);
    expect(r.psi).toBeCloseTo(-1.2137, 3);
    expect(r.psiClamped).toBe(-1);
  });

  it("saf eğilmede ψ = −1 çıkar", () => {
    const r = normalizePanelEdges(120, -120);
    expect(r.psi).toBeCloseTo(-1, 10);
    expect(r.allTension).toBe(false);
  });

  it("her iki kenar çekmedeyse burkulma söz konusu değildir", () => {
    expect(normalizePanelEdges(-80, -40).allTension).toBe(true);
  });

  it("FEM örneğinin işaret kuralını üretir (basınç pozitif)", () => {
    // FEM: σ1 = −28 (basınç), σ2 = +22 (çekme) → ψ = −0,79
    // Uygulamanın kuralı: basınç POZİTİF → σ1 = 28, σ2 = −22
    const r = normalizePanelEdges(28, -22);
    expect(r.psi).toBeCloseTo(-0.7857, 4);
  });
});
