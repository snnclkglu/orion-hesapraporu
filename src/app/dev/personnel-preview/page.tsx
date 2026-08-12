// Sadece development: Personel ekranlarını auth OLMADAN görsel test etmek için.
// Production'da 404 döner. (worklog-preview / sales-preview ile aynı desen.)
//
// Veriler SAHTEDİR ve veritabanına dokunmaz; kaydetme/silme sunucu eylemleri
// sahte kimliklerle hata döner. Amaç yalnız yerleşim, tablo sütun önceliği,
// grafiklerin okunurluğu ve toplamların gözle doğrulanmasıdır.
//
// FİKSTÜR GERÇEK KAYITTAN TÜRETİLMİŞTİR (devralınan Excel): kişiler, maaşlar ve
// kurlar gerçek büyüklüklerdedir. Uydurma küçük sayılarla bakmak, 71.000 ₺'lik
// bir maaşın ve 48.753,33 ₺'lik bir mesai tutarının sütuna sığıp sığmadığını
// göstermezdi.

import { notFound } from "next/navigation";
import { PersonnelNav } from "@/app/(app)/personnel/personnel-nav";
import { PersonnelTable } from "@/app/(app)/personnel/personnel-table";
import { PayrollBoard } from "@/app/(app)/personnel/maas/payroll-board";
import { SummaryView } from "@/app/(app)/personnel/ozet/summary-view";
import { FxView } from "@/app/(app)/personnel/kurlar/fx-view";
import { PerDiemTable } from "@/app/(app)/personnel/harcirah/per-diem-table";
import { EmployeeProfile } from "@/app/(app)/personnel/[id]/employee-profile";
import type {
  DocumentRow,
  EmployeeRow,
  FxMonthlyRow,
  PayrollRow,
  PerDiemRow,
  PeriodRow,
} from "@/app/(app)/personnel/schema";
import { fazlaMesaiTutari } from "@/lib/personnel/payroll";

const BUGUN = "2026-08-12";

function kisi(
  id: string,
  fullName: string,
  category: string,
  title: string,
  start: string,
  end: string | null,
  ek: Partial<EmployeeRow> = {}
): EmployeeRow {
  const gun = (a: string, b: string) =>
    Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
  return {
    id,
    fullName,
    employeeNo: "",
    category,
    title,
    department: "",
    nationalId: "10000000000",
    birthDate: "1985-06-30",
    birthPlace: "",
    gender: null,
    maritalStatus: null,
    childCount: 0,
    bloodType: "",
    education: null,
    militaryStatus: "",
    disabilityDegree: null,
    phone: "0500 000 00 00",
    email: "",
    address: "",
    city: "",
    emergencyContact: "",
    emergencyPhone: "",
    contractType: "belirsiz",
    workMode: "tam",
    sgkNo: "",
    annualLeaveDays: 14,
    bankName: "",
    iban: "",
    notes: "",
    employment: [
      { id: `${id}-e1`, startDate: start, endDate: end, exitReason: end ? "istifa" : null, note: "" },
    ],
    currentStart: start,
    lastEnd: end,
    active: !end,
    serviceDays: gun(start, end ?? BUGUN),
    expiringDocs: 0,
    ...ek,
  };
}

const EMPLOYEES: EmployeeRow[] = [
  kisi("e1", "SALİH ERGÜVEN", "01 - ÜST YÖNETİM", "GENEL MÜDÜR", "2024-01-24", null),
  kisi("e2", "BARIŞ YEŞİLBAŞ", "01 - ÜST YÖNETİM", "FİNANS MÜDÜRÜ", "2024-01-24", null),
  kisi("e3", "AKİF ERGÜVEN", "02 - ALT YÖNETİM", "ÜRETİM PLANLAMA", "2024-01-24", null),
  kisi("e4", "ORHAN KILIÇ", "03 - PERSONEL", "USTA - KAYNAKÇI", "2025-05-07", "2026-05-31", {
    expiringDocs: 2,
  }),
  kisi("e5", "SEMİH CAN", "03 - PERSONEL", "USTA - İMALAT", "2024-06-01", null, {
    expiringDocs: 1,
  }),
  kisi("e6", "TUNCAY ÇELİKER", "03 - PERSONEL", "TEKNİK RESSAM", "2024-06-24", null),
  kisi("e7", "GÖNÜL KIYAK", "03 - PERSONEL", "YEMEKHANE", "2025-08-29", null),
  // TC'si olmayan personel — listede sessiz işaret çıkmalı.
  kisi("e8", "ALİ (SURİYE)", "03 - PERSONEL", "YARDIMCI - İMALAT", "2024-11-25", "2025-04-08", {
    nationalId: null,
  }),
  // İKİ DÖNEMİ olan kişi — kıdem dönemlerin TOPLAMI olmalı.
  {
    ...kisi("e9", "FURKAN AYTEKİN", "03 - PERSONEL", "YARDIMCI - İMALAT", "2026-03-09", "2026-06-18"),
    employment: [
      { id: "e9-e2", startDate: "2026-03-09", endDate: "2026-06-18", exitReason: "istifa", note: "" },
      { id: "e9-e1", startDate: "2025-01-03", endDate: "2025-04-16", exitReason: "istifa", note: "" },
    ],
    serviceDays: 101 + 103,
  },
];

