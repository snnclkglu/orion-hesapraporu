// TARİHSEL DOĞRULAMA — buruşma (plaka burkulması) kontrolü.
//
// Bu bir ŞARTNAME DEĞİL, tarihsel doğrulamadır: uygulamanın hesap yöntemi
// FEM 1.001 A-3.4'e dayanır, ilk portun çıkış noktası olan hesap tablosuna
// değil. π hassasiyeti ve yöntem iyileştirmeleri nedeniyle karşılaştırma
// toleransı 1e-4 göreliye gevşetilmiştir.
//
// Zincir: döküm hücresi → alias → semantik anahtar → motor değeri.
//
// DİKKAT — bu dosyadaki SAPMA sözlüğü artık uzundur ve bu BEKLENEN durumdur:
// buruşma modülü FEM 1.001 A-3.4'e göre yeniden kuruldu (σvcr.c bağıntısındaki
// dizgi hatası düzeltildi, T.A.3.4.2 orantı sınırı indirgemesi eklendi, panel
// geometrisi ana kirişin kesitinden türetildi, Yükleme Durumu III kontrolü
// eklendi). Yöntemin STANDARDA karşı doğrulaması
// `__tests__/plate-buckling.test.ts` dosyasındadır; burası yalnız ilk portla
// aradaki farkın gerekçeli kaydıdır.

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

  // --- σvcr.c bağıntısı: ÇARPMA → TOPLAMA -----------------------------------
  // İlk port, FEM 1.001 A-3.4'ün BASILI metnindeki dizgi hatasını birebir
  // kopyalamıştı: karekökün içindeki iki terim çarpılıyordu. Standardın KENDİ
  // çözümlü örneği (s.126-128: σ=28, τ=47, ψ=−0,79, σvcr=158,5, τvcr=99)
  // 168 N/mm² verir ve bu sonucu YALNIZ toplama üretir; çarpma 965 N/mm²
  // çıkarır. Toplama yorumu ayrıca τ=0'da σvcr.c ≡ σvcr dejenerasyonunu
  // sağlar (fiziksel zorunluluk), çarpma ise σvcr'nin katlarını verir.
  // Kaynak DIN 4114 bağıntısı da toplamalıdır. Yön: çarpma kapasiteyi DAİMA
  // şişirir, yani ilk port EMNİYETSİZ taraftaydı.
  // Doğrulaması: __tests__/plate-buckling.test.ts (FEM örneği + sınır hâlleri).
  L48: "σvcr.c: karekök içi çarpma → toplama (FEM A-3.4 çözümlü örneği 168 N/mm²).",
  L107: "σvcr.c: karekök içi çarpma → toplama (FEM A-3.4 çözümlü örneği 168 N/mm²).",

  // --- Orantı sınırı ve ρ indirgemesi (T.A.3.4.2) ----------------------------
  // İlk port FEM A-3.4'ün "Important note" maddesini hiç uygulamıyordu:
  // elastik bağıntılar yalnız orantı sınırının (St 37: 190, St 52: 290 N/mm²)
  // altında geçerlidir; üzerinde kritik değer ρ ile indirgenir. V5 yan sacında
  // σvcr = 729 N/mm² çıkıyordu — çeliğin akma sınırının üç katı, fiziksel
  // olarak imkânsız bir kritik gerilme. Motor artık T.A.3.4.2'yi uygular ve
  // tablonun son satırında sabitler (St 37 → 221, St 52 → 322 N/mm²).
  // İlk portun elle girdiği "düzeltilmiş kritik gerilme = 322" değerinin
  // T.A.3.4.2'nin St 52 son satırındaki indirgenmiş değerin birebir kendisi
  // olması, indirgemenin o zaman ELLE yapıldığını gösterir; artık motorda.
  L39: "σvcr: T.A.3.4.2 ρ indirgemesi uygulanıyor (elastik 729 → indirgenmiş 221).",
  L43: "τvcr: √3·τvcr orantı sınırı koşulu ve ρ indirgemesi uygulanıyor.",
  L52: "İzin verilen gerilme: indirgenmiş σvcr.c ve düzeltilmiş bağıntıdan.",
  L111: "İzin verilen gerilme: indirgenmiş σvcr.c ve düzeltilmiş bağıntıdan.",

  // --- Üst sac panel geometrisi kesitten türetildi --------------------------
  // İlk portta üst sac paneli b = 590 mm ve a = 1500 mm girilmişti. b = 590,
  // kirişin ÜST BAŞLIĞININ TAMAMINDAN (b2 = 460 mm) bile geniştir ve kesitteki
  // hiçbir ölçüye karşılık gelmez; a = 1500 de kirişin perde aralığıyla
  // (2000 mm) çelişir. FEM A-3.4'te panel, MESNETLİ KENARLARI arasındaki
  // açıklıktır: üst başlığın dört kenarından mesnetli bölümü gövde sacları
  // arasında kalan net açıklıktır (aMm = 320 mm), uzunluğu ise perde
  // aralığıdır (2000 mm). Değerler artık kesitten türetilir.
  L75: "Üst sac σER: panel genişliği b, kesitten türetildi (590 → gövdeler arası 320 mm).",
  L87: "Üst sac α: b = 320 mm ve a = perde aralığı 2000 mm (1500 değil).",
  L94: "Üst sac Kτ: düzeltilmiş α'dan.",
  L98: "Üst sac σvcr: düzeltilmiş geometri + T.A.3.4.2 ρ indirgemesi.",
  L102: "Üst sac τvcr: düzeltilmiş geometri + ρ indirgemesi.",
};
describe("buruşma — tarihsel doğrulama", () => {
  // Tarihsel karşılaştırma ELLE girdilerle yapılır: ilk portta panel ölçüleri
  // ve gerilmeleri elle yazılıyordu, ana kirişten türetilmiyordu.
  const result = computeBuckling({ ...V5_BUCKLING_INPUTS, autoFromGirder: false });
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
      thicknessMm: 8,
      panelWidthMm: 3000, stiffenerSpacingMm: 1500,
      sigma1: 100, sigma2: -50, tau: 0,
    };
    const r = computeBuckling({
      autoFromGirder: false,
      side: panel,
      top: V5_BUCKLING_INPUTS.top,
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
