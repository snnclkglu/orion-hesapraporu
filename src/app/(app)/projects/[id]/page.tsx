import Link from "next/link";
import { notFound } from "next/navigation";
import { FileDown, GitCompare, ScrollText } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getDrawingCategories, DRAWING_STATUS_LABELS, type DrawingStatus,
} from "@/lib/drawings";
import { NewRevisionButton } from "./new-revision-button";
import { ArchiveButton } from "./archive-button";
import { DrawingDialog, DeleteDrawingButton, type DrawingRow } from "./drawing-dialog";

function drawingStatusBadge(status: DrawingStatus) {
  const variant =
    status === "approved" ? "default" : status === "checking" ? "outline" : "secondary";
  return <Badge variant={variant}>{DRAWING_STATUS_LABELS[status]}</Badge>;
}

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, doc_no, name, customer, crane_type, status, created_at, job_id, jobs:job_id(id, job_no, title)")
    .eq("id", id)
    .single();

  if (!project) notFound();

  const job = (project.jobs as unknown as {
    id: string;
    job_no: string;
    title: string;
  } | null) ?? null;

  const [{ data: revisions }, { data: drawings }, categories] = await Promise.all([
    supabase
      .from("revisions")
      .select("id, rev_no, label, status, engine_version, created_at, issued_at, created_by, profiles:created_by(full_name)")
      .eq("project_id", id)
      .order("rev_no", { ascending: false }),
    supabase
      .from("drawings")
      .select("id, drawing_no, title, category, revision, status, file_url, notes, created_at")
      .eq("project_id", id)
      .order("drawing_no", { ascending: true }),
    getDrawingCategories(supabase),
  ]);

  const drawingList = (drawings ?? []) as DrawingRow[];
  const latestRev = revisions?.[0];

  return (
    <div className="grid gap-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm text-muted-foreground">
            {job ? (
              <>
                <Link href="/jobs" className="hover:underline">İşler</Link>
                {" / "}
                <Link href={`/jobs/${job.id}`} className="font-mono hover:underline">
                  {job.job_no}
                </Link>
              </>
            ) : (
              <Link href="/projects" className="hover:underline">Projeler</Link>
            )}
            {" / "}
            <span className="font-mono">{project.doc_no}</span>
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{project.name}</h1>
          <p className="text-sm text-muted-foreground">
            {project.customer} · {project.crane_type}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <Link
              href={`/projects/${project.id}/compare`}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border bg-card px-3 text-sm shadow-xs hover:bg-muted"
            >
              <GitCompare className="size-3.5 text-muted-foreground" />
              Revizyonları Karşılaştır
            </Link>
            <Link
              href={`/projects/${project.id}/audit`}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border bg-card px-3 text-sm shadow-xs hover:bg-muted"
            >
              <ScrollText className="size-3.5 text-muted-foreground" />
              İşlem Kaydı
            </Link>
            <ArchiveButton projectId={project.id} archived={project.status === "archived"} />
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="flex gap-2">
            {revisions?.[0]?.status === "draft" && (
              <Link
                href={`/projects/${project.id}/revisions/${revisions[0].id}`}
                className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Düzenlemeye Devam (V{revisions[0].rev_no})
              </Link>
            )}
            <NewRevisionButton
              projectId={project.id}
              variant={revisions?.[0]?.status === "draft" ? "outline" : "default"}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Yeni revizyon, son revizyonun kopyasıyla açılır — sıfırdan başlamaz.
          </p>
        </div>
      </div>

      <Tabs defaultValue="report">
        <TabsList>
          <TabsTrigger value="report">Hesap Raporu</TabsTrigger>
          <TabsTrigger value="drawings">
            Teknik Çizimler
            {drawingList.length > 0 && (
              <span className="text-xs tabular-nums text-muted-foreground">
                ({drawingList.length})
              </span>
            )}
          </TabsTrigger>
          {/* Ekipman listesi revizyon snapshot'ından üretilir; sekme yerine
              son revizyonun indirme linki verilir. */}
          {latestRev && (
            <a
              href={`/projects/${project.id}/revisions/${latestRev.id}/equipment`}
              className="inline-flex h-[calc(100%-1px)] items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium whitespace-nowrap text-foreground/60 hover:text-foreground"
            >
              <FileDown className="size-3.5" />
              Ekipman Listesi (V{latestRev.rev_no})
            </a>
          )}
        </TabsList>

        {/* ------------------------------------------------ Hesap Raporu */}
        <TabsContent value="report">
          <div className="overflow-hidden rounded-lg border bg-card shadow-xs">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead>Revizyon</TableHead>
                  <TableHead>Etiket</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead>Oluşturan</TableHead>
                  <TableHead>Tarih</TableHead>
                  <TableHead>Motor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(revisions ?? []).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono">
                      <Link
                        href={`/projects/${project.id}/revisions/${r.id}`}
                        className="text-primary hover:underline"
                      >
                        V{r.rev_no}
                      </Link>
                    </TableCell>
                    <TableCell>{r.label}</TableCell>
                    <TableCell>
                      <Badge variant={r.status === "issued" ? "default" : "secondary"}>
                        {r.status === "issued" ? "yayınlandı" : "taslak"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {(r.profiles as unknown as { full_name: string } | null)?.full_name ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(r.created_at).toLocaleDateString("tr-TR")}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {r.engine_version || "—"}
                    </TableCell>
                  </TableRow>
                ))}
                {(revisions ?? []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      Henüz revizyon yok. &quot;Yeni Revizyon&quot; ile başlayın.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* --------------------------------------------- Teknik Çizimler */}
        <TabsContent value="drawings">
          <div className="grid gap-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Çizim kayıtları; dosyalar Google Drive linkiyle takip edilir.
              </p>
              <DrawingDialog projectId={project.id} categories={categories} />
            </div>
            <div className="overflow-hidden rounded-lg border bg-card shadow-xs">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead>Çizim No</TableHead>
                    <TableHead>Ad</TableHead>
                    <TableHead>Kategori</TableHead>
                    <TableHead>Rev</TableHead>
                    <TableHead>Durum</TableHead>
                    <TableHead>Dosya</TableHead>
                    <TableHead className="text-right">İşlem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {drawingList.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-mono text-sm">{d.drawing_no}</TableCell>
                      <TableCell className="font-medium">{d.title}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{d.category}</TableCell>
                      <TableCell className="font-mono text-sm">{d.revision}</TableCell>
                      <TableCell>{drawingStatusBadge(d.status)}</TableCell>
                      <TableCell>
                        {d.file_url ? (
                          <a
                            href={d.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-primary hover:underline"
                          >
                            Drive
                          </a>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex gap-1">
                          <DrawingDialog
                            projectId={project.id}
                            categories={categories}
                            drawing={d}
                          />
                          <DeleteDrawingButton
                            drawingId={d.id}
                            projectId={project.id}
                            drawingNo={d.drawing_no}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {drawingList.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                        Henüz çizim kaydı yok. &quot;Yeni Çizim&quot; ile başlayın.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
