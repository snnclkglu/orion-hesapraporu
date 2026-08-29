// Uygulama kullanımı — bölüm eşleme, süre özeti ve kullanım skoru.
//
// Bu çekirdek SAFTIR: tarayıcı, React, HTTP veya veritabanı içe aktarmaz.
// Takip bileşeni yalnız aşağıdaki bölüm anahtarlarını gönderir; tam adres,
// kayıt kimliği, arama metni ve form içeriği bu katmana hiç girmez.

import {
  DEFAULT_PROFILE_SCORING_SETTINGS,
  calculateUserScore,
  type UserScore,
  type UserScoreSettings,
} from "@/lib/profile-scoring";

export const USAGE_SECTIONS = [
  "panel",
  "jobs",
  "offers",
  "engineering",
  "drawings",
  "purchasing",
  "catalog",
  "worklog",
  "sales",
  "personnel",
  "administration",
  "other",
] as const;

export type UsageSection = (typeof USAGE_SECTIONS)[number];
export type UsageDeviceClass = "desktop" | "tablet" | "mobile";

export const USAGE_SECTION_LABELS: Record<UsageSection, string> = {
  panel: "Panel",
  jobs: "İşler",
  offers: "Teklif",
  engineering: "Mühendislik",
  drawings: "Teknik Resimler",
  purchasing: "Satın Alma",
  catalog: "Katalog",
  worklog: "İş Takibi",
  sales: "Satış Takibi",
  personnel: "Personel",
  administration: "Yönetim",
  other: "Diğer",
};

export const USAGE_DEVICE_LABELS: Record<UsageDeviceClass, string> = {
  desktop: "Masaüstü",
  tablet: "Tablet",
  mobile: "Telefon",
};

/**
 * Açık adresi yalnız ANA BÖLÜME indirger.
 *
 * Kimlik ve alt yol burada bilerek atılır: `/jobs/<uuid>/edit` kayıtta yalnız
 * `jobs` olur. Böylece kullanım biçimi ölçülürken kullanıcının hangi müşteri,
 * personel veya belge üzerinde çalıştığı toplanmaz.
 */
export function usageSectionForPath(pathname: string): UsageSection {
  const path = pathname.split("?")[0].replace(/\/+$/, "") || "/";
  if (path === "/") return "panel";
  if (path.startsWith("/jobs")) return "jobs";
  if (path.startsWith("/offers")) return "offers";
  if (path.startsWith("/drawing-viewer") || path.startsWith("/drawings")) return "drawings";
  if (path.startsWith("/projects")) return "engineering";
  if (path.startsWith("/purchasing")) return "purchasing";
  if (path.startsWith("/katalog")) return "catalog";
  if (path.startsWith("/worklog")) return "worklog";
  if (path.startsWith("/sales")) return "sales";
  if (path.startsWith("/personnel")) return "personnel";
  if (path.startsWith("/admin")) return "administration";
  return "other";
}

/** Cihaz adı kullanıcı ajanından değil yalnız görünür alan genişliğinden gelir. */
export function usageDeviceClass(width: number): UsageDeviceClass {
  if (width < 640) return "mobile";
  if (width < 1024) return "tablet";
  return "desktop";
}

export interface UsageMetricRow {
  session_id: string;
  usage_date: string;
  section: string;
  device_class: string;
  started_at: string;
  last_seen_at: string;
  active_seconds: number;
  page_views: number;
}

export interface UsagePeriodSummary {
  activeSeconds: number;
  pageViews: number;
  sessionCount: number;
  activeDays: number;
}

export interface DailyUsageSummary {
  date: string;
  activeSeconds: number;
  pageViews: number;
}

export interface SectionUsageSummary {
  section: UsageSection;
  activeSeconds: number;
  pageViews: number;
  ratio: number;
}

export interface DeviceUsageSummary {
  device: UsageDeviceClass;
  activeSeconds: number;
  sessionCount: number;
  ratio: number;
}

export interface RecentUsageSession {
  sessionId: string;
  startedAt: string;
  lastSeenAt: string;
  activeSeconds: number;
  pageViews: number;
  device: UsageDeviceClass;
  primarySection: UsageSection;
}

export type UsageScore = UserScore;

