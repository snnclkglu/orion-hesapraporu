// VİNÇ ARABASI RAPORU — yalnız arabanın yenilendiği iş (kullanıcı kararı,
// 19.08.2026).
//
// Müşteri bazen yeni vinç istemez; mevcut vincin yalnız arabası değişir. O
// raporda köprü yürütme, teker yükleri, ana kirişler, buruşma ve başkiriş
// bölümleri YOKTUR. Bu dosya o senaryonun DAVRANIŞINI kilitler:
//   1. Köprü kapatılabilir (`REQUIRED_MODULE_KEYS` yalnız ana kaldırma + ana araba).
//   2. Köprü kapanınca hesabı köprüsüz koşamayan bölümler (`MODULE_PARENT`)
//      KENDİLİĞİNDEN düşer; koşabilenler (başkiriş, buruşma) düşmez.
//   3. Kalan hesap NaN üretmez.
//   4. **Girdisi olan her bölümün SONUCU da vardır.** Bu bir sunum kuralı
//      değil bir değişmezdir: PDF raporu bölüm numaralarını "bu bölüm
//      basılıyor mu" yüklemine göre dizer; girdisi olup sonucu olmayan bir
//      bölüm numarayı harcar, içindekilerde satır açar ama sayfası basılmaz —
//      müşteri belgede atlanmış numara ve boşa giden bir dizin satırı görür.
//   5. Kapatma kararı KAYITTAN GERİ OKUNUR (`disabledModules` yuvarlak yolu).

import { describe, expect, it } from "vitest";
import { activeModules, runCalc, type CalcInput, type CalcResult } from "../engine";
import { NEW_WORK_DISABLED_MODULES, NEW_WORK_TEMPLATE } from "../defaults";
import { CALC_FIELD, loadRevision } from "@/lib/revision-load";
import {
  DISABLEABLE_MODULE_KEYS,
  MODULE_ORDER,
  REQUIRED_MODULE_KEYS,
  type ModuleKey,
} from "../presentation/module-family";
import { TROLLEY_ONLY_DISABLED_MODULES } from "@/lib/crane-types";

const BASE = NEW_WORK_TEMPLATE.specs;
const OFF = [...NEW_WORK_DISABLED_MODULES];
/** Araba-only iş: yeni işin kapalı listesi + köprü tarafının tamamı. */
const TROLLEY_ONLY = [...new Set([...OFF, ...TROLLEY_ONLY_DISABLED_MODULES])];

/** Bölüm anahtarı → `CalcInput`/`CalcResult` alanı var mı. */
function has(bundle: CalcInput | CalcResult, key: ModuleKey): boolean {
  return (bundle as unknown as Record<string, unknown>)[CALC_FIELD[key]] !== undefined;
}

/** Verilen kapalı listeyle hesaba giren girdi setini kurar. */
function calcFor(disabled: readonly string[]): CalcInput {
  const src = NEW_WORK_TEMPLATE as unknown as Record<string, unknown>;
  const active = activeModules(BASE, disabled);
  const out: Record<string, unknown> = { specs: BASE };
  for (const key of MODULE_ORDER) {
    if (!active.has(key)) continue;
    out[CALC_FIELD[key]] = src[CALC_FIELD[key]];
  }
  return out as unknown as CalcInput;
}

describe("kapatılabilirlik", () => {
  it("yalnız ana kaldırma ve ana araba kapatılamaz", () => {
    expect([...REQUIRED_MODULE_KEYS]).toEqual(["main", "trolley"]);
    // Köprü artık kapatılabilir; liste MODULE_ORDER'dan TÜRETİLİR, elle yazılmaz.
    expect(DISABLEABLE_MODULE_KEYS).toContain("bridge");
    expect(DISABLEABLE_MODULE_KEYS).toContain("wheelLoads");
    expect(DISABLEABLE_MODULE_KEYS).toContain("cabin");
    expect(DISABLEABLE_MODULE_KEYS.length).toBe(MODULE_ORDER.length - 2);
  });

  it("bozuk bir kayıt ana kaldırmayı/ana arabayı kapatamaz", () => {
    const active = activeModules(BASE, ["main", "trolley"]);
    expect(active.has("main")).toBe(true);
    expect(active.has("trolley")).toBe(true);
  });
});

