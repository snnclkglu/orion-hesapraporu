// `pdf/merge.ts` — birleştirmenin İKİ SÖZÜNÜ sınar:
//
//   1. SIRA KORUNUR. Deste defter sırasıyla basılıyor; sıra bozulursa atölye
//      yanlış sayfayı yanlış parçayla eşleştirir ve bunu hiçbir sayı ele
//      vermez.
//   2. BOZUK TEK DOSYA BÜTÜN İŞİ DÜŞÜRMEZ. 171 resimlik bir pakette tek
//      okunamayan dosya yüzünden atölyenin hiçbir resmi olmaması, modülün
//      kabul etmediği sonuçtur.
//
// Fikstür pdf-lib'in kendisiyle üretilir: gerçek bir resim dosyasını depoya
// koymak testi ağırlaştırır ve sınanan şey sayfa AKTARIMI, resmin içeriği
// değil.

import { describe, expect, it } from "vitest";
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFString } from "pdf-lib";
import { pdfBirlestir, pdfEkleriniSonaEkle, pdfEkleriYerlestir } from "../merge";

/** `sayfa` adet boş A4 taşıyan geçerli bir PDF. */
async function sahtePdf(sayfa: number): Promise<Uint8Array> {
  const belge = await PDFDocument.create();
  for (let i = 0; i < sayfa; i += 1) belge.addPage([595, 842]);
  return belge.save();
}

/** Geçerli ama SAYFASIZ bir PDF — okunur, kopyalanacak bir şeyi yoktur. */
async function sayfasizPdf(): Promise<Uint8Array> {
  const belge = await PDFDocument.create();
  return belge.save({ addDefaultPage: false });
}

describe("pdfBirlestir", () => {
  it("sayfaları verilen sırada tek belgede toplar", async () => {
    const sonuc = await pdfBirlestir([
      { ad: "a.pdf", bytes: await sahtePdf(1) },
      { ad: "b.pdf", bytes: await sahtePdf(2) },
      { ad: "c.pdf", bytes: await sahtePdf(1) },
    ]);

    expect(sonuc.birlesen).toBe(3);
    expect(sonuc.sayfaSayisi).toBe(4);
    expect(sonuc.atlananlar).toEqual([]);

    const okunan = await PDFDocument.load(sonuc.bytes, { updateMetadata: false });
    expect(okunan.getPageCount()).toBe(4);
  });

  it("bozuk dosya atlanır, kalanlar birleşmeye devam eder", async () => {
    const sonuc = await pdfBirlestir([
      { ad: "saglam-1.pdf", bytes: await sahtePdf(1) },
      { ad: "bozuk.pdf", bytes: new TextEncoder().encode("bu bir PDF değil") },
      { ad: "saglam-2.pdf", bytes: await sahtePdf(1) },
    ]);

    expect(sonuc.birlesen).toBe(2);
    expect(sonuc.sayfaSayisi).toBe(2);
    expect(sonuc.atlananlar).toHaveLength(1);
    expect(sonuc.atlananlar[0].ad).toBe("bozuk.pdf");
    // Sebep YAZILIR: sessiz atlama yok.
    expect(sonuc.atlananlar[0].sebep.length).toBeGreaterThan(0);
  });

  it("boş bayt ve sayfasız belge sebebiyle birlikte atlanır", async () => {
    const sonuc = await pdfBirlestir([
      { ad: "bos.pdf", bytes: new Uint8Array(0) },
      { ad: "sayfasiz.pdf", bytes: await sayfasizPdf() },
      { ad: "saglam.pdf", bytes: await sahtePdf(3) },
    ]);

    expect(sonuc.sayfaSayisi).toBe(3);
    expect(sonuc.atlananlar.map((a) => a.ad)).toEqual(["bos.pdf", "sayfasiz.pdf"]);
    expect(sonuc.atlananlar[0].sebep).toContain("boş");
    expect(sonuc.atlananlar[1].sebep).toContain("sayfa");
  });

  it("hiç sayfa eklenemezse BOŞ PDF üretmez", async () => {
    const sonuc = await pdfBirlestir([
      { ad: "bozuk.pdf", bytes: new TextEncoder().encode("çöp") },
    ]);

    expect(sonuc.sayfaSayisi).toBe(0);
    expect(sonuc.birlesen).toBe(0);
    expect(sonuc.bytes.byteLength).toBe(0);
    expect(sonuc.atlananlar).toHaveLength(1);
  });

  it("künye özetten türeyebilir ve Türkçe harfleri kaybetmez", async () => {
    let gorulenOzet = { birlesen: -1, sayfaSayisi: -1, atlanan: -1 };

    const sonuc = await pdfBirlestir(
      [
        { ad: "saglam.pdf", bytes: await sahtePdf(2) },
        { ad: "bozuk.pdf", bytes: new TextEncoder().encode("çöp") },
      ],
      (ozet) => {
        gorulenOzet = {
          birlesen: ozet.birlesen,
          sayfaSayisi: ozet.sayfaSayisi,
          atlanan: ozet.atlananlar.length,
        };
        return {
          baslik: "İmalat Resimleri — ŞŞ ĞĞ ıI",
          konu: `${ozet.birlesen} resim birleştirildi; ${ozet.atlananlar.length} açılamadı.`,
        };
      }
    );

    // Künye SAVE'DEN ÖNCE yazılır, yani özet o an hazır olmalıdır.
    expect(gorulenOzet).toEqual({ birlesen: 1, sayfaSayisi: 2, atlanan: 1 });

    const okunan = await PDFDocument.load(sonuc.bytes, { updateMetadata: false });
    expect(okunan.getTitle()).toBe("İmalat Resimleri — ŞŞ ĞĞ ıI");
    expect(okunan.getSubject()).toBe("1 resim birleştirildi; 1 açılamadı.");
  });
});

