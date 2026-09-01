// AĞIRLIK DÖKÜMÜ — davranış koruması.
//
// Sayılar değil DAVRANIŞ sınanır: hangi bant hangi topolojide doğuyor, eksik
// bir ağırlık nasıl davranıyor, ezme nereye akıyor, bozuk girdi ne yapıyor.
// Döküm bir HESAP DEĞİLDİR (HESAP-35); burada bir kesit onaylanmaz, yalnız
// vincin üzerindeki parçalar tartılır.

import { describe, expect, it } from "vitest";
import { activeModules, runCalc, type CalcInput } from "@/lib/calc/engine";
import { NEW_WORK_DISABLED_MODULES, NEW_WORK_TEMPLATE } from "@/lib/calc/defaults";
import { CALC_FIELD } from "@/lib/revision-load";
import { MODULE_ORDER } from "@/lib/calc/presentation/module-family";
import { TROLLEY_ONLY_DISABLED_MODULES } from "@/lib/crane-types";
import { buildEquipmentGroups, type EqRow } from "@/lib/equipment-list";
import type { TechnicalSpecs } from "@/lib/calc/types";
import { agirlikDokumu } from "../topla";
import { AGIRLIK_SAPMA_SINIRI, type AgirlikDokumuDurumu } from "../types";

const BASE = NEW_WORK_TEMPLATE.specs;
const OFF = [...NEW_WORK_DISABLED_MODULES];

/** Verilen teknik özellik ve kapalı listeyle hesaba giren girdi setini kurar. */
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

function satirlariniAl(input: CalcInput): EqRow[] {
  return buildEquipmentGroups(input).flatMap((g) => g.rows);
}

function dokumFor(
  specs: TechnicalSpecs = BASE,
  disabled: readonly string[] = OFF,
  durum?: AgirlikDokumuDurumu,
  gizliBolumler?: readonly string[]
) {
  const input = calcFor(specs, disabled);
  return agirlikDokumu({
    input,
    result: runCalc(input),
    satirlar: satirlariniAl(input),
    gizliBolumler,
    durum,
  });
}

function bant(dokum: ReturnType<typeof dokumFor>, key: string) {
  return dokum.bantlar.find((b) => b.key === key);
}

function grup(dokum: ReturnType<typeof dokumFor>, bantKey: string, grupKey: string) {
  return bant(dokum, bantKey)?.gruplar.find((g) => g.key === `${bantKey}.${grupKey}`);
}

describe("bant yapısı topolojiden doğar", () => {
  it("varsayılan yeni işte KÖPRÜ ve ANA ARABA bantları vardır", () => {
    const dokum = dokumFor();
    expect(dokum.bantlar.map((b) => b.key)).toEqual(["bridge", "trolley"]);
    expect(bant(dokum, "bridge")?.label).toBe("KÖPRÜ");
    expect(bant(dokum, "trolley")?.specKey).toBe("mainTrolleyWeightT");
  });

  it("VİNÇ ARABASI raporunda KÖPRÜ bandı HİÇ doğmaz", () => {
    const kapali = [...new Set([...OFF, ...TROLLEY_ONLY_DISABLED_MODULES])];
    const dokum = dokumFor(BASE, kapali);
    expect(bant(dokum, "bridge")).toBeUndefined();
    expect(bant(dokum, "trolley")).toBeDefined();
  });

  it("AYRI yardımcı arabada iki ARABA bandı olur, her biri kendi kutusuna bakar", () => {
    const specs: TechnicalSpecs = { ...BASE, auxTrolleyMode: "separate", auxTrolleyWeightT: 1.2 };
    const dokum = dokumFor(specs, OFF.filter((k) => k !== "aux" && k !== "auxHookBlock"));
    expect(bant(dokum, "trolley")?.specKey).toBe("mainTrolleyWeightT");
    expect(bant(dokum, "auxTrolley")?.specKey).toBe("auxTrolleyWeightT");
  });

  it("PAYLAŞIMLI yardımcı kaldırma ANA arabanın bandındadır", () => {
    // `auxTrolleyMode` verilmezse "shared" okunur: yardımcı kaldırma ana
    // arabanın üzerindedir ve kilosu ANA arabanın toplamına girer.
    const dokum = dokumFor(BASE, OFF.filter((k) => k !== "aux" && k !== "auxHookBlock"));
    expect(bant(dokum, "auxTrolley")).toBeUndefined();
    const tahrik = grup(dokum, "trolley", "hoistDrive");
    const moduller = new Set(tahrik?.kalemler.map((k) => k.moduleKey));
    expect(moduller.has("main")).toBe(true);
    expect(moduller.has("aux")).toBe(true);
  });

  it("aynı grupta iki kaldırma varsa etiketler AYRIŞIR", () => {
    const dokum = dokumFor(BASE, OFF.filter((k) => k !== "aux" && k !== "auxHookBlock"));
    const etiketler = grup(dokum, "trolley", "hoistDrive")?.kalemler.map((k) => k.label) ?? [];
    expect(etiketler.some((e) => e.startsWith("Ana · "))).toBe(true);
    expect(etiketler.some((e) => e.startsWith("Yardımcı · "))).toBe(true);
  });
});

