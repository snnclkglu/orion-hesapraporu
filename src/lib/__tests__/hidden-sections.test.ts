// Alt bölüm gizleme — çekirdek sözleşmeler.
//
// Kullanıcı bir alt bölümü (ör. 5.7 Teker — Redüktör Kaplini) başlığındaki
// kutucukla gizleyebilir: bölüm hesaba girmeye devam eder ama editör özetleri,
// PDF raporu ve ekipman listesi onu taşımaz. Bu dosya dört bağı kilitler:
//   1. `hiddenSectionsFromRevision` — JSONB'den güvenli okuma
//   2. `hiddenSectionCheckIds` — gizli bölüm → kontrol kimlikleri eşlemesi
//   3. `sectionDisplayNumbers` — gizlenen bölüm numarasını da götürür
//   4. `diffRevisions` — gizleme kararı karşılaştırmada kaybolmaz

import { describe, expect, it } from "vitest";
import {
  hiddenSectionsFromRevision,
  sectionHideKeyFor,
  sectionNoteKeyFor,
} from "@/lib/revision-load";
import { diffRevisions } from "@/lib/revision-diff";
import { fieldLabel } from "@/lib/calc/labels";
import { NEW_WORK_TEMPLATE } from "@/lib/calc/defaults";
import {
  MODULE_ADAPTERS,
  hiddenSectionCheckIds,
  sectionDisplayNumbers,
  type AdapterSection,
} from "@/app/(app)/projects/[id]/revisions/[revId]/module-adapters";

describe("sectionHideKeyFor", () => {
  it("not/alternatif anahtarlarıyla aynı uzayı kullanır", () => {
    // Üç kayıt da aynı bölümü işaret eder; anahtar biçimleri ayrışamaz.
    expect(sectionHideKeyFor("trolley", "5.7")).toBe("trolley-5.7");
    expect(sectionHideKeyFor("trolley", "5.7")).toBe(sectionNoteKeyFor("trolley", "5.7"));
  });
});

describe("hiddenSectionsFromRevision", () => {
  it("geçerli anahtarları okur, bozukları ve yinelenenleri atar", () => {
    const out = hiddenSectionsFromRevision({
      hiddenSections: [
        "trolley-5.7",
        "trolley-5.7",        // yinelenen
        "main-2.8",
        "",                   // boş
        "-5.7",               // modül anahtarı yok
        "trolley-",           // bölüm id'si yok
        "bolumsuz",           // ayraç yok
        42 as unknown as string, // tip dışı
      ],
    });
    expect(out.sort()).toEqual(["main-2.8", "trolley-5.7"]);
  });

  it("alan yokken, null iken ya da dizi değilken boş döner", () => {
    expect(hiddenSectionsFromRevision(null)).toEqual([]);
    expect(hiddenSectionsFromRevision({})).toEqual([]);
    expect(hiddenSectionsFromRevision({ hiddenSections: null })).toEqual([]);
    expect(
      hiddenSectionsFromRevision({ hiddenSections: "trolley-5.7" as unknown as string[] })
    ).toEqual([]);
  });
});

describe("hiddenSectionCheckIds", () => {
  it("gizli bölümün kontrol soneklerini adaptör önekiyle birleştirir", () => {
    const ids = hiddenSectionCheckIds(["trolley-5.7"]);
    // 5.7'nin checkSuffixes bildirimi: wheelCoupling.torque + wheelCoupling.bore
    expect([...ids].sort()).toEqual([
      "trolley.wheelCoupling.bore",
      "trolley.wheelCoupling.torque",
    ]);
  });

  it("aynı ham bölüm başka modülde gizlenmemişse onun kontrollerine dokunmaz", () => {
    // Araba 5.7 gizli, köprü 5.7 açık: köprünün kontrol kimlikleri kümede yok.
    const ids = hiddenSectionCheckIds(new Set(["trolley-5.7"]));
    expect(ids.has("bridge.wheelCoupling.torque")).toBe(false);
  });

  it("boş listede boş küme döner", () => {
    expect(hiddenSectionCheckIds([]).size).toBe(0);
  });

  it("çift tamburda seçilmeyen kanca sistemi bölümlerinin kontrollerini gizler", () => {
    const doubleHookSpecs = {
      ...NEW_WORK_TEMPLATE.specs,
      mainHoistEquipmentArrangement: "doubleDrum" as const,
      mainDoubleDrumHookSystem: "doubleHookBlock" as const,
    };
    const doubleHookIds = hiddenSectionCheckIds([], doubleHookSpecs);
    expect(doubleHookIds.has("hookBlock.girder.static")).toBe(true);
    expect(doubleHookIds.has("hookBlock.hook.capacity")).toBe(false);

    const liftingBeamIds = hiddenSectionCheckIds([], {
      ...doubleHookSpecs,
      mainDoubleDrumHookSystem: "liftingBeam" as const,
    });
    expect(liftingBeamIds.has("hookBlock.hook.capacity")).toBe(true);
    expect(liftingBeamIds.has("hookBlock.hookBearing.static")).toBe(true);
    expect(liftingBeamIds.has("hookBlock.girder.static")).toBe(false);
  });
});

