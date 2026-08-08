// Sadece development: iş emri ekranlarını (liste + filtreler + form) auth
// olmadan görsel test etmek için. Production'da 404 döner.
//
// Veriler SAHTEDİR ve veritabanına dokunmaz; buradaki düğmeler gerçek kayıt
// üzerinde çalışmaz (sunucu eylemleri sahte id ile hata döner). Amaç yalnız
// yerleşim, filtre davranışı ve otomatik alanların gözle doğrulanmasıdır.

import { notFound } from "next/navigation";
import { JobForm, EMPTY_JOB, type PersonOption } from "@/app/(app)/jobs/job-form";
import { JobsTable, type JobRow } from "@/app/(app)/jobs/jobs-table";
import type { CustomerOption } from "@/app/(app)/jobs/schema";

const YEAR = new Date().getFullYear();

const JOBS: JobRow[] = [
  {
    id: "j1", job_no: "0055", title: "İsdemir Amonyum Sülfat Vinci",
    customer: "İSKENDERUN DEMİR VE ÇELİK A.Ş.", status: "active",
    work_order_date: `${YEAR}-05-11`, created_at: `${YEAR}-05-11T09:00:00Z`,
    itemCount: 1, craneCount: 1,
  },
  {
    id: "j2", job_no: "0057", title: "Astor 1T ve 5T Vinçler",
    customer: "ASTOR ENERJİ A.Ş.", status: "completed",
    work_order_date: `${YEAR}-03-02`, created_at: `${YEAR}-03-02T09:00:00Z`,
    itemCount: 2, craneCount: 2,
  },
  {
    id: "j3", job_no: "0053", title: "LITEC 40 t x 16,7 m Portal Vinç",
    customer: "LITEC MAKİNA", status: "passive",
    work_order_date: `${YEAR}-01-20`, created_at: `${YEAR}-01-20T09:00:00Z`,
    itemCount: 1, craneCount: 0,
  },
  {
    id: "j4", job_no: "0045", title: "Habaş 2x30T Tersane Vinçleri",
    customer: "HABAŞ SINAİ VE TIBBİ GAZLAR", status: "archived",
    work_order_date: `${YEAR - 1}-07-26`, created_at: `${YEAR - 1}-07-26T09:00:00Z`,
    itemCount: 2, craneCount: 2,
  },
];

const CUSTOMERS: CustomerOption[] = [
  {
    id: "c1", name: "İSKENDERUN DEMİR VE ÇELİK A.Ş.",
    address: "Karşı Mahalle Şehit Yüzbaşı Ali Oğuz Bulvarı No:1 PK 31900 Payas/Hatay",
    tax_office: "HATAY - Akdeniz Vergi Dairesi Müdürlüğü", tax_no: "8790009670",
    phone: "+90 (326) 758 40 40", fax: "+90 (326) 758 38 38", notes: "",
  },
  {
    id: "c2", name: "ASTOR ENERJİ A.Ş.", address: "ASO 2. ve 3. OSB, Sincan/Ankara",
    tax_office: "Ankara - Sincan", tax_no: "1234567890",
    phone: "+90 312 267 01 56", fax: "", notes: "",
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
      <div className="mx-auto grid w-full max-w-6xl flex-1 gap-8 px-4 py-6 lg:px-8">
        <section className="grid gap-3">
          <h2 className="text-lg font-semibold tracking-tight">İşler — filtreler ve satır eylemleri</h2>
          <JobsTable jobs={JOBS} canDelete />
        </section>
        <section className="grid gap-3">
          <h2 className="text-lg font-semibold tracking-tight">Yeni İş Emri formu</h2>
          <JobForm mode="create" initial={EMPTY_JOB} customers={CUSTOMERS} people={PEOPLE} />
        </section>
      </div>
    </div>
  );
}
