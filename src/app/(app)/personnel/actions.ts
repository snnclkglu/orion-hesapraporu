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
import { canEditPersonnel, canSeePersonnel } from "@/lib/roles";
import { tazeleKurlar } from "@/lib/fx/refresh";
import {
  employeeSchema,
  employmentSchema,
  payrollSchema,
  perDiemSchema,
  periodSchema,
  raiseBatchSchema,
  salaryPlanSchema,
  type EmployeeInput,
  type EmploymentInput,
  type PersonnelActionResult,
  type PayrollInput,
  type PerDiemInput,
  type PeriodInput,
  type RaiseBatchInput,
  type SalaryPlanInput,
} from "./schema";

function tazele() {
  revalidatePath("/personnel");
  revalidatePath("/personnel/ucret");
  revalidatePath("/personnel/maas");
  revalidatePath("/personnel/ozet");
  revalidatePath("/personnel/harcirah");
  revalidatePath("/personnel/kurlar");
}

async function requirePersonnelWrite() {
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
  if (!canSeePersonnel(role) || !canEditPersonnel(role)) {
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
): Promise<PersonnelActionResult> {
  const ctx = await requirePersonnelWrite();
  if ("error" in ctx) return ctx;
  const { supabase, user } = ctx;

  const parsed = employeeSchema.safeParse(input);
  if (!parsed.success) return { error: ilkHata(parsed.error.issues) };
  const row = employeeRow(parsed.data);

  if (id) {
    const { error, count } = await supabase
      .from("hr_employees")
      .update(row, { count: "exact" })
      .eq("id", id);
    // RLS SESSİZ NO-OP ÜRETİR: sayıyı okumak yetkisizliği gerçek hataya çevirir.
    if (error) return { error: temizHata(error.message) };
    if (!count) return { error: "Kayıt güncellenemedi; yetkiniz olmayabilir." };
    await supabase.from("audit_log").insert({
      actor: user.id,
      action: "personnel.employee.update",
      detail: { id, full_name: row.full_name },
    });
    tazele();
    revalidatePath(`/personnel/${id}`);
    return { ok: true, id };
  }

  const { data, error } = await supabase
    .from("hr_employees")
    .insert({ ...row, created_by: user.id })
    .select("id")
    .maybeSingle();
  if (error) return { error: temizHata(error.message) };
  const yeniId = (data as { id: string } | null)?.id;
  if (!yeniId) return { error: "Personel oluşturuldu ama kimliği okunamadı." };

  if (startDate && /^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
    const { error: dHata } = await supabase
      .from("hr_employment")
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
    action: "personnel.employee.create",
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
export async function deleteEmployee(id: string): Promise<PersonnelActionResult> {
  const ctx = await requirePersonnelWrite();
  if ("error" in ctx) return ctx;
  const { supabase, user } = ctx;

  const { count: maasSayisi } = await supabase
    .from("hr_payroll")
    .select("id", { count: "exact", head: true })
    .eq("employee_id", id);
  if (maasSayisi && maasSayisi > 0) {
    return {
      error: `Bu personelin ${maasSayisi} maaş kaydı var; silinemez. İşten ayrıldıysa çalışma dönemini kapatın.`,
    };
  }

  // Belgeler: önce TABLO satırı, sonra depo nesnesi ("önce ucuz olanı kaybet").
  const { data: belgeler } = await supabase
    .from("hr_employee_documents")
    .select("storage_path")
    .eq("employee_id", id);

  const { error, count } = await supabase
    .from("hr_employees")
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
    action: "personnel.employee.delete",
    detail: { id, documents: yollar.length },
  });
  tazele();
  return { ok: true };
}

// ————————————————————————————————————————————————————— çalışma dönemleri

export async function saveEmployment(input: EmploymentInput): Promise<PersonnelActionResult> {
  const ctx = await requirePersonnelWrite();
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
      .from("hr_employment")
      .update(row, { count: "exact" })
      .eq("id", d.id);
    if (error) return { error: temizHata(error.message) };
    if (!count) return { error: "Dönem güncellenemedi; yetkiniz olmayabilir." };
  } else {
    const { error } = await supabase.from("hr_employment").insert(row);
    if (error) return { error: temizHata(error.message) };
  }

  await supabase.from("audit_log").insert({
    actor: user.id,
    action: d.id ? "personnel.employment.update" : "personnel.employment.create",
    detail: { employee_id: d.employeeId, start: d.startDate, end: d.endDate },
  });
  tazele();
  revalidatePath(`/personnel/${d.employeeId}`);
  return { ok: true };
}

