// Tampon çekirdeği — MÜHENDİSLİK DOĞRULAMA.
//
// Eski hesap tablosuna karşı değil, FİZİĞE ve standardın metnine karşı sınanır:
// enerji dengesi, birim tutarlılığı, eğri enterpolasyonunun uç noktaları, hız
// eşiği ve yavaşlama sınırı.

import { describe, expect, it } from "vitest";
import {
  BUFFER_SPEED_THRESHOLD_MPS,
  DECELERATION_LIMIT_FREQUENT_MPS2,
  DECELERATION_LIMIT_MPS2,
  cellularCurvesAtImpactSpeed,
  HYDRAULIC_DAMPING_EFFICIENCY,
  computeBuffer,
  interpolateCurve,
  inverseCurve,
  selectMeteringPin,
  type BufferInput,
  type CurvePoint,
} from "../buffer";
import { cellularSpeedCurvesForModel } from "../cellularBufferSpeedCurves";
import { V5_SPECS } from "../defaults";
import {
  V5_BRIDGE_INPUTS,
  V5_BRIDGE_SELECTIONS,
  V5_TRAVEL_DEPS,
  V5_TROLLEY_INPUTS,
  V5_TROLLEY_SELECTIONS,
} from "../defaults/travel";
import { computeTravelGroup } from "../modules/travelGroup";

/** Hidrolik tampon temel girdisi — testler bunun üstüne yazar. */
const BASE: BufferInput = {
  which: "trolley",
  type: "hidrolik",
  nominalSpeedMpm: 60,          // 1 m/s
  impactSpeedRatio: 1,
  massPerBufferT: 10,
  bufferCount: 2,
  drivePowerTotalKw: 0,         // tahriksiz — saf kinetik denge
  strokeMm: 100,
  catalogEnergyKj: 100,
  catalogMaxForceKn: 1000,
  catalogDesignMassMaxT: 0,
  maxCompressionPct: 0,
  frequentEndApproach: false,
};

const check = (r: ReturnType<typeof computeBuffer>, suffix: string) =>
  r.checks.find((c) => c.id === `trolley.${suffix}`);

// --------------------------------------------------------- eğri enterpolasyonu

describe("eğri enterpolasyonu", () => {
  const curve: CurvePoint[] = [
    [0, 0],
    [25, 100],
    [50, 400],
  ];

  it("düğüm noktalarını birebir verir", () => {
    expect(interpolateCurve(curve, 0)).toBe(0);
    expect(interpolateCurve(curve, 25)).toBe(100);
    expect(interpolateCurve(curve, 50)).toBe(400);
  });

  it("düğümler arasında DOĞRUSAL enterpole eder", () => {
    // 12,5 % → 0 ile 100 arasının ortası
    expect(interpolateCurve(curve, 12.5)).toBeCloseTo(50, 10);
    // 37,5 % → 100 ile 400 arasının ortası
    expect(interpolateCurve(curve, 37.5)).toBeCloseTo(250, 10);
  });

  it("eğrinin DIŞINA ekstrapole ETMEZ — uç noktada kalır", () => {
    // Katalog eğrisinin ötesi ölçülmemiş bölgedir; uydurma sayı üretilmez.
    expect(interpolateCurve(curve, -10)).toBe(0);
    expect(interpolateCurve(curve, 999)).toBe(400);
  });

  it("ters enterpolasyon düz enterpolasyonun tersidir", () => {
    for (const pct of [0, 5, 12.5, 25, 40, 50]) {
      const y = interpolateCurve(curve, pct)!;
      expect(inverseCurve(curve, y)).toBeCloseTo(pct, 8);
    }
  });

  it("boş / bozuk eğride değer ÜRETMEZ", () => {
    expect(interpolateCurve([], 10)).toBeUndefined();
    expect(interpolateCurve(undefined, 10)).toBeUndefined();
    expect(inverseCurve([], 10)).toBeUndefined();
  });
});

