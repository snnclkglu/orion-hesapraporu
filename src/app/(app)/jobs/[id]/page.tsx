import Link from "next/link";
import { notFound } from "next/navigation";
import { FileDown, Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { getReportSettings } from "@/lib/settings";
import { cn } from "@/lib/utils";
import { NewProjectDialog } from "../../projects/new-project-dialog";
import { JobArchiveButton } from "./job-archive-button";

const SCOPE_LABELS: [string, string][] = [
  ["proje", "Proje"], ["devreyeAlma", "Devreye Alma"], ["malzeme", "Malzeme"],
  ["nakliye", "Nakliye"], ["imalat", "İmalat"], ["montaj", "Montaj"],
];

function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso;
}

function KV({
  label,
  value,
  mono = false,
}: {
  label: string;
  value?: string | null;
  mono?: boolean; // tarih/sayı gibi teknik değerler mono dizilir
}) {
  return (
    <div className="flex gap-2 border-b py-1 last:border-0">
      <span className="w-32 shrink-0 text-xs text-muted-foreground">{label}</span>
      <span className={mono ? "font-mono text-sm tabular-nums" : "text-sm"}>
        {value && String(value).trim() ? value : "—"}
      </span>
    </div>
  );
}

export default async function JobPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: job } = await supabase.from("jobs").select("*").eq("id", id).single();
  if (!job) notFound();

  const [{ data: items }, { data: cranes }, settings] = await Promise.all([
    supabase
      .from("job_items")
      .select("item_no, product_name, quantity, project_id")
      .eq("job_id", id)
      .order("sort", { ascending: true }),
    supabase
      .from("projects")
      .select("id, doc_no, name, crane_type, status, created_at, revisions(rev_no, status)")
      .eq("job_id", id)
      .order("doc_no", { ascending: true }),
    getReportSettings(supabase),
  ]);

  const itemList = items ?? [];
  const list = cranes ?? [];
  const scope = (job.scope ?? {}) as Record<string, boolean>;
  const activeScopes = SCOPE_LABELS.filter(([k]) => scope[k]).map(([, l]) => l);

  return (
    <div className="grid gap-6">
      {/* Başlık + eylemler */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm text-muted-foreground">
            <Link href="/jobs" className="hover:underline">İşler</Link>
            {" / "}
            <span className="font-mono">{job.job_no}</span>
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{job.title}</h1>
          <p className="text-sm text-muted-foreground">
            {job.customer} · İş Emri Tarihi:{" "}
            <span className="font-mono tabular-nums">{fmtDate(job.work_order_date)}</span>
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <span className="inline-flex items-center gap-1.5">
              <span className={cn("size-2 rounded-full", job.status === "active" ? "bg-success" : "bg-muted-foreground/40")} />
              {job.status === "active" ? "aktif" : "arşiv"}
            </span>
            <JobArchiveButton jobId={job.id} archived={job.status === "archived"} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <a href={`/jobs/${job.id}/work-order`}>
              <FileDown className="size-3.5" /> İş Emri PDF
            </a>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/jobs/${job.id}/edit`}>
              <Pencil className="size-3.5" /> Düzenle
            </Link>
          </Button>
        </div>
      </div>

      {/* İş kalemleri */}
      <div className="overflow-hidden rounded-lg border bg-card">
        <div className="border-b bg-muted/40 px-4 py-2 text-sm font-semibold">İş Kalemleri</div>
        {itemList.length === 0 ? (
          <div
            className="flex flex-col items-center gap-2 px-4 py-8 text-center"
            style={{
              backgroundImage:
                "repeating-linear-gradient(135deg, var(--muted) 0 10px, transparent 10px 20px)",
            }}
          >
            <span className="border bg-background px-3 py-1.5 font-mono text-xs font-medium tracking-[0.15em]">
              [ KALEM YOK ]
            </span>
            <p className="bg-card px-3 py-1 text-sm text-foreground/70">
              Kalem yok. &quot;Düzenle&quot; ile ürün/iş no ekleyin.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="w-[8%]">#</TableHead>
                <TableHead>Ürün Adı</TableHead>
                <TableHead className="w-[16%]">İş No</TableHead>
                <TableHead className="w-[12%]">Adet</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {itemList.map((it, i) => (
                <TableRow key={i}>
                  <TableCell className="font-mono tabular-nums text-muted-foreground">{i + 1}</TableCell>
                  <TableCell className="font-medium">{it.product_name}</TableCell>
                  <TableCell className="font-mono text-sm text-primary">{it.item_no || "—"}</TableCell>
                  <TableCell className="font-mono tabular-nums">{it.quantity || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Müşteri + iş bilgileri */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border bg-card p-4">
          <h2 className="mb-2 text-sm font-semibold">Müşteri Bilgileri</h2>
          <KV label="Adı" value={job.customer} />
          <KV label="Adresi" value={job.customer_address} />
          <KV label="Vergi Dairesi" value={job.customer_tax_office} />
          <KV label="Vergi No" value={job.customer_tax_no} mono />
          <KV label="Telefon" value={job.customer_phone} mono />
          <KV label="Faks" value={job.customer_fax} mono />
        </div>
        <div className="rounded-lg border bg-card p-4">
          <h2 className="mb-2 text-sm font-semibold">İş Bilgileri</h2>
          <KV label="Sözleşme" value={job.contract_exists ? "VAR" : "YOK"} />
          <KV label="Sözleşme Tarihi" value={fmtDate(job.contract_date)} mono />
          <KV label="Atölye Çıkış" value={fmtDate(job.workshop_exit_date)} mono />
          <KV label="Teslim Tarihi" value={fmtDate(job.delivery_date)} mono />
          <KV label="Adet" value={job.quantity_text} />
          <KV label="İş Lideri" value={job.job_leader} />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {activeScopes.length > 0 ? (
              activeScopes.map((sLabel) => (
                <Badge key={sLabel} variant="secondary" className="text-[11px]">{sLabel}</Badge>
              ))
            ) : (
              <span className="text-xs text-muted-foreground">Kapsam seçilmedi</span>
            )}
          </div>
        </div>
      </div>

      {(job.notes || job.prepared_by_name) && (
        <div className="rounded-lg border bg-card p-4 text-sm">
          {job.notes && <p className="whitespace-pre-line text-muted-foreground">{job.notes}</p>}
          {job.prepared_by_name && (
            <p className="mt-2 text-xs text-muted-foreground">
              Hazırlayan: <span className="font-medium text-foreground">{job.prepared_by_name}</span>
              {job.prepared_by_title ? ` — ${job.prepared_by_title}` : ""}
            </p>
          )}
        </div>
      )}

      {/* Vinçler / hesap raporları */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">Hesap Raporları (Vinçler)</h2>
          <NewProjectDialog
            defaultCraneType={settings.default_crane_type}
            jobId={job.id}
            jobNo={job.job_no}
            defaultCustomer={job.customer}
          />
        </div>
        {list.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center gap-4 border bg-card px-6 py-12 text-center"
            style={{
              backgroundImage:
                "repeating-linear-gradient(135deg, var(--muted) 0 10px, transparent 10px 20px)",
            }}
          >
            <h3 className="border bg-background px-3 py-1.5 font-mono text-xs font-medium tracking-[0.15em]">
              [ HENÜZ HESAP RAPORU YOK ]
            </h3>
            <p className="max-w-sm bg-card px-3 py-1 text-sm text-foreground/70">
              &quot;Vinç Ekle&quot; ile işe bağlı bir hesap raporu oluşturun.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border bg-card">
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
                            <Badge variant={lastRev.status === "issued" ? "default" : "secondary"}>
                              {lastRev.status === "issued" ? "yayınlandı" : "taslak"}
                            </Badge>
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1.5 text-sm">
                          <span className={cn("size-2 rounded-full", p.status === "active" ? "bg-success" : "bg-muted-foreground/40")} />
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
    </div>
  );
}
