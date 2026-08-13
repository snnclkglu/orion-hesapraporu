// Finans şemaları ve arayüz tipleri.
//
// `actions.ts` `"use server"` taşıdığı için oradan async OLMAYAN değer export
// edilemez; şemalar bu yüzden kardeş dosyadadır (worklog/purchasing ile aynı).

import { z } from "zod";
import { adBuyuk } from "@/lib/tr-text";
import { RAISE_REASONS } from "@/lib/personnel/salary-plan";
import {
  CONTRACT_TYPES,
  DOCUMENT_KINDS,
  EDUCATION_LEVELS,
  EXIT_REASONS,
  GENDERS,
  MARITAL_STATUSES,
  WORK_MODES,
} from "@/lib/personnel/employee";

/** Hata İSTİSNA DEĞİL DEĞERdir (worklog/purchasing kalıbı). */
export type PersonnelActionResult = { error?: string; ok?: boolean; id?: string };

// ————————————————————————————————————————————————————————— yapı taşları

const isoGun = z
  .string()
  .trim()
  .refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), "Tarih gg.aa.yyyy biçiminde olmalı")
  .transform((v) => (v === "" ? null : v));

const isoDonem = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}(-\d{2})?$/, "Dönem yyyy-aa biçiminde olmalı")
  .transform((v) => `${v.slice(0, 7)}-01`);

const metin = (max = 200) => z.string().trim().max(max).default("");

/** Boş bırakılabilen seçim: "" → null (Zod enum boş dizgiyi kabul etmez). */
const secim = <T extends readonly [string, ...string[]]>(values: T) =>
  z
    .string()
    .trim()
    .refine((v) => v === "" || (values as readonly string[]).includes(v), "Geçersiz seçim")
    .transform((v) => (v === "" ? null : v));

const paraOptional = z
  .number()
  .finite()
  .nullable()
  .optional()
  .transform((v) => (v === undefined ? null : v));

// ——————————————————————————————————————————————————————————————— personel

/**
 * AD BÜYÜK HARFLE SAKLANIR (AGENTS md. 14) ve dönüşüm ŞEMADA da yapılır:
 * kayıt hangi kapıdan girerse girsin öyle olsun. `toUpperCase()` KULLANILMAZ —
 * "i" harfini "I" yapar.
 */
export const employeeSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Ad soyad gerekli")
    .max(120)
    .transform(adBuyuk),
  employeeNo: metin(40),
  category: z.string().trim().min(1, "Kategori gerekli").max(60),
  title: metin(80).transform(adBuyuk),
  department: metin(60).transform(adBuyuk),

  nationalId: z
    .string()
    .trim()
    .max(20)
    .default("")
    // TC no DOĞRULANMAZ, yalnız biçimlenir: yabancı uyruklu personelin
    // numarası 99 ile başlar ve NVİ algoritmasını geçmez; üç kişinin ise hiç
    // numarası yok. Reddetmek onları kaydedilemez yapardı. Uyarı ARAYÜZDEDİR.
    .transform((v) => v.replace(/\s+/g, "")),
  birthDate: isoGun,
  birthPlace: metin(80),
  gender: secim(GENDERS),
  maritalStatus: secim(MARITAL_STATUSES),
  childCount: z.number().int().min(0).max(20).default(0),
  bloodType: metin(10),
  education: secim(EDUCATION_LEVELS),
  militaryStatus: metin(40),
  disabilityDegree: z.number().int().min(1).max(3).nullable().default(null),

  phone: metin(40),
  email: z
    .string()
    .trim()
    .max(120)
    .default("")
    .refine((v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "E-posta geçersiz"),
  address: metin(400),
  city: metin(60),
  emergencyContact: metin(120),
  emergencyPhone: metin(40),

  contractType: z.enum(CONTRACT_TYPES).default("belirsiz"),
  workMode: z.enum(WORK_MODES).default("tam"),
  sgkNo: metin(40),
  annualLeaveDays: z.number().int().min(0).max(60).default(14),

  bankName: metin(60),
  iban: z
    .string()
    .trim()
    .max(40)
    .default("")
    .transform((v) => v.replace(/\s+/g, "").toUpperCase()),

  notes: metin(2000),
});

export type EmployeeInput = z.input<typeof employeeSchema>;

/**
 * ÇALIŞMA DÖNEMİ ayrı yazılır — künyeye gömülü değildir.
 * Kişi işten çıkarken künyesi değişmez, DÖNEMİ kapanır.
 */
