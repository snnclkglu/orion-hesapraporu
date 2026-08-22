import Link from "next/link";
import { notFound } from "next/navigation";
import { FileSpreadsheet } from "lucide-react";
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
  hiddenSectionsFromRevision,
  loadRevision,
  sectionNotesFromRevision,
  type RevisionInputsJson,
  type RevisionSelectionsJson,
} from "@/lib/revision-load";
import { hiddenSectionCheckIds } from "./module-adapters";

export default async function RevisionPage({
  params,
}: {
  params: Promise<{ id: string; revId: string }>;
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
    .select("doc_no, name, customer")
    .eq("id", id)
    .single();

  // Şablon toggle'ı sadece admin'e gösterilir (action ayrıca sunucuda doğrular).
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).single()
    : { data: null };
  const isAdmin = profile?.role === "admin";

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

  return (
    // Başlık şeridi sabit yükseklikte; editör kalan alanı doldurur ve
    // kendi içinde kayar (sayfa gövdesi kaymaz).
    <div className="flex h-full min-h-0 flex-col gap-4">
      {/* Başlık ve eylemler kabuğun üst şeridine taşındı: editör ekranında
          çalışma alanı kutsaldır ve bir başlık satırı burada en pahalı
          yerdedir. Kırıntı yolu (Mühendislik / 0055 / V1) başlığın önünde,
          yalnız geniş ekranda görünür. */}
      <PageHeader
        // Kırıntı yolu yalnız `xl` üstünde görünür; altında geri oku onun
        // yerini tutar (bkz. PageHeader.backHref). Telefonda editörden projeye
        // dönmenin başka bir yolu yoktu.
        backHref={`/projects/${id}`}
        backLabel="Projeye dön"
        kicker={
          <span className="flex items-center gap-1">
            <Link href="/projects" className="hover:underline">Mühendislik</Link>
            <span aria-hidden>/</span>
            <Link href={`/projects/${id}`} className="hover:underline">
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
          {/* Kontrol özeti + Kaydet buraya, PDF Rapor'un SOLUNA gelir; editör
              onları bu yuvaya portalla taşır (bkz. EDITOR_STATUS_SLOT_ID).
              Böylece çalışma alanı üstteki durum kartından kurtulur.

              `flex-wrap` DEĞİL `shrink-0`: eylem şeridi dar ekranda yatay
              KAYAR, sarmaz. Sarma orada satırı ikiye bölüp kaydırmayı anlamsız
              kılıyordu. */}
          <div id={EDITOR_STATUS_SLOT_ID} className="flex shrink-0 items-center gap-2" />
          <ReportMenu projectId={id} revisionId={revision.id} />
          {/* Boy `size="sm"`in kendisinden gelir: elle yazılan `h-8` dokunmatik
              payını eziyordu (AGENTS MOBIL-1). */}
          <Button asChild variant="outline" size="sm">
            <a
              href={`/projects/${id}/revisions/${revision.id}/equipment`}
              title="Ekipman listesi panelini aç (tablo görünümü + Excel/PDF indirme)"
            >
              <FileSpreadsheet className="size-3.5 text-muted-foreground" />
              Ekipman Listesi
            </a>
          </Button>
          {revision.is_template && (
            <Badge variant="outline" className="shrink-0 border-primary/40 text-primary">ŞABLON</Badge>
          )}
          <Badge variant={revisionStatusVariant(revision.status)} className="shrink-0">
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
            />
          )}
      </PageHeader>

      <RevisionEditor
        projectId={id}
        revisionId={revision.id}
        readOnly={revision.status === "issued"}
        initial={loaded.full}
        initialAlts={selections?.alts}
        initialSectionNotes={sectionNotesFromRevision(selections)}
        initialDisabled={loaded.disabled}
        initialHidden={hiddenSections}
      />
    </div>
  );
}