describe("pdfEkleriYerlestir", () => {
  it("kopyalanan EK-F dizin bağlantısını nihai sayfa referansına çevirir", async () => {
    const temel = await PDFDocument.create();
    temel.addPage([595, 842]); // EK-F kapağı

    const ek = await PDFDocument.create();
    const dizin = ek.addPage([595, 842]);
    ek.addPage([595, 842]);
    const annot = ek.context.obj({
      Type: "Annot",
      Subtype: "Link",
      Rect: [20, 20, 140, 40],
      Border: [0, 0, 0],
      Dest: PDFString.of("ekf-entry-1"),
    });
    dizin.node.set(PDFName.of("Annots"), ek.context.obj([ek.context.register(annot)]));

    const sonuc = await pdfEkleriYerlestir(
      await temel.save(),
      [{
        ad: "EK-F",
        bytes: await ek.save(),
        destinations: { "ekf-entry-1": 1 },
        sectionLabel: "EK-F",
      }],
      { finalFolio: true }
    );

    const final = await PDFDocument.load(sonuc.bytes, { updateMetadata: false });
    expect(final.getPageCount()).toBe(3);
    const annots = final.getPage(1).node.lookup(PDFName.of("Annots"), PDFArray);
    const link = final.context.lookup(annots.get(0), PDFDict);
    const dest = link.lookup(PDFName.of("Dest"), PDFArray);
    expect(dest.get(0).toString()).toBe(final.getPage(2).ref.toString());
  });
});

describe("pdfEkleriniSonaEkle", () => {
  it("temel listedeki ve ek dizinindeki bağlantıları ekin gerçek sayfasına bağlar", async () => {
    const temel = await PDFDocument.create();
    const liste = temel.addPage([595, 842]);
    temel.addPage([595, 842]); // Sonda kalacak kullanıcı ek kapağı
    const listeBaglantisi = temel.context.obj({
      Type: "Annot",
      Subtype: "Link",
      Rect: [20, 20, 140, 40],
      Border: [0, 0, 0],
      Dest: PDFString.of("ekf-entry-1"),
    });
    liste.node.set(
      PDFName.of("Annots"),
      temel.context.obj([temel.context.register(listeBaglantisi)])
    );

    const ek = await PDFDocument.create();
    const dizin = ek.addPage([595, 842]);
    ek.addPage([595, 842]);
    const dizinBaglantisi = ek.context.obj({
      Type: "Annot",
      Subtype: "Link",
      Rect: [20, 20, 140, 40],
      Border: [0, 0, 0],
      Dest: PDFString.of("ekf-entry-1"),
    });
    dizin.node.set(
      PDFName.of("Annots"),
      ek.context.obj([ek.context.register(dizinBaglantisi)])
    );

    const sonuc = await pdfEkleriniSonaEkle(
      await temel.save(),
      [{
        ad: "Elektrik katalog eki",
        bytes: await ek.save(),
        destinations: { "ekf-entry-1": 1 },
      }],
      { sondakiSayfalardanOnce: 1 }
    );

    const final = await PDFDocument.load(sonuc.bytes, { updateMetadata: false });
    expect(final.getPageCount()).toBe(4);
    // Yerleşim: liste · EK-F dizin · gerçek katalog sayfası · kullanıcı ek kapağı.
    for (const pageIndex of [0, 1]) {
      const annots = final.getPage(pageIndex).node.lookup(PDFName.of("Annots"), PDFArray);
      const link = final.context.lookup(annots.get(0), PDFDict);
      const dest = link.lookup(PDFName.of("Dest"), PDFArray);
      expect(dest.get(0).toString()).toBe(final.getPage(2).ref.toString());
    }
  });
});
