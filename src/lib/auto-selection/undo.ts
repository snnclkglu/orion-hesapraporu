import type { ModulesState } from "@/lib/calc/state";
import { MODULE_ORDER } from "@/lib/calc/presentation/module-family";
import { stableStringify } from "./types";

/** Yalnız otomatiğin hâlâ aynı kalan yazılarını geri alır; sonraki elle değişiklikler korunur. */
export function undoSelection(current: ModulesState, before: ModulesState, after: ModulesState): { modules: ModulesState; preserved: number } {
  let preserved = 0;
  const modules = { ...current };
  for (const key of MODULE_ORDER) {
    if (!current[key] || !before[key] || !after[key]) continue;
    modules[key] = { ...current[key] };
    for (const side of ["inputs", "selections"] as const) {
      const a = after[key][side] as Record<string, unknown>;
      const b = before[key][side] as Record<string, unknown>;
      const c = { ...current[key][side] } as Record<string, unknown>;
      for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
        if (stableStringify(a[key]) === stableStringify(b[key])) continue;
        if (stableStringify(c[key]) !== stableStringify(a[key])) { preserved++; continue; }
        if (key in b) c[key] = b[key]; else delete c[key];
      }
      modules[key][side] = c;
    }
  }
  return { modules, preserved };
}
