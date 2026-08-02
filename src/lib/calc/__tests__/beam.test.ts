// Kiriş çözücüsü testleri — doğrulama referansı FİZİKTİR: denge denklemleri,
// simetri ve mukavemet literatüründeki kapalı çözümler.

import { describe, expect, it } from "vitest";
import {
  beamReactions,
  momentAtX,
  shearAtX,
  solveBeam,
  type BeamModel,
} from "../beam";

/** Modeldeki toplam düşey yük ΣP [kg] */
function totalLoadKg(model: BeamModel): number {
  let total = 0;
  for (const load of model.pointLoads) total += load.loadKg;
  for (const load of model.distributedLoads ?? []) {
    total += load.intensityKgPerCm * (load.toCm - load.fromCm);
  }
  return total;
}

/** Tüm sayısal alanların sonlu olduğunu doğrular */
function expectAllFinite(model: BeamModel): void {
  const result = solveBeam(model);
  expect(Number.isFinite(result.reactionAKg)).toBe(true);
  expect(Number.isFinite(result.reactionBKg)).toBe(true);
  expect(Number.isFinite(result.maxMomentKgCm)).toBe(true);
  expect(Number.isFinite(result.maxMomentXCm)).toBe(true);
  expect(Number.isFinite(result.maxShearKg)).toBe(true);
  for (const station of result.stations) {
    expect(Number.isFinite(station.xCm)).toBe(true);
    expect(Number.isFinite(station.shearKg)).toBe(true);
    expect(Number.isFinite(station.momentKgCm)).toBe(true);
  }
}

/** Basit mesnetli kiriş, ortada tek yük */
const CENTER_LOAD: BeamModel = {
  lengthCm: 400,
  supportACm: 0,
  supportBCm: 400,
  pointLoads: [{ xCm: 200, loadKg: 2000, label: "kanca yükü" }],
};

/** Basit mesnetli kiriş, mesnetlerden a kadar içeride iki eşit yük */
const TWO_EQUAL_LOADS: BeamModel = {
  lengthCm: 300,
  supportACm: 0,
  supportBCm: 300,
  pointLoads: [
    { xCm: 100, loadKg: 1000, label: "teker 1" },
    { xCm: 200, loadKg: 1000, label: "teker 2" },
  ],
};

/** Basit mesnetli kiriş, tam açıklık boyunca düzgün yayılı yük */
const UNIFORM_LOAD: BeamModel = {
  lengthCm: 400,
  supportACm: 0,
  supportBCm: 400,
  pointLoads: [],
  distributedLoads: [
    { fromCm: 0, toCm: 400, intensityKgPerCm: 5, label: "öz ağırlık" },
  ],
};

/** Konsol destekli kiriş: yük B mesnedinin dışında */
const CANTILEVER: BeamModel = {
  lengthCm: 300,
  supportACm: 0,
  supportBCm: 200,
  pointLoads: [{ xCm: 300, loadKg: 500, label: "konsol ucu" }],
};

/** İçe kaydırılmış mesnetler + karışık yükleme */
const MIXED: BeamModel = {
  lengthCm: 500,
  supportACm: 50,
  supportBCm: 450,
  pointLoads: [
    { xCm: 0, loadKg: 300 },
    { xCm: 250, loadKg: 1200 },
    { xCm: 500, loadKg: 300 },
  ],
  distributedLoads: [{ fromCm: 100, toCm: 400, intensityKgPerCm: 2 }],
};

const ALL_MODELS: Array<[string, BeamModel]> = [
  ["ortada tek yük", CENTER_LOAD],
  ["iki eşit yük", TWO_EQUAL_LOADS],
  ["düzgün yayılı yük", UNIFORM_LOAD],
  ["konsol yükü", CANTILEVER],
  ["karışık yükleme", MIXED],
];

