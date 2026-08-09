import Link from "next/link";
import { notFound } from "next/navigation";
import { FileDown, GitCompare, ScrollText } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { canEditReports, isAdminRole } from "@/lib/roles";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getDrawingCategories, DRAWING_STATUS_LABELS, type DrawingStatus,
} from "@/lib/drawings";
import { NewRevisionButton } from "./new-revision-button";
import { DeleteRevisionButton } from "./delete-revision-button";
import { ArchiveButton } from "./archive-button";
import { ProjectDetailActions } from "../project-actions";
import { DrawingDialog, DeleteDrawingButton, type DrawingRow } from "./drawing-dialog";
import { ProjectSignatoryCard, type SignatoryOption } from "./signatory-card";
import type { JobItemOption } from "../new-project-dialog";

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
    .select("id, doc_no, name, customer, crane_type, status, created_at, job_id, prepared_by, checked_by, jobs:job_id(id, job_no, title)")
    .eq("id", id)
    .single();

  if (!project) notFound();

  const job = (project.jobs as unknown as {
    id: string;
    job_no: string;
    title: string;
  } | null) ?? null;

  const [{ data: revisions }, { data: drawings }, categories, { data: jobsData }, { data: signatoryProfiles }] =
    await Promise.all([
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
      // Kopyalama / işe bağlama dialogları için aktif iş emirleri + kalemleri
      supabase
        .from("jobs")
        .select("id, job_no, title, customer, job_items(id, item_no, product_name, quantity, project_id)")
        .eq("status", "active")
        .order("created_at", { ascending: false }),
      supabase
        .from("profiles")
        .select("id, full_name, role")
        .in("role", ["admin", "engineer"])
        .order("full_name", { ascending: true }),
    ]);

  // İKİ AYRI SORU: PROJEYİ silmek yöneticiye özeldir (projects DELETE
  // politikası `is_admin()` ister), TASLAK REVİZYONU ise raporu yazan da
  // silebilir (`can_edit_reports()`). Tek bir `isAdmin` ile ikisini birden
  // sormak, mühendisin kendi açtığı taslağı temizlemesini engellerdi.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
    : { data: null };
  const isAdmin = isAdminRole(profile?.role);
  const canDeleteRevision = canEditReports(profile?.role);

  const jobs = (jobsData ?? []).map((j) => ({
    id: j.id,
    job_no: j.job_no,
    title: j.title,
    customer: j.customer,
    items: (j.job_items ?? []) as unknown as JobItemOption[],
  }));

  const drawingList = (drawings ?? []) as DrawingRow[];
  const signatoryPeople = (signatoryProfiles ?? []) as SignatoryOption[];
  const revisionList = revisions ?? [];
  const latestRev = revisionList[0];
  // İlk hesap raporu henüz oluşturulmadıysa buton "Hesap Raporu Oluştur" der.
  const isFirstRevision = revisionList.length === 0;
  const projectSummary = {
    id: project.id,
    doc_no: project.doc_no,
    name: project.name,
    customer: project.customer,
    job_id: (project.job_id as string | null) ?? null,
    job_no: job?.job_no ?? null,
    hasIssuedRevision: revisionList.some((r) => r.status === "issued"),
  };

  return (
    <div className="grid gap-6">
      {/* Başlık + eylem şeridi: sağdaki blok ("Düzenlemeye Devam (V3)" +
          "Yeni Revizyon") tek başına ~350px tuttuğu için sarmasız bir
          `justify-between` 375/430px telefonda satırı yatay taşırıyordu. */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
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
          {/* Bu iki bağlantı elle yazılmış düğmelerdir; yandaki `size="sm"`
              Button'lar dokunmatik payını tabandan alıyor, bunlar almıyordu. */}
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
            <Link
              href={`/projects/${project.id}/compare`}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border bg-card px-3 text-sm hover:bg-muted pointer-coarse:h-10"
            >
              <GitCompare className="size-3.5 text-muted-foreground" />
              Revizyonları Karşılaştır
            </Link>
            <Link
              href={`/projects/${project.id}/audit`}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border bg-card px-3 text-sm hover:bg-muted pointer-coarse:h-10"
            >
              <ScrollText className="size-3.5 text-muted-foreground" />
              İşlem Kaydı
            </Link>
            <ArchiveButton projectId={project.id} archived={project.status === "archived"} />
            <ProjectDetailActions
              project={projectSummary}
              jobs={jobs}
              canDelete={isAdmin}
            />
          </div>
        </div>
        <div className="flex w-full flex-col gap-1 sm:w-auto sm:items-end">
          <div className="flex flex-wrap gap-2">
            {latestRev?.status === "draft" && (
              <Link
                href={`/projects/${project.id}/revisions/${latestRev.id}`}
                className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 pointer-coarse:h-10"
              >
                Düzenlemeye Devam (V{latestRev.rev_no})
              </Link>
            )}
            <NewRevisionButton
              projectId={project.id}
              isFirst={isFirstRevision}
              variant={latestRev?.status === "draft" ? "outline" : "default"}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {isFirstRevision
              ? "İlk hesap raporu şablondan kopyalanarak açılır — boş sayfayla başlamazsınız."
              : "Yeni revizyon, son revizyonun kopyasıyla açılır — sıfırdan başlamaz."}
          </p>
        </div>
      </div>

      <ProjectSignatoryCard
        projectId={project.id}
        people={signatoryPeople}
        preparedBy={(project.prepared_by as string | null) ?? null}
        checkedBy={(project.checked_by as string | null) ?? null}
      />

      <Tabs defaultValue="report">
        {/* Link, role=tablist içinde kalmasın diye TabsList'in kardeşi olarak durur */}
        <div className="flex flex-wrap items-center gap-1">
          <TabsList>
            <TabsTrigger value="report">Hesap Raporu</TabsTrigger>
            <TabsTrigger value="drawings">
              Teknik Çizimler
              {drawingList.length > 0 && (
                <span className="font-mono text-xs tabular-nums text-muted-foreground">
                  ({drawingList.length})
                </span>
              )}
            </TabsTrigger>
          </TabsList>
          {/* Ekipman listesi revizyon snapshot'ından üretilir; sekme yerine
              son revizyonun indirme linki verilir. Yalnız `py-1` ile hedef
              ~26px kalıyordu, sekmelerin yanında parmakla tutulmuyordu. */}
          {latestRev && (
            <a
              href={`/projects/${project.id}/revisions/${latestRev.id}/equipment`}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium whitespace-nowrap text-foreground/60 hover:text-foreground pointer-coarse:min-h-10"
            >
              <FileDown className="size-3.5" />
              Ekipman Listesi (V{latestRev.rev_no})
            </a>
          )}
        </div>

        {/* ------------------------------------------------ Hesap Raporu */}
        <TabsContent value="report">
          <div className="overflow-hidden rounded-lg border bg-card">
            <Table>
              <TableHeader>
                {/* SÜTUN ÖNCELİKLENDİRME — yedi sütunda en sağdaki "İşlem"
                    (taslak silme) telefonda ekranın dışında kalıyordu.
                    Oluşturan · Tarih · Motor mobilde gizlenir, ilk ikisi
                    etiketin altına iner. */}
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead>Revizyon</TableHead>
                  <TableHead>Etiket</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead className="hidden md:table-cell">Oluşturan</TableHead>
                  <TableHead className="hidden md:table-cell">Tarih</TableHead>
                  <TableHead className="hidden lg:table-cell">Motor</TableHead>
                  <TableHead className="w-12 text-right">İşlem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {revisionList.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono">
                      <Link
                        href={`/projects/${project.id}/revisions/${r.id}`}
                        className="inline-flex min-h-9 items-center text-primary hover:underline pointer-coarse:min-h-10"
                      >
                        V{r.rev_no}
                      </Link>
                    </TableCell>
                    <TableCell className="whitespace-normal">
                      {r.label}
                      {/* Mobilde gizlenen tarih + oluşturan bilgisi */}
                      <div className="mt-0.5 text-[11px] whitespace-normal text-muted-foreground md:hidden">
                        {new Date(r.created_at).toLocaleDateString("tr-TR")}
                        {" · "}
                        {(r.profiles as unknown as { full_name: string } | null)?.full_name ?? "—"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={r.status === "issued" ? "default" : "secondary"}>
                        {r.status === "issued" ? "yayınlandı" : "taslak"}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden text-sm md:table-cell">
                      {(r.profiles as unknown as { full_name: string } | null)?.full_name ?? "—"}
                    </TableCell>
                    <TableCell className="hidden font-mono text-sm tabular-nums text-muted-foreground md:table-cell">
                      {new Date(r.created_at).toLocaleDateString("tr-TR")}
                    </TableCell>
                    <TableCell className="hidden font-mono text-xs text-muted-foreground lg:table-cell">
                      {r.engine_version || "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {/* Silme YALNIZ taslakta: yayınlanmış revizyon teslim
                          edilmiş bir hesabın kaydıdır (DB tetikleyicisi de
                          engeller). Yetki raporu yazan rollerdedir. */}
                      {canDeleteRevision && r.status === "draft" && (
                        <DeleteRevisionButton
                          projectId={project.id}
                          revisionId={r.id}
                          revNo={r.rev_no}
                          fallbackRevNo={
                            revisionList
                              .filter((other) => other.id !== r.id)
                              .reduce<number | null>(
                                (max, other) =>
                                  max === null || other.rev_no > max ? other.rev_no : max,
                                null
                              )
                          }
                        />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {isFirstRevision && (
                  <TableRow className="hover:bg-transparent">
                    <TableCell
                      colSpan={7}
                      className="h-32 text-center"
                      style={{
                        backgroundImage:
                          "repeating-linear-gradient(135deg, var(--muted) 0 10px, transparent 10px 20px)",
                      }}
                    >
                      <div className="flex flex-col items-center gap-2">
                        <span className="border bg-background px-3 py-1.5 font-mono text-xs font-medium tracking-[0.15em] text-foreground">
                          [ HENÜZ HESAP RAPORU YOK ]
                        </span>
                        <span className="bg-card px-3 py-1 text-sm text-foreground/70">
                          Henüz hesap raporu yok. &quot;Hesap Raporu Oluştur&quot; ile başlayın.
                        </span>
                      </div>
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
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
              <p className="min-w-0 flex-1 text-sm text-muted-foreground">
                Çizim kayıtları; dosyalar Google Drive linkiyle takip edilir.
              </p>
              <DrawingDialog projectId={project.id} categories={categories} />
            </div>
            <div className="overflow-hidden rounded-lg border bg-card">
              <Table>
                <TableHeader>
                  {/* SÜTUN ÖNCELİKLENDİRME — "İşlem" (Düzenle · Sil) yedi
                      sütunun ardında telefonda erişilemiyordu. Mobilde
                      Çizim No · Ad · İşlem kalır; kategori, revizyon, durum ve
                      dosya bağlantısı çizim adının altına iner. */}
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead>Çizim No</TableHead>
                    <TableHead>Ad</TableHead>
                    <TableHead className="hidden lg:table-cell">Kategori</TableHead>
                    <TableHead className="hidden lg:table-cell">Rev</TableHead>
                    <TableHead className="hidden md:table-cell">Durum</TableHead>
                    <TableHead className="hidden md:table-cell">Dosya</TableHead>
                    <TableHead className="text-right">İşlem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {drawingList.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-mono text-sm">{d.drawing_no}</TableCell>
                      <TableCell className="font-medium whitespace-normal">
                        {d.title}
                        {/* Mobilde gizlenen sütunlar — kategori · rev · durum ·
                            dosya bağlantısı burada toplanır. */}
                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-normal text-muted-foreground md:hidden">
                          <span>
                            {d.category} · Rev {d.revision}
                          </span>
                          {drawingStatusBadge(d.status)}
                          {d.file_url && (
                            <a
                              href={d.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex min-h-9 items-center text-primary hover:underline pointer-coarse:min-h-10"
                            >
                              Drive
                            </a>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="hidden text-xs text-muted-foreground lg:table-cell">
                        {d.category}
                      </TableCell>
                      <TableCell className="hidden font-mono text-sm lg:table-cell">
                        {d.revision}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {drawingStatusBadge(d.status)}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {d.file_url ? (
                          <a
                            href={d.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex min-h-9 items-center text-sm text-primary hover:underline pointer-coarse:min-h-10"
                          >
                            Drive
                          </a>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {/* 4px arayla iki düğme parmakla ayırt edilmiyordu.
                            Yan yana ~150px yiyip çizim adına yer bırakmadığı
                            için mobilde alt alta durur. */}
                        <div className="inline-flex flex-col gap-2 md:flex-row">
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
                    <TableRow className="hover:bg-transparent">
                      <TableCell
                        colSpan={7}
                        className="h-32 text-center"
                        style={{
                          backgroundImage:
                            "repeating-linear-gradient(135deg, var(--muted) 0 10px, transparent 10px 20px)",
                        }}
                      >
                        <div className="flex flex-col items-center gap-2">
                          <span className="border bg-background px-3 py-1.5 font-mono text-xs font-medium tracking-[0.15em] text-foreground">
                            [ HENÜZ ÇİZİM YOK ]
                          </span>
                          <span className="bg-card px-3 py-1 text-sm text-foreground/70">
                            Henüz çizim kaydı yok. &quot;Yeni Çizim&quot; ile başlayın.
                          </span>
                        </div>
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
