// Vinç topolojisi — uçtan uca davranış koruması.
//
// Bu dosya bir denetim turunda bulunan GERÇEK kusurları kilitler: her testin
// başlığı hangi davranışı koruduğunu söyler. Sayılar değil DAVRANIŞ test edilir
// (hangi bölüm hesaba giriyor, hangi veri nereden besleniyor, eski bir kayıt
// açıldığında mühendisin girdiği değer korunuyor mu).

import { describe, expect, it } from "vitest";
import { activeModules, bridgeTrolleyWeightT, runCalc } from "../engine";
import { NEW_WORK_DISABLED_MODULES, NEW_WORK_TEMPLATE } from "../defaults";
import { CALC_FIELD, loadRevision } from "@/lib/revision-load";
import { MODULE_ORDER } from "../presentation/module-family";
import type { TechnicalSpecs } from "../types";

const BASE = NEW_WORK_TEMPLATE.specs;
const OFF = [...NEW_WORK_DISABLED_MODULES];
/** Yardımcı kaldırma açıkken kalan kapalı liste. */
const OFF_AUX_ON = OFF.filter((k) => k !== "aux");

describe("varsayılan yeni iş", () => {
  it("yalnız ana kaldırma, kanca bloğu, arabalar, köprü, teker yükleri ve ana kirişi hesaplar", () => {
    expect([...activeModules(BASE, OFF)].sort()).toEqual(
      ["bridge", "girder", "hookBlock", "main", "trolley", "wheelLoads"]
    );
  });
});

describe("vinç konfigürasyonu bölümleri AÇAR", () => {
  it("ayrı yardımcı araba seçilince yardımcı araba bölümü açılır", () => {
    const kapali = activeModules({ ...BASE, auxTrolleyMode: "shared" }, OFF_AUX_ON);
    const acik = activeModules({ ...BASE, auxTrolleyMode: "separate" }, OFF_AUX_ON);
    expect(kapali.has("auxTrolley")).toBe(false);
    expect(acik.has("auxTrolley")).toBe(true);
  });

  it("monoray adedi her grubun üç bölümünü birden açar", () => {
    const bir = activeModules({ ...BASE, monorailCount: 1 }, OFF_AUX_ON);
    expect(bir.has("mono1")).toBe(true);
    expect(bir.has("mono1HookBlock")).toBe(true);
    expect(bir.has("mono1Trolley")).toBe(true);
    expect(bir.has("mono2")).toBe(false);

    const iki = activeModules({ ...BASE, monorailCount: 2 }, OFF_AUX_ON);
    expect(iki.has("mono2Trolley")).toBe(true);
  });

  it("üst bölüm kapalıysa alt bölüm de açılmaz", () => {
    // Yardımcı kaldırma kapalı → yardımcı kanca bloğu ve arabası olamaz.
    const a = activeModules({ ...BASE, auxTrolleyMode: "separate" }, OFF);
    expect(a.has("auxHookBlock")).toBe(false);
    expect(a.has("auxTrolley")).toBe(false);
  });
});

describe("her kaldırma grubu KENDİ verisiyle hesaplanır", () => {
  const specs: TechnicalSpecs = {
    ...BASE,
    auxTrolleyMode: "separate",
    auxCapacityT: 3,
    auxTrolleyWeightT: 1.2,
    monorailCount: 2,
    mono1CapacityT: 2,
    mono1TrolleyWeightT: 0.8,
    mono2CapacityT: 5,
    mono2TrolleyWeightT: 0.9,
  };
  const result = runCalc({ ...NEW_WORK_TEMPLATE, specs });
  const yuk = (c?: { cells: Record<string, number | string> }) => c?.cells["load.hoisted"];

  it("kapasiteler karışmaz", () => {
    expect(yuk(result.mainHoist)).toBe(10_000);
    expect(yuk(result.auxHoist)).toBe(3_000);
    expect(yuk(result.mono1Hoist)).toBe(2_000);
    expect(yuk(result.mono2Hoist)).toBe(5_000);
  });

  it("kanca bloğu bağlı olduğu kaldırma grubunun yükünü görür", () => {
    /** Kanca kapasitesi kontrolünün istenen (talep) değeri. */
    const talep = (id: string): number | undefined => {
      const c = result.allChecks.find((x) => x.id === id);
      return c && c.op !== "range" ? c.required : undefined;
    };
    expect(talep("hookBlock.hook.capacity")).toBe(10_000);
    expect(talep("mono1HookBlock.hook.capacity")).toBe(2_000);
    expect(talep("mono2HookBlock.hook.capacity")).toBe(5_000);
  });

  it("araba ağırlıkları teknik özelliklerden ayrı ayrı okunur", () => {
    const agirlik = (c?: { cells: Record<string, number | string> }) => c?.cells["weight.trolley"];
    expect(agirlik(result.trolley)).toBe(specs.mainTrolleyWeightT);
    expect(agirlik(result.auxTrolley)).toBe(1.2);
    expect(agirlik(result.mono1Trolley)).toBe(0.8);
  });

  it("kontrol kimlikleri benzersizdir (bölümler birbirini ezmez)", () => {
    const idler = result.allChecks.map((c) => c.id);
    expect(new Set(idler).size).toBe(idler.length);
  });

  it("köprü ÜZERİNDEKİ TÜM arabaların ağırlığını taşır", () => {
    // Ana + yardımcı + iki monoray arabası; hepsi köprünün yüküdür.
    const toplam = 2.5 + 1.2 + 0.8 + 0.9;
    expect(
      bridgeTrolleyWeightT(specs, new Set(["trolley", "auxTrolley", "mono1Trolley", "mono2Trolley"]))
    ).toBeCloseTo(toplam, 10);
    expect(result.bridge!.values.craneWeightT).toBeCloseTo(specs.bridgeWeightT + toplam, 10);
  });
});

