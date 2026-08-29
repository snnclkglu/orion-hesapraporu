// Geliştirici görsel doğrulaması: veritabanına yazmadan iki profil PDF'i üretir.

import fs from "node:fs/promises";
import path from "node:path";
import { renderCustomerProfilePdf, renderUserProfilePdf } from "../src/lib/pdf/profile-report";
import { DEFAULT_PROFILE_SCORING_SETTINGS } from "../src/lib/profile-scoring";
import type { CustomerProfileDataset } from "../src/lib/customer-profile";
import type { UsageMetricRow } from "../src/lib/usage";

const nowIso = "2026-08-29T12:00:00.000Z";
const company = {
  company: "ORION CRANES",
  address: "Ankara · Türkiye",
  phone: "+90 312 000 00 00",
  email: "info@orioncranes.com",
  web: "orioncranes.com",
};

const usageRows: UsageMetricRow[] = Array.from({ length: 14 }, (_, index) => {
  const day = String(29 - index).padStart(2, "0");
  const sections = ["engineering", "drawings", "jobs", "purchasing"];
  return {
    session_id: `10000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    usage_date: `2026-08-${day}`,
    section: sections[index % sections.length],
    device_class: index % 4 === 0 ? "mobile" : index % 5 === 0 ? "tablet" : "desktop",
    started_at: `2026-08-${day}T07:30:00.000Z`,
    last_seen_at: index === 0 ? "2026-08-29T11:59:20.000Z" : `2026-08-${day}T09:15:00.000Z`,
    active_seconds: 900 + (index % 5) * 780,
    page_views: 3 + (index % 6),
  };
});

const customerData: CustomerProfileDataset = {
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
    { id: "1", name: "AYŞE YILMAZ", title: "Satın Alma Müdürü", department: "Satın Alma", phone: "+90 262 000 00 01", email: "ayse.yilmaz@example.com", note: "Birincil teklif muhatabı.", isPrimary: true, active: true },
    { id: "2", name: "MEHMET KAYA", title: "Bakım Mühendisi", department: "Bakım", phone: "+90 262 000 00 02", email: "mehmet.kaya@example.com", note: "", isPrimary: false, active: true },
    { id: "3", name: "DENİZ AK", title: "Eski Proje Sorumlusu", department: "Proje", phone: "", email: "", note: "", isPrimary: false, active: false },
  ],
  offers: Array.from({ length: 26 }, (_, index) => ({
    id: `30000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    offerNo: `OC-T-2026-${String(index + 1).padStart(3, "0")}`,
    subject: index % 2 ? "Çift kirişli gezer köprülü vinç modernizasyonu" : "Proses vinci ve elektrik sistemi yenilemesi",
    status: ["won", "sent", "lost", "won", "draft"][index % 5],
    currency: index % 3 === 0 ? "USD" : "EUR",
    latestTotal: 125000 + index * 18500,
    issuedOn: `2026-${String(8 - (index % 7)).padStart(2, "0")}-${String(1 + (index % 25)).padStart(2, "0")}`,
    issueDate: "",
    createdAt: "2026-02-10T08:00:00.000Z",
    updatedAt: "2026-08-28T08:00:00.000Z",
  })),
  jobs: [
    { id: "j1", jobNo: "0088-00", title: "PROSES VİNCİ MODERNİZASYONU", status: "active", workOrderDate: "2026-06-11", createdAt: "2026-06-11T08:00:00Z", updatedAt: "2026-08-20T08:00:00Z" },
    { id: "j2", jobNo: "0062-00", title: "ÇELİKHANE TAVAN VİNCİ", status: "completed", workOrderDate: "2025-09-18", createdAt: "2025-09-18T08:00:00Z", updatedAt: "2026-03-20T08:00:00Z" },
  ],
  projects: [
    { id: "p1", jobId: "j1", docNo: "0088-HR-001", name: "PROSES VİNCİ", status: "active", createdAt: "2026-06-12T08:00:00Z", updatedAt: "2026-08-20T08:00:00Z" },
    { id: "p2", jobId: "j2", docNo: "0062-HR-001", name: "TAVAN VİNCİ", status: "archived", createdAt: "2025-09-20T08:00:00Z", updatedAt: "2026-03-20T08:00:00Z" },
  ],
};

async function main() {
  const outputDir = path.join(process.cwd(), "output", "pdf");
  await fs.mkdir(outputDir, { recursive: true });
  const [userPdf, customerPdf] = await Promise.all([
    renderUserProfilePdf({
      profile: {
        id: "10000000-0000-4000-8000-000000000099",
        fullName: "ÖNİZLEME KULLANICISI UZUN AD SOYAD",
        email: "onizleme.kullanicisi@orioncranes.com",
        title: "Kıdemli Proje ve Hesap Mühendisi",
        role: "engineer",
        createdAt: "2026-05-03T08:00:00.000Z",
      },
      usageRows,
      auditEvents: Array.from({ length: 20 }, (_, index) => ({
        id: index + 1,
        action: ["revision.issue", "drawing.update", "job.update", "project.create"][index % 4],
        createdAt: `2026-08-${String(29 - (index % 14)).padStart(2, "0")}T10:45:00.000Z`,
      })),
      actionCount30: 48,
      nowIso,
      scoring: DEFAULT_PROFILE_SCORING_SETTINGS.user,
      company,
    }),
    renderCustomerProfilePdf({
      data: customerData,
      nowIso,
      scoring: DEFAULT_PROFILE_SCORING_SETTINGS.customer,
      company,
    }),
  ]);
  await Promise.all([
    fs.writeFile(path.join(outputDir, "KULLANICI PROFIL RAPORU - ONIZLEME.pdf"), userPdf),
    fs.writeFile(path.join(outputDir, "MUSTERI PROFIL RAPORU - ONIZLEME.pdf"), customerPdf),
  ]);
}

void main();
