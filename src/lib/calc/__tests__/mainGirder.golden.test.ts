// ANA KİRİŞ — MÜHENDİSLİK DOĞRULAMA.
//
// Bu dosya artık bir hesap tablosuna karşı DEĞİL, FİZİĞE ve STANDARDA karşı
// test eder (AGENTS.md "Yeni bir hesap eklerken" madde 6). Denenen şeyler:
// denge ve tanım tutarlılığı (A, Cz, Cy, W = I/c), simetri (simetrik kesitte
// Cy = b2/2), ölçek duyarlılığı (yük iki katına çıkınca gerilme iki katı),
// sınıf duyarlılığı (γc, yük grubu), kombinasyon tutarlılığı (Durum I ve III
// aynı kabulü kullanır) ve sınır durumları (tek gövde sacı, sıfır ek flanş).
//
// Tarihsel karşılaştırma katmanı (__tests__/legacy/) ayrı bir ağdır ve
// hesap yöntemi için ŞARTNAME DEĞİLDİR.

import { describe, expect, it } from "vitest";
import { V5_SPECS } from "../defaults";
import {
  V5_GIRDER_DEPS,
  V5_GIRDER_INPUTS,
  V5_GIRDER_SELECTIONS,
} from "../defaults/structural";
import {
  computeMainGirder,
  horizontalDynamicFactor,
  FATIGUE_TENSILE_NMM2,
  GIRDER_ALLOWABLE_STRESS,
  STRUCTURE_AMPLIFY_FACTOR,
  type GirderDeps,
  type GirderInputs,
  type GirderSelections,
} from "../modules/mainGirder";
import type { TechnicalSpecs } from "../types";

const run = (
  o?: {
    specs?: Partial<TechnicalSpecs>;
    inp?: Partial<GirderInputs>;
    sel?: Partial<GirderSelections>;
    deps?: Partial<GirderDeps>;
  }
) => {
  const specs = { ...V5_SPECS, ...o?.specs };
  return computeMainGirder(
    specs,
    // Tarihsel fikstür TEK ana kiriş takımıdır; ikinci takım (dört kirişli
    // köprü) ayrı bir anahtarla koşar ve bu karşılaştırmaya girmez.
    "girder",
    { ...V5_GIRDER_INPUTS, ...o?.inp },
    { ...V5_GIRDER_SELECTIONS, ...o?.sel },
    {
      ...V5_GIRDER_DEPS,
      // Kirişin TAŞIDIĞI kaldırma grubu artık `deps`ten gelir (dört kirişli
      // köprüde ikinci takım yardımcı kaldırmayı taşır). Bu fikstürde taşınan
      // grup ANA kaldırmadır, yani iki alan teknik özelliklerden TÜRETİLİR —
      // testlerin "kapasiteyi/hızı değiştir" kurgusu böylece korunur.
      hoistLoadKg: specs.mainCapacityT * 1000,
      liftSpeedMpm: specs.mainLiftSpeedMpm,
      ...o?.deps,
    }
  );
};

const cell = (r: ReturnType<typeof run>, k: string): number => {
  const v = r.cells[k];
  expect(typeof v, `${k} sayısal olmalı`).toBe("number");
  return v as number;
};

