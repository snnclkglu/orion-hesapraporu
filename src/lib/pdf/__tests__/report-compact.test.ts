// Kompakt (basit) raporun planı ve yerleşim çekirdeği.
//
// PLAN KORUMASI: plandaki her anahtar adaptörde GERÇEKTEN var olmalıdır.
// Yanlış yazılmış ya da sonradan yeniden adlandırılmış bir anahtar çizimde
// sessizce düşer (kart o satırı basmaz, kimse fark etmez); burada test düşer.

import { describe, expect, it } from "vitest";
import { MODULE_ADAPTERS } from "@/app/(app)/projects/[id]/revisions/[revId]/module-adapters";
import { moduleFamily, type ModuleFamily } from "@/lib/calc/presentation/module-family";
import type { AnyCheck } from "@/lib/calc/types";
import {
  COMPACT_PLAN,
  compactPlanFor,
  isExistenceCheck,
  pairCompactRows,
} from "../report-compact";

describe("kompakt rapor planı — adaptörle tutarlılık", () => {
  // Her aileden en az bir adaptör; yürütmede hem araba hem köprü (satırlar
  // varyanta göre süzülür, ikisinde de var olmalı).
  const adaptersOf = (family: ModuleFamily) =>
    MODULE_ADAPTERS.filter((a) => moduleFamily(a.key) === family);

  for (const family of Object.keys(COMPACT_PLAN) as ModuleFamily[]) {
    it(`${family}: plandaki bölüm ve anahtarlar adaptörde var`, () => {
      const adapters = adaptersOf(family);
      expect(adapters.length, `${family} ailesinin adaptörü`).toBeGreaterThan(0);
      for (const adapter of adapters) {
        for (const [rawId, plan] of Object.entries(COMPACT_PLAN[family])) {
          const section = adapter.sections.find((s) => s.rawId === rawId);
          expect(section, `${adapter.key} ${rawId} bölümü`).toBeDefined();
          if (!section) continue;
          const inputKeys = new Set([
            ...section.inputDefs.map((d) => d.key),
            ...(section.extraInputDefs ?? []).map((d) => d.key),
          ]);
          const selectionKeys = new Set(section.selectionDefs.map((d) => d.key));
          const rowKeys = new Set(section.rows.map((r) => r.key));
          for (const key of plan.inputs ?? []) {
            expect(inputKeys.has(key), `${adapter.key} ${rawId} girdi ${key}`).toBe(true);
          }
          for (const key of [...(plan.selections ?? []), ...(plan.line ?? [])]) {
            expect(selectionKeys.has(key), `${adapter.key} ${rawId} seçim ${key}`).toBe(true);
          }
          for (const key of plan.rows ?? []) {
            expect(rowKeys.has(key), `${adapter.key} ${rawId} satır ${key}`).toBe(true);
          }
          if (plan.table) {
            expect(section.table, `${adapter.key} ${rawId} tablosu`).toBeDefined();
          }
        }
      }
    });
  }

  it("planı olmayan bölüm boş planla (genel kural) basılır", () => {
    expect(compactPlanFor("hoist", "yok-boyle-bolum")).toEqual({});
    expect(compactPlanFor("wheelLoads", "10.5").table).toBe(true);
  });

  // Ürün satırı özet sayfasından gelen bölümlerde `line` YAZILMAZ: iki
  // kaynak aynı ekipmanı farklı yazardı.
  it("özet sayfasının satırı olan bölümler ayrıca ürün satırı tanımlamaz", () => {
    const summaryLined: [ModuleFamily, string][] = [
      ["hoist", "2.1"], ["hoist", "2.2.1"], ["hoist", "2.3"], ["hoist", "2.4"], ["hoist", "2.5"],
      ["hoist", "2.6"], ["hoist", "2.7"], ["hookBlock", "4.1"], ["hookBlock", "4.2"],
      ["travel", "5.1"], ["travel", "5.4"], ["travel", "5.5"], ["travel", "5.5b"],
      ["travel", "5.6"], ["travel", "5.7"],
    ];
    for (const [family, rawId] of summaryLined) {
      expect(compactPlanFor(family, rawId).line, `${family} ${rawId}`).toBeUndefined();
    }
  });
});

describe("onay / varlık kontrolü", () => {
  const base = { id: "x", label: "x", pass: true, computedSide: "provided" as const };

  it("birimsiz 1 ≥ 1 kontrolü varlık kontrolüdür", () => {
    const c: AnyCheck = { ...base, required: 1, provided: 1, unit: "-", op: ">=" };
    expect(isExistenceCheck(c)).toBe(true);
    expect(isExistenceCheck({ ...c, provided: 0, pass: false })).toBe(true);
  });

  it("emniyet katsayısı ve aralık kontrolleri varlık kontrolü DEĞİLDİR", () => {
    const safety: AnyCheck = { ...base, required: 1, provided: 3.186, unit: "-", op: ">=" };
    expect(isExistenceCheck(safety)).toBe(false);
    const withUnit: AnyCheck = { ...base, required: 1, provided: 1, unit: "mm", op: ">=" };
    expect(isExistenceCheck(withUnit)).toBe(false);
    const range: AnyCheck = {
      id: "r", label: "r", pass: true, provided: 1, unit: "-", op: "range", min: 0, max: 1,
    };
    expect(isExistenceCheck(range)).toBe(false);
  });
});

describe("ikişerli satır düzeni", () => {
  const item = (id: string, wide = false) => ({ id, wide });

  it("kartları sırayla eşler — soldan sağa okunur", () => {
    const rows = pairCompactRows([item("5.1"), item("5.2"), item("5.3"), item("5.4")]);
    expect(rows).toEqual([
      { kind: "pair", left: item("5.1"), right: item("5.2") },
      { kind: "pair", left: item("5.3"), right: item("5.4") },
    ]);
  });

  it("tek kalan kart yarım satırda durur (sağ hücre boş)", () => {
    const rows = pairCompactRows([item("5.1"), item("5.2"), item("5.3")]);
    expect(rows).toHaveLength(2);
    expect(rows[1]).toEqual({ kind: "pair", left: item("5.3") });
  });

  it("geniş kart kendi satırıdır ve bekleyen yarım satırı kapatır", () => {
    const rows = pairCompactRows([
      item("7.1", true), item("7.2"), item("7.3", true), item("7.4"), item("7.5"),
    ]);
    expect(rows.map((r) => r.kind)).toEqual(["wide", "pair", "wide", "pair"]);
    // 7.2 eşini bekliyordu; geniş 7.3 gelince yarım satır olarak kapandı —
    // sıra korunur, 7.2 hiçbir zaman 7.4'ün yanına düşmez.
    expect(rows[1]).toEqual({ kind: "pair", left: item("7.2") });
    expect(rows[3]).toEqual({ kind: "pair", left: item("7.4"), right: item("7.5") });
  });

  it("boş liste satır üretmez", () => {
    expect(pairCompactRows([])).toEqual([]);
  });

  it("SIRA HİÇ DEĞİŞMEZ — satırlar düzleştirilince girdi dizisi çıkar", () => {
    const cards = ["2.1", "2.2", "2.3", "2.4", "2.5"].map((id) => item(id));
    cards.splice(2, 0, item("2.9", true));
    const flat = pairCompactRows(cards).flatMap((r) =>
      r.kind === "wide" ? [r.item] : [r.left, ...(r.right ? [r.right] : [])]
    );
    expect(flat).toEqual(cards);
  });
});
