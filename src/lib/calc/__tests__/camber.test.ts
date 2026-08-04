// Sehim ve ters sehim (kamber) — MÜHENDİSLİK doğrulaması.
// Karşılaştırma ölçütü fiziktir: klasik kapalı çözümler, denge, simetri ve
// ölçek tutarlılığı. Bir tabloya ya da eski çıktıya karşı test edilmez.

import { describe, expect, it } from "vitest";
import {
  camberProfile,
  camberStationGrid,
  pointLoadDeflectionCm,
  udlDeflectionCm,
  type CamberBeam,
} from "../camber";
import { railMassKgPerM } from "../tables";

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

/**
 * BAĞIMSIZ DOĞRULAMA — kapalı çözümler, ikinci bir yöntemle sınanır.
 *
 * Eşlenik kiriş (conjugate beam) yöntemi: sehim, M(x)/EI yükleme diyagramının
 * iki kez integralidir. Burada M(x) doğrudan denge denklemlerinden kurulur ve
 * sehim SAYISAL olarak integre edilir; camber.ts'teki kapalı bağıntılarla
 * bağımsız biçimde karşılaştırılır. İki yöntem farklı bir yol izlediği için
 * bağıntılarda işaret/katsayı hatası olsaydı burada yakalanırdı.
 */
function numericDeflection(
  spanCm: number,
  eiKgCm2: number,
  moment: (x: number) => number,
  xTarget: number,
  steps = 20000
): number {
  const L = spanCm;
  const h = L / steps;
  // Eşlenik kirişte yayılı yük w*(x) = M(x)/EI.
  // Sol eşlenik mesnet reaksiyonu: R* = (1/L)·∫ w*(x)·(L−x) dx
  let reaction = 0;
  for (let i = 0; i < steps; i++) {
    const xa = i * h, xb = xa + h, xm = (xa + xb) / 2;
    const f = (x: number) => (moment(x) / eiKgCm2) * (L - x);
    reaction += (h / 6) * (f(xa) + 4 * f(xm) + f(xb)); // Simpson
  }
  reaction /= L;
  // Sehim = eşlenik kirişte xTarget noktasındaki moment:
  //   δ(x) = R*·x − ∫₀ˣ w*(t)·(x−t) dt
  let integral = 0;
  const n = Math.max(2, Math.round((xTarget / L) * steps));
  const hh = xTarget / n;
  for (let i = 0; i < n; i++) {
    const ta = i * hh, tb = ta + hh, tm = (ta + tb) / 2;
    const g = (t: number) => (moment(t) / eiKgCm2) * (xTarget - t);
    integral += (hh / 6) * (g(ta) + 4 * g(tm) + g(tb));
  }
  return reaction * xTarget - integral;
}