describe("solveBeam — denge", () => {
  it.each(ALL_MODELS)("%s: Ra + Rb = ΣP", (_ad, model) => {
    const result = solveBeam(model);
    expect(result.reactionAKg + result.reactionBKg).toBeCloseTo(
      totalLoadKg(model),
      9
    );
  });

  it.each(ALL_MODELS)("%s: kiriş uçlarında moment sıfırdır", (_ad, model) => {
    // Serbest uçlarda (yük ve mesnet yoksa) moment sıfır olmalıdır
    expect(momentAtX(model, model.lengthCm)).toBeCloseTo(0, 6);
  });

  it("moment dengesi: B mesnedi için moment toplamı sıfırdır", () => {
    const { reactionAKg } = beamReactions(MIXED);
    let sum = reactionAKg * (MIXED.supportBCm - MIXED.supportACm);
    for (const load of MIXED.pointLoads) {
      sum -= load.loadKg * (MIXED.supportBCm - load.xCm);
    }
    for (const load of MIXED.distributedLoads ?? []) {
      const length = load.toCm - load.fromCm;
      const centroid = (load.fromCm + load.toCm) / 2;
      sum -= load.intensityKgPerCm * length * (MIXED.supportBCm - centroid);
    }
    expect(sum).toBeCloseTo(0, 6);
  });
});

describe("solveBeam — simetri", () => {
  it("simetrik tekil yükte Ra = Rb ve maksimum moment orta noktadadır", () => {
    const result = solveBeam(CENTER_LOAD);
    expect(result.reactionAKg).toBeCloseTo(result.reactionBKg, 9);
    expect(result.reactionAKg).toBeCloseTo(1000, 9);
    expect(result.maxMomentXCm).toBeCloseTo(200, 9);
  });

  it("simetrik yayılı yükte Ra = Rb ve maksimum moment orta noktadadır", () => {
    const result = solveBeam(UNIFORM_LOAD);
    expect(result.reactionAKg).toBeCloseTo(result.reactionBKg, 9);
    expect(result.maxMomentXCm).toBeCloseTo(200, 9);
  });

  it("simetrik yüklemede moment dağılımı da simetriktir", () => {
    for (const offset of [10, 55, 120, 199]) {
      expect(momentAtX(UNIFORM_LOAD, offset)).toBeCloseTo(
        momentAtX(UNIFORM_LOAD, 400 - offset),
        6
      );
    }
  });
});

describe("solveBeam — bilinen kapalı çözümler", () => {
  it("ortada tek yük: Mmaks = P·L/4", () => {
    const P = 2000;
    const L = 400;
    const result = solveBeam(CENTER_LOAD);
    expect(result.maxMomentKgCm).toBeCloseTo((P * L) / 4, 6);
    expect(Math.abs(result.maxShearKg)).toBeCloseTo(P / 2, 6);
  });

  it("mesnetlerden a kadar içeride iki eşit yük: Mmaks = P·a", () => {
    const P = 1000;
    const a = 100;
    const result = solveBeam(TWO_EQUAL_LOADS);
    expect(result.reactionAKg).toBeCloseTo(P, 9);
    expect(result.maxMomentKgCm).toBeCloseTo(P * a, 6);
    // Yükler arasında moment sabittir (saf eğilme bölgesi)
    expect(momentAtX(TWO_EQUAL_LOADS, 150)).toBeCloseTo(P * a, 6);
  });

  it("düzgün yayılı yük: Mmaks = w·L²/8 ve Ra = w·L/2", () => {
    const w = 5;
    const L = 400;
    const result = solveBeam(UNIFORM_LOAD);
    expect(result.reactionAKg).toBeCloseTo((w * L) / 2, 9);
    expect(result.maxMomentKgCm).toBeCloseTo((w * L * L) / 8, 6);
    expect(Math.abs(result.maxShearKg)).toBeCloseTo((w * L) / 2, 6);
  });

  it("yayılı yükün parabolik moment eğrisi doğrulanır", () => {
    // M(x) = w·x·(L − x)/2
    const w = 5;
    const L = 400;
    for (const x of [50, 100, 175, 320]) {
      expect(momentAtX(UNIFORM_LOAD, x)).toBeCloseTo((w * x * (L - x)) / 2, 6);
    }
  });
});

