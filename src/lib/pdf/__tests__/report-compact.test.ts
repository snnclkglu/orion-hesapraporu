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
  estimateCompactCardHeight,
  isExistenceCheck,
  packCompactBlocks,
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

describe("iki sütunlu paketleme", () => {
  const item = (height: number, wide = false) => ({ height, wide });

  it("sırayı korur ve sütunları dengeler", () => {
    const blocks = packCompactBlocks([item(40), item(40), item(40), item(40)], 100);
    expect(blocks).toHaveLength(1);
    const b = blocks[0];
    expect(b.kind).toBe("columns");
    if (b.kind !== "columns") return;
    expect(b.left).toHaveLength(2);
    expect(b.right).toHaveLength(2);
  });

  it("tavanı aşınca yeni blok açar ve blokları DENGELİ böler (kuyrukta tek kart kalmaz)", () => {
    const items = Array.from({ length: 10 }, () => item(50));
    const blocks = packCompactBlocks(items, 100);
    // 10 × 50 = 500 → 200'lük tavanla ÜÇ blok; açgözlü 4 + 4 + 2 yerine 4 + 3 + 3
    expect(blocks.map((b) => (b.kind === "columns" ? b.left.length + b.right.length : 1))).toEqual([
      4, 3, 3,
    ]);
    for (const b of blocks) {
      if (b.kind !== "columns") continue;
      const sum = (col: { height: number }[]) => col.reduce((s, it) => s + it.height, 0);
      expect(sum(b.left) + sum(b.right)).toBeLessThanOrEqual(200);
      // Her blokta iki sütun da dolu
      expect(b.left.length).toBeGreaterThan(0);
      expect(b.right.length).toBeGreaterThan(0);
    }
  });

  it("ilk blok küçük tutulabilir (bölüm bandıyla taşınır)", () => {
    const items = Array.from({ length: 6 }, () => item(50));
    const blocks = packCompactBlocks(items, 100, 50);
    // İlk blok ≤ 2 × 50 = 100 → 2 kart; kalan 4 kart (200) tek blok
    expect(blocks.map((b) => (b.kind === "columns" ? b.left.length + b.right.length : 1))).toEqual([
      2, 4,
    ]);
    // Küçük ilk blok yalnız İLK blok için: geniş karttan sonraki dizi normal
    // tavanla ve dengeli bölünür (6 × 50 = 300 → 200'lük tavanla 3 + 3)
    const withWide = packCompactBlocks([item(200, true), ...items], 100, 50);
    expect(withWide[0].kind).toBe("wide");
    expect(withWide.slice(1).map((b) => (b.kind === "columns" ? b.left.length + b.right.length : 1))).toEqual([
      3, 3,
    ]);
  });

  it("geniş kart kendi bloğudur ve öncesindeki birikimi kapatır", () => {
    const blocks = packCompactBlocks([item(30), item(200, true), item(30), item(30)], 100);
    expect(blocks.map((b) => b.kind)).toEqual(["columns", "wide", "columns"]);
    const last = blocks[2];
    if (last.kind === "columns") {
      expect(last.left).toHaveLength(1);
      expect(last.right).toHaveLength(1);
    }
  });

  it("tek kart sol sütuna düşer, sağ boş kalır", () => {
    const blocks = packCompactBlocks([item(30)], 100);
    expect(blocks).toEqual([{ kind: "columns", left: [item(30)], right: [] }]);
  });

  it("dengesiz yükseklikte bölme noktası yarıya en yakın prefix'tir", () => {
    // 10 + 10 + 10 | 30 → sol 30, sağ 30
    const blocks = packCompactBlocks([item(10), item(10), item(10), item(30)], 100);
    const b = blocks[0];
    if (b.kind !== "columns") throw new Error("columns bekleniyordu");
    expect(b.left).toHaveLength(3);
    expect(b.right).toHaveLength(1);
  });
});

describe("kart yüksekliği tahmini", () => {
  it("satır ve kontrol sayısıyla artar, geniş kart gövdesini yarılar", () => {
    const small = estimateCompactCardHeight({
      lineChars: 20, rows: 2, longRows: 0, checks: 1, longChecks: 0, tableRows: 0, noteChars: 0,
    });
    const big = estimateCompactCardHeight({
      lineChars: 20, rows: 8, longRows: 2, checks: 3, longChecks: 1, tableRows: 0, noteChars: 0,
    });
    const wide = estimateCompactCardHeight({
      lineChars: 20, rows: 8, longRows: 2, checks: 3, longChecks: 1, tableRows: 0, noteChars: 0, wide: true,
    });
    expect(big).toBeGreaterThan(small);
    expect(wide).toBeLessThan(big);
    expect(small).toBeGreaterThan(0);
  });

  it("tablo ve not yüksekliğe girer", () => {
    const bare = estimateCompactCardHeight({
      lineChars: 0, rows: 0, longRows: 0, checks: 0, longChecks: 0, tableRows: 0, noteChars: 0,
    });
    const withTable = estimateCompactCardHeight({
      lineChars: 0, rows: 0, longRows: 0, checks: 0, longChecks: 0, tableRows: 12, noteChars: 0,
    });
    const withNote = estimateCompactCardHeight({
      lineChars: 0, rows: 0, longRows: 0, checks: 0, longChecks: 0, tableRows: 0, noteChars: 200,
    });
    expect(withTable).toBeGreaterThan(bare + 100);
    expect(withNote).toBeGreaterThan(bare + 30);
  });
});
