import { describe, expect, it } from "vitest";
import {
  COMMON_REEVINGS,
  commonReevingByLabel,
  deriveReeving,
  reevingLabel,
  validateReeving,
  type Reeving,
} from "../reeving";

/** Test fikstürü — geçerli bir donanım tanımı üretir. */
function reeving(over: Partial<Reeving> = {}): Reeving {
  return {
    drivenFalls: 2,
    totalFalls: 2,
    fixedSheaveCount: 0,
    sheaveEfficiency: 0.985,
    ...over,
  };
}

/**
 * Mevcut kaldırma grubu motorundaki halat verimi bağıntısının birebir
 * kopyası. Motorun sayısı değişmemeli; bu bağımsız kopya, referans olarak
 * karşılaştırma için kullanılır.
 */
function referenceRopeEfficiency(r: Reeving): number {
  const i = r.totalFalls / r.drivenFalls;
  return (
    ((r.sheaveEfficiency ** r.fixedSheaveCount) / i) *
    ((1 - r.sheaveEfficiency ** i) / (1 - r.sheaveEfficiency))
  );
}

describe("deriveReeving — kapalı çözümler", () => {
  it("2/2 donanımında mekanik avantaj 1, halat verimi 1'dir", () => {
    const d = deriveReeving(reeving());
    expect(d.mechanicalAdvantage).toBe(1);
    expect(d.ropeEfficiency).toBeCloseTo(1, 12);
    expect(d.label).toBe("2/2");
  });

  it("2/4 donanımında verim (1 + η)/2 kapalı biçimine eşittir", () => {
    const eta = 0.985;
    const d = deriveReeving(reeving({ totalFalls: 4 }));
    expect(d.mechanicalAdvantage).toBe(2);
    expect(d.ropeEfficiency).toBeCloseTo((1 + eta) / 2, 12);
    expect(d.ropeEfficiency).toBeCloseTo(0.9925, 12);
  });

  it("4/8 donanımının makara ve rulman adetleri", () => {
    const d = deriveReeving(reeving({ drivenFalls: 4, totalFalls: 8 }));
    expect(d.label).toBe("4/8");
    expect(d.mechanicalAdvantage).toBe(2);
    expect(d.blockSheaveCount).toBe(4);
    expect(d.topSheaveCount).toBe(2);
    expect(d.sheaveBearingCount).toBe(8);
    expect(d.drumRopeEnds).toBe(4);
  });

  it("2/2 donanımında üst (sabit) makara yoktur", () => {
    const d = deriveReeving(reeving());
    expect(d.topSheaveCount).toBe(0);
    expect(d.blockSheaveCount).toBe(1);
    expect(d.sheaveBearingCount).toBe(2);
    expect(d.drumRopeEnds).toBe(2);
  });

  it("sabit makara adedi verimi η_m^s kadar düşürür", () => {
    const eta = 0.985;
    const withoutFixed = deriveReeving(reeving({ totalFalls: 4 }));
    const withFixed = deriveReeving(reeving({ totalFalls: 4, fixedSheaveCount: 2 }));
    expect(withFixed.ropeEfficiency).toBeCloseTo(
      withoutFixed.ropeEfficiency * eta ** 2,
      12
    );
    expect(withFixed.ropeEfficiency).toBeLessThan(withoutFixed.ropeEfficiency);
  });

  it("makara verimi düştükçe halat verimi düşer", () => {
    const a = deriveReeving(reeving({ totalFalls: 8, drivenFalls: 4, sheaveEfficiency: 0.985 }));
    const b = deriveReeving(reeving({ totalFalls: 8, drivenFalls: 4, sheaveEfficiency: 0.96 }));
    expect(b.ropeEfficiency).toBeLessThan(a.ropeEfficiency);
  });
});

describe("deriveReeving — mevcut motorla birebir aynı sonuç", () => {
  const cases: Reeving[] = [
    { drivenFalls: 2, totalFalls: 2, fixedSheaveCount: 0, sheaveEfficiency: 0.985 },
    { drivenFalls: 2, totalFalls: 4, fixedSheaveCount: 0, sheaveEfficiency: 0.985 },
    { drivenFalls: 2, totalFalls: 4, fixedSheaveCount: 2, sheaveEfficiency: 0.985 },
    { drivenFalls: 4, totalFalls: 8, fixedSheaveCount: 1, sheaveEfficiency: 0.98 },
    { drivenFalls: 1, totalFalls: 4, fixedSheaveCount: 3, sheaveEfficiency: 0.96 },
    { drivenFalls: 4, totalFalls: 4, fixedSheaveCount: 0, sheaveEfficiency: 0.98 },
  ];

  for (const c of cases) {
    it(`${c.drivenFalls}/${c.totalFalls} (s=${c.fixedSheaveCount}, η=${c.sheaveEfficiency})`, () => {
      const d = deriveReeving(c);
      expect(d.mechanicalAdvantage).toBe(c.totalFalls / c.drivenFalls);
      // Kayan nokta işlem sırası aynı olduğu için tam eşitlik beklenir.
      expect(d.ropeEfficiency).toBe(referenceRopeEfficiency(c));
    });
  }
});

