// Pastel etiket kuralları — müşteri kısaltması, renk dağıtımı, kapsam tonları.

import { describe, expect, it } from "vitest";
import {
  autoShortName,
  customerTag,
  hueFromText,
  nextDistinctHue,
  normalizeHue,
  SALE_SCOPES,
  scopeHue,
  scopeLabel,
} from "../tags";

describe("autoShortName", () => {
  it("adın ilk kelimesini alır (firma kuralı)", () => {
    expect(autoShortName("LITEC MAKİNA SAN. VE TİC. A.Ş.")).toBe("LITEC");
    expect(
      autoShortName("Sİ-MA MAKİNA ELEKTRİK ELEKTRONİK İNŞ.KİMYEVİ MAD.PET.ÜRÜN.SAN.TİC.LTD.ŞTİ")
    ).toBe("Sİ-MA");
    expect(autoShortName("ASTOR A.Ş.")).toBe("ASTOR");
  });

  it("tek kelimelik adı olduğu gibi bırakır", () => {
    expect(autoShortName("HABAŞ")).toBe("HABAŞ");
    expect(autoShortName("PİMSUN")).toBe("PİMSUN");
  });

  it("sondaki noktalama kısaltmaya taşınmaz", () => {
    expect(autoShortName("ORHUN, MAKİNA")).toBe("ORHUN");
  });

  it("boş ad boş kısaltma verir (çağıran tam ada düşer)", () => {
    expect(autoShortName("")).toBe("");
    expect(autoShortName("   ")).toBe("");
  });
});

describe("customerTag", () => {
  it("defterdeki kısaltma ve rengi kullanır", () => {
    const tag = customerTag({ name: "ASTOR A.Ş.", shortName: "ASTOR", hue: 148 });
    expect(tag).toEqual({ short: "ASTOR", full: "ASTOR A.Ş.", hue: 148 });
  });

  it("deftere bağlı olmayan müşteride addan türetir — ekran renksiz kalmaz", () => {
    const tag = customerTag({ name: "HABAŞ SINAİ VE TIBBİ GAZLAR" });
    expect(tag.short).toBe("HABAŞ");
    expect(tag.hue).toBe(hueFromText("HABAŞ SINAİ VE TIBBİ GAZLAR"));
    expect(tag.hue).toBeGreaterThanOrEqual(0);
    expect(tag.hue).toBeLessThan(360);
  });

  it("kısaltması boş bırakılmış defter kaydında da ad görünür", () => {
    expect(customerTag({ name: "MTC PASLANMAZ", shortName: "", hue: 10 }).short).toBe("MTC");
  });
});

describe("hueFromText", () => {
  it("aynı metin her zaman aynı tonu verir (sunucu/istemci aynı rengi çizmeli)", () => {
    expect(hueFromText("KARDEMİR A.Ş.")).toBe(hueFromText("KARDEMİR A.Ş."));
    expect(hueFromText("kardemir a.ş.")).toBe(hueFromText("KARDEMİR A.Ş."));
  });

  it("ton aralığı 0–359", () => {
    for (const s of ["a", "ASTOR", "İSDEMİR", "çok uzun bir müşteri adı olabilir"]) {
      const h = hueFromText(s);
      expect(Number.isInteger(h)).toBe(true);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(360);
    }
  });
});

describe("nextDistinctHue", () => {
  it("boş defterde ilk tonu verir", () => {
    expect(nextDistinctHue([])).toBe(0);
  });

  it("var olan tonlardan en uzak noktayı seçer", () => {
    // Tek ton varsa karşı taraf seçilir (yaklaşık 180° uzak).
    const hue = nextDistinctHue([0]);
    const gap = Math.min(Math.abs(hue - 0), 360 - Math.abs(hue - 0));
    expect(gap).toBeGreaterThanOrEqual(175);
  });

  it("art arda eklenen müşteriler birbirine benzemez", () => {
    const used: number[] = [];
    for (let i = 0; i < 8; i++) used.push(nextDistinctHue(used));
    // 8 müşteride en yakın iki ton arası en az 40° olmalı
    let enYakin = 360;
    for (let i = 0; i < used.length; i++) {
      for (let j = i + 1; j < used.length; j++) {
        const d = Math.abs(used[i] - used[j]);
        enYakin = Math.min(enYakin, Math.min(d, 360 - d));
      }
    }
    expect(enYakin).toBeGreaterThanOrEqual(40);
    expect(new Set(used).size).toBe(used.length);
  });
});

describe("normalizeHue", () => {
  it("aralık dışını çembere sarar", () => {
    expect(normalizeHue(360)).toBe(0);
    expect(normalizeHue(-30)).toBe(330);
    expect(normalizeHue(725)).toBe(5);
    expect(normalizeHue(Number.NaN)).toBe(0);
  });
});

describe("kapsam etiketleri", () => {
  it("her sabit kapsamın kendi tonu vardır ve tonlar çakışmaz", () => {
    const hues = SALE_SCOPES.map(scopeHue);
    expect(new Set(hues).size).toBe(SALE_SCOPES.length);
  });

  it("listede olmayan kapsam da renk alır (devralınan serbest metinler)", () => {
    const h = scopeHue("Köprü İmalatı. Elektrik, Devreye Alma ve Araba Hariç");
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThan(360);
  });

  it("kapsam etiketi tek satıra indirilir ve kırpılır", () => {
    expect(scopeLabel("Köprü İmalatı.\nElektrik, Devreye Alma Hariç")).toBe(
      "Köprü İmalatı. · Elektrik, Devreye Alma Hariç"
    );
    const uzun = scopeLabel("A".repeat(80));
    expect(uzun.length).toBe(46);
    expect(uzun.endsWith("…")).toBe(true);
  });
});
