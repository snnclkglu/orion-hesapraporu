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

// ————————————————————————————————————————————————— 02.09.2026 turu

describe("BAŞKİRİŞ köprü grubunda HER ZAMAN görünür (md. 9)", () => {
  it("bölüm KAPALIYKEN köşe yükünden tahmin edilir", () => {
    // Yeni işler «09 · Başkiriş» bölümü KAPALI açılır; grup bugüne dek hiç
    // çizilmiyordu ve `bridgeWeightT` ipucunun sözü ("başkirişler dâhil")
    // tutulmuyordu.
    expect(OFF).toContain("endCarriage");
    const g = grup(dokumFor(), "bridge", "endCarriage");
    expect(g, "başkiriş grubu").toBeDefined();
    const kalem = g!.kalemler.find((k) => k.key === "bridge.endCarriage.beam")!;
    expect(kalem.kaynak).toBe("tahmin");
    expect(kalem.adet).toBe(2);
    expect(kalem.kg).toBeGreaterThan(0);
    expect(kalem.gerekce).toContain("kapalı");
  });

  it("bölüm AÇIKKEN kesitten gelir ve ANAHTAR AYNI kalır", () => {
    // Anahtar değişseydi, bölümü sonradan açan mühendisin elle girdiği kilo ve
    // notu sessizce kopardı.
    const dokum = dokumFor(BASE, OFF.filter((k) => k !== "endCarriage"));
    const kalem = grup(dokum, "bridge", "endCarriage")!.kalemler.find(
      (k) => k.key === "bridge.endCarriage.beam"
    )!;
    expect(kalem.moduleKey).toBe("endCarriage");
    expect(kalem.formul).toContain("kg/m");
  });

  it("ezme, bölüm açık da kapalı da AYNI anahtardan geçer", () => {
    const durum: AgirlikDokumuDurumu = { overrides: { "bridge.endCarriage.beam": 3300 } };
    for (const kapali of [OFF, OFF.filter((k) => k !== "endCarriage")]) {
      const kalem = grup(dokumFor(BASE, kapali, durum), "bridge", "endCarriage")!.kalemler.find(
        (k) => k.key === "bridge.endCarriage.beam"
      )!;
      expect(kalem.kg).toBe(3300);
      expect(kalem.kaynak).toBe("elle");
    }
  });

  it("VİNÇ ARABASI raporunda köprü bandını DİRİLTMEZ", () => {
    const kapali = [...new Set([...OFF, ...TROLLEY_ONLY_DISABLED_MODULES])];
    const dokum = dokumFor(BASE, kapali);
    expect(dokum.bantlar.map((b) => b.key)).toEqual(["trolley"]);
  });
});

describe("PORTAL AYAKLARI köprü grubunda, kutunun DIŞINDA (md. 8)", () => {
  const ile = (craneType: string, durum?: AgirlikDokumuDurumu) => {
    const input = calcFor(BASE, OFF);
    return agirlikDokumu({
      input,
      result: runCalc(input),
      satirlar: satirlariniAl(input),
      durum,
      craneType,
    });
  };

  it("gezer köprülü vinçte AYAK GRUBU HİÇ doğmaz", () => {
    expect(grup(ile("Çift Kirişli Gezer Köprülü Vinç"), "bridge", "legs")).toBeUndefined();
    expect(grup(dokumFor(), "bridge", "legs")).toBeUndefined();
  });

  it("Portal Vinç künyesinde dört ayak, KÖPRÜ bandının içinde doğar", () => {
    const dokum = ile("Portal Vinç", { ayakYuksekligiM: 8 });
    const g = grup(dokum, "bridge", "legs")!;
    expect(g.label).toBe("Ayaklar ve Portal Yapısı");
    expect(g.bantToplaminaGirmez).toBe(true);
    const ayak = g.kalemler.find((k) => k.key === "bridge.legs.ayak")!;
    expect(ayak.adet).toBe(4);
    expect(ayak.kg).toBeGreaterThan(0);
    expect(g.kalemler.map((k) => k.label)).toEqual([
      "Ayaklar",
      "Üst Uç Bağlantı",
      "Portal Takviyeleri",
      "Ayak Merdiveni ve Sahanlıkları",
    ]);
  });

  it("YARI portalde iki ayak olur", () => {
    const g = grup(ile("Yarı Portal Vinç", { ayakYuksekligiM: 8 }), "bridge", "legs")!;
    expect(g.kalemler.find((k) => k.key === "bridge.legs.ayak")!.adet).toBe(2);
  });

  it("ayak kilosu `bridgeWeightT` toplamına GİRMEZ, vinç toplamına GİRER", () => {
    // Kutuyu ana kiriş (ölü yük payı) ve teker yükleri okuyor; ayak kirişi
    // TAŞIR, kirişe BİNMEZ. Kilosu kutuya sızsaydı sehim ve teker yükü sessizce
    // büyürdü.
    const yok = ile("Çift Kirişli Gezer Köprülü Vinç");
    const portal = ile("Portal Vinç", { ayakYuksekligiM: 8 });
    const kopru = bant(portal, "bridge")!;
    expect(kopru.kg).toBe(bant(yok, "bridge")!.kg);
    expect(kopru.disKg).toBeGreaterThan(0);
    expect(portal.kg!).toBeCloseTo(yok.kg! + kopru.disKg!, 1);
  });

  it("ayak yüksekliği girilmezse kilo BOŞ kalır ve sebebi yazılır (md. 4)", () => {
    const g = grup(ile("Portal Vinç"), "bridge", "legs")!;
    const ayak = g.kalemler.find((k) => k.key === "bridge.legs.ayak")!;
    expect(ayak.kg).toBeNull();
    // "yükseklik" ARANMAZ: metinde "yüksekliği" geçiyor ve ünsüz yumuşaması
    // k → ğ olduğu için alt dizge tutmaz (Türkçe eki olan her aramanın tuzağı).
    expect(ayak.gerekce).toContain("Ayak yüksekli");
    expect(g.eksikKalemSayisi).toBeGreaterThan(0);
  });

  it("tanınmayan künye portal SAYILMAZ", () => {
    expect(grup(ile("PORTAL"), "bridge", "legs")).toBeUndefined();
    expect(grup(ile(""), "bridge", "legs")).toBeUndefined();
  });
});

