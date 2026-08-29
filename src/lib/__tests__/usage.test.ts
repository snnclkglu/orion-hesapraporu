import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  USAGE_SECTIONS,
  auditActionLabel,
  buildUsageAnalytics,
  formatUsageDuration,
  usageDeviceClass,
  usageSectionForPath,
  type UsageMetricRow,
} from "../usage";

function row(overrides: Partial<UsageMetricRow> = {}): UsageMetricRow {
  return {
    session_id: "10000000-0000-4000-8000-000000000001",
    usage_date: "2026-08-29",
    section: "engineering",
    device_class: "desktop",
    started_at: "2026-08-29T07:00:00.000Z",
    last_seen_at: "2026-08-29T07:30:00.000Z",
    active_seconds: 1800,
    page_views: 4,
    ...overrides,
  };
}

describe("kullanım bölümü", () => {
  it("kayıt kimliğini ve alt adresi yalnız ana bölüme indirger", () => {
    expect(usageSectionForPath("/jobs/abc/edit")).toBe("jobs");
    expect(usageSectionForPath("/projects/abc/revisions/def")).toBe("engineering");
    expect(usageSectionForPath("/drawings/abc/progress")).toBe("drawings");
    expect(usageSectionForPath("/admin/users/abc")).toBe("administration");
    expect(usageSectionForPath("/")).toBe("panel");
  });

  it("bilinmeyen adresi güvenli Diğer bölümüne alır", () => {
    expect(usageSectionForPath("/gelecekteki-bolum/kayit")).toBe("other");
  });

  it("cihaz sınıfı yalnız görünür alan genişliğidir", () => {
    expect(usageDeviceClass(375)).toBe("mobile");
    expect(usageDeviceClass(768)).toBe("tablet");
    expect(usageDeviceClass(1440)).toBe("desktop");
  });
});

describe("kullanım özeti", () => {
  const now = new Date("2026-08-29T08:00:00.000Z");

  it("oturumları, günleri, bölümleri ve cihazları çift saymadan toplar", () => {
    const summary = buildUsageAnalytics(
      [
        row(),
        row({ section: "drawings", active_seconds: 900, page_views: 2 }),
        row({
          session_id: "10000000-0000-4000-8000-000000000002",
          usage_date: "2026-08-28",
          section: "jobs",
          device_class: "mobile",
          started_at: "2026-08-28T09:00:00.000Z",
          last_seen_at: "2026-08-28T09:10:00.000Z",
          active_seconds: 600,
          page_views: 3,
        }),
      ],
      now
    );

    expect(summary.last30).toEqual({
      activeSeconds: 3300,
      pageViews: 9,
      sessionCount: 2,
      activeDays: 2,
    });
    expect(summary.sections30.map((item) => item.section)).toEqual([
      "engineering",
      "drawings",
      "jobs",
    ]);
    expect(summary.devices30.map((item) => item.device)).toEqual(["desktop", "mobile"]);
    expect(summary.recentSessions).toHaveLength(2);
  });

  it("gelecek günü son 30 güne katmaz ve boş günleri grafikte korur", () => {
    const summary = buildUsageAnalytics(
      [row(), row({ usage_date: "2026-08-30", active_seconds: 9999 })],
      now
    );
    expect(summary.last30.activeSeconds).toBe(1800);
    expect(summary.daily14).toHaveLength(14);
    expect(summary.daily14.at(-1)).toMatchObject({ date: "2026-08-29", activeSeconds: 1800 });
  });

  it("skor rol veya bölüm çeşitliliğini değil güncellik, aktif gün ve süreyi kullanır", () => {
    const rows = Array.from({ length: 12 }, (_, index) =>
      row({
        session_id: `10000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
        usage_date: `2026-08-${String(29 - index).padStart(2, "0")}`,
        active_seconds: 3000,
      })
    );
    const summary = buildUsageAnalytics(rows, now);
    expect(summary.score).toMatchObject({ total: 100, label: "Güçlü" });
  });

  it("veri yoksa sıfır performans iddiası yerine skor üretmez", () => {
    expect(buildUsageAnalytics([], now).score).toBeNull();
  });
});

describe("sunum metinleri", () => {
  it("süreyi Türkçe ve okunur biçimler", () => {
    expect(formatUsageDuration(0)).toBe("0 dk");
    expect(formatUsageDuration(45)).toBe("1 dk'dan az");
    expect(formatUsageDuration(7500)).toBe("2 sa 5 dk");
  });

  it("denetim kodunu ekranda iç ad göstermeden açıklar", () => {
    expect(auditActionLabel("offer.revision_issue")).toBe("Teklif · revizyon yayımladı");
    expect(auditActionLabel("job.create")).toBe("İşler · kayıt oluşturdu");
  });
});

describe("SQL ve TypeScript bölüm sözlüğü ayrışmamalı", () => {
  const migration = readFileSync(
    join(process.cwd(), "supabase/migrations/20260829000002_user_usage_metrics.sql"),
    "utf8"
  );

  it("migration bütün istemci bölüm anahtarlarını kabul ediyor", () => {
    for (const section of USAGE_SECTIONS) {
      expect(migration, section).toContain(`'${section}'`);
    }
  });

  it("ham yol veya sayfa içeriği için sütun açmıyor", () => {
    expect(migration).not.toMatch(/\b(path|url|query|payload|content)\b/i);
  });
});
