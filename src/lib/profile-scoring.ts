// PROFİL PUANLAMA — kullanıcı ve müşteri profillerinin saf, açıklanabilir çekirdeği.
//
// Bu puanlar ücret/performans değerlendirmesi ya da kredi notu değildir. Kullanıcı
// puanı yalnız uygulama etkinliğini, müşteri puanı ise kayıtlı ticari ilişkinin
// güncelliğini ve veri bütünlüğünü özetler. Veritabanı, HTTP ve React içermez.

export interface UserScoreSettings {
  recencyWeight: number;
  consistencyWeight: number;
  engagementWeight: number;
  activeDaysTarget: number;
  activeHoursTarget: number;
}

export interface CustomerScoreSettings {
  recencyWeight: number;
  offerActivityWeight: number;
  conversionWeight: number;
  activeWorkWeight: number;
  completenessWeight: number;
  recencyWindowDays: number;
  annualOfferTarget: number;
  activeJobTarget: number;
}

export interface ProfileScoringSettings {
  user: UserScoreSettings;
  customer: CustomerScoreSettings;
}

export const DEFAULT_PROFILE_SCORING_SETTINGS: ProfileScoringSettings = {
  user: {
    recencyWeight: 35,
    consistencyWeight: 35,
    engagementWeight: 30,
    activeDaysTarget: 12,
    activeHoursTarget: 10,
  },
  customer: {
    recencyWeight: 25,
    offerActivityWeight: 20,
    conversionWeight: 25,
    activeWorkWeight: 20,
    completenessWeight: 10,
    recencyWindowDays: 365,
    annualOfferTarget: 6,
    activeJobTarget: 2,
  },
};

export interface UserScore {
  total: number;
  label: "Başlangıç" | "Düşük" | "Düzenli" | "Güçlü";
  recency: number;
  consistency: number;
  engagement: number;
}

export interface CustomerScore {
  total: number;
  label: "Başlangıç" | "Gelişen" | "Güçlü" | "Stratejik";
  recency: number;
  offerActivity: number;
  conversion: number;
  activeWork: number;
  completeness: number;
}

export interface CustomerScoreMetrics {
  lastActivityAt: string | null;
  annualOfferCount: number;
  decidedOfferCount: number;
  wonOfferCount: number;
  activeJobCount: number;
  completenessFilled: number;
  completenessTotal: number;
}

const DAY_MS = 86_400_000;

function finiteInRange(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = typeof value === "number" ? value : Number.NaN;
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
}

function integerInRange(value: unknown, fallback: number, min: number, max: number): number {
  return Math.round(finiteInRange(value, fallback, min, max));
}

function objectOf(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** Bozuk/eski ayarı güvenli varsayılanlarla birleştirir; ağırlık toplamı 100 kalır. */
export function profileScoringSettingsOf(value: unknown): ProfileScoringSettings {
  const root = objectOf(value);
  const rawUser = objectOf(root.user);
  const rawCustomer = objectOf(root.customer);
  const defaults = DEFAULT_PROFILE_SCORING_SETTINGS;

  const userWeights = {
    recencyWeight: integerInRange(rawUser.recencyWeight, defaults.user.recencyWeight, 0, 100),
    consistencyWeight: integerInRange(rawUser.consistencyWeight, defaults.user.consistencyWeight, 0, 100),
    engagementWeight: integerInRange(rawUser.engagementWeight, defaults.user.engagementWeight, 0, 100),
  };
  const customerWeights = {
    recencyWeight: integerInRange(rawCustomer.recencyWeight, defaults.customer.recencyWeight, 0, 100),
    offerActivityWeight: integerInRange(rawCustomer.offerActivityWeight, defaults.customer.offerActivityWeight, 0, 100),
    conversionWeight: integerInRange(rawCustomer.conversionWeight, defaults.customer.conversionWeight, 0, 100),
    activeWorkWeight: integerInRange(rawCustomer.activeWorkWeight, defaults.customer.activeWorkWeight, 0, 100),
    completenessWeight: integerInRange(rawCustomer.completenessWeight, defaults.customer.completenessWeight, 0, 100),
  };

  const safeUserWeights = Object.values(userWeights).reduce((sum, item) => sum + item, 0) === 100
    ? userWeights
    : {
        recencyWeight: defaults.user.recencyWeight,
        consistencyWeight: defaults.user.consistencyWeight,
        engagementWeight: defaults.user.engagementWeight,
      };
  const safeCustomerWeights = Object.values(customerWeights).reduce((sum, item) => sum + item, 0) === 100
    ? customerWeights
    : {
        recencyWeight: defaults.customer.recencyWeight,
        offerActivityWeight: defaults.customer.offerActivityWeight,
        conversionWeight: defaults.customer.conversionWeight,
        activeWorkWeight: defaults.customer.activeWorkWeight,
        completenessWeight: defaults.customer.completenessWeight,
      };

  return {
    user: {
      ...safeUserWeights,
      activeDaysTarget: integerInRange(rawUser.activeDaysTarget, defaults.user.activeDaysTarget, 1, 30),
      activeHoursTarget: finiteInRange(rawUser.activeHoursTarget, defaults.user.activeHoursTarget, 1, 300),
    },
    customer: {
      ...safeCustomerWeights,
      recencyWindowDays: integerInRange(rawCustomer.recencyWindowDays, defaults.customer.recencyWindowDays, 30, 1825),
      annualOfferTarget: integerInRange(rawCustomer.annualOfferTarget, defaults.customer.annualOfferTarget, 1, 100),
      activeJobTarget: integerInRange(rawCustomer.activeJobTarget, defaults.customer.activeJobTarget, 1, 50),
    },
  };
}

function ratio(value: number, target: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(target) || target <= 0) return 0;
  return Math.min(Math.max(value, 0) / target, 1);
}

