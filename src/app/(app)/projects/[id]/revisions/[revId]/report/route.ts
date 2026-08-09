// PDF hesap raporu indirme ucu.
// GET /projects/[id]/revisions/[revId]/report?level=detayli|standart|ozet
//   -> application/pdf (attachment)
// Auth'lu Supabase istemcisiyle revizyon + proje + hazırlayan profili çekilir,
// hesap sunucuda yeniden koşturulur ve rapor @react-pdf ile üretilir.

import { createClient } from "@/lib/supabase/server";
import { runCalc } from "@/lib/calc/engine";
import {
  altsFromRevision,
  calcInputFromRevision,
  sectionNotesFromRevision,
  type RevisionInputsJson,
  type RevisionSelectionsJson,
} from "@/lib/revision-load";
import { isReportLevel, renderReportPdf, type ReportLevel } from "@/lib/pdf/report";
import { REPORT_LEVEL_LABELS, docCode, downloadFileName } from "@/lib/pdf/doc-naming";
import { getReportSettings } from "@/lib/settings";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; revId: string }> }
) {
  const { id, revId } = await params;
  const levelParam = new URL(req.url).searchParams.get("level");
  const level: ReportLevel = isReportLevel(levelParam) ? levelParam : "detayli";
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Oturum bulunamadı", { status: 401 });

  const { data: revision } = await supabase
    .from("revisions")
    .select(
      "id, rev_no, label, status, inputs, selections, created_by, issued_by, issued_at, updated_at"
    )
    .eq("id", revId)
    .eq("project_id", id)
    .single();
  if (!revision) return new Response("Revizyon bulunamadı", { status: 404 });

  const { data: project } = await supabase
    .from("projects")
    .select("doc_no, name, customer, crane_type, prepared_by, checked_by")
    .eq("id", id)
    .single();
  if (!project) return new Response("Proje bulunamadı", { status: 404 });

  // Eski projeler için hazırlayan fallback'i korunur; yeni projelerde iki isim
  // proje düzeyindeki resmi sorumlulardan gelir.
  const preparedById = project.prepared_by ?? revision.issued_by ?? revision.created_by;
  const signatoryIds = [preparedById, project.checked_by].filter(
    (value): value is string => Boolean(value)
  );
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", signatoryIds);
  const nameOf = (id: string | null | undefined) =>
    (profiles ?? []).find((profile) => profile.id === id)?.full_name || "—";

  const input = calcInputFromRevision(
    revision.inputs as RevisionInputsJson,
    revision.selections as RevisionSelectionsJson
  );
  const result = runCalc(input);

  const reportSettings = await getReportSettings(supabase);
      const buffer = await renderReportPdf({
        settings: reportSettings,
    project,
    revision: {
      rev_no: revision.rev_no,
      label: revision.label,
      issued_at: revision.issued_at,
      updated_at: revision.updated_at,
    },
    preparedBy: nameOf(preparedById),
    checkedBy: nameOf(project.checked_by),
    input,
    result,
    level,
    // Seçenekli (alternatif) ekipman seçimleri raporda "SEÇENEKLER" bloğu olur.
    alts: altsFromRevision(revision.selections as RevisionSelectionsJson),
    sectionNotes: sectionNotesFromRevision(revision.selections as RevisionSelectionsJson),
  });

  // Dosya adı: İŞ ADI - DOKÜMAN KODU - VERSİYON - SEVİYE (bkz. pdf/doc-naming).
  // Türkçe karakterli ad: ASCII geri düşüş + RFC 5987 filename*.
  const filename = downloadFileName([
    project.name,
    docCode("HR", project.doc_no, revision.rev_no),
    `V${revision.rev_no}`,
    REPORT_LEVEL_LABELS[level],
  ]);
  const asciiFilename = filename.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "'");

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${asciiFilename}"; filename*=UTF-8''${encodeURIComponent(
        filename
      )}`,
      "Cache-Control": "no-store",
    },
  });
}
