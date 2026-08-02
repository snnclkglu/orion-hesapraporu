// Yürütme grubu — TARİHSEL DOĞRULAMA.
//
// Bu bir ŞARTNAME DEĞİL, tarihsel doğrulamadır: uygulamanın hesap yöntemini
// eski hesap tablosu tanımlamaz, FEM 1.001 / CMAA 70 tanımlar. Buradaki
// karşılaştırma yalnızca bir hesap zincirinin farkında olmadan bozulduğunu
// yakalayan bir uyarı zilidir.
//
// Karşılaştırma toleransı 1e-4 GÖRELİDİR: π hassasiyetinin tam kullanılması ve
// kiriş/gerilme hesabının ortak çözücülere taşınması gibi yöntem iyileştirmeleri
// son basamaklarda küçük farklar üretir; tolerans buna göre gevşetilmiştir.
//
// Akış: döküm hücresi → alias → semantik anahtar → motor değeri.
// Tik/çarpı hücreleri motorda YOKTUR; `tickFromCheck` ile kontrol sonucundan
// türetilir. Motorda karşılığı kalmayan hücreler gerekçeleriyle KAPSAM_DISI
// sözlüklerinde toplanır ve testler bu sözlüklerin bayatlamadığını da doğrular.

import { describe, expect, it } from "vitest";
import { V5_SPECS } from "../defaults";
import {
  V5_BRIDGE_INPUTS,
  V5_BRIDGE_SELECTIONS,
  V5_TRAVEL_DEPS,
  V5_TROLLEY_INPUTS,
  V5_TROLLEY_SELECTIONS,
} from "../defaults/travel";
import { computeTravelGroup, type TravelWhich } from "../modules/travelGroup";
import { compareCell, isDecorative, loadFormulaCells, type DumpCell } from "./golden";
import {
  BRIDGE_ALIASES,
  BRIDGE_KAPSAM_DISI,
  BRIDGE_SAPMA,
  BRIDGE_TICKS,
  TROLLEY_ALIASES,
  TROLLEY_KAPSAM_DISI,
  TROLLEY_SAPMA,
  TROLLEY_TICKS,
} from "./legacy/alias-travel";
import { tickFromCheck, type AliasMap } from "./legacy/excel-alias";

/** Göreli tolerans — şartname değil, tarihsel karşılaştırma toleransı. */
const REL_TOL = 1e-4;

interface Fixture {
  which: TravelWhich;
  dumpFile: string;
  aliases: AliasMap;
  ticks: Record<string, string>;
  kapsamDisi: Record<string, string>;
  sapma: Record<string, string>;
}

const FIXTURES: Fixture[] = [
  {
    which: "trolley",
    dumpFile: "06_05_ARABA_YÜRÜTME_GRUBU.txt",
    aliases: TROLLEY_ALIASES,
    ticks: TROLLEY_TICKS,
    kapsamDisi: TROLLEY_KAPSAM_DISI,
    sapma: TROLLEY_SAPMA,
  },
  {
    which: "bridge",
    dumpFile: "07_06_KÖPRÜ_YÜRÜTME_GRUBU.txt",
    aliases: BRIDGE_ALIASES,
    ticks: BRIDGE_TICKS,
    kapsamDisi: BRIDGE_KAPSAM_DISI,
    sapma: BRIDGE_SAPMA,
  },
];

function runModule(which: TravelWhich) {
  return computeTravelGroup(
    V5_SPECS,
    which,
    which === "trolley" ? V5_TROLLEY_INPUTS : V5_BRIDGE_INPUTS,
    which === "trolley" ? V5_TROLLEY_SELECTIONS : V5_BRIDGE_SELECTIONS,
    V5_TRAVEL_DEPS
  );
}

/** Dökümdeki karşılaştırılabilir hücreler (süsleme ve hata değerleri elenir) */
function comparableCells(dumpFile: string): DumpCell[] {
  return loadFormulaCells(dumpFile)
    .filter((c) => !isDecorative(c))
    .filter(
      (c) => !(typeof c.value === "string" && (c.value.startsWith("#") || c.value === "None"))
    );
}

