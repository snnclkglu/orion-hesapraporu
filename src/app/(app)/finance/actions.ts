"use server";

// Finans yazma eylemleri.
//
// Yetki İKİ KEZ sorulur: burada anlaşılır bir hata mesajı için, RLS'te asıl
// engel olarak. Menüden gizlemek yalnız görgü kuralıdır.
//
// DENETİM İZİ BURADA ZORUNLUDUR. Uygulamanın her bölümü `audit_log` yazmaz
// (Satın Alma hiç yazmaz) ama ÜCRET DEĞİŞTİREN bir kayıt denetlenebilir
// olmalıdır: "bu ay kimin maaşını kim değiştirdi" sorusunun cevabı bir
// yedekten okunmamalıdır.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { canEditFinance, canSeeFinance } from "@/lib/roles";
import { tazeleKurlar } from "@/lib/finance/fx-refresh";
import {
  employeeSchema,
  employmentSchema,
  payrollSchema,
  perDiemSchema,
  periodSchema,
  type EmployeeInput,
  type EmploymentInput,
  type FinanceActionResult,
  type PayrollInput,
  type PerDiemInput,
  type PeriodInput,
} from "./schema";

function tazele() {
  revalidatePath("/finance");
  revalidatePath("/finance/maas");
  revalidatePath("/finance/ozet");
  revalidatePath("/finance/harcirah");
  revalidatePath("/finance/kurlar");
}

async function requireFinanceWrite() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı" } as const;
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  const role = (profile as { role?: string } | null)?.role;
  if (!canSeeFinance(role) || !canEditFinance(role)) {
    return { error: "Finans bölümüne yalnız Yönetici ve Müdür erişebilir" } as const;
  }
  return { supabase, user } as const;
}

/** Zod hatasını tek mesaja indirger (evin kalıbı). */
function ilkHata(issues: { message: string }[]): string {
  return issues[0]?.message ?? "Geçersiz veri";
}

// ═══════════════════════════════════════════════════════════════ personel

function employeeRow(data: ReturnType<typeof employeeSchema.parse>) {
  return {
    full_name: data.fullName,
    employee_no: data.employeeNo,
    category: data.category,
    title: data.title,
    department: data.department,
    // BOŞ METİN NULL'A ÇEVRİLİR: tekil indeks kısmidir (`where national_id is
    // not null and <> ''`) ama boş metni null yapmak, ileride kısıt
    // sadeleşirse iki boş kaydın çakışmasını da engeller.
    national_id: data.nationalId || null,
    birth_date: data.birthDate,
    birth_place: data.birthPlace,
    gender: data.gender,
    marital_status: data.maritalStatus,
    child_count: data.childCount,
    blood_type: data.bloodType,
    education: data.education,
    military_status: data.militaryStatus,
    disability_degree: data.disabilityDegree,
    phone: data.phone,
    email: data.email,
    address: data.address,
    city: data.city,
    emergency_contact: data.emergencyContact,
    emergency_phone: data.emergencyPhone,
    contract_type: data.contractType,
    work_mode: data.workMode,
    sgk_no: data.sgkNo,
    annual_leave_days: data.annualLeaveDays,
    bank_name: data.bankName,
    iban: data.iban,
    notes: data.notes,
  };
}

/**
 * Personel açar ya da günceller.
 *
 * `startDate` verilirse İLK ÇALIŞMA DÖNEMİ de aynı işlemde açılır: yeni
 * personel penceresinde "işe giriş tarihi" sorulup ayrı bir adımda dönem
 * açtırmak, kullanıcıyı hiçbir şey kazandırmayan iki adıma zorlardı.
 */
