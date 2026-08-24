import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { canEditJobs } from "@/lib/roles";
import { JobForm } from "../../job-form";
import { loadJobFormData } from "../../form-data";
import type { JobInput } from "../../schema";


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

  const [{ data: items }, formData] = await Promise.all([
    supabase
      .from("job_items")
      .select("item_no, product_name, quantity")
      .eq("job_id", id)
      .order("sort", { ascending: true }),
    loadJobFormData(),
  ]);

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
