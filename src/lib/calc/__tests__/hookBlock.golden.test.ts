// Golden testler: kanca bloğu motoru, Excel V5 "04-KANCA BLOĞU" sayfasının
// SAĞLAM formül hücreleriyle birebir karşılaştırılır. Sayfanın §4.6 yorulma
// bloğu Excel'de bozuktur (#ref!) — bu hücreler açıklamalı exclude listesiyle
// hariç tutulur ve motor bunları temiz yeniden yazımla (nonExcel kontroller)
// üretir; hücre haritasına koymaz.

import { describe, expect, it } from "vitest";
import { V5_SPECS } from "../defaults";
import {
  V5_HOOKBLOCK_DEPS,
  V5_HOOKBLOCK_INPUTS,
  V5_HOOKBLOCK_SELECTIONS,
} from "../defaults/hookBlock";
import { computeHookBlock } from "../modules/hookBlock";
import { compareCell, isDecorative, loadFormulaCells } from "./golden";

/**
 * Excel'in bozuk hücreleri (silinmiş malzeme dropdown'ına giden #ref!
 * referansları ve bunlara bağlı zincir) — dökümdeki VALUE alanları
 * #NAME? / #VALUE! hata metnidir, karşılaştırılamaz. Sebepleriyle:
 */
const BROKEN_CELLS: Record<string, string> = {
  L134: "=IF(#ref!=\"S355JR\",2300,...) — silinmiş malzeme hücresine #ref!",
  P132: "=IF(L132<=L134,...) — bozuk L134'e bağlı kontrol tiki",
  L154: "zul σ D(-1): HLOOKUP+MATCH içinde #ref! malzeme koşulu",
  L155: "=L154*100/9.81 — bozuk L154'e bağlı",
  L157: "=L155*5/3 — bozuk L155'e bağlı",
  L169: "zul σ Dz(x): bozuk L157 ve bozuk L166 (ölü ArrayFormula) girdileri",
  L172: "=L169 — bozuk L169'un gösterimi",
  N172: "=IF(I172<=L172,...) — bozuk L172'ye bağlı kontrol tiki",
  L177: "zul τ (W0): HLOOKUP+MATCH içinde #ref! malzeme koşulu",
  L178: "=L177*9.81 — bozuk L177'ye bağlı",
  L180: "=L178/SQRT(3) — bozuk L178'e bağlı",
  L183: "=L180 — bozuk L180'in gösterimi",
  N183: "=IF(I183<=L183,...) — bozuk L183'e bağlı kontrol tiki",
  I188: "bileşik yorulma oranı — bozuk L172/L183'e bağlı",
  N188: "=IF(I188<=L188,...) — bozuk I188'e bağlı kontrol tiki",
};
// Not: L166 (σB, ölü ArrayFormula) dökümde STATIC repr olarak durur; golden
// yükleyicisi zaten sadece FORMULA satırlarını okuduğundan listede yer almaz.

describe("hookBlock golden — Excel V5", () => {
  it("04-KANCA BLOĞU sayfasının tüm sağlam formül hücreleriyle eşleşir", () => {
    const result = computeHookBlock(
      V5_SPECS,
      V5_HOOKBLOCK_INPUTS,
      V5_HOOKBLOCK_SELECTIONS,
      V5_HOOKBLOCK_DEPS
    );

    const dumpCells = loadFormulaCells("05_04_KANCA_BLOĞU.txt").filter(
      (c) => !isDecorative(c)
    );

    // Hata değerli (bozuk) hücrelerin tamamı exclude listesinde olmalı;
    // listede olup sağlam görünen hücre de olmamalı (liste bayatlamasın).
    const isError = (v: number | string) =>
      typeof v === "string" && (v.startsWith("#") || v === "" || v === "None");
    for (const c of dumpCells) {
      if (isError(c.value)) {
        expect(
          BROKEN_CELLS,
          `${c.cell} hata değeri taşıyor ama exclude listesinde değil`
        ).toHaveProperty(c.cell);
      }
    }
    for (const cell of Object.keys(BROKEN_CELLS)) {
      const dc = dumpCells.find((c) => c.cell === cell);
      expect(dc, `${cell} exclude listesinde ama dökümde yok`).toBeDefined();
      expect(
        isError(dc!.value),
        `${cell} exclude listesinde ama dökümdeki değeri sağlam (${dc!.value})`
      ).toBe(true);
    }

    const sound = dumpCells.filter(
      (c) => !isError(c.value) && !(c.cell in BROKEN_CELLS)
    );
    expect(sound.length).toBeGreaterThanOrEqual(50);

    const failures: string[] = [];
    for (const dc of sound) {
      const { ok, message } = compareCell(dc.value, result.cells[dc.cell]);
      if (!ok) failures.push(`${dc.cell}: ${message}  [${dc.formula}]`);
    }
    expect(failures, failures.join("\n")).toEqual([]);

    // Motor, bozuk hücreleri haritaya koymamalı (yeniden yazım values/checks'te).
    for (const cell of Object.keys(BROKEN_CELLS)) {
      expect(result.cells[cell], `${cell} cells haritasında olmamalı`).toBeUndefined();
    }
  });

  it("Excel V5'in bilinen kontrol durumlarını yeniden üretir", () => {
    const result = computeHookBlock(
      V5_SPECS,
      V5_HOOKBLOCK_INPUTS,
      V5_HOOKBLOCK_SELECTIONS,
      V5_HOOKBLOCK_DEPS
    );
    const byId = (id: string) => result.checks.find((c) => c.id === id);

    // Bilinen V5 durumu: makara rulmanı ömrü yetersiz (2707 < 6300 saat).
    expect(byId("hookBlock.sheaveBearing.life")?.pass).toBe(false);
    // Bilinen V5 durumu: mil bileşik gerilmesi C45 iznini aşar (1596 > 1180).
    expect(byId("hookBlock.shaft.stress")?.pass).toBe(false);
    // Makara çapı ve kanca rulmanı sağlanır.
    expect(byId("hookBlock.sheave.dia")?.pass).toBe(true);
    expect(byId("hookBlock.hookBearing.static")?.pass).toBe(true);

    // Yeniden yazılan §4.6: S235JR/B6/K3 için tüm yorulma kontrolleri geçer
    // ve Excel'de karşılığı olmadığından nonExcel işaretlidir.
    for (const id of [
      "hookBlock.girder.static",
      "hookBlock.fatigue.sigma",
      "hookBlock.fatigue.tau",
      "hookBlock.fatigue.combined",
    ]) {
      const check = byId(id);
      expect(check?.pass, id).toBe(true);
      expect(check?.nonExcel, id).toBe(true);
    }

    // Yeniden yazım ara değerleri: DIN 15018 T17 St37/K3/B6 = 45 N/mm².
    expect(result.values.fatigueSigmaD1Nmm2).toBe(45);
    expect(result.values.fatigueTauW0Nmm2).toBe(120); // St37/W0/B6
    expect(result.values.fatigueSigmaDz0KgCm2).toBeCloseTo((45 * 100 / 9.81) * 5 / 3, 6);
    expect(result.values.kappa).toBeCloseTo(0.466666666666667, 9);
  });
});
