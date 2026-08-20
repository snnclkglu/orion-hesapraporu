// Kanca tanımı ve DIN 15407 lamel kanca tablosu.
//
// Testler tabloyu SATIR SATIR tekrarlamaz (o, tablonun kendisini iki kez yazmak
// olurdu); tablonun İÇ TUTARLILIĞINI ve seçim mantığını ölçer. Kaynak:
// DIN 15407 Teil 1 (Eylül 1977), "Zusammenstellung — Hauptmaße".

import { describe, expect, it } from "vitest";
import {
  DEFAULT_HOOK_STANDARD,
  DIN15407_KEYS,
  DIN15407_ROWS,
  HOOK_STANDARDS,
  din15407Key,
  din15407Label,
  din15407Row,
  hookDesignationText,
  hookNumberOptions,
  hookStandardOf,
  isLamellaHook,
  smallestDin15407Key,
} from "../hook-standards";
import { HOOK_NUMBERS } from "../hook-table";
import { DRUM_DIA_SERIES_MM } from "../fields";
import { HOOKBLOCK_SECTIONS } from "../presentation/hookBlockSections";
import { HOOKBLOCK_SELECTION_FIELDS } from "../presentation/hookBlockFields";
import { computeHookBlock } from "../modules/hookBlock";
import {
  V5_HOOKBLOCK_DEPS,
  V5_HOOKBLOCK_INPUTS,
  V5_HOOKBLOCK_SELECTIONS,
} from "../defaults/hookBlock";
import { NEW_WORK_TEMPLATE } from "../defaults";

describe("DIN 15407 lamel kanca tablosu", () => {
  it("standardın 20 satırını taşır ve anahtarlar TEKİLDİR", () => {
    expect(DIN15407_ROWS).toHaveLength(20);
    expect(new Set(DIN15407_KEYS).size).toBe(DIN15407_ROWS.length);
  });

  it("kapasite TEK BAŞINA satırı belirlemez — anahtar ağız yarıçapını da taşır", () => {
    // 25 · 40 · 63 · 100 · 160 · 250 t'nin İKİŞER satırı var; anahtar
    // yalnız tonaj olsaydı altı satır sessizce kaybolurdu.
    const tekrarli = DIN15407_ROWS.filter(
      (r) => DIN15407_ROWS.filter((o) => o.capacityT === r.capacityT).length > 1
    );
    expect(tekrarli.length).toBe(12);
    for (const r of tekrarli) {
      expect(din15407Key(r)).toContain(`x${r.a1}`);
    }
  });

  it("her satır kendi içinde tutarlıdır (b₂ > b₁, a₂ > a₁, l₁ > l₂)", () => {
    for (const r of DIN15407_ROWS) {
      // Paketin dış genişliği lamel paketinden büyüktür (yan sac payı).
      expect(r.b2).toBeGreaterThan(r.b1);
      // Ağız genişliği yarıçapından büyüktür.
      expect(r.a2).toBeGreaterThan(r.a1);
      // Toplam boy, üst delik ekseninden ölçülen boydan büyüktür.
      expect(r.l1).toBeGreaterThan(r.l2);
      // Lamel adedi ile paket kalınlığı aynı yönde büyür.
      expect(r.plateCount).toBeGreaterThanOrEqual(2);
      expect(r.s1).toBeGreaterThan(0);
    }
  });

  it("vinç kapasitesi kancanınkinin İKİ KATIDIR (pota İKİ kancaya asılır)", () => {
    // İki kat, R10 (Renard) serisine oturtulmuş hâliyle: 32 t kanca 63 t vincin
    // (64 değil), 320 t kanca 630 t vincin (640 değil) kancasıdır. Sapma bu
    // yuvarlamadan ibarettir; %2'yi aşan bir fark tablonun yanlış okunduğunu
    // söyler (iki sütun KARIŞTIRILIRSA kanca iki kat büyük seçilir).
    for (const r of DIN15407_ROWS) {
      const sapma = Math.abs(r.craneCapacityT - r.capacityT * 2) / (r.capacityT * 2);
      expect(sapma).toBeLessThan(0.02);
    }
  });

  it("aynı ağız yarıçapını paylaşan satırlar ortak ölçüleri paylaşır", () => {
    // d₁ · g₁ · l₁ · l₂ · s₁ standartta a₁ grubuna göre BİRLEŞTİRİLMİŞ
    // hücrelerdir; grup içinde farklılaşırlarsa tablo yanlış okunmuş demektir.
    const gruplar = new Map<number, typeof DIN15407_ROWS[number][]>();
    for (const r of DIN15407_ROWS) {
      gruplar.set(r.a1, [...(gruplar.get(r.a1) ?? []), r]);
    }
    expect(gruplar.size).toBe(7);
    for (const rows of gruplar.values()) {
      for (const r of rows) {
        expect([r.d1, r.g1, r.l1, r.l2, r.s1]).toEqual([
          rows[0].d1, rows[0].g1, rows[0].l1, rows[0].l2, rows[0].s1,
        ]);
      }
    }
  });

  it("kullanıcının örnek kancasını (63 × 150) birebir verir", () => {
    const row = din15407Row("63x150");
    expect(row).toBeDefined();
    expect(row).toMatchObject({
      capacityT: 63, a1: 150, a2: 225, b1: 140, b2: 172,
      d1: 160, g1: 340, l1: 1250, l2: 250, s1: 20,
      plateCount: 5, craneCapacityT: 125,
    });
    expect(din15407Label(row!)).toBe("63 × 150");
  });

  it("tanınmayan anahtarda satır UYDURMAZ", () => {
    expect(din15407Row("10")).toBeUndefined();
    expect(din15407Row("63x999")).toBeUndefined();
    expect(din15407Row(undefined)).toBeUndefined();
  });

  it("en küçük kanca önerisi yükü GERÇEKTEN taşır", () => {
    expect(smallestDin15407Key(15_000)).toBe("16x110");
    expect(smallestDin15407Key(16_000)).toBe("16x110");
    expect(smallestDin15407Key(16_001)).toBe("20x110");
    // Kapasitesi eşit iki satırdan KÜÇÜK ağızlı olan önerilir.
    expect(smallestDin15407Key(25_000)).toBe("25x110");
    // Tablonun üstünde kalan yükte öneri YOKTUR (uydurma bir boy dönmez).
    expect(smallestDin15407Key(400_000)).toBeUndefined();
    expect(smallestDin15407Key(0)).toBeUndefined();
  });
});

