// Otomatik girdiler — mühendislik doğrulaması + anahtar davranışı.
//
// Bu dosya PK-D paketiyle gelen dört yeni otomatik alanı kilitler: makara
// verimi, yiv boyu metni, tambur ağırlığı, yürütme uygulama sınıfı ve ana
// kirişin ψhA / ψhK / γc katsayıları.
//
// İKİ ŞEY AYRI AYRI DOĞRULANIR:
//   1. Türetmenin SAYISI doğru mu (fizik / standart / kullanıcı örneği).
//   2. Anahtar KAPALIYKEN elle girilen değer korunuyor mu — yani her yeni
//      `*Auto` anahtarının `revision-load.ts` AUTO_FLAGS listesinde karşılığı
//      var mı. Kayıt anahtarı taşımıyorsa değer ELLE girilmiştir ve şablondaki
//      `true` miras alınırsa mühendisin sayısı sessizce ezilir.

import { describe, expect, it } from "vitest";
import {
  CMAA_APPLICATION_CLASSES,
  DRUM_STEEL_DENSITY_G_CM3,
  DRUM_WEIGHT_EXTRA_FACTOR,
  FEM_TO_CMAA_APPLICATION_CLASS,
  HOIST_DRUM_COUPLING_SERVICE_FACTOR,
  HOIST_GEARBOX_SERVICE_FACTOR,
  STANDARD_SHEAVE_EFFICIENCY,
  deriveDrumGrooveLengthText,
  deriveDrumWeightKg,
  deriveGirderInputs,
  deriveHoistInputs,
  deriveTravelInputs,
  travelAcceleration,
  travelApplicationClass,
  travelGearboxServiceFactor,
} from "../derive";
import {
  GIRDER_AUTO_FIELDS,
  HOIST_AUTO_FIELDS,
  HOIST_AUTO_SELECTION_FIELDS,
  HOIST_SELECTION_FIELDS,
  TRAVEL_AUTO_FIELDS,
  TRAVEL_AUTO_SELECTION_FIELDS,
  withDiameterSign,
} from "../fields";
import {
  NEW_WORK_SPECS,
  NEW_WORK_TEMPLATE,
  V5_MAIN_HOIST_INPUTS,
  V5_MAIN_HOIST_SELECTIONS,
  V5_SPECS,
} from "../defaults";
import { CALC_FIELD, loadRevision } from "@/lib/revision-load";
import { MODULE_ORDER } from "../presentation/module-family";
import { STRUCTURE_AMPLIFY_FACTOR, horizontalDynamicFactor } from "../modules/mainGirder";
import { drumGrooveRequirement, drumShaftGeometry } from "../modules/hoistGroup";
import { MECHANISM_CLASSES } from "../fields";
import type { HoistInputs, HoistSelections } from "../modules/hoistGroup";
import type { GirderInputs } from "../modules/mainGirder";
import type { TravelInputs, TravelSelections } from "../modules/travelGroup";
import { TRAVEL_INPUT_FIELDS, TRAVEL_SELECTION_FIELDS } from "../presentation/travelFields";
import {
  WHEELLOAD_AUTO_FIELDS,
  WHEELLOAD_AUTO_SELECTION_FIELDS,
} from "../presentation/wheelLoadFields";

const MAIN = NEW_WORK_TEMPLATE.mainHoist!;
const CTX = { liftHeightM: 10, capacityT: 10, ambientTempMaxC: 40, mechanismClass: "M6" as const };
const withInputs = (patch: Partial<HoistInputs>): HoistInputs => ({ ...MAIN.inputs, ...patch });
const withSel = (patch: Partial<HoistSelections>): HoistSelections => ({
  ...MAIN.selections,
  ...patch,
});