describe("solveBeam — konsol davranışı", () => {
  it("mesnet dışındaki yük açıklık içinde negatif moment üretir", () => {
    const result = solveBeam(CANTILEVER);
    // Ra aşağı doğru (negatif) tepki verir, Rb yükten büyüktür
    expect(result.reactionAKg).toBeCloseTo(-250, 9);
    expect(result.reactionBKg).toBeCloseTo(750, 9);
    expect(momentAtX(CANTILEVER, 100)).toBeCloseTo(-25000, 6);
    expect(result.maxMomentKgCm).toBeCloseTo(-50000, 6);
    expect(result.maxMomentXCm).toBeCloseTo(200, 9);
    // Konsolun serbest ucunda moment sıfıra döner
    expect(momentAtX(CANTILEVER, 300)).toBeCloseTo(0, 6);
  });

  it("konsol momenti mesnet B'de −P·konsol boyu değerine eşittir", () => {
    expect(momentAtX(CANTILEVER, CANTILEVER.supportBCm)).toBeCloseTo(
      -500 * 100,
      6
    );
  });
});

describe("solveBeam — düğüm listesi", () => {
  it("düğümler konuma göre sıralıdır", () => {
    for (const [, model] of ALL_MODELS) {
      const { stations } = solveBeam(model);
      for (let i = 1; i < stations.length; i += 1) {
        expect(stations[i].xCm).toBeGreaterThanOrEqual(stations[i - 1].xCm);
      }
    }
  });

  it("kesme süreksizliklerinde çift düğüm üretilir", () => {
    const { stations } = solveBeam(CENTER_LOAD);
    const atMid = stations.filter((s) => Math.abs(s.xCm - 200) < 1e-9);
    expect(atMid).toHaveLength(2);
    expect(atMid[0].side).toBe("left");
    expect(atMid[1].side).toBe("right");
    expect(atMid[0].shearKg).toBeCloseTo(1000, 9);
    expect(atMid[1].shearKg).toBeCloseTo(-1000, 9);
    // Moment süreklidir: iki yüzde de aynı
    expect(atMid[0].momentKgCm).toBeCloseTo(atMid[1].momentKgCm, 9);
  });

  it("yayılı yükte kesmenin sıfırlandığı ara düğüm eklenir", () => {
    const { stations } = solveBeam(UNIFORM_LOAD);
    const zeroShear = stations.find(
      (s) => s.side === undefined && Math.abs(s.shearKg) < 1e-9 && s.xCm > 0
    );
    expect(zeroShear).toBeDefined();
    expect(zeroShear?.xCm).toBeCloseTo(200, 9);
  });

  it("her mesnet ve tekil yük konumu düğüm listesinde bulunur", () => {
    const { stations } = solveBeam(MIXED);
    for (const x of [0, 50, 100, 250, 400, 450, 500]) {
      expect(stations.some((s) => Math.abs(s.xCm - x) < 1e-9)).toBe(true);
    }
  });
});

describe("shearAtX / momentAtX yardımcıları", () => {
  it("varsayılan taraf sağ yüzdür", () => {
    expect(shearAtX(CENTER_LOAD, 200)).toBeCloseTo(-1000, 9);
    expect(shearAtX(CENTER_LOAD, 200, "left")).toBeCloseTo(1000, 9);
  });

  it("mesnetin hemen solunda kesme sıfırdır", () => {
    expect(shearAtX(CENTER_LOAD, 0, "left")).toBeCloseTo(0, 9);
    expect(shearAtX(CENTER_LOAD, 0, "right")).toBeCloseTo(1000, 9);
  });

  it("momentAt yöntemi momentAtX ile aynı sonucu verir", () => {
    const result = solveBeam(MIXED);
    for (const x of [0, 37.5, 250, 421, 500]) {
      expect(result.momentAt(x)).toBeCloseTo(momentAtX(MIXED, x), 9);
    }
  });
});