export async function deleteEmployment(
  id: string,
  employeeId: string
): Promise<PersonnelActionResult> {
  const ctx = await requirePersonnelWrite();
  if ("error" in ctx) return ctx;
  const { supabase, user } = ctx;
  const { error, count } = await supabase
    .from("hr_employment")
    .delete({ count: "exact" })
    .eq("id", id);
  if (error) return { error: temizHata(error.message) };
  if (!count) return { error: "Dönem silinemedi; yetkiniz olmayabilir." };
  await supabase.from("audit_log").insert({
    actor: user.id,
    action: "personnel.employment.delete",
    detail: { id, employee_id: employeeId },
  });
  tazele();
  revalidatePath(`/personnel/${employeeId}`);
  return { ok: true };
}

// ═══════════════════════════════════════════════════════════════════ maaş

/**
 * Bir kişinin bir ayki maaşı.
 *
 * `overtime_amount` GÖNDERİLMEZ — türetilmiş sütundur; yazmaya kalkmak
 * Postgres hatası verir ve vermese bile saatlerle çelişen bir tutar üretirdi.
 */
export async function savePayroll(input: PayrollInput): Promise<PersonnelActionResult> {
  const ctx = await requirePersonnelWrite();
  if ("error" in ctx) return ctx;
  const { supabase, user } = ctx;

  const parsed = payrollSchema.safeParse(input);
  if (!parsed.success) return { error: ilkHata(parsed.error.issues) };
  const d = parsed.data;

  const { error } = await supabase.from("hr_payroll").upsert(
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
      leave_hours: d.leaveHours,
      report_hours: d.reportHours,
      worked_days: d.workedDays,
      paid_on: d.paidOn,
      note: d.note,
      created_by: user.id,
    },
    { onConflict: "employee_id,period" }
  );
  if (error) return { error: temizHata(error.message) };

  await supabase.from("audit_log").insert({
    actor: user.id,
    action: "personnel.payroll.save",
    detail: {
      employee_id: d.employeeId,
      period: d.period,
      net_salary: d.netSalary,
      ot50: d.overtimeHours50,
      ot100: d.overtimeHours100,
    },
  });
  tazele();
  revalidatePath(`/personnel/${d.employeeId}`);
  return { ok: true };
}

export async function deletePayroll(
  employeeId: string,
  period: string
): Promise<PersonnelActionResult> {
  const ctx = await requirePersonnelWrite();
  if ("error" in ctx) return ctx;
  const { supabase, user } = ctx;
  const ay = `${period.slice(0, 7)}-01`;
  const { error, count } = await supabase
    .from("hr_payroll")
    .delete({ count: "exact" })
    .eq("employee_id", employeeId)
    .eq("period", ay);
  if (error) return { error: temizHata(error.message) };
  if (!count) return { error: "Maaş kaydı silinemedi; yetkiniz olmayabilir." };
  await supabase.from("audit_log").insert({
    actor: user.id,
    action: "personnel.payroll.delete",
    detail: { employee_id: employeeId, period: ay },
  });
  tazele();
  revalidatePath(`/personnel/${employeeId}`);
  return { ok: true };
}

// ═══════════════════════════════════════════════════════════════════ dönem

