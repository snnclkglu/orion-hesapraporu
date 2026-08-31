import { describe, expect, it } from "vitest";
import {
  MANUAL_PACKAGE_BOOK,
  applyManualPackage,
  manualAppendixOption,
  manualPackageDef,
  manualScopeDrift,
  manualSetAppendixOption,
  manualToggleSection,
  packageWantsHidden,
  suggestManualPackage,
} from "../packages";
import { manualFromTemplate, printedManual, usedAppendices } from "../payload";
import { MANUAL_TEMPLATE, type TemplateSection } from "../template";
import { MANUAL_APPENDIX_KINDS, type ManualPayload, type ManualSection } from "../types";

function sablonAnahtarlari(): Set<string> {
  const out = new Set<string>();
  const gez = (liste: readonly TemplateSection[]) => {
    for (const s of liste) {
      out.add(s.key);
      if (s.children) gez(s.children);
    }
  };
  gez(MANUAL_TEMPLATE);
  return out;
}

function ara(sections: readonly ManualSection[], key: string): ManualSection | null {
  for (const s of sections) {
    if (s.key === key) return s;
    const alt = ara(s.children, key);
    if (alt) return alt;
  }
  return null;
}

function bulKey(sections: readonly ManualSection[], key: string): ManualSection {
  const s = ara(sections, key);
  if (!s) throw new Error(`bölüm yok: ${key}`);
  return s;
}

function tazePayload(): ManualPayload {
  return manualFromTemplate({ craneType: "Gezer Köprü Vinci" });
}

// ————————————————————————————————————————————————————————————— defter

describe("paket defteri", () => {
  // BİR KURAL İKİ YERDE YAŞIYORSA AYRIŞMAYI TEST ENGELLER (değişmez md. 8).
  // Paket şablonun `key`lerine atıf yapar; bir bölüm yeniden adlandırılırsa
  // paket o bölümü sessizce gizlemeyi bırakır ve kimse fark etmez.
  it("her gizlenecek bölüm anahtarı ŞABLONDA VARDIR", () => {
    const anahtarlar = sablonAnahtarlari();
    for (const def of MANUAL_PACKAGE_BOOK) {
      const kopuk = def.hiddenSections.filter((k) => !anahtarlar.has(k));
      expect({ paket: def.key, kopuk }).toEqual({ paket: def.key, kopuk: [] });
    }
  });

  it("her ek seçeneği GERÇEK bir ek türüne bağlıdır", () => {
    for (const def of MANUAL_PACKAGE_BOOK) {
      for (const o of def.appendixOptions) {
        expect(MANUAL_APPENDIX_KINDS).toContain(o.kind);
        // Seçeneği verilen ek, o pakette GÖRÜNÜYOR olmalıdır; yoksa hiç
        // basılmayacak bir ekin biçimi ayarlanmış olurdu.
        expect(def.appendices).toContain(o.kind);
      }
    }
  });

  it("üç paket artan kapsamdadır", () => {
    const [standart, detayli, tam] = MANUAL_PACKAGE_BOOK;
    expect(standart.appendices.length).toBeLessThan(detayli.appendices.length);
    expect(detayli.appendices.length).toBeLessThan(tam.appendices.length);
    expect(tam.appendices).toHaveLength(MANUAL_APPENDIX_KINDS.length);
  });
});

// —————————————————————————————————————————————————————————— uygulama

