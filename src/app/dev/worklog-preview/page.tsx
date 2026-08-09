// Sadece development: İş Takibi ekranlarını auth olmadan görsel test etmek
// için. Production'da 404 döner. (jobs-preview / sales-preview ile aynı desen.)
//
// Veriler SAHTEDİR ve veritabanına dokunmaz; kaydetme/silme sunucu eylemleri
// sahte kimliklerle hata döner. Amaç yalnız yerleşim, grafiklerin okunurluğu,
// süzgeç/sıralama davranışı ve toplamların gözle doğrulanmasıdır.

import { notFound } from "next/navigation";
import { AnalysisView } from "@/app/(app)/worklog/analysis/analysis-view";
import { DayEntry } from "@/app/(app)/worklog/day-entry";
import { RecordsTable } from "@/app/(app)/worklog/records/records-table";
import { WorkLogNav } from "@/app/(app)/worklog/worklog-nav";
import type { RecentCombo } from "@/app/(app)/worklog/data";
import type {
  WorkCategory,
  WorkJobOption,
  WorkLogRow,
  WorkPart,
} from "@/lib/work-log";

const CATEGORIES: WorkCategory[] = [
  { id: "c1", name: "Çelik İmalat", colorHue: 25, sort: 10, active: true },
  { id: "c2", name: "Talaşlı İmalat", colorHue: 235, sort: 20, active: true },
  { id: "c3", name: "Montaj", colorHue: 155, sort: 30, active: true },
  { id: "c4", name: "Saha Montajı", colorHue: 195, sort: 40, active: true },
  { id: "c5", name: "Boya", colorHue: 290, sort: 50, active: true },
];

const PARTS: WorkPart[] = [
  "Ana Kiriş",
  "Baş Kiriş",
  "Kabin",
  "Elektrik Odası",
  "Boji",
  "Araba Şasesi",
  "Tambur 185T",
  "Montaj",
  "Talaşlı",
].map((name, i) => ({ id: `p${i + 1}`, name, sort: (i + 1) * 10, active: true }));

const JOBS: WorkJobOption[] = [
  {
    jobItemId: "j1",
    jobId: "job1",
    itemNo: "0025-00",
    jobNo: "0025",
    productName: "20 t x 30 m Kütük Holü Vinci",
    customer: "İZMİR DEMİR ÇELİK SANAYİ A.Ş.",
    customerShort: "İDÇ",
    customerHue: 120,
    orphan: false,
  },
  {
    jobItemId: "j2",
    jobId: "job2",
    itemNo: "0026-01",
    jobNo: "0026",
    productName: "100 t x 15,50 m Çift Kirişli Köprülü Tavan Vinci",
    customer: "ASTOR A.Ş.",
    customerShort: "ASTOR",
    customerHue: 0,
    orphan: false,
  },
  {
    jobItemId: "j3",
    jobId: "job3",
    itemNo: "0053-01",
    jobNo: "0053",
    productName: "40 t x 16,7 m Portal Vinci",
    customer: "LITEC MAKİNA SAN. VE TİC. A.Ş.",
    customerShort: "LITEC",
    customerHue: 255,
    orphan: false,
  },
  {
    jobItemId: null,
    jobId: null,
    itemNo: "0020-00",
    jobNo: "0020",
    productName: "",
    customer: "",
    customerShort: null,
    customerHue: null,
    orphan: true,
  },
];

/**
 * Örnek kayıtlar — gerçek verinin ŞEKLİNİ taklit eder: bir işin baskın olduğu,
 * çelik imalatın çoğunluğu oluşturduğu, aylara yayılmış ve bir kısmı işe
 * bağlanamamış bir küme. Üretim sabit tohumludur (rastgele değil): önizleme
 * her açılışta aynı görünsün, ekran karşılaştırılabilir olsun.
 */
