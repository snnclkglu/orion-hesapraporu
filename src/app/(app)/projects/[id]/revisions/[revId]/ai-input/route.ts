// Teklif hesap raporunun AI aracı girdi dosyası.
//
// PDF'den farkı: hesap sonuçlarını değil, bu revizyonun eksiksiz girdi
// ve seçim snapshot'ını + Türkçe alan rehberini JSON olarak indirir. Yerel
// agent yeni şartnameye göre bu dosyayı düzenler; "Dosya ile oluştur"
// akışı sonuçları yeniden hesaplar.

import { createClient } from "@/lib/supabase/server";
import { canSeeOffers } from "@/lib/roles";
import { OFFER_REPORT_CONTEXT, reportContextOf } from "@/lib/report-context";
import {
  buildOfferReportTransferFile,
  stringifyOfferReportTransferFile,
} from "@/lib/offer-report-transfer";
import type {
  RevisionInputsJson,
  RevisionSelectionsJson,
} from "@/lib/revision-load";
import { docCode, downloadFileName } from "@/lib/pdf/doc-naming";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; revId: string }> }
) {
  const { id, revId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Oturum bulunamadı", { status: 401 });

  const [{ data: profile }, { data: project }, { data: revision }] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(),
    supabase
      .from("projects")
      .select("id, doc_no, name, customer, crane_type, crane_location, report_context")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("revisions")
      .select("id, project_id, rev_no, inputs, selections, engine_version")
      .eq("id", revId)
      .eq("project_id", id)
      .maybeSingle(),
  ]);

  // Route Handler layout yetki kapısından geçmez; rol burada da sorulur.
  if (!canSeeOffers(profile?.role)) return new Response("Yetkiniz yok", { status: 403 });
  if (
    !project ||
    !revision ||
    reportContextOf(project.report_context) !== OFFER_REPORT_CONTEXT
  ) {
    return new Response("Teklif hesap raporu revizyonu bulunamadı", { status: 404 });
  }

  const file = buildOfferReportTransferFile({
    project: {
      documentNo: project.doc_no,
      name: project.name,
      customer: project.customer,
      craneType: project.crane_type,
      craneLocation: project.crane_location ?? "",
    },
    revision: {
      revNo: revision.rev_no,
      engineVersion: revision.engine_version,
      inputs: revision.inputs as RevisionInputsJson | null,
      selections: revision.selections as RevisionSelectionsJson | null,
    },
  });
  const body = stringifyOfferReportTransferFile(file);
  const filename = downloadFileName(
    [
      project.name,
      docCode("HR", project.doc_no, revision.rev_no),
      "AI Girdi",
    ],
    "json"
  );
  const asciiFilename = filename.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "'");

  return new Response(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${asciiFilename}"; filename*=UTF-8''${encodeURIComponent(
        filename
      )}`,
      "Cache-Control": "no-store",
    },
  });
}
