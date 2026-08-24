// Yalnız development: yeni Teklif Hesap Raporları listesini auth/veritabanı
// olmadan görsel olarak sınar. Fikstür, teklif aşamasındaki gerçek büyüklükte
// adları kullanır; Mühendislik iş numarası sütununun görünmediği de burada
// ölçülür.

import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import {
  ProjectsTable,
  type ProjectRow,
} from "@/app/(app)/projects/projects-table";
import { OFFER_REPORT_CONTEXT, reportBasePath } from "@/lib/report-context";

const ROWS: ProjectRow[] = [
  {
    id: "teklif-hesap-1",
    doc_no: "T26-084-HR-01",
    name: "32 T × 30 M PORTAL VİNÇ TEKLİF ÖN HESABI",
    customer: "ASTOR ENERJİ A.Ş.",
    crane_type: "Çift Kirişli Portal Vinç",
    status: "active",
    created_at: "2026-08-24T08:00:00Z",
    job_id: null,
    job_no: null,
    lastRevNo: 1,
    lastRevStatus: "draft",
    hasIssuedRevision: false,
  },
  {
    id: "teklif-hesap-2",
    doc_no: "T26-079-HR-01",
    name: "20 T KAPASİTELİ KEPÇELİ VİNÇ ARABA KOMPLE İMALATI",
    customer: "LITEC MAKİNA SAN. VE TİC. A.Ş.",
    crane_type: "Vinç Arabası",
    status: "active",
    created_at: "2026-08-20T08:00:00Z",
    job_id: null,
    job_no: null,
    lastRevNo: 0,
    lastRevStatus: "issued",
    hasIssuedRevision: true,
  },
  {
    id: "teklif-hesap-3",
    doc_no: "T26-061-HR-02",
    name: "MONORAY VİNÇ SİSTEMİ ALTERNATİFİ",
    customer: "MTC PASLANMAZ ÇELİK",
    crane_type: "Monoray Vinç",
    status: "archived",
    created_at: "2026-07-11T08:00:00Z",
    job_id: null,
    job_no: null,
    lastRevNo: 2,
    lastRevStatus: "issued",
    hasIssuedRevision: true,
  },
];

export default function OfferReportsPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();

  return (
    <main className="mx-auto grid min-h-dvh w-full max-w-none gap-4 px-3 py-4 sm:px-4 sm:py-6 lg:px-8">
      <PageHeader
        kicker="Teklif"
        title="Teklif Hesap Raporları"
        hint="Teklif aşamasındaki hızlı mühendislik hesapları; Mühendislik arşivinden ayrı, aynı hesap motoruyla."
      />
      <ProjectsTable
        projects={ROWS}
        jobs={[]}
        canDelete
        basePath={reportBasePath(OFFER_REPORT_CONTEXT)}
        reportContext={OFFER_REPORT_CONTEXT}
      />
    </main>
  );
}
