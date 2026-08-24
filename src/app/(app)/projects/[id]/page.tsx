import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canEditReports, isAdminRole } from "@/lib/roles";
import {
  loadDrawingAuthors,
  loadDrawingPlan,
  resolveProjectItemNo,
} from "@/lib/drawing-plan-data";
import { revisionStatusLabel, revisionStatusVariant } from "@/lib/revision-status";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { DRAWING_STATUS_LABELS, type DrawingStatus } from "@/lib/drawings";
import {
  loadCurrentElectricalDoc,
  loadElectricalDocs,
  loadElectricalParts,
} from "@/lib/electrical/data";
import { loadElectricalCatalogReferencesForParts } from "@/lib/electrical/catalog-data";
import { loadCurrentSpec } from "@/lib/project-specs";
import { loadManual, loadManualRevisions } from "@/lib/manual/data";
import { DeleteRevisionButton } from "./delete-revision-button";
import { ElectricalCard } from "./electrical/electrical-card";
import { ManualCard, type ManualSourceStatus } from "./manual/manual-card";
import { ProjectDetailHeader } from "./project-header";
import { DrawingPackagesCard } from "./drawing-packages-card";
import { DrawingPlanCard } from "./drawing-plan-card";
import { ProjectTabsNav } from "./project-tabs";
import { EquipmentRevisionsTable } from "./equipment-revisions-table";
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
    drawingAuthors,
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
      // "Çizen" seçicisinin listesi — Teknik Ressam + Mühendis, önce ressamlar.
      // Sıra ORADA verilir; ekran onu yeniden sıralamaz (md. 4).
      loadDrawingAuthors(supabase),
      resolveProjectItemNo(supabase, id, project.doc_no),
    ]);

  // ELEKTRİK PROJESİ · ŞARTNAME · EL KİTABI — üç yeni bölümün verisi.
  //
  // AYRI BİR `Promise.all`DIR ve bu bilinçlidir: üstteki demet projenin
  // KİMLİĞİNİ kurar (revizyonlar, iş emri, imzacılar) ve alttaki sorgular
  // ondan bağımsızdır; tek bir devasa demet, hangi sorgunun hangi sekmeyi
  // beslediğini okunmaz yapardı.
  const [elektrikBelgeler, elektrikGuncel, sartname, elKitabi] = await Promise.all([
    loadElectricalDocs(supabase, id),
    loadCurrentElectricalDoc(supabase, id),
    loadCurrentSpec(supabase, id),
    loadManual(supabase, id),
  ]);
  // Malzeme satırları YALNIZ güncel sürüm için çekilir: arşiv sürümlerin
  // satırları ekranda hiç görünmüyor ve 726 satırlık bir listeyi boşuna
  // taşımak sayfayı ağırlaştırırdı.
  const elektrikParcalar = elektrikGuncel
    ? await loadElectricalParts(supabase, elektrikGuncel.id)
    : [];
  const elektrikKataloglari = await loadElectricalCatalogReferencesForParts(
    supabase,
    elektrikParcalar
  );
  const elKitabiRevizyonlari = elKitabi
    ? await loadManualRevisions(supabase, elKitabi.id)
    : [];

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
    crane_type: (project.crane_type as string | null) ?? null,
    job_id: (project.job_id as string | null) ?? null,
    job_no: job?.job_no ?? null,
    hasIssuedRevision: revisionList.some((r) => r.status === "issued"),
  };

  /** El kitabının beslendiği kaynaklar — eksiklik YAYIMDAN ÖNCE görünmeli. */
  const elKitabiKaynaklari: ManualSourceStatus[] = [
    {
      label: "Hesap Raporu",
      ready: revisionList.length > 0,
      hint: "Sınıflandırma, karakteristik özellik, hız ve ekipman tabloları buradan gelir.",
    },
    {
      label: "Elektrik Projesi",
      ready: Boolean(elektrikGuncel && elektrikParcalar.length > 0),
      hint: "Elektrik malzeme listesi ve sayfa dizini buradan gelir.",
    },
    {
      label: "Elektrik Katalogları",
      ready: elektrikKataloglari.some((r) => r.technicalDocumentId !== null),
      hint: "EK-F, malzeme listesine bağlı 1-6 sayfalık teknik föylerden otomatik derlenir.",
    },
    {
      label: "Teknik Resim",
      ready: drawingPlan.length > 0,
      hint: "Resim listesi Teknik Resim Takibi defterinden gelir.",
    },
    {
      label: "Şartname",
      ready: Boolean(sartname),
      hint: "Teknik Şartname eki müşterinin kendi belgesidir.",
    },
  ];

  return (
    <div className="grid min-w-0 max-w-full gap-3 overflow-x-hidden sm:gap-4 lg:gap-6">
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
        spec={sartname}
        canEditSpec={canWriteReports}
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
          equipmentCount={revisionList.length}
          electricalPartCount={elektrikParcalar.length}
          drawingPlanCount={drawingPlan.length}
          manualRevisionCount={elKitabiRevizyonlari.length}
        />

        {/* ------------------------------------------------ Hesap Raporu */}
        <TabsContent value="report">
          <div className="relative overflow-hidden rounded-lg border bg-card">
            <Table containerClassName="oc-mobile-table-wrap" className="oc-mobile-table oc-compact-mobile-table">
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
                    <TableCell data-label="Revizyon" className="font-mono">
                      <Link
                        href={`/projects/${project.id}/revisions/${r.id}`}
                        className="oc-tap inline-flex items-center text-primary hover:underline"
                      >
                        V{r.rev_no}
                      </Link>
                    </TableCell>
                    {/* `break-words`: etiket serbest metindir, boşluksuz uzun
                        bir jeton telefonda tabloyu taşırmasın (kural 15). */}
                    <TableCell
                      data-label="Etiket"
                      data-mobile-span="full"
                      className="break-words whitespace-normal"
                    >
                      {r.label}
                      {/* Mobilde gizlenen tarih + oluşturan bilgisi */}
                      <div className="mt-0.5 text-[11px] whitespace-normal text-muted-foreground md:hidden">
                        {new Date(r.created_at).toLocaleDateString("tr-TR")}
                        {" · "}
                        {(r.profiles as unknown as { full_name: string } | null)?.full_name ?? "—"}
                      </div>
                    </TableCell>
                    <TableCell data-label="Durum">
                      <Badge variant={revisionStatusVariant(r.status)}>
                        {revisionStatusLabel(r.status)}
                      </Badge>
                    </TableCell>
                    <TableCell data-label="Oluşturan" className="hidden text-sm md:table-cell">
                      {(r.profiles as unknown as { full_name: string } | null)?.full_name ?? "—"}
                    </TableCell>
                    <TableCell
                      data-label="Tarih"
                      className="hidden font-mono text-sm tabular-nums text-muted-foreground md:table-cell"
                    >
                      {new Date(r.created_at).toLocaleDateString("tr-TR")}
                    </TableCell>
                    <TableCell
                      data-label="Motor"
                      className="hidden font-mono text-xs text-muted-foreground lg:table-cell"
                    >
                      {r.engine_version || "—"}
                    </TableCell>
                    <TableCell
                      data-label="İşlem"
                      data-mobile-span="full"
                      data-mobile-hidden={!(canDeleteRevision && r.status === "draft") || undefined}
                      data-mobile-actions
                      className="text-right"
                    >
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
                      data-mobile-span="full"
                      data-mobile-hide-label
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

        {/* ------------------------------------------- Ekipman Listeleri */}
        {/* Her ekipman listesi bir hesap raporu revizyonundan TÜRETİLİR.
            Ayrı bir revizyon zinciri uydurulmaz; bu defter Vn ↔ Vn bağını
            görünür yapar ve her iki belgeye de doğrudan geçiş verir. Hesap
            raporu editöründeki mevcut Ekipman Listesi bağlantısı korunur. */}
        <TabsContent value="equipment">
          <EquipmentRevisionsTable
            projectId={project.id}
            revisions={revisionList.map((revision) => ({
              id: revision.id,
              revNo: revision.rev_no,
              label: revision.label,
              status: revision.status,
              createdAt: revision.created_at,
              createdBy:
                (revision.profiles as unknown as { full_name: string } | null)?.full_name ?? "",
            }))}
          />
        </TabsContent>

        {/* -------------------------------------------- Elektrik Projesi */}
        {/* Çizim bürosundan gelen PDF ARŞİVLENİR ve OKUNUR: malzeme listesi
            (Parts list), sayfa dizini ve künye ayıklanır. Aynı bilgi yoksa
            ekipman listesine, satın almaya ve el kitabının elektrik ekine üç
            kez elle yazılıyordu. */}
        <TabsContent value="electrical">
          <ElectricalCard
            projectId={project.id}
            docs={elektrikBelgeler}
            current={elektrikGuncel}
            parts={elektrikParcalar}
            catalogReferences={elektrikKataloglari}
            canEdit={canWriteReports}
          />
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
              authors={drawingAuthors}
              canEdit={canWriteReports}
            />

            <DrawingPackagesCard projectId={project.id} docNo={project.doc_no} />

            {/* DEFTER KAPANDI ama SİLİNMEDİ. Yeni kayıt yolları (Yeni Çizim ·
                Düzenle · Sil) kalktı; yazılmış satırlar ve Drive bağlantıları
                olduğu gibi durur.

                AÇIKLAMA CÜMLESİ KALDIRILDI (kullanıcı kararı, 11.08.2026):
                sekmenin üç katmanı artık kendini anlatıyor ve paragraf her
                projede aynı üç satırı tekrarlıyordu. Yerine yalnız bir BAŞLIK
                kaldı — başlıksız bir "Çizim No / Kategori / Rev" tablosu, üstte
                duran paket kartının devamı sanılırdı.

                Satır yoksa bölüm hiç çizilmez. Eski boş durum "Yeni Çizim ile
                başlayın" diyordu — artık var olmayan bir düğmeyi tarif eden bir
                yönerge, boşluktan daha kötüdür. */}
            {drawingList.length > 0 && (
              <div className="relative overflow-hidden rounded-lg border bg-card">
                <div className="border-b bg-muted/40 px-4 py-2.5">
                  <span className="oc-kicker text-muted-foreground">
                    Eski Çizim Defteri · Arşiv
                  </span>
                </div>
                <Table containerClassName="oc-mobile-table-wrap" className="oc-mobile-table oc-compact-mobile-table">
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
                        <TableCell data-label="Çizim No" className="font-mono text-sm">
                          {d.drawing_no}
                        </TableCell>
                        {/* `break-words`: çizim adı veriden gelir (kural 15). */}
                        <TableCell
                          data-label="Ad"
                          data-mobile-span="full"
                          className="font-medium break-words whitespace-normal"
                        >
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
                                className="oc-tap inline-flex items-center text-primary hover:underline"
                              >
                                Drive
                              </a>
                            )}
                          </div>
                        </TableCell>
                        <TableCell data-label="Kategori" className="hidden text-xs text-muted-foreground lg:table-cell">
                          {d.category}
                        </TableCell>
                        <TableCell data-label="Revizyon" className="hidden font-mono text-sm lg:table-cell">
                          {d.revision}
                        </TableCell>
                        <TableCell data-label="Durum" className="hidden md:table-cell">
                          {drawingStatusBadge(d.status)}
                        </TableCell>
                        <TableCell data-label="Dosya" className="hidden md:table-cell">
                          {d.file_url ? (
                            <a
                              href={d.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="oc-tap inline-flex items-center text-sm text-primary hover:underline"
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

        {/* --------------------------- İşletme ve Bakım El Kitabı */}
        {/* SEKME EN SONDADIR çünkü ötekilerin hepsinden beslenir; kaynak
            şeridi hangisinin hazır olduğunu yayımdan ÖNCE söyler. */}
        <TabsContent value="manual">
          <ManualCard
            projectId={project.id}
            manual={elKitabi}
            revisions={elKitabiRevizyonlari}
            sources={elKitabiKaynaklari}
            canEdit={canWriteReports}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