/** Maaş satırı — mesai tutarı ÇEKİRDEKTEN hesaplanır, elle yazılmaz. */
function maas(
  employeeId: string,
  period: string,
  netSalary: number,
  h50 = 0,
  h100 = 0
): PayrollRow {
  return {
    id: `${employeeId}-${period}`,
    employeeId,
    period,
    netSalary,
    overtimeHours50: h50,
    overtimeHours100: h100,
    overtimeAmount: Math.round(fazlaMesaiTutari(netSalary, h50, h100) * 100) / 100,
    grossSalary: null,
    sgkEmployee: null,
    sgkEmployer: null,
    unemploymentEmployee: null,
    incomeTax: null,
    stampTax: null,
    bonus: 0,
    perDiem: 0,
    advance: 0,
    deduction: 0,
    paidOn: null,
    note: "",
    workedDays: 30,
    cumulativeTaxBase: null,
    paramsValidFrom: null,
  };
}

const AYLAR = ["2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08"];

const PAYROLL: PayrollRow[] = AYLAR.flatMap((ay, i) => [
  maas("e1", ay, 180000 + i * 5000),
  maas("e2", ay, 150000 + i * 4000),
  maas("e3", ay, 95000 + i * 3000),
  maas("e5", ay, 85000 + i * 2000, [12, 40, 103, 16, 24, 8][i]),
  maas("e6", ay, 87000 + i * 2000, [0, 8, 16, 0, 4, 0][i]),
  // GÖNÜL KIYAK son ayda YOK: çalışıyor ama maaşı girilmemiş — Maaş
  // ekranındaki "girilmemiş" bandı bu satırla sınanır.
  ...(i < AYLAR.length - 1 ? [maas("e7", ay, 33000 + i * 1000, 0, [0, 0, 8, 0, 0, 4][i])] : []),
  // ORHAN KILIÇ yalnız ilk üç ayda: Maaş ekranında "girilmemiş" bandını
  // görebilmek için son aylarda satırı YOK.
  ...(i < 3 ? [maas("e4", ay, 71000 + i * 4000, [45, 103, 22.5][i])] : []),
]);

const FX_MONTHLY: FxMonthlyRow[] = [
  { period: "2026-08", eurTry: 54.8231, usdTry: 47.5303, eurUsd: 1.153433, usdEur: 0.866978, dayCount: 7, firstDay: "2026-08-03", lastDay: "2026-08-11", sources: ["TCMB"] },
  { period: "2026-07", eurTry: 53.6663, usdTry: 46.9845, eurUsd: 1.142213, usdEur: 0.875499, dayCount: 22, firstDay: "2026-07-01", lastDay: "2026-07-31", sources: ["TCMB"] },
  { period: "2026-06", eurTry: 53.1911, usdTry: 46.1782, eurUsd: 1.151908, usdEur: 0.868189, dayCount: 22, firstDay: "2026-06-01", lastDay: "2026-06-30", sources: ["TCMB", "ECB"] },
  { period: "2026-05", eurTry: 52.9992, usdTry: 45.3381, eurUsd: 1.168995, usdEur: 0.855460, dayCount: 15, firstDay: "2026-05-02", lastDay: "2026-05-30", sources: ["TCMB"] },
  { period: "2026-04", eurTry: 52.2236, usdTry: 44.6770, eurUsd: 1.169077, usdEur: 0.855377, dayCount: 21, firstDay: "2026-04-01", lastDay: "2026-04-30", sources: ["TCMB"] },
  { period: "2026-03", eurTry: 50.9883, usdTry: 44.1006, eurUsd: 1.156183, usdEur: 0.864916, dayCount: 20, firstDay: "2026-03-02", lastDay: "2026-03-31", sources: ["TCMB"] },
];

