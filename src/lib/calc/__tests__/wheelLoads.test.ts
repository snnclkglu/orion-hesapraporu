// Teker yükleri — mühendislik doğrulaması.
//
// Ölçüt FİZİKTİR ve FEM 1.001 Kitapçık 9'un bağıntılarıdır: denge, ölçek
// tutarlılığı, sınıf duyarlılığı ve sınır durumları. Kullanıcının elindeki
// Excel sayfası yalnız DÜŞEY YÜK ve DİNAMİK KATSAYI bloklarında birebir
// karşılaştırma için kullanılır; savrulma bloğunda bilinçli olarak sapılmıştır
// (bkz. "µ' ağırlık merkezinden türetilir" testi) ve bu sapma belgelidir.

import { describe, expect, it } from "vitest";
import {
  BUFFER_SPEED_THRESHOLD_MS,
  HOISTING_CLASS_FACTORS,
  LONGITUDINAL_MAX_RATIO,
  LONGITUDINAL_MIN_RATIO,
  SKEW_ANGLE_LIMIT_RAD,
  DEFAULT_BOGIE_GAP_MM,
  DEFAULT_CORNER_GAP_MM,
  WHEEL_COUNT_OPTIONS,
  autoCoupledPairs,
  computeWheelLoads,
  creepSpeedForLiftSpeed,
  guideClearanceForWheelDiameter,
  hoistingClassForMechanism,
  hoistSpeedForPhi2,
  normalizeWheelCount,
  positionsFromSpacings,
  resolveWheelSpacings,
  wheelCodes,
  type WheelLoadDeps,
  type WheelLoadInputs,
  type WheelLoadSelections,
} from "../modules/wheelLoads";
import { NEW_WORK_TEMPLATE } from "../defaults";
import { railNominalHeadWidthMm } from "../tables";
import type { TechnicalSpecs } from "../types";

// ---------------------------------------------------------------- fikstür
// Excel "Teker Yükleri Detaylı Hesap Örnek" işi: 75/20 t × 31 m, 8 teker,
// 4 tekerli boji düzeni, A70 eşdeğeri 70 mm ray başı.

const SPECS: TechnicalSpecs = {
  ...NEW_WORK_TEMPLATE.specs,
  spanM: 31,
  mainLiftSpeedMpm: 4,
};

const INPUTS: WheelLoadInputs = {
  // Ray başına 4 teker (A1 A2 · B1 B2) → 3 mesafe; dingil mesafesi 5000 mm
  wheelSpacingsText: "1600, 1800, 1600",
  guideSpacingMm: 5000,
  guideSpacingAuto: true,
  guideClearanceMm: 10,
  coupledPairCount: 4,
  coupledPairAuto: false,
  creepSpeedMpm: 1,
};

const SELECTIONS: WheelLoadSelections = {
  hoistingClass: "HC2",
  hoistDriveClass: "HD3",
  wheelPairMode: "CFF",
  guideMeans: "flange",
};

const DEPS: WheelLoadDeps = {
  wheelCount: 8,
  drivenWheels: 4,
  travelSpeedMpm: 30,
  accelerationMs2: 0.15,
  minApproachM: 1.5,
  railCode: "70x40",
  hoistLoadT: 75,
  trolleyWeightT: 12,
  bridgeWeightT: 58,
  bufferForceKn: 42,
};

const run = (
  o: {
    specs?: Partial<TechnicalSpecs>;
    inp?: Partial<WheelLoadInputs>;
    sel?: Partial<WheelLoadSelections>;
    deps?: Partial<WheelLoadDeps>;
  } = {}
) =>
  computeWheelLoads(
    { ...SPECS, ...o.specs },
    { ...INPUTS, ...o.inp },
    { ...SELECTIONS, ...o.sel },
    { ...DEPS, ...o.deps }
  );

const checkById = (r: ReturnType<typeof run>, id: string) =>
  r.checks.find((c) => c.id === id);