describe("applyManualPackage", () => {
  it("standart pakette yalnız elektrik projesi eki basılır", () => {
    const { payload } = applyManualPackage(tazePayload(), "standart");
    expect(usedAppendices(printedManual(payload).sections)).toEqual(["elektrikProje"]);
  });

  it("tam teknik pakette yedi ekin tamamı basılır", () => {
    const { payload } = applyManualPackage(tazePayload(), "tamTeknik");
    expect(usedAppendices(printedManual(payload).sections)).toHaveLength(
      MANUAL_APPENDIX_KINDS.length
    );
  });

  it("ekipman bloğuna varyant yazar", () => {
    const { payload } = applyManualPackage(tazePayload(), "tamTeknik");
    const bolum = bulKey(payload.sections, "yedek.ekipman");
    const blok = bolum.blocks[0];
    expect(blok.kind === "auto" && blok.variant).toBe("kataloglu");
  });

  it("İKİNCİ UYGULAMA HİÇBİR ŞEYİ DEĞİŞTİRMEZ (idempotent)", () => {
    const bir = applyManualPackage(tazePayload(), "detayli").payload;
    const iki = applyManualPackage(bir, "detayli");
    expect(iki.degisen).toBe(0);
    expect(iki.payload.sections).toEqual(bir.sections);
  });

  it("paket değiştirmek GERİ ALINABİLİR — blok silinmez", () => {
    const taze = tazePayload();
    const tam = applyManualPackage(taze, "tamTeknik").payload;
    const geri = applyManualPackage(tam, "standart").payload;
    const yine = applyManualPackage(geri, "tamTeknik").payload;
    expect(usedAppendices(printedManual(yine).sections)).toHaveLength(
      MANUAL_APPENDIX_KINDS.length
    );
    // Gizlenen bölümlerin blokları AĞAÇTA durur: gizlemek silmek değildir.
    expect(bulKey(geri.sections, "yedek.elektrik").blocks).toHaveLength(1);
  });

  it("ANAHTARI OLMAYAN serbest bölüme dokunmaz", () => {
    const taze = tazePayload();
    taze.sections.push({
      id: "serbest",
      title: "Müşteriye özel not",
      blocks: [],
      children: [],
    });
    const { payload } = applyManualPackage(taze, "standart");
    const serbest = payload.sections.find((s) => s.id === "serbest")!;
    expect(serbest.hidden).toBeUndefined();
    expect(packageWantsHidden(manualPackageDef("standart"), serbest)).toBeNull();
  });

  it("ELLE DEĞİŞTİRİLEN VARYANTI EZMEZ", () => {
    const taze = applyManualPackage(tazePayload(), "tamTeknik").payload;
    const bolum = bulKey(taze.sections, "yedek.ekipman");
    bolum.blocks[0] = { ...bolum.blocks[0], edited: true, variant: "standart" } as never;
    const { payload } = applyManualPackage(taze, "detayli");
    const sonra = bulKey(payload.sections, "yedek.ekipman").blocks[0];
    expect(sonra.kind === "auto" && sonra.variant).toBe("standart");
  });
});

// ——————————————————————————————————————————————————————————— sapma

