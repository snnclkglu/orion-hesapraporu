// Sadece development: TEKLİF listesini auth olmadan görsel test etmek için.
// Production'da 404 döner (sales-preview ile aynı desen).
//
// FİKSTÜR GERÇEK BÜYÜKLÜKLERDEDİR: 223.600 € ve 1.382.000 € gibi tutarlar
// firmanın kendi tekliflerinden alındı. Uydurma küçük sayılarla sütun taşması,
// müşteri çipinin kırpılması ve takip çipinin renk aralığı GÖRÜLMEZ.
//
// TAKİP SAYACININ TAM YELPAZESİ BASILIR: bugün, 3 gün, 12 gün, 5 hafta ve 3
// aylık satırlar yan yana durur — sarıdan kırmızıya inen ölçek ancak birlikte
// görüldüğünde denetlenebilir.

import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { OffersTable } from "@/app/(app)/offers/offers-table";
import type { OfferListEntry } from "@/app/(app)/offers/data";
import type { CustomerOption } from "@/app/(app)/jobs/schema";

const BUGUN = "2026-08-17";

const MUSTERILER: CustomerOption[] = [
  m("c1", "HABAŞ SINAİ VE TIBBİ GAZLAR İSTİHSAL ENDÜSTRİSİ A.Ş.", "HABAŞ", 40),
  m("c2", "ETİ BAKIR A.Ş.", "ETİ BAKIR", 150),
  m("c3", "ASTOR ENERJİ A.Ş.", "ASTOR", 0),
  m("c4", "LITEC MAKİNA SAN. VE TİC. A.Ş.", "LITEC", 255),
  m("c5", "GAZİ ÜNİVERSİTESİ", "GAZİ ÜNİ.", 300),
];

function m(id: string, name: string, short: string, hue: number): CustomerOption {
  return {
    id,
    name,
    short_name: short,
    color_hue: hue,
    address: "",
    tax_office: "",
    tax_no: "",
    phone: "",
    fax: "",
    notes: "",
  };
}

function teklif(over: Partial<OfferListEntry> & Pick<OfferListEntry, "id" | "offer_no">): OfferListEntry {
  return {
    subject: "",
    customer_name: "",
    customerShort: null,
    customerHue: null,
    status: "sent",
    issue_date: "2026-01-27",
    issuedOn: "2026-01-27",
    wonOn: null,
    jobId: null,
    currency: "EUR",
    latestTotal: null,
    latestRevNo: 0,
    craneTypes: [],
    capacities: [],
    itemCount: 1,
    lang: "tr",
    customerId: null,
    latestRevisionId: "r1",
    latestRevStatus: "issued",
    updatedAt: "2026-01-27T00:00:00Z",
    ...over,
  };
}

