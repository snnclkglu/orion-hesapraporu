// TARİHSEL DOĞRULAMA — ana kiriş.
//
// Bu bir ŞARTNAME DEĞİL, tarihsel doğrulamadır: uygulamanın hesap yöntemi
// standartlara (FEM 1.001 / DIN 15018 / CMAA 70) dayanır, ilk portun çıkış
// noktası olan hesap tablosuna değil. Burada yapılan tek şey, o ilk portta
// çıkan sayıların bugün de çıktığını doğrulayan hızlı bir regresyon ağıdır.
// π hassasiyeti ve yöntem iyileştirmeleri nedeniyle karşılaştırma toleransı
// 1e-4 göreliye gevşetilmiştir.
//
// Zincir: döküm hücresi → alias → semantik anahtar → motor değeri.
// Motorda karşılığı kalmayan hücreler KAPSAM_DISI'nda gerekçesiyle,
// bilinçli olarak sapılan hücreler SAPMA'da eski/yeni değeriyle listelenir.

import { describe, expect, it } from "vitest";
import { V5_SPECS } from "../defaults";
import {
  V5_GIRDER_DEPS,
  V5_GIRDER_INPUTS,
  V5_GIRDER_SELECTIONS,
} from "../defaults/structural";
import { computeMainGirder } from "../modules/mainGirder";
import { compareCell, isDecorative, loadFormulaCells } from "./golden";
import { GIRDER_ALIASES, resolveAlias } from "./legacy/alias-structural";
import { tickFromCheck } from "./legacy/excel-alias";

/** Göreli karşılaştırma toleransı — bkz. dosya başı açıklaması. */
const TOLERANCE = 1e-4;

/**
 * Motorda karşılığı BULUNMAYAN döküm hücreleri ve çıkarılma gerekçeleri.
 * Bu hücreler ya bir girdinin yankısı, ya başka bir hücrenin birebir kopyası,
 * ya da yalnız gösterim amaçlı ara hücrelerdir.
 */
const KAPSAM_DISI: Record<string, string> = {
  D56: "Girdi yankısı: araba ivmelenme süresi zaten modül girdisidir.",
  D60: "Girdi yankısı: köprü ivmelenme süresi zaten modül girdisidir.",
  D85: "Girdi yankısı: açıklık zaten teknik özelliklerde tanımlıdır.",
  D172: "Girdinin birim dönüşümü (araba dingil açıklığı m → mm).",
  D174: "Girdinin birim dönüşümü (açıklık m → mm).",
  D183: "Gösterim ikizi: load.bridgeDeadWeight ile aynı değer.",
  D209: "Gösterim ikizi: load.bridgeHorizontal ile aynı değer.",
  D217: "Gösterim ikizi: load.trolleySkew ile aynı değer.",
  D231: "Gösterim ikizi: load.trolleyHorizontal ile aynı değer.",
  D246: "Gösterim ikizi: load.trolleyWheelLoad ile aynı değer.",
  D254: "Gösterim ikizi: load.hoistWheelLoad ile aynı değer.",
  D286: "Gösterim ikizi: load.trolleyWheelLoad ile aynı değer.",
  D293: "Gösterim ikizi: load.hoistWheelLoad ile aynı değer.",
  D307: "Gösterim ikizi: load.bridgeDeadWeight ile aynı değer.",
  D323: "Gösterim ikizi: load.trolleyWheelLoad ile aynı değer.",
  D324: "Gösterim ikizi: section.mainWebShearArea ile aynı değer.",
  D331: "Gösterim ikizi: section.secondaryWebShearArea ile aynı değer.",
  D341: "Gösterim ikizi: load.hoistWheelLoad ile aynı değer.",
  D342: "Gösterim ikizi: section.mainWebShearArea ile aynı değer.",
  D347: "Gösterim ikizi: section.secondaryWebShearArea ile aynı değer.",
  E375: "Gösterim ikizi: stress.amplifiedSigmaXTop ile aynı değer.",
  E422: "Gösterim ikizi: fatigue.sigmaXMax ile aynı değer.",
  G422: "Gösterim ikizi: fatigue.allowableSigmaX ile aynı değer.",
  E428: "Girdi yankısı: σy,maks zaten modül girdisidir.",
  G428: "Gösterim ikizi: fatigue.allowableSigmaY ile aynı değer.",
  E433: "Gösterim ikizi: fatigue.tauMax ile aynı değer.",
  G433: "Gösterim ikizi: fatigue.allowableTau ile aynı değer.",
  G442: "Girdinin birim dönüşümü (araba dingil açıklığı mm → cm).",
  G445: "Gösterim ikizi: section.inertiaY ile aynı değer.",
};

