// Sadece development: iş emri ekranlarını (liste + filtreler + form) auth
// olmadan görsel test etmek için. Production'da 404 döner.
//
// Veriler SAHTEDİR ve veritabanına dokunmaz; buradaki düğmeler gerçek kayıt
// üzerinde çalışmaz (sunucu eylemleri sahte id ile hata döner). Amaç yalnız
// yerleşim, filtre davranışı ve otomatik alanların gözle doğrulanmasıdır.

import { notFound } from "next/navigation";
import { JobForm, type PersonOption } from "@/app/(app)/jobs/job-form";
import type { JobRow } from "@/app/(app)/jobs/jobs-table";
import { JobsViews } from "@/app/(app)/jobs/jobs-views";
import { JobsSummary } from "@/app/(app)/jobs/jobs-summary";
// EMPTY_JOB şemadan gelir: sunucu bileşeni bir istemci modülünün dışa
// aktarımını yayamaz (bkz. jobs/schema.ts'teki not).
import { EMPTY_JOB, type CustomerOption } from "@/app/(app)/jobs/schema";

// Production ilk satırda `notFound()` ile kesilir ve statik 404 kalır; aksi
// halde yalnız geliştirmede kullanılan bu ekran Vercel'de boşuna fonksiyon
// bütçesi tüketir. Next dev sayfayı yine istek anında çalıştırır.

const YEAR = new Date().getFullYear();

const JOBS: JobRow[] = [
  {
    id: "j1", job_no: "0055", title: "İsdemir Amonyum Sülfat Vinci",
    customer: "İSKENDERUN DEMİR VE ÇELİK A.Ş.", customerShort: "İSDEMİR", customerHue: 12,
    status: "active",
    work_order_date: `${YEAR}-05-11`, created_at: `${YEAR}-05-11T09:00:00Z`,
    itemCount: 1, craneCount: 1, favori: true, jobLeader: "SİNAN ÇOLAKOĞLU",
    workshopExitDate: `${YEAR}-08-20`, deliveryDate: `${YEAR}-09-15`,
  },
  {
    id: "j2", job_no: "0057", title: "Astor 1T ve 5T Vinçler",
    customer: "ASTOR ENERJİ A.Ş.", customerShort: "ASTOR", customerHue: 148,
    status: "completed",
    work_order_date: `${YEAR}-03-02`, created_at: `${YEAR}-03-02T09:00:00Z`,
    itemCount: 2, craneCount: 2,
  },
  {
    id: "j3", job_no: "0053", title: "LITEC 40 t x 16,7 m Portal Vinç",
    customer: "LITEC MAKİNA SAN. VE TİC. A.Ş.", customerShort: "LITEC", customerHue: 255,
    status: "passive",
    work_order_date: `${YEAR}-01-20`, created_at: `${YEAR}-01-20T09:00:00Z`,
    itemCount: 1, craneCount: 0,
  },
  {
    // Deftere bağlanmamış eski kayıt: kısaltma ve renk metinden türetilir.
    id: "j4", job_no: "0045", title: "Habaş 2x30T Tersane Vinçleri",
    customer: "HABAŞ SINAİ VE TIBBİ GAZLAR", status: "archived",
    work_order_date: `${YEAR - 1}-07-26`, created_at: `${YEAR - 1}-07-26T09:00:00Z`,
    itemCount: 2, craneCount: 2,
  },
];

const CUSTOMERS: CustomerOption[] = [
  {
    id: "c1", name: "İSKENDERUN DEMİR VE ÇELİK A.Ş.", short_name: "İSDEMİR", color_hue: 12,
    address: "Karşı Mahalle Şehit Yüzbaşı Ali Oğuz Bulvarı No:1 PK 31900 Payas/Hatay",
    tax_office: "HATAY - Akdeniz Vergi Dairesi Müdürlüğü", tax_no: "8790009670",
    phone: "+90 (326) 758 40 40", fax: "+90 (326) 758 38 38", notes: "",
  },
  {
    id: "c2", name: "ASTOR ENERJİ A.Ş.", short_name: "ASTOR", color_hue: 148,
    address: "ASO 2. ve 3. OSB, Sincan/Ankara",
    tax_office: "Ankara - Sincan", tax_no: "1234567890",
    phone: "+90 312 267 01 56", fax: "", notes: "",
  },
  {
    id: "c3", name: "LITEC MAKİNA SAN. VE TİC. A.Ş.", short_name: "LITEC", color_hue: 255,
    address: "The Paragon, B Blok, Kat 23 No.113, Çukurambar, Çankaya/Ankara",
    tax_office: "", tax_no: "", phone: "", fax: "", notes: "",
  },
];

