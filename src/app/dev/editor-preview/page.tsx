// Sadece development: revizyon editörünü auth olmadan görsel test etmek için.
// Production'da 404 döner.

import { notFound } from "next/navigation";
import { RevisionEditor } from "@/app/(app)/projects/[id]/revisions/[revId]/revision-editor";
import { V5_TEMPLATE } from "@/lib/calc/defaults";

export default function EditorPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return (
    <div className="flex min-h-screen flex-col">
      {/* Uygulama kabuğundaki ince üst şeridin karşılığı (sticky hizalama için) */}
      <header className="sticky top-0 z-30 flex h-12 items-center border-b bg-background/90 px-4 backdrop-blur">
        <div className="text-sm font-medium">Editör Önizleme (dev)</div>
      </header>
      <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <RevisionEditor
          projectId="dev"
          revisionId="dev"
          readOnly={false}
          initial={V5_TEMPLATE}
        />
      </div>
    </div>
  );
}
