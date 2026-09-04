// Sadece development: Satış Analizi'nin iki çalışma yüzünü auth olmadan
// gerçek büyüklükte fikstürlerle görsel olarak denetlemek için.

import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { AnalizView } from "@/app/(app)/offers/analiz/analiz-view";
import type { AnalizSatiriDetay } from "@/app/(app)/offers/analiz/lead-dialog";
import type { CustomerOption } from "@/app/(app)/jobs/schema";
import type { KazanilanIsSatiri } from "@/lib/offers/analiz";

const BUGUN = "2026-09-04";

function musteri(id: string, name: string, shortName: string, hue: number): CustomerOption {
  return {
    id,
    name,
    short_name: shortName,
    color_hue: hue,
    address: "",
    tax_office: "",
    tax_no: "",
    phone: "",
    fax: "",
    notes: "",
  };
}

const MUSTERILER = [
  musteri("11111111-1111-4111-8111-111111111111", "ASTOR ENERJİ A.Ş.", "ASTOR", 0),
  musteri("22222222-2222-4222-8222-222222222222", "ETİ BAKIR A.Ş.", "ETİ BAKIR", 150),
  musteri(
    "33333333-3333-4333-8333-333333333333",
    "HABAŞ SINAİ VE TIBBİ GAZLAR İSTİHSAL ENDÜSTRİSİ A.Ş.",
    "HABAŞ",
    40
  ),
  musteri("44444444-4444-4444-8444-444444444444", "LITEC MAKİNA SAN. VE TİC. A.Ş.", "LITEC", 255),
] satisfies CustomerOption[];

const PROJEKSIYON: AnalizSatiriDetay[] = [
  {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
    kaynak: "teklif",
    offerNo: "TETR-20260901-1",
    customerName: MUSTERILER[0].name,
    customerShort: MUSTERILER[0].short_name,
    customerHue: MUSTERILER[0].color_hue,
    subject: "YENİ FABRİKA 32/5T PORTAL VİNÇ VE YÜRÜME YOLLARI",
    status: "sent",
    verilisTarihi: "2026-09-01",
    expectedOn: "2026-10-15",
    amount: 615_000,
    currency: "EUR",
    score: 8,
    active: true,
    customerId: MUSTERILER[0].id,
    notes: "",
  },
  {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2",
    kaynak: "teklif",
    offerNo: "TETR-20260824-2",
    customerName: MUSTERILER[2].name,
    customerShort: MUSTERILER[2].short_name,
    customerHue: MUSTERILER[2].color_hue,
    subject: "40T ŞARJ VİNCİ MODERNİZASYONU VE ELEKTRİK PANOLARI",
    status: "sent",
    verilisTarihi: "2026-08-24",
    expectedOn: "2026-12-20",
    amount: 1_240_000,
    currency: "EUR",
    score: 6,
    active: true,
    customerId: MUSTERILER[2].id,
    notes: "",
  },
  {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3",
    kaynak: "beklenen",
    offerNo: null,
    customerName: MUSTERILER[1].name,
    customerShort: MUSTERILER[1].short_name,
    customerHue: MUSTERILER[1].color_hue,
    subject: "MUHTELİF VİNÇLER — 8 ADET",
    status: "beklenen",
    verilisTarihi: null,
    expectedOn: "2027-02-10",
    amount: 880_000,
    currency: "EUR",
    score: 5,
    active: true,
    customerId: MUSTERILER[1].id,
    notes: "Yatırım takvimi bekleniyor.",
  },
];

const KAZANILANLAR: KazanilanIsSatiri[] = [
  {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1",
    offerNo: "TETR-20260802-1",
    customerName: MUSTERILER[0].name,
    customerShort: MUSTERILER[0].short_name,
    customerHue: MUSTERILER[0].color_hue,
    subject: "32T x 30M ÇİFT KİRİŞ TAM PORTAL VİNÇ",
    issuedOn: "2026-08-02",
    wonOn: "2026-08-28",
    amount: 642_017,
    currency: "EUR",
    jobId: "cccccccc-cccc-4ccc-8ccc-ccccccccccc1",
    jobNo: "0081-00",
    jobTitle: "ASTOR — 32T PORTAL VİNÇ",
  },
  {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2",
    offerNo: "TETR-20260612-1",
    customerName: MUSTERILER[1].name,
    customerShort: MUSTERILER[1].short_name,
    customerHue: MUSTERILER[1].color_hue,
    subject: "5T MONORAY VİNÇLER — 6 ADET",
    issuedOn: "2026-06-12",
    wonOn: "2026-07-03",
    amount: 223_600,
    currency: "EUR",
    jobId: "cccccccc-cccc-4ccc-8ccc-ccccccccccc2",
    jobNo: "0078-00",
    jobTitle: "ETİ BAKIR — MONORAY VİNÇLER",
  },
  {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3",
    offerNo: "TETR-20260324-3",
    customerName: MUSTERILER[2].name,
    customerShort: MUSTERILER[2].short_name,
    customerHue: MUSTERILER[2].color_hue,
    subject: "200/20T ÇELİKHANE VİNCİ",
    issuedOn: "2026-03-24",
    wonOn: "2026-05-19",
    amount: 1_050_000,
    currency: "EUR",
    jobId: null,
    jobNo: null,
    jobTitle: null,
  },
  {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb4",
    offerNo: "TETR-20260127-1",
    customerName: MUSTERILER[3].name,
    customerShort: MUSTERILER[3].short_name,
    customerHue: MUSTERILER[3].color_hue,
    subject: "40T PORTAL VİNÇ VE KST",
    issuedOn: "2026-01-27",
    wonOn: "2026-02-16",
    amount: 615_000,
    currency: "EUR",
    jobId: null,
    jobNo: null,
    jobTitle: null,
  },
  {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb5",
    offerNo: "TEEN-20251117-1",
    customerName: MUSTERILER[0].name,
    customerShort: MUSTERILER[0].short_name,
    customerHue: MUSTERILER[0].color_hue,
    subject: "CRANE ELECTRICAL MODERNIZATION",
    issuedOn: "2025-11-17",
    wonOn: "2026-01-08",
    amount: 185_000,
    currency: "USD",
    jobId: null,
    jobNo: null,
    jobTitle: null,
  },
  {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb6",
    offerNo: "TETR-20250408-2",
    customerName: MUSTERILER[1].name,
    customerShort: MUSTERILER[1].short_name,
    customerHue: MUSTERILER[1].color_hue,
    subject: "ESKİ KAZANILMIŞ TEKLİF — KARAR TARİHİ BİLİNMİYOR",
    issuedOn: "2025-04-08",
    wonOn: null,
    amount: 96_000,
    currency: "EUR",
    jobId: null,
    jobNo: null,
    jobTitle: null,
  },
];

export default function OfferAnalysisPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="mx-auto grid max-w-[110rem] gap-4 p-3 sm:p-6">
      <PageHeader
        kicker="TEKLİF"
        title="Satış Analizi"
        hint="İleri satış projeksiyonu ile kazanılan işlerin gerçekleşmesini aynı yerde izleyin."
      />
      <AnalizView
        satirlar={PROJEKSIYON}
        kazanilanlar={KAZANILANLAR}
        customers={MUSTERILER}
        bugun={BUGUN}
      />
    </main>
  );
}
