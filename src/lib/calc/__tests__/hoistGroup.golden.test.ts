// Kaldırma grubu — TARİHSEL DOĞRULAMA.
//
// Bu bir ŞARTNAME DEĞİL, tarihsel doğrulamadır. Motorun hesap yöntemi doğrudan
// standartlara dayanır (FEM 1.001 / DIN 15061 / CMAA 70) ve büyüklükleri
// semantik anahtarlarla adresler; buradaki eski döküm yalnızca "ilk portta şu
// sayı çıkıyordu" bilgisini saklayan bir regresyon ağıdır. Uyuşmazlık çıktığında
// önce motorun standarda göre doğruluğu incelenir — öncelik her zaman motorun
// kendi yöntemindedir (bkz. legacy/README.md).
//
// TOLERANS 1e-4 GÖRELİDİR (eskiden 1e-6): eski tablo bazı hücrelerde π yerine
// 3,14159 kısaltmasını kullanıyordu, motor her yerde tam π kullanır; ayrıca
// kiriş statiği ve mil gerilmeleri artık ortak kütüphanelerden (beam.ts,
// shaftStress.ts) gelir. Bu iyileştirmeler ~1e-6 mertebesinde göreli fark
// üretir; tolerans buna göre gevşetilmiştir.
//
// Zincir: döküm hücresi → alias → semantik anahtar → motor değeri.

import { describe, expect, it } from "vitest";
import {
  V5_AUX_HOIST_INPUTS,
  V5_AUX_HOIST_SELECTIONS,
  V5_MAIN_HOIST_INPUTS,
  V5_MAIN_HOIST_SELECTIONS,
  V5_SPECS,
} from "../defaults";
import { computeHoistGroup } from "../modules/hoistGroup";
import { compareCell, isDecorative, loadFormulaCells, type DumpCell } from "./golden";
import {
  HOIST_ALIASES,
  HOIST_KAPSAM_DISI,
  HOIST_SAPMA,
  HOIST_TICK_CHECKS,
} from "./legacy/alias-hoist";
import { tickFromCheck } from "./legacy/excel-alias";

/** Tarihsel karşılaştırma toleransı — göreli. */
const REL_TOL = 1e-4;

interface Variant {
  which: "main" | "aux";
  dumpFile: string;
  title: string;
}

const VARIANTS: Variant[] = [
  { which: "main", dumpFile: "03_02_ANA_KALDIRMA_GRUBU.txt", title: "ana kaldırma" },
  { which: "aux", dumpFile: "04_03_YRD_KALDIRMA_GRUBU.txt", title: "yardımcı kaldırma" },
];

function run(which: "main" | "aux") {
  return computeHoistGroup(
    V5_SPECS,
    which,
    which === "main" ? V5_MAIN_HOIST_INPUTS : V5_AUX_HOIST_INPUTS,
    which === "main" ? V5_MAIN_HOIST_SELECTIONS : V5_AUX_HOIST_SELECTIONS
  );
}

function dumpCellsOf(file: string): DumpCell[] {
  return loadFormulaCells(file).filter((c) => !isDecorative(c));
}

/** İki dökümde geçen tüm hücre adresleri — sözlük bayatlama denetimi için. */
const ALL_DUMP_CELLS = new Set<string>(
  VARIANTS.flatMap((v) => dumpCellsOf(v.dumpFile).map((c) => c.cell))
);