describe("kalem anahtarları", () => {
  it("TEKİLDİR — aynı anahtar iki satırda görünmez", () => {
    const dokum = dokumFor(BASE, OFF.filter((k) => k !== "aux" && k !== "auxHookBlock"));
    const anahtarlar = dokum.bantlar.flatMap((b) =>
      b.gruplar.flatMap((g) => g.kalemler.map((k) => k.key))
    );
    expect(new Set(anahtarlar).size).toBe(anahtarlar.length);
  });

  it("köprü yürütmesi ARABA yürütmesiyle aynı grup anahtarına düşmez", () => {
    const dokum = dokumFor();
    expect(grup(dokum, "bridge", "bridgeTravel")).toBeDefined();
    expect(grup(dokum, "bridge", "travel")).toBeUndefined();
    expect(grup(dokum, "trolley", "travel")).toBeDefined();
  });
});

describe("eksik ağırlık SIFIR sayılmaz", () => {
  it("ağırlığı bilinmeyen kalem `null` gelir ve gerekçesini yazar", () => {
    const dokum = dokumFor();
    const kalemler = dokum.bantlar.flatMap((b) => b.gruplar.flatMap((g) => g.kalemler));
    const bos = kalemler.filter((k) => k.kg === null);
    expect(bos.length).toBeGreaterThan(0);
    for (const k of bos) {
      expect(k.kg).toBeNull();
      expect(k.gerekce, k.key).toBeTruthy();
    }
  });

  it("grup toplamı yalnız BİLİNEN kalemlerden çıkar, eksikler sayılır", () => {
    const dokum = dokumFor();
    for (const b of dokum.bantlar) {
      for (const g of b.gruplar) {
        if (g.ezildi) continue;
        const bilinen = g.kalemler.filter((k) => k.kg !== null);
        const eksik = g.kalemler.length - bilinen.length;
        expect(g.eksikKalemSayisi, g.key).toBe(eksik);
        if (bilinen.length === 0) {
          expect(g.kg, g.key).toBeNull();
        } else {
          expect(g.kg, g.key).toBeCloseTo(
            bilinen.reduce((t, k) => t + (k.kg as number), 0),
            6
          );
        }
      }
    }
  });

  it("eksik varken döküm bunu CÜMLEYLE söyler", () => {
    const dokum = dokumFor();
    expect(dokum.eksikKalemSayisi).toBeGreaterThan(0);
    expect(dokum.notlar.some((n) => n.includes("EN AZ"))).toBe(true);
  });

  it("başkiriş: kesit HESAPTAN, boy TAHMİNden — rozet en zayıf halkayı yazar", () => {
    // Bölüm toplam boyu sormuyor; boy defterde teker aralığı + konsol payından
    // türetiliyor. Kesit metre ağırlığı hesaptan gelse de satırın güvenilirliği
    // boyun güvenilirliğidir.
    const dokum = dokumFor(BASE, OFF.filter((k) => k !== "endCarriage"));
    const kalem = grup(dokum, "bridge", "endCarriage")?.kalemler[0];
    expect(kalem?.adet).toBe(2);
    expect(kalem?.kg).toBeGreaterThan(0);
    expect(kalem?.kaynak).toBe("tahmin");
    expect(kalem?.gerekce).toContain("boy TAHMİN");
  });

  it("teker aralığı yoksa başkiriş boyu türetilemez ve satır BOŞ kalır", () => {
    const input = calcFor(BASE, OFF.filter((k) => k !== "endCarriage"));
    const bozuk = {
      ...input,
      endCarriage: {
        ...input.endCarriage!,
        inputs: { ...input.endCarriage!.inputs, wheelSpanAMm: 0 },
      },
    } as CalcInput;
    const dokum = agirlikDokumu({
      input: bozuk,
      result: runCalc(bozuk),
      satirlar: satirlariniAl(bozuk),
    });
    const kalem = dokum.bantlar
      .find((b) => b.key === "bridge")
      ?.gruplar.find((g) => g.key === "bridge.endCarriage")?.kalemler[0];
    expect(kalem?.kg).toBeNull();
    expect(kalem?.gerekce).toContain("teker aralığı");
  });
});

