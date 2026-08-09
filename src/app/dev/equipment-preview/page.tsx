// Sadece development: ekipman listesi panelini auth olmadan görsel test etmek
// için. Production'da 404 döner.
//
// Veri GERÇEK hesap motorundan gelir (V5 şablonu) — sahte satır uydurmak sütun
// kaymasını gizlerdi; sorun tam da uzun katalog metinlerinin sütunları
// bozmasıydı (madde 36).

import { notFound } from "next/navigation";
import { V5_TEMPLATE } from "@/lib/calc/defaults";
import { runCalc } from "@/lib/calc/engine";
import {
  buildCatalogSheetUrls, buildEquipmentGroups, buildSummarySections,
} from "@/lib/excel/equipment";
import { EquipmentPanel } from "@/app/(app)/projects/[id]/revisions/[revId]/equipment/equipment-panel";

export default function EquipmentPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();

  const groups = buildEquipmentGroups(V5_TEMPLATE, {
    "main:rope": "Galvanizli, müşteri onayına tabi",
  });
  const summary = buildSummarySections(V5_TEMPLATE, runCalc(V5_TEMPLATE));
  const sheetUrls = Object.fromEntries(buildCatalogSheetUrls(groups));

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 flex h-12 items-center border-b bg-background/90 px-4">
        <div className="text-sm font-medium">Ekipman Listesi Önizleme (dev)</div>
      </header>
      {/* Gerçek sayfa gibi TAM GENİŞLİK; dar önizlemede sütun taşması görünmez. */}
      <div className="w-full flex-1 px-4 py-6 lg:px-8">
        <EquipmentPanel
          projectId="dev"
          revisionId="dev"
          autoGroups={groups}
          summary={summary}
          initialExtras={[
            {
              group: "Ek Ekipman", component: "Uzaktan kumanda", brand: "HBC",
              model: "radiomatic", spec: "6 fonksiyon, 433 MHz", qty: "1",
            },
          ]}
          datasheetUrls={{}}
          sheetUrls={sheetUrls}
          locked={false}
        />
      </div>
    </div>
  );
}