describe("köprü kapanınca üst bölüm bağı", () => {
  const active = activeModules(BASE, [...OFF, "bridge"]);

  it("hesabı köprüsüz koşamayan bölümler KENDİLİĞİNDEN düşer", () => {
    // `girderDepsFor` köprü sonucu olmadan `undefined` döner; teker yükleri
    // hiç hesaplanmaz. Açık bırakılsalardı rapora sonucu olmayan iki bölüm
    // basılırdı.
    expect(active.has("girder")).toBe(false);
    expect(active.has("girder2")).toBe(false);
    expect(active.has("wheelLoads")).toBe(false);
  });

  it("köprüsüz de koşabilen bölümler BİLEREK düşmez", () => {
    // Başkiriş yalnız ana kaldırma yükünü ve köprü ağırlığını okur; buruşma
    // ana kiriş kapalıyken elle girilen panel ölçüleriyle koşar. İkisini de
    // köprüye bağlamak, çalışan bir hesabı kullanıcının elinden almak olurdu.
    const tamam = activeModules(BASE, ["bridge"]);
    expect(tamam.has("endCarriage")).toBe(true);
    expect(tamam.has("buckling")).toBe(true);
  });
});

describe("araba-only hesap", () => {
  const input = calcFor(TROLLEY_ONLY);
  const result = runCalc(input);

  it("yalnız kaldırma, kanca bloğu ve ana araba hesaba girer", () => {
    expect([...activeModules(BASE, TROLLEY_ONLY)].sort()).toEqual(
      ["hookBlock", "main", "trolley"]
    );
  });

  it("köprü tarafının hiçbir bölümü sonuç üretmez", () => {
    for (const key of TROLLEY_ONLY_DISABLED_MODULES) {
      expect(has(result, key as ModuleKey), key).toBe(false);
    }
  });

  it("kalan hesap NaN üretmez", () => {
    expect(result.allChecks.length).toBeGreaterThan(0);
    for (const c of result.allChecks) {
      expect(Number.isFinite(c.provided), `${c.id} provided`).toBe(true);
    }
  });

  it("kontrollerin hiçbiri köprü tarafından gelmez", () => {
    for (const c of result.allChecks) {
      for (const key of TROLLEY_ONLY_DISABLED_MODULES) {
        expect(c.id.startsWith(`${key}.`), c.id).toBe(false);
      }
    }
  });
});

describe("DEĞİŞMEZ — girdisi olan bölümün sonucu da vardır", () => {
  // Tek tek her bölümü kapatarak tarar: hangi kombinasyonda olursa olsun
  // `CalcInput`te duran bir bölüm `CalcResult`ta da durmalıdır. Yeni bir
  // bağımlılık `MODULE_PARENT`a yazılmadan eklenirse bu test kırılır ve
  // "numarayı harcayan ama basılmayan bölüm" tuzağı üretime kaçamaz.
  const senaryolar: readonly (readonly string[])[] = [
    OFF,
    TROLLEY_ONLY,
    ...DISABLEABLE_MODULE_KEYS.map((k) => [...OFF, k]),
  ];

  for (const disabled of senaryolar) {
    const ad = disabled === OFF ? "varsayılan" : [...disabled].sort().join("+");
    it(`kapalı: ${ad}`, () => {
      const input = calcFor(disabled);
      const result = runCalc(input);
      for (const key of MODULE_ORDER) {
        if (!has(input, key)) continue;
        expect(has(result, key), `${key} girdisi var ama sonucu yok`).toBe(true);
      }
    });
  }
});

