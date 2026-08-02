// Modül erişim katmanı testleri: girdi durumu, sonuç ve sunum bağlamı
// eşlemeleri tüm modül anahtarları için tutarlı mı?

import { describe, expect, it } from "vitest";
import { V5_TEMPLATE } from "@/lib/calc/defaults";
import { runCalc, type CalcInput } from "@/lib/calc/engine";
import { buildModuleDeps } from "@/app/(app)/projects/[id]/revisions/[revId]/module-adapters";
import type { ModuleKey } from "@/lib/calc/presentation/module-family";
import {
  ctxFor,
  moduleResult,
  modulePresent,
  moduleState,
} from "@/lib/calc/presentation/module-access";

const ALL_KEYS: ModuleKey[] = [
  "main",
  "aux",
  "hookBlock",
  "trolley",
  "bridge",
  "girder",
  "buckling",
  "endCarriage",
];

const input = V5_TEMPLATE;
const result = runCalc(input);
const deps = buildModuleDeps(input, result);

describe("moduleState", () => {
  it("tam şablonda tüm modüller için girdi/seçim döndürür", () => {
    for (const key of ALL_KEYS) {
      const st = moduleState(input, key);
      expect(st, key).toBeDefined();
      expect(typeof st!.inputs, key).toBe("object");
      expect(typeof st!.selections, key).toBe("object");
    }
  });

  it("buruşma modülünü boş seçim nesnesiyle normalize eder", () => {
    const st = moduleState(input, "buckling");
    expect(st!.selections).toEqual({});
    expect(st!.inputs).toBe(input.buckling!.inputs);
  });

  it("olmayan modül için undefined döndürür", () => {
    const withoutAux: CalcInput = { ...input, auxHoist: undefined };
    expect(moduleState(withoutAux, "aux")).toBeUndefined();
    expect(modulePresent(withoutAux, "aux")).toBe(false);
    expect(modulePresent(withoutAux, "main")).toBe(true);
  });
});

describe("moduleResult", () => {
  it("her anahtarı kendi sonuç dalına bağlar", () => {
    expect(moduleResult(result, "main")).toBe(result.mainHoist);
    expect(moduleResult(result, "aux")).toBe(result.auxHoist);
    expect(moduleResult(result, "hookBlock")).toBe(result.hookBlock);
    expect(moduleResult(result, "trolley")).toBe(result.trolley);
    expect(moduleResult(result, "bridge")).toBe(result.bridge);
    expect(moduleResult(result, "girder")).toBe(result.girder);
    expect(moduleResult(result, "buckling")).toBe(result.buckling);
    expect(moduleResult(result, "endCarriage")).toBe(result.endCarriage);
  });

  it("hesaplanmamış modülde undefined döndürür", () => {
    expect(moduleResult({ ...result, girder: undefined }, "girder")).toBeUndefined();
  });
});

describe("ctxFor", () => {
  it("tüm modüller için hücre haritası dolu bir bağlam kurar", () => {
    for (const key of ALL_KEYS) {
      const ctx = ctxFor(key, input, result, deps) as
        | { c: Record<string, number | string>; inp: object }
        | undefined;
      expect(ctx, key).toBeDefined();
      expect(ctx!.inp, key).toBe(moduleState(input, key)!.inputs);
      expect(Object.keys(ctx!.c).length, key).toBeGreaterThan(0);
    }
  });

  it("kaldırma bağlamına hangi grup olduğunu yazar", () => {
    const main = ctxFor("main", input, result, deps) as { which: string };
    const aux = ctxFor("aux", input, result, deps) as { which: string };
    expect(main.which).toBe("main");
    expect(aux.which).toBe("aux");
  });

  it("yürütme bağlamına hangi grup olduğunu ve değer kümesini yazar", () => {
    const trolley = ctxFor("trolley", input, result, deps) as { which: string; v: unknown };
    const bridge = ctxFor("bridge", input, result, deps) as { which: string; v: unknown };
    expect(trolley.which).toBe("trolley");
    expect(bridge.which).toBe("bridge");
    expect(trolley.v).toBe(result.trolley!.values);
    expect(bridge.v).toBe(result.bridge!.values);
  });

  it("bağımlılık paketini ilgili modüle geçirir", () => {
    const hookBlock = ctxFor("hookBlock", input, result, deps) as { deps: unknown };
    const girder = ctxFor("girder", input, result, deps) as { deps: unknown };
    const endCarriage = ctxFor("endCarriage", input, result, deps) as { deps: unknown };
    expect(hookBlock.deps).toBe(deps.hookBlock.hookBlock);
    expect(girder.deps).toBe(deps.girder);
    expect(endCarriage.deps).toBe(deps.endCarriage);
  });

  it("olmayan modülde çökmez, undefined döndürür", () => {
    const withoutHookBlock: CalcInput = { ...input, hookBlock: undefined };
    expect(ctxFor("hookBlock", withoutHookBlock, result, deps)).toBeUndefined();
  });

  it("sonucu olmayan modülde de çökmez", () => {
    expect(ctxFor("hookBlock", input, { ...result, hookBlock: undefined }, deps)).toBeUndefined();
    expect(ctxFor("bridge", input, { ...result, bridge: undefined }, deps)).toBeUndefined();
  });

  it("sonuç yoksa hücre haritası boş bağlam kurar (buruşma)", () => {
    const ctx = ctxFor("buckling", input, { ...result, buckling: undefined }, deps) as {
      c: Record<string, number | string>;
    };
    expect(ctx.c).toEqual({});
  });
});
