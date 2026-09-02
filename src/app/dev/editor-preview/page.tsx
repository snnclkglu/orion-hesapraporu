// Sadece development: revizyon editörünü auth olmadan görsel test etmek için.
// Production'da 404 döner.

import { notFound } from "next/navigation";
import {
  EDITOR_STATUS_SLOT_ID, RevisionEditor,
} from "@/app/(app)/projects/[id]/revisions/[revId]/revision-editor";
import { ReportMenu } from "@/app/(app)/projects/[id]/revisions/[revId]/report-menu";
import { NEW_WORK_DISABLED_MODULES, NEW_WORK_TEMPLATE } from "@/lib/calc/defaults";

export default async function EditorPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ doubleDrum?: string; craneType?: string }>;
}) {
  if (process.env.NODE_ENV !== "development") notFound();
  // `craneType` KÜNYE alanıdır ve hesap motoruna girmez (HESAP-8b); tek
  // okuyucusu ağırlık dökümüdür ve orada yalnız "bu vincin ayağı var mı"
  // sorusuna cevap verir. Önizlemede portal ayaklarını görebilmek için
  // ?craneType=Portal%20Vin%C3%A7 ile verilir.
  const { doubleDrum, craneType } = await searchParams;
  const initial = doubleDrum === "1"
    ? {
        ...NEW_WORK_TEMPLATE,
        specs: {
          ...NEW_WORK_TEMPLATE.specs,
          mainCapacityT: 64,
          mainHoistEquipmentArrangement: "doubleDrum" as const,
          mainDoubleDrumHookSystem: "doubleHookBlock" as const,
        },
      }
    : NEW_WORK_TEMPLATE;
  return (
    <div className="flex min-h-screen flex-col">
      {/* Uygulama kabuğundaki ince üst şeridin karşılığı (sticky hizalama için) */}
      <header className="sticky top-0 z-30 flex h-12 items-center border-b bg-background/90 px-4">
        <div className="text-sm font-medium">Editör Önizleme (dev)</div>
        {/* Gerçek sayfadaki gibi durum yuvası: kontrol özeti + Kaydet buraya
            portalla taşınır (bkz. EDITOR_STATUS_SLOT_ID). Yanında PDF Rapor
            menüsü durur — seviye açıklamaları belgenin gerçek kapsamını
            anlatmalıdır ve o metin ancak burada gözle görülür. */}
        <div id={EDITOR_STATUS_SLOT_ID} className="ml-auto flex items-center gap-2" />
        <div className="ml-2">
          <ReportMenu projectId="dev" revisionId="dev" />
        </div>
      </header>
      <div className="mx-auto w-full flex-1 px-4 py-6 lg:px-8">
        <RevisionEditor
          projectId="dev"
          revisionId="dev"
          readOnly={false}
          initial={initial}
          initialDisabled={[...NEW_WORK_DISABLED_MODULES]}
          craneType={craneType}
        />
      </div>
    </div>
  );
}