describe("elle açılan serbest satır (md. 7)", () => {
  const durumla = (durum: AgirlikDokumuDurumu) => dokumFor(BASE, OFF, durum);

  it("kendi grubunda doğar, toplama girer ve `elle` rozetlidir", () => {
    const dokum = durumla({
      serbest: [
        {
          id: "serbest-1",
          bant: "trolley",
          grup: "frame",
          ad: "Kabin yürütme grubu",
          adet: 1,
          kg: 420,
        },
      ],
    });
    const g = grup(dokum, "trolley", "frame")!;
    const kalem = g.kalemler.find((k) => k.serbestId === "serbest-1")!;
    expect(kalem.label).toBe("Kabin yürütme grubu");
    expect(kalem.kaynak).toBe("elle");
    expect(kalem.kg).toBe(420);
    const otomatik = g.kalemler.filter((k) => !k.serbestId).reduce((t, k) => t + (k.kg ?? 0), 0);
    expect(g.kg).toBeCloseTo(otomatik + 420, 1);
  });

  it("kilosu girilmemiş serbest satır EKSİK sayılır, sıfır sayılmaz (md. 4)", () => {
    const dokum = durumla({
      serbest: [
        { id: "serbest-2", bant: "bridge", grup: "platform", ad: "Ek sahanlık", adet: null, kg: null },
      ],
    });
    const g = grup(dokum, "bridge", "platform")!;
    const kalem = g.kalemler.find((k) => k.serbestId === "serbest-2")!;
    expect(kalem.kg).toBeNull();
    expect(kalem.kisaDurum).toBe("ağırlık girilmedi");
    expect(g.eksikKalemSayisi).toBe(1);
  });

  it("ÖN EKSİZ kimlik otomatik bir kalemin anahtarını ELE GEÇİREMEZ", () => {
    const dokum = durumla({
      serbest: [{ id: "beam", bant: "bridge", grup: "endCarriage", ad: "Sahte", adet: 1, kg: 9 }],
    });
    const kalemler = grup(dokum, "bridge", "endCarriage")!.kalemler;
    expect(kalemler.some((k) => k.label === "Sahte")).toBe(false);
  });

  it("bandı olmayan satır bandı DİRİLTMEZ, notlarda sayılır", () => {
    const dokum = durumla({
      serbest: [
        { id: "serbest-3", bant: "mono1Trolley", grup: "frame", ad: "Eski", adet: 1, kg: 50 },
      ],
    });
    expect(bant(dokum, "mono1Trolley")).toBeUndefined();
    expect(dokum.notlar.some((n) => n.includes("elle açılmış satır"))).toBe(true);
  });

  it("tanımsız grup düşer", () => {
    const dokum = durumla({
      serbest: [{ id: "serbest-4", bant: "bridge", grup: "yokBoyleGrup", ad: "X", adet: 1, kg: 5 }],
    });
    expect(dokum.notlar.some((n) => n.includes("elle açılmış satır"))).toBe(true);
  });
});

