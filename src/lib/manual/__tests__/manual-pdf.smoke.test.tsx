import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { renderToBuffer } from "@react-pdf/renderer";
import { PDFArray, PDFDocument, PDFName } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { allBlocks, manualFromTemplate } from "@/lib/manual/payload";
import { manualAssetsFor } from "@/lib/manual/asset-bytes";
import { manualUsedAssetKeys } from "@/lib/manual/assets";
import { ManualPdf } from "@/lib/pdf/manual";

describe("ManualPdf smoke", () => {
  it("proje rapor firmasını, ek logo bandını, kapak görselini ve vektör işaretleriyle belgeyi basar", async () => {
    const payload = manualFromTemplate({
      manufacturer: "ORION CRANES",
      product: "ŞARJ VİNCİ",
      craneType: "GEZER KÖPRÜ VİNCİ",
      customer: "ÖRNEK MÜŞTERİ",
    });

    const assets = manualAssetsFor(manualUsedAssetKeys(allBlocks(payload.sections)));
    const logoBytes = readFileSync(path.join(process.cwd(), "public", "brand", "orion-logo.png"));
    const kapak = assets.find((asset) => asset.id === "halatSoketi1") ?? assets[0];
    expect(kapak).toBeDefined();

    const images = [
      ...assets,
      { id: "ortak-center", bytes: logoBytes, width: 596, height: 67 },
      { id: "ortak-right", bytes: logoBytes, width: 596, height: 67 },
      { id: "cover-image", bytes: kapak!.bytes, width: kapak!.width, height: kapak!.height },
    ];
    payload.partnerLogos = { centerImageId: "ortak-center", rightImageId: "ortak-right" };
    payload.coverImageId = "cover-image";
    payload.coverTitle = "ESKİ İŞ EMRİ BAŞLIĞI";

    const bytes = await renderToBuffer(
      ManualPdf({
        payload,
        sources: {
          // 7.4'ün gerçek 0019 ölçeğine yakın uzunluğu: tam genişlik dalı
          // satırları dilimlemezse react-pdf örtük sayfa açar ve sonraki
          // bölüm/folio haritası kayar. Duman çıktısı bunu görsel QA'ya taşır.
          electricalParts: Array.from({ length: 180 }, (_, index) => ({
            deviceTag: `=185T+LVD${(index % 12) + 1}-F${index + 1}`,
            installation: "185T",
            location: `LVD${(index % 12) + 1}`,
            device: `F${index + 1}`,
            qty: (index % 5) + 1,
            designation: `Elektrik malzemesi ${index + 1} uzun teknik tanımı`,
            typeNo: `6SL${String(index + 1).padStart(6, "0")}`,
            supplier: index % 2 === 0 ? "Siemens" : "Schneider Electric",
            partNo: `SIE.6SL${String(index + 1).padStart(6, "0")}`,
            page: index + 1,
          })),
        },
        images,
        partner: { name: "Karçel Ortak Firma", logo: logoBytes },
        projectTitle: "185/40 T X 18,28 M KAPASİTELİ DÖRT KİRİŞLİ KÖPRÜLÜ ŞARJ VİNCİ",
        craneLocation: "Çelikhane şarj holü tesisi",
        endCustomerLogo: logoBytes,
        coverSpecs: [
          { label: "VİNÇ TİPİ", value: "Şarj / Döküm Vinci" },
          { label: "KAPASİTE", value: "185 t / 40 t" },
          { label: "AÇIKLIK", value: "18,29 m" },
          { label: "KALDIRMA YÜKSEKLİĞİ", value: "19,5 m" },
          { label: "FEM SINIFI", value: "FEM 5M / ISO M8" },
          { label: "YÜK GRUBU", value: "H4/B6" },
          { label: "ÇELİK KONSTRÜKSİYON SINIFI", value: "A8" },
          { label: "KANCA TİPİ", value: "Kaldırma Kirişi" },
        ],
        coverMeta: {
          customer: "Kardemir A.Ş.",
          date: "AĞUSTOS 2026",
          preparedBy: "Sinan Çolakoğlu",
          checkedBy: "Sinan Çolakoğlu",
          revision: "R01",
        },
        docCode: "ORC-BK-0019-00-R01",
        docLine: "ORION CRANES · İŞLETME VE BAKIM EL KİTABI · V1 · 2026",
        company: { company: "ORION CRANES", address: "ANKARA · TÜRKİYE", web: "orioncranes.com" },
        bandLines: ["V1", "20.08.2026"],
        includedAppendices: [],
      })
    );

    expect(bytes.subarray(0, 4).toString()).toBe("%PDF");
    expect(bytes.byteLength).toBeGreaterThan(100_000);
    const { extractText, getDocumentProxy } = await import("unpdf");
    const textDocument = await getDocumentProxy(new Uint8Array(bytes));
    const { text } = await extractText(textDocument, { mergePages: true });
    expect(String(text)).toContain("KARÇEL ORTAK FİRMA");
    expect(String(text)).toContain("185/40 T X 18,28 M KAPASİTELİ");
    expect(String(text)).not.toContain("ESKİ İŞ EMRİ BAŞLIĞI");
    expect(String(text).toLocaleUpperCase("tr-TR")).not.toContain("PARTNER");
    const pdf = await PDFDocument.load(bytes, { updateMetadata: false });
    // Gövde çıktısı boş EK kapsayıcısı ve yedi ayraç kapağı taşımaz. 180
    // elektrik satırı da pano özetine iner; eski tam döküm 14 yaprak
    // üretiyordu. Bu üst sınır iki regresyonu birlikte yakalar.
    expect(pdf.getPageCount()).toBeLessThan(24);
    for (const page of pdf.getPages()) {
      expect(page.getWidth()).toBeCloseTo(595.28, 1);
      expect(page.getHeight()).toBeCloseTo(841.89, 1);
    }
    const linkCount = pdf.getPages().reduce((total, page) => {
      const annots = page.node.lookupMaybe(PDFName.of("Annots"), PDFArray);
      return total + (annots?.size() ?? 0);
    }, 0);
    // İçindekiler satırları gerçek PDF GoTo anotasyonlarıdır; yalnız renkli
    // metin olsaydı tıklama isteği görsel olarak geçer ama çalışmazdı.
    expect(linkCount).toBeGreaterThan(10);

    const smokeOut = process.env.MANUAL_SMOKE_OUT;
    if (smokeOut) writeFileSync(smokeOut, bytes);
  }, 30_000);
});