describe("SIBRE SP kısma iğnesi seçimi", () => {
  const pins = [
    { design_mass_t_max: 5, metering_pin_code: "102" },
    { design_mass_t_max: 10, metering_pin_code: "104" },
    { design_mass_t_max: 20, metering_pin_code: "106" },
  ];

  it("tasarım kütlesini karşılayan en küçük katalog sınıfını seçer", () => {
    expect(selectMeteringPin(pins, 5)).toEqual({ code: "102", designMassMaxT: 5 });
    expect(selectMeteringPin(pins, 5.01)).toEqual({ code: "104", designMassMaxT: 10 });
  });

  it("katalog sınıfı yetmezse kod üretmez", () => {
    expect(selectMeteringPin(pins, 21)).toBeUndefined();
  });
});

// ------------------------------------------------------------ enerji dengesi

describe("enerji dengesi ve birim tutarlılığı", () => {
  it("E = ½·m·v²: 10 t, 1 m/s → 5 kJ", () => {
    // t · (m/s)² = kJ — ara birim dönüşümü YOKTUR.
    const r = computeBuffer(BASE);
    expect(r.values.impactSpeedMps).toBeCloseTo(1, 12);
    expect(r.values.impactEnergyKj).toBeCloseTo(5, 12);
  });

  it("çarpma hızı oranı k enerjiyi KARESİYLE ölçekler", () => {
    const tam = computeBuffer(BASE).values.impactEnergyKj;
    const yedide = computeBuffer({ ...BASE, impactSpeedRatio: 0.7 }).values.impactEnergyKj;
    expect(yedide / tam).toBeCloseTo(0.49, 12);
  });

  it("tahrik kuvveti F₀ = P/v — birim tutarlı (kW·1000/[m/s] = N)", () => {
    // 10 kW, 1 m/s → 10.000 N toplam; 2 tampon → 5.000 N/tampon.
    const r = computeBuffer({ ...BASE, drivePowerTotalKw: 10 });
    expect(r.values.totalDriveForceN).toBeCloseTo(10000, 6);
    expect(r.values.driveForcePerBufferN).toBeCloseTo(5000, 6);
  });

  it("tahrik enerjisi E_pot = F₀·f′ ve toplam E_a = E_kin + E_pot", () => {
    const r = computeBuffer({ ...BASE, drivePowerTotalKw: 10 });
    // 5.000 N × 0,1 m = 500 J = 0,5 kJ
    expect(r.values.driveEnergyKj).toBeCloseTo(0.5, 9);
    expect(r.values.totalEnergyKj).toBeCloseTo(5.5, 9);
    expect(r.values.totalEnergyKj - r.values.impactEnergyKj).toBeCloseTo(
      r.values.driveEnergyKj,
      12
    );
  });

  it("hidrolik tampon kuvveti F = E_a/(s·η) ile TERSİNE çözülebilir", () => {
    const r = computeBuffer({ ...BASE, drivePowerTotalKw: 10 });
    const sonuc = r.values.reactionForceKn;
    // Ters çözüm: kuvvetten enerjiye dönülünce aynı E_a çıkmalı.
    const geri =
      sonuc *
      (r.values.strokeUsedMm / 1000) *
      HYDRAULIC_DAMPING_EFFICIENCY;
    expect(geri).toBeCloseTo(r.values.totalEnergyKj, 9);
  });

  it("tahrik kuvvetini tampon direncine eklemez; ivme net kuvvetle hesaplanır", () => {
    const r = computeBuffer({ ...BASE, drivePowerTotalKw: 10 });
    const strokeM = r.values.strokeUsedMm / 1000;
    const expectedResistanceKn = r.values.totalEnergyKj / (strokeM * HYDRAULIC_DAMPING_EFFICIENCY);
    const expectedDeceleration =
      (expectedResistanceKn * 1000 - r.values.driveForcePerBufferN) /
      (r.values.massPerBufferT * 1000);

    expect(r.values.reactionForceKn).toBeCloseTo(expectedResistanceKn, 9);
    expect(r.values.maxDecelerationMps2).toBeCloseTo(expectedDeceleration, 9);
  });

  it("sönümleme verimi 0,85'tir (SIBRE SP kataloğu) ve kuvveti belirler", () => {
    expect(HYDRAULIC_DAMPING_EFFICIENCY).toBe(0.85);
    const r = computeBuffer(BASE);
    // 5 kJ / (0,1 m · 0,85) = 58,82 kN
    expect(r.values.reactionForceKn).toBeCloseTo(5 / (0.1 * 0.85), 9);
  });

  it("kütle tampon adedine bölündüğünde enerji de aynı oranda düşer", () => {
    const tek = computeBuffer({ ...BASE, massPerBufferT: 10 }).values.impactEnergyKj;
    const yarim = computeBuffer({ ...BASE, massPerBufferT: 5 }).values.impactEnergyKj;
    expect(yarim / tek).toBeCloseTo(0.5, 12);
  });
});

