// AĞIRLIK DÖKÜMÜ — KAPSAM VE SINIR KORUMASI.
//
// İKİ YÖNLÜ KAPSAM (`hidden-sections-equipment.test.ts` deseni):
//   ileri  — ekipman listesinin ürettiği HER slug'ın defterde bir grubu var mı;
//   geri   — defterdeki HER slug gerçekten üretiliyor mu.
// Tek yön yetmez: yalnız ileri bakılsaydı defter ölü satırlarla şişer, yalnız
// geri bakılsaydı yeni eklenen bir ekipman satırı dökümden SESSİZCE düşerdi —
// ve eksik bir kilo, ekranda hiç fark edilmeyen türden bir eksikliktir.
//
// SINIR: döküm bir HESAP DEĞİLDİR (HESAP-35). `lib/calc` bu çekirdeği hiç
// tanımaz ve `lib/weights` maliyet MODELİNİ hiç okumaz; paylaşılabilecek şey
// bir DEFTERDİR, bir model değil (MALIYET-3).

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { activeModules, type CalcInput } from "@/lib/calc/engine";
import { NEW_WORK_DISABLED_MODULES, NEW_WORK_TEMPLATE } from "@/lib/calc/defaults";
import { CALC_FIELD } from "@/lib/revision-load";
import { MODULE_ORDER, type ModuleKey } from "@/lib/calc/presentation/module-family";
import { buildEquipmentGroups, rowSlug } from "@/lib/equipment-list";
import type { TechnicalSpecs } from "@/lib/calc/types";
import { SLUG_GRUP_DEFTERI, bandinGruplari, kalemBandi, kalemGrubu } from "../defter";

const BASE = NEW_WORK_TEMPLATE.specs;

function calcFor(specs: TechnicalSpecs, disabled: readonly string[]): CalcInput {
  const src = NEW_WORK_TEMPLATE as unknown as Record<string, unknown>;
  const active = activeModules(specs, disabled);
  const out: Record<string, unknown> = { specs };
  for (const key of MODULE_ORDER) {
    if (!active.has(key)) continue;
    out[CALC_FIELD[key]] = src[CALC_FIELD[key]];
  }
  return out as unknown as CalcInput;
}

/**
 * KAPSAM FİKSTÜRLERİ — tek bir vinç bütün satırları üretmez.
 *
 * Sol helis halat yalnız denge TRAVERSLİ düzende, denge MAKARASI yalnız öteki
 * düzende, kaldırma kirişi yalnız çift tamburun kiriş seçeneğinde doğar. Tek
 * fikstürle koşan bir kapsam testi, defterin yarısını "ölü" ilan ederdi.
 */
const FIKSTURLER: {
  ad: string;
  specs: TechnicalSpecs;
  acik: string[];
  /** Modül GİRDİLERİNİ yamalar (teknik özellikten sürülemeyen düzenler). */
  yama?: (input: CalcInput) => CalcInput;
}[] = [
  {
    ad: "tam donanımlı çift kirişli",
    specs: {
      ...BASE,
      auxTrolleyMode: "separate",
      auxTrolleyWeightT: 1.2,
      monorailCount: 2,
      mono1TrolleyWeightT: 0.8,
      mono2TrolleyWeightT: 0.9,
      hasOperatorCabin: "yes",
      operatorCabinHasAirConditioner: "yes",
      electricalAccommodationType: "room",
      electricalRoomHasAirConditioner: "yes",
      // Feston SATIRI yalnız o eksenin beslemesi festonken doğar.
      trolleyPowerSupply: "festoon",
      bridgePowerSupply: "festoon",
      girderArrangement: "dort",
    },
    acik: [
      "aux",
      "auxHookBlock",
      "auxTrolley",
      "mono1",
      "mono1HookBlock",
      "mono1Trolley",
      "mono2",
      "mono2HookBlock",
      "mono2Trolley",
      "cabin",
      "girder2",
      "endCarriage",
    ],
  },
  {
    ad: "çift tambur · kaldırma kirişi",
    specs: {
      ...BASE,
      mainCapacityT: 64,
      mainHoistEquipmentArrangement: "doubleDrum",
      mainDoubleDrumHookSystem: "liftingBeam",
    },
    acik: ["endCarriage"],
  },
  {
    ad: "pano tipi elektrik",
    specs: {
      ...BASE,
      electricalAccommodationType: "panel",
      electricalPanelHasAirConditioner: "yes",
    },
    acik: ["cabin"],
  },
  {
    // EMNİYET FRENİ bir vinç değil KALDIRMA GRUBU özelliğidir (HESAP-5) ve
    // satırı ancak model SEÇİLMİŞSE doğar.
    ad: "tambur emniyet frenli kaldırma",
    specs: { ...BASE, hoistSafetyBrake: "Var" },
    acik: [],
    yama: (input) => ({
      ...input,
      mainHoist: {
        ...input.mainHoist!,
        selections: { ...input.mainHoist!.selections, safetyBrakeModel: "SHI 105" },
      },
    }),
  },
  {
    // DENGE MAKARALI düzen bir GİRDİdir, teknik özellik değil: yeni işler
    // traversli açılır ve makara satırı yalnız eski/seçilmiş düzende doğar.
    ad: "denge makaralı kaldırma",
    specs: BASE,
    acik: [],
    yama: (input) => ({
      ...input,
      mainHoist: {
        ...input.mainHoist!,
        inputs: {
          ...input.mainHoist!.inputs,
          ropeBalancingType: "equalizerSheave" as const,
        },
      },
    }),
  },
];