describe("ana kiriş — kesit özellikleri", () => {
  const r = run();

  it("kesit alanı plaka alanlarının toplamıdır", () => {
    const i = V5_GIRDER_INPUTS;
    const sumMm2 =
      i.t1Mm * i.b1Mm + i.t2Mm * i.b2Mm + i.t3Mm * i.h3Mm + i.t4Mm * i.h3Mm +
      i.t5Mm * i.b5Mm + i.t6Mm * i.b6Mm;
    expect(cell(r, "section.area")).toBeCloseTo(sumMm2 / 100, 8);
  });

  it("ağırlık merkezi kesit içinde kalır ve W = I/c tanımını sağlar", () => {
    const h = cell(r, "section.height");
    const cz = cell(r, "section.centroidZ");
    expect(cz).toBeGreaterThan(0);
    expect(cz).toBeLessThan(h);
    expect(cell(r, "section.modulusYBottom")).toBeCloseTo(
      (cell(r, "section.inertiaY") * 10) / cz, 6
    );
    expect(cell(r, "section.modulusYTop")).toBeCloseTo(
      (cell(r, "section.inertiaY") * 10) / (h - cz), 6
    );
  });

  it("ray ekseni ana gövde sacının ortasıdır (b1 merkezi)", () => {
    expect(cell(r, "section.railCenterY")).toBeCloseTo(
      V5_GIRDER_INPUTS.xMm + V5_GIRDER_INPUTS.t3Mm / 2, 10
    );
  });

  it("b1 büyüdükçe Cy ray eksenine yaklaşır (b1 kirişin ortasında değil)", () => {
    const railY = cell(r, "section.railCenterY");
    const cyBase = cell(r, "section.centroidY");
    const cyHeavy = cell(run({ inp: { t1Mm: 60 } }), "section.centroidY");
    // Kalın b1 kesitin ağırlığını ray eksenine çeker
    expect(Math.abs(cyHeavy - railY)).toBeLessThan(Math.abs(cyBase - railY));
  });

  it("simetrik kesitte Cy tam olarak b2/2'dir ve Izz analitik değere eşittir", () => {
    // Simetri kurgusu: b1 = 0 (ray altı sacı yok), b5 = b6 = b2, gövdeler
    // b2/2'ye göre simetrik (x = 62 → gövde merkezleri 66 ve 394, b2 = 460).
    const sym: Partial<GirderInputs> = {
      b1Mm: 0, t1Mm: 0,
      b2Mm: 460, t2Mm: 8,
      t3Mm: 8, t4Mm: 8, h3Mm: 990, aMm: 320, xMm: 62,
      b5Mm: 460, t5Mm: 8,
      b6Mm: 460, t6Mm: 6,
    };
    const s = run({ inp: sym });
    expect(cell(s, "section.centroidY")).toBeCloseTo(230, 8);

    // Analitik Izz [cm⁴]: yatay plakalar b³t/12 (Steiner sıfır),
    // gövdeler t³h/12 + t·h·d² (d = |66 − 230| = |394 − 230| = 164)
    const flange = (b: number, t: number) => (b ** 3 * t) / 12;
    const web = (t: number, h: number, d: number) => (t ** 3 * h) / 12 + t * h * d ** 2;
    const izzMm4 =
      flange(460, 8) + flange(460, 8) + flange(460, 6) +
      web(8, 990, 164) + web(8, 990, 164);
    expect(cell(s, "section.inertiaZ")).toBeCloseTo(izzMm4 / 1e4, 4);
  });

  it("ek flanş (b6) Izz'yi arttırır — Steiner terimi işaret hatası içermez", () => {
    const noB6 = cell(run({ inp: { t6Mm: 0, b6Mm: 0 } }), "section.inertiaZ");
    const withB6 = cell(run({ inp: { t6Mm: 10, b6Mm: 300 } }), "section.inertiaZ");
    expect(withB6).toBeGreaterThan(noB6);
    // İşaret hatalı sürümde b6 = b2 katkısı devasa büyürdü; gerçekte plakanın
    // kendi ataleti mertebesinde kalmalı (kaba üst sınır).
    const centered = run({ inp: { t6Mm: 10, b6Mm: 460, b2Mm: 460 } });
    const own = (460 ** 3 * 10) / 12 / 1e4;
    expect(cell(centered, "section.inertiaZ") - noB6).toBeLessThan(own * 3);
  });

  it("tek gövde sacında burulma sabiti açık kesit değerine düşer", () => {
    const open = run({ inp: { t4Mm: 0 } });
    expect(cell(open, "section.inertiaTorsion")).toBeCloseTo(
      cell(open, "section.inertiaTorsionOpen"), 8
    );
    // Kapalı kutu, açık kesitten çok daha rijittir
    expect(cell(run(), "section.inertiaTorsion")).toBeGreaterThan(
      cell(run(), "section.inertiaTorsionOpen") * 10
    );
  });

  it("CMAA 70 3.5.1 narinlik oranları geometriden gelir", () => {
    expect(cell(r, "section.spanToDepthRatio")).toBeCloseTo(
      (V5_SPECS.spanM * 1000) / cell(r, "section.height"), 8
    );
    expect(cell(r, "section.spanToWidthRatio")).toBeCloseTo(
      (V5_SPECS.spanM * 1000) / V5_GIRDER_INPUTS.aMm, 8
    );
  });
});