// -------------------------------------------------------------- kauçuk tampon

describe("kauçuk tampon — eğriden çözüm", () => {
  // Basit ama DOĞRUSAL OLMAYAN örnek eğri (kauçuk gibi sertleşen).
  const energyCurve: CurvePoint[] = [[0, 0], [25, 1000], [50, 8000]];
  const forceCurve: CurvePoint[] = [[0, 0], [25, 20], [50, 100]];
  const RUBBER: BufferInput = {
    ...BASE,
    type: "kaucuk",
    massPerBufferT: 2,
    nominalSpeedMpm: 60,
    strokeMm: 50,              // %50 izinli sıkışma için kullanılabilir strok
    energyCurve,
    forceCurve,
    maxCompressionPct: 50,
    catalogEnergyKj: 8,
    catalogMaxForceKn: 100,
  };

  it("kapalı formül DEĞİL, eğri kullanılır: sıkışma enerjiden okunur", () => {
    // E_kin = ½·2·1² = 1 kJ = 1000 J → eğride tam %25.
    const r = computeBuffer(RUBBER);
    expect(r.values.impactEnergyKj).toBeCloseTo(1, 12);
    expect(r.values.compressionPct).toBeCloseTo(25, 6);
    expect(r.values.strokeUsedMm).toBeCloseTo(25, 6);
    // Kuvvet AYNI yüzdeden okunur.
    expect(r.values.reactionForceKn).toBeCloseTo(20, 6);
  });

  it("tahrik enerjisi varsa iterasyon YAKINSAR ve enerji dengesi kapanır", () => {
    const r = computeBuffer({ ...RUBBER, drivePowerTotalKw: 4 });
    // F₀ = 4000 W / 1 m/s / 2 tampon = 2000 N
    expect(r.values.driveForcePerBufferN).toBeCloseTo(2000, 6);
    // Yakınsama koşulu: okunan sıkışmadaki eğri enerjisi = E_a
    const curveEnergyJ = interpolateCurve(energyCurve, r.values.compressionPct)!;
    expect(curveEnergyJ / 1000).toBeCloseTo(r.values.totalEnergyKj, 6);
    // ve E_pot gerçekten F₀ · f′
    expect(r.values.driveEnergyKj).toBeCloseTo(
      (2000 * (r.values.strokeUsedMm / 1000)) / 1000,
      9
    );
    // Tahrik enerjisi sıkışmayı ARTIRIR (tahriksiz hâlden büyük olmalı)
    expect(r.values.compressionPct).toBeGreaterThan(computeBuffer(RUBBER).values.compressionPct);
  });

  it("sıkışma sınırı aşılırsa üretici kontrolü UYGUN ÇIKMAZ", () => {
    // Ağır kütle: eğrinin tepesini zorlar.
    const r = computeBuffer({ ...RUBBER, massPerBufferT: 40 });
    const c = r.checks.find((x) => x.id === "trolley.buffer.compression");
    expect(c).toBeDefined();
    expect(c!.pass).toBe(false);
    expect(c!.kind).toBe("uretici");
  });

  it("EĞRİ VERİSİ YOKSA sessiz kalmaz: hesap yapılmaz, bilgi kontrolü çıkar", () => {
    const r = computeBuffer({
      ...RUBBER,
      energyCurve: undefined,
      forceCurve: undefined,
    });
    expect(r.values.computed).toBe(false);
    expect(r.values.reactionForceKn).toBe(0);
    const scope = check(r, "buffer.scope");
    expect(scope).toBeDefined();
    expect(scope!.kind).toBe("bilgi");
    // Uydurma bir enerji/kuvvet kontrolü ÜRETİLMEZ
    expect(check(r, "buffer.energy")).toBeUndefined();
    expect(check(r, "buffer.load")).toBeUndefined();
  });

  it("hücresel tampon KAT0180 hız eğrisini kullanır; limitlerden eğri uydurmaz", () => {
    const cellularSpeedCurves = cellularSpeedCurvesForModel("Conductix-Wampfler 018112-080x080");
    const r = computeBuffer({
      ...RUBBER,
      type: "hucresel",
      energyCurve: undefined,
      forceCurve: undefined,
      cellularSpeedCurves,
      massPerBufferT: 1,
      strokeMm: 64,
      catalogEnergyKj: 1.52,
      catalogMaxForceKn: 31,
      maxCompressionPct: 80,
    });
    expect(r.values.computed).toBe(true);
    expect(r.values.compressionPct).toBeGreaterThan(0);
    expect(r.values.compressionPct).toBeLessThanOrEqual(80);
    expect(r.values.reactionForceKn).toBeGreaterThan(0);
    expect(check(r, "buffer.energy")?.pass).toBe(true);
    expect(check(r, "buffer.deceleration")).toBeDefined();
    const deceleration = check(r, "buffer.deceleration");
    expect(deceleration && "required" in deceleration ? deceleration.required : undefined)
      .toBeCloseTo(r.values.maxDecelerationMps2, 12);
  });

  it("hücresel eğri çarpma hızında enterpole edilir ve 4 m/s üstünde hesaplanmaz", () => {
    const curves = cellularSpeedCurvesForModel("Conductix-Wampfler 018112-080x080");
    const staticCurve = cellularCurvesAtImpactSpeed(curves, 0, 31)!;
    const dynamicCurve = cellularCurvesAtImpactSpeed(curves, 4, 31)!;
    const midpoint = cellularCurvesAtImpactSpeed(curves, 0.5, 31)!;

    expect(staticCurve.energyCapacityKj).toBeCloseTo(0.6966, 4);
    expect(dynamicCurve.energyCapacityKj).toBeCloseTo(1.5084, 4);
    expect(midpoint.energyCapacityKj).toBeCloseTo((0.6966 + 0.8843) / 2, 4);
    expect(dynamicCurve.forceCapacityKn).toBeCloseTo(31 * 1.6197, 4);
    expect(cellularCurvesAtImpactSpeed(curves, 4.01, 31)).toBeUndefined();
  });

  it("teknik özellikteki Kauçuk ailesinde katalogdan hücresel alt tür seçilebilir", () => {
    const result = computeTravelGroup(
      { ...V5_SPECS, trolleyBufferType: "kaucuk" },
      "trolley",
      V5_TROLLEY_INPUTS,
      {
        ...V5_TROLLEY_SELECTIONS,
        bufferCatalogType: "hücresel",
        bufferModel: "Conductix-Wampfler 018112-080x080",
        bufferStrokeMm: 64,
        bufferEnergyKj: 1.52,
        bufferLoadKn: 31,
        bufferEnergyCurve: undefined,
        bufferForceCurve: undefined,
        bufferMaxCompressionPct: 80,
      },
      V5_TRAVEL_DEPS
    );
    expect(result.values.bufferType).toBe("hucresel");
    expect(result.values.bufferComputed).toBe(true);
  });
});