function buildRows(): WorkLogRow[] {
  const out: WorkLogRow[] = [];
  const start = Date.UTC(2025, 9, 1); // 2025-10-01
  let n = 0;
  for (let day = 0; day < 300; day++) {
    const d = new Date(start + day * 86_400_000);
    const dow = d.getUTCDay();
    if (dow === 0) continue; // pazar çalışılmıyor
    const iso = d.toISOString().slice(0, 10);
    const lines = 3 + (day % 3);
    for (let i = 0; i < lines; i++) {
      n += 1;
      const job = JOBS[(day + i) % JOBS.length];
      const part = PARTS[(day * 2 + i * 3) % PARTS.length];
      // Çelik imalat baskın: beş satırın üçü.
      const cat = CATEGORIES[[0, 0, 0, 1, 2, 3, 4][(day + i) % 7]];
      const people = 1 + ((day + i * 2) % 6);
      const hours = i === 0 && day % 17 === 0 ? 10 : 8;
      out.push({
        id: `r${n}`,
        date: iso,
        itemNo: job.itemNo,
        jobId: job.jobId,
        jobItemId: job.jobItemId,
        jobNo: job.orphan ? "" : job.jobNo,
        jobTitle: job.productName,
        customer: job.customer,
        customerShort: job.customerShort,
        customerHue: job.customerHue,
        productName: job.productName,
        partId: part.id,
        partName: part.name,
        categoryId: cat.id,
        categoryName: cat.name,
        categoryHue: cat.colorHue,
        partCode: ["0100", "0200", "0700", "0800", "1000"][(day + i) % 5],
        people,
        hours,
        manHours: people * hours,
        note: "",
      });
    }
  }
  return out;
}

const ROWS = buildRows();

const RECENT: RecentCombo[] = ROWS.slice(0, 8).map((r) => ({
  itemNo: r.itemNo,
  jobItemId: r.jobItemId,
  jobId: r.jobId,
  partId: r.partId,
  partName: r.partName,
  categoryId: r.categoryId,
  categoryName: r.categoryName,
  categoryHue: r.categoryHue,
  partCode: r.partCode,
  people: r.people,
  hours: r.hours,
  lastDate: r.date,
  uses: 12,
}));

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-3">
      <div className="flex items-center gap-3 border-t pt-6">
        <span className="oc-rule-red" aria-hidden />
        <h2 className="oc-kicker text-foreground/80">{title}</h2>
      </div>
      {children}
    </section>
  );
}

export default function WorkLogPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();

  const today = ROWS[ROWS.length - 1].date;
  const dayRows = ROWS.filter((r) => r.date === today);
  const prevDate = [...new Set(ROWS.map((r) => r.date))].sort().at(-2)!;
  const dailyTotals: Record<string, number> = {};
  for (const r of ROWS) dailyTotals[r.date] = (dailyTotals[r.date] ?? 0) + r.manHours;

  return (
    // Üst bant GERÇEK bölüm kabuğunun birebir aynısıdır (worklog/layout.tsx):
    // önizlemenin işe yaraması için sıkıştırılmış başlık düzeni de burada
    // görülebilmeli.
    // Kenar boşluğu da kabuğun gerçek değerlerini izler (`app-shell.tsx`
    // `main`): sabit `px-6` dar ekranda gerçekte olmayan 12px'lik bir pay
    // ekliyor ve önizlemeyi olduğundan geniş gösteriyordu.
    <div className="mx-auto grid max-w-[1500px] gap-3 px-3 py-4 sm:px-4 sm:py-6 lg:px-8">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
        <h1 className="text-xl font-semibold tracking-tight">İş Takibi</h1>
        <p className="hidden min-w-0 flex-1 truncate text-sm text-muted-foreground sm:block">
          Atölyede hangi gün hangi işe kaç kişi çalıştı — adam·saat kaydı ve analizi
        </p>
      </div>
      <WorkLogNav />

      <Section title="Günlük Giriş">
        <DayEntry
          date={today}
          rows={dayRows}
          previous={{ date: prevDate, rows: ROWS.filter((r) => r.date === prevDate) }}
          parts={PARTS}
          categories={CATEGORIES}
          jobs={JOBS}
          recent={RECENT}
          codeHints={{}}
          dailyTotals={dailyTotals}
        />
      </Section>

      <Section title="Analiz">
        <AnalysisView
          rows={ROWS}
          bounds={{ first: ROWS[0].date, last: ROWS[ROWS.length - 1].date }}
        />
      </Section>

      <Section title="Kayıtlar">
        <RecordsTable rows={ROWS} parts={PARTS} categories={CATEGORIES} jobs={JOBS} />
      </Section>
    </div>
  );
}
