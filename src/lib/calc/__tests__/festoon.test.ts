import { describe, expect, it } from "vitest";
import { festoonProductCodeSummary, selectFestoon } from "@/lib/calc/festoon";

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

  it("Vasel serilerini taşıyıcı yükü ve yayımlanmış hız limitine göre seçer", () => {
    const result = selectFestoon(
      {
        brand: "vasel",
        series: "auto",
        cableForm: "flat",
        trolleyCount: 2,
        cablePackageWeightKg: 120,
      },
      20,
      90
    );

    expect(result.brand).toBe("vasel");
    expect(result.loadPerTrolleyKg).toBe(60);
    expect(result.selected?.series).toBe("VS2060");
    expect(result.trolleyLoadLimitKg).toBe(80);
    expect(result.speedPass).toBe(true);
    expect(result.pass).toBe(true);
  });

  it("Vasel katalogda hız limiti yayımlamamışsa uygunluğu hız teyidiyle işaretler", () => {
    const result = selectFestoon(
      {
        brand: "vasel",
        series: "VS2005",
        cableForm: "round",
        trolleyCount: 2,
        cablePackageWeightKg: 30,
      },
      20,
      90
    );

    expect(result.capacityPass).toBe(true);
    expect(result.speedPass).toBeNull();
    expect(result.pass).toBe(true);
  });

  it("Vasel 2010/2020 ürün kod şablonunu seçilen kablo formuna göre ayırır", () => {
    const flat = selectFestoon(
      { brand: "vasel", series: "VS2020", cableForm: "flat", trolleyCount: 1, cablePackageWeightKg: 20 },
      20,
      40
    );
    const round = selectFestoon(
      { brand: "vasel", series: "VS2020", cableForm: "round", trolleyCount: 1, cablePackageWeightKg: 20 },
      20,
      40
    );

    expect(festoonProductCodeSummary(flat.selected, "flat")).toContain("VS2020A-4WF");
    expect(festoonProductCodeSummary(round.selected, "round")).toContain("VS2020A-4WU");
    expect(round.trolleyLoadLimitKg).toBe(30);
  });
});
