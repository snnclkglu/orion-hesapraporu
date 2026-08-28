// Editörün OTOMATİK ALAN BAĞLANTISI — regresyon testleri (paket FIX-1).
//
// Neden bu dosya var: `derive.ts` tarafı 616 testle zaten kilitliydi, ama
// EDİTÖRÜN o türetmeleri state'e YAZDIĞI yer test edilmiyordu. Sonuç: makara
// verimi, tambur ağırlığı, yiv boyu, yürütmenin uygulama sınıfı/Ks/Kt ve ana
// kirişin ψhA/ψhK/γc katsayıları arayüzde ÖLÜ kaldı — kutu yalnız kilitleniyor,
// değeri güncellenmiyordu. Testler yeşilken hata görünmüyordu.
//
// Burada iki şey ayrı ayrı doğrulanır:
//   1. Saf yazma katmanı (`withDerivedModules`) doğru alanı doğru nesneye
//      yazıyor mu — girdiye mi, seçime mi; anahtar kapalıyken elle değer
//      korunuyor mu; anahtar açılınca türetilen değer geri geliyor mu.
//   2. Editörün o katmanı GERÇEKTEN çağırdığı ve `auto` prop'unu hem girdi hem
//      SEÇİM ızgarasına bağladığı — kaynak metni üzerinden (bileşen testi
//      altyapısı yok; bağlantı kesilirse bu testler kırılır).

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  MODULE_ADAPTERS,
  autoInputFlag,
  autoSelectionFlag,
  derivationWarnings,
  reArmGearboxRatioAuto,
  syncRailCodeToFamily,
  withDerivedModules,
  type ModuleState,
  type ModulesState,
} from "../module-adapters";
import { NEW_WORK_SPECS, NEW_WORK_TEMPLATE } from "@/lib/calc/defaults";
import { CALC_FIELD } from "@/lib/revision-load";
import { MODULE_ORDER } from "@/lib/calc/presentation/module-family";
import {
  STANDARD_SHEAVE_EFFICIENCY,
  cmaaAccelTorqueKt,
  cmaaServiceFactorKs,
  deriveDrumWeightKg,
  travelApplicationClass,
} from "@/lib/calc/derive";
import {
  GIRDER_AUTO_FIELDS,
  HOIST_AUTO_FIELDS,
  HOIST_AUTO_SELECTION_FIELDS,
  TRAVEL_AUTO_FIELDS,
  TRAVEL_AUTO_SELECTION_FIELDS,
} from "@/lib/calc/fields";
import { STRUCTURE_AMPLIFY_FACTOR, horizontalDynamicFactor } from "@/lib/calc/modules/mainGirder";
import { drumShaftGeometry } from "@/lib/calc/modules/hoistGroup";
import { computeTravelGroup } from "@/lib/calc/modules/travelGroup";
import type { HoistInputs, HoistSelections } from "@/lib/calc/modules/hoistGroup";
import type { TravelInputs, TravelSelections } from "@/lib/calc/modules/travelGroup";
import type { GirderInputs } from "@/lib/calc/modules/mainGirder";
import type { WheelLoadInputs, WheelLoadSelections } from "@/lib/calc/modules/wheelLoads";
import {
  WHEELLOAD_AUTO_FIELDS,
  WHEELLOAD_AUTO_SELECTION_FIELDS,
} from "@/lib/calc/presentation/wheelLoadFields";
import type { ModuleKey } from "../module-adapters";
import type { TechnicalSpecs } from "@/lib/calc/types";

// ------------------------------------------------------------------ fikstür

/** Editörün `initModules` ile kurduğu duruma denk başlangıç (türetme UYGULANMADAN). */
function baseModules(): ModulesState {
  const src = NEW_WORK_TEMPLATE as unknown as Record<
    string,
    { inputs?: object; selections?: object } | undefined
  >;
  const out = {} as ModulesState;
  for (const key of MODULE_ORDER) {
    const st = src[CALC_FIELD[key]];
    out[key] = {
      inputs: { ...(st?.inputs ?? {}) },
      selections: { ...(st?.selections ?? {}) },
    };
  }
  return out;
}

/** Bir bölümün girdilerini yamalar (kullanıcının kutuya yazması / anahtarı çevirmesi). */
function patchInputs(mods: ModulesState, key: ModuleKey, patch: object): ModulesState {
  const st: ModuleState = mods[key];
  return { ...mods, [key]: { ...st, inputs: { ...st.inputs, ...patch } } };
}

