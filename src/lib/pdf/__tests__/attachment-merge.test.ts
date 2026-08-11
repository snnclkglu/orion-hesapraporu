// `pdfEkleriYerlestir` — ekipman listesinin "Ek Belge" destesi.
//
// ÜÇ SÖZÜ VAR ve üçü de sessizce bozulabilir:
//
//   1. HER EK KENDİ KAPAĞININ ARDINA gider. Sıra kayarsa kapak bir ekipmanı,
//      ardındaki sayfalar başkasını gösterir — hiçbir sayı bunu ele vermez.
//   2. TEMEL BELGENİN BAĞLANTILARI YAŞAR. Ekipman adındaki iç bağlantılar
//      @react-pdf'in `/Root /Names /Dests` ağacına dayanır; sayfaları YENİ bir
//      belgeye kopyalayan bir birleştirme (yani `pdfBirlestir`) bu ağacı
//      taşımaz ve bütün bağlantılar ölür. Bu yüzden temel belge YERİNDE açılıp
//      İÇİNE ekleniyor — testin ikinci maddesi tam olarak bunu bekliyor.
//   3. OKUNAMAYAN EKİN KAPAĞI DA KALMAZ. Kalsaydı belge "bundan sonraki 3
//      sayfa şu ekipmanındır" der, ardından başka bir kapak gelirdi.
//
// Fikstür pdf-lib ile üretilir; sınanan şey sayfa aktarımı, içerik değil.

import { describe, expect, it } from "vitest";
import { PDFDocument, PDFName } from "pdf-lib";
import { pdfEkleriYerlestir } from "../merge";

/** `sayfa` adet boş A4 taşıyan geçerli bir PDF. */
async function sahtePdf(sayfa: number): Promise<Uint8Array> {
  const belge = await PDFDocument.create();
  for (let i = 0; i < sayfa; i += 1) belge.addPage([595, 842]);
  return belge.save();
}

/**
 * Temel belge taklidi: `liste` sayfa gövde + `kapak` sayfa kapak.
 * Kapak sayfaları BOY ile işaretlenir ki testte sıra izlenebilsin.
 */
async function temelPdf(liste: number, kapak: number): Promise<Uint8Array> {
  const belge = await PDFDocument.create();
  for (let i = 0; i < liste; i += 1) belge.addPage([595, 842]);
  // Kapakların yüksekliği artan: 900, 901, 902… — hangi sayfanın hangi kapak
  // olduğunu ölçüden okuyabilmek için.
  for (let i = 0; i < kapak; i += 1) belge.addPage([595, 900 + i]);
  return belge.save();
}

/** Sayfa yüksekliklerini sırayla verir — deste düzeninin parmak izi. */
async function yukseklikler(bytes: Uint8Array): Promise<number[]> {
  const belge = await PDFDocument.load(bytes, { updateMetadata: false });
  return belge.getPages().map((p) => Math.round(p.getHeight()));
}