describe("kaldırma grubu — tarihsel doğrulama (şartname değil)", () => {
  for (const variant of VARIANTS) {
    it(`${variant.title}: eski dökümün her hücresi ya eşlenir ya gerekçelendirilir`, () => {
      const result = run(variant.which);
      const dumpCells = dumpCellsOf(variant.dumpFile);
      expect(dumpCells.length).toBeGreaterThan(100);

      const failures: string[] = [];
      for (const dc of dumpCells) {
        // Bilinçli sapma ve kapsam dışı hücreler karşılaştırmaya girmez.
        if (HOIST_SAPMA[dc.cell] !== undefined) continue;
        if (HOIST_KAPSAM_DISI[dc.cell] !== undefined) continue;

        // Tik/çarpı hücreleri: motorda kontrolün `pass` alanından türetilir.
        const checkSuffix = HOIST_TICK_CHECKS[dc.cell];
        if (checkSuffix !== undefined) {
          const tick = tickFromCheck(result.checks, `${variant.which}.${checkSuffix}`);
          if (tick !== dc.value) {
            failures.push(
              `${dc.cell}: kontrol "${checkSuffix}" → beklenen "${dc.value}", gelen "${tick}"`
            );
          }
          continue;
        }

        const semanticKey = HOIST_ALIASES[dc.cell];
        if (semanticKey === undefined) {
          failures.push(
            `${dc.cell}: eşleme yok. Motorda karşılığı varsa HOIST_ALIASES'a ekleyin; ` +
              `yoksa gerekçesiyle HOIST_KAPSAM_DISI'na yazın.  [${dc.formula}]`
          );
          continue;
        }
        const { ok, message } = compareCell(dc.value, result.cells[semanticKey], REL_TOL);
        if (!ok) failures.push(`${dc.cell} → ${semanticKey}: ${message}  [${dc.formula}]`);
      }
      expect(failures, failures.join("\n")).toEqual([]);
    });
  }

  it("ana kaldırmada redüktör torku V5'te de yetersizdi (22 < 22,07 kNm)", () => {
    // Tarihsel durumun korunduğunu doğrular: motor bu kontrolü de aynı sonuçla
    // üretmelidir, aksi hâlde tork zinciri sessizce kaymış demektir.
    const check = run("main").checks.find((c) => c.id === "main.gearbox.torque");
    expect(check?.pass).toBe(false);
  });

  it("tambur rulmanı iç çapı milin D2 oturma çapıyla birebir eşleşir", () => {
    const calculate = (bearingBoreMm: number) => computeHoistGroup(
      V5_SPECS,
      "main",
      V5_MAIN_HOIST_INPUTS,
      { ...V5_MAIN_HOIST_SELECTIONS, bearingBoreMm }
    ).checks.find((check) => check.id === "main.bearing.bore");
    expect(calculate(V5_MAIN_HOIST_INPUTS.shaftD2Mm)?.pass).toBe(true);
    expect(calculate(V5_MAIN_HOIST_INPUTS.shaftD2Mm + 0.1)?.pass).toBe(false);
  });

  it("eşleme ve gerekçe sözlükleri bayatlamamıştır", () => {
    const stale: string[] = [];
    const check = (sozluk: string, keys: string[]) => {
      for (const cell of keys) {
        if (!ALL_DUMP_CELLS.has(cell)) {
          stale.push(`${sozluk}: "${cell}" artık hiçbir dökümde yok — kaydı silin.`);
        }
      }
    };
    check("HOIST_ALIASES", Object.keys(HOIST_ALIASES));
    check("HOIST_TICK_CHECKS", Object.keys(HOIST_TICK_CHECKS));
    check("HOIST_KAPSAM_DISI", Object.keys(HOIST_KAPSAM_DISI));
    check("HOIST_SAPMA", Object.keys(HOIST_SAPMA));

    // Aynı hücre iki sözlükte birden bulunmamalı — hangi kuralın geçerli
    // olduğu belirsiz kalır.
    const buckets: Record<string, string[]> = {};
    const note = (sozluk: string, keys: string[]) => {
      for (const cell of keys) (buckets[cell] ??= []).push(sozluk);
    };
    note("HOIST_ALIASES", Object.keys(HOIST_ALIASES));
    note("HOIST_TICK_CHECKS", Object.keys(HOIST_TICK_CHECKS));
    note("HOIST_KAPSAM_DISI", Object.keys(HOIST_KAPSAM_DISI));
    note("HOIST_SAPMA", Object.keys(HOIST_SAPMA));
    for (const [cell, where] of Object.entries(buckets)) {
      if (where.length > 1) {
        stale.push(`"${cell}" birden çok sözlükte: ${where.join(", ")}.`);
      }
    }

    expect(stale, stale.join("\n")).toEqual([]);
  });

  it("her semantik anahtarın motorda gerçek bir karşılığı vardır", () => {
    const result = run("main");
    const missing = [...new Set(Object.values(HOIST_ALIASES))].filter(
      (key) => result.cells[key] === undefined
    );
    // `drumBearing.requiredLifeMax` yalnız üst sınırı olan kullanım
    // sınıflarında üretilir; V5 fikstürü (T6) bu değeri üretir.
    expect(
      missing,
      `Motorun üretmediği anahtar(lar): ${missing.join(", ")}`
    ).toEqual([]);
  });
});
