import { describe, expect, it } from "vitest";
import { selectFestoon } from "@/lib/calc/festoon";

describe("I-kiriş festoon ön seçimi", () => {
  it("hız ve taşıyıcı başına yüke göre en küçük uygun seriyi seçer", () => {
    const result = selectFestoon(
      { series: "auto", cableForm: "flat", trolleyCount: 2, cablePackageWeightKg: 120 },
      20,
      80
    );

    expect(result.loadPerTrolleyKg).toBe(60);
    expect(result.selected?.series).toBe("0320");
    expect(result.pass).toBe(true);
  });

  it("elle seçilen küçük serinin hız/yük sınırı aşıldığında uygunsuz döner", () => {
    const result = selectFestoon(
      { series: "0314", cableForm: "round", trolleyCount: 1, cablePackageWeightKg: 25 },
      60,
      60
    );

    expect(result.capacityPass).toBe(false);
    expect(result.speedPass).toBe(false);
    expect(result.pass).toBe(false);
  });

  it("kablo paketi yükü girilmeden katalog uygunluğu iddia etmez", () => {
    const result = selectFestoon(
      { series: "auto", cableForm: "flat", trolleyCount: 4, cablePackageWeightKg: 0 },
      80,
      40
    );

    expect(result.complete).toBe(false);
    expect(result.selected).toBeNull();
    expect(result.pass).toBeNull();
  });
});
