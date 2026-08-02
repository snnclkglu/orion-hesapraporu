// TARİHSEL DOĞRULAMA — başkiriş.
//
// Bu bir ŞARTNAME DEĞİL, tarihsel doğrulamadır: uygulamanın hesap yöntemi
// standartlara (FEM 1.001 / DIN 15018) dayanır, ilk portun çıkış noktası olan
// hesap tablosuna değil. π hassasiyeti ve yöntem iyileştirmeleri nedeniyle
// karşılaştırma toleransı 1e-4 göreliye gevşetilmiştir.
//
// Zincir: döküm hücresi → alias → semantik anahtar → motor değeri.

import { describe, expect, it } from "vitest";
import { V5_SPECS } from "../defaults";
import {
  V5_ENDCARRIAGE_DEPS,
  V5_ENDCARRIAGE_INPUTS,
  V5_ENDCARRIAGE_SELECTIONS,
} from "../defaults/structural";
import { computeEndCarriage } from "../modules/endCarriage";
import { compareCell, isDecorative, loadFormulaCells } from "./golden";
import { ENDCARRIAGE_ALIASES, resolveAlias } from "./legacy/alias-structural";
import { tickFromCheck } from "./legacy/excel-alias";

/** Göreli karşılaştırma toleransı — bkz. dosya başı açıklaması. */
const TOLERANCE = 1e-4;

/** Motorda karşılığı BULUNMAYAN döküm hücreleri ve çıkarılma gerekçeleri. */
const KAPSAM_DISI: Record<string, string> = {
  I88: "Gösterim ikizi: fatigue.sigmaMax ile aynı değer.",
  I99: "Gösterim ikizi: fatigue.tauMax ile aynı değer.",
  // İlk portun yorulma bloğu, silinmiş bir malzeme seçim hücresine bakan
  // bozuk referanslar yüzünden hiç hesaplanamıyordu (hata değerleri üretir).
  // Motor bu bloğu ana kirişin çalışan DIN 15018 Tablo 17/18 mantığıyla
  // yeniden yazar; karşılaştırılacak sayı yoktur.
  L70: "Bozuk kaynak: silinmiş malzeme hücresine bakan tablo araması, sayı üretmiyor.",
  L71: "L70'e bağlı; kaynak hücre sayı üretmiyor.",
  L73: "L71'e bağlı; kaynak hücre sayı üretmiyor.",
  L85: "Bozuk L73 ve eksik σB hücresine bağlı; sayı üretmiyor.",
  L88: "L85'e bağlı; sayı üretmiyor.",
  N88: "L88'e bağlı tik hücresi; sayı üretmiyor.",
  L93: "Bozuk kaynak: silinmiş malzeme hücresine bakan tablo araması, sayı üretmiyor.",
  L94: "L93'e bağlı; ayrıca birim dönüşümü hatalı (·9,81 yerine ·100/9,81 olmalı).",
  L96: "L94'e bağlı; sayı üretmiyor.",
  L99: "L96'ya bağlı; sayı üretmiyor.",
  N99: "L99'a bağlı tik hücresi; sayı üretmiyor.",
  I104: "L88/L99'a bağlı bileşik oran; sayı üretmiyor.",
  N104: "I104'e bağlı tik hücresi; sayı üretmiyor.",
};

/**
 * Bilinçli olarak SAPILAN hücreler (eski → yeni + gerekçe).
 *
 * KALDIRMA SINIFI TEK KAYNAK: ilk portta başkiriş modülüne ayrıca "H2"
 * giriliyordu; oysa teknik özellikler vinci "H3/B4" olarak sınıflandırıyor.
 * Veri kendi içinde çelişiyordu. Sınıf artık tek kaynaktan (teknik özellikler)
 * okunur: H3 → k = 1,3 · l = 0,0066. Dinamik katsayı ψ 1,354'ten 1,531'e
 * çıkar; ψ ile çarpılan tüm statik gerilmeler aynı oranda (%13,07) büyür.
 * Statik kontrol yine sağlanır (σbil ≈ 1086 < 1530 kg/cm²), tik hücresi
 * değişmez. Yorulma bloğu ψ kullanmadığından etkilenmez.
 */
const SAPMA: Record<string, string> = {
  L37: "Kaldırma sınıfı H2 → H3 (teknik özelliklerdeki 'H3/B4' tek kaynak).",
  L41: "k: 1,2 → 1,3 (H3, DIN 15018 Tablo 2).",
  L42: "l: 0,0044 → 0,0066 (H3, DIN 15018 Tablo 2).",
  L39: "ψ = k + l·v: 1,354 → 1,531.",
  L45: "σ: 905,37 → 1023,72 kg/cm² (ψ oranı 1,1307).",
  L46: "τ: 185,12 → 209,32 kg/cm² (ψ oranı 1,1307).",
  L47: "σbil: 960,47 → 1086,02 kg/cm² (ψ oranı 1,1307); izin 1530 kg/cm², kontrol yine sağlanır.",
};