/** Bir bölümün seçimlerini yamalar. */
function patchSelections(mods: ModulesState, key: ModuleKey, patch: object): ModulesState {
  const st: ModuleState = mods[key];
  return { ...mods, [key]: { ...st, selections: { ...st.selections, ...patch } } };
}

const hoistIn = (m: ModulesState, k: ModuleKey = "main") => m[k].inputs as HoistInputs;
const hoistSel = (m: ModulesState, k: ModuleKey = "main") => m[k].selections as HoistSelections;
const travelIn = (m: ModulesState, k: ModuleKey) => m[k].inputs as TravelInputs;
const travelSel = (m: ModulesState, k: ModuleKey) => m[k].selections as TravelSelections;
const girderIn = (m: ModulesState) => m.girder.inputs as GirderInputs;
const wheelIn = (m: ModulesState) => m.wheelLoads.inputs as WheelLoadInputs;
const wheelSel = (m: ModulesState) => m.wheelLoads.selections as WheelLoadSelections;

const SPECS: TechnicalSpecs = NEW_WORK_SPECS;

// ------------------------------------------------- 1. Makara verimi (madde 2)

describe("makara verimi kutusu (madde 2)", () => {
  it("OTOMATİK açıkken firma standardını GİRDİYE yazar", () => {
    const m = withDerivedModules(baseModules(), SPECS);
    expect(hoistIn(m).sheaveEfficiency).toBe(STANDARD_SHEAVE_EFFICIENCY);
  });

  it("OTOMATİK kapalıyken elle girilen 0,9 KORUNUR", () => {
    const m = withDerivedModules(
      patchInputs(baseModules(), "main", {
        sheaveEfficiencyAuto: false,
        sheaveEfficiency: 0.9,
      }),
      SPECS
    );
    expect(hoistIn(m).sheaveEfficiency).toBe(0.9);
  });

  it("kapat → 0,9 yaz → tekrar aç: türetilen 0,985 GERİ GELİR", () => {
    // Denetimin canlı ölçtüğü semptomun birebir tekrarı: eskiden kutu 0,9'da
    // kilitli kalıyordu (anahtar yalnız disabled yapıyor, değeri yazmıyordu).
    const kapali = withDerivedModules(
      patchInputs(baseModules(), "main", {
        sheaveEfficiencyAuto: false,
        sheaveEfficiency: 0.9,
      }),
      SPECS
    );
    expect(hoistIn(kapali).sheaveEfficiency).toBe(0.9);
    const tekrarAcik = withDerivedModules(
      patchInputs(kapali, "main", { sheaveEfficiencyAuto: true }),
      SPECS
    );
    expect(hoistIn(tekrarAcik).sheaveEfficiency).toBe(STANDARD_SHEAVE_EFFICIENCY);
  });
});

// ------------------------------------------------ 2. Tambur ağırlığı (madde 6)

describe("tambur ağırlığı kutusu (madde 6)", () => {
  it("OTOMATİK açıkken türetilen ağırlığı girdiye yazar", () => {
    const m = withDerivedModules(baseModules(), SPECS);
    const inp = hoistIn(m);
    const sel = hoistSel(m);
    expect(inp.drumWeightKg).toBe(
      deriveDrumWeightKg({
        drumDiaMm: sel.drumDiaMm,
        grooveWallThicknessMm: inp.drumWallThicknessMm,
        ropeDiaMm: sel.ropeDiaMm,
        barrelLengthMm: drumShaftGeometry(inp).barrelCm * 10,
      })
    );
  });

  it("kaynak veri değişince kutu GÜNCELLENİR (yalnız kilitlemez)", () => {
    const once = withDerivedModules(baseModules(), SPECS);
    const kalin = withDerivedModules(
      patchInputs(once, "main", {
        drumWallThicknessMm: (hoistIn(once).drumWallThicknessMm ?? 0) + 10,
      }),
      SPECS
    );
    expect(hoistIn(kalin).drumWeightKg).toBeGreaterThan(hoistIn(once).drumWeightKg);
  });

  it("OTOMATİK kapalıyken elle girilen ağırlık KORUNUR", () => {
    const m = withDerivedModules(
      patchInputs(baseModules(), "main", { drumWeightAuto: false, drumWeightKg: 1234 }),
      SPECS
    );
    expect(hoistIn(m).drumWeightKg).toBe(1234);
  });
});

// ------------------------------------------------------ 3. Yiv boyu (madde 5)