describe("hesaptan gelen yapı ağırlıkları", () => {
  it("ana kiriş kilosu KESİTTEN gelir ve kiriş adediyle çarpılır", () => {
    const dokum = dokumFor();
    const kiris = grup(dokum, "bridge", "girder")?.kalemler[0];
    expect(kiris?.kaynak).toBe("hesap");
    expect(kiris?.adet).toBe(2); // çift kirişli varsayılan
    expect(kiris?.birimKg).toBeGreaterThan(0);
    expect(kiris?.kg).toBeCloseTo((kiris?.birimKg as number) * 2, 6);
  });

  it("DÖRT kirişlide iki ayrı kiriş kalemi olur, her takım 2 kiriş", () => {
    const specs: TechnicalSpecs = { ...BASE, girderArrangement: "dort" };
    const dokum = dokumFor(specs, OFF.filter((k) => k !== "girder2"));
    const kalemler = grup(dokum, "bridge", "girder")?.kalemler ?? [];
    expect(kalemler.map((k) => k.moduleKey)).toEqual(["girder", "girder2"]);
    expect(kalemler.every((k) => k.adet === 2)).toBe(true);
  });

  it("SATIRLAR EKRANDA TOPLANIR: kg = adet × birim, 0,1 kg'a yuvarlı", () => {
    // Ham birimden çarpıp ayrıca yuvarlamak "2 ad × 4.774,5 = 9.549,1" gibi
    // kendi kendini yalanlayan bir satır üretiyordu.
    const dokum = dokumFor();
    for (const b of dokum.bantlar) {
      for (const g of b.gruplar) {
        for (const k of g.kalemler) {
          if (k.kg === null || k.birimKg === null || k.adet === null || k.ezildi) continue;
          expect(k.kg, k.key).toBeCloseTo(
            Math.round(k.birimKg * k.adet * 10) / 10,
            9
          );
          expect(k.birimKg * 10, k.key).toBeCloseTo(Math.round(k.birimKg * 10), 9);
        }
        if (g.kg !== null && !g.ezildi) {
          const bilinen = g.kalemler.filter((k) => k.kg !== null);
          expect(g.kg, g.key).toBeCloseTo(
            Math.round(bilinen.reduce((t, k) => t + (k.kg as number), 0) * 10) / 10,
            9
          );
        }
      }
    }
  });

  it("tambur ve halat KATALOG değil HESAP rozeti taşır", () => {
    const dokum = dokumFor();
    const tambur = grup(dokum, "trolley", "drum")?.kalemler.find((k) =>
      k.rowKey?.endsWith(":drum")
    );
    expect(tambur?.kaynak).toBe("hesap");
    const halat = grup(dokum, "trolley", "rope")?.kalemler[0];
    expect(halat?.kaynak).toBe("hesap");
  });
});

