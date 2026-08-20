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
  it("üçlü logo bandını, kapak görselini ve vektör işaretleriyle belgeyi basar", async () => {
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
      { id: "partner-center", bytes: logoBytes, width: 596, height: 67 },
      { id: "partner-right", bytes: logoBytes, width: 596, height: 67 },
      { id: "cover-image", bytes: kapak!.bytes, width: kapak!.width, height: kapak!.height },
    ];
    payload.partnerLogos = { centerImageId: "partner-center", rightImageId: "partner-right" };
    payload.coverImageId = "cover-image";

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
        docCode: "ORC-BK-0019-00-R01",
        docLine: "ORION CRANES · İŞLETME VE BAKIM EL KİTABI · V1 · 2026",
        company: { company: "ORION CRANES", address: "ANKARA · TÜRKİYE", web: "orioncranes.com" },
        bandLines: ["V1", "20.08.2026"],
      })
    );

    expect(bytes.subarray(0, 4).toString()).toBe("%PDF");
    expect(bytes.byteLength).toBeGreaterThan(100_000);
    const pdf = await PDFDocument.load(bytes, { updateMetadata: false });
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