describe("yiv boyu SEÇİM alanı (madde 5)", () => {
  it("otomatik anahtarı seçim alanı için tanımlıdır (girdi haritasında DEĞİL)", () => {
    expect(autoSelectionFlag("main", "drumGrooveLengthText")).toBe("drumGrooveLengthAuto");
    expect(autoInputFlag("main", "drumGrooveLengthText")).toBeUndefined();
  });

  it("halat boyunu otomatik tam metre olarak seçimlere yazar ve elle değeri korur", () => {
    const otomatik = withDerivedModules(baseModules(), SPECS);
    expect(autoSelectionFlag("main", "ropeOrderLengthM")).toBe("ropeOrderLengthAuto");
    expect(Number.isInteger(hoistSel(otomatik).ropeOrderLengthM)).toBe(true);

    const elle = withDerivedModules(
      patchSelections(
        patchInputs(baseModules(), "main", { ropeOrderLengthAuto: false }),
        "main",
        { ropeOrderLengthM: 105 }
      ),
      SPECS
    );
    expect(hoistSel(elle).ropeOrderLengthM).toBe(105);
  });

  it("türetilen metin SEÇİMLERE yazılır (girdilere değil)", () => {
    const m = withDerivedModules(
      patchSelections(baseModules(), "main", { drumGrooveLengthText: "elle yazılmış" }),
      SPECS
    );
    expect(hoistSel(m).drumGrooveLengthText).toMatch(/^\d+ x \d+$/);
    expect((hoistIn(m) as unknown as Record<string, unknown>).drumGrooveLengthText)
      .toBeUndefined();
  });

  it("OTOMATİK kapalıyken elle yazılan metin KORUNUR, açılınca geri gelir", () => {
    const kapali = withDerivedModules(
      patchSelections(
        patchInputs(baseModules(), "main", { drumGrooveLengthAuto: false }),
        "main",
        { drumGrooveLengthText: "2 x 999" }
      ),
      SPECS
    );
    expect(hoistSel(kapali).drumGrooveLengthText).toBe("2 x 999");
    const tekrarAcik = withDerivedModules(
      patchInputs(kapali, "main", { drumGrooveLengthAuto: true }),
      SPECS
    );
    expect(hoistSel(tekrarAcik).drumGrooveLengthText).not.toBe("2 x 999");
    expect(hoistSel(tekrarAcik).drumGrooveLengthText).toMatch(/^\d+ x \d+$/);
  });

  it("kaynak veri eksikse değer yerine UYARI üretilir", () => {
    const m = patchSelections(baseModules(), "main", { drumDiaMm: 0 });
    const w = derivationWarnings(m, SPECS).main;
    expect(w.map((x) => x.field)).toContain("drumGrooveLengthText");
  });
});

// ------------------------------- 4. Yürütme: uygulama sınıfı + Ks/Kt (17, 18)

describe("yürütme uygulama sınıfı ve Ks/Kt kutuları (madde 17, 18)", () => {
  it("şablonda M6 → uygulama sınıfı D, Ks tablodan gelir", () => {
    const m = withDerivedModules(baseModules(), SPECS);
    const t = travelIn(m, "trolley");
    expect(SPECS.trolleyMechanismClass).toBe("M6");
    expect(t.applicationClass).toBe("D");
    expect(t.serviceFactorKs).toBe(cmaaServiceFactorKs("D", t.driveControl));
    expect(t.accelTorqueFactorKt).toBe(cmaaAccelTorqueKt(t.motorControl));
  });

  it("Teknik Özellikler'de M6 → M3 yapılınca sınıf VE Ks birlikte değişir", () => {
    // Denetimin ölçtüğü semptom: mekanizma sınıfı M3 yapıldığında 4.4'teki
    // uygulama sınıfı "E"de, Ks 1,2'de kalıyordu (deriveTravelInputs hiç
    // çağrılmıyordu).
    const m3: TechnicalSpecs = {
      ...SPECS,
      trolleyMechanismClass: "M3",
      bridgeMechanismClass: "M3",
    };
    const m = withDerivedModules(baseModules(), m3);
    for (const key of ["trolley", "bridge"] as const) {
      const t = travelIn(m, key);
      expect(t.applicationClass).toBe(travelApplicationClass("M3"));
      expect(t.applicationClass).toBe("A");
      expect(t.serviceFactorKs).toBe(cmaaServiceFactorKs("A", t.driveControl));
      // D → A geçişinde acManyetik sütunu 1,1 → 1,0 düşer; sayı GERÇEKTEN oynar.
      expect(t.serviceFactorKs).toBe(1);
    }
  });

  it("uygulama sınıfı anahtarı kapalıyken elle seçilen sınıf ve Ks'si korunur", () => {
    const m = withDerivedModules(
      patchInputs(baseModules(), "trolley", {
        travelApplicationClassAuto: false,
        applicationClass: "B",
      }),
      { ...SPECS, trolleyMechanismClass: "M3" }
    );
    const t = travelIn(m, "trolley");
    expect(t.applicationClass).toBe("B");
    // Ks otomatiği açık kaldığı için mühendisin SEÇTİĞİ sınıfın satırından okur.
    expect(t.serviceFactorKs).toBe(cmaaServiceFactorKs("B", t.driveControl));
  });

  it("Ks anahtarı kapalıyken elle girilen değer KORUNUR", () => {
    const m = withDerivedModules(
      patchInputs(baseModules(), "bridge", { serviceFactorKsAuto: false, serviceFactorKs: 1 }),
      SPECS
    );
    expect(travelIn(m, "bridge").serviceFactorKs).toBe(1);
  });

  it("tablo N/A verdiğinde değer uydurulmaz, UYARI üretilir", () => {
    // E sınıfı × 30 dakikalık DC sütunu tabloda N/A'dır.
    const m = patchInputs(baseModules(), "bridge", { driveControl: "dcSabit30" });
    const m7 = { ...SPECS, bridgeMechanismClass: "M7" as const };
    const w = derivationWarnings(m, m7).bridge;
    expect(w.map((x) => x.field)).toContain("serviceFactorKs");
    expect(travelIn(withDerivedModules(m, m7), "bridge").serviceFactorKs).toBe(1.1);
  });
});