/** Eski tablodaki tik hücreleri → motorun kontrol kimliği. */
const TIK: Record<string, string> = {
  P47: "endCarriage.stress",
};

describe("başkiriş — tarihsel doğrulama", () => {
  const result = computeEndCarriage(
    V5_SPECS,
    V5_ENDCARRIAGE_INPUTS,
    V5_ENDCARRIAGE_SELECTIONS,
    V5_ENDCARRIAGE_DEPS
  );
  const dumpCells = loadFormulaCells("10_09_BAŞKİRİŞ.txt").filter((c) => !isDecorative(c));

  it("ilk portun sapma dışı tüm sağlam hücreleriyle eşleşir", () => {
    expect(dumpCells.length).toBeGreaterThan(20);

    const failures: string[] = [];
    for (const dc of dumpCells) {
      if (dc.cell in SAPMA) continue;

      const tikCheckId = TIK[dc.cell];
      if (tikCheckId !== undefined) {
        const actual = tickFromCheck(result.checks, tikCheckId);
        if (actual !== dc.value) {
          failures.push(`${dc.cell}: tik beklenen "${dc.value}", gelen "${actual}"`);
        }
        continue;
      }

      if (dc.cell in KAPSAM_DISI) {
        if (resolveAlias(ENDCARRIAGE_ALIASES, dc.cell, result.cells) !== undefined) {
          failures.push(`${dc.cell}: KAPSAM_DISI'nda ama eşlemesi de var — ikisinden biri fazla`);
        }
        continue;
      }

      const actual = resolveAlias(ENDCARRIAGE_ALIASES, dc.cell, result.cells);
      if (actual === undefined) {
        failures.push(
          `${dc.cell}: eşleme yok. Ya ENDCARRIAGE_ALIASES'a ekleyin ya da ` +
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

    for (const cell of Object.keys(ENDCARRIAGE_ALIASES)) {
      if (!dumpSet.has(cell)) {
        stale.push(`ENDCARRIAGE_ALIASES["${cell}"]: dökümde böyle bir hücre yok`);
      } else if (result.cells[ENDCARRIAGE_ALIASES[cell]] === undefined) {
        stale.push(
          `ENDCARRIAGE_ALIASES["${cell}"] → "${ENDCARRIAGE_ALIASES[cell]}": motor bu anahtarı üretmiyor`
        );
      }
    }
    for (const dict of [
      { name: "KAPSAM_DISI", map: KAPSAM_DISI },
      { name: "TIK", map: TIK },
    ]) {
      for (const cell of Object.keys(dict.map)) {
        if (!dumpSet.has(cell)) stale.push(`${dict.name}["${cell}"]: dökümde böyle bir hücre yok`);
      }
    }
    // SAPMA'daki L37 dökümde STATİK hücredir (formül değil), bu yüzden
    // formül listesinde aranmaz; kalanların hepsi formül hücresi olmalıdır.
    for (const cell of Object.keys(SAPMA)) {
      if (cell !== "L37" && !dumpSet.has(cell)) {
        stale.push(`SAPMA["${cell}"]: dökümde böyle bir formül hücresi yok`);
      }
    }
    expect(stale, stale.join("\n")).toEqual([]);
  });

  it("kaldırma sınıfı tek kaynaktan türetilir ve elle ezilebilir", () => {
    expect(result.cells["load.hoistClass"]).toBe("H3"); // "H3/B4"
    expect(result.cells["load.factorK"]).toBe(1.3);
    expect(result.cells["load.factorL"]).toBe(0.0066);
    expect(result.cells["load.dynamicFactor"]).toBeCloseTo(1.531, 10);

    const overridden = computeEndCarriage(
      V5_SPECS,
      V5_ENDCARRIAGE_INPUTS,
      { ...V5_ENDCARRIAGE_SELECTIONS, hoistClassOverride: "H2" },
      V5_ENDCARRIAGE_DEPS
    );
    expect(overridden.cells["load.dynamicFactor"]).toBeCloseTo(1.354, 10);
  });

  it("sapma sonrası statik kontrol hâlâ sağlanır", () => {
    expect(result.values.sigmaCombinedKgCm2).toBeGreaterThan(1085);
    expect(result.values.sigmaCombinedKgCm2).toBeLessThan(1087);
    expect(result.values.allowableKgCm2).toBe(1530);
    expect(result.checks.find((c) => c.id === "endCarriage.stress")?.pass).toBe(true);
  });

  it("yorulma kontrolleri sağlanır ve ψ'den etkilenmez", () => {
    // Yorulma gerilmeleri dinamik katsayısızdır; kaldırma sınıfı sapması
    // bu bloğu değiştirmez.
    expect(result.values.sigmaMaxKgCm2).toBeCloseTo(668.662039100809, 6);
    expect(result.values.tauMaxKgCm2).toBeCloseTo(136.71875, 6);
    for (const id of [
      "endCarriage.fatigue.sigma",
      "endCarriage.fatigue.tau",
      "endCarriage.fatigue.combined",
    ]) {
      expect(result.checks.find((c) => c.id === id)?.pass, id).toBe(true);
    }
  });
});
