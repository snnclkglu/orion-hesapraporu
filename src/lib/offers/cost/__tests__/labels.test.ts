// ALAN DEFTERİNİN BÜTÜNLÜĞÜ — tek bir test, dört ayrı kusur sınıfını kapatır.
//
// Buradaki hiçbir iddia bir sayı hakkında değildir; hepsi defterin KENDİSİ
// hakkındadır. Sebep şudur: bu kusurların dördü de 18.08.2026 turunda ekranda
// GÖRÜLDÜ ama hiçbiri bir hata gibi görünmedi.
//
//   · `c.deflectionLimit` İKİ bölümde tanımlıydı → satır ekranda ve PDF'te
//     iki kez çıkıyor, `costFieldDef` sessizce sonuncusunu seçiyordu.
//   · `c.capacityT`in tanımı YOKTU → on ayrı alanın "ara değerler" listesinde
//     ham anahtar basılıyordu ("c.capacityT").
//   · `c.deflectionRatio`nun `deps`i `c.deflectionMm` diyordu → pop-up
//     "3.000 cm ÷ 20,5 mm = 1.463" gösteriyor, okuyan tutturamıyordu.
//   · `${onek}ReqPowerKw` modelde üretiliyor ama defterde yoktu → motorun
//     neden bir üst boya çıktığı ekrandan okunamıyordu.
//
// Dördü de "bir anahtar defterde karşılıksız kaldı" ya da "iki kez yazıldı"
// biçimindedir. Aşağıdaki testler o iki cümleyi ölçer; yeni bir alan eklerken
// aynı hatayı yapmak artık kırmızıya düşer (MALIYET-17, MALIYET-18).

import { describe, expect, it } from "vitest";
import {
  AGIRLIK_OZET_KEY,
  CALC_SECTIONS,
  COST_FIELD_KEYS,
  WEIGHT_SECTIONS,
  costFieldDef,
  costFieldText,
} from "../labels";
import { COST_PARAM_DEFS } from "../params";
import { COST_GROUP_DEFS, MATERIAL_PRICE_DEFS } from "../registry";
import { adBuyuk } from "@/lib/tr-text";
import { emptyCostInputs } from "../payload";
import { hesapla } from "../model";
import { COST_PARAM_DEFAULTS } from "../params";

const BOLUMLER = [...WEIGHT_SECTIONS, ...CALC_SECTIONS];
const ALANLAR = BOLUMLER.flatMap((s) => s.fields);

describe("alan defteri — anahtar TEKİLDİR (MALIYET-17)", () => {
  it("hiçbir alan anahtarı iki bölümde birden tanımlı değildir", () => {
    const sayac = new Map<string, string[]>();
    for (const s of BOLUMLER) {
      for (const f of s.fields) {
        sayac.set(f.key, [...(sayac.get(f.key) ?? []), s.key]);
      }
    }
    const cift = [...sayac.entries()].filter(([, bolumler]) => bolumler.length > 1);
    // `ALAN_HARITASI` bir `Object.fromEntries`tir: çift anahtar sessizce
    // sonuncuyu seçer ve satırı ekranda İKİ KEZ çizer.
    expect(cift.map(([k, b]) => `${k} → ${b.join(", ")}`)).toEqual([]);
  });

  it("bölüm anahtarları da tekildir", () => {
    const anahtarlar = BOLUMLER.map((s) => s.key);
    expect(anahtarlar.length).toBe(new Set(anahtarlar).size);
  });

  it("ağırlık özetinin bölüm anahtarı WEIGHT_SECTIONS içinde vardır", () => {
    // Ekran özeti bu anahtarla AYIRIP girdilerin yanına koyuyor (MALIYET-20).
    // Anahtar kayarsa özet hem üstte hem sütunların içinde çizilirdi.
    expect(WEIGHT_SECTIONS.some((s) => s.key === AGIRLIK_OZET_KEY)).toBe(true);
  });
});

