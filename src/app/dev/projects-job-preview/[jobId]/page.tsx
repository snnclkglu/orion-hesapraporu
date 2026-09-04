import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { ProjectsTable, type ProjectRow } from "@/app/(app)/projects/projects-table";
import { NewProjectDialog, type JobOption } from "@/app/(app)/projects/new-project-dialog";

const JOB: JobOption = {
  id: "0057",
  job_no: "0057",
  title: "MUHTELİF VİNÇLER",
  customer: "ASTOR A.Ş.",
  items: [
    { id: "item-1", item_no: "0057-01", product_name: "1 T TEK KİRİŞLİ VİNÇ", quantity: "1", project_id: "0057-01" },
    { id: "item-2", item_no: "0057-02", product_name: "2 T ÇİFT KİRİŞLİ VİNÇ", quantity: "1", project_id: "0057-02" },
    { id: "item-3", item_no: "0057-03", product_name: "3,2 T MONORAY VİNÇ", quantity: "1", project_id: "0057-03" },
  ],
};

const ROWS: ProjectRow[] = [
  {
    id: "0057-01",
    doc_no: "0057-01",
    name: "1 T X 19,00 M KAPASİTELİ TEK KİRİŞLİ KÖPRÜLÜ TAVAN VİNCİ",
    customer: "ASTOR A.Ş.",
    crane_type: "Tek Kirişli Gezer Köprülü Vinç",
    status: "active",
    created_at: "2026-05-14T09:00:00Z",
    job_id: JOB.id,
    job_no: JOB.job_no,
    job_title: JOB.title,
    job_customer: JOB.customer,
    lastRevNo: 0,
    lastRevStatus: "draft",
    hasIssuedRevision: false,
  },
  {
    id: "0057-02",
    doc_no: "0057-02",
    name: "2 T X 12,00 M KAPASİTELİ ÇİFT KİRİŞLİ KÖPRÜLÜ TAVAN VİNCİ",
    customer: "ASTOR A.Ş.",
    crane_type: "Çift Kirişli Gezer Köprülü Vinç",
    status: "active",
    created_at: "2026-05-15T09:00:00Z",
    job_id: JOB.id,
    job_no: JOB.job_no,
    job_title: JOB.title,
    job_customer: JOB.customer,
    lastRevNo: 1,
    lastRevStatus: "issued",
    hasIssuedRevision: true,
  },
  {
    id: "0057-03",
    doc_no: "0057-03",
    name: "3,2 T KAPASİTELİ MONORAY SERVİS VİNCİ",
    customer: "ASTOR A.Ş.",
    crane_type: "Monoray Vinç",
    status: "archived",
    created_at: "2026-05-16T09:00:00Z",
    job_id: JOB.id,
    job_no: JOB.job_no,
    job_title: JOB.title,
    job_customer: JOB.customer,
    lastRevNo: 2,
    lastRevStatus: "issued",
    hasIssuedRevision: true,
  },
];

export default async function ProjectsJobPreviewPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  if (process.env.NODE_ENV !== "development") notFound();
  await params;

  return (
    <main className="mx-auto grid min-h-dvh w-full max-w-none gap-4 px-3 py-4 sm:px-4 sm:py-6 lg:px-8">
      <PageHeader
        kicker="Mühendislik · İş"
        title="0057 · MUHTELİF VİNÇLER"
        hint="ASTOR A.Ş. · 3 doküman · 2 yayınlı"
        backHref="/dev/projects-preview"
      >
        <NewProjectDialog jobs={[JOB]} fixedJobId={JOB.id} />
      </PageHeader>
      <section className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border bg-card px-3 py-2 text-sm">
        <span className="font-mono font-medium text-primary">0057</span>
        <span className="min-w-0 flex-1 truncate font-medium">MUHTELİF VİNÇLER</span>
        <span className="text-muted-foreground">ASTOR A.Ş.</span>
        <span className="font-mono text-xs text-muted-foreground">3 doküman</span>
      </section>
      <ProjectsTable
        projects={ROWS}
        jobs={[JOB]}
        canDelete
        groupByJob={false}
        showJobColumn={false}
        defaultSort={{ key: "doc_no", dir: "asc" }}
      />
    </main>
  );
}