describe("ana kiriş — yükler", () => {
  const r = run();

  it("bir kirişe köprünün yarısı düşer", () => {
    expect(cell(r, "load.bridgeDeadWeight")).toBeCloseTo(
      (V5_GIRDER_DEPS.bridgeWeightT / 2) * 1000, 8
    );
    // Köprü ağırlığı iki katına çıkarsa kirişe düşen pay da iki katına çıkar
    expect(cell(run({ deps: { bridgeWeightT: 34 } }), "load.bridgeDeadWeight")).toBeCloseTo(
      2 * cell(r, "load.bridgeDeadWeight"), 8
    );
  });

  it("dinamik katsayı ψ hıza göre 1,15 … 1,60 bandında kalır", () => {
    expect(cell(run({ specs: { mainLiftSpeedMpm: 6 } }), "load.dynamicFactor")).toBeCloseTo(1.15, 10);
    expect(cell(run({ specs: { mainLiftSpeedMpm: 120 } }), "load.dynamicFactor")).toBeCloseTo(1.6, 10);
    const mid = cell(run({ specs: { mainLiftSpeedMpm: 30 } }), "load.dynamicFactor");
    expect(mid).toBeGreaterThan(1.15);
    expect(mid).toBeLessThan(1.6);
  });

  it("ψh kütle oranından türetilir (FEM Şekil A.2.2.1 zarfı)", () => {
    expect(horizontalDynamicFactor(0.4)).toBeCloseTo(2, 10);
    expect(horizontalDynamicFactor(1)).toBeCloseTo(2, 10);
    expect(horizontalDynamicFactor(3)).toBeCloseTo(Math.sqrt(2 + 3 + 1 / 3), 10);
    // µ arttıkça ψh artar (µ > 1 bölgesinde)
    expect(horizontalDynamicFactor(5)).toBeGreaterThan(horizontalDynamicFactor(2));
    // Motorda: µ_araba = W / Wa
    expect(cell(r, "load.massRatioTrolley")).toBeCloseTo(
      cell(r, "load.totalLiveLoad") / cell(r, "load.trolleyWeight"), 8
    );
    expect(cell(r, "load.psiHA")).toBeCloseTo(
      horizontalDynamicFactor(cell(r, "load.massRatioTrolley")), 10
    );
  });

  it("ψh elle ezilebilir", () => {
    const o = run({ inp: { psiHAOverride: 1.5, psiHKOverride: 1.25 } });
    expect(cell(o, "load.psiHA")).toBe(1.5);
    expect(cell(o, "load.psiHK")).toBe(1.25);
  });

  it("köprü atalet yükü asılı yükü ψhK ile içerir (araba ile simetrik)", () => {
    const light = run({ specs: { mainCapacityT: 1 } });
    const heavy = run({ specs: { mainCapacityT: 8 } });
    // Eski (hatalı) kabulde köprü ataleti yükten hiç etkilenmiyordu
    expect(cell(heavy, "load.bridgeInertia")).toBeGreaterThan(cell(light, "load.bridgeInertia"));
    // Bağıntının kendisi: F' = aK·(W1·ψhK + 2·Wv)/g
    expect(cell(r, "load.bridgeInertia")).toBeCloseTo(
      (cell(r, "load.bridgeAccel") *
        (cell(r, "load.hoistLoad") * cell(r, "load.psiHK") +
          2 * cell(r, "load.bridgeDeadWeight"))) / 9.81,
      6
    );
  });

  it("sürtünme sınırı tahrikli teker sayısıyla orantılıdır (μ = 1/7, çift teker)", () => {
    const one = run({ deps: { trolleyDrivenWheels: 1 } });
    const two = run({ deps: { trolleyDrivenWheels: 2 } });
    expect(cell(two, "load.trolleyTractionLimit")).toBeCloseTo(
      2 * cell(one, "load.trolleyTractionLimit"), 8
    );
    expect(cell(two, "load.trolleyTractionLimit")).toBeCloseTo(
      (2 * cell(two, "load.trolleyWheelPressure")) / 14, 8
    );
  });

  it("yatay yük atalet ve sürtünme sınırının küçüğünden gelir", () => {
    const v = run({ deps: { trolleyDrivenWheels: 1 } });
    const expected =
      Math.min(cell(v, "load.trolleyInertia"), cell(v, "load.trolleyTractionLimit")) / 2;
    expect(cell(v, "load.trolleyHorizontal")).toBeCloseTo(expected, 8);
  });

  it("çapraz yürüyüş katsayısı λ 0,05 … 0,20 bandına kırpılır", () => {
    const low = run({ inp: { trolleyWheelSpacingM: 0.5, trolleyAxleSpacingM: 10 } });
    const high = run({ inp: { trolleyWheelSpacingM: 40, trolleyAxleSpacingM: 1 } });
    expect(cell(low, "load.skewFactorTrolley")).toBeCloseTo(0.05, 10);
    expect(cell(high, "load.skewFactorTrolley")).toBeCloseTo(0.2, 10);
  });
});

