import { notFound } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { ProtectedPdfViewer } from "@/app/(app)/drawing-viewer/[packageId]/[fileId]/protected-pdf-viewer";

/** Üyeliksiz teknik resim müşteri kabuğunun auth/DB gerektirmeyen görsel fikstürü. */
export default function DrawingSharePreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();

  const fileName = "0057-00-0500 — PROJE ANA PAFTASI.pdf";
  return (
    <main className="mx-auto grid h-dvh w-full max-w-[1600px] grid-rows-[auto_minmax(0,1fr)] gap-3 overflow-hidden px-2 py-2 sm:px-4 sm:py-4">
      <header className="flex min-w-0 flex-wrap items-center justify-between gap-3 border bg-card px-4 py-3 print:hidden">
        <span className="min-w-0">
          <span className="oc-kicker text-muted-foreground">ORION CRANES · Müşteri Paylaşımı</span>
          <h1 className="truncate font-mono text-sm font-medium" title={fileName}>
            {fileName}
          </h1>
        </span>
        <span className="inline-flex items-center gap-1.5 border bg-muted px-2 py-1 font-mono text-[11px] text-muted-foreground">
          <ShieldCheck className="size-3.5 text-primary" /> Üyelik gerekmez · Tek dosya
        </span>
      </header>

      <ProtectedPdfViewer
        contentUrl="/dev/drawing-viewer-preview/content"
        fileName={fileName}
        notice="İndirme ve yazdırma kapalı · paylaşılan kopya filigranlı"
        fillHeight
      />
    </main>
  );
}