export async function saveEmployee(
  id: string | null,
  input: EmployeeInput,
  startDate?: string
): Promise<FinanceActionResult> {
  const ctx = await requireFinanceWrite();
  if ("error" in ctx) return ctx;
  const { supabase, user } = ctx;

  const parsed = employeeSchema.safeParse(input);
  if (!parsed.success) return { error: ilkHata(parsed.error.issues) };
  const row = employeeRow(parsed.data);

  if (id) {
    const { error, count } = await supabase
      .from("fin_employees")
      .update(row, { count: "exact" })
      .eq("id", id);
    // RLS SESSİZ NO-OP ÜRETİR: sayıyı okumak yetkisizliği gerçek hataya çevirir.
    if (error) return { error: temizHata(error.message) };
    if (!count) return { error: "Kayıt güncellenemedi; yetkiniz olmayabilir." };
    await supabase.from("audit_log").insert({
      actor: user.id,
      action: "finance.employee.update",
      detail: { id, full_name: row.full_name },
    });
    tazele();
    revalidatePath(`/finance/${id}`);
    return { ok: true, id };
  }

  const { data, error } = await supabase
    .from("fin_employees")
    .insert({ ...row, created_by: user.id })
    .select("id")
    .maybeSingle();
  if (error) return { error: temizHata(error.message) };
  const yeniId = (data as { id: string } | null)?.id;
  if (!yeniId) return { error: "Personel oluşturuldu ama kimliği okunamadı." };

  if (startDate && /^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
    const { error: dHata } = await supabase
      .from("fin_employment")
      .insert({ employee_id: yeniId, start_date: startDate });
    // Dönem yazılamazsa personel SİLİNMEZ: künye kaydedilmiştir ve tarih
    // profil sayfasından eklenebilir. Kaydı geri almak, kullanıcıyı bütün
    // formu yeniden doldurmaya zorlardı.
    if (dHata) {
      tazele();
      return { ok: true, id: yeniId, error: `Personel kaydedildi, işe giriş tarihi yazılamadı: ${dHata.message}` };
    }
  }

  await supabase.from("audit_log").insert({
    actor: user.id,
    action: "finance.employee.create",
    detail: { id: yeniId, full_name: row.full_name },
  });
  tazele();
  return { ok: true, id: yeniId };
}

/**
 * Personeli SİLER.
 *
 * MAAŞ GEÇMİŞİ OLAN KİŞİ SİLİNMEZ. Silme `on delete cascade` ile maaş
 * satırlarını ve özlük belgelerini birlikte götürürdü; ödenmiş bir ayın kaydı
 * bir tuşla yok olmamalıdır. İşten ayrılan kişi SİLİNMEZ, DÖNEMİ KAPANIR —
 * arşivleme bir işarettir, bir silme değil (Mühendislik listesindeki aynı
 * kural).
 */
export async function deleteEmployee(id: string): Promise<FinanceActionResult> {
  const ctx = await requireFinanceWrite();
  if ("error" in ctx) return ctx;
  const { supabase, user } = ctx;

  const { count: maasSayisi } = await supabase
    .from("fin_payroll")
    .select("id", { count: "exact", head: true })
    .eq("employee_id", id);
  if (maasSayisi && maasSayisi > 0) {
    return {
      error: `Bu personelin ${maasSayisi} maaş kaydı var; silinemez. İşten ayrıldıysa çalışma dönemini kapatın.`,
    };
  }

  // Belgeler: önce TABLO satırı, sonra depo nesnesi ("önce ucuz olanı kaybet").
  const { data: belgeler } = await supabase
    .from("fin_employee_documents")
    .select("storage_path")
    .eq("employee_id", id);

  const { error, count } = await supabase
    .from("fin_employees")
    .delete({ count: "exact" })
    .eq("id", id);
  if (error) return { error: temizHata(error.message) };
  if (!count) return { error: "Kayıt silinemedi; yetkiniz olmayabilir." };

  const yollar = (belgeler ?? []).map((b) => (b as { storage_path: string }).storage_path);
  if (yollar.length > 0) {
    // Yetim nesne GERİ ALINABİLİR bir hatadır; hata yutulur.
    await supabase.storage.from("personnel").remove(yollar);
  }

  await supabase.from("audit_log").insert({
    actor: user.id,
    action: "finance.employee.delete",
    detail: { id, documents: yollar.length },
  });
  tazele();
  return { ok: true };
}

