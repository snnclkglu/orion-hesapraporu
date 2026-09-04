// Teklif hesap raporunun AI aracı girdi dosyası.
//
// PDF'den farkı: hesap sonuçlarını değil, bu revizyonun eksiksiz girdi ve
// seçim snapshot'ını, proje künyesini (son kullanıcı, rapor firması, bizim
// kaydımız, imza sorumluları) ve Türkçe alan rehberini JSON olarak indirir.
// Yerel agent yeni şartnameye göre bu dosyayı düzenler; "Dosya ile oluştur"
// akışı sonuçları yeniden hesaplar (TEKLIF-72, TEKLIF-79).

import { createClient } from "@/lib/supabase/server";
import { canSeeOffers } from "@/lib/roles";
import { OFFER_REPORT_CONTEXT, reportContextOf } from "@/lib/report-context";
import {
  buildOfferReportTransferFile,
  stringifyOfferReportTransferFile,
} from "@/lib/offer-report-transfer";
import { loadCustomerCompany, loadSelfCompany } from "@/lib/customers/company-server";
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
      .select(
        "id, doc_no, name, customer, crane_type, crane_location, report_context, report_brand_customer_id, end_customer_id, prepared_by, checked_by, checked_by_name"
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("revisions")
      .select("id, project_id, rev_no, inputs, selections, engine_version, created_by, issued_by")
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

  // Kapak kimliği PDF rotasıyla aynı kaynaklardan okunur: firma defteri
  // (son kullanıcı, rapor firması, bizim kaydımız) ve imza sorumluları.
  // Hazırlayan yedeği de raporla aynıdır: proje sorumlusu yoksa yayımlayan,
  // o da yoksa revizyonu oluşturan.
  const preparedById = project.prepared_by ?? revision.issued_by ?? revision.created_by;
  const signatoryIds = [preparedById, project.checked_by].filter(
    (value): value is string => Boolean(value)
  );
  const [endCustomer, reportBrand, issuer, profilesResult] = await Promise.all([
    loadCustomerCompany(supabase, project.end_customer_id),
    loadCustomerCompany(supabase, project.report_brand_customer_id),
    loadSelfCompany(supabase),
    signatoryIds.length > 0
      ? supabase.from("profiles").select("id, full_name").in("id", signatoryIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
  ]);
  const profiles = (profilesResult.data ?? []) as { id: string; full_name: string }[];
  const nameOf = (profileId: string | null | undefined) =>
    profiles.find((entry) => entry.id === profileId)?.full_name?.trim() ?? "";

  const file = buildOfferReportTransferFile({
    project: {
      documentNo: project.doc_no,
      name: project.name,
      customer: project.customer,
      craneType: project.crane_type,
      craneLocation: project.crane_location ?? "",
      endCustomer,
      reportBrand,
      issuer,
      signatories: {
        preparedBy: nameOf(preparedById),
        checkedBy: project.checked_by_name?.trim() || nameOf(project.checked_by),
      },
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
