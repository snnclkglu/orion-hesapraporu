// Rulman markası bağı — kutular ORTAK markayı paylaşır.
//
// Sınanan şey bir sayı değil bir KURALDIR: marka bölüm bölüm verilen bir karar
// değildir, ama bağdan çıkarılmış bir kutu kendi markasını tutar. İkisinden
// biri bozulursa ekipman listesi ya tek markayı beş kez yazamaz ya da
// mühendisin ayırdığı kutuyu geri eşitler.

import { describe, expect, it } from "vitest";
import {
  BEARING_BRAND_AUTO_FLAGS,
  applyBearingBrand,
  bearingBrandFieldOf,
  bearingBrandFields,
} from "../bearing-brand";
import { BEARING_BRANDS } from "../fields";
import { NEW_WORK_TEMPLATE } from "../defaults";
import { CALC_FIELD, loadRevision } from "@/lib/revision-load";
import { MODULE_ORDER } from "../presentation/module-family";

/** Bir bölümün rulman markası kutularının hepsi otomatik olan asgari durum. */
function moduleWith(key: Parameters<typeof bearingBrandFields>[0], brand?: string) {
  const inputs: Record<string, unknown> = {};
  const selections: Record<string, unknown> = {};
  for (const f of bearingBrandFields(key)) {
    inputs[f.flag] = true;
    if (brand !== undefined) selections[f.selection] = brand;
  }
  return { inputs, selections };
}

describe("rulman markası kutuları", () => {
  it("her rulman bölümünün bir marka kutusu vardır", () => {
    // Kanca rulmanı kutusu marka SORMUYORDU (kullanıcı bildirimi, 24.08.2026);
    // eksik kalan kutu ekipman listesinin marka sütununa rulman tipini
    // yazdırıyordu.
    expect(bearingBrandFieldOf("main", "bearingBrand")).toBeDefined();
    expect(bearingBrandFieldOf("main", "balanceBearingBrand")).toBeDefined();
    expect(bearingBrandFieldOf("hookBlock", "sheaveBearingBrand")).toBeDefined();
    expect(bearingBrandFieldOf("hookBlock", "hookBearingBrand")).toBeDefined();
    expect(bearingBrandFieldOf("bridge", "bearingBrand")).toBeDefined();
  });

  it("aynı aileye giren bütün bölümler aynı kutuları taşır", () => {
    for (const key of ["aux", "mono1", "mono2"] as const) {
      expect(bearingBrandFields(key)).toEqual(bearingBrandFields("main"));
    }
    for (const key of ["auxHookBlock", "mono1HookBlock", "mono2HookBlock"] as const) {
      expect(bearingBrandFields(key)).toEqual(bearingBrandFields("hookBlock"));
    }
    for (const key of ["trolley", "auxTrolley", "mono1Trolley"] as const) {
      expect(bearingBrandFields(key)).toEqual(bearingBrandFields("bridge"));
    }
  });

  it("rulmanı olmayan bölümlerde kutu yoktur", () => {
    for (const key of ["girder", "buckling", "wheelLoads", "cabin"] as const) {
      expect(bearingBrandFields(key)).toHaveLength(0);
    }
  });
});