describe("motor ve tahrik adet alanları", () => {
  it("kaldırma motor adedini yalnız 1, 2 veya 4 seçenekli kutu olarak sunar", () => {
    const field = HOIST_SELECTION_FIELDS.find((item) => item.key === "motorCount");
    expect(field).toMatchObject({ type: "select", options: ["1", "2", "4"], numeric: true });
  });

  it("yürütme tahrik ve motor adetlerini belirlenmiş seçenekli kutular olarak sunar", () => {
    const drive = TRAVEL_INPUT_FIELDS.find((item) => item.key === "driveCount");
    const motor = TRAVEL_SELECTION_FIELDS.find((item) => item.key === "motorCount");
    expect(drive).toMatchObject({
      type: "select", options: ["1", "2", "4", "8", "16"], numeric: true,
    });
    expect(motor).toMatchObject({
      type: "select", options: ["1", "2", "4", "8", "16"], numeric: true,
    });
  });
});

describe("halat sipariş boyu alanı", () => {
  it("tek halat boyu sanılmaması için toplamı açıkça adlandırır", () => {
    const field = HOIST_SELECTION_FIELDS.find((item) => item.key === "ropeOrderLengthM");
    expect(field).toMatchObject({
      label: "Toplam Halat Boyu",
      hint: "Halat adedi × halat boyu = toplam halat boyu.",
    });
    expect(field?.info).toContain("tek bir halatın boyunu değil");
  });
});

// --------------------------------------------------------- 1. Makara verimi

describe("makara verimi otomatiği", () => {
  it("anahtar açıkken firma standardını girdiye yazar", () => {
    const d = deriveHoistInputs(withInputs({ sheaveEfficiencyAuto: true }), MAIN.selections, CTX);
    expect(d.sheaveEfficiency).toBe(STANDARD_SHEAVE_EFFICIENCY);
  });

  it("anahtar kapalıyken elle girilen verime dokunmaz", () => {
    const d = deriveHoistInputs(
      withInputs({ sheaveEfficiencyAuto: false, sheaveEfficiency: 0.96 }),
      MAIN.selections,
      CTX
    );
    expect(d.sheaveEfficiency).toBeUndefined();
  });
});

// -------------------------------------------------------------- 2. Yiv boyu

describe("yiv boyu otomatiği", () => {
  it("yiv SAYISINI yukarı yuvarlar ve boyu tam yiv sayısı × hatve yapar", () => {
    const base = drumGrooveRequirement(
      { ...V5_MAIN_HOIST_INPUTS, safetyGrooveCount: 0 },
      V5_MAIN_HOIST_SELECTIONS,
      32.7 * Math.PI * (V5_MAIN_HOIST_SELECTIONS.drumDiaMm / 1000)
    );
    expect(base.grooves).toBe(33);
    expect(base.lengthMm).toBe(base.grooves * base.pitchMm);
  });

  it("metni '<tahrikli halat sayısı> x <yiv boyu>' biçiminde kurar", () => {
    // V5 referans işi: 2/2 donanım, 10 m, Ø400 tambur, Ø18 halat, 3 emniyet
    // sarımı → z = 10,96 sarım · p = 20 mm → 219,15 mm → 220 mm.
    // Mühendisin elle yazdığı değer de tam olarak "2 x 220"dir.
    expect(deriveDrumGrooveLengthText(V5_MAIN_HOIST_INPUTS, V5_MAIN_HOIST_SELECTIONS, 10))
      .toBe("2 x 220");
    expect(V5_MAIN_HOIST_SELECTIONS.drumGrooveLengthText).toBe("2 x 220");
  });

  it("baştaki sayı TAHRİKLİ kol sayısıdır (donanım seçiminden okunur)", () => {
    const text = deriveDrumGrooveLengthText(
      { ...V5_MAIN_HOIST_INPUTS, reevingLabel: "4/8", drivenFalls: 1, totalFalls: 1 },
      V5_MAIN_HOIST_SELECTIONS,
      10
    );
    expect(text?.startsWith("4 x ")).toBe(true);
  });

  it("motorun gerekli yiv boyuyla tutarlıdır (aşağı kalmaz)", () => {
    const req = drumGrooveRequirement(V5_MAIN_HOIST_INPUTS, V5_MAIN_HOIST_SELECTIONS, 10);
    const rounded = Number(
      deriveDrumGrooveLengthText(V5_MAIN_HOIST_INPUTS, V5_MAIN_HOIST_SELECTIONS, 10)!
        .split(" x ")[1]
    );
    expect(rounded).toBeGreaterThanOrEqual(req.lengthMm);
  });

  it("anahtar kapalıyken metne dokunmaz, açıkken yazar", () => {
    expect(
      deriveHoistInputs(withInputs({ drumGrooveLengthAuto: false }), MAIN.selections, CTX)
        .drumGrooveLengthText
    ).toBeUndefined();
    expect(
      deriveHoistInputs(withInputs({ drumGrooveLengthAuto: true }), MAIN.selections, CTX)
        .drumGrooveLengthText
    ).toBe("2 x 380");
  });

  it("yiv boyunu C/E ölçülerine otomatik taşır; anahtar kapalıysa elle değeri korur", () => {
    const automatic = deriveHoistInputs(
      withInputs({ drumGrooveSpanAuto: true }), MAIN.selections, CTX
    );
    expect(automatic.drumSpanCMm).toBe(380);
    expect(automatic.drumSpanEMm).toBe(380);
    const manual = deriveHoistInputs(
      withInputs({ drumGrooveSpanAuto: false, drumSpanCMm: 123, drumSpanEMm: 456 }),
      MAIN.selections,
      CTX
    );
    expect(manual.drumSpanCMm).toBeUndefined();
    expect(manual.drumSpanEMm).toBeUndefined();
  });

  it("kaynak veri eksikse değer değil UYARI üretir", () => {
    const d = deriveHoistInputs(
      withInputs({ drumGrooveLengthAuto: true }),
      withSel({ drumDiaMm: 0 }),
      CTX
    );
    expect(d.drumGrooveLengthText).toBeUndefined();
    expect(d.warnings.map((w) => w.field)).toContain("drumGrooveLengthText");
  });
});