function uretilenSluglar(): Map<ModuleKey, Set<string>> {
  const cikti = new Map<ModuleKey, Set<string>>();
  for (const f of FIKSTURLER) {
    const kapali = NEW_WORK_DISABLED_MODULES.filter((k) => !f.acik.includes(k));
    const ham = calcFor(f.specs, kapali);
    const input = f.yama ? f.yama(ham) : ham;
    for (const row of buildEquipmentGroups(input).flatMap((g) => g.rows)) {
      if (!row.rowKey) continue;
      const ayrac = row.rowKey.indexOf(":");
      const modul = row.rowKey.slice(0, ayrac) as ModuleKey;
      if (!(MODULE_ORDER as readonly string[]).includes(modul)) continue;
      const slug = rowSlug(row.rowKey, modul);
      if (!slug) continue;
      if (!cikti.has(modul)) cikti.set(modul, new Set());
      cikti.get(modul)!.add(slug);
    }
  }
  return cikti;
}

describe("kapsam — ekipman satırı ↔ döküm defteri", () => {
  it("üretilen HER slug'ın bir grubu vardır (satır dökümden sessizce düşmez)", () => {
    const sahipsiz: string[] = [];
    for (const [modul, sluglar] of uretilenSluglar()) {
      // Bir modül dökümde hiç yer almıyorsa (buruşma · teker yükleri) satırı
      // da yoktur; onlar zaten ekipman satırı üretmez.
      if (kalemBandi(BASE, modul) === undefined) continue;
      for (const slug of sluglar) {
        if (kalemGrubu(modul, slug) === undefined) sahipsiz.push(`${modul}:${slug}`);
      }
    }
    expect(sahipsiz).toEqual([]);
  });

  it("defterdeki HER slug gerçekten üretilir (ölü satır kalmaz)", () => {
    const uretilen = uretilenSluglar();
    const tumSluglar = new Set<string>();
    for (const sluglar of uretilen.values()) for (const s of sluglar) tumSluglar.add(s);
    const olu: string[] = [];
    for (const defter of Object.values(SLUG_GRUP_DEFTERI)) {
      for (const slug of Object.keys(defter)) {
        if (!tumSluglar.has(slug)) olu.push(slug);
      }
    }
    expect(olu).toEqual([]);
  });

  it("her grup anahtarı kendi bandının defterinde tanımlıdır", () => {
    const tanimsiz: string[] = [];
    for (const [modul, sluglar] of uretilenSluglar()) {
      const bantKey = kalemBandi(BASE, modul);
      if (!bantKey) continue;
      const tanimlilar = new Set(bandinGruplari(bantKey).map((g) => g.key));
      for (const slug of sluglar) {
        const grup = kalemGrubu(modul, slug);
        if (grup && !tanimlilar.has(grup)) tanimsiz.push(`${bantKey}/${grup} (${modul}:${slug})`);
      }
    }
    expect(tanimsiz).toEqual([]);
  });

  it("grup anahtarları bant içinde TEKİLDİR (MALIYET-17 tuzağı)", () => {
    for (const bantKey of ["bridge", "trolley"]) {
      const anahtarlar = bandinGruplari(bantKey).map((g) => g.key);
      expect(new Set(anahtarlar).size, bantKey).toBe(anahtarlar.length);
    }
  });
});

// ————————————————————————————————————————————————————————————— sınırlar

const KOK = path.resolve(__dirname, "..", "..", "..");

function tsDosyalari(dizin: string): string[] {
  const cikti: string[] = [];
  for (const giris of fs.readdirSync(dizin, { withFileTypes: true })) {
    const tam = path.join(dizin, giris.name);
    if (giris.isDirectory()) {
      if (giris.name === "__tests__") continue;
      cikti.push(...tsDosyalari(tam));
    } else if (giris.name.endsWith(".ts") || giris.name.endsWith(".tsx")) {
      cikti.push(tam);
    }
  }
  return cikti;
}

