// Sehim ve ters sehim (kamber) — MÜHENDİSLİK doğrulaması.
// Karşılaştırma ölçütü fiziktir: klasik kapalı çözümler, denge, simetri ve
// ölçek tutarlılığı. Bir tabloya ya da eski çıktıya karşı test edilmez.

import { describe, expect, it } from "vitest";
import {
  camberProfile,
  pointLoadDeflectionCm,
  udlDeflectionCm,
  type CamberBeam,
} from "../camber";

// Referans kiriş: L = 1750 cm, I = 363.742 cm⁴, E = 2,1e6 kg/cm²
const E = 2_100_000;
const I = 363_742;
const EI = E * I;
const L = 1750;

const beam: CamberBeam = {
  spanCm: L,
  deadLoadPerCm: 2.0353,      // 203,53 kg/m
  wheelLoadKg: 1625,
  wheelSpacingCm: 300,
  elasticModulus: E,
  inertiaCm4: I,
};

describe("sehim — klasik kapalı çözümler", () => {
  it("yayılı yükte açıklık ortası 5wL⁴/(384EI) değerini verir", () => {
    const w = 2.0353;
    const closed = (5 * w * L ** 4) / (384 * EI);
    expect(udlDeflectionCm(w, L, L / 2, EI)).toBeCloseTo(closed, 10);
  });

  it("ortadaki tekil yükte PL³/(48EI) değerini verir", () => {
    const P = 1625;
    const closed = (P * L ** 3) / (48 * EI);
    expect(pointLoadDeflectionCm(P, L / 2, L, L / 2, EI)).toBeCloseTo(closed, 10);
  });

  it("iki simetrik tekil yükün toplamı P·b·(3L²−4b²)/(24EI) ile aynıdır", () => {
    const P = 1625;
    const s = 300;                       // dingil açıklığı
    const b = (L - s) / 2;               // mesnetten yakın tekere
    const closed = (P * b * (3 * L ** 2 - 4 * b ** 2)) / (24 * EI);
    const sum =
      pointLoadDeflectionCm(P, L / 2 - s / 2, L, L / 2, EI) +
      pointLoadDeflectionCm(P, L / 2 + s / 2, L, L / 2, EI);
    expect(sum).toBeCloseTo(closed, 10);
  });

  it("mesnetlerde sehim sıfırdır", () => {
    expect(udlDeflectionCm(2, L, 0, EI)).toBeCloseTo(0, 12);
    expect(udlDeflectionCm(2, L, L, EI)).toBeCloseTo(0, 12);
    expect(pointLoadDeflectionCm(1625, 700, L, 0, EI)).toBeCloseTo(0, 12);
    expect(pointLoadDeflectionCm(1625, 700, L, L, EI)).toBeCloseTo(0, 12);
  });

  it("tekil yük çözümü yükün konumuna göre simetriktir", () => {
    const P = 1000;
    const a = 500;
    // Yük solda x=500'de iken x=1200'deki sehim, yük sağda simetrikteyken
    // aynadaki noktadaki sehime eşit olmalıdır.
    const left = pointLoadDeflectionCm(P, a, L, 1200, EI);
    const right = pointLoadDeflectionCm(P, L - a, L, L - 1200, EI);
    expect(left).toBeCloseTo(right, 12);
  });

  it("sehim yüke doğrusal, ataletle ters orantılıdır", () => {
    const base = udlDeflectionCm(2, L, L / 2, EI);
    expect(udlDeflectionCm(4, L, L / 2, EI)).toBeCloseTo(2 * base, 10);
    expect(udlDeflectionCm(2, L, L / 2, 2 * EI)).toBeCloseTo(base / 2, 10);
  });

  it("geçersiz kesit/açıklıkta sıfır döner (bölme hatası üretmez)", () => {
    expect(udlDeflectionCm(2, L, L / 2, 0)).toBe(0);
    expect(pointLoadDeflectionCm(1000, 100, 0, 0, EI)).toBe(0);
  });
});