describe("kaldırma katsayıları otomatiği", () => {
  it("redüktör katsayılarını FEM mekanizma sınıfından getirir", () => {
    expect(HOIST_GEARBOX_SERVICE_FACTOR).toEqual({
      M1: 1, M2: 1, M3: 1, M4: 1, M5: 1.1, M6: 1.3, M7: 1.5, M8: 1.7,
    });
  });

  it("tambur kaplini katsayılarını FEM mekanizma sınıfından getirir", () => {
    expect(HOIST_DRUM_COUPLING_SERVICE_FACTOR).toEqual({
      M1: 1.1, M2: 1.1, M3: 1.1, M4: 1.1, M5: 1.3, M6: 1.5, M7: 1.6, M8: 1.7,
    });
  });

  it("otomatik açıkken M7 değerlerini yazar, kapalıyken elle girileni korur", () => {
    const automatic = deriveHoistInputs(
      withInputs({ gearboxServiceFactorAuto: true, drumCouplingServiceFactorAuto: true }),
      MAIN.selections,
      { ...CTX, mechanismClass: "M7" }
    );
    expect(automatic.gearboxServiceFactor).toBe(1.5);
    expect(automatic.drumCouplingServiceFactor).toBe(1.6);
    const manual = deriveHoistInputs(
      withInputs({ gearboxServiceFactorAuto: false, drumCouplingServiceFactorAuto: false }),
      MAIN.selections,
      { ...CTX, mechanismClass: "M7" }
    );
    expect(manual.gearboxServiceFactor).toBeUndefined();
    expect(manual.drumCouplingServiceFactor).toBeUndefined();
  });
});

// -------------------------------------------------------- 3. Tambur ağırlığı