// ————————————————————————————————————————————————————— çalışma dönemleri

export async function saveEmployment(input: EmploymentInput): Promise<FinanceActionResult> {
  const ctx = await requireFinanceWrite();
  if ("error" in ctx) return ctx;
  const { supabase, user } = ctx;

  const parsed = employmentSchema.safeParse(input);
  if (!parsed.success) return { error: ilkHata(parsed.error.issues) };
  const d = parsed.data;
  const row = {
    employee_id: d.employeeId,
    start_date: d.startDate,
    end_date: d.endDate,
    exit_reason: d.exitReason,
    note: d.note,
  };

  if (d.id) {
    const { error, count } = await supabase
      .from("fin_employment")
      .update(row, { count: "exact" })
      .eq("id", d.id);
    if (error) return { error: temizHata(error.message) };
    if (!count) return { error: "Dönem güncellenemedi; yetkiniz olmayabilir." };
  } else {
    const { error } = await supabase.from("fin_employment").insert(row);
    if (error) return { error: temizHata(error.message) };
  }

  await supabase.from("audit_log").insert({
    actor: user.id,
    action: d.id ? "finance.employment.update" : "finance.employment.create",
    detail: { employee_id: d.employeeId, start: d.startDate, end: d.endDate },
  });
  tazele();
  revalidatePath(`/finance/${d.employeeId}`);
  return { ok: true };
}

export async function deleteEmployment(
  id: string,
  employeeId: string
): Promise<FinanceActionResult> {
  const ctx = await requireFinanceWrite();
  if ("error" in ctx) return ctx;
  const { supabase, user } = ctx;
  const { error, count } = await supabase
    .from("fin_employment")
    .delete({ count: "exact" })
    .eq("id", id);
  if (error) return { error: temizHata(error.message) };
  if (!count) return { error: "Dönem silinemedi; yetkiniz olmayabilir." };
  await supabase.from("audit_log").insert({
    actor: user.id,
    action: "finance.employment.delete",
    detail: { id, employee_id: employeeId },
  });
  tazele();
  revalidatePath(`/finance/${employeeId}`);
  return { ok: true };
}

// ═══════════════════════════════════════════════════════════════════ maaş

/**
 * Bir kişinin bir ayki maaşı.
 *
 * `overtime_amount` GÖNDERİLMEZ — türetilmiş sütundur; yazmaya kalkmak
 * Postgres hatası verir ve vermese bile saatlerle çelişen bir tutar üretirdi.
 */
export async function savePayroll(input: PayrollInput): Promise<FinanceActionResult> {
  const ctx = await requireFinanceWrite();
  if ("error" in ctx) return ctx;
  const { supabase, user } = ctx;

  const parsed = payrollSchema.safeParse(input);
  if (!parsed.success) return { error: ilkHata(parsed.error.issues) };
  const d = parsed.data;

  const { error } = await supabase.from("fin_payroll").upsert(
    {
      employee_id: d.employeeId,
      period: d.period,
      net_salary: d.netSalary,
      overtime_hours_50: d.overtimeHours50,
      overtime_hours_100: d.overtimeHours100,
      gross_salary: d.grossSalary,
      sgk_employee: d.sgkEmployee,
      sgk_employer: d.sgkEmployer,
      unemployment_employee: d.unemploymentEmployee,
      income_tax: d.incomeTax,
      stamp_tax: d.stampTax,
      bonus: d.bonus,
      per_diem: d.perDiem,
      advance: d.advance,
      deduction: d.deduction,
      paid_on: d.paidOn,
      note: d.note,
      created_by: user.id,
    },
    { onConflict: "employee_id,period" }
  );
  if (error) return { error: temizHata(error.message) };

  await supabase.from("audit_log").insert({
    actor: user.id,
    action: "finance.payroll.save",
    detail: {
      employee_id: d.employeeId,
      period: d.period,
      net_salary: d.netSalary,
      ot50: d.overtimeHours50,
      ot100: d.overtimeHours100,
    },
  });
  tazele();
  revalidatePath(`/finance/${d.employeeId}`);
  return { ok: true };
}

