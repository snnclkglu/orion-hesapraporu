import Link from "next/link";
import {
  CircleCheck,
  Clock3,
  FolderKanban,
  History,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { NewProjectDialog, type JobItemOption } from "./new-project-dialog";
import { ProjectRowActions } from "./project-actions";
import { getReportSettings } from "@/lib/settings";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border bg-card p-4">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 leading-tight">
        <div className="oc-kicker text-muted-foreground">{label}</div>
        <div className="mt-0.5 font-mono text-xl font-semibold tabular-nums tracking-tight">
          {value}
        </div>
        {/* `truncate` kırptığında tam metnin görünebileceği tek yer ipucudur. */}
        {hint && (
          <div className="mt-0.5 truncate text-[11px] text-foreground/70" title={hint}>
            {hint}
          </div>
        )}
      </div>
    </div>
  );
}

export default async function ProjectsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: projects }, { data: jobsData }, settings] = await Promise.all([
    supabase
      .from("projects")
      .select("id, doc_no, name, customer, crane_type, status, created_at, job_id, jobs:job_id(job_no), revisions(rev_no, status)")
      .order("created_at", { ascending: false }),
    supabase
      .from("jobs")
      .select("id, job_no, title, customer, job_items(id, item_no, product_name, quantity, project_id)")
      .eq("status", "active")
      .order("created_at", { ascending: false }),
    getReportSettings(supabase),
  ]);

  // Silme yalnızca yöneticide: projects DELETE politikası is_admin() ister,
  // yetkisiz kullanıcıya buton hiç gösterilmez.
  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
    : { data: null };
  const isAdmin = profile?.role === "admin";
  // Yeni rapor / kopyalama / işe bağlama dialoglarında kalemler de gerekir.
  const jobs = (jobsData ?? []).map((j) => ({
    id: j.id,
    job_no: j.job_no,
    title: j.title,
    customer: j.customer,
    items: (j.job_items ?? []) as unknown as JobItemOption[],
  }));

  const list = projects ?? [];
  const allRevs = list.flatMap((p) => p.revisions ?? []);
  const draftCount = allRevs.filter((r) => r.status === "draft").length;
  const issuedCount = allRevs.filter((r) => r.status === "issued").length;
  const lastCreated = list[0]?.created_at
    ? new Date(list[0].created_at).toLocaleDateString("tr-TR")
    : "—";

  return (
    <div className="grid gap-4">
      <PageHeader title="Projeler" hint="Hesap raporu projeleri ve revizyon arşivi">
        <NewProjectDialog defaultCraneType={settings.default_crane_type} jobs={jobs} />
      </PageHeader>

      {/* İstatistik kartları */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Toplam Proje"
          value={String(list.length)}
          hint={`${list.filter((p) => p.status === "active").length} Aktif`}
          icon={FolderKanban}
        />
        <StatCard
          label="Taslak Revizyon"
          value={String(draftCount)}
          hint="düzenlemeye açık"
          icon={Clock3}
        />
        <StatCard
          label="Yayınlanan Revizyon"
          value={String(issuedCount)}
          hint="kilitli snapshot"
          icon={CircleCheck}
        />
        <StatCard
          label="Son Proje"
          value={lastCreated}
          hint={list[0]?.doc_no ?? "kayıt yok"}
          icon={History}
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
            [ HENÜZ PROJE YOK ]
          </h2>
          <p className="max-w-sm bg-card px-3 py-1 text-sm text-foreground/70">
            İlk hesap raporu projenizi oluşturun; her proje revizyon arşivi ve
            yayınlanabilir PDF raporlarla birlikte gelir.
          </p>
          <NewProjectDialog defaultCraneType={settings.default_crane_type} jobs={jobs} />
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card">
          <Table>
            <TableHeader>
              {/* SÜTUN ÖNCELİKLENDİRME — sekiz sütunluk satır telefonda kabın
                  (~341px) bir buçuk katıydı ve sağdaki Durum/İşlem hiç
                  görünmüyordu. Mobilde yalnız Doküman No · Proje · Durum ·
                  İşlem kalır; gizlenenlerin kritik olanları proje adının
                  altına iner (aşağıdaki md:hidden satır). */}
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="hidden md:table-cell">İş No</TableHead>
                <TableHead>Doküman No</TableHead>
                <TableHead>Proje</TableHead>
                <TableHead className="hidden md:table-cell">Müşteri</TableHead>
                <TableHead className="hidden lg:table-cell">Vinç Tipi</TableHead>
                <TableHead className="hidden md:table-cell">Son Revizyon</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead className="w-12 text-right">İşlem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((p) => {
                const lastRev = [...(p.revisions ?? [])].sort((a, b) => b.rev_no - a.rev_no)[0];
                const jobNo = (p.jobs as unknown as { job_no: string } | null)?.job_no;
                return (
                  <TableRow key={p.id} className="relative cursor-pointer">
                    <TableCell className="hidden font-mono text-sm text-muted-foreground md:table-cell">
                      {jobNo && p.job_id ? (
                        <Link
                          href={`/jobs/${p.job_id}`}
                          className="relative z-10 inline-flex min-h-9 items-center text-primary hover:underline pointer-coarse:min-h-10"
                        >
                          {jobNo}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground/60">bağımsız</span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-sm font-medium text-primary">
                      <Link href={`/projects/${p.id}`} className="after:absolute after:inset-0">
                        {p.doc_no}
                      </Link>
                    </TableCell>
                    <TableCell className="font-medium whitespace-normal">
                      {p.name}
                      {/* Mobilde gizlenen sütunların kritik olanları — kart
                          markup'ı çoğaltmadan, aynı hücrenin ikinci satırı. */}
                      <div className="mt-0.5 text-[11px] font-normal whitespace-normal text-muted-foreground md:hidden">
                        {/* İş no BURADA DA BAĞLANTIDIR: sütunu gizlemek bilgiyi
                            korur ama iş emrine geçişi telefonda tümüyle
                            kaybettiriyordu. `relative z-10` satırın tamamını
                            kaplayan proje bağlantısının üstünde kalmasını
                            sağlar (aksi hâlde dokunuş projeye giderdi). */}
                        {jobNo && p.job_id ? (
                          <>
                            <Link
                              href={`/jobs/${p.job_id}`}
                              className="relative z-10 font-mono text-primary hover:underline"
                            >
                              {jobNo}
                            </Link>
                            {" · "}
                          </>
                        ) : null}
                        {p.customer}
                        {lastRev
                          ? ` · V${lastRev.rev_no} ${lastRev.status === "issued" ? "Yayınlandı" : "Taslak"}`
                          : ""}
                      </div>
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">
                      {p.customer}
                    </TableCell>
                    <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">
                      {p.crane_type}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {lastRev ? (
                        <span className="inline-flex items-center gap-1.5 text-sm">
                          <span className="font-mono">V{lastRev.rev_no}</span>
                          <Badge
                            variant={lastRev.status === "issued" ? "default" : "secondary"}
                          >
                            {lastRev.status === "issued" ? "Yayınlandı" : "Taslak"}
                          </Badge>
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5 text-sm">
                        <span
                          className={cn(
                            "size-2",
                            p.status === "active" ? "bg-success" : "bg-muted-foreground/40"
                          )}
                        />
                        {p.status === "active" ? "Aktif" : "Arşiv"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <ProjectRowActions
                        project={{
                          id: p.id,
                          doc_no: p.doc_no,
                          name: p.name,
                          customer: p.customer,
                          job_id: p.job_id ?? null,
                          job_no: jobNo ?? null,
                          hasIssuedRevision: (p.revisions ?? []).some(
                            (r) => r.status === "issued"
                          ),
                        }}
                        jobs={jobs}
                        canDelete={isAdmin}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