describe("tambur ağırlığı otomatiği", () => {
  it("kullanıcının verdiği örneği birebir üretir (Ø400 · 12 mm yiv dibi · Ø18 · 2000 mm)", () => {
    // s = 12 + 18/2 = 21 mm → A = π/4·(400² − 358²) = 25.004 mm²
    // V = 25.004 · 2.000 = 50.008,1 cm³ → 392,6 kg → ×1,3 = 510,3 → 520 kg
    const areaMm2 = (Math.PI / 4) * (400 ** 2 - 358 ** 2);
    const kg = ((areaMm2 * 2000) / 1000) * DRUM_STEEL_DENSITY_G_CM3 / 1000 *
      DRUM_WEIGHT_EXTRA_FACTOR;
    expect(kg).toBeCloseTo(510.3, 1);
    expect(
      deriveDrumWeightKg({
        drumDiaMm: 400,
        grooveWallThicknessMm: 12,
        ropeDiaMm: 18,
        barrelLengthMm: 2000,
      })
    ).toBe(520);
  });

  it("et kalınlığına halat çapının YARISI eklenir", () => {
    const withRope = deriveDrumWeightKg({
      drumDiaMm: 400, grooveWallThicknessMm: 12, ropeDiaMm: 18, barrelLengthMm: 2000,
    })!;
    const asIfWallOnly = deriveDrumWeightKg({
      drumDiaMm: 400, grooveWallThicknessMm: 21, ropeDiaMm: 0, barrelLengthMm: 2000,
    })!;
    expect(withRope).toBe(asIfWallOnly);
  });

  it("boy ve et kalınlığıyla birlikte artar", () => {
    const base = { drumDiaMm: 400, grooveWallThicknessMm: 12, ropeDiaMm: 18, barrelLengthMm: 2000 };
    expect(deriveDrumWeightKg({ ...base, barrelLengthMm: 4000 })!).toBeGreaterThan(
      deriveDrumWeightKg(base)!
    );
    expect(deriveDrumWeightKg({ ...base, grooveWallThicknessMm: 20 })!).toBeGreaterThan(
      deriveDrumWeightKg(base)!
    );
  });

  it("boyu NAMLU (yanaklar arası B…F) ölçüsünden alır, yiv boyundan değil", () => {
    const geo = drumShaftGeometry(V5_MAIN_HOIST_INPUTS);
    // B+C+D+E+F = 5+22+64+22+5 = 118 cm; yiv bölgeleri yalnız C ve E'dir.
    expect(geo.barrelCm).toBe(118);
    const d = deriveHoistInputs(
      { ...V5_MAIN_HOIST_INPUTS, drumWeightAuto: true },
      V5_MAIN_HOIST_SELECTIONS,
      { ...CTX, capacityT: 4 }
    );
    expect(d.drumWeightKg).toBe(
      deriveDrumWeightKg({
        drumDiaMm: V5_MAIN_HOIST_SELECTIONS.drumDiaMm,
        grooveWallThicknessMm: V5_MAIN_HOIST_INPUTS.drumWallThicknessMm,
        ropeDiaMm: V5_MAIN_HOIST_SELECTIONS.ropeDiaMm,
        barrelLengthMm: 1180,
      })
    );
  });

  it("geometrik olarak imkânsız kesitte değer üretmez", () => {
    // 2s ≥ D → gövde dolu; boru bağıntısı anlamsız.
    expect(
      deriveDrumWeightKg({
        drumDiaMm: 100, grooveWallThicknessMm: 60, ropeDiaMm: 20, barrelLengthMm: 1000,
      })
    ).toBeUndefined();
    expect(
      deriveDrumWeightKg({
        drumDiaMm: 400, grooveWallThicknessMm: 12, ropeDiaMm: 18, barrelLengthMm: 0,
      })
    ).toBeUndefined();
  });

  it("anahtar kapalıyken elle girilen ağırlığa dokunmaz", () => {
    const d = deriveHoistInputs(
      withInputs({ drumWeightAuto: false, drumWeightKg: 1234 }),
      MAIN.selections,
      CTX
    );
    expect(d.drumWeightKg).toBeUndefined();
  });
});

// ------------------------------------------- 4. Yürütme uygulama (CMAA) sınıfı