const TEKLIFLER: OfferListEntry[] = [
  teklif({
    id: "1",
    offer_no: "TETR-20260817-1",
    subject: "İDÇ 5T MONORAY VİNÇ",
    customer_name: "ETİ BAKIR A.Ş.",
    customerShort: "ETİ BAKIR",
    customerHue: 150,
    customerId: "c2",
    issue_date: "2026-08-17",
    issuedOn: "2026-08-17",
    latestTotal: 28_500,
    latestRevNo: 0,
    craneTypes: ["Monoray Vinç"],
    capacities: [5],
  }),
  teklif({
    id: "2",
    offer_no: "TETR-20260814-1",
    subject: "HABAŞ DÖRTYOL HADDANE 20T ÇİFT KİRİŞLİ VİNÇ",
    customer_name: "HABAŞ SINAİ VE TIBBİ GAZLAR İSTİHSAL ENDÜSTRİSİ A.Ş.",
    customerShort: "HABAŞ",
    customerHue: 40,
    customerId: "c1",
    issue_date: "2026-08-10",
    issuedOn: "2026-08-14",
    latestTotal: 223_600,
    latestRevNo: 2,
    craneTypes: ["Çift Kirişli Gezer Köprülü Vinç"],
    capacities: [20],
    itemCount: 1,
  }),
  teklif({
    id: "3",
    offer_no: "TETR-20260805-2",
    subject: "ASTOR YENİ FABRİKA 1T VİNÇ PAKETİ",
    customer_name: "ASTOR ENERJİ A.Ş.",
    customerShort: "ASTOR",
    customerHue: 0,
    customerId: "c3",
    issue_date: "2026-08-05",
    issuedOn: "2026-08-05",
    latestTotal: 187_400,
    latestRevNo: 1,
    craneTypes: ["Tek Kirişli Gezer Köprülü Vinç", "Pergel Vinç"],
    capacities: [1, 5],
    itemCount: 4,
  }),
  teklif({
    id: "4",
    offer_no: "TETR-20260712-1",
    subject: "LITEC 40T PORTAL VİNÇ VE KST",
    customer_name: "LITEC MAKİNA SAN. VE TİC. A.Ş.",
    customerShort: "LITEC",
    customerHue: 255,
    customerId: "c4",
    issue_date: "2026-07-12",
    issuedOn: "2026-07-12",
    latestTotal: 615_000,
    latestRevNo: 2,
    craneTypes: ["Portal Vinç"],
    capacities: [40],
  }),
  teklif({
    id: "5",
    offer_no: "TETR-20260518-3",
    subject: "ETİ BAKIR MUHTELİF VİNÇLER — 22 ADET",
    customer_name: "ETİ BAKIR A.Ş.",
    customerShort: "ETİ BAKIR",
    customerHue: 150,
    customerId: "c2",
    issue_date: "2026-05-18",
    issuedOn: "2026-05-18",
    latestTotal: 1_382_000,
    latestRevNo: 3,
    craneTypes: ["Çift Kirişli Gezer Köprülü Vinç", "Monoray Vinç"],
    capacities: [2, 5, 10, 20],
    itemCount: 14,
  }),
  teklif({
    id: "6",
    offer_no: "TETR-20260324-3",
    subject: "GAZİ ÜNİVERSİTESİ 200/20T VİNÇ",
    customer_name: "GAZİ ÜNİVERSİTESİ",
    customerShort: "GAZİ ÜNİ.",
    customerHue: 300,
    customerId: "c5",
    issue_date: "2026-03-24",
    issuedOn: "2026-03-24",
    latestTotal: 1_050_000,
    latestRevNo: 1,
    craneTypes: ["Çift Kirişli Gezer Köprülü Vinç"],
    capacities: [200],
    status: "won",
  }),
  // HİÇ YAYIMLANMAMIŞ TASLAK: takip çipi ÇIKMAMALIDIR ve tarih açılış
  // gününden okunmalıdır.
  teklif({
    id: "7",
    offer_no: "TETR-20260816-1",
    subject: "YAZICI DÇ ŞARJ VİNCİ KABİN DEĞİŞİMİ",
    customer_name: "YAZICI DEMİR ÇELİK SAN. A.Ş.",
    customerShort: null,
    customerHue: null,
    issue_date: "2026-08-16",
    issuedOn: null,
    latestTotal: null,
    latestRevNo: 0,
    latestRevStatus: "draft",
    status: "draft",
    craneTypes: ["Operatör Kabini"],
    capacities: [],
  }),
  // Kaybedilmiş teklif — takip çipi çıkmaz, durum çipi kırmızıya yakın.
  teklif({
    id: "8",
    offer_no: "TETR-20260218-1",
    subject: "MAKİ ENERJİ 25T VİNÇ",
    customer_name: "MAKİ ENERJİ SAN. TİC. A.Ş.",
    customerShort: null,
    customerHue: null,
    issue_date: "2026-02-18",
    issuedOn: "2026-02-18",
    latestTotal: 96_000,
    latestRevNo: 1,
    craneTypes: ["Çift Kirişli Gezer Köprülü Vinç"],
    capacities: [25],
    status: "lost",
  }),
];

export default function OffersPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="mx-auto grid max-w-[110rem] gap-6 p-4">
      <PageHeader
        kicker="Önizleme"
        title="Teklifler"
        hint="Sahte veri — auth'suz görsel denetim. Takip sayacının tam yelpazesi basılır."
      />
      <OffersTable rows={TEKLIFLER} customers={MUSTERILER} bugun={BUGUN} />
    </main>
  );
}
