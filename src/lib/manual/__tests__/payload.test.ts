// El kitabı çekirdeğinin birim testleri.
//
// EN PAHALI HATA GİZLEMEDİR (TEKLIF-4'ün dersi): gizlenen bir bölüm ekrandan
// düşüp belgeye girmeye devam ederse müşteri, olmayan bir donanımın
// talimatını okur. Bu yüzden süzgecin testi burada en ayrıntılı olanıdır.

import { describe, expect, it } from "vitest";
import {
  allBlocks,
  flattenManual,
  manualDraftForNextRevision,
  manualFromProjectTemplate,
  manualFromTemplate,
  numberManual,
  printedManual,
  usedAppendices,
  withManualDefaults,
} from "../payload";
import { MANUAL_TEMPLATE_VERSION } from "../template";
import { manualDocCode, MANUAL_DOC_TITLE } from "../naming";
import type { ManualPayload, ManualSection } from "../types";

function bolum(over: Partial<ManualSection> & { id: string }): ManualSection {
  return { title: "", blocks: [], children: [], ...over };
}

const govde = (sections: ManualSection[]): ManualPayload => ({
  v: 1,
  docTitle: "",
  coverTitle: "",
  partnerLogos: {},
  identity: withManualDefaults({}).identity,
  sections,
  templateVersion: MANUAL_TEMPLATE_VERSION,
});

describe("manualFromTemplate", () => {
  it("şablondan ağaç kurar ve künyeyi çağırandan alır", () => {
    const m = manualFromTemplate({ customer: "KARDEMİR", craneType: "GEZER KÖPRÜ VİNCİ" });
    expect(m.sections.length).toBeGreaterThan(5);
    expect(m.identity.customer).toBe("KARDEMİR");
    // Verilmeyen alan BOŞ kalır — uydurulmaz (değişmez md. 4).
    expect(m.identity.serialNo).toBe("");
    expect(m.partnerLogos).toEqual({});
    expect(m.templateVersion).toBe(MANUAL_TEMPLATE_VERSION);
  });

  it("ŞABLONDA VİNCE ÖZEL SAYI YOKTUR", () => {
    // Kaynak kılavuzdaki o vince ait değerler şablona sızarsa otuz kılavuz
    // sonra kimsenin fark etmeyeceği bir yalan olur.
    const metin = JSON.stringify(manualFromTemplate());
    for (const yasak of ["185T", "185/40", "192.168.221", "028.00", "Kardemir", "KARÇEL"]) {
      expect(metin).not.toContain(yasak);
    }
  });

  it("her blok şablondan geldiğini işaretler", () => {
    const bloklar = allBlocks(manualFromTemplate().sections);
    expect(bloklar.length).toBeGreaterThan(20);
    expect(bloklar.every((b) => b.fromTemplate)).toBe(true);
    expect(bloklar.some((b) => b.edited)).toBe(false);
  });

  it("müşterinin istediği yedi ek bağlıdır", () => {
    expect(usedAppendices(manualFromTemplate().sections)).toEqual([
      "mekanikHesap",
      "mekanikProje",
      "mekanikKatalog",
      "elektrikHesap",
      "elektrikProje",
      "elektrikKatalog",
      "sartname",
    ]);
  });
});