// ------------------------------------- 5. Ana kiriş ψhA / ψhK / γc (madde 22)

describe("ana kiriş 7.2 / 7.3 katsayı kutuları (madde 22)", () => {
  it("OTOMATİK açıkken üç katsayı da girdiye yazılır", () => {
    const m = withDerivedModules(baseModules(), SPECS);
    const g = girderIn(m);
    const h = hoistIn(m);
    const live = SPECS.mainCapacityT * 1000 + h.hookBlockWeightKg + h.ropeWeightKg;
    const trolleyKg = SPECS.mainTrolleyWeightT * 1000;
    expect(g.psiHAOverride).toBe(horizontalDynamicFactor(live / trolleyKg));
    expect(g.psiHKOverride).toBe(
      horizontalDynamicFactor(live / (SPECS.bridgeWeightT * 1000 + trolleyKg))
    );
    expect(g.amplifyYcOverride).toBe(STRUCTURE_AMPLIFY_FACTOR[SPECS.structureClass]);
  });

  it("ana kaldırmanın kanca ağırlığı değişince ψhA GÜNCELLENİR (bölümler arası)", () => {
    const once = withDerivedModules(baseModules(), SPECS);
    const agir = withDerivedModules(
      patchInputs(once, "main", {
        hookBlockWeightAuto: false,
        hookBlockWeightKg: hoistIn(once).hookBlockWeightKg + 20000,
      }),
      SPECS
    );
    expect(girderIn(agir).psiHAOverride).not.toBe(girderIn(once).psiHAOverride);
  });

  it("γc çelik yapı sınıfı değişince yeniden yazılır", () => {
    const a3 = withDerivedModules(baseModules(), { ...SPECS, structureClass: "A3" });
    expect(girderIn(a3).amplifyYcOverride).toBe(STRUCTURE_AMPLIFY_FACTOR.A3);
  });

  it("anahtarlar kapalıyken elle girilen katsayılar KORUNUR", () => {
    const m = withDerivedModules(
      patchInputs(baseModules(), "girder", {
        psiHAAuto: false,
        psiHKAuto: false,
        amplifyYcAuto: false,
        psiHAOverride: 1.11,
        psiHKOverride: 1.22,
        amplifyYcOverride: 1.33,
      }),
      SPECS
    );
    const g = girderIn(m);
    expect([g.psiHAOverride, g.psiHKOverride, g.amplifyYcOverride]).toEqual([1.11, 1.22, 1.33]);
  });
});

// --------------------------------------- 6. Kararlılık: sonsuz döngü olmasın

describe("türetme kararlılığı", () => {
  it("ikinci geçiş hiçbir şeyi değiştirmez (AYNI nesne döner)", () => {
    const once = withDerivedModules(baseModules(), SPECS);
    expect(withDerivedModules(once, SPECS)).toBe(once);
  });

  it("değişmeyen bölümlerin nesne kimliği korunur", () => {
    const once = withDerivedModules(baseModules(), SPECS);
    const sonra = withDerivedModules(
      patchInputs(once, "main", { drumWallThicknessMm: 20 }),
      SPECS
    );
    expect(sonra.bridge).toBe(once.bridge);
    expect(sonra.endCarriage).toBe(once.endCarriage);
  });
});

