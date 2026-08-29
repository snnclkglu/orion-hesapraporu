// MÜŞTERİ PROFİLİ — ticari ilişki özeti ve grafik verisinin saf çekirdeği.

import { calculateCustomerScore, type CustomerScore, type CustomerScoreSettings } from "@/lib/profile-scoring";
import { offerStatusOf, type OfferStatus } from "@/lib/offers/status";
import { jobStatusOf, type JobStatus } from "@/lib/job-status";

export interface CustomerProfileIdentity {
  id: string;
  name: string;
  shortName: string;
  colorHue: number;
  address: string;
  taxOffice: string;
  taxNo: string;
  phone: string;
  fax: string;
  notes: string;
  logoPath: string;
  logoName: string;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerProfileContact {
  id: string;
  name: string;
  title: string;
  department: string;
  phone: string;
  email: string;
  note: string;
  isPrimary: boolean;
  active: boolean;
}

export interface CustomerProfileOffer {
  id: string;
  offerNo: string;
  subject: string;
  status: string;
  currency: string;
  latestTotal: number | null;
  issuedOn: string | null;
  issueDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerProfileJob {
  id: string;
  jobNo: string;
  title: string;
  status: string;
  workOrderDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerProfileProject {
  id: string;
  jobId: string | null;
  docNo: string;
  name: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerProfileDataset {
  customer: CustomerProfileIdentity;
  contacts: CustomerProfileContact[];
  offers: CustomerProfileOffer[];
  jobs: CustomerProfileJob[];
  projects: CustomerProfileProject[];
}

export interface CustomerMonthlyActivity {
  month: string;
  offers: number;
  wonOffers: number;
  jobs: number;
  projects: number;
}

export interface CustomerProfileAnalytics {
  score: CustomerScore;
  lastActivityAt: string | null;
  annualOfferCount: number;
  wonOfferCount: number;
  conversionRatio: number | null;
  activeJobCount: number;
  completenessFilled: number;
  completenessTotal: number;
  completenessMissing: string[];
  offerStatusCounts: Record<OfferStatus, number>;
  jobStatusCounts: Record<JobStatus, number>;
  quotedTotalsByCurrency: Array<{ currency: string; total: number; count: number }>;
  monthly12: CustomerMonthlyActivity[];
}

const DAY_MS = 86_400_000;

function validDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function activityDateOfOffer(offer: CustomerProfileOffer): Date | null {
  return validDate(offer.issuedOn || offer.issueDate || offer.createdAt);
}

function activityDateOfJob(job: CustomerProfileJob): Date | null {
  return validDate(job.workOrderDate || job.createdAt);
}

function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function shiftMonth(date: Date, delta: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + delta, 1));
}

function latestIso(values: Array<Date | null>): string | null {
  const times = values.filter((value): value is Date => Boolean(value)).map((value) => value.getTime());
  return times.length > 0 ? new Date(Math.max(...times)).toISOString() : null;
}

export function buildCustomerProfileAnalytics(
  data: CustomerProfileDataset,
  now: Date,
  scoreSettings: CustomerScoreSettings
): CustomerProfileAnalytics {
  const offerStatusCounts: Record<OfferStatus, number> = { draft: 0, sent: 0, won: 0, lost: 0, cancelled: 0 };
  for (const offer of data.offers) offerStatusCounts[offerStatusOf(offer.status)] += 1;
  const jobStatusCounts: Record<JobStatus, number> = { active: 0, passive: 0, completed: 0, archived: 0 };
  for (const job of data.jobs) jobStatusCounts[jobStatusOf(job.status)] += 1;

  const cutoff = now.getTime() - 365 * DAY_MS;
  const annualOffers = data.offers.filter((offer) => (activityDateOfOffer(offer)?.getTime() ?? -Infinity) >= cutoff);
  const decidedOfferCount = offerStatusCounts.won + offerStatusCounts.lost;
  const conversionRatio = decidedOfferCount > 0 ? offerStatusCounts.won / decidedOfferCount : null;

  const completenessChecks = [
    [data.customer.address, "Adres"],
    [data.customer.taxOffice, "Vergi dairesi"],
    [data.customer.taxNo, "Vergi numarası"],
    [data.customer.phone, "Firma telefonu"],
    [data.customer.logoPath, "Logo"],
    [data.contacts.some((contact) => contact.active), "Etkin iletişim kişisi"],
    [data.contacts.some((contact) => contact.active && contact.email.trim()), "İletişim e-postası"],
  ] as const;
  const completenessMissing = completenessChecks.filter(([value]) => !value).map(([, label]) => label);
  const completenessFilled = completenessChecks.length - completenessMissing.length;

  const totals = new Map<string, { total: number; count: number }>();
  for (const offer of data.offers) {
    if (offer.latestTotal === null || !Number.isFinite(offer.latestTotal)) continue;
    const currency = offer.currency.trim().toLocaleUpperCase("tr-TR") || "—";
    const current = totals.get(currency) ?? { total: 0, count: 0 };
    current.total += offer.latestTotal;
    current.count += 1;
    totals.set(currency, current);
  }

  const monthMap = new Map<string, CustomerMonthlyActivity>();
  for (let index = -11; index <= 0; index += 1) {
    const month = monthKey(shiftMonth(now, index));
    monthMap.set(month, { month, offers: 0, wonOffers: 0, jobs: 0, projects: 0 });
  }
  for (const offer of data.offers) {
    const date = activityDateOfOffer(offer);
    const row = date ? monthMap.get(monthKey(date)) : undefined;
    if (!row) continue;
    row.offers += 1;
    if (offerStatusOf(offer.status) === "won") row.wonOffers += 1;
  }
  for (const job of data.jobs) {
    const date = activityDateOfJob(job);
    const row = date ? monthMap.get(monthKey(date)) : undefined;
    if (row) row.jobs += 1;
  }
  for (const project of data.projects) {
    const date = validDate(project.createdAt);
    const row = date ? monthMap.get(monthKey(date)) : undefined;
    if (row) row.projects += 1;
  }

  const lastActivityAt = latestIso([
    ...data.offers.map(activityDateOfOffer),
    ...data.jobs.map(activityDateOfJob),
    ...data.projects.map((project) => validDate(project.createdAt)),
    validDate(data.customer.createdAt),
  ]);
  const score = calculateCustomerScore(
    {
      lastActivityAt,
      annualOfferCount: annualOffers.length,
      decidedOfferCount,
      wonOfferCount: offerStatusCounts.won,
      activeJobCount: jobStatusCounts.active,
      completenessFilled,
      completenessTotal: completenessChecks.length,
    },
    now,
    scoreSettings
  );

  return {
    score,
    lastActivityAt,
    annualOfferCount: annualOffers.length,
    wonOfferCount: offerStatusCounts.won,
    conversionRatio,
    activeJobCount: jobStatusCounts.active,
    completenessFilled,
    completenessTotal: completenessChecks.length,
    completenessMissing,
    offerStatusCounts,
    jobStatusCounts,
    quotedTotalsByCurrency: [...totals.entries()]
      .map(([currency, value]) => ({ currency, ...value }))
      .sort((a, b) => a.currency.localeCompare(b.currency, "tr")),
    monthly12: [...monthMap.values()],
  };
}
