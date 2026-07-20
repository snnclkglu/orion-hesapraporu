import Link from "next/link";
import { notFound } from "next/navigation";
import { Construction } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { getReportSettings } from "@/lib/settings";
import { cn } from "@/lib/utils";
import { NewProjectDialog } from "../../projects/new-project-dialog";
import { JobArchiveButton } from "./job-archive-button";

export default async function JobPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: job } = await supabase
    .from("jobs")
    .select("id, job_no, title, customer, status, notes, created_at")
    .eq("id", id)
    .single();

  if (!job) notFound();

  const [{ data: cranes }, settings] = await Promise.all([
    supabase
      .from("projects")
      .select("id, doc_no, name, crane_type, status, created_at, revisions(rev_no, status)")
      .eq("job_id", id)
      .order("doc_no", { ascending: true }),
    getReportSettings(supabase),
  ]);

  const list = cranes ?? [];

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm text-muted-foreground">
            <Link href="/jobs" className="hover:underline">İşler</Link>
            {" / "}
            <span className="font-mono">{job.job_no}</span>
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{job.title}</h1>
          <p className="text-sm text-muted-foreground">
            {job.customer} · {new Date(job.created_at).toLocaleDateString("tr-TR")}
          </p>
          {job.notes && (
            <p className="mt-2 max-w-2xl text-sm whitespace-pre-line text-muted-foreground">
              {job.notes}
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <span className="inline-flex items-center gap-1.5">
              <span
                className={cn(
                  "size-2 rounded-full",
                  job.status === "active" ? "bg-success" : "bg-muted-foreground/40"
                )}
              />
              {job.status === "active" ? "aktif" : "arşiv"}
            </span>
            <JobArchiveButton jobId={job.id} archived={job.status === "archived"} />
          </div>
        </div>
        <NewProjectDialog
          defaultCraneType={settings.default_crane_type}
          jobId={job.id}
          jobNo={job.job_no}
          defaultCustomer={job.customer}
        />
      </div>

      {list.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-card px-6 py-14 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Construction className="size-6" />
          </span>
          <div>
            <h2 className="text-base font-semibold">Bu işte henüz vinç yok</h2>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              &quot;Vinç Ekle&quot; ile işe bağlı ilk vinci oluşturun; her vinç
              hesap raporu, ekipman listesi ve teknik çizim takibiyle gelir.
            </p>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card shadow-xs">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead>Doküman No</TableHead>
                <TableHead>Vinç</TableHead>
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
                    <TableCell className="font-mono text-sm font-medium text-primary">
                      <Link href={`/projects/${p.id}`} className="after:absolute after:inset-0">
                        {p.doc_no}
                      </Link>
                    </TableCell>
                    <TableCell className="font-medium">{p.name}</TableCell>
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
                            "size-2 rounded-full",
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