describe("pdfEkleriYerlestir", () => {
  it("her ek KENDİ kapağının hemen ardına girer", async () => {
    // 3 liste sayfası + 2 kapak; birinci eke 2, ikinci eke 1 sayfa.
    const sonuc = await pdfEkleriYerlestir(await temelPdf(3, 2), [
      { ad: "birinci.pdf", bytes: await sahtePdf(2) },
      { ad: "ikinci.pdf", bytes: await sahtePdf(1) },
    ]);

    expect(sonuc.eklenen).toBe(2);
    expect(sonuc.eklenenSayfa).toBe(3);
    expect(sonuc.atlananlar).toEqual([]);
    // liste(842×3) · kapak1(900) · ek1(842×2) · kapak2(901) · ek2(842)
    expect(await yukseklikler(sonuc.bytes)).toEqual([
      842, 842, 842, 900, 842, 842, 901, 842,
    ]);
  });

  it("ek yoksa belge olduğu gibi kalır", async () => {
    const sonuc = await pdfEkleriYerlestir(await temelPdf(2, 0), []);
    expect(sonuc.eklenen).toBe(0);
    expect(await yukseklikler(sonuc.bytes)).toEqual([842, 842]);
  });

  it("çok sayfalı ek kendi iç sırasını korur", async () => {
    const kaynak = await PDFDocument.create();
    kaynak.addPage([595, 100]);
    kaynak.addPage([595, 200]);
    kaynak.addPage([595, 300]);
    const sonuc = await pdfEkleriYerlestir(await temelPdf(1, 1), [
      { ad: "cok-sayfa.pdf", bytes: await kaynak.save() },
    ]);
    expect(await yukseklikler(sonuc.bytes)).toEqual([842, 900, 100, 200, 300]);
  });

  it("okunamayan ekin KAPAĞI da silinir, diğerleri yerinde kalır", async () => {
    const sonuc = await pdfEkleriYerlestir(await temelPdf(1, 2), [
      { ad: "bozuk.pdf", bytes: new TextEncoder().encode("bu bir PDF değil") },
      { ad: "saglam.pdf", bytes: await sahtePdf(1) },
    ]);

    expect(sonuc.eklenen).toBe(1);
    expect(sonuc.atlananlar).toHaveLength(1);
    expect(sonuc.atlananlar[0].ad).toBe("bozuk.pdf");
    // Bozuk ekin kapağı (900) düştü; sağlam olanınki (901) ve eki kaldı.
    expect(await yukseklikler(sonuc.bytes)).toEqual([842, 901, 842]);
  });

  it("boş ve sayfasız dosyalar sebebiyle birlikte atlanır", async () => {
    const sayfasiz = await PDFDocument.create();
    const sonuc = await pdfEkleriYerlestir(await temelPdf(1, 2), [
      { ad: "bos.pdf", bytes: new Uint8Array(0) },
      { ad: "sayfasiz.pdf", bytes: await sayfasiz.save({ addDefaultPage: false }) },
    ]);
    expect(sonuc.eklenen).toBe(0);
    expect(sonuc.atlananlar.map((a) => a.sebep)).toEqual([
      "dosya boş geldi",
      "belgede hiç sayfa yok",
    ]);
    expect(await yukseklikler(sonuc.bytes)).toEqual([842]);
  });

  it("ADLANDIRILMIŞ HEDEFLER (iç bağlantı çapaları) yaşar", async () => {
    // Ekipman listesindeki "adına tıkla, ekine git" bağlantısı bu ağaca
    // dayanır. `pdfBirlestir` gibi yeni belgeye kopyalayan bir yol seçilseydi
    // ağaç taşınmaz ve bütün bağlantılar sessizce ölürdü.
    const temel = await PDFDocument.create();
    temel.addPage([595, 842]);
    const kapak = temel.addPage([595, 900]);
    temel.catalog.set(
      PDFName.of("Names"),
      temel.context.obj({
        Dests: temel.context.obj({
          Names: [
            PDFName.of("ek-belge-main-gearbox"),
            temel.context.obj([kapak.ref, PDFName.of("XYZ"), null, null, null]),
          ],
        }),
      })
    );

    const sonuc = await pdfEkleriYerlestir(await temel.save(), [
      { ad: "ek.pdf", bytes: await sahtePdf(1) },
    ]);

    const okunan = await PDFDocument.load(sonuc.bytes, { updateMetadata: false });
    const names = okunan.context.lookup(okunan.catalog.get(PDFName.of("Names")));
    expect(names).toBeDefined();
    expect(String(names)).toContain("ek-belge-main-gearbox");
    // Ek gerçekten girmiş olmalı: ağaç yaşarken sayfa eklenmemesi de bir hata.
    expect(okunan.getPageCount()).toBe(3);
  });

  it("kapak sayısı sözleşmesi bozulursa SESSİZ KALMAZ", async () => {
    await expect(
      pdfEkleriYerlestir(await temelPdf(1, 0), [
        { ad: "a.pdf", bytes: await sahtePdf(1) },
        { ad: "b.pdf", bytes: await sahtePdf(1) },
      ])
    ).rejects.toThrow(/sözleşmesi bozuldu/i);
  });
});
