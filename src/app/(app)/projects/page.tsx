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
import { getReportSettings } from "@/lib/settings";
import { cn } from "@/lib/utils";

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
        {hint && <div className="mt-0.5 truncate text-[11px] text-foreground/70">{hint}</div>}
      </div>
    </div>
  );
}

export default async function ProjectsPage() {
  const supabase = await createClient();
  const [{ data: projects }, { data: jobsData }, settings] = await Promise.all([
    supabase
      .from("projects")
      .select("id, doc_no, name, customer, crane_type, status, created_at, job_id, jobs:job_id(job_no), revisions(rev_no, status)")
      .order("created_at", { ascending: false }),
    supabase
      .from("jobs")
      .select("id, job_no, title, customer, job_items(item_no, product_name, quantity, project_id)")
      .eq("status", "active")
      .order("created_at", { ascending: false }),
    getReportSettings(supabase),
  ]);
  // Yeni rapor dialogunda iş + kalem seçimi için kalemleri de taşırız.
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
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Projeler</h1>
          <p className="text-sm text-muted-foreground">
            Hesap raporu projeleri ve revizyon arşivi
          </p>
        </div>
        <NewProjectDialog defaultCraneType={settings.default_crane_type} jobs={jobs} />
      </div>

      {/* İstatistik kartları */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Toplam Proje"
          value={String(list.length)}
          hint={`${list.filter((p) => p.status === "active").length} aktif`}
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
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead>İş No</TableHead>
                <TableHead>Doküman No</TableHead>
                <TableHead>Proje</TableHead>
                <TableHead>Müşteri</TableHead>
                <TableHead>Vinç Tipi</TableHead>
                <TableHead>Son Revizyon</TableHead>
                <TableHead>Durum</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((p) => {
                const lastRev = [...(p.revisions ?? [])].sort((a, b) => b.rev_no - a.rev_no)[0];
                return (
                  <TableRow key={p.id} className="relative cursor-pointer">
                    <TableCell className="font-mono text-sm text-muted-foreground">
                      {(p.jobs as unknown as { job_no: string } | null)?.job_no ?? (
                        <span className="text-muted-foreground/60">bağımsız</span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-sm font-medium text-primary">
                      <Link href={`/projects/${p.id}`} className="after:absolute after:inset-0">
                        {p.doc_no}
                      </Link>
                    </TableCell>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="text-muted-foreground">{p.customer}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.crane_type}</TableCell>
                    <TableCell>
                      {lastRev ? (
                        <span className="inline-flex items-center gap-1.5 text-sm">
                          <span className="font-mono">V{lastRev.rev_no}</span>
                          <Badge
                            variant={lastRev.status === "issued" ? "default" : "secondary"}
                          >
                            {lastRev.status === "issued" ? "yayınlandı" : "taslak"}
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
                        {p.status === "active" ? "aktif" : "arşiv"}
                      </span>
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
