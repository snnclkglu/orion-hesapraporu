// TARİHSEL DOĞRULAMA — buruşma (plaka burkulması) kontrolü.
//
// Bu bir ŞARTNAME DEĞİL, tarihsel doğrulamadır: uygulamanın hesap yöntemi
// FEM 1.001 A-3.4'e dayanır, ilk portun çıkış noktası olan hesap tablosuna
// değil. π hassasiyeti ve yöntem iyileştirmeleri nedeniyle karşılaştırma
// toleransı 1e-4 göreliye gevşetilmiştir.
//
// Zincir: döküm hücresi → alias → semantik anahtar → motor değeri.

import { describe, expect, it } from "vitest";
import { V5_BUCKLING_INPUTS } from "../defaults/structural";
import { computeBuckling } from "../modules/buckling";
import { compareCell, isDecorative, loadFormulaCells } from "./golden";
import { BUCKLING_ALIASES, resolveAlias } from "./legacy/alias-structural";

/** Göreli karşılaştırma toleransı — bkz. dosya başı açıklaması. */
const TOLERANCE = 1e-4;

/** Motorda karşılığı BULUNMAYAN döküm hücreleri ve çıkarılma gerekçeleri. */
const KAPSAM_DISI: Record<string, string> = {
  X32: "Dal göstergesi: ψ'nin hangi aralıkta olduğunu yazan yardımcı hücre; motor dalı doğrudan seçer.",
  AA32: "Dal adayı: ψ ≤ −1 durumunun Kσ değeri; motor yalnız seçilen dalı hesaplar.",
  AA34: "Dal adayı: ψ > 0 durumunun Kσ değeri; motor yalnız seçilen dalı hesaplar.",
  Q52: "Gösterim ikizi: sidePanel.combinedStress ile aynı değer.",
  Q54: "Gösterim ikizi: sidePanel.combinedStress ile aynı değer.",
  X91: "Dal göstergesi (üst sac); motor dalı doğrudan seçer.",
  AA91: "Dal adayı: ψ ≤ −1 durumunun Kσ değeri (üst sac).",
  AA93: "Dal adayı: ψ > 0 durumunun Kσ değeri (üst sac).",
  Q111: "Gösterim ikizi: topPanel.combinedStress ile aynı değer.",
};

/**
 * Bilinçli olarak SAPILAN hücreler.
 *
 * AA33 / AA92: −1 < ψ ≤ 0 dalının α ≤ 2/3 alt dalında ilk portta
 * `15,87 + 1,87/α² + 8,6/α²` yazılıydı; FEM 1.001 Tablo A.3.4.1 bu terimi
 * `15,87 + 1,87/α² + 8,6·α²` olarak verir. Standardın doğrusu uygulandı.
 * Sayısal etki: V5 fikstüründe her iki panelde de α > 1 olduğu için seçilen
 * dal değişmez ve hiçbir hücrenin değeri değişmez (eski = yeni). Etki yalnız
 * kısa panellerde (α ≤ 2/3) görülür; orada Kσ belirgin biçimde düşer, yani
 * hesap güvenli tarafa kayar. Hücreler ayrıca dal adayı ara hücre oldukları
 * için motor haritasında yer almaz.
 */
const SAPMA: Record<string, string> = {
  AA33: "Kσ (−1<ψ≤0, α≤2/3) dalı: 8,6/α² → 8,6·α² (FEM T.A.3.4.1). V5'te dal seçilmediğinden değer değişmez.",
  AA92: "Kσ (−1<ψ≤0, α≤2/3) dalı: 8,6/α² → 8,6·α² (FEM T.A.3.4.1). V5'te dal seçilmediğinden değer değişmez.",
};

