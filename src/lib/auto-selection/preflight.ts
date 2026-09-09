import { hoistSpecView } from "@/lib/calc/modules/hoistGroup";
import { travelSpecView } from "@/lib/calc/modules/travelGroup";
import { MODULE_LABELS, isHoistKey, isTravelKey } from "@/lib/calc/presentation/module-family";
import type { SelectionRequest } from "./types";
import { requestedBrakeFamily } from "./brands";

export function validateSelectionRequest(request: SelectionRequest): void {
  const problems: string[] = [];
  if (!request.active.length) problems.push("En az bir hesap bölümü etkin olmalı");
  if (request.active.some(isHoistKey) && !requestedBrakeFamily(String(request.specs.hoistBrakeType))) problems.push("Kaldırma fren tipi belirlenmeli");
  if (request.active.some(isTravelKey) && !requestedBrakeFamily(String(request.specs.travelBrakeType))) problems.push("Yürütme fren tipi eksik veya teklifin araba/köprü fren tipleri çelişiyor");
  const positive = (value: number) => typeof value === "number" && Number.isFinite(value) && value > 0;
  for (const key of request.active) {
    if (!request.modules[key]) { problems.push(`${MODULE_LABELS[key]} girdileri yok`); continue; }
    if (isHoistKey(key)) {
      const view = hoistSpecView(request.specs, key);
      if (![view.capacityT, view.liftHeightM, view.liftSpeedMpm].every(positive)) problems.push(`${MODULE_LABELS[key]} kapasite, yükseklik ve hız pozitif sayı olmalı`);
      if (!/^M[1-8]$/.test(view.mechanismClass) || !/^T[0-9]$/.test(view.usageClass)) problems.push(`${MODULE_LABELS[key]} sınıfları eksik`);
    }
    if (isTravelKey(key)) {
      const view = travelSpecView(request.specs, key, { hookEquipmentT: 0, trolleyWeightT: 0 });
      if (!positive(view.speedMpm)) problems.push(`${MODULE_LABELS[key]} hızı pozitif sayı olmalı`);
    }
  }
  if (request.active.includes("girder") && !positive(request.specs.spanM)) problems.push("Açıklık pozitif sayı olmalı");
  if (!Number.isFinite(request.specs.ambientTempMinC) || !Number.isFinite(request.specs.ambientTempMaxC) || request.specs.ambientTempMinC > request.specs.ambientTempMaxC) problems.push("Ortam sıcaklığı aralığı geçersiz");
  if (problems.length) throw new Error(`Önce teknik özellikleri tamamlayın: ${problems.join("; ")}.`);
}
