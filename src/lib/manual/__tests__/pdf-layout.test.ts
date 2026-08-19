// El kitabı PDF yerleşiminin birim testleri.
//
// EN PAHALI HATA EKSİK ÖLÇMEKTİR: @react-pdf taşan içeriği SESSİZCE kırpar ve
// bir bakım talimatının yarısının kaybolduğu ancak müşteri belgeyi okurken
// anlaşılır. Bu yüzden ölçümün YÖNÜ (fazla ölçmek) ve akışın sırası burada
// donmuş testlerle korunur; kâğıdın kendisi ayrıca `check-manual-layout.py`
// ile geri okunur.

import { describe, expect, it } from "vitest";
import {
  ICERIK_YUKSEKLIK,
  SUTUN_GENISLIK,
  TAM_GENISLIK,
  blokOlcusu,
  manualAtomlari,
  manualPdfSayfalari,
  tabloYuksekligi,
  type ManualAtom,
} from "../pdf-layout";
import { numberManual, printedManual } from "../payload";
import type { ManualBlock, ManualSection } from "../types";

const BOS_KAYNAK = {};

function bolum(over: Partial<ManualSection> & { id: string }): ManualSection {
  return { title: "", blocks: [], children: [], ...over };
}

const paragraf = (id: string, text: string): ManualBlock => ({ id, kind: "text", text });

describe("ölçüler sayfanın gerçeğinden türer", () => {
  it("iki sütun + oluk tam genişliği verir", () => {
    // Kopyalanmış bir sayı değil, aritmetiğin kendisi sınanır: marj değişirse
    // bu eşitlik de değişir ve türetmeyi unutmuş olan taraf düşer.
    expect(SUTUN_GENISLIK * 2 + 18).toBeCloseTo(TAM_GENISLIK, 6);
  });

  it("içerik yüksekliği A4'ten marjlar düşülerek bulunur", () => {
    // 841,89 − 16mm üst − (13mm alt + 14 altbilgi) ≈ 745,7 — teklif PDF'inin
    // ölçtüğü sayının aynısı (`offers/pdf-layout.ts` PDF_SUTUN_KAPASITE).
    expect(ICERIK_YUKSEKLIK).toBeCloseTo(745.69, 1);
  });
});