describe("kayıt → yükleme dönüşü (köprü tarafı)", () => {
  /** Bütün bölüm alanlarını yazan, bugünün kayıt biçimindeki bir snapshot. */
  function snapshot(disabledModules: readonly string[]) {
    const src = NEW_WORK_TEMPLATE as unknown as Record<
      string,
      { inputs?: object; selections?: object }
    >;
    const inputs: Record<string, unknown> = { specs: BASE, disabledModules: [...disabledModules] };
    const selections: Record<string, unknown> = {};
    for (const k of MODULE_ORDER) {
      inputs[CALC_FIELD[k]] = src[CALC_FIELD[k]]?.inputs ?? null;
      selections[CALC_FIELD[k]] = src[CALC_FIELD[k]]?.selections ?? null;
    }
    return { inputs, selections };
  }

  it("araba-only kararı aynen geri gelir, girdiler KORUNUR", () => {
    const { inputs, selections } = snapshot(TROLLEY_ONLY);
    const geri = loadRevision(inputs as never, selections as never);
    expect([...geri.disabled].sort()).toEqual([...TROLLEY_ONLY].sort());
    expect(geri.input.bridge).toBeUndefined();
    expect(geri.input.wheelLoads).toBeUndefined();
    // Kapatılan bölümün girdileri kaybolmaz: kutucuk geri açılınca döner.
    expect(geri.full.bridge).toBeDefined();
    expect(geri.full.wheelLoads).toBeDefined();
  });

  it("teker yükleri ve kabin kararı da KALICIDIR", () => {
    // İki liste ayrıştığı sürece bu kutucuklar ekranda kapanıp kayıtta geri
    // açılıyordu; bölüm şablon değerleriyle rapora giriyordu.
    const { inputs, selections } = snapshot(["wheelLoads", "cabin"]);
    const geri = loadRevision(inputs as never, selections as never);
    expect(geri.disabled).toContain("wheelLoads");
    expect(geri.disabled).toContain("cabin");
    expect(geri.input.wheelLoads).toBeUndefined();
  });

  it("ESKİ kayıtta köprü alanı yoksa köprü AÇIK kalır", () => {
    // "Alan yok → kapalı" kuralı DONDURULMUŞ listeye bağlıdır. Köprü oraya
    // eklenseydi, köprü alanını taşımayan her eski revizyonda bölüm sessizce
    // kapanır ve yayınlanmış bir raporun bölüm numaraları kayardı.
    const geri = loadRevision(
      {
        specs: BASE,
        mainHoist: NEW_WORK_TEMPLATE.mainHoist!.inputs,
        hookBlock: NEW_WORK_TEMPLATE.hookBlock!.inputs,
        trolley: NEW_WORK_TEMPLATE.trolley!.inputs,
        girder: NEW_WORK_TEMPLATE.girder!.inputs,
      } as never,
      {} as never
    );
    expect(geri.disabled).not.toContain("bridge");
    expect(geri.input.bridge).toBeDefined();
  });

  it("tohumlanmış YENİ revizyon yalnız tohumdaki bölümleri kapatır", () => {
    // `createRevision` vinç tipi "Vinç Arabası" iken V0'a yalnız
    // `{ disabledModules: [...] }` yazar; hiçbir modül alanı yoktur. Ölçüt
    // "nesne boş mu" olsaydı bu snapshot'ta bütün bölümler kapalı sayılırdı.
    const geri = loadRevision(
      { disabledModules: [...TROLLEY_ONLY_DISABLED_MODULES] } as never,
      {} as never
    );
    expect(geri.input.mainHoist).toBeDefined();
    expect(geri.input.hookBlock).toBeDefined();
    expect(geri.input.trolley).toBeDefined();
    expect(geri.input.bridge).toBeUndefined();
    expect(geri.input.girder).toBeUndefined();
    // Yeni iş şablonunun kendi kapalı listesi de geçerlidir.
    expect(geri.disabled).toContain("aux");
  });
});