describe("kullanıcının kapsam sapması", () => {
  it("paketten sonra elle açılan bölüm KORUNUR", () => {
    const uygulanan = applyManualPackage(tazePayload(), "standart").payload;
    const gizli = bulKey(uygulanan.sections, "yedek.elektrik");
    expect(gizli.hidden).toBe(true);

    // Kullanıcı bölümü elle geri açıyor.
    const elle = manualToggleSection(uygulanan, gizli.id);
    expect(bulKey(elle.sections, "yedek.elektrik").hidden).toBeFalsy();
    expect(elle.scope.keptSections).toEqual(["yedek.elektrik"]);

    // Paket yeniden uygulanınca o karar EZİLMEZ.
    const yeniden = applyManualPackage(elle, "standart");
    expect(yeniden.korunan).toEqual(["yedek.elektrik"]);
    expect(bulKey(yeniden.payload.sections, "yedek.elektrik").hidden).toBeFalsy();
  });

  it("KENDİ KENDİNİ ONARIR: paketin dediği yere dönen bölüm sapma listesinden çıkar", () => {
    const uygulanan = applyManualPackage(tazePayload(), "standart").payload;
    const id = bulKey(uygulanan.sections, "yedek.elektrik").id;
    const acildi = manualToggleSection(uygulanan, id);
    expect(acildi.scope.keptSections).toEqual(["yedek.elektrik"]);
    const tekrarGizlendi = manualToggleSection(acildi, id);
    expect(tekrarGizlendi.scope.keptSections).toEqual([]);
  });

  it("PAKETİ BAŞTAN UYGULA sapmaları temizler", () => {
    const uygulanan = applyManualPackage(tazePayload(), "standart").payload;
    const id = bulKey(uygulanan.sections, "yedek.elektrik").id;
    const elle = manualToggleSection(uygulanan, id);
    const bastan = applyManualPackage(elle, "standart", { sapmalariYokSay: true });
    expect(bastan.korunan).toEqual([]);
    expect(bastan.payload.scope.keptSections).toEqual([]);
    expect(bulKey(bastan.payload.sections, "yedek.elektrik").hidden).toBe(true);
  });

  it("serbest kapsamda sapma diye bir şey yoktur", () => {
    const taze = tazePayload();
    const id = bulKey(taze.sections, "yedek.elektrik").id;
    const elle = manualToggleSection(taze, id);
    expect(elle.scope.keptSections).toEqual([]);
    expect(manualScopeDrift(elle)).toEqual({ sections: [], appendices: [] });
  });

  it("manualScopeDrift paketten sapan bölümleri bildirir", () => {
    const uygulanan = applyManualPackage(tazePayload(), "standart").payload;
    const id = bulKey(uygulanan.sections, "yedek.elektrik").id;
    const drift = manualScopeDrift(manualToggleSection(uygulanan, id));
    expect(drift.sections).toEqual([
      { key: "yedek.elektrik", title: "Elektrik Malzeme Özeti", paket: false, belge: true },
    ]);
  });
});

// —————————————————————————————————————————————————————— ek seçenekleri

describe("ek seçenekleri", () => {
  it("paket seçeneği verir", () => {
    const { payload } = applyManualPackage(tazePayload(), "detayli");
    expect(manualAppendixOption(payload, "mekanikHesap")).toBe("ozet");
    expect(manualAppendixOption(payload, "elektrikKatalog")).toBe("2");
  });

  it("ELLE VERİLEN SEÇENEK paket yeniden uygulanınca korunur", () => {
    const uygulanan = applyManualPackage(tazePayload(), "detayli").payload;
    const elle = manualSetAppendixOption(uygulanan, "mekanikHesap", "detayli");
    const yeniden = applyManualPackage(elle, "detayli").payload;
    expect(manualAppendixOption(yeniden, "mekanikHesap")).toBe("detayli");
    expect(manualScopeDrift(yeniden).appendices).toEqual([
      { kind: "mekanikHesap", option: "detayli", edited: true },
    ]);
  });
});

// ——————————————————————————————————————————————————————————— öneri

describe("suggestManualPackage", () => {
  // TÜRKÇE ı/I TUZAĞI: `/şarj/i` deseni "ŞARJ VİNCİ"yi bulmaz; karşılaştırma
  // `trKatla` ile yapılır ve bu test tam olarak onu sınar.
  it("büyük harfli Türkçe adlarda da çalışır", () => {
    expect(suggestManualPackage("185/40 TON ŞARJ VİNCİ")).toBe("tamTeknik");
    expect(suggestManualPackage("Şarj Vinci")).toBe("tamTeknik");
    expect(suggestManualPackage("POTA VİNCİ")).toBe("tamTeknik");
  });

  it("portal ve konsol vinçlerde detaylı önerir", () => {
    expect(suggestManualPackage("Portal Vinç")).toBe("detayli");
    expect(suggestManualPackage("PERGEL VİNÇ")).toBe("detayli");
  });

  it("bilinmeyen ve boş tipte standarda düşer", () => {
    expect(suggestManualPackage("Gezer Köprü Vinci")).toBe("standart");
    expect(suggestManualPackage("")).toBe("standart");
  });
});