describe("kayıt → yükleme dönüşü", () => {
  const specs: TechnicalSpecs = { ...BASE, monorailCount: 2, mono1CapacityT: 2 };
  const src = { ...NEW_WORK_TEMPLATE, specs } as unknown as Record<
    string,
    { inputs?: object; selections?: object }
  >;
  const kapali = ["auxHookBlock", "mono2", "mono2HookBlock", "mono2Trolley", "buckling"];
  const inputs: Record<string, unknown> = { specs, disabledModules: kapali };
  const selections: Record<string, unknown> = {};
  for (const k of MODULE_ORDER) {
    inputs[CALC_FIELD[k]] = src[CALC_FIELD[k]]?.inputs ?? null;
    selections[CALC_FIELD[k]] = src[CALC_FIELD[k]]?.selections ?? null;
  }
  const geri = loadRevision(inputs as never, selections as never);

  it("kapalı bölüm listesi aynen geri gelir", () => {
    expect([...geri.disabled].sort()).toEqual([...kapali].sort());
  });

  it("kapalı bölüm hesaba girmez ama girdileri KORUNUR", () => {
    expect(geri.input.mono2Hoist).toBeUndefined();
    expect(geri.full.mono2Hoist).toBeDefined();
  });

  it("açık bölüm hesaba girer", () => {
    expect(geri.input.mono1HookBlock).toBeDefined();
  });
});

describe("eski şema göçü", () => {
  /** Ağırlıkları yürütme girdisinde, otomatik anahtarları hiç taşımayan kayıt. */
  function eskiKayit(patch: Record<string, unknown> = {}) {
    const eskiSpecs = { ...BASE } as Record<string, unknown>;
    delete eskiSpecs.mainTrolleyWeightT;
    delete eskiSpecs.bridgeWeightT;
    const eskiHoist = { ...NEW_WORK_TEMPLATE.mainHoist!.inputs } as Record<string, unknown>;
    delete eskiHoist.ropeWeightAuto;
    delete eskiHoist.hookBlockWeightAuto;
    delete eskiHoist.tempFactorAuto;
    Object.assign(eskiHoist, { hookBlockWeightKg: 3250, ropeWeightKg: 250, tempFactor: 1.1 });
    return loadRevision(
      {
        specs: eskiSpecs as never,
        mainHoist: eskiHoist as never,
        trolley: { ...NEW_WORK_TEMPLATE.trolley!.inputs, trolleyWeightT: 2.5 } as never,
        bridge: {
          ...NEW_WORK_TEMPLATE.bridge!.inputs,
          bridgeWeightT: 15,
          otherWeightsT: 2,
        } as never,
        girder: NEW_WORK_TEMPLATE.girder!.inputs,
        auxHoist: null,
        buckling: null,
        ...patch,
      } as never,
      { mainHoist: NEW_WORK_TEMPLATE.mainHoist!.selections } as never
    );
  }

  it("ağırlıklar yürütme girdisinden teknik özelliklere taşınır", () => {
    const r = eskiKayit();
    expect(r.input.specs.mainTrolleyWeightT).toBe(2.5);
    // Eski model köprü ağırlığını ikiye ayırıyordu; yeni model tek toplam tutar.
    expect(r.input.specs.bridgeWeightT).toBe(17);
  });

  it("mühendisin ELLE girdiği değerler otomatik türetmeyle EZİLMEZ", () => {
    // Otomatik anahtarlar şablonda AÇIK; kayıtta hiç yoksa miras alınmamalıdır,
    // yoksa 3250 kg'lık kepçe sessizce kapasitenin %10'una düşer.
    const mh = eskiKayit().full.mainHoist!.inputs;
    expect(mh.hookBlockWeightKg).toBe(3250);
    expect(mh.tempFactor).toBe(1.1);
    expect(mh.hookBlockWeightAuto).not.toBe(true);
    expect(mh.tempFactorAuto).not.toBe(true);
  });

  it("kayıtta hiç geçmeyen yeni bölümler kendiliğinden AÇILMAZ", () => {
    const r = eskiKayit();
    expect(r.input.auxHookBlock).toBeUndefined();
    expect(r.input.mono1Hoist).toBeUndefined();
    expect(r.input.mono1Trolley).toBeUndefined();
  });

  it("eski kayıt hesaplanabilir (şema evrimi NaN üretmez)", () => {
    const r = runCalc(eskiKayit().input);
    expect(Number.isFinite(r.girder!.values.deflectionMm)).toBe(true);
    for (const c of r.allChecks) {
      expect(Number.isFinite(c.provided), `${c.id} provided`).toBe(true);
    }
  });

  it("açık listedeki bölüm kapalı, listede olmayan mevcut bölüm açık kalır", () => {
    const r = loadRevision(
      {
        specs: BASE,
        disabledModules: ["buckling", "endCarriage"],
        mainHoist: NEW_WORK_TEMPLATE.mainHoist!.inputs,
        auxHoist: NEW_WORK_TEMPLATE.auxHoist!.inputs,
        hookBlock: NEW_WORK_TEMPLATE.hookBlock!.inputs,
        trolley: NEW_WORK_TEMPLATE.trolley!.inputs,
        bridge: NEW_WORK_TEMPLATE.bridge!.inputs,
        girder: NEW_WORK_TEMPLATE.girder!.inputs,
      } as never,
      {} as never
    );
    expect(r.input.auxHoist).toBeDefined();
    expect(r.input.buckling).toBeUndefined();
    expect(r.input.auxHookBlock).toBeUndefined();
  });
});