describe("sınır — döküm bir HESAP DEĞİLDİR", () => {
  it("`lib/calc` ağırlık çekirdeğini HİÇ tanımaz", () => {
    const sizanlar = tsDosyalari(path.join(KOK, "lib", "calc")).filter((f) =>
      fs.readFileSync(f, "utf8").includes("@/lib/weights")
    );
    expect(sizanlar.map((f) => path.relative(KOK, f))).toEqual([]);
  });

  it("`lib/weights` maliyet MODELİNİ okumaz (MALIYET-3)", () => {
    // İTHAL aranır, ham metin DEĞİL: sınırın kendisi dosya başlıklarında
    // anlatılıyor ve "@/lib/offers/cost/model" dizgisi bir yasağı AÇIKLAYAN
    // yorumda da geçiyor. Metin arayan bir koruma, kuralı yazan yorumu ihlal
    // sanardı.
    const ithal = /from\s+"@\/lib\/offers\/cost\/model"/;
    const sizanlar = tsDosyalari(path.join(KOK, "lib", "weights")).filter((f) =>
      ithal.test(fs.readFileSync(f, "utf8"))
    );
    expect(sizanlar.map((f) => path.relative(KOK, f))).toEqual([]);
  });

  it("`lib/weights` firma tablolarını TEK DİKİŞ YERİNDEN okur", () => {
    // `firma-tablolari.ts` dışındaki hiçbir dosya `offers/cost`a doğrudan
    // bağlanmaz; bağlansaydı sınırın gerekçesi dosya dosya dağılırdı.
    const dogrudan = /from\s+"@\/lib\/offers\/cost\//;
    const sizanlar = tsDosyalari(path.join(KOK, "lib", "weights"))
      .filter((f) => !f.endsWith("firma-tablolari.ts"))
      .filter((f) => dogrudan.test(fs.readFileSync(f, "utf8")));
    expect(sizanlar.map((f) => path.relative(KOK, f))).toEqual([]);
  });

  it("`lib/weights` SAFTIR — DB, HTTP ve React içe aktarmaz", () => {
    const kirli: string[] = [];
    for (const f of tsDosyalari(path.join(KOK, "lib", "weights"))) {
      const metin = fs.readFileSync(f, "utf8");
      for (const yasak of ["@/lib/supabase", "next/", "from \"react\""]) {
        if (metin.includes(yasak)) kirli.push(`${path.relative(KOK, f)} → ${yasak}`);
      }
    }
    expect(kirli).toEqual([]);
  });
});

describe("firma tabloları TEK TANIMDIR", () => {
  it("yeniden dışa verim maliyet tarafındaki nesnenin TA KENDİSİDİR", async () => {
    // `toBe` ile: bir gün yeniden dışa verim elle bir nesneye dönüşürse (yani
    // tablo KOPYALANIRSA) test düşer. Kopya, teker grubu ağırlığının bir yerde
    // 850 ötekinde 900 kg olmasının başlangıcıdır (değişmez md. 8).
    const dikis = await import("../firma-tablolari");
    const kaynak = await import("@/lib/offers/cost/params");
    expect(dikis.FRAME_TABLE).toBe(kaynak.FRAME_TABLE);
    expect(dikis.CLASS_WEIGHT).toBe(kaynak.CLASS_WEIGHT);
    expect(dikis.COST_PARAM_DEFAULTS).toBe(kaynak.COST_PARAM_DEFAULTS);
    expect(dikis.paramOf).toBe(kaynak.paramOf);
    expect(dikis.interpolate).toBe(kaynak.interpolate);
  });

  it("defter kendi ağırlık TABLOSUNU tanımlamaz", async () => {
    const metin = fs.readFileSync(path.join(KOK, "lib", "weights", "ledger.ts"), "utf8");
    expect(metin).not.toMatch(/\bconst\s+\w*_TABLE\s*[:=]/);
  });

  it("defterin kendi katsayıları firma defterini GÖLGELEMEZ", async () => {
    // Ortak bir katsayıyı burada yeniden tanımlamak iki tanım demektir ve ilk
    // gölgeleme sessizce ayrışmanın başlangıcıdır.
    const { AGIRLIK_KATSAYI_TANIMLARI } = await import("../ledger");
    const { COST_PARAM_DEFAULTS } = await import("@/lib/offers/cost/params");
    const cakisan = AGIRLIK_KATSAYI_TANIMLARI.map((p) => p.key).filter(
      (k) => k in COST_PARAM_DEFAULTS
    );
    expect(cakisan).toEqual([]);
  });
});