describe("kanca tanımı (standart seçimi)", () => {
  it("dört tanım vardır ve eksik değer DIN 15401'e düşer", () => {
    expect(HOOK_STANDARDS).toEqual([
      "DIN 15401", "DIN 15402", "DIN 15407", "DIN 15408",
    ]);
    expect(hookStandardOf(undefined)).toBe(DEFAULT_HOOK_STANDARD);
    expect(hookStandardOf("DIN 15499")).toBe(DEFAULT_HOOK_STANDARD);
    expect(DEFAULT_HOOK_STANDARD).toBe("DIN 15401");
  });

  it("lamel olan İKİ tanımdır", () => {
    expect(isLamellaHook("DIN 15407")).toBe(true);
    expect(isLamellaHook("DIN 15408")).toBe(true);
    expect(isLamellaHook("DIN 15401")).toBe(false);
    expect(isLamellaHook(undefined)).toBe(false);
  });

  it("kanca numarası listesi SEÇİLEN TANIMA göre değişir", () => {
    expect(hookNumberOptions("DIN 15401", HOOK_NUMBERS)).toEqual(HOOK_NUMBERS);
    expect(hookNumberOptions("DIN 15402", HOOK_NUMBERS)).toEqual(HOOK_NUMBERS);
    expect(hookNumberOptions("DIN 15407", HOOK_NUMBERS)).toEqual(DIN15407_KEYS);
    // DIN 15408'in tablosu yok: liste boştur, kapasite elle girilir.
    expect(hookNumberOptions("DIN 15408", HOOK_NUMBERS)).toEqual([]);
  });

  it("tam tanım metni standarda göre kurulur", () => {
    expect(
      hookDesignationText({ hookStandard: "DIN 15401", hookNumber: "10", hookStrengthClass: "S" })
    ).toBe("DIN 15401 Nr 10 S");
    expect(
      hookDesignationText({ hookStandard: "DIN 15402", hookNumber: "16" })
    ).toBe("DIN 15402 Nr 16");
    expect(
      hookDesignationText({ hookStandard: "DIN 15407", hookNumber: "63x150" })
    ).toBe("DIN 15407 — 63 × 150");
    // Boy seçilmemişken OLMAYAN bir boy uydurulmaz.
    expect(hookDesignationText({ hookStandard: "DIN 15408" })).toBe("DIN 15408");
    expect(
      hookDesignationText({ hookStandard: "DIN 15407", hookNumber: "10" })
    ).toBe("DIN 15407");
  });

  // JSONB'den SAYI gelen kanca numarası bir kez revizyon sayfasını 500'e
  // düşürdü (`sel.hookNumber?.trim()` — `?.` yanlış TİPE karşı korumaz).
  // Yazma yolu kapatıldı, ama motor bir revizyonu AÇAMAZSA yayınlanmış bir
  // raporun onarımı yoktur; okuma tarafı da kendini savunur.
  it("sayı olarak kaydedilmiş kanca numarasında ÇÖKMEZ", () => {
    expect(
      hookDesignationText({
        hookStandard: "DIN 15401",
        hookNumber: 250 as unknown as string,
        hookStrengthClass: "S",
      })
    ).toBe("DIN 15401 Nr 250 S");
    expect(
      hookDesignationText({ hookStandard: "DIN 15402", hookNumber: 2.5 as unknown as string })
    ).toBe("DIN 15402 Nr 2.5");
    // Mukavemet sınıfı da aynı kaynaktan gelir.
    expect(
      hookDesignationText({
        hookStandard: "DIN 15401",
        hookNumber: "10",
        hookStrengthClass: 8 as unknown as string,
      })
    ).toBe("DIN 15401 Nr 10");
    // Lamel anahtarı sayıya çevrilemez; olmayan bir boy UYDURULMAZ.
    expect(din15407Row(250 as unknown as string)).toBeUndefined();
    expect(
      hookDesignationText({ hookStandard: "DIN 15407", hookNumber: 250 as unknown as string })
    ).toBe("DIN 15407");
  });
});