describe.each(FIXTURES)("yürütme grubu tarihsel doğrulama — $which", (fx) => {
  const result = runModule(fx.which);
  const dumpCells = comparableCells(fx.dumpFile);

  it("döküm yüzeyi beklenen büyüklükte (fikstür bozulmamış)", () => {
    expect(dumpCells.length).toBeGreaterThan(90);
  });

  it("eşlemesi olan her hücre motorun semantik anahtarıyla örtüşür", () => {
    const failures: string[] = [];
    for (const dc of dumpCells) {
      if (dc.cell in fx.sapma) continue; // bilinçli sapma — karşılaştırmadan çıkarıldı
      const checkId = fx.ticks[dc.cell];
      if (checkId !== undefined) {
        const actual = tickFromCheck(result.checks, checkId);
        if (actual === undefined) {
          failures.push(`${dc.cell}: "${checkId}" kontrolü motorda üretilmiyor`);
        } else if (actual !== dc.value) {
          failures.push(`${dc.cell}: beklenen "${dc.value}", gelen "${actual}" (${checkId})`);
        }
        continue;
      }
      const key = fx.aliases[dc.cell];
      if (key === undefined) continue; // eşlemesiz hücreler ayrı test tarafından kovalanır
      const { ok, message } = compareCell(dc.value, result.cells[key], REL_TOL);
      if (!ok) failures.push(`${dc.cell} → ${key}: ${message}  [${dc.formula}]`);
    }
    expect(failures, failures.join("\n")).toEqual([]);
  });

  it("dökümdeki her hücrenin bir karşılığı ya da yazılı gerekçesi var", () => {
    const unmapped = dumpCells
      .map((c) => c.cell)
      .filter(
        (cell) =>
          !(cell in fx.aliases) &&
          !(cell in fx.ticks) &&
          !(cell in fx.kapsamDisi) &&
          !(cell in fx.sapma)
      );
    expect(
      unmapped,
      `Eşlemesi de gerekçesi de olmayan hücre(ler): ${unmapped.join(", ")}.\n` +
        `YAPILACAK: hücre motorda üretiliyorsa alias-travel.ts haritasına ekleyin; ` +
        `üretilmiyorsa KAPSAM_DISI sözlüğüne TEK CÜMLELİK gerekçesiyle yazın.`
    ).toEqual([]);
  });

  it("KAPSAM_DISI ve SAPMA sözlükleri bayatlamamış", () => {
    const dumpCellSet = new Set(dumpCells.map((c) => c.cell));
    const stale: string[] = [];
    for (const [cell, reason] of Object.entries({ ...fx.kapsamDisi, ...fx.sapma })) {
      if (!dumpCellSet.has(cell)) {
        stale.push(`${cell}: dökümde artık böyle bir hücre yok — kaydı silin. (${reason})`);
      }
      if (cell in fx.aliases || cell in fx.ticks) {
        stale.push(`${cell}: hem eşlemesi hem gerekçesi var — birini kaldırın.`);
      }
    }
    expect(stale, stale.join("\n")).toEqual([]);
  });

  it("her alias hedefi motorun ürettiği bir anahtarı gösterir", () => {
    const dead = Object.entries(fx.aliases)
      .filter(([, key]) => result.cells[key] === undefined)
      .map(([cell, key]) => `${cell} → ${key}`);
    expect(
      dead,
      `Ölü eşleme (haritada var, motorda yok): ${dead.join(", ")}.\n` +
        `YAPILACAK: anahtar yeniden adlandırıldıysa haritayı güncelleyin; büyüklük ` +
        `motordan çıkarıldıysa hücreyi KAPSAM_DISI'na gerekçesiyle taşıyın.`
    ).toEqual([]);
  });
});

describe("yürütme grubu — varyant davranışı", () => {
  it("araba varyantında yürütme freni hesaplanmaz", () => {
    const trolley = runModule("trolley");
    expect(trolley.checks.find((c) => c.id === "trolley.brake.torque")).toBeUndefined();
    expect(trolley.cells["brake.requiredTorque"]).toBeUndefined();
    expect(trolley.values.requiredBrakeTorqueNm).toBeNull();
  });

  it("köprüde fren seçilmemişse fren kontrolü uygun çıkmaz", () => {
    const bridge = runModule("bridge");
    const brake = bridge.checks.find((c) => c.id === "bridge.brake.torque");
    expect(brake?.pass).toBe(false);
  });

  it("her iki varyant da aynı semantik anahtar kümesini üretir (fren ve köprüye özgü ağırlıklar dışında)", () => {
    const onlyBridge = new Set(["brake.requiredTorque", "weight.crane", "weight.bridgeTotal"]);
    const trolleyKeys = Object.keys(runModule("trolley").cells).sort();
    const bridgeKeys = Object.keys(runModule("bridge").cells)
      .filter((k) => !onlyBridge.has(k))
      .sort();
    expect(bridgeKeys).toEqual(trolleyKeys);
  });

  it("mekanizma ve kullanım sınıfı yürütmenin KENDİ sınıfından okunur", () => {
    // Köprü sınıfı değiştirilince araba sonucu değişmemeli, köprününki değişmeli.
    const specs = { ...V5_SPECS, bridgeMechanismClass: "M3" as const, bridgeUsageClass: "T3" as const };
    const bridge = computeTravelGroup(
      specs, "bridge", V5_BRIDGE_INPUTS, V5_BRIDGE_SELECTIONS, V5_TRAVEL_DEPS
    );
    const trolley = computeTravelGroup(
      specs, "trolley", V5_TROLLEY_INPUTS, V5_TROLLEY_SELECTIONS, V5_TRAVEL_DEPS
    );
    expect(bridge.values.c2).toBe(1.12);              // M3 → 1,12
    expect(trolley.values.c2).toBe(0.9);              // araba hâlâ M6 → 0,9
    expect(bridge.values.requiredLifeMin).not.toBe(trolley.values.requiredLifeMin);
  });

  it("redüktör emniyet kontrolü her iki varyantta da aynı kimlikle üretilir", () => {
    for (const which of ["trolley", "bridge"] as const) {
      const r = runModule(which);
      expect(r.checks.find((c) => c.id === `${which}.gearbox.safety`)).toBeDefined();
      expect(r.checks.find((c) => c.id === `${which}.gearbox.torque`)).toBeUndefined();
    }
  });

  it("üretilen anahtarların tamamı iki segmentli semantik biçimdedir", () => {
    for (const which of ["trolley", "bridge"] as const) {
      for (const key of Object.keys(runModule(which).cells)) {
        expect(key, `geçersiz anahtar: ${key}`).toMatch(/^[a-z][A-Za-z0-9]*\.[a-z][A-Za-z0-9]*$/);
      }
    }
  });
});
