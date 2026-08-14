// Sipariş Onayı PDF indirmesi — tek bir siparişin dikey belgesi (md. 6/11).
//
// GET'tir: tek bir sipariş kimliği adres çubuğuna sığar ve satırdaki düğme bir
// bağlantıdır (yeni sekmede açar / indirir). Yetki `can_see_purchasing()`;
// RLS zaten keser, buradaki kontrol anlaşılır hata içindir.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { COMPANY_NAME } from "@/lib/app";
import { canSeePurchasing } from "@/lib/roles";
import { getReportSettings } from "@/lib/settings";
import { paymentTermLabel } from "@/lib/purchasing/terms";
import {
  renderOrderConfirmationPdf,
  type OrderConfirmationLine,
} from "@/lib/pdf/order-confirmation";
import { loadSiparisler } from "../../../data";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profil } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
    : { data: null };
  if (!canSeePurchasing(profil?.role)) {
    return new NextResponse("Yetkisiz", { status: 403 });
  }

  const siparisler = await loadSiparisler(supabase, { iptalDahil: true });
  const siparis = siparisler.find((s) => s.id === id);
  if (!siparis) return new NextResponse("Sipariş bulunamadı", { status: 404 });

  const ayarlar = await getReportSettings(supabase);
  const lines: OrderConfirmationLine[] = siparis.satirlar.map((l) => ({
    sample: l.sample,
    itemNo: l.itemNo,
    quality: l.quality,
    qty: l.qty,
    unitPrice: l.unitPrice,
    vatRate: l.vatRate,
  }));

  const bugun = new Date().toISOString().slice(0, 10);
  const docCode = `ORC-SO-${siparis.orderNo || id.slice(0, 8)}`;
  const pdf = await renderOrderConfirmationPdf({
    order: {
      orderNo: siparis.orderNo,
      supplier: siparis.supplier,
      orderedAt: siparis.orderedAt,
      dueAt: siparis.dueAt,
      paymentLabel: paymentTermLabel(siparis.paymentMethod, siparis.paymentTermDays),
      currency: siparis.currency,
      lines,
    },
    meta: { docCode, generatedAt: new Date().toLocaleDateString("tr-TR") },
    company: {
      company: ayarlar.company,
      address: ayarlar.address ?? "",
      phone: ayarlar.phone,
      email: ayarlar.email,
      web: ayarlar.web,
    },
  });

  const ad = `${COMPANY_NAME} - SİPARİŞ ONAYI - ${siparis.orderNo || bugun}.pdf`;
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(ad)}`,
      "Cache-Control": "no-store",
    },
  });
}