export const employmentSchema = z
  .object({
    id: z.uuid().optional(),
    employeeId: z.uuid(),
    startDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Giriş tarihi gerekli"),
    endDate: isoGun,
    exitReason: secim(EXIT_REASONS),
    note: metin(300),
  })
  .superRefine((v, ctx) => {
    if (v.endDate && v.endDate < v.startDate) {
      ctx.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "Çıkış tarihi girişten önce olamaz",
      });
    }
    // Çıkış nedeni çıkış tarihi OLMADAN anlamsızdır; ters yön serbesttir
    // (tarih bilinip neden sonradan girilebilir).
    if (v.exitReason && !v.endDate) {
      ctx.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "Ayrılma nedeni girildiyse çıkış tarihi de gerekir",
      });
    }
  });

export type EmploymentInput = z.input<typeof employmentSchema>;

// ——————————————————————————————————————————————————————————————— maaş

export const payrollSchema = z.object({
  employeeId: z.uuid(),
  period: isoDonem,
  netSalary: z.number().min(0, "Net maaş negatif olamaz").max(100_000_000),
  overtimeHours50: z.number().min(0).max(400).default(0),
  overtimeHours100: z.number().min(0).max(400).default(0),

  // BORDRO ALTYAPISI — hepsi isteğe bağlı. Bugün HESAPLANMAZ, saklanır:
  // yasal brüt→net dönüşümü (SGK matrahı, kümülatif vergi dilimi, asgari
  // ücret istisnası) her yıl iki kez değişir ve muhasebeden gelen rakamı
  // uydurulmuş bir hesapla ezmek bordroyu yanlış yapardı.
  grossSalary: paraOptional,
  sgkEmployee: paraOptional,
  sgkEmployer: paraOptional,
  unemploymentEmployee: paraOptional,
  incomeTax: paraOptional,
  stampTax: paraOptional,

  bonus: z.number().min(0).default(0),
  perDiem: z.number().min(0).default(0),
  advance: z.number().min(0).default(0),
  deduction: z.number().min(0).default(0),

  // İZİN VE RAPOR SAATİ KİŞİ BAZINDADIR (kullanıcı kararı, 13.08.2026):
  // "personel birkaç gün gelmediyse bunu sisteme girmek isterim … dönem
  // ayarlarında değil, kişi bazında." Üst sınır bir aylık normal çalışma
  // saatinin iki katıdır: 450'yi aşan bir izin saati bir yazım hatasıdır.
  leaveHours: z.number().min(0).max(450).default(0),
  reportHours: z.number().min(0).max(450).default(0),
  // SGK GÜN SAYISI: tam ay 30'dur (31 çeken aylarda da 30). Giriş/çıkış
  // ayında ve ücretsiz izinde düşer; bordronun ve SGK bildiriminin girdisidir.
  workedDays: z.number().int().min(0).max(31).default(30),
  paidOn: isoGun,
  note: metin(300),
});

export type PayrollInput = z.input<typeof payrollSchema>;

/**
 * DÖNEM AYARLARI — bugün yalnız KAPANIŞ İŞARETİ ve not.
 *
 * KUR KULLANICIDAN ALINMIYOR (kullanıcı kararı, 12.08.2026): ayın SON YAYIN
 * GÜNÜNÜN TCMB kuru otomatik yazılır (`ensurePeriodRates`). Alan şemada
 * duruyor çünkü değer hâlâ SATIRIN KENDİNDE donar (AGENTS md. 16) — değişen
 * şey onu kimin yazdığıdır, nerede durduğu değil.
 *
 * İZİN VE RAPOR SAATİ DE ALINMIYOR (kullanıcı kararı, 13.08.2026): ikisi de
 * kişi bazına indi (`payrollSchema`). Alanlar burada DEVRALINAN değeri taşımak
 * için duruyor — 27 ayın Excel'den gelen ay düzeyi saatleri silinmez, yalnız
 * artık buradan YAZILMAZ (`savePeriod` iki sütuna hiç dokunmaz).
 */
export const periodSchema = z.object({
  period: isoDonem,
  eurTryRate: z.number().positive("Kur sıfırdan büyük olmalı").nullable().default(null),
  usdTryRate: z.number().positive().nullable().default(null),
  leaveHours: z.number().min(0).max(100_000).default(0),
  reportHours: z.number().min(0).max(100_000).default(0),
  closed: z.boolean().default(false),
  note: metin(300),
});