describe("blokOlcusu", () => {
  it("uzun paragraf kısa paragraftan yüksektir", () => {
    const kisa = blokOlcusu(paragraf("a", "Kısa."), BOS_KAYNAK);
    const uzun = blokOlcusu(paragraf("b", "Uzun bir cümle. ".repeat(40)), BOS_KAYNAK);
    expect(uzun.h).toBeGreaterThan(kisa.h * 5);
  });

  it("SATIR SONU GERÇEK BİR SATIR KIRAR", () => {
    // Metin tek parça sayılsaydı çok satırlı bir paragraf olduğundan KISA
    // ölçülür ve sütun dibinden taşardı.
    const tek = blokOlcusu(paragraf("a", "abc"), BOS_KAYNAK);
    const uc = blokOlcusu(paragraf("b", "abc\nabc\nabc"), BOS_KAYNAK);
    expect(uc.h).toBeGreaterThan(tek.h * 2);
  });

  it("TAM GENİŞLİK KARARI SÜTUN SAYARAK DEĞİL ÖLÇEREK verilir", () => {
    // Hücreleri KISA olan beş sütunlu bir tablo yarım sütunda rahat okunur;
    // eski "dörtten fazla sütun tam genişliğe düşer" kuralı onu koca bir
    // yaprağa yayıp başlığından koparıyordu (ölçüldü, s. 16-17).
    const dar = blokOlcusu(
      {
        id: "a",
        kind: "table",
        table: {
          head: ["Ekipman", "Marka", "Model", "Adet", "Grup"],
          rows: [["Tambur rulmanı", "SKF", "22320", "4", "Ana Kaldırma"]],
        },
      },
      BOS_KAYNAK
    );
    expect(dar.tam).toBe(false);

    // Hücreleri UZUN olan bir tablo dar kapta katlanır — o tam genişlik ister.
    const genis = blokOlcusu(
      {
        id: "b",
        kind: "table",
        table: {
          head: ["Aygıt Etiketi", "Adet", "Tanım", "Tip No", "Tedarikçi", "Malzeme Kodu"],
          rows: [
            [
              "=185T+LVD10-A351",
              "1",
              "SIMATIC S7-1500 CPU 1511-1 PN, SENSOR MODULE CABINET ile birlikte",
              "6ES7511-1AL03-0AB0",
              "Siemens",
              "SIE.6ES7511-1AL03-0AB0",
            ],
          ],
        },
      },
      BOS_KAYNAK
    );
    expect(genis.tam).toBe(true);
  });

  it("aynı tablo dar kapta daha YÜKSEKTİR — hücreler sarar", () => {
    // Gerçekten uzun bir tanım seçilir: kısa bir hücre HER İKİ genişlikte de
    // tek satıra sığar ve test hiçbir şey ölçmemiş olurdu.
    const t = {
      head: ["Tanım", "Marka"],
      rows: [
        [
          "SINAMICS S120 CONTROL UNIT CU320-2 PN, SENSOR MODULE CABINET SMC30 ve DRIVE CLIQ HUB MODULE CABINET DMC20 ile birlikte",
          "Siemens",
        ],
      ],
    };
    expect(tabloYuksekligi(t, SUTUN_GENISLIK)).toBeGreaterThan(tabloYuksekligi(t, TAM_GENISLIK));
  });

  it("ORANI BİLİNMEYEN GÖRSEL KARE varsayılır — fazla ölçmenin yönü", () => {
    const blok: ManualBlock = { id: "g", kind: "image", imageId: "x", widthPct: 100 };
    const bilinmeyen = blokOlcusu(blok, BOS_KAYNAK);
    const yatik = blokOlcusu(blok, BOS_KAYNAK, new Map([["x", 0.5]]));
    expect(bilinmeyen.h).toBeGreaterThan(yatik.h);
  });

  it("geniş görsel tam genişlik bandına düşer", () => {
    const dar = blokOlcusu({ id: "g", kind: "image", imageId: "x", widthPct: 40 }, BOS_KAYNAK);
    const genis = blokOlcusu({ id: "h", kind: "image", imageId: "x", widthPct: 90 }, BOS_KAYNAK);
    expect(dar.tam).toBe(false);
    expect(genis.tam).toBe(true);
  });

  it("ŞABLONUN AÇIK İSTEĞİ yüzdeyi yener", () => {
    // Halat hasar şekli sütunun TAMAMINI ister ama sayfanın tamamını
    // istemez: iki kolona yayılınca sayfa yarı yarıya kısalır.
    const sutunda = blokOlcusu(
      { id: "g", kind: "image", assetKey: "x", widthPct: 100, fullWidth: false },
      BOS_KAYNAK
    );
    expect(sutunda.tam).toBe(false);
  });

  it("kaynağı boş ve açıklaması olmayan otomatik blok SIFIRDIR", () => {
    const o = blokOlcusu({ id: "a", kind: "auto", source: "ekipman" }, BOS_KAYNAK);
    expect(o.h).toBe(0);
  });
});

describe("manualAtomlari", () => {
  it("başlık ve bloklar BELGE SIRASINDA düz akışa iner", () => {
    const sections = [
      bolum({
        id: "a",
        title: "Bir",
        blocks: [paragraf("p1", "x")],
        children: [bolum({ id: "a1", title: "Bir-bir", blocks: [paragraf("p2", "y")] })],
      }),
    ];
    const atomlar = manualAtomlari(numberManual(sections), BOS_KAYNAK);
    expect(atomlar.map((a) => (a.kind === "heading" ? a.section.title : "blok"))).toEqual([
      "Bir",
      "blok",
      "Bir-bir",
      "blok",
    ]);
  });

  it("EK KAPAĞI AKIŞA GİRMEZ — kendi yaprağında kalır", () => {
    const sections = [
      bolum({
        id: "e",
        title: "Ekler",
        children: [bolum({ id: "e1", title: "Şartname", appendix: "sartname" })],
      }),
    ];
    const atomlar = manualAtomlari(numberManual(sections), BOS_KAYNAK);
    // Yalnız kapsayıcının başlığı akar; ek kapağı çizim tarafında ayrı sayfadır.
    expect(atomlar).toHaveLength(1);
  });

  it("gizli ve boş bloklar akışa girmez", () => {
    const sections = [
      bolum({
        id: "a",
        title: "Bir",
        blocks: [
          { id: "p1", kind: "text", text: "görünür" },
          { id: "p2", kind: "text", text: "gizli", hidden: true },
          { id: "p3", kind: "text", text: "   " },
        ],
      }),
    ];
    expect(manualAtomlari(numberManual(sections), BOS_KAYNAK)).toHaveLength(2);
  });
});

