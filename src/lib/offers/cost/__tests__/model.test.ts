// AĞIRLIK VE BOYUTLANDIRMA MODELİNİN DOĞRULAMASI.
//
// ÖLÇÜT FİRMANIN KENDİ MALİYET ÇALIŞMASIDIR: "ÖRNEK ASTOR 32T × 30 m Portal
// Vinç Teklif Maliyet Çalışması V3". O çalışma kitabı bu modelin KAYNAĞIDIR
// (bir standart değil — gerekçe `params.ts`in başındadır) ve model onu
// BİREBİR üretmek zorundadır: bir sayı tutmuyorsa ya port hatalıdır ya da
// devralınan tablo yanlış okunmuştur; ikisi de sessiz kalmamalıdır.
//
// DEVRALINAN "32T ÖZEL PARAMETRELER" BLOĞU BİLEREK PORTLANMADI. O bloktaki
// bütün sayılar (tambur Ø 410, şasi 1700 kg, kanca bloğu 970 kg, tambur
// ağırlığı 1100 kg) genel tabloların 30–40 ve 30–50 satırları arasındaki
// DOĞRUSAL ARA DEĞERLERİDİR; elle hesaplanıp yapıştırılmışlar. Model
// enterpolasyonu kendi yaptığı için o blok gereksizleşir — ve 32 değil 33
// tonluk bir vinçte de doğru sayı çıkar. Aşağıdaki testler bunu ölçer:
// enterpolasyon bozulursa kanca bloğu bir anda %78 ağırlaşır.

import { describe, expect, it } from "vitest";
import { hesapla } from "../model";
import { COST_PARAM_DEFAULTS, interpolate, DRUM_TABLE, HOOK_BLOCK_TABLE, sectionProps } from "../params";
import type { CostInputs } from "../types";

/** ASTOR 32 T × 30 m TAM PORTAL — devralınan çalışmanın girdi satırı. */
const ASTOR: CostInputs = {
  capacityT: 32,
  auxCapacityT: null,
  spanM: 30,
  liftHeightM: 12,
  liftSpeedMpm: 4,
  trolleySpeedMpm: 20,
  bridgeSpeedMpm: 20,
  craneClass: "M6",
  ambientC: 40,
  girderCount: 2,
  legHeightM: 12,
  bridgeWheelCount: 8,
  bridgeDriveCount: 4,
  trolleyDriveCount: 2,
  gantry: true,
  cabin: false,
  movingCabin: false,
  electricRoom: false,
  heatShield: false,
  // ASTOR çalışmasının rayı A65'tir (teklif belgesindeki köprü rayı satırı).
  bridgeRailCode: "A65",
  trolleyRailCode: "A65",
};

const model = () => hesapla(ASTOR, { ...COST_PARAM_DEFAULTS });

describe("devralınan 32T özel parametreleri ARA DEĞERDİR", () => {
  it("tambur çapı 30–40 T arasında 410 mm'ye düşer", () => {
    expect(interpolate(DRUM_TABLE, 32, (r) => r.capT, (r) => r.diaMm)).toBe(410);
  });

  it("kanca bloğu 30–50 T arasında 970 kg'a düşer (ilk ≥ olsaydı 1600 olurdu)", () => {
    expect(interpolate(HOOK_BLOCK_TABLE, 32, (r) => r.capT, (r) => r.kg)).toBe(970);
  });

  it("15 m tambur ağırlığı 1100 kg'a düşer", () => {
    expect(interpolate(DRUM_TABLE, 32, (r) => r.capT, (r) => r.kg15)).toBe(1100);
  });
});

describe("kutu kesit özellikleri", () => {
  it("750x1900x750 t10 kesidi 530 cm² alan ve 2.511.216,67 cm⁴ atalet verir", () => {
    const s = sectionProps({ topMm: 750, webMm: 1900, botMm: 750, tMm: 10 }, 0.785);
    expect(s.name).toBe("750x1900x750 t10");
    expect(s.areaCm2).toBeCloseTo(530, 6);
    expect(s.inertiaCm4).toBeCloseTo(2511216.6667, 3);
    expect(s.kgPerM).toBeCloseTo(416.05, 6);
  });
});