// -------------------------------- 7. Anahtar haritalarının bölüme bağlanması

describe("otomatik anahtar haritaları editöre bağlı", () => {
  it("kaldırma girdileri HOIST_AUTO_FIELDS'ten çözülür", () => {
    for (const [field, flag] of Object.entries(HOIST_AUTO_FIELDS)) {
      expect(autoInputFlag("main", field)).toBe(flag);
      expect(autoInputFlag("mono2", field)).toBe(flag);
    }
  });

  it("kaldırma SEÇİM alanları HOIST_AUTO_SELECTION_FIELDS'ten çözülür", () => {
    for (const [field, flag] of Object.entries(HOIST_AUTO_SELECTION_FIELDS)) {
      expect(autoSelectionFlag("main", field)).toBe(flag);
    }
  });

  it("yürütme girdileri TRAVEL_AUTO_FIELDS'ten çözülür", () => {
    for (const [field, flag] of Object.entries(TRAVEL_AUTO_FIELDS)) {
      expect(autoInputFlag("trolley", field)).toBe(flag);
      expect(autoInputFlag("bridge", field)).toBe(flag);
    }
  });

  it("ANA KİRİŞ dalı vardır — GIRDER_AUTO_FIELDS ölü harita değildir", () => {
    for (const [field, flag] of Object.entries(GIRDER_AUTO_FIELDS)) {
      expect(autoInputFlag("girder", field)).toBe(flag);
    }
  });

  it("teker yükleri girdi ve seçim otomatikleri 6.2 alanlarına bağlıdır", () => {
    for (const [field, flag] of Object.entries(WHEELLOAD_AUTO_FIELDS)) {
      expect(autoInputFlag("wheelLoads", field)).toBe(flag);
    }
    for (const [field, flag] of Object.entries(WHEELLOAD_AUTO_SELECTION_FIELDS)) {
      expect(autoSelectionFlag("wheelLoads", field)).toBe(flag);
    }
  });

  it("otomatik olmayan alanda anahtar üretmez", () => {
    expect(autoInputFlag("main", "drumWallThicknessMm")).toBeUndefined();
    expect(autoSelectionFlag("bridge", "drumGrooveLengthText")).toBeUndefined();
  });
});

describe("6.2 teker yükleri otomatikleri", () => {
  it("yeni işte HD3 ve IFF varsayılanı; HC, sürünme ve boşluk otomatik gelir", () => {
    const m = withDerivedModules(baseModules(), SPECS);
    expect(wheelSel(m).hoistDriveClass).toBe("HD3");
    expect(wheelSel(m).wheelPairMode).toBe("IFF");
    expect(wheelSel(m).hoistingClass).toBe("HC2");
    expect(wheelIn(m).creepSpeedMpm).toBeCloseTo(SPECS.mainLiftSpeedMpm * 0.1, 9);
    expect(wheelIn(m).guideClearanceMm).toBe(7.5);
    expect(wheelIn(m).coupledPairCount).toBe(0);
    expect(wheelIn(m).coupledPairAuto).toBe(false);
  });

  it("kaynaklar değişince açık otomatikler yeniden türetilir", () => {
    const wheelChanged = patchSelections(baseModules(), "bridge", { wheelDiaMm: 710 });
    const m = withDerivedModules(wheelChanged, {
      ...SPECS,
      hoistMechanismClass: "M8",
      mainLiftSpeedMpm: 12,
    });
    expect(wheelSel(m).hoistingClass).toBe("HC4");
    expect(wheelIn(m).creepSpeedMpm).toBeCloseTo(1.2, 9);
    expect(wheelIn(m).guideClearanceMm).toBe(12.5);
  });

  it("otomatikler kapalıysa kullanıcı değerlerini korur", () => {
    let m = patchInputs(baseModules(), "wheelLoads", {
      hoistingClassAuto: false,
      creepSpeedAuto: false,
      guideClearanceAuto: false,
      creepSpeedMpm: 2.25,
      guideClearanceMm: 11,
    });
    m = patchSelections(m, "wheelLoads", { hoistingClass: "HC1" });
    m = withDerivedModules(m, { ...SPECS, hoistMechanismClass: "M8", mainLiftSpeedMpm: 20 });
    expect(wheelSel(m).hoistingClass).toBe("HC1");
    expect(wheelIn(m).creepSpeedMpm).toBe(2.25);
    expect(wheelIn(m).guideClearanceMm).toBe(11);
  });
});

