import { describe, expect, it } from "vitest";
import {
  TEMPLATE_BLOCKS,
  blockAppend,
  blockInsertAt,
  blockMove,
  blockRemove,
  blockReorder,
  blockRevertToTemplate,
  blockUpdate,
  sectionFind,
  sectionMove,
  sectionPath,
  sectionRename,
  sectionReorder,
  sectionToggleHidden,
} from "../edit-ops";
import type { ManualBlock, ManualSection } from "../types";

function metin(id: string, text = ""): ManualBlock {
  return { id, kind: "text", text };
}

function bolum(
  id: string,
  ek: Partial<ManualSection> = {}
): ManualSection {
  return { id, title: id.toUpperCase(), blocks: [], children: [], ...ek };
}

/** a ├ a1 ├ a1x / a2 ; b */
function agac(): ManualSection[] {
  return [
    bolum("a", {
      children: [
        bolum("a1", { children: [bolum("a1x")] }),
        bolum("a2", { blocks: [metin("m1", "bir"), metin("m2", "iki"), metin("m3", "üç")] }),
      ],
    }),
    bolum("b"),
  ];
}

describe("sectionFind / sectionPath", () => {
  it("derindeki bölümü bulur", () => {
    expect(sectionFind(agac(), "a1x")?.id).toBe("a1x");
    expect(sectionFind(agac(), "yok")).toBeNull();
  });

  it("kökten kendisine giden yolu verir", () => {
    expect(sectionPath(agac(), "a1x").map((s) => s.id)).toEqual(["a", "a1", "a1x"]);
    expect(sectionPath(agac(), "yok")).toEqual([]);
  });
});

describe("sectionToggleHidden", () => {
  it("bayrağı çevirir ve ALT AĞACA DOKUNMAZ — gizlemek silmek değildir", () => {
    const sonuc = sectionToggleHidden(agac(), "a1");
    const a1 = sectionFind(sonuc, "a1")!;
    expect(a1.hidden).toBe(true);
    expect(a1.children).toHaveLength(1);
    expect(sectionFind(sonuc, "a1x")?.hidden).toBeUndefined();
  });

  it("gelen ağacı DEĞİŞTİRMEZ", () => {
    const once = agac();
    sectionToggleHidden(once, "a1");
    expect(once[0].children[0].hidden).toBeUndefined();
  });
});

describe("sectionRename", () => {
  it("başlığı yazar ve titleEdited açar", () => {
    const s = sectionFind(sectionRename(agac(), "b", "Yeni Ad"), "b")!;
    expect(s.title).toBe("Yeni Ad");
    expect(s.titleEdited).toBe(true);
  });
});

describe("sectionMove", () => {
  it("kardeşler arasında kaydırır", () => {
    const sonuc = sectionMove(agac(), "a2", "yukari");
    expect(sectionFind(sonuc, "a")!.children.map((s) => s.id)).toEqual(["a2", "a1"]);
  });

  it("sınırda ağacı DEĞİŞTİRMEZ", () => {
    const sonuc = sectionMove(agac(), "a1", "yukari");
    expect(sectionFind(sonuc, "a")!.children.map((s) => s.id)).toEqual(["a1", "a2"]);
  });

  it("kökteki bölümü de kaydırır", () => {
    expect(sectionMove(agac(), "b", "yukari").map((s) => s.id)).toEqual(["b", "a"]);
  });
});

describe("sectionReorder", () => {
  it("başka bir üst bölümün altına taşır", () => {
    const sonuc = sectionReorder(agac(), "a2", "b", 0);
    expect(sectionFind(sonuc, "a")!.children.map((s) => s.id)).toEqual(["a1"]);
    expect(sectionFind(sonuc, "b")!.children.map((s) => s.id)).toEqual(["a2"]);
  });

  it("kök seviyesine alır ve sırayı kelepçeler", () => {
    const sonuc = sectionReorder(agac(), "a1x", null, 99);
    expect(sonuc.map((s) => s.id)).toEqual(["a", "b", "a1x"]);
    expect(sectionFind(sonuc, "a1")!.children).toEqual([]);
  });

  it("BÖLÜM KENDİ ALT AĞACINA TAŞINAMAZ", () => {
    const once = agac();
    const sonuc = sectionReorder(once, "a", "a1x", 0);
    expect(sonuc.map((s) => s.id)).toEqual(["a", "b"]);
    expect(sectionFind(sonuc, "a")!.children.map((s) => s.id)).toEqual(["a1", "a2"]);
  });

  it("bulunamayan kimlikte ağacı DEĞİŞTİRMEZ", () => {
    expect(sectionReorder(agac(), "yok", "b", 0).map((s) => s.id)).toEqual(["a", "b"]);
  });
});

