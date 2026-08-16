// Sadece development: iş hub'ının yeni yüzlerini (bölüm rayı + olay akışı)
// auth olmadan görsel test etmek için. Production'da 404 döner.
//
// Fikstür GERÇEK olay türlerinin tamamını basar: tek türlü bir akış, rozet
// renk ayrımının ve özet cümlelerinin çalıştığını gösteremez.

import { notFound } from "next/navigation";
import { JobNav } from "@/app/(app)/jobs/[id]/job-nav";
import {
  JobAkisi,
  type JobCommentRow,
  type JobEventRow,
} from "@/app/(app)/jobs/akis-view";

const PEOPLE = [
  { id: "p1", fullName: "Sinan Çolakoğlu" },
  { id: "p2", fullName: "Salih Ergüven" },
];

const YORUMLAR: JobCommentRow[] = [
  {
    id: "y1",
    at: "2026-08-15T10:00:00Z",
    authorId: "p1",
    authorName: "Sinan Çolakoğlu",
    body: "@Salih Ergüven termine bir hafta kaldı, sevk planını netleştirelim.",
    edited: false,
  },
  {
    id: "y2",
    at: "2026-08-12T08:30:00Z",
    authorId: "p2",
    authorName: "Salih Ergüven",
    body: "Sözleşme imzalandı, PDF'i yükledim.",
    edited: true,
  },
];

const OLAYLAR: JobEventRow[] = [
  {
    id: "e1",
    event: "durum_oto",
    at: "2026-08-15T14:20:00Z",
    actorName: "Sinan Çolakoğlu",
    detail: { to: "completed" },
  },
  {
    id: "e2",
    event: "durum",
    at: "2026-08-14T09:05:00Z",
    actorName: "Salih Ergüven",
    detail: { from: "active", to: "passive" },
  },
  {
    id: "e3",
    event: "gorev_atandi",
    at: "2026-08-13T11:40:00Z",
    actorName: "Sinan Çolakoğlu",
    detail: { title: "SÖZLEŞME PDF'İNİ YÜKLE" },
  },
  {
    id: "e4",
    event: "guncellendi",
    at: "2026-08-12T16:12:00Z",
    actorName: "Sinan Çolakoğlu",
    detail: { kalem: 3 },
  },
  {
    id: "e5",
    event: "olusturuldu",
    at: "2026-08-11T08:30:00Z",
    actorName: "Salih Ergüven",
    detail: { title: "ASTOR 1T VE 5T VİNÇLER", kalem: 2 },
  },
  {
    id: "e6",
    event: "silindi",
    at: "2026-08-10T10:00:00Z",
    actorName: "Sinan Çolakoğlu",
    detail: {},
  },
];

export default function JobHubPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return (
    <div className="mx-auto grid w-full max-w-4xl gap-6 px-4 py-6">
      <header className="text-sm font-medium">
        İş Hub Önizleme (dev · sahte veri)
      </header>
      <section className="grid gap-3">
        <h2 className="text-lg font-semibold tracking-tight">Bölüm rayı</h2>
        <JobNav jobId="onizleme" />
      </section>
      <section className="grid gap-3">
        <h2 className="text-lg font-semibold tracking-tight">Akış</h2>
        <JobAkisi
          jobId="onizleme"
          olaylar={OLAYLAR}
          yorumlar={YORUMLAR}
          people={PEOPLE}
          meId="p1"
          isAdmin
        />
      </section>
    </div>
  );
}
