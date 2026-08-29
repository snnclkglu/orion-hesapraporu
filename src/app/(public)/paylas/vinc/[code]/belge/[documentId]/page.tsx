import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { ProtectedPdfViewer } from "@/app/(app)/drawing-viewer/[packageId]/[fileId]/protected-pdf-viewer";
import {
  normalizedPublicCode,
  portalCookieName,
  resolvePortalDocument,
} from "@/lib/product-portal/access-server";

export const metadata: Metadata = {
  title: "Doküman Görüntüleme — ORION CRANES",
  robots: { index: false, follow: false, noarchive: true },
};
export const dynamic = "force-dynamic";

export default async function PortalDocumentPage({
  params,
}: {
  params: Promise<{ code: string; documentId: string }>;
}) {
  const { code: rawCode, documentId } = await params;
  const code = normalizedPublicCode(rawCode);
  const token = (await cookies()).get(portalCookieName(code))?.value;
  const resolved = await resolvePortalDocument(code, token, documentId).catch(() => null);
  if (!resolved || resolved.file.accessMode !== "view_watermarked") notFound();

  return (
    <main className="mx-auto grid h-dvh w-full max-w-[1600px] grid-rows-[auto_minmax(0,1fr)] gap-3 overflow-hidden px-2 py-2 sm:px-4 sm:py-4">
      <header className="flex min-w-0 flex-wrap items-center justify-between gap-3 border bg-card px-3 py-3 print:hidden sm:px-4">
        <span className="flex min-w-0 items-center gap-3">
          <Link href={`/paylas/vinc/${encodeURIComponent(code)}`} className="oc-tap inline-grid size-11 shrink-0 place-items-center border text-primary" aria-label="Dokümanlara dön">
            <ArrowLeft className="size-4" />
          </Link>
          <span className="min-w-0">
            <span className="oc-kicker text-muted-foreground">ORION CRANES · Müşteri Portalı</span>
            <h1 className="truncate text-sm font-medium" title={resolved.file.title}>{resolved.file.title}</h1>
          </span>
        </span>
        <span className="inline-flex items-center gap-1.5 border bg-muted px-2 py-1 font-mono text-[11px] text-muted-foreground">
          <ShieldCheck className="size-3.5 text-primary" /> {resolved.session.unit.serialNo} · Filigranlı
        </span>
      </header>
      <ProtectedPdfViewer
        contentUrl={`/paylas/vinc/${encodeURIComponent(code)}/belge/${encodeURIComponent(documentId)}/content`}
        fileName={resolved.file.fileName}
        notice="İndirme ve yazdırma düğmeleri kapalı · kopya seri ve oturum iziyle filigranlı"
        fillHeight
      />
    </main>
  );
}