describe("blok işlemleri", () => {
  it("blockMove komşuyla takas eder, sınırda durur", () => {
    const asagi = blockMove(agac(), "a2", "m1", "asagi");
    expect(sectionFind(asagi, "a2")!.blocks.map((b) => b.id)).toEqual(["m2", "m1", "m3"]);

    const sinir = blockMove(agac(), "a2", "m1", "yukari");
    expect(sectionFind(sinir, "a2")!.blocks.map((b) => b.id)).toEqual(["m1", "m2", "m3"]);
  });

  it("blockReorder bloğu verilen sıraya taşır", () => {
    const sonuc = blockReorder(agac(), "a2", "m3", 0);
    expect(sectionFind(sonuc, "a2")!.blocks.map((b) => b.id)).toEqual(["m3", "m1", "m2"]);
  });

  it("blockInsertAt sırayı kelepçeler", () => {
    const bas = blockInsertAt(agac(), "a2", -5, metin("yeni"));
    expect(sectionFind(bas, "a2")!.blocks[0].id).toBe("yeni");

    const son = blockInsertAt(agac(), "a2", 99, metin("yeni"));
    expect(sectionFind(son, "a2")!.blocks.at(-1)!.id).toBe("yeni");
  });

  it("blockAppend sona ekler, blockRemove siler", () => {
    const eklendi = blockAppend(agac(), "a2", metin("m4"));
    expect(sectionFind(eklendi, "a2")!.blocks.map((b) => b.id)).toEqual([
      "m1",
      "m2",
      "m3",
      "m4",
    ]);
    const silindi = blockRemove(eklendi, "a2", "m2");
    expect(sectionFind(silindi, "a2")!.blocks.map((b) => b.id)).toEqual(["m1", "m3", "m4"]);
  });

  it("blockUpdate yalnız hedef bloğu değiştirir", () => {
    const sonuc = blockUpdate(agac(), "a2", "m2", (b) => ({ ...b, edited: true }));
    const bloklar = sectionFind(sonuc, "a2")!.blocks;
    expect(bloklar.map((b) => b.edited)).toEqual([undefined, true, undefined]);
  });
});

describe("blockRevertToTemplate", () => {
  const sablonBloklari = TEMPLATE_BLOCKS.get("notlar.amac")!;

  function sablonluAgac(): ManualSection[] {
    return [
      bolum("s", {
        key: "notlar.amac",
        blocks: [
          { id: "b1", kind: "text", text: "kullanıcı yazdı", fromTemplate: true, edited: true },
          { id: "b2", kind: "list", items: ["elle"], fromTemplate: true, edited: true },
        ],
      }),
    ];
  }

  it("şablon metnini geri getirir ve edited kapanır", () => {
    const sonuc = blockRevertToTemplate(sablonluAgac(), "s", "b1");
    const blok = sectionFind(sonuc, "s")!.blocks[0];
    expect(blok.kind).toBe("text");
    expect(blok.kind === "text" && blok.text).toBe(sablonBloklari[0].text);
    expect(blok.edited).toBe(false);
    expect(blok.id).toBe("b1");
  });

  it("liste bloğunun maddelerini KOPYALAYARAK geri getirir", () => {
    const sonuc = blockRevertToTemplate(sablonluAgac(), "s", "b2");
    const blok = sectionFind(sonuc, "s")!.blocks[1];
    expect(blok.kind === "list" && blok.items).toEqual(sablonBloklari[1].items);
    expect(blok.kind === "list" && blok.items).not.toBe(sablonBloklari[1].items);
  });

  it("TÜR TUTMUYORSA HİÇBİR ŞEY YAPMAZ — yanlış bloğun üstüne yazmaz", () => {
    const agacSaptirilmis = sablonluAgac();
    agacSaptirilmis[0].blocks[0] = {
      id: "b1",
      kind: "note",
      level: "uyari",
      text: "kullanıcının kendi uyarısı",
    };
    const sonuc = blockRevertToTemplate(agacSaptirilmis, "s", "b1");
    const blok = sectionFind(sonuc, "s")!.blocks[0];
    expect(blok.kind).toBe("note");
    expect(blok.kind === "note" && blok.text).toBe("kullanıcının kendi uyarısı");
  });

  it("şablon anahtarı olmayan bölümde ağacı değiştirmez", () => {
    const sonuc = blockRevertToTemplate(agac(), "a2", "m1");
    expect(sectionFind(sonuc, "a2")!.blocks.map((b) => b.id)).toEqual(["m1", "m2", "m3"]);
  });
});
