// İş Emri (FR.11.02) PDF indirme ucu. react-pdf Node Buffer → nodejs runtime.

import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { renderWorkOrderPdf, type WorkOrderData } from "@/lib/pdf/work-order";
import { downloadFileName } from "@/lib/pdf/doc-naming";
import { getReportSettings } from "@/lib/settings";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Oturum gerekli", { status: 401 });

  const { data: job } = await supabase.from("jobs").select("*").eq("id", id).single();
  if (!job) return new Response("İş bulunamadı", { status: 404 });

  const { data: items } = await supabase
    .from("job_items")
    .select("item_no, product_name, quantity")
    .eq("job_id", id)
    .order("sort", { ascending: true });

  const settings = await getReportSettings(supabase);

  const data: WorkOrderData = {
    job_no: job.job_no ?? "",
    title: job.title ?? "",
    form_code: job.form_code ?? "FR.11.02",
    revision: job.revision ?? "A",
    work_order_date: job.work_order_date ?? null,
    customer: job.customer ?? "",
    customer_address: job.customer_address ?? "",
    customer_tax_office: job.customer_tax_office ?? "",
    customer_tax_no: job.customer_tax_no ?? "",
    customer_phone: job.customer_phone ?? "",
    customer_fax: job.customer_fax ?? "",
    contract_exists: !!job.contract_exists,
    contract_date: job.contract_date ?? null,
    workshop_exit_date: job.workshop_exit_date ?? null,
    delivery_date: job.delivery_date ?? null,
    shipping_address: job.shipping_address ?? "",
    assembly_address: job.assembly_address ?? "",
    quantity_text: job.quantity_text ?? "",
    job_leader: job.job_leader ?? "",
    scope: (job.scope ?? {}) as Record<string, boolean>,
    prepared_by_name: job.prepared_by_name ?? "",
    prepared_by_title: job.prepared_by_title ?? "",
    notes: job.notes ?? "",
    items: (items ?? []).map((it) => ({
      item_no: it.item_no ?? "",
      product_name: it.product_name ?? "",
      quantity: it.quantity ?? "",
    })),
  };

  const buffer = await renderWorkOrderPdf(data, settings);
  // Dosya adı: "İŞ ADI - İŞ NO - İŞ EMRİ - REV A" (bkz. pdf/doc-naming).
  // REVİZYON ADA GİRER: aynı iş emri revize edildiğinde indirilenler klasöründe
  // iki dosya yan yana durur ve hangisinin güncel olduğu ancak açılınca
  // anlaşılırdı (tarayıcı ikincisini "(1)" ile adlandırırdı).
  const filename = downloadFileName([
    job.title, job.job_no, job.form_code, "İş Emri", `Rev ${data.revision}`,
  ]);
  const asciiFilename = filename.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "'");
  const encodedFilename = encodeURIComponent(filename);

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${asciiFilename}"; filename*=UTF-8''${encodedFilename}`,
      "Cache-Control": "no-store",
    },
  });
}
