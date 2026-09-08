// UYGUNLUK ÖZETİ kapsam koruması.
// Bölüm sayacı, ayrıntılı kontroller ve özet aynı `checkSuffixes` kaynağını
// okumalıdır. Böylece bölüm 3/3 gösterirken özette 2 satır kalamaz.

import { describe, expect, it } from "vitest";
import { MODULE_ADAPTERS, headlineItems } from "../module-adapters";
import { NEW_WORK_TEMPLATE } from "@/lib/calc/defaults";
import { runCalc } from "@/lib/calc/engine";
import { moduleResult, moduleState } from "@/lib/calc/presentation/module-access";
import type { ModuleKey } from "@/lib/calc/presentation/module-family";

const input = {
  ...NEW_WORK_TEMPLATE,
  specs: {
    ...NEW_WORK_TEMPLATE.specs,
    hoistSafetyBrake: "Ana ve Yardımcı Kaldırmada" as const,
    girderArrangement: "dort" as const,
  },
};
const result = runCalc(input);

describe("uygunluk özeti — eksiksiz ve tekil kontrol kapsamı", () => {
  it("kontrol bildiren her bölümde özet vardır", () => {
    const missing = MODULE_ADAPTERS.flatMap((adapter) =>
      adapter.sections
        .filter((section) => section.checkSuffixes.length > 0 && !section.headline)
        .map((section) => `${adapter.key}:${section.rawId}`)
    );
    expect(missing, missing.join("\n")).toEqual([]);
  });

  it("özel kısa etiketler yalnız bölümün gerçek kontrollerine bağlıdır", () => {
    const invalid: string[] = [];
    for (const adapter of MODULE_ADAPTERS) {
      for (const section of adapter.sections) {
        for (const item of section.headline?.checks ?? []) {
          if (!section.checkSuffixes.includes(item.suffix)) {
            invalid.push(`${adapter.key}:${section.rawId} → ${item.suffix}`);
          }
        }
      }
    }
    expect(invalid, invalid.join("\n")).toEqual([]);
  });

  it("çalışan her görünür bölümde üretilen bütün kontroller özet satırına dönüşür", () => {
    const differences: string[] = [];
    for (const adapter of MODULE_ADAPTERS) {
      const key = adapter.key as ModuleKey;
      const mr = moduleResult(result, key);
      const state = moduleState(input, key);
      if (!mr || !state) continue;
      for (const section of adapter.sections) {
        if (section.visible && !section.visible(input.specs, state.inputs as Record<string, unknown>)) continue;
        const expected = section.checkSuffixes.filter((suffix) =>
          mr.checks.some((check) => check.id === `${adapter.checkPrefix}${suffix}`)
        );
        const actual = headlineItems(adapter.checkPrefix, section, mr.checks)
          .map((item) => item.check.id.slice(adapter.checkPrefix.length));
        if (JSON.stringify(actual) !== JSON.stringify(expected)) {
          differences.push(`${adapter.key}:${section.rawId} → ${actual.length}/${expected.length}`);
        }
      }
    }
    expect(differences, differences.join("\n")).toEqual([]);
  });

  it("aynı kontrol aynı anda iki görünür alt bölüme yazılmaz", () => {
    const duplicates: string[] = [];
    for (const adapter of MODULE_ADAPTERS) {
      const key = adapter.key as ModuleKey;
      const mr = moduleResult(result, key);
      const state = moduleState(input, key);
      if (!mr || !state) continue;
      const seen = new Set<string>();
      for (const section of adapter.sections) {
        if (section.visible && !section.visible(input.specs, state.inputs as Record<string, unknown>)) continue;
        for (const item of headlineItems(adapter.checkPrefix, section, mr.checks)) {
          if (seen.has(item.check.id)) duplicates.push(`${adapter.key} → ${item.check.id}`);
          seen.add(item.check.id);
        }
      }
    }
    expect(duplicates, duplicates.join("\n")).toEqual([]);
  });
});
