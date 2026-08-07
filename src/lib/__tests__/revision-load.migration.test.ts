// Şema göçü koruma testi: tambur mili ölçüleri cm → mm.
//
// Eski revizyonlar tambur mili ölçülerini cm alanlarında saklıyordu
// (`drumSpanACm`, `shaftD1Cm`, `drumWeldThicknessCm` …). Alanlar mm'ye
// taşındı; `withDefaults` AD BAZLI çalıştığı için göç OLMASAYDI eski
// kayıtlardaki ölçüler tanınmaz, yeni `*Mm` alanları ŞABLON değerine düşer ve
// mühendisin girdiği tambur SESSİZCE başka bir tamburla değiştirilirdi.
//
// Fikstür bu yüzden ŞABLONDAN FARKLI ölçüler kullanır: göç kaldırılırsa
// testler şablon değerine düştüğü için kırılır (aynı değerler kullanılsaydı
// test göçü hiç kilitlemezdi).
//
// Kilitlenen iki davranış:
//   1. Eski biçimli bir revizyon yüklendiğinde ölçüler korunur (×10 ile mm).
//   2. Aynı revizyonun hesabı, ölçüler doğrudan mm girilmiş hâliyle BİREBİR
//      aynı sonucu verir.

import { describe, expect, it } from "vitest";
import { V5_TEMPLATE } from "@/lib/calc/defaults";
import { runCalc, type CalcInput } from "@/lib/calc/engine";
import { MODULE_ORDER } from "@/lib/calc/presentation/module-family";
import {
  CALC_FIELD,
  loadRevision,
  migrateDrumShaftUnits,
  type RevisionInputsJson,
  type RevisionSelectionsJson,
} from "@/lib/revision-load";

/**
 * Fikstürün tambur mili ölçüleri — ŞABLONDAN KASITLI OLARAK FARKLI.
 * Anahtar: yeni (mm) alan adı · [eski cm alan adı, cm değeri, beklenen mm].
 */
const DIMS: ReadonlyArray<readonly [mmKey: string, cmKey: string, cm: number, mm: number]> = [
  ["drumSpanAMm", "drumSpanACm", 7, 70],
  ["drumSpanBMm", "drumSpanBCm", 4.5, 45],
  ["drumSpanCMm", "drumSpanCCm", 25, 250],
  ["drumSpanDMm", "drumSpanDCm", 70, 700],
  ["drumSpanEMm", "drumSpanECm", 25, 250],
  ["drumSpanFMm", "drumSpanFCm", 4.5, 45],
  ["drumSpanGMm", "drumSpanGCm", 7, 70],
  ["shaftD1Mm", "shaftD1Cm", 7, 70],
  ["shaftD2Mm", "shaftD2Cm", 5.5, 55],
  ["drumWeldThicknessMm", "drumWeldThicknessCm", 1.8, 18],
  ["shaftWeldThicknessMm", "shaftWeldThicknessCm", 1.2, 12],
];

/** Kaldırma girdilerini ESKİ (cm) biçimde yazar: *Mm alanları kayıtta YOKTUR. */
function legacyHoistInputs(inputs: object): Record<string, unknown> {
  const out: Record<string, unknown> = { ...(inputs as Record<string, unknown>) };
  for (const [mmKey, cmKey, cm] of DIMS) {
    delete out[mmKey];
    out[cmKey] = cm;
  }
  return out;
}

/** Aynı tamburun YENİ (mm) biçimdeki karşılığı. */
function modernHoistInputs(inputs: object): Record<string, unknown> {
  const out: Record<string, unknown> = { ...(inputs as Record<string, unknown>) };
  for (const [mmKey, , , mm] of DIMS) out[mmKey] = mm;
  return out;
}

/** V5 şablonundan revizyon snapshot'ı (inputs/selections jsonb) üretir. */
function snapshotOf(
  template: CalcInput,
  hoistInputsOf: (inputs: object) => Record<string, unknown>
): { inputs: RevisionInputsJson; selections: RevisionSelectionsJson } {
  const src = template as unknown as Record<
    string,
    { inputs: object; selections?: object } | undefined
  >;
  const inputs: Record<string, unknown> = { specs: template.specs, disabledModules: [] };
  const selections: Record<string, unknown> = {};
  for (const key of MODULE_ORDER) {
    const field = CALC_FIELD[key];
    const mod = src[field];
    if (!mod) continue;
    inputs[field] = field.endsWith("Hoist") ? hoistInputsOf(mod.inputs) : mod.inputs;
    if (mod.selections) selections[field] = mod.selections;
  }
  return {
    inputs: inputs as RevisionInputsJson,
    selections: selections as RevisionSelectionsJson,
  };
}