describe("6.2 ORION otomatik başlangıç kuralları", () => {
  it("mekanizma sınıfını HC1…HC4 sınıfına eşler", () => {
    for (const mechanism of ["M1", "M2", "M3", "M4", "M5"] as const) {
      expect(hoistingClassForMechanism(mechanism)).toBe("HC1");
    }
    expect(hoistingClassForMechanism("M6")).toBe("HC2");
    expect(hoistingClassForMechanism("M7")).toBe("HC3");
    expect(hoistingClassForMechanism("M8")).toBe("HC4");
  });

  it("sürünme hızını ana kaldırma hızının %10'u yapar", () => {
    expect(creepSpeedForLiftSpeed(4)).toBeCloseTo(0.4, 9);
    expect(creepSpeedForLiftSpeed(-5)).toBe(0);
  });

  it("köprü teker çapını kılavuz boşluğu kademelerine eşler", () => {
    expect(guideClearanceForWheelDiameter(200)).toBe(5);
    expect(guideClearanceForWheelDiameter(250)).toBe(7.5);
    expect(guideClearanceForWheelDiameter(315)).toBe(7.5);
    expect(guideClearanceForWheelDiameter(400)).toBe(10);
    expect(guideClearanceForWheelDiameter(630)).toBe(10);
    expect(guideClearanceForWheelDiameter(710)).toBe(12.5);
    expect(guideClearanceForWheelDiameter(800)).toBe(12.5);
    expect(guideClearanceForWheelDiameter(900)).toBe(15);
  });
});

// ---------------------------------------------------------------- düşey yükler

describe("düşey teker yükleri", () => {
  it("araba en yakın konumdayken statik dengeyi sağlar", () => {
    const v = run().values;
    // Yakın ray + uzak ray toplamı = toplam yüklü ağırlık
    const nearTotal = v.maxWheelLoadKg * v.wheelsPerSide;
    const farTotal =
      ((v.hoistLoadKg + DEPS.trolleyWeightT * 1000) * (DEPS.minApproachM / SPECS.spanM) +
        (DEPS.bridgeWeightT * 1000) / 2);
    expect(nearTotal + farTotal).toBeCloseTo(v.totalLoadKg, 6);
  });

  it("Pmaks ≥ Pmin ≥ yüksüz Pmin sıralaması bozulmaz", () => {
    const v = run().values;
    expect(v.maxWheelLoadKg).toBeGreaterThan(v.minWheelLoadKg);
    expect(v.minWheelLoadKg).toBeGreaterThan(v.minUnloadedWheelLoadKg);
  });

  it("araba tam ortadayken iki ray eşit yüklenir", () => {
    const v = run({ deps: { minApproachM: SPECS.spanM / 2 } }).values;
    expect(v.nearRailShare).toBeCloseTo(0.5, 10);
    expect(v.maxWheelLoadKg).toBeCloseTo(v.minWheelLoadKg, 6);
  });

  it("köprü kendi ağırlığını arabanın konumundan bağımsız paylaştırır", () => {
    // Araba ve yük sıfırsa iki ray daima yarı yarıya taşır.
    const v = run({ deps: { hoistLoadT: 0, trolleyWeightT: 0 } }).values;
    expect(v.nearRailShare).toBeCloseTo(0.5, 10);
  });

  it("teker adedi iki katına çıkınca teker yükü yarıya iner", () => {
    const a = run().values.maxWheelLoadKg;
    const b = run({ deps: { wheelCount: 16 } }).values.maxWheelLoadKg;
    expect(b).toBeCloseTo(a / 2, 6);
  });

  it("Excel örneğinin düşey yükleriyle birebir örtüşür", () => {
    const v = run().values;
    expect(Math.round(v.maxWheelLoadKg)).toBe(27948);
    expect(Math.round(v.minWheelLoadKg)).toBe(8302);
  });
});

// ------------------------------------------------------------ dinamik katsayı

