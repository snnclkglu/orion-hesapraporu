// Sadece development: Mühendislik LİSTESİNİ auth olmadan görsel test etmek
// için. Production'da 404 döner. (sales-preview ile aynı desen.)
//
// `/dev/project-preview` proje DETAYINI gösterir; burası listedir. İkisi ayrı
// sayfadır çünkü ölçülen şey de ayrıdır: detayda bölüm kartlarının yerleşimi,
// burada SÜTUN GENİŞLİKLERİ ve satır yüksekliği.
//
// KABUK GEOMETRİSİ TAKLİT EDİLİR, AppShell ÇİZİLMEZ. Sebep ölçmedir: kırılım
// sınıfları (`md:`/`lg:`) PENCERE genişliğine bakar ama sütunlara kalan yer
// KABIN genişliğidir ve ikisi `lg`de ayrışır — kenar çubuğu tam orada belirip
// içeriği 254px daraltır, yani 1024px'te tabloya 1023px'tekinden AZ yer kalır.
// Kabuğu kendisi çizmek `isWide` yolu `/projects` olmadığı için sayfayı
// `max-w-6xl`e sokar ve gerçek genişliği bir daha vermezdi; bu yüzden burada
// yalnız kenar çubuğunun YERİ ve `main` dolgusu birebir kopyalanır.

import { notFound } from "next/navigation";
import { ProjectsTable, type ProjectRow } from "@/app/(app)/projects/projects-table";
import { PageHeader } from "@/components/page-header";

function row(
  p: Pick<ProjectRow, "doc_no" | "name" | "customer" | "crane_type"> & Partial<ProjectRow>
): ProjectRow {
  return {
    id: p.doc_no,
    status: "active",
    created_at: "2026-05-14T09:00:00Z",
    job_id: p.doc_no.slice(0, 4),
    job_no: p.doc_no.slice(0, 4),
    lastRevNo: 0,
    lastRevStatus: "draft",
    hasIssuedRevision: false,
    ...p,
  };
}

// Fikstür GERÇEK satırlardan: ekrandaki en uzun proje adı ve en uzun müşteri
// unvanı buradadır — kelepçe onlarla sınanmazsa hiç sınanmamış olur.
const ROWS: ProjectRow[] = [
  row({
    doc_no: "0063-00",
    name: "20 T KAPASİTELİ KEPÇELİ VİNÇ ARABA KOMPLE İMALATI",
    customer: "LITEC MAKİNA SAN. VE TİC. A.Ş.",
    crane_type: "Vinç Arabası",
  }),
  row({
    doc_no: "0057-01",
    name: "1 t x 19,00 m Kapasiteli Tek Kirişli Köprülü Tavan Vinci",
    customer: "ASTOR A.Ş.",
    crane_type: "Tek Kirişli Gezer Köprülü Vinç",
    job_title: "MUHTELİF VİNÇLER",
    job_customer: "ASTOR A.Ş.",
  }),
  row({
    doc_no: "0057-02",
    name: "2 t x 12,00 m Kapasiteli Çift Kirişli Köprülü Tavan Vinci",
    customer: "ASTOR A.Ş.",
    crane_type: "Çift Kirişli Gezer Köprülü Vinç",
    job_title: "MUHTELİF VİNÇLER",
    job_customer: "ASTOR A.Ş.",
    lastRevNo: 1,
    lastRevStatus: "issued",
    hasIssuedRevision: true,
  }),
  row({
    doc_no: "0057-03",
    name: "3,2 t Kapasiteli Monoray Servis Vinci",
    customer: "ASTOR A.Ş.",
    crane_type: "Monoray Vinç",
    job_title: "MUHTELİF VİNÇLER",
    job_customer: "ASTOR A.Ş.",
  }),
  row({
    doc_no: "0055",
    name: "AMONYUM SÜLFAT TESİSİ VİNCİ",
    customer: "İSDEMİR A.Ş.",
    crane_type: "Çift Kirişli Gezer Köprülü Vinç",
    lastRevNo: 1,
  }),
  row({
    doc_no: "0019-00",
    name:
      "185/40 T X 18,28 M KAPASİTELİ DÖRT KİRİŞLİ KÖPRÜLÜ TAVAN VİNCİ " +
      "MÜHENDİSLİK VE TASARIM HİZMETİ (ÇELİKHANE ŞARJ HOLÜ TESİSİ)",
    customer: "KARÇEL KARDEMİR ÇELİK YAPI İMALAT SAN.VE TİC.LTD.ŞTİ.",
    crane_type: "Şarj / Döküm Vinci",
  }),
  // İŞE BAĞLI OLMAYAN + ARŞİVLİ + YAYINLANMIŞ satır: "bağımsız" yazısı, arşiv
  // rozeti ve `V2 Yayın` rozeti de aynı ekranda ölçülsün.
  row({
    doc_no: "0043-00",
    name: "MTC PASLANMAZ ÇELİK KONSTRÜKSİYONLU MONORAY VİNÇ SİSTEMİ",
    customer: "PLASTIC MASTER PLASTİK SANAYİ VE TİC.LTD.ŞTİ.",
    crane_type: "Monoray Vinç",
    status: "archived",
    job_id: null,
    job_no: null,
    lastRevNo: 2,
    lastRevStatus: "issued",
    hasIssuedRevision: true,
  }),
  // Revizyonu hiç olmayan satır — "—" hücresi.
  row({
    doc_no: "0064-00",
    name: "Kaldırma Kirişi",
    customer: "YALCO DIŞ TİCARET VE MÜMESSİLLİK LTD. ŞTİ.",
    crane_type: "Kaldırma Kirişi",
    lastRevNo: null,
    lastRevStatus: null,
  }),
];

export default function ProjectsPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return (
    <div className="flex min-h-dvh">
      {/* Kenar çubuğunun YERİ: `app-shell` 15rem + 14px'lik kırmızı omurga,
          `hidden lg:flex`. Ölçüm bu payı görmeden yapılırsa 1024px'te tabloya
          254px fazla yer verir ve "sığıyor" sonucu yalan çıkar. */}
      <div
        aria-hidden
        className="hidden shrink-0 border-l-[14px] border-l-primary bg-sidebar lg:block"
        style={{ width: "15rem", minWidth: "15rem", maxWidth: "15rem" }}
      />
      <main className="min-w-0 flex-1 px-3 py-4 sm:px-4 sm:py-6 lg:px-8">
        {/* `/projects` GENİŞ sayfadır (`app-shell` isWide): `max-w-none`. */}
        <div className="mx-auto grid w-full max-w-none gap-4">
          <PageHeader title="Mühendislik" hint="Hesap raporu projeleri ve revizyon arşivi" />
          <ProjectsTable
            projects={ROWS}
            jobs={[]}
            canDelete
            jobGroupBasePath="/dev/projects-job-preview"
          />
        </div>
      </main>
    </div>
  );
}