describe("applyBearingBrand", () => {
  it("otomatik olan bütün kutulara ortak markayı yazar", () => {
    const mods = {
      main: moduleWith("main"),
      hookBlock: moduleWith("hookBlock"),
      bridge: moduleWith("bridge"),
    };
    const out = applyBearingBrand(mods, "SKF");
    expect((out.main.selections as Record<string, unknown>).bearingBrand).toBe("SKF");
    expect((out.main.selections as Record<string, unknown>).balanceBearingBrand).toBe("SKF");
    expect((out.hookBlock.selections as Record<string, unknown>).sheaveBearingBrand).toBe("SKF");
    expect((out.hookBlock.selections as Record<string, unknown>).hookBearingBrand).toBe("SKF");
    expect((out.bridge.selections as Record<string, unknown>).bearingBrand).toBe("SKF");
  });

  it("BAĞDAN ÇIKARILMIŞ kutuya dokunmaz", () => {
    const mods = {
      main: moduleWith("main", "FAG"),
      hookBlock: {
        // Kanca rulmanı bağdan çıkarılmış: yalnız o kutu kendi markasını tutar.
        inputs: { sheaveBearingBrandAuto: true, hookBearingBrandAuto: false },
        selections: { sheaveBearingBrand: "FAG", hookBearingBrand: "TIMKEN" },
      },
    };
    const out = applyBearingBrand(mods, "SKF");
    expect((out.hookBlock.selections as Record<string, unknown>).sheaveBearingBrand).toBe("SKF");
    expect((out.hookBlock.selections as Record<string, unknown>).hookBearingBrand).toBe("TIMKEN");
  });

  it("AYNI BÖLÜMDEKİ ikinci kutuyu da yazar", () => {
    // Kaldırma grubunda iki rulman kutusu vardır (tambur + denge). Marka
    // tambur kutusunda seçildiğinde denge kutusu da değişmelidir; yayılım
    // başlatan bölümü atlarsa o kutu bağın dışında kalırdı.
    const mods = {
      main: {
        inputs: { bearingBrandAuto: true, balanceBearingBrandAuto: true },
        selections: { bearingBrand: "SKF", balanceBearingBrand: "" },
      },
    };
    const out = applyBearingBrand(mods, "SKF");
    expect((out.main.selections as Record<string, unknown>).balanceBearingBrand).toBe("SKF");
  });

  it("değişen bir şey yoksa AYNI nesneyi döndürür (boş türetme turu açılmasın)", () => {
    const mods = { main: moduleWith("main", "SKF") };
    expect(applyBearingBrand(mods, "SKF")).toBe(mods);
  });

  it("çoklu seçimi olduğu gibi taşır (marka listesi de bir değerdir)", () => {
    const mods = { main: moduleWith("main"), bridge: moduleWith("bridge") };
    const joined = `${BEARING_BRANDS[0]}, ${BEARING_BRANDS[1]}`;
    const out = applyBearingBrand(mods, joined);
    expect((out.bridge.selections as Record<string, unknown>).bearingBrand).toBe(joined);
  });
});

describe("yeni iş şablonu", () => {
  it("bütün rulman markası kutuları bağlı açılır", () => {
    const tpl = NEW_WORK_TEMPLATE as unknown as Record<
      string,
      { inputs: Record<string, unknown> } | undefined
    >;
    for (const key of MODULE_ORDER) {
      const state = tpl[CALC_FIELD[key]];
      if (!state) continue;
      for (const f of bearingBrandFields(key)) {
        expect(state.inputs[f.flag], `${key}.${f.flag}`).toBe(true);
      }
    }
  });
});

describe("eski revizyon koruması", () => {
  // Bağ YENİDİR: kayıtta anahtar yoksa markalar ELLE seçilmiştir ve şablondan
  // `true` miras kalırsa yayınlanmış bir rapor ilk açılışta kendi kendini
  // eşitlerdi.
  /** Kayıtlı bir revizyon: şablonun girdileri, ama YENİ anahtar hiç yok. */
  function storedWithout(flag: string): Record<string, unknown> {
    const tpl = NEW_WORK_TEMPLATE as unknown as Record<
      string,
      { inputs: Record<string, unknown> } | undefined
    >;
    const out: Record<string, unknown> = { specs: {}, disabledModules: [] };
    for (const key of MODULE_ORDER) {
      const field = CALC_FIELD[key];
      const state = tpl[field];
      if (!state) continue;
      const inputs = { ...state.inputs };
      delete inputs[flag];
      out[field] = inputs;
    }
    return out;
  }

  for (const flag of BEARING_BRAND_AUTO_FLAGS) {
    it(`${flag}: kayıtta anahtar yoksa KAPALI yüklenir`, () => {
      const loaded = loadRevision(storedWithout(flag), null);
      const full = loaded.full as unknown as Record<
        string,
        { inputs: Record<string, unknown> } | undefined
      >;
      for (const key of MODULE_ORDER) {
        const state = full[CALC_FIELD[key]];
        if (!state) continue;
        if (!bearingBrandFields(key).some((f) => f.flag === flag)) continue;
        expect(state.inputs[flag], `${key}.${flag}`).toBe(false);
      }
    });

    it(`${flag}: kayıtta anahtar açıksa açık kalır`, () => {
      const stored = storedWithout(flag);
      for (const key of MODULE_ORDER) {
        const field = CALC_FIELD[key];
        const rec = stored[field] as Record<string, unknown> | undefined;
        if (!rec) continue;
        if (!bearingBrandFields(key).some((f) => f.flag === flag)) continue;
        stored[field] = { ...rec, [flag]: true };
      }
      const loaded = loadRevision(stored, null);
      const full = loaded.full as unknown as Record<
        string,
        { inputs: Record<string, unknown> } | undefined
      >;
      for (const key of MODULE_ORDER) {
        const state = full[CALC_FIELD[key]];
        if (!state) continue;
        if (!bearingBrandFields(key).some((f) => f.flag === flag)) continue;
        expect(state.inputs[flag], `${key}.${flag}`).toBe(true);
      }
    });
  }
});