describe("dinamik katsayı φ2 (FEM Kitapçık 9 md. 9.3)", () => {
  it("sınıf sertleştikçe φ2 büyür", () => {
    const phis = (["HC1", "HC2", "HC3", "HC4"] as const).map(
      (hoistingClass) => run({ sel: { hoistingClass } }).values.phi2
    );
    for (let i = 1; i < phis.length; i += 1) {
      expect(phis[i]).toBeGreaterThan(phis[i - 1]);
    }
  });

  it("T.9.3.a değerleri standartla birebir aynıdır", () => {
    expect(HOISTING_CLASS_FACTORS.HC1).toEqual({ beta2: 0.17, phi2Min: 1.05 });
    expect(HOISTING_CLASS_FACTORS.HC2).toEqual({ beta2: 0.34, phi2Min: 1.1 });
    expect(HOISTING_CLASS_FACTORS.HC3).toEqual({ beta2: 0.51, phi2Min: 1.15 });
    expect(HOISTING_CLASS_FACTORS.HC4).toEqual({ beta2: 0.68, phi2Min: 1.2 });
  });

  it("T.9.3.b hız seçimi tahrik sınıfına göre dallanır", () => {
    expect(hoistSpeedForPhi2("HD1", 6, 1)).toBeCloseTo(0.1, 10); // vmaks
    expect(hoistSpeedForPhi2("HD2", 6, 1)).toBeCloseTo(1 / 60, 10); // sürünme
    expect(hoistSpeedForPhi2("HD3", 6, 1)).toBeCloseTo(1 / 60, 10); // sürünme
    expect(hoistSpeedForPhi2("HD4", 6, 1)).toBeCloseTo(0.05, 10); // 0,5·vmaks
    expect(hoistSpeedForPhi2("HD5", 6, 1)).toBe(0);
  });

  it("HD5'te φ2 = φ2min olur (ön germeli tahrik, dinamik etki yok)", () => {
    const v = run({ sel: { hoistDriveClass: "HD5" } }).values;
    expect(v.phi2).toBeCloseTo(HOISTING_CLASS_FACTORS.HC2.phi2Min, 12);
  });

  it("φ2 yalnız KALDIRMA yükünü büyütür, ölü yükü değil", () => {
    const v = run().values;
    const hoistShare = v.hoistLoadKg * ((SPECS.spanM - DEPS.minApproachM) / SPECS.spanM);
    const beklenenArtis = ((v.phi2 - 1) * hoistShare) / v.wheelsPerSide;
    expect(v.designWheelLoadKg - v.maxWheelLoadKg).toBeCloseTo(beklenenArtis, 6);
  });

  it("kaldırma yükü yoksa tasarım yükü karakteristik yüke eşittir", () => {
    const v = run({ deps: { hoistLoadT: 0 } }).values;
    expect(v.designWheelLoadKg).toBeCloseTo(v.maxWheelLoadKg, 9);
  });
});

// ------------------------------------------------------------------ savrulma

describe("savrulma açısı (FEM Kitapçık 9 md. 9.4.1.5)", () => {
  it("α = αg + αw + αt bileşenlerinin toplamıdır", () => {
    const v = run().values;
    expect(v.alphaRad).toBeCloseTo(
      v.alphaGuideRad + v.alphaWearRad + v.alphaToleranceRad,
      12
    );
    expect(v.alphaToleranceRad).toBe(0.001);
  });

  it("αg toplam boşluğu kullanır (tek taraf boşluğun iki katı)", () => {
    const v = run().values;
    expect(v.alphaGuideRad).toBeCloseTo((2 * 10) / 5000, 12);
  });

  it("αw rayın ANMA baş genişliğini kullanır (etkin temas genişliğini değil)", () => {
    const v = run({ deps: { railCode: "A75" } }).values;
    expect(v.railHeadWidthMm).toBeCloseTo(75, 9);
    expect(railNominalHeadWidthMm("A75")).toBeCloseTo(75, 9);
    expect(v.alphaWearRad).toBeCloseTo((0.1 * 75) / 5000, 12);
  });

  it("dingil mesafesi büyüdükçe savrulma açısı küçülür", () => {
    const dar = run({ inp: { wheelSpacingsText: "800, 900, 800" } }).values.alphaRad;
    const genis = run({ inp: { wheelSpacingsText: "2600, 2800, 2600" } }).values.alphaRad;
    expect(genis).toBeLessThan(dar);
  });

  it("α > 0,015 rad olunca kontrol düşer", () => {
    const r = run({ inp: { wheelSpacingsText: "400, 400, 400" } });
    expect(r.values.wheelbaseMm).toBe(1200);
    expect(r.values.alphaRad).toBeGreaterThan(SKEW_ANGLE_LIMIT_RAD);
    expect(checkById(r, "wheelLoads.skew.angle")?.pass).toBe(false);
  });

  it("sürtünme fonksiyonu 0,3'te doyar ve açıyla artar", () => {
    const kucuk = run({ inp: { guideClearanceMm: 1 } }).values.frictionF;
    const buyuk = run({ inp: { guideClearanceMm: 30 } }).values.frictionF;
    expect(buyuk).toBeGreaterThan(kucuk);
    expect(buyuk).toBeLessThan(0.3);
  });
});

