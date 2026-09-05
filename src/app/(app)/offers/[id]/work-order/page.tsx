import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, ArrowLeft, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { canEditJobs } from "@/lib/roles";
import { sonrakiIsNo } from "@/lib/jobs/is-emri";
import { offerRevLabel } from "@/lib/offers/no";
import { buildJobDraftFromOffer } from "@/lib/offers/job-transfer";
import { loadJobFormData } from "@/app/(app)/jobs/form-data";
import { JobForm } from "@/app/(app)/jobs/job-form";
import { EMPTY_JOB, type JobInput } from "@/app/(app)/jobs/schema";
import { loadOffer, loadOfferRevision } from "../../data";

export const dynamic = "force-dynamic";

function Blocked({
  title,
  message,
  offerId,
}: {
  title: string;
  message: string;
  offerId: string;
}) {
  return (
    <div className="mx-auto grid w-full max-w-5xl gap-4">
      <Button asChild variant="ghost" className="w-fit">
        <Link href={`/offers/${offerId}`}>
          <ArrowLeft className="size-4" /> Teklife Dön
        </Link>
      </Button>
      <div className="rounded-lg border bg-card p-6">
        <h1 className="text-lg font-semibold">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}

export default async function OfferWorkOrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ revision?: string }>;
}) {
  const { id } = await params;
  const { revision: requestedRevision } = await searchParams;
  const supabase = await createClient();
  const [{ data: auth }, record] = await Promise.all([
    supabase.auth.getUser(),
    loadOffer(supabase, id),
  ]);
  if (!record) {
    return (
      <Blocked
        title="Teklif bulunamadı"
        message="İş emri taslağının kaynağı artık bulunamıyor."
        offerId={id}
      />
    );
  }
  if (record.offer.job_id) redirect(`/jobs/${record.offer.job_id}`);

  const { data: profile } = auth.user
    ? await supabase.from("profiles").select("role").eq("id", auth.user.id).maybeSingle()
    : { data: null };
  if (!canEditJobs((profile as { role?: string } | null)?.role)) {
    return (
      <Blocked
        title="Yetki yok"
        message="Tekliften iş emri oluşturma yetkisi yalnız Yönetici ve Müdürdedir."
        offerId={id}
      />
    );
  }
  if (record.offer.status !== "won") {
    return (
      <Blocked
        title="Teklif henüz kazanılmadı"
        message="İş emri yalnız Kazanıldı durumundaki bir tekliften oluşturulabilir."
        offerId={id}
      />
    );
  }

  const issued = record.revisions.filter((entry) => entry.status === "issued");
  if (issued.length === 0) {
    return (
      <Blocked
        title="Yayımlanmış revizyon gerekli"
        message="Kabul edilen müşteri belgesi sabitlenmeden iş emri oluşturulamaz. Önce teklif revizyonunu yayımlayın."
        offerId={id}
      />
    );
  }
  const selected =
    issued.find((entry) => entry.id === requestedRevision) ?? issued[0];
  const full = await loadOfferRevision(supabase, id, selected.id);
  if (!full) {
    return (
      <Blocked
        title="Revizyon bulunamadı"
        message="Seçilen teklif revizyonu artık okunamıyor."
        offerId={id}
      />
    );
  }

  const [{ customers, people }, { data: currentNos }] = await Promise.all([
    loadJobFormData(),
    supabase.from("jobs").select("job_no"),
  ]);
  const draft = buildJobDraftFromOffer(full.revision.payload);
  const customer = customers.find((entry) => entry.id === record.offer.customer_id);
  const nextJobNo = sonrakiIsNo(
    ((currentNos ?? []) as { job_no: string | null }[]).map((entry) => entry.job_no)
  );

  const initial: JobInput = {
    ...EMPTY_JOB,
    job_no: nextJobNo,
    title: record.offer.subject,
    customer: customer?.name || record.offer.customer_name,
    customer_id: customer?.id ?? record.offer.customer_id,
    customer_address: customer?.address ?? "",
    customer_tax_office: customer?.tax_office ?? "",
    customer_tax_no: customer?.tax_no ?? "",
    customer_phone: customer?.phone ?? "",
    customer_fax: customer?.fax ?? "",
    scope: draft.scopeSuggestions,
    items: draft.candidates.map((candidate) => ({
      item_no: "",
      product_name: candidate.productName,
      quantity: candidate.quantity,
      included: candidate.included,
      source_ref: candidate.sourceRef,
      source_label:
        candidate.sourceType === "technicalItem"
          ? `Teknik teklif kalemi · ${candidate.eligibility === "eligible" ? "hesap raporuna uygun" : candidate.eligibility === "review" ? "mühendis kontrolü gerekli" : "hesap raporuna uygun değil"}`
          : "Bağımsız fiyat satırı · varsayılan olarak iş emri dışında",
      source_warnings: candidate.warnings,
    })),
  };

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-4">
      <PageHeader
        kicker="Teklif → İş Emri"
        title="İş Emri Taslağını Kontrol Et"
        hint={`${record.offer.offer_no} · ${record.offer.customer_name}`}
        backHref={`/offers/${id}`}
        backLabel="Teklife dön"
      />

      <section className="grid gap-3 rounded-lg border bg-card p-4">
        <div className="flex items-start gap-2">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
          <div>
            <h2 className="text-sm font-semibold">Kabul edilen teklif revizyonu</h2>
            <p className="text-xs text-muted-foreground">
              Varsayılan son yayımlanmış revizyondur. Başka bir yayımlanmış
              revizyon kabul edildiyse aşağıdan değiştirin.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {issued.map((entry) => (
            <Button
              key={entry.id}
              asChild
              size="sm"
              variant={entry.id === selected.id ? "default" : "outline"}
            >
              <Link href={`/offers/${id}/work-order?revision=${entry.id}`}>
                {offerRevLabel(entry.rev_no) ?? "İlk (R0)"}
              </Link>
            </Button>
          ))}
        </div>
        {selected.id !== issued[0]?.id ? (
          <p className="flex gap-2 text-xs text-amber-700 dark:text-amber-300">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" /> Son yayımlanmış
            revizyon yerine daha eski bir revizyon seçildi; oluştururken bu kaynak sabitlenecek.
          </p>
        ) : null}
      </section>

      <JobForm
        mode="create"
        initial={initial}
        customers={customers}
        people={people}
        offerSource={{
          offerId: id,
          revisionId: selected.id,
          offerNo: record.offer.offer_no,
          revisionLabel: offerRevLabel(selected.rev_no) ?? "İlk (R0)",
          deliveryHint: draft.deliveryHint,
          shippingHint: draft.shippingHint,
          warnings: draft.warnings,
        }}
      />
    </div>
  );
}