export type PeriodInput = z.input<typeof periodSchema>;

// —————————————————————————————————————————————————————————— ücret planı

/**
 * ÜCRET PLANI — "şu tarihten itibaren bu kişinin net ücreti şudur".
 *
 * Geçerlilik AYIN İLK GÜNÜNE oturur (`isoDonem`): ücret ay ortasında
 * değişmez, bordro dönemi aydır. Kullanıcı ekranda bir AY seçer, bir gün
 * değil — ve şema o sözleşmeyi burada da uygular ki kayıt hangi kapıdan
 * girerse girsin aynı ızgaraya düşsün.
 */
export const salaryPlanSchema = z.object({
  id: z.uuid().optional(),
  employeeId: z.uuid(),
  effectiveFrom: isoDonem,
  netSalary: z.number().min(0, "Net maaş negatif olamaz").max(100_000_000),
  // ZAMMIN KÜNYESİ — ikisi de isteğe bağlıdır: elle yazılan bir ücret
  // kararının tabanı ve oranı olmayabilir ve uydurmak yanlış olurdu.
  previousNet: paraOptional,
  raisePct: z.number().finite().min(-100).max(1000).nullable().optional().default(null),
  reason: z.enum(RAISE_REASONS).default("yillik"),
  note: metin(300),
});

export type SalaryPlanInput = z.input<typeof salaryPlanSchema>;

/** TOPLU ZAM girdisi — bir yılın kararını tek işlemde yazar. */
export const raiseBatchSchema = z.object({
  /** Kararın geçerli olacağı dönem (genelde `yyyy-01`). */
  effectiveFrom: isoDonem,
  reason: z.enum(RAISE_REASONS).default("yillik"),
  note: metin(300),
  rows: z
    .array(
      z.object({
        employeeId: z.uuid(),
        netSalary: z.number().min(0).max(100_000_000),
        previousNet: paraOptional,
        raisePct: z.number().finite().min(-100).max(1000).nullable().optional().default(null),
      })
    )
    .min(1, "Kaydedilecek satır yok")
    .max(500),
});

export type RaiseBatchInput = z.input<typeof raiseBatchSchema>;

// ——————————————————————————————————————————————————————————————— belge

export const documentSchema = z.object({
  employeeId: z.uuid(),
  /** Depo yolu SUNUCUDA kurulur; istemci yalnız KİMLİĞİ üretir. */
  documentId: z.uuid(),
  kind: z.enum(DOCUMENT_KINDS).default("diger"),
  title: metin(160),
  fileName: z.string().trim().min(1, "Dosya adı gerekli").max(260),
  mimeType: metin(120),
  sizeBytes: z.number().int().min(0).max(64 * 1024 * 1024),
  issuedOn: isoGun,
  expiresOn: isoGun,
  notes: metin(500),
});

export type DocumentInput = z.input<typeof documentSchema>;

// ——————————————————————————————————————————————————————————————— harcirah

export const perDiemSchema = z.object({
  id: z.uuid().optional(),
  validFrom: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Geçerlilik tarihi gerekli"),
  periodLabel: metin(60),
  roleLabel: z.string().trim().min(2, "Personel sınıfı gerekli").max(120),
  dailyTry: z.number().min(0).max(1_000_000),
  sort: z.number().int().min(0).max(10_000).default(0),
  note: metin(200),
});

export type PerDiemInput = z.input<typeof perDiemSchema>;

// ——————————————————————————————————————————————————————— arayüz tipleri

export interface EmploymentRow {
  id: string;
  startDate: string;
  endDate: string | null;
  exitReason: string | null;
  note: string;
}

export interface EmployeeRow {
  id: string;
  fullName: string;
  employeeNo: string;
  category: string;
  title: string;
  department: string;
  nationalId: string | null;
  birthDate: string | null;
  birthPlace: string;
  gender: string | null;
  maritalStatus: string | null;
  childCount: number;
  bloodType: string;
  education: string | null;
  militaryStatus: string;
  disabilityDegree: number | null;
  phone: string;
  email: string;
  address: string;
  city: string;
  emergencyContact: string;
  emergencyPhone: string;
  contractType: string;
  workMode: string;
  sgkNo: string;
  annualLeaveDays: number;
  bankName: string;
  iban: string;
  notes: string;
  /** Çalışma dönemleri — en yenisi başta. */
  employment: EmploymentRow[];
  /** Açık dönem varsa onun başlangıcı; yoksa son dönemin başlangıcı. */
  currentStart: string | null;
  /** Açık dönem YOKSA son çıkış tarihi. */
  lastEnd: string | null;
  /** Bugün çalışıyor mu (açık dönemi var mı)? */
  active: boolean;
  /** Bütün dönemlerin toplam gün sayısı. */
  serviceDays: number;
  /** Süresi dolmuş ya da dolmak üzere belge adedi (uyarı rozeti). */
  expiringDocs: number;
}