describe("savrulma kuvvetleri (FEM Kitapçık 9 md. 9.4.1.3 / T.9.4)", () => {
  it("teker enine kuvvetlerinin toplamı kılavuz kuvvetine eşittir", () => {
    for (const mode of ["CFF", "IFF", "CFM", "IFM"] as const) {
      const v = run({ sel: { wheelPairMode: mode } }).values;
      expect(v.guideForceBalanceN).toBeCloseTo(v.guideForceN, 6);
    }
  });

  it("her tekerin enine kuvveti düşey yüküyle ORANTILIDIR (f · Fz)", () => {
    const v = run().values;
    const railOneWheelLoadN = v.maxWheelLoadKg * 9.81;
    // 1 numaralı teker kılavuz elemandadır (d = 0) → kayma tam α kadardır.
    expect(v.wheels[0].lateralNearN).toBeCloseTo(v.frictionF * railOneWheelLoadN, 6);
  });

  it("µ' yakın rayın yük payıdır — ağırlık merkezinden türetilir", () => {
    const v = run().values;
    // Excel araba kolunu (l−e)/l = 0,9516 kullanıyordu; köprünün kendi ağırlığı
    // iki raya eşit dağıldığı için gerçek pay daha küçüktür.
    expect(v.muPrime).toBeCloseTo(0.7710, 4);
    expect(v.mu + v.muPrime).toBeCloseTo(1, 12);
    // Düşey yük bloğuyla tutarlılık: µ'·mg / n = Pmaks
    expect((v.muPrime * v.totalLoadKg) / v.wheelsPerSide).toBeCloseTo(
      v.maxWheelLoadKg,
      6
    );
  });

  it("kuvvet kılavuz elemandan uzaklaştıkça azalır", () => {
    const v = run().values;
    for (let i = 1; i < v.wheels.length; i += 1) {
      expect(v.wheels[i].lateralNearN).toBeLessThan(v.wheels[i - 1].lateralNearN);
    }
  });

  it("anlık kayma kutbunun ötesindeki teker ters yönde kuvvet alır", () => {
    // Bağımsız teker çiftinde (p = 0) kayma kutbu yakındır: h = Σdᵢ²/Σdᵢ.
    // Uzun dingil mesafeli 16 tekerli düzende son tekerler dᵢ > h bölgesine
    // düşer; FEM T.9.4'te (1 − dᵢ/h) negatife geçer ve kuvvet yön değiştirir.
    const v = run({
      deps: { wheelCount: 16 },
      sel: { wheelPairMode: "IFF" },
      inp: { wheelSpacingsText: "1100, 1410, 1100, 6600, 1100, 1410, 1100" },
    }).values;
    const beyond = v.wheels.filter((w) => w.distanceM > v.poleDistanceM);
    expect(beyond.length).toBeGreaterThan(0);
    for (const w of beyond) expect(w.lateralNearN).toBeLessThan(0);
    // İşaret dönse de denge korunur
    expect(v.guideForceBalanceN).toBeCloseTo(v.guideForceN, 6);
  });

  it("bağımsız (I) teker çiftinde raya paralel teğetsel kuvvet doğmaz", () => {
    expect(run({ sel: { wheelPairMode: "IFF" } }).values.xi).toBe(0);
    expect(run({ sel: { wheelPairMode: "IFM" } }).values.xi).toBe(0);
    expect(run({ sel: { wheelPairMode: "CFF" } }).values.xi).toBeGreaterThan(0);
  });

  it("yanal hareketli taraf (F/M) enine kuvvet taşımaz", () => {
    const v = run({ sel: { wheelPairMode: "CFM" } }).values;
    expect(v.maxLateralFarN).toBe(0);
    for (const w of v.wheels) expect(w.lateralFarN).toBe(0);
  });

  it("bağlı çift adedi arttıkça kayma kutbu uzaklaşır ve kılavuz kuvveti büyür", () => {
    const az = run({ inp: { coupledPairCount: 1 } }).values;
    const cok = run({ inp: { coupledPairCount: 4 } }).values;
    expect(cok.poleDistanceM).toBeGreaterThan(az.poleDistanceM);
    expect(cok.guideForceN).toBeGreaterThan(az.guideForceN);
  });

  it("bağımsız düzende p = 0'dır — elle girilen değer düzenle çelişemez", () => {
    const bagimli = run({ sel: { wheelPairMode: "CFF" }, inp: { coupledPairCount: 2 } });
    const bagimsiz = run({ sel: { wheelPairMode: "IFF" }, inp: { coupledPairCount: 2 } });
    expect(bagimli.values.coupledPairs).toBe(2);
    expect(bagimsiz.values.coupledPairs).toBe(0);
    // p = 0 → h = Σdᵢ²/Σdᵢ, kutup belirgin biçimde yakınlaşır
    expect(bagimsiz.values.poleDistanceM).toBeLessThan(bagimli.values.poleDistanceM);
  });

  it("bağlı çift adedi otomatikte tahrikli teker çiftlerinden okunur", () => {
    expect(autoCoupledPairs("CFF", 4, 4)).toBe(2);
    expect(autoCoupledPairs("CFF", 8, 4)).toBe(4);
    expect(autoCoupledPairs("IFF", 8, 4)).toBe(0);
    // Tek taraftaki teker adedini aşamaz
    expect(autoCoupledPairs("CFF", 20, 3)).toBe(3);
  });

  it("en küçük vinçte (4 teker) model geçerlidir", () => {
    const v = run({ deps: { wheelCount: 4 } }).values;
    expect(v.wheelsPerSide).toBe(2);
    expect(v.skewApplicable).toBe(true);
    expect(v.guideForceN).toBeGreaterThan(0);
  });

  it("tekerler üst üste düşerse (Σd = 0) model devre dışı kalır", () => {
    // Fiziksel olarak imkânsız bir geometri; hesap NaN'a düşmek yerine susar.
    const v = run({ deps: { wheelCount: 4 }, inp: { wheelSpacingsText: "0" } }).values;
    expect(v.skewApplicable).toBe(false);
    expect(v.guideForceN).toBe(0);
    expect(v.wheels.every((w) => w.lateralNearN === 0)).toBe(true);
  });

  it("kuvvetler yüklü ağırlıkla doğrusal ölçeklenir", () => {
    const bir = run().values;
    const iki = run({
      deps: { hoistLoadT: 150, trolleyWeightT: 24, bridgeWeightT: 116 },
    }).values;
    // Ağırlık iki katına çıkınca yük dağılımı (µ') aynı kalır → S iki katı olur
    expect(iki.muPrime).toBeCloseTo(bir.muPrime, 12);
    expect(iki.guideForceN).toBeCloseTo(2 * bir.guideForceN, 6);
  });
});