describe("besleme yöntemi feston değilse SESSİZ KALINMAZ (md. 4)", () => {
  it("bara seçilmiş köprüde notlarda uyarı çıkar", () => {
    const dokum = dokumFor({ ...BASE, bridgePowerSupply: "conductorBar" });
    expect(dokum.notlar.some((n) => n.includes("bara"))).toBe(true);
  });

  it("feston seçilmişse uyarı çıkmaz", () => {
    const dokum = dokumFor({ ...BASE, bridgePowerSupply: "festoon" });
    expect(dokum.notlar.some((n) => n.includes("Köprü beslemesi"))).toBe(false);
  });
});

describe("ağırlık neden yok — cevap ÜÇE ayrılır", () => {
  it("ürün seçiliyken «yeniden seçin» DEMEZ", () => {
    const dokum = dokumFor();
    const bos = dokum.bantlar
      .flatMap((b) => b.gruplar)
      .flatMap((g) => g.kalemler)
      .filter((k) => k.kg === null && k.rowKey && !k.kapsandi);
    expect(bos.length).toBeGreaterThan(0);
    for (const k of bos) {
      expect(k.gerekce, k.key).toBeTruthy();
      expect(k.gerekce, k.key).not.toContain("yeniden seçin");
      expect(k.kisaDurum, k.key).toBeTruthy();
    }
  });
});

describe("katalogda olmayan ağırlıklar artık boş durmuyor (md. 4)", () => {
  it("KANCA BLOĞU MİLİ kendi geometrisinden tartılır", () => {
    const kalem = grup(dokumFor(), "trolley", "hookBlock")!.kalemler.find((k) =>
      k.rowKey?.endsWith(":shaft")
    )!;
    expect(kalem.kaynak).toBe("hesap");
    expect(kalem.kg).toBeGreaterThan(0);
    expect(kalem.formul).toContain("7,85");
    expect(kalem.gerekce).toContain("silindir");
  });

  it("KALDIRMA KİRİŞİ tek sayı değil ARALIK verir — kesit iki bölgeli", () => {
    const specs: TechnicalSpecs = {
      ...BASE,
      mainCapacityT: 64,
      mainHoistEquipmentArrangement: "doubleDrum",
      mainDoubleDrumHookSystem: "liftingBeam",
    };
    const kalem = grup(dokumFor(specs), "trolley", "hookBlock")!.kalemler.find((k) =>
      k.rowKey?.endsWith(":liftingBeam")
    )!;
    expect(kalem.kaynak).toBe("hesap");
    expect(kalem.kg).toBeGreaterThan(0);
    // Üst uç kalın kesitten gelir ve alt uçtan büyüktür; tek sayıya indirilmez.
    expect(kalem.kgUst).toBeGreaterThan(kalem.kg!);
  });

  it("YÜK HÜCRESİ ağırlığı Esit föyünden gelir", () => {
    // Denge traversli varsayılan düzende loadcell satırı doğar.
    const kalem = grup(dokumFor(), "trolley", "balance")!.kalemler.find((k) =>
      k.rowKey?.endsWith(":balanceLoadcell")
    );
    expect(kalem, "yük hücresi satırı").toBeDefined();
    expect(kalem!.kaynak).toBe("katalog");
    expect(kalem!.kg).toBeGreaterThan(0);
  });

  it("DENGE MAKARASI yayımlanmış çapta tartılır, yayımlanmamışta gerekçe yazar", () => {
    const ile = (dia: number) => {
      const input = calcFor(BASE, OFF);
      const patched: CalcInput = {
        ...input,
        mainHoist: {
          ...input.mainHoist!,
          inputs: { ...input.mainHoist!.inputs, ropeBalancingType: "equalizerSheave" as const },
          selections: { ...input.mainHoist!.selections, balanceSheaveDiaMm: dia },
        },
      };
      const dokum = agirlikDokumu({
        input: patched,
        result: runCalc(patched),
        satirlar: satirlariniAl(patched),
      });
      return dokum.bantlar
        .find((b) => b.key === "trolley")!
        .gruplar.find((g) => g.key === "trolley.balance")!
        .kalemler.find((k) => k.rowKey?.endsWith(":balanceSheave"))!;
    };
    const yayimli = ile(450);
    expect(yayimli.kaynak).toBe("katalog");
    expect(yayimli.kg).toBe(31.5);
    expect(yayimli.kgUst).toBe(34);

    // ARA DEĞER ALINMAZ: "Ø 500 mm makara" diye bir ürün yok.
    const yayimsiz = ile(500);
    expect(yayimsiz.kg).toBeNull();
    expect(yayimsiz.gerekce).toContain("yayımlanmış");
  });
});