describe("ana kiriş — gerilme analizi", () => {
  const r = run();

  it("σx,alt bileşenlerin ψ'li toplamıdır", () => {
    const psi = cell(r, "load.dynamicFactor");
    const sum =
      cell(r, "stress.sigmaXSelfWeightBottom") +
      cell(r, "stress.sigmaXTrolleyBottom") +
      psi * cell(r, "stress.sigmaXHoistBottom") +
      cell(r, "stress.sigmaXLateralBridgeBottom") +
      cell(r, "stress.sigmaXLateralTrolleyBottom") +
      cell(r, "stress.sigmaXRailLeverBottom") +
      cell(r, "stress.sigmaXSecondaryTrolleyBottom") +
      psi * cell(r, "stress.sigmaXSecondaryHoistBottom");
    expect(cell(r, "stress.sigmaXBottomCase1")).toBeCloseTo(sum, 8);
  });

  it("alt lif çekme, üst lif basınç işaretlidir", () => {
    expect(cell(r, "stress.sigmaXSelfWeightBottom")).toBeGreaterThan(0);
    expect(cell(r, "stress.sigmaXSelfWeightTop")).toBeLessThan(0);
    expect(cell(r, "stress.sigmaZTrolley")).toBeLessThan(0); // teker basıncı
  });

  it("bileşik gerilme her gövde sacı için ayrı hesaplanır, elverişsizi seçilir", () => {
    expect(cell(r, "stress.combinedBottomCase1")).toBe(
      Math.max(
        cell(r, "stress.combinedBottomMainCase1"),
        cell(r, "stress.combinedBottomSecondaryCase1")
      )
    );
    expect(cell(r, "stress.combinedCase3")).toBe(
      Math.max(cell(r, "stress.combinedBottomCase3"), cell(r, "stress.combinedTopCase3"))
    );
    // İkincil gövde sacı yeterince inceldiğinde elverişsiz hâle gelir
    // (yükün yarısını taşır ama kesit alanı çok daha küçüktür)
    const thin = run({ inp: { t4Mm: 2 } });
    expect(cell(thin, "stress.shearSecondaryCase1")).toBeGreaterThan(
      cell(thin, "stress.shearMainCase1")
    );
    expect(cell(thin, "stress.combinedBottomCase1")).toBe(
      cell(thin, "stress.combinedBottomSecondaryCase1")
    );
  });

  it("Durum I ve Durum III aynı kabulü kullanır (k = ψ iken sonuçlar eşit)", () => {
    // ρ1 = 1 ve ρ2 = 0 → k = ψ·1 = ψ; iki kombinasyon birebir örtüşmeli
    const same = run({ inp: { dynTestFactorR1: 1, statTestFactorR2: 0 } });
    expect(cell(same, "stress.testFactor")).toBeCloseTo(cell(same, "load.dynamicFactor"), 10);
    expect(cell(same, "stress.sigmaXBottomCase3")).toBeCloseTo(
      cell(same, "stress.sigmaXBottomCase1"), 8
    );
    expect(cell(same, "stress.shearSecondaryCase3")).toBeCloseTo(
      cell(same, "stress.shearSecondaryCase1"), 8
    );
    expect(cell(same, "stress.combinedBottomCase3")).toBeCloseTo(
      cell(same, "stress.combinedBottomCase1"), 8
    );
  });

  it("von Mises bileşkesi tanımıyla birebir örtüşür", () => {
    const sx = cell(r, "stress.sigmaXBottomCase1");
    const sz = cell(r, "stress.sigmaZCase1");
    const tau = cell(r, "stress.shearMainCase1");
    expect(cell(r, "stress.combinedBottomMainCase1")).toBeCloseTo(
      Math.sqrt(sx ** 2 + sz ** 2 - Math.abs(sx * sz) + 3 * tau ** 2), 8
    );
    // Kayma yokken bileşke saf normal gerilmeye iner
    expect(Math.sqrt(sx ** 2)).toBeCloseTo(Math.abs(sx), 10);
  });

  it("γc yapı sınıfından gelir, elle ezilebilir ve gerilmeleri ölçekler", () => {
    expect(cell(r, "load.amplifyFactor")).toBeCloseTo(
      STRUCTURE_AMPLIFY_FACTOR[V5_SPECS.structureClass], 10
    );
    const a1 = run({ specs: { structureClass: "A1" } });
    const a8 = run({ specs: { structureClass: "A8" } });
    expect(cell(a8, "stress.amplifiedCombinedBottom") / cell(a1, "stress.amplifiedCombinedBottom"))
      .toBeCloseTo(1.2 / 1.0, 6);
    expect(cell(run({ inp: { amplifyYcOverride: 1.2 } }), "load.amplifyFactor")).toBe(1.2);
  });

  it("izin gerilmesi malzemeden gelir ve Durum III daha yüksektir", () => {
    const st52 = run({ sel: { staticMaterial: "St52" } });
    expect(cell(st52, "stress.allowableCase1")).toBe(GIRDER_ALLOWABLE_STRESS.St52.case1);
    expect(cell(st52, "stress.allowableCase3")).toBeGreaterThan(
      cell(st52, "stress.allowableCase1")
    );
  });

  it("yük iki katına çıkınca yükten gelen gerilme iki katına çıkar", () => {
    const q1 = run({ specs: { mainCapacityT: 4 } });
    const q2 = run({ specs: { mainCapacityT: 8 } });
    expect(cell(q2, "stress.sigmaXHoistBottom")).toBeCloseTo(
      2 * cell(q1, "stress.sigmaXHoistBottom"), 8
    );
  });
});

