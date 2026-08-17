// Panel tercih sözleşmesini DONDURUR: bozuk/gelecek-sürümlü kayıt varsayılana
// döner, bilinmeyen kimlik sessizce düşer, katlanamaz bölüm katlı listesine
// giremez. Tercih tablosundaki hiçbir değer açılış sayfasını düşüremez.

import { describe, expect, it } from "vitest";
import {
  COLLAPSIBLE_SECTION_IDS,
  PANEL_SECTION_IDS,
  PANEL_SECTION_LABELS,
  configToPrefs,
  prefsToConfig,
} from "@/lib/panel-prefs";

describe("configToPrefs", () => {
  it("boş nesne ve null varsayılana döner", () => {
    expect(configToPrefs({})).toEqual({ hidden: [], collapsed: [] });
    expect(configToPrefs(null)).toEqual({ hidden: [], collapsed: [] });
    expect(configToPrefs("bozuk")).toEqual({ hidden: [], collapsed: [] });
  });

  it("tanınmayan sürüm VARSAYILANA döner (yarım anlamak yok)", () => {
    expect(configToPrefs({ v: 2, hidden: ["alan"] })).toEqual({
      hidden: [],
      collapsed: [],
    });
    expect(configToPrefs({ hidden: ["alan"] })).toEqual({
      hidden: [],
      collapsed: [],
    });
  });

  it("bilinmeyen kimlik sessizce düşer, tekrarlar tekilleşir", () => {
    expect(
      configToPrefs({ v: 1, hidden: ["alan", "yok-boyle", "alan", 5] })
    ).toEqual({ hidden: ["alan"], collapsed: [] });
  });

  it("katlanamaz bölüm katlı listesine giremez", () => {
    expect(
      configToPrefs({ v: 1, collapsed: ["hizli", "yapilacak", "ajanda"] })
    ).toEqual({ hidden: [], collapsed: ["ajanda"] });
  });
});

describe("prefsToConfig", () => {
  it("sürüm damgasıyla ve temizlenmiş listelerle yazar", () => {
    expect(
      prefsToConfig({
        hidden: ["akis", "akis"],
        collapsed: ["sinyal"],
      })
    ).toEqual({ v: 1, hidden: ["akis"], collapsed: ["sinyal"] });
  });
});

describe("kimlik sözlüğü", () => {
  it("her kimliğin Türkçe etiketi var", () => {
    for (const id of PANEL_SECTION_IDS) {
      expect(PANEL_SECTION_LABELS[id], id).toBeTruthy();
    }
  });

  it("katlanabilir küme bilinen kimliklerin alt kümesidir", () => {
    for (const id of COLLAPSIBLE_SECTION_IDS) {
      expect(PANEL_SECTION_IDS).toContain(id);
    }
  });
});