describe("manualDraftForNextRevision", () => {
  it("revizyon kalmadığında proje künyesiyle şablondan V1 açar", () => {
    const draft = manualDraftForNextRevision(null, {
      customer: "LİTEC MAKİNA",
      product: "20 T KAPASİTELİ KEPÇELİ VİNÇ",
      craneType: "VİNÇ ARABASI",
      coverTitle: "MEVCUT EL KİTABI BAŞLIĞI",
    });

    expect(draft.revNo).toBe(1);
    expect(draft.copiedFromPrevious).toBe(false);
    expect(draft.payload.docTitle).toBe(MANUAL_DOC_TITLE);
    expect(draft.payload.coverTitle).toBe("MEVCUT EL KİTABI BAŞLIĞI");
    expect(draft.payload.identity).toMatchObject({
      customer: "LİTEC MAKİNA",
      product: "20 T KAPASİTELİ KEPÇELİ VİNÇ",
      craneType: "VİNÇ ARABASI",
    });
    expect(draft.payload.sections.length).toBeGreaterThan(5);
  });

  it("üst kayıt başlığı boşsa kapak başlığını proje bilgisinden önerir", () => {
    const payload = manualFromProjectTemplate({
      product: "64 T X 12,44 M KAPASİTELİ PORTAL VİNÇ",
      craneType: "PORTAL VİNÇ",
      coverTitle: "   ",
    });

    expect(payload.docTitle).toBe(MANUAL_DOC_TITLE);
    expect(payload.coverTitle).toContain("64 T X 12,44 M KAPASİTELİ PORTAL VİNÇ");
  });

  it("önceki revizyon varsa içeriği kopyalar ve donmuş otomatik tabloları çözer", () => {
    const previous = manualFromProjectTemplate({
      customer: "MÜŞTERİ",
      product: "ÜRÜN",
      craneType: "TİP",
      coverTitle: "ÖZEL KAPAK",
    });
    const auto = allBlocks(previous.sections).find((block) => block.kind === "auto");
    if (!auto || auto.kind !== "auto") throw new Error("Şablonda otomatik blok bulunamadı.");
    auto.frozen = { head: ["ALAN"], rows: [["DEĞER"]] };

    const draft = manualDraftForNextRevision(
      { revNo: 3, payload: previous },
      { customer: "YENİ MÜŞTERİ", product: "YENİ ÜRÜN", craneType: "YENİ TİP" }
    );

    expect(draft.revNo).toBe(4);
    expect(draft.copiedFromPrevious).toBe(true);
    expect(draft.payload.coverTitle).toBe("ÖZEL KAPAK");
    expect(draft.payload.identity.customer).toBe("MÜŞTERİ");
    expect(
      allBlocks(draft.payload.sections)
        .filter((block) => block.kind === "auto")
        .every((block) => block.kind === "auto" && block.frozen === undefined)
    ).toBe(true);
  });
});

describe("printedManual", () => {
  it("gizli bölüm belgede İZ BIRAKMAZ", () => {
    const m = govde([
      bolum({ id: "a", title: "Görünür", blocks: [{ id: "b1", kind: "text", text: "var" }] }),
      bolum({ id: "b", title: "Gizli", hidden: true, blocks: [{ id: "b2", kind: "text", text: "var" }] }),
    ]);
    const basilan = printedManual(m);
    expect(basilan.sections.map((s) => s.title)).toEqual(["Görünür"]);
  });

  it("bütün blokları gizlenmiş bölüm BAŞLIĞIYLA BİRLİKTE düşer", () => {
    const m = govde([
      bolum({
        id: "a",
        title: "Boşalan",
        blocks: [{ id: "b1", kind: "text", text: "var", hidden: true }],
      }),
    ]);
    expect(printedManual(m).sections).toHaveLength(0);
  });

  it("boş paragraf basılmaz — belgede kusurdur", () => {
    const m = govde([
      bolum({
        id: "a",
        title: "Bölüm",
        blocks: [
          { id: "b1", kind: "text", text: "   " },
          { id: "b2", kind: "text", text: "dolu" },
        ],
      }),
    ]);
    expect(printedManual(m).sections[0].blocks.map((b) => b.id)).toEqual(["b2"]);
  });

  it("çocuğu ayakta olan bölüm başlığıyla kalır", () => {
    const m = govde([
      bolum({
        id: "a",
        title: "Üst",
        children: [bolum({ id: "a1", title: "Alt", blocks: [{ id: "b1", kind: "text", text: "var" }] })],
      }),
    ]);
    const basilan = printedManual(m);
    expect(basilan.sections).toHaveLength(1);
    expect(basilan.sections[0].children).toHaveLength(1);
  });

  it("EK bölümü içeriksiz de ayakta kalır — gövdesi bir ayraç kapağıdır", () => {
    const m = govde([bolum({ id: "e", title: "Teknik Şartname", appendix: "sartname" })]);
    expect(printedManual(m).sections).toHaveLength(1);
  });

  it("boş satırlı tablo basılmaz", () => {
    const m = govde([
      bolum({
        id: "a",
        title: "Bölüm",
        blocks: [{ id: "b1", kind: "table", table: { head: ["A", "B"], rows: [] } }],
      }),
    ]);
    expect(printedManual(m).sections).toHaveLength(0);
  });
});

