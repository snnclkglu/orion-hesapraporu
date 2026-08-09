import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { JobForm } from "../../job-form";
import { loadJobFormData } from "../../form-data";
import type { JobInput } from "../../schema";

export default async function EditJobPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

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
    contract_file_path: job.contract_file_path ?? "",
    contract_file_name: job.contract_file_name ?? "",
    workshop_exit_date: job.workshop_exit_date ?? "",
    delivery_date: job.delivery_date ?? "",
    quantity_text: job.quantity_text ?? "",
    job_leader: job.job_leader ?? "",
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