describe("yürütme uygulama sınıfı otomatiği", () => {
  it("FEM mekanizma sınıfını CMAA servis sınıfına eşler (firma kabulü)", () => {
    expect(FEM_TO_CMAA_APPLICATION_CLASS).toEqual({
      M1: "A", M2: "A", M3: "A", M4: "B", M5: "C", M6: "D", M7: "E", M8: "F",
    });
  });

  it("her mekanizma sınıfının geçerli bir karşılığı vardır ve eşleme monotondur", () => {
    let prev = -1;
    for (const m of MECHANISM_CLASSES) {
      const cls = travelApplicationClass(m);
      const i = CMAA_APPLICATION_CLASSES.indexOf(cls);
      expect(i).toBeGreaterThanOrEqual(0);
      expect(i).toBeGreaterThanOrEqual(prev); // ağırlaşan mekanizma → ağırlaşan sınıf
      prev = i;
    }
  });

  it("tanınmayan sınıfta en ağır kabulde kalır", () => {
    expect(travelApplicationClass(undefined)).toBe("F");
  });

  it("anahtar açıkken sınıfı girdiye yazar, kapalıyken elle seçime dokunmaz", () => {
    const inp = NEW_WORK_TEMPLATE.bridge!.inputs as TravelInputs;
    const sel = NEW_WORK_TEMPLATE.bridge!.selections as TravelSelections;
    expect(
      deriveTravelInputs({ ...inp, travelApplicationClassAuto: true }, sel, {
        ambientTempMaxC: 40, mechanismClass: "M3", travelSpeedMpm: 30,
      }).applicationClass
    ).toBe("A");
    expect(
      deriveTravelInputs({ ...inp, travelApplicationClassAuto: false, applicationClass: "B" }, sel, {
        ambientTempMaxC: 40, mechanismClass: "M3", travelSpeedMpm: 30,
      }).applicationClass
    ).toBeUndefined();
  });

  it("şablondaki değer seçenek listesindedir", () => {
    for (const key of ["trolley", "bridge"] as const) {
      const cls = (NEW_WORK_TEMPLATE[key]!.inputs as TravelInputs).applicationClass;
      expect(CMAA_APPLICATION_CLASSES as readonly string[]).toContain(cls);
    }
  });
});

describe("yürütme redüktörü katsayısı otomatiği", () => {
  it("M1–M8 kullanıcı tablosunu eksiksiz uygular", () => {
    expect(MECHANISM_CLASSES.map((m) => travelGearboxServiceFactor(m)))
      .toEqual([1.4, 1.4, 1.4, 1.4, 1.5, 1.6, 1.9, 2.1]);
  });

  it("otomatik açıkken değeri yazar, kapalıyken elle girileni ezmez", () => {
    const inp = NEW_WORK_TEMPLATE.bridge!.inputs as TravelInputs;
    const sel = NEW_WORK_TEMPLATE.bridge!.selections as TravelSelections;
    expect(deriveTravelInputs(
      { ...inp, gearboxServiceFactorAuto: true },
      sel,
      { ambientTempMaxC: 40, mechanismClass: "M7", travelSpeedMpm: 30 }
    ).gearboxServiceFactor).toBe(1.9);
    expect(deriveTravelInputs(
      { ...inp, gearboxServiceFactorAuto: false, gearboxServiceFactor: 7.7 },
      sel,
      { ambientTempMaxC: 40, mechanismClass: "M7", travelSpeedMpm: 30 }
    ).gearboxServiceFactor).toBeUndefined();
  });
});

// ------------------------------- 5. Ana kiriş: yükler ve yükleme durumları

