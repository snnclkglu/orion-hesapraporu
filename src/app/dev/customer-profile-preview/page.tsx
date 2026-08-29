import { notFound } from "next/navigation";
import { CustomerProfileView } from "@/app/(app)/admin/customers/[id]/customer-profile-view";
import type { CustomerProfileDataset } from "@/lib/customer-profile";
import { DEFAULT_PROFILE_SCORING_SETTINGS } from "@/lib/profile-scoring";

const data: CustomerProfileDataset = {
  customer: {
    id: "20000000-0000-4000-8000-000000000099",
    name: "ORION ÖNİZLEME DEMİR ÇELİK SANAYİ VE TİCARET ANONİM ŞİRKETİ",
    shortName: "ÖNİZLEME",
    colorHue: 210,
    address: "Organize Sanayi Bölgesi, Teknik Cadde No: 24, Gebze / KOCAELİ",
    taxOffice: "Gebze",
    taxNo: "1234567890",
    phone: "+90 262 000 00 00",
    fax: "",
    notes: "Uzun dönemli vinç modernizasyonu ve bakım yatırımları için takip edilen kurumsal müşteri.",
    logoPath: "",
    logoName: "",
    createdAt: "2025-02-04T08:00:00.000Z",
    updatedAt: "2026-08-26T11:30:00.000Z",
  },
  contacts: [
    { id: "1", name: "AYŞE YILMAZ", title: "Satın Alma Müdürü", department: "Satın Alma", phone: "+90 262 000 00 01", email: "ayse.yilmaz@example.com", note: "", isPrimary: true, active: true },
    { id: "2", name: "MEHMET KAYA", title: "Bakım Mühendisi", department: "Bakım", phone: "+90 262 000 00 02", email: "mehmet.kaya@example.com", note: "", isPrimary: false, active: true },
    { id: "3", name: "DENİZ AK", title: "Eski Proje Sorumlusu", department: "Proje", phone: "", email: "", note: "", isPrimary: false, active: false },
  ],
  offers: Array.from({ length: 9 }, (_, index) => ({
    id: `30000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    offerNo: `OC-T-2026-${String(index + 1).padStart(3, "0")}`,
    subject: index % 2 ? "Çift kirişli gezer köprülü vinç modernizasyonu" : "Proses vinci ve elektrik sistemi yenilemesi",
    status: ["won", "sent", "lost", "won", "draft"][index % 5],
    currency: index % 3 === 0 ? "USD" : "EUR",
    latestTotal: 125000 + index * 18500,
    issuedOn: `2026-${String(8 - Math.floor(index / 2)).padStart(2, "0")}-${String(10 + index).padStart(2, "0")}`,
    issueDate: "",
    createdAt: `2026-0${Math.max(1, 8 - Math.floor(index / 2))}-10T08:00:00.000Z`,
    updatedAt: "2026-08-28T08:00:00.000Z",
  })),
  jobs: [
    { id: "40000000-0000-4000-8000-000000000001", jobNo: "0088-00", title: "PROSES VİNCİ MODERNİZASYONU", status: "active", workOrderDate: "2026-06-11", createdAt: "2026-06-11T08:00:00Z", updatedAt: "2026-08-20T08:00:00Z" },
    { id: "40000000-0000-4000-8000-000000000002", jobNo: "0062-00", title: "ÇELİKHANE TAVAN VİNCİ", status: "completed", workOrderDate: "2025-09-18", createdAt: "2025-09-18T08:00:00Z", updatedAt: "2026-03-20T08:00:00Z" },
  ],
  projects: [
    { id: "50000000-0000-4000-8000-000000000001", jobId: "40000000-0000-4000-8000-000000000001", docNo: "0088-HR-001", name: "PROSES VİNCİ", status: "active", createdAt: "2026-06-12T08:00:00Z", updatedAt: "2026-08-20T08:00:00Z" },
    { id: "50000000-0000-4000-8000-000000000002", jobId: "40000000-0000-4000-8000-000000000002", docNo: "0062-HR-001", name: "TAVAN VİNCİ", status: "archived", createdAt: "2025-09-20T08:00:00Z", updatedAt: "2026-03-20T08:00:00Z" },
  ],
};

export default function CustomerProfilePreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return (
    <main className="mx-auto max-w-[92rem] p-3 sm:p-6">
      <CustomerProfileView data={data} logoUrl={null} scoring={DEFAULT_PROFILE_SCORING_SETTINGS.customer} nowIso="2026-08-29T12:00:00.000Z" />
    </main>
  );
}