describe("solveBeam — sınır durumları", () => {
  it("sıfır uzunluklu kiriş NaN/Infinity üretmez", () => {
    expectAllFinite({
      lengthCm: 0,
      supportACm: 0,
      supportBCm: 0,
      pointLoads: [],
    });
  });

  it("yüksüz kiriş sıfır tepki ve sıfır moment verir", () => {
    const result = solveBeam({
      lengthCm: 250,
      supportACm: 0,
      supportBCm: 250,
      pointLoads: [],
    });
    expect(result.reactionAKg).toBeCloseTo(0, 9);
    expect(result.reactionBKg).toBeCloseTo(0, 9);
    expect(result.maxMomentKgCm).toBeCloseTo(0, 9);
    expect(result.maxShearKg).toBeCloseTo(0, 9);
    expectAllFinite({
      lengthCm: 250,
      supportACm: 0,
      supportBCm: 250,
      pointLoads: [],
    });
  });

  it("mesnetler çakışıksa tüm yük A'ya aktarılır, denge korunur", () => {
    const model: BeamModel = {
      lengthCm: 100,
      supportACm: 50,
      supportBCm: 50,
      pointLoads: [{ xCm: 100, loadKg: 800 }],
    };
    const result = solveBeam(model);
    expect(result.reactionAKg).toBeCloseTo(800, 9);
    expect(result.reactionBKg).toBeCloseTo(0, 9);
    expect(result.reactionAKg + result.reactionBKg).toBeCloseTo(800, 9);
    expectAllFinite(model);
  });

  it("tek yük ve tek düğüm durumunda sonuçlar sonludur", () => {
    expectAllFinite({
      lengthCm: 120,
      supportACm: 0,
      supportBCm: 120,
      pointLoads: [{ xCm: 60, loadKg: 1 }],
    });
  });

  it("NaN/Infinity girdiler sıfıra indirgenir", () => {
    const model: BeamModel = {
      lengthCm: Number.NaN,
      supportACm: 0,
      supportBCm: Number.POSITIVE_INFINITY,
      pointLoads: [
        { xCm: Number.NaN, loadKg: Number.NaN },
        { xCm: 40, loadKg: 600 },
      ],
      distributedLoads: [
        { fromCm: 0, toCm: Number.NaN, intensityKgPerCm: 3 },
      ],
    };
    expectAllFinite(model);
    const result = solveBeam(model);
    // supportB de 0'a indiği için mesnetler çakışır; tüm yük A'da toplanır
    expect(result.reactionAKg).toBeCloseTo(600, 9);
  });

  it("sıfır şiddetli yayılı yük sonucu değiştirmez", () => {
    const withZero: BeamModel = {
      ...CENTER_LOAD,
      distributedLoads: [{ fromCm: 0, toCm: 400, intensityKgPerCm: 0 }],
    };
    expect(solveBeam(withZero).maxMomentKgCm).toBeCloseTo(
      solveBeam(CENTER_LOAD).maxMomentKgCm,
      9
    );
  });

  it("ters verilen yayılı yük sınırları otomatik düzeltilir", () => {
    const reversed: BeamModel = {
      lengthCm: 400,
      supportACm: 0,
      supportBCm: 400,
      pointLoads: [],
      distributedLoads: [{ fromCm: 400, toCm: 0, intensityKgPerCm: 5 }],
    };
    expect(solveBeam(reversed).maxMomentKgCm).toBeCloseTo(
      solveBeam(UNIFORM_LOAD).maxMomentKgCm,
      6
    );
  });
});