// -------------------------------- 8. Editörün bağlantısı (kaynak metni kilidi)
//
// Bileşen testi altyapısı (RTL) yok; saf katman doğru çalışsa bile editör onu
// çağırmazsa hata geri gelir. Aşağıdaki kilitler tam olarak KOPAN bağlantıları
// hedefler — hepsi denetimin bulduğu gerçek kusurlardır.

// ------------------------- Yürütme: ivme, tahvil oranı ve varyanta özel kutu

describe("yürütme ivmesi kutusu", () => {
  it("OTOMATİK açıkken mekanizma sınıfının ivmesini GİRDİYE yazar", () => {
    const m = withDerivedModules(baseModules(), SPECS);
    // Şablonun köprü mekanizma sınıfı M6 → 0,15 m/s².
    expect(travelIn(m, "bridge").accelerationMs2).toBe(0.15);
    expect(travelIn(m, "trolley").accelerationMs2).toBe(0.15);
  });

  it("mekanizma sınıfı değişince ivme YENİDEN türetilir", () => {
    const m = withDerivedModules(baseModules(), { ...SPECS, bridgeMechanismClass: "M8" });
    expect(travelIn(m, "bridge").accelerationMs2).toBe(0.25);
    // Arabanın kendi sınıfı değişmedi — ivmesi de değişmez.
    expect(travelIn(m, "trolley").accelerationMs2).toBe(0.15);
  });

  it("OTOMATİK kapalıyken elle girilen ivme KORUNUR", () => {
    const m = withDerivedModules(
      patchInputs(baseModules(), "bridge", { accelerationAuto: false, accelerationMs2: 0.44 }),
      SPECS
    );
    expect(travelIn(m, "bridge").accelerationMs2).toBe(0.44);
  });
});

describe("yürütme tahvil oranı kutusu", () => {
  it("anahtarı GİRDİLERDE, değeri SEÇİMLERDE durur", () => {
    expect(TRAVEL_AUTO_SELECTION_FIELDS.gearboxRatio).toBe("gearboxRatioAuto");
    expect(autoSelectionFlag("bridge", "gearboxRatio")).toBe("gearboxRatioAuto");
    expect(autoSelectionFlag("trolley", "gearboxRatio")).toBe("gearboxRatioAuto");
  });

  it("OTOMATİK açıkken oranı gereken orana eşitler → gerçek hız = anma hızı", () => {
    const m = withDerivedModules(baseModules(), SPECS);
    const sel = travelSel(m, "bridge");
    const v = (sel.motorRpm / sel.gearboxRatio) * Math.PI * (sel.wheelDiaMm / 1000);
    expect(v).toBeCloseTo(SPECS.bridgeSpeedMpm, 3);
  });

  it("TEKER ÇAPI DEĞİŞİNCE oran yeniden eşitlenir", () => {
    const m = withDerivedModules(
      patchSelections(baseModules(), "bridge", { wheelDiaMm: 500 }),
      SPECS
    );
    const sel = travelSel(m, "bridge");
    const v = (sel.motorRpm / sel.gearboxRatio) * Math.PI * 0.5;
    expect(v).toBeCloseTo(SPECS.bridgeSpeedMpm, 3);
  });

  it("OTOMATİK kapalıyken katalogdan seçilen oran KORUNUR", () => {
    const m = withDerivedModules(
      patchSelections(
        patchInputs(baseModules(), "bridge", { gearboxRatioAuto: false }),
        "bridge",
        { gearboxRatio: 24 }
      ),
      SPECS
    );
    expect(travelSel(m, "bridge").gearboxRatio).toBe(24);
  });

  it("oran otomatikken 5.5 bölümü UYGUN DEĞİLDİR, kapanınca kontrol geçer", () => {
    const kontrol = (auto: boolean) => {
      const st = NEW_WORK_TEMPLATE.bridge!;
      const res = computeTravelGroup(
        SPECS,
        "bridge",
        { ...(st.inputs as TravelInputs), gearboxRatioAuto: auto },
        st.selections as TravelSelections,
        { hookEquipmentT: 1, trolleyWeightT: 2.5 }
      );
      return res.checks.find((c) => c.id === "bridge.gearbox.selected")!;
    };
    expect(kontrol(true).pass).toBe(false);
    expect(kontrol(false).pass).toBe(true);
  });
});

