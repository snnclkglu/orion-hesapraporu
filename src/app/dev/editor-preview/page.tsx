// Sadece development: revizyon editörünü auth olmadan görsel test etmek için.
// Production'da 404 döner.

import { notFound } from "next/navigation";
import {
  EDITOR_STATUS_SLOT_ID, RevisionEditor,
} from "@/app/(app)/projects/[id]/revisions/[revId]/revision-editor";
import { NEW_WORK_DISABLED_MODULES, NEW_WORK_TEMPLATE } from "@/lib/calc/defaults";

export default function EditorPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return (
    <div className="flex min-h-screen flex-col">
      {/* Uygulama kabuğundaki ince üst şeridin karşılığı (sticky hizalama için) */}
      <header className="sticky top-0 z-30 flex h-12 items-center border-b bg-background/90 px-4">
        <div className="text-sm font-medium">Editör Önizleme (dev)</div>
        {/* Gerçek sayfadaki gibi durum yuvası: kontrol özeti + Kaydet buraya
            portalla taşınır (bkz. EDITOR_STATUS_SLOT_ID). */}
        <div id={EDITOR_STATUS_SLOT_ID} className="ml-auto flex items-center gap-2" />
      </header>
      <div className="mx-auto w-full flex-1 px-4 py-6 lg:px-8">
        <RevisionEditor
          projectId="dev"
          revisionId="dev"
          readOnly={false}
          initial={NEW_WORK_TEMPLATE}
          initialDisabled={[...NEW_WORK_DISABLED_MODULES]}
        />
      </div>
    </div>
  );
}
