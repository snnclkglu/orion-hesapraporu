import { notFound } from "next/navigation";
import { FileDown, FileText } from "lucide-react";
import { PdfDownloadLink } from "@/components/pdf-download-link";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

export default async function JobOfferDocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: job }, { data: hasDocument }] = await Promise.all([
    supabase.from("jobs").select("id, job_no").eq("id", id).maybeSingle(),
    supabase.rpc("has_job_offer_document", { p_job_id: id }),
  ]);
  if (!job || hasDocument !== true) notFound();

  const href = `/jobs/${id}/offer-document`;
  return (
    <section className="grid gap-3">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border bg-card p-4">
        <div className="flex min-w-0 gap-2">
          <FileText className="mt-0.5 size-4 shrink-0 text-primary" />
          <div>
            <h2 className="text-sm font-semibold">İşler İçin Teklif Dokümanı</h2>
            <p className="mt-0.5 max-w-2xl text-xs text-muted-foreground">
              İş emrine bağlanan yayımlanmış teklif revizyonundan otomatik üretilir.
              Fiyat tablosu, iskonto, toplam ve ödeme planı bu kopyada bulunmaz.
            </p>
          </div>
        </div>
        <Button asChild size="sm" variant="outline">
          <PdfDownloadLink href={href} fallbackFileName={`${job.job_no}-teklif-dokumani.pdf`}>
            <FileDown className="size-3.5" /> PDF İndir
          </PdfDownloadLink>
        </Button>
      </div>

      <iframe
        src={`${href}?inline=1`}
        title={`${job.job_no} fiyat ve ödeme içermeyen teklif dokümanı`}
        className="h-[75dvh] min-h-[34rem] w-full rounded-lg border bg-muted"
      />
    </section>
  );
}
