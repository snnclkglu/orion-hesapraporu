// TEKLİF PANELİ — belgenin künyesi ve revizyon zinciri.
//
// Editör bir sonraki ekrandır; burası "bu teklif nedir, hangi revizyondayız,
// müşteriye ne zaman gitti" sorularını cevaplar. Mühendislikteki proje
// detayının teklif karşılığıdır.

import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/profile";
import { canEditJobs, isAdminRole } from "@/lib/roles";
import { PageHeader } from "@/components/page-header";
import { loadCustomers, loadOffer } from "../data";
import { loadOfferCosts } from "../cost-data";
import { OfferPanel } from "./offer-panel";
import { CostPanel } from "./cost-panel";

export const dynamic = "force-dynamic";

export default async function OfferDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const [kayit, customers, profile, costs] = await Promise.all([
    loadOffer(supabase, id),
    loadCustomers(supabase),
    getSessionProfile(),
    loadOfferCosts(supabase, id),
  ]);
  if (!kayit) notFound();

  return (
    <div className="grid gap-4">
      <PageHeader
        kicker="Teklif"
        title={kayit.offer.subject || kayit.offer.offer_no}
        hint={kayit.offer.customer_name}
        backHref="/offers"
        backLabel="Teklifler"
      />
      <OfferPanel
        offer={kayit.offer}
        revisions={kayit.revisions}
        customers={customers}
        bugun={new Date().toISOString().slice(0, 10)}
        yonetici={isAdminRole(profile?.role)}
        isEmriYazabilir={canEditJobs(profile?.role)}
      />
      {/* MALİYET AYRI BİR ZİNCİRDİR ve panelde AYRI bir tablo olarak durur.
          Teklif revizyonlarının tablosuna sütun eklenmedi: iki zincirin
          numaraları eşleşmez (R1'in maliyeti M1 DEĞİLDİR) ve aynı tabloda
          göstermek o eşleşmeyi ima ederdi. */}
      <CostPanel
        offerId={id}
        currency={kayit.offer.currency}
        costs={costs}
        offerRevNo={kayit.revisions[0]?.rev_no ?? null}
        yonetici={isAdminRole(profile?.role)}
      />
    </div>
  );
}
