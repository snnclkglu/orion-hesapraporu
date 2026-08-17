// TEKLİF EDİTÖRÜ — kabuk (sunucu bileşeni).
//
// Defterin TAMAMI tek okumada gelir (`loadOfferOptions`): editörde elliye yakın
// açılır liste var ve her biri için ayrı sorgu atmak açılışta elli istek
// demekti. Defter birkaç yüz satırdır; bir kerede gelmesi hem daha hızlı hem
// daha basittir.

import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { loadOfferOptions, loadOfferRevision } from "../../../data";
import { OfferEditor } from "./offer-editor";

export const dynamic = "force-dynamic";

export default async function OfferRevisionPage({
  params,
}: {
  params: Promise<{ id: string; revId: string }>;
}) {
  const { id, revId } = await params;
  const supabase = await createClient();
  const [kayit, options] = await Promise.all([
    loadOfferRevision(supabase, id, revId),
    loadOfferOptions(supabase),
  ]);
  if (!kayit) notFound();

  return (
    <div className="grid gap-4">
      <PageHeader
        kicker="Teklif"
        title={kayit.offer.subject || kayit.offer.offer_no}
        hint={kayit.offer.customer_name}
        backHref={`/offers/${id}`}
        backLabel="Teklif Paneli"
      />
      <OfferEditor
        offerId={id}
        offerNo={kayit.offer.offer_no}
        revisionId={revId}
        revNo={kayit.revision.rev_no}
        readOnly={kayit.revision.status !== "draft"}
        initial={kayit.revision.payload}
        options={options}
        currency={kayit.offer.currency}
      />
    </div>
  );
}