/**
 * Bilinçli olarak SAPILAN hücreler (eski değer → yeni değer + gerekçe).
 * Ana kirişte sapma yoktur: γc artık yapı sınıfından (A6 → 1,14) ve yorulma
 * yük grubu kaldırma/yük sınıfından (H3/B4 → B4) türetilir; her ikisi de
 * eskiden elle girilen değerlerle birebir aynı sonucu verir.
 */
const SAPMA: Record<string, string> = {};

/** Eski tablodaki tik hücreleri → motorun kontrol kimliği. */
const TIK: Record<string, string> = {
  H422: "girder.fatigue.sigmaX",
  H428: "girder.fatigue.sigmaY",
  H433: "girder.fatigue.tau",
  H435: "girder.fatigue.combined",
};

describe("ana kiriş — tarihsel doğrulama", () => {
  const result = computeMainGirder(
    V5_SPECS,
    V5_GIRDER_INPUTS,
    V5_GIRDER_SELECTIONS,
    V5_GIRDER_DEPS
  );
  const dumpCells = loadFormulaCells("08_07_ANA_KİRİŞ.txt").filter((c) => !isDecorative(c));

  it("ilk portun tüm sağlam hücreleriyle eşleşir", () => {
    expect(dumpCells.length).toBeGreaterThan(150);

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
        if (resolveAlias(GIRDER_ALIASES, dc.cell, result.cells) !== undefined) {
          failures.push(`${dc.cell}: KAPSAM_DISI'nda ama eşlemesi de var — ikisinden biri fazla`);
        }
        continue;
      }

      const actual = resolveAlias(GIRDER_ALIASES, dc.cell, result.cells);
      if (actual === undefined) {
        failures.push(
          `${dc.cell}: eşleme yok. Ya GIRDER_ALIASES'a ekleyin ya da ` +
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

    for (const cell of Object.keys(GIRDER_ALIASES)) {
      if (!dumpSet.has(cell)) stale.push(`GIRDER_ALIASES["${cell}"]: dökümde böyle bir hücre yok`);
      else if (result.cells[GIRDER_ALIASES[cell]] === undefined) {
        stale.push(`GIRDER_ALIASES["${cell}"] → "${GIRDER_ALIASES[cell]}": motor bu anahtarı üretmiyor`);
      }
    }
    for (const dict of [
      { name: "KAPSAM_DISI", map: KAPSAM_DISI },
      { name: "SAPMA", map: SAPMA },
      { name: "TIK", map: TIK },
    ]) {
      for (const cell of Object.keys(dict.map)) {
        if (!dumpSet.has(cell)) stale.push(`${dict.name}["${cell}"]: dökümde böyle bir hücre yok`);
      }
    }
    expect(stale, stale.join("\n")).toEqual([]);
  });

  it("yorulma kontrollerinin tamamı sağlanır", () => {
    for (const id of Object.values(TIK)) {
      expect(result.checks.find((c) => c.id === id)?.pass, id).toBe(true);
    }
  });

  it("γc yapı sınıfından türetilir ve elle ezilebilir", () => {
    expect(result.cells["load.amplifyFactor"]).toBeCloseTo(1.14, 10); // A6
    const overridden = computeMainGirder(
      V5_SPECS,
      { ...V5_GIRDER_INPUTS, amplifyYcOverride: 1.2 },
      V5_GIRDER_SELECTIONS,
      V5_GIRDER_DEPS
    );
    expect(overridden.cells["load.amplifyFactor"]).toBe(1.2);
  });

  it("yorulma yük grubu kaldırma/yük sınıfından türetilir ve elle ezilebilir", () => {
    expect(result.cells["fatigue.loadGroup"]).toBe("B4"); // "H3/B4"
    const overridden = computeMainGirder(
      V5_SPECS,
      V5_GIRDER_INPUTS,
      { ...V5_GIRDER_SELECTIONS, fatigueLoadGroupOverride: "B2" },
      V5_GIRDER_DEPS
    );
    expect(overridden.cells["fatigue.loadGroup"]).toBe("B2");
  });
});
