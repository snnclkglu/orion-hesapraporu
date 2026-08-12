// Finans'ın OKUMA katmanı — ekran, Excel ucu ve bordro PDF'i AYNI yerden okur.
//
// Sorgu iki yerde yazılsaydı ekrandaki tablo ile indirilen dosya sessizce
// ayrışırdı; İş Takibi'nde bir kez yaşandı (`worklog/filters.ts` başlığı).
//
// Yükleyiciler client'ı KENDİLERİ kurmaz, `supabase` parametresi alır: aynı
// fonksiyonun hem sayfadan hem route handler'dan çağrılabilmesinin ön şartı
// budur.

import type { SupabaseClient } from "@supabase/supabase-js";
import { hizmetGunu } from "@/lib/finance/payroll";
import { expiryState } from "@/lib/finance/personnel";
import type {
  DocumentRow,
  EmployeeRow,
  EmploymentRow,
  FxMonthlyRow,
  PayrollRow,
  PerDiemRow,
  PeriodRow,
} from "./schema";

/** PostgREST `max_rows` bu projede 1000'dir ve `.limit()` onu AŞAMAZ. */
const PAGE = 1000;

/** numeric sütunlar PostgREST'ten METİN gelebilir. */
function num(v: number | string | null | undefined): number {
  if (v === null || v === undefined || v === "") return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function numOrNull(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function str(v: string | null | undefined): string {
  return v ?? "";
}

/**
 * Sayfalayarak okur. Tek `select` ile 1000 satırda sessizce kesilmek bu
 * projede birden çok kez yaşandı; maaş tablosu bugün 566 satır ama yılda
 * ~300 satır büyüyor ve üç yıl sonra sınırı geçecek.
 */
async function tumSatirlar<T>(
  sorgu: (bas: number, son: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const out: T[] = [];
  for (let sayfa = 0; sayfa < 40; sayfa++) {
    const { data, error } = await sorgu(sayfa * PAGE, sayfa * PAGE + PAGE - 1);
    if (error) throw new Error(error.message);
    const dilim = data ?? [];
    out.push(...dilim);
    if (dilim.length < PAGE) break;
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════ personel

// TEK PARÇA ŞABLON DİZGİSİ: birleştirilmiş bir select metninde Supabase tip
// çıkarımı çalışmaz ve satırlar `GenericStringError` olur.
const EMPLOYEE_SELECT = `id, full_name, employee_no, category, title, department,
national_id, birth_date, birth_place, gender, marital_status, child_count, blood_type,
education, military_status, disability_degree, phone, email, address, city,
emergency_contact, emergency_phone, contract_type, work_mode, sgk_no, annual_leave_days,
bank_name, iban, notes`;

interface EmployeeDb {
  id: string;
  full_name: string;
  employee_no: string | null;
  category: string | null;
  title: string | null;
  department: string | null;
  national_id: string | null;
  birth_date: string | null;
  birth_place: string | null;
  gender: string | null;
  marital_status: string | null;
  child_count: number | string | null;
  blood_type: string | null;
  education: string | null;
  military_status: string | null;
  disability_degree: number | string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  emergency_contact: string | null;
  emergency_phone: string | null;
  contract_type: string | null;
  work_mode: string | null;
  sgk_no: string | null;
  annual_leave_days: number | string | null;
  bank_name: string | null;
  iban: string | null;
  notes: string | null;
}

interface EmploymentDb {
  id: string;
  employee_id: string;
  start_date: string;
  end_date: string | null;
  exit_reason: string | null;
  note: string | null;
}

/**
 * Personel listesi — künye + çalışma dönemleri + süresi dolan belge sayacı.
 *
 * ÇALIŞMA DÖNEMİ AYRI SORGUDUR, gömülü (embed) DEĞİL: gömülü liste PostgREST
 * tarafında sessizce kırpılabilir ve bir kişinin İKİNCİ dönemi kaybolursa
 * kıdem yanlış çıkar (`loadSiparisler`de aynı ders).
 */
export async function loadEmployees(
  supabase: SupabaseClient,
  bugun: string
): Promise<EmployeeRow[]> {
  const [kisiler, donemler, belgeler] = await Promise.all([
    tumSatirlar<EmployeeDb>((bas, son) =>
      supabase.from("fin_employees").select(EMPLOYEE_SELECT).order("full_name").range(bas, son)
    ),
    tumSatirlar<EmploymentDb>((bas, son) =>
      supabase
        .from("fin_employment")
        .select("id, employee_id, start_date, end_date, exit_reason, note")
        .order("start_date", { ascending: false })
        .range(bas, son)
    ),
    tumSatirlar<{ employee_id: string; expires_on: string | null }>((bas, son) =>
      supabase
        .from("fin_employee_documents")
        .select("employee_id, expires_on")
        .not("expires_on", "is", null)
        .range(bas, son)
    ),
  ]);

  const donemHarita = new Map<string, EmploymentRow[]>();
  for (const d of donemler) {
    const liste = donemHarita.get(d.employee_id) ?? [];
    liste.push({
      id: d.id,
      startDate: d.start_date,
      endDate: d.end_date,
      exitReason: d.exit_reason,
      note: str(d.note),
    });
    donemHarita.set(d.employee_id, liste);
  }

  // "Süresi dolan belge" SAYACI: uyarı ve geçmiş BİRLİKTE sayılır — listede
  // tek bir rozet var ve iki durumun ikisi de "bak" demek.
  const uyariHarita = new Map<string, number>();
  for (const b of belgeler) {
    const durum = expiryState(b.expires_on, bugun);
    if (durum === "gecti" || durum === "yaklasiyor") {
      uyariHarita.set(b.employee_id, (uyariHarita.get(b.employee_id) ?? 0) + 1);
    }
  }

  return kisiler.map((k) => {
    const employment = donemHarita.get(k.id) ?? [];
    const acik = employment.find((e) => !e.endDate) ?? null;
    const sonKapali = employment.find((e) => e.endDate) ?? null;
    return {
      id: k.id,
      fullName: str(k.full_name),
      employeeNo: str(k.employee_no),
      category: str(k.category),
      title: str(k.title),
      department: str(k.department),
      nationalId: k.national_id,
      birthDate: k.birth_date,
      birthPlace: str(k.birth_place),
      gender: k.gender,
      maritalStatus: k.marital_status,
      childCount: num(k.child_count),
      bloodType: str(k.blood_type),
      education: k.education,
      militaryStatus: str(k.military_status),
      disabilityDegree: numOrNull(k.disability_degree),
      phone: str(k.phone),
      email: str(k.email),
      address: str(k.address),
      city: str(k.city),
      emergencyContact: str(k.emergency_contact),
      emergencyPhone: str(k.emergency_phone),
      contractType: str(k.contract_type) || "belirsiz",
      workMode: str(k.work_mode) || "tam",
      sgkNo: str(k.sgk_no),
      annualLeaveDays: num(k.annual_leave_days),
      bankName: str(k.bank_name),
      iban: str(k.iban),
      notes: str(k.notes),
      employment,
      currentStart: acik?.startDate ?? sonKapali?.startDate ?? null,
      lastEnd: acik ? null : (sonKapali?.endDate ?? null),
      active: Boolean(acik),
      // KIDEM BÜTÜN DÖNEMLERİN TOPLAMIDIR: aynı kişi iki kez çalıştıysa
      // (devralınan kayıtta bir örnek var) yalnız son dönemi saymak kıdemi
      // olduğundan kısa gösterirdi.
      serviceDays: employment.reduce(
        (t, e) => t + hizmetGunu(e.startDate, e.endDate, bugun),
        0
      ),
      expiringDocs: uyariHarita.get(k.id) ?? 0,
    };
  });
}

export async function loadEmployee(
  supabase: SupabaseClient,
  id: string,
  bugun: string
): Promise<EmployeeRow | null> {
  // TEK KİŞİ İÇİN DE LİSTE YÜKLEYİCİSİ: ikinci bir eşleme yazmak, dönem ve
  // belge sayacı mantığını ikizler ve ikisi zamanla ayrışır. 46 satırlık bir
  // tabloda maliyeti yok.
  const hepsi = await loadEmployees(supabase, bugun);
  return hepsi.find((e) => e.id === id) ?? null;
}

// ═══════════════════════════════════════════════════════════════════ maaş

const PAYROLL_SELECT = `id, employee_id, period, net_salary, overtime_hours_50,
overtime_hours_100, overtime_amount, gross_salary, sgk_employee, sgk_employer,
unemployment_employee, income_tax, stamp_tax, bonus, per_diem, advance, deduction,
paid_on, note`;

interface PayrollDb {
  id: string;
  employee_id: string;
  period: string;
  net_salary: number | string | null;
  overtime_hours_50: number | string | null;
  overtime_hours_100: number | string | null;
  overtime_amount: number | string | null;
  gross_salary: number | string | null;
  sgk_employee: number | string | null;
  sgk_employer: number | string | null;
  unemployment_employee: number | string | null;
  income_tax: number | string | null;
  stamp_tax: number | string | null;
  bonus: number | string | null;
  per_diem: number | string | null;
  advance: number | string | null;
  deduction: number | string | null;
  paid_on: string | null;
  note: string | null;
}

function toPayroll(p: PayrollDb): PayrollRow {
  return {
    id: p.id,
    employeeId: p.employee_id,
    period: p.period.slice(0, 7),
    netSalary: num(p.net_salary),
    overtimeHours50: num(p.overtime_hours_50),
    overtimeHours100: num(p.overtime_hours_100),
    overtimeAmount: num(p.overtime_amount),
    grossSalary: numOrNull(p.gross_salary),
    sgkEmployee: numOrNull(p.sgk_employee),
    sgkEmployer: numOrNull(p.sgk_employer),
    unemploymentEmployee: numOrNull(p.unemployment_employee),
    incomeTax: numOrNull(p.income_tax),
    stampTax: numOrNull(p.stamp_tax),
    bonus: num(p.bonus),
    perDiem: num(p.per_diem),
    advance: num(p.advance),
    deduction: num(p.deduction),
    paidOn: p.paid_on,
    note: str(p.note),
  };
}

/** Bütün maaş satırları (özet ekranı ve Excel ucu bunu okur). */
export async function loadPayroll(
  supabase: SupabaseClient,
  opts: { period?: string; employeeId?: string } = {}
): Promise<PayrollRow[]> {
  const rows = await tumSatirlar<PayrollDb>((bas, son) => {
    let q = supabase.from("fin_payroll").select(PAYROLL_SELECT);
    if (opts.period) q = q.eq("period", `${opts.period.slice(0, 7)}-01`);
    if (opts.employeeId) q = q.eq("employee_id", opts.employeeId);
    return q.order("period", { ascending: false }).range(bas, son);
  });
  return rows.map(toPayroll);
}

// ═══════════════════════════════════════════════════════════════════ dönem

interface PeriodDb {
  period: string;
  eur_try_rate: number | string | null;
  usd_try_rate: number | string | null;
  leave_hours: number | string | null;
  report_hours: number | string | null;
  closed: boolean | null;
  note: string | null;
}

export async function loadPeriods(supabase: SupabaseClient): Promise<PeriodRow[]> {
  const rows = await tumSatirlar<PeriodDb>((bas, son) =>
    supabase
      .from("fin_periods")
      .select("period, eur_try_rate, usd_try_rate, leave_hours, report_hours, closed, note")
      .order("period", { ascending: false })
      .range(bas, son)
  );
  return rows.map((p) => ({
    period: p.period.slice(0, 7),
    eurTryRate: numOrNull(p.eur_try_rate),
    usdTryRate: numOrNull(p.usd_try_rate),
    leaveHours: num(p.leave_hours),
    reportHours: num(p.report_hours),
    closed: Boolean(p.closed),
    note: str(p.note),
  }));
}

// ══════════════════════════════════════════════════════════════════ belge

interface DocumentDb {
  id: string;
  employee_id: string;
  kind: string | null;
  title: string | null;
  file_name: string | null;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | string | null;
  page_count: number | string | null;
  issued_on: string | null;
  expires_on: string | null;
  notes: string | null;
  created_at: string;
}

export async function loadDocuments(
  supabase: SupabaseClient,
  employeeId?: string
): Promise<DocumentRow[]> {
  const rows = await tumSatirlar<DocumentDb>((bas, son) => {
    let q = supabase
      .from("fin_employee_documents")
      .select(
        "id, employee_id, kind, title, file_name, storage_path, mime_type, size_bytes, page_count, issued_on, expires_on, notes, created_at"
      );
    if (employeeId) q = q.eq("employee_id", employeeId);
    return q.order("created_at", { ascending: false }).range(bas, son);
  });
  return rows.map((d) => ({
    id: d.id,
    employeeId: d.employee_id,
    kind: str(d.kind) || "diger",
    title: str(d.title),
    fileName: str(d.file_name),
    storagePath: d.storage_path,
    mimeType: str(d.mime_type),
    sizeBytes: num(d.size_bytes),
    pageCount: num(d.page_count),
    issuedOn: d.issued_on,
    expiresOn: d.expires_on,
    notes: str(d.notes),
    createdAt: d.created_at,
  }));
}

// ═══════════════════════════════════════════════════════════════ harcirah

export async function loadPerDiem(supabase: SupabaseClient): Promise<PerDiemRow[]> {
  const rows = await tumSatirlar<{
    id: string;
    valid_from: string;
    period_label: string | null;
    role_label: string;
    daily_try: number | string | null;
    sort: number | string | null;
    note: string | null;
  }>((bas, son) =>
    supabase
      .from("fin_per_diem")
      .select("id, valid_from, period_label, role_label, daily_try, sort, note")
      .order("valid_from", { ascending: false })
      .order("sort")
      .range(bas, son)
  );
  return rows.map((p) => ({
    id: p.id,
    validFrom: p.valid_from,
    periodLabel: str(p.period_label),
    roleLabel: p.role_label,
    dailyTry: num(p.daily_try),
    sort: num(p.sort),
    note: str(p.note),
  }));
}

// ═════════════════════════════════════════════════════════════════ kurlar

export async function loadFxMonthly(supabase: SupabaseClient): Promise<FxMonthlyRow[]> {
  const rows = await tumSatirlar<{
    period: string;
    eur_try: number | string | null;
    usd_try: number | string | null;
    eur_usd: number | string | null;
    usd_eur: number | string | null;
    day_count: number | string | null;
    first_day: string;
    last_day: string;
    sources: string[] | null;
  }>((bas, son) =>
    supabase
      .from("fin_fx_monthly")
      .select("period, eur_try, usd_try, eur_usd, usd_eur, day_count, first_day, last_day, sources")
      .order("period", { ascending: false })
      .range(bas, son)
  );
  return rows.map((r) => ({
    period: r.period.slice(0, 7),
    eurTry: num(r.eur_try),
    usdTry: num(r.usd_try),
    eurUsd: num(r.eur_usd),
    usdEur: num(r.usd_eur),
    dayCount: num(r.day_count),
    firstDay: r.first_day,
    lastDay: r.last_day,
    sources: r.sources ?? [],
  }));
}

/** Depodaki en son gün — "ne kadar güncel" sorusunun tek cevabı. */
export async function loadFxLastDay(supabase: SupabaseClient): Promise<string | null> {
  const { data, error } = await supabase
    .from("fin_fx_daily")
    .select("rate_date")
    .order("rate_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as { rate_date: string } | null)?.rate_date ?? null;
}

/** Son N günün gözlemi — kur ekranındaki günlük grafik. */
export async function loadFxDaily(
  supabase: SupabaseClient,
  from: string
): Promise<
  { date: string; source: string; usdTry: number; eurTry: number }[]
> {
  const rows = await tumSatirlar<{
    rate_date: string;
    source: string;
    usd_try: number | string;
    eur_try: number | string;
  }>((bas, son) =>
    supabase
      .from("fin_fx_daily")
      .select("rate_date, source, usd_try, eur_try")
      .gte("rate_date", from)
      .order("rate_date")
      .range(bas, son)
  );
  return rows.map((r) => ({
    date: r.rate_date,
    source: r.source,
    usdTry: num(r.usd_try),
    eurTry: num(r.eur_try),
  }));
}