export async function savePeriod(input: PeriodInput): Promise<PersonnelActionResult> {
  const ctx = await requirePersonnelWrite();
  if ("error" in ctx) return ctx;
  const { supabase, user } = ctx;

  const parsed = periodSchema.safeParse(input);
  if (!parsed.success) return { error: ilkHata(parsed.error.issues) };
  const d = parsed.data;

  // ÜÇ SÜTUNA HİÇ DOKUNULMAZ ve gerekçeleri ayrıdır:
  //
  //   • KUR (12.08.2026): ayın son yayın gününün TCMB kuru `ensurePeriodRates`
  //     ile otomatik gelir. Alanı bu eyleme bırakmak, kullanıcıya
  //     sorulmayacak bir değeri arka kapıdan sordurmak olurdu.
  //   • İZİN / RAPOR SAATİ (13.08.2026): ikisi de KİŞİ BAZINA indi
  //     (`hr_payroll`). Buradaki sütunlar DEVRALINAN 27 ayın Excel'den gelen
  //     ay düzeyi değerleridir ve korunur — üzerine sıfır yazmak, dağıtılamaz
  //     ama gerçek olan bir veriyi silmek olurdu.
  const { error } = await supabase.from("hr_periods").upsert(
    {
      period: d.period,
      closed: d.closed,
      note: d.note,
    },
    { onConflict: "period" }
  );
  if (error) return { error: temizHata(error.message) };

  await supabase.from("audit_log").insert({
    actor: user.id,
    action: "personnel.period.save",
    detail: { period: d.period, closed: d.closed },
  });
  tazele();
  return { ok: true };
}

/**
 * DÖNEMİ SİLER — maaş satırlarıyla birlikte.
 *
 * Kullanıcı kararı (12.08.2026): "Dönemi tamamen yanlış yapmış da olabilir."
 * Bir ayı baştan girmenin yolu satır satır silmek olmamalı. Silme dönem
 * KAYDINI ve o aya ait BÜTÜN maaş satırlarını götürür; kaç satırın gideceği
 * çağrı yerine döner ki onay penceresi sayıyı gösterebilsin.
 *
 * KAPALI DÖNEM ÖNCE AÇILIR. "Dönemi kapat" bir işarettir ve kapalı bir ayı
 * kazara silmek, kapatma işaretini anlamsız kılardı; kullanıcı önce açar,
 * sonra siler — iki bilinçli hareket.
 */
export async function deletePeriod(period: string): Promise<PersonnelActionResult> {
  const ctx = await requirePersonnelWrite();
  if ("error" in ctx) return ctx;
  const { supabase, user } = ctx;

  const ay = `${period.slice(0, 7)}-01`;
  const { data: donem } = await supabase
    .from("hr_periods")
    .select("closed")
    .eq("period", ay)
    .maybeSingle();
  if ((donem as { closed?: boolean } | null)?.closed) {
    return { error: "Dönem kapalı. Silmeden önce dönemi açın." };
  }

  const { count: silinen, error: maasHatasi } = await supabase
    .from("hr_payroll")
    .delete({ count: "exact" })
    .eq("period", ay);
  if (maasHatasi) return { error: temizHata(maasHatasi.message) };

  const { error } = await supabase.from("hr_periods").delete().eq("period", ay);
  if (error) return { error: temizHata(error.message) };

  await supabase.from("audit_log").insert({
    actor: user.id,
    action: "personnel.period.delete",
    detail: { period: ay, silinen_maas_satiri: silinen ?? 0 },
  });
  tazele();
  return { ok: true, id: String(silinen ?? 0) };
}

// ═════════════════════════════════════════════════════════════ dönem kuru

export interface PeriodRateResult {
  error?: string;
  /** Kuru yazılan dönemler. */
  yazilan: { period: string; date: string; eurTry: number }[];
  /** Kur çekimi de yapıldıysa eklenen gün sayısı. */
  eklenenGun?: number;
}

