// EL KİTABI EDİTÖRÜ — sunucu kabuğu.
//
// KAYNAK VERİSİ SUNUCUDA ÇÖZÜLÜR, editöre HAZIR gelir: otomatik blokların
// tablosunu istemcide üretmek, hesap motorunu ve 726 satırlık malzeme
// listesini tarayıcıya taşımak demekti. Editör yalnız GÖRÜNENİ tutar.
//
// Adres proje detayının DIŞINDA değil ALTINDADIR (`/projects/[id]/manual/...`)
// çünkü el kitabı projenin bir belgesidir; hesap raporu editörünün
// (`revisions/[revId]`) yanında durur ve aynı kırıntı yolunu paylaşır.

import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canEditReports } from "@/lib/roles";
import { PageHeader } from "@/components/page-header";
import {
  loadManual,
  loadManualImages,
  loadManualRevision,
} from "@/lib/manual/data";
import { MANUAL_LABEL } from "@/lib/manual/naming";
import { resolveProjectItemNo } from "@/lib/drawing-plan-data";
import { loadManualSnippets } from "@/lib/manual/books-data";
import { buildManualSourceData } from "../sources-data";
import { ManualEditor } from "./manual-editor";

export default async function ManualEditorPage({
  params,
}: {
  params: Promise<{ id: string; revId: string }>;
}) {
  const { id, revId } = await params;
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, doc_no, name, customer, crane_type, jobs:job_id(id, job_no)")
    .eq("id", id)
    .maybeSingle();
  if (!project) notFound();

  const manual = await loadManual(supabase, id);
  const revizyon = await loadManualRevision(supabase, revId);
  if (!manual || !revizyon || revizyon.row.manualId !== manual.id) notFound();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profil } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
    : { data: null };
  const canEdit = canEditReports((profil as { role?: string } | null)?.role);

  const [kaynaklar, gorseller, itemNo, parcalar] = await Promise.all([
    buildManualSourceData(supabase, id),
    loadManualImages(supabase, revId),
    resolveProjectItemNo(supabase, id, String(project.doc_no ?? "")),
    // METİN PARÇALARI DEFTERİ blok ekleme menüsünde görünür (KITAP-21).
    loadManualSnippets(supabase),
  ]);

  const job = (project.jobs as unknown as { id: string; job_no: string } | null) ?? null;

  return (
    <div className="grid gap-4">
      <PageHeader
        backHref={`/projects/${id}`}
        backLabel={project.name as string}
        title={`${MANUAL_LABEL} · V${revizyon.row.revNo}`}
        hint={project.customer as string}
      />

      <div className="text-sm text-muted-foreground">
        {job ? (
          <>
            <Link href="/jobs" className="hover:underline">
              İşler
            </Link>
            {" / "}
            <Link href={`/jobs/${job.id}`} className="font-mono hover:underline">
              {job.job_no}
            </Link>
          </>
        ) : (
          <Link href="/projects" className="hover:underline">
            Mühendislik
          </Link>
        )}
        {" / "}
        <Link href={`/projects/${id}`} className="font-mono hover:underline">
          {itemNo || String(project.doc_no ?? "")}
        </Link>
        {" / "}
        <span>El Kitabı V{revizyon.row.revNo}</span>
      </div>

      <ManualEditor
        projectId={id}
        revisionId={revId}
        revNo={revizyon.row.revNo}
        status={revizyon.row.status}
        label={revizyon.row.label}
        initialPayload={revizyon.payload}
        projectTitle={String(project.name ?? "")}
        sources={kaynaklar}
        images={gorseller}
        snippets={parcalar}
        itemNo={itemNo || String(project.doc_no ?? "")}
        canEdit={canEdit}
      />
    </div>
  );
}