// ------------------------------------------------------------ boyuna kuvvetler

describe("boyuna kuvvetler (FEM Kitapçık 2 md. 2.2.3.1.1)", () => {
  it("atalet kuvveti m·a bağıntısını izler", () => {
    const v = run().values;
    expect(v.inertiaForceN).toBeCloseTo(v.totalLoadKg * DEPS.accelerationMs2, 6);
  });

  it("tasarım kuvveti FEM bandının dışına çıkmaz", () => {
    for (const accelerationMs2 of [0.01, 0.15, 0.5, 3]) {
      const v = run({ deps: { accelerationMs2 } }).values;
      expect(v.designLongitudinalN).toBeGreaterThanOrEqual(
        v.drivenWheelLoadN * LONGITUDINAL_MIN_RATIO - 1e-6
      );
      expect(v.designLongitudinalN).toBeLessThanOrEqual(
        v.drivenWheelLoadN * LONGITUDINAL_MAX_RATIO + 1e-6
      );
    }
  });

  it("düşük ivmede alt sınır, yüksek ivmede üst sınır belirler", () => {
    const dusuk = run({ deps: { accelerationMs2: 0.01 } });
    expect(dusuk.cells["longitudinal.bound"]).toContain("alt sınır");
    const yuksek = run({ deps: { accelerationMs2: 3 } });
    expect(yuksek.cells["longitudinal.bound"]).toContain("üst sınır");
  });

  it("aktarılabilirlik kontrolü yalnız ÜST sınır aşılınca düşer", () => {
    // Alt sınırın altında kalmak bir tasarım hatası değildir — kuvvet tabana
    // yükseltilir ve kontrol geçer.
    expect(
      checkById(run({ deps: { accelerationMs2: 0.01 } }), "wheelLoads.longitudinal.transferable")
        ?.pass
    ).toBe(true);
    expect(
      checkById(run({ deps: { accelerationMs2: 3 } }), "wheelLoads.longitudinal.transferable")
        ?.pass
    ).toBe(false);
  });

  it("ray ve tahrikli teker başına dağılım toplamı korur", () => {
    const v = run().values;
    expect(v.longitudinalPerRailN * 2).toBeCloseTo(v.designLongitudinalN, 9);
    const drivenWheels = v.drivenWheelLoadN / ((v.totalLoadKg * 9.81) / DEPS.wheelCount);
    expect(v.longitudinalPerDrivenWheelN * drivenWheels).toBeCloseTo(
      v.designLongitudinalN,
      6
    );
  });

  it("ivmelenme süresi v/a bağıntısını izler", () => {
    const v = run().values;
    expect(v.accelTimeS).toBeCloseTo(v.travelSpeedMs / DEPS.accelerationMs2, 9);
  });
});

