// Sadece development: revizyon editörünü auth olmadan görsel test etmek için.
// Production'da 404 döner.

import { notFound } from "next/navigation";
import { RevisionEditor } from "@/app/(app)/projects/[id]/revisions/[revId]/revision-editor";
import { V5_TEMPLATE } from "@/lib/calc/defaults";

export default function EditorPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6">
      <RevisionEditor
        projectId="dev"
        revisionId="dev"
        readOnly={false}
        initial={V5_TEMPLATE}
      />
    </div>
  );
}
