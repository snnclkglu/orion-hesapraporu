import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { canEditJobs } from "@/lib/roles";
import { JobForm } from "../../job-form";
import { loadJobFormData } from "../../form-data";
import type { JobInput } from "../../schema";
import {
  ExistingOfferLinker,
  type ExistingOfferOption,
  type LinkedOfferSummary,
} from "./existing-offer-linker";


/**
 * FORM SAYFASI YAZMA YETKİSİ İSTER (canEditJobs, 18.08.2026).
 *
 * Sessizce `/jobs`a yönlendirmek YERİNE sayfa NEDENİ SÖYLER: adres elle
 * yazılmış ya da eski bir yer iminden gelinmiş olabilir ve boş bir yönlendirme
 * kullanıcıya "bağlantı bozuk" dedirtirdi. Asıl engel yine RLS'tir; bu ekran
 * yalnız kapıyı görünür kılar.
 */
function YetkiYok({ geriHref, geriEtiket }: { geriHref: string; geriEtiket: string }) {
  return (
    <div className="mx-auto w-full max-w-5xl">
      <Link
        href={geriHref}
        className="-ml-1 inline-flex min-h-9 items-center gap-1 px-1 text-sm text-muted-foreground hover:text-foreground pointer-coarse:min-h-10"
      >
        <ChevronLeft className="size-4" /> {geriEtiket}
      </Link>
      <div className="mt-3 border bg-card p-6">
        <h1 className="text-lg font-semibold tracking-tight">Yetki yok</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          İş emri açma ve düzenleme yetkisi yalnız Yönetici ve Müdürdedir. İş
          emrini görüntüleyebilir, PDF olarak indirebilir, görev ve yorum
          ekleyebilirsiniz.
        </p>
      </div>
    </div>
  );
}

export default async function EditJobPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profil } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
    : { data: null };
  if (!canEditJobs((profil as { role?: string } | null)?.role)) {
    return <YetkiYok geriHref={`/jobs/${id}`} geriEtiket="İş emri" />;
  }

  const { data: job } = await supabase.from("jobs").select("*").eq("id", id).single();
  if (!job) notFound();

  const [{ data: items }, formData, { data: linkedRow }, { data: offerRows }] = await Promise.all([
    supabase
      .from("job_items")
      .select("item_no, product_name, quantity")
      .eq("job_id", id)
      .order("sort", { ascending: true }),
    loadJobFormData(),
    // Dönüşüm satırı varsa sade doküman zaten bağlıdır. Tam teklif payload'ı
    // bu sayfaya taşınmaz; yalnız kullanıcıya gösterilecek kimlik okunur.
    supabase
      .from("offer_job_conversions")
      .select(
        "offer_id, offer_revision_id, offers:offer_id(offer_no, customer_name, subject), offer_revisions:offer_revision_id(rev_no)"
      )
      .eq("job_id", id)
      .maybeSingle(),
    // Eski veri göçünde `offers.job_id` zaten bu işe bağlı olabilir ama yeni
    // dönüşüm satırı yoktur. Bu nedenle hem BOŞ hem de BU İŞE bağlı teklifler
    // adaydır; başka işe bağlı bir teklif listede gösterilmez.
    supabase
      .from("offers")
      .select(
        "id, offer_no, customer_name, subject, job_id, issue_date, offer_revisions!inner(id, rev_no, status)"
      )
      .eq("status", "won")
      .or(`job_id.is.null,job_id.eq.${id}`)
      .eq("offer_revisions.status", "issued")
      .order("issue_date", { ascending: false }),
  ]);

  const one = <T,>(value: unknown): T | null =>
    Array.isArray(value) ? ((value[0] as T | undefined) ?? null) : ((value as T) ?? null);
  const linkedOffer = one<{
    offer_no?: string;
    customer_name?: string;
    subject?: string;
  }>((linkedRow as Record<string, unknown> | null)?.offers);
  const linkedRevision = one<{ rev_no?: number }>(
    (linkedRow as Record<string, unknown> | null)?.offer_revisions
  );
  const linked: LinkedOfferSummary | null = linkedOffer
    ? {
        offerNo: String(linkedOffer.offer_no ?? ""),
        customerName: String(linkedOffer.customer_name ?? ""),
        subject: String(linkedOffer.subject ?? ""),
        revisionNo: Number(linkedRevision?.rev_no ?? 0),
      }
    : null;

  const options: ExistingOfferOption[] = linked
    ? []
    : (offerRows ?? []).map((row) => {
        const revisions = (row.offer_revisions ?? []) as {
          rev_no: number;
          status: string;
        }[];
        const latest = [...revisions].sort((a, b) => b.rev_no - a.rev_no)[0];
        return {
          id: String(row.id),
          offerNo: String(row.offer_no ?? ""),
          customerName: String(row.customer_name ?? ""),
          subject: String(row.subject ?? ""),
          revisionNo: Number(latest?.rev_no ?? 0),
        };
      });

  const scope = (job.scope ?? {}) as Partial<JobInput["scope"]>;
  const initial: JobInput = {
    job_no: job.job_no ?? "",
    // İlk yayın REVİZYONSUZDUR; şema geçersiz/eksik değeri boşa çevirir.
    revision: job.revision ?? "",
    title: job.title ?? "",
    customer: job.customer ?? "",
    customer_id: job.customer_id ?? null,
    work_order_date: job.work_order_date ?? "",
    customer_address: job.customer_address ?? "",
    customer_tax_office: job.customer_tax_office ?? "",
    customer_tax_no: job.customer_tax_no ?? "",
    customer_phone: job.customer_phone ?? "",
    customer_fax: job.customer_fax ?? "",
    contract_exists: !!job.contract_exists,
    contract_date: job.contract_date ?? "",
    workshop_exit_date: job.workshop_exit_date ?? "",
    delivery_date: job.delivery_date ?? "",
    shipping_address: job.shipping_address ?? "",
    shipping_country: job.shipping_country ?? "Türkiye",
    assembly_address: job.assembly_address ?? "",
    quantity_text: job.quantity_text ?? "",
    job_leader: job.job_leader ?? "",
    project_manager: job.project_manager ?? "",
    prepared_by_name: job.prepared_by_name ?? "",
    prepared_by_title: job.prepared_by_title ?? "",
    scope: {
      proje: !!scope.proje, devreyeAlma: !!scope.devreyeAlma, malzeme: !!scope.malzeme,
      nakliye: !!scope.nakliye, imalat: !!scope.imalat, montaj: !!scope.montaj,
    },
    notes: job.notes ?? "",
    items: (items ?? []).map((it) => ({
      item_no: it.item_no ?? "",
      product_name: it.product_name ?? "",
      quantity: it.quantity ?? "",
    })),
  };

  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="mb-4">
        {/* Geri bağlantısı yalnız yazı yüksekliğindeydi (~20px); tıklama alanı
            asgari 36px'e (dokunmatikte 40px) yayılır. */}
        <Link href={`/jobs/${id}`} className="-ml-1 inline-flex min-h-9 items-center gap-1 px-1 text-sm text-muted-foreground hover:text-foreground pointer-coarse:min-h-10">
          <ChevronLeft className="size-4" /> {job.job_no}
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">İş Emrini Düzenle</h1>
      </div>
      <ExistingOfferLinker jobId={id} linked={linked} options={options} />
      <JobForm
        mode="edit"
        jobId={id}
        initial={initial}
        customers={formData.customers}
        people={formData.people}
      />
    </div>
  );
}
