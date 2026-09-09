import { HOOK_STANDARDS, type HookStandard } from "@/lib/calc/hook-standards";
import { isHookBlockKey, MODULE_LABELS } from "@/lib/calc/presentation/module-family";
import type { SelectionRequest } from "./types";

/** Teknik talep bir ürün ailesidir; benzer bir standarda düşülmez. */
export function requestedHookStandard(hookType: string): HookStandard | undefined {
  const code = hookType.match(/\bDIN\s*(15401|15402|15407|15408)\b/i)?.[1];
  return HOOK_STANDARDS.find(standard => standard === `DIN ${code}`);
}

/** Yalnız kullanıcının başlattığı seçimde teknik talebi modül şartlarına taşır. */
export function prepareSelectionRequest(request: SelectionRequest): SelectionRequest {
  const next = structuredClone(request);
  const standard = requestedHookStandard(request.specs.hookType);
  if (!standard) return next;
  for (const key of request.active.filter(isHookBlockKey)) {
    const selection = next.modules[key]?.selections as Record<string, unknown> | undefined;
    if (!selection || selection.hookStandard === standard) continue;
    if (request.locks.some(lock => lock === key || lock === `${key}.4.1` || lock.startsWith(`${key}.selections.hook`))) {
      throw new Error(`${MODULE_LABELS[key]}: kilitli kanca ile teknik özellikteki ${standard} uyuşmuyor. Kanca kilidini veya teknik talebi düzeltin.`);
    }
    Object.assign(selection, { hookStandard: standard, hookNumber: null, hookCapacityKg: null, hookWeightKg: null });
  }
  return next;
}