/**
 * DÖNEM KURLARINI OTOMATİK TAMAMLAR — kullanıcıya sorulmadan.
 *
 * Kullanıcı kararı (12.08.2026): "Kur mevzusunu bir şekilde otomatikleştirmeliyiz,
 * kullanıcıdan almak istemiyorum. Ayın son günü olan kurları alsın."
 *
 * Üç adım, sırası önemli:
 *   1. Kur deposu bugüne getirilir (TCMB) — ayın son günü henüz çekilmemiş
 *      olabilir ve o gün olmadan dönem kuru yazılamaz.
 *   2. KAPANMIŞ ama kuru boş olan her dönem için AYIN SON YAYIN GÜNÜNÜN kuru
 *      yazılır. "Son gün" takvimin 31'i değildir: ay hafta sonu ya da resmî
 *      tatille bitiyorsa o günün kuru YOKTUR ve bir öncekine düşülür.
 *   3. İÇİNDE BULUNULAN AY ATLANIR. Ay bitmeden "ay sonu kuru" diye bir şey
 *      yoktur; şimdilik yazılan değer birkaç gün sonra yanlış olurdu.
 *
 * YAZILMIŞ KUR EZİLMEZ (`is("eur_try_rate", null)`): ödenmiş bir ayın kuru
 * donar (AGENTS SATIS-16). Devralınan 27 ayın Excel'den gelen kuru bu yüzden
 * yerinde kalır.
 *
 * Ekran açıldığında çağrılır ve İDEMPOTENTtir: yapacak iş yoksa hiçbir şey
 * yazmaz, boş liste döner.
 */