describe("ana kiriş — yorulma (DIN 15018)", () => {
  const r = run();

  it("σy elle girilmez, teker basıncından gelir", () => {
    expect(cell(r, "fatigue.sigmaYMax")).toBeCloseTo(
      Math.abs(cell(r, "stress.sigmaZCase1")) / 9.81, 8
    );
    expect(cell(r, "fatigue.sigmaYMin")).toBeCloseTo(
      Math.abs(cell(r, "stress.sigmaZTrolley")) / 9.81, 8
    );
    const o = run({ inp: { sigmaYMaxOverrideNmm2: 34, sigmaYMinOverrideNmm2: 8 } });
    expect(cell(o, "fatigue.sigmaYMax")).toBe(34);
    expect(cell(o, "fatigue.sigmaYMin")).toBe(8);
  });

  it("τ,maks GERÇEK kayma gerilmesidir, teker basıncı değil", () => {
    const tau = Math.max(
      Math.abs(cell(r, "stress.shearMainCase1")),
      Math.abs(cell(r, "stress.shearSecondaryCase1"))
    ) / 9.81;
    expect(cell(r, "fatigue.tauMax")).toBeCloseTo(tau, 8);
    expect(cell(r, "fatigue.tauMax")).not.toBeCloseTo(
      Math.abs(cell(r, "stress.sigmaZCase1")) / 9.81, 3
    );
  });

  it("τ,min yalnız öz ağırlıktan gelir ve κτ hesabına girer", () => {
    expect(cell(r, "fatigue.tauMin")).toBeCloseTo(
      Math.abs(cell(r, "stress.shearMainSelfWeight")) / 9.81, 8
    );
    expect(cell(r, "fatigue.kappaTau")).toBeCloseTo(
      cell(r, "fatigue.tauMin") / cell(r, "fatigue.tauMax"), 8
    );
    expect(cell(r, "fatigue.kappaTau")).toBeGreaterThan(0);
    expect(cell(r, "fatigue.kappaTau")).toBeLessThan(1);
  });

  it("σB yorulma malzemesinden türetilir, elle ezilebilir", () => {
    expect(cell(run({ sel: { fatigueMaterial: "S235JR" } }), "fatigue.tensileStrength"))
      .toBe(FATIGUE_TENSILE_NMM2.S235JR);
    expect(cell(run({ sel: { fatigueMaterial: "S355JR" } }), "fatigue.tensileStrength"))
      .toBe(FATIGUE_TENSILE_NMM2.S355JR);
    expect(cell(run({ inp: { fatigueTensileOverrideNmm2: 350 } }), "fatigue.tensileStrength"))
      .toBe(350);
  });

  it("yük grubu kaldırma/yük sınıfından türetilir, elle ezilebilir", () => {
    expect(r.cells["fatigue.loadGroup"]).toBe("B4"); // "H3/B4"
    expect(run({ sel: { fatigueLoadGroupOverride: "B2" } }).cells["fatigue.loadGroup"]).toBe("B2");
    // Daha ağır grup daha düşük izin gerilmesi verir
    expect(cell(run({ sel: { fatigueLoadGroupOverride: "B6" } }), "fatigue.allowableD1"))
      .toBeLessThan(cell(run({ sel: { fatigueLoadGroupOverride: "B2" } }), "fatigue.allowableD1"));
  });

  it("bileşik yorulma oranı bileşenlerinin karelerinden gelir", () => {
    const sx = cell(r, "fatigue.sigmaXMax") / cell(r, "fatigue.allowableSigmaX");
    const sy = cell(r, "fatigue.sigmaYMax") / cell(r, "fatigue.allowableSigmaY");
    const tt = cell(r, "fatigue.tauMax") / cell(r, "fatigue.allowableTau");
    expect(cell(r, "fatigue.combined")).toBeCloseTo(sx ** 2 + sy ** 2 - sx * sy + tt ** 2, 8);
  });
});

