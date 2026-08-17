// TEKLİF PANELİ — belgenin künyesi ve revizyon zinciri.
//
// Editör bir sonraki ekrandır; burası "bu teklif nedir, hangi revizyondayız,
// müşteriye ne zaman gitti" sorularını cevaplar. Mühendislikteki proje
// detayının teklif karşılığıdır.

import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/profile";
import { isAdminRole } from "@/lib/roles";
import { PageHeader } from "@/components/page-header";
import { loadCustomers, loadOffer } from "../data";
import { OfferPanel } from "./offer-panel";

export const dynamic = "force-dynamic";

export default async function OfferDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const [kayit, customers, profile] = await Promise.all([
    loadOffer(supabase, id),
    loadCustomers(supabase),
    getSessionProfile(),
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
      />
    </div>
  );
}
