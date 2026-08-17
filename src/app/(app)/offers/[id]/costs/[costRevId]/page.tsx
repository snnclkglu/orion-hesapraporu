// MALİYET EDİTÖRÜ — kabuk (sunucu bileşeni).
//
// Teklifin revizyon sayfasının kardeşidir ve AYNI yükseklik zincirini kurar
// (TEKLIF-17): kabuk `/…/costs/…` adreslerini de sabit çerçeve sayar, sayfa
// kendi kaydırma kabını kurmazsa taşan içerik kırpılır ve kaydırılamaz.
// `flex`tir, `grid-rows` DEĞİL — `PageHeader` kabuğun şeridine portallanır ve
// burada hiç DOM düğümü bırakmaz, yani çocuk sayısı bağlama göre değişir.

import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { emptyPayload } from "@/lib/offers/payload";
import { loadOffer, loadOfferRevision } from "../../../data";
import { loadOfferCostRevision } from "../../../cost-data";
import { CostEditor } from "./cost-editor";

export const dynamic = "force-dynamic";

export default async function OfferCostPage({
  params,
}: {
  params: Promise<{ id: string; costRevId: string }>;
}) {
  const { id, costRevId } = await params;
  const supabase = await createClient();

  const kayit = await loadOffer(supabase, id);
  if (!kayit) notFound();
  const { offer, revisions } = kayit;

  const cost = await loadOfferCostRevision(supabase, id, costRevId, offer.currency);
  if (!cost) notFound();

  // TEKLİFİN GÜNCEL REVİZYONU: maliyet satırlarının teknik karşılığı, kâr
  // karşılaştırması ve kalem başlıkları oradan okunur. Teklifin hiç revizyonu
  // yoksa boş belge kullanılır — fiyatsız bir maliyet çalışması meşrudur
  // (kullanıcının kendi akışı: önce teklif iskeleti, sonra maliyet, sonra fiyat).
  const guncel = revisions[0];
  const teklif = guncel
    ? ((await loadOfferRevision(supabase, id, guncel.id))?.revision.payload ?? emptyPayload(offer.currency))
    : emptyPayload(offer.currency);

  return (
    <div className="flex flex-col gap-4 lg:min-h-0 lg:flex-1">
      <PageHeader
        kicker="Maliyet Çalışması"
        title={offer.subject || offer.offer_no}
        hint={offer.customer_name}
        backHref={`/offers/${id}`}
        backLabel="Teklif Paneli"
      />
      <CostEditor
        offerId={id}
        offerNo={offer.offer_no}
        costRevId={costRevId}
        costRevNo={cost.rev_no}
        offerRevNo={guncel?.rev_no ?? null}
        offerRevisionId={guncel?.id ?? null}
        readOnly={cost.status !== "draft"}
        initial={cost.payload}
        offer={teklif}
      />
    </div>
  );
}