describe("elle ezme", () => {
  it("kalem ezmesi gruba, banda ve vinç toplamına AKAR", () => {
    const once = dokumFor();
    const kiris = grup(once, "bridge", "girder")!.kalemler[0];
    const ezilmis = dokumFor(BASE, OFF, { overrides: { [kiris.key]: 12345 } });
    const yeni = grup(ezilmis, "bridge", "girder")!.kalemler[0];
    expect(yeni.kg).toBe(12345);
    expect(yeni.ezildi).toBe(true);
    expect(yeni.kaynak).toBe("elle");
    expect(yeni.kaynakOnce).toBe("hesap");
    expect(yeni.otomatikKg).toBeCloseTo(kiris.kg as number, 6);
    const fark = (kiris.kg as number) - 12345;
    expect(bant(ezilmis, "bridge")!.kg).toBeCloseTo(
      (bant(once, "bridge")!.kg as number) - fark,
      6
    );
    expect(ezilmis.kg).toBeCloseTo((once.kg as number) - fark, 6);
  });

  it("GRUP toplamı ezilebilir; kalemler listede kalır ama toplama girmez", () => {
    const dokum = dokumFor(BASE, OFF, { overrides: { "bridge.girder": 20000 } });
    const g = grup(dokum, "bridge", "girder")!;
    expect(g.kg).toBe(20000);
    expect(g.ezildi).toBe(true);
    expect(g.kalemler.length).toBeGreaterThan(0);
    expect(g.eksikKalemSayisi).toBe(0);
  });

  it("mühendisin notu kalemin gerekçesine yazılır", () => {
    const once = dokumFor();
    const kiris = grup(once, "bridge", "girder")!.kalemler[0];
    const dokum = dokumFor(BASE, OFF, {
      overrides: { [kiris.key]: 9000 },
      notes: { [kiris.key]: "Atölye tartısı." },
    });
    expect(grup(dokum, "bridge", "girder")!.kalemler[0].gerekce).toBe("Atölye tartısı.");
  });

  it("ADET EZİLMEZ — ezme yalnız kiloyu değiştirir", () => {
    const once = dokumFor();
    const kiris = grup(once, "bridge", "girder")!.kalemler[0];
    const dokum = dokumFor(BASE, OFF, { overrides: { [kiris.key]: 1 } });
    expect(grup(dokum, "bridge", "girder")!.kalemler[0].adet).toBe(kiris.adet);
  });
});

describe("gizlenen alt bölüm", () => {
  const GIZLI = ["trolley-5.8"]; // araba tamponu

  it("VARSAYILAN olarak kalemi düşer ve kaç satırın düştüğü yazılır", () => {
    const dokum = dokumFor(BASE, OFF, undefined, GIZLI);
    const g = grup(dokum, "trolley", "travel")!;
    expect(g.kalemler.some((k) => k.rowKey === "trolley:buffer")).toBe(false);
    expect(g.gizliDusenSayisi).toBe(1);
    expect(dokum.notlar.some((n) => n.includes("gizlenmiş alt bölüm"))).toBe(true);
  });

  it("ANAHTAR açılınca kalem geri gelir ve işaretli olur", () => {
    const dokum = dokumFor(BASE, OFF, { gizliBolumleriSay: true }, GIZLI);
    const tampon = grup(dokum, "trolley", "travel")!.kalemler.find(
      (k) => k.rowKey === "trolley:buffer"
    );
    expect(tampon).toBeDefined();
    expect(tampon?.gizliBolumden).toBe(true);
  });
});

describe("fark şeridi", () => {
  it("tahmini ile döküm arasındaki oranı verir", () => {
    const dokum = dokumFor();
    const b = bant(dokum, "trolley")!;
    expect(b.tahminiKg).toBeCloseTo(BASE.mainTrolleyWeightT * 1000, 6);
    if (b.kg !== null && b.tahminiKg !== null) {
      expect(b.farkOrani).toBeCloseTo((b.kg - b.tahminiKg) / b.tahminiKg, 9);
    }
  });

  it("sapma sınırı TEK yerdedir ve maliyet tarafındaki %5 DEĞİLDİR", () => {
    expect(AGIRLIK_SAPMA_SINIRI).toBe(0.1);
  });

  it("tahmini ağırlık girilmemişse fark hesaplanmaz (uydurma yüzde çıkmaz)", () => {
    const specs: TechnicalSpecs = { ...BASE, mainTrolleyWeightT: 0 };
    const dokum = dokumFor(specs);
    expect(bant(dokum, "trolley")?.tahminiKg).toBeNull();
    expect(bant(dokum, "trolley")?.farkOrani).toBeNull();
  });
});