describe("deriveReeving — sınır durumları", () => {
  it("η = 1'de bölme sıfıra gitmez, verim 1 çıkar", () => {
    const d = deriveReeving(reeving({ totalFalls: 4, sheaveEfficiency: 1 }));
    expect(Number.isFinite(d.ropeEfficiency)).toBe(true);
    expect(d.ropeEfficiency).toBeCloseTo(1, 12);
  });

  it("η, 1'e çok yakınken sonuç sürekli kalır", () => {
    const near = deriveReeving(reeving({ totalFalls: 4, sheaveEfficiency: 1 - 1e-10 }));
    expect(Number.isFinite(near.ropeEfficiency)).toBe(true);
    expect(near.ropeEfficiency).toBeCloseTo(1, 9);
  });

  it("geçersiz sayılar sonucu bozmaz (NaN üretmez)", () => {
    const d = deriveReeving({
      drivenFalls: Number.NaN,
      totalFalls: 0,
      fixedSheaveCount: -3,
      sheaveEfficiency: Number.NaN,
    });
    expect(Number.isFinite(d.mechanicalAdvantage)).toBe(true);
    expect(Number.isFinite(d.ropeEfficiency)).toBe(true);
    expect(d.blockSheaveCount).toBeGreaterThanOrEqual(1);
    expect(d.topSheaveCount).toBeGreaterThanOrEqual(0);
  });

  it("tahrikli kol sayısı toplamı aşarsa toplamla sınırlanır", () => {
    const d = deriveReeving(reeving({ drivenFalls: 8, totalFalls: 4 }));
    expect(d.mechanicalAdvantage).toBe(1);
    expect(d.drumRopeEnds).toBe(4);
    expect(d.topSheaveCount).toBe(0);
  });

  it("tek sayılı toplam kol sayısında makara adedi yukarı yuvarlanır", () => {
    const d = deriveReeving(reeving({ drivenFalls: 1, totalFalls: 3 }));
    expect(d.blockSheaveCount).toBe(2);
    expect(d.sheaveBearingCount).toBe(4);
  });
});

describe("reevingLabel", () => {
  it("tahrikli/toplam biçiminde etiket üretir", () => {
    expect(reevingLabel({ drivenFalls: 2, totalFalls: 4 })).toBe("2/4");
    expect(reevingLabel({ drivenFalls: 4, totalFalls: 8 })).toBe("4/8");
  });

  it("tahrikli kol sayısı toplamı aşarsa etikette de sınırlanır", () => {
    expect(reevingLabel({ drivenFalls: 6, totalFalls: 4 })).toBe("4/4");
  });
});