describe("alan defteri — her anahtarın bir tanımı vardır (MALIYET-18)", () => {
  it("bütün `deps` anahtarları defterde karşılığını bulur", () => {
    const eksik = new Set<string>();
    for (const f of ALANLAR) {
      for (const d of f.deps ?? []) {
        if (!costFieldDef(d)) eksik.add(`${f.key} → ${d}`);
      }
    }
    // Tanımsız anahtar pop-up'ta HAM hâliyle basılır.
    expect([...eksik]).toEqual([]);
  });

  it("bütün `qtySource` anahtarları defterde karşılığını bulur", () => {
    const eksik = new Set<string>();
    for (const g of COST_GROUP_DEFS) {
      for (const l of g.lines) {
        if (l.qtySource && !costFieldDef(l.qtySource)) eksik.add(`${g.key}/${l.key} → ${l.qtySource}`);
      }
    }
    expect([...eksik]).toEqual([]);
  });

  it("bütün `paramKeys` anahtarları katsayı defterinde karşılığını bulur", () => {
    const katsayilar = new Set(COST_PARAM_DEFS.map((d) => d.key));
    const eksik = new Set<string>();
    for (const f of ALANLAR) {
      for (const k of f.paramKeys ?? []) {
        if (!katsayilar.has(k)) eksik.add(`${f.key} → ${k}`);
      }
    }
    expect([...eksik]).toEqual([]);
  });

  it("çizilmeyen ama defterde yaşayan alanların adı vardır", () => {
    // Bunların ekranda SATIRI yoktur ama `deps`/`qtySource` listelerinde
    // geçerler; adsız kalırlarsa pop-up ham anahtar basar.
    for (const k of ["c.capacityT", "c.deflectionCm", "c.one"]) {
      const def = costFieldDef(k);
      expect(def, k).toBeDefined();
      expect(def!.label, k).not.toBe("");
      expect(def!.label, k).not.toContain(".");
    }
    expect(COST_FIELD_KEYS).toContain("c.capacityT");
  });

  it("modelin ürettiği her `c.*`/`w.*` değeri defterde adlandırılmıştır", () => {
    // Devralınan ASTOR girdileriyle model ne üretiyorsa hepsinin bir adı
    // olmalıdır: adsız bir değer PDF'te ve pop-up'ta anahtarıyla görünür.
    const r = hesapla(
      {
        ...emptyCostInputs(true),
        capacityT: 32,
        auxCapacityT: 5,
        spanM: 30,
        liftHeightM: 12,
        liftSpeedMpm: 4,
        trolleySpeedMpm: 20,
        bridgeSpeedMpm: 20,
        craneClass: "M6",
        bridgeWheelCount: 8,
        bridgeDriveCount: 4,
        legHeightM: 12,
        cabin: true,
        electricRoom: true,
        heatShield: true,
      },
      { ...COST_PARAM_DEFAULTS }
    );
    const adsiz = Object.keys(r.values).filter((k) => !costFieldDef(k));
    expect(adsiz).toEqual([]);
  });
});

