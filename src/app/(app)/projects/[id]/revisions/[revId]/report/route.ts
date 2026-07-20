// PDF hesap raporu indirme ucu.
// GET /projects/[id]/revisions/[revId]/report?level=detayli|standart|ozet
//   -> application/pdf (attachment)
// Auth'lu Supabase istemcisiyle revizyon + proje + hazırlayan profili çekilir,
// hesap sunucuda yeniden koşturulur ve rapor @react-pdf ile üretilir.

import { createClient } from "@/lib/supabase/server";
import { runCalc } from "@/lib/calc/engine";
import {
  calcInputFromRevision,
  type RevisionInputsJson,
  type RevisionSelectionsJson,
} from "@/lib/revision-load";
import { isReportLevel, renderReportPdf, type ReportLevel } from "@/lib/pdf/report";
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
    .select("doc_no, name, customer, crane_type")
    .eq("id", id)
    .single();
  if (!project) return new Response("Proje bulunamadı", { status: 404 });

  // Hazırlayan: yayınlayan; taslakta revizyonu oluşturan
  const preparedById = revision.issued_by ?? revision.created_by;
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", preparedById)
    .single();

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
    preparedBy: profile?.full_name || "—",
    input,
    result,
    level,
  });

  // Türkçe karakterli dosya adı: ASCII geri düşüş + RFC 5987 filename*
  const levelSuffix = level === "detayli" ? "" : level === "standart" ? "-Standart" : "-Ozet";
  const filename = `${project.doc_no}-V${revision.rev_no}${levelSuffix}.pdf`;
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