describe("SKF yatak gövdesi ağırlığı — yerel katalogdan", () => {
  const ile = (kod: string) => {
    const input = calcFor(BASE, OFF);
    const patched: CalcInput = {
      ...input,
      mainHoist: {
        ...input.mainHoist!,
        selections: { ...input.mainHoist!.selections, bearingHousingCode: kod },
      },
    };
    const dokum = agirlikDokumu({
      input: patched,
      result: runCalc(patched),
      satirlar: satirlariniAl(patched),
    });
    return dokum.bantlar
      .find((b) => b.key === "trolley")!
      .gruplar.find((g) => g.key === "trolley.drum")!
      .kalemler.find((k) => k.rowKey?.endsWith(":drumBearingHousing"))!;
  };

  it("gövde kodundan çözülür ve KATALOG rozetiyle durur", () => {
    const kalem = ile("SNL 520-617");
    expect(kalem.kaynak).toBe("katalog");
    expect(kalem.birimKg).toBe(17.6);
    expect(kalem.gerekce).toContain("taban + kapak");
  });

  it("katalogun kendi içinde çeliştiği gövdede ARALIK verir", () => {
    // Aynı gövde iki mil çapı bloğunda birebir aynı ölçülerle ama farklı
    // kütleyle basılmış; tek sayıya indirmek yayımlanmamış bir kesinlik
    // uydurmak olurdu.
    const kalem = ile("SNL 517");
    expect(kalem.birimKg).toBe(9.5);
    expect(kalem.birimKgUst).toBe(10);
  });

  it("defterde olmayan bir seri BOŞ kalır ve sebebini yazar", () => {
    const kalem = ile("SAF 22518");
    expect(kalem.kg).toBeNull();
    expect(kalem.gerekce).toContain("başka bir seri");
  });
});

describe("klima ağırlığı — seri + hesaplanan ısı yükünden (TAHMİN)", () => {
  const ile = (seri: string) => {
    const acik = OFF.filter((k) => k !== "cabin");
    const specs: TechnicalSpecs = {
      ...BASE,
      hasOperatorCabin: "yes",
      operatorCabinHasAirConditioner: "yes",
      operatorCabinWidthM: 1.5,
      operatorCabinLengthM: 1.5,
      operatorCabinHeightM: 2.2,
    };
    const input = calcFor(specs, acik);
    const patched: CalcInput = {
      ...input,
      cabin: {
        ...input.cabin!,
        selections: {
          ...input.cabin!.selections,
          cabinAcBrand: "TMS",
          cabinAcModel: seri,
          cabinAcCoolingKwMin: 2,
          cabinAcCoolingKwMax: 8,
        },
      },
    };
    const dokum = agirlikDokumu({
      input: patched,
      result: runCalc(patched),
      satirlar: satirlariniAl(patched),
    });
    return dokum.bantlar
      .find((b) => b.key === "bridge")!
      .gruplar.find((g) => g.key === "bridge.cabin")!
      .kalemler.find((k) => k.rowKey?.endsWith(":cabinAc"));
  };

  it("tanınan seride ağırlık gelir ve rozet TAHMİN olur", () => {
    const kalem = ile("VKS-VC");
    expect(kalem, "klima satırı").toBeDefined();
    // Isı yükü şablon ölçülerinden gerçekten çıkıyor: satır BOŞ KALMAMALI.
    expect(kalem!.kg).not.toBeNull();
    expect(kalem!.kaynak).toBe("tahmin");
    // Ağırlık serinin yayımlanmış bandındadır (VKS-VC: 280–370 kg).
    expect(kalem!.kg!).toBeGreaterThanOrEqual(280);
    expect(kalem!.kg!).toBeLessThanOrEqual(370);
    expect(kalem!.gerekce).toContain("SERİ");
  });

  it("tanınmayan seride BOŞ kalır ve ne gerektiğini söyler", () => {
    const kalem = ile("BILINMEYEN-SERI");
    expect(kalem, "klima satırı").toBeDefined();
    expect(kalem!.kg).toBeNull();
    expect(kalem!.gerekce).toContain("SERİ");
  });
});
