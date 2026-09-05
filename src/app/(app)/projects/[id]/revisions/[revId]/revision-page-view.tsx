import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, FileSpreadsheet, Files } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { revisionStatusLabel, revisionStatusVariant } from "@/lib/revision-status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { EDITOR_STATUS_SLOT_ID, RevisionEditor } from "./revision-editor";
import { IssueRevisionButton } from "./issue-button";
import { ReportMenu } from "./report-menu";
import { TemplateToggle } from "./template-toggle";
import {
  hiddenDiagramsFromRevision,
  hiddenSectionsFromRevision,
  weightBreakdownFromRevision,
  loadRevision,
  sectionNotesFromRevision,
  type RevisionInputsJson,
  type RevisionSelectionsJson,
} from "@/lib/revision-load";
import { hiddenSectionCheckIds } from "./module-adapters";
import {
  ENGINEERING_REPORT_CONTEXT,
  reportBasePath,
  reportContextLabel,
  reportContextOf,
  type ReportContext,
} from "@/lib/report-context";

export async function RevisionPageView({
  params,
  expectedContext = ENGINEERING_REPORT_CONTEXT,
}: {
  params: Promise<{ id: string; revId: string }>;
  expectedContext?: ReportContext;
}) {
  const { id, revId } = await params;
  const supabase = await createClient();

  const { data: revision } = await supabase
    .from("revisions")
    .select("id, project_id, rev_no, label, status, inputs, selections, results, engine_version, is_template")
    .eq("id", revId)
    .eq("project_id", id)
    .single();

  if (!revision) notFound();

  const { data: project } = await supabase
    .from("projects")
    .select("doc_no, name, customer, crane_type, report_context")
    .eq("id", id)
    .single();
  if (!project || reportContextOf(project.report_context) !== expectedContext) notFound();
  const reportContext = reportContextOf(project.report_context);
  const basePath = reportBasePath(reportContext);

  // Şablon toggle'ı sadece admin'e gösterilir (action ayrıca sunucuda doğrular).
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).single()
    : { data: null };
  const isAdmin = profile?.role === "admin";

  // Teklif kaynaklı V0'da fiyat/sözleşme verisi değil, yalnız kontrollü teknik
  // aktarım görünür. Bu kayıt editörün hesap snapshot'ından ayrı tutulur.
  const { data: reportSourceData } =
    reportContext === ENGINEERING_REPORT_CONTEXT
      ? await supabase
          .from("engineering_report_sources")
          .select("mode, handoff_id, mapped_fields, review_warnings")
          .eq("project_id", id)
          .eq("revision_id", revId)
          .maybeSingle()
      : { data: null };
  const reportSource = reportSourceData as
    | {
        mode: string;
        handoff_id: string | null;
        mapped_fields: unknown;
        review_warnings: unknown;
      }
    | null;
  const { data: handoffData } = reportSource?.handoff_id
    ? await supabase
        .from("offer_engineering_handoffs")
        .select("source_offer_no, source_revision_no, eligibility")
        .eq("id", reportSource.handoff_id)
        .maybeSingle()
    : { data: null };
  const handoff = handoffData as
    | { source_offer_no: string; source_revision_no: number; eligibility: string }
    | null;
  const mappedFieldCount = Array.isArray(reportSource?.mapped_fields)
    ? reportSource.mapped_fields.length
    : 0;
  const sourceWarnings = Array.isArray(reportSource?.review_warnings)
    ? reportSource.review_warnings.filter(
        (entry): entry is string => typeof entry === "string"
      )
    : [];

  // Boş revizyon V5 şablonuyla başlar; kayıtlı revizyon kendi snapshot'ını yükler.
  const inputs = revision.inputs as RevisionInputsJson;
  const selections = revision.selections as RevisionSelectionsJson;
  // Editör TÜM bölümleri alır (kapalılar dâhil) ve kapalı listesini ayrıca
  // bilir — kapatılan bölümün girdileri korunur, yeniden açılınca geri gelir.
  const loaded = loadRevision(inputs, selections);
  // Gizlenen alt bölümler: editör soluk gösterir; yayınlama düğmesinin
  // "uygun değil" sayacı da gizli bölümlerin kontrollerini SAYMAZ — raporda
  // basılmayan bir hesabın kontrolü yayın uyarısı üretmemeli.
  const hiddenSections = hiddenSectionsFromRevision(inputs);
  const hiddenCheckIds = hiddenSectionCheckIds(hiddenSections, loaded.full.specs);
  // Şeması gizlenen bölümler: editör soluk göstermez (bölüm rapora girer),
  // yalnız çizimini "PDF'e girmiyor" rozetiyle işaretler.
  const hiddenDiagrams = hiddenDiagramsFromRevision(inputs);
  const weightBreakdown = weightBreakdownFromRevision(inputs);

  return (
    // Başlık şeridi sabit yükseklikte; editör kalan alanı doldurur ve
    // kendi içinde kayar (sayfa gövdesi kaymaz).
    <div className="flex h-full min-h-0 min-w-0 max-w-full flex-col gap-4 overflow-x-clip">
      {/* Başlık ve eylemler kabuğun üst şeridine taşındı: editör ekranında
          çalışma alanı kutsaldır ve bir başlık satırı burada en pahalı
          yerdedir. Kırıntı yolu (Mühendislik / 0055 / V1) başlığın önünde,
          yalnız geniş ekranda görünür. */}
      <PageHeader
        // Kırıntı yolu yalnız `xl` üstünde görünür; altında geri oku onun
        // yerini tutar (bkz. PageHeader.backHref). Telefonda editörden projeye
        // dönmenin başka bir yolu yoktu.
        backHref={`${basePath}/${id}`}
        backLabel="Projeye dön"
        kicker={
          <span className="flex items-center gap-1">
            <Link href={basePath} className="hover:underline">
              {reportContextLabel(reportContext)}
            </Link>
            <span aria-hidden>/</span>
            <Link href={`${basePath}/${id}`} className="hover:underline">
              {project?.doc_no}
            </Link>
            <span aria-hidden>/</span>
            <span>V{revision.rev_no}</span>
          </span>
        }
        title={
          <>
            {project?.name}{" "}
            <span className="font-normal text-muted-foreground">— {project?.customer}</span>
          </>
        }
      >
        <div className="grid w-full grid-cols-4 items-stretch gap-1.5 lg:flex lg:w-auto lg:items-center lg:gap-2">
          {/* Kontrol özeti + Kaydet buraya, PDF Rapor'un SOLUNA gelir; editör
              onları bu yuvaya portalla taşır (bkz. EDITOR_STATUS_SLOT_ID).
              Böylece çalışma alanı üstteki durum kartından kurtulur.

              Telefonda bu dört temel öğe görünür bir ızgaradır; kontrol özeti
              masaüstünde aynı yuvadaki yerini korur. */}
          <div id={EDITOR_STATUS_SLOT_ID} className="hidden shrink-0 items-center gap-2 lg:flex" />
          <ReportMenu projectId={id} revisionId={revision.id} basePath={basePath} />
          {/* Boy `size="sm"`in kendisinden gelir: elle yazılan `h-8` dokunmatik
              payını eziyordu (AGENTS MOBIL-1). */}
          <Button asChild variant="outline" size="sm" className="min-w-0 px-1.5 text-xs lg:px-3 lg:text-sm">
            <a
              href={`${basePath}/${id}/revisions/${revision.id}/equipment`}
              title="Ekipman listesi panelini aç (tablo görünümü + Excel/PDF indirme)"
            >
              <FileSpreadsheet className="size-3.5 text-muted-foreground" />
              <span className="truncate lg:hidden">Ekipman</span>
              <span className="hidden lg:inline">Ekipman Listesi</span>
            </a>
          </Button>
          {revision.is_template && (
            <Badge variant="outline" className="hidden shrink-0 border-primary/40 text-primary lg:inline-flex">ŞABLON</Badge>
          )}
          <Badge variant={revisionStatusVariant(revision.status)} className="min-w-0 shrink-0 justify-center truncate px-1.5 text-[11px] lg:px-2.5 lg:text-xs">
            {revisionStatusLabel(revision.status)}
          </Badge>
          {isAdmin && revision.status === "issued" && (
            <TemplateToggle
              projectId={id}
              revisionId={revision.id}
              isTemplate={!!revision.is_template}
            />
          )}
          {revision.status === "draft" && (
            <IssueRevisionButton
              projectId={id}
              revisionId={revision.id}
              revNo={revision.rev_no}
              defaultLabel={revision.label || `V${revision.rev_no}`}
              failingChecks={
                ((revision.results as { allChecks?: { id?: string; pass: boolean }[] } | null)
                  ?.allChecks ?? [])
                  .filter((c) => !c.pass && !(c.id && hiddenCheckIds.has(c.id))).length
              }
              className="w-full min-w-0 px-1.5 text-xs lg:w-auto lg:px-3 lg:text-sm"
            />
          )}
        </div>
      </PageHeader>

      {reportSource?.mode === "from_offer" && handoff ? (
        <section className="flex shrink-0 flex-col gap-1 rounded-md border border-primary/25 bg-primary/5 px-3 py-2 text-xs sm:flex-row sm:items-center sm:justify-between">
          <p className="flex min-w-0 items-center gap-2">
            <Files className="size-4 shrink-0 text-primary" />
            <span>
              <strong>Tekliften oluşturuldu:</strong>{" "}
              <span className="font-mono">
                {handoff.source_offer_no} · R{handoff.source_revision_no}
              </span>{" "}
              · {mappedFieldCount} teknik alan V0’a aktarıldı. Ekipman seçimleri
              otomatik değiştirilmedi.
            </span>
          </p>
          {handoff.eligibility === "review" || sourceWarnings.length > 0 ? (
            <p
              className="flex shrink-0 items-center gap-1 text-amber-700 dark:text-amber-300"
              title={sourceWarnings.join("\n")}
            >
              <AlertTriangle className="size-3.5" /> Mühendis kontrolü gerekli
            </p>
          ) : null}
        </section>
      ) : null}

      <RevisionEditor
        projectId={id}
        revisionId={revision.id}
        readOnly={revision.status === "issued"}
        initial={loaded.full}
        initialAlts={selections?.alts}
        initialSectionNotes={sectionNotesFromRevision(selections)}
        initialDisabled={loaded.disabled}
        initialHidden={hiddenSections}
        initialHiddenDiagrams={hiddenDiagrams}
        initialWeightBreakdown={weightBreakdown}
        craneType={project.crane_type ?? undefined}
      />
    </div>
  );
}