const PERIODS: PeriodRow[] = [
  // 2026-08 KURSUZ bırakıldı: ekran ortalamayı ÖNERMELİ, tablo "kur yok" demeli.
  { period: "2026-08", eurTryRate: null, usdTryRate: null, leaveHours: 0, reportHours: 0, closed: false, note: "" },
  { period: "2026-07", eurTryRate: 54.8736, usdTryRate: null, leaveHours: 149.5, reportHours: 7.5, closed: false, note: "" },
  { period: "2026-06", eurTryRate: 53.6159, usdTryRate: null, leaveHours: 120, reportHours: 0, closed: false, note: "" },
  { period: "2026-05", eurTryRate: 53.4381, usdTryRate: null, leaveHours: 79, reportHours: 52.5, closed: false, note: "" },
  { period: "2026-04", eurTryRate: 53.1928, usdTryRate: null, leaveHours: 128.5, reportHours: 15, closed: false, note: "" },
  { period: "2026-03", eurTryRate: 52.7894, usdTryRate: null, leaveHours: 216.5, reportHours: 0, closed: true, note: "" },
];

const FX_DAILY = [
  { date: "2026-08-03", source: "TCMB", usdTry: 47.42, eurTry: 54.61 },
  { date: "2026-08-04", source: "TCMB", usdTry: 47.46, eurTry: 54.72 },
  { date: "2026-08-05", source: "TCMB", usdTry: 47.51, eurTry: 54.80 },
  { date: "2026-08-06", source: "TCMB", usdTry: 47.55, eurTry: 54.88 },
  { date: "2026-08-07", source: "TCMB", usdTry: 47.58, eurTry: 54.91 },
  { date: "2026-08-10", source: "TCMB", usdTry: 47.62, eurTry: 54.95 },
  { date: "2026-08-11", source: "TCMB", usdTry: 47.6505, eurTry: 54.9693 },
];

const PER_DIEM: PerDiemRow[] = [
  { id: "h1", validFrom: "2026-01-01", periodLabel: "2026", roleLabel: "Şantiye Formeni", dailyTry: 1300, sort: 10, note: "" },
  { id: "h2", validFrom: "2026-01-01", periodLabel: "2026", roleLabel: "Usta, Kaynakçı", dailyTry: 1200, sort: 20, note: "" },
  { id: "h3", validFrom: "2026-01-01", periodLabel: "2026", roleLabel: "Diğer Tüm Personeller", dailyTry: 1000, sort: 30, note: "" },
  { id: "h4", validFrom: "2025-07-01", periodLabel: "2025/2.DÖNEM", roleLabel: "Şantiye Formeni", dailyTry: 650, sort: 10, note: "" },
  { id: "h5", validFrom: "2025-07-01", periodLabel: "2025/2.DÖNEM", roleLabel: "Diğer Tüm Personeller", dailyTry: 600, sort: 20, note: "" },
  { id: "h6", validFrom: "2025-01-01", periodLabel: "2025/1.DÖNEM", roleLabel: "Şantiye Formeni ve Ustalar", dailyTry: 500, sort: 10, note: "" },
  { id: "h7", validFrom: "2025-01-01", periodLabel: "2025/1.DÖNEM", roleLabel: "Diğer Personeller", dailyTry: 400, sort: 20, note: "" },
];

const DOCUMENTS: DocumentRow[] = [
  { id: "d1", employeeId: "e4", kind: "sozlesme", title: "Belirsiz Süreli İş Sözleşmesi", fileName: "sozlesme.pdf", storagePath: "e4/d1.pdf", mimeType: "application/pdf", sizeBytes: 384_000, pageCount: 4, issuedOn: "2025-05-07", expiresOn: null, notes: "", createdAt: "2025-05-08T09:00:00Z" },
  { id: "d2", employeeId: "e4", kind: "isg", title: "Çok Tehlikeli Sınıf İSG Eğitimi", fileName: "isg-egitim.pdf", storagePath: "e4/d2.pdf", mimeType: "application/pdf", sizeBytes: 128_000, pageCount: 1, issuedOn: "2025-05-10", expiresOn: "2026-05-10", notes: "", createdAt: "2025-05-10T09:00:00Z" },
  { id: "d3", employeeId: "e4", kind: "saglik", title: "Periyodik Sağlık Muayenesi", fileName: "saglik-raporu.pdf", storagePath: "e4/d3.pdf", mimeType: "application/pdf", sizeBytes: 96_000, pageCount: 2, issuedOn: "2025-09-01", expiresOn: "2026-09-01", notes: "", createdAt: "2025-09-01T09:00:00Z" },
  { id: "d4", employeeId: "e4", kind: "sertifika", title: "Kaynakçı Yeterlilik Belgesi", fileName: "kaynakci.jpg", storagePath: "e4/d4.jpg", mimeType: "image/jpeg", sizeBytes: 1_240_000, pageCount: 0, issuedOn: "2024-03-01", expiresOn: "2027-03-01", notes: "", createdAt: "2025-05-12T09:00:00Z" },
];