describe("buruşma — tarihsel doğrulama", () => {
  const result = computeBuckling(V5_BUCKLING_INPUTS);
  const dumpCells = loadFormulaCells("09_08_BURUŞMA_KONTROLÜ.txt").filter(
    (c) => !isDecorative(c)
  );

  it("ilk portun tüm sağlam hücreleriyle eşleşir", () => {
    expect(dumpCells.length).toBeGreaterThan(25);

    const failures: string[] = [];
    for (const dc of dumpCells) {
      if (dc.cell in SAPMA) continue;

      if (dc.cell in KAPSAM_DISI) {
        if (resolveAlias(BUCKLING_ALIASES, dc.cell, result.cells) !== undefined) {
          failures.push(`${dc.cell}: KAPSAM_DISI'nda ama eşlemesi de var — ikisinden biri fazla`);
        }
        continue;
      }

      const actual = resolveAlias(BUCKLING_ALIASES, dc.cell, result.cells);
      if (actual === undefined) {
        failures.push(
          `${dc.cell}: eşleme yok. Ya BUCKLING_ALIASES'a ekleyin ya da ` +
            `KAPSAM_DISI'na gerekçesiyle yazın.  [${dc.formula}]`
        );
        continue;
      }
      const { ok, message } = compareCell(dc.value, actual, TOLERANCE);
      if (!ok) failures.push(`${dc.cell}: ${message}  [${dc.formula}]`);
    }
    expect(failures, failures.join("\n")).toEqual([]);
  });

  it("eşleme ve gerekçe sözlükleri bayatlamamıştır", () => {
    const dumpSet = new Set(dumpCells.map((c) => c.cell));
    const stale: string[] = [];

    for (const cell of Object.keys(BUCKLING_ALIASES)) {
      if (!dumpSet.has(cell)) stale.push(`BUCKLING_ALIASES["${cell}"]: dökümde böyle bir hücre yok`);
      else if (result.cells[BUCKLING_ALIASES[cell]] === undefined) {
        stale.push(
          `BUCKLING_ALIASES["${cell}"] → "${BUCKLING_ALIASES[cell]}": motor bu anahtarı üretmiyor`
        );
      }
    }
    for (const dict of [
      { name: "KAPSAM_DISI", map: KAPSAM_DISI },
      { name: "SAPMA", map: SAPMA },
    ]) {
      for (const cell of Object.keys(dict.map)) {
        if (!dumpSet.has(cell)) stale.push(`${dict.name}["${cell}"]: dökümde böyle bir hücre yok`);
      }
    }
    expect(stale, stale.join("\n")).toEqual([]);
  });

  it("her iki panel de buruşma açısından emniyetlidir", () => {
    expect(result.checks.every((c) => c.pass)).toBe(true);
  });

  it("kısa panelde (α ≤ 2/3) Kσ standardın 8,6·α² terimiyle hesaplanır", () => {
    // α = 1500/3000 = 0,5 ve ψ = −50/100 = −0,5 → −1 < ψ ≤ 0, α ≤ 2/3 dalı.
    const panel = {
      elasticModulus: 210000, poisson: 0.3, thicknessMm: 8,
      panelWidthMm: 3000, stiffenerSpacingMm: 1500,
      sigma1: 100, sigma2: -50, tau: 0,
    };
    const r = computeBuckling({
      side: panel,
      top: V5_BUCKLING_INPUTS.top,
      sideCorrectedCriticalNmm2: 0,
    });
    const alpha = 0.5, psi = -0.5;
    const expected =
      ((1 + psi) * (alpha + 1 / alpha) ** 2 * 2.1) / 1.1 -
      psi * (15.87 + 1.87 / alpha ** 2 + 8.6 * alpha ** 2) +
      10 * psi * (1 + psi);
    expect(r.cells["sidePanel.factorSigma"]).toBeCloseTo(expected, 10);
    // İlk portta yazılı olan (hatalı) değerden belirgin biçimde düşüktür.
    const legacy =
      ((1 + psi) * (alpha + 1 / alpha) ** 2 * 2.1) / 1.1 -
      psi * (15.87 + 1.87 / alpha ** 2 + 8.6 / alpha ** 2) +
      10 * psi * (1 + psi);
    expect(expected).toBeLessThan(legacy);
  });
});