describe("yürütme ivmesi otomatiği", () => {
  const inp = NEW_WORK_TEMPLATE.bridge!.inputs as TravelInputs;
  const sel = NEW_WORK_TEMPLATE.bridge!.selections as TravelSelections;
  const ctx = (mechanismClass: (typeof MECHANISM_CLASSES)[number]) => ({
    ambientTempMaxC: 40,
    mechanismClass,
    travelSpeedMpm: 30,
  });

  it("M1–M8 kullanıcı tablosunu eksiksiz uygular", () => {
    expect(MECHANISM_CLASSES.map((m) => travelAcceleration(m)))
      .toEqual([0.12, 0.12, 0.12, 0.12, 0.13, 0.15, 0.2, 0.25]);
  });

  it("ağırlaşan mekanizma sınıfında ivme AZALMAZ", () => {
    let prev = 0;
    for (const m of MECHANISM_CLASSES) {
      const a = travelAcceleration(m);
      expect(a, m).toBeGreaterThanOrEqual(prev);
      prev = a;
    }
  });

  it("otomatik açıkken değeri yazar, kapalıyken elle girileni ezmez", () => {
    expect(
      deriveTravelInputs({ ...inp, accelerationAuto: true }, sel, ctx("M8")).accelerationMs2
    ).toBe(0.25);
    expect(
      deriveTravelInputs(
        { ...inp, accelerationAuto: false, accelerationMs2: 0.44 },
        sel,
        ctx("M8")
      ).accelerationMs2
    ).toBeUndefined();
  });

  it("şablon değeri kendi mekanizma sınıfının türetmesiyle birebir aynıdır", () => {
    for (const key of ["trolley", "auxTrolley", "mono1Trolley", "mono2Trolley", "bridge"] as const) {
      const t = NEW_WORK_TEMPLATE[key]!.inputs as TravelInputs;
      expect(t.accelerationAuto, key).toBe(true);
      if (key === "trolley" || key === "bridge") {
        const mech = key === "bridge"
          ? NEW_WORK_SPECS.bridgeMechanismClass
          : NEW_WORK_SPECS.trolleyMechanismClass;
        expect(t.accelerationMs2, key).toBe(travelAcceleration(mech));
      }
    }
  });
});

describe("yürütme tahrik ve motor adedi otomatiği", () => {
  const inp = NEW_WORK_TEMPLATE.bridge!.inputs as TravelInputs;
  const sel = NEW_WORK_TEMPLATE.bridge!.selections as TravelSelections;
  const ctx = { ambientTempMaxC: 40, mechanismClass: "M6" as const, travelSpeedMpm: 30 };

  it("motor adedini tahrik adedine eşitler, anahtar kapalıyken dokunmaz", () => {
    expect(deriveTravelInputs({ ...inp, driveCount: 8, motorCountAuto: true }, sel, ctx).motorCount)
      .toBe(8);
    expect(deriveTravelInputs({ ...inp, driveCount: 8, motorCountAuto: false }, sel, ctx).motorCount)
      .toBeUndefined();
  });

  it("yeni raporun tüm yürütmelerinde tahrik 2 ve motor otomatiği açıktır", () => {
    for (const key of ["trolley", "auxTrolley", "mono1Trolley", "mono2Trolley", "bridge"] as const) {
      const state = NEW_WORK_TEMPLATE[key]!;
      expect(state.inputs.driveCount, key).toBe(2);
      expect(state.inputs.motorCountAuto, key).toBe(true);
      expect(state.selections.motorCount, key).toBe(2);
    }
  });
});

