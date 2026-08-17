// Hızlı eylem şeridinin rol haritasını DONDURUR (roles.test.ts deseni):
// bir rol yeni bir kapı kazandığında ya da kaybettiğinde bu test bilinçli
// olarak güncellenmek zorundadır — sessiz genişleme olmaz. Etiketlerde kod
// adı geçmez kuralı da (md. 15) burada tutulur.

import { describe, expect, it } from "vitest";
import { PANEL_ACTIONS, visiblePanelActions } from "@/lib/panel-actions";
import { USER_ROLES } from "@/lib/roles";

describe("visiblePanelActions — rol → eylem kümesi", () => {
  const beklenen: Record<string, string[]> = {
    admin: [
      "Yeni İş",
      "Görev Panosu",
      "Hesap Raporları",
      "Resim Yükle",
      "Talep Havuzu",
      "Sarf Girişi",
      "Günlük Giriş",
      "Maaş",
    ],
    manager: ["Yeni İş", "Görev Panosu", "Günlük Giriş", "Maaş"],
    engineer: ["Yeni İş", "Görev Panosu", "Hesap Raporları", "Resim Yükle"],
    draftsman: ["Yeni İş", "Görev Panosu", "Resim Yükle"],
    purchasing: ["Yeni İş", "Görev Panosu", "Talep Havuzu", "Sarf Girişi"],
    planning: ["Yeni İş", "Görev Panosu", "Talep Havuzu"],
    quality: ["Yeni İş", "Görev Panosu"],
    production: ["Yeni İş", "Görev Panosu"],
  };

  it("sekiz rolün tamamı için küme SABİTTİR", () => {
    for (const rol of USER_ROLES) {
      expect(
        visiblePanelActions(rol).map((a) => a.label),
        `rol: ${rol}`
      ).toEqual(beklenen[rol]);
    }
  });

  it("bilinmeyen rol MÜHENDİS varsayılır (roleOf kuralı)", () => {
    // roles.ts yardımcıları bilinmeyen değeri `roleOf` ile mühendise indirger
    // — profil satırı bozulsa bile kullanıcı varsayılan kapılarını korur.
    expect(visiblePanelActions("bilinmeyen").map((a) => a.label)).toEqual(
      beklenen.engineer
    );
  });

  it("etikette fonksiyon/kod adı geçmez", () => {
    for (const a of PANEL_ACTIONS) {
      expect(a.label).not.toMatch(/[a-z][A-Z]|_|\(\)/);
    }
  });

  it("her eylemin adresi uygulama içidir", () => {
    for (const a of PANEL_ACTIONS) {
      expect(a.href.startsWith("/")).toBe(true);
    }
  });
});
