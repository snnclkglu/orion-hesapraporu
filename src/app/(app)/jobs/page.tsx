import Link from "next/link";
import { Briefcase, Building2, Construction, History } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { NewJobDialog } from "./new-job-dialog";

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
    <div className="flex items-start gap-3 rounded-lg border bg-card p-4 shadow-xs">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 leading-tight">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="mt-0.5 text-xl font-semibold tabular-nums tracking-tight">
          {value}
        </div>
        {hint && <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{hint}</div>}
      </div>
    </div>
  );
}

export default async function JobsPage() {
  const supabase = await createClient();
  const { data: jobs } = await supabase
    .from("jobs")
    .select("id, job_no, title, customer, status, created_at, projects(id)")
    .order("created_at", { ascending: false });

  const list = jobs ?? [];
  const craneCount = list.reduce((sum, j) => sum + (j.projects?.length ?? 0), 0);
  const customers = new Set(list.map((j) => j.customer)).size;
  const lastCreated = list[0]?.created_at
    ? new Date(list[0].created_at).toLocaleDateString("tr-TR")
    : "—";

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">İşler</h1>
          <p className="text-sm text-muted-foreground">
            İş emirleri ve içerdikleri vinçler
          </p>
        </div>
        <NewJobDialog />
      </div>

      {/* İstatistik kartları */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Toplam İş"
          value={String(list.length)}
          hint={`${list.filter((j) => j.status === "active").length} aktif`}
          icon={Briefcase}
        />
        <StatCard
          label="Bağlı Vinç"
          value={String(craneCount)}
          hint="iş emirlerine bağlı"
          icon={Construction}
        />
        <StatCard
          label="Müşteri"
          value={String(customers)}
          hint="farklı müşteri"
          icon={Building2}
        />
        <StatCard
          label="Son İş"
          value={lastCreated}
          hint={list[0]?.job_no ?? "kayıt yok"}
          icon={History}
        />
      </div>

      {list.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-card px-6 py-16 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Briefcase className="size-6" />
          </span>
          <div>
            <h2 className="text-base font-semibold">Henüz iş yok</h2>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              İlk iş emrini oluşturun; her iş birden çok vinç, hesap raporu ve
              teknik çizim takibi içerir.
            </p>
          </div>
          <NewJobDialog />
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card shadow-xs">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead>İş No</TableHead>
                <TableHead>İşin Adı</TableHead>
                <TableHead>Müşteri</TableHead>
                <TableHead>Vinç</TableHead>
                <TableHead>Tarih</TableHead>
                <TableHead>Durum</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((j) => (
                <TableRow key={j.id} className="relative cursor-pointer">
                  <TableCell className="font-mono text-sm font-medium text-primary">
                    <Link href={`/jobs/${j.id}`} className="after:absolute after:inset-0">
                      {j.job_no}
                    </Link>
                  </TableCell>
                  <TableCell className="font-medium">{j.title}</TableCell>
                  <TableCell className="text-muted-foreground">{j.customer}</TableCell>
                  <TableCell className="tabular-nums">
                    {j.projects?.length ?? 0}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(j.created_at).toLocaleDateString("tr-TR")}
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1.5 text-sm">
                      <span
                        className={cn(
                          "size-2 rounded-full",
                          j.status === "active" ? "bg-success" : "bg-muted-foreground/40"
                        )}
                      />
                      {j.status === "active" ? "aktif" : "arşiv"}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