export interface UsageAnalytics {
  lastSeenAt: string | null;
  currentlyActive: boolean;
  trackingStartedAt: string | null;
  last30: UsagePeriodSummary;
  allTime: UsagePeriodSummary;
  daily14: DailyUsageSummary[];
  sections30: SectionUsageSummary[];
  devices30: DeviceUsageSummary[];
  recentSessions: RecentUsageSession[];
  score: UsageScore | null;
}

const DAY_MS = 86_400_000;

function dateKeyInIstanbul(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: "year" | "month" | "day") =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function dayNumber(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const time = Date.UTC(year, month - 1, day);
  return Number.isFinite(time) ? Math.floor(time / DAY_MS) : null;
}

function dateKeyFromDayNumber(value: number): string {
  return new Date(value * DAY_MS).toISOString().slice(0, 10);
}

function daysAgo(value: string, today: string): number | null {
  const valueDay = dayNumber(value);
  const todayDay = dayNumber(today);
  if (valueDay === null || todayDay === null) return null;
  return todayDay - valueDay;
}

function safeSection(value: string): UsageSection {
  return (USAGE_SECTIONS as readonly string[]).includes(value)
    ? (value as UsageSection)
    : "other";
}

function safeDevice(value: string): UsageDeviceClass {
  return value === "mobile" || value === "tablet" || value === "desktop"
    ? value
    : "desktop";
}

function safeCount(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

function summarize(rows: readonly UsageMetricRow[]): UsagePeriodSummary {
  const sessions = new Set<string>();
  const days = new Set<string>();
  let activeSeconds = 0;
  let pageViews = 0;
  for (const row of rows) {
    activeSeconds += safeCount(row.active_seconds);
    pageViews += safeCount(row.page_views);
    sessions.add(row.session_id);
    days.add(row.usage_date);
  }
  return {
    activeSeconds,
    pageViews,
    sessionCount: sessions.size,
    activeDays: days.size,
  };
}

export function buildUsageAnalytics(
  rows: readonly UsageMetricRow[],
  now = new Date(),
  scoreSettings: UserScoreSettings = DEFAULT_PROFILE_SCORING_SETTINGS.user
): UsageAnalytics {
  const today = dateKeyInIstanbul(now);
  const normalized = rows
    .filter((row) => Boolean(row.session_id && row.usage_date && row.last_seen_at))
    .map((row) => ({
      ...row,
      section: safeSection(row.section),
      device_class: safeDevice(row.device_class),
      active_seconds: safeCount(row.active_seconds),
      page_views: safeCount(row.page_views),
    }));
  const last30Rows = normalized.filter((row) => {
    const age = daysAgo(row.usage_date, today);
    return age !== null && age >= 0 && age < 30;
  });
  const lastSeenAt = normalized.reduce<string | null>(
    (latest, row) => (!latest || row.last_seen_at > latest ? row.last_seen_at : latest),
    null
  );
  const trackingStartedAt = normalized.reduce<string | null>(
    (earliest, row) => (!earliest || row.started_at < earliest ? row.started_at : earliest),
    null
  );
  const last30 = summarize(last30Rows);

  const byDay = new Map<string, DailyUsageSummary>();
  for (const row of last30Rows) {
    const current = byDay.get(row.usage_date) ?? {
      date: row.usage_date,
      activeSeconds: 0,
      pageViews: 0,
    };
    current.activeSeconds += row.active_seconds;
    current.pageViews += row.page_views;
    byDay.set(row.usage_date, current);
  }
  const todayNumber = dayNumber(today) ?? 0;
  const daily14 = Array.from({ length: 14 }, (_, index) => {
    const date = dateKeyFromDayNumber(todayNumber - (13 - index));
    return byDay.get(date) ?? { date, activeSeconds: 0, pageViews: 0 };
  });

  const bySection = new Map<UsageSection, { activeSeconds: number; pageViews: number }>();
  for (const row of last30Rows) {
    const current = bySection.get(row.section) ?? { activeSeconds: 0, pageViews: 0 };
    current.activeSeconds += row.active_seconds;
    current.pageViews += row.page_views;
    bySection.set(row.section, current);
  }
  const sectionTotal = [...bySection.values()].reduce((sum, row) => sum + row.activeSeconds, 0);
  const sections30 = [...bySection.entries()]
    .map(([section, value]) => ({
      section,
      ...value,
      ratio: sectionTotal > 0 ? value.activeSeconds / sectionTotal : 0,
    }))
    .sort((a, b) => b.activeSeconds - a.activeSeconds || b.pageViews - a.pageViews);

  const sessionMap = new Map<
    string,
    RecentUsageSession & { sectionSeconds: Map<UsageSection, number> }
  >();
  for (const row of normalized) {
    const current = sessionMap.get(row.session_id) ?? {
      sessionId: row.session_id,
      startedAt: row.started_at,
      lastSeenAt: row.last_seen_at,
      activeSeconds: 0,
      pageViews: 0,
      device: row.device_class,
      primarySection: row.section,
      sectionSeconds: new Map<UsageSection, number>(),
    };
    if (row.started_at < current.startedAt) current.startedAt = row.started_at;
    if (row.last_seen_at > current.lastSeenAt) {
      current.lastSeenAt = row.last_seen_at;
      current.device = row.device_class;
    }
    current.activeSeconds += row.active_seconds;
    current.pageViews += row.page_views;
    current.sectionSeconds.set(
      row.section,
      (current.sectionSeconds.get(row.section) ?? 0) + row.active_seconds
    );
    sessionMap.set(row.session_id, current);
  }
  const recentSessions = [...sessionMap.values()]
    .map(({ sectionSeconds, ...session }) => ({
      ...session,
      primarySection:
        [...sectionSeconds.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? session.primarySection,
    }))
    .sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt))
    .slice(0, 12);

  const deviceMap = new Map<UsageDeviceClass, { activeSeconds: number; sessions: Set<string> }>();
  for (const row of last30Rows) {
    const current = deviceMap.get(row.device_class) ?? { activeSeconds: 0, sessions: new Set<string>() };
    current.activeSeconds += row.active_seconds;
    current.sessions.add(row.session_id);
    deviceMap.set(row.device_class, current);
  }
  const deviceTotal = [...deviceMap.values()].reduce((sum, value) => sum + value.activeSeconds, 0);
  const devices30 = [...deviceMap.entries()]
    .map(([device, value]) => ({
      device,
      activeSeconds: value.activeSeconds,
      sessionCount: value.sessions.size,
      ratio: deviceTotal > 0 ? value.activeSeconds / deviceTotal : 0,
    }))
    .sort((a, b) => b.activeSeconds - a.activeSeconds);

  return {
    lastSeenAt,
    currentlyActive: lastSeenAt
      ? now.getTime() - new Date(lastSeenAt).getTime() <= 2 * 60 * 1000
      : false,
    trackingStartedAt,
    last30,
    allTime: summarize(normalized),
    daily14,
    sections30,
    devices30,
    recentSessions,
    score: calculateUserScore(last30, lastSeenAt, now, scoreSettings),
  };
}