function weighted(valueRatio: number, weight: number): number {
  return Math.round(Math.min(Math.max(valueRatio, 0), 1) * weight);
}

export function calculateUserScore(
  summary: { activeDays: number; activeSeconds: number },
  lastSeenAt: string | null,
  now: Date,
  settings: UserScoreSettings
): UserScore | null {
  if (!lastSeenAt) return null;
  const seenAt = new Date(lastSeenAt);
  if (Number.isNaN(seenAt.getTime())) return null;
  const elapsedDays = Math.max(0, (now.getTime() - seenAt.getTime()) / DAY_MS);
  const recencyRatio =
    elapsedDays <= 1 ? 1 : elapsedDays <= 3 ? 0.86 : elapsedDays <= 7 ? 0.63 : elapsedDays <= 14 ? 0.34 : elapsedDays <= 30 ? 0.17 : 0;
  const recency = weighted(recencyRatio, settings.recencyWeight);
  const consistency = weighted(ratio(summary.activeDays, settings.activeDaysTarget), settings.consistencyWeight);
  const engagement = weighted(ratio(summary.activeSeconds, settings.activeHoursTarget * 3600), settings.engagementWeight);
  const total = recency + consistency + engagement;
  const label = total >= 80 ? "Güçlü" : total >= 55 ? "Düzenli" : total >= 25 ? "Düşük" : "Başlangıç";
  return { total, label, recency, consistency, engagement };
}

export function calculateCustomerScore(
  metrics: CustomerScoreMetrics,
  now: Date,
  settings: CustomerScoreSettings
): CustomerScore {
  const activity = metrics.lastActivityAt ? new Date(metrics.lastActivityAt) : null;
  const elapsedDays = activity && !Number.isNaN(activity.getTime())
    ? Math.max(0, (now.getTime() - activity.getTime()) / DAY_MS)
    : settings.recencyWindowDays;
  const recency = weighted(1 - ratio(elapsedDays, settings.recencyWindowDays), settings.recencyWeight);
  const offerActivity = weighted(ratio(metrics.annualOfferCount, settings.annualOfferTarget), settings.offerActivityWeight);
  const conversion = weighted(
    metrics.decidedOfferCount > 0 ? ratio(metrics.wonOfferCount, metrics.decidedOfferCount) : 0,
    settings.conversionWeight
  );
  const activeWork = weighted(ratio(metrics.activeJobCount, settings.activeJobTarget), settings.activeWorkWeight);
  const completeness = weighted(
    metrics.completenessTotal > 0 ? ratio(metrics.completenessFilled, metrics.completenessTotal) : 0,
    settings.completenessWeight
  );
  const total = recency + offerActivity + conversion + activeWork + completeness;
  const label = total >= 80 ? "Stratejik" : total >= 60 ? "Güçlü" : total >= 35 ? "Gelişen" : "Başlangıç";
  return { total, label, recency, offerActivity, conversion, activeWork, completeness };
}