describe("kamber profili — CMAA 70 3.5.5.2", () => {
  const profile = camberProfile(beam, 1500);

  it("uçlarda (teker ekseni) tüm kotlar sıfırdır", () => {
    const first = profile.stations[0];
    const last = profile.stations[profile.stations.length - 1];
    for (const st of [first, last]) {
      expect(st.liveMm).toBeCloseTo(0, 9);
      expect(st.deadMm).toBeCloseTo(0, 9);
      expect(st.cuttingMm).toBeCloseTo(0, 9);
      expect(st.supportedMm).toBeCloseTo(0, 9);
    }
    expect(first.xMm).toBe(0);
    expect(last.xMm).toBeCloseTo(L * 10, 6);
  });

  it("kesimde = ölü + canlı/2, mesnette = canlı/2 (her istasyonda)", () => {
    for (const st of profile.stations) {
      expect(st.cuttingMm).toBeCloseTo(st.deadMm + st.liveMm / 2, 10);
      expect(st.supportedMm).toBeCloseTo(st.liveMm / 2, 10);
      // Mesnette verisi tanımı gereği kesimde − ölü yük sehimidir
      expect(st.cuttingMm - st.deadMm).toBeCloseTo(st.supportedMm, 10);
    }
  });

  it("profil açıklık ortasına göre simetriktir", () => {
    const n = profile.stations.length;
    for (let i = 0; i < n; i++) {
      const a = profile.stations[i];
      const b = profile.stations[n - 1 - i];
      expect(a.cuttingMm).toBeCloseTo(b.cuttingMm, 8);
      expect(a.supportedMm).toBeCloseTo(b.supportedMm, 8);
      expect(a.fromCenterMm).toBeCloseTo(-b.fromCenterMm, 6);
    }
  });

  it("en büyük kot açıklık ortasındadır", () => {
    const maxCutting = Math.max(...profile.stations.map((s) => s.cuttingMm));
    expect(profile.mid.cuttingMm).toBeCloseTo(maxCutting, 10);
    expect(profile.mid.fromCenterMm).toBe(0);
  });

  it("kotlar ortadan mesnete doğru tekdüze azalır", () => {
    const half = profile.stations.filter((s) => s.fromCenterMm <= 0);
    for (let i = 1; i < half.length; i++) {
      expect(half[i].cuttingMm).toBeGreaterThanOrEqual(half[i - 1].cuttingMm - 1e-9);
    }
  });

  it("istasyonlar ortadan başlayıp perde aralığınca ilerler", () => {
    const inner = profile.stations.slice(1, -1);
    for (const st of inner) {
      const k = Math.abs(st.fromCenterMm) / profile.spacingUsedMm;
      expect(k).toBeCloseTo(Math.round(k), 6);
    }
    expect(profile.spacingUsedMm).toBe(1500);
    expect(profile.thinned).toBe(false);
  });

  it("perde aralığı çok küçükse şerit seyreltilir, sayı sınırlı kalır", () => {
    const dense = camberProfile(beam, 100);
    expect(dense.thinned).toBe(true);
    expect(dense.spacingUsedMm % 100).toBe(0);
    expect(dense.stations.length).toBeLessThanOrEqual(41);
  });

  it("ölü yük yoksa kesimde = mesnette = canlı/2 olur", () => {
    const noDead = camberProfile({ ...beam, deadLoadPerCm: 0 }, 1500);
    for (const st of noDead.stations) {
      expect(st.deadMm).toBeCloseTo(0, 10);
      expect(st.cuttingMm).toBeCloseTo(st.supportedMm, 10);
    }
  });

  it("canlı yük yoksa mesnette sıfır, kesimde yalnız ölü yük sehimidir", () => {
    const noLive = camberProfile({ ...beam, wheelLoadKg: 0 }, 1500);
    for (const st of noLive.stations) {
      expect(st.supportedMm).toBeCloseTo(0, 10);
      expect(st.cuttingMm).toBeCloseTo(st.deadMm, 10);
    }
  });

  it("açıklık ortası kotları kapalı çözümlerle birebir tutar", () => {
    const b = (L - beam.wheelSpacingCm) / 2;
    const liveCm = (beam.wheelLoadKg * b * (3 * L ** 2 - 4 * b ** 2)) / (24 * EI);
    const deadCm = (5 * beam.deadLoadPerCm * L ** 4) / (384 * EI);
    expect(profile.mid.liveMm).toBeCloseTo(liveCm * 10, 8);
    expect(profile.mid.deadMm).toBeCloseTo(deadCm * 10, 8);
    expect(profile.mid.cuttingMm).toBeCloseTo((deadCm + liveCm / 2) * 10, 8);
  });
});