describe("ASTOR 32T × 30 m portal — mekanizma", () => {
  const r = model();
  const v = (k: string) => r.values[k];

  it("4 halat seçilir ve halat yükü 8.400 kg olur", () => {
    expect(v("c.hoistRopeCount")).toBe(4);
    expect(v("c.hoistRopeLoadKg")).toBeCloseTo(8400, 6);
  });

  it("tambur momenti 16.892,82 Nm, final moment 21.960,67 Nm", () => {
    expect(v("c.hoistDrumMomentNm")).toBeCloseTo(16892.82, 2);
    expect(v("c.hoistFinalMomentNm")).toBeCloseTo(21960.666, 3);
  });

  it("hesap gücü 22,65 kW, seçilen motor 30 kW", () => {
    expect(v("c.hoistCalcPowerKw")).toBeCloseTo(22.6524, 3);
    expect(v("c.hoistMotorKw")).toBe(30);
  });

  it("kaldırma sürücüsü motorun 1,35 katından seçilir → 45 kW", () => {
    expect(v("c.hoistDriveKw")).toBe(45);
  });

  it("portal tekeri Ø400, araba tekeri Ø315", () => {
    expect(v("c.bridgeWheelLoadT")).toBeCloseTo(15.04, 4);
    expect(v("c.bridgeWheelEffDiaMm")).toBe(400);
    expect(v("c.trolleyWheelLoadT")).toBeCloseTo(10.4, 6);
    expect(v("c.trolleyWheelEffDiaMm")).toBe(315);
  });

  it("yürütme motorları 1,5 kW, kurulu güç 39 kW, besleme 70 A", () => {
    expect(v("c.bridgeCalcPowerKw")).toBeCloseTo(1.496025, 6);
    expect(v("c.bridgeMotorKw")).toBe(1.5);
    expect(v("c.trolleyCalcPowerKw")).toBeCloseTo(1.2753, 6);
    expect(v("c.trolleyMotorKw")).toBe(1.5);
    expect(v("c.installedKw")).toBe(39);
    expect(v("c.supplyCurrentA")).toBe(70);
  });

  it("sürücü adedi motor adedinin yarısıdır", () => {
    expect(v("c.bridgeDriveCount")).toBe(4);
    expect(v("c.bridgeDriveUnits")).toBe(2);
    expect(v("c.trolleyDriveUnits")).toBe(1);
  });
});

describe("ASTOR 32T × 30 m portal — kiriş ve sehim", () => {
  const r = model();
  const v = (k: string) => r.values[k];

  it("teker aralığı 300 cm, konsol 1350 cm, teker yükü 9.750 kg", () => {
    expect(v("c.wheelbaseCm")).toBe(300);
    expect(v("c.overhangCm")).toBe(1350);
    expect(v("c.girderWheelLoadKg")).toBe(9750);
  });

  it("gerekli atalet 1.887.408 cm⁴ → 750x1900x750 t10 kesidi", () => {
    expect(v("c.requiredInertiaCm4")).toBeCloseTo(1887408.48, 1);
    expect(r.sectionName).toBe("750x1900x750 t10");
  });

  it("sehim 2,05 cm ve oran L/1463 — M6'nın L/1100 şartını sağlar", () => {
    expect(v("c.deflectionCm")).toBeCloseTo(2.0498, 4);
    expect(v("c.deflectionRatio")).toBeCloseTo(1463.56, 2);
    expect(r.deflectionOk).toBe(true);
  });

  it("30 m açıklık kamber eşiğini aşar", () => {
    expect(r.camber).toBe(true);
  });
});