describe("validateReeving", () => {
  it("geçerli donanımda bulgu üretmez", () => {
    expect(validateReeving(reeving())).toEqual([]);
    expect(validateReeving(reeving({ drivenFalls: 4, totalFalls: 8 }))).toEqual([]);
  });

  it("tahrikli kol sayısı toplamı aşamaz", () => {
    const issues = validateReeving(reeving({ drivenFalls: 4, totalFalls: 2 }));
    const found = issues.find((i) => i.alan === "drivenFalls" && i.agirlik === "hata");
    expect(found?.mesaj).toContain("aşamaz");
  });

  it("sıfır veya negatif kol sayısı hatadır", () => {
    const issues = validateReeving(reeving({ drivenFalls: 0, totalFalls: 0 }));
    expect(issues.some((i) => i.alan === "totalFalls" && i.agirlik === "hata")).toBe(true);
    expect(issues.some((i) => i.alan === "drivenFalls" && i.agirlik === "hata")).toBe(true);
  });

  it("tam sayı olmayan kol sayısı hatadır", () => {
    const issues = validateReeving(reeving({ drivenFalls: 2.5, totalFalls: 5 }));
    expect(
      issues.some(
        (i) => i.alan === "drivenFalls" && i.agirlik === "hata" && i.mesaj.includes("tam sayı")
      )
    ).toBe(true);
  });

  it("tek sayılı toplam kol sayısı uyarı verir", () => {
    const issues = validateReeving(reeving({ drivenFalls: 1, totalFalls: 3 }));
    const found = issues.find((i) => i.alan === "totalFalls" && i.agirlik === "uyari");
    expect(found?.mesaj).toContain("tam makara sayısı");
  });

  it("tam sayı olmayan mekanik avantaj uyarı verir", () => {
    const issues = validateReeving(reeving({ drivenFalls: 4, totalFalls: 6 }));
    const found = issues.find(
      (i) => i.agirlik === "uyari" && i.mesaj.includes("Mekanik avantaj")
    );
    expect(found).toBeDefined();
    // Bu donanımda kol sayıları geçerli olduğundan hata bulunmamalı.
    expect(issues.some((i) => i.agirlik === "hata")).toBe(false);
  });

  it("makara verimi 0 ile 1 arasında olmalı", () => {
    for (const eta of [0, 1, 1.2, -0.5]) {
      const issues = validateReeving(reeving({ sheaveEfficiency: eta }));
      expect(
        issues.some((i) => i.alan === "sheaveEfficiency" && i.agirlik === "hata")
      ).toBe(true);
    }
    expect(
      validateReeving(reeving({ sheaveEfficiency: Number.NaN })).some(
        (i) => i.alan === "sheaveEfficiency" && i.agirlik === "hata"
      )
    ).toBe(true);
  });

  it("negatif sabit makara adedi hata, kesirli olan uyarıdır", () => {
    const negatif = validateReeving(reeving({ fixedSheaveCount: -1 }));
    expect(
      negatif.some((i) => i.alan === "fixedSheaveCount" && i.agirlik === "hata")
    ).toBe(true);
    const kesirli = validateReeving(reeving({ fixedSheaveCount: 1.5 }));
    expect(
      kesirli.some((i) => i.alan === "fixedSheaveCount" && i.agirlik === "uyari")
    ).toBe(true);
    expect(validateReeving(reeving({ fixedSheaveCount: 0 }))).toEqual([]);
  });

  it("tüm mesajlar doludur ve ağırlık alanı geçerlidir", () => {
    const issues = validateReeving({
      drivenFalls: -1,
      totalFalls: Number.NaN,
      fixedSheaveCount: Number.NaN,
      sheaveEfficiency: 2,
    });
    expect(issues.length).toBeGreaterThan(0);
    for (const i of issues) {
      expect(i.alan.length).toBeGreaterThan(0);
      expect(i.mesaj.length).toBeGreaterThan(0);
      expect(["hata", "uyari"]).toContain(i.agirlik);
    }
  });
});

describe("COMMON_REEVINGS", () => {
  it("beklenen donanımları içerir", () => {
    expect(COMMON_REEVINGS.map((c) => c.label)).toEqual([
      "2/2",
      "2/4",
      "4/4",
      "4/8",
      "6/6",
      "8/8",
    ]);
  });

  it("her seçenek kendi etiketi, doğrulaması ve türetmesiyle tutarlıdır", () => {
    for (const c of COMMON_REEVINGS) {
      const r: Reeving = {
        drivenFalls: c.drivenFalls,
        totalFalls: c.totalFalls,
        fixedSheaveCount: 0,
        sheaveEfficiency: 0.985,
      };
      expect(reevingLabel(c)).toBe(c.label);
      expect(validateReeving(r)).toEqual([]);
      const d = deriveReeving(r);
      expect(d.label).toBe(c.label);
      expect(Number.isInteger(d.mechanicalAdvantage)).toBe(true);
      expect(d.blockSheaveCount).toBe(c.totalFalls / 2);
      expect(d.topSheaveCount).toBe((c.totalFalls - c.drivenFalls) / 2);
      expect(d.sheaveBearingCount).toBe(c.totalFalls);
      expect(d.drumRopeEnds).toBe(c.drivenFalls);
    }
  });

  it("4/8 seçeneği i = 2 ve 4 blok makarası verir", () => {
    const c = commonReevingByLabel("4/8");
    expect(c).toBeDefined();
    const d = deriveReeving({
      drivenFalls: c!.drivenFalls,
      totalFalls: c!.totalFalls,
      fixedSheaveCount: 0,
      sheaveEfficiency: 0.985,
    });
    expect(d.mechanicalAdvantage).toBe(2);
    expect(d.blockSheaveCount).toBe(4);
  });

  it("tanınmayan etiket için undefined döner", () => {
    expect(commonReevingByLabel("3/7")).toBeUndefined();
  });
});
