import { notFound } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { jobStatusLabel } from "@/lib/job-status";
import {
  projectRowsFromRecords,
  type ProjectListRecord,
} from "@/lib/project-list";
import { ENGINEERING_REPORT_CONTEXT } from "@/lib/report-context";
import { getReportSettings } from "@/lib/settings";
import { createClient } from "@/lib/supabase/server";
import {
  NewProjectDialog,
  type CustomerOption,
  type JobItemOption,
  type JobOption,
} from "../../new-project-dialog";
import { ProjectsTable } from "../../projects-table";

export default async function JobProjectDocumentsPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const parsedId = z.uuid().safeParse((await params).jobId);
  if (!parsedId.success) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [
    { data: job },
    { data: projects },
    { data: activeJobsData },
    { data: customersData },
    settings,
  ] = await Promise.all([
    supabase
      .from("jobs")
      .select("id, job_no, title, customer, customer_id, status, job_items(id, item_no, product_name, quantity, project_id)")
      .eq("id", parsedId.data)
      .maybeSingle(),
    supabase
      .from("projects")
      .select("id, doc_no, name, customer, crane_type, crane_location, report_brand_customer_id, end_customer_id, status, created_at, job_id, revisions(rev_no, status)")
      .eq("report_context", ENGINEERING_REPORT_CONTEXT)
      .eq("job_id", parsedId.data)
      .order("created_at", { ascending: false }),
    supabase
      .from("jobs")
      .select("id, job_no, title, customer, customer_id, job_items(id, item_no, product_name, quantity, project_id)")
      .eq("status", "active")
      .order("created_at", { ascending: false }),
    supabase
      .from("customers")
      .select("id, name, short_name, logo_path")
      .order("name", { ascending: true }),
    getReportSettings(supabase),
  ]);
  if (!job) notFound();

  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
    : { data: null };
  const isAdmin = profile?.role === "admin";

  const rows = projectRowsFromRecords(
    (projects ?? []) as unknown as ProjectListRecord[]
  ).map((row) => ({
    ...row,
    job_no: job.job_no,
    job_title: job.title,
    job_customer: job.customer,
  }));

  const activeJobs: JobOption[] = (activeJobsData ?? []).map((entry) => ({
    id: entry.id,
    job_no: entry.job_no,
    title: entry.title,
    customer: entry.customer,
    customer_id: entry.customer_id,
    items: (entry.job_items ?? []) as unknown as JobItemOption[],
  }));
  const currentJob: JobOption = {
    id: job.id,
    job_no: job.job_no,
    title: job.title,
    customer: job.customer,
    customer_id: job.customer_id,
    items: (job.job_items ?? []) as unknown as JobItemOption[],
  };
  const customerOptions: CustomerOption[] = (customersData ?? []).map((entry) => ({
    id: entry.id,
    name: entry.name,
    short_name: entry.short_name,
    has_logo: Boolean(entry.logo_path),
  }));
  const issuedDocumentCount = rows.filter((row) => row.hasIssuedRevision).length;

  return (
    <div className="grid min-w-0 max-w-full gap-4 overflow-x-clip">
      <PageHeader
        kicker="Mühendislik · İş"
        title={`${job.job_no} · ${job.title}`}
        hint={`${job.customer} · ${rows.length} doküman${
          issuedDocumentCount > 0 ? ` · ${issuedDocumentCount} yayınlı` : ""
        }`}
        backHref="/projects"
        backLabel="Mühendislik listesine dön"
      >
        {job.status === "active" && (
          <NewProjectDialog
            defaultCraneType={settings.default_crane_type}
            jobs={[currentJob]}
            customers={customerOptions}
            fixedJobId={job.id}
          />
        )}
      </PageHeader>

      <section className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border bg-card px-3 py-2 text-sm">
        <span className="font-mono font-medium text-primary">{job.job_no}</span>
        <span className="min-w-0 flex-1 truncate font-medium" title={job.title}>
          {job.title}
        </span>
        <span className="truncate text-muted-foreground" title={job.customer}>
          {job.customer}
        </span>
        <Badge variant="outline">{jobStatusLabel(job.status)}</Badge>
        <span className="font-mono text-xs tabular-nums text-muted-foreground">
          {rows.length} doküman
        </span>
      </section>

      {rows.length > 0 ? (
        <ProjectsTable
          projects={rows}
          jobs={activeJobs}
          customerOptions={customerOptions}
          canDelete={isAdmin}
          groupByJob={false}
          showJobColumn={false}
          defaultSort={{ key: "doc_no", dir: "asc" }}
        />
      ) : (
        <div className="grid place-items-center gap-2 rounded-lg border bg-card px-6 py-14 text-center">
          <h2 className="font-medium">Bu işe bağlı hesap raporu yok</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            Aktif bir iş kalemi için yeni hesap raporu oluşturduğunuzda doküman burada görünür.
          </p>
        </div>
      )}
    </div>
  );
}