export async function ensurePeriodRates(): Promise<PeriodRateResult> {
  const ctx = await requirePersonnelWrite();
  if ("error" in ctx) return { error: ctx.error, yazilan: [] };
  const { supabase, user } = ctx;

  const bugun = new Date().toISOString().slice(0, 10);
  const buAy = bugun.slice(0, 7);

  const { data: eksikler, error: okumaHatasi } = await supabase
    .from("hr_periods")
    .select("period")
    .is("eur_try_rate", null)
    .order("period");
  if (okumaHatasi) return { error: temizHata(okumaHatasi.message), yazilan: [] };

  // Yalnız KAPANMIŞ aylar — içinde bulunulan ay ve gelecek atlanır.
  const hedefler = (eksikler ?? [])
    .map((r) => String((r as { period: string }).period).slice(0, 7))
    .filter((ay) => ay < buAy);
  if (hedefler.length === 0) return { yazilan: [] };

  // Kur deposunu önce bugüne getir: ayın son günü eksikse kur yazılamaz.
  const tazeleme = await tazeleKurlar(supabase, bugun);

  const yazilan: PeriodRateResult["yazilan"] = [];
  for (const ay of hedefler) {
    const [y, m] = ay.split("-").map(Number);
    const ayinSonu = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
    const { data } = await supabase
      .from("fx_rate_daily")
      .select("rate_date, eur_try, usd_try")
      .gte("rate_date", `${ay}-01`)
      .lte("rate_date", ayinSonu)
      .order("rate_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    const kur = data as { rate_date: string; eur_try: number; usd_try: number } | null;
    if (!kur) continue;

    const { error, count } = await supabase
      .from("hr_periods")
      .update(
        { eur_try_rate: kur.eur_try, usd_try_rate: kur.usd_try },
        { count: "exact" }
      )
      .eq("period", `${ay}-01`)
      // YARIŞ KORUMASI: iki kullanıcı aynı anda girerse ikincisi yazmaz.
      .is("eur_try_rate", null);
    if (!error && count) {
      yazilan.push({ period: ay, date: kur.rate_date, eurTry: Number(kur.eur_try) });
    }
  }

  if (yazilan.length > 0) {
    await supabase.from("audit_log").insert({
      actor: user.id,
      action: "personnel.period.rate.auto",
      detail: { donemler: yazilan.map((x) => `${x.period}←${x.date}`), kaynak: "TCMB ay sonu" },
    });
    tazele();
  }
  return { yazilan, eklenenGun: tazeleme.eklenen };
}

// ═══════════════════════════════════════════════════════════ ücret planı

/**
 * ORAN EKRANDA YÜZDE, VERİTABANINDA KESİRDİR.
 *
 * Dönüşüm iki yerde ve YALNIZ iki yerde yapılır: burada (yazarken) ve
 * `data.ts → loadSalaryPlan`ta (okurken). Arayüzün tamamı yüzde konuşur;
 * iki birimi bileşenler arasında dolaştırmak, sıfır bir zammı yüzde bir
 * küçültmenin en kolay yoluydu.
 */
function oranKesre(yuzde: number | null | undefined): number | null {
  return yuzde === null || yuzde === undefined || !Number.isFinite(yuzde)
    ? null
    : Number((yuzde / 100).toFixed(4));
}

/**
 * TEK BİR ÜCRET KARARINI yazar (yeni ya da düzenleme).
 *
 * Kullanıcı kararı (13.08.2026): "Yıl içinde bazen nadiren ayarlama
 * yapabilirim; düzenleme seçeneği olsun."
 *
 * ANAHTAR (kişi, dönem)dir ve UPSERT'tir: aynı aya ikinci bir karar yazmak bir
 * hata değil bir DÜZELTMEdir. Yanlış girilmiş bir zammı silip yeniden
 * girdirmek, kararın kendi geçmişini (kim ne zaman yazdı) yok ederdi.
 */
export async function saveSalaryPlan(input: SalaryPlanInput): Promise<PersonnelActionResult> {
  const ctx = await requirePersonnelWrite();
  if ("error" in ctx) return ctx;
  const { supabase, user } = ctx;

  const parsed = salaryPlanSchema.safeParse(input);
  if (!parsed.success) return { error: ilkHata(parsed.error.issues) };
  const d = parsed.data;

  const { error } = await supabase.from("hr_salary_plan").upsert(
    {
      employee_id: d.employeeId,
      effective_from: d.effectiveFrom,
      net_salary: d.netSalary,
      previous_net: d.previousNet,
      raise_pct: oranKesre(d.raisePct),
      reason: d.reason,
      note: d.note,
      created_by: user.id,
    },
    { onConflict: "employee_id,effective_from" }
  );
  if (error) return { error: temizHata(error.message) };

  await supabase.from("audit_log").insert({
    actor: user.id,
    action: "personnel.salary_plan.save",
    detail: {
      employee_id: d.employeeId,
      effective_from: d.effectiveFrom,
      net_salary: d.netSalary,
      raise_pct: d.raisePct,
      reason: d.reason,
    },
  });
  tazele();
  revalidatePath(`/personnel/${d.employeeId}`);
  return { ok: true };
}

/**
 * TOPLU ZAM — bir yılın kararını tek işlemde yazar.
 *
 * Kullanıcı kararı: "%5 10 15 20 25 veya kendi istediğim oranda kişilere zam
 * verebileyim." Kırk kişiye tek tek yazmak bir iş akışı değildi.
 *
 * SATIRLAR SIRAYLA YAZILIR, tek bir `upsert` dizisiyle değil: bir satırın
 * kısıta takılması ötekilerin yazılmasını engellememeli ve kaçının yazıldığı
 * kullanıcıya SAYIYLA dönmelidir ("geçen ayı kopyala" ile aynı kalıp).
 * Denetim izi TEK satırdır — kırk satırlık bir zam kararı kırk kayıt değil bir
 * karardır.
 */
export async function applyRaiseBatch(
  input: RaiseBatchInput
): Promise<PersonnelActionResult & { yazilan?: number }> {
  const ctx = await requirePersonnelWrite();
  if ("error" in ctx) return ctx;
  const { supabase, user } = ctx;

  const parsed = raiseBatchSchema.safeParse(input);
  if (!parsed.success) return { error: ilkHata(parsed.error.issues) };
  const d = parsed.data;

  let yazilan = 0;
  const hatalar: string[] = [];
  for (const r of d.rows) {
    const { error } = await supabase.from("hr_salary_plan").upsert(
      {
        employee_id: r.employeeId,
        effective_from: d.effectiveFrom,
        net_salary: r.netSalary,
        previous_net: r.previousNet,
        raise_pct: oranKesre(r.raisePct),
        reason: d.reason,
        note: d.note,
        created_by: user.id,
      },
      { onConflict: "employee_id,effective_from" }
    );
    if (error) hatalar.push(temizHata(error.message));
    else yazilan += 1;
  }

  if (yazilan > 0) {
    await supabase.from("audit_log").insert({
      actor: user.id,
      action: "personnel.salary_plan.batch",
      detail: {
        effective_from: d.effectiveFrom,
        reason: d.reason,
        kisi: yazilan,
        hata: hatalar.length,
      },
    });
    tazele();
  }
  // Eksiklik GİZLENMEZ: kaç satırın yazılamadığı çağrı yerine döner.
  return hatalar.length > 0
    ? { ok: yazilan > 0, yazilan, error: `${hatalar.length} satır yazılamadı: ${hatalar[0]}` }
    : { ok: true, yazilan };
}

export async function deleteSalaryPlan(id: string): Promise<PersonnelActionResult> {
  const ctx = await requirePersonnelWrite();
  if ("error" in ctx) return ctx;
  const { supabase, user } = ctx;
  const { error, count } = await supabase
    .from("hr_salary_plan")
    .delete({ count: "exact" })
    .eq("id", id);
  if (error) return { error: temizHata(error.message) };
  if (!count) return { error: "Ücret kaydı silinemedi; yetkiniz olmayabilir." };
  await supabase.from("audit_log").insert({
    actor: user.id,
    action: "personnel.salary_plan.delete",
    detail: { id },
  });
  tazele();
  return { ok: true };
}

// ═══════════════════════════════════════════════════════════════ harcirah

export async function savePerDiem(input: PerDiemInput): Promise<PersonnelActionResult> {
  const ctx = await requirePersonnelWrite();
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
      .from("hr_per_diem")
      .update(row, { count: "exact" })
      .eq("id", d.id);
    if (error) return { error: temizHata(error.message) };
    if (!count) return { error: "Tarife güncellenemedi; yetkiniz olmayabilir." };
  } else {
    const { error } = await supabase.from("hr_per_diem").insert(row);
    if (error) return { error: temizHata(error.message) };
  }
  revalidatePath("/personnel/harcirah");
  return { ok: true };
}

