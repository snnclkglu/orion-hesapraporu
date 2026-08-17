// Olay sözlüğünün davranışını DONDURUR: on olay türünün hepsi Türkçe ad
// üretir, bilinmeyen slug ekrana HAM DÜŞMEZ, özetler anlamlı cümledir.
// Sözlüğün iki tüketicisi var (iş akış sekmesi + panel Son Hareketler) —
// bu test ikisinin ortak dilini korur.

import { describe, expect, it } from "vitest";
import {
  OLAY_ADLARI,
  olayAdi,
  olayOzeti,
  olaySinifi,
} from "@/lib/jobs/event-labels";

const TUM_OLAYLAR = [
  "olusturuldu",
  "guncellendi",
  "durum",
  "durum_oto",
  "silindi",
  "gorev_acildi",
  "gorev_kapandi",
  "gorev_atandi",
  "yorum",
  "carpan",
];

describe("olayAdi", () => {
  it("on olay türünün hepsi Türkçe ad üretir", () => {
    for (const olay of TUM_OLAYLAR) {
      expect(OLAY_ADLARI[olay], olay).toBeTruthy();
      expect(olayAdi(olay)).toBe(OLAY_ADLARI[olay]);
    }
  });

  it("bilinmeyen slug ham düşmez", () => {
    expect(olayAdi("gorev_x")).toBe("Değişiklik");
  });
});

describe("olayOzeti", () => {
  it("durum geçişi iki Türkçe durum adıyla yazılır", () => {
    expect(
      olayOzeti({ event: "durum", detail: { from: "active", to: "completed" } })
    ).toBe("Aktif → Tamamlandı");
  });

  it("görev olayları başlığı taşır", () => {
    expect(
      olayOzeti({ event: "gorev_atandi", detail: { title: "HALAT SİPARİŞİ" } })
    ).toBe("HALAT SİPARİŞİ");
  });

  it("söyleyecek şeyi olmayan olay SUSAR (boş dizge)", () => {
    expect(olayOzeti({ event: "silindi", detail: {} })).toBe("");
    expect(olayOzeti({ event: "bilinmeyen", detail: { x: 1 } })).toBe("");
  });
});

describe("olaySinifi", () => {
  it("yıkıcı olay ayrışır, durum birincil renktedir, gerisi sessizdir", () => {
    expect(olaySinifi("silindi")).toContain("destructive");
    expect(olaySinifi("durum")).toContain("primary");
    expect(olaySinifi("yorum")).toContain("muted");
  });
});
