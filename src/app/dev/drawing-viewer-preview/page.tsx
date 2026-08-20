// Korumalı PDF görüntüleyicisinin auth/depo olmadan görsel önizlemesi.

import { notFound } from "next/navigation";
import { ProtectedPdfViewer } from "@/app/(app)/drawing-viewer/[packageId]/[fileId]/protected-pdf-viewer";

export default function DrawingViewerPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return (
    <main className="mx-auto grid w-full max-w-[100rem] gap-3 p-3 sm:p-5">
      <header className="flex min-w-0 flex-wrap items-center justify-between gap-3 border bg-card px-4 py-3 print:hidden">
        <span className="min-w-0">
          <p className="text-xs text-muted-foreground">Teknik Resimler / Görsel Önizleme</p>
          <h1 className="truncate font-mono text-sm font-medium">
            0057-00-0510-01 - ANA TAŞIYICI PLAKA.pdf
          </h1>
        </span>
        <span className="border bg-muted px-2 py-1 font-mono text-[11px] text-muted-foreground">
          Kişiye Özel Görüntüleme
        </span>
      </header>
      <ProtectedPdfViewer
        contentUrl="/dev/drawing-viewer-preview/content"
        fileName="0057-00-0510-01 - ANA TAŞIYICI PLAKA.pdf"
      />
    </main>
  );
}