describe("dayanıklılık — döküm ASLA fırlatmaz", () => {
  it("bozuk satırlar, bozuk ezmeler ve boş sonuç fırlatmaz", () => {
    const input = calcFor(BASE, OFF);
    const bozukSatirlar = [
      ...satirlariniAl(input),
      { component: "anahtarsız", brand: "-", model: "-", spec: "", qty: 1 },
      { rowKey: "bilinmeyenModul:sey", component: "x", brand: "-", model: "-", spec: "", qty: 1 },
      { rowKey: "main:bilinmeyenSlug", component: "y", brand: "-", model: "-", spec: "", qty: 1 },
      { rowKey: "main:drum", component: "z", brand: "-", model: "-", spec: "", qty: "—" },
    ] as EqRow[];
    expect(() =>
      agirlikDokumu({
        input,
        result: runCalc(input),
        satirlar: bozukSatirlar,
        gizliBolumler: ["bozuk", "trolley-yok"],
        durum: {
          overrides: { "bridge.girder": Number.NaN, "yok.olan.anahtar": 5 },
          notes: { "yok.olan.anahtar": "x" },
        },
      })
    ).not.toThrow();
  });

  it("hiç hesaplanmamış bir sonuçla da çalışır", () => {
    const input = calcFor(BASE, OFF);
    const dokum = agirlikDokumu({
      input,
      result: {} as ReturnType<typeof runCalc>,
      satirlar: satirlariniAl(input),
    });
    // Kiriş kilosu hesaptan gelemedi ama satır DÜŞMEDİ: gerekçesiyle durur.
    const kiris = grup(dokum, "bridge", "girder")?.kalemler[0];
    expect(kiris?.kg).toBeNull();
    expect(kiris?.gerekce).toBeTruthy();
  });
});