// ---------------------------------------------------------------------- tampon

describe("tampon etkisi (FEM Kitapçık 9 md. 9.4.2)", () => {
  it("0,4 m/s eşiğinin altında tampon kuvveti hesaba katılmaz", () => {
    const yavas = run({ deps: { travelSpeedMpm: 0.4 * 60 - 1 } }).values;
    expect(yavas.bufferConsidered).toBe(false);
    expect(yavas.bufferForceKn).toBe(0);
  });

  it("eşiğin üstünde köprü yürütmeden gelen tepki kuvveti taşınır", () => {
    const hizli = run({ deps: { travelSpeedMpm: 30 } }).values;
    expect(hizli.travelSpeedMs).toBeGreaterThan(BUFFER_SPEED_THRESHOLD_MS);
    expect(hizli.bufferConsidered).toBe(true);
    expect(hizli.bufferForceKn).toBe(DEPS.bufferForceKn);
  });
});

// --------------------------------------------------------------- teker düzeni

describe("teker düzeni — dört köşede eşit teker", () => {
  it("geçerli teker adetleri dördün katıdır", () => {
    for (const c of WHEEL_COUNT_OPTIONS) expect(c % 4).toBe(0);
    expect([...WHEEL_COUNT_OPTIONS]).toEqual([4, 8, 12, 16, 20, 24]);
  });

  it("adet normalize edilir ve bant dışına taşmaz", () => {
    expect(normalizeWheelCount(4)).toBe(4);
    expect(normalizeWheelCount(6)).toBe(8); // 4'ün katına yuvarlanır
    expect(normalizeWheelCount(16)).toBe(16);
    expect(normalizeWheelCount(2)).toBe(4);
    expect(normalizeWheelCount(40)).toBe(24);
    expect(normalizeWheelCount(Number.NaN)).toBe(4);
  });

  it("her köşede eşit teker vardır: toplam/4 köşe, toplam/2 ray", () => {
    for (const wheelCount of WHEEL_COUNT_OPTIONS) {
      const v = run({ deps: { wheelCount } }).values;
      expect(v.totalWheels).toBe(wheelCount);
      expect(v.wheelsPerCorner).toBe(wheelCount / 4);
      expect(v.wheelsPerSide).toBe(wheelCount / 2);
      expect(v.wheelsPerSide).toBe(2 * v.wheelsPerCorner);
      expect(v.wheels).toHaveLength(v.wheelsPerSide);
      expect(v.spacingsMm).toHaveLength(v.wheelsPerSide - 1);
    }
  });

  it("teker kodları ön köşede A, arka köşede B olur", () => {
    expect(wheelCodes(2)).toEqual(["A1", "B1"]);
    expect(wheelCodes(4)).toEqual(["A1", "A2", "B1", "B2"]);
    expect(wheelCodes(8)).toEqual([
      "A1", "A2", "A3", "A4", "B1", "B2", "B3", "B4",
    ]);
    // 16 tekerli vinç → rayda 8 teker, köşede 4
    expect(run({ deps: { wheelCount: 16 } }).values.codes).toEqual(wheelCodes(8));
  });

  it("konumlar ardışık mesafelerin birikimli toplamıdır", () => {
    expect(positionsFromSpacings([1100, 1410, 1100, 6600, 1100, 1410, 1100])).toEqual([
      0, 1100, 2510, 3610, 10210, 11310, 12720, 13820,
    ]);
    expect(positionsFromSpacings([])).toEqual([0]);
  });

  it("kullanıcının 16 tekerli teknik resmi birebir çözülür", () => {
    // 1100 · 1410 · 1100 · 6600 · 1100 · 1410 · 1100  → dingil mesafesi 13820
    const v = run({
      deps: { wheelCount: 16 },
      inp: { wheelSpacingsText: "1100, 1410, 1100, 6600, 1100, 1410, 1100" },
    }).values;
    expect(v.wheelbaseMm).toBe(13820);
    expect(v.codes).toEqual(["A1", "A2", "A3", "A4", "B1", "B2", "B3", "B4"]);
    expect(v.positionsM[4]).toBeCloseTo(10.21, 6);
  });

  it("kullanıcının 8 tekerli teknik resmi birebir çözülür", () => {
    // 1500 · 5500 · 1500 → dingil mesafesi 8500, rayda 4 teker
    const v = run({
      deps: { wheelCount: 8 },
      inp: { wheelSpacingsText: "1500, 5500, 1500" },
    }).values;
    expect(v.wheelbaseMm).toBe(8500);
    expect(v.wheelsPerCorner).toBe(2);
    expect(v.codes).toEqual(["A1", "A2", "B1", "B2"]);
  });

  it("bozuk ya da eksik mesafe listesi simetrik varsayılana düşer", () => {
    // Ray başına 4 teker → 3 mesafe: köşe içi, köşeler arası, köşe içi
    expect(resolveWheelSpacings("abc", 4)).toEqual([
      DEFAULT_CORNER_GAP_MM, DEFAULT_BOGIE_GAP_MM, DEFAULT_CORNER_GAP_MM,
    ]);
    expect(resolveWheelSpacings("1000", 4)).toHaveLength(3);
    const v = run({ inp: { wheelSpacingsText: "çöp veri" } }).values;
    expect(v.positionsM.every((d) => Number.isFinite(d))).toBe(true);
    expect(Number.isFinite(v.guideForceN)).toBe(true);
  });

  it("dingil mesafesi mesafelerin toplamıdır ve wb otomatikte onu izler", () => {
    const v = run({ inp: { wheelSpacingsText: "1100, 6600, 1100" } }).values;
    expect(v.wheelbaseMm).toBe(8800);
    // wb = dingil mesafesi (teker flanşıyla kılavuzlama) → αg = 2·10/8800
    expect(v.alphaGuideRad).toBeCloseTo(20 / 8800, 12);
  });

  it("açılar raporda miliradyan yayımlanır, values SI biriminde kalır", () => {
    const r = run();
    expect(r.cells["skew.angle"]).toBeCloseTo(r.values.alphaRad * 1000, 9);
    expect(r.cells["skew.angleLimit"]).toBeCloseTo(15, 9);
    const c = checkById(r, "wheelLoads.skew.angle");
    expect(c?.unit).toBe("mrad");
    expect((c as { provided: number }).provided).toBeCloseTo(15, 9);
  });
});
