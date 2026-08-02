// Otomatik girdi türetmeleri — mühendislik doğrulaması.
//
// Bu türetmeler bir "kolaylık" değil hesabın parçasıdır: türetilen değer girdiye
// YAZILIR ve motor, PDF raporu ile ekipman listesi aynı sayıyı görür. Bu yüzden
// her kural burada kilitlenir.

import { describe, expect, it } from "vitest";
import {
  HOOK_BLOCK_WEIGHT_RATIO,
  MOTOR_TEMP_FACTORS,
  STANDARD_SHEAVE_EFFICIENCY,
  deriveHookBlockWeightKg,
  deriveHoistInputs,
  deriveRopeWeightKg,
  motorTempFactor,
} from "../derive";
import { NEW_WORK_TEMPLATE } from "../defaults";
import type { HoistInputs, HoistSelections } from "../modules/hoistGroup";

const INPUTS = NEW_WORK_TEMPLATE.mainHoist!.inputs;
const SELECTIONS = NEW_WORK_TEMPLATE.mainHoist!.selections;
const CTX = { liftHeightM: 10, capacityT: 10, ambientTempMaxC: 40 };

const withInputs = (patch: Partial<HoistInputs>): HoistInputs => ({ ...INPUTS, ...patch });
const withSelections = (patch: Partial<HoistSelections>): HoistSelections => ({
  ...SELECTIONS,
  ...patch,
});

describe("motor sıcaklık faktörü", () => {
  it("Sinan'ın verdiği basamakları birebir uygular", () => {
    const beklenen: [number, number][] = [
      [40, 1], [45, 1.05], [50, 1.1], [55, 1.1],
      [60, 1.15], [65, 1.15], [70, 1.2], [75, 1.25], [80, 1.3],
    ];
    for (const [t, f] of beklenen) expect(motorTempFactor(t)).toBe(f);
  });

  it("ara değerleri BİR ÜST basamağa yuvarlar (emniyetli taraf)", () => {
    // 47 °C, 45 ile 50 arasındadır; düşük katsayı seçilirse motor küçük çıkar.
    expect(motorTempFactor(47)).toBe(1.1);
    expect(motorTempFactor(41)).toBe(1.05);
    expect(motorTempFactor(66)).toBe(1.2);
  });

  it("tablo dışında sınır değerlerde kalır", () => {
    expect(motorTempFactor(-40)).toBe(1);
    expect(motorTempFactor(0)).toBe(1);
    expect(motorTempFactor(120)).toBe(1.3);
    expect(motorTempFactor(Number.NaN)).toBe(1);
  });

  it("tablo monoton artar (sıcaklık arttıkça katsayı düşmez)", () => {
    for (let i = 1; i < MOTOR_TEMP_FACTORS.length; i += 1) {
      expect(MOTOR_TEMP_FACTORS[i].factor).toBeGreaterThanOrEqual(
        MOTOR_TEMP_FACTORS[i - 1].factor
      );
      expect(MOTOR_TEMP_FACTORS[i].maxC).toBeGreaterThan(MOTOR_TEMP_FACTORS[i - 1].maxC);
    }
  });
});

describe("kanca bloğu ağırlığı", () => {
  it("kapasitenin %10'udur ve 10 kg'a yuvarlanır", () => {
    expect(deriveHookBlockWeightKg(10)).toBe(10 * 1000 * HOOK_BLOCK_WEIGHT_RATIO);
    expect(deriveHookBlockWeightKg(5)).toBe(500);
    expect(deriveHookBlockWeightKg(3.2)).toBe(320);
    expect(deriveHookBlockWeightKg(0.32)).toBe(30); // 32 -> 30 kg
  });

  it("geçersiz kapasitede değer üretmez", () => {
    expect(deriveHookBlockWeightKg(0)).toBeUndefined();
    expect(deriveHookBlockWeightKg(-4)).toBeUndefined();
    expect(deriveHookBlockWeightKg(Number.NaN)).toBeUndefined();
  });
});