describe("bağımsız doğrulama — eşlenik kiriş (sayısal integrasyon)", () => {
  it("yayılı yük: kapalı çözüm ile sayısal integrasyon örtüşür", () => {
    const w = 2.3626; // kg/cm
    // Basit kiriş, düzgün yayılı yük: M(x) = w·x·(L−x)/2
    const M = (x: number) => (w * x * (L - x)) / 2;
    for (const frac of [0.1, 0.25, 0.5, 0.75, 0.9]) {
      const x = L * frac;
      const closed = udlDeflectionCm(w, L, x, EI);
      const numeric = numericDeflection(L, EI, M, x);
      expect(numeric).toBeCloseTo(closed, 6);
    }
  });

  it("iki simetrik tekil yük: kapalı çözüm ile sayısal integrasyon örtüşür", () => {
    const P = 1625;
    const s = 300;
    const a1 = L / 2 - s / 2;
    const a2 = L / 2 + s / 2;
    // Simetrik yükleme → her mesnette R = P
    const M = (x: number) =>
      P * x - (x > a1 ? P * (x - a1) : 0) - (x > a2 ? P * (x - a2) : 0);
    for (const frac of [0.15, 0.35, 0.5, 0.65, 0.85]) {
      const x = L * frac;
      const closed =
        pointLoadDeflectionCm(P, a1, L, x, EI) + pointLoadDeflectionCm(P, a2, L, x, EI);
      const numeric = numericDeflection(L, EI, M, x);
      expect(numeric).toBeCloseTo(closed, 5);
    }
  });

  it("kamber profili boyunca canlı+ölü sehim sayısal çözümle örtüşür", () => {
    const profile = camberProfile(beam, 1500);
    const s = beam.wheelSpacingCm;
    const a1 = L / 2 - s / 2;
    const a2 = L / 2 + s / 2;
    const P = beam.wheelLoadKg;
    const w = beam.deadLoadPerCm;
    const M = (x: number) =>
      (w * x * (L - x)) / 2 +
      P * x - (x > a1 ? P * (x - a1) : 0) - (x > a2 ? P * (x - a2) : 0);
    for (const st of profile.stations) {
      if (st.xMm === 0 || st.xMm === L * 10) continue;
      const numericMm = numericDeflection(L, EI, M, st.xMm / 10) * 10;
      expect(st.liveMm + st.deadMm).toBeCloseTo(numericMm, 4);
    }
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

  it("perde kodları tekildir ve M1 · P… · O · M2 düzenindedir", () => {
    const codes = profile.stations.map((s) => s.code);
    expect(new Set(codes).size).toBe(codes.length); // hiçbir kod tekrar etmez
    expect(codes[0]).toBe("M1");
    expect(codes[codes.length - 1]).toBe("M2");
    expect(profile.mid.code).toBe("O");
    expect(codes.filter((c) => c.startsWith("P")).length).toBe(codes.length - 3);
    // Perde numaraları soldan sağa 1'den başlayarak kesintisiz artar
    const pNums = codes.filter((c) => /^P\d+$/.test(c)).map((c) => Number(c.slice(1)));
    expect(pNums).toEqual(pNums.map((_, i) => i + 1));
  });

  it("perde eksenleri ortadan başlayıp perde aralığınca ilerler", () => {
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

describe("ray metre ağırlığı — ana kirişin ölü yüküne girer", () => {
  const RHO = 0.008; // kg/cm³ (STEEL_DENSITY_KG_CM3)

  it("A serisi DIN 536-1 anma kütlesini verir", () => {
    expect(railMassKgPerM("A45", RHO)).toBe(22.1);
    expect(railMassKgPerM("A65", RHO)).toBe(43.1);
    expect(railMassKgPerM("A100", RHO)).toBe(74.3);
    expect(railMassKgPerM("A150", RHO)).toBe(150.2);
  });

  it("A serisi ray büyüdükçe ağırlık tekdüze artar", () => {
    const order = ["A45", "A55", "A65", "A75", "A100", "A120", "A150"];
    const masses = order.map((c) => railMassKgPerM(c, RHO)!);
    for (let i = 1; i < masses.length; i++) {
      expect(masses[i]).toBeGreaterThan(masses[i - 1]);
    }
  });

  it("kare/dikdörtgen çubuk rayda kütle kesit alanından gelir", () => {
    // 50×50 mm = 25 cm² → 25 · 100 · 0,008 = 20 kg/m
    expect(railMassKgPerM("50x50", RHO)).toBeCloseTo(20, 10);
    expect(railMassKgPerM("30x30", RHO)).toBeCloseTo(7.2, 10);
    expect(railMassKgPerM("70x40", RHO)).toBeCloseTo(22.4, 10);
    // Ölçek: kenar iki katına çıkınca alan (ve kütle) dört katına çıkar
    expect(railMassKgPerM("80x80", RHO)! / railMassKgPerM("40x40", RHO)!).toBeCloseTo(4, 10);
  });

  it("tanınmayan ya da boş kod null döner (ray payı sıfır sayılır)", () => {
    expect(railMassKgPerM("", RHO)).toBeNull();
    expect(railMassKgPerM(undefined, RHO)).toBeNull();
    expect(railMassKgPerM("BILINMEYEN", RHO)).toBeNull();
  });
});

describe("perde eksenleri — kamber kotları ile perde adedi tek kaynaktan", () => {
  it("mesnetler dâhil, ortadan simetrik yerleşir", () => {
    const g = camberStationGrid(20000, 1500);
    expect(g.xs[0]).toBe(0);
    expect(g.xs[g.xs.length - 1]).toBe(20000);
    expect(g.xs).toContain(10000);
    // Simetri: i'ninci ile sondan i'ninci mesnete eşit uzaklıkta
    for (let i = 0; i < g.xs.length; i++) {
      expect(g.xs[i]).toBeCloseTo(20000 - g.xs[g.xs.length - 1 - i], 6);
    }
  });

  it("perde adedi açıklık/aralık ile büyür", () => {
    const az = camberStationGrid(20000, 3000).xs.length;
    const cok = camberStationGrid(20000, 1000).xs.length;
    expect(cok).toBeGreaterThan(az);
  });

  it("kamber profili ile perde ızgarası aynı eksenleri verir", () => {
    const g = camberStationGrid(17500, 2000);
    const p = camberProfile(
      {
        spanCm: 1750, deadLoadPerCm: 2, wheelLoadKg: 1000, wheelSpacingCm: 300,
        elasticModulus: 2_100_000, inertiaCm4: 363_742,
      },
      2000
    );
    expect(p.stations.map((s) => s.xMm)).toEqual(g.xs);
    expect(p.stations.map((s) => s.code)).toEqual(g.codes);
  });
});