describe("teker çapı değişince oran otomatiği yeniden kurulur", () => {
  const sel = { wheelDiaMm: 315 } as object;

  it("çap değişti + anahtar kapalıysa anahtar AÇILIR", () => {
    const out = reArmGearboxRatioAuto(
      "bridge", sel, { wheelDiaMm: 400 }, { gearboxRatioAuto: false }
    );
    expect((out as { gearboxRatioAuto?: boolean } | null)?.gearboxRatioAuto).toBe(true);
  });

  it("çap aynıysa dokunmaz", () => {
    expect(reArmGearboxRatioAuto("bridge", sel, { wheelDiaMm: 315 }, {})).toBeNull();
  });

  it("anahtar zaten açıksa gereksiz yazma yapmaz", () => {
    expect(
      reArmGearboxRatioAuto("bridge", sel, { wheelDiaMm: 400 }, { gearboxRatioAuto: true })
    ).toBeNull();
  });

  it("yürütme dışındaki bölümlerde kural işlemez", () => {
    expect(
      reArmGearboxRatioAuto("main", sel, { wheelDiaMm: 400 }, { gearboxRatioAuto: false })
    ).toBeNull();
  });
});

describe("ray ailesi değişince ölçü de aileye geçer", () => {
  const sync = (prior: object, next: object) =>
    syncRailCodeToFamily("trolley", prior, next) as { railCode?: string } | null;

  it("çubuk raydan A tipine geçişte EN YAKIN baş genişliğine düşer", () => {
    const out = sync(
      { railFamily: "bar", railCode: "50x50" },
      { railFamily: "a", railCode: "50x50" }
    );
    // 50 mm başa en yakın A serisi rayı: A55 (anma başı 55 mm).
    expect(out?.railCode).toBe("A55");
  });

  it("A tipinden S tipine geçişte de aileye uyar", () => {
    const out = sync(
      { railFamily: "a", railCode: "A65" },
      { railFamily: "s", railCode: "A65" }
    );
    expect(out?.railCode).toBe("S39"); // A65'in anma başı 65 mm → S39 (66 mm)
  });

  it("aile değişmediyse ölçüye dokunmaz", () => {
    expect(sync({ railFamily: "a", railCode: "A65" }, { railFamily: "a", railCode: "A45" }))
      .toBeNull();
  });

  it("kod zaten yeni ailedeyse dokunmaz", () => {
    expect(sync({ railFamily: "bar", railCode: "50x50" }, { railFamily: "a", railCode: "A75" }))
      .toBeNull();
  });

  it("yürütme dışındaki bölümlerde kural işlemez", () => {
    expect(syncRailCodeToFamily("main", { railFamily: "bar" }, { railFamily: "a" })).toBeNull();
  });
});

describe("yalnız köprüde sorulan girdiler", () => {
  const kutular = (key: ModuleKey, sectionRawId: string) =>
    MODULE_ADAPTERS.find((a) => a.key === key)!
      .sections.find((s) => s.rawId === sectionRawId)!
      .inputDefs.map((d) => d.key);

  it("minimum araba yanaşması KÖPRÜDE sorulur, arabalarda sorulmaz", () => {
    expect(kutular("bridge", "5.1")).toContain("minApproachM");
    for (const key of ["trolley", "auxTrolley", "mono1Trolley", "mono2Trolley"] as const) {
      expect(kutular(key, "5.1"), key).not.toContain("minApproachM");
    }
  });

  it("arabada kutu düşse de diğer girdiler yerinde kalır", () => {
    expect(kutular("trolley", "5.1")).toEqual(["wheelCount", "driveCount", "wheelsPerMotor"]);
  });

  it("yürütme freni bölümü bütün araba ve köprü varyantlarında bulunur", () => {
    for (const key of ["trolley", "auxTrolley", "mono1Trolley", "mono2Trolley", "bridge"] as const) {
      const section = MODULE_ADAPTERS.find((a) => a.key === key)!
        .sections.find((s) => s.rawId === "5.5b");
      expect(section?.inputDefs.map((d) => d.key), key).toContain("brakeServiceFactor");
      expect(section?.selectionDefs.map((d) => d.key), key).toContain("brakeTorqueNm");
    }
  });

  it("teker sertliği çapın yanında açılır ve Yok seçimi yalnız rapor satırını gizler", () => {
    const section = MODULE_ADAPTERS.find((a) => a.key === "trolley")!
      .sections.find((s) => s.rawId === "5.1")!;
    const keys = section.selectionDefs.map((d) => d.key);
    expect(keys.indexOf("wheelHardness")).toBe(keys.indexOf("wheelDiaMm") + 1);
    const hardness = section.selectionDefs.find((d) => d.key === "wheelHardness")!;
    expect(hardness.options).toEqual([
      "Yok", "32-35 HRC", "35-40 HRC", "40-45 HRC", "45-50 HRC", "50-55 HRC",
    ]);
    expect(hardness.reportVisibleWhen?.({ wheelHardness: "Yok" })).toBe(false);
    expect(hardness.reportVisibleWhen?.({ wheelHardness: "32-35 HRC" })).toBe(true);
    expect(NEW_WORK_TEMPLATE.trolley!.selections.wheelHardness).toBe("32-35 HRC");
  });
});

