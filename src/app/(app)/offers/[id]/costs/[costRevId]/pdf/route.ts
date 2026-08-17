// MALİYET ÇALIŞMASI PDF UCU — İÇ BELGE.
// GET /offers/[id]/costs/[costRevId]/pdf          -> attachment (indirme)
// GET /offers/[id]/costs/[costRevId]/pdf?inline=1 -> inline (önizleme)
//
// TEKLİF UCUNUN İKİZİDİR ama ÇERÇEVEYE AÇIK DEĞİLDİR. `next.config.ts`teki
// gevşetme yalnız `/offers/:id/revisions/:revId/pdf` adresine verildi
// (TEKLIF-18): teklif önizlemesi bir `<iframe>` içinde açılıyor. Maliyet iç
// belgedir ve bir çerçeveye gömülmesi için bir sebep yoktur; ne kadar az
// adres gömülebilirse o kadar iyidir. Önizleme yeni sekmede açılır.

import { createClient } from "@/lib/supabase/server";
import { loadOfferCostRevision } from "@/app/(app)/offers/cost-data";
import { loadOffer, loadOfferRevision } from "@/app/(app)/offers/data";
import { renderOfferCostPdf } from "@/lib/pdf/offer-cost";
import { offerCostFileName } from "@/lib/pdf/doc-naming";
import { emptyPayload } from "@/lib/offers/payload";
import { getReportSettings } from "@/lib/settings";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; costRevId: string }> }
) {
  const { id, costRevId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Oturum bulunamadı", { status: 401 });

  const kayit = await loadOffer(supabase, id);
  if (!kayit) return new Response("Teklif bulunamadı", { status: 404 });
  const { offer, revisions } = kayit;

  const cost = await loadOfferCostRevision(supabase, id, costRevId, offer.currency);
  if (!cost) return new Response("Maliyet revizyonu bulunamadı", { status: 404 });

  // TEKLİFİN GÜNCEL REVİZYONU okunur — kâr karşılaştırması ve satırların
  // teknik karşılığı ondan gelir. Teklifin hiç revizyonu yoksa boş belge
  // kullanılır ve maliyet yine basılır: fiyatsız bir maliyet çalışması
  // meşrudur (kullanıcının kendi akışı: önce maliyet, sonra fiyat).
  const guncel = revisions[0];
  const teklif = guncel
    ? (await loadOfferRevision(supabase, id, guncel.id))?.revision.payload ?? emptyPayload(offer.currency)
    : emptyPayload(offer.currency);

  const settings = await getReportSettings(supabase);
  const buffer = await renderOfferCostPdf({
    offer: {
      offerNo: offer.offer_no,
      subject: offer.subject,
      customerName: offer.customer_name,
      currency: offer.currency,
      offerRevNo: guncel?.rev_no ?? null,
    },
    costRevNo: cost.rev_no,
    payload: cost.payload,
    offerPayload: teklif,
    company: { company: settings.company },
    meta: { generatedAt: new Date().toLocaleDateString("tr-TR") },
  });

  const inline = new URL(req.url).searchParams.get("inline") === "1";
  const filename = offerCostFileName(offer.subject, offer.offer_no, cost.rev_no);
  const asciiFilename = filename.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "'");

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${asciiFilename}"; filename*=UTF-8''${encodeURIComponent(
        filename
      )}`,
      // Taslak maliyet her kaydetmede değişir; önbelleğe alınmış bir maliyet
      // yönetime eski kâr marjını gösterirdi.
      "Cache-Control": "no-store",
    },
  });
}
