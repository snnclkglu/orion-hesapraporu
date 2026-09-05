// İşler'e özel sade teklif PDF'i.
//
// Tam teklif tabloları bu rota tarafından OKUNMAZ. Security-definer RPC,
// fiyat/iskonto/ödeme alanlarını veritabanında ayıklayıp yalnız güvenli
// payload'ı döndürür. Böylece İşler'i gören ama Teklif bölümüne giremeyen bir
// kullanıcıya dolaylı ticari erişim açılmaz.

import { createClient } from "@/lib/supabase/server";
import { loadCustomerLogo, resolveCustomerIdForSnapshot } from "@/lib/customers/logo-server";
import { jobOfferDocumentFileName, jobOfferDocumentPayload } from "@/lib/offers/job-document";
import { offerIssuerCompany } from "@/lib/offers/issuer";
import { renderOfferPdf } from "@/lib/pdf/offer";
import { getReportSettings } from "@/lib/settings";

export const runtime = "nodejs";

interface JobOfferDocumentRow {
  job_no: string;
  offer_no: string;
  revision_no: number;
  issue_date: string;
  subject: string;
  customer_id: string | null;
  customer_name: string;
  currency: string;
  payload: unknown;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Oturum bulunamadı", { status: 401 });

  const { data, error } = await supabase.rpc("get_job_offer_document", {
    p_job_id: id,
  });
  if (error) return new Response("Teklif dokümanı okunamadı", { status: 500 });
  const row = (data as JobOfferDocumentRow[] | null)?.[0];
  if (!row) return new Response("Bu işe bağlı teklif dokümanı yok", { status: 404 });

  // RPC zaten ayıklanmış payload döndürür. Saf süzgeç ikinci kez çalışır;
  // migration geride kalmış bir ortamda bile PDF motoruna fiyat gidemez.
  const payload = jobOfferDocumentPayload(row.payload, row.currency);
  const customerId = await resolveCustomerIdForSnapshot(
    supabase,
    row.customer_id,
    row.customer_name
  );
  const [settings, customerLogo, issuerLogo] = await Promise.all([
    getReportSettings(supabase),
    loadCustomerLogo(supabase, customerId),
    loadCustomerLogo(supabase, payload.issuer.customerId),
  ]);
  const buffer = await renderOfferPdf({
    offer: {
      offerNo: row.offer_no,
      revNo: row.revision_no,
      issueDate: row.issue_date,
      subject: row.subject,
      customerName: row.customer_name,
      currency: row.currency,
    },
    payload,
    company: offerIssuerCompany(payload, settings),
    customerLogo,
    issuerLogo: payload.issuer.customerId ? issuerLogo : undefined,
    meta: { generatedAt: new Date().toLocaleDateString("tr-TR") },
    jobCopy: true,
  });

  const filename = jobOfferDocumentFileName(
    row.job_no,
    row.offer_no,
    row.revision_no
  );
  const asciiFilename = filename.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "'");
  const inline = new URL(req.url).searchParams.get("inline") === "1";

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${asciiFilename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