describe("halat ağırlığı", () => {
  it("kol sayısı × metre ağırlığı × yükseklik, 50 kg'a YUKARI yuvarlanır", () => {
    // 4 × 1,33 × 10 = 53,2 kg -> 100 kg (yukarı yuvarlama emniyetli tarafta)
    expect(deriveRopeWeightKg(4, 1.33, 10)).toBe(100);
    expect(deriveRopeWeightKg(2, 1.33, 10)).toBe(50);
  });
});

describe("deriveHoistInputs", () => {
  it("hazır donanım seçiliyse tahrikli/toplam kol sayılarını doldurur", () => {
    const d = deriveHoistInputs(
      withInputs({ reevingLabel: "4/8", drivenFalls: 2, totalFalls: 4 }),
      SELECTIONS,
      CTX
    );
    expect(d.drivenFalls).toBe(4);
    expect(d.totalFalls).toBe(8);
  });

  it("değer zaten donanımla uyumluysa gereksiz güncelleme üretmez", () => {
    const d = deriveHoistInputs(
      withInputs({ reevingLabel: "2/4", drivenFalls: 2, totalFalls: 4 }),
      SELECTIONS,
      CTX
    );
    expect(d.drivenFalls).toBeUndefined();
    expect(d.totalFalls).toBeUndefined();
  });

  it("elle girişte kol sayılarına dokunmaz", () => {
    const d = deriveHoistInputs(
      withInputs({ reevingLabel: "Elle giriş", drivenFalls: 3, totalFalls: 7 }),
      SELECTIONS,
      CTX
    );
    expect(d.drivenFalls).toBeUndefined();
    expect(d.totalFalls).toBeUndefined();
  });

  it("otomatik anahtarlar kapalıyken hiçbir değer türetmez", () => {
    const d = deriveHoistInputs(
      withInputs({
        reevingLabel: "Elle giriş",
        ropeWeightAuto: false,
        hookBlockWeightAuto: false,
        tempFactorAuto: false,
      }),
      SELECTIONS,
      CTX
    );
    expect(d.ropeWeightKg).toBeUndefined();
    expect(d.hookBlockWeightKg).toBeUndefined();
    expect(d.tempFactor).toBeUndefined();
    expect(d.warnings).toEqual([]);
  });

  it("kanca bloğu ağırlığını grubun KENDİ kapasitesinden türetir", () => {
    const ana = deriveHoistInputs(INPUTS, SELECTIONS, { ...CTX, capacityT: 10 });
    const monoray = deriveHoistInputs(INPUTS, SELECTIONS, { ...CTX, capacityT: 2 });
    expect(ana.hookBlockWeightKg).toBe(1000);
    expect(monoray.hookBlockWeightKg).toBe(200);
  });

  it("sıcaklık faktörünü ortam sıcaklığı üst sınırından alır", () => {
    expect(deriveHoistInputs(INPUTS, SELECTIONS, { ...CTX, ambientTempMaxC: 60 }).tempFactor)
      .toBe(1.15);
  });

  it("halat metre ağırlığı yoksa değer değil UYARI üretir", () => {
    const d = deriveHoistInputs(
      INPUTS,
      withSelections({ ropeWeightKgPerM: undefined }),
      CTX
    );
    expect(d.ropeWeightKg).toBeUndefined();
    expect(d.warnings.map((w) => w.field)).toContain("ropeWeightKg");
  });

  it("halat ağırlığı donanımın TOPLAM kol sayısını kullanır (girdiden değil)", () => {
    // Girdide 2 kol yazsa da seçili donanım 4/8 ise 8 kol üzerinden hesaplanır.
    const d = deriveHoistInputs(
      withInputs({ reevingLabel: "4/8", drivenFalls: 2, totalFalls: 2, ropeWeightAuto: true }),
      withSelections({ ropeWeightKgPerM: 1 }),
      { ...CTX, liftHeightM: 10 }
    );
    expect(d.ropeWeightKg).toBe(100); // 8 × 1 × 10 = 80 -> 100
  });
});

describe("makara verimi", () => {
  it("firma standardı sabittir ve yeni iş şablonunda kullanılır", () => {
    expect(STANDARD_SHEAVE_EFFICIENCY).toBe(0.985);
    expect(INPUTS.sheaveEfficiency).toBe(STANDARD_SHEAVE_EFFICIENCY);
  });
});