describe("tahmin defteri", () => {
  it("platform, köprü elektriği, şasi ve araba platformu TAHMİN rozetiyle gelir", () => {
    const dokum = dokumFor();
    for (const [bantKey, grupKey, ad] of [
      ["bridge", "platform", "Platform ve Korkuluk"],
      ["bridge", "electric", "Köprü Elektrik Tesisatı"],
      ["trolley", "frame", "Araba Şasisi"],
      ["trolley", "platform", "Araba Platformu"],
    ] as const) {
      const g = grup(dokum, bantKey, grupKey);
      expect(g, `${bantKey}.${grupKey}`).toBeDefined();
      const kalem = g!.kalemler[0];
      expect(kalem.kaynak, kalem.key).toBe("tahmin");
      expect(kalem.kg, kalem.key).toBeGreaterThan(0);
      expect(kalem.formul, kalem.key).toBeTruthy();
      expect(kalem.label, kalem.key).toBe(ad);
      expect(g!.tahminIcerir).toBe(true);
    }
  });

  it("araba platformu ŞASİDEN türer — sıra bozulursa sayı çıkmazdı", () => {
    const dokum = dokumFor();
    const sasi = grup(dokum, "trolley", "frame")!.kalemler[0].kg as number;
    const platform = grup(dokum, "trolley", "platform")!.kalemler[0].kg as number;
    // Oran firma defterindedir (0,12); burada bağın KURULDUĞU sınanır.
    expect(platform).toBeGreaterThan(0);
    expect(platform).toBeLessThan(sasi);
  });

  it("ÜST MAKARA eşiğin altında HİÇ ÇIKMAZ, üstünde çıkar", () => {
    // "0 kg'lık bir üst makara bloğu" diye bir parça yok; olmayan satır,
    // sıfır yazan satırdan iyidir.
    expect(grup(dokumFor(), "trolley", "topSheave")).toBeUndefined();
    const buyuk = dokumFor({ ...BASE, mainCapacityT: 64 });
    const g = grup(buyuk, "trolley", "topSheave");
    expect(g).toBeDefined();
    expect(g!.kalemler[0].kaynak).toBe("tahmin");
  });

  it("FESTON tahmini yalnız beslemesi feston olan eksende çıkar", () => {
    expect(grup(dokumFor(), "bridge", "festoon")).toBeUndefined();
    const dokum = dokumFor({ ...BASE, bridgePowerSupply: "festoon" });
    const g = grup(dokum, "bridge", "festoon")!;
    const tahmin = g.kalemler.find((k) => k.kaynak === "tahmin");
    expect(tahmin?.kg).toBeGreaterThan(0);
  });

  it("feston tahmini katalog satırını KAPSAR — iki kez toplanmaz, eksik sayılmaz", () => {
    const dokum = dokumFor({ ...BASE, bridgePowerSupply: "festoon" });
    const g = grup(dokum, "bridge", "festoon")!;
    const katalog = g.kalemler.find((k) => k.rowKey === "bridge:festoon");
    expect(katalog?.kapsandi).toBe(true);
    expect(katalog?.kg).toBeNull(); // toplama girmez
    expect(katalog?.gerekce).toContain("kapsıyor");
    // Kapsanan satır EKSİK sayılmaz: ekran olmayan bir boşluk göstermemeli.
    expect(g.eksikKalemSayisi).toBe(0);
    expect(g.kg).toBe(g.kalemler.find((k) => k.kaynak === "tahmin")!.kg);
  });

  it("kabin ve oda ölçülerinden türer; ölçü yoksa BOŞ kalır ve sebebi yazılır", () => {
    const acik = OFF.filter((k) => k !== "cabin");
    const specs: TechnicalSpecs = {
      ...BASE,
      hasOperatorCabin: "yes",
      electricalAccommodationType: "room",
    };
    const dokum = dokumFor(specs, acik);
    const kabin = grup(dokum, "bridge", "cabin")!.kalemler.find((k) => k.kaynak === "tahmin");
    const oda = grup(dokum, "bridge", "electricalRoom")!.kalemler.find(
      (k) => k.kaynak === "tahmin" && k.label === "Oda Çeliği"
    );
    for (const k of [kabin, oda]) {
      expect(k, "tahmin kalemi").toBeDefined();
      // Şablonda mahal ölçüleri sıfırdır: uydurma bir kilo çıkmaz.
      if (k!.kg === null) expect(k!.gerekce).toContain("ölçüleri");
      else expect(k!.kg).toBeGreaterThan(0);
    }
  });
});

describe("tambur emniyet freni artık görünür", () => {
  it("kaliper TAHRİK GRUBUNDA, katalog ağırlığıyla", () => {
    // Bölüm 2.8 uzun süre HİÇ ekipman satırı üretmiyordu: seçilen SIBRE SHI
    // kaliperi ne listede ne dökümde vardı, satın alma da onu görmüyordu.
    const input = calcFor({ ...BASE, hoistSafetyBrake: "Var" }, OFF);
    const ile: CalcInput = {
      ...input,
      mainHoist: {
        ...input.mainHoist!,
        selections: { ...input.mainHoist!.selections, safetyBrakeModel: "SHI 105" },
      },
    };
    const dokum = agirlikDokumu({
      input: ile,
      result: runCalc(ile),
      satirlar: satirlariniAl(ile),
    });
    const kalem = dokum.bantlar
      .find((b) => b.key === "trolley")!
      .gruplar.find((g) => g.key === "trolley.hoistDrive")!
      .kalemler.find((k) => k.rowKey === "main:safetyBrake");
    expect(kalem).toBeDefined();
    expect(kalem!.kaynak).toBe("katalog");
    expect(kalem!.adet).toBe(1);
    expect(kalem!.kg).toBe(130); // SHI 105 — katalog tohumuyla birebir
  });

  it("emniyet freni YOKKEN satır hiç doğmaz", () => {
    const dokum = dokumFor();
    const varMi = dokum.bantlar.some((b) =>
      b.gruplar.some((g) => g.kalemler.some((k) => k.rowKey?.endsWith(":safetyBrake")))
    );
    expect(varMi).toBe(false);
  });
});
