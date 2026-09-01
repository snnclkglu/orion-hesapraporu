import {
  Archive,
  CircleCheck,
  Clock3,
  FolderKanban,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  NewProjectDialog,
  type CustomerOption,
  type JobItemOption,
} from "./new-project-dialog";
import { ProjectsTable, type ProjectRow } from "./projects-table";
import { getReportSettings } from "@/lib/settings";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import {
  OFFER_REPORT_CONTEXT,
  reportBasePath,
  type ReportContext,
} from "@/lib/report-context";

/**
 * Mühendislik ve Teklif Hesap Raporları listelerinin ortak sunucu görünümü.
 *
 * İki ekran aynı `projects`/`revisions` zincirini, aynı tabloyu ve aynı yeni
 * rapor penceresini kullanır. Tek ayrım `projects.report_context` süzgecidir;
 * böylece hesap davranışı kopyalanmadan iki arşiv birbirine karışmaz.
 */
export async function ProjectListPage({ context }: { context: ReportContext }) {
  const offerContext = context === OFFER_REPORT_CONTEXT;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const projectQuery = supabase
    .from("projects")
    .select("id, doc_no, name, customer, crane_type, crane_location, report_brand_customer_id, end_customer_id, status, created_at, job_id, jobs:job_id(job_no), revisions(rev_no, status)")
    .eq("report_context", context)
    .order("created_at", { ascending: false });

  const [{ data: projects }, { data: jobsData }, { data: customersData }, settings] = await Promise.all([
    projectQuery,
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

  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
    : { data: null };
  const isAdmin = profile?.role === "admin";
  // Teklif raporu kazanılmış bir işe bağlanmaz. Sorgunun sonucu yalnız ortak
  // TS tipini korumak için alınır; teklif bağlamında seçenek listesine girmez.
  const jobs = (offerContext ? [] : jobsData ?? []).map((job) => ({
    id: job.id,
    job_no: job.job_no,
    title: job.title,
    customer: job.customer,
    customer_id: job.customer_id,
    items: (job.job_items ?? []) as unknown as JobItemOption[],
  }));
  const customerOptions: CustomerOption[] = (customersData ?? []).map((entry) => ({
    id: entry.id,
    name: entry.name,
    short_name: entry.short_name,
    has_logo: Boolean(entry.logo_path),
  }));

  const list = projects ?? [];
  const allRevs = list.flatMap((project) => project.revisions ?? []);
  const draftCount = allRevs.filter((revision) => revision.status === "draft").length;
  const issuedCount = allRevs.filter((revision) => revision.status === "issued").length;
  const archivedCount = list.filter((project) => project.status === "archived").length;

  const rows: ProjectRow[] = list.map((project) => {
    const lastRev = [...(project.revisions ?? [])].sort((a, b) => b.rev_no - a.rev_no)[0];
    return {
      id: project.id,
      doc_no: project.doc_no,
      name: project.name,
      customer: project.customer,
      crane_type: project.crane_type,
      crane_location: project.crane_location,
      report_brand_customer_id: project.report_brand_customer_id,
      end_customer_id: project.end_customer_id,
      status: project.status,
      created_at: project.created_at,
      job_id: (project.job_id as string | null) ?? null,
      job_no: (project.jobs as unknown as { job_no: string } | null)?.job_no ?? null,
      lastRevNo: lastRev?.rev_no ?? null,
      lastRevStatus: lastRev?.status ?? null,
      hasIssuedRevision: (project.revisions ?? []).some(
        (revision) => revision.status === "issued"
      ),
    };
  });

  const title = offerContext ? "Teklif Hesap Raporları" : "Mühendislik";
  const hint = offerContext
    ? "Teklif aşamasındaki hızlı mühendislik hesapları; Mühendislik arşivinden ayrı, aynı hesap motoruyla."
    : "Hesap raporu projeleri ve revizyon arşivi";

  return (
    <div className="grid min-w-0 max-w-full gap-4 overflow-x-clip">
      <PageHeader kicker={offerContext ? "Teklif" : undefined} title={title} hint={hint}>
        <NewProjectDialog
          defaultCraneType={settings.default_crane_type}
          jobs={offerContext ? undefined : jobs}
          customers={customerOptions}
          reportContext={context}
        />
      </PageHeader>

      <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-2 sm:gap-3 lg:grid-cols-4">
        <StatCard
          label={offerContext ? "Toplam Teklif Raporu" : "Toplam Proje"}
          value={String(list.length)}
          hint={`${list.length - archivedCount} Aktif`}
          icon={FolderKanban}
          responsiveCompact
        />
        <StatCard
          label="Taslak Revizyon"
          value={String(draftCount)}
          hint="Düzenlemeye Açık"
          icon={Clock3}
          responsiveCompact
        />
        <StatCard
          label="Yayınlanan Revizyon"
          value={String(issuedCount)}
          hint="Kilitli Snapshot"
          icon={CircleCheck}
          responsiveCompact
        />
        <StatCard
          label="Arşivlenen Rapor"
          value={String(archivedCount)}
          hint={
            archivedCount > 0
              ? "Listede kalır — Durum süzgecinden görülür"
              : "Arşivlenmiş rapor yok"
          }
          icon={Archive}
          responsiveCompact
        />
      </div>

      {list.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center gap-4 border bg-card px-6 py-16 text-center"
          style={{
            backgroundImage:
              "repeating-linear-gradient(135deg, var(--muted) 0 10px, transparent 10px 20px)",
          }}
        >
          <h2 className="border bg-background px-3 py-1.5 font-mono text-xs font-medium tracking-[0.15em]">
            [ HENÜZ HESAP RAPORU YOK ]
          </h2>
          <p className="max-w-md bg-card px-3 py-1 text-sm text-foreground/70">
            {offerContext
              ? "İlk teklif hesap raporunuzu oluşturun; çalışma Mühendislik listesinden ayrı tutulur ve aynı hesap motoruyla açılır."
              : "İlk hesap raporu projenizi oluşturun; her proje revizyon arşivi ve yayınlanabilir PDF raporlarla birlikte gelir."}
          </p>
          <NewProjectDialog
            defaultCraneType={settings.default_crane_type}
            jobs={offerContext ? undefined : jobs}
            customers={customerOptions}
            reportContext={context}
          />
        </div>
      ) : (
        <ProjectsTable
          projects={rows}
          jobs={jobs}
          customerOptions={customerOptions}
          canDelete={isAdmin}
          basePath={reportBasePath(context)}
          reportContext={context}
        />
      )}
    </div>
  );
}
