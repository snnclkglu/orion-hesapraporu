// Sadece development: mevcut işe teklif belgesi bağlama kartını ve otomatik
// resim çarpanı başlangıcını veritabanına dokunmadan görsel olarak sınar.

import { notFound } from "next/navigation";
import { ExistingOfferLinker } from "@/app/(app)/jobs/[id]/edit/existing-offer-linker";
import { DrawingQtyCard } from "@/app/(app)/jobs/[id]/drawing-qty-card";
import { PageHeader } from "@/components/page-header";

const JOB_ID = "11111111-1111-4111-8111-111111111111";

export default function JobEditOfferPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-6 lg:px-8">
      <PageHeader
        kicker="İş Emrini Düzenle"
        title="0063 · Teklif ve Resim Başlangıçları"
        hint="Geliştirme önizlemesi · sahte veri"
      />

      <ExistingOfferLinker
        jobId={JOB_ID}
        linked={null}
        options={[
          {
            id: "22222222-2222-4222-8222-222222222222",
            offerNo: "TETR-20260512-2",
            customerName: "ASTOR A.Ş.",
            subject: "10 T ve 3 T köprülü vinçler",
            revisionNo: 2,
          },
          {
            id: "33333333-3333-4333-8333-333333333333",
            offerNo: "TETR-20241108-1",
            customerName: "KARÇEL A.Ş.",
            subject: "Pota vinci modernizasyonu",
            revisionNo: 0,
          },
        ]}
      />

      <DrawingQtyCard
        jobId={JOB_ID}
        hazir
        kalemler={[
          {
            id: "44444444-4444-4444-8444-444444444444",
            itemNo: "0063-01",
            productName: "10 T X 21,75 M ÇİFT KİRİŞLİ GEZER KÖPRÜLÜ VİNÇ",
            quantityText: "3 Adet",
            qty: 3,
            sharesWith: null,
          },
          {
            id: "55555555-5555-4555-8555-555555555555",
            itemNo: "0063-02",
            productName: "SERVİS PLATFORMU VE BAKIM EKİPMANLARI",
            quantityText: "Muhtelif",
            qty: 1,
            sharesWith: null,
          },
        ]}
      />
    </div>
  );
}