export function formatUsageDuration(seconds: number): string {
  const safe = safeCount(seconds);
  if (safe < 60) return safe === 0 ? "0 dk" : "1 dk'dan az";
  const totalMinutes = Math.round(safe / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} dk`;
  return minutes > 0 ? `${hours} sa ${minutes} dk` : `${hours} sa`;
}

/** Denetim kodunu, iç ad göstermeden yöneticiye okunur bir özete çevirir. */
export function auditActionLabel(action: string): string {
  const category = action.startsWith("admin.")
    ? "Yönetim"
    : action.startsWith("job.")
      ? "İşler"
      : action.startsWith("project.") || action.startsWith("revision.")
        ? "Mühendislik"
        : action.startsWith("drawing")
          ? "Teknik Resimler"
          : action.startsWith("purchase.")
            ? "Satın Alma"
            : action.startsWith("offer.")
              ? "Teklif"
              : action.startsWith("worklog.")
                ? "İş Takibi"
                : action.startsWith("sales.")
                  ? "Satış Takibi"
                  : action.startsWith("personnel.")
                    ? "Personel"
                    : action.startsWith("customer.")
                      ? "Müşteri Defteri"
                      : "Uygulama";
  const verb = /(?:delete|clear|remove)$/.test(action)
    ? "kayıt sildi"
    : /(?:create|add)$/.test(action)
      ? "kayıt oluşturdu"
      : /(?:issue)$/.test(action)
        ? "revizyon yayımladı"
        : /(?:unlock)$/.test(action)
          ? "kilit açtı"
          : /(?:open)$/.test(action)
            ? "belge açtı"
            : /(?:copy|duplicate)$/.test(action)
              ? "kayıt kopyaladı"
              : /(?:status)$/.test(action)
                ? "durum değiştirdi"
                : "kayıt güncelledi";
  return `${category} · ${verb}`;
}