describe("ASTOR 32T × 30 m portal — ağırlıklar", () => {
  const r = model();
  const v = (k: string) => r.values[k];

  it("araba parçaları ve araba toplamı", () => {
    expect(v("w.trolleyTravelGroup")).toBe(667);
    expect(v("w.trolleyFrame")).toBe(2050);
    expect(v("w.drum")).toBe(1265);
    expect(v("w.hoistDriveGroup")).toBe(1087);
    expect(v("w.hookBlock")).toBe(1116);
    expect(v("w.balanceBeams")).toBe(440);
    expect(v("w.topSheave")).toBe(670);
    expect(v("w.trolleyPlatform")).toBe(246);
    expect(v("w.trolleyTotal")).toBe(7000);
  });

  it("köprü parçaları ve köprü toplamı", () => {
    expect(v("w.mainGirder")).toBe(27850);
    expect(v("w.platform")).toBe(3600);
    expect(v("w.festoon")).toBe(450);
    expect(v("w.bridgeElectric")).toBe(720);
    expect(v("w.topEndConnection")).toBe(2000);
    expect(v("w.bridgeTravelGroup")).toBe(1955);
    expect(v("w.bridgeTotal")).toBe(37000);
  });

  it("portal ayak modeli", () => {
    expect(v("c.cornerLoadT")).toBeCloseTo(19.7, 6);
    expect(v("c.legUnitKgPerM")).toBeCloseTo(160.38, 6);
    expect(v("w.gantryLegs")).toBe(7700);
    expect(v("w.bogies")).toBe(4190);
    expect(v("w.gantryBracing")).toBe(2840);
    expect(v("w.legLadders")).toBe(480);
    expect(v("w.gantrySteel")).toBe(15500);
  });

  it("çelik ağırlığı 51.000 kg, toplam vinç ağırlığı 59.500 kg", () => {
    expect(v("w.steel")).toBe(51000);
    expect(v("w.total")).toBe(59500);
  });

  it("fire yalnız işçilik miktarına biner", () => {
    expect(v("w.steelWithFire")).toBeCloseTo(51000 * 1.1, 6);
  });
});

describe("elle ezilen değer AŞAĞIYA AKAR", () => {
  it("ana kiriş ezilince köşe yükü, ayaklar ve toplam ağırlık birlikte değişir", () => {
    const temiz = model();
    const ezik = hesapla(ASTOR, { ...COST_PARAM_DEFAULTS }, { "w.mainGirder": 30000 });

    expect(ezik.values["w.mainGirder"]).toBe(30000);
    // Köşe yükü ana kirişi taşır: 27.850 → 30.000 onu da yükseltmeli.
    expect(ezik.values["c.cornerLoadT"] as number).toBeGreaterThan(temiz.values["c.cornerLoadT"] as number);
    expect(ezik.values["w.gantryLegs"] as number).toBeGreaterThan(temiz.values["w.gantryLegs"] as number);
    expect(ezik.values["w.total"] as number).toBeGreaterThan(temiz.values["w.total"] as number);
  });
});

describe("eksik girdi SIFIR SAYILMAZ", () => {
  it("kapasitesiz kalemde mekanizma ve ağırlıklar boş kalır, gerekçe yazılır", () => {
    const r = hesapla({ ...ASTOR, capacityT: null }, { ...COST_PARAM_DEFAULTS });
    expect(r.values["c.hoistMotorKw"]).toBeNull();
    expect(r.values["w.trolleyTotal"]).toBeNull();
    expect(r.values["w.total"]).toBeNull();
    expect(r.eksik.join(" ")).toContain("Kaldırma kapasitesi");
  });

  it("açıklıksız kalemde kiriş ve platform boş kalır", () => {
    const r = hesapla({ ...ASTOR, spanM: null }, { ...COST_PARAM_DEFAULTS });
    expect(r.values["w.mainGirder"]).toBeNull();
    expect(r.values["w.platform"]).toBeNull();
    expect(r.eksik.join(" ")).toContain("Açıklık");
  });
});

describe("portal olmayan vinçte ayak modeli çalışmaz", () => {
  it("köprü vincinde portal çeliği ve üst uç bağlantı sıfırdır", () => {
    const r = hesapla({ ...ASTOR, gantry: false, bridgeWheelCount: 4, bridgeDriveCount: 2 }, { ...COST_PARAM_DEFAULTS });
    expect(r.values["w.gantrySteel"]).toBe(0);
    expect(r.values["w.gantryLegs"]).toBe(0);
    expect(r.values["w.topEndConnection"]).toBe(0);
    expect(r.values["w.total"] as number).toBeLessThan(59500);
  });
});
