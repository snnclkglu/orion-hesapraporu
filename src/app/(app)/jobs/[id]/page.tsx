import Link from "next/link";
import { notFound } from "next/navigation";
import { FileDown, Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ContractOpenButton } from "../contract-upload";
import { JobStatusMenu } from "../job-status-menu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

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

/** Kaleme bağlı hesap raporunun özeti (son revizyon rozetiyle) */
interface LinkedReport {
  id: string;
  doc_no: string;
  name: string;
  status: string;
  revisions?: { rev_no: number; status: string }[] | null;
}

function ReportCell({ report }: { report: LinkedReport | null }) {
  if (!report) {
    return (
      <span className="text-xs text-muted-foreground/70">
        Rapor bağlı değil
      </span>
    );
  }
  const lastRev = [...(report.revisions ?? [])].sort((a, b) => b.rev_no - a.rev_no)[0];
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <Link
        href={`/projects/${report.id}`}
        className="font-mono text-sm font-medium text-primary hover:underline"
      >
        {report.doc_no}
      </Link>
      {lastRev && (
        <Badge variant={lastRev.status === "issued" ? "default" : "secondary"} className="text-[10px]">
          V{lastRev.rev_no} · {lastRev.status === "issued" ? "yayınlandı" : "taslak"}
        </Badge>
      )}
    </span>
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

  // Hesap raporu İŞE değil İŞ KALEMİNE bağlanır: bir iş emrinde birden çok
  // ürün olur ve her ürünün kendi raporu vardır. Kalem satırı raporunu
  // doğrudan taşır; kaleme bağlanmamış raporlar ayrı listelenir.
  const [{ data: items }, { data: cranes }] = await Promise.all([
    supabase
      .from("job_items")
      .select(
        "item_no, product_name, quantity, project_id, projects:project_id(id, doc_no, name, status, revisions(rev_no, status))"
      )
      .eq("job_id", id)
      .order("sort", { ascending: true }),
    supabase
      .from("projects")
      .select("id, doc_no, name, crane_type, status, created_at, revisions(rev_no, status)")
      .eq("job_id", id)
      .order("doc_no", { ascending: true }),
  ]);

  const itemList = items ?? [];
  const linkedProjectIds = new Set(
    itemList.map((it) => it.project_id).filter((v): v is string => Boolean(v))
  );
  // Kaleme bağlanmamış raporlar (eski kayıtlar ya da doğrudan işe bağlananlar)
  const unlinked = (cranes ?? []).filter((p) => !linkedProjectIds.has(p.id));
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
            <JobStatusMenu jobId={job.id} status={job.status} size="md" />
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

      {/* İş kalemleri — her kalem kendi hesap raporunu taşır */}
      <div className="overflow-hidden rounded-lg border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/40 px-4 py-2">
          <span className="text-sm font-semibold">İş Kalemleri</span>
          <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
            {itemList.length} kalem · {linkedProjectIds.size} rapor bağlı
          </span>
        </div>
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
                <TableHead className="w-[6%]">#</TableHead>
                <TableHead className="w-[14%]">İş Kalemi No</TableHead>
                <TableHead>Ürün Adı</TableHead>
                <TableHead className="w-[9%]">Adet</TableHead>
                <TableHead className="w-[26%]">Hesap Raporu</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {itemList.map((it, i) => (
                <TableRow key={i}>
                  <TableCell className="font-mono tabular-nums text-muted-foreground">{i + 1}</TableCell>
                  <TableCell className="font-mono text-sm text-primary">{it.item_no || "—"}</TableCell>
                  <TableCell className="font-medium">{it.product_name}</TableCell>
                  <TableCell className="font-mono tabular-nums">{it.quantity || "—"}</TableCell>
                  <TableCell>
                    <ReportCell
                      report={(it.projects as unknown as LinkedReport | null) ?? null}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <p className="border-t px-4 py-2 text-[11px] text-muted-foreground">
          Hesap raporu iş kalemine bağlanır. Bağlamak için Projeler bölümünde
          raporun satır menüsünden &quot;İşe Bağla&quot; ile bu işi ve kalemi seçin.
        </p>
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
          {job.contract_file_path ? (
            <div className="mt-3">
              <ContractOpenButton
                path={job.contract_file_path}
                fileName={job.contract_file_name}
              />
            </div>
          ) : job.contract_exists ? (
            <p className="mt-3 text-xs text-muted-foreground">
              Sözleşme dosyası yüklenmemiş — &quot;Düzenle&quot; ile PDF ekleyebilirsiniz.
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-1.5">
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

      {/* Kaleme bağlanmamış raporlar — eski kayıtlarda ya da kalem açılmadan
          bağlanan raporlarda görünür; kaleme taşınması için hatırlatıcıdır. */}
      {unlinked.length > 0 && (
        <div>
          <h2 className="mb-1 text-lg font-semibold tracking-tight">
            Kaleme Bağlanmamış Hesap Raporları
          </h2>
          <p className="mb-3 text-sm text-muted-foreground">
            Bu raporlar işe bağlı ama bir iş kalemine atanmamış. Projeler
            bölümündeki &quot;İşe Bağla&quot; ile kalem seçerek eşleştirin.
          </p>
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
                {unlinked.map((p) => {
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
                          {p.status === "active" ? "Aktif" : "Arşiv"}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