describe("yürütme redüktörü tahvil oranı otomatiği", () => {
  const inp = NEW_WORK_TEMPLATE.bridge!.inputs as TravelInputs;
  const sel = NEW_WORK_TEMPLATE.bridge!.selections as TravelSelections;
  const CTX30 = { ambientTempMaxC: 40, mechanismClass: "M6" as const, travelSpeedMpm: 30 };

  it("oranı GEREKEN ORANA eşitler: gerçekleşen hız anma hızına oturur", () => {
    const d = deriveTravelInputs({ ...inp, gearboxRatioAuto: true }, sel, CTX30);
    expect(d.gearboxRatio).toBeDefined();
    // V = (n_motor / i) · π · D  →  anma hızının kendisi
    const actual = (sel.motorRpm / d.gearboxRatio!) * Math.PI * (sel.wheelDiaMm / 1000);
    expect(actual).toBeCloseTo(CTX30.travelSpeedMpm, 3);
  });

  it("teker çapı büyürse gereken oran BÜYÜR (büyük teker daha yavaş döner)", () => {
    // Aynı yürüyüş hızını daha büyük tekerle tutturmak için teker devri
    // düşer, dolayısıyla motor ile teker arasındaki küçültme oranı artar.
    const kucuk = deriveTravelInputs(
      { ...inp, gearboxRatioAuto: true }, { ...sel, wheelDiaMm: 250 }, CTX30
    ).gearboxRatio!;
    const buyuk = deriveTravelInputs(
      { ...inp, gearboxRatioAuto: true }, { ...sel, wheelDiaMm: 500 }, CTX30
    ).gearboxRatio!;
    expect(buyuk).toBeGreaterThan(kucuk);
    expect(buyuk).toBeCloseTo(kucuk * 2, 3); // oran çapla DOĞRU orantılıdır
  });

  it("anahtar kapalıyken katalogdan seçilen oran türetilmez", () => {
    expect(
      deriveTravelInputs({ ...inp, gearboxRatioAuto: false }, sel, CTX30).gearboxRatio
    ).toBeUndefined();
  });

  it("hız ya da çap girilmemişse SAYI YAZILMAZ (kutu NaN'a düşmez)", () => {
    expect(
      deriveTravelInputs({ ...inp, gearboxRatioAuto: true }, sel, {
        ...CTX30, travelSpeedMpm: 0,
      }).gearboxRatio
    ).toBeUndefined();
    expect(
      deriveTravelInputs(
        { ...inp, gearboxRatioAuto: true }, { ...sel, wheelDiaMm: 0 }, CTX30
      ).gearboxRatio
    ).toBeUndefined();
  });

  it("şablondaki oran türetmenin yazacağı sayının BİREBİR aynısıdır", () => {
    for (const key of ["trolley", "bridge"] as const) {
      const t = NEW_WORK_TEMPLATE[key]!.inputs as TravelInputs;
      const s2 = NEW_WORK_TEMPLATE[key]!.selections as TravelSelections;
      const speed = key === "bridge"
        ? NEW_WORK_SPECS.bridgeSpeedMpm
        : NEW_WORK_SPECS.trolleySpeedMpm;
      expect(t.gearboxRatioAuto, key).toBe(true);
      const d = deriveTravelInputs(t, s2, {
        ambientTempMaxC: NEW_WORK_SPECS.ambientTempMaxC,
        mechanismClass: key === "bridge"
          ? NEW_WORK_SPECS.bridgeMechanismClass
          : NEW_WORK_SPECS.trolleyMechanismClass,
        travelSpeedMpm: speed,
      });
      expect(s2.gearboxRatio, key).toBe(d.gearboxRatio);
    }
  });
});

describe("ana kiriş ψhA / ψhK / γc otomatiği", () => {
  const GIRDER = NEW_WORK_TEMPLATE.girder!.inputs as GirderInputs;
  const DEP = { mainHookBlockWeightKg: 1000, mainRopeWeightKg: 100 };

  it("ψh değerleri motorun kendi bağıntısıyla BİREBİR aynıdır", () => {
    const d = deriveGirderInputs({ ...GIRDER, psiHAAuto: true, psiHKAuto: true }, NEW_WORK_SPECS, DEP);
    const live = NEW_WORK_SPECS.mainCapacityT * 1000 + 1000 + 100;
    const trolleyKg = NEW_WORK_SPECS.mainTrolleyWeightT * 1000;
    expect(d.psiHAOverride).toBe(horizontalDynamicFactor(live / trolleyKg));
    expect(d.psiHKOverride).toBe(
      horizontalDynamicFactor(live / (NEW_WORK_SPECS.bridgeWeightT * 1000 + trolleyKg))
    );
  });

  it("γc çelik yapı sınıfından gelir", () => {
    const d = deriveGirderInputs({ ...GIRDER, amplifyYcAuto: true }, V5_SPECS, DEP);
    expect(d.amplifyYcOverride).toBe(STRUCTURE_AMPLIFY_FACTOR[V5_SPECS.structureClass]);
  });

  it("kütle oranı 1'in altındaysa ψh = 2 (FEM üst zarfı)", () => {
    const agirAraba = { ...NEW_WORK_SPECS, mainTrolleyWeightT: 100 };
    const d = deriveGirderInputs({ ...GIRDER, psiHAAuto: true }, agirAraba, DEP);
    expect(d.psiHAOverride).toBe(2);
  });

  it("anahtarlar kapalıyken elle girilen katsayılara dokunmaz", () => {
    const d = deriveGirderInputs(
      {
        ...GIRDER,
        psiHAAuto: false,
        psiHKAuto: false,
        amplifyYcAuto: false,
        hookTopPositionAuto: false,
        bridgeAxleSpacingAuto: false,
        wheelContactTAuto: false,
      },
      NEW_WORK_SPECS,
      DEP
    );
    expect(d).toEqual({});
  });
});