describe("revizyon göçü — tambur mili ölçüleri cm → mm", () => {
  const legacy = snapshotOf(V5_TEMPLATE, legacyHoistInputs);
  const modern = snapshotOf(V5_TEMPLATE, modernHoistInputs);

  it("fikstür gerçekten eski biçimdedir ve şablondan farklıdır", () => {
    const stored = legacy.inputs.mainHoist as unknown as Record<string, unknown>;
    for (const [mmKey, cmKey, cm] of DIMS) {
      expect(stored[mmKey], mmKey).toBeUndefined();
      expect(stored[cmKey], cmKey).toBe(cm);
    }
    const tpl = V5_TEMPLATE.mainHoist!.inputs as unknown as Record<string, unknown>;
    // En az bir ölçü şablondan farklı olmalı; aksi hâlde test göçü kilitlemez.
    expect(DIMS.some(([mmKey, , , mm]) => tpl[mmKey] !== mm)).toBe(true);
  });

  it("eski *Cm ölçüleri ×10 ile *Mm alanlarına taşınır (şablona DÜŞMEZ)", () => {
    const inp = loadRevision(legacy.inputs, legacy.selections).input.mainHoist!.inputs;
    const rec = inp as unknown as Record<string, unknown>;
    for (const [mmKey, , , mm] of DIMS) expect(rec[mmKey], mmKey).toBe(mm);
    expect(inp.drumSpanAMm).toBe(70);
    expect(inp.drumSpanDMm).toBe(700);
    expect(inp.shaftWeldThicknessMm).toBe(12);
  });

  it("yardımcı kaldırma grubu da göç eder", () => {
    const aux = loadRevision(legacy.inputs, legacy.selections).input.auxHoist!.inputs;
    expect(aux.drumSpanDMm).toBe(700);
    expect(aux.shaftD1Mm).toBe(70);
  });

  it("kanca bloğu ve teker mili eski cm girdilerini mm olarak korur", () => {
    const hook = migrateDrumShaftUnits(
      { shaftEdgeGapCm: 5, shaftSheavePitchCm: 10, shaftCenterGapCm: 15, shaftD1Cm: 6.5 },
      { ...V5_TEMPLATE.hookBlock!.inputs }
    );
    expect(hook).toMatchObject({ shaftEdgeGapMm: 50, shaftSheavePitchMm: 100, shaftCenterGapMm: 150, shaftD1Mm: 65 });
    const travel = migrateDrumShaftUnits(
      { shaftSpanACm: 7.25, shaftSpanBCm: 9, shaftDiaCm: 11 },
      { ...V5_TEMPLATE.trolley!.inputs }
    );
    expect(travel).toMatchObject({ shaftSpanAMm: 72.5, shaftSpanBMm: 90, shaftDiaMm: 110 });
  });

  it("eski biçimli revizyonun hesabı mm biçimiyle BİREBİR aynıdır", () => {
    const fromLegacy = runCalc(loadRevision(legacy.inputs, legacy.selections).input);
    const fromModern = runCalc(loadRevision(modern.inputs, modern.selections).input);
    for (const field of ["mainHoist", "auxHoist"] as const) {
      expect(fromLegacy[field]!.cells, field).toEqual(fromModern[field]!.cells);
      expect(fromLegacy[field]!.values, field).toEqual(fromModern[field]!.values);
    }
  });

  it("göç edilen ölçüler hesaba GERÇEKTEN girer (şablon sonucuyla aynı değil)", () => {
    // Fikstür tamburu şablondan farklı olduğuna göre mesnet açıklığı da farklı
    // olmalıdır; eşit çıkarsa göç değil şablon değeri hesaba girmiş demektir.
    const fromLegacy = runCalc(loadRevision(legacy.inputs, legacy.selections).input);
    const fromTemplate = runCalc(V5_TEMPLATE);
    expect(fromLegacy.mainHoist!.values.drumShaftSpanCm).toBeCloseTo(143, 9);
    expect(fromTemplate.mainHoist!.values.drumShaftSpanCm).toBeCloseTo(130, 9);
  });

  it("yeni biçimli kayıt göçten etkilenmez (çift dönüşüm yok)", () => {
    const stored = modern.inputs.mainHoist as unknown as Record<string, unknown>;
    const merged = { ...stored };
    const out = migrateDrumShaftUnits(stored, merged);
    expect(out.drumSpanAMm).toBe(70);
    expect(out).toBe(merged); // hiç değişiklik yapılmadı
  });

  it("kayıtta ne *Mm ne *Cm varsa şablon değeri korunur", () => {
    const merged = { drumSpanAMm: 60, shaftD1Mm: 60 };
    const out = migrateDrumShaftUnits({ drumWeightKg: 800 }, merged);
    expect(out).toEqual(merged);
  });
});
