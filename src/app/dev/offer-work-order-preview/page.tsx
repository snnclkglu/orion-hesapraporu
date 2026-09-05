// Sadece development: değişken yapılı bir teklifin iş emri taslağına
// dönüştürüldüğü formu, kimlik doğrulama ve veritabanı olmadan sınar.

import { notFound } from "next/navigation";
import { JobForm, type PersonOption } from "@/app/(app)/jobs/job-form";
import { EMPTY_JOB, type CustomerOption, type JobInput } from "@/app/(app)/jobs/schema";
import { PageHeader } from "@/components/page-header";

const CUSTOMERS: CustomerOption[] = [
  {
    id: "customer-preview",
    name: "ASTOR ENERJİ A.Ş.",
    short_name: "ASTOR",
    color_hue: 148,
    address: "ASO 2. ve 3. OSB, Sincan / Ankara",
    tax_office: "Sincan",
    tax_no: "1234567890",
    phone: "+90 312 267 01 56",
    fax: "",
    notes: "",
  },
];

const PEOPLE: PersonOption[] = [
  { id: "person-preview", full_name: "Sinan Çolakoğlu", title: "Vinç Mühendisi" },
];

const INITIAL: JobInput = {
  ...EMPTY_JOB,
  job_no: "0064",
  title: "ASTOR 10 T VE 3 T KÖPRÜLÜ VİNÇLER",
  customer: CUSTOMERS[0].name,
  customer_id: CUSTOMERS[0].id,
  customer_address: CUSTOMERS[0].address,
  customer_tax_office: CUSTOMERS[0].tax_office,
  customer_tax_no: CUSTOMERS[0].tax_no,
  customer_phone: CUSTOMERS[0].phone,
  scope: {
    ...EMPTY_JOB.scope,
    proje: true,
    malzeme: true,
    imalat: true,
  },
  items: [
    {
      item_no: "0064-01",
      product_name: "10 T X 21,70 M ÇİFT KİRİŞLİ KÖPRÜLÜ VİNÇ",
      quantity: "1",
      included: true,
      source_ref: "technicalItems[0]",
      source_label: "Teknik teklif kalemi · hesap raporuna uygun",
      source_warnings: [],
    },
    {
      item_no: "0064-02",
      product_name: "3 T X 6 M MONORAY VİNÇ",
      quantity: "2",
      included: true,
      source_ref: "technicalItems[1]",
      source_label: "Teknik teklif kalemi · mühendis kontrolü gerekli",
      source_warnings: ["Kaldırma yüksekliği teklif metninde kesin olarak ayrıştırılamadı."],
    },
    {
      item_no: "",
      product_name: "YEDEK PARÇA VE DEVREYE ALMA BEDELİ",
      quantity: "1",
      included: false,
      source_ref: "priceRows[3]",
      source_label: "Bağımsız fiyat satırı · varsayılan olarak iş emri dışında",
      source_warnings: ["Bu satır teknik ekipman olmayabilir; eklemeden önce kontrol edin."],
    },
  ],
};

export default function OfferWorkOrderPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-4 px-4 py-6 lg:px-8">
      <PageHeader
        kicker="Teklif → İş Emri"
        title="İş Emri Taslağını Kontrol Et"
        hint="TKL-2026-0042 · ASTOR ENERJİ A.Ş. · geliştirme önizlemesi"
      />
      <JobForm
        mode="create"
        initial={INITIAL}
        customers={CUSTOMERS}
        people={PEOPLE}
        offerSource={{
          offerId: "offer-preview",
          revisionId: "revision-preview",
          offerNo: "TKL-2026-0042",
          revisionLabel: "R2",
          deliveryHint: "Siparişten sonra 16-18 hafta",
          shippingHint: "Ankara OSB fabrika sahası",
          warnings: [
            "Değişken teklif yapısı nedeniyle üç aday kalem bulundu; seçili kalemleri kontrol edin.",
          ],
        }}
      />
    </div>
  );
}