// ---------------------------------------- 6. AUTO_FLAGS koruması (regresyon)

/** Kaydedilmiş bir revizyon gövdesi — tüm bölümler mevcut (kapalı sayılmasın). */
function storedRevision(): Record<string, unknown> {
  const src = NEW_WORK_TEMPLATE as unknown as Record<string, { inputs: object } | undefined>;
  const out: Record<string, unknown> = { specs: NEW_WORK_SPECS, disabledModules: [] };
  for (const key of MODULE_ORDER) {
    const field = CALC_FIELD[key];
    out[field] = { ...(src[field]?.inputs ?? {}) };
  }
  return out;
}

/** Bir bölümün girdisinden bir anahtarı siler (eski kayıt: elle girilmiş). */
function withoutFlag(stored: Record<string, unknown>, field: string, flag: string) {
  const rec = { ...(stored[field] as Record<string, unknown>) };
  delete rec[flag];
  return { ...stored, [field]: rec };
}

describe("AUTO_FLAGS koruması", () => {
  const CASES: [string, Record<string, string>][] = [
    ["mainHoist", HOIST_AUTO_FIELDS],
    ["mainHoist", HOIST_AUTO_SELECTION_FIELDS],
    ["bridge", TRAVEL_AUTO_FIELDS],
    ["bridge", TRAVEL_AUTO_SELECTION_FIELDS],
    ["girder", GIRDER_AUTO_FIELDS],
    ["wheelLoads", WHEELLOAD_AUTO_FIELDS],
    ["wheelLoads", WHEELLOAD_AUTO_SELECTION_FIELDS],
  ];

  for (const [field, map] of CASES) {
    for (const flag of new Set(Object.values(map))) {
      it(`${field}.${flag}: kayıtta anahtar yoksa KAPALI yüklenir (elle değer ezilmez)`, () => {
        const stored = withoutFlag(storedRevision(), field, flag);
        const loaded = loadRevision(stored, null);
        const inputs = (loaded.full as unknown as Record<string, { inputs: Record<string, unknown> }>)[
          field
        ].inputs;
        // Halat sipariş boyu eski revizyonlarda hiç bulunamaz; yükleyici bu
        // yeni alanı hesaplayıp otomatiği özellikle açar. Diğer eski otomatik
        // alanlarda elle girilmiş değeri koruyan genel kural devam eder.
        expect(inputs[flag]).toBe(flag === "ropeOrderLengthAuto");
      });

      it(`${field}.${flag}: kayıtta anahtar açıksa açık kalır`, () => {
        const base = storedRevision();
        const rec = { ...(base[field] as Record<string, unknown>), [flag]: true };
        const loaded = loadRevision({ ...base, [field]: rec }, null);
        const inputs = (loaded.full as unknown as Record<string, { inputs: Record<string, unknown> }>)[
          field
        ].inputs;
        expect(inputs[flag]).toBe(true);
      });
    }
  }
});

// ------------------------------------------------------------ 7. Çap işareti

describe("çap işareti", () => {
  it("yalnız işaretli tanımların değerine Ø ekler", () => {
    expect(withDiameterSign("400", { diameter: true })).toBe("Ø400");
    expect(withDiameterSign("400")).toBe("400");
    expect(withDiameterSign("400", {})).toBe("400");
  });

  it("boş ve zaten işaretli değerlere dokunmaz", () => {
    expect(withDiameterSign("—", { diameter: true })).toBe("—");
    expect(withDiameterSign("", { diameter: true })).toBe("");
    expect(withDiameterSign("Ø400", { diameter: true })).toBe("Ø400");
  });
});