describe("elektrik odası pano yerleşimi sunumu", () => {
  const section = MODULE_ADAPTERS.find((a) => a.key === "cabin")!
    .sections.find((s) => s.rawId === "11.2")!;

  it("pano adedi, ortak ölçüler ve kapı ölçülerini aynı bölümde sorar", () => {
    expect(section.inputDefs.map((field) => field.key)).toEqual(expect.arrayContaining([
      "roomDoorWidthMm", "roomDoorHeightMm", "panelCount",
      "roomPanelHeightMm", "roomPanelDepthMm",
    ]));
    expect(section.editor).toBe("roomPanels");
  });

  it("ortak pano yüksekliği ve derinliği yalnız standart dropdown seçeneklerini taşır", () => {
    expect(section.inputDefs.find((field) => field.key === "roomPanelHeightMm")?.options)
      .toEqual(["1400", "1600", "1800", "2000"]);
    expect(section.inputDefs.find((field) => field.key === "roomPanelDepthMm")?.options)
      .toEqual(["400", "600", "700"]);
  });

  it("cihaz atık ısısı döküm tablosunu hesap raporuyla paylaşır", () => {
    expect(section.table?.title).toContain("Cihaz Atık Isısı");
    expect(section.table?.headers).toContain("Seçilen Sürücü Sınıfı");
  });
});

const EDITOR_SRC = readFileSync(
  fileURLToPath(new URL("../revision-editor.tsx", import.meta.url)),
  "utf8"
);

describe("revision-editor.tsx bağlantı kilidi", () => {
  it("saf türetme katmanını içe aktarır", () => {
    for (const name of [
      "withDerivedModules",
      "autoInputFlag",
      "autoSelectionFlag",
      "derivationWarnings",
      // Teker çapı değişince tahvil oranı yeniden otomatiğe döner.
      "reArmGearboxRatioAuto",
      // Ray ailesi değişince ölçü kutusu da o aileye geçer.
      "syncRailCodeToFamily",
    ]) {
      expect(EDITOR_SRC).toContain(name);
    }
  });

  it("kendi kopya türetmesini TAŞIMAZ (tek kaynak module-adapters)", () => {
    expect(EDITOR_SRC).not.toMatch(/function\s+withDerivedHoist\s*\(/);
    expect(EDITOR_SRC).not.toMatch(/function\s+withDerivedTravel\s*\(/);
    expect(EDITOR_SRC).not.toMatch(/function\s+withDerived\s*\(/);
  });

  it("SEÇİM ızgarasına da `auto` prop'unu bağlar (yiv boyu)", () => {
    expect(EDITOR_SRC).toContain("autoSelectionStateFor");
    // section.selectionDefs render'ının içinde auto prop'u geçmeli
    const block = EDITOR_SRC.slice(EDITOR_SRC.indexOf("section.selectionDefs.map("));
    expect(block.slice(0, 600)).toContain("auto={autoSelectionStateFor(");
  });

  it("kart rozeti DİNAMİK bölüm numarasını basar (kenar çubuğuyla aynı)", () => {
    // Eskiden sabit `{adapter.title}` basılıyordu: kenar çubuğu "04 · ANA ARABA
    // YÜRÜTME" derken rozet "05 · Ana Araba Yürütme" diyordu.
    // Başlık artık `adapterTitle(adapter, specs)` ile çözülür: dört kirişli
    // köprüde ana kiriş "Ana Kiriş - 1" olur. Numara yine tek kaynaktan gelir.
    expect(EDITOR_SRC).toContain("renumberTitle(adapterTitle(adapter, specs), numbers[key] ?? 0)");
    expect(EDITOR_SRC).not.toMatch(/>\s*\{adapter\.title\}\s*</);
  });
});
