// "Güncel İş Listesi" PDF ucu — müşteriye teklif ekinde giden referans belgesi.
//
// Satırlar Satış Takibi'nin KENDİ okuma katmanından (`../data.ts`) gelir; iki
// liste ayrışamaz. Ticari alanlar (birim fiyat, tutar, kur, para birimi) bu
// uçta DÜŞÜRÜLÜR ve belgenin tip tanımı onları zaten kabul etmez
// (`lib/pdf/job-list.tsx`).
//
// YETKİ `canSeeSales`TİR. Belgede fiyat olmamasına rağmen: liste firmanın
// müşteri portföyünün tamamıdır ve hangi müşteriye ne zaman verileceği ticari
// bir karardır. Bölümü göremeyen kullanıcı adresini yazarak da alamamalıdır.

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { canSeeSales } from "@/lib/roles";
import { getReportSettings, DEFAULT_REPORT_SETTINGS } from "@/lib/settings";
import { downloadFileName, jobListDocCode, jobListPeriod } from "@/lib/pdf/doc-naming";
import { renderJobListPdf, type JobListRow } from "@/lib/pdf/job-list";
import { customerTag } from "@/lib/tags";
import { saleYear } from "../schema";
import { loadSaleRows } from "../data";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Oturum bulunamadı." }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (!canSeeSales(profile?.role)) {
    return NextResponse.json(
      { error: "İş listesine yalnız Yönetici ve Müdür erişebilir." },
      { status: 403 }
    );
  }

  const yil = request.nextUrl.searchParams.get("yil")?.trim() ?? "";
  const tumu = await loadSaleRows(supabase);
  const secili = yil ? tumu.filter((r) => saleYear(r) === yil) : tumu;

  // SIRALAMA BURADA YAPILMAZ — belgenin kendi işidir (`yillaraBol`). İki yerde
  // yazılsaydı indirme ucu ile duman testi aynı listeyi farklı düzende basardı.
  const rows: JobListRow[] = secili.map((r) => ({
    itemNo: r.itemNo,
    productName: r.productName,
    // Müşteri sütununda DEFTERDEKİ KISALTMA görünür. Resmî unvan
    // ("Sİ-MA MAKİNA ELEKTRİK ELEKTRONİK İNŞ.KİMYEVİ MAD.PET.ÜRÜN.SAN.TİC.
    // LTD.ŞTİ") yatay A4'te bile üç satıra sarıyor ve çizelgenin ritmini
    // bozuyordu; kısaltma kullanıcının kendi düzenlediği alandır
    // (Yönetim → Müşteriler).
    customer: customerTag({ name: r.customer, shortName: r.customerShort }).short,
    scope: r.sale.scope,
    quantity: r.sale.quantity,
    unit: r.sale.unit,
    totalWeightKg: r.totalWeightKg,
    contractDate: r.contractDate,
    dueDate: r.sale.due_date,
    shipmentDate: r.sale.shipment_date,
    shipmentPlace: r.sale.shipment_place,
  }));

  const bugun = new Date();
  const donem = jobListPeriod(bugun);
  const kod = jobListDocCode(bugun);
  const st = { ...DEFAULT_REPORT_SETTINGS, ...(await getReportSettings(supabase)) };

  const govde = await renderJobListPdf({
    rows,
    meta: {
      periodLabel: donem,
      docCode: kod,
      generatedAt: bugun.toLocaleDateString("tr-TR"),
      filterText: yil ? `yalnız ${yil} yılı` : undefined,
    },
    company: {
      company: st.company,
      address: st.address || st.city,
      phone: st.phone,
      email: st.email,
      web: st.web,
    },
  });

  const dosyaAdi = downloadFileName(
    ["Orion Vinç", "Güncel İş Listesi", yil || donem],
    "pdf"
  );

  // Content-Disposition ÇİFT yazılır: Türkçe harf taşıyan ad `filename*` ile
  // gider, ASCII yedek eski istemciler içindir (worklog/export/route.ts kalıbı).
  const asciiAd = dosyaAdi.replace(/[^\x20-\x7E]/g, "_");
  return new NextResponse(new Uint8Array(govde), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${asciiAd}"; filename*=UTF-8''${encodeURIComponent(dosyaAdi)}`,
      "Cache-Control": "no-store",
    },
  });
}