export async function deletePayroll(
  employeeId: string,
  period: string
): Promise<FinanceActionResult> {
  const ctx = await requireFinanceWrite();
  if ("error" in ctx) return ctx;
  const { supabase, user } = ctx;
  const ay = `${period.slice(0, 7)}-01`;
  const { error, count } = await supabase
    .from("fin_payroll")
    .delete({ count: "exact" })
    .eq("employee_id", employeeId)
    .eq("period", ay);
  if (error) return { error: temizHata(error.message) };
  if (!count) return { error: "Maaş kaydı silinemedi; yetkiniz olmayabilir." };
  await supabase.from("audit_log").insert({
    actor: user.id,
    action: "finance.payroll.delete",
    detail: { employee_id: employeeId, period: ay },
  });
  tazele();
  revalidatePath(`/finance/${employeeId}`);
  return { ok: true };
}

// ═══════════════════════════════════════════════════════════════════ dönem

export async function savePeriod(input: PeriodInput): Promise<FinanceActionResult> {
  const ctx = await requireFinanceWrite();
  if ("error" in ctx) return ctx;
  const { supabase, user } = ctx;

  const parsed = periodSchema.safeParse(input);
  if (!parsed.success) return { error: ilkHata(parsed.error.issues) };
  const d = parsed.data;

  const { error } = await supabase.from("fin_periods").upsert(
    {
      period: d.period,
      eur_try_rate: d.eurTryRate,
      usd_try_rate: d.usdTryRate,
      leave_hours: d.leaveHours,
      report_hours: d.reportHours,
      closed: d.closed,
      note: d.note,
    },
    { onConflict: "period" }
  );
  if (error) return { error: temizHata(error.message) };

  await supabase.from("audit_log").insert({
    actor: user.id,
    action: "finance.period.save",
    detail: { period: d.period, eur_try_rate: d.eurTryRate, closed: d.closed },
  });
  tazele();
  return { ok: true };
}

// ═══════════════════════════════════════════════════════════════ harcirah

export async function savePerDiem(input: PerDiemInput): Promise<FinanceActionResult> {
  const ctx = await requireFinanceWrite();
  if ("error" in ctx) return ctx;
  const { supabase } = ctx;

  const parsed = perDiemSchema.safeParse(input);
  if (!parsed.success) return { error: ilkHata(parsed.error.issues) };
  const d = parsed.data;
  const row = {
    valid_from: d.validFrom,
    period_label: d.periodLabel,
    role_label: d.roleLabel,
    daily_try: d.dailyTry,
    sort: d.sort,
    note: d.note,
  };

  if (d.id) {
    const { error, count } = await supabase
      .from("fin_per_diem")
      .update(row, { count: "exact" })
      .eq("id", d.id);
    if (error) return { error: temizHata(error.message) };
    if (!count) return { error: "Tarife güncellenemedi; yetkiniz olmayabilir." };
  } else {
    const { error } = await supabase.from("fin_per_diem").insert(row);
    if (error) return { error: temizHata(error.message) };
  }
  revalidatePath("/finance/harcirah");
  return { ok: true };
}

export async function deletePerDiem(id: string): Promise<FinanceActionResult> {
  const ctx = await requireFinanceWrite();
  if ("error" in ctx) return ctx;
  const { error, count } = await ctx.supabase
    .from("fin_per_diem")
    .delete({ count: "exact" })
    .eq("id", id);
  if (error) return { error: temizHata(error.message) };
  if (!count) return { error: "Tarife silinemedi; yetkiniz olmayabilir." };
  revalidatePath("/finance/harcirah");
  return { ok: true };
}