// ----------------------------------------------------------------- kontroller

describe("kontroller ve standart eşikleri", () => {
  it("hız eşiği 0,4 m/s'dir (FEM Kitapçık 9 md. 9.4.2)", () => {
    expect(BUFFER_SPEED_THRESHOLD_MPS).toBe(0.4);
  });

  it("eşiğin ALTINDA tepki yapıya aktarılmaz ama tampon YİNE hesaplanır", () => {
    // 18 m/dak = 0,3 m/s < 0,4
    const r = computeBuffer({ ...BASE, nominalSpeedMpm: 18 });
    expect(r.values.transferredToStructure).toBe(false);
    expect(r.values.impactEnergyKj).toBeGreaterThan(0);
    expect(r.values.reactionForceKn).toBeGreaterThan(0);
    const c = check(r, "buffer.speedThreshold");
    expect(c!.kind).toBe("bilgi");
    expect(c!.standard).toBe("FEM 1.001 9.4.2");
  });

  it("eşiğin ÜSTÜNDE tepki yapıya aktarılır", () => {
    expect(computeBuffer({ ...BASE, nominalSpeedMpm: 30 }).values.transferredToStructure)
      .toBe(true);
  });

  it("yavaşlama sınırı 5 m/s², sınıra sık ulaşılıyorsa 2,5 m/s²", () => {
    expect(DECELERATION_LIMIT_MPS2).toBe(5);
    expect(DECELERATION_LIMIT_FREQUENT_MPS2).toBe(2.5);
    // v_ç = 1 m/s, f′ = 0,1 m → a_ort = 1/(2·0,1) = 5 m/s² (tam sınırda)
    const r = computeBuffer({ ...BASE, strokeMm: 100 });
    expect(r.values.avgDecelerationMps2).toBeCloseTo(5, 9);
    // Sık yanaşmada aynı tasarım UYGUN ÇIKMAZ
    const sik = computeBuffer({ ...BASE, frequentEndApproach: true });
    expect(check(sik, "buffer.deceleration")!.pass).toBe(false);
  });

  it("uzun strok yavaşlamayı düşürür (a ~ 1/f′)", () => {
    const kisa = computeBuffer({ ...BASE, strokeMm: 100 }).values.avgDecelerationMps2;
    const uzun = computeBuffer({ ...BASE, strokeMm: 200 }).values.avgDecelerationMps2;
    expect(uzun / kisa).toBeCloseTo(0.5, 9);
  });

  it("ortalama yavaşlama ile tepe yavaşlama farklı büyüklüklerdir", () => {
    // Kullanıcının karşılaştırdığı örnekler: köprüde %70 çarpma hızı, arabada %100.
    const bridge = computeBuffer({ ...BASE, nominalSpeedMpm: 60, impactSpeedRatio: 0.7, strokeMm: 100 });
    const trolley65 = computeBuffer({ ...BASE, nominalSpeedMpm: 40, impactSpeedRatio: 1, strokeMm: 65 });
    const trolley200 = computeBuffer({ ...BASE, nominalSpeedMpm: 40, impactSpeedRatio: 1, strokeMm: 200 });

    expect(bridge.values.avgDecelerationMps2).toBeCloseTo(2.45, 2);
    expect(trolley65.values.avgDecelerationMps2).toBeCloseTo(3.42, 2);
    expect(trolley200.values.avgDecelerationMps2).toBeCloseTo(1.11, 2);
    // a_maks tampon kuvvet eğrisinden gelir; strok ve hızın tek başına türevi değildir.
    expect(trolley65.values.maxDecelerationMps2).not.toBeCloseTo(trolley65.values.avgDecelerationMps2, 4);
  });

  it("enerji kontrolü standart, kuvvet kontrolü üretici dayanaklıdır", () => {
    const r = computeBuffer(BASE);
    expect(check(r, "buffer.energy")!.kind).toBe("standart");
    expect(check(r, "buffer.energy")!.standard).toBe("FEM 1.001 2.2.3.4.1");
    expect(check(r, "buffer.load")!.kind).toBe("uretici");
    expect(check(r, "buffer.energy")!.severity).toBe("engelleyici");
  });

  it("kısma iğnesi kontrolü YALNIZ katalog verisi varken üretilir", () => {
    expect(check(computeBuffer(BASE), "buffer.designMass")).toBeUndefined();
    const r = computeBuffer({ ...BASE, catalogDesignMassMaxT: 5 });
    // 10 t > 5 t sınıf tavanı → uygun değil
    expect(check(r, "buffer.designMass")!.pass).toBe(false);
    expect(check(computeBuffer({ ...BASE, catalogDesignMassMaxT: 20 }), "buffer.designMass")!.pass)
      .toBe(true);
  });

  it("tampon YOKSA hesap koşmaz ve bunu bilgi kontrolüyle SÖYLER", () => {
    const r = computeBuffer({ ...BASE, type: "yok" });
    expect(r.values.computed).toBe(false);
    expect(check(r, "buffer.scope")!.kind).toBe("bilgi");
    expect(check(r, "buffer.energy")).toBeUndefined();
    // Anahtar kümesi yine üretilir (rapor iskeleti sabit kalır)
    expect(r.cells["buffer.totalEnergy"]).toBe(0);
    expect(r.cells["buffer.reactionForce"]).toBe(0);
  });
});

