import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canEditReports, isAdminRole } from "@/lib/roles";
import { loadDrawingPlan, resolveProjectItemNo } from "@/lib/drawing-plan-data";
import { revisionStatusLabel, revisionStatusVariant } from "@/lib/revision-status";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { DRAWING_STATUS_LABELS, type DrawingStatus } from "@/lib/drawings";
import { DeleteRevisionButton } from "./delete-revision-button";
import { ProjectDetailHeader } from "./project-header";
import { DrawingPackagesCard } from "./drawing-packages-card";
import { DrawingPlanCard } from "./drawing-plan-card";
import { ProjectTabsNav } from "./project-tabs";
import { ProjectSignatoryCard, type SignatoryOption } from "./signatory-card";
import type { JobItemOption } from "../new-project-dialog";

/**
 * Eski çizim defterinin satırı.
 *
 * Tip eskiden `drawing-dialog.tsx`teydi; defter yeni kayıt almadığı için o
 * dosya kalktı ve tip okuyan tek yere, buraya taşındı. Satırlar SİLİNMEZ —
 * yazılmış bir niyet kaydı ve Drive bağlantısı hâlâ okunabilir olmalıdır.
 */
interface DrawingRow {
  id: string;
  drawing_no: string;
  title: string;
  category: string;
  revision: string;
  status: DrawingStatus;
  file_url: string;
  notes: string;
}

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

  const [
    { data: revisions },
    { data: drawings },
    { data: jobsData },
    { data: signatoryProfiles },
    drawingPlan,
    itemNo,
  ] = await Promise.all([
      supabase
        .from("revisions")
        .select("id, rev_no, label, status, engine_version, created_at, issued_at, created_by, profiles:created_by(full_name)")
        .eq("project_id", id)
        .order("rev_no", { ascending: false }),
      // Eski çizim defteri YALNIZ OKUNUR. Kategori listesi (`app_settings`)
      // artık çekilmiyor: onu yalnız yeni kayıt penceresi kullanıyordu.
      supabase
        .from("drawings")
        .select("id, drawing_no, title, category, revision, status, file_url, notes, created_at")
        .eq("project_id", id)
        .order("drawing_no", { ascending: true }),
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
      // Teknik Resim Takibi defteri + resim numarasının kökü. İkisi de
      // `lib/drawing-plan-data.ts`ten okunur; ekipman paneli ve indirme ucu da
      // aynı iki fonksiyonu çağırır, böylece ekrandaki numara ile indirilen
      // dosyadaki numara ayrışamaz.
      loadDrawingPlan(supabase, id),
      resolveProjectItemNo(supabase, id, project.doc_no),
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
  // AYNI SORU, İKİ AYRI YER: taslak silme ve Teknik Resim Takibi'ne yazma
  // yetkisi de "hesap raporunu kim yazar"dır (Yönetici + Mühendis). Numarayı
  // mühendis verir; müdür ve teknik ressam okur ama değiştiremez — asıl engel
  // RLS'tedir (`can_edit_reports()`), buradaki yalnız ekranı sadeleştirir.
  const canWriteReports = canEditReports(profile?.role);
  const canDeleteRevision = canWriteReports;

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
      {/* Sayfanın kimliği kabuğun yapışkan üst şeridine de çıkar; künye bloğu
          (aşağıda) ayrıntıyı taşımaya devam eder. `xl` altında geri oku
          kırıntı yolunun yerini tutar — telefonda projeden çıkmanın tek yolu
          tarayıcı geri tuşuydu. */}
      <PageHeader
        backHref={job ? `/jobs/${job.id}` : "/projects"}
        backLabel={job?.job_no ?? "Mühendislik"}
        title={project.name}
        hint={`${project.customer} · ${project.crane_type}`}
      />

      <ProjectDetailHeader
        itemNo={itemNo}
        project={{
          id: project.id,
          doc_no: project.doc_no,
          name: project.name,
          customer: project.customer,
          crane_type: project.crane_type,
          archived: project.status === "archived",
        }}
        job={job}
        summary={projectSummary}
        jobs={jobs}
        canDelete={isAdmin}
        latestRev={latestRev ?? null}
        isFirstRevision={isFirstRevision}
      />

      <ProjectSignatoryCard
        projectId={project.id}
        people={signatoryPeople}
        preparedBy={(project.prepared_by as string | null) ?? null}
        checkedBy={(project.checked_by as string | null) ?? null}
      />

      <Tabs defaultValue="report">
        {/* Bölüm rayı kendi dosyasındadır (`project-tabs.tsx`) ki
            `/dev/project-preview` GERÇEK rayı bassın; gerekçe orada. */}
        <ProjectTabsNav
          revisionCount={revisionList.length}
          drawingPlanCount={drawingPlan.length}
          equipmentHref={
            latestRev
              ? `/projects/${project.id}/revisions/${latestRev.id}/equipment`
              : undefined
          }
          equipmentLabel={latestRev ? `Ekipman Listesi (V${latestRev.rev_no})` : undefined}
        />

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
                      <Badge variant={revisionStatusVariant(r.status)}>
                        {revisionStatusLabel(r.status)}
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

        {/* ----------------------------------------- Teknik Resim Takibi */}
        {/* SEKME ÜÇ KATMANLIDIR ve sıra ZAMAN SIRASIDIR:
              1. PLAN    — mühendisin proje başında verdiği ana grup numaraları
              2. GERÇEK  — ressamın teslim ettiği doğrulanmış paketler
              3. NİYET   — kapanmış eski Drive defteri (arşiv)
            Plan en üsttedir çünkü diğer ikisi ondan sonra doğar. Üç katman
            birbirine BAĞLANMAZ: plan Teknik Resimler modülünü hiç bilmez
            (kullanıcı kararı) ve paket kartı da planı okumaz. */}
        <TabsContent value="drawings">
          <div className="grid gap-3">
            <DrawingPlanCard
              projectId={project.id}
              itemNo={itemNo}
              initialRows={drawingPlan}
              canEdit={canWriteReports}
            />

            <DrawingPackagesCard projectId={project.id} docNo={project.doc_no} />

            {/* DEFTER KAPANDI ama SİLİNMEDİ. Yeni kayıt yolları (Yeni Çizim ·
                Düzenle · Sil) kalktı; yazılmış satırlar ve Drive bağlantıları
                olduğu gibi durur. Metin SUÇLAMAZ: burada kimse yanlış bir şey
                yapmadı, defterin işi bitti. */}
            {/* Cümle içi bağlantıya `.oc-tap` VERİLMEZ: sınıfın 44px'lik
                görünmez `::after` katmanı satır yüksekliğini aşıp üstteki
                paket kartının son satırının dokunuşunu çalardı. Sınıf ayrı
                duran denetimler içindir (AGENTS dokunmatik md. 1). */}
            <p className="text-sm text-muted-foreground">
              Bu defter artık yeni kayıt almıyor; aşağıdaki satırlar ve Google
              Drive bağlantıları arşiv olarak duruyor. Doğrulanmış teknik resim
              paketleri{" "}
              <Link href="/drawings" className="text-primary hover:underline">
                Teknik Resimler
              </Link>{" "}
              bölümündedir.
            </p>

            {/* Satır yoksa tablo hiç çizilmez. Eski boş durum "Yeni Çizim ile
                başlayın" diyordu — artık var olmayan bir düğmeyi tarif eden bir
                yönerge, boşluktan daha kötüdür. */}
            {drawingList.length > 0 && (
              <div className="overflow-hidden rounded-lg border bg-card">
                <Table>
                  <TableHeader>
                    {/* SÜTUN ÖNCELİKLENDİRME — "İşlem" sütunu defterle birlikte
                        kalktı. Mobilde Çizim No · Ad kalır; kategori, revizyon,
                        durum ve dosya bağlantısı çizim adının altına iner. */}
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead>Çizim No</TableHead>
                      <TableHead>Ad</TableHead>
                      <TableHead className="hidden lg:table-cell">Kategori</TableHead>
                      <TableHead className="hidden lg:table-cell">Rev</TableHead>
                      <TableHead className="hidden md:table-cell">Durum</TableHead>
                      <TableHead className="hidden md:table-cell">Dosya</TableHead>
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
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