export interface PayrollRow {
  id: string;
  employeeId: string;
  period: string;
  netSalary: number;
  overtimeHours50: number;
  overtimeHours100: number;
  overtimeAmount: number;
  grossSalary: number | null;
  sgkEmployee: number | null;
  sgkEmployer: number | null;
  unemploymentEmployee: number | null;
  incomeTax: number | null;
  stampTax: number | null;
  bonus: number;
  perDiem: number;
  advance: number;
  deduction: number;
  /** Kişinin o aydaki izin saati (13.08.2026'dan beri kişi bazında). */
  leaveHours: number;
  /** Kişinin o aydaki raporlu saati. */
  reportHours: number;
  paidOn: string | null;
  note: string;
  /** SGK gün sayısı. Tam ay 30'dur; giriş/çıkış ayında ve ücretsiz izinde düşer. */
  workedDays: number;
  /** Hesaplandığı ANDAKİ kümülatif gelir vergisi matrahı (bu dönem dâhil). */
  cumulativeTaxBase: number | null;
  /** Hangi yılın bordro parametreleriyle hesaplandı? */
  paramsValidFrom: string | null;
}

/** `hr_payroll_params` satırının arayüz karşılığı. */
export interface PayrollParamsRow {
  validFrom: string;
  label: string;
  minWageGross: number;
  sgkCeiling: number;
  sgkEmployeeRate: number;
  unemploymentEmployeeRate: number;
  sgkEmployerRate: number;
  unemploymentEmployerRate: number;
  stampTaxRate: number;
  brackets: { ust: number | null; oran: number }[];
  incomeTaxExemption: number;
  stampTaxExemption: number;
  source: string;
  verified: boolean;
}

export interface PeriodRow {
  period: string;
  eurTryRate: number | null;
  usdTryRate: number | null;
  /** DEVRALINAN ay düzeyi izin saati — yeni kayıt kişi satırına yazılır. */
  leaveHours: number;
  /** DEVRALINAN ay düzeyi rapor saati. */
  reportHours: number;
  closed: boolean;
  note: string;
}

export interface SalaryPlanRow {
  id: string;
  employeeId: string;
  /** `yyyy-aa` — geçerliliğin başladığı dönem. */
  effectiveFrom: string;
  netSalary: number;
  previousNet: number | null;
  /** Uygulanan zam oranı (yüzde; 15 = %15). Elle yazılan kararda null olabilir. */
  raisePct: number | null;
  reason: string;
  note: string;
}

export interface DocumentRow {
  id: string;
  employeeId: string;
  kind: string;
  title: string;
  fileName: string;
  storagePath: string;
  mimeType: string;
  sizeBytes: number;
  pageCount: number;
  issuedOn: string | null;
  expiresOn: string | null;
  notes: string;
  createdAt: string;
}

export interface PerDiemRow {
  id: string;
  validFrom: string;
  periodLabel: string;
  roleLabel: string;
  dailyTry: number;
  sort: number;
  note: string;
}

export interface FxMonthlyRow {
  period: string;
  eurTry: number;
  usdTry: number;
  eurUsd: number;
  usdEur: number;
  dayCount: number;
  firstDay: string;
  lastDay: string;
  sources: string[];
}

/** Yeni personel penceresinin boş hâli — yer tutucu DEĞİL gerçek değerler. */
export const EMPTY_EMPLOYEE: EmployeeInput = {
  fullName: "",
  employeeNo: "",
  category: "03 - PERSONEL",
  title: "",
  department: "",
  nationalId: "",
  birthDate: "",
  birthPlace: "",
  gender: "",
  maritalStatus: "",
  childCount: 0,
  bloodType: "",
  education: "",
  militaryStatus: "",
  disabilityDegree: null,
  phone: "",
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
};
