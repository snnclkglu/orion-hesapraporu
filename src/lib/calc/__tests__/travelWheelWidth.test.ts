// Teker mili — TEKER GENİŞLİĞİ (yayılı yük) mühendislik doğrulaması.
//
// Yöntem: teker göbeği mile bir çizgi üzerinden basmaz; yük bandaj genişliği
// kadar bir bant boyunca aktarılır. Bant açıklığın ortasında merkezlendiğinde
//   · mesnet tepkileri            R = Pmaks / 2        (DEĞİŞMEZ)
//   · maksimum kesme kuvveti      V = Pmaks / 2        (DEĞİŞMEZ)
//   · açıklık ortası momenti      M = R·a − q·b_t²/8   (KÜÇÜLÜR)
// olur. q·b_t² / 8 = Pmaks·b_t / 8 olduğundan düşüş yalnız teker genişliğine
// ve teker yüküne bağlıdır — mil çapından ve malzemeden bağımsızdır.
//
// GERİYE DÖNÜK UYUM burada KİLİTLENİR: alan tanımsız ya da 0 ise motor tekil
// yük modeline geri döner ve eski revizyonların sayıları BİREBİR korunur.

import { describe, expect, it } from "vitest";
import { V5_SPECS } from "../defaults";
import {
  V5_BRIDGE_INPUTS,
  V5_BRIDGE_SELECTIONS,
  V5_TRAVEL_DEPS,
  V5_TROLLEY_INPUTS,
  V5_TROLLEY_SELECTIONS,
} from "../defaults/travel";
import {
  computeTravelGroup,
  type TravelInputs,
  type TravelValues,
} from "../modules/travelGroup";

function runTrolley(overrides: Partial<TravelInputs>) {
  const res = computeTravelGroup(
    V5_SPECS,
    "trolley",
    { ...V5_TROLLEY_INPUTS, ...overrides },
    V5_TROLLEY_SELECTIONS,
    V5_TRAVEL_DEPS
  );
  return res.values as TravelValues;
}

function runBridge(overrides: Partial<TravelInputs>) {
  const res = computeTravelGroup(
    V5_SPECS,
    "bridge",
    { ...V5_BRIDGE_INPUTS, ...overrides },
    V5_BRIDGE_SELECTIONS,
    V5_TRAVEL_DEPS
  );
  return res.values as TravelValues;
}

describe("teker mili — teker genişliği boyunca yayılı yük", () => {
  it("alan tanımsızsa TEKİL yük modeline döner (eski revizyon uyumu)", () => {
    // `undefined` — bu alanın eklenmesinden önceki revizyonların hâli
    const eski = runTrolley({ wheelWidthMm: undefined });
    const a = V5_TROLLEY_INPUTS.shaftSpanAMm / 10;
    expect(eski.shaftLoadBandCm).toBe(0);
    expect(eski.shaftLoadIntensityKgPerCm).toBe(0);
    // Tekil yükün analitik momenti: M = (Pmaks/2) · a
    expect(eski.maxMomentKgCm).toBeCloseTo((eski.maxWheelLoadKg / 2) * a, 6);
  });

  it("alan 0 ise de tekil yük modeline döner ve tanımsızla AYNI sonucu verir", () => {
    const bosBirakilmis = runTrolley({ wheelWidthMm: undefined });
    const sifir = runTrolley({ wheelWidthMm: 0 });
    expect(sifir.maxMomentKgCm).toBe(bosBirakilmis.maxMomentKgCm);
    expect(sifir.shaftBendingStress).toBe(bosBirakilmis.shaftBendingStress);
    expect(sifir.shaftCombinedStress).toBe(bosBirakilmis.shaftCombinedStress);
    expect(sifir.shaftLoadBandCm).toBe(0);
  });

  it("negatif genişlik de tekil yüke geri düşer (bozuk girdi güvenliği)", () => {
    const bozuk = runTrolley({ wheelWidthMm: -50 });
    const tekil = runTrolley({ wheelWidthMm: 0 });
    expect(bozuk.maxMomentKgCm).toBe(tekil.maxMomentKgCm);
  });

  it("momenti tam olarak Pmaks·b_t/8 kadar düşürür", () => {
    const bt = 9; // cm
    const tekil = runTrolley({ wheelWidthMm: 0 });
    const yayili = runTrolley({ wheelWidthMm: bt * 10 });
    expect(yayili.shaftLoadBandCm).toBeCloseTo(bt, 9);
    expect(yayili.shaftLoadIntensityKgPerCm).toBeCloseTo(yayili.maxWheelLoadKg / bt, 6);
    expect(tekil.maxMomentKgCm - yayili.maxMomentKgCm).toBeCloseTo(
      (yayili.maxWheelLoadKg * bt) / 8,
      6
    );
  });

  it("mesnet tepkilerini ve kesme gerilmesini DEĞİŞTİRMEZ", () => {
    const tekil = runBridge({ wheelWidthMm: 0 });
    const yayili = runBridge({ wheelWidthMm: 100 });
    expect(yayili.reactionAKg).toBeCloseTo(tekil.reactionAKg, 9);
    expect(yayili.reactionBKg).toBeCloseTo(tekil.reactionBKg, 9);
    // Kesme gerilmesi yalnız maksimum kesme kuvvetine bağlıdır; o da değişmez.
    expect(yayili.shaftShearStress).toBeCloseTo(tekil.shaftShearStress, 9);
    // Eğilme ise küçülür.
    expect(yayili.shaftBendingStress).toBeLessThan(tekil.shaftBendingStress);
    expect(yayili.shaftCombinedStress).toBeLessThan(tekil.shaftCombinedStress);
  });

  it("genişlik arttıkça moment tekdüze azalır", () => {
    const moments = [0, 40, 80, 120].map(
      (mm) => runBridge({ wheelWidthMm: mm }).maxMomentKgCm
    );
    for (let i = 1; i < moments.length; i++) {
      expect(moments[i]).toBeLessThan(moments[i - 1]);
    }
  });

  it("açıklıktan geniş teker tüm açıklığa yayılır (bant kelepçelenir)", () => {
    const spanCm = (2 * V5_BRIDGE_INPUTS.shaftSpanAMm) / 10;
    const asiri = runBridge({ wheelWidthMm: spanCm * 10 * 3 });
    expect(asiri.shaftLoadBandCm).toBeCloseTo(spanCm, 9);
    // Tüm açıklığa düzgün yayılı yükte M = P·L/8
    expect(asiri.maxMomentKgCm).toBeCloseTo(
      (asiri.maxWheelLoadKg * spanCm) / 8,
      6
    );
  });

  it("yeni iş şablonunda yayılı yük AÇIKTIR (varsayılan genişlik > 0)", () => {
    expect(V5_TROLLEY_INPUTS.wheelWidthMm ?? 0).toBeGreaterThan(0);
    expect(V5_BRIDGE_INPUTS.wheelWidthMm ?? 0).toBeGreaterThan(0);
    expect(runTrolley({}).shaftLoadBandCm).toBeGreaterThan(0);
    expect(runBridge({}).shaftLoadBandCm).toBeGreaterThan(0);
  });
});