export async function deletePerDiem(id: string): Promise<PersonnelActionResult> {
  const ctx = await requirePersonnelWrite();
  if ("error" in ctx) return ctx;
  const { error, count } = await ctx.supabase
    .from("hr_per_diem")
    .delete({ count: "exact" })
    .eq("id", id);
  if (error) return { error: temizHata(error.message) };
  if (!count) return { error: "Tarife silinemedi; yetkiniz olmayabilir." };
  revalidatePath("/personnel/harcirah");
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
  const ctx = await requirePersonnelWrite();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, user } = ctx;

  const bugun = new Date().toISOString().slice(0, 10);
  const sonuc = await tazeleKurlar(supabase, bugun);
  if (sonuc.error) return { error: temizHata(sonuc.error) };

  if (sonuc.aralik) {
    await supabase.from("audit_log").insert({
      actor: user.id,
      action: "personnel.fx.refresh",
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

  revalidatePath("/personnel/kurlar");
  revalidatePath("/personnel/maas");
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
 * constraint hr_employees_national_id_key" bir kullanıcı mesajı değildir.
 */
function temizHata(mesaj: string): string {
  if (mesaj.includes("hr_employees_national_id_key")) {
    return "Bu TC kimlik numarası başka bir personelde kayıtlı.";
  }
  if (mesaj.includes("hr_employment_open_key")) {
    return "Bu personelin zaten açık bir çalışma dönemi var; önce onu kapatın.";
  }
  if (mesaj.includes("hr_payroll_unique")) {
    return "Bu personelin bu ay için zaten bir maaş kaydı var.";
  }
  if (mesaj.includes("hr_employment_order")) {
    return "Çıkış tarihi giriş tarihinden önce olamaz.";
  }
  if (mesaj.includes("hr_salary_plan")) {
    // Tablonun kendisi yoksa (migration uygulanmamışsa) mesaj "relation …
    // does not exist" olur; kullanıcıya kısıt adı değil YAPILACAK İŞ söylenir.
    return mesaj.includes("does not exist")
      ? "Ücret planı tablosu henüz kurulmamış (migration uygulanmalı)."
      : "Bu kişi için bu dönemde zaten bir ücret kararı var.";
  }
  if (mesaj.includes("row-level security")) {
    return "Bu işlem için yetkiniz yok.";
  }
  return mesaj;
}