const PEOPLE: PersonOption[] = [
  { id: "p1", full_name: "Sinan Çolakoğlu", title: "Vinç Mühendisi" },
  { id: "p2", full_name: "Salih Ergüven", title: "Genel Müdür" },
];

export default function JobsPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 flex h-12 items-center border-b bg-background/90 px-4">
        <div className="text-sm font-medium">İş Emri Önizleme (dev · sahte veri)</div>
      </header>
      {/* Gerçek liste sayfası gibi TAM GENİŞLİK — önizleme dar kalsaydı sütun
          sıkışması burada görünmez, sorunu ancak canlıda fark ederdik. */}
      <div className="grid w-full flex-1 gap-8 px-4 py-6 lg:px-8">
        <section className="grid gap-3">
          <h2 className="text-lg font-semibold tracking-tight">İşler — görünümler, filtreler ve satır eylemleri</h2>
          <JobsSummary
            total={JOBS.length}
            active={1}
            craneCount={5}
            customerCount={4}
            lastCreated="11.05.2026"
            lastJobNo="0055"
          />
          <JobsViews
            jobs={JOBS}
            canDelete
            savedViews={[]}
            extras={{
              tasks: { j1: { open: 2, overdue: 1 }, j2: { open: 1, overdue: 0 } },
              termin: { j1: "2026-09-01" },
              taskDates: [
                { jobId: "j1", title: "SÖZLEŞME PDF'İNİ YÜKLE", dueDate: `${YEAR}-08-18` },
              ],
              salesDates: [
                { jobId: "j1", dueDate: `${YEAR}-09-01`, shipmentDate: null },
                { jobId: "j2", dueDate: `${YEAR}-03-01`, shipmentDate: `${YEAR}-03-05` },
              ],
            }}
          />
        </section>
        <section className="grid gap-3">
          <h2 className="text-lg font-semibold tracking-tight">Yeni İş Emri formu</h2>
          {/* İş no önerisi SUNUCUDA hesaplanır (`sonrakiIsNo`, jobs/new/page.tsx);
              önizlemede defter yok, bu yüzden kutu boş açılır. */}
          <JobForm mode="create" initial={EMPTY_JOB} customers={CUSTOMERS} people={PEOPLE} />
        </section>
        {/* DÜZENLEME KİPİ AYRICA BASILIR: revizyon anahtarı ve montaj
            adresinin "Sevk ile aynı" hâli YALNIZ burada görünür — create
            kipinde kutu "Revizyonsuz" yazar ve anahtar hiç çizilmez. */}
        <section className="grid gap-3">
          <h2 className="text-lg font-semibold tracking-tight">
            İş Emrini Düzenle — revizyon anahtarı + sevk/montaj adresi
          </h2>
          <JobForm
            mode="edit"
            jobId="onizleme"
            initial={{
              ...EMPTY_JOB,
              job_no: "0063",
              // REVİZYONSUZ: yeni iş emrinin normal hâli. Anahtar bu yüzden
              // "(Revizyonsuz → A)" yazar — kullanıcının ilk göreceği geçiş.
              revision: "",
              title: "ASTOR MUHTELİF VİNÇLER",
              customer: "ASTOR A.Ş.",
              work_order_date: `${YEAR}-08-18`,
              shipping_address: "Ankara OSB, 1. Cadde No: 12, Sincan / ANKARA",
              assembly_address: "Ankara OSB, 1. Cadde No: 12, Sincan / ANKARA",
              items: [
                { item_no: "0063-01", product_name: "10 T X 21,70 M ÇİFT KİRİŞLİ KÖPRÜLÜ VİNÇ", quantity: "1" },
                { item_no: "0063-02", product_name: "3 T X 6 M MONORAY VİNÇ", quantity: "2" },
              ],
            }}
            customers={CUSTOMERS}
            people={PEOPLE}
          />
        </section>
      </div>
    </div>
  );
}