// ═══════════════════════════════════════════════════════════════════ kur

export interface FxRefreshResult {
  error?: string;
  /** Yeni yazılan gün sayısı. */
  eklenen?: number;
  /** Bülten yayımlanmayan gün (resmî tatil) — EKSİK DEĞİLDİR. */
  yayinYok?: number;
  /** TCMB'ye ulaşılamayıp ECB'den tamamlanan gün. */
  yedek?: number;
  /** Gerçekten çekilemeyen günler. */
  hatalar?: string[];
  /** Pencere kelepçesi yüzünden bu turda getirilemeyen son gün. */
  kalanVar?: boolean;
  sonGun?: string | null;
}

/**
 * Kurları BUGÜNE GETİRİR.
 *
 * "Her ay otomatik yenilensin" isteğinin çekirdeği. İki yerden çağrılır:
 * kullanıcı Kurlar ekranındaki düğmeye bastığında ve Vercel Cron
 * (`/api/cron/fx`) ayda bir tetiklediğinde. Kullanıcı yolu HİÇBİR AYAR
 * GEREKTİRMEZ — cron kurulmasa bile bölüm açıldıkça veri tazelenir.
 *
 * Pencere `eksikGunAraligi` ile 62 günle kelepçelidir: uygulama aylarca
 * açılmazsa tek istekte yüzlerce gün çekmeye kalkmak zaman aşımına düşerdi.
 * Kalan varsa `kalanVar` ile söylenir ve kullanıcı yeniden basar.
 */
export async function refreshFxRates(): Promise<FxRefreshResult> {
  const ctx = await requireFinanceWrite();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, user } = ctx;

  const bugun = new Date().toISOString().slice(0, 10);
  const sonuc = await tazeleKurlar(supabase, bugun);
  if (sonuc.error) return { error: temizHata(sonuc.error) };

  if (sonuc.aralik) {
    await supabase.from("audit_log").insert({
      actor: user.id,
      action: "finance.fx.refresh",
      detail: {
        from: sonuc.aralik.from,
        to: sonuc.aralik.to,
        eklenen: sonuc.eklenen,
        yayin_yok: sonuc.yayinYok,
        yedek: sonuc.yedek,
        hata: sonuc.hatalar.length,
      },
    });
  }

  revalidatePath("/finance/kurlar");
  revalidatePath("/finance/maas");
  return {
    eklenen: sonuc.eklenen,
    yayinYok: sonuc.yayinYok,
    yedek: sonuc.yedek,
    hatalar: sonuc.hatalar,
    kalanVar: sonuc.kalanVar,
    sonGun: sonuc.sonGun,
  };
}

// ————————————————————————————————————————————————————————————————— yardım

/**
 * Veritabanı hatasını kullanıcının anlayacağı cümleye çevirir.
 *
 * Kısıt adları ekrana çıkmamalı: "duplicate key value violates unique
 * constraint fin_employees_national_id_key" bir kullanıcı mesajı değildir.
 */
function temizHata(mesaj: string): string {
  if (mesaj.includes("fin_employees_national_id_key")) {
    return "Bu TC kimlik numarası başka bir personelde kayıtlı.";
  }
  if (mesaj.includes("fin_employment_open_key")) {
    return "Bu personelin zaten açık bir çalışma dönemi var; önce onu kapatın.";
  }
  if (mesaj.includes("fin_payroll_unique")) {
    return "Bu personelin bu ay için zaten bir maaş kaydı var.";
  }
  if (mesaj.includes("fin_employment_order")) {
    return "Çıkış tarihi giriş tarihinden önce olamaz.";
  }
  if (mesaj.includes("row-level security")) {
    return "Bu işlem için yetkiniz yok.";
  }
  return mesaj;
}
