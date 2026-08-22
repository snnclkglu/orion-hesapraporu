import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { resolvePublicDrawingShare } from "@/lib/drawing-public-share";
import { ProtectedPdfViewer } from "@/app/(app)/drawing-viewer/[packageId]/[fileId]/protected-pdf-viewer";

export const metadata: Metadata = {
  title: "Paylaşılan Teknik Resim — ORION",
  robots: { index: false, follow: false, noarchive: true },
};

export const dynamic = "force-dynamic";

export default async function PublicDrawingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const share = await resolvePublicDrawingShare(token).catch(() => null);
  if (!share) notFound();

  return (
    <main className="mx-auto grid h-dvh w-full max-w-[1600px] grid-rows-[auto_minmax(0,1fr)] gap-3 overflow-hidden px-2 py-2 sm:px-4 sm:py-4">
      <header className="flex min-w-0 flex-wrap items-center justify-between gap-3 border bg-card px-4 py-3 print:hidden">
        <span className="min-w-0">
          <span className="oc-kicker text-muted-foreground">ORION CRANES · Müşteri Paylaşımı</span>
          <h1 className="truncate font-mono text-sm font-medium" title={share.fileName}>
            {share.fileName}
          </h1>
        </span>
        <span className="inline-flex items-center gap-1.5 border bg-muted px-2 py-1 font-mono text-[11px] text-muted-foreground">
          <ShieldCheck className="size-3.5 text-primary" /> Üyelik gerekmez · Tek dosya
        </span>
      </header>

      <ProtectedPdfViewer
        contentUrl={`/paylas/resim/${encodeURIComponent(token)}/content`}
        fileName={share.fileName}
        notice="İndirme ve yazdırma kapalı · paylaşılan kopya filigranlı"
        fillHeight
      />
    </main>
  );
}
