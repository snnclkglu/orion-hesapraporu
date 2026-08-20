import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { renderToBuffer } from "@react-pdf/renderer";
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
        sources: {},
        images,
        docCode: "ORC-BK-0019-00-R01",
        docLine: "ORION CRANES · İŞLETME VE BAKIM EL KİTABI · V1 · 2026",
        company: { company: "ORION CRANES", address: "ANKARA · TÜRKİYE", web: "orioncranes.com" },
        bandLines: ["V1", "20.08.2026"],
      })
    );

    expect(bytes.subarray(0, 4).toString()).toBe("%PDF");
    expect(bytes.byteLength).toBeGreaterThan(100_000);

    const smokeOut = process.env.MANUAL_SMOKE_OUT;
    if (smokeOut) writeFileSync(smokeOut, bytes);
  }, 30_000);
});
