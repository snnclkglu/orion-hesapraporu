import { describe, expect, it } from "vitest";
import { writeFileSync } from "node:fs";
import sharp from "sharp";
import { PDFDocument, PDFName, type PDFDict } from "pdf-lib";
import { renderEquipmentPdf, breakEquipmentModelCode } from "@/lib/pdf/equipment-report";
import {
  buildEquipmentGroups,
  buildSummarySections,
  rowCatalogSheetKey,
} from "@/lib/excel/equipment";
import { BRAND_LOGO_INK } from "@/lib/pdf/brand";
import { V5_TEMPLATE } from "@/lib/calc/defaults";
import { runCalc } from "@/lib/calc/engine";
import { summarySpecsForReport } from "@/lib/pdf/report";

describe("ekipman listesi PDF düzeni", () => {
  it("mekanik ve elektrik bölümlerini tek tabloda ayrı bantlarla basar", async () => {
    const sections = [
      {
        key: "mechanical" as const,
        name: "Mekanik Ekipmanlar",
        groups: [{
          name: "Ana Kaldırma",
          rows: [{ component: "Kaldırma Motoru", brand: "GAMAK", model: "M1", spec: "15 kW", qty: 1 }],
        }],
      },
      {
        key: "electrical" as const,
        name: "Elektrik Ekipmanları",
        groups: [{
          name: "Şalterler ve Devre Kesiciler",
          rows: [{ component: "CIRCUIT BREAKER", brand: "SIEMENS", model: "5SL6210-7", spec: "SIE.5SL6210-7", qty: 9 }],
        }],
      },
    ];
    const groups = sections.flatMap((section) => section.groups);
    const pdf = await renderEquipmentPdf({
      meta: {
        docNo: "EQ-00", projectName: "Birleşik Liste", customer: "ORION",
        revLabel: "V0", revNo: 0, date: "29.08.2026",
      },
      groups,
      sections,
      listTitle: "Tüm Ekipman Listesi",
    });
    const { extractText, getDocumentProxy } = await import("unpdf");
    const doc = await getDocumentProxy(new Uint8Array(pdf));
    const { text } = await extractText(doc, { mergePages: true });
    const content = String(text);

    expect(content).toContain("TÜM EKİPMAN LİSTESİ");
    expect(content).toContain("MEKANİK EKİPMANLAR");
    expect(content).toContain("ELEKTRİK EKİPMANLARI");
  }, 120_000);

  it("uzun katalog kodlarına satır kırma noktası ekler ve yatay PDF üretir", async () => {
    const model = "N(NV).250.HYD.050/090-200N";
    expect(breakEquipmentModelCode(model)).toContain("\u200B");

    const pdf = await renderEquipmentPdf({
      meta: {
        docNo: "EQ-01", projectName: "Uzun Kod Testi", customer: "ORION", revLabel: "V0", revNo: 0,
        date: "07.08.2026",
      },
      partner: { name: "Karçel Ortak Firma", logo: BRAND_LOGO_INK },
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
      mainDrawingUrl: `https://orion.example/paylas/resim/${"A".repeat(43)}`,
    });

    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
    expect(pdf.length).toBeGreaterThan(10 * 1024);
    const { extractText, getDocumentProxy } = await import("unpdf");
    const doc = await getDocumentProxy(new Uint8Array(pdf));
    const { text } = await extractText(doc, { mergePages: true });
    expect(String(text)).toContain("Proje Ana Paftasını Aç");
    expect(String(text)).toContain("KARÇEL ORTAK FİRMA");
    expect(String(text).toLocaleUpperCase("tr-TR")).not.toContain("PARTNER");
  }, 120_000);

  it("rapor firması kimliğini teknik özellikler, liste ve teknik özet yapraklarında korur", async () => {
    const input = structuredClone(V5_TEMPLATE);
    const pdf = await renderEquipmentPdf({
      meta: {
        docNo: "EQ-04",
        projectName: "Ortak Firmalı Çizim Paketi",
        customer: "Örnek Müşteri",
        revLabel: "Ön Tasarım",
        revNo: 1,
        date: "29.08.2026",
        preparedBy: "Sinan Çolakoğlu",
        checkedBy: "Alkım Kelleci",
      },
      partner: { name: "Karçel Ortak Firma", logo: BRAND_LOGO_INK },
      groups: buildEquipmentGroups(input),
      summary: buildSummarySections(input, runCalc(input)),
      specTable: { ...summarySpecsForReport(input), specs: input.specs },
    });

    const document = await PDFDocument.load(pdf, { updateMetadata: false });
    expect(document.getPageCount()).toBeGreaterThanOrEqual(3);
    const { extractText, getDocumentProxy } = await import("unpdf");
    const textDocument = await getDocumentProxy(new Uint8Array(pdf));
    const { text } = await extractText(textDocument, { mergePages: true });
    expect(String(text)).toContain("KARÇEL ORTAK FİRMA");
    expect(String(text).toLocaleUpperCase("tr-TR")).not.toContain("PARTNER");

    const smokeOut = process.env.EQUIPMENT_REPORT_BRAND_OUT;
    if (smokeOut) writeFileSync(smokeOut, pdf);
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

/** PDF sayfalarındaki bağlantı eylemlerinin `/URI` / `/GoTo` türleri. */
async function linkActionKinds(pdf: Uint8Array): Promise<string[]> {
  const document = await PDFDocument.load(pdf, { updateMetadata: false });
  const kinds: string[] = [];
  for (const page of document.getPages()) {
    const annotations = page.node.Annots();
    if (!annotations) continue;
    for (const ref of annotations.asArray()) {
      const annotation = document.context.lookup(ref) as PDFDict;
      const actionRef = annotation.get(PDFName.of("A"));
      if (!actionRef) continue;
      const action = document.context.lookup(actionRef) as PDFDict;
      const kind = action.get(PDFName.of("S"));
      if (kind) kinds.push(String(kind));
    }
  }
  return kinds;
}

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
  it("standart PDF dış, detaylı PDF belge içi katalog bağlantısı üretir", async () => {
    const row = {
      rowKey: "main:rope",
      kind: "rope",
      component: "Çelik Halat",
      brand: "HAŞÇELİK",
      model: "6X36 WS SAĞ HELİS",
      catalogModel: "Ø20 6x36 WS IWRC 1960 MPa",
      spec: "Ø20 mm · IWRC · 1960 MPa",
      qty: 2,
    };
    const key = rowCatalogSheetKey(row)!;
    const [standard, detailed] = await Promise.all([
      renderEquipmentPdf({
        meta: META,
        groups: [{ name: "Ana Kaldırma", rows: [row] }],
        sheetUrls: new Map([
          [key, "https://orion.example/paylas/katalog?tur=rope&model=halat"],
        ]),
      }),
      renderEquipmentPdf({
        meta: META,
        groups: [{ name: "Ana Kaldırma", rows: [row] }],
        sheetPages: [{
          keys: [key],
          title: "Haşçelik 6x36 WS",
          model: row.model,
          source: "Hasçelik 6x36 WS.pdf",
          printedPages: "s.1-2",
          images: [{
            data: await jpeg(990, 1400), format: "jpg", orientation: "portrait",
          }],
        }],
      }),
    ]);

    expect(await linkActionKinds(standard)).toContain("/URI");
    expect(await linkActionKinds(detailed)).toContain("/GoTo");
  }, 120_000);

  it("detaylı PDF'de elektrik teknik föyünün dış bağlantısını korur", async () => {
    const electricalRow = {
      rowKey: "electrical:0123456789abcdef",
      kind: "electrical",
      component: "CIRCUIT BREAKER",
      brand: "SIEMENS",
      model: "5SL6210-7",
      spec: "SIE.5SL6210-7",
      qty: 9,
    };
    const key = rowCatalogSheetKey(electricalRow)!;
    const pdf = await renderEquipmentPdf({
      meta: META,
      groups: [
        { name: "Şalterler", rows: [electricalRow] },
        ...GROUPS,
      ],
      sheetUrls: new Map([
        [key, "https://orion.example/api/electrical-catalog/foy-1"],
      ]),
      // Başka bir satırın eki belgeyi detaylı kipe geçirir. Elektrik satırının
      // dış föy bağlantısı bu kipte de `/URI` olarak kalmalıdır.
      attachmentCovers: [
        { rowKey: "main:gearbox", component: "Redüktör", fileName: "olcu.pdf", pageCount: 2 },
      ],
    });

    expect(await linkActionKinds(pdf)).toContain("/URI");
  }, 120_000);

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

/**
 * BOŞ İLK SAYFA KORUMASI (kullanıcı bildirimi, 12.08.2026).
 *
 * Grubun tamamını saran kutuya `minPresenceAhead` konduğunda react-pdf, grup
 * sayfaya SIĞSA BİLE bitişinden sonra istenen boşluk kalmıyorsa bloğu bütünüyle
 * sonraki yaprağa atıyordu: ilk içerik sayfasında yalnız marka bandı, künye ve tablo
 * başlığı kalıyor, tek bir satır bile basılmıyordu.
 *
 * Koşul DAR olduğu için tek bir fikstür yetmez — grup boyu taranır. Ölçüt
 * "kapaktan sonraki ilk içerik sayfasında en az bir EKİPMAN SATIRI var mı"dır;
 * sayfa sayısı değil, çünkü
 * hata sayfa sayısını her zaman artırmıyordu.
 */
describe("ilk sayfa boş kalmaz", () => {
  function satirlar(n: number, ofs = 0) {
    return Array.from({ length: n }, (_, i) => ({
      rowKey: `r${ofs + i}`,
      component: `Ekipman ${ofs + i + 1}`,
      brand: "SKF",
      model: `MODEL-${ofs + i + 1}`,
      spec: "C = 331 kN, C0 = 375 kN",
      qty: 2,
    }));
  }

  it("grup boyu ne olursa olsun tablo kapaktan sonraki İLK içerik sayfasında başlar", async () => {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const bos: number[] = [];
    // 6…22 satır: hatayı 16 ve 17 satırda üretiyordu (yatay A4, künyeli altbilgi).
    for (let n = 6; n <= 22; n += 1) {
      const pdf = await renderEquipmentPdf({
        meta: {
          docNo: "EQ-03", projectName: "Boş Sayfa Testi", customer: "ORION",
          revLabel: "V0", revNo: 0, date: "12.08.2026",
        },
        groups: [
          { name: "Ana Kaldırma", rows: satirlar(n) },
          { name: "Köprü Yürütme", rows: satirlar(12, 100) },
        ],
      });
      const doc = await getDocumentProxy(new Uint8Array(pdf));
      const { text } = await extractText(doc, { mergePages: false });
      const ilkIcerikSayfasi = (text as string[])[1].replace(/\s+/g, " ");
      if (!ilkIcerikSayfasi.includes("EKİPMAN 1 ")) bos.push(n);
    }
    expect(bos, `boş ilk sayfa üreten grup boyları: ${bos.join(", ")}`).toEqual([]);
  }, 300_000);
});
