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

  // "Ek Belge" sütunu da GERÇEK veriyle bakılabilsin diye bir satıra iki
  // yükleme takılır; önizlemede yükleme/silme depoya gitmez (kimlikler sahte),
  // amaç sütun genişliği ve satır yüksekliğinin görünmesidir.
  const attachments = {
    "main:gearbox": [
      { fileName: "YILMAZ HT0823 ölçü sayfası.pdf", pageCount: 2 },
      { fileName: "Bağlantı deliği detayı.pdf", pageCount: 1 },
    ],
  };
  const groups = buildEquipmentGroups(
    V5_TEMPLATE,
    { "main:rope": "Galvanizli, müşteri onayına tabi" },
    undefined,
    attachments
  );
  const summary = buildSummarySections(V5_TEMPLATE, runCalc(V5_TEMPLATE), {
    itemNo: "0055-00",
    rows: [
      { id: "a", code: "0100", name: "KÖPRÜ YÜRÜTME GRUBU", status: "cizildi", note: "" },
      { id: "b", code: "0200", name: "ANA KİRİŞ", status: "kontrol", note: "" },
      { id: "c", code: "1500", name: "ANA ARABA KOMPLESİ", status: "ciziliyor", note: "" },
      { id: "d", code: "2300", name: "YARDIMCI ARABA KOMPLESİ", status: "bekliyor", note: "" },
      { id: "e", code: "3000", name: "MEKANİK KEPÇE", status: "bekliyor", note: "" },
    ],
  });
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
          initialAttachments={[
            {
              id: "00000000-0000-4000-8000-000000000001",
              rowKey: "main:gearbox",
              fileName: "YILMAZ HT0823 ölçü sayfası.pdf",
              pageCount: 2,
            },
            {
              id: "00000000-0000-4000-8000-000000000002",
              rowKey: "main:gearbox",
              fileName: "Bağlantı deliği detayı.pdf",
              pageCount: 1,
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