describe("ana kiriş — sehim", () => {
  const r = run();

  it("sehim mm cinsindedir ve oran birimsizdir", () => {
    const deltaMm = cell(r, "deflection.value");
    expect(Math.abs(deltaMm)).toBeGreaterThan(0.1);   // cm olsaydı 10 kat küçük olurdu
    expect(Math.abs(deltaMm)).toBeLessThan(100);
    expect(cell(r, "deflection.ratio")).toBeCloseTo(V5_SPECS.spanM * 1000 / deltaMm, 6);
  });

  it("sehim atalet momentiyle ters, yükle doğru orantılıdır", () => {
    // δ · I sabit kalmalı (aynı yük, aynı açıklık, farklı gövde kalınlığı)
    const a = run();
    const b = run({ inp: { t3Mm: 14, t4Mm: 14 } });
    const pa = cell(a, "deflection.value") * cell(a, "section.inertiaY");
    const pb = cell(b, "deflection.value") * cell(b, "section.inertiaY");
    expect(Math.abs(pa - pb) / Math.abs(pa)).toBeLessThan(1e-9);

    // Yük artınca sehim doğrusal artar (doğrusal elastik)
    const q1 = run({ specs: { mainCapacityT: 4 } });
    const q2 = run({ specs: { mainCapacityT: 8 } });
    expect(cell(q2, "deflection.value") / cell(q1, "deflection.value")).toBeCloseTo(
      cell(q2, "deflection.wheelLoad") / cell(q1, "deflection.wheelLoad"), 8
    );
  });

  it("sehim sınırı kontrolü uyarı seviyesindedir", () => {
    const chk = r.checks.find((c) => c.id === "girder.deflection")!;
    expect(chk.severity).toBe("uyari");
    expect(chk.kind).toBe("firma");
  });
});

describe("ana kiriş — sağlamlık", () => {
  it("varsayılan girdilerle üretilen tüm sayısal hücreler sonludur", () => {
    const r = run();
    const bad = Object.entries(r.cells).filter(
      ([, v]) => typeof v === "number" && !Number.isFinite(v)
    );
    expect(bad.map(([k]) => k)).toEqual([]);
  });

  it("kontrollerin tamamı dayanak ve ağırlık taşır", () => {
    for (const c of run().checks) {
      expect(c.kind, c.id).toBeDefined();
      expect(c.severity, c.id).toBeDefined();
      expect(c.standard, c.id).toBeTruthy();
    }
  });
});