// --------------------------------------------- yürütme modülüyle bütünleşme

describe("yürütme modülünde tampon", () => {
  const trolley = () =>
    computeTravelGroup(V5_SPECS, "trolley", V5_TROLLEY_INPUTS, V5_TROLLEY_SELECTIONS, V5_TRAVEL_DEPS);
  const bridge = () =>
    computeTravelGroup(V5_SPECS, "bridge", V5_BRIDGE_INPUTS, V5_BRIDGE_SELECTIONS, V5_TRAVEL_DEPS);

  it("SALINABİLİR yük çarpışan kütleye GİRMEZ (FEM 1.001 2.2.3.4.1)", () => {
    const t = trolley();
    // Araba ağırlığı 2,5 t / 2 tampon = 1,25 t; kapasite (4 t) ve kanca
    // donanımı (3,5 t) HARİÇTİR.
    expect(t.values.collisionLoadT).toBeCloseTo(V5_SPECS.mainTrolleyWeightT / 2, 9);
  });

  it("RİJİT KILAVUZLU yükte kapasite ve kanca donanımı kütleye EKLENİR", () => {
    const rijit = computeTravelGroup(
      V5_SPECS, "trolley",
      { ...V5_TROLLEY_INPUTS, bufferLoadRigidlyGuided: "Evet" },
      V5_TROLLEY_SELECTIONS, V5_TRAVEL_DEPS
    );
    const beklenen =
      (V5_SPECS.mainTrolleyWeightT + V5_SPECS.mainCapacityT + V5_TRAVEL_DEPS.hookEquipmentT) / 2;
    expect(rijit.values.collisionLoadT).toBeCloseTo(beklenen, 9);
    // Kütle arttığı için enerji de artar
    expect(rijit.values.impactEnergyKj).toBeGreaterThan(trolley().values.impactEnergyKj);
  });

  it("köprüde çarpışan kütle eksantriktir ve BİR tampona gelen paydır", () => {
    const b = bridge();
    const beklenen =
      V5_SPECS.bridgeWeightT / 2 +
      (V5_TRAVEL_DEPS.trolleyWeightT * (V5_SPECS.spanM - V5_BRIDGE_INPUTS.bufferApproachM)) /
        V5_SPECS.spanM;
    expect(b.values.collisionLoadT).toBeCloseTo(beklenen, 9);
  });

  it("çarpma hızı oranı teknik özelliklerden okunur (araba %100, köprü %70)", () => {
    expect(trolley().values.bufferImpactSpeedRatio).toBeCloseTo(1, 12);
    expect(bridge().values.bufferImpactSpeedRatio).toBeCloseTo(0.7, 12);
    const yavas = computeTravelGroup(
      { ...V5_SPECS, trolleyBufferImpactSpeedPct: 70 },
      "trolley", V5_TROLLEY_INPUTS, V5_TROLLEY_SELECTIONS, V5_TRAVEL_DEPS
    );
    expect(yavas.values.bufferImpactSpeedRatio).toBeCloseTo(0.7, 12);
    // %70 hızda enerji 0,49 katına iner
    expect(yavas.values.impactEnergyKj / trolley().values.impactEnergyKj).toBeCloseTo(0.49, 9);
  });

  it("tahrik kuvveti = çıkış momenti / teker yarıçapı ile ÖZDEŞTİR", () => {
    const b = bridge();
    // F₀ = P/v ; aynı zamanda T_çıkış / r olmalı.
    const powerW = V5_BRIDGE_SELECTIONS.motorPowerKw * 1000;
    const outputTorqueNm = (9550 * V5_BRIDGE_SELECTIONS.motorPowerKw / V5_BRIDGE_SELECTIONS.motorRpm)
      * V5_BRIDGE_SELECTIONS.gearboxRatio;
    const radiusM = V5_BRIDGE_SELECTIONS.wheelDiaMm / 2 / 1000;
    const speedMps = b.values.actualSpeedMpm / 60;
    expect(b.values.driveLoadPerMotorN).toBeCloseTo(powerW / speedMps, 6);
    // 9550 ≈ 60000/2π = 9549,297 olduğundan iki yol %0,01 içinde örtüşür.
    const oran = b.values.driveLoadPerMotorN / (outputTorqueNm / radiusM);
    expect(Math.abs(oran - 1)).toBeLessThan(1e-4);
  });

  it("tampon adedi arttıkça tampon başına kütle ve enerji AZALIR", () => {
    const iki = trolley().values;
    const dort = computeTravelGroup(
      V5_SPECS, "trolley", { ...V5_TROLLEY_INPUTS, bufferCount: 4 },
      V5_TROLLEY_SELECTIONS, V5_TRAVEL_DEPS
    ).values;
    expect(dort.collisionLoadT / iki.collisionLoadT).toBeCloseTo(0.5, 9);
    expect(dort.impactEnergyKj / iki.impactEnergyKj).toBeCloseTo(0.5, 9);
  });

  it("tampon tipi \"yok\" seçilince tampon kontrolleri üretilmez", () => {
    const yok = computeTravelGroup(
      { ...V5_SPECS, trolleyBufferType: "yok" },
      "trolley", V5_TROLLEY_INPUTS, V5_TROLLEY_SELECTIONS, V5_TRAVEL_DEPS
    );
    expect(yok.checks.find((c) => c.id === "trolley.buffer.energy")).toBeUndefined();
    expect(yok.checks.find((c) => c.id === "trolley.buffer.scope")).toBeDefined();
    expect(yok.values.bufferForceKn).toBe(0);
  });

  it("SIBRE SP kısma iğnesini katalogdaki kütle sınıfından otomatik seçer", () => {
    const withPins = computeTravelGroup(
      V5_SPECS,
      "trolley",
      V5_TROLLEY_INPUTS,
      {
        ...V5_TROLLEY_SELECTIONS,
        bufferMeteringPins: [
          { design_mass_t_max: 1, metering_pin_code: "102" },
          { design_mass_t_max: 2, metering_pin_code: "104" },
        ],
      },
      V5_TRAVEL_DEPS
    );
    expect(withPins.values.collisionLoadT).toBeGreaterThan(1);
    expect(withPins.values.bufferMeteringPinCode).toBe("104");
    expect(withPins.values.bufferDesignMassMaxT).toBe(2);
    expect(withPins.checks.find((item) => item.id === "trolley.buffer.designMass")?.pass).toBe(true);
  });
});