describe("MALİYET KALEMİ ADLARI BÜYÜK HARFTİR (kullanıcı isteği 19.08.2026)", () => {
  // Kural VERİDE yaşar, çizimde değil: ad belgeye kopyalanır (`costLineFromDef`)
  // ve PDF onu ham basar. Defterde küçük harfle yazılmış bir ad, okuma geçidinde
  // (`lineFromRaw` → `adBuyuk`) sessizce büyür ve defter ile belge ayrışırdı;
  // test o ayrışmayı defterin KENDİSİNDE yakalar (değişmez md. 8).
  it("defterdeki her satır adı ve grup başlığı `adBuyuk` yazımındadır", () => {
    const kucuk: string[] = [];
    for (const g of COST_GROUP_DEFS) {
      if (g.title !== adBuyuk(g.title)) kucuk.push(`${g.key} (başlık): ${g.title}`);
      for (const l of g.lines) {
        if (l.label !== adBuyuk(l.label)) kucuk.push(`${g.key}/${l.key}: ${l.label}`);
      }
    }
    expect(kucuk).toEqual([]);
  });

  it("hammadde şeridinin adları da büyüktür", () => {
    const kucuk = MATERIAL_PRICE_DEFS.filter((d) => d.label !== adBuyuk(d.label));
    expect(kucuk.map((d) => d.key)).toEqual([]);
  });

  it("düz `toUpperCase` KULLANILMAZ — 'İ' ve 'ı' bozulur", () => {
    // "Çelik İmalat İşçiliği" → toUpperCase ile "CELIK IMALAT ISCILIGI".
    const imalat = COST_GROUP_DEFS.find((g) => g.key === "fabrication")!.lines[0].label;
    expect(imalat).toBe("ÇELİK İMALAT İŞÇİLİĞİ (FİRE DAHİL)");
    expect(imalat).not.toBe("Çelik İmalat İşçiliği (fire dahil)".toUpperCase());
  });
});

describe("ara değerler HESABIN BİRİMİNDEDİR", () => {
  it("sehim oranı santimetreyi anar, milimetreyi değil", () => {
    // Oran `spanCm / deflectionCm`dir. `deps` milimetreyi andığında pop-up
    // "3.000 ÷ 20,5 = 1.463" diyordu; okuyan tutturamaz.
    const def = costFieldDef("c.deflectionRatio");
    expect(def?.deps).toContain("c.deflectionCm");
    expect(def?.deps).not.toContain("c.deflectionMm");
  });

  it("sehim EKRANDA milimetredir ve santimetrenin tam on katıdır", () => {
    const r = hesapla(
      {
        ...emptyCostInputs(true),
        capacityT: 32,
        spanM: 30,
        liftHeightM: 12,
        liftSpeedMpm: 4,
        trolleySpeedMpm: 20,
        bridgeSpeedMpm: 20,
        craneClass: "M6",
        bridgeWheelCount: 8,
        bridgeDriveCount: 4,
        legHeightM: 12,
      },
      { ...COST_PARAM_DEFAULTS }
    );
    expect(costFieldDef("c.deflectionMm")?.unit).toBe("mm");
    expect(r.values["c.deflectionMm"]).toBeCloseTo((r.values["c.deflectionCm"] ?? 0) * 10, 9);
    // Sehim ve oranı EZİLEMEZ: ikisi de aynı sonucun başka bir yazılışıdır,
    // ayrı ayrı ezmek aynı kiriş için iki farklı sehim doğururdu.
    expect(costFieldDef("c.deflectionMm")?.readOnly).toBe(true);
    expect(costFieldDef("c.deflectionRatio")?.readOnly).toBe(true);
  });
});

describe("çap öneki (kullanıcı isteği md. 4)", () => {
  it("⌀ taşıyan her alan bir KATALOG BOYUDUR (listeden seçilir)", () => {
    const onekli = ALANLAR.filter((f) => f.prefix === "⌀");
    expect(onekli.length).toBeGreaterThan(0);
    // Çap serbest yazılamaz: teker grubu ağırlığı çapı TABLODA ARAR ve
    // listede olmayan bir çapta ağırlık sessizce `null` düşerdi (MALIYET-19).
    for (const f of onekli) {
      expect(f.choices, f.key).toBeDefined();
      expect(f.choices!.length, f.key).toBeGreaterThan(0);
    }
  });

  it("önek BOŞ DEĞERE basılmaz", () => {
    const def = costFieldDef("c.hoistDrumDiaMm")!;
    expect(costFieldText(def, 410)).toBe("⌀ 410");
    // "⌀ —" hesaplanmış ama sıfır çıkmış bir çap gibi okunur; oysa orada hiç
    // çap yoktur (değişmez md. 4).
    expect(costFieldText(def, null)).toBe("—");
  });
});