describe("manualPdfSayfalari", () => {
  const atom = (h: number, tam = false): ManualAtom =>
    ({ kind: "block", block: paragraf("x", "y"), h, tam }) as ManualAtom;

  it("önce SOL sütunu doldurur, sonra sağa, sonra yeni sayfaya", () => {
    // Kapasite ~700; 300'lük dört atom: sol 2, sağ 2, sonra taşar.
    const sayfalar = manualPdfSayfalari([atom(300), atom(300), atom(300), atom(300), atom(300)]);
    const ilk = sayfalar[0].bantlar[0];
    expect(ilk.kind).toBe("cols");
    if (ilk.kind === "cols") {
      expect(ilk.sol).toHaveLength(2);
      expect(ilk.sag).toHaveLength(2);
    }
    expect(sayfalar).toHaveLength(2);
  });

  it("TAM GENİŞLİK ATOMU kendi bandını açar ve sütun bandını kapatır", () => {
    const sayfalar = manualPdfSayfalari([atom(100), atom(200, true), atom(100)]);
    const bantlar = sayfalar[0].bantlar;
    expect(bantlar.map((b) => b.kind)).toEqual(["cols", "full", "cols"]);
  });

  it("SIRA KORUNUR: tam genişlik atomu kendinden öncekinin ARDINDA kalır", () => {
    const once = atom(100);
    const genis = atom(200, true);
    const sayfalar = manualPdfSayfalari([once, genis]);
    const b0 = sayfalar[0].bantlar[0];
    expect(b0.kind).toBe("cols");
    if (b0.kind === "cols") expect(b0.sol[0]).toBe(once);
    const b1 = sayfalar[0].bantlar[1];
    expect(b1.kind).toBe("full");
    if (b1.kind === "full") expect(b1.atoms[0]).toBe(genis);
  });

  it("SÜTUNA SIĞMAYAN TEK ATOM YİNE DE BASILIR — sonsuz döngü yok", () => {
    // Boş sütuna bile sığmayan patolojik bir blok reddedilmeye devam etseydi
    // dağıtım sonsuza girerdi (teklifin `zorla` dersi). Taşarak da olsa basar.
    const sayfalar = manualPdfSayfalari([atom(5000)]);
    expect(sayfalar).toHaveLength(1);
  });

  it("BAŞLIK YALNIZ BAŞINA SÜTUN DİBİNDE KALMAZ", () => {
    const baslik: ManualAtom = {
      kind: "heading",
      section: { ...bolum({ id: "h", title: "Başlık" }), number: "1", depth: 1, children: [] },
      h: 30,
      tam: false,
    };
    // Sütunda başlıktan sonra ~20 pt kalıyor: başlık aşağı itilmeli.
    const sayfalar = manualPdfSayfalari([atom(650), baslik, atom(200)]);
    const b = sayfalar[0].bantlar[0];
    expect(b.kind).toBe("cols");
    if (b.kind === "cols") {
      expect(b.sol).toHaveLength(1);
      expect(b.sag[0]).toBe(baslik);
    }
  });

  it("boş akış boş liste verir", () => {
    expect(manualPdfSayfalari([])).toEqual([]);
  });
});

