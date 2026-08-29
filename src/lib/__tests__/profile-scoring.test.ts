import { describe, expect, it } from "vitest";
import {
  DEFAULT_PROFILE_SCORING_SETTINGS,
  calculateCustomerScore,
  calculateUserScore,
  profileScoringSettingsOf,
} from "@/lib/profile-scoring";

describe("profil puanlama", () => {
  it("kullanıcı bileşenlerini yönetim ağırlıklarıyla 100 üzerinden toplar", () => {
    expect(
      calculateUserScore(
        { activeDays: 12, activeSeconds: 10 * 3600 },
        "2026-08-29T08:00:00.000Z",
        new Date("2026-08-29T09:00:00.000Z"),
        DEFAULT_PROFILE_SCORING_SETTINGS.user
      )
    ).toMatchObject({ total: 100, recency: 35, consistency: 35, engagement: 30 });
  });

  it("müşteri puanını güncellik, teklif, dönüşüm, aktif iş ve bütünlükten üretir", () => {
    expect(
      calculateCustomerScore(
        {
          lastActivityAt: "2026-08-29T08:00:00.000Z",
          annualOfferCount: 6,
          decidedOfferCount: 4,
          wonOfferCount: 4,
          activeJobCount: 2,
          completenessFilled: 7,
          completenessTotal: 7,
        },
        new Date("2026-08-29T09:00:00.000Z"),
        DEFAULT_PROFILE_SCORING_SETTINGS.customer
      )
    ).toMatchObject({ total: 100, label: "Stratejik" });
  });

  it("toplamı 100 olmayan saklı ağırlıkları güvenli varsayılana döndürür", () => {
    const parsed = profileScoringSettingsOf({
      user: { recencyWeight: 99, consistencyWeight: 99, engagementWeight: 99 },
      customer: { recencyWeight: -1, activeJobTarget: 9 },
    });
    expect(parsed.user).toMatchObject(DEFAULT_PROFILE_SCORING_SETTINGS.user);
    expect(parsed.customer.recencyWeight).toBe(DEFAULT_PROFILE_SCORING_SETTINGS.customer.recencyWeight);
    expect(parsed.customer.activeJobTarget).toBe(9);
  });
});