function Bolum({ baslik, aciklama, children }: { baslik: string; aciklama: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-3">
      <div className="border-l-[3px] border-l-primary pl-3">
        <h2 className="text-lg font-semibold">{baslik}</h2>
        <p className="text-sm text-muted-foreground">{aciklama}</p>
      </div>
      {children}
    </section>
  );
}

export default function PersonnelPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();

  return (
    <div className="mx-auto grid max-w-none gap-10 p-4 lg:p-8">
      <header className="grid gap-1">
        <span className="oc-kicker text-muted-foreground">Geliştirme Önizlemesi</span>
        <h1 className="text-2xl font-semibold">Personel — Ekran Önizlemesi</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Veriler sahtedir ve veritabanına dokunmaz; kaydetme eylemleri hata döner. Bu sayfa
          yalnız yerleşim, sütun önceliği, grafik okunurluğu ve toplamların gözle
          doğrulanması içindir. Production&apos;da 404 döner.
        </p>
      </header>

      <PersonnelNav />

      <Bolum
        baslik="Personel Listesi"
        aciklama="Ayrılanlar ayrı ekranda değil aynı listede; TC'si olmayan ve iki dönemi olan kişiler fikstürde var."
      >
        <PersonnelTable
          employees={EMPLOYEES}
          bugun={BUGUN}
          durum="tumu"
          kategori=""
          ara=""
          canWrite
        />
      </Bolum>

      <Bolum
        baslik="Personel Profili"
        aciklama="Künye, çalışma dönemleri (iki dönem), maaş geçmişi ve özlük dosyaları — biri süresi geçmiş."
      >
        <EmployeeProfile
          employee={EMPLOYEES[3]}
          payroll={PAYROLL.filter((p) => p.employeeId === "e4")}
          documents={DOCUMENTS}
          periods={PERIODS}
          bugun={BUGUN}
          canWrite
        />
      </Bolum>

      <Bolum
        baslik="Aylık Maaş"
        aciklama="Ağustos 2026 kuru GİRİLMEMİŞ: dönem şeridi ortalamayı önermeli. ORHAN KILIÇ'ın satırı yok — 'maaşı girilmemiş' bandı çıkmalı."
      >
        <PayrollBoard
          ay="2026-08"
          bugunAy="2026-08"
          employees={EMPLOYEES}
          payroll={PAYROLL.filter((p) => p.period === "2026-08")}
          previousPayroll={PAYROLL.filter((p) => p.period === "2026-07")}
          periods={PERIODS}
          fxMonthly={FX_MONTHLY}
          canWrite
        />
      </Bolum>

      <Bolum
        baslik="Özet"
        aciklama="Bütün sayılar maaş satırlarından türetilir. Kuru olmayan ayın avro hücresi boş, satırda 'kur yok' işareti."
      >
        <SummaryView
          employees={EMPLOYEES}
          payroll={PAYROLL}
          periods={PERIODS}
          year={null}
          scope={null}
          canWrite
        />
      </Bolum>

      <Bolum
        baslik="Harcirah"
        aciklama="Tarife bir geçmiştir: güncel dönem açık, eskiler kapalı. Avro karşılığı dönemin ortalama kuruyla."
      >
        <PerDiemTable rows={PER_DIEM} fx={FX_MONTHLY} bugun={BUGUN} canWrite />
      </Bolum>

      <Bolum
        baslik="Kurlar"
        aciklama="Aylık ortalamalar; 2026-08 yalnız 7 yayın gününden çıktığı için 'kısmi' işaretlenmeli. Haziran iki kaynaklı."
      >
        <FxView
          monthly={FX_MONTHLY}
          daily={FX_DAILY}
          periods={PERIODS}
          lastDay="2026-08-11"
          bugun={BUGUN}
          secilenAy={null}
          canWrite
        />
      </Bolum>
    </div>
  );
}