describe("kanca bloğu — kapasitenin kaynağı", () => {
  const run = (sel: Partial<typeof V5_HOOKBLOCK_SELECTIONS>) =>
    computeHookBlock(
      NEW_WORK_TEMPLATE.specs,
      "hookBlock",
      V5_HOOKBLOCK_INPUTS,
      { ...V5_HOOKBLOCK_SELECTIONS, ...sel },
      { ...V5_HOOKBLOCK_DEPS, loadKg: 40_000 }
    );

  it("lamel kancada kapasite TABLONUN KENDİ satırından gelir", () => {
    const r = run({ hookStandard: "DIN 15407", hookNumber: "63x150" });
    expect(r.values.hookCapacityKg).toBe(63_000);
    expect(r.values.hookCapacityFromTable).toBe(true);
    expect(r.values.lamellaRow?.a1).toBe(150);
    expect(r.values.hookDesignationText).toBe("DIN 15407 — 63 × 150");
    // Ölçüler hücre haritasına da girer (rapor satırları oradan okur).
    expect(r.cells["hook.d1"]).toBe(160);
    expect(r.cells["hook.plateCount"]).toBe(5);
    expect(r.cells["hook.craneCapacity"]).toBe(125_000);
  });

  it("lamel kancada MUKAVEMET SINIFI kapasiteyi değiştirmez", () => {
    const m = run({ hookStandard: "DIN 15407", hookNumber: "63x150", hookStrengthClass: "M" });
    const v = run({ hookStandard: "DIN 15407", hookNumber: "63x150", hookStrengthClass: "V" });
    expect(m.values.hookCapacityKg).toBe(v.values.hookCapacityKg);
  });

  it("dövme kanca yolu DEĞİŞMEDİ — DIN 15400 Tablo 3 okunur", () => {
    const r = run({ hookStandard: "DIN 15401", hookNumber: "10", hookStrengthClass: "S" });
    expect(r.values.hookCapacityFromTable).toBe(true);
    expect(r.values.hookIsLamella).toBe(false);
    expect(r.values.lamellaRow).toBeUndefined();
    expect(r.cells["hook.d1"]).toBeUndefined();
  });

  it("DIN 15408 için tablo yoksa elle yazılan eski değeri kullanmaz ve uygunluk vermez", () => {
    const r = run({ hookStandard: "DIN 15408", hookNumber: undefined, hookCapacityKg: 50_000 });
    expect(r.values.hookCapacityFromTable).toBe(false);
    expect(r.values.hookCapacityKg).toBe(0);
    expect(r.values.hookDesignationText).toBe("DIN 15408");
    const kapasite = r.checks.find((c) => c.id === "hookBlock.hook.capacity");
    expect(kapasite?.pass).toBe(false);
  });

  it("kapasitenin KAYNAĞI raporda yazar (kontrol değil, künye satırı)", () => {
    const bolum = HOOKBLOCK_SECTIONS.find((s) => s.id === "4.1")!;
    const satir = bolum.rows.find((r) => r.key === "hook.capacitySource")!;
    const ctx = (sel: Partial<typeof V5_HOOKBLOCK_SELECTIONS>) => {
      const secim = { ...V5_HOOKBLOCK_SELECTIONS, ...sel };
      return {
        c: {}, v: run(sel).values, inp: V5_HOOKBLOCK_INPUTS, sel: secim,
        deps: V5_HOOKBLOCK_DEPS, specs: NEW_WORK_TEMPLATE.specs,
      };
    };
    expect(satir.valueFrom!(ctx({ hookStandard: "DIN 15401", hookNumber: "10", hookStrengthClass: "S" })))
      .toBe("DIN 15400 Tablo 3");
    expect(satir.valueFrom!(ctx({ hookStandard: "DIN 15407", hookNumber: "63x150" })))
      .toBe("DIN 15407 Tablo 1");
    expect(satir.valueFrom!(ctx({ hookStandard: "DIN 15408", hookNumber: undefined })))
      .toBe("Standart kapasite satırı bulunamadı — seçim uygun değil");
  });

  it("kapasite yükü karşılamıyorsa kontrol DÜŞER", () => {
    const r = run({ hookStandard: "DIN 15407", hookNumber: "16x110" });
    const kapasite = r.checks.find((c) => c.id === "hookBlock.hook.capacity");
    expect(kapasite?.pass).toBe(false);
    expect(kapasite?.standard).toBe("DIN 15407");
    // Öneri gerçekten yükü taşıyan en küçük boydur.
    expect(r.values.suggestedHookNumber).toBe("40x130");
  });
});

