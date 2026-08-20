import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ProtectedPdfViewer } from "./protected-pdf-viewer";

export const metadata: Metadata = {
  title: "Korumalı Teknik Resim",
  robots: { index: false, follow: false, noarchive: true },
};

export default async function DrawingViewerPage({
  params,
}: {
  params: Promise<{ packageId: string; fileId: string }>;
}) {
  const { packageId, fileId } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("drawing_files")
    .select("file_name")
    .eq("id", fileId)
    .eq("package_id", packageId)
    .maybeSingle();
  const file = data as { file_name: string } | null;
  if (!file || !/\.pdf$/i.test(file.file_name)) notFound();

  return (
    <div className="grid gap-3">
      <header className="flex min-w-0 flex-wrap items-center justify-between gap-3 border bg-card px-4 py-3 print:hidden">
        <span className="min-w-0">
          <Link
            href={`/drawings/${packageId}/files`}
            className="inline-flex min-h-9 items-center text-sm text-muted-foreground hover:text-foreground hover:underline pointer-coarse:min-h-11"
          >
            <ChevronLeft className="size-4" /> Teknik Resimlere Dön
          </Link>
          <h1 className="truncate font-mono text-sm font-medium" title={file.file_name}>
            {file.file_name}
          </h1>
        </span>
        <span className="border bg-muted px-2 py-1 font-mono text-[11px] text-muted-foreground">
          Kişiye Özel Görüntüleme
        </span>
      </header>

      <ProtectedPdfViewer
        contentUrl={`/drawing-viewer/${packageId}/${fileId}/content`}
        fileName={file.file_name}
      />
    </div>
  );
}