describe("sectionDisplayNumbers", () => {
  const adapterOf = (key: string) => {
    const a = MODULE_ADAPTERS.find((m) => m.key === key);
    if (!a) throw new Error(`adaptör yok: ${key}`);
    return a;
  };
  /** Ham id kümesini düşüren yüklem (gizleme + koşullu bölüm aynı kapıdan). */
  const without =
    (...rawIds: string[]) =>
    (s: AdapterSection) =>
      !rawIds.includes(s.rawId);
  const all = () => true;

  it("modül numarasını basar ve alt bölümleri SIRAYLA numaralar", () => {
    // Ana araba yürütme (5.x) rapora 3. bölüm olarak giriyorsa: 5.1 → 3.1 …
    const nos = sectionDisplayNumbers(adapterOf("trolley").sections, 3, all);
    expect(nos.get("5.1")).toBe("3.1");
    expect(nos.get("5.7")).toBe("3.7");
  });

  it("gizlenen bölüm numarasını da götürür — sonrakiler bir öne kayar", () => {
    // Kullanıcının bildirdiği hâl: 3.6 gizlenince 3.7 boşluk bırakmamalı.
    const nos = sectionDisplayNumbers(adapterOf("trolley").sections, 3, without("5.6"));
    expect(nos.has("5.6")).toBe(false);
    expect(nos.get("5.5")).toBe("3.5");
    expect(nos.get("5.7")).toBe("3.6");
    expect(nos.get("5.8")).toBe("3.7");
    // Basılan numaralar boşluksuz bir dizidir.
    expect([...nos.values()]).toEqual(["3.1", "3.2", "3.3", "3.4", "3.5", "3.6", "3.7", "3.8"]);
  });

  it("koşullu bölüm (o vinçte yok) de boşluk bırakmaz", () => {
    // Tamponsuz bir arabada 5.8 hiç çizilmez; feston (5.9) onun yerine geçer.
    const nos = sectionDisplayNumbers(adapterOf("trolley").sections, 3, without("5.8"));
    expect(nos.get("5.9")).toBe("3.8");
  });

  it("alt kırılımı korur: 2.2.x ailesi tek üst numara altında 1'den sayar", () => {
    const nos = sectionDisplayNumbers(adapterOf("main").sections, 2, all);
    expect(nos.get("2.1")).toBe("2.1");
    expect(nos.get("2.2.1")).toBe("2.2.1");
    expect(nos.get("2.2.7")).toBe("2.2.7");
    expect(nos.get("2.3")).toBe("2.3");
  });

  it("aile içinden gizlenen bölüm yalnız KARDEŞLERİNİ kaydırır", () => {
    const nos = sectionDisplayNumbers(adapterOf("main").sections, 2, without("2.2.3"));
    expect(nos.get("2.2.2")).toBe("2.2.2");
    expect(nos.get("2.2.4")).toBe("2.2.3");
    // Ailenin dışı etkilenmez: 2.3 hâlâ 2.3.
    expect(nos.get("2.3")).toBe("2.3");
  });

  it("ailenin tamamı gizlenirse üst numara da harcanmaz", () => {
    const nos = sectionDisplayNumbers(
      adapterOf("main").sections,
      2,
      without("2.2.1", "2.2.2", "2.2.3", "2.2.4", "2.2.5", "2.2.6", "2.2.7")
    );
    expect(nos.get("2.1")).toBe("2.1");
    expect(nos.get("2.3")).toBe("2.2");
    expect(nos.get("2.4")).toBe("2.3");
  });

  it("harf sonekli ham id (5.5b) sıradan bir numara alır", () => {
    // "b" soneki bölümün sonradan araya girdiğini söyler — ham id ANAHTAR
    // olarak kalır ama müşteriye giden numara sıradan bir sayıdır.
    const nos = sectionDisplayNumbers(adapterOf("bridge").sections, 6, all);
    expect(nos.get("5.5")).toBe("6.5");
    expect(nos.get("5.5b")).toBe("6.6");
    expect(nos.get("5.6")).toBe("6.7");
  });

  it("hiçbir modülde numara yinelenmez ya da atlanmaz", () => {
    for (const adapter of MODULE_ADAPTERS) {
      const nos = sectionDisplayNumbers(adapter.sections, 4, all);
      const values = [...nos.values()];
      expect(new Set(values).size, `${adapter.key} yinelenen numara`).toBe(values.length);
      // Üst düzey numaralar 1'den başlayıp birer birer artar (alt kırılımın
      // bütün üyeleri AYNI üst numarayı taşır, o yüzden tekilleştirilir).
      const tops = [...new Set(values.map((v) => Number(v.split(".")[1])))];
      expect(tops, `${adapter.key} üst düzey dizisi`).toEqual(tops.map((_, i) => i + 1));
    }
  });
});

describe("diffRevisions — gizlenen alt bölümler", () => {
  const snap = (hidden?: string[]) => ({
    inputs: { specs: {}, hiddenSections: hidden ?? [] } as Record<string, unknown>,
    selections: {},
    results: null,
  });

  it("gizleme değişimini ayrı bir fark satırı olarak gösterir", () => {
    const diff = diffRevisions(snap([]), snap(["trolley-5.7"]));
    const row = diff.fields.find((f) => f.key === "hiddenSections");
    expect(row).toBeDefined();
    expect(row?.a).toBe("—");
    expect(row?.b).toBe("trolley-5.7");
    // Karşılaştırma ekranı anahtarı insan okunur etiketle basar.
    expect(fieldLabel("hiddenSections").label).toBe("Gizlenen Alt Bölümler");
  });

  it("liste aynıyken (sıra farklı olsa da) satır üretmez", () => {
    const a = snap(["main-2.8", "trolley-5.7"]);
    const b = snap(["trolley-5.7", "main-2.8"]);
    const diff = diffRevisions(a, b);
    expect(diff.fields.find((f) => f.key === "hiddenSections")).toBeUndefined();
  });
});
