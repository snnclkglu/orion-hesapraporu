// TEKLİFLER — liste ekranı.
//
// Sorgu SUNUCUDA bir kez koşar, SÜZME İSTEMCİDE yapılır (Mühendislik
// listesinin deseni): teklif sayısı bir firmanın yıllık üretimi kadardır
// (yüzler mertebesi) ve her süzgeç değişiminde sunucuya gitmek, ekranı
// gereksiz yere yavaşlatırdı.

import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { loadCustomers, loadOfferList } from "./data";
import { NewOfferButton } from "./new-offer-dialog";
import { OffersTable } from "./offers-table";

export const dynamic = "force-dynamic";

export default async function OffersPage() {
  const supabase = await createClient();
  // ŞABLON DEFTERİ BURADA GEREKMEZ: şablon KALEM eklenirken sorulur (TEKLIF-32)
  // ve o liste revizyon editörüne yüklenir.
  const [offers, customers] = await Promise.all([
    loadOfferList(supabase),
    loadCustomers(supabase),
  ]);

  return (
    <div className="grid gap-4">
      <PageHeader
        kicker="Teklif"
        title="Teklifler"
        hint="Müşteriye verilen teknik ve ticari teklifler; her teklif kendi revizyon zincirini taşır."
      >
        <NewOfferButton customers={customers} />
      </PageHeader>

      {/*
        BUGÜN SUNUCUDA ÇÖZÜLÜR ve aşağı geçirilir: takip sayacı bir tarih
        farkıdır ve istemcide `new Date()` çağırmak sunucu boyamasıyla
        uyuşmazlık (gece yarısı, farklı saat dilimi) açardı.
      */}
      <OffersTable
        rows={offers}
        customers={customers}
        bugun={new Date().toISOString().slice(0, 10)}
      />
    </div>
  );
}