describe("§4.2 makara çapı — standart seriye iniş toleransı", () => {
  // Kullanıcının örneği bir ÇARPIMdır: D_min = 1008 mm. Standart seride 1000
  // var, sonraki basamak 1100 — 8 mm için bir boy büyüğe geçilmez.
  //
  // Fikstür M8 sınıfını kullanır: FEM T.4.2.3.1.1'de makara katsayısı H en çok
  // 28'dir (M8) ve 28 × Ø36 halat tam olarak 1008 eder. Kuralın kendisi H'den
  // bağımsızdır; ölçülen şey ÇARPIMIN standart seriye oturmasıdır.
  const SPECS = { ...NEW_WORK_TEMPLATE.specs, hoistMechanismClass: "M8" as const };
  const ROPE_MM = 36;
  const MIN_DIA = 1008;

  const run = (sheaveDiaMm: number) =>
    computeHookBlock(
      SPECS,
      "hookBlock",
      V5_HOOKBLOCK_INPUTS,
      { ...V5_HOOKBLOCK_SELECTIONS, sheaveDiaMm },
      { ...V5_HOOKBLOCK_DEPS, ropeDiaMm: ROPE_MM }
    );

  it("örnek birebir çıkar: D_min 1008 mm, 1000 mm UYGUN", () => {
    const r = run(1000);
    expect(r.values.sheaveCoefficientH * ROPE_MM).toBe(MIN_DIA);
    expect(r.values.minSheaveDiaMm).toBe(MIN_DIA);
    expect(r.values.acceptedMinSheaveDiaMm).toBeCloseTo(MIN_DIA * 0.98, 6);
    const c = r.checks.find((x) => x.id === "hookBlock.sheave.dia");
    expect(c?.pass).toBe(true);
    // Sapma yazılır ve gerçekten küçüktür: (1008 − 1000) / 1008 = %0,79
    expect(r.values.sheaveDiaToleranceUsed).toBe(true);
    expect(r.values.sheaveDiaShortfallPct).toBeCloseTo(0.7937, 3);
  });

  it("%2'yi AŞAN eksiklik hâlâ ENGELLEYİCİdir", () => {
    // 1008 · 0,98 = 987,84 → 987 mm bandın dışındadır.
    const c = run(987).checks.find((x) => x.id === "hookBlock.sheave.dia");
    expect(c?.pass).toBe(false);
    expect(c?.severity).toBe("engelleyici");
    // 900 mm bir boy küçüktür (%10,7) — tolerans bunu ASLA kurtarmaz.
    expect(run(900).checks.find((x) => x.id === "hookBlock.sheave.dia")?.pass).toBe(false);
  });

  it("sınırın ÜSTÜNDEKİ seçimde tolerans KULLANILMIŞ SAYILMAZ", () => {
    const r = run(1100);
    expect(r.checks.find((x) => x.id === "hookBlock.sheave.dia")?.pass).toBe(true);
    expect(r.values.sheaveDiaToleranceUsed).toBe(false);
    // Sapma satırı basılmaz — "eksiklik −%9" bir yanlış alarmdır (RESIM-18 / HESAP-3).
    const bolum = HOOKBLOCK_SECTIONS.find((s) => s.id === "4.2")!;
    const satir = bolum.rows.find((x) => x.key === "sheave.diaShortfall")!;
    const ctx = (v: typeof r.values) => ({
      c: {}, v, inp: V5_HOOKBLOCK_INPUTS,
      sel: { ...V5_HOOKBLOCK_SELECTIONS, sheaveDiaMm: 1100 },
      deps: { ...V5_HOOKBLOCK_DEPS, ropeDiaMm: ROPE_MM },
      specs: SPECS,
    });
    expect(satir.visible!(ctx(r.values))).toBe(false);
    expect(satir.visible!({ ...ctx(r.values), v: run(1000).values })).toBe(true);
  });

  it("makara çapı TAMBURLA AYNI standart seriden seçilir", () => {
    const alan = HOOKBLOCK_SELECTION_FIELDS.find((f) => f.key === "sheaveDiaMm")!;
    expect(alan.type).toBe("select");
    expect(alan.options).toBe(DRUM_DIA_SERIES_MM);
    // Liste bir ÖNERİDİR: ara bir çap elle yazılabilir.
    expect(alan.allowCustom).toBe(true);
    expect(alan.numeric).toBe(true);
  });

  it("eski (liste dışı) bir çap sessizce DEĞİŞMEZ", () => {
    // Kayıtlı revizyonların 450 mm'lik makarası listede yok; motor onu olduğu
    // gibi okur ve editör listeye kendi seçeneği olarak ekler.
    expect((DRUM_DIA_SERIES_MM as readonly string[]).includes("450")).toBe(true);
    const r = run(1008);
    expect(r.checks.find((x) => x.id === "hookBlock.sheave.dia")?.pass).toBe(true);
    expect(r.values.sheaveDiaToleranceUsed).toBe(false);
  });
});

describe("kanca bloğu — kapasite kontrolü (yük karşılaştırması)", () => {
  const run = (sel: Partial<typeof V5_HOOKBLOCK_SELECTIONS>) =>
    computeHookBlock(
      NEW_WORK_TEMPLATE.specs,
      "hookBlock",
      V5_HOOKBLOCK_INPUTS,
      { ...V5_HOOKBLOCK_SELECTIONS, ...sel },
      { ...V5_HOOKBLOCK_DEPS, loadKg: 40_000 }
    );

  it("kapasite yükü karşılamıyorsa kontrol DÜŞER", () => {
    const r = run({ hookStandard: "DIN 15407", hookNumber: "16x110" });
    const kapasite = r.checks.find((c) => c.id === "hookBlock.hook.capacity");
    expect(kapasite?.pass).toBe(false);
    expect(kapasite?.standard).toBe("DIN 15407");
    // Öneri gerçekten yükü taşıyan en küçük boydur.
    expect(r.values.suggestedHookNumber).toBe("40x130");
  });
});