describe("numberManual", () => {
  it("gövdeyi 1 · 1.1 · 1.1.1 diye numaralar", () => {
    const sections = [
      bolum({
        id: "a",
        title: "Bir",
        children: [bolum({ id: "a1", title: "Bir-bir", children: [bolum({ id: "a11", title: "Derin" })] })],
      }),
      bolum({ id: "b", title: "İki" }),
    ];
    const n = numberManual(sections);
    expect(flattenManual(n).map((s) => s.number)).toEqual(["1", "1.1", "1.1.1", "2"]);
  });

  it("NUMARA SÜZGEÇTEN SONRA VERİLİR: gizli bölüm sırayı boşaltmaz", () => {
    const m = govde([
      bolum({ id: "a", title: "Bir", blocks: [{ id: "b1", kind: "text", text: "x" }] }),
      bolum({ id: "b", title: "İki", hidden: true, blocks: [{ id: "b2", kind: "text", text: "x" }] }),
      bolum({ id: "c", title: "Üç", blocks: [{ id: "b3", kind: "text", text: "x" }] }),
    ]);
    const n = numberManual(printedManual(m).sections);
    expect(n.map((s) => `${s.number} ${s.title}`)).toEqual(["1 Bir", "2 Üç"]);
  });

  it("ekler AYRI ZİNCİRDİR: EK-A · EK-B", () => {
    const sections = [
      bolum({ id: "g", title: "Gövde" }),
      bolum({
        id: "e",
        title: "Ekler",
        children: [
          bolum({ id: "e1", title: "Mekanik Hesaplamalar", appendix: "mekanikHesap" }),
          bolum({ id: "e2", title: "Teknik Şartname", appendix: "sartname" }),
        ],
      }),
    ];
    const n = numberManual(sections);
    expect(n[0].number).toBe("1");
    // Ek kapsayıcısı numarasızdır; numarayı çocukları alır.
    expect(n[1].number).toBe("");
    expect(n[1].children.map((c) => c.number)).toEqual(["EK-A", "EK-B"]);
  });
});

describe("withManualDefaults", () => {
  it("eski kaydı boş partner yuvalarıyla bugüne taşır", () => {
    const p = withManualDefaults({
      v: 1,
      docTitle: "ESKİ BELGE",
      sections: [],
    });
    expect(p.docTitle).toBe("ESKİ BELGE");
    expect(p.partnerLogos).toEqual({});
  });

  it("iki partner görsel kimliğini konumlarıyla korur", () => {
    const p = withManualDefaults({
      partnerLogos: {
        centerImageId: "  partner-orta  ",
        rightImageId: "partner-sag",
      },
    });
    expect(p.partnerLogos).toEqual({
      centerImageId: "partner-orta",
      rightImageId: "partner-sag",
    });
  });

  it("bilinmeyen partner yuvasını ve değersiz kimlikleri düşürür", () => {
    const p = withManualDefaults({
      partnerLogos: {
        centerImageId: "   ",
        rightImageId: 42,
        leftImageId: "orion-sabittir",
        thirdImageId: "tanimsiz-yuva",
      },
    });
    expect(p.partnerLogos).toEqual({});
  });

  it("bozuk JSONB'de belge düşmez, bozuk düğüm düşer", () => {
    const p = withManualDefaults({
      sections: [
        { id: "a", title: "İyi", blocks: [{ id: "b", kind: "text", text: "var" }, { kind: "yok" }, 42], children: null },
        "bozuk",
      ],
    });
    expect(p.sections).toHaveLength(1);
    expect(p.sections[0].blocks).toHaveLength(1);
    expect(p.sections[0].children).toEqual([]);
  });

  it("kimliksiz görsel bloğu düşer — depoda karşılığı yoktur", () => {
    const p = withManualDefaults({
      sections: [{ id: "a", title: "T", blocks: [{ id: "b", kind: "image", imageId: "" }] }],
    });
    expect(p.sections[0].blocks).toHaveLength(0);
  });

  it("tanınmayan otomatik kaynak düşer", () => {
    const p = withManualDefaults({
      sections: [{ id: "a", title: "T", blocks: [{ id: "b", kind: "auto", source: "uydurma" }] }],
    });
    expect(p.sections[0].blocks).toHaveLength(0);
  });

  it("boş girdi çalışabilir bir belge verir", () => {
    const p = withManualDefaults(null);
    expect(p.sections).toEqual([]);
    expect(p.identity.customer).toBe("");
  });
});

describe("adlandırma", () => {
  it("belge adı KULLANMA VE BAKIM KILAVUZU DEĞİLDİR (kullanıcı kararı)", () => {
    expect(MANUAL_DOC_TITLE).toBe("İŞLETME VE BAKIM EL KİTABI");
  });

  it("belge kodu kalem numarasını taşır", () => {
    expect(manualDocCode("0019-00", 1)).toBe("ORC-BK-0019-00-R01");
  });
});
