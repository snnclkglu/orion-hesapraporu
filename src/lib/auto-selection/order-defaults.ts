import { NEW_WORK_TEMPLATE } from "@/lib/calc/defaults";
import { moduleState } from "@/lib/calc/presentation/module-access";
import { isHoistKey, isTravelKey, MODULE_LABELS } from "@/lib/calc/presentation/module-family";
import { travelNeedsMotorCoupling } from "@/lib/calc/modules/travelGroup";
import type { SelectionRequest, SelectionProposal } from "./types";

/** Yalnız boş sipariş alanları tamamlanır; katalog kapasitesi uydurulmaz. */
export function completeOrderDefaults(request: SelectionRequest, proposal: SelectionProposal): void {
  for (const key of request.active.filter(key => isHoistKey(key) || isTravelKey(key))) {
    const selection = proposal.modules[key].selections as Record<string, unknown>;
    const baseline = moduleState(NEW_WORK_TEMPLATE, key)?.selections as Record<string, unknown> | undefined;
    const defaults: Record<string, unknown> = Object.fromEntries(["motorInsulationClass", "motorDutyType", "motorThermalProtection"].map(field => [field, baseline?.[field]]));
    // IEC bağlantı biçimi ön tasarım kararıdır; gerçek flanş ölçüsü değildir.
    defaults.motorMountType = isTravelKey(key) && !travelNeedsMotorCoupling(selection) ? "B5" : "B3";
    const assigned: string[] = [];
    for (const [field, value] of Object.entries(defaults)) {
      if (!value || selection[field] || request.locks.some(lock => lock === key || lock === `${key}.${isHoistKey(key) ? "2.4" : "5.4"}` || lock === `${key}.selections.${field}`)) continue;
      selection[field] = value; assigned.push(String(value));
    }
    if (assigned.length) proposal.trace.issues.push({ code: `order.defaults.${key}`, module: key, state: "review", message: `${MODULE_LABELS[key]}: boş motor sipariş alanları firma başlangıç kabulleriyle tamamlandı (${assigned.join(", ")}). Montaj ve görev çevrimi raporda düzenlenebilir; üretici uyumu ayrıca doğrulanır.` });
  }
}