describe("gerçek şablon", () => {
  it("HİÇBİR İÇERİK KAYBOLMAZ — bölünen atom bile eksiksiz yerleşir", async () => {
    // SAYIM YETMEZ: bölünen bir atom iki dilime çıkar, yani yerleşen atom
    // sayısı girdiden FAZLA olur. Sınanacak şey sayı değil İÇERİKTİR —
    // her bloğun ve her başlığın belgede karşılığı var mı.
    const { manualFromTemplate } = await import("../payload");
    const p = manualFromTemplate({ product: "ŞARJ VİNCİ" });
    const numarali = numberManual(printedManual(p).sections);
    const atomlar = manualAtomlari(numarali, BOS_KAYNAK);
    const sayfalar = manualPdfSayfalari(atomlar);

    const yerlesenler = sayfalar
      .flatMap((s) => s.bantlar)
      .flatMap((b) => (b.kind === "full" ? b.atoms : [...b.sol, ...b.sag]));

    // 1. Her başlık en az bir kez yerleşti.
    const basliklar = new Set(
      yerlesenler.filter((a) => a.kind === "heading").map((a) => a.section.id)
    );
    for (const a of atomlar) {
      if (a.kind === "heading") expect(basliklar.has(a.section.id)).toBe(true);
    }

    // 2. Her blok en az bir kez yerleşti.
    const bloklar = new Set(
      yerlesenler.filter((a) => a.kind === "block").map((a) => a.block.id)
    );
    for (const a of atomlar) {
      if (a.kind === "block") expect(bloklar.has(a.block.id)).toBe(true);
    }

    // 3. BÖLÜNEN LİSTENİN BÜTÜN MADDELERİ basılır — ne eksik ne yinelenmiş.
    for (const a of atomlar) {
      if (a.kind !== "block" || a.block.kind !== "list") continue;
      const basilan = yerlesenler
        .filter((y) => y.kind === "block" && y.block.id === a.block.id)
        .flatMap((y) => (y.kind === "block" ? (y.items ?? []) : []));
      expect(basilan).toEqual(a.block.items.filter((i) => i.trim()));
    }

    expect(sayfalar.length).toBeGreaterThan(1);
  });

  it("BÖLÜNEN LİSTE numarasını kaldığı yerden sürdürür", () => {
    // ATOM ÇEKİRDEĞİN KENDİSİNDEN üretilir: elle yazılmış bir `h`, bölmenin
    // yeniden ölçtüğü yükseklikle tutmaz ve test hiçbir şey sınamamış olur.
    const madde = (n: number) =>
      `${n}. adım: bu madde bilerek uzun yazılmıştır ki dar bir sütunda birkaç satır sarsın ve liste tek bir sütuna sığmasın.`;
    const sections = [
      bolum({
        id: "s",
        title: "Bölüm",
        blocks: [
          { id: "d", kind: "text", text: "Dolgu. ".repeat(220) },
          {
            id: "l",
            kind: "list",
            ordered: true,
            items: Array.from({ length: 12 }, (_, i) => madde(i + 1)),
            result: "Beklenen sonuç.",
          },
        ],
      }),
    ];
    const atomlar = manualAtomlari(numberManual(sections), BOS_KAYNAK);
    const sayfalar = manualPdfSayfalari(atomlar);
    const dilimler = sayfalar
      .flatMap((s) => s.bantlar)
      .flatMap((b) => (b.kind === "full" ? b.atoms : [...b.sol, ...b.sag]))
      .filter((a) => a.kind === "block" && a.block.id === "l");

    expect(dilimler.length).toBeGreaterThan(1);

    const ilk = dilimler[0];
    const ikinci = dilimler[1];
    if (ilk.kind === "block" && ikinci.kind === "block") {
      // İkinci dilim ilkinin BİTTİĞİ yerden başlar — "1." diye yeniden
      // başlasaydı okuyan iki ayrı liste görürdü.
      expect(ikinci.itemOffset).toBe(ilk.items?.length);
      // SONUÇ SATIRI yalnız SON dilimde basılır.
      expect(ilk.sonuc).toBe(false);
      expect(ikinci.devam).toBe(true);
    }

    // Bütün maddeler eksiksiz ve sırayla basılır.
    const basilan = dilimler.flatMap((a) => (a.kind === "block" ? (a.items ?? []) : []));
    expect(basilan).toEqual(Array.from({ length: 12 }, (_, i) => madde(i + 1)));
  });
});
