// AĞIRLIK DÖKÜMÜ KARARLARININ SNAPSHOT YOLCULUĞU.
//
// Döküm bir HESAP DEĞİL bir DOĞRULAMADIR (HESAP-35) ve KENDİSİ saklanmaz —
// her açılışta girdilerden yeniden türetilir. Revizyona giden tek şey insanın
// türetilemeyen kararıdır: hangi kalemi elle verdi, neden verdi, hangi teknik
// özellik kutusuna dökümden yazdı.
//
// JSONB SERBEST BİÇİMLİDİR ve bozuk bir kayıt raporu DÜŞÜRMEMELİDİR
// (`altsFromRevision` ile aynı ilke). Bu dosya o sözleşmeyi kilitler.

import { describe, expect, it } from "vitest";
import {
  weightBreakdownFromRevision,
  type RevisionInputsJson,
  type RevisionWeightBreakdown,
} from "../revision-load";
import { diffRevisions } from "../revision-diff";
import { fieldLabel } from "../calc/labels";

function inputsWith(weightBreakdown: unknown): RevisionInputsJson {
  return { weightBreakdown } as unknown as RevisionInputsJson;
}

describe("weightBreakdownFromRevision", () => {
  it("alan hiç yoksa BOŞ döner — eski revizyon bugünkü hâlini korur", () => {
    expect(weightBreakdownFromRevision(null)).toEqual({});
    expect(weightBreakdownFromRevision(undefined)).toEqual({});
    expect(weightBreakdownFromRevision({} as RevisionInputsJson)).toEqual({});
  });

  it("geçerli kararları OLDUĞU GİBİ okur", () => {
    const kayit: RevisionWeightBreakdown = {
      overrides: { "bridge.girder": 12340 },
      notes: { "bridge.girder": "Atölye tartısı." },
      applied: { bridgeWeightT: { at: "2026-09-01T07:00:00.000Z", kg: 26400, mix: { tahmin: 0.27 } } },
    };
    expect(weightBreakdownFromRevision(inputsWith(kayit))).toEqual(kayit);
  });

  it("BOZUK ezmeler atlanır: dize, NaN, sonsuz, sıfır ve eksi", () => {
    const okunan = weightBreakdownFromRevision(
      inputsWith({
        overrides: {
          saglam: 120,
          dize: "120",
          nan: Number.NaN,
          sonsuz: Number.POSITIVE_INFINITY,
          sifir: 0,
          eksi: -5,
          nesne: { kg: 1 },
        },
      })
    );
    // `0` bir ölçüm değil BOŞ bir kutudur (değişmez md. 4): ağırlık olarak
    // saklanmaz, yoksa döküm "bu kalem sıfır kilo" der.
    expect(okunan.overrides).toEqual({ saglam: 120 });
  });

  it("boş ve dize olmayan notlar atlanır", () => {
    const okunan = weightBreakdownFromRevision(
      inputsWith({ notes: { a: "  ", b: "gerçek not", c: 5 } })
    );
    expect(okunan.notes).toEqual({ b: "gerçek not" });
  });

  it("kilosu olmayan `applied` kaydı atlanır, tarihi olmayan korunur", () => {
    const okunan = weightBreakdownFromRevision(
      inputsWith({
        applied: {
          kotu: { at: "2026-09-01", kg: "x" },
          tarihsiz: { kg: 100 },
        },
      })
    );
    expect(okunan.applied).toEqual({ tarihsiz: { at: "", kg: 100 } });
  });

  it("nesne olmayan gövde FIRLATMAZ", () => {
    for (const bozuk of [[], "metin", 5, true, null]) {
      expect(() => weightBreakdownFromRevision(inputsWith(bozuk))).not.toThrow();
      expect(weightBreakdownFromRevision(inputsWith(bozuk))).toEqual({});
    }
  });
});

describe("revizyon karşılaştırması", () => {
  const bos = { inputs: {}, selections: {}, results: {} };

  it("ezme değişimi KENDİ satırıyla görünür, ham anahtar basılmaz", () => {
    const diff = diffRevisions(bos, {
      inputs: { weightBreakdown: { overrides: { "bridge.girder": 12340 } } },
      selections: {},
      results: {},
    });
    const satir = diff.fields.find((f) => f.key === "weightBreakdownOverrides");
    expect(satir).toBeDefined();
    expect(satir?.a).toBe("—");
    expect(satir?.b).toBe("bridge.girder");
    // `weightBreakdown` sahte bir MODÜL olarak açılmamalı: `overrides.<anahtar>`
    // biçiminde ham satırlar MODULE_LABELS'ta karşılığı olmayan bir bölüm
    // başlığı altında basılırdı (MALIYET-18 tuzağı).
    expect(diff.fields.some((f) => f.module === "weightBreakdown")).toBe(false);
    expect(diff.fields.some((f) => f.key.startsWith("overrides."))).toBe(false);
  });

  it("ezme değişmediyse satır HİÇ çıkmaz", () => {
    const kayit = { weightBreakdown: { overrides: { a: 1 } } };
    const diff = diffRevisions(
      { inputs: kayit, selections: {}, results: {} },
      { inputs: kayit, selections: {}, results: {} }
    );
    expect(diff.fields.some((f) => f.key === "weightBreakdownOverrides")).toBe(false);
  });

  it("NOT değişmesi tek başına fark satırı üretmez (ezme listesi aynı)", () => {
    const diff = diffRevisions(
      { inputs: { weightBreakdown: { overrides: { a: 1 }, notes: { a: "x" } } }, selections: {}, results: {} },
      { inputs: { weightBreakdown: { overrides: { a: 1 }, notes: { a: "y" } } }, selections: {}, results: {} }
    );
    expect(diff.fields.some((f) => f.key === "weightBreakdownOverrides")).toBe(false);
  });

  it("satırın TÜRKÇE bir etiketi vardır", () => {
    expect(fieldLabel("weightBreakdownOverrides").label).toBe(
      "Ağırlık Dökümü — Elle Verilen Kalemler"
    );
  });
});
