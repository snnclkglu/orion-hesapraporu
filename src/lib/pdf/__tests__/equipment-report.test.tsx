import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { PDFDocument, PDFName, type PDFDict } from "pdf-lib";
import { renderEquipmentPdf, breakEquipmentModelCode } from "@/lib/pdf/equipment-report";

describe("ekipman listesi PDF düzeni", () => {
  it("uzun katalog kodlarına satır kırma noktası ekler ve yatay PDF üretir", async () => {
    const model = "N(NV).250.HYD.050/090-200N";
    expect(breakEquipmentModelCode(model)).toContain("\u200B");

    const pdf = await renderEquipmentPdf({
      meta: {
        docNo: "EQ-01", projectName: "Uzun Kod Testi", customer: "ORION", revLabel: "V0", revNo: 0,
        date: "07.08.2026",
      },
      groups: [{
        name: "Ana Kaldırma",
        rows: [{
          component: "Fren",
          brand: "Galvi Newcomen",
          model,
          spec: "Fren torku 720 Nm, kasnak/disk Ø250 mm; uzun özellik metni satıra güvenle kırılır.",
          qty: 4,
        }],
      }],
    });

    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
    expect(pdf.length).toBeGreaterThan(10 * 1024);
  }, 120_000);
});

/** Düz renkli JPEG üretir — ek yaprağı fikstürü (içerik önemsiz, ÖLÇÜ önemli). */
async function jpeg(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: "#ffffff" },
  })
    .jpeg()
    .toBuffer();
}

const META = {
  docNo: "EQ-02", projectName: "Ek Sayfa Testi", customer: "ORION",
  revLabel: "V0", revNo: 0, date: "11.08.2026",
};

const GROUPS = [
  {
    name: "Ana Kaldırma",
    rows: [
      {
        rowKey: "main:gearbox",
        component: "Redüktör",
        brand: "YILMAZ",
        model: "HT0823",
        spec: "i = 52,57",
        qty: 1,
        attachments: [{ fileName: "olcu.pdf", pageCount: 2 }],
      },
    ],
  },
];

describe("detaylı listenin ek sayfaları", () => {
  it("YATAY taranmış katalog sayfası YATAY basılır", async () => {
    // Ek sayfalar bir süre HEPSİ dikey basılıyordu; yatay bir ölçü tablosu
    // dikey A4'e sığdırılınca yüksekliğin üçte birine iniyor ve okunmuyordu
    // (kullanıcı bildirimi). Yön artık görüntünün ÖLÇÜSÜNDEN gelir.
    const pdf = await renderEquipmentPdf({
      meta: META,
      groups: GROUPS,
      sheetPages: [
        {
          keys: ["gearbox|yilmaz|ht0823"],
          title: "YILMAZ H serisi",
          model: "HT0823",
          source: "YILMAZ H KATALOG.pdf",
          printedPages: "s.44",
          images: [
            { data: await jpeg(1400, 990), format: "jpg", orientation: "landscape" },
            { data: await jpeg(990, 1400), format: "jpg", orientation: "portrait" },
          ],
        },
      ],
    });

    const belge = await PDFDocument.load(pdf, { updateMetadata: false });
    const yonler = belge
      .getPages()
      .map((p) => (p.getWidth() > p.getHeight() ? "yatay" : "dikey"));
    // Liste sayfası zaten yataydır; ek yaprakları: 1 yatay + 1 dikey.
    expect(yonler.slice(-2)).toEqual(["yatay", "dikey"]);
  }, 120_000);

  it("ek belge kapağı basılır ve sayfa adedini yazar", async () => {
    const pdf = await renderEquipmentPdf({
      meta: META,
      groups: GROUPS,
      attachmentCovers: [
        {
          rowKey: "main:gearbox",
          component: "Redüktör",
          fileName: "olcu.pdf",
          pageCount: 2,
        },
      ],
    });
    const belge = await PDFDocument.load(pdf, { updateMetadata: false });
    // Liste (en az 1 sayfa) + kapak
    expect(belge.getPageCount()).toBeGreaterThanOrEqual(2);
    // Kapak DİKEYDİR: yalnız başlık taşır, yatay basmanın bir gerekçesi yok.
    const son = belge.getPage(belge.getPageCount() - 1);
    expect(son.getWidth()).toBeLessThan(son.getHeight());
  }, 120_000);

  it("aynı satırın İKİ eki için çapa YALNIZ ilk kapakta olur", async () => {
    // İki kapak aynı adlandırılmış hedefi taşısaydı, listedeki bağlantının
    // hangi yaprağa gideceği belirsizleşirdi.
    const pdf = await renderEquipmentPdf({
      meta: META,
      groups: GROUPS,
      attachmentCovers: [
        { rowKey: "main:gearbox", component: "Redüktör", fileName: "a.pdf", pageCount: 1 },
        { rowKey: "main:gearbox", component: "Redüktör", fileName: "b.pdf", pageCount: 1 },
      ],
    });
    // Ölçüm ADLANDIRILMIŞ HEDEF AĞACINDAN yapılır, ham baytlardan değil:
    // aynı ad, listedeki bağlantının hedefi olarak da geçer ve bayt sayımı
    // ikisini ayırt edemez.
    const belge = await PDFDocument.load(pdf, { updateMetadata: false });
    const names = belge.context.lookup(belge.catalog.get(PDFName.of("Names")));
    const dests = belge.context.lookup(
      (names as PDFDict).get(PDFName.of("Dests"))
    );
    const agac = String(dests);
    expect(agac.split("ek-belge-main-gearbox").length - 1).toBe(1);
    // `id={undefined}` DE BİR HEDEFTİR: @react-pdf `'id' in props` diye bakar
    // ve tanımsız değeri "undefined" adlı bir hedef olarak yazar. Çapasız
    // kapak, alanı hiç taşımamalıdır.
    expect(agac).not.toContain("undefined");
    // İki kapak da basılmış olmalı — çapa tekilleşirken sayfa kaybolmasın.
    expect(belge.getPageCount()).toBeGreaterThanOrEqual(3);
  }, 120_000);
});
